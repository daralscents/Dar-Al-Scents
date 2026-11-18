'use strict';
// Testhulpen: verse database per test, ingelogde HTTP-client met cookie + CSRF.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDb } = require('../src/db');
const C = require('../src/services/common');
const auth = require('../src/auth');
const { createApp } = require('../src/app');

let n = 0;
function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'das-test-'));
  const db = openDb(path.join(dir, 'test.sqlite'));
  C.ensureDefaults(db);
  db.dir = dir;
  return db;
}
const U = { id: 1 };
function admin(db, email = 'admin@test.nl', role = 'admin') {
  return auth.createUser(db, { email, name: 'Test ' + role, password: 'Test-wachtwoord-123', role });
}

async function startServer(db) {
  const config = { port: 0, host: '127.0.0.1', dataDir: db.dir, dbFile: path.join(db.dir, 'test.sqlite'), uploadDir: path.join(db.dir, 'uploads'), backupDir: path.join(db.dir, 'backups'), cookieSecure: false, trustProxy: false, setupToken: '' };
  const app = createApp({ db, config });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  return { server, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

class Client {
  constructor(base) { this.base = base; this.cookie = ''; this.csrf = ''; }
  async req(method, url, { form, body, headers = {}, redirect = 'manual' } = {}) {
    const h = { ...headers }; if (this.cookie) h.cookie = this.cookie;
    let b = body;
    if (form) { h['content-type'] = 'application/x-www-form-urlencoded'; b = new URLSearchParams({ _csrf: this.csrf, ...form }).toString(); }
    const res = await fetch(this.base + url, { method, headers: h, body: b, redirect });
    const sc = res.headers.getSetCookie?.() || [];
    for (const c of sc) { const m = /^das_sid=([^;]*)/.exec(c); if (m) this.cookie = m[1] ? `das_sid=${m[1]}` : ''; }
    const text = await res.text();
    const t = /name="_csrf" value="([^"]+)"/.exec(text); if (t) this.csrf = t[1];
    return { status: res.status, location: res.headers.get('location'), text, headers: res.headers };
  }
  get(url) { return this.req('GET', url); }
  post(url, form) { return this.req('POST', url, { form }); }
  async login(email = 'admin@test.nl', password = 'Test-wachtwoord-123') {
    await this.get('/inloggen');
    return this.post('/inloggen', { email, password });
  }
}

module.exports = { freshDb, admin, startServer, Client, U, uid: () => `t-${process.pid}-${++n}` };
