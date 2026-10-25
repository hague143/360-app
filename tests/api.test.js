import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { validateGlb } from "../server/storage.js";
import { triangleGlb, testConfig } from "./fixtures.js";
let instance, server, base, dir, listing, photo, original, assetId, fixtureRoot;
const seller = { cookie: "" },
  other = { cookie: "" },
  anon = { cookie: "" },
  admin = { cookie: "" };
async function request(
  route,
  { method = "GET", body, user = anon, form, headers = {} } = {},
) {
  const r = await fetch(base + route, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      "X-CarView-Request": "1",
      ...(user.cookie ? { Cookie: user.cookie } : {}),
      ...headers,
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (r.headers.get("set-cookie"))
    user.cookie = r.headers.get("set-cookie").split(";")[0];
  return r;
}
const input = {
  catalog_id: "toyota-corolla-e170-pk",
  title: "TEST listing – not a vehicle advertisement",
  year: 2020,
  price: 6250000,
  mileage: 54000,
  city: "Islamabad",
  description: "Automated workflow test only.",
};
before(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "carview-test-"));
  dir = path.join(fixtureRoot, ".data");
  instance = await createApp({ dataDir: dir });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  original = await sharp({
    create: { width: 120, height: 90, channels: 3, background: "#557766" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
});
after(async () => {
  await new Promise((r) => server.close(r));
  instance.db.close();
  await rm(fixtureRoot, { recursive: true, force: true });
});
test("catalog demo is explicit and has no invented photographs or substitute model", async () => {
  const l = await (await request("/api/listings/demo-corolla")).json();
  assert.equal(l.demo, 1);
  assert.equal(l.asset, null);
  assert.deepEqual(l.photos, []);
  assert.equal(l.coverage, 0);
  assert.match(l.description, /not a vehicle advertisement/);
});
test("accounts register, enforce password policy, and authenticate through HttpOnly session", async () => {
  const bad = await request("/api/auth/register", {
    method: "POST",
    body: { name: "Seller", email: "bad", password: "123" },
    user: seller,
  });
  assert.equal(bad.status, 400);
  for (const [u, email] of [
    [seller, "seller@example.com"],
    [other, "other@example.com"],
    [admin, "admin@example.com"],
  ]) {
    const r = await request("/api/auth/register", {
      method: "POST",
      body: {
        name: "Test Seller",
        email,
        password: "test-password-long-enough",
      },
      user: u,
    });
    assert.equal(r.status, 201);
    assert.match(r.headers.get("set-cookie"), /HttpOnly/);
    assert.match(r.headers.get("set-cookie"), /SameSite=Lax/);
  }
  instance.db
    .prepare("UPDATE users SET role='admin' WHERE email='admin@example.com'")
    .run();
  assert.equal(
    (await (await request("/api/me", { user: seller })).json()).email,
    "seller@example.com",
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: "seller@example.com", password: "wrong-password" },
      })
    ).status,
    401,
  );
});
test("seller creates a private draft; other sellers cannot read, edit, publish or upload to it", async () => {
  const r = await request("/api/listings", {
    method: "POST",
    body: input,
    user: seller,
  });
  assert.equal(r.status, 201);
  listing = await r.json();
  assert.equal(listing.status, "draft");
  for (const u of [anon, other])
    assert.equal(
      (await request("/api/listings/" + listing.id, { user: u })).status,
      404,
    );
  for (const route of [
    "/publish",
    "/unpublish",
    "/photos",
    "/markers",
    "/reorder",
  ])
    assert.equal(
      (
        await request("/api/listings/" + listing.id + route, {
          method: "POST",
          body: {},
          user: other,
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await request("/api/listings/" + listing.id, {
        method: "PATCH",
        body: input,
        user: other,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/publish", {
        method: "POST",
        body: {},
        user: seller,
      })
    ).status,
    400,
  );
});
test("validates image decoding and refuses disguised / non-image uploads", async () => {
  const form = new FormData();
  form.append(
    "photos",
    new Blob(["<script>bad</script>"], { type: "image/jpeg" }),
    "fake.jpg",
  );
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/photos", {
        method: "POST",
        form,
        user: seller,
      })
    ).status,
    400,
  );
});
test("uploads original byte-for-byte and creates metadata-free public derivatives while draft media stays private", async () => {
  const form = new FormData();
  form.append(
    "photos",
    new Blob([original], { type: "image/jpeg" }),
    "seller-photo.jpg",
  );
  const r = await request("/api/listings/" + listing.id + "/photos", {
    method: "POST",
    form,
    user: seller,
  });
  assert.equal(r.status, 201);
  listing = await r.json();
  photo = listing.photos[0];
  const raw = await request("/api/photos/" + photo.id + "/original", {
    user: seller,
  });
  assert.deepEqual(Buffer.from(await raw.arrayBuffer()), original);
  for (const user of [anon, other])
    assert.equal(
      (await request("/media/photos/" + photo.id + "/display", { user }))
        .status,
      404,
    );
  const derivative = await request("/media/photos/" + photo.id + "/display", {
    user: seller,
  });
  const meta = await sharp(
    Buffer.from(await derivative.arrayBuffer()),
  ).metadata();
  assert.equal(meta.exif, undefined);
  assert.equal(meta.width, 90);
  assert.equal(meta.height, 120);
  assert.equal(
    (await request("/api/photos/" + photo.id + "/original", { user: other }))
      .status,
    404,
  );
});
test("one photo maps to several stable IDs; unlabelled photos cannot publish", async () => {
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/publish", {
        method: "POST",
        body: {},
        user: seller,
      })
    ).status,
    400,
  );
  const ids = [
    "mirror_right",
    "angle_rear_right",
    "engine_bay",
    "boot_interior",
  ];
  assert.equal(
    (
      await request("/api/photos/" + photo.id, {
        method: "PATCH",
        body: { areas: ["invented_part"] },
        user: seller,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/photos/" + photo.id, {
        method: "PATCH",
        body: { areas: ids, note: "Test mapping fixture" },
        user: seller,
      })
    ).status,
    200,
  );
  const l = await (
    await request("/api/listings/" + listing.id, { user: seller })
  ).json();
  assert.deepEqual(new Set(l.photos[0].areas), new Set(ids));
  assert.equal(l.photos.length, 1);
  assert.equal(l.coverage, 3);
  assert.equal(
    (
      await request("/api/photos/" + photo.id, {
        method: "PATCH",
        body: { areas: ids },
        user: other,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request("/api/photos/" + photo.id, {
        method: "DELETE",
        user: other,
      })
    ).status,
    404,
  );
});
test("publishing makes derivatives and mapped photos available; originals remain private", async () => {
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/publish", {
        method: "POST",
        body: {},
        user: seller,
      })
    ).status,
    200,
  );
  const l = await (await request("/api/listings/" + listing.id)).json();
  assert.equal(l.status, "published");
  for (const id of [
    "mirror_right",
    "angle_rear_right",
    "engine_bay",
    "boot_interior",
  ])
    assert.equal(l.photos.filter((p) => p.areas.includes(id)).length, 1);
  assert.equal(
    l.photos.filter((p) => p.areas.includes("mirror_left")).length,
    0,
  );
  assert.equal(
    (await request("/media/photos/" + photo.id + "/thumbnail")).status,
    200,
  );
  assert.equal(
    (await request("/api/photos/" + photo.id + "/original")).status,
    401,
  );
  assert.equal(
    (await request("/api/photos/" + photo.id + "/original", { user: other }))
      .status,
    404,
  );
});
test("CSRF custom header and origin checks reject untrusted mutations", async () => {
  assert.equal(
    (
      await request("/api/listings", {
        method: "POST",
        body: input,
        user: seller,
        headers: { "X-CarView-Request": "" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/listings", {
        method: "POST",
        body: input,
        user: seller,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
});
test("only administrators can manage catalog / assets; resource URIs and invalid GLB are rejected", async () => {
  assert.equal(
    (await request("/api/admin/assets", { user: seller })).status,
    403,
  );
  assert.throws(() => validateGlb(Buffer.from("bad")));
  const glb = triangleGlb();
  assert.equal(validateGlb(glb).asset.version, "2.0");
  const modified = Buffer.from(glb);
  modified.writeUInt32LE(7, 4);
  assert.throws(() => validateGlb(modified));
});
test("admin imports TEST geometry, previews before approval; versions pin new listings without changing existing listings", async () => {
  const form = new FormData();
  for (const [k, v] of Object.entries({
    catalog_id: input.catalog_id,
    source_url: "https://example.com/TEST-geometry-NOT-A-CAR",
    creator: "Automated TEST",
    license: "TEST geometry only; not a vehicle asset",
    attribution: "Test fixture",
    limitations:
      "Not a vehicle. Never use as a real approved vehicle reference.",
    config: JSON.stringify(testConfig),
  }))
    form.append(k, v);
  form.append("asset", new Blob([triangleGlb()]), "test.glb");
  const r = await request("/api/admin/assets", {
    method: "POST",
    form,
    user: admin,
  });
  assert.equal(r.status, 201);
  const a = await r.json();
  assetId = a.id;
  assert.equal(a.approved, false);
  assert.equal((await request("/media/assets/" + a.id)).status, 404);
  assert.equal(
    (await request("/media/assets/" + a.id, { user: admin })).status,
    200,
  );
  assert.equal(
    (
      await request("/api/admin/assets/" + a.id + "/approve", {
        method: "POST",
        body: { confirmed: true },
        user: seller,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request("/api/admin/assets/" + a.id + "/approve", {
        method: "POST",
        body: { confirmed: false },
        user: admin,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/admin/assets/" + a.id + "/approve", {
        method: "POST",
        body: { confirmed: true },
        user: admin,
      })
    ).status,
    200,
  );
  const fresh = await (
    await request("/api/listings", {
      method: "POST",
      body: input,
      user: seller,
    })
  ).json();
  assert.equal(fresh.asset_id, a.id);
  const existing = await (await request("/api/listings/" + listing.id)).json();
  assert.equal(existing.asset_id, null);
  assert.equal(
    (
      await request("/api/admin/catalog/" + input.catalog_id, {
        method: "PATCH",
        body: {},
        user: admin,
      })
    ).status,
    409,
  );
});
test("markers are asset-local and version-pinned; unsupported listings cannot fabricate marker coordinates", async () => {
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/markers", {
        method: "POST",
        user: seller,
        body: { label: "Scratch", damage: true, position: [1, 0, 0] },
      })
    ).status,
    400,
  );
  const fresh = await (
    await request("/api/listings", {
      method: "POST",
      body: input,
      user: seller,
    })
  ).json();
  const r = await request("/api/listings/" + fresh.id + "/markers", {
    method: "POST",
    user: seller,
    body: {
      label: "Seller detail fixture",
      damage: true,
      position: [0.2, 0.2, 0],
    },
  });
  assert.equal(r.status, 201);
  const l = await (
    await request("/api/listings/" + fresh.id, { user: seller })
  ).json();
  assert.equal(l.markers[0].asset_id, assetId);
  assert.equal(l.markers[0].damage, true);
});
test("data, originals and session persist after a real API server / database restart", async () => {
  await new Promise((r) => server.close(r));
  instance.db.close();
  instance = await createApp({ dataDir: dir });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const l = await (await request("/api/listings/" + listing.id)).json();
  assert.equal(l.photos[0].id, photo.id);
  assert.equal(l.status, "published");
  assert.equal((await request("/api/me", { user: seller })).status, 200);
  assert.deepEqual(
    Buffer.from(
      await (
        await request("/api/photos/" + photo.id + "/original", { user: seller })
      ).arrayBuffer(),
    ),
    original,
  );
});
test("owner can reorder, unpublish, and delete without exposing stale private media", async () => {
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/reorder", {
        method: "POST",
        body: { ids: [photo.id, photo.id] },
        user: seller,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/reorder", {
        method: "POST",
        body: { ids: [photo.id] },
        user: seller,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("/api/listings/" + listing.id + "/unpublish", {
        method: "POST",
        body: {},
        user: seller,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/media/photos/" + photo.id + "/display")).status,
    404,
  );
  assert.equal(
    (
      await request("/api/photos/" + photo.id, {
        method: "DELETE",
        user: seller,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/media/photos/" + photo.id + "/display", { user: seller }))
      .status,
    404,
  );
});

test("photo spins validate ownership, frame membership, uniqueness and honest partial/full-loop settings", async () => {
  const fresh = await (
    await request("/api/listings", {
      method: "POST",
      body: input,
      user: seller,
    })
  ).json();
  assert.deepEqual(fresh.spin, { ids: [], confirmed: false, loop: false });
  let l = fresh;
  for (let batch = 0; batch < 2; batch++) {
    const form = new FormData();
    for (let i = 0; i < 6; i++)
      form.append(
        "photos",
        new Blob([original], { type: "image/jpeg" }),
        `test-frame-${batch * 6 + i + 1}.jpg`,
      );
    const r = await request("/api/listings/" + l.id + "/photos", {
      method: "POST",
      form,
      user: seller,
    });
    assert.equal(r.status, 201);
    l = await r.json();
  }
  const ids = l.photos.map((p) => p.id),
    route = "/api/listings/" + l.id + "/spin";
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: other,
        body: { ids, confirmed: true, loop: true },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: seller,
        body: { ids: [ids[0], ids[0]], confirmed: false, loop: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: seller,
        body: { ids: ["another-listing-photo"], confirmed: false, loop: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: seller,
        body: { ids: [ids[0]], confirmed: true, loop: false },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: seller,
        body: { ids: ids.slice(0, 2), confirmed: true, loop: true },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(route, {
        method: "PUT",
        user: seller,
        body: { ids, confirmed: false, loop: true },
      })
    ).status,
    400,
  );
  const preview = await (
    await request(route, {
      method: "PUT",
      user: seller,
      body: { ids, confirmed: false, loop: false },
    })
  ).json();
  assert.equal(preview.spin.ids.length, 12);
  assert.equal(preview.spin.confirmed, false);
  assert.equal(
    (
      await request("/api/listings/" + l.id + "/publish", {
        method: "POST",
        user: seller,
        body: {},
      })
    ).status,
    400,
  );
  const reversed = [...ids].reverse();
  const confirmed = await (
    await request(route, {
      method: "PUT",
      user: seller,
      body: { ids: reversed, confirmed: true, loop: true },
    })
  ).json();
  assert.deepEqual(confirmed.spin, {
    ids: reversed,
    confirmed: true,
    loop: true,
  });
  assert.equal(
    (
      await request("/api/listings/" + l.id + "/publish", {
        method: "POST",
        user: seller,
        body: {},
      })
    ).status,
    200,
  );
  const buyer = await (await request("/api/listings/" + l.id)).json();
  assert.deepEqual(buyer.spin.ids, reversed);
  assert.equal(buyer.coverage, 0);
  // Partial sequence changes do not preserve a stale full-circle claim.
  const partial = await (
    await request(route, {
      method: "PUT",
      user: seller,
      body: { ids: ids.slice(0, 4), confirmed: true, loop: false },
    })
  ).json();
  assert.equal(partial.spin.loop, false);
  assert.equal(
    (await request("/api/photos/" + ids[0], { method: "DELETE", user: seller }))
      .status,
    200,
  );
  const afterDelete = await (
    await request("/api/listings/" + l.id, { user: seller })
  ).json();
  assert.equal(afterDelete.spin.confirmed, false);
  assert.equal(afterDelete.spin.loop, false);
  assert.deepEqual(afterDelete.spin.ids, ids.slice(1, 4));
  await new Promise((resolve) => server.close(resolve));
  instance.db.close();
  instance = await createApp({ dataDir: dir });
  server = instance.app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  const restored = await (
    await request("/api/listings/" + l.id, { user: seller })
  ).json();
  assert.deepEqual(restored.spin, afterDelete.spin);
  assert.equal(
    instance.db
      .prepare("SELECT version FROM schema_migrations WHERE version=2")
      .get().version,
    2,
  );
});
