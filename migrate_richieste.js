require("dotenv").config();
const { getDb } = require("./db");

async function main() {
    const db = await getDb();

    await db.query(`
    CREATE TABLE IF NOT EXISTS richieste (
      id VARCHAR(80) PRIMARY KEY,
      from_user_id VARCHAR(36) NOT NULL,
      from_name VARCHAR(120) NOT NULL,
      producer_id VARCHAR(80) NOT NULL,
      producer_name VARCHAR(200) NOT NULL,
      request_text TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'aperta',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

    const [cols] = await db.query("DESCRIBE richieste;");
    console.log("OK richieste table. Columns:");
    console.table(cols);

    await db.end();
}

main().catch((e) => {
    console.error("MIGRATION RICHIESTE FAILED:", e);
    process.exit(1);
});