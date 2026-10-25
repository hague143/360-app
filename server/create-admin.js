import { createRuntime } from "./runtime.js";
import { passwordHash } from "./app.js";
import { randomUUID } from "node:crypto";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email))
  throw new Error(
    "Usage: npm run create-admin -- admin@example.com (set ADMIN_PASSWORD securely in the environment)",
  );
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 14)
  throw new Error(
    "ADMIN_PASSWORD must have at least 14 characters. Never commit it.",
  );
const { db } = await createRuntime();
if (await db.prepare("SELECT id FROM users WHERE email=?").get(email))
  throw new Error("Account already exists; no account was modified.");
await db
  .prepare(
    "INSERT INTO users(id,name,email,password,role) VALUES(?,?,?,?,'admin')",
  )
  .run(randomUUID(), "Administrator", email, passwordHash(password));
await db.close();
console.log("Administrator created. Sign in with your email and password.");
