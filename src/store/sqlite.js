'use strict';

/*
  Datenspeicher für lokal: SQLite über node:sqlite (ab Node 22.13).
  Gleiche Schnittstelle wie src/store/mongo.js; welcher genutzt wird, entscheidet src/repo.js.
*/
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', '..', 'data');
let db = null;

// Zeitstempel mit Millisekunden, damit "gelesen" und "neue Nachricht" sauber vergleichbar sind
const NOW_MS = "strftime('%Y-%m-%d %H:%M:%f', 'now')";
const plain = (row) => (row ? { ...row } : null);
const rows = (list) => list.map((r) => ({ ...r }));

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Spalte nachrüsten, falls eine ältere Datenbank sie noch nicht hat
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

async function init() {
  if (db) return;
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, 'portal.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin', 'client')),
      discord       TEXT,
      notes         TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS default_prices (
      service_id  TEXT PRIMARY KEY,
      price_cents INTEGER
    );
    CREATE TABLE IF NOT EXISTS user_prices (
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service_id  TEXT NOT NULL,
      price_cents INTEGER,
      hidden      INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, service_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id              INTEGER PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status          TEXT NOT NULL DEFAULT 'new',
      deadline        TEXT,
      message         TEXT,
      links           TEXT,
      total_cents     INTEGER,
      admin_note      TEXT,
      discord_channel TEXT,
      discord_message TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id               INTEGER PRIMARY KEY,
      order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      service_id       TEXT NOT NULL,
      qty              INTEGER NOT NULL,
      unit_price_cents INTEGER,
      note             TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id          INTEGER PRIMARY KEY,
      order_id    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_role TEXT NOT NULL CHECK (author_role IN ('client', 'admin', 'system')),
      body        TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
    );
    CREATE TABLE IF NOT EXISTS attachments (
      id            INTEGER PRIMARY KEY,
      order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      item_id       INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      stored_name   TEXT NOT NULL,
      size          INTEGER NOT NULL,
      mime          TEXT
    );
    CREATE TABLE IF NOT EXISTS contacts (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      services   TEXT,
      budget     TEXT,
      deadline   TEXT,
      message    TEXT NOT NULL,
      handled    INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Ergänzungen für Datenbanken aus älteren Versionen
  ensureColumn('orders', 'client_seen_at', 'TEXT');
  ensureColumn('orders', 'admin_seen_at', 'TEXT');
  ensureColumn('attachments', 'message_id', 'INTEGER REFERENCES messages(id) ON DELETE CASCADE');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_att_order ON attachments(order_id);
    CREATE INDEX IF NOT EXISTS idx_msg_order ON messages(order_id);
  `);
}

async function close() {
  if (db) { db.close(); db = null; }
}

/* ---------- Benutzer ---------- */
const USER_PUBLIC = 'id, username, display_name, role, discord, notes, active, created_at';

async function countAdmins() {
  return db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1").get().n;
}

async function createUser({ username, display_name, password_hash, role, discord = null, notes = null }) {
  return Number(db.prepare('INSERT INTO users (username, display_name, password_hash, role, discord, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(username, display_name, password_hash, role, discord, notes).lastInsertRowid);
}

async function getUserForLogin(username) {
  return plain(db.prepare('SELECT id, username, password_hash, role, active FROM users WHERE username = ?').get(username));
}

async function getUser(id) {
  return plain(db.prepare(`SELECT ${USER_PUBLIC} FROM users WHERE id = ?`).get(id));
}

async function getPasswordHash(id) {
  return db.prepare('SELECT password_hash FROM users WHERE id = ?').get(id)?.password_hash ?? null;
}

async function listUsers() {
  return rows(db.prepare(`
    SELECT ${USER_PUBLIC.split(', ').map((c) => `u.${c}`).join(', ')},
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status IN ('new','progress','review')) AS open_count
    FROM users u ORDER BY u.role = 'admin' DESC, u.display_name COLLATE NOCASE
  `).all());
}

async function updateUser(id, fields) {
  const allowed = ['display_name', 'discord', 'notes', 'active'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE users SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map((k) => fields[k]), id);
}

async function setPassword(id, password_hash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
}

// Löscht Konto samt Aufträgen; gibt die Auftragsnummern zurück (für die Dateien)
async function deleteUser(id) {
  const orderIds = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(id).map((r) => r.id);
  transaction(() => {
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  return orderIds;
}

/* ---------- Sessions ---------- */
async function createSession(tokenHash, userId, expiresAt) {
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(tokenHash, userId, expiresAt, Date.now());
}

async function getSessionUser(tokenHash) {
  return plain(db.prepare(`
    SELECT u.id, u.username, u.display_name, u.role, u.discord
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1
  `).get(tokenHash, Date.now()));
}

async function deleteSession(tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

async function deleteUserSessions(userId, exceptHash = null) {
  db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash IS NOT ?').run(userId, exceptHash);
}

async function purgeSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

/* ---------- Preise ---------- */
async function getDefaultPrices() {
  return new Map(db.prepare('SELECT service_id, price_cents FROM default_prices').all().map((r) => [r.service_id, r.price_cents]));
}

async function setDefaultPrices(prices) {
  transaction(() => {
    const up = db.prepare('INSERT INTO default_prices (service_id, price_cents) VALUES (?, ?) ON CONFLICT(service_id) DO UPDATE SET price_cents = excluded.price_cents');
    for (const [id, cents] of Object.entries(prices)) up.run(id, cents);
  });
}

async function getUserPrices(userId) {
  return new Map(db.prepare('SELECT service_id, price_cents, hidden FROM user_prices WHERE user_id = ?').all(userId)
    .map((r) => [r.service_id, { price_cents: r.price_cents, hidden: !!r.hidden }]));
}

async function setUserPrices(userId, prices) {
  transaction(() => {
    const up = db.prepare(`INSERT INTO user_prices (user_id, service_id, price_cents, hidden) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, service_id) DO UPDATE SET price_cents = excluded.price_cents, hidden = excluded.hidden`);
    for (const [id, p] of Object.entries(prices)) up.run(userId, id, p.price_cents, p.hidden ? 1 : 0);
  });
}

/* ---------- Aufträge ---------- */
const ORDER_SELECT = `
  SELECT o.*, u.username, u.display_name, u.discord AS user_discord,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.order_id = o.id AND m.author_role = 'client') AS last_client_msg_at,
    (SELECT MAX(m.created_at) FROM messages m WHERE m.order_id = o.id AND m.author_role IN ('admin','system')) AS last_admin_msg_at,
    (SELECT COUNT(*) FROM messages m WHERE m.order_id = o.id AND m.author_role <> 'system') AS message_count
  FROM orders o JOIN users u ON u.id = o.user_id`;

function withDetails(order) {
  order.items = rows(db.prepare('SELECT id, service_id, qty, unit_price_cents, note FROM order_items WHERE order_id = ? ORDER BY id').all(order.id));
  order.attachments = rows(db.prepare('SELECT id, item_id, message_id, original_name, stored_name, size, mime FROM attachments WHERE order_id = ? AND message_id IS NULL ORDER BY id').all(order.id));
  return order;
}

// Legt Auftrag + Positionen an und gibt die IDs der Positionen in derselben Reihenfolge zurück
async function createOrder({ user_id, deadline, message, links, total_cents, items }) {
  return transaction(() => {
    const id = Number(db.prepare(`INSERT INTO orders (user_id, deadline, message, links, total_cents, client_seen_at) VALUES (?, ?, ?, ?, ?, ${NOW_MS})`)
      .run(user_id, deadline, message, links, total_cents).lastInsertRowid);
    const ins = db.prepare('INSERT INTO order_items (order_id, service_id, qty, unit_price_cents, note) VALUES (?, ?, ?, ?, ?)');
    const itemIds = items.map((it) => Number(ins.run(id, it.service_id, it.qty, it.unit_price_cents, it.note).lastInsertRowid));
    return { id, itemIds };
  });
}

async function addAttachment({ order_id, item_id = null, message_id = null, original_name, stored_name, size, mime }) {
  return Number(db.prepare('INSERT INTO attachments (order_id, item_id, message_id, original_name, stored_name, size, mime) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(order_id, item_id, message_id, original_name, stored_name, size, mime).lastInsertRowid);
}

async function deleteOrder(id) {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
}

async function getOrder(id) {
  const o = plain(db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id));
  return o ? withDetails(o) : null;
}

async function listOrders({ userId = null, statuses = null, q = '' } = {}) {
  const where = [];
  const params = [];
  if (userId) { where.push('o.user_id = ?'); params.push(userId); }
  if (statuses?.length) { where.push(`o.status IN (${statuses.map(() => '?').join(',')})`); params.push(...statuses); }
  if (q) {
    const num = /^#?(\d{1,9})$/.exec(q);
    if (num) { where.push('o.id = ?'); params.push(Number(num[1])); } else {
      where.push('(u.display_name LIKE ? ESCAPE \'\\\' OR u.username LIKE ? ESCAPE \'\\\')');
      const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like);
    }
  }
  return rows(db.prepare(`${ORDER_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY o.id DESC LIMIT 500`).all(...params))
    .map(withDetails);
}

// Offene Aufträge: früheste Deadline zuerst, ohne Deadline ans Ende
async function listOpen() {
  return rows(db.prepare(`${ORDER_SELECT} WHERE o.status IN ('new','progress','review') ORDER BY o.deadline IS NULL, o.deadline, o.id`).all())
    .map(withDetails);
}

async function updateOrder(id, fields) {
  const allowed = ['status', 'admin_note', 'total_cents', 'discord_channel', 'discord_message'];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), id);
}

async function markSeen(orderId, role) {
  db.prepare(`UPDATE orders SET ${role === 'admin' ? 'admin_seen_at' : 'client_seen_at'} = ${NOW_MS} WHERE id = ?`).run(orderId);
}

async function getAttachment(id) {
  return plain(db.prepare('SELECT a.*, o.user_id FROM attachments a JOIN orders o ON o.id = a.order_id WHERE a.id = ?').get(id));
}

/* ---------- Nachrichten pro Auftrag ---------- */
async function addMessage({ order_id, author_id = null, author_role, body = null }) {
  return Number(db.prepare(`INSERT INTO messages (order_id, author_id, author_role, body, created_at) VALUES (?, ?, ?, ?, ${NOW_MS})`)
    .run(order_id, author_id, author_role, body).lastInsertRowid);
}

async function listMessages(orderId) {
  const msgs = rows(db.prepare(`
    SELECT m.id, m.order_id, m.author_id, m.author_role, m.body, m.created_at, u.display_name AS author_name
    FROM messages m LEFT JOIN users u ON u.id = m.author_id
    WHERE m.order_id = ? ORDER BY m.id
  `).all(orderId));
  const atts = rows(db.prepare('SELECT id, message_id, original_name, stored_name, size, mime FROM attachments WHERE order_id = ? AND message_id IS NOT NULL ORDER BY id').all(orderId));
  for (const m of msgs) m.attachments = atts.filter((a) => a.message_id === m.id);
  return msgs;
}

async function recentClientMessages(limit = 8) {
  return rows(db.prepare(`
    SELECT m.id, m.order_id, m.body, m.created_at, u.display_name
    FROM messages m JOIN orders o ON o.id = m.order_id JOIN users u ON u.id = o.user_id
    WHERE m.author_role = 'client' ORDER BY m.id DESC LIMIT ?
  `).all(limit));
}

/* ---------- Website-Anfragen ---------- */
async function createContact({ name, email, services, budget, deadline, message }) {
  return Number(db.prepare('INSERT INTO contacts (name, email, services, budget, deadline, message) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, email, services, budget, deadline, message).lastInsertRowid);
}

async function listContacts({ handled = null } = {}) {
  const where = handled === null ? '' : 'WHERE handled = ?';
  return rows(db.prepare(`SELECT * FROM contacts ${where} ORDER BY id DESC LIMIT 500`).all(...(handled === null ? [] : [handled ? 1 : 0])));
}

async function setContactHandled(id, handled) {
  return db.prepare('UPDATE contacts SET handled = ? WHERE id = ?').run(handled ? 1 : 0, id).changes > 0;
}

async function deleteContact(id) {
  return db.prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0;
}

async function stats() {
  return { ...db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM contacts WHERE handled = 0) AS contacts_open,
      COALESCE(SUM(status = 'new'), 0) AS new_count,
      COALESCE(SUM(status = 'progress'), 0) AS progress_count,
      COALESCE(SUM(status = 'review'), 0) AS review_count,
      COALESCE(SUM(status = 'done' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now')), 0) AS done_month,
      COALESCE(SUM(CASE WHEN status = 'done' AND strftime('%Y-%m', updated_at) = strftime('%Y-%m', 'now') THEN total_cents END), 0) AS revenue_month_cents
    FROM orders
  `).get() };
}

module.exports = {
  kind: 'sqlite', DATA_DIR, init, close,
  countAdmins, createUser, getUserForLogin, getUser, getPasswordHash, listUsers, updateUser, setPassword, deleteUser,
  createSession, getSessionUser, deleteSession, deleteUserSessions, purgeSessions,
  getDefaultPrices, setDefaultPrices, getUserPrices, setUserPrices,
  createOrder, addAttachment, deleteOrder, getOrder, listOrders, listOpen, updateOrder, markSeen, getAttachment,
  addMessage, listMessages, recentClientMessages,
  createContact, listContacts, setContactHandled, deleteContact, stats,
};
