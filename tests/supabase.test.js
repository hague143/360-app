import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { postgresFixture } from "./postgres-fixture.js";
import { storageFixture } from "./supabase-fixture.js";
import { triangleGlb, testConfig } from "./fixtures.js";
import { postgresSql } from "../server/postgres.js";
let pgFixture,
  files,
  db,
  instance,
  server,
  base,
  listing,
  photo,
  ticket,
  original;
const owner = { cookie: "" },
  other = { cookie: "" },
  admin = { cookie: "" },
  anon = { cookie: "" };
async function req(
  route,
  { method = "GET", body, user = anon, redirect = "follow" } = {},
) {
  const response = await fetch(base + route, {
    method,
    redirect,
    headers: {
      "Content-Type": "application/json",
      "X-CarView-Request": "1",
      ...(user.cookie ? { Cookie: user.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.headers.get("set-cookie"))
    user.cookie = response.headers.get("set-cookie").split(";")[0];
  return response;
}
async function start() {
  db = await pgFixture.connect();
  instance = await createApp({ db, storage: files.storage() });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
}
before(async () => {
  pgFixture = await postgresFixture();
  files = await storageFixture();
  await start();
  original = await sharp({
    create: { width: 100, height: 80, channels: 3, background: "#819982" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
});
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await db?.close();
  await files?.close();
  await pgFixture?.close();
});
const input = {
  catalog_id: "toyota-corolla-e170-pk",
  title: "TEST cloud listing",
  year: 2020,
  price: 1,
  mileage: 0,
  city: "Test",
  description: "Test fixture, not a real advertisement.",
};
test("Postgres SQL keeps values separate and preserves literals; setup is idempotent and private", async () => {
  assert.equal(
    postgresSql(
      "SELECT '?' AS literal FROM users WHERE id=? AND name='users?'",
    ),
    "SELECT '?' AS literal FROM carview.users WHERE id=$1 AND name='users?'",
  );
  const c = await db.prepare("SELECT * FROM catalog").all();
  assert.equal(c.length, 3);
  const { rows } = await db.exec(
    "SELECT relrowsecurity FROM pg_class WHERE oid='carview.photos'::regclass",
  );
  assert.equal(rows[0].relrowsecurity, true);
  await db.withContext(async () => {
    await db.exec("BEGIN");
    try {
      await db.exec("SET LOCAL ROLE anon");
      const result = await db.exec(
        "SELECT id FROM storage.objects ORDER BY id",
      );
      assert.deepEqual(result.rows, [{ id: "other" }]);
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  });
  await files.storage().init();
  files.setPublic(true);
  await assert.rejects(files.storage().init(), /must be private/);
  files.setPublic(false);
});
test("cloud accounts persist in PostgreSQL and drafts enforce ownership", async () => {
  for (const [u, email] of [
    [owner, "pg-owner@example.com"],
    [other, "pg-other@example.com"],
    [admin, "pg-admin@example.com"],
  ]) {
    const r = await req("/api/auth/register", {
      method: "POST",
      user: u,
      body: { name: "Cloud Test", email, password: "cloud-test-password-long" },
    });
    assert.equal(r.status, 201);
  }
  await db
    .prepare("UPDATE users SET role='admin' WHERE email=?")
    .run("pg-admin@example.com");
  let r = await req("/api/listings", {
    method: "POST",
    body: input,
    user: owner,
  });
  assert.equal(r.status, 201);
  listing = await r.json();
  assert.equal(
    (await req("/api/listings/" + listing.id, { user: other })).status,
    404,
  );
  assert.equal((await req("/api/runtime")).status, 200);
  assert.equal((await (await req("/api/runtime")).json()).directUploads, true);
});
test("direct upload grants are owner-bound, size-limited and private; originals avoid the API request body", async () => {
  assert.equal(
    (
      await req("/api/uploads/prepare", {
        method: "POST",
        body: { kind: "photo", listing_id: listing.id, size: original.length },
        user: other,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await req("/api/uploads/prepare", {
        method: "POST",
        body: { kind: "photo", listing_id: listing.id, size: 11 * 1024 * 1024 },
        user: owner,
      })
    ).status,
    400,
  );
  const r = await req("/api/uploads/prepare", {
    method: "POST",
    body: { kind: "photo", listing_id: listing.id, size: original.length },
    user: owner,
  });
  assert.equal(r.status, 201);
  ticket = await r.json();
  assert.equal(ticket.method, "PUT");
  assert.match(ticket.url, /token=/);
  assert.equal(
    JSON.stringify(ticket).includes("test-only-server-secret"),
    false,
  );
  assert.equal(
    (
      await req("/api/uploads/" + ticket.id + "/complete", {
        method: "POST",
        body: {},
        user: other,
      })
    ).status,
    404,
  );
  const upload = await fetch(ticket.url, {
    method: "PUT",
    body: original,
    headers: { "Content-Type": "image/jpeg" },
  });
  assert.equal(upload.status, 200);
  const completed = await req("/api/uploads/" + ticket.id + "/complete", {
    method: "POST",
    body: {},
    user: owner,
  });
  assert.equal(completed.status, 201);
  listing = await completed.json();
  assert.equal(listing.photos.length, 1);
  photo = listing.photos[0];
  const duplicate = await req("/api/uploads/" + ticket.id + "/complete", {
    method: "POST",
    body: {},
    user: owner,
  });
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json()).photos.length, 1);
  const raw = await req("/api/photos/" + photo.id + "/original", {
    user: owner,
  });
  assert.deepEqual(Buffer.from(await raw.arrayBuffer()), original);
  const image = await req("/media/photos/" + photo.id + "/display", {
    user: owner,
  });
  const metadata = await sharp(
    Buffer.from(await image.arrayBuffer()),
  ).metadata();
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.width, 80);
  assert.equal(metadata.height, 100);
  assert.equal(
    (await req("/media/photos/" + photo.id + "/display")).status,
    404,
  );
  assert.equal(
    (await req("/api/photos/" + photo.id + "/original", { user: other }))
      .status,
    404,
  );
});
test("decoder rejects invalid direct objects without creating photo rows", async () => {
  const invalid = Buffer.from("<svg>not an approved image</svg>");
  const t = await (
    await req("/api/uploads/prepare", {
      method: "POST",
      body: { kind: "photo", listing_id: listing.id, size: invalid.length },
      user: owner,
    })
  ).json();
  await fetch(t.url, { method: "PUT", body: invalid });
  assert.equal(
    (
      await req("/api/uploads/" + t.id + "/complete", {
        method: "POST",
        body: {},
        user: owner,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await req("/api/uploads/" + t.id + "/complete", {
        method: "POST",
        body: {},
        user: owner,
      })
    ).status,
    409,
  );
  assert.equal(
    (await (await req("/api/listings/" + listing.id, { user: owner })).json())
      .photos.length,
    1,
  );
});
test("mapping and publishing work through async transactions; only derivatives get public short-lived links", async () => {
  assert.equal(
    (
      await req("/api/photos/" + photo.id, {
        method: "PATCH",
        body: {
          areas: ["mirror_right", "angle_rear_right"],
          note: "Test cloud mapping",
        },
        user: owner,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await req("/api/listings/" + listing.id + "/publish", {
        method: "POST",
        body: {},
        user: owner,
      })
    ).status,
    200,
  );
  const publicPhoto = await req("/media/photos/" + photo.id + "/display", {
    redirect: "manual",
  });
  assert.equal(publicPhoto.status, 302);
  assert.match(publicPhoto.headers.get("location"), /token=/);
  assert.match(publicPhoto.headers.get("cache-control"), /no-store/);
  assert.equal(
    (await req("/api/photos/" + photo.id + "/original")).status,
    401,
  );
});
test("admin GLB direct import validates the file and retains immutable asset versions", async () => {
  const buffer = triangleGlb(),
    body = {
      kind: "asset",
      catalog_id: input.catalog_id,
      size: buffer.length,
      source_url: "https://example.com/test-geometry",
      creator: "TEST",
      license: "Test-only geometry, not a vehicle",
      attribution: "Test fixture",
      limitations: "Not a real car asset",
      config: JSON.stringify(testConfig),
    };
  assert.equal(
    (await req("/api/uploads/prepare", { method: "POST", body, user: owner }))
      .status,
    403,
  );
  const t = await (
    await req("/api/uploads/prepare", { method: "POST", body, user: admin })
  ).json();
  assert.equal(
    (await fetch(t.url, { method: "PUT", body: buffer })).status,
    200,
  );
  const completed = await req("/api/uploads/" + t.id + "/complete", {
    method: "POST",
    body: {},
    user: admin,
  });
  assert.equal(completed.status, 201);
  const asset = await completed.json();
  assert.equal(asset.approved, false);
  assert.equal(asset.version, 1);
  assert.equal((await req("/media/assets/" + asset.id)).status, 404);
  assert.equal(
    (
      await req("/api/admin/assets/" + asset.id + "/approve", {
        method: "POST",
        body: { confirmed: true },
        user: admin,
      })
    ).status,
    200,
  );
  assert.equal(
    (await req("/media/assets/" + asset.id, { redirect: "manual" })).status,
    302,
  );
});
test("database, sessions and private images survive a fresh Function/app instance", async () => {
  await new Promise((r) => server.close(r));
  server = null;
  await db.close();
  db = null;
  await start();
  const l = await (await req("/api/listings/" + listing.id)).json();
  assert.equal(l.photos[0].id, photo.id);
  assert.equal(l.status, "published");
  assert.equal(
    (await (await req("/api/me", { user: owner })).json()).email,
    "pg-owner@example.com",
  );
  assert.deepEqual(
    Buffer.from(
      await (
        await req("/api/photos/" + photo.id + "/original", { user: owner })
      ).arrayBuffer(),
    ),
    original,
  );
});

test("concurrent direct completions serialize the durable 60-photo quota", async () => {
  const quota = await (
    await req("/api/listings", {
      method: "POST",
      body: { ...input, title: "TEST quota fixture" },
      user: owner,
    })
  ).json();
  // Existing photo objects are reused only inside this disposable quota fixture.
  for (let i = 0; i < 59; i++)
    await db
      .prepare(
        "INSERT INTO photos(id,listing_id,original,display,thumbnail,mime,size,sort_order) SELECT ?,?,original,display,thumbnail,mime,size,? FROM photos WHERE id=?",
      )
      .run("quota-fixture-" + i, quota.id, i, photo.id);
  const tickets = [];
  for (let i = 0; i < 2; i++) {
    const response = await req("/api/uploads/prepare", {
      method: "POST",
      body: { kind: "photo", listing_id: quota.id, size: original.length },
      user: owner,
    });
    assert.equal(response.status, 201);
    const ticket = await response.json();
    assert.equal(
      (
        await fetch(ticket.url, {
          method: "PUT",
          body: original,
          headers: { "Content-Type": "image/jpeg" },
        })
      ).status,
      200,
    );
    tickets.push(ticket);
  }
  const results = await Promise.all(
    tickets.map((t) =>
      req("/api/uploads/" + t.id + "/complete", {
        method: "POST",
        body: {},
        user: owner,
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) n FROM photos WHERE listing_id=?")
        .get(quota.id)
    ).n,
    60,
  );
});

test("durable pending-upload limit cannot be bypassed with concurrent grants", async () => {
  const l = await (
    await req("/api/listings", {
      method: "POST",
      body: { ...input, title: "TEST pending limit" },
      user: other,
    })
  ).json();
  const responses = await Promise.all(
    Array.from({ length: 13 }, () =>
      req("/api/uploads/prepare", {
        method: "POST",
        body: { kind: "photo", listing_id: l.id, size: original.length },
        user: other,
      }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 201).length, 12);
  assert.equal(responses.filter((r) => r.status === 429).length, 1);
});
