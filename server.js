'use strict';

/*
  DerPole: Website, Kundenportal und Admin-Bereich in einem Prozess.
  Start: npm start   (Einstellungen in .env, siehe .env.example)
*/
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const multer = require('multer');
const repo = require('./src/repo');
const auth = require('./src/auth');
const files = require('./src/files');
const discord = require('./src/discord');
const { SERVICE_IDS, byId, STATUSES } = require('./src/catalog');
const { priceTable, clientView, adminView, messageView } = require('./src/orders');
const { Limiter } = require('./src/limiter');

const PORT = Number(process.env.PORT) || 8130;
const HOST = process.env.HOST || '127.0.0.1';
const PROD = process.env.NODE_ENV === 'production';
const COOKIE = 'dp_session';
const PUBLIC_DIR = path.join(__dirname, 'public');
const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
  ...(process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN.replace(/\/$/, '')] : []),
]);

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1); // hinter dem Proxy von Render

/* ======================================================================
   Sicherheits-Header
   ====================================================================== */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://static-cdn.jtvnw.net https://panels.twitch.tv",
  'frame-src https://www.tiktok.com',
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(PROD ? ['upgrade-insecure-requests'] : []),
].join('; ');

app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  if (PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

/* ======================================================================
   Hilfen
   ====================================================================== */
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* kaputtes Cookie ignorieren */ }
  }
  return out;
}

function setSessionCookie(res, token, maxAge) {
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: PROD, path: '/', maxAge });
}
function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: PROD, path: '/' });
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const intId = (v) => (/^\d{1,9}$/.test(String(v)) ? Number(v) : null);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
// Euro-Betrag (Zahl oder Text mit Komma) in Cent; null = kein Preis
function toCents(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 100000) throw new HttpError(400, 'invalid_price');
  return Math.round(n * 100);
}

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new HttpError(status, code); };

/* ======================================================================
   Session & Schutz vor fremden Seiten
   ====================================================================== */
app.use(ah(async (req, res, next) => {
  req.token = parseCookies(req.headers.cookie)[COOKIE] || null;
  req.user = req.token ? await auth.getSessionUser(req.token) : null;
  next();
}));

// Schreibende API-Aufrufe nur mit eigenem Header und von der eigenen Seite (dazu SameSite=Strict-Cookie)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (req.get('X-Requested-With') !== 'derpole' || (origin && !ALLOWED_ORIGINS.has(origin))) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
});
app.use('/api', express.json({ limit: '64kb' }));

const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'unauthorized' }));
const requireAdmin = (req, res, next) => (req.user?.role === 'admin' ? next() : res.status(req.user ? 403 : 401).json({ error: 'forbidden' }));

/* ======================================================================
   Rate-Limits
   ====================================================================== */
const limits = {
  loginIp: new Limiter({ max: 20, windowMs: 15 * 60e3 }),
  loginUser: new Limiter({ max: 6, windowMs: 15 * 60e3 }), // Fehlversuche pro Konto
  password: new Limiter({ max: 6, windowMs: 15 * 60e3 }),
  contact: new Limiter({ max: 5, windowMs: 60 * 60e3 }),
  orders: new Limiter({ max: 20, windowMs: 60 * 60e3 }),
  messages: new Limiter({ max: 60, windowMs: 60 * 60e3 }),
};
const tooMany = (res, limiter, key) => res.status(429).set('Retry-After', String(limiter.retryAfter(key))).json({ error: 'too_many' });
const limitBy = (limiter, keyFn) => (req, res, next) => (limiter.hit(keyFn(req)) ? next() : tooMany(res, limiter, keyFn(req)));

/* ======================================================================
   Seiten: Portal und Admin nur mit Login
   ====================================================================== */
const page = (name) => path.join(PUBLIC_DIR, name);
app.get(['/login', '/login.html'], (req, res) => {
  if (req.user) return res.redirect(req.user.role === 'admin' ? '/admin' : '/portal');
  res.sendFile(page('login.html'));
});
app.get(['/portal', '/portal.html'], (req, res) => {
  if (!req.user) return res.redirect('/login');
  res.set('Cache-Control', 'no-store').sendFile(page('portal.html'));
});
app.get(['/admin', '/admin.html'], (req, res) => {
  if (req.user?.role !== 'admin') return res.redirect(req.user ? '/portal' : '/login');
  res.set('Cache-Control', 'no-store').sendFile(page('admin.html'));
});
app.use(express.static(PUBLIC_DIR, { dotfiles: 'deny', index: 'index.html' }));

/* ======================================================================
   Login & eigenes Konto
   ====================================================================== */
app.post('/api/auth/login', ah(async (req, res) => {
  const username = str(req.body?.username, 64);
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 200) : '';
  const userKey = username.toLowerCase();
  if (!limits.loginIp.hit(req.ip)) return tooMany(res, limits.loginIp, req.ip);
  if (limits.loginUser.blocked(userKey)) return tooMany(res, limits.loginUser, userKey);

  const user = username && password ? await repo.getUserForLogin(username) : null;
  let ok = false;
  if (user && user.active) ok = await auth.verifyPassword(password, user.password_hash);
  else await auth.burnTime(password || 'x');

  if (!ok) {
    limits.loginUser.hit(userKey);
    return res.status(401).json({ error: 'invalid' });
  }
  limits.loginUser.reset(userKey);
  if (req.token) await auth.deleteSession(req.token);
  const { token, maxAge } = await auth.createSession(user.id);
  setSessionCookie(res, token, maxAge);
  res.json({ role: user.role });
}));

app.post('/api/auth/logout', ah(async (req, res) => {
  await auth.deleteSession(req.token);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

app.get('/api/me', requireUser, (req, res) => {
  const { id, username, display_name, role, discord: dc } = req.user;
  res.json({ user: { id, username, display_name, role, discord: dc } });
});

app.post('/api/me/password', requireUser, limitBy(limits.password, (req) => `pw:${req.user.id}`), ah(async (req, res) => {
  const current = typeof req.body?.current === 'string' ? req.body.current.slice(0, 200) : '';
  const next = typeof req.body?.next === 'string' ? req.body.next : '';
  if (next.length < 10 || next.length > 200) fail(400, 'weak_password');
  if (!(await auth.verifyPassword(current, await repo.getPasswordHash(req.user.id)))) fail(400, 'wrong_password');
  await repo.setPassword(req.user.id, await auth.hashPassword(next));
  await auth.deleteUserSessions(req.user.id, req.token); // andere Geräte abmelden
  res.json({ ok: true });
}));

/* ======================================================================
   Uploads
   ====================================================================== */
const ALLOWED_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'psd', 'ai', 'pdf', 'txt', 'md', 'pgn',
  'mp4', 'mov', 'webm', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'zip', '7z', 'ttf', 'otf', 'woff2',
]);
const MAX_ITEMS = 20;
const MAX_FILE_MB = Number(process.env.MAX_FILE_MB) || 25;

function makeUpload({ field, maxFiles }) {
  return multer({
    storage: multer.diskStorage({
      destination: files.TMP_DIR,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex')),
    }),
    limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: maxFiles, fields: 4, fieldSize: 200 * 1024, parts: maxFiles + 6 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      if (!field.test(file.fieldname)) return cb(new HttpError(400, 'bad_field'));
      if (!ALLOWED_EXT.has(ext)) return cb(new HttpError(400, 'file_type'));
      cb(null, true);
    },
  }).any();
}
const orderUpload = makeUpload({ field: /^file_(general|\d{1,2})$/, maxFiles: 15 });
const messageUpload = makeUpload({ field: /^file$/, maxFiles: 10 });

// Dateinamen aufräumen (multer liefert latin1)
function cleanName(name) {
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return path.basename(utf8).replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_').slice(-120) || 'datei';
}

async function storeUpload(orderId, f, link) {
  const original_name = cleanName(f.originalname);
  const mime = String(f.mimetype || '').slice(0, 100);
  const stored = await files.store(orderId, f.path, { filename: original_name, mime });
  return repo.addAttachment({ order_id: orderId, ...link, original_name, stored_name: stored, size: f.size, mime });
}

// Nicht übernommene Zwischendateien (z. B. nach einem Fehler) aufräumen
const cleanupTemp = (req) => files.removeTemp((req.files || []).map((f) => f.path).filter((p) => fs.existsSync(p)));

/* ======================================================================
   Kundenportal
   ====================================================================== */
app.get('/api/catalog', requireUser, ah(async (req, res) => {
  const table = await priceTable(req.user.id);
  res.json({
    services: table.filter((s) => !s.hidden).map(({ id, cat, icon, name, unit, price_cents }) => ({ id, cat, icon, name, unit, price_cents })),
  });
}));

app.get('/api/orders', requireUser, ah(async (req, res) => {
  res.json({ orders: (await repo.listOrders({ userId: req.user.id })).map(clientView) });
}));

// Eigener Auftrag oder 404 (fremde Aufträge sind nicht von "gibt es nicht" zu unterscheiden)
async function ownOrder(req) {
  const id = intId(req.params.id);
  const order = id && (await repo.getOrder(id));
  if (!order || order.user_id !== req.user.id) fail(404, 'not_found');
  return order;
}

app.get('/api/orders/:id', requireUser, ah(async (req, res) => {
  const order = await ownOrder(req);
  await repo.markSeen(order.id, 'client');
  res.json({ order: clientView(order), messages: (await repo.listMessages(order.id)).map(messageView) });
}));

app.post('/api/orders', requireUser, limitBy(limits.orders, (req) => `o:${req.user.id}`), orderUpload, ah(async (req, res) => {
  try {
    let payload;
    try { payload = JSON.parse(req.body?.payload || ''); } catch { fail(400, 'bad_payload'); }
    if (!payload || !Array.isArray(payload.items) || !payload.items.length || payload.items.length > MAX_ITEMS) fail(400, 'no_items');

    const prices = new Map((await priceTable(req.user.id)).filter((s) => !s.hidden).map((s) => [s.id, s.price_cents]));
    const keys = new Set();
    const items = payload.items.map((it) => {
      const key = Number(it?.key);
      const qty = Number(it?.qty);
      if (!Number.isInteger(key) || key < 0 || key >= MAX_ITEMS || keys.has(key)) fail(400, 'bad_item');
      if (!SERVICE_IDS.has(it.service) || !prices.has(it.service)) fail(400, 'bad_service');
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) fail(400, 'bad_qty');
      keys.add(key);
      // Preis kommt immer vom Server, nie vom Browser
      return { key, service_id: it.service, qty, unit_price_cents: prices.get(it.service), note: str(it.note, 1000) || null };
    });

    const deadline = payload.deadline ? String(payload.deadline) : null;
    if (deadline && !isDate(deadline)) fail(400, 'bad_deadline');
    for (const f of req.files || []) {
      const k = f.fieldname.slice(5);
      if (k !== 'general' && !keys.has(Number(k))) fail(400, 'bad_field');
    }

    const allPriced = items.every((it) => it.unit_price_cents != null);
    const total = allPriced ? items.reduce((sum, it) => sum + it.unit_price_cents * it.qty, 0) : null;
    const { id, itemIds } = await repo.createOrder({
      user_id: req.user.id, deadline, total_cents: total, items,
      message: str(payload.message, 5000) || null,
      links: str(payload.links, 2000) || null,
    });
    const itemIdByKey = new Map(items.map((it, i) => [it.key, itemIds[i]]));
    for (const f of req.files || []) {
      const k = f.fieldname.slice(5);
      await storeUpload(id, f, { item_id: k === 'general' ? null : itemIdByKey.get(Number(k)) });
    }

    const order = await repo.getOrder(id);
    const sent = await discord.sendOrder(order);
    if (sent) await repo.updateOrder(id, { discord_channel: sent.channelId, discord_message: sent.messageId });
    console.log(`Neuer Auftrag #${id} von ${req.user.username}`);
    res.status(201).json({ id });
  } finally {
    await cleanupTemp(req);
  }
}));

// Nachricht (optional mit Dateien) zu einem Auftrag – für Kunde und Admin
async function postMessage(req, res, order, role) {
  try {
    const body = str(req.body?.body, 4000);
    if (!body && !(req.files || []).length) fail(400, 'empty');
    const messageId = await repo.addMessage({ order_id: order.id, author_id: req.user.id, author_role: role, body: body || null });
    for (const f of req.files || []) await storeUpload(order.id, f, { message_id: messageId });
    await repo.markSeen(order.id, role);
    res.status(201).json({ messages: (await repo.listMessages(order.id)).map(messageView) });
  } finally {
    await cleanupTemp(req);
  }
}

app.post('/api/orders/:id/messages', requireUser, limitBy(limits.messages, (req) => `m:${req.user.id}`), messageUpload, ah(async (req, res) => {
  const order = await ownOrder(req).catch(async (err) => { await cleanupTemp(req); throw err; });
  await postMessage(req, res, order, 'client');
}));

// Kunde kann eine Anfrage zurückziehen, solange noch nicht angefangen wurde
app.post('/api/orders/:id/cancel', requireUser, ah(async (req, res) => {
  const order = await ownOrder(req);
  if (order.status !== 'new') fail(409, 'not_cancellable');
  await setStatus(order.id, 'cancelled');
  res.json({ ok: true });
}));

// Anhänge nur für den eigenen Auftrag oder den Admin, immer als Download
app.get('/api/files/:id', requireUser, ah(async (req, res) => {
  const id = intId(req.params.id);
  const att = id && (await repo.getAttachment(id));
  if (!att || (req.user.role !== 'admin' && att.user_id !== req.user.id)) return res.status(404).json({ error: 'not_found' });
  const stream = files.openStream(att.order_id, att.stored_name);
  stream.on('error', () => { if (!res.headersSent) res.status(404).json({ error: 'not_found' }); else res.destroy(); });
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(att.original_name)}`,
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  stream.pipe(res);
}));

/* ======================================================================
   Kontaktformular der Startseite
   ====================================================================== */
const contactForm = multer({ limits: { fields: 30, fieldSize: 10 * 1024, files: 0, parts: 40 } }).none();
app.post('/api/contact', limitBy(limits.contact, (req) => req.ip), contactForm, ah(async (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 100);
  const email = str(b.email, 200);
  const message = str(b.message, 5000);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !b.privacy) fail(400, 'invalid');
  const services = [].concat(b.services || []).map((s) => (s === 'other' ? 'Was anderes' : byId(s)?.name.de)).filter(Boolean).join(', ');
  const deadline = isDate(String(b.deadline || '')) ? b.deadline : null;
  const contact = { name, email, message, services: services || null, budget: str(b.budget, 40) || null, deadline };
  await repo.createContact(contact);
  if (discord.enabled()) discord.sendContact(contact);
  res.json({ ok: true });
}));

/* ======================================================================
   Admin
   ====================================================================== */
const admin = express.Router();
admin.use(requireAdmin);

async function setStatus(id, status) {
  if (!STATUSES.includes(status)) return null;
  const before = await repo.getOrder(id);
  if (!before) return null;
  if (before.status !== status) {
    await repo.updateOrder(id, { status });
    await repo.addMessage({ order_id: id, author_role: 'system', body: `status:${status}` });
  }
  const order = await repo.getOrder(id);
  discord.updateOrder(order);
  return order;
}

admin.get('/dashboard', ah(async (req, res) => {
  const [stats, open, recent] = await Promise.all([repo.stats(), repo.listOpen(), repo.recentClientMessages(6)]);
  res.json({ stats, next: open.slice(0, 8).map(adminView), recent });
}));

admin.get('/stats', ah(async (req, res) => res.json(await repo.stats())));

/* ---------- Aufträge ---------- */
admin.get('/orders', ah(async (req, res) => {
  const filter = String(req.query.status || 'open');
  const statuses = filter === 'open' ? ['new', 'progress', 'review'] : STATUSES.includes(filter) ? [filter] : null;
  res.json({ orders: (await repo.listOrders({ statuses, userId: intId(req.query.user), q: str(req.query.q, 60) })).map(adminView) });
}));

admin.get('/orders/:id', ah(async (req, res) => {
  const order = await repo.getOrder(intId(req.params.id));
  if (!order) fail(404, 'not_found');
  await repo.markSeen(order.id, 'admin');
  res.json({ order: adminView(order), messages: (await repo.listMessages(order.id)).map(messageView) });
}));

admin.patch('/orders/:id', ah(async (req, res) => {
  const id = intId(req.params.id);
  if (!id || !(await repo.getOrder(id))) fail(404, 'not_found');
  const fields = {};
  if ('admin_note' in req.body) fields.admin_note = str(req.body.admin_note, 4000) || null;
  if ('total' in req.body) fields.total_cents = toCents(req.body.total);
  if ('status' in req.body && !STATUSES.includes(req.body.status)) fail(400, 'bad_status');
  await repo.updateOrder(id, fields);
  const order = 'status' in req.body ? await setStatus(id, req.body.status) : await repo.getOrder(id);
  if (!('status' in req.body)) discord.updateOrder(order);
  res.json({ order: adminView(order) });
}));

admin.post('/orders/:id/messages', limitBy(limits.messages, (req) => `m:${req.user.id}`), messageUpload, ah(async (req, res) => {
  const order = await repo.getOrder(intId(req.params.id));
  if (!order) { await cleanupTemp(req); fail(404, 'not_found'); }
  await postMessage(req, res, order, 'admin');
}));

admin.delete('/orders/:id', ah(async (req, res) => {
  const id = intId(req.params.id);
  if (!id || !(await repo.getOrder(id))) fail(404, 'not_found');
  await repo.deleteOrder(id);
  await files.removeOrder(id);
  res.json({ ok: true });
}));

/* ---------- Kunden ---------- */
admin.get('/users', ah(async (req, res) => res.json({ users: await repo.listUsers() })));

admin.get('/users/:id', ah(async (req, res) => {
  const user = await repo.getUser(intId(req.params.id));
  if (!user) fail(404, 'not_found');
  res.json({ user, prices: await priceTable(user.id) });
}));

// Preise eines Kontos: { serviceId: { price: Euro|null, hidden: bool } }
function parseUserPrices(input) {
  const out = {};
  for (const [id, p] of Object.entries(input || {})) {
    if (!SERVICE_IDS.has(id)) continue;
    out[id] = { price_cents: toCents(p?.price), hidden: !!p?.hidden };
  }
  return out;
}

admin.post('/users', ah(async (req, res) => {
  const username = str(req.body?.username, 32);
  const display_name = str(req.body?.display_name, 60);
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) fail(400, 'bad_username');
  if (!display_name) fail(400, 'bad_name');
  if (await repo.getUserForLogin(username)) fail(409, 'username_taken');
  const prices = parseUserPrices(req.body?.prices);
  const password = auth.generatePassword();
  const id = await repo.createUser({
    username, display_name, role: 'client',
    password_hash: await auth.hashPassword(password),
    discord: str(req.body?.discord, 60) || null,
    notes: str(req.body?.notes, 2000) || null,
  });
  if (Object.keys(prices).length) await repo.setUserPrices(id, prices);
  // Das Passwort gibt es genau einmal, gespeichert wird nur der Hash
  res.status(201).json({ id, username, password });
}));

async function clientAccount(req) {
  const id = intId(req.params.id);
  const user = id && (await repo.getUser(id));
  if (!user) fail(404, 'not_found');
  if (user.id === req.user.id || user.role !== 'client') fail(400, 'self');
  return user;
}

admin.patch('/users/:id', ah(async (req, res) => {
  const user = await clientAccount(req);
  const fields = {};
  if ('display_name' in req.body) { fields.display_name = str(req.body.display_name, 60); if (!fields.display_name) fail(400, 'bad_name'); }
  if ('discord' in req.body) fields.discord = str(req.body.discord, 60) || null;
  if ('notes' in req.body) fields.notes = str(req.body.notes, 2000) || null;
  if ('active' in req.body) fields.active = req.body.active ? 1 : 0;
  await repo.updateUser(user.id, fields);
  if (fields.active === 0) await auth.deleteUserSessions(user.id);
  res.json({ ok: true });
}));

admin.put('/users/:id/prices', ah(async (req, res) => {
  const user = await clientAccount(req);
  await repo.setUserPrices(user.id, parseUserPrices(req.body?.prices));
  res.json({ prices: await priceTable(user.id) });
}));

admin.post('/users/:id/password', ah(async (req, res) => {
  const user = await clientAccount(req);
  const password = auth.generatePassword();
  await repo.setPassword(user.id, await auth.hashPassword(password));
  await auth.deleteUserSessions(user.id);
  res.json({ username: user.username, password });
}));

admin.delete('/users/:id', ah(async (req, res) => {
  const user = await clientAccount(req);
  const orderIds = await repo.deleteUser(user.id);
  for (const id of orderIds) await files.removeOrder(id);
  res.json({ ok: true, deleted_orders: orderIds.length });
}));

/* ---------- Preise ---------- */
admin.get('/prices', ah(async (req, res) => res.json({ prices: await priceTable(null) })));

admin.put('/prices', ah(async (req, res) => {
  const out = {};
  for (const [id, v] of Object.entries(req.body?.prices || {})) if (SERVICE_IDS.has(id)) out[id] = toCents(v);
  await repo.setDefaultPrices(out);
  res.json({ prices: await priceTable(null) });
}));

/* ---------- Website-Anfragen ---------- */
admin.get('/contacts', ah(async (req, res) => {
  const filter = String(req.query.filter || 'open');
  res.json({ contacts: await repo.listContacts({ handled: filter === 'all' ? null : filter === 'done' }) });
}));

admin.patch('/contacts/:id', ah(async (req, res) => {
  const id = intId(req.params.id);
  if (!id || !(await repo.setContactHandled(id, !!req.body?.handled))) fail(404, 'not_found');
  res.json({ ok: true });
}));

admin.delete('/contacts/:id', ah(async (req, res) => {
  const id = intId(req.params.id);
  if (!id || !(await repo.deleteContact(id))) fail(404, 'not_found');
  res.json({ ok: true });
}));

app.use('/api/admin', admin);

/* ======================================================================
   Fehler
   ====================================================================== */
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
  if (err instanceof multer.MulterError) {
    const code = err.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : err.code === 'LIMIT_FILE_COUNT' ? 'too_many_files' : 'bad_upload';
    return res.status(400).json({ error: code });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

/* ======================================================================
   Start
   ====================================================================== */
// Erstes Admin-Konto aus der Umgebung anlegen (Render Free hat keine Konsole).
// Greift nur, solange es noch keinen Admin gibt; im Env steht nur der Hash, nie das Passwort.
async function ensureAdmin() {
  const name = (process.env.ADMIN_USERNAME || '').trim();
  const hash = (process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (!name || !hash || (await repo.countAdmins())) return;
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(name) || !/^scrypt\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(hash)) {
    console.error('ADMIN_USERNAME oder ADMIN_PASSWORD_HASH ist ungültig, es wurde kein Admin angelegt.');
    return;
  }
  if (await repo.getUserForLogin(name)) {
    console.error(`"${name}" gibt es schon als Kundenkonto, es wurde kein Admin angelegt.`);
    return;
  }
  await repo.createUser({ username: name, display_name: name, password_hash: hash, role: 'admin' });
  console.log(`Admin-Konto "${name}" angelegt.`);
}

(async () => {
  await repo.init();
  await ensureAdmin();
  setInterval(() => repo.purgeSessions().catch(() => {}), 60 * 60e3).unref();
  discord.start({ setStatus, listOpen: () => repo.listOpen(), getOrder: (id) => repo.getOrder(id) });
  app.listen(PORT, HOST, async () => {
    console.log(`DerPole läuft auf http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT} (Daten: ${repo.kind === 'mongo' ? 'MongoDB' : 'lokal, SQLite'})`);
    if (!(await repo.countAdmins())) console.log('Noch kein Admin-Konto. ADMIN_USERNAME + ADMIN_PASSWORD_HASH setzen oder:  npm run create-admin -- <benutzername>');
  });
})().catch((err) => {
  console.error('Start fehlgeschlagen:', err.message);
  process.exit(1);
});
