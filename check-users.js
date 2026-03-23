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

  const [rows] = await db.query(
    "SELECT id, name, email, province_code, province_name FROM users ORDER BY id DESC LIMIT 10"
  );

  console.log(rows);

  await db.end();
})();