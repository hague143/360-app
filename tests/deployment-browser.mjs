import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
process.env.NODE_ENV = "production";
const dir = await mkdtemp(path.join(tmpdir(), "carview-hosting-browser-"));
const { app, db } = await createApp({ dataDir: dir });
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", (r) =>
    r.fulfill({
      status: 404,
      contentType: "text/plain",
      body: "The page could not be found",
    }),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const alert = page.getByRole("alert");
  await alert.waitFor();
  assert.equal(
    await alert.innerText(),
    "The service is temporarily unavailable. Please try again shortly.",
  );
  assert.equal(
    (await page.locator("body").innerText()).includes("Unexpected token"),
    false,
  );
  await page.unroute("**/api/**");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await page
    .getByRole("heading", { name: "Get to know every angle." })
    .waitFor();
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS Hosting text/HTML errors render a clear unavailable state; retry recovers the actual app after the API is restored",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  db.close();
  await rm(dir, { recursive: true, force: true });
}
