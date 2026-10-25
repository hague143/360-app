import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright-core";
import sharp from "sharp";

const temporary = await mkdtemp(
  path.join(os.tmpdir(), "carview-browser-media-"),
);
let browser;
const errors = [],
  external = [];
const origin = "http://carview-media-fixture.test";
async function open(html, mobile = false) {
  const context = await browser.newContext({
    offline: true,
    acceptDownloads: true,
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1365, height: 1000 },
    hasTouch: mobile,
    isMobile: mobile,
  });
  // The managed browser blocks file://. This allowed fixture serves only the
  // unchanged single HTML document, with external networking offline.
  await context.route(origin + "/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: html }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      !(request.isNavigationRequest() && request.url().startsWith(origin + "/"))
    )
      external.push(request.url());
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(origin + "/index.html");
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  return { context, page };
}
async function matrix(page) {
  return page.locator("#photo").evaluate((image) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(image).transform);
    return { zoom: m.a, x: m.e, y: m.f };
  });
}
async function downloadedHTML(page, name) {
  const event = page.waitForEvent("download");
  await page.locator("#export").click();
  const file = path.join(temporary, name);
  await (await event).saveAs(file);
  return await readFile(file, "utf8");
}
try {
  execFileSync("python", [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    path.resolve("downloads/CarView-Pakistan-Browser.zip"),
    temporary,
  ]);
  const html = await readFile(
    path.join(temporary, "CarView-Pakistan.html"),
    "utf8",
  );
  const clip = path.join(temporary, "test-pattern.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30:duration=6",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-y",
    clip,
  ]);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const { page } = await open(html);
  // Photos remain a separate, fully working source with optional higher detail.
  await page.locator("#detail-quality").selectOption("2560");
  const detail = await sharp({
    create: { width: 3000, height: 1800, channels: 3, background: "#5588aa" },
  })
    .png()
    .toBuffer();
  await page.locator("#files").setInputFiles({
    name: "detail.png",
    mimeType: "image/png",
    buffer: detail,
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 1 &&
      document.getElementById("busy").hidden,
  );
  await page.waitForFunction(
    () => document.getElementById("photo").naturalWidth === 2560,
  );
  await page.locator("#video-tab").click();
  await page.locator("#video-file").setInputFiles(clip);
  await page.waitForFunction(
    () =>
      !document.getElementById("video-settings").hidden &&
      document.getElementById("busy").hidden,
  );
  assert.equal(await page.locator("#video-frames").inputValue(), "72");
  await page.locator("#video-start").fill("5");
  await page.locator("#video-end").fill("1");
  await page.locator("#create-video").click();
  assert.match(
    await page.locator("#notice-text").textContent(),
    /Start\/end check/,
  );
  assert.equal(await page.locator(".thumb").count(), 1);
  await page.locator("#video-start").fill("1");
  await page.locator("#video-end").fill("5");
  // Cancel must preserve the existing sequence rather than commit partial frames.
  await page.locator("#create-video").click();
  await page.locator("#cancel-import").click();
  await page.waitForFunction(() => document.getElementById("busy").hidden);
  assert.equal(await page.locator(".thumb").count(), 1);
  assert.match(await page.locator("#notice-text").textContent(), /cancelled/);
  await page.locator("#create-video").click();
  await page.waitForFunction(
    () => document.getElementById("busy").hidden,
    null,
    { timeout: 90000 },
  );
  assert.equal(
    await page.locator(".thumb").count(),
    72,
    await page.locator("#notice-text").textContent(),
  );
  const names = await page.locator(".thumb span").allTextContents();
  assert.match(names[0], /^001-video-1\.00s/);
  assert.match(names[71], /^072-video-4\.94s/);
  assert.equal(await page.locator("#loop").isChecked(), false);
  assert.equal(await page.locator("#previous").isDisabled(), true);
  await page.locator("#stage").focus();
  await page.keyboard.press("End");
  assert.equal(await page.locator("#next").isDisabled(), true);
  await page.locator("#loop").check();
  await page.locator("#next").click();
  assert.equal(await page.locator("#frame-number").textContent(), "01");
  const exported = await downloadedHTML(page, "video-frames.html");
  const payload = JSON.parse(
    exported.match(
      /<script[^>]*id="carview-data"[^>]*>([\s\S]*?)<\/script>/,
    )[1],
  );
  assert.equal(payload.photos.length, 72);
  assert.ok(
    new Set(payload.photos.map((photo) => photo.src)).size >= 65,
    "Seeked frames must show distinct actual video contents; got " +
      new Set(payload.photos.map((photo) => photo.src)).size,
  );
  const first = await sharp(
    Buffer.from(payload.photos[0].src.split(",")[1], "base64"),
  ).stats();
  const last = await sharp(
    Buffer.from(payload.photos[71].src.split(",")[1], "base64"),
  ).stats();
  assert.notDeepEqual(
    first.channels.map((c) => c.mean),
    last.channels.map((c) => c.mean),
  );
  await page.waitForFunction(() =>
    document
      .getElementById("storage-status")
      .textContent.startsWith("Saved in this browser"),
  );
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  assert.equal(await page.locator(".thumb").count(), 72);
  const { page: restored } = await open(exported);
  assert.equal(await restored.locator(".thumb").count(), 72);
  assert.equal(await restored.locator("#loop").isChecked(), true);
  console.log(
    "PASS Photos retain optional 2560px detail; real MP4 preview/trim, safe cancellation, 72 decoded frames, exclusive end, manual loop confirmation, persistence and portable export",
  );
  await restored.locator("#inspect-mode").click();
  const before = await matrix(restored),
    angle = await restored.locator("#frame-number").textContent();
  const box = await restored.locator("#stage").boundingBox();
  await restored.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await restored.mouse.down();
  await restored.mouse.move(
    box.x + box.width / 2 + 70,
    box.y + box.height / 2 + 35,
    { steps: 5 },
  );
  await restored.mouse.up();
  const after = await matrix(restored);
  assert.equal(after.zoom, 2);
  assert.notEqual(after.x, before.x);
  assert.notEqual(after.y, before.y);
  assert.equal(await restored.locator("#frame-number").textContent(), angle);
  await restored.locator("#rotate-mode").click();
  await restored.mouse.move(box.x + box.width * 0.7, box.y + 150);
  await restored.mouse.down();
  await restored.mouse.move(box.x + box.width * 0.4, box.y + 150, { steps: 6 });
  await restored.mouse.up();
  assert.notEqual(await restored.locator("#frame-number").textContent(), angle);
  assert.equal((await matrix(restored)).zoom, 2);
  await restored.locator("#fit").click();
  assert.deepEqual(await matrix(restored), { zoom: 1, x: 0, y: 0 });
  await restored.mouse.move(box.x + box.width * 0.35, box.y + 150);
  await restored.mouse.wheel(0, -250);
  await restored.waitForFunction(
    () =>
      Number(
        document.getElementById("zoom-label").textContent.replace("×", ""),
      ) > 1,
  );
  assert.equal(
    await restored.locator("#inspect-mode").getAttribute("aria-pressed"),
    "true",
  );
  const { page: mobile, context: mobileContext } = await open(exported, true);
  await mobile.locator("#stage").scrollIntoViewIfNeeded();
  const mobileBox = await mobile.locator("#stage").boundingBox(),
    cdp = await mobileContext.newCDPSession(mobile);
  const x = mobileBox.x + mobileBox.width / 2,
    y = mobileBox.y + mobileBox.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: x - 30, y },
      { x: x + 30, y },
    ],
  });
  for (const distance of [40, 55, 75, 90])
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - distance, y },
        { x: x + distance, y },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok((await matrix(mobile)).zoom > 2);
  assert.equal(await mobile.locator("#frame-number").textContent(), "01");
  const prePan = await matrix(mobile);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 50, y: y + 30 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual((await matrix(mobile)).x, prePan.x);
  assert.equal(await mobile.locator("#frame-number").textContent(), "01");
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mkdir("test-results", { recursive: true });
  await mobile.screenshot({
    path: "test-results/browser-media-mobile.png",
    fullPage: true,
  });
  await page.locator("#video-tab").click();
  await page.locator("#video-file").setInputFiles(clip);
  await page.waitForFunction(
    () =>
      !document.getElementById("video-settings").hidden &&
      document.getElementById("busy").hidden,
  );
  await page.locator("#video-frames").selectOption("36");
  await page.locator("#create-video").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 36 &&
      document.getElementById("busy").hidden,
    null,
    { timeout: 90000 },
  );
  assert.match(
    await page.locator(".thumb span").first().textContent(),
    /^001-video-0\.00s/,
  );
  await page.locator("#video-file").setInputFiles({
    name: "bad.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("invalid video"),
  });
  await page.waitForFunction(() => document.getElementById("busy").hidden);
  assert.match(await page.locator("#notice-text").textContent(), /decode nahi/);
  assert.equal(await page.locator(".thumb").count(), 36);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS Detail pan keeps the angle fixed; rotate-while-zoomed, fit, anchored wheel zoom, real two-finger pinch and one-finger pan work; corrupt video preserves saved photos",
  );
  console.log(
    "NOTE Native file:// remains blocked by managed browser policy; all checks use document-only HTTP fixtures with external networking offline",
  );
} finally {
  if (browser) await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
