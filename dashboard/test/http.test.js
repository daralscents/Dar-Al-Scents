'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, admin, startServer, Client } = require('./helpers');
const C = require('../src/services/common');

let db, srv;
test.before(async () => { db = freshDb(); admin(db); admin(db, 'kijker@test.nl', 'viewer'); srv = await startServer(db); });
test.after(() => srv.close());

const idOf = loc => Number(/\/(\d+)(?:$|[/?#])/.exec(loc)[1]);

test('zonder inloggen geen toegang; fout wachtwoord geweigerd', async () => {
  const c = new Client(srv.base);
  for (const p of ['/', '/verkopen', '/rapporten/btw?format=csv', '/bijlagen/1']) {
    const r = await c.get(p);
    assert.equal(r.status, 302, p); assert.match(r.location, /\/inloggen/);
  }
  await c.get('/inloggen');
  const bad = await c.post('/inloggen', { email: 'admin@test.nl', password: 'fout-wachtwoord-1' });
  assert.equal(bad.status, 401);
  assert.match(bad.text, /onjuist/i);
  const ok = await c.post('/inloggen', { email: 'admin@test.nl', password: 'Test-wachtwoord-123' });
  assert.equal(ok.status, 303);
  assert.equal((await c.get('/')).status, 200);
});

test('CSRF: POST zonder geldig token wordt geweigerd', async () => {
  const c = new Client(srv.base); await c.login();
  const none = await fetch(srv.base + '/leveranciers/nieuw', { method: 'POST', headers: { cookie: c.cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Hack+BV', redirect: 'manual' });
  assert.equal(none.status, 403);
  c.csrf = 'ongeldig';
  const bad = await c.post('/leveranciers/nieuw', { name: 'Hack BV', idem: 'x1' });
  assert.equal(bad.status, 403);
  assert.equal(db.get("SELECT COUNT(*) n FROM suppliers WHERE name = 'Hack BV'").n, 0);
  await c.get('/leveranciers/nieuw');
  const ok = await c.post('/leveranciers/nieuw', { name: 'Echte BV', idem: 'x2' });
  assert.equal(ok.status, 303);
});

test('alleen-lezen gebruiker kan niets wijzigen', async () => {
  const c = new Client(srv.base); await c.login('kijker@test.nl');
  assert.equal((await c.get('/verkopen')).status, 200);
  await c.get('/leveranciers');
  const r = await c.post('/leveranciers/nieuw', { name: 'Kijker BV' });
  assert.equal(r.status, 403);
  assert.equal(db.get("SELECT COUNT(*) n FROM suppliers WHERE name = 'Kijker BV'").n, 0);
});

test('volledige stroom via formulieren: product → beginvoorraad → verkoop → betaling → retour, dubbel indienen veilig', async () => {
  const c = new Client(srv.base); await c.login();
  await c.get('/producten/nieuw');
  let r = await c.post('/producten/nieuw', { name: 'HTTP Oud', category_id: String(C.lookupId(db, 'product_category', 'Parfumflessen')), 'variants[0][sku]': 'H-1', 'variants[0][name]': '100 ml', 'variants[0][price_incl]': '50,00', 'variants[0][vat]': '21', 'variants[0][min_stock]': '1' });
  assert.equal(r.status, 303, r.text.slice(0, 300));
  const vid = db.get("SELECT id FROM variants WHERE sku = 'H-1'").id;
  // Validatiefout: dubbele SKU → 422 met melding, niets opgeslagen.
  await c.get('/producten/nieuw');
  r = await c.post('/producten/nieuw', { name: 'Dubbel', 'variants[0][sku]': 'H-1', 'variants[0][name]': 'x', 'variants[0][price_incl]': '1' });
  assert.equal(r.status, 422); assert.match(r.text, /SKU/);
  await c.get('/voorraad/beginvoorraad');
  r = await c.post('/voorraad/beginvoorraad', { variant_id: String(vid), qty: '3', unit_cost: '20,00', date: '2026-10-01', idem: 'open-h1' });
  assert.equal(r.status, 303);
  // Verkoop dubbel indienen (zelfde idem): één verkoop, één betaling, voorraad 1× afgeboekt.
  await c.get('/verkopen/nieuw');
  const form = { sale_date: '2026-10-05', channel_id: String(C.lookupId(db, 'sales_channel', 'Webshop')), 'lines[0][variant_id]': String(vid), 'lines[0][qty]': '1', fulfill: '1', paid: '1', idem: 'sale-dubbel' };
  const a = await c.post('/verkopen/nieuw', form);
  await c.get('/verkopen/nieuw');
  const b = await c.post('/verkopen/nieuw', form);
  assert.equal(a.status, 303); assert.equal(b.status, 303);
  assert.equal(a.location, b.location);
  assert.equal(db.get('SELECT COUNT(*) n FROM sales').n, 1);
  assert.equal(db.get("SELECT COUNT(*) n FROM payments WHERE kind='sale'").n, 1);
  assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [vid]).q, 2);
  const sid = idOf(a.location);
  const page = await c.get(`/verkopen/${sid}`);
  assert.match(page.text, /afgerond/i);
  // Retour + terugbetaling.
  const lineId = db.get('SELECT id FROM sale_lines WHERE sale_id = ?', [sid]).id;
  await c.get(`/verkopen/${sid}`);
  r = await c.post(`/verkopen/${sid}/retour`, { date: '2026-10-08', [`qty[${lineId}]`]: '1', restock: '1', reason: 'test', idem: 'ret-1' });
  assert.equal(r.status, 303);
  const after = await c.get(`/verkopen/${sid}`);
  assert.doesNotMatch(after.text, /flash-error/, (after.text.match(/flash-error[^<]*<[^<]*/) || [''])[0]);
  r = await c.post(`/verkopen/${sid}/betaling`, { kind: 'refund', date: '2026-10-09', amount: '50,00', idem: 'refund-1' });
  assert.equal(r.status, 303, r.text.slice(-800));
  assert.equal(db.get('SELECT COUNT(*) n FROM sale_returns').n, 1);
  assert.equal(db.get("SELECT SUM(amount_cents) s FROM payments WHERE kind='refund'").s, 5000);
  assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [vid]).q, 3);
  // Te hoge terugbetaling geweigerd.
  await c.get(`/verkopen/${sid}`);
  r = await c.post(`/verkopen/${sid}/betaling`, { kind: 'refund', date: '2026-10-09', amount: '1,00', idem: 'refund-2' });
  assert.notEqual(db.get("SELECT COUNT(*) n FROM payments WHERE idempotency_key = 'refund-2'").n, 1);
});

test('uitgave met bijlage: alleen echte PDF/afbeelding, bijlage alleen ingelogd op te halen', async () => {
  const c = new Client(srv.base); await c.login();
  await c.get('/uitgaven/nieuw');
  const mk = (buf, name, type) => {
    const fd = new FormData();
    Object.entries({ _csrf: c.csrf, expense_date: '2026-10-10', category_id: String(C.lookupId(db, 'expense_category', 'Marketing en advertenties')), description: 'Advertenties', payee: 'Meta', amount: '100,00', vat_rate: '21', amount_mode: 'excl', vat_recoverable: '1', idem: 'exp-' + name }).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', new Blob([buf], { type }), name);
    return c.req('POST', '/uitgaven/nieuw', { body: fd });
  };
  const fake = await mk(Buffer.from('MZ dit is geen pdf'), 'virus.pdf', 'application/pdf');
  assert.equal(fake.status, 422); assert.match(fake.text, /PDF|bestand/i);
  assert.equal(db.get("SELECT COUNT(*) n FROM expenses WHERE idempotency_key = 'exp-virus.pdf'").n, 0, 'uitgave niet half opgeslagen');
  await c.get('/uitgaven/nieuw');
  const ok = await mk(Buffer.from('%PDF-1.4\n%test\n'), 'factuur.pdf', 'application/pdf');
  assert.equal(ok.status, 303, ok.text.slice(0, 400));
  const att = db.get('SELECT id FROM attachments ORDER BY id DESC LIMIT 1');
  const dl = await c.get(`/bijlagen/${att.id}`);
  assert.equal(dl.status, 200); assert.match(dl.headers.get('content-type'), /pdf/);
  assert.equal((await new Client(srv.base).get(`/bijlagen/${att.id}`)).status, 302);
});

test('CSV-import: preview, bevestigen, hetzelfde bestand niet twee keer', async () => {
  const c = new Client(srv.base); await c.login();
  const csv = 'sku;product;variant;prijs;btw;beginvoorraad;kostprijs\nIMP-1;Import Oud;100 ml;45,00;21;2;15,00\nIMP-2;Import Rose;50 ml;35,00;21;;\n';
  const up = async () => { await c.get('/import'); const fd = new FormData(); fd.append('_csrf', c.csrf); fd.append('type', 'products'); fd.append('file', new Blob([csv], { type: 'text/csv' }), 'p.csv'); return c.req('POST', '/import', { body: fd }); };
  const r = await up();
  assert.equal(r.status, 303, r.text.slice(0, 300));
  const bid = idOf(r.location);
  const prev = await c.get(`/import/${bid}`);
  assert.match(prev.text, /Preview/);
  assert.match(prev.text, /IMP-1/);
  const done = await c.post(`/import/${bid}/verwerken`, {});
  assert.equal(done.status, 303);
  assert.equal(db.get("SELECT COUNT(*) n FROM variants WHERE sku LIKE 'IMP-%'").n, 2);
  assert.equal(db.get("SELECT SUM(qty) q FROM stock_movements m JOIN variants v ON v.id = m.variant_id WHERE v.sku = 'IMP-1'").q, 2);
  const again = await up();
  assert.equal(again.status, 303);
  assert.match((await c.get(again.location)).text, /al eerder geïmporteerd|al geïmporteerd/i);
  assert.equal(db.get("SELECT COUNT(*) n FROM variants WHERE sku LIKE 'IMP-%'").n, 2);
});

test('CSV-export van rapporten en KPI-uitsplitsing', async () => {
  const c = new Client(srv.base); await c.login();
  for (const k of ['maandelijks', 'producten', 'btw', 'voorraad', 'betalingen']) {
    const r = await c.get(`/rapporten/${k}?periode=year&format=csv`);
    assert.equal(r.status, 200, k);
    assert.match(r.headers.get('content-type'), /text\/csv/);
    assert.match(r.headers.get('content-disposition'), /attachment/);
  }
  const k = await c.get('/overzicht/omzet?periode=year&format=csv');
  assert.equal(k.status, 200);
});

test('beveiligingsheaders en sessiecookie', async () => {
  const c = new Client(srv.base);
  const r = await c.get('/inloggen');
  assert.match(r.headers.get('content-security-policy') || '', /default-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  const res = await fetch(srv.base + '/inloggen', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: c.cookie }, body: new URLSearchParams({ _csrf: c.csrf, email: 'admin@test.nl', password: 'Test-wachtwoord-123' }), redirect: 'manual' });
  const ck = res.headers.getSetCookie().join(';');
  assert.match(ck, /HttpOnly/i); assert.match(ck, /SameSite=Lax/i);
});

test('beheerder kan wachtwoord van een gebruiker resetten; oude sessies vervallen', async () => {
  const k = new Client(srv.base); await k.login('kijker@test.nl');
  assert.equal((await k.get('/')).status, 200);
  const c = new Client(srv.base); await c.login();
  await c.get('/instellingen');
  const id = db.get("SELECT id FROM users WHERE email = 'kijker@test.nl'").id;
  const short = await c.post(`/instellingen/gebruikers/${id}`, { role: 'viewer', active: '1', new_password: 'kort' });
  assert.equal(short.status, 303);
  assert.equal((await k.get('/')).status, 200, 'te kort wachtwoord: niets gewijzigd');
  await c.get('/instellingen');
  const r = await c.post(`/instellingen/gebruikers/${id}`, { role: 'viewer', active: '1', new_password: 'Nieuw-wachtwoord-456' });
  assert.equal(r.status, 303);
  assert.equal((await k.get('/')).status, 302, 'oude sessie uitgelogd');
  const k2 = new Client(srv.base);
  assert.equal((await k2.login('kijker@test.nl', 'Nieuw-wachtwoord-456')).status, 303);
});
