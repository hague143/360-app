import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chromium } from "playwright-core";
const temp = await mkdtemp(path.join(tmpdir(), "carview-local-package-"));
const zip = path.resolve("downloads/CarView-Pakistan-Local.zip");
const folder = path.join(temp, "CarView-Pakistan");
let process_,
  browser,
  output = "";
async function availablePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
}
const port = await availablePort(),
  base = `http://127.0.0.1:${port}`;
async function launch(offline = false) {
  output = "";
  process_ = spawn(process.execPath, ["scripts/start-local.mjs"], {
    cwd: folder,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      CARVIEW_NO_OPEN: "1",
      CARVIEW_LOCAL_PORT: String(port),
      CARVIEW_MODE: "supabase",
      VERCEL: "1",
      APP_ORIGIN: "https://not-used.example",
      npm_config_cache: "/tmp/carview-npm-cache",
      ...(offline ? { npm_config_offline: "true" } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  process_.stdout.on("data", (data) => (output += data.toString()));
  process_.stderr.on("data", (data) => (output += data.toString()));
  for (let i = 0; i < 240; i++) {
    if (process_.exitCode !== null)
      throw new Error("Local launcher stopped:\n" + output);
    if (output.includes("READY: ")) {
      const r = await fetch(base + "/api/health");
      if (r.ok && (await r.json()).ok) return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Local launcher readiness timed out:\n" + output);
}
async function stop() {
  if (!process_ || process_.exitCode !== null) return;
  const child = process_;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Launcher failed to stop its server.")),
      10000,
    );
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
try {
  execFileSync("python", [
    "-c",
    `import sys,zipfile,hashlib
with zipfile.ZipFile(sys.argv[1]) as z:
 names=z.namelist()
 assert not any('/node_modules/' in n or '/.data/' in n or '/.git/' in n or '/.npm-cache/' in n for n in names)
 for line in z.read('CarView-Pakistan/CONTENTS-SHA256.txt').decode().splitlines():
  checksum,name=line.split('  ',1)
  assert hashlib.sha256(z.read('CarView-Pakistan/'+name)).hexdigest()==checksum,name
 z.extractall(sys.argv[2])`,
    zip,
    temp,
  ]);
  await launch();
  assert.match(output, /First start: installing packages/);
  assert.equal((await fetch(base + "/api/runtime")).status, 200);
  assert.equal(
    (await (await fetch(base + "/api/runtime")).json()).directUploads,
    false,
  );
  console.log(
    "PASS Fresh extracted ZIP installs OS-specific production dependencies and starts in local mode despite inherited cloud settings",
  );
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    }),
    page = await context.newPage(),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().startsWith("http") && !r.url().startsWith(base))
      external.push(r.url());
  });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Get to know every angle." })
    .waitFor();
  const headers = { "X-CarView-Request": "1", Origin: base };
  let response = await context.request.post(base + "/api/auth/register", {
    headers,
    data: {
      name: "Local Package Test",
      email: "local-package@example.com",
      password: "local-package-test-password",
    },
  });
  assert.equal(response.status(), 201);
  assert.equal(/;\s*Secure/i.test(response.headers()["set-cookie"]), false);
  assert.match(response.headers()["set-cookie"], /HttpOnly/);
  response = await context.request.post(base + "/api/listings", {
    headers,
    data: {
      catalog_id: "toyota-corolla-e170-pk",
      title: "TEST extracted local app",
      year: 2020,
      price: 1,
      mileage: 0,
      city: "Test",
      description: "Disposable package test; no actual car is advertised.",
    },
  });
  assert.equal(response.status(), 201);
  let listing = await response.json();
  const image = await sharp({
    create: { width: 640, height: 400, channels: 3, background: "#7d9b80" },
  })
    .png()
    .toBuffer();
  for (let i = 0; i < 2; i++) {
    response = await context.request.post(
      base + "/api/listings/" + listing.id + "/photos",
      {
        headers,
        multipart: {
          photos: {
            name: `TEST-fixture-${i}.png`,
            mimeType: "image/png",
            buffer: image,
          },
        },
      },
    );
    assert.equal(response.status(), 201);
    listing = await response.json();
  }
  response = await context.request.put(
    base + "/api/listings/" + listing.id + "/spin",
    {
      headers,
      data: {
        ids: listing.photos.map((p) => p.id),
        confirmed: true,
        loop: false,
      },
    },
  );
  assert.equal(response.status(), 200);
  assert.equal(
    (
      await context.request.post(
        base + "/api/listings/" + listing.id + "/publish",
        { headers, data: {} },
      )
    ).status(),
    200,
  );
  const displayCheck = await context.request.get(
    base + "/media/photos/" + listing.photos[0].id + "/display",
  );
  assert.equal(displayCheck.status(), 200);
  assert.equal((await sharp(await displayCheck.body()).metadata()).width, 640);
  await page.goto(base + "/listing/" + listing.id);
  await page.waitForFunction(
    () => document.querySelector(".spin-stage>img")?.naturalWidth === 640,
  );
  await page.getByRole("button", { name: "Next photo angle" }).click();
  assert.equal(
    await page.getByRole("button", { name: "Next photo angle" }).isDisabled(),
    true,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS Packaged prebuilt UI, local HTTP login, photo upload and published photo walk-around work without cloud requests",
  );
  await page.goto("about:blank");
  await stop();
  await launch(true);
  assert.match(output, /Installed packages found. No download needed/);
  assert.equal(
    (await (await context.request.get(base + "/api/me")).json()).email,
    "local-package@example.com",
  );
  const restored = await (
    await context.request.get(base + "/api/listings/" + listing.id)
  ).json();
  assert.equal(restored.photos.length, 2);
  assert.equal(restored.status, "published");
  assert.deepEqual(
    await (
      await context.request.get(
        base + "/api/photos/" + restored.photos[0].id + "/original",
      )
    ).body(),
    image,
  );
  assert.ok(
    (await stat(path.join(folder, ".data", "carview.sqlite"))).size > 0,
  );
  console.log(
    "PASS Restart reuses installed packages in offline mode and retains account, listing, photos and byte-identical original",
  );
  await stop();
} catch (error) {
  console.error("Packaged app log:", output);
  if (browser) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const page of pages) {
      console.error(
        "Page:",
        page.url(),
        (
          await page
            .locator("main")
            .innerText()
            .catch(() => "")
        ).slice(0, 3500),
      );
      await page
        .screenshot({
          path: "/tmp/carview-local-package-failure.png",
          fullPage: true,
        })
        .catch(() => {});
    }
  }
  throw error;
} finally {
  await browser?.close();
  if (process_ && process_.exitCode === null) {
    try {
      process_.kill("SIGTERM");
      if (process.platform !== "win32") process.kill(-process_.pid, "SIGTERM");
    } catch {}
  }
  await rm(temp, { recursive: true, force: true });
}
