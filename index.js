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
      province_code VARCHAR(20) NOT NULL,
      province_name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

    await db.end();
}
async function ensureCirclesTable() {
    const db = await getDb();

    await db.query(`
    CREATE TABLE IF NOT EXISTS circles (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      owner_user_id VARCHAR(191) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_circles_owner_user_id (owner_user_id)
    )
  `);

    await db.end();
}

async function ensureCircleMembersTable() {
    const db = await getDb();

    await db.query(`
    CREATE TABLE IF NOT EXISTS circle_members (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      circle_id VARCHAR(191) NOT NULL,
      user_id VARCHAR(191) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'member',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_circle_user (circle_id, user_id),
      INDEX idx_circle_members_circle_id (circle_id),
      INDEX idx_circle_members_user_id (user_id)
    )
  `);

    await db.end();
}

async function ensureCircleInvitesTable() {
    const db = await getDb();

    await db.query(`
    CREATE TABLE IF NOT EXISTS circle_invites (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      circle_id VARCHAR(191) NOT NULL,
      invited_by_user_id VARCHAR(191) NOT NULL,
      invitee_email VARCHAR(191) NOT NULL,
      invitee_user_id VARCHAR(191) NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      token VARCHAR(191) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      accepted_at TIMESTAMP NULL DEFAULT NULL,
      UNIQUE KEY uniq_pending_invite_token (token),
      INDEX idx_circle_invites_circle_id (circle_id),
      INDEX idx_circle_invites_invitee_email (invitee_email),
      INDEX idx_circle_invites_invitee_user_id (invitee_user_id),
      INDEX idx_circle_invites_status (status)
    )
  `);

    await db.end();
}
async function ensurePassaggiTable() {
    const db = await getDb();

    await db.query(`
        CREATE TABLE IF NOT EXISTS passaggi (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            circle_id VARCHAR(191) NOT NULL,
            from_user_id VARCHAR(191) NOT NULL,
            from_name VARCHAR(191) NOT NULL,
            producer_id VARCHAR(191) NOT NULL,
            producer_name VARCHAR(191) NOT NULL,
            producer_category VARCHAR(191) NOT NULL,
            when_label VARCHAR(50) NOT NULL,
            date_iso VARCHAR(50) NULL,
            note TEXT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'in_corso',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_passaggi_circle_id (circle_id),
            INDEX idx_passaggi_from_user_id (from_user_id),
            INDEX idx_passaggi_status (status)
        )
    `);

    const [circleIdCols] = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'passaggi'
          AND COLUMN_NAME = 'circle_id'
        LIMIT 1
    `);

    if (!circleIdCols || circleIdCols.length === 0) {
        await db.query(`
            ALTER TABLE passaggi
            ADD COLUMN circle_id VARCHAR(191) NOT NULL AFTER id
        `);

        await db.query(`
            ALTER TABLE passaggi
            ADD INDEX idx_passaggi_circle_id (circle_id)
        `);
    }

    await db.end();
}
async function ensureRichiesteTable() {
    const db = await getDb();

    await db.query(`
        CREATE TABLE IF NOT EXISTS richieste (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            circle_id VARCHAR(191) NOT NULL,
            from_user_id VARCHAR(191) NOT NULL,
            from_name VARCHAR(191) NOT NULL,
            producer_id VARCHAR(191) NOT NULL,
            producer_name VARCHAR(191) NOT NULL,
            request_text TEXT NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_richieste_circle_id (circle_id),
            INDEX idx_richieste_from_user_id (from_user_id),
            INDEX idx_richieste_status (status)
        )
    `);

    const [circleIdCols] = await db.query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'richieste'
          AND COLUMN_NAME = 'circle_id'
        LIMIT 1
    `);

    if (!circleIdCols || circleIdCols.length === 0) {
        await db.query(`
            ALTER TABLE richieste
            ADD COLUMN circle_id VARCHAR(191) NOT NULL AFTER id
        `);

        await db.query(`
            ALTER TABLE richieste
            ADD INDEX idx_richieste_circle_id (circle_id)
        `);
    }

    await db.end();
}
async function ensureRichiestaTargetsTable() {
    const db = await getDb();

    await db.query(`
        CREATE TABLE IF NOT EXISTS richiesta_targets (
            id VARCHAR(191) NOT NULL PRIMARY KEY,
            richiesta_id VARCHAR(191) NOT NULL,
            target_user_id VARCHAR(191) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            responded_at TIMESTAMP NULL DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_richiesta_target (richiesta_id, target_user_id),
            INDEX idx_richiesta_targets_richiesta_id (richiesta_id),
            INDEX idx_richiesta_targets_target_user_id (target_user_id),
            INDEX idx_richiesta_targets_status (status)
        )
    `);

    await db.end();
}
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || "empagij_dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

function createAuthToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            email: user.email,
            name: user.name,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function authMiddleware(req, res, next) {
    try {
        const authHeader = req.header("authorization") || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            return res.status(401).json({
                ok: false,
                error: "Missing or invalid Authorization header",
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        req.user = {
            id: decoded.sub,
            email: decoded.email,
            name: decoded.name,
        };

        return next();
    } catch (err) {
        return res.status(401).json({
            ok: false,
            error: "Invalid or expired token",
        });
    }
}
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
app.get("/db-producers-structure", async (req, res) => {
    try {
        const db = await getDb();

        const [columns] = await db.query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'producers'
      ORDER BY ORDINAL_POSITION
    `);

        await db.end();
        res.json({ ok: true, columns });
    } catch (err) {
        console.error("DB PRODUCERS STRUCTURE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.get("/db-users-structure", async (req, res) => {
    try {
        const db = await getDb();

        const [columns] = await db.query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `);

        await db.end();
        res.json({ ok: true, columns });
    } catch (err) {
        console.error("DB USERS STRUCTURE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.get("/db-circles-structure", async (req, res) => {
    try {
        const db = await getDb();

        const [circles] = await db.query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        'circles' AS table_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'circles'
    `);

        const [members] = await db.query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        'circle_members' AS table_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'circle_members'
    `);

        const [invites] = await db.query(`
      SELECT
        COLUMN_NAME,
        COLUMN_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        'circle_invites' AS table_name
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'circle_invites'
    `);

        await db.end();

        res.json({
            ok: true,
            columns: [...circles, ...members, ...invites],
        });
    } catch (err) {
        console.error("DB CIRCLES STRUCTURE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password, province_code, province_name } = req.body || {};

        if (!name || !email || !password || !province_code || !province_name) {
            return res.status(400).json({
                ok: false,
                error: "Missing name/email/password/province_code/province_name",
            });
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
            `INSERT INTO users
       (id, name, email, province_code, province_name, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [id, name, email, province_code, province_name, password_hash]
        );

        await db.end();

        return res.json({
            ok: true,
            user: { id, name, email, province_code, province_name },
        });
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
            "SELECT id, name, email, province_code, province_name, password_hash FROM users WHERE email = ? LIMIT 1",
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

        const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    province_code: user.province_code,
    province_name: user.province_name,
};

const token = createAuthToken(safeUser);

return res.json({
    ok: true,
    token,
    user: safeUser,
});
    } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Membri di una cerchia
app.get("/circles/:id/members", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const db = await getDb();

        const [membershipRows] = await db.query(
            `SELECT id
             FROM circle_members
             WHERE circle_id = ? AND user_id = ?
             LIMIT 1`,
            [id, userId]
        );

        if (!membershipRows || membershipRows.length === 0) {
            await db.end();
            return res.status(403).json({ ok: false, error: "Not a member of this circle" });
        }

        const [rows] = await db.query(
            `
            SELECT u.id, u.name, u.email, cm.role
            FROM circle_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.circle_id = ?
            `,
            [id]
        );

        await db.end();

        return res.json({ ok: true, members: rows });
    } catch (err) {
        console.error("GET MEMBERS ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.delete("/circles/:circleId/members/:memberUserId", async (req, res) => {
    let db;

    try {
        const { circleId, memberUserId } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        db = await getDb();
        await db.beginTransaction();

        const [circleRows] = await db.query(
            `SELECT id, owner_user_id
             FROM circles
             WHERE id = ?
             LIMIT 1`,
            [circleId]
        );

        if (!circleRows || circleRows.length === 0) {
            await db.rollback();
            await db.end();
            return res.status(404).json({ ok: false, error: "Circle not found" });
        }

        const circle = circleRows[0];

        if (circle.owner_user_id !== userId) {
            await db.rollback();
            await db.end();
            return res.status(403).json({ ok: false, error: "Only the owner can remove members" });
        }

        if (memberUserId === userId) {
            await db.rollback();
            await db.end();
            return res.status(400).json({ ok: false, error: "Owner cannot remove themselves" });
        }

        const [memberRows] = await db.query(
            `SELECT id
             FROM circle_members
             WHERE circle_id = ? AND user_id = ?
             LIMIT 1`,
            [circleId, memberUserId]
        );

        if (!memberRows || memberRows.length === 0) {
            await db.rollback();
            await db.end();
            return res.status(404).json({ ok: false, error: "Member not found in this circle" });
        }

        await db.query(
            `DELETE FROM circle_members
             WHERE circle_id = ? AND user_id = ?`,
            [circleId, memberUserId]
        );

        const [remainingRows] = await db.query(
            `SELECT user_id
             FROM circle_members
             WHERE circle_id = ?`,
            [circleId]
        );

        const remainingCount = Array.isArray(remainingRows) ? remainingRows.length : 0;

        // Se resta solo l'owner, eliminiamo tutta la cerchia e tutti i dati collegati
        if (remainingCount <= 1) {
            await db.query(
                `DELETE rt
                 FROM richiesta_targets rt
                 INNER JOIN richieste r ON r.id = rt.richiesta_id
                 WHERE r.circle_id = ?`,
                [circleId]
            );

            await db.query(
                `DELETE FROM richieste
                 WHERE circle_id = ?`,
                [circleId]
            );

            await db.query(
                `DELETE FROM passaggi
                 WHERE circle_id = ?`,
                [circleId]
            );

            await db.query(
                `DELETE FROM circle_invites
                 WHERE circle_id = ?`,
                [circleId]
            );

            await db.query(
                `DELETE FROM circle_members
                 WHERE circle_id = ?`,
                [circleId]
            );

            await db.query(
                `DELETE FROM circles
                 WHERE id = ?`,
                [circleId]
            );

            await db.commit();
            await db.end();

            return res.json({
                ok: true,
                circle_deleted: true,
            });
        }

        await db.commit();
        await db.end();

        return res.json({
            ok: true,
            circle_deleted: false,
        });
    } catch (err) {
        try {
            if (db) {
                await db.rollback();
                await db.end();
            }
        } catch (_) {}

        console.error("REMOVE CIRCLE MEMBER ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});

// ===== CERCHIE =====

// Crea una nuova cerchia
app.post("/circles", async (req, res) => {
    try {
        const { name } = req.body || {};
        const owner_user_id = req.header("x-user-id");

        if (!name || !owner_user_id) {
            return res.status(400).json({
                ok: false,
                error: "Missing name/x-user-id",
            });
        }

        const db = await getDb();
        // limite: max 3 cerchie per utente
const [countRows] = await db.query(
    "SELECT COUNT(*) as count FROM circles WHERE owner_user_id = ?",
    [owner_user_id]
);

if (countRows[0].count >= 3) {
    await db.end();
    return res.status(400).json({
        ok: false,
        error: "Limite cerchie raggiunto (max 3)"
    });
}
        const circleId = crypto.randomUUID();

        // crea cerchia
        await db.query(
            `INSERT INTO circles (id, name, owner_user_id)
             VALUES (?, ?, ?)`,
            [circleId, name, owner_user_id]
        );

        // aggiunge owner come membro
        await db.query(
            `INSERT INTO circle_members (id, circle_id, user_id, role)
             VALUES (?, ?, ?, 'owner')`,
            [crypto.randomUUID(), circleId, owner_user_id]
        );

        await db.end();

        return res.json({ ok: true, id: circleId });
    } catch (err) {
        console.error("CREATE CIRCLE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Lista cerchie dell'utente
app.get("/circles/mine", authMiddleware, async (req, res) => {
    try {
        console.log("JWT CIRCLES MINE OK", req.user);
        const userId = req.user.id;

        const db = await getDb();

        const [rows] = await db.query(
            `
            SELECT c.id, c.name, c.owner_user_id
            FROM circles c
            JOIN circle_members cm ON cm.circle_id = c.id
            WHERE cm.user_id = ?
            ORDER BY c.created_at DESC
            `,
            [userId]
        );

        await db.end();

        return res.json({ ok: true, circles: rows });
    } catch (err) {
        console.error("GET MY CIRCLES ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Membri di una cerchia

// Invita utente via email in una cerchia
app.post("/circles/:id/invite", async (req, res) => {
    try {
        const { id: circle_id } = req.params;
        const { invitee_email } = req.body || {};
        const invited_by_user_id = req.header("x-user-id");

        if (!invited_by_user_id) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        if (!invitee_email) {
            return res.status(400).json({ ok: false, error: "Missing invitee_email" });
        }

        const db = await getDb();

        // verifica che la cerchia esista
        const [circles] = await db.query(
            "SELECT id FROM circles WHERE id = ? LIMIT 1",
            [circle_id]
        );
        // 1. Conta membri attuali della cerchia
const [membersCount] = await db.query(
  "SELECT COUNT(*) as count FROM circle_members WHERE circle_id = ?",
  [circle_id]
);

if (membersCount[0].count >= 5) {
  await db.end();
  return res.status(400).json({
    ok: false,
    error: "Limite cerchia raggiunto (max 5 membri)"
  });
}

        if (!circles || circles.length === 0) {
            await db.end();
            return res.status(404).json({ ok: false, error: "Circle not found" });
        }

        // verifica che chi invita sia membro della cerchia
        const [members] = await db.query(
            "SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ? LIMIT 1",
            [circle_id, invited_by_user_id]
        );

        if (!members || members.length === 0) {
            await db.end();
            return res.status(403).json({ ok: false, error: "Not a member of this circle" });
        }
        const normalizedInviteeEmail = String(invitee_email).trim().toLowerCase();
        const [usersByEmail] = await db.query(
    "SELECT id, email FROM users WHERE email = ? LIMIT 1",
    [normalizedInviteeEmail]
);

if (!usersByEmail || usersByEmail.length === 0) {
    await db.end();
    return res.status(404).json({
        ok: false,
        error: "User not found",
    });
}

const [existingPendingInvites] = await db.query(
    `SELECT id
     FROM circle_invites
     WHERE circle_id = ?
       AND invitee_email = ?
       AND status = 'pending'
     LIMIT 1`,
    [circle_id, normalizedInviteeEmail]
);

if (existingPendingInvites && existingPendingInvites.length > 0) {
    await db.end();
    return res.status(409).json({
        ok: false,
        error: "Esiste già un invito pendente per questa email",
    });
}
        const id = crypto.randomUUID();
        const token = crypto.randomUUID();

        await db.query(
            `INSERT INTO circle_invites
      (id, circle_id, invited_by_user_id, invitee_email, token, status)
      VALUES (?, ?, ?, ?, ?, ?)`,
            [id, circle_id, invited_by_user_id, normalizedInviteeEmail, token, "pending"]
        );

        await db.end();

        return res.json({ ok: true, id });
    } catch (err) {
        console.error("INVITE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Lista inviti ricevuti
app.get("/invites/mine", async (req, res) => {
    try {
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const db = await getDb();

       const [userRows] = await db.query(
    "SELECT email FROM users WHERE id = ? LIMIT 1",
    [userId]
);

if (!userRows || userRows.length === 0) {
    await db.end();
    return res.status(404).json({ ok: false, error: "User not found" });
}

const userEmail = userRows[0].email;

const [rows] = await db.query(
    `
    SELECT ci.id, ci.circle_id, c.name AS circle_name,
           ci.invited_by_user_id, ci.invitee_email,
           ci.status, ci.created_at
    FROM circle_invites ci
    JOIN circles c ON c.id = ci.circle_id
    WHERE ci.status = 'pending'
      AND ci.invitee_email = ?
    ORDER BY ci.created_at DESC
    `,
    [userEmail]
);

        await db.end();

        return res.json({ ok: true, invites: rows });
    } catch (err) {
        console.error("GET INVITES ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// Accetta invito
app.post("/invites/:id/accept", async (req, res) => {
    let db;

    try {
        const { id: inviteId } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        db = await getDb();
        await db.beginTransaction();

        // 1) blocca utente loggato e recupera email
        const [userRows] = await db.query(
            `SELECT id, email
             FROM users
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            await db.rollback();
            await db.end();
            return res.status(404).json({ ok: false, error: "User not found" });
        }

        const user = userRows[0];

        const [userCircleRows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM circle_members
     WHERE user_id = ?`,
    [userId]
);

const userCircleCount = Number(userCircleRows?.[0]?.count || 0);

if (userCircleCount >= 3) {
    await db.rollback();
    await db.end();
    return res.status(409).json({
        ok: false,
        error: "User already belongs to the maximum number of circles (max 3)",
    });
}
        // 2) blocca invito
        const [inviteRows] = await db.query(
            `SELECT *
             FROM circle_invites
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [inviteId]
        );

        if (!inviteRows || inviteRows.length === 0) {
            await db.rollback();
            await db.end();
            return res.status(404).json({ ok: false, error: "Invite not found" });
        }

        const invite = inviteRows[0];

        if (invite.status !== "pending") {
            await db.rollback();
            await db.end();
            return res.status(409).json({ ok: false, error: "Invite is not pending" });
        }

        // 3) verifica che l'invito appartenga davvero all'utente loggato
        const userEmail = String(user.email || "").trim().toLowerCase();
        const inviteEmail = String(invite.invitee_email || "").trim().toLowerCase();

        if (!userEmail || userEmail !== inviteEmail) {
            await db.rollback();
            await db.end();
            return res.status(403).json({ ok: false, error: "This invite does not belong to the current user" });
        }

        // 4) blocca la cerchia
        const [circleRows] = await db.query(
            `SELECT id
             FROM circles
             WHERE id = ?
             LIMIT 1
             FOR UPDATE`,
            [invite.circle_id]
        );

        if (!circleRows || circleRows.length === 0) {
            await db.rollback();
            await db.end();
            return res.status(404).json({ ok: false, error: "Circle not found" });
        }

        // 5) blocca i membri della cerchia e conta i membri reali
        const [memberRows] = await db.query(
            `SELECT id, user_id
             FROM circle_members
             WHERE circle_id = ?
             FOR UPDATE`,
            [invite.circle_id]
        );

        const memberCount = Array.isArray(memberRows) ? memberRows.length : 0;

        if (memberCount >= 5) {
            await db.rollback();
            await db.end();
            return res.status(409).json({
                ok: false,
                error: "Circle full (max 5 members)",
            });
        }

        // 6) verifica che l'utente non sia già membro
        const alreadyMember = memberRows.some((m) => m.user_id === userId);

        if (alreadyMember) {
            await db.rollback();
            await db.end();
            return res.status(409).json({ ok: false, error: "Already a member" });
        }

        // 7) inserisce membro
        await db.query(
            `INSERT INTO circle_members (id, circle_id, user_id, role, status)
             VALUES (?, ?, ?, 'member', 'active')`,
            [crypto.randomUUID(), invite.circle_id, userId]
        );

        // 8) aggiorna invito
        await db.query(
            `UPDATE circle_invites
             SET status = 'accepted',
                 invitee_user_id = ?,
                 accepted_at = NOW()
             WHERE id = ?`,
            [userId, inviteId]
        );

        await db.commit();
        await db.end();

        return res.json({ ok: true });
    } catch (err) {
        try {
            if (db) {
                await db.rollback();
                await db.end();
            }
        } catch (_) {}

        console.error("ACCEPT INVITE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.post("/invites/:id/decline", async (req, res) => {
    try {
        const { id: inviteId } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const db = await getDb();

        const [userRows] = await db.query(
            "SELECT email FROM users WHERE id = ? LIMIT 1",
            [userId]
        );

        if (!userRows || userRows.length === 0) {
            await db.end();
            return res.status(404).json({ ok: false, error: "User not found" });
        }

        const userEmail = String(userRows[0].email || "").trim().toLowerCase();

        const [inviteRows] = await db.query(
            `SELECT id, invitee_email, status
             FROM circle_invites
             WHERE id = ?
             LIMIT 1`,
            [inviteId]
        );

        if (!inviteRows || inviteRows.length === 0) {
            await db.end();
            return res.status(404).json({ ok: false, error: "Invite not found" });
        }

        const invite = inviteRows[0];
        const inviteEmail = String(invite.invitee_email || "").trim().toLowerCase();

        if (invite.status !== "pending") {
            await db.end();
            return res.status(409).json({ ok: false, error: "Invite is not pending" });
        }

        if (!userEmail || userEmail !== inviteEmail) {
            await db.end();
            return res.status(403).json({ ok: false, error: "This invite does not belong to the current user" });
        }

        await db.query(
            `UPDATE circle_invites
             SET status = 'declined'
             WHERE id = ?`,
            [inviteId]
        );

        await db.end();

        return res.json({ ok: true });
    } catch (err) {
        console.error("DECLINE INVITE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
// ===== PASSAGGI =====

// Lista passaggi (per ora tutti)
app.get("/passaggi", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const { circle_id } = req.query || {};

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        if (!circle_id) {
            return res.status(400).json({ ok: false, error: "Missing circle_id" });
        }

        const db = await getDb();

        const [membershipRows] = await db.query(
            `SELECT id
             FROM circle_members
             WHERE circle_id = ? AND user_id = ?
             LIMIT 1`,
            [circle_id, userId]
        );

        if (!membershipRows || membershipRows.length === 0) {
            await db.end();
            return res.status(403).json({ ok: false, error: "Not a member of this circle" });
        }

        const [rows] = await db.query(
            `SELECT *
             FROM passaggi
             WHERE circle_id = ?
             ORDER BY created_at DESC`,
            [circle_id]
        );

        await db.end();

        return res.json({ ok: true, items: rows });
    } catch (err) {
        console.error("GET PASSAGGI ERROR:", err);
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
            circle_id,
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
            !circle_id ||
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

        const [membershipRows] = await db.query(
    `SELECT id
     FROM circle_members
     WHERE circle_id = ? AND user_id = ?
     LIMIT 1`,
    [circle_id, from_user_id]
);

if (!membershipRows || membershipRows.length === 0) {
    await db.end();
    return res.status(403).json({
        ok: false,
        error: "User is not a member of this circle",
    });
}
        await db.query(
            `INSERT INTO passaggi
            (id, circle_id, from_user_id, from_name, producer_id, producer_name, producer_category, when_label, date_iso, note, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                circle_id,
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
// GET producers by province
app.get("/producers", async (req, res) => {
    try {
        const { province_code } = req.query || {};

        if (!province_code) {
            return res.status(400).json({
                ok: false,
                error: "Missing province_code",
            });
        }

        const db = await getDb();

        const [rows] = await db.query(
            `
      SELECT id, name, category, province_code, address, city,
             google_maps_url, website_url, notes,
             created_by_user_id, visibility,
             created_at, updated_at
      FROM producers
      WHERE province_code = ?
      ORDER BY name ASC
    `,
            [String(province_code).trim().toUpperCase()]
        );

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
            created_by_user_id,
            visibility,
        } = req.body || {};
        console.log("POST /producers BODY:", req.body);


        if (!name || !category || !created_by_user_id) {
            return res.status(400).json({
                ok: false,
                error: "Missing name/category/created_by_user_id",
            });
        }

        const db = await getDb();

        const [users] = await db.query(
            "SELECT province_code FROM users WHERE id = ? LIMIT 1",
            [created_by_user_id]
        );

        if (!users || users.length === 0) {
            await db.end();
            return res.status(404).json({
                ok: false,
                error: "User not found",
            });
        }

        const province_code = users[0].province_code || null;
        console.log("POST /producers USER LOOKUP:", users[0]);
        console.log("POST /producers province_code:", province_code);

        if (!province_code) {
            await db.end();
            return res.status(400).json({
                ok: false,
                error: "User has no province_code",
            });
        }
      
        const producerId = id || crypto.randomUUID();
        console.log("POST /producers INSERT DATA:", {
            producerId,
            name,
            province_code,
            category,
            address: address || null,
            city: city || null,
            phone: phone || null,
            notes: notes || null,
            opening_hours: opening_hours || null,
            closed_days: closed_days || null,
            holidays: holidays || null,
            created_by_user_id,
            visibility: visibility || "cerchia",
        });
        await db.query(
            `INSERT INTO producers
      (id, name, province_code, category, address, city, phone, notes, opening_hours, closed_days, holidays, created_by_user_id, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
                producerId,
                name,
                province_code,
                category,
                address || null,
                city || null,
                phone || null,
                notes || null,
                opening_hours || null,
                closed_days || null,
                holidays || null,
                created_by_user_id,
                visibility || "cerchia",
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
app.delete("/producers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const db = await getDb();

        const [result] = await db.query(
            "DELETE FROM producers WHERE id = ? AND created_by_user_id = ?",
            [id, userId]
        );

        console.log("DELETE /producers id:", id);
        console.log("DELETE /producers userId:", userId);
        console.log("DELETE /producers result:", result);

        await db.end();

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: "Not found or not allowed" });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error("DELETE PRODUCER ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.put("/producers/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.header("x-user-id");

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        const {
            name,
            category,
            address,
            city,
            notes,
        } = req.body || {};

        if (!name || !category) {
            return res.status(400).json({ ok: false, error: "Missing name/category" });
        }

        const db = await getDb();

        const [result] = await db.query(
            `UPDATE producers
             SET name = ?, category = ?, address = ?, city = ?, notes = ?, updated_at = NOW()
             WHERE id = ? AND created_by_user_id = ?`,
            [
                name,
                category,
                address || null,
                city || null,
                notes || null,
                id,
                userId,
            ]
        );

        await db.end();

        if (!result || result.affectedRows === 0) {
            return res.status(404).json({ ok: false, error: "Not found or not allowed" });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error("UPDATE PRODUCER ERROR:", err);
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
    console.log("POST /richieste HIT", req.body);
    let db;

    try {
        const userId = req.header("x-user-id");
        const {
            circle_id,
            from_user_id,
            from_name,
            producer_id,
            producer_name,
            request_text,
            target_user_ids,
        } = req.body || {};

        if (!userId) {
            return res.status(401).json({ ok: false, error: "Missing x-user-id" });
        }

        if (
            !circle_id ||
            !from_user_id ||
            !from_name ||
            !producer_id ||
            !producer_name ||
            !request_text ||
            !Array.isArray(target_user_ids) ||
            target_user_ids.length === 0
        ) {
            return res.status(400).json({
                ok: false,
                error: "Missing required fields",
            });
        }

        if (userId !== from_user_id) {
            return res.status(403).json({
                ok: false,
                error: "x-user-id and from_user_id do not match",
            });
        }

        const cleanTargetUserIds = [...new Set(
            target_user_ids
                .map((x) => String(x || "").trim())
                .filter(Boolean)
        )];

        if (cleanTargetUserIds.length === 0) {
            return res.status(400).json({
                ok: false,
                error: "No valid target_user_ids",
            });
        }

        db = await getDb();
        await db.beginTransaction();

        const [memberRows] = await db.query(
            `SELECT user_id
             FROM circle_members
             WHERE circle_id = ?`,
            [circle_id]
        );

        const memberIds = new Set((memberRows || []).map((m) => m.user_id));

        if (!memberIds.has(userId)) {
            await db.rollback();
            await db.end();
            return res.status(403).json({
                ok: false,
                error: "User is not a member of this circle",
            });
        }

        for (const targetUserId of cleanTargetUserIds) {
            if (!memberIds.has(targetUserId)) {
                await db.rollback();
                await db.end();
                return res.status(400).json({
                    ok: false,
                    error: `Target user not in circle: ${targetUserId}`,
                });
            }

            if (targetUserId === userId) {
                await db.rollback();
                await db.end();
                return res.status(400).json({
                    ok: false,
                    error: "You cannot send a request to yourself",
                });
            }
        }

        const richiestaId = crypto.randomUUID();

        await db.query(
            `INSERT INTO richieste
            (id, circle_id, from_user_id, from_name, producer_id, producer_name, request_text, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                richiestaId,
                circle_id,
                from_user_id,
                from_name,
                producer_id,
                producer_name,
                String(request_text).trim(),
                "open",
            ]
        );

        for (const targetUserId of cleanTargetUserIds) {
            await db.query(
                `INSERT INTO richiesta_targets
                (id, richiesta_id, target_user_id, status)
                VALUES (?, ?, ?, ?)`,
                [crypto.randomUUID(), richiestaId, targetUserId, "pending"]
            );
        }

        await db.commit();
        await db.end();

        return res.json({ ok: true, id: richiestaId });
    } catch (err) {
        try {
            if (db) {
                await db.rollback();
                await db.end();
            }
        } catch (_) {}

        console.error("CREATE RICHIESTA ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
app.get("/richieste", authMiddleware, async (req, res) => {
    console.log("GET /richieste HIT", req.query);
    try {
        const { circle_id } = req.query;
        const userId = req.user.id;

        if (!circle_id) {
            return res.status(400).json({ ok: false, error: "Missing circle_id" });
        }

        const db = await getDb();

        // verifica che l'utente sia membro della cerchia
        const [members] = await db.query(
            "SELECT id FROM circle_members WHERE circle_id = ? AND user_id = ? LIMIT 1",
            [circle_id, userId]
        );

        if (!members || members.length === 0) {
            await db.end();
            return res.status(403).json({ ok: false, error: "Not a member of this circle" });
        }

       const [rows] = await db.query(
    `
    SELECT
        r.*,
        GROUP_CONCAT(u.name SEPARATOR ', ') AS target_names,
        GROUP_CONCAT(rt.target_user_id SEPARATOR ',') AS target_user_ids
    FROM richieste r
    LEFT JOIN richiesta_targets rt ON rt.richiesta_id = r.id
    LEFT JOIN users u ON u.id = rt.target_user_id
    WHERE r.circle_id = ?
    GROUP BY r.id
    ORDER BY r.created_at DESC
    `,
    [circle_id]
);

        await db.end();

        return res.json({ ok: true, items: rows });
    } catch (err) {
        console.error("GET RICHIESTE ERROR:", err);
        return res.status(500).json({ ok: false, error: String(err) });
    }
});
process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
    console.error("UNHANDLED REJECTION:", reason);
});
Promise.all([
    ensureUsersTable(),
    ensureCirclesTable(),
    ensureCircleMembersTable(),
    ensureCircleInvitesTable(),
    ensurePassaggiTable(),
    ensureRichiesteTable(),
    ensureRichiestaTargetsTable(),
])
    .then(() => {
        console.log("Users/Circles tables check OK");
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Empagij backend running on 0.0.0.0:${PORT}`);
        });
    })
    .catch((err) => {
        console.error("BOOT ERROR - table setup failed:", err);
        process.exit(1);
    });




