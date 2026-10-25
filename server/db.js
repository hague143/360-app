import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
export function openDb(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path.join(dir, "carview.sqlite"));
  db.exec(
    readFileSync(
      new URL("./migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    readFileSync(
      new URL("./migrations/002_photo_spins.sql", import.meta.url),
      "utf8",
    ),
  );
  db.exec(
    readFileSync(
      new URL("./migrations/003_direct_uploads.sql", import.meta.url),
      "utf8",
    ),
  );
  if (!db.prepare("SELECT id FROM catalog LIMIT 1").get()) {
    const add = db.prepare("INSERT INTO catalog VALUES(?,?,?,?,?,?,?,?,?)");
    add.run(
      "toyota-corolla-e170-pk",
      "Toyota",
      "Corolla",
      "E170 · 11th generation",
      2017,
      2023,
      "Pakistan facelift",
      "1.8 Altis Grande CVT-i",
      "Pakistan · RHD",
    );
    add.run(
      "honda-civic-fc-pk",
      "Honda",
      "Civic",
      "FC · 10th generation",
      2016,
      2018,
      "Pre-facelift",
      "1.8 i-VTEC Oriel",
      "Pakistan · RHD",
    );
    add.run(
      "suzuki-alto-ha36-pk",
      "Suzuki",
      "Alto",
      "HA36 · 8th generation",
      2019,
      2026,
      "Pakistan body shape",
      "VXL AGS 660cc",
      "Pakistan · RHD",
    );
  }
  db.prepare(
    "INSERT OR IGNORE INTO users(id,name,email,password) VALUES('demo-system','CarView demo','demo@invalid.local','disabled')",
  ).run();
  db.prepare(
    `INSERT OR IGNORE INTO listings(id,seller_id,catalog_id,title,year,price,mileage,city,description,status,demo) VALUES('demo-corolla','demo-system','toyota-corolla-e170-pk','Toyota Corolla Altis Grande',2020,6250000,54000,'Islamabad','An interactive demonstration of CarView. This is not a vehicle advertisement. Vehicle details and price are illustrative. No seller photographs have been uploaded. Create your own listing to try uploading and mapping actual photos.','published',1)`,
  ).run();
  return db;
}
