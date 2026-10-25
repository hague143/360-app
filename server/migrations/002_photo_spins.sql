-- Photo-based navigation: uses existing originals/derivatives, never synthesizes frames.
CREATE TABLE IF NOT EXISTS photo_spins (
 listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
 confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN(0,1)),
 loop INTEGER NOT NULL DEFAULT 0 CHECK(loop IN(0,1))
);
CREATE TABLE IF NOT EXISTS spin_frames (
 listing_id TEXT NOT NULL REFERENCES photo_spins(listing_id) ON DELETE CASCADE,
 photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
 frame_order INTEGER NOT NULL,
 PRIMARY KEY(listing_id,frame_order),
 UNIQUE(listing_id,photo_id)
);
INSERT OR IGNORE INTO schema_migrations(version) VALUES(2);
