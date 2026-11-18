'use strict';
const multer = require('multer');
const { html, raw, date, field, table, badge } = require('../views/html');
const M = require('../money');
const { page, action, csrfInput } = require('../web');
const auth = require('../auth');
const IMP = require('../services/imports');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const TYPE_LABELS = { products: 'Producten', suppliers: 'Leveranciers', sales: 'Verkopen' };

module.exports = (app, { db }) => {
  app.get('/import', (req, res) => {
    const type = TYPE_LABELS[req.query.type] ? req.query.type : 'products';
    const batches = db.all('SELECT id, type, filename, status, created_rows, skipped_rows, created_at FROM import_batches ORDER BY id DESC LIMIT 20');
    const body = html`<div class="grid-2">
      <section class="card"><h2>CSV importeren</h2>
        <ol class="steps"><li>Download het voorbeeldbestand en vul het (Excel: opslaan als CSV, scheidingsteken ; of ,).</li><li>Upload het bestand en koppel de kolommen.</li><li>Controleer de preview en bevestig.</li></ol>
        <form method="post" action="/import" enctype="multipart/form-data" class="stack">${csrfInput(req)}
          ${field('Soort gegevens', 'type', type, { type: 'select', blank: false, options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) })}
          ${field('CSV-bestand (max. 5 MB, UTF-8)', 'file', '', { type: 'file', required: true, attrs: 'accept=".csv,text/csv"' })}
          <button class="btn" type="submit">Uploaden en koppelen</button>
        </form>
        <p class="help">Voorbeeldbestanden: ${Object.entries(TYPE_LABELS).map(([k, l], i) => html`${i ? ' · ' : ''}<a href="/import/voorbeeld/${k}">${l}</a>`)}</p>
        <p class="help">Dubbele imports worden voorkomen: hetzelfde bestand kan maar één keer worden verwerkt, en per regel worden bestaande SKU's, leveranciersnamen en externe ordernummers overgeslagen.</p>
      </section>
      <section class="card"><h2>Recente imports</h2>
        ${table({ columns: [{ label: '#', render: b => html`<a href="/import/${b.id}">${b.id}</a>` }, { label: 'Soort', render: b => TYPE_LABELS[b.type] }, { label: 'Bestand', key: 'filename' },
          { label: 'Status', render: b => badge({ pending: 'wacht op bevestiging', done: 'verwerkt', discarded: 'geannuleerd' }[b.status], b.status === 'done' ? 'ok' : b.status === 'pending' ? 'warn' : 'muted') },
          { label: 'Resultaat', render: b => (b.status === 'done' ? `${b.created_rows} aangemaakt, ${b.skipped_rows} overgeslagen` : '–') }, { label: 'Datum', render: b => M.formatDateTime(b.created_at) }], rows: batches, empty: 'Nog geen imports.' })}
      </section></div>`;
    page(req, res, { title: 'Importeren', active: 'instellingen', body });
  });

  app.get('/import/voorbeeld/:type', (req, res, next) => {
    const ex = IMP.EXAMPLES[req.params.type]; if (!ex) return next();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="voorbeeld-${req.params.type}.csv"`);
    res.send('﻿' + ex);
  });

  app.post('/import', upload.single('file'), action((req, res) => {
    if (!auth.csrfOk(req)) throw new M.ValidationError('Formulier verlopen; probeer opnieuw.');
    if (!req.file) throw new M.ValidationError('Kies een CSV-bestand.');
    const id = IMP.createBatch(db, req.body.type, req.file.originalname, req.file.buffer, req.user);
    res.redirect(303, `/import/${id}`);
  }, { back: '/import' }));

  app.get('/import/:id', (req, res, next) => {
    const b = IMP.getBatch(db, Number(req.params.id)); if (!b) return next();
    const fields = IMP.FIELDS[b.type];
    let analysis = null, err = null;
    if (b.status === 'pending') { try { analysis = IMP.analyze(db, b, b.mappingObj, b.optionsObj); } catch (e) { if (e instanceof M.ValidationError) err = e.message; else throw e; } }
    const headerOpts = b.parsed.headers.map(h => ({ value: h, label: h }));
    const body = html`<div class="card"><h2>${TYPE_LABELS[b.type]} · ${b.filename}</h2>
      <p class="scope">${b.parsed.records.length} gegevensregels · scheidingsteken “${b.parsed.delimiter === '\t' ? 'tab' : b.parsed.delimiter}” · status ${badge({ pending: 'wacht op bevestiging', done: 'verwerkt', discarded: 'geannuleerd' }[b.status])}</p>
      ${b.status === 'done' ? html`<p>Verwerkt: ${b.created_rows} aangemaakt, ${b.skipped_rows} overgeslagen.</p>` : ''}
      ${b.status === 'pending' ? html`<form method="post" action="/import/${b.id}/koppeling" class="form">${csrfInput(req)}
        <h3>Veldkoppeling</h3>
        <div class="grid-form">${fields.map(f => field(`${f.label}${f.required ? ' *' : ''}`, `map[${f.key}]`, b.mappingObj[f.key] || '', { type: 'select', blank: '— niet importeren —', options: headerOpts, id: `map-${f.key}` }))}</div>
        <h3>Opties</h3>
        ${field('Onbekende categorieën, kanalen en betaalmethoden automatisch aanmaken', 'opt[createLookups]', b.optionsObj.createLookups, { type: 'checkbox', id: 'opt-lookups' })}
        ${b.type === 'sales' ? field('Verkopen als uitgeleverd boeken als de kolom ontbreekt (voorraad wordt afgeboekt)', 'opt[defaultFulfilled]', b.optionsObj.defaultFulfilled, { type: 'checkbox', id: 'opt-ff' }) : ''}
        ${b.type === 'products' ? field('Datum beginvoorraad', 'opt[openingDate]', b.optionsObj.openingDate || M.todayIso(), { type: 'date', id: 'opt-od' }) : ''}
        <div class="form-actions"><button class="btn btn-ghost" type="submit">Koppeling toepassen en controleren</button></div>
      </form>` : ''}
    </div>
    ${err ? html`<div class="flash flash-error" role="alert">${err}</div>` : ''}
    ${analysis ? html`<div class="card"><h2>Preview</h2>
      <p class="scope">${analysis.summary.total} regels: <strong>${analysis.summary.create}</strong> aanmaken, ${analysis.summary.skip} overslaan (bestaat al), <strong class="${analysis.summary.error ? 'warn-text' : ''}">${analysis.summary.error} met fouten</strong>.</p>
      ${table({ columns: [
        { label: 'Regel', render: r => r.line },
        { label: 'Actie', render: r => badge({ create: 'aanmaken', skip: 'overslaan', error: 'fout' }[r.action], { create: 'ok', skip: 'muted', error: 'danger' }[r.action]) },
        { label: 'Gegevens', render: r => preview(b.type, r.data) },
        { label: 'Melding', render: r => (r.errors.length ? html`<ul class="plain error-text">${r.errors.map(e => html`<li>${e}</li>`)}</ul>` : r.note || '') },
      ], rows: analysis.rows.slice(0, 300) })}
      ${analysis.rows.length > 300 ? html`<p class="help">Eerste 300 regels getoond.</p>` : ''}
      <div class="form-actions">
        <form method="post" action="/import/${b.id}/verwerken" class="inline">${csrfInput(req)}<button class="btn" type="submit"${analysis.summary.error || !analysis.summary.create ? raw(' disabled') : ''}>Importeren (${analysis.summary.create})</button></form>
        <form method="post" action="/import/${b.id}/annuleren" class="inline">${csrfInput(req)}<button class="btn btn-ghost" type="submit">Annuleren</button></form>
      </div>
      ${analysis.summary.error ? html`<p class="help">Los eerst de fouten op (in het bestand of via de koppeling). Upload een gecorrigeerd bestand als nieuwe import.</p>` : ''}
    </div>` : ''}`;
    page(req, res, { title: `Import #${b.id}`, active: 'instellingen', body, actions: html`<a class="btn btn-ghost" href="/import">← Importeren</a>` });
  });

  app.post('/import/:id/koppeling', action((req, res) => {
    const b = IMP.getBatch(db, Number(req.params.id));
    if (!b || b.status !== 'pending') throw new M.ValidationError('Deze import kan niet meer worden aangepast.');
    const mapping = {};
    for (const f of IMP.FIELDS[b.type]) { const h = req.body.map?.[f.key]; if (h && b.parsed.headers.includes(h)) mapping[f.key] = h; }
    const o = req.body.opt || {};
    const options = { createLookups: o.createLookups === '1', defaultFulfilled: o.defaultFulfilled === '1', openingDate: o.openingDate ? M.parseDate(o.openingDate) : undefined };
    db.run('UPDATE import_batches SET mapping = ?, options = ? WHERE id = ?', [JSON.stringify(mapping), JSON.stringify(options), b.id]);
    res.redirect(303, `/import/${b.id}`);
  }));
  app.post('/import/:id/verwerken', action((req, res) => {
    const b = IMP.getBatch(db, Number(req.params.id));
    if (!b) throw new M.ValidationError('Import niet gevonden.');
    const r = IMP.commit(db, b.id, b.mappingObj, b.optionsObj, req.user);
    req.addFlash('success', `Import verwerkt: ${r.created} aangemaakt, ${r.skipped} overgeslagen.`);
    res.redirect(303, `/import/${b.id}`);
  }));
  app.post('/import/:id/annuleren', action((req, res) => {
    db.run("UPDATE import_batches SET status = 'discarded' WHERE id = ? AND status = 'pending'", [Number(req.params.id)]);
    req.addFlash('info', 'Import geannuleerd.');
    res.redirect(303, '/import');
  }));
};

function preview(type, d) {
  if (type === 'products') return html`${d.product_name || ''} · <strong>${d.sku || ''}</strong>${d.variant_name ? ` · ${d.variant_name}` : ''}${d.price_incl != null ? ` · ${M.formatMoney(d.price_incl)}` : ''}${d.opening_qty ? ` · begin ${d.opening_qty} st.` : ''}`;
  if (type === 'suppliers') return html`<strong>${d.name || ''}</strong>${d.country ? ` · ${d.country}` : ''}${d.email ? ` · ${d.email}` : ''}`;
  return html`<strong>${d.order_ref || ''}</strong> · ${date(d.date)} · ${d.qty || ''} × ${d.sku || ''}${d.unit_price ? ` à ${d.unit_price}` : ''}${d.paid ? ' · betaald' : ''}${d.fulfilled ? ' · uitgeleverd' : ''}`;
}
