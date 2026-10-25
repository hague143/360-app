import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHandler } from "../api/index.mjs";
import { postgresSql } from "../server/postgres.js";
import { storageFixture } from "./supabase-fixture.js";
import { SupabaseStorage } from "../server/supabase-storage.js";
import { readFile } from "node:fs/promises";

test("Postgres translation binds parameters and leaves quoted literal content intact", () => {
  assert.equal(
    postgresSql(
      "SELECT '?' AS x FROM users WHERE email=? AND name='users?''x'",
    ),
    "SELECT '?' AS x FROM carview.users WHERE email=$1 AND name='users?''x'",
  );
  assert.equal(
    postgresSql("INSERT INTO photo_areas VALUES(?,?)"),
    "INSERT INTO carview.photo_areas VALUES($1,$2)",
  );
});
test("Supabase SDK adapter requires a private bucket and produces scoped upload/download links", async () => {
  const fixture = await storageFixture();
  try {
    const storage = fixture.storage();
    await storage.init();
    await storage.put("fixture-1.original", Buffer.from("private bytes"));
    assert.equal(
      (await storage.read("fixture-1.original")).toString(),
      "private bytes",
    );
    const signed = await storage.signedUrl("fixture-1.original", {
      download: "original.jpg",
    });
    assert.match(signed, /download=original.jpg/);
    assert.equal((await fetch(signed)).status, 200);
    assert.equal(
      (
        await fetch(
          fixture.url + "/storage/v1/object/carview-private/fixture-1.original",
        )
      ).status,
      403,
    );
    const url = await storage.uploadUrl("fixture-2.original");
    assert.equal(
      (await fetch(url, { method: "PUT", body: "source" })).status,
      200,
    );
    assert.equal(
      (await storage.read("fixture-2.original")).toString(),
      "source",
    );
    await storage.remove("fixture-1.original");
    await assert.rejects(storage.read("fixture-1.original"));
    fixture.setPublic(true);
    await assert.rejects(storage.init(), /must be private/);
    assert.throws(
      () => new SupabaseStorage({ url: "http://unsafe.example", key: "test" }),
      /HTTPS/,
    );
  } finally {
    await fixture.close();
  }
});
test("serverless entry fails closed when unconfigured and retries initialization after recovery", async () => {
  let calls = 0;
  const handler = createHandler(async () => {
    calls++;
    if (calls === 1)
      throw new Error("A private setup detail must not reach the browser");
    return {
      app: (_req, res) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      },
    };
  });
  const server = createServer(handler).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base + "/api/health");
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.equal(text.includes("private setup detail"), false);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await (await fetch(base + "/api/health")).json(), {
      ok: true,
    });
    assert.equal(calls, 2);
    await fetch(base + "/api/health");
    assert.equal(calls, 2);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("Vercel config routes API/media to the real Function before SPA routes and uses both frontend/backend builds", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(
    config.builds.some(
      (b) => b.src === "api/index.mjs" && b.use === "@vercel/node",
    ),
    true,
  );
  assert.equal(
    config.builds.some((b) => b.use === "@vercel/static-build"),
    true,
  );
  for (const path of [
    "/api/health",
    "/api/auth/register",
    "/api/uploads/123/complete",
    "/media/photos/123/display",
    "/media/assets/123",
  ]) {
    const first = config.routes.find(
      (r) => r.src && new RegExp("^" + r.src + "$").test(path),
    );
    assert.equal(first.dest, "/api/index.mjs");
  }
  const listing = config.routes.find(
    (r) => r.src && new RegExp("^" + r.src + "$").test("/listing/demo-corolla"),
  );
  assert.equal(listing.dest, "/index.html");
});
