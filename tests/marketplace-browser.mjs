import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const temporary = await mkdtemp(path.join(os.tmpdir(), "carview-marketplace-"));
let browser;
const errors = [],
  external = [];
const origin = "http://carview-marketplace-fixture.test";
const directRelease = process.env.CARVIEW_TEST_RELEASE === "direct";
async function open(html, mobile = false) {
  const context = await browser.newContext({
    offline: true,
    acceptDownloads: true,
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1100 },
    hasTouch: mobile,
    isMobile: mobile,
  });
  // Managed Chromium blocks file://. This document-only fixture honors its
  // policy and keeps every external request offline; it provides no API.
  await context.route(origin + "/**", (route) =>
    route.fulfill({ contentType: "text/html; charset=utf-8", body: html }),
  );
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.isNavigationRequest())
      external.push(request.url());
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(origin + "/index.html");
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  return { context, page };
}
async function click(page, name) {
  if (name === "My ads") return await page.locator("#nav-garage").click();
  if (name === "Explore cars") return await page.locator("#nav-browse").click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function next(page) {
  await click(page, "Save & continue →");
}
async function readyStudio(page) {
  const frame = page.frameLocator(".studio-frame");
  await frame.locator('html[data-ready="true"]').waitFor();
  return frame;
}
async function assertBuyerMedia(page, photoCount) {
  let frame = await readyStudio(page);
  assert.equal(
    await frame.locator("#photo").isVisible(),
    true,
    "Buyer sees actual studio photograph",
  );
  await frame.locator("#photo").evaluate((image) => image.decode());
  const before = await frame.locator("#photo").getAttribute("src");
  await frame.locator("#next").click();
  assert.notEqual(
    await frame.locator("#photo").getAttribute("src"),
    before,
    "Buyer rotation changes actual photo",
  );
  await page.locator("#detail-photos-tab").click();
  assert.equal(
    await page.locator(".detail-thumbs button").count(),
    photoCount,
    "All gallery images and frames stay available",
  );
  assert.equal(await page.locator("#detail-image").isVisible(), true);
  await page.locator(".detail-thumbs button").last().click();
  await page.locator("#detail-image").evaluate((image) => image.decode());
  await page.locator("#detail-video-tab").click();
  await page.waitForFunction(
    () => document.querySelector("#detail-video-player").readyState >= 2,
  );
  await page.locator("#detail-video-player").evaluate(async (video) => {
    await video.play();
  });
  await page.waitForFunction(
    () => document.querySelector("#detail-video-player").currentTime > 0.05,
  );
  await page.locator("#detail-studio-tab").click();
  assert.equal(
    await page
      .locator("#detail-video-player")
      .evaluate((video) => video.paused),
    true,
  );
  frame = await readyStudio(page);
  assert.equal(await frame.locator("#photo").isVisible(), true);
}
async function exported(page, button, name) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: button, exact: true }).click();
  const download = await event;
  const file = path.join(temporary, name);
  await download.saveAs(file);
  return { file, text: await readFile(file, "utf8") };
}
function payload(html) {
  return JSON.parse(
    html.match(
      /<script[^>]*id="marketplace-data"[^>]*>([\s\S]*?)<\/script>/,
    )[1],
  );
}
try {
  execFileSync("python", [
    "-c",
    `import zipfile,sys,json,hashlib
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 manifest=json.loads(z.read('CONTENTS-SHA256.json'))
 assert hashlib.sha256(z.read('CarView-Pakistan-Marketplace.html')).hexdigest()==manifest['html_sha256']
 z.extractall(sys.argv[2])`,
    path.resolve("downloads/CarView-Pakistan-Marketplace.zip"),
    temporary,
  ]);
  const html = await readFile(
    directRelease
      ? "downloads/CarView-Neon-Direct.html"
      : path.join(temporary, "CarView-Pakistan-Marketplace.html"),
    "utf8",
  );
  const original = await readFile("downloads/CarView-Pakistan.html");
  assert.equal(
    createHash("sha256").update(original).digest("hex"),
    "56a9872dfd8072da85009535e585e496684f5bfb39584211cf8e927e198125cf",
  );
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
    ],
  });
  const { page, context } = await open(html);
  await page
    .getByRole("heading", { name: "Your showroom starts with one car." })
    .waitFor();
  const fixtures = [];
  for (let index = 0; index < 12; index++)
    fixtures.push({
      name: String(index + 1).padStart(2, "0") + "-angle.png",
      mimeType: "image/png",
      buffer: await sharp({
        create: {
          width: 900,
          height: 600,
          channels: 3,
          background: { r: 30 + index * 12, g: 120, b: 160 - index * 7 },
        },
      })
        .png()
        .toBuffer(),
    });
  await page.waitForFunction(
    () => document.querySelector("#hero-vehicle").dataset.render === "empty",
  );
  assert.equal(await page.locator(".showroom-empty").isVisible(), true);
  assert.ok(
    !html.includes("CarViewHero.mount"),
    "Synthetic car renderer removed from release",
  );
  await page.locator("#showroom-files").setInputFiles(fixtures.slice(0, 4));
  await page.waitForFunction(
    () => document.querySelector("#hero-vehicle").dataset.render === "photos",
  );
  await page.locator("#showroom-photo").evaluate((image) => image.decode());
  assert.equal(await page.locator(".showroom-photo-strip button").count(), 4);
  await page.getByRole("button", { name: "Pause showroom photos" }).click();
  const pausedFrame = await page
    .locator("#hero-vehicle")
    .getAttribute("data-frame");
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator("#hero-vehicle").getAttribute("data-frame"),
    pausedFrame,
  );
  await page.getByRole("button", { name: "Next showroom photo" }).click();
  assert.equal(
    await page.locator("#hero-vehicle").getAttribute("data-frame"),
    "1",
  );
  await page.locator("#hero-vehicle").press("End");
  assert.equal(
    await page.locator("#hero-vehicle").getAttribute("data-frame"),
    "3",
  );
  await click(page, "Arrange photos");
  assert.equal(
    await page.locator("#showroom-full-lap").isDisabled(),
    true,
    "Four press images must not be labelled a continuous lap",
  );
  await page
    .getByRole("button", { name: "Move showroom photo 4 earlier" })
    .click();
  assert.match(
    await page.locator("#showroom-filename").textContent(),
    /04-angle/,
  );
  const heroCopy = await exported(
    page,
    "Save app copy",
    "showroom-photos.html",
  );
  assert.equal(payload(heroCopy.text).showroom.photos.length, 4);
  assert.equal(payload(heroCopy.text).showroom.fullLap, false);
  const { page: heroRestored } = await open(heroCopy.text);
  await heroRestored
    .locator("#showroom-photo")
    .evaluate((image) => image.decode());
  assert.equal(
    await heroRestored.locator(".showroom-photo-strip button").count(),
    4,
  );
  assert.equal(
    await heroRestored.locator(".car-card").count(),
    0,
    "Showroom photos never become seller ads",
  );
  await heroRestored
    .getByRole("button", { name: "Pause showroom photos" })
    .click();
  const heroBox = await heroRestored.locator("#hero-vehicle").boundingBox();
  await heroRestored.mouse.move(
    heroBox.x + heroBox.width * 0.75,
    heroBox.y + heroBox.height * 0.5,
  );
  await heroRestored.mouse.down();
  await heroRestored.mouse.move(
    heroBox.x + heroBox.width * 0.75 - 90,
    heroBox.y + heroBox.height * 0.5,
    { steps: 6 },
  );
  await heroRestored.mouse.up();
  assert.equal(
    await heroRestored.locator("#hero-vehicle").getAttribute("data-frame"),
    "2",
  );
  await heroRestored.locator("#showroom-files").setInputFiles(fixtures);
  await heroRestored.waitForFunction(
    () =>
      document.querySelectorAll(".showroom-photo-strip button").length === 12,
  );
  await click(heroRestored, "Arrange photos");
  assert.equal(
    await heroRestored.locator("#showroom-full-lap").isDisabled(),
    false,
  );
  await heroRestored.locator("#showroom-full-lap").check();
  await heroRestored
    .getByRole("button", { name: "Play showroom photos" })
    .click();
  const lapBefore = await heroRestored
    .locator("#hero-vehicle")
    .getAttribute("data-frame");
  await heroRestored.waitForFunction(
    (index) => document.querySelector("#hero-vehicle").dataset.frame !== index,
    lapBefore,
    { timeout: 2000 },
  );
  const lapCopy = await exported(
    heroRestored,
    "Save app copy",
    "showroom-full-lap.html",
  );
  assert.equal(payload(lapCopy.text).showroom.fullLap, true);
  assert.equal(payload(lapCopy.text).showroom.photos.length, 12);
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  assert.equal(
    await page.locator(".showroom-photo-strip button").count(),
    4,
    "Showroom photos survive reload",
  );
  await page.locator("#showroom-files").setInputFiles({
    name: "bad.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("not an image"),
  });
  await page.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("Use a JPG"),
  );
  assert.equal(
    await page.locator(".showroom-photo-strip button").count(),
    4,
    "Failed replacement keeps the previous photos",
  );
  await page.getByRole("button", { name: "Pause showroom photos" }).click();
  await page.getByRole("button", { name: "Play showroom photos" }).click();
  const startFrame = await page
    .locator("#hero-vehicle")
    .getAttribute("data-frame");
  await page.waitForFunction(
    (frame) => document.querySelector("#hero-vehicle").dataset.frame !== frame,
    startFrame,
    { timeout: 6000 },
  );
  assert.match(
    await page.locator(".scene-topline").textContent(),
    /LEXUS LX.*WHITE/,
  );
  console.log(
    "PASS Real photo selection, manual controls/drag/order, autoplay/pause, failed replacement safety, reload persistence and self-contained showroom HTML",
  );
  const scene = await page.locator(".hero-scene").boundingBox();
  await page.mouse.move(
    scene.x + scene.width * 0.8,
    scene.y + scene.height * 0.3,
  );
  await page.waitForFunction(
    () =>
      Math.abs(
        parseFloat(
          document.querySelector(".hero-scene").style.getPropertyValue("--ry"),
        ),
      ) > 0.1,
  );
  await page.getByRole("button", { name: "Toggle studio glow" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Toggle studio glow" })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.getByRole("button", { name: "Toggle studio glow" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".hero-scene")
      .evaluate((element) => getComputedStyle(element).transform),
    "none",
  );
  await page.getByRole("button", { name: "Find a car", exact: true }).click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "search-query",
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.mouse.move(5, 5);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/marketplace-home.png",
    fullPage: true,
    animations: "disabled",
  });
  await click(page, "＋ Sell your car");
  await next(page);
  await page.locator("#form-errors").waitFor();
  assert.match(
    await page.locator("#form-errors").textContent(),
    /City is required/,
  );
  await page.locator("#field-city").fill("Lahore");
  await page.locator("#field-area").fill("DHA Phase 6");
  await page.locator("#field-make").selectOption("Toyota");
  await page.locator("#field-model").selectOption("Corolla");
  await page.locator("#field-year").selectOption("2020");
  await page.locator("#field-variant").fill("GLi 1.3");
  await next(page);
  await page.locator("#field-registration").fill("Lahore");
  await page.locator("#field-mileage").fill("65000");
  await page.locator("#field-color").fill("White");
  await page.locator("#field-assembly").selectOption("Local");
  await page.locator("#field-fuel").selectOption("Petrol");
  await page.locator("#field-transmission").selectOption("Automatic");
  await page.locator("#field-engineCC").fill("1300");
  await page.locator("#field-bodyType").selectOption("Sedan");
  await page.locator("#field-price").fill("3850000");
  const description =
    "Regularly maintained. Test description: </script><script>window.carviewInjection=true</script><img src=x onerror=window.carviewInjection=true> Known faults described honestly.";
  await page.locator("#field-description").fill(description);
  await page.getByLabel("ABS", { exact: true }).check();
  await page.getByLabel("Power mirrors", { exact: true }).check();
  await page.screenshot({
    path: "test-results/marketplace-specifications.png",
    fullPage: true,
  });
  await next(page);
  let frame = await readyStudio(page);
  await page.locator("#gallery-files").setInputFiles(fixtures.slice(0, 2));
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".gallery-item").length === 2 &&
      document.getElementById("photo-busy").hidden,
  );
  await frame.locator("#files").setInputFiles(fixtures);
  await frame.locator(".thumb").nth(11).waitFor();
  await frame.locator("#loop").check();
  await page.waitForFunction(
    () =>
      document
        .getElementById("studio-caption")
        .textContent.includes("12 frames saved"),
    null,
    { timeout: 20000 },
  );
  await page.getByRole("button", { name: "Use photo 2 as cover" }).click();
  assert.equal(await frame.locator(".thumb").count(), 12);
  // The studio's own native HTML export remains a normal standalone download.
  const nativeEvent = page.waitForEvent("download");
  await frame.locator("#export").click();
  const native = await nativeEvent;
  const nativeFile = path.join(temporary, "saved-360.html");
  await native.saveAs(nativeFile);
  const nativeText = await readFile(nativeFile, "utf8");
  assert.ok(nativeText.includes('id="carview-data"'));
  assert.ok(
    !nativeText.includes("carview:capture"),
    "Host bridge must not leak into standalone studio export",
  );
  assert.ok(
    !nativeText.includes("host-managed-studio-storage"),
    "Native studio export must retain its normal standalone persistence",
  );
  // Existing video replacement confirmation and decode work inside the wrapper.
  const clip = path.join(temporary, "pattern.mp4");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30:duration=4",
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
  await frame.locator("#video-tab").click();
  await frame.locator("#video-file").setInputFiles(clip);
  await frame.locator("#video-settings").waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector(".video-file-row")
      ?.textContent.includes("pattern.mp4"),
  );
  await frame.locator("#video-frames").selectOption("36");
  await frame.locator("#create-video").click();
  await frame.locator("#busy").waitFor({ state: "hidden", timeout: 90000 });
  assert.equal(
    await frame.locator(".thumb").count(),
    36,
    await frame.locator("#notice-text").textContent(),
  );
  await frame.locator("#loop").check();
  await frame.locator("#inspect-mode").click();
  assert.equal(await frame.locator("#zoom-label").textContent(), "2×");
  await next(page);
  await page.locator("#field-name").waitFor();
  await page.locator("#field-name").fill("Test seller");
  await page.locator("#field-phone").fill("123");
  await click(page, "Preview ad →");
  assert.match(
    await page.locator("#form-errors").textContent(),
    /Pakistani mobile/,
  );
  await page.locator("#field-phone").fill("03001234567");
  await page
    .getByText("Buyers can contact me on WhatsApp at this number", {
      exact: true,
    })
    .click();
  await click(page, "Preview ad →");
  await page
    .getByText("This is your buyer preview.", { exact: true })
    .waitFor();
  frame = await readyStudio(page);
  assert.equal(await frame.locator(".thumb").count(), 36);
  await assertBuyerMedia(page, 38);
  frame = await readyStudio(page);
  assert.equal(await frame.locator("#inspect-mode").isVisible(), true);
  assert.equal(await frame.locator("#video-tab").isVisible(), false);
  await page.screenshot({
    path: "test-results/marketplace-preview.png",
    fullPage: true,
  });
  await click(page, "Save to showroom →");
  await page.locator(".detail-heading h1").waitFor();
  await assertBuyerMedia(page, 38);
  assert.match(
    await page.locator(".detail-heading h1").textContent(),
    /Toyota Corolla GLi 1.3 2020/,
  );
  assert.equal(await page.locator("#revealed-contact").isVisible(), false);
  await click(page, "Show phone number");
  assert.equal(
    await page.getByRole("link", { name: "Call seller" }).getAttribute("href"),
    "tel:+923001234567",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "Contact on WhatsApp ↗" })
      .getAttribute("href"),
    "https://wa.me/923001234567",
  );
  assert.equal(await page.evaluate(() => !!window.carviewInjection), false);
  const downloaded = await exported(page, "Download this ad", "car-ad.html"),
    data = payload(downloaded.text);
  assert.equal(data.ads.length, 1);
  assert.equal(data.ads[0].studio.photos.length, 36);
  assert.equal(data.ads[0].gallery.length, 2);
  assert.equal(
    data.showroom.photos.length,
    4,
    "Ad HTML retains actual home-showcase photos",
  );
  assert.match(data.ads[0].video.src, /^data:video\/mp4;base64,/);
  const videoBytes = Buffer.from(data.ads[0].video.src.split(",")[1], "base64");
  assert.deepEqual(
    videoBytes,
    await readFile(clip),
    "Original clip bytes must survive ad export",
  );
  assert.equal(data.ads[0].details.description, description);
  const { page: copy } = await open(downloaded.text);
  await copy.locator(".detail-heading h1").waitFor();
  frame = await readyStudio(copy);
  assert.equal(await frame.locator(".thumb").count(), 36);
  await assertBuyerMedia(copy, 38);
  await copy.reload();
  await copy.locator(".detail-heading h1").waitFor();
  await assertBuyerMedia(copy, 38);
  assert.equal(await copy.evaluate(() => !!window.carviewInjection), false);
  console.log(
    "PASS Five-step validation, car/price/features/contact, gallery covers, unchanged photo/video studio, buyer preview, phone/WhatsApp and portable ad with 36-frame media",
  );
  await click(page, "Explore cars");
  await page.locator(".car-card").waitFor();
  assert.equal(await page.locator(".car-card").count(), 1);
  await page.locator("#search-maxPrice").fill("2000000");
  await click(page, "Search cars");
  assert.equal(await page.locator(".car-card").count(), 0);
  await click(page, "Reset filters");
  await page.locator("#search-city").fill("Lahore");
  await page.locator("#search-make").selectOption("Toyota");
  await click(page, "Search cars");
  assert.equal(await page.locator(".car-card").count(), 1);
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  assert.equal(await page.locator(".car-card").count(), 1);
  await click(page, "My ads");
  await click(page, "Edit ad");
  await page.locator('[data-action="step"][data-step="3"]').click();
  frame = await readyStudio(page);
  assert.equal(await frame.locator(".thumb").count(), 36);
  await page.locator("#studio-import").setInputFiles(nativeFile);
  await page.waitForFunction(() =>
    document
      .getElementById("studio-caption")
      .textContent.includes("12 frames saved"),
  );
  frame = await readyStudio(page);
  assert.equal(await frame.locator(".thumb").count(), 12);
  await click(page, "Save & exit");
  await click(page, "＋ Add a car");
  await page.locator("#field-make").selectOption("Other");
  await page.locator("#field-customMake").fill("Custom make");
  await page.locator("#field-customModel").fill("Custom model");
  await click(page, "Save & exit");
  const backup = await exported(page, "Download backup", "backup.html");
  assert.equal(payload(backup.text).ads.length, 2);
  // A copied ad in the SAME browser must not replace the two-ad workspace.
  await context.route(origin + "/copy.html", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: downloaded.text,
    }),
  );
  const sibling = await context.newPage();
  sibling.on("pageerror", (error) => errors.push(error.message));
  await sibling.goto(origin + "/copy.html");
  await sibling.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  await click(page, "My ads");
  const isolated = await exported(
    page,
    "Download backup",
    "isolated-backup.html",
  );
  assert.equal(payload(isolated.text).ads.length, 2);
  assert.equal(
    payload(isolated.text).ads.find((ad) => ad.details.make === "Toyota").studio
      .photos.length,
    12,
  );
  const row = page
    .locator(".garage-row")
    .filter({ hasText: "Toyota Corolla GLi 1.3 2020" });
  await row
    .getByRole("button", { name: "Continue draft", exact: true })
    .click();
  await page.locator('[data-action="step"][data-step="5"]').click();
  await click(page, "Save to showroom →");
  await page.locator(".detail-heading h1").waitFor();
  await click(page, "My ads");
  await page.getByRole("button", { name: "Mark sold", exact: true }).click();
  await page.getByText("SOLD", { exact: true }).waitFor();
  await click(page, "Explore cars");
  await page
    .getByRole("heading", { name: "Your showroom starts with one car." })
    .waitFor();
  assert.equal(await page.locator(".car-card").count(), 0);
  await click(page, "My ads");
  await page
    .locator(".garage-row")
    .filter({ hasText: "Toyota Corolla GLi 1.3 2020" })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".garage-row").length === 1,
  );
  console.log(
    "PASS Ad-copy storage is isolated in the same browser; sold cars leave search and deletion removes only the selected ad",
  );
  const { page: mobile } = await open(downloaded.text, true);
  await mobile.locator(".detail-heading h1").waitFor();
  frame = await readyStudio(mobile);
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await frame.locator("#inspect-mode").click();
  assert.equal(await frame.locator("#zoom-label").textContent(), "2×");
  await mobile.screenshot({
    path: "test-results/marketplace-mobile.png",
    fullPage: true,
  });
  const { page: mobileHome } = await open(html, true);
  await mobileHome.waitForFunction(
    () => document.querySelector("#hero-vehicle").dataset.render === "empty",
  );
  assert.equal(
    await mobileHome.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobileHome.screenshot({
    path: "test-results/marketplace-neon-mobile-home.png",
    fullPage: true,
    animations: "disabled",
  });
  // Failed parent persistence must not lose exportability.
  const fallbackContext = await browser.newContext({
    offline: true,
    acceptDownloads: true,
  });
  await fallbackContext.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("Blocked storage fixture");
      },
    }),
  );
  await fallbackContext.route(origin + "/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: downloaded.text,
    }),
  );
  const fallback = await fallbackContext.newPage();
  fallback.on("pageerror", (error) => errors.push(error.message));
  await fallback.goto(origin + "/index.html");
  await fallback.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  assert.match(
    await fallback.locator("#storage-status").textContent(),
    /Session only/,
  );
  await exported(fallback, "Download this ad", "fallback.html");
  // Older ads still open; create an original-video-only ad through the real
  // uploader without requiring a derived 360 sequence or gallery photo.
  const legacyState = structuredClone(data);
  legacyState.copyId = "legacy-media-fixture";
  delete legacyState.ads[0].video;
  delete legacyState.showroom;
  function withData(state) {
    return downloaded.text.replace(
      /(<script[^>]*id="marketplace-data"[^>]*>)[\s\S]*?(<\/script>)/,
      (_, start, end) =>
        start + JSON.stringify(state).replace(/</g, "\\u003c") + end,
    );
  }
  const { page: legacy } = await open(withData(legacyState));
  await readyStudio(legacy);
  assert.equal(await legacy.locator("#detail-video-tab").count(), 0);
  assert.equal(
    await legacy.frameLocator(".studio-frame").locator("#photo").isVisible(),
    true,
  );
  const videoState = structuredClone(legacyState);
  videoState.copyId = "video-only-fixture";
  videoState.ads[0].gallery = [];
  videoState.ads[0].studio.photos = [];
  const { page: videoOnly } = await open(withData(videoState));
  await click(videoOnly, "Edit this ad");
  await videoOnly.locator('[data-action="step"][data-step="3"]').click();
  await readyStudio(videoOnly);
  await videoOnly.locator("#ad-video-files").setInputFiles(clip);
  await videoOnly.waitForFunction(() =>
    document
      .querySelector(".video-file-row")
      ?.textContent.includes("pattern.mp4"),
  );
  // An invalid replacement must preserve the saved original video.
  await videoOnly.locator("#ad-video-files").setInputFiles({
    name: "bad.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not a video"),
  });
  await videoOnly.waitForFunction(() =>
    document.querySelector("#toast").textContent.includes("cannot play"),
  );
  assert.match(
    await videoOnly.locator(".video-file-row").textContent(),
    /pattern.mp4/,
  );
  await next(videoOnly);
  await click(videoOnly, "Preview ad →");
  await videoOnly.waitForFunction(
    () => document.querySelector("#detail-video-player")?.readyState >= 2,
  );
  assert.equal(
    await videoOnly.locator("#detail-video-player").isVisible(),
    true,
  );
  assert.equal(
    await videoOnly.locator("#detail-video-tab").getAttribute("class"),
    "active",
  );
  assert.equal(await videoOnly.locator(".studio-frame").count(), 0);
  await click(videoOnly, "Save to showroom →");
  await videoOnly.locator(".detail-heading h1").waitFor();
  await videoOnly.locator("#detail-video-player").evaluate(async (video) => {
    await video.play();
  });
  await videoOnly.waitForFunction(
    () => document.querySelector("#detail-video-player").currentTime > 0.05,
  );
  const videoCopy = await exported(
    videoOnly,
    "Download this ad",
    "video-only.html",
  );
  assert.ok(
    payload(videoCopy.text).ads[0].video.poster.startsWith("data:image/jpeg"),
  );
  const { page: videoRestored } = await open(videoCopy.text);
  await videoRestored.waitForFunction(
    () => document.querySelector("#detail-video-player")?.readyState >= 2,
  );
  assert.equal(
    await videoRestored.locator("#detail-video-player").isVisible(),
    true,
  );
  console.log(
    "PASS Original video upload/playback/preservation, video-only publish/export/reopen, legacy ads and actual buyer media on reload",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS Search/budget/city/make filtering, reload persistence, editable drafts, saved 360 import, custom make/model, backup, mobile fit and blocked-storage export fallback",
  );
  console.log(
    "NOTE Native file:// blocked by managed browser policy; unchanged packaged HTML tested through document-only offline fixtures.",
  );
} catch (error) {
  console.error("Marketplace failure:", error.message);
  if (errors.length) console.error("Page errors:", errors);
  throw error;
} finally {
  if (browser) await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
