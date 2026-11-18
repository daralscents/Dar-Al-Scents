'use strict';
// Herstel: npm run restore -- <pad-naar-backup-map>
// Stop de applicatie vóór het herstellen. De huidige database wordt eerst veiliggesteld.
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('../src/config');
const { openDb } = require('../src/db');

const src = process.argv[2];
const config = getConfig();
if (!src || !fs.existsSync(src)) { console.error('Gebruik: npm run restore -- <map-van-back-up>'); process.exit(1); }
const dbSrc = path.join(src, path.basename(config.dbFile));
if (!fs.existsSync(dbSrc)) { console.error(`Geen databasebestand gevonden in ${src}`); process.exit(1); }
const test = openDb(dbSrc);
const ok = test.get('PRAGMA integrity_check').integrity_check;
test.close();
if (ok !== 'ok') { console.error(`Back-up is beschadigd (integrity_check: ${ok}). Herstel afgebroken.`); process.exit(1); }
fs.mkdirSync(config.dataDir, { recursive: true });
if (fs.existsSync(config.dbFile)) {
  const keep = `${config.dbFile}.voor-herstel-${Date.now()}`;
  fs.renameSync(config.dbFile, keep);
  for (const ext of ['-wal', '-shm']) if (fs.existsSync(config.dbFile + ext)) fs.rmSync(config.dbFile + ext);
  console.log(`Huidige database bewaard als ${keep}`);
}
fs.copyFileSync(dbSrc, config.dbFile);
if (fs.existsSync(path.join(src, 'uploads'))) fs.cpSync(path.join(src, 'uploads'), config.uploadDir, { recursive: true });
console.log('Herstel voltooid. Start de applicatie opnieuw met `npm start`.');
