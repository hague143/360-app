-- Used only with explicit storage-adapter tests locally; cloud setup is in Supabase SQL.
CREATE TABLE IF NOT EXISTS upload_tickets (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
 listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, object_key TEXT NOT NULL, size INTEGER NOT NULL,
 metadata TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', result_id TEXT,
 expires INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version) VALUES(3);
