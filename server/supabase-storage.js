import { createClient } from "@supabase/supabase-js";
function safeKey(key) {
  if (!/^[a-z0-9-]+\.(original|webp|glb)$/.test(key))
    throw new Error("Invalid storage key");
  return key;
}
export class SupabaseStorage {
  constructor({
    url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket = process.env.SUPABASE_STORAGE_BUCKET || "carview-private",
    client,
  } = {}) {
    if (!client && (!url || !key))
      throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");
    if (!client) {
      const u = new URL(url);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/" ||
        u.search ||
        u.hash
      )
        throw new Error("SUPABASE_URL must be a project HTTPS origin.");
    }
    this.origin = url ? new URL(url).origin : null;
    this.bucket = bucket;
    this.directUploads = true;
    this.client =
      client ||
      createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
  }
  async init() {
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data)
      throw Object.assign(
        new Error(
          "Private storage bucket is unavailable. Run supabase/setup.sql.",
        ),
        { code: "STORAGE_NOT_READY" },
      );
    if (data.public)
      throw Object.assign(
        new Error("The CarView storage bucket must be private."),
        { code: "STORAGE_NOT_PRIVATE" },
      );
  }
  async put(key, buffer) {
    safeKey(key);
    const type = key.endsWith(".webp")
      ? "image/webp"
      : key.endsWith(".glb")
        ? "model/gltf-binary"
        : "application/octet-stream";
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, buffer, {
        contentType: type,
        upsert: false,
        cacheControl: "0",
      });
    if (error) throw new Error("Private storage write failed.");
  }
  async read(key) {
    safeKey(key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .download(key);
    if (error || !data) throw new Error("Private storage read failed.");
    return Buffer.from(await data.arrayBuffer());
  }
  async remove(key) {
    safeKey(key);
    const { error } = await this.client.storage.from(this.bucket).remove([key]);
    if (error) throw new Error("Private storage delete failed.");
  }
  async signedUrl(key, { download } = {}) {
    safeKey(key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(key, 60, download ? { download } : {});
    if (error || !data?.signedUrl)
      throw new Error("Photo link could not be created.");
    return data.signedUrl;
  }
  async uploadUrl(key) {
    safeKey(key);
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(key, { upsert: false });
    if (error || !data?.signedUrl)
      throw new Error("Upload link could not be created.");
    return data.signedUrl;
  }
}
