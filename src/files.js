'use strict';

/*
  Ablage für Anhänge.
  - Lokal (SQLite): Festplatte unter data/uploads/<auftrag>/<zufallsname>
  - Render (MongoDB): GridFS in der Datenbank, weil die Festplatte bei Render Free flüchtig ist
  Uploads landen immer erst in einem Zwischenordner (multer) und werden dann hierher übernommen.
*/
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const repo = require('./repo');

const useGridFs = repo.kind === 'mongo';
const UPLOAD_DIR = useGridFs ? null : path.join(repo.DATA_DIR, 'uploads');
const TMP_DIR = useGridFs ? path.join(os.tmpdir(), 'derpole-uploads') : path.join(UPLOAD_DIR, '.tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

let bucket = null;
function gridfs() {
  if (!bucket) {
    const { GridFSBucket } = require('mongodb');
    bucket = new GridFSBucket(repo.getDb(), { bucketName: 'uploads' });
  }
  return bucket;
}

const orderDir = (orderId) => path.join(UPLOAD_DIR, String(Number(orderId)));
const LOCAL_NAME = /^[a-f0-9]{32}$/;
const GRID_NAME = /^[a-f0-9]{24}$/;

// Datei aus dem Zwischenordner übernehmen; gibt den gespeicherten Namen zurück
async function store(orderId, tmpPath, { filename = 'datei', mime = '' } = {}) {
  if (useGridFs) {
    const upload = gridfs().openUploadStream(filename, { metadata: { order_id: Number(orderId), mime } });
    await new Promise((resolve, reject) => {
      fs.createReadStream(tmpPath).pipe(upload).on('finish', resolve).on('error', reject);
    });
    await fs.promises.unlink(tmpPath).catch(() => {});
    return upload.id.toHexString();
  }
  const dir = orderDir(orderId);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = crypto.randomBytes(16).toString('hex');
  await fs.promises.rename(tmpPath, path.join(dir, name));
  return name;
}

// Lesestream zu einer gespeicherten Datei; der Name kommt aus der Datenbank und wird trotzdem geprüft
function openStream(orderId, storedName) {
  if (useGridFs) {
    if (!GRID_NAME.test(storedName)) throw new Error('ungültiger Dateiname');
    const { ObjectId } = require('mongodb');
    return gridfs().openDownloadStream(new ObjectId(storedName));
  }
  if (!LOCAL_NAME.test(storedName)) throw new Error('ungültiger Dateiname');
  return fs.createReadStream(path.join(orderDir(orderId), storedName));
}

async function removeTemp(paths) {
  await Promise.all(paths.map((p) => fs.promises.unlink(p).catch(() => {})));
}

// Alle Dateien eines Auftrags löschen
async function removeOrder(orderId) {
  if (useGridFs) {
    const files = await gridfs().find({ 'metadata.order_id': Number(orderId) }).toArray();
    await Promise.all(files.map((f) => gridfs().delete(f._id).catch(() => {})));
    return;
  }
  await fs.promises.rm(orderDir(orderId), { recursive: true, force: true });
}

module.exports = { TMP_DIR, store, openStream, removeTemp, removeOrder };
