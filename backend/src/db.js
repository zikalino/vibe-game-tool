import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace(/^sqlite:\/\/\//, "/").replace(/^sqlite:\/\//, "")
  : path.join(__dirname, "../../data/app.db");

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    github_id   TEXT    NOT NULL UNIQUE,
    login       TEXT    NOT NULL,
    name        TEXT,
    avatar_url  TEXT,
    is_sponsor  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT    NOT NULL,
    value      TEXT    NOT NULL DEFAULT '{}',
    updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, key)
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK(type IN ('map', 'tile')),
    data       TEXT    NOT NULL DEFAULT '{}',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate: add is_sponsor column if it does not yet exist (existing databases)
try {
  db.exec("ALTER TABLE users ADD COLUMN is_sponsor INTEGER NOT NULL DEFAULT 0");
} catch (err) {
  if (!err.message.includes("duplicate column name")) throw err;
}

export const upsertUser = db.transaction((profile) => {
  db.prepare(`
    INSERT INTO users (github_id, login, name, avatar_url, is_sponsor, updated_at)
    VALUES (@github_id, @login, @name, @avatar_url, @is_sponsor, datetime('now'))
    ON CONFLICT (github_id) DO UPDATE SET
      login      = excluded.login,
      name       = excluded.name,
      avatar_url = excluded.avatar_url,
      is_sponsor = excluded.is_sponsor,
      updated_at = excluded.updated_at
  `).run(profile);

  return db.prepare("SELECT * FROM users WHERE github_id = ?").get(profile.github_id);
});

export const getUserById = (id) =>
  db.prepare("SELECT * FROM users WHERE id = ?").get(id);

export const getUserData = (userId, key) =>
  db.prepare("SELECT value FROM user_data WHERE user_id = ? AND key = ?").get(userId, key);

export const setUserData = db.transaction((userId, key, value) => {
  db.prepare(`
    INSERT INTO user_data (user_id, key, value, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, key) DO UPDATE SET
      value      = excluded.value,
      updated_at = excluded.updated_at
  `).run(userId, key, value);
});

export const listUserData = (userId) =>
  db.prepare("SELECT key, value, updated_at FROM user_data WHERE user_id = ?").all(userId);

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export const listArtifacts = (userId) =>
  db.prepare(
    "SELECT id, name, type, created_at, updated_at FROM artifacts WHERE user_id = ? ORDER BY updated_at DESC"
  ).all(userId);

export const getArtifact = (id, userId) =>
  db.prepare("SELECT * FROM artifacts WHERE id = ? AND user_id = ?").get(id, userId);

export const createArtifact = db.transaction((userId, name, type, data) => {
  const result = db.prepare(
    "INSERT INTO artifacts (user_id, name, type, data) VALUES (?, ?, ?, ?)"
  ).run(userId, name, type, data);
  return db.prepare("SELECT * FROM artifacts WHERE id = ?").get(result.lastInsertRowid);
});

export const updateArtifact = db.transaction((id, userId, name, data) => {
  db.prepare(
    "UPDATE artifacts SET name = ?, data = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(name, data, id, userId);
  return db.prepare("SELECT * FROM artifacts WHERE id = ? AND user_id = ?").get(id, userId);
});

export const deleteArtifact = (id, userId) =>
  db.prepare("DELETE FROM artifacts WHERE id = ? AND user_id = ?").run(id, userId);

export default db;
