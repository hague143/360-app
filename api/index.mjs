import { createApp } from "../server/app.js";
export function createHandler(factory = () => createApp({ mode: "supabase" })) {
  let application;
  return async function handler(req, res) {
    try {
      // Cached only for warm-instance efficiency; all durable state lives in
      // PostgreSQL and private Storage, never in this Function's /tmp filesystem.
      application ||= factory();
      const { app } = await application;
      await new Promise((resolve, reject) => {
        res.once("finish", resolve);
        res.once("close", resolve);
        try {
          app(req, res);
        } catch (e) {
          reject(e);
        }
      });
    } catch (error) {
      application = undefined;
      console.error("CarView server initialization failed", {
        name: error.name,
        code: error.code,
        detail: error.detail,
      });
      if (!res.headersSent) {
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(
          JSON.stringify({
            error:
              "The service is temporarily unavailable. Please try again shortly.",
          }),
        );
      }
    }
  };
}
export default createHandler();
