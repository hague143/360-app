import { mkdir, writeFile, unlink, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
export class LocalStorage {
  constructor(root) {
    this.root = root;
  }
  async init() {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
  }
  resolve(key) {
    if (!/^[a-z0-9-]+\.(original|webp|glb)$/.test(key))
      throw new Error("Invalid storage key");
    return path.join(this.root, key);
  }
  async put(key, buffer) {
    await writeFile(this.resolve(key), buffer, { mode: 0o600, flag: "wx" });
  }
  async remove(key) {
    await unlink(this.resolve(key)).catch(() => {});
  }
  async read(key) {
    return readFile(this.resolve(key));
  }
}
export async function processPhoto(storage, buffer) {
  const image = sharp(buffer, {
    limitInputPixels: 40_000_000,
    failOn: "warning",
  });
  const meta = await image.metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format) ||
    meta.pages > 1 ||
    !meta.width ||
    !meta.height
  )
    throw new Error("Use a single JPEG, PNG or WebP image.");
  const id = randomUUID(),
    keys = [`${id}.original`, `${id}-display.webp`, `${id}-thumb.webp`];
  // rotate() honors EXIF orientation; sharp strips metadata by default. No retouching.
  const display = await image
    .clone()
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
  const thumb = await image
    .clone()
    .rotate()
    .resize({
      width: 480,
      height: 360,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
  try {
    await storage.put(keys[0], buffer);
    await storage.put(keys[1], display);
    await storage.put(keys[2], thumb);
  } catch (e) {
    await Promise.all(keys.map((k) => storage.remove(k)));
    throw e;
  }
  return {
    id,
    original: keys[0],
    display: keys[1],
    thumbnail: keys[2],
    mime: `image/${meta.format === "jpg" ? "jpeg" : meta.format}`,
    size: buffer.length,
  };
}
export function validateGlb(buffer) {
  if (
    buffer.length < 20 ||
    buffer.readUInt32LE(0) !== 0x46546c67 ||
    buffer.readUInt32LE(4) !== 2 ||
    buffer.readUInt32LE(8) !== buffer.length
  )
    throw new Error("A valid GLB 2.0 file is required.");
  const size = buffer.readUInt32LE(12);
  if (
    size > 4_000_000 ||
    buffer.readUInt32LE(16) !== 0x4e4f534a ||
    20 + size > buffer.length
  )
    throw new Error("Invalid GLB JSON chunk.");
  const json = JSON.parse(buffer.toString("utf8", 20, 20 + size));
  function walk(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      if (key === "uri")
        throw new Error(
          "Only self-contained GLB assets without resource URIs are accepted.",
        );
      walk(v);
    }
  }
  walk(json);
  if ((json.extensionsRequired || []).length)
    throw new Error(
      "Required glTF extensions are not supported. Export an uncompressed core GLB.",
    );
  if (!json.meshes?.length) throw new Error("Asset must contain meshes.");
  if ((json.accessors || []).some((a) => a.count > 1_000_000))
    throw new Error(
      "Optimize the model: an accessor exceeds one million entries.",
    );
  return json;
}
