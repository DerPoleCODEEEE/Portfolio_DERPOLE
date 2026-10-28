# Online bringen: MongoDB Atlas + Render (beide kostenlos)

Alles auf deinem **privaten** Rechner und mit **privater** E-Mail machen.

Reihenfolge: 1. Repo → 2. MongoDB → 3. Render → 4. Einloggen

Du brauchst dafür drei Werte. Zwei bekommst du unterwegs, einer liegt schon bereit:

| Wert | Woher |
| --- | --- |
| `MONGODB_URI` | aus Schritt 2 |
| `PUBLIC_ORIGIN` | aus Schritt 3 (Adresse deiner Seite) |
| `ADMIN_PASSWORD_HASH` | hast du von mir bekommen (beginnt mit `scrypt$`) |

---

## 1. Repo anlegen

1. Neues **privates** Repository auf GitHub erstellen (z. B. `derpole`).
2. Den Inhalt von `derpole-repo.zip` ins Repo legen (die Dateien direkt in die oberste Ebene, nicht in einen Unterordner).
3. Committen und pushen. `node_modules/`, `data/` und `.env` gehören nicht rein (steht schon in `.gitignore`).

## 2. MongoDB Atlas (Free / M0)

1. Auf https://www.mongodb.com/cloud/atlas registrieren.
2. **Create** → Cluster-Typ **M0 (Free)** → Anbieter **AWS**, Region **Frankfurt (eu-central-1)** → Name z. B. `derpole` → erstellen.
3. **Database Access** → *Add New Database User*:
   - Methode: Password
   - Benutzername z. B. `derpole-app`
   - **Autogenerate Secure Password** benutzen und das Passwort sicher speichern
   - Rolle: *Read and write to any database*
4. **Network Access** → *Add IP Address* → **Allow Access from Anywhere** (`0.0.0.0/0`).
   Render Free hat keine festen IP-Adressen, deshalb geht es nicht anders. Geschützt ist die Datenbank durch das lange Passwort aus Schritt 3.
5. **Database** → beim Cluster auf **Connect** → *Drivers* → Node.js. Den Connection-String kopieren, er sieht so aus:
   ```
   mongodb+srv://derpole-app:<password>@derpole.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   - `<password>` durch das Passwort aus Schritt 3 ersetzen.
   - Hinter `.mongodb.net/` den Datenbanknamen einsetzen: `...mongodb.net/derpole?retryWrites=true&w=majority`.

   Das ist dein `MONGODB_URI`.

## 3. Render (Free)

1. Auf https://render.com mit GitHub anmelden.
2. **New** → **Blueprint** → dein Repo auswählen. Render liest `render.yaml` und schlägt den Dienst `derpole` vor (Free, Region Frankfurt).
3. Render fragt nach drei Werten:
   - `MONGODB_URI`: der Connection-String aus Schritt 2
   - `PUBLIC_ORIGIN`: die Adresse der Seite, z. B. `https://derpole.onrender.com`. Die genaue Adresse steht nach dem Anlegen oben im Dienst. Falls sie anders ist, unter *Environment* korrigieren und neu deployen.
   - `ADMIN_PASSWORD_HASH`: der Hash, den du von mir bekommen hast (komplett, ohne Leerzeichen)
4. **Apply**. Nach ein paar Minuten ist die Seite online.

Beim ersten Start legt der Server das Konto **Admin** an. Im Log (*Logs* im Dienst) steht dann `Admin-Konto "Admin" angelegt.`

Falls du lieber ohne Blueprint arbeitest: *New → Web Service*, Build Command `npm ci --omit=dev`, Start Command `npm start`, Instance Type *Free*, Region *Frankfurt*. Unter *Environment* setzt du dann `NODE_VERSION=22`, `NODE_ENV=production`, `HOST=0.0.0.0`, `TRUST_PROXY=1`, `ADMIN_USERNAME=Admin`, `ADMIN_PASSWORD_HASH=…`, `MONGODB_URI=…` und `PUBLIC_ORIGIN=…`.

## 4. Einloggen

1. `https://deine-adresse.onrender.com/login` öffnen.
2. Benutzername `Admin` (großes A), Passwort: das Passwort, das du von mir bekommen hast.
3. Du landest im Admin-Bereich. Dort legst du unter *Kunden* die Konten für deine Kunden an.

Gut zu wissen:
- Das Passwort selbst steht nirgends, bei Render liegt nur der Hash. Wenn du es im Admin-Bereich änderst (oben rechts auf deinen Namen), gilt das neue. Der Hash bei Render wird dann nicht mehr benutzt, du kannst ihn stehen lassen oder löschen.
- Passwort vergessen? Ein neuer Hash bei Render hilft nicht, weil es schon einen Admin gibt. Dann auf deinem Rechner mit der `.env` aus „Optional: Selbsttest“ ein zweites Admin-Konto anlegen: `npm run create-admin -- Admin2`. Das Passwort wird einmal angezeigt.

## Feinschliff

- **Impressum & Datenschutz** (`public/impressum.html`, `public/datenschutz.html`): Platzhalter ausfüllen. Als Hosting Render (Frankfurt) und MongoDB Atlas (AWS Frankfurt) eintragen und rechtlich prüfen lassen.
- **Discord-Name** auf der Startseite: in `public/main.js` ganz oben unter `CONFIG`.
- **Eigene Domain** (optional): bei Render unter *Settings → Custom Domains*. Danach `PUBLIC_ORIGIN` auf die neue Adresse ändern.

## Gut zu wissen (Free-Tarife)

- **Schlafmodus:** Render Free schläft nach ca. 15 Minuten ohne Besucher. Der erste Aufruf danach dauert etwa 30 bis 60 Sekunden, Daten gehen dabei nicht verloren.
- **Speicher:** Atlas M0 hat 512 MB insgesamt, inklusive Anhängen. Alte Aufträge mit großen Dateien kannst du im Admin-Bereich löschen. Die maximale Dateigröße stellst du mit `MAX_FILE_MB` ein.
- **Backups:** Atlas M0 macht keine automatischen Backups. Wichtige Lieferungen zusätzlich lokal speichern.
- **Zugangsdaten:** `MONGODB_URI` und Passwörter nie ins Repo, in Screenshots oder in Chats geben. Wenn doch passiert: in Atlas das Passwort des Datenbank-Users ändern und bei Render die URI aktualisieren.

## Optional: Selbsttest gegen MongoDB

Nur falls du prüfen willst, ob die Datenbank-Anbindung klappt (braucht Node.js 22 auf deinem Rechner):

```bash
npm install
```

`.env.example` nach `.env` kopieren, `MONGODB_URI=…` eintragen, dann:

```bash
npm run selftest
```

Am Ende muss `… bestanden · Datenbank: MongoDB` stehen. Der Test nutzt eine eigene Datenbank (`derpole_selftest`) und räumt danach auf.
