import express from "express";
import helmet from "helmet";
import multer from "multer";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import path from "node:path";
import { openDb } from "./db.js";
import { LocalStorage, processPhoto, validateGlb } from "./storage.js";
import { areas, recommended } from "./taxonomy.js";

export function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
function passwordValid(password, stored) {
  if (!stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    scryptSync(password, salt, 64),
  );
}
const digest = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
function str(v, max = 200) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw fail(400, `Please enter text between 1 and ${max} characters.`);
  return v.trim();
}
function integer(v, min, max) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw fail(400, `Enter a whole number between ${min} and ${max}.`);
  return n;
}
const vec = (v) =>
  Array.isArray(v) &&
  v.length === 3 &&
  v.every(
    (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 10000,
  );
function validateConfig(config) {
  if (
    !config ||
    typeof config !== "object" ||
    !Array.isArray(config.hotspots) ||
    config.hotspots.length > 100
  )
    throw fail(400, "Configuration needs a hotspots array (maximum 100).");
  if (
    !Number.isFinite(config.scale) ||
    config.scale <= 0 ||
    config.scale > 1000 ||
    !vec(config.rotation) ||
    !vec(config.target)
  )
    throw fail(400, "Provide scale, rotation [x,y,z] and target [x,y,z].");
  for (const h of config.hotspots) {
    if (
      !areas.some((a) => a.id === h.area) ||
      !vec(h.position) ||
      !vec(h.normal) ||
      Math.hypot(...h.normal) < 0.1
    )
      throw fail(
        400,
        "Each hotspot needs a valid area, position and outward normal.",
      );
  }
  if (
    config.meshes &&
    Object.entries(config.meshes).some(
      ([name, area]) => name.length > 200 || !areas.some((a) => a.id === area),
    )
  )
    throw fail(400, "Invalid mesh-to-area mapping.");
  if (
    config.cameras &&
    Object.entries(config.cameras).some(
      ([name, pos]) =>
        !areas.some((a) => a.id === name && a.group === "angle") || !vec(pos),
    )
  )
    throw fail(400, "Invalid camera preset.");
  return config;
}
export async function createApp({
  dataDir = process.env.DATA_DIR || ".data",
} = {}) {
  const app = express(),
    db = openDb(path.resolve(dataDir)),
    storage = new LocalStorage(path.join(path.resolve(dataDir), "private"));
  await storage.init();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "blob:", "data:"],
                connectSrc: ["'self'"],
                workerSrc: ["'self'", "blob:"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: null,
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-CarView-Request") !== "1")
        return next(fail(403, "Invalid request. Refresh and try again."));
      const origin = req.get("Origin");
      const allowed = process.env.APP_ORIGIN
        ? [process.env.APP_ORIGIN]
        : [
            `http://${req.get("host")}`,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
          ];
      if (origin && !allowed.includes(origin))
        return next(fail(403, "Origin is not permitted."));
    }
    const cookie = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("carview_session="))
      ?.slice(16);
    if (cookie) {
      const row = db
        .prepare(
          "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(digest(cookie), Date.now());
      if (row) req.user = row;
    }
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : next(fail(401, "Please sign in to continue."));
  const admin = (req, res, next) =>
    req.user?.role === "admin"
      ? next()
      : next(fail(403, "Administrator access required."));
  const rate = new Map();
  function limit(max, windowMs = 900000) {
    return (req, res, next) => {
      const key = req.path + ":" + req.socket.remoteAddress,
        now = Date.now();
      let r = rate.get(key);
      if (!r || r.until < now) {
        r = { n: 0, until: now + windowMs };
        rate.set(key, r);
      }
      if (++r.n > max)
        return next(fail(429, "Too many requests. Please try again later."));
      if (rate.size > 10000)
        for (const [k, v] of rate) if (v.until < now) rate.delete(k);
      next();
    };
  }
  function session(res, user) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
      digest(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("carview_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 86400000,
      path: "/",
    });
  }
  function listing(id, user, owner = false) {
    const l = db.prepare("SELECT * FROM listings WHERE id=?").get(id);
    if (!l || ((owner || l.status !== "published") && l.seller_id !== user?.id))
      throw fail(404, "Listing not found.");
    return l;
  }
  function photo(id, user, owner = false) {
    const p = db.prepare("SELECT * FROM photos WHERE id=?").get(id);
    if (!p) throw fail(404, "Photo not found.");
    listing(p.listing_id, user, owner);
    return p;
  }
  function assetRow(a) {
    return a
      ? { ...a, config: JSON.parse(a.config), approved: !!a.approved }
      : null;
  }
  function listingData(l) {
    const vehicle = db
      .prepare("SELECT * FROM catalog WHERE id=?")
      .get(l.catalog_id);
    const photos = db
      .prepare(
        "SELECT id,note,sort_order FROM photos WHERE listing_id=? ORDER BY sort_order,id",
      )
      .all(l.id)
      .map((p) => ({
        ...p,
        areas: db
          .prepare("SELECT area_id FROM photo_areas WHERE photo_id=?")
          .all(p.id)
          .map((a) => a.area_id),
      }));
    const markers = db
      .prepare("SELECT * FROM markers WHERE listing_id=?")
      .all(l.id)
      .map((m) => ({
        ...m,
        damage: !!m.damage,
        position: JSON.parse(m.position),
      }));
    const asset = l.asset_id
      ? assetRow(
          db
            .prepare("SELECT * FROM assets WHERE id=? AND approved=1")
            .get(l.asset_id),
        )
      : null;
    const { seller_id, ...safe } = l;
    return {
      ...safe,
      vehicle,
      photos,
      markers,
      asset,
      spin: {
        confirmed: !!db
          .prepare("SELECT confirmed FROM photo_spins WHERE listing_id=?")
          .get(l.id)?.confirmed,
        loop: !!db
          .prepare("SELECT loop FROM photo_spins WHERE listing_id=?")
          .get(l.id)?.loop,
        ids: db
          .prepare(
            "SELECT photo_id FROM spin_frames WHERE listing_id=? ORDER BY frame_order",
          )
          .all(l.id)
          .map((f) => f.photo_id),
      },
      unavailable: JSON.parse(l.unavailable),
      coverage: recommended.filter((id) =>
        photos.some((p) => p.areas.includes(id)),
      ).length,
      recommended: recommended.length,
    };
  }
  function areaIds(values, l) {
    if (!Array.isArray(values) || values.length > 60)
      throw fail(400, "Select up to 60 photo labels.");
    const valid = new Set([
      ...areas.map((a) => a.id),
      ...db
        .prepare("SELECT id FROM markers WHERE listing_id=?")
        .all(l.id)
        .map((m) => m.id),
    ]);
    if (values.some((id) => !valid.has(id)))
      throw fail(400, "Unknown photo area.");
    return [...new Set(values)];
  }
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/taxonomy", (_req, res) => res.json({ areas, recommended }));
  app.get("/api/catalog", (_req, res) =>
    res.json(
      db
        .prepare(
          "SELECT c.*, EXISTS(SELECT 1 FROM assets a WHERE a.catalog_id=c.id AND a.approved=1) AS supported FROM catalog c ORDER BY make,model",
        )
        .all(),
    ),
  );
  app.get("/api/me", (req, res) => res.json(req.user || null));
  app.post("/api/auth/register", limit(12), (req, res) => {
    const name = str(req.body.name, 80),
      email = str(req.body.email, 180).toLowerCase(),
      password = str(req.body.password, 128);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10)
      throw fail(
        400,
        "Use a valid email and a password of at least 10 characters.",
      );
    if (db.prepare("SELECT id FROM users WHERE email=?").get(email))
      throw fail(409, "An account already exists with that email.");
    const user = { id: randomUUID(), name, email, role: "seller" };
    db.prepare("INSERT INTO users(id,name,email,password) VALUES(?,?,?,?)").run(
      user.id,
      name,
      email,
      passwordHash(password),
    );
    session(res, user);
    res.status(201).json(user);
  });
  app.post("/api/auth/login", limit(25), (req, res) => {
    const u = db
      .prepare("SELECT * FROM users WHERE email=?")
      .get(str(req.body.email, 180).toLowerCase());
    const password = str(req.body.password, 128);
    if (!u || !passwordValid(password, u.password))
      throw fail(401, "Email or password is incorrect.");
    session(res, u);
    const { password: _, ...user } = u;
    res.json(user);
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("carview_session="))
      ?.slice(16);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
    res.clearCookie("carview_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/listings", (req, res) => {
    const page = integer(req.query.page || 1, 1, 10000),
      mine = req.query.mine === "1";
    if (mine && !req.user) throw fail(401, "Please sign in.");
    const rows = mine
      ? db
          .prepare(
            "SELECT * FROM listings WHERE seller_id=? ORDER BY created_at DESC LIMIT 20 OFFSET ?",
          )
          .all(req.user.id, (page - 1) * 20)
      : db
          .prepare(
            "SELECT * FROM listings WHERE status='published' ORDER BY demo,created_at DESC LIMIT 20 OFFSET ?",
          )
          .all((page - 1) * 20);
    res.json({
      items: rows.map(listingData),
      page,
      hasMore: rows.length === 20,
    });
  });
  app.get("/api/listings/:id", (req, res) =>
    res.json(listingData(listing(req.params.id, req.user))),
  );
  function fields(body) {
    const c = db
      .prepare("SELECT * FROM catalog WHERE id=?")
      .get(str(body.catalog_id));
    if (!c) throw fail(400, "Choose a catalog vehicle.");
    return {
      catalog_id: c.id,
      title: str(body.title, 120),
      year: integer(body.year, c.year_from, c.year_to),
      price: integer(body.price, 1, 1000000000),
      mileage: integer(body.mileage, 0, 3000000),
      city: str(body.city, 80),
      description: str(body.description, 5000),
    };
  }
  app.post("/api/listings", auth, (req, res) => {
    const f = fields(req.body),
      id = randomUUID(),
      asset = db
        .prepare(
          "SELECT id FROM assets WHERE catalog_id=? AND approved=1 ORDER BY version DESC LIMIT 1",
        )
        .get(f.catalog_id);
    db.prepare(
      "INSERT INTO listings(id,seller_id,catalog_id,asset_id,title,year,price,mileage,city,description) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      req.user.id,
      f.catalog_id,
      asset?.id || null,
      f.title,
      f.year,
      f.price,
      f.mileage,
      f.city,
      f.description,
    );
    res.status(201).json(listingData(listing(id, req.user)));
  });
  app.patch("/api/listings/:id", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true),
      f = fields(req.body);
    if (l.catalog_id !== f.catalog_id)
      throw fail(
        400,
        "Vehicle identity cannot be changed after creation. Create a new listing.",
      );
    const unavailable = areaIds(req.body.unavailable || [], l);
    db.prepare(
      "UPDATE listings SET title=?,year=?,price=?,mileage=?,city=?,description=?,unavailable=? WHERE id=?",
    ).run(
      f.title,
      f.year,
      f.price,
      f.mileage,
      f.city,
      f.description,
      JSON.stringify(unavailable),
      l.id,
    );
    res.json(listingData(listing(l.id, req.user)));
  });
  app.post("/api/listings/:id/publish", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true);
    const photos = db
      .prepare("SELECT id FROM photos WHERE listing_id=?")
      .all(l.id);
    if (!photos.length)
      throw fail(
        400,
        "Upload and label at least one actual photo before publishing.",
      );
    if (
      photos.some(
        (p) =>
          !db.prepare("SELECT 1 FROM photo_areas WHERE photo_id=?").get(p.id) &&
          !db
            .prepare(
              "SELECT 1 FROM spin_frames f JOIN photo_spins s ON s.listing_id=f.listing_id WHERE f.photo_id=? AND s.confirmed=1",
            )
            .get(p.id),
      )
    )
      throw fail(
        400,
        "Confirm an area label for each photo, or include it in a confirmed photo walk-around.",
      );
    db.prepare("UPDATE listings SET status='published' WHERE id=?").run(l.id);
    res.json(listingData(listing(l.id, req.user)));
  });
  app.post("/api/listings/:id/unpublish", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true);
    db.prepare("UPDATE listings SET status='draft' WHERE id=?").run(l.id);
    res.json({ ok: true });
  });
  const uploads = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 6, fields: 3 },
  }).array("photos", 6);
  app.post(
    "/api/listings/:id/photos",
    auth,
    limit(100, 3600000),
    (req, res, next) => {
      try {
        listing(req.params.id, req.user, true);
        next();
      } catch (e) {
        next(e);
      }
    },
    uploads,
    async (req, res) => {
      const l = listing(req.params.id, req.user, true),
        files = req.files || [];
      if (!files.length) throw fail(400, "Select at least one image.");
      const count = db
        .prepare("SELECT count(*) n FROM photos WHERE listing_id=?")
        .get(l.id).n;
      if (count + files.length > 60)
        throw fail(400, "Maximum 60 photos per listing.");
      const created = [];
      try {
        for (const file of files) {
          const p = await processPhoto(storage, file.buffer);
          created.push(p);
        }
      } catch (e) {
        await Promise.all(
          created
            .flatMap((p) => [p.original, p.display, p.thumbnail])
            .map((k) => storage.remove(k)),
        );
        throw fail(
          400,
          "Image could not be decoded. Use JPEG, PNG or WebP under 10 MB (40 megapixels maximum).",
        );
      }
      try {
        db.exec("BEGIN");
        // Recheck inside the write transaction after asynchronous image processing.
        const currentCount = db
          .prepare("SELECT count(*) n FROM photos WHERE listing_id=?")
          .get(l.id).n;
        if (currentCount + created.length > 60)
          throw fail(400, "Maximum 60 photos per listing.");
        created.forEach((p, i) =>
          db
            .prepare(
              "INSERT INTO photos(id,listing_id,original,display,thumbnail,mime,size,sort_order) VALUES(?,?,?,?,?,?,?,?)",
            )
            .run(
              p.id,
              l.id,
              p.original,
              p.display,
              p.thumbnail,
              p.mime,
              p.size,
              currentCount + i,
            ),
        );
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        await Promise.all(
          created
            .flatMap((p) => [p.original, p.display, p.thumbnail])
            .map((k) => storage.remove(k)),
        );
        throw e;
      }
      res.status(201).json(listingData(listing(l.id, req.user)));
    },
  );
  app.patch("/api/photos/:id", auth, (req, res) => {
    const p = photo(req.params.id, req.user, true),
      l = listing(p.listing_id, req.user, true),
      ids = areaIds(req.body.areas, l),
      note = typeof req.body.note === "string" ? req.body.note.trim() : "";
    if (note.length > 1000)
      throw fail(400, "Keep notes under 1,000 characters.");
    db.exec("BEGIN");
    try {
      db.prepare("UPDATE photos SET note=? WHERE id=?").run(note, p.id);
      db.prepare("DELETE FROM photo_areas WHERE photo_id=?").run(p.id);
      ids.forEach((id) =>
        db.prepare("INSERT INTO photo_areas VALUES(?,?)").run(p.id, id),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ ok: true });
  });
  app.post("/api/listings/:id/reorder", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true),
      ids = req.body.ids,
      actual = db
        .prepare("SELECT id FROM photos WHERE listing_id=?")
        .all(l.id)
        .map((p) => p.id);
    if (
      !Array.isArray(ids) ||
      new Set(ids).size !== actual.length ||
      ids.length !== actual.length ||
      ids.some((id) => !actual.includes(id))
    )
      throw fail(400, "Provide every photo exactly once.");
    ids.forEach((id, i) =>
      db.prepare("UPDATE photos SET sort_order=? WHERE id=?").run(i, id),
    );
    res.json({ ok: true });
  });
  app.put("/api/listings/:id/spin", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true),
      { ids, confirmed, loop } = req.body;
    if (
      !Array.isArray(ids) ||
      ids.length > 60 ||
      ids.some((id) => typeof id !== "string") ||
      new Set(ids).size !== ids.length ||
      typeof confirmed !== "boolean" ||
      typeof loop !== "boolean"
    )
      throw fail(
        400,
        "Provide unique photo IDs and boolean confirmation/loop settings.",
      );
    const owned = new Set(
      db
        .prepare("SELECT id FROM photos WHERE listing_id=?")
        .all(l.id)
        .map((p) => p.id),
    );
    if (ids.some((id) => !owned.has(id)))
      throw fail(400, "Every frame must belong to this listing.");
    if (confirmed && ids.length < 2)
      throw fail(400, "A photo sequence needs at least two uploaded photos.");
    if (loop && (!confirmed || ids.length < 12))
      throw fail(
        400,
        "A full 360 loop needs at least 12 photos and seller confirmation of one complete, ordered lap.",
      );
    db.exec("BEGIN");
    try {
      db.prepare(
        "INSERT INTO photo_spins(listing_id,confirmed,loop) VALUES(?,?,?) ON CONFLICT(listing_id) DO UPDATE SET confirmed=excluded.confirmed,loop=excluded.loop",
      ).run(l.id, confirmed ? 1 : 0, loop ? 1 : 0);
      db.prepare("DELETE FROM spin_frames WHERE listing_id=?").run(l.id);
      ids.forEach((photoId, i) =>
        db
          .prepare("INSERT INTO spin_frames VALUES(?,?,?)")
          .run(l.id, photoId, i),
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json(listingData(listing(l.id, req.user)));
  });
  app.delete("/api/photos/:id", auth, async (req, res) => {
    const p = photo(req.params.id, req.user, true);
    db.prepare(
      "UPDATE photo_spins SET confirmed=0,loop=0 WHERE listing_id IN(SELECT listing_id FROM spin_frames WHERE photo_id=?)",
    ).run(p.id);
    db.prepare("DELETE FROM photos WHERE id=?").run(p.id);
    await Promise.all(
      [p.original, p.display, p.thumbnail].map((k) => storage.remove(k)),
    );
    res.json({ ok: true });
  });
  app.get("/media/photos/:id/:kind", (req, res) => {
    const p = photo(req.params.id, req.user);
    if (!["display", "thumbnail"].includes(req.params.kind))
      throw fail(404, "Image not found.");
    res.setHeader("Cache-Control", "private, no-store");
    res.type("webp").sendFile(storage.resolve(p[req.params.kind]));
  });
  app.get("/api/photos/:id/original", auth, (req, res) => {
    const p = photo(req.params.id, req.user, true);
    res
      .type(p.mime)
      .download(
        storage.resolve(p.original),
        `carview-${p.id}.${p.mime.split("/")[1]}`,
      );
  });
  app.post("/api/listings/:id/markers", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true);
    if (!l.asset_id)
      throw fail(
        400,
        "Custom markers need a pinned approved 3D asset. Use standard photo labels for unsupported vehicles.",
      );
    if (!vec(req.body.position))
      throw fail(400, "Choose a valid model-local position.");
    if (
      db.prepare("SELECT count(*) n FROM markers WHERE listing_id=?").get(l.id)
        .n >= 30
    )
      throw fail(400, "Maximum 30 custom markers.");
    const id = "detail_" + randomUUID();
    db.prepare("INSERT INTO markers VALUES(?,?,?,?,?,?)").run(
      id,
      l.id,
      l.asset_id,
      str(req.body.label, 100),
      req.body.damage ? 1 : 0,
      JSON.stringify(req.body.position),
    );
    res.status(201).json({ id });
  });
  app.delete("/api/listings/:id/markers/:marker", auth, (req, res) => {
    const l = listing(req.params.id, req.user, true);
    db.prepare(
      "DELETE FROM photo_areas WHERE area_id IN(SELECT id FROM markers WHERE id=? AND listing_id=?)",
    ).run(req.params.marker, l.id);
    db.prepare("DELETE FROM markers WHERE id=? AND listing_id=?").run(
      req.params.marker,
      l.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/admin/assets", auth, admin, (_req, res) =>
    res.json(
      db
        .prepare("SELECT * FROM assets ORDER BY created_at DESC")
        .all()
        .map(assetRow),
    ),
  );
  app.post("/api/admin/catalog", auth, admin, (req, res) => {
    const b = req.body,
      id = randomUUID();
    const from = integer(b.year_from, 1950, 2035),
      to = integer(b.year_to, from, 2035);
    db.prepare("INSERT INTO catalog VALUES(?,?,?,?,?,?,?,?,?)").run(
      id,
      str(b.make, 80),
      str(b.model, 80),
      str(b.generation, 120),
      from,
      to,
      str(b.facelift, 120),
      str(b.variant, 120),
      str(b.market, 120),
    );
    res.status(201).json({ id });
  });
  app.patch("/api/admin/catalog/:id", auth, admin, (req, res) => {
    if (
      db
        .prepare("SELECT id FROM listings WHERE catalog_id=? LIMIT 1")
        .get(req.params.id)
    )
      throw fail(
        409,
        "This catalog identity is used by listings. Add a new entry to preserve their vehicle match.",
      );
    const b = req.body,
      from = integer(b.year_from, 1950, 2035),
      to = integer(b.year_to, from, 2035);
    db.prepare(
      "UPDATE catalog SET make=?,model=?,generation=?,year_from=?,year_to=?,facelift=?,variant=?,market=? WHERE id=?",
    ).run(
      str(b.make, 80),
      str(b.model, 80),
      str(b.generation, 120),
      from,
      to,
      str(b.facelift, 120),
      str(b.variant, 120),
      str(b.market, 120),
      req.params.id,
    );
    res.json({ ok: true });
  });
  const assetUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024,
      files: 1,
      fieldSize: 100000,
      fields: 10,
    },
  }).single("asset");
  app.post("/api/admin/assets", auth, admin, assetUpload, async (req, res) => {
    const b = req.body;
    if (!req.file) throw fail(400, "Select a self-contained GLB.");
    try {
      validateGlb(req.file.buffer);
    } catch (e) {
      throw fail(400, e.message);
    }
    if (!db.prepare("SELECT id FROM catalog WHERE id=?").get(b.catalog_id))
      throw fail(400, "Unknown catalog vehicle.");
    let config;
    try {
      config = validateConfig(JSON.parse(b.config));
    } catch (e) {
      throw fail(400, e.status ? e.message : "Invalid configuration JSON.");
    }
    const source = str(b.source_url, 1000);
    if (!/^https:\/\//.test(source))
      throw fail(400, "Use an HTTPS provenance URL.");
    const id = randomUUID(),
      key = id + ".glb",
      version = db
        .prepare(
          "SELECT COALESCE(MAX(version),0)+1 n FROM assets WHERE catalog_id=?",
        )
        .get(b.catalog_id).n;
    const creator = str(b.creator, 200),
      license = str(b.license, 1000),
      attribution = str(b.attribution, 1000),
      limitations = str(b.limitations, 2000);
    await storage.put(key, req.file.buffer);
    try {
      db.prepare(
        "INSERT INTO assets(id,catalog_id,version,filename,size,source_url,creator,license,attribution,limitations,config) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        b.catalog_id,
        version,
        key,
        req.file.size,
        source,
        creator,
        license,
        attribution,
        limitations,
        JSON.stringify(config),
      );
    } catch (e) {
      await storage.remove(key);
      throw e;
    }
    res
      .status(201)
      .json(assetRow(db.prepare("SELECT * FROM assets WHERE id=?").get(id)));
  });
  app.post("/api/admin/assets/:id/approve", auth, admin, (req, res) => {
    if (req.body.confirmed !== true)
      throw fail(
        400,
        "Confirm license rights and exact Pakistani vehicle geometry after testing.",
      );
    if (!db.prepare("SELECT id FROM assets WHERE id=?").get(req.params.id))
      throw fail(404, "Asset not found.");
    db.prepare("UPDATE assets SET approved=1 WHERE id=?").run(req.params.id);
    res.json({ ok: true });
  });
  app.get("/media/assets/:id", (req, res) => {
    const a = db.prepare("SELECT * FROM assets WHERE id=?").get(req.params.id);
    if (!a || (!a.approved && req.user?.role !== "admin"))
      throw fail(404, "Asset not found.");
    res
      .type("model/gltf-binary")
      .setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(storage.resolve(a.filename));
  });
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve("dist")));
    app.get("/{*splat}", (req, res, next) =>
      req.path.startsWith("/api/") || req.path.startsWith("/media/")
        ? next()
        : res.sendFile(path.resolve("dist/index.html")),
    );
  }
  app.use((req, res, next) => next(fail(404, "Not found.")));
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = err instanceof multer.MulterError ? 400 : err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      error:
        err instanceof multer.MulterError
          ? "Upload limit exceeded. Images: 10 MB each, up to 6 at a time. GLB: 25 MB."
          : status >= 500
            ? "Something went wrong. Please try again."
            : err.message,
    });
  });
  return { app, db, storage };
}
