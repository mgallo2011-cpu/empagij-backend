require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
    try {
        const conn = await mysql.createConnection({
            host: "127.0.0.1",
            port: 3307,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
        });

        const [rows] = await conn.query("SELECT NOW() AS now");
        console.log("DB OK", rows);

        await conn.end();
    } catch (e) {
        console.error("DB FAIL", e);
        process.exit(1);
    }
})();