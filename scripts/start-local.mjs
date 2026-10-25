import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
let activeProcess,
  stopping = false;
function stop() {
  stopping = true;
  activeProcess?.kill("SIGTERM");
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
function runNpm(args) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "cmd.exe" : "npm";
    const arguments_ =
      process.platform === "win32" ? ["/d", "/c", "npm", ...args] : args;
    activeProcess = spawn(command, arguments_, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_cache:
          process.env.npm_config_cache || path.join(root, ".npm-cache"),
      },
    });
    activeProcess.once("error", () =>
      reject(
        new Error(
          "npm could not start. Install Node.js 24 LTS, then reopen this file.",
        ),
      ),
    );
    activeProcess.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              stopping
                ? "Setup stopped."
                : `Setup failed (exit ${code}). Check the message above; internet is required for the first installation.`,
            ),
          ),
    );
  });
}
function portIsFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)));
  });
}
async function choosePort() {
  const specified = process.env.CARVIEW_LOCAL_PORT;
  if (specified) {
    const port = Number(specified);
    if (!Number.isInteger(port) || port < 1024 || port > 65535)
      throw new Error(
        "CARVIEW_LOCAL_PORT must be a number from 1024 to 65535.",
      );
    if (!(await portIsFree(port)))
      throw new Error(
        `Port ${port} is busy. Close the other local app or choose another CARVIEW_LOCAL_PORT.`,
      );
    return port;
  }
  for (let port = 8765; port < 8786; port++)
    if (await portIsFree(port)) return port;
  throw new Error(
    "Local ports 8765–8785 are busy. Close another copy or set CARVIEW_LOCAL_PORT.",
  );
}
function dependenciesWork() {
  try {
    for (const name of ["express", "sharp", "pg", "@supabase/supabase-js"])
      require(name);
    return true;
  } catch {
    return false;
  }
}
function openBrowser(url) {
  if (process.env.CARVIEW_NO_OPEN === "1") return;
  const command =
    process.platform === "win32"
      ? "cmd.exe"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["/d", "/c", "start", "", url] : [url];
  const opener = spawn(command, args, { stdio: "ignore", windowsHide: true });
  opener.on("error", () =>
    console.log(
      "Browser did not open automatically. Open the address printed above.",
    ),
  );
  opener.unref();
}
async function main() {
  console.log("\nCarView Pakistan — local test\n");
  if (Number(process.versions.node.split(".")[0]) !== 24)
    throw new Error(
      `Node.js 24 LTS is required. Your version is ${process.versions.node}. Install 24.x from https://nodejs.org/en/download, then try again.`,
    );
  if (!existsSync(path.join(root, "dist", "index.html")))
    throw new Error(
      "The ready-built interface is missing. Extract the complete local-test ZIP first. Source-code users: npm ci, then npm run build.",
    );
  if (!dependenciesWork()) {
    console.log(
      "First start: installing packages. Internet is needed once. Please wait.\n",
    );
    await runNpm(["ci", "--omit=dev", "--no-audit", "--no-fund"]);
  } else console.log("Installed packages found. No download needed.");
  if (stopping) return;
  const port = await choosePort(),
    origin = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    CARVIEW_MODE: "local",
    CARVIEW_LOCAL_ONLY: "1",
    HOST: "127.0.0.1",
    PORT: String(port),
    APP_ORIGIN: origin,
    DATA_DIR: path.join(root, ".data"),
  };
  // A local test must not inherit a cloud/serverless environment accidentally.
  for (const name of [
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "RENDER_EXTERNAL_URL",
  ])
    delete env[name];
  activeProcess = spawn(
    process.execPath,
    [path.join(root, "server", "index.js")],
    { cwd: root, env, stdio: "inherit" },
  );
  let ended = false;
  const completion = new Promise((resolve, reject) => {
    activeProcess.once("error", reject);
    activeProcess.once("exit", (code, signal) => {
      ended = true;
      if (stopping || code === 0) resolve();
      else
        reject(
          new Error(
            `The local server stopped (${signal || code}). Check the message above.`,
          ),
        );
    });
  });
  // Attach rejection handling while waiting for readiness, avoiding an unhandled
  // rejection if a server prerequisite fails immediately.
  completion.catch(() => {});
  let ready = false;
  for (let i = 0; i < 100 && !ended && !stopping; i++) {
    try {
      const response = await fetch(origin + "/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      const health = await response.json();
      if (response.ok && health.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) {
    activeProcess.kill("SIGTERM");
    await completion.catch(() => {});
    if (!stopping)
      throw new Error("The app could not start. Check the messages above.");
    return;
  }
  console.log(
    `\nREADY: ${origin}\n\nYour photos and database stay in: ${path.join(root, ".data")}\nKeep this window open while testing. Press Ctrl+C to stop.\n`,
  );
  openBrowser(origin);
  await completion;
}
main().catch((error) => {
  if (!stopping) {
    console.error("\n" + error.message + "\n");
    process.exitCode = 1;
  }
});
