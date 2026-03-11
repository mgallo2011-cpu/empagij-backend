require("dotenv").config();
const { getDb } = require("./db");

async function main() {
    const db = await getDb();

    await db.query(`
    CREATE TABLE IF NOT EXISTS producers (
      id VARCHAR(80) PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(120) NOT NULL,
      address VARCHAR(255),
      city VARCHAR(120),
      phone VARCHAR(60),
      notes TEXT,
      opening_hours VARCHAR(255),
      closed_days VARCHAR(255),
      holidays VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL
    );
  `);

    const [cols] = await db.query(`DESCRIBE producers;`);
    console.log("OK producers table. Columns:");
    console.log(cols);

    await db.end();
}

main().catch((e) => {
    console.error("MIGRATION FAILED:", e);
    process.exit(1);
});