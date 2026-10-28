'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const repo = require('./repo');

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;
const SESSION_MS = 14 * 864e5;

/* ---------- Passwörter (scrypt mit eigenem Salt pro Passwort) ---------- */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifyPassword(password, stored) {
  const [alg, n, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { ...SCRYPT, N: Number(n) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Für unbekannte Benutzernamen trotzdem rechnen, damit die Antwortzeit nichts verrät
let dummyHash = null;
async function burnTime(password) {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(12).toString('hex'));
  await verifyPassword(password, dummyHash);
}

// Lesbares Zufallspasswort ohne verwechselbare Zeichen (0/O, 1/l/I)
function generatePassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

/* ---------- Sessions: im Cookie steht ein Zufallstoken, gespeichert wird nur sein Hash ---------- */
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await repo.createSession(sha256(token), userId, Date.now() + SESSION_MS);
  return { token, maxAge: SESSION_MS };
}

async function getSessionUser(token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  return repo.getSessionUser(sha256(token));
}

async function deleteSession(token) {
  if (token) await repo.deleteSession(sha256(token));
}

// Alle Sessions eines Nutzers beenden (optional außer der aktuellen)
async function deleteUserSessions(userId, keepToken = null) {
  await repo.deleteUserSessions(userId, keepToken ? sha256(keepToken) : null);
}

module.exports = { hashPassword, verifyPassword, burnTime, generatePassword, createSession, getSessionUser, deleteSession, deleteUserSessions };
