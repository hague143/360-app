import { randomUUID } from "node:crypto";
import { processPhoto, validateGlb } from "./storage.js";
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (value, max) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw fail(400, "Please complete the asset metadata.");
  return value.trim();
};
export function registerDirectUploads(
  app,
  { db, storage, auth, listing, listingData, assetRow, validateConfig },
) {
  app.get("/api/runtime", (_req, res) =>
    res.json({
      directUploads: !!storage.directUploads,
      maxPhotoBytes: 10 * 1024 * 1024,
      maxAssetBytes: 25 * 1024 * 1024,
    }),
  );
  if (!storage.directUploads) return;
  app.post("/api/uploads/prepare", auth, async (req, res) => {
    const b = req.body,
      kind = b.kind;
    if (!["photo", "asset"].includes(kind))
      throw fail(400, "Unknown upload kind.");
    const max = kind === "photo" ? 10 * 1024 * 1024 : 25 * 1024 * 1024,
      size = Number(b.size);
    if (!Number.isInteger(size) || size < 1 || size > max)
      throw fail(400, `File exceeds the ${max / 1024 / 1024} MB limit.`);
    let l = null,
      metadata = {};
    if (kind === "photo") {
      l = await listing(b.listing_id, req.user, true);
      const count = await db
        .prepare("SELECT count(*) n FROM photos WHERE listing_id=?")
        .get(l.id);
      if (count.n >= 60) throw fail(400, "Maximum 60 photos per listing.");
    } else {
      if (req.user.role !== "admin")
        throw fail(403, "Administrator access required.");
      if (
        !(await db
          .prepare("SELECT id FROM catalog WHERE id=?")
          .get(b.catalog_id))
      )
        throw fail(400, "Unknown catalog vehicle.");
      let config;
      try {
        config = validateConfig(
          typeof b.config === "string" ? JSON.parse(b.config) : b.config,
        );
      } catch {
        throw fail(400, "Invalid asset/hotspot configuration.");
      }
      const source = text(b.source_url, 1000);
      if (!/^https:\/\//.test(source))
        throw fail(400, "Use an HTTPS provenance URL.");
      metadata = {
        catalog_id: b.catalog_id,
        source_url: source,
        creator: text(b.creator, 200),
        license: text(b.license, 1000),
        attribution: text(b.attribution, 1000),
        limitations: text(b.limitations, 2000),
        config,
      };
    }
    const now = Date.now(),
      id = randomUUID(),
      key = id + (kind === "photo" ? ".original" : ".glb");
    await db.exec("BEGIN");
    try {
      if (db.isPostgres)
        await db
          .prepare("SELECT id FROM users WHERE id=? FOR UPDATE")
          .get(req.user.id);
      const pending = await db
        .prepare(
          "SELECT count(*) n FROM upload_tickets WHERE owner_id=? AND state IN('pending','processing') AND expires>?",
        )
        .get(req.user.id, now);
      const recent = await db
        .prepare(
          "SELECT count(*) n FROM upload_tickets WHERE owner_id=? AND expires>?",
        )
        .get(req.user.id, now - 45 * 60000);
      if (pending.n >= 12 || recent.n >= 120)
        throw fail(
          429,
          "Upload limit reached. Complete current uploads or try again later.",
        );
      await db
        .prepare(
          "INSERT INTO upload_tickets(id,owner_id,listing_id,kind,object_key,size,metadata,expires) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          id,
          req.user.id,
          l?.id || null,
          kind,
          key,
          size,
          JSON.stringify(metadata),
          now + 15 * 60000,
        );
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
    try {
      const url = await storage.uploadUrl(key);
      res
        .status(201)
        .json({ id, url, method: "PUT", completeBefore: now + 15 * 60000 });
    } catch {
      await db
        .prepare("UPDATE upload_tickets SET state='failed' WHERE id=?")
        .run(id);
      throw fail(503, "Upload storage is unavailable.");
    }
  });
  app.post("/api/uploads/:id/complete", auth, async (req, res) => {
    const ticket = await db
      .prepare("SELECT * FROM upload_tickets WHERE id=? AND owner_id=?")
      .get(req.params.id, req.user.id);
    if (!ticket) throw fail(404, "Upload not found.");
    if (ticket.kind === "photo")
      await listing(ticket.listing_id, req.user, true);
    else if (req.user.role !== "admin")
      throw fail(403, "Administrator access required.");
    if (ticket.state === "complete") {
      if (ticket.kind === "photo")
        return res.json(
          await listingData(await listing(ticket.listing_id, req.user, true)),
        );
      return res.json(
        assetRow(
          await db
            .prepare("SELECT * FROM assets WHERE id=?")
            .get(ticket.result_id),
        ),
      );
    }
    if (ticket.expires < Date.now())
      throw fail(410, "Upload link expired. Upload the file again.");
    const claim = await db
      .prepare(
        "UPDATE upload_tickets SET state='processing' WHERE id=? AND state='pending' RETURNING id",
      )
      .get(ticket.id);
    if (!claim)
      throw fail(
        409,
        "This upload is already being processed or failed. Start a new upload if needed.",
      );
    let created = null,
      assetKey = null,
      committed = false;
    try {
      const buffer = await storage.read(ticket.object_key);
      if (
        buffer.length !== ticket.size ||
        buffer.length > (ticket.kind === "photo" ? 10 : 25) * 1024 * 1024
      )
        throw fail(400, "Uploaded file size did not match its upload ticket.");
      if (ticket.kind === "photo") {
        try {
          created = await processPhoto(storage, buffer);
        } catch {
          throw fail(
            400,
            "Image could not be decoded. Use a single JPEG, PNG or WebP under 10 MB and 40 megapixels.",
          );
        }
        await db.exec("BEGIN");
        try {
          if (db.isPostgres)
            await db
              .prepare("SELECT id FROM listings WHERE id=? FOR UPDATE")
              .get(ticket.listing_id);
          const count = await db
            .prepare("SELECT count(*) n FROM photos WHERE listing_id=?")
            .get(ticket.listing_id);
          if (count.n >= 60) throw fail(400, "Maximum 60 photos per listing.");
          await db
            .prepare(
              "INSERT INTO photos(id,listing_id,original,display,thumbnail,mime,size,sort_order) VALUES(?,?,?,?,?,?,?,?)",
            )
            .run(
              created.id,
              ticket.listing_id,
              created.original,
              created.display,
              created.thumbnail,
              created.mime,
              created.size,
              count.n,
            );
          await db
            .prepare(
              "UPDATE upload_tickets SET state='complete',result_id=? WHERE id=?",
            )
            .run(created.id, ticket.id);
          await db.exec("COMMIT");
          committed = true;
        } catch (e) {
          await db.exec("ROLLBACK");
          throw e;
        }
        // No longer used as a source object; originals created by processPhoto stay private.
        await storage.remove(ticket.object_key).catch(() => {});
        return res
          .status(201)
          .json(
            await listingData(await listing(ticket.listing_id, req.user, true)),
          );
      }
      try {
        validateGlb(buffer);
      } catch (e) {
        throw fail(400, e.message);
      }
      const meta = JSON.parse(ticket.metadata),
        id = randomUUID();
      assetKey = id + ".glb";
      await storage.put(assetKey, buffer);
      await db.exec("BEGIN");
      try {
        if (db.isPostgres)
          await db
            .prepare("SELECT id FROM catalog WHERE id=? FOR UPDATE")
            .get(meta.catalog_id);
        const version = (
          await db
            .prepare(
              "SELECT COALESCE(MAX(version),0)+1 n FROM assets WHERE catalog_id=?",
            )
            .get(meta.catalog_id)
        ).n;
        await db
          .prepare(
            "INSERT INTO assets(id,catalog_id,version,filename,size,source_url,creator,license,attribution,limitations,config) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            id,
            meta.catalog_id,
            version,
            assetKey,
            buffer.length,
            meta.source_url,
            meta.creator,
            meta.license,
            meta.attribution,
            meta.limitations,
            JSON.stringify(meta.config),
          );
        await db
          .prepare(
            "UPDATE upload_tickets SET state='complete',result_id=? WHERE id=?",
          )
          .run(id, ticket.id);
        await db.exec("COMMIT");
        committed = true;
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
      await storage.remove(ticket.object_key).catch(() => {});
      return res
        .status(201)
        .json(
          assetRow(await db.prepare("SELECT * FROM assets WHERE id=?").get(id)),
        );
    } catch (e) {
      if (created && !committed)
        await Promise.all(
          [created.original, created.display, created.thumbnail].map((key) =>
            storage.remove(key).catch(() => {}),
          ),
        );
      if (assetKey && !committed)
        await storage.remove(assetKey).catch(() => {});
      await storage.remove(ticket.object_key).catch(() => {});
      await db
        .prepare(
          "UPDATE upload_tickets SET state='failed' WHERE id=? AND state<>'complete'",
        )
        .run(ticket.id);
      throw e;
    }
  });
}
