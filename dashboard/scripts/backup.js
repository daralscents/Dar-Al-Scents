'use strict';
// Consistente back-up van database (VACUUM INTO, ook tijdens gebruik) en bijlagen.
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('../src/config');
const { openDb } = require('../src/db');

const config = getConfig();
if (!fs.existsSync(config.dbFile)) { console.error(`Database niet gevonden: ${config.dbFile}`); process.exit(1); }
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = path.join(config.backupDir, `backup-${stamp}`);
fs.mkdirSync(dir, { recursive: true });
const db = openDb(config.dbFile);
const target = path.join(dir, path.basename(config.dbFile));
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
if (fs.existsSync(config.uploadDir)) fs.cpSync(config.uploadDir, path.join(dir, 'uploads'), { recursive: true });
const check = openDb(target);
const ok = check.get('PRAGMA integrity_check').integrity_check;
check.close();
fs.writeFileSync(path.join(dir, 'MANIFEST.txt'), `Back-up Dar Al Scents dashboard\nGemaakt: ${new Date().toISOString()}\nDatabase: ${path.basename(config.dbFile)} (integrity_check: ${ok})\nBijlagen: uploads/\n`);
console.log(`Back-up gemaakt in ${dir} (integriteit: ${ok}).`);
