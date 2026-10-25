import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createApp } from "../server/app.js";
process.env.NODE_ENV = "production";
const dir = await mkdtemp(path.join(tmpdir(), "carview-spin-"));
process.env.XDG_CACHE_HOME = path.join(dir, "font-cache");
await mkdir(process.env.XDG_CACHE_HOME, { recursive: true });
const { app, db, storage } = await createApp({ dataDir: dir });
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("test-results", { recursive: true });
try {
  await context.request.post(base + "/api/auth/register", {
    headers: { "X-CarView-Request": "1" },
    data: {
      name: "Spin Test",
      email: "spin-browser@example.com",
      password: "spin-test-password-long",
    },
  });
  const response = await context.request.post(base + "/api/listings", {
    headers: { "X-CarView-Request": "1" },
    data: {
      catalog_id: "toyota-corolla-e170-pk",
      title: "TEST photo sequence — not a real car",
      year: 2020,
      price: 1,
      mileage: 0,
      city: "Test",
      description: "Non-photographic automated fixtures only.",
    },
  });
  assert.equal(response.status(), 201);
  const listing = await response.json();
  const paths = [];
  for (let i = 1; i <= 12; i++) {
    // Plain numbered diagrams, never car photos. Fixtures live only in a disposable DB.
    const file = path.join(dir, `frame-${String(i).padStart(2, "0")}.jpg`);
    const svg = Buffer.from(
      `<svg width="600" height="400"><rect width="600" height="400" fill="hsl(${100 + i * 6},20%,65%)"/><text x="300" y="175" text-anchor="middle" font-size="24" fill="#24372a">TEST FRAME ${i}</text><text x="300" y="235" text-anchor="middle" font-size="16" fill="#24372a">Not a car photograph</text></svg>`,
    );
    await sharp(svg).jpeg().toFile(file);
    paths.push(file);
  }
  await page.goto(base + "/garage/" + listing.id);
  await page
    .getByRole("button", { name: "360 photo view", exact: true })
    .click();
  await page
    .getByLabel("Upload walk-around photos")
    .setInputFiles([...paths].reverse());
  await page.locator(".spin-frame-card").last().waitFor();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".spin-frame-card").length === 12 &&
      !document.querySelector(".spin-upload progress"),
  );
  assert.equal(await page.locator(".spin-frame-card").count(), 12);
  assert.match(await page.locator(".spin-source").innerText(), /Preview/);
  const saved = await (
    await context.request.get(base + "/api/listings/" + listing.id)
  ).json();
  const firstRow = db
    .prepare("SELECT original FROM photos WHERE id=?")
    .get(saved.spin.ids[0]);
  const { readFile } = await import("node:fs/promises");
  assert.deepEqual(
    await storage.read(firstRow.original),
    await readFile(paths[0]),
  );
  console.log(
    "PASS Bulk upload automatically assembles 12 original frames in natural filename order across safe batches",
  );
  await page.getByRole("button", { name: "Next photo angle" }).click();
  assert.match(await page.locator(".spin-frame-number").innerText(), /02/);
  await page.locator(".spin-stage").focus();
  await page.keyboard.press("ArrowRight");
  assert.match(await page.locator(".spin-frame-number").innerText(), /03/);
  await page.getByLabel("Photo viewing angle").fill("11");
  assert.match(await page.locator(".spin-frame-number").innerText(), /12/);
  assert.equal(
    await page.getByRole("button", { name: "Next photo angle" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Reset photo sequence" }).click();
  const stage = await page.locator(".spin-stage").boundingBox();
  await page.mouse.move(
    stage.x + stage.width * 0.8,
    stage.y + stage.height * 0.5,
  );
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width * 0.3,
    stage.y + stage.height * 0.5,
    { steps: 8 },
  );
  await page.mouse.up();
  assert.notEqual(
    await page.getByLabel("Photo viewing angle").inputValue(),
    "0",
  );
  await page.getByRole("button", { name: "Zoom photo in" }).click();
  assert.match(
    await page.locator(".spin-stage>img").getAttribute("style"),
    /1.25/,
  );
  console.log(
    "PASS Drag, keyboard, slider and zoom work; partial preview stops at the final actual photo",
  );
  await page
    .getByRole("button", { name: "Move frame 1 later", exact: true })
    .click();
  await page.waitForFunction(
    () => !document.querySelector(".spin-upload progress"),
  );
  await page.waitForTimeout(150);
  assert.notEqual(
    (
      await (
        await context.request.get(base + "/api/listings/" + listing.id)
      ).json()
    ).spin.ids[0],
    saved.spin.ids[0],
  );
  await page
    .getByRole("checkbox", { name: /These photos cover one complete lap/ })
    .check();
  await page.getByRole("checkbox", { name: /I checked the order/ }).check();
  await page.getByRole("button", { name: "Confirm 360 photo view" }).click();
  await page
    .locator(".spin-studio-heading .badge")
    .filter({ hasText: "360 LOOP READY" })
    .waitFor();
  await page
    .getByRole("button", { name: "Publish listing", exact: true })
    .click();
  await page.getByRole("button", { name: "View published listing" }).click();
  await page
    .locator(".spin-source")
    .filter({ hasText: "Seller-confirmed sequence" })
    .waitFor();
  await page.getByLabel("Photo viewing angle").fill("11");
  await page.getByRole("button", { name: "Next photo angle" }).click();
  assert.equal(await page.getByLabel("Photo viewing angle").inputValue(), "0");
  const firstPhoto = page.locator(".spin-stage>img");
  await firstPhoto.evaluate(
    (img) =>
      img.complete ||
      new Promise((r) => img.addEventListener("load", r, { once: true })),
  );
  assert.equal(await firstPhoto.evaluate((img) => img.naturalWidth), 600);
  await page.screenshot({
    path: "test-results/photo-spin-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS Manual order check enables full loop; spin-only listing publishes; buyer sees original frames and loop wraps correctly",
  );
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    phone = await mobile.newPage();
  await phone.goto(base + "/listing/" + listing.id);
  await phone.getByLabel("Photo viewing angle").waitFor();
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await phone.locator(".spin-stage").scrollIntoViewIfNeeded();
  const box = await phone.locator(".spin-stage").boundingBox(),
    session = await mobile.newCDPSession(phone),
    y = box.y + box.height * 0.5;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width * 0.8, y }],
  });
  for (let i = 1; i <= 6; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: box.x + box.width * (0.8 - i * 0.07), y }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(
    await phone.getByLabel("Photo viewing angle").inputValue(),
    "0",
  );
  await phone.screenshot({
    path: "test-results/photo-spin-mobile.png",
    fullPage: true,
  });
  await phone.reload();
  await phone.getByLabel("Photo viewing angle").waitFor();
  assert.match(
    await phone.locator(".spin-topline").innerText(),
    /360 PHOTO VIEW/,
  );
  console.log(
    "PASS Anonymous mobile buyer can swipe the photo view, with no WebGL dependency or horizontal overflow; saved view survives reload",
  );
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log("PASS No photo-spin JavaScript errors");
} catch (e) {
  await page.screenshot({
    path: "test-results/spin-failure.png",
    fullPage: true,
  });
  console.error("Photo spin failed at", page.url());
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
  await rm(dir, { recursive: true, force: true });
}
