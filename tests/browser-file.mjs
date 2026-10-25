import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import sharp from "sharp";

const temporary = await mkdtemp(
  path.join(os.tmpdir(), "carview-browser-file-"),
);
const folder = path.join(temporary, "extracted");
let browser,
  nativeFileURLs = true;
const errors = [],
  network = [];
const harnessOrigin = "http://carview-standalone.test/";
// Some managed test browsers block file:// through administrator policy.
// Honor that policy: use an allowed document-only HTTP fixture for functional
// checks, report the limitation, and do not claim native file-origin coverage.
async function configure(context) {
  await context.route(harnessOrigin + "**", async (route) => {
    const filename = decodeURIComponent(
      route.request().url().slice(harnessOrigin.length),
    );
    assert.ok(filename.startsWith(temporary + path.sep));
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: await readFile(filename),
    });
  });
}
const urlFor = (file) =>
  nativeFileURLs
    ? pathToFileURL(file).href
    : harnessOrigin + encodeURIComponent(file);
function observe(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !(r.isNavigationRequest() && r.url().startsWith(harnessOrigin))
    )
      network.push(r.url());
  });
}
async function ready(page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
}
async function frame(page) {
  return await page.locator("#frame-number").textContent();
}
async function waitSaved(page) {
  await page.waitForFunction(() =>
    document
      .getElementById("storage-status")
      .textContent.startsWith("Saved in this browser"),
  );
}
try {
  await mkdir(folder);
  execFileSync("python", [
    "-c",
    "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    path.resolve("downloads/CarView-Pakistan-Browser.zip"),
    folder,
  ]);
  const htmlFile = path.join(folder, "CarView-Pakistan.html");
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 1000 },
    acceptDownloads: true,
    offline: true,
  });
  await configure(context);
  let page = await context.newPage();
  observe(page);
  try {
    await page.goto(urlFor(htmlFile));
  } catch (error) {
    if (!String(error).includes("ERR_BLOCKED_BY_ADMINISTRATOR")) throw error;
    nativeFileURLs = false;
    console.log(
      "NOTE Managed Chromium blocks file://. Testing unchanged standalone HTML through a document-only HTTP fixture with all external networking offline; native file-origin execution is not verified here.",
    );
    await page.close();
    page = await context.newPage();
    observe(page);
    await page.goto(urlFor(htmlFile));
  }
  await ready(page);
  assert.equal(await page.locator("#empty").isVisible(), true);
  assert.equal(await page.locator("#loop").isDisabled(), true);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/browser-file-empty.png",
    fullPage: true,
  });
  const photos = [];
  for (let i = 1; i <= 12; i++) {
    const buffer = await sharp({
      create: {
        width: i === 1 ? 2200 : 720,
        height: 480,
        channels: 3,
        background: { r: 25 + i * 12, g: 100 + i * 7, b: 160 - i * 8 },
      },
    })
      .png()
      .toBuffer();
    photos.push({ name: i + "-angle.png", mimeType: "image/png", buffer });
  }
  await page
    .locator("#files")
    .setInputFiles([
      photos[11],
      photos[1],
      photos[0],
      {
        name: "broken.png",
        mimeType: "image/png",
        buffer: Buffer.from("not a photograph"),
      },
    ]);
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 3 &&
      document.getElementById("busy").hidden,
  );
  assert.deepEqual(await page.locator(".thumb span").allTextContents(), [
    "1-angle.png",
    "2-angle.png",
    "12-angle.png",
  ]);
  assert.match(await page.locator("#notice-text").textContent(), /broken.png/);
  await page.waitForFunction(
    () => document.getElementById("photo").naturalWidth === 1600,
  );
  assert.equal(await page.locator("#previous").isDisabled(), true);
  await page.locator("#stage").focus();
  await page.keyboard.press("End");
  assert.equal(await frame(page), "03");
  assert.equal(await page.locator("#next").isDisabled(), true);
  await page.locator("#stage").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await frame(page), "03");
  await page.locator("#stage").focus();
  await page.keyboard.press("Home");
  await page.locator("#zoom-in").click();
  assert.equal(await page.locator("#zoom-label").textContent(), "1.25×");
  await page.locator("#zoom-out").click();
  await page.locator("#move-right").click();
  assert.deepEqual(await page.locator(".thumb span").allTextContents(), [
    "2-angle.png",
    "1-angle.png",
    "12-angle.png",
  ]);
  await page.locator("#sort").click();
  await page.locator("#files").setInputFiles(photos.slice(2, 11).reverse());
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 12 &&
      document.getElementById("busy").hidden,
  );
  await page.locator("#sort").click();
  assert.deepEqual(
    await page.locator(".thumb span").allTextContents(),
    photos.map((p) => p.name),
  );
  await page.locator("#loop").check();
  await page.locator("#stage").focus();
  await page.keyboard.press("End");
  await page.locator("#next").click();
  assert.equal(await frame(page), "01");
  const stage = await page.locator("#stage").boundingBox();
  await page.mouse.move(stage.x + stage.width * 0.75, stage.y + 180);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.35, stage.y + 180, {
    steps: 8,
  });
  await page.mouse.up();
  assert.notEqual(await frame(page), "01");
  await page.locator("#car-title").fill("Toyota Corolla");
  await page.locator("#car-year").fill("2020");
  await page.locator("#car-city").fill("Lahore");
  const dangerous =
    "</script><script>window.carviewInjection=true</script><img src=x onerror=window.carviewInjection=true>";
  await page.locator("#car-notes").fill(dangerous);
  await waitSaved(page);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator(".thumb").count(), 12);
  assert.equal(await page.locator("#car-title").inputValue(), "Toyota Corolla");
  assert.equal(await page.locator("#loop").isChecked(), true);
  assert.equal(await page.locator("#car-notes").inputValue(), dangerous);
  await page.getByRole("button", { name: "Play photo sequence" }).click();
  await page.waitForFunction(
    () => document.getElementById("frame-number").textContent !== "01",
  );
  await page.getByRole("button", { name: "Pause photo sequence" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadEvent,
    savedFile = path.join(temporary, download.suggestedFilename());
  await download.saveAs(savedFile);
  const exportedSource = await readFile(savedFile, "utf8");
  assert.match(exportedSource, /\\u003c\/script/);
  assert.equal((exportedSource.match(/id="carview-data"/g) || []).length, 1);
  await page.screenshot({
    path: "test-results/browser-file-photos.png",
    fullPage: true,
  });
  console.log(
    "PASS Extracted single HTML: real photo decoding, numeric sorting, resize, keyboard/drag/zoom/play, loop confirmation, ordering, details and reload persistence",
  );
  const clean = await browser.newContext({
    offline: true,
    acceptDownloads: true,
  });
  await configure(clean);
  const restored = await clean.newPage();
  observe(restored);
  await restored.goto(urlFor(savedFile));
  await ready(restored);
  assert.equal(await restored.locator(".thumb").count(), 12);
  assert.equal(
    await restored.locator("#car-title").inputValue(),
    "Toyota Corolla",
  );
  assert.equal(await restored.locator("#car-notes").inputValue(), dangerous);
  assert.equal(await restored.evaluate(() => !!window.carviewInjection), false);
  await restored.waitForFunction(
    () => document.getElementById("photo").naturalWidth > 0,
  );
  // A second export must stay self-contained, without duplicating the source template.
  const secondEvent = restored.waitForEvent("download");
  await restored.locator("#export").click();
  const second = await secondEvent;
  const secondFile = path.join(temporary, "second.html");
  await second.saveAs(secondFile);
  const secondSource = await readFile(secondFile, "utf8");
  assert.ok(secondSource.length < exportedSource.length * 1.05);
  const secondPage = await clean.newPage();
  observe(secondPage);
  await secondPage.goto(urlFor(secondFile));
  await ready(secondPage);
  assert.equal(await secondPage.locator(".thumb").count(), 12);
  await secondPage.locator("#remove").click();
  assert.equal(await secondPage.locator("#loop").isChecked(), false);
  assert.equal(await secondPage.locator("#loop").isDisabled(), true);
  console.log(
    "PASS Exported HTML includes photos/details, opens offline in a clean browser, safely escapes embedded text, re-exports without growth and clears loop confirmation after editing",
  );
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    offline: true,
  });
  await configure(mobileContext);
  const mobile = await mobileContext.newPage();
  observe(mobile);
  await mobile.goto(urlFor(savedFile));
  await ready(mobile);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobile.locator("#stage").scrollIntoViewIfNeeded();
  const mobileStage = await mobile.locator("#stage").boundingBox(),
    cdp = await mobileContext.newCDPSession(mobile);
  const touchY = mobileStage.y + mobileStage.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: mobileStage.x + mobileStage.width * 0.85, y: touchY }],
  });
  for (const fraction of [0.7, 0.55, 0.4, 0.25])
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: mobileStage.x + mobileStage.width * fraction, y: touchY },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.notEqual(await frame(mobile), "01");
  await mobile.screenshot({
    path: "test-results/browser-file-mobile.png",
    fullPage: true,
  });
  // Storage can be blocked on file origins or in private modes; export still works.
  const unavailableContext = await browser.newContext({
    offline: true,
    acceptDownloads: true,
  });
  await configure(unavailableContext);
  await unavailableContext.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Storage disabled for test");
      },
    });
  });
  const unavailable = await unavailableContext.newPage();
  observe(unavailable);
  await unavailable.goto(urlFor(htmlFile));
  await ready(unavailable);
  assert.match(
    await unavailable.locator("#storage-status").textContent(),
    /Session only/,
  );
  await unavailable.locator("#files").setInputFiles([photos[0]]);
  await unavailable.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 1 &&
      document.getElementById("busy").hidden,
  );
  const fallback = unavailable.waitForEvent("download");
  await unavailable.locator("#export").click();
  await fallback;
  assert.equal(await unavailable.locator("#photo").isVisible(), true);
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS Mobile layout/swipe and unavailable browser-storage fallback; zero external network requests or page errors across offline sessions",
  );
} finally {
  if (browser) await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
