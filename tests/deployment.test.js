import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  backendOrigin,
  prepareVercelOutput,
} from "../scripts/build-vercel.mjs";
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

test("Vercel proxy/fallback routes validate HTTPS backends, reject loops and preserve API/media paths", async () => {
  assert.throws(() => backendOrigin(""), /CARVIEW_BACKEND_URL is required/);
  for (const value of [
    "not-a-url",
    "http://backend.example",
    "https://user:password@backend.example",
    "https://backend.example/api",
    "https://backend.example?token=x",
    "https://backend.example#x",
    "https://localhost",
    "https://127.0.0.1",
  ])
    assert.throws(() => backendOrigin(value));
  assert.throws(
    () => backendOrigin("https://frontend.vercel.app", "frontend.vercel.app"),
    /requests loop/,
  );
  const dir = await mkdtemp(path.join(tmpdir(), "carview-vercel-test-"));
  try {
    const dist = path.join(dir, "dist"),
      out = path.join(dir, "output");
    await mkdir(path.join(dist, "assets"), { recursive: true });
    await writeFile(path.join(dist, "index.html"), "CarView frontend test");
    await writeFile(path.join(dist, "assets", "app.js"), "app");
    const config = await prepareVercelOutput({
      backendUrl: "https://persistent-backend.example/",
      distDir: dist,
      outputDir: out,
    });
    assert.equal(config.version, 3);
    assert.equal(
      await readFile(path.join(out, "static", "index.html"), "utf8"),
      "CarView frontend test",
    );
    assert.equal(
      await readFile(path.join(out, "static", "assets", "app.js"), "utf8"),
      "app",
    );
    const diskConfig = JSON.parse(
      await readFile(path.join(out, "config.json"), "utf8"),
    );
    assert.deepEqual(diskConfig, config);
    function destination(url) {
      for (const r of config.routes) {
        if (r.src && new RegExp("^" + r.src + "$").test(url))
          return {
            route: r,
            dest: r.dest
              ? url.replace(new RegExp("^" + r.src + "$"), r.dest)
              : undefined,
          };
      }
      throw new Error("No route");
    }
    for (const input of [
      "/api/health",
      "/api/auth/login",
      "/api/listings/123/photos",
      "/api/photos/abc/original",
      "/media/photos/abc/display",
      "/media/assets/abc",
    ]) {
      const selected = destination(input);
      assert.equal(selected.dest, "https://persistent-backend.example" + input);
      assert.equal(
        selected.route.headers["Cache-Control"],
        "private, no-store",
      );
    }
    assert.equal(destination("/listing/demo-corolla").dest, "/index.html");
    assert.equal(destination("/garage/new").dest, "/index.html");
    assert.equal(destination("/assets/missing.js").route.status, 404);
    // Failed config must leave the previous valid output intact.
    await assert.rejects(
      prepareVercelOutput({
        backendUrl: "http://insecure.example",
        distDir: dist,
        outputDir: out,
      }),
    );
    assert.equal(
      await readFile(path.join(out, "static", "index.html"), "utf8"),
      "CarView frontend test",
    );
    const unconfigured = await prepareVercelOutput({
      distDir: dist,
      outputDir: out,
    });
    assert.equal(unconfigured.routes[0].status, 503);
    assert.equal(
      unconfigured.routes[0].headers["Content-Type"],
      "application/json",
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(out, "static", "_carview", "service-unavailable.json"),
          "utf8",
        ),
      ).error,
      SERVICE_UNAVAILABLE,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
