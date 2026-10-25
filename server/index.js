import { createApp } from "./app.js";
const { app, db } = await createApp();
const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "0.0.0.0",
  () =>
    console.log(`CarView API listening on port ${process.env.PORT || 3001}`),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await db.close();
      process.exit(0);
    }),
  );
