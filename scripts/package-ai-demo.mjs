// Exercise the normal app upload/export workflow to package a portable AI demo.
// Original generated PNGs are preserved unchanged in the separate photo ZIP.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  writeFile,
  rm,
  mkdir,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const temporary = await mkdtemp(path.join(os.tmpdir(), "carview-ai-demo-"));
const photoZip = path.resolve("downloads/CarView-AI-Test-Photos.zip");
const demoZip = path.resolve("downloads/CarView-AI-Demo.zip");
const source = await readFile("downloads/CarView-Pakistan.html", "utf8");
const origin = "http://carview-demo-fixture.test";
const errors = [],
  external = [];
let browser;
async function configure(context, html) {
  // Managed Chromium disallows file:// here. Honor that policy and test the
  // same HTML via a document-only fixture; no real networking or API exists.
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
  await page.goto(origin + "/CarView.html");
  await page.waitForFunction(
    () => document.documentElement.dataset.ready === "true",
  );
  return page;
}
try {
  execFileSync("python", [
    "-c",
    `import zipfile,sys,json,hashlib,pathlib
with zipfile.ZipFile(sys.argv[1]) as z:
    root=pathlib.Path(sys.argv[2]).resolve()
    for name in z.namelist():
        assert (root/name).resolve().is_relative_to(root)
    manifest=json.loads(z.read('AI-DEMO-MANIFEST.json'))
    assert len(manifest['images'])==12
    for image in manifest['images']:
        assert hashlib.sha256(z.read(image['file'])).hexdigest()==image['sha256']
    z.extractall(root)`,
    photoZip,
    temporary,
  ]);
  const photoFolder = path.join(temporary, "Photos");
  const photos = (await readdir(photoFolder))
    .filter((name) => name.endsWith(".png"))
    .sort();
  assert.equal(photos.length, 12);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    offline: true,
    acceptDownloads: true,
    viewport: { width: 1365, height: 1000 },
  });
  const page = await configure(context, source);
  await page
    .locator("#files")
    .setInputFiles(photos.map((name) => path.join(photoFolder, name)));
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".thumb").length === 12 &&
      document.getElementById("busy").hidden,
    null,
    { timeout: 60000 },
  );
  assert.deepEqual(await page.locator(".thumb span").allTextContents(), photos);
  assert.match(
    await page.locator("#notice-text").textContent(),
    /12 photos ready/,
  );
  await page.locator("#car-title").fill("AI DEMO · White Sedan");
  await page
    .locator("#car-notes")
    .fill(
      "AI-GENERATED TEST IMAGES — fictional car, software demonstration only. These 12 images cover front, both sides and rear. Intended angles are approximate; shape, details, scale and spacing can vary between AI frames. Yeh real sale wali car ki photos nahi hain.",
    );
  await page.locator("#loop").check();
  const uniqueImages = new Set();
  for (let n = 1; n <= 12; n++) {
    await page.waitForFunction(
      () =>
        document.getElementById("photo").complete &&
        document.getElementById("photo").naturalWidth > 0,
    );
    uniqueImages.add(await page.locator("#photo").getAttribute("src"));
    assert.equal(
      await page.locator("#frame-number").textContent(),
      String(n).padStart(2, "0"),
    );
    await page.locator("#next").click();
  }
  assert.equal(uniqueImages.size, 12);
  assert.equal(await page.locator("#frame-number").textContent(), "01");
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadEvent;
  const htmlPath = path.join(temporary, "CarView-AI-Demo.html");
  await download.saveAs(htmlPath);
  let demo = await readFile(htmlPath, "utf8");
  // Label the exported sample prominently; the empty browser edition is unchanged.
  demo = demo
    .replace(" Browser edition</span>", " AI demo · 12 angles</span>")
    .replaceAll("actual photos", "AI demo frames")
    .replace(
      "Photos select karein. Drag karein. Har angle dekhein.",
      "AI-generated test car · 12 views · Drag or press Play",
    )
    .replace(
      "This view plays your real photos in order; unseen angles are not generated.",
      "These AI-generated demo frames test playback. Car details, scale and angular spacing can vary between frames.",
    );
  await writeFile(htmlPath, demo);
  const fresh = await browser.newContext({
    offline: true,
    acceptDownloads: true,
    viewport: { width: 1365, height: 1000 },
  });
  const restored = await configure(fresh, demo);
  assert.equal(await restored.locator(".thumb").count(), 12);
  assert.equal(await restored.locator("#loop").isChecked(), true);
  assert.match(await restored.locator("#heading").textContent(), /AI DEMO/);
  assert.match(
    await restored.locator(".header-actions .pill").textContent(),
    /AI demo/,
  );
  assert.equal(
    await restored.locator("#angle-total").textContent(),
    "12 AI demo frames",
  );
  await restored.getByRole("button", { name: "Play photo sequence" }).click();
  await restored.waitForFunction(
    () => document.getElementById("frame-number").textContent !== "01",
  );
  await restored.getByRole("button", { name: "Pause photo sequence" }).click();
  await mkdir("test-results", { recursive: true });
  await restored.screenshot({
    path: "test-results/ai-demo-desktop.png",
    fullPage: true,
  });
  await restored.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await restored.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await restored.screenshot({
    path: "test-results/ai-demo-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  await writeFile(
    path.join(temporary, "START-HERE.txt"),
    `CARVIEW PAKISTAN - READY AI DEMO
================================
1. ZIP ko Extract All karein.
2. CarView-AI-Demo.html ko Chrome ya Edge mein double-click se kholein.
3. 12 photos pehle se lagi hain. Drag/swipe karein ya Play dabayein.

Node.js, account, installation ya internet nahi chahiye.

Yeh car aur iski sari 12 images AI-generated hain, sirf software test ke
liye. Real sale wali car ya condition ka proof nahi. Angles takreeban
30-degree steps ke liye banaye gaye hain; car ki shape, size, details aur
angle-spacing mein halka farq ho sakta hai. Yeh measured 3D scan nahi.

Photos is HTML file ke andar hain. Browser data clear hone ke baad bhi
original downloaded file mein photos rehti hain. Edit karne ke baad
Save HTML copy se nayi copy save kar sakte hain.

Khud upload test karne ke liye separate CarView-AI-Test-Photos.zip mein
12 original PNG images hain. Apni empty CarView-Pakistan.html mein upload
karein, phir Enable 360 looping tick karke drag/play karein.

This small demo uses display copies produced by the app's normal browser
upload/export workflow. Original AI PNGs are unchanged in the photo ZIP.
`,
  );
  execFileSync("python", [
    "-c",
    `import pathlib,sys,zipfile,hashlib,json
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    manifest={}
    for name in ['CarView-AI-Demo.html','START-HERE.txt']:
        data=(root/name).read_bytes()
        z.writestr(name,data)
        manifest[name]=hashlib.sha256(data).hexdigest()
    z.writestr('SHA256.json',json.dumps(manifest,indent=2)+'\\n')
with zipfile.ZipFile(sys.argv[2]) as z:
    assert z.testzip() is None
print('Ready AI demo ZIP:',pathlib.Path(sys.argv[2]).stat().st_size,'bytes')`,
    temporary,
    demoZip,
  ]);
  console.log(
    "PASS All 12 original AI PNGs decode and upload, preserve filename order, display distinct angles and loop back to the first frame",
  );
  console.log(
    "PASS Photo-filled HTML restores 12 frames in a clean offline browser, labels AI content, plays and fits mobile without external requests/errors",
  );
  console.log(
    "NOTE Native file:// is blocked by test browser policy; checks use identical HTML in a document-only HTTP fixture with external networking offline.",
  );
} finally {
  if (browser) await browser.close();
  await rm(temporary, { recursive: true, force: true });
}
