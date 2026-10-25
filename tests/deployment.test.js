import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { parseApiResponse, SERVICE_UNAVAILABLE } from "../src/api-response.ts";
import { createApp } from "../server/app.js";

test("API response parsing handles real JSON and non-JSON hosting errors safely", () => {
  assert.deepEqual(
    parseApiResponse('{"ok":true}', "application/json; charset=utf-8", 200),
    { ok: true },
  );
  assert.equal(parseApiResponse("null", "application/json", 200), null);
  for (const [text, type, status] of [
    ["The page could not be found", "text/plain", 404],
    ["<!doctype html><title>Homepage</title>", "text/html", 200],
    ["<h1>Bad gateway</h1>", "text/html", 502],
    ["broken-json", "application/json", 200],
  ])
    assert.throws(() => parseApiResponse(text, type, status), {
      message: SERVICE_UNAVAILABLE,
    });
  assert.throws(
    () =>
      parseApiResponse('{"error":"Please sign in."}', "application/json", 401),
    { message: "Please sign in." },
  );
  assert.throws(
    () =>
      parseApiResponse(
        '{"message":"not a normal API error"}',
        "application/json",
        503,
      ),
    { message: SERVICE_UNAVAILABLE },
  );
});

test("persistent backend accepts the configured public HTTPS origin and rejects other origins", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "carview-origin-test-"));
  const priorOrigin = process.env.APP_ORIGIN,
    priorRender = process.env.RENDER_EXTERNAL_URL;
  let instance, server;
  try {
    delete process.env.APP_ORIGIN;
    process.env.RENDER_EXTERNAL_URL = "https://carview-test.onrender.com";
    instance = await createApp({ dataDir: dir });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    let base = `http://127.0.0.1:${server.address().port}`;
    const headers = {
      "X-CarView-Request": "1",
      Origin: process.env.RENDER_EXTERNAL_URL,
    };
    assert.equal(
      (await fetch(base + "/api/auth/logout", { method: "POST", headers }))
        .status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: { ...headers, Origin: "https://other.example" },
        })
      ).status,
      403,
    );
    await new Promise((r) => server.close(r));
    server = null;
    instance.db.close();
    instance = null;
    process.env.APP_ORIGIN = "https://360-app-three.vercel.app";
    instance = await createApp({ dataDir: dir });
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}`;
    assert.equal(
      (
        await fetch(base + "/api/auth/logout", {
          method: "POST",
          headers: { ...headers, Origin: process.env.APP_ORIGIN },
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/auth/logout", { method: "POST", headers }))
        .status,
      403,
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    instance?.db.close();
    if (priorOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = priorOrigin;
    if (priorRender === undefined) delete process.env.RENDER_EXTERNAL_URL;
    else process.env.RENDER_EXTERNAL_URL = priorRender;
    await rm(dir, { recursive: true, force: true });
  }
});
