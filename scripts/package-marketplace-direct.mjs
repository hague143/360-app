// One self-contained HTML, including the local 3D renderer. No companion assets.
// This packages the app; it does not certify any antivirus product's verdict.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const data = await readFile(
  path.join(root, "downloads/CarView-Pakistan-Marketplace.html"),
);
const name = "CarView-Neon-Direct.html";
await writeFile(path.join(root, "downloads", name), data);
const files = [
  {
    name,
    bytes: data.length,
    sha256: createHash("sha256").update(data).digest("hex"),
  },
];
await writeFile(
  path.join(root, "downloads/CarView-Neon-Direct-SHA256.json"),
  JSON.stringify({ files }, null, 2) + "\n",
);
console.log(JSON.stringify(files, null, 2));
