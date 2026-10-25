import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { createHandler } from "../api/index.mjs";
import { createServer } from "node:http";
import { postgresFixture } from "./postgres-fixture.js";
import { storageFixture } from "./supabase-fixture.js";
process.env.NODE_ENV = "production";
const dir = await mkdtemp(path.join(tmpdir(), "carview-cloud-browser-"));
let pg, files, db, server, browser;
try {
  pg = await postgresFixture();
  files = await storageFixture();
  db = await pg.connect();
  server = createServer(
    createHandler(() => createApp({ db, storage: files.storage() })),
  ).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [],
    apiBodies = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (request.url().startsWith(base + "/api/"))
      apiBodies.push(request.postDataBuffer()?.length || 0);
  });
  const headers = { "X-CarView-Request": "1" };
  let r = await context.request.post(base + "/api/auth/register", {
    headers,
    data: {
      name: "Cloud Browser",
      email: "cloud-browser@example.com",
      password: "test-cloud-password-123",
    },
  });
  assert.equal(r.status(), 201);
  r = await context.request.post(base + "/api/listings", {
    headers,
    data: {
      catalog_id: "toyota-corolla-e170-pk",
      title: "TEST cloud photo upload — not a car",
      year: 2020,
      price: 1,
      mileage: 0,
      city: "Test",
      description: "Plain noise/colour test fixtures only.",
    },
  });
  assert.equal(r.status(), 201);
  const l = await r.json();
  // Random pixel data is explicitly a non-photographic fixture, not an AI photo.
  const large = await sharp(randomBytes(1600 * 1200 * 3), {
    raw: { width: 1600, height: 1200, channels: 3 },
  })
    .png()
    .toBuffer();
  assert.ok(large.length > 4.5 * 1024 * 1024);
  const small = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#90aa88" },
  })
    .png()
    .toBuffer();
  const paths = [
    path.join(dir, "01-test-noise.png"),
    path.join(dir, "02-test-colour.png"),
  ];
  await writeFile(paths[0], large);
  await writeFile(paths[1], small);
  await page.goto(base + "/garage/" + l.id);
  await page
    .getByRole("button", { name: "360 photo view", exact: true })
    .click();
  await page.getByLabel("Upload walk-around photos").setInputFiles(paths);
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".spin-frame-card").length === 2 &&
      !document.querySelector(".spin-upload progress"),
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: /These photos cover one complete lap/ })
      .isDisabled(),
    true,
  );
  await page.getByRole("checkbox", { name: /I checked the order/ }).check();
  await page.getByRole("button", { name: "Confirm photo walk-around" }).click();
  await page
    .locator(".spin-studio-heading .badge")
    .filter({ hasText: "PHOTO SEQUENCE READY" })
    .waitFor();
  await page
    .getByRole("button", { name: "Publish listing", exact: true })
    .click();
  await page.getByRole("button", { name: "View published listing" }).click();
  await page
    .locator(".spin-source")
    .filter({ hasText: "Seller-confirmed" })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector(".spin-stage>img")?.naturalWidth === 1600,
  );
  assert.ok(apiBodies.every((n) => n < 1024 * 1024));
  const stored = await (
    await context.request.get(base + "/api/listings/" + l.id)
  ).json();
  const original = await context.request.get(
    base + "/api/photos/" + stored.photos[0].id + "/original",
  );
  assert.deepEqual(await original.body(), large);
  console.log(
    "PASS Real PostgreSQL + actual Supabase SDK HTTP fixture: a >4.5 MB photo uploads directly, is decoded, mapped into a photo sequence and published with only small API requests",
  );
  const buyer = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    phone = await buyer.newPage();
  await phone.goto(base + "/listing/" + l.id);
  await phone.waitForFunction(
    () => document.querySelector(".spin-stage>img")?.naturalWidth === 1600,
  );
  await phone.getByRole("button", { name: "Next photo angle" }).click();
  assert.equal(
    await phone.getByRole("button", { name: "Next photo angle" }).isDisabled(),
    true,
  );
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  assert.equal(
    (
      await buyer.request.get(
        base + "/api/photos/" + stored.photos[0].id + "/original",
      )
    ).status(),
    401,
  );
  assert.deepEqual(errors, []);
  await buyer.close();
  console.log(
    "PASS Anonymous mobile buyer can view private-storage display links; originals stay protected; no cloud-flow browser errors",
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await db?.close();
  await files?.close();
  await pg?.close();
  await rm(dir, { recursive: true, force: true });
}
