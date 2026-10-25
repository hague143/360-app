import pg from "pg";
import { AsyncLocalStorage } from "node:async_hooks";
// All application integer values (prices, sizes, counts, timestamps) are bounded
// below Number.MAX_SAFE_INTEGER. Preserve SQLite's existing JSON number contract.
pg.types.setTypeParser(20, (value) => Number(value));
const tables =
  "users|sessions|catalog|assets|listings|photos|photo_areas|markers|photo_spins|spin_frames|upload_tickets|schema_migrations";
export function postgresSql(sql) {
  let index = 0;
  // Split quoted SQL literals so placeholders and table names inside text are
  // never rewritten. Values are always sent separately as PostgreSQL parameters.
  return sql
    .split(/('(?:''|[^'])*')/g)
    .map((part, i) =>
      i % 2
        ? part
        : part
            .replace(
              new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\s+(${tables})\\b`, "gi"),
              "$1 carview.$2",
            )
            .replace(/\?/g, () => "$" + ++index),
    )
    .join("");
}
export async function createPostgresDb({
  connectionString = process.env.DATABASE_URL,
  ca = process.env.SUPABASE_DB_CA_CERT,
  ssl = true,
  checkSchema = true,
} = {}) {
  if (!connectionString)
    throw new Error("DATABASE_URL is required for Supabase mode.");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
  // pg must not replace strict certificate verification with URL sslmode flags.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    query_timeout: 20000,
    ssl: ssl
      ? {
          rejectUnauthorized: true,
          ...(ca ? { ca: ca.replaceAll("\\n", "\n") } : {}),
        }
      : false,
    application_name: "carview",
  });
  // Handle idle connection failures without logging URLs, credentials or values.
  pool.on("error", () =>
    console.error("CarView database idle connection closed."),
  );
  const context = new AsyncLocalStorage();
  function current() {
    return context.getStore()?.client || pool;
  }
  const db = {
    isPostgres: true,
    withContext(fn) {
      return context.run({}, fn);
    },
    prepare(sql) {
      const text = postgresSql(sql);
      return {
        async get(...values) {
          return (await current().query(text, values)).rows[0];
        },
        async all(...values) {
          return (await current().query(text, values)).rows;
        },
        async run(...values) {
          const result = await current().query(text, values);
          return { changes: result.rowCount };
        },
      };
    },
    async exec(sql) {
      const command = sql.trim().toUpperCase();
      if (command === "BEGIN") {
        const state = context.getStore();
        if (!state) throw new Error("Transactions require a request context.");
        if (state.client)
          throw new Error("Nested transactions are not supported.");
        state.client = await pool.connect();
        try {
          await state.client.query("BEGIN");
        } catch (e) {
          state.client.release();
          delete state.client;
          throw e;
        }
        return;
      }
      if (command === "COMMIT" || command === "ROLLBACK") {
        const state = context.getStore();
        if (!state?.client) {
          if (command === "ROLLBACK") return;
          throw new Error("No active transaction.");
        }
        try {
          await state.client.query(command);
        } finally {
          state.client.release();
          delete state.client;
        }
        return;
      }
      return current().query(sql);
    },
    async close() {
      await pool.end();
    },
  };
  if (checkSchema) {
    try {
      const row = await db
        .prepare("SELECT version FROM schema_migrations WHERE version=3")
        .get();
      if (!row) throw new Error("Missing schema");
    } catch (e) {
      await pool.end();
      throw Object.assign(
        new Error(
          "Supabase database is unavailable or not initialized. Run supabase/setup.sql and check database/TLS settings.",
        ),
        {
          code: "DATABASE_UNAVAILABLE",
          detail: /^[A-Z0-9_]+$/.test(e.code || "")
            ? e.code
            : "SCHEMA_NOT_READY",
        },
      );
    }
  }
  return db;
}
