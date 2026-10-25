import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createPostgresDb } from "../server/postgres.js";
export async function postgresFixture() {
  const name = "carview-pg-" + randomUUID().slice(0, 8),
    password = randomBytes(24).toString("hex"),
    docker = ["--config", "/tmp/carview-docker-config"];
  const run = (...args) =>
    execFileSync("docker", [...docker, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  let created = false;
  try {
    run(
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      "-e",
      "POSTGRES_PASSWORD=" + password,
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    );
    created = true;
    const port = run("port", name, "5432/tcp").split(":").at(-1),
      url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const client = new pg.Client({
        connectionString: url,
        connectionTimeoutMillis: 1000,
      });
      try {
        await client.connect();
        await client.query("SELECT 1");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      } finally {
        await client.end().catch(() => {});
      }
    }
    if (!ready) throw new Error("Disposable PostgreSQL was not reachable.");
    const sql = await readFile(
      new URL("../supabase/setup.sql", import.meta.url),
      "utf8",
    );
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      // Minimal Supabase-owned relations/roles to exercise bucket RLS guards
      // with a deliberately broad existing policy, on real PostgreSQL.
      await client.query(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
        CREATE SCHEMA storage;
        CREATE TABLE storage.buckets(id TEXT PRIMARY KEY,name TEXT,public BOOLEAN,file_size_limit INTEGER);
        CREATE TABLE storage.objects(id TEXT PRIMARY KEY,bucket_id TEXT);
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        GRANT USAGE ON SCHEMA storage TO anon,authenticated;
        GRANT SELECT ON storage.objects TO anon,authenticated;
        CREATE POLICY fixture_public_read ON storage.objects FOR SELECT TO anon,authenticated USING(true);
        INSERT INTO storage.objects VALUES('private','carview-private'),('other','unrelated-bucket');`);
      await client.query(sql);
      await client.query(sql);
    } finally {
      await client.end();
    }
    return {
      connect: () => createPostgresDb({ connectionString: url, ssl: false }),
      close: () => {
        if (created) run("rm", "-f", name);
      },
    };
  } catch (error) {
    if (created) run("rm", "-f", name);
    throw error;
  }
}
