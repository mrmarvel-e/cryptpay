const path = require("path");
const Database = require("better-sqlite3");

const db = new Database(
    path.join(__dirname, "website.db")
);


// ========================
// USERS TABLE
// ========================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE,

        username TEXT NOT NULL UNIQUE,

        password TEXT NOT NULL,

        balance REAL DEFAULT 0,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP

    )
`).run();


// ========================
// DAILY REWARD CLAIMS
// ========================

db.prepare(`
    CREATE TABLE IF NOT EXISTS daily_claims (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
            REFERENCES users(id)

    )
`).run();

console.log("Daily claims table is ready!");


// ========================
// CP CODES TABLE
// ========================

db.prepare(`
    CREATE TABLE IF NOT EXISTS cp_codes (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        code TEXT NOT NULL UNIQUE,

        proof_path TEXT,

        used INTEGER DEFAULT 0,

        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
            REFERENCES users(id)

    )
`).run();


console.log("Database is ready!");


// ========================
// EXPORT DATABASE
// ========================

module.exports = db;
