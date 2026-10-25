import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { triangleGlb, testConfig } from "./fixtures.js";

// All accounts, non-photographic image fixtures, and non-vehicle 3D test geometry
// live in an isolated temporary database. Nothing is added to the app's demo.
process.env.NODE_ENV = "production";
const dir = await mkdtemp(path.join(tmpdir(), "carview-browser-"));
const { app, db } = await createApp({ dataDir: dir });
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1060 },
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const check = (message) => console.log("PASS", message);
const waitText = (locator, text) => locator.filter({ hasText: text }).waitFor();
const shotDir = path.resolve("test-results");
await mkdir(shotDir, { recursive: true });
try {
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Get to know every angle." })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "3D view" }).isDisabled(),
    true,
  );
  assert.match(
    await page.locator(".spin-empty").innerText(),
    /Only the photos you upload/,
  );
  await page.getByRole("button", { name: "Parts map", exact: true }).click();
  assert.match(
    await page.locator(".unsupported-note").innerText(),
    /3D model not yet supported/,
  );
  await page.screenshot({
    path: path.join(shotDir, "desktop.png"),
    fullPage: true,
  });
  check("Honest empty demo, no substitute model or fabricated seller photos");

  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Browser Seller");
  await page.getByLabel("Email address").fill("browser@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password-26");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("heading", { name: "Hello, Browser." }).waitFor();
  await page.getByRole("button", { name: "Add a car", exact: true }).click();
  await page.getByLabel("Make", { exact: true }).selectOption("Toyota");
  await page.getByLabel("Model year").fill("2020");
  await page.getByLabel("Listing title").fill("Browser workflow test");
  await page.getByLabel("Asking price (PKR)").fill("6250000");
  await page.getByLabel("Mileage (km)").fill("54000");
  await page.getByLabel("City", { exact: true }).fill("Islamabad");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Automated browser test; not a real vehicle advertisement.");
  await page.getByRole("button", { name: "Save draft & add photos" }).click();
  await page.getByRole("heading", { name: "Browser workflow test" }).waitFor();
  const listingId = new URL(page.url()).pathname.split("/")[2];
  const fixturePath = path.join(dir, "image-fixture.jpg");
  await sharp({
    create: { width: 600, height: 400, channels: 3, background: "#809d85" },
  })
    .jpeg()
    .toFile(fixturePath);
  await page.getByLabel("Upload car photos").setInputFiles(fixturePath);
  await page.locator(".editable-photo").waitFor();
  await page.locator(".editable-photo .text-button").click();
  const dialog = page.getByRole("dialog");
  for (const name of [
    "Right mirror",
    "Rear-right",
    "Engine bay",
    "Boot interior",
  ]) {
    await dialog
      .getByRole("checkbox", { name: new RegExp(`^${name} `) })
      .check();
  }
  await dialog
    .getByPlaceholder("Optional details or damage description")
    .fill("Test fixture note. No car is depicted.");
  await dialog.getByRole("button", { name: "Confirm labels & save" }).click();
  await waitText(page.locator(".photo-label-summary"), "4 areas confirmed");
  await page
    .getByRole("button", { name: "Publish listing", exact: true })
    .click();
  await page.getByRole("heading", { name: "Your listing is live." }).waitFor();
  await page.getByRole("button", { name: "View published listing" }).click();
  await page
    .getByRole("heading", { name: "Get to know every angle." })
    .waitFor();
  check(
    "Seller registers, creates draft, uploads, maps one photo to four areas, and publishes through UI",
  );

  await page.getByRole("button", { name: "Right mirror", exact: true }).click();
  await waitText(page.locator(".photo-panel h2"), "Right mirror");
  await page.locator(".photo-panel .seller-photo img").waitFor();
  await page.locator(".photo-panel .seller-photo").click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  assert.match(await page.locator(".lightbox-tools").innerText(), /150%/);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.match(
    await page.locator(".photo-panel h2").innerText(),
    /Right mirror/,
  );
  await page
    .locator(".view-presets")
    .getByRole("button", { name: "Rear-right", exact: true })
    .click();
  await waitText(page.locator(".photo-panel h2"), "Rear-right");
  await page.getByRole("tab", { name: "Inside & underneath" }).click();
  for (const name of ["Engine bay", "Boot interior"]) {
    await page.locator(".area-card").filter({ hasText: name }).click();
    await waitText(page.locator(".photo-panel h2"), name);
    assert.equal(await page.locator(".photo-panel .seller-photo").count(), 1);
  }
  await page.locator(".area-card").filter({ hasText: "Underbody" }).click();
  assert.match(
    await page.locator(".empty-frame").innerText(),
    /Photo not uploaded/,
  );
  check(
    "Right mirror, rear-right, engine and boot show the mapped upload; missing underbody is explicit; photo zoom works",
  );

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(`${base}/listing/${listingId}`);
  await phone
    .getByRole("heading", { name: "Get to know every angle." })
    .waitFor();
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await phone.screenshot({
    path: path.join(shotDir, "mobile.png"),
    fullPage: true,
  });
  await phone.getByRole("button", { name: "Right mirror", exact: true }).tap();
  await phone
    .locator(".show-mobile-panel .photo-panel .seller-photo")
    .waitFor();
  await phone.getByRole("button", { name: "Close photo panel" }).tap();
  assert.equal(await phone.locator(".show-mobile-panel").count(), 0);
  await phone.locator(".map-point.selected").waitFor();
  check(
    "Mobile touch selection opens bottom sheet; close preserves selection; no horizontal overflow",
  );

  // Test the GLB renderer and admin flow with visibly labelled TEST GEOMETRY,
  // never an alleged exact vehicle match or substitute in the real catalog.
  db.prepare(
    "UPDATE users SET role='admin' WHERE email='browser@example.com'",
  ).run();
  await page.goto(`${base}/admin`);
  await page
    .getByRole("button", { name: "Vehicle catalog", exact: true })
    .click();
  await page.getByRole("button", { name: "Add catalog entry" }).click();
  for (const [label, value] of Object.entries({
    Make: "TEST",
    Model: "NON-VEHICLE GEOMETRY",
    "Generation / body shape": "Triangle fixture",
    Facelift: "Not applicable",
    "Visible variant / trim": "TEST ONLY",
    "Market specification": "Not a car",
    "From year": "2020",
    "To year": "2020",
  }))
    await page
      .getByRole("dialog")
      .getByLabel(label, { exact: true })
      .fill(value);
  await page.getByRole("button", { name: "Save catalog entry" }).click();
  await page.getByRole("button", { name: "3D assets & versions" }).click();
  await page.getByLabel("Exact catalog match").selectOption({
    label: "TEST NON-VEHICLE GEOMETRY · Triangle fixture · TEST ONLY",
  });
  await page.getByLabel("Self-contained GLB · max 25 MB").setInputFiles({
    name: "TEST-geometry.glb",
    mimeType: "model/gltf-binary",
    buffer: triangleGlb(),
  });
  await page
    .getByLabel("Source URL", { exact: true })
    .fill("https://example.com/test-geometry");
  await page.getByLabel("Creator", { exact: true }).fill("Automated test");
  await page
    .getByLabel("License & commercial web usage rights")
    .fill("Test fixture only. Not a vehicle asset.");
  await page.getByLabel("Required attribution").fill("Test fixture");
  await page
    .getByLabel("Compatibility / known limitations")
    .fill(
      "Not a vehicle. No supported model claim. Isolated automated test only.",
    );
  await page
    .getByLabel("Versioned geometry & hotspot configuration")
    .fill(JSON.stringify(testConfig));
  await page
    .getByRole("button", { name: "Import as unapproved version" })
    .click();
  await page.getByRole("button", { name: "Preview & verify" }).click();
  await page.locator(".model-container canvas").waitFor();
  await page.waitForFunction(
    () => !document.querySelector(".model-container .model-status"),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Approve this version" })
      .isDisabled(),
    true,
  );
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve this version" }).click();
  await waitText(page.locator(".asset-card .badge"), "APPROVED");
  check(
    "Admin adds a catalog identity, imports self-contained GLB, previews, confirms and approves a version",
  );

  const c = db.prepare("SELECT id FROM catalog WHERE make='TEST'").get();
  const a = db.prepare("SELECT id FROM assets WHERE catalog_id=?").get(c.id);
  const user = db
    .prepare("SELECT id FROM users WHERE email='browser@example.com'")
    .get();
  db.prepare(
    "INSERT INTO listings(id,seller_id,catalog_id,asset_id,title,year,price,mileage,city,description,status) VALUES('test-3d',?,?,?,'TEST GEOMETRY — NOT A VEHICLE',2020,1,0,'Test','Renderer test only','published')",
  ).run(user.id, c.id, a.id);
  db.prepare(
    "INSERT INTO photos(id,listing_id,original,display,thumbnail,mime,size) SELECT 'test-3d-photo','test-3d',original,display,thumbnail,mime,size FROM photos WHERE listing_id=? LIMIT 1",
  ).run(listingId);
  db.prepare(
    "INSERT INTO photo_areas VALUES('test-3d-photo','engine_bay')",
  ).run();
  await page.goto(`${base}/listing/test-3d`);
  await page.waitForFunction(
    () =>
      document.querySelector(".model-container canvas") &&
      !document.querySelector(".model-container .model-status"),
  );
  const canvas = page.locator(".model-container canvas"),
    box = await canvas.boundingBox();
  const cameraBefore = await page
    .locator(".model-container")
    .getAttribute("data-camera");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, {
    steps: 15,
  });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const rotated = await page
    .locator(".model-container")
    .getAttribute("data-camera");
  assert.notEqual(rotated, cameraBefore);
  await page.mouse.wheel(0, -150);
  await page.waitForTimeout(400);
  assert.notEqual(
    await page.locator(".model-container").getAttribute("data-camera"),
    rotated,
  );
  await page.getByLabel("Search parts and angles").fill("right mirror");
  await page.locator(".area-card").click();
  const held = await page
    .locator(".model-container")
    .getAttribute("data-camera");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(400);
  assert.notEqual(
    await page.locator(".model-container").getAttribute("data-camera"),
    held,
  );
  // A close-up dialog on a normal inspection never unmounts the viewer;
  // area selection itself must preserve the camera.
  await page.getByLabel("Search parts and angles").fill("engine");
  const beforeArea = await page
    .locator(".model-container")
    .getAttribute("data-camera");
  await page.locator(".area-card").click();
  await page.waitForTimeout(250);
  assert.equal(
    await page.locator(".model-container").getAttribute("data-camera"),
    beforeArea,
  );
  await page.locator(".photo-panel .seller-photo").click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  assert.equal(
    await page.locator(".model-container").getAttribute("data-camera"),
    beforeArea,
  );
  check(
    "GLB loads; mouse rotation, wheel zoom, reset and orientation-preserving part selection work (test geometry, not a car)",
  );

  await phone.goto(`${base}/listing/test-3d`);
  await phone.waitForFunction(
    () =>
      document.querySelector(".model-container canvas") &&
      !document.querySelector(".model-container .model-status"),
  );
  await phone.locator(".model-container canvas").scrollIntoViewIfNeeded();
  const touchBox = await phone.locator(".model-container canvas").boundingBox();
  const cd = await mobile.newCDPSession(phone);
  const x = touchBox.x + touchBox.width * 0.5,
    y = touchBox.y + touchBox.height * 0.5;
  const oldTouchCamera = await phone
    .locator(".model-container")
    .getAttribute("data-camera");
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let n = 1; n <= 8; n++)
    await cd.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + n * 8, y: y + n * 2 }],
    });
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.waitForTimeout(400);
  assert.notEqual(
    await phone.locator(".model-container").getAttribute("data-camera"),
    oldTouchCamera,
  );
  const prePinch = await phone
    .locator(".model-container")
    .getAttribute("data-camera");
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 25, y },
      { x: x + 25, y },
    ],
  });
  for (let n = 1; n <= 8; n++)
    await cd.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 25 - n * 4, y },
        { x: x + 25 + n * 4, y },
      ],
    });
  await cd.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.waitForTimeout(400);
  assert.notEqual(
    await phone.locator(".model-container").getAttribute("data-camera"),
    prePinch,
  );
  check("Touch drag rotates and pinch zoom works with GLB renderer");

  const fallback = await browser.newContext();
  await fallback.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type.startsWith("webgl")) return null;
      return get.call(this, type, ...args);
    };
  });
  const fp = await fallback.newPage();
  await fp.goto(`${base}/listing/test-3d`);
  await waitText(fp.locator(".model-status"), "WebGL is unavailable");
  await fp.getByLabel("Search parts and angles").fill("right mirror");
  await fp.locator(".area-card").click();
  await waitText(fp.locator(".photo-panel h2"), "Right mirror");
  assert.match(
    await fp.locator(".empty-frame").innerText(),
    /Photo not uploaded/,
  );
  check("WebGL failure keeps searchable parts and photo panel usable");
  await fallback.close();
  await mobile.close();
  assert.deepEqual(errors, []);
  check("No browser JavaScript errors");
  console.log(
    "Browser checks completed. Exact vehicle geometry remains unverified: no licensed car asset is available.",
  );
} catch (e) {
  await page.screenshot({
    path: path.join(shotDir, "failure.png"),
    fullPage: true,
  });
  console.error("Current page", page.url());
  throw e;
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
  await rm(dir, { recursive: true, force: true });
}
