-- Run once in the Supabase SQL Editor. Idempotent: existing rows are preserved.
-- App tables are in a private, non-exposed schema. The server uses its database
-- credentials; browser publishable/anon keys never receive access to these rows.
CREATE SCHEMA IF NOT EXISTS carview;
REVOKE ALL ON SCHEMA carview FROM PUBLIC;

 CREATE TABLE IF NOT EXISTS carview.schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT (CURRENT_TIMESTAMP::text));
 CREATE TABLE IF NOT EXISTS carview.users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'seller', created_at TEXT DEFAULT (CURRENT_TIMESTAMP::text));
 CREATE TABLE IF NOT EXISTS carview.sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES carview.users(id), expires BIGINT NOT NULL);
 CREATE TABLE IF NOT EXISTS carview.catalog(id TEXT PRIMARY KEY, make TEXT NOT NULL, model TEXT NOT NULL, generation TEXT NOT NULL, year_from INTEGER NOT NULL, year_to INTEGER NOT NULL, facelift TEXT NOT NULL, variant TEXT NOT NULL, market TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS carview.assets(id TEXT PRIMARY KEY, catalog_id TEXT NOT NULL REFERENCES carview.catalog(id), version INTEGER NOT NULL, filename TEXT NOT NULL, size INTEGER NOT NULL, source_url TEXT NOT NULL, creator TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT NOT NULL, limitations TEXT NOT NULL, config TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (CURRENT_TIMESTAMP::text), UNIQUE(catalog_id,version));
 CREATE TABLE IF NOT EXISTS carview.listings(id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES carview.users(id), catalog_id TEXT NOT NULL REFERENCES carview.catalog(id), asset_id TEXT REFERENCES carview.assets(id), title TEXT NOT NULL, year INTEGER NOT NULL, price INTEGER NOT NULL, mileage INTEGER NOT NULL, city TEXT NOT NULL, description TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', demo INTEGER NOT NULL DEFAULT 0, unavailable TEXT NOT NULL DEFAULT '[]', created_at TEXT DEFAULT (CURRENT_TIMESTAMP::text));
 CREATE TABLE IF NOT EXISTS carview.photos(id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES carview.listings(id) ON DELETE CASCADE, original TEXT NOT NULL, display TEXT NOT NULL, thumbnail TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS carview.photo_areas(photo_id TEXT NOT NULL REFERENCES carview.photos(id) ON DELETE CASCADE, area_id TEXT NOT NULL, PRIMARY KEY(photo_id,area_id));
 CREATE TABLE IF NOT EXISTS carview.markers(id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES carview.listings(id) ON DELETE CASCADE, asset_id TEXT NOT NULL REFERENCES carview.assets(id), label TEXT NOT NULL, damage INTEGER NOT NULL DEFAULT 0, position TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS listing_status ON carview.listings(status,created_at);
 CREATE INDEX IF NOT EXISTS photo_listing ON carview.photos(listing_id,sort_order);
 INSERT INTO carview.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;

-- Photo-based navigation: uses existing originals/derivatives, never synthesizes frames.
CREATE TABLE IF NOT EXISTS carview.photo_spins (
 listing_id TEXT PRIMARY KEY REFERENCES carview.listings(id) ON DELETE CASCADE,
 confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN(0,1)),
 loop INTEGER NOT NULL DEFAULT 0 CHECK(loop IN(0,1))
);
CREATE TABLE IF NOT EXISTS carview.spin_frames (
 listing_id TEXT NOT NULL REFERENCES carview.photo_spins(listing_id) ON DELETE CASCADE,
 photo_id TEXT NOT NULL REFERENCES carview.photos(id) ON DELETE CASCADE,
 frame_order INTEGER NOT NULL,
 PRIMARY KEY(listing_id,frame_order),
 UNIQUE(listing_id,photo_id)
);
INSERT INTO carview.schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS carview.upload_tickets (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES carview.users(id),
 listing_id TEXT REFERENCES carview.listings(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,
 object_key TEXT NOT NULL,
 size INTEGER NOT NULL,
 metadata TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending',
 result_id TEXT,
 expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS upload_ticket_owner ON carview.upload_tickets(owner_id,state,expires);
INSERT INTO carview.schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
INSERT INTO carview.catalog VALUES
 ('toyota-corolla-e170-pk','Toyota','Corolla','E170 · 11th generation',2017,2023,'Pakistan facelift','1.8 Altis Grande CVT-i','Pakistan · RHD'),
 ('honda-civic-fc-pk','Honda','Civic','FC · 10th generation',2016,2018,'Pre-facelift','1.8 i-VTEC Oriel','Pakistan · RHD'),
 ('suzuki-alto-ha36-pk','Suzuki','Alto','HA36 · 8th generation',2019,2026,'Pakistan body shape','VXL AGS 660cc','Pakistan · RHD')
 ON CONFLICT(id) DO NOTHING;
INSERT INTO carview.users(id,name,email,password) VALUES('demo-system','CarView demo','demo@invalid.local','disabled') ON CONFLICT(id) DO NOTHING;
INSERT INTO carview.listings(id,seller_id,catalog_id,title,year,price,mileage,city,description,status,demo)
 VALUES('demo-corolla','demo-system','toyota-corolla-e170-pk','Toyota Corolla Altis Grande',2020,6250000,54000,'Islamabad','An interactive demonstration of CarView. This is not a vehicle advertisement. Vehicle details and price are illustrative. No seller photographs have been uploaded. Create your own listing to try uploading and mapping actual photos.','published',1)
 ON CONFLICT(id) DO NOTHING;
ALTER TABLE carview.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.photo_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.photo_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.spin_frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE carview.upload_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA carview FROM anon'; EXECUTE 'REVOKE ALL ON SCHEMA carview FROM anon'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA carview FROM authenticated'; EXECUTE 'REVOKE ALL ON SCHEMA carview FROM authenticated'; END IF;
END $$;

-- Only Supabase has storage.buckets. A plain PostgreSQL test skips this block.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NOT NULL THEN
  INSERT INTO storage.buckets(id,name,public,file_size_limit)
   VALUES('carview-private','carview-private',false,26214400)
   ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=26214400;
 END IF;
END $$;
-- Do not create any anonymous/public storage policies. Objects stay private.

-- Protect this bucket even if the project has a broad permissive policy for
-- some other application. Leave other buckets/policies intact. Signed URLs
-- created by the server's service role remain the supported access path.
DO $$ BEGIN
 IF to_regclass('storage.objects') IS NOT NULL
    AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
    AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
  EXECUTE 'DROP POLICY IF EXISTS carview_private_bucket_guard ON storage.objects';
  EXECUTE $policy$CREATE POLICY carview_private_bucket_guard ON storage.objects
    AS RESTRICTIVE FOR ALL TO anon, authenticated
    USING (bucket_id <> 'carview-private')
    WITH CHECK (bucket_id <> 'carview-private')$policy$;
 END IF;
END $$;
