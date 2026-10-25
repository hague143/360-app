import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function backendOrigin(value, frontendHostname = "") {
  if (!value)
    throw new Error("CARVIEW_BACKEND_URL is required for a working backend.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CARVIEW_BACKEND_URL must be a valid HTTPS origin.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.startsWith("127.") ||
    url.hostname === "[::1]"
  ) {
    throw new Error(
      "CARVIEW_BACKEND_URL must be the public HTTPS backend origin without credentials, path, query or fragment.",
    );
  }
  if (frontendHostname && url.hostname === frontendHostname)
    throw new Error(
      "CARVIEW_BACKEND_URL must point to the persistent backend, not this Vercel frontend; otherwise requests loop.",
    );
  return url.origin;
}

export async function prepareVercelOutput({
  backendUrl,
  frontendHostname = "",
  distDir = "dist",
  outputDir = ".vercel/output",
}) {
  const origin = backendUrl
    ? backendOrigin(backendUrl, frontendHostname)
    : null;
  const unavailable = "/_carview/service-unavailable.json";
  const upstream = (source) =>
    origin
      ? {
          src: `${source}/(.*)`,
          dest: `${origin}${source}/$1`,
          headers: { "Cache-Control": "private, no-store" },
        }
      : {
          src: `${source}/(.*)`,
          dest: unavailable,
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
          },
        };
  const root = (source) =>
    origin
      ? {
          src: source,
          dest: origin + source,
          headers: { "Cache-Control": "private, no-store" },
        }
      : {
          src: source,
          dest: unavailable,
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
          },
        };
  // Build Output API v3: external routes keep authentication/media same-origin
  // without buffering image batches in a JavaScript Vercel Function.
  const config = {
    version: 3,
    routes: [
      upstream("/api"),
      upstream("/media"),
      root("/api"),
      root("/media"),
      { handle: "filesystem" },
      { src: "/assets/(.*)", status: 404 },
      { src: "/(.*)", dest: "/index.html" },
    ],
  };
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(distDir, path.join(outputDir, "static"), { recursive: true });
  if (!origin) {
    await mkdir(path.join(outputDir, "static", "_carview"), {
      recursive: true,
    });
    await writeFile(
      path.join(outputDir, "static", unavailable),
      JSON.stringify({
        error:
          "The service is temporarily unavailable. Please try again shortly.",
      }) + "\n",
    );
  }
  await writeFile(
    path.join(outputDir, "config.json"),
    JSON.stringify(config, null, 2) + "\n",
  );
  return config;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    await prepareVercelOutput({
      backendUrl: process.env.CARVIEW_BACKEND_URL,
      frontendHostname: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    });
    if (!process.env.CARVIEW_BACKEND_URL)
      console.warn(
        "BACKEND NOT CONFIGURED: set CARVIEW_BACKEND_URL in Vercel after deploying a persistent Node backend, then redeploy. API/media return JSON 503 until then. See docs/DEPLOYMENT.md.",
      );
    else
      console.log(
        "Vercel frontend, SPA fallback and persistent API/media proxy routes prepared.",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
