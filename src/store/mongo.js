'use strict';

/*
  Datenspeicher für Render + MongoDB Atlas (Free/M0).
  Gleiche Schnittstelle wie src/store/sqlite.js. Aktiv, sobald MONGODB_URI gesetzt ist.
  IDs bleiben fortlaufende Zahlen (Zähler-Collection), damit Auftragsnummern wie #12 funktionieren.
*/
const { MongoClient } = require('mongodb');

let client = null;
let db = null;
let c = {}; // Collections

// Datum im selben Format wie SQLite: "YYYY-MM-DD HH:MM:SS.mmm" (UTC), Millisekunden für "gelesen"-Vergleiche
const ts = (d) => (d ? new Date(d).toISOString().slice(0, 23).replace('T', ' ') : null);
const OPEN = ['new', 'progress', 'review'];

async function nextId(name) {
  const r = await c.counters.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return r.seq;
}

async function init() {
  if (db) return;
  client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 15000 });
  await client.connect();
  db = client.db(process.env.MONGODB_DB || undefined);
  for (const name of ['counters', 'users', 'sessions', 'default_prices', 'user_prices', 'orders', 'messages', 'attachments', 'contacts']) {
    c[name] = db.collection(name);
  }
  await Promise.all([
    c.users.createIndex({ username_lower: 1 }, { unique: true }),
    c.sessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }), // abgelaufene Sessions löscht MongoDB selbst
    c.sessions.createIndex({ user_id: 1 }),
    c.user_prices.createIndex({ user_id: 1, service_id: 1 }, { unique: true }),
    c.orders.createIndex({ user_id: 1 }),
    c.orders.createIndex({ status: 1 }),
    c.messages.createIndex({ order_id: 1 }),
    c.attachments.createIndex({ order_id: 1 }),
  ]);
}

async function close() {
  if (client) { await client.close(); client = null; db = null; c = {}; }
}

function getDb() { return db; }

/* ---------- Benutzer ---------- */
const userOut = (u) => (u ? {
  id: u._id, username: u.username, display_name: u.display_name, role: u.role,
  discord: u.discord ?? null, notes: u.notes ?? null, active: u.active ? 1 : 0, created_at: ts(u.created_at),
} : null);

async function countAdmins() {
  return c.users.countDocuments({ role: 'admin', active: true });
}

async function createUser({ username, display_name, password_hash, role, discord = null, notes = null }) {
  const id = await nextId('users');
  await c.users.insertOne({
    _id: id, username, username_lower: username.toLowerCase(), display_name, password_hash, role,
    discord, notes, active: true, created_at: new Date(),
  });
  return id;
}

async function getUserForLogin(username) {
  const u = await c.users.findOne({ username_lower: String(username).toLowerCase() });
  return u ? { id: u._id, username: u.username, password_hash: u.password_hash, role: u.role, active: u.active ? 1 : 0 } : null;
}

async function getUser(id) {
  return userOut(await c.users.findOne({ _id: id }));
}

async function getPasswordHash(id) {
  return (await c.users.findOne({ _id: id }, { projection: { password_hash: 1 } }))?.password_hash ?? null;
}

async function listUsers() {
  const users = await c.users.find({}).sort({ display_name: 1 }).toArray();
  const counts = await c.orders.aggregate([
    { $group: { _id: '$user_id', order_count: { $sum: 1 }, open_count: { $sum: { $cond: [{ $in: ['$status', OPEN] }, 1, 0] } } } },
  ]).toArray();
  const byUser = new Map(counts.map((x) => [x._id, x]));
  return users
    .map((u) => ({ ...userOut(u), order_count: byUser.get(u._id)?.order_count || 0, open_count: byUser.get(u._id)?.open_count || 0 }))
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'admin' ? -1 : 1));
}

async function updateUser(id, fields) {
  const set = {};
  for (const k of ['display_name', 'discord', 'notes']) if (k in fields) set[k] = fields[k];
  if ('active' in fields) set.active = !!fields.active;
  if (Object.keys(set).length) await c.users.updateOne({ _id: id }, { $set: set });
}

async function setPassword(id, password_hash) {
  await c.users.updateOne({ _id: id }, { $set: { password_hash } });
}

async function deleteOrdersWhere(filter) {
  const ids = (await c.orders.find(filter, { projection: { _id: 1 } }).toArray()).map((o) => o._id);
  if (ids.length) {
    await Promise.all([
      c.messages.deleteMany({ order_id: { $in: ids } }),
      c.attachments.deleteMany({ order_id: { $in: ids } }),
      c.orders.deleteMany({ _id: { $in: ids } }),
    ]);
  }
  return ids;
}

async function deleteUser(id) {
  const orderIds = await deleteOrdersWhere({ user_id: id });
  await Promise.all([c.sessions.deleteMany({ user_id: id }), c.user_prices.deleteMany({ user_id: id }), c.users.deleteOne({ _id: id })]);
  return orderIds;
}

/* ---------- Sessions ---------- */
async function createSession(tokenHash, userId, expiresAt) {
  await c.sessions.insertOne({ _id: tokenHash, user_id: userId, expires_at: new Date(expiresAt), created_at: new Date() });
}

async function getSessionUser(tokenHash) {
  const s = await c.sessions.findOne({ _id: tokenHash, expires_at: { $gt: new Date() } });
  if (!s) return null;
  const u = await c.users.findOne({ _id: s.user_id, active: true });
  return u ? { id: u._id, username: u.username, display_name: u.display_name, role: u.role, discord: u.discord ?? null } : null;
}

async function deleteSession(tokenHash) {
  await c.sessions.deleteOne({ _id: tokenHash });
}

async function deleteUserSessions(userId, exceptHash = null) {
  await c.sessions.deleteMany(exceptHash ? { user_id: userId, _id: { $ne: exceptHash } } : { user_id: userId });
}

async function purgeSessions() {
  await c.sessions.deleteMany({ expires_at: { $lte: new Date() } });
}

/* ---------- Preise ---------- */
async function getDefaultPrices() {
  return new Map((await c.default_prices.find({}).toArray()).map((p) => [p._id, p.price_cents ?? null]));
}

async function setDefaultPrices(prices) {
  const ops = Object.entries(prices).map(([id, cents]) => ({ updateOne: { filter: { _id: id }, update: { $set: { price_cents: cents } }, upsert: true } }));
  if (ops.length) await c.default_prices.bulkWrite(ops);
}

async function getUserPrices(userId) {
  return new Map((await c.user_prices.find({ user_id: userId }).toArray())
    .map((p) => [p.service_id, { price_cents: p.price_cents ?? null, hidden: !!p.hidden }]));
}

async function setUserPrices(userId, prices) {
  const ops = Object.entries(prices).map(([id, p]) => ({
    updateOne: { filter: { user_id: userId, service_id: id }, update: { $set: { price_cents: p.price_cents, hidden: !!p.hidden } }, upsert: true },
  }));
  if (ops.length) await c.user_prices.bulkWrite(ops);
}

/* ---------- Aufträge ---------- */
async function decorate(orders) {
  if (!orders.length) return [];
  const ids = orders.map((o) => o._id);
  const userIds = [...new Set(orders.map((o) => o.user_id))];
  const [users, atts, msgStats] = await Promise.all([
    c.users.find({ _id: { $in: userIds } }).toArray(),
    c.attachments.find({ order_id: { $in: ids }, message_id: null }).sort({ _id: 1 }).toArray(),
    c.messages.aggregate([
      { $match: { order_id: { $in: ids } } },
      { $group: {
        _id: '$order_id',
        last_client: { $max: { $cond: [{ $eq: ['$author_role', 'client'] }, '$created_at', null] } },
        last_admin: { $max: { $cond: [{ $in: ['$author_role', ['admin', 'system']] }, '$created_at', null] } },
        count: { $sum: { $cond: [{ $ne: ['$author_role', 'system'] }, 1, 0] } },
      } },
    ]).toArray(),
  ]);
  const userById = new Map(users.map((u) => [u._id, u]));
  const statsById = new Map(msgStats.map((s) => [s._id, s]));
  return orders.map((o) => {
    const u = userById.get(o.user_id) || {};
    const s = statsById.get(o._id) || {};
    return {
      id: o._id, user_id: o.user_id, status: o.status, deadline: o.deadline ?? null, message: o.message ?? null,
      links: o.links ?? null, total_cents: o.total_cents ?? null, admin_note: o.admin_note ?? null,
      discord_channel: o.discord_channel ?? null, discord_message: o.discord_message ?? null,
      created_at: ts(o.created_at), updated_at: ts(o.updated_at),
      client_seen_at: ts(o.client_seen_at), admin_seen_at: ts(o.admin_seen_at),
      username: u.username, display_name: u.display_name, user_discord: u.discord ?? null,
      last_client_msg_at: ts(s.last_client), last_admin_msg_at: ts(s.last_admin), message_count: s.count || 0,
      items: o.items || [],
      attachments: atts.filter((a) => a.order_id === o._id).map(attOut),
    };
  });
}

const attOut = (a) => ({
  id: a._id, item_id: a.item_id ?? null, message_id: a.message_id ?? null,
  original_name: a.original_name, stored_name: a.stored_name, size: a.size, mime: a.mime ?? null,
});

async function createOrder({ user_id, deadline, message, links, total_cents, items }) {
  const id = await nextId('orders');
  const withIds = [];
  for (const it of items) {
    withIds.push({ id: await nextId('items'), service_id: it.service_id, qty: it.qty, unit_price_cents: it.unit_price_cents, note: it.note });
  }
  const now = new Date();
  await c.orders.insertOne({
    _id: id, user_id, status: 'new', deadline, message, links, total_cents, admin_note: null,
    created_at: now, updated_at: now, client_seen_at: now, admin_seen_at: null, items: withIds,
  });
  return { id, itemIds: withIds.map((it) => it.id) };
}

async function addAttachment({ order_id, item_id = null, message_id = null, original_name, stored_name, size, mime }) {
  const id = await nextId('attachments');
  await c.attachments.insertOne({ _id: id, order_id, item_id, message_id, original_name, stored_name, size, mime });
  return id;
}

async function deleteOrder(id) {
  await deleteOrdersWhere({ _id: id });
}

async function getOrder(id) {
  const o = await c.orders.findOne({ _id: id });
  return o ? (await decorate([o]))[0] : null;
}

async function listOrders({ userId = null, statuses = null, q = '' } = {}) {
  const filter = {};
  if (userId) filter.user_id = userId;
  if (statuses?.length) filter.status = { $in: statuses };
  if (q) {
    const num = /^#?(\d{1,9})$/.exec(q);
    if (num) filter._id = Number(num[1]);
    else {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const ids = (await c.users.find({ $or: [{ display_name: rx }, { username: rx }] }, { projection: { _id: 1 } }).toArray()).map((u) => u._id);
      filter.user_id = userId ? (ids.includes(userId) ? userId : -1) : { $in: ids };
    }
  }
  return decorate(await c.orders.find(filter).sort({ _id: -1 }).limit(500).toArray());
}

async function listOpen() {
  const list = await decorate(await c.orders.find({ status: { $in: OPEN } }).toArray());
  return list.sort((a, b) => (a.deadline === b.deadline ? a.id - b.id : !a.deadline ? 1 : !b.deadline ? -1 : a.deadline < b.deadline ? -1 : 1));
}

async function updateOrder(id, fields) {
  const set = {};
  for (const k of ['status', 'admin_note', 'total_cents', 'discord_channel', 'discord_message']) if (k in fields) set[k] = fields[k];
  if (!Object.keys(set).length) return;
  set.updated_at = new Date();
  await c.orders.updateOne({ _id: id }, { $set: set });
}

async function markSeen(orderId, role) {
  await c.orders.updateOne({ _id: orderId }, { $set: { [role === 'admin' ? 'admin_seen_at' : 'client_seen_at']: new Date() } });
}

async function getAttachment(id) {
  const a = await c.attachments.findOne({ _id: id });
  if (!a) return null;
  const o = await c.orders.findOne({ _id: a.order_id }, { projection: { user_id: 1 } });
  return o ? { ...attOut(a), order_id: a.order_id, user_id: o.user_id } : null;
}

/* ---------- Nachrichten ---------- */
async function addMessage({ order_id, author_id = null, author_role, body = null }) {
  const id = await nextId('messages');
  await c.messages.insertOne({ _id: id, order_id, author_id, author_role, body, created_at: new Date() });
  return id;
}

async function listMessages(orderId) {
  const [msgs, atts] = await Promise.all([
    c.messages.find({ order_id: orderId }).sort({ _id: 1 }).toArray(),
    c.attachments.find({ order_id: orderId, message_id: { $ne: null } }).sort({ _id: 1 }).toArray(),
  ]);
  const authors = new Map((await c.users.find({ _id: { $in: [...new Set(msgs.map((m) => m.author_id).filter(Boolean))] } }).toArray())
    .map((u) => [u._id, u.display_name]));
  return msgs.map((m) => ({
    id: m._id, order_id: m.order_id, author_id: m.author_id ?? null, author_role: m.author_role, body: m.body ?? null,
    created_at: ts(m.created_at), author_name: authors.get(m.author_id) ?? null,
    attachments: atts.filter((a) => a.message_id === m._id).map(attOut),
  }));
}

async function recentClientMessages(limit = 8) {
  const msgs = await c.messages.find({ author_role: 'client' }).sort({ _id: -1 }).limit(limit).toArray();
  const orders = new Map((await c.orders.find({ _id: { $in: msgs.map((m) => m.order_id) } }).toArray()).map((o) => [o._id, o]));
  const users = new Map((await c.users.find({ _id: { $in: [...orders.values()].map((o) => o.user_id) } }).toArray()).map((u) => [u._id, u]));
  return msgs.map((m) => ({
    id: m._id, order_id: m.order_id, body: m.body ?? null, created_at: ts(m.created_at),
    display_name: users.get(orders.get(m.order_id)?.user_id)?.display_name ?? '?',
  }));
}

/* ---------- Website-Anfragen ---------- */
const contactOut = (x) => ({ id: x._id, name: x.name, email: x.email, services: x.services ?? null, budget: x.budget ?? null, deadline: x.deadline ?? null, message: x.message, handled: x.handled ? 1 : 0, created_at: ts(x.created_at) });

async function createContact({ name, email, services, budget, deadline, message }) {
  const id = await nextId('contacts');
  await c.contacts.insertOne({ _id: id, name, email, services, budget, deadline, message, handled: false, created_at: new Date() });
  return id;
}

async function listContacts({ handled = null } = {}) {
  const filter = handled === null ? {} : { handled: !!handled };
  return (await c.contacts.find(filter).sort({ _id: -1 }).limit(500).toArray()).map(contactOut);
}

async function setContactHandled(id, handled) {
  return (await c.contacts.updateOne({ _id: id }, { $set: { handled: !!handled } })).matchedCount > 0;
}

async function deleteContact(id) {
  return (await c.contacts.deleteOne({ _id: id })).deletedCount > 0;
}

async function stats() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [contacts_open, byStatus, doneMonth] = await Promise.all([
    c.contacts.countDocuments({ handled: false }),
    c.orders.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray(),
    c.orders.aggregate([
      { $match: { status: 'done', updated_at: { $gte: monthStart } } },
      { $group: { _id: null, n: { $sum: 1 }, cents: { $sum: { $ifNull: ['$total_cents', 0] } } } },
    ]).toArray(),
  ]);
  const count = (s) => byStatus.find((x) => x._id === s)?.n || 0;
  return {
    contacts_open, new_count: count('new'), progress_count: count('progress'), review_count: count('review'),
    done_month: doneMonth[0]?.n || 0, revenue_month_cents: doneMonth[0]?.cents || 0,
  };
}

module.exports = {
  kind: 'mongo', DATA_DIR: null, init, close, getDb,
  countAdmins, createUser, getUserForLogin, getUser, getPasswordHash, listUsers, updateUser, setPassword, deleteUser,
  createSession, getSessionUser, deleteSession, deleteUserSessions, purgeSessions,
  getDefaultPrices, setDefaultPrices, getUserPrices, setUserPrices,
  createOrder, addAttachment, deleteOrder, getOrder, listOrders, listOpen, updateOrder, markSeen, getAttachment,
  addMessage, listMessages, recentClientMessages,
  createContact, listContacts, setContactHandled, deleteContact, stats,
};
