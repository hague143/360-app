import path from "node:path";
import { openDb } from "./db.js";
import { LocalStorage } from "./storage.js";
import { createPostgresDb } from "./postgres.js";
import { SupabaseStorage } from "./supabase-storage.js";
export async function createRuntime({
  dataDir = process.env.DATA_DIR || ".data",
  db,
  storage,
  mode = process.env.CARVIEW_MODE ||
    (process.env.VERCEL ? "supabase" : "local"),
} = {}) {
  if (db && storage) return { db, storage };
  if (process.env.VERCEL && mode !== "supabase")
    throw new Error(
      "Vercel requires Supabase mode; local files are not persistent.",
    );
  if (mode === "supabase") {
    if (
      !process.env.DATABASE_URL ||
      !process.env.SUPABASE_URL ||
      !(
        process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    )
      throw Object.assign(
        new Error("Supabase server settings are incomplete."),
        { code: "MISSING_SUPABASE_CONFIG" },
      );
    const cloudStorage = storage || new SupabaseStorage();
    return { db: db || (await createPostgresDb()), storage: cloudStorage };
  }
  if (mode !== "local")
    throw new Error("CARVIEW_MODE must be local or supabase.");
  return {
    db: db || openDb(path.resolve(dataDir)),
    storage:
      storage || new LocalStorage(path.join(path.resolve(dataDir), "private")),
  };
}
