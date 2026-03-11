const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const crypto = require("crypto");
console.log("DB_HOST", process.env.DB_HOST, "DB_USER", process.env.DB_USER, "DB_PORT", process.env.DB_PORT, "DB_NAME", process.env.DB_NAME, "PWD_LEN", (process.env.DB_PASSWORD || "").length);
const { getDb } = require("./db");
async function ensureUsersTable() {
  const db = await getDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL
    )
  `);

  await db.end();
}
const bcrypt = require("bcryptjs");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, name: "empagij-backend", time: new Date().toISOString() });
});
app.get("/db-test", async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.query("SELECT NOW() AS now");
    await db.end();
    res.json({ ok: true, rows });
  } catch (err) {
     console.error(err);
    return res.status(500).json({ ok: false, error: String(err) });
}
});
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: "Missing name/email/password" });
    }

    const db = await getDb();

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      await db.end();
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      "INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
      [id, name, email, password_hash]
    );

    await db.end();
    return res.json({ ok: true, user: { id, name, email } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
});
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ ok: false, error: "Missing email/password" });
        }

        const db = await getDb();

        const [rows] = await db.query(
            "SELECT id, name, email, password_hash FROM users WHERE email = ? LIMIT 1",
            [email]
        );

        if (!rows || rows.length === 0) {
            await db.end();
            return res.status(401).json({ ok: false, error: "Invalid credentials" });
        }

        const user = rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);

        await db.end();

        if (!ok) {
            return res.status(401).json({ ok: false, error: "Invalid credentials" });
        }

        // Per ora: ritorniamo solo l'utente (niente token ancora)
        return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// ===== PASSAGGI =====

// Lista passaggi (per ora tutti)
app.get("/passaggi", async (req, res) => {
    try {
        const db = await getDb();
        const [rows] = await db.query(
            "SELECT * FROM passaggi ORDER BY created_at DESC"
        );
        await db.end();
        return res.json({ ok: true, items: rows });
   } catch (err) {
  console.error("REGISTER ERROR:", err);
  return res.status(500).json({
    ok: false,
    error: String(err),
    detail: err && err.message ? err.message : null
  });
}
});

// Crea passaggio
app.post("/passaggi", async (req, res) => {
    try {
        const {
            from_user_id,
            from_name,
            producer_id,
            producer_name,
            producer_category,
            when_label,
            date_iso,
            note,
            status,
        } = req.body || {};

        const id = crypto.randomUUID();

        if (
            !id ||
            !from_user_id ||
            !from_name ||
            !producer_id ||
            !producer_name ||
            !producer_category ||
            !when_label
        ) {
            return res.status(400).json({ ok: false, error: "Missing required fields" });
        }

        const db = await getDb();

        await db.query(
            `INSERT INTO passaggi
      (id, from_user_id, from_name, producer_id, producer_name, producer_category, when_label, date_iso, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                from_user_id,
                from_name,
                producer_id,
                producer_name,
                producer_category,
                when_label,
                date_iso || null,
                note || null,
                status || "in_corso",
            ]
        );

        await db.end();
        return res.json({ ok: true, id });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Elimina passaggio (solo autore)
app.delete("/passaggi/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Per ora prendiamo l'utente dal header (minimo sindacale, no token)
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const db = await getDb();

        // elimina SOLO se il passaggio è dell'utente loggato
        const [result] = await db.query(
            "DELETE FROM passaggi WHERE id = ? AND from_user_id = ?",
            [id, userId]
        );

        await db.end();

        // result.affectedRows = 0 => o non esiste, o non è tuo
        if (!result || result.affectedRows === 0) {
            return res
                .status(404)
                .json({ ok: false, error: "Not found or not allowed" });
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
const PORT = process.env.PORT || 4000;
// GET all producers
app.get("/producers", async (req, res) => {
    try {
        const db = await getDb();

        const [rows] = await db.query(`
      SELECT id, name, category, address, city, phone,
             notes, opening_hours, closed_days, holidays,
             created_at, updated_at
      FROM producers
      ORDER BY name ASC
    `);

        await db.end();

        res.json({ ok: true, producers: rows });
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});
// Crea producer
app.post("/producers", async (req, res) => {
    try {
        const {
            id,
            name,
            category,
            address,
            city,
            phone,
            notes,
            opening_hours,
            closed_days,
            holidays,
        } = req.body || {};

        if (!name || !category) {
            return res.status(400).json({
                ok: false,
                error: "Missing name/category",
            });
        }

        const db = await getDb();

        const producerId = id || crypto.randomUUID();

        await db.query(
            `INSERT INTO producers
      (id, name, category, address, city, phone, notes, opening_hours, closed_days, holidays, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                producerId,
                name,
                category,
                address || null,
                city || null,
                phone || null,
                notes || null,
                opening_hours || null,
                closed_days || null,
                holidays || null,
            ]
        );

        await db.end();

        return res.json({ ok: true, id: producerId });
    } catch (err) {
        console.error("CREATE PRODUCER ERROR:", err);
        return res.status(500).json({
            ok: false,
            error: String(err),
        });
    }
});
// Elimina passaggio
app.delete("/passaggi/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const db = await getDb();
        const [result] = await db.query("DELETE FROM passaggi WHERE id = ?", [id]);
        await db.end();

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: "Not found" });
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.post("/admin/reset-demo", async (req, res) => {
    try {
        const db = await getDb();
        await db.query("DELETE FROM passaggi");
        await db.end();
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// ===== RICHIESTE =====

// Crea richiesta
app.post("/richieste", async (req, res) => {
    try {
        const {
            from_user_id,
            from_name,
            producer_id,
            producer_name,
            request_text,
            status,
        } = req.body || {};

        if (
            !from_user_id ||
            !from_name ||
            !producer_id ||
            !producer_name ||
            !request_text
        ) {
            return res.status(400).json({
                ok: false,
                error: "Missing required fields",
            });
        }

        const db = await getDb();

        const id = crypto.randomUUID();

        await db.query(
            `INSERT INTO richieste
      (id, from_user_id, from_name, producer_id, producer_name, request_text, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                from_user_id,
                from_name,
                producer_id,
                producer_name,
                request_text,
                status || "aperta",
            ]
        );

        await db.end();

        return res.json({ ok: true, id });
    } catch (err) {
        console.error("CREATE RICHIESTA ERROR:", err);
        return res.status(500).json({
            ok: false,
            error: String(err),
        });
    }
});
ensureUsersTable()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Empagij backend running on 0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Errore creazione tabella users:", err);
    process.exit(1);
  });




