'use strict';

/*
  Selbsttest: startet den Server mit einer eigenen, leeren Test-Datenbank und prüft Login, Rechte,
  Aufträge, Dateien, Nachrichten und Admin-Funktionen. Deine echten Daten werden nicht angefasst.
    npm run selftest
  - Ohne MONGODB_URI: SQLite in einem Temp-Ordner
  - Mit MONGODB_URI:  Datenbank "<name>_selftest" in deinem Atlas-Cluster, wird danach wieder geleert
*/
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// Vor dem Laden des Servers: Testumgebung setzen
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), 'derpole-selftest-'));
process.env.PORT = process.env.SELFTEST_PORT || '8199';
process.env.HOST = '127.0.0.1';
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = '';
if (process.env.MONGODB_URI) process.env.MONGODB_DB = `${process.env.MONGODB_DB || 'derpole'}_selftest`;
else process.env.DATA_DIR = tmpData;

const repo = require('../src/repo');
const auth = require('../src/auth');
require('../server');

const BASE = `http://127.0.0.1:${process.env.PORT}`;
const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok: !!ok, extra });

function client() {
  let cookie = '';
  return async (url, { method = 'GET', body, form, raw = false } = {}) => {
    const headers = { 'X-Requested-With': 'derpole' };
    if (cookie) headers.Cookie = cookie;
    let payload;
    if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(BASE + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    if (raw) return res;
    let data = null; try { data = await res.json(); } catch { /* leer */ }
    return { status: res.status, data };
  };
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE + '/')).ok) return; } catch { /* startet noch */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server startet nicht');
}

async function run() {
  await waitForServer();
  const adminPw = auth.generatePassword();
  await repo.createUser({ username: 'selftest_admin', display_name: 'Selftest Admin', role: 'admin', password_hash: await auth.hashPassword(adminPw) });

  const a = client();
  const c = client();
  const o = client();
  let r;

  // Sicherheit
  const home = await fetch(BASE + '/');
  check('Sicherheits-Header gesetzt', /script-src 'self'/.test(home.headers.get('content-security-policy') || ''));
  check('Portal ohne Login gesperrt', (await fetch(BASE + '/portal', { redirect: 'manual' })).status === 302);
  check('Anfrage ohne Schutz-Header abgelehnt', (await fetch(BASE + '/api/auth/login', { method: 'POST' })).status === 403);
  r = await a('/api/auth/login', { method: 'POST', body: { username: 'selftest_admin', password: 'falsch' } });
  check('falsches Passwort abgelehnt', r.status === 401);
  r = await a('/api/auth/login', { method: 'POST', body: { username: 'selftest_admin', password: adminPw } });
  check('Admin-Login', r.status === 200 && r.data.role === 'admin');

  // Kunden + Preise
  await a('/api/admin/prices', { method: 'PUT', body: { prices: { emotes: '25', short: '39,50' } } });
  r = await a('/api/admin/users', { method: 'POST', body: { username: 'selftest_kunde', display_name: 'Selftest Kunde', prices: { emotes: { price: '20' }, website: { hidden: true } } } });
  check('Kundenkonto anlegen', r.status === 201);
  const clientPw = r.data.password;
  const r2 = await a('/api/admin/users', { method: 'POST', body: { username: 'selftest_zwei', display_name: 'Zwei' } });
  await c('/api/auth/login', { method: 'POST', body: { username: 'selftest_kunde', password: clientPw } });
  await o('/api/auth/login', { method: 'POST', body: { username: 'selftest_zwei', password: r2.data.password } });
  r = await c('/api/catalog');
  check('eigene Preise und ausgeblendete Dienste', r.data.services.find((s) => s.id === 'emotes')?.price_cents === 2000 && !r.data.services.some((s) => s.id === 'website'));
  check('Kunde ohne Admin-Zugriff', (await c('/api/admin/users')).status === 403);

  // Auftrag mit Dateien
  const form = new FormData();
  form.append('payload', JSON.stringify({ items: [{ key: 0, service: 'emotes', qty: 3, note: 'Test' }, { key: 1, service: 'short', qty: 1 }], deadline: '2030-01-01' }));
  form.append('file_0', new Blob(['PNGDATA']), 'skizze.png');
  r = await c('/api/orders', { method: 'POST', form });
  check('Auftrag mit Anhang anlegen', r.status === 201);
  const orderId = r.data?.id;
  r = await c(`/api/orders/${orderId}`);
  check('Summe vom Server berechnet', r.data?.order?.total_cents === 9950);
  const att = r.data.order.attachments[0];
  const dl = await c(`/api/files/${att.id}`, { raw: true });
  check('Anhang herunterladen', dl.status === 200 && (await dl.text()) === 'PNGDATA');
  check('fremder Kunde sieht Anhang nicht', (await o(`/api/files/${att.id}`, { raw: true })).status === 404);
  const bad = new FormData();
  bad.append('payload', JSON.stringify({ items: [{ key: 0, service: 'emotes', qty: 1 }] }));
  bad.append('file_0', new Blob(['MZ']), 'virus.exe');
  check('.exe abgelehnt', (await c('/api/orders', { method: 'POST', form: bad })).status === 400);

  // Nachrichten + Lieferung
  // Kurz warten: SQLite-Zeit tickt unter Windows nur alle ~15 ms, sonst hätten "gelesen" und "Antwort" denselben Zeitstempel
  await new Promise((resolve) => setTimeout(resolve, 40));
  const msg = new FormData();
  msg.append('body', 'Erster Entwurf');
  msg.append('file', new Blob(['ENTWURF']), 'entwurf.png');
  r = await a(`/api/admin/orders/${orderId}/messages`, { method: 'POST', form: msg });
  check('Admin liefert Datei', r.status === 201);
  r = await c('/api/orders');
  check('Kunde sieht neue Antwort', r.data.orders[0]?.unread === true);
  r = await c(`/api/orders/${orderId}`);
  const deliverable = r.data.messages.find((m) => m.attachments.length)?.attachments[0];
  const dl2 = deliverable && await c(`/api/files/${deliverable.id}`, { raw: true });
  check('Kunde lädt Lieferung', dl2?.status === 200 && (await dl2.text()) === 'ENTWURF');
  r = await a(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'progress' } });
  check('Status ändern', r.data?.order?.status === 'progress');
  check('Storno nach Start gesperrt', (await c(`/api/orders/${orderId}/cancel`, { method: 'POST' })).status === 409);
  r = await a('/api/admin/dashboard');
  check('Admin-Übersicht', r.status === 200 && r.data.next.length === 1);

  // Kontaktformular
  const contact = new FormData();
  contact.append('name', 'Test'); contact.append('email', 'test@example.com'); contact.append('message', 'Hallo'); contact.append('privacy', 'on');
  check('Kontaktformular speichert', (await fetch(BASE + '/api/contact', { method: 'POST', body: contact, headers: { 'X-Requested-With': 'derpole' } })).status === 200);

  // Löschen
  check('Auftrag löschen', (await a(`/api/admin/orders/${orderId}`, { method: 'DELETE' })).status === 200);
  check('Anhang nach Löschen weg', (await a(`/api/files/${att.id}`, { raw: true })).status === 404);
}

async function cleanup() {
  try {
    if (repo.kind === 'mongo') {
      const db = repo.getDb();
      for (const col of await db.listCollections().toArray()) await db.dropCollection(col.name);
    }
    await repo.close();
  } catch { /* egal */ }
  fs.rmSync(tmpData, { recursive: true, force: true });
}

run()
  .catch((err) => check('Testlauf', false, err.message))
  .finally(async () => {
    await cleanup();
    for (const t of results) console.log(`${t.ok ? 'OK   ' : 'FEHLER'}  ${t.name}${t.extra ? `  (${t.extra})` : ''}`);
    const failed = results.filter((t) => !t.ok).length;
    console.log(`\n${results.length - failed}/${results.length} bestanden · Datenbank: ${repo.kind === 'mongo' ? 'MongoDB' : 'SQLite'}`);
    process.exit(failed ? 1 : 0);
  });
