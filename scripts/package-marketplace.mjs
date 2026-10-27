import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const original = await readFile(
  path.join(root, "downloads/CarView-Pakistan.html"),
  "utf8",
);
const hash = createHash("sha256").update(original).digest("hex");
const expected =
  "56a9872dfd8072da85009535e585e496684f5bfb39584211cf8e927e198125cf";
if (hash !== expected)
  throw new Error(
    "The protected 360 studio changed. Review the explicit user requirement before updating its preservation hash.",
  );
const dir = path.join(root, "browser-marketplace");
const [template, baseCSS, neonCSS, ...scripts] = await Promise.all(
  [
    "index.html",
    "styles.css",
    "neon.css",
    "model.js",
    "hero-photos.js",
    "effects.js",
    "studio.js",
    "app.js",
  ].map((name) => readFile(path.join(dir, name), "utf8")),
);
const css = baseCSS + "\n" + neonCSS;
const [model, poster, threeLicense] = await Promise.all([
  readFile(path.join(dir, "assets/agera.glb")),
  readFile(path.join(dir, "assets/agera-poster.webp")),
  readFile(path.join(root, "node_modules/three/LICENSE"), "utf8"),
]);
const viewer = await build({
  entryPoints: [path.join(dir, "hero-model.js")],
  bundle: true,
  minify: true,
  format: "iife",
  globalName: "CarViewModel",
  write: false,
  target: "es2020",
  legalComments: "inline",
});
const modelData = JSON.stringify({
  name: "Koenigsegg Agera",
  base64: model.toString("base64"),
  poster: "data:image/webp;base64," + poster.toString("base64"),
});
const code =
  "(() => { 'use strict';\nconst PRISTINE_TEMPLATE = '<!doctype html>\\n' + document.documentElement.outerHTML;\n" +
  scripts.join("\n") +
  "\n})();";
new vm.Script(code, { filename: "marketplace-bundle.js" });
const safeJSON = JSON.stringify(original)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");
const html = template
  .replace("/*__MARKETPLACE_CSS__*/", () => css)
  .replace("/*__STUDIO_JSON__*/", () => safeJSON)
  .replace("/*__MODEL_DATA__*/", () => modelData)
  .replace("/*__MODEL_VIEWER__*/", () =>
    (
      "/* Bundled Three.js licence:\n" +
      threeLicense +
      "\n*/\n" +
      viewer.outputFiles[0].text.replace(/[\t ]+$/gm, "")
    ).replace(/<\/script/gi, "<\\/script"),
  )
  .replace("/*__MARKETPLACE_JS__*/", () => code);
if (/\/\*__\w+__\*\//.test(html))
  throw new Error("Unfilled marketplace template marker.");
await mkdir(path.join(root, "downloads"), { recursive: true });
await writeFile(
  path.join(root, "downloads/CarView-Pakistan-Marketplace.html"),
  html,
);
execFileSync(
  "python",
  [
    "-c",
    `import pathlib,sys,zipfile,json,hashlib
root=pathlib.Path(sys.argv[1])
target=root/'downloads/CarView-Pakistan-Marketplace.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for source,name in [('downloads/CarView-Pakistan-Marketplace.html','CarView-Pakistan-Marketplace.html'),('browser-marketplace/START-HERE.txt','START-HERE.txt')]:
        archive.write(root/source,name)
    archive.writestr('CONTENTS-SHA256.json',json.dumps({'studio_source_sha256':sys.argv[2],'html_sha256':hashlib.sha256((root/'downloads/CarView-Pakistan-Marketplace.html').read_bytes()).hexdigest()},indent=2)+'\\n')
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
print('Marketplace ZIP:',target.stat().st_size,'bytes; original 360 studio SHA256 preserved')`,
    root,
    hash,
  ],
  { stdio: "inherit" },
);
