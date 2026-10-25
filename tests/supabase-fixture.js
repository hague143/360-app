// HTTP contract fixture for Supabase Storage. This is not a Supabase service;
// tests use the actual SDK against these private object/signing endpoints.
import express from "express";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SupabaseStorage } from "../server/supabase-storage.js";
export async function storageFixture() {
  const app = express(),
    objects = new Map(),
    tokens = new Map(),
    key = "test-only-server-secret";
  let isPublic = false;
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type,authorization,apikey,x-upsert,x-client-info,cache-control",
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.raw({ type: () => true, limit: "27mb" }));
  const parse = (req) =>
    req.body?.length ? JSON.parse(req.body.toString()) : {};
  app.use((req, res, next) => {
    const url = new URL(req.url, "http://fixture");
    const signed =
      (req.path.startsWith("/storage/v1/object/sign/") &&
        req.method === "GET") ||
      (req.path.startsWith("/storage/v1/object/upload/sign/") &&
        req.method === "PUT");
    if (signed) {
      const t = tokens.get(url.searchParams.get("token"));
      if (
        !t ||
        t.path !== req.path ||
        t.method !== req.method ||
        t.until < Date.now()
      )
        return res.status(403).json({ error: "Bad signed token" });
      req.signed = t;
      return next();
    }
    if (
      req.get("apikey") !== key ||
      req.get("authorization") !== `Bearer ${key}`
    )
      return res.status(403).json({ error: "No server authorization" });
    next();
  });
  app.get("/storage/v1/bucket/carview-private", (_req, res) =>
    res.json({
      id: "carview-private",
      name: "carview-private",
      public: isPublic,
    }),
  );
  function objectKey(req, prefix) {
    return req.path.slice(prefix.length);
  }
  app.post(
    "/storage/v1/object/upload/sign/carview-private/:key",
    (req, res) => {
      const key = req.params.key,
        token = randomUUID(),
        p = "/storage/v1/object/upload/sign/carview-private/" + key;
      tokens.set(token, {
        method: "PUT",
        path: p,
        until: Date.now() + 7200000,
        key,
      });
      res.json({ url: p.slice("/storage/v1".length) + "?token=" + token });
    },
  );
  app.put("/storage/v1/object/upload/sign/carview-private/:key", (req, res) => {
    if (objects.has(req.params.key))
      return res.status(409).json({ error: "Already exists" });
    objects.set(req.params.key, {
      buffer: Buffer.from(req.body),
      type: req.get("content-type") || "application/octet-stream",
    });
    res.json({ Key: "carview-private/" + req.params.key });
  });
  app.post("/storage/v1/object/sign/carview-private/:key", (req, res) => {
    const b = parse(req),
      token = randomUUID(),
      p = "/storage/v1/object/sign/carview-private/" + req.params.key;
    tokens.set(token, {
      method: "GET",
      path: p,
      until: Date.now() + b.expiresIn * 1000,
      key: req.params.key,
    });
    res.json({ signedURL: p.slice("/storage/v1".length) + "?token=" + token });
  });
  app.get("/storage/v1/object/sign/carview-private/:key", (req, res) => {
    const o = objects.get(req.params.key);
    if (!o) return res.status(404).end();
    res.type(o.type).send(o.buffer);
  });
  app.post("/storage/v1/object/carview-private/:key", (req, res) => {
    if (objects.has(req.params.key))
      return res.status(409).json({ error: "Already exists" });
    objects.set(req.params.key, {
      buffer: Buffer.from(req.body),
      type: req.get("content-type") || "application/octet-stream",
    });
    res.json({ Key: "carview-private/" + req.params.key, Id: randomUUID() });
  });
  app.get(
    [
      "/storage/v1/object/carview-private/:key",
      "/storage/v1/object/authenticated/carview-private/:key",
    ],
    (req, res) => {
      const o = objects.get(req.params.key);
      if (!o) return res.status(404).json({ error: "Object not found" });
      res.type(o.type).send(o.buffer);
    },
  );
  app.delete("/storage/v1/object/carview-private", (req, res) => {
    for (const k of parse(req).prefixes || []) objects.delete(k);
    res.json([]);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    url,
    objects,
    client,
    storage: () => new SupabaseStorage({ url, client }),
    setPublic: (value) => {
      isPublic = value;
    },
    close: () => new Promise((r) => server.close(r)),
  };
}
