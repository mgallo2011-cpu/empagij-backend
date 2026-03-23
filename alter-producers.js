require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    await db.query(`
    ALTER TABLE producers
      ADD COLUMN province_code varchar(10) DEFAULT NULL AFTER name,
      ADD COLUMN city_normalized varchar(120) DEFAULT NULL AFTER city,
      ADD COLUMN google_maps_url varchar(500) DEFAULT NULL AFTER city_normalized,
      ADD COLUMN website_url varchar(500) DEFAULT NULL AFTER google_maps_url,
      ADD COLUMN name_normalized varchar(200) DEFAULT NULL AFTER website_url,
      ADD COLUMN status varchar(30) NOT NULL DEFAULT 'active' AFTER name_normalized,
      ADD COLUMN updated_by_user_id varchar(191) DEFAULT NULL AFTER created_by_user_id,
      ADD COLUMN managed_by_user_id varchar(191) DEFAULT NULL AFTER updated_by_user_id
  `);

    console.log("OK_ALTER_PRODUCERS");
    await db.end();
})().catch((err) => {
    console.error(err);
    process.exit(1);
});