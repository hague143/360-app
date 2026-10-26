// A conventional HTML + PNG distribution. No archive and no embedded hero image.
// This changes packaging only; it does not certify any antivirus product's verdict.
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = await readFile(
  path.join(root, "downloads/CarView-Pakistan-Marketplace.html"),
  "utf8",
);
const heroPattern = /(<script[^>]*id="hero-asset"[^>]*>)[\s\S]*?(<\/script>)/;
if (!heroPattern.test(source))
  throw new Error("Missing decorative hero asset.");
const html = source.replace(
  heroPattern,
  (_, start, end) => start + JSON.stringify("./carview-neon-hero.png") + end,
);
const htmlName = "CarView-Neon-Direct.html",
  imageName = "carview-neon-hero.png";
await writeFile(path.join(root, "downloads", htmlName), html);
await copyFile(
  path.join(root, "browser-marketplace/assets/neon-hero.png"),
  path.join(root, "downloads", imageName),
);
const files = [];
for (const name of [htmlName, imageName]) {
  const data = await readFile(path.join(root, "downloads", name));
  files.push({
    name,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  });
}
await writeFile(
  path.join(root, "downloads/CarView-Neon-Direct-SHA256.json"),
  JSON.stringify({ files }, null, 2) + "\n",
);
console.log(JSON.stringify(files, null, 2));
