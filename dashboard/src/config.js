'use strict';
// Configuratie uit omgevingsvariabelen (optioneel uit een lokaal .env-bestand).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

function getConfig() {
  loadEnvFile();
  const dataDir = path.resolve(ROOT, process.env.DATA_DIR || 'data');
  return {
    port: Number(process.env.PORT || 3000),
    host: process.env.HOST || '127.0.0.1',
    dataDir,
    dbFile: path.resolve(dataDir, process.env.DB_FILE || 'dar-al-scents.sqlite'),
    uploadDir: path.resolve(dataDir, 'uploads'),
    backupDir: path.resolve(ROOT, process.env.BACKUP_DIR || 'backups'),
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    trustProxy: process.env.TRUST_PROXY || false,
    setupToken: process.env.SETUP_TOKEN || '',
  };
}

module.exports = { getConfig, ROOT };
