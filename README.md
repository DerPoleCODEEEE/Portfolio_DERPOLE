# DerPole · Website, Kundenportal und Admin

Ein Node-Prozess (`server.js`) für alles:

- **Website** (`/`): Portfolio mit Editor-Demo, Leistungen, Showcase, Paketen, FAQ und Kontaktformular.
- **Kundenportal** (`/login` → `/portal`): Kunden wählen Dienste mit Menge, Notiz und Dateien pro Posten. Sie sehen ihre Preise, den Fortschritt jeder Anfrage und schreiben mit dir im Verlauf. Dort können sie auch Dateien nachreichen, deine Lieferungen herunterladen, neue Anfragen zurückziehen und ihr Passwort ändern.
- **Admin** (`/admin`):
  - **Übersicht:** „Als Nächstes“ nach Deadline und neueste Kundennachrichten.
  - **Aufträge:** Suche, Status, Verlauf, Dateien liefern, interne Notiz, Summe, Löschen.
  - **Website-Anfragen:** daraus direkt ein Konto anlegen.
  - **Kunden:** eigene Preise, Dienste ausblenden, sperren, Passwort zurücksetzen, löschen.
  - **Standardpreise** und dein eigenes Passwort.

Daten: lokal SQLite in `data/` (Standard), online MongoDB Atlas (sobald `MONGODB_URI` gesetzt ist). Online gehen: siehe **[DEPLOY.md](DEPLOY.md)**.

## Lokal starten

Voraussetzung: Node.js 22.13 oder neuer.

```bash
npm install
```

```bash
npm run create-admin -- deinname
```

```bash
npm start
```

Auf Render legt der Server das erste Admin-Konto selbst an, aus `ADMIN_USERNAME` und `ADMIN_PASSWORD_HASH` (siehe DEPLOY.md).

Seite: http://localhost:8130 · Login: http://localhost:8130/login

Selbsttest (eigene Test-Datenbank, deine Daten bleiben unberührt):

```bash
npm run selftest
```

## Ordner

```
server.js            Server: Seiten, API, Sicherheit
src/repo.js          wählt den Datenspeicher (SQLite oder MongoDB)
src/store/sqlite.js  lokal
src/store/mongo.js   MongoDB Atlas
src/files.js         Anhänge (lokal auf Platte oder GridFS in MongoDB)
src/auth.js          Passwörter (scrypt) und Sessions
src/catalog.js       Dienste und Status
src/discord.js       Discord-Bot (derzeit aus)
scripts/             create-user, selftest
public/              Website, Portal, Admin
render.yaml          Render-Blueprint
```

## Sicherheit

- **Passwörter:** scrypt mit eigenem Salt, gespeichert wird nur der Hash. Zugangsdaten werden genau einmal angezeigt.
- **Sessions:** zufälliger Token im Cookie (`HttpOnly`, `SameSite=Strict`, online `Secure`), gespeichert nur als SHA-256-Hash. Sperren, Löschen oder Passwort-Reset meldet überall ab.
- **Schutz vor fremden Seiten:** Schreibende Anfragen brauchen einen eigenen Header und die eigene Origin.
- **Login:** Rate-Limit pro IP und Sperre nach 6 Fehlversuchen pro Konto, gleiche Antwort bei falschem Namen oder Passwort.
- **Rechte:** Kunden sehen nur eigene Aufträge, Nachrichten und Dateien (fremde = 404). Preise rechnet immer der Server.
- **Uploads:** nur erlaubte Dateitypen, Größen- und Anzahl-Limits, Zufallsnamen, Download nur als Anhang mit Sandbox-Header.
- **Header:** strenge Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, HSTS (online).
- **Netzwerk:** Lokal hört der Server nur auf `127.0.0.1`.

## Discord-Bot (optional, derzeit aus)

Der Code ist vorhanden, bleibt aber inaktiv, solange in `.env` kein `DISCORD_TOKEN` steht. Bei Render Free wäre der Bot ohnehin offline, solange die Seite schläft. Wenn du ihn später willst: Bot im Discord Developer Portal anlegen, `DISCORD_TOKEN`, `DISCORD_CHANNEL_ID`, `DISCORD_GUILD_ID` und `DISCORD_ADMIN_IDS` setzen. Danach in der Datenschutzerklärung ergänzen, dass Anfragen an Discord (USA) gehen.
