'use strict';

/*
  Konto über die Kommandozeile anlegen (vor allem für das erste Admin-Konto):
    npm run create-admin -- <benutzername> ["Anzeigename"]
    npm run create-user  -- <benutzername> ["Anzeigename"]
  Das Passwort wird zufällig erzeugt und genau einmal angezeigt.
*/
const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const repo = require('../src/repo');
const auth = require('../src/auth');

async function main() {
  await repo.init();
  const args = process.argv.slice(2);
  const isAdmin = args.includes('--admin');
  const [username, displayName] = args.filter((a) => a !== '--admin');
  if (!username || !/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    console.error('Benutzername fehlt oder ungültig (3–32 Zeichen: Buchstaben, Zahlen, _ . -).');
    process.exit(1);
  }
  if (await repo.getUserForLogin(username)) {
    console.error(`"${username}" gibt es schon.`);
    process.exit(1);
  }
  const password = auth.generatePassword(isAdmin ? 20 : 16);
  await repo.createUser({
    username,
    display_name: (displayName || username).slice(0, 60),
    password_hash: await auth.hashPassword(password),
    role: isAdmin ? 'admin' : 'client',
  });
  console.log(`\n${isAdmin ? 'Admin' : 'Kunden'}-Konto angelegt (${repo.kind === 'mongo' ? 'MongoDB' : 'lokal'}).\n  Benutzername: ${username}\n  Passwort:     ${password}\n\nDas Passwort wird nur jetzt angezeigt. Bitte sicher aufbewahren.\n`);
}

main()
  .catch((err) => { console.error(err.message); process.exitCode = 1; })
  .finally(() => repo.close());
