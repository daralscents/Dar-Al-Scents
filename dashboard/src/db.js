'use strict';
// Database-toegang via de ingebouwde SQLite-module van Node (geen native build nodig).
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function clean(params) {
  if (params == null) return undefined;
  if (Array.isArray(params)) return params.map(cleanValue);
  const out = {};
  for (const [k, v] of Object.entries(params)) out[k] = cleanValue(v);
  return out;
}
function cleanValue(v) {
  if (v === undefined) return null;
  if (v === true) return 1;
  if (v === false) return 0;
  return v;
}

class Db {
  constructor(file) {
    this.file = file;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL;');
    this.depth = 0;
    this.cache = new Map();
  }
  stmt(sql) {
    let s = this.cache.get(sql);
    if (!s) { s = this.raw.prepare(sql); s.setAllowUnknownNamedParameters(true); this.cache.set(sql, s); }
    return s;
  }
  call(method, sql, params) {
    const p = clean(params);
    const s = this.stmt(sql);
    if (p === undefined) return s[method]();
    return Array.isArray(p) ? s[method](...p) : s[method](p);
  }
  run(sql, params) { return this.call('run', sql, params); }
  get(sql, params) { const r = this.call('get', sql, params); return r === undefined ? undefined : r; }
  all(sql, params) { return this.call('all', sql, params); }
  exec(sql) { this.raw.exec(sql); }
  insert(sql, params) { return Number(this.run(sql, params).lastInsertRowid); }

  // Transactie met ondersteuning voor nesten (savepoints). Synchroon, dus binnen één
  // Node-proces worden schrijfacties strikt na elkaar uitgevoerd.
  tx(fn) {
    if (this.depth > 0) {
      const sp = `sp_${this.depth}`;
      this.raw.exec(`SAVEPOINT ${sp}`);
      this.depth++;
      try { const r = fn(); this.depth--; this.raw.exec(`RELEASE ${sp}`); return r; }
      catch (e) { this.depth--; this.raw.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`); throw e; }
    }
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try { const r = fn(); this.depth = 0; this.raw.exec('COMMIT'); return r; }
    catch (e) { this.depth = 0; this.raw.exec('ROLLBACK'); throw e; }
  }

  migrate() {
    this.raw.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime(\'now\')))');
    const done = new Set(this.all('SELECT name FROM schema_migrations').map(r => r.name));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    const applied = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
      this.tx(() => { this.raw.exec(sql); this.run('INSERT INTO schema_migrations(name) VALUES (?)', [f]); });
      applied.push(f);
    }
    return applied;
  }
  close() { this.raw.close(); }
}

function openDb(file) {
  const db = new Db(file);
  db.migrate();
  return db;
}

module.exports = { openDb, Db };
