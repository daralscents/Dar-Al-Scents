'use strict';
const path = require('node:path');
const fs = require('node:fs');
const multer = require('multer');
const { html, raw, money, date, pct, qs, field, moneyField, opts, table, statusBadge, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, idemInput, sendCsv } = require('../web');
const auth = require('../auth');
const { csvMoney, csvPercent } = require('../csv');
const C = require('../services/common');
const catalog = require('../services/catalog');
const E = require('../services/expenses');
const A = require('../services/attachments');
const payments = require('../services/payments');
const { paymentsTable, paymentForm } = require('./purchasing');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: A.MAX_BYTES, files: 1, fields: 200 } });

module.exports = (app, { db, config }) => {
  app.get('/uitgaven', (req, res) => {
    const q = { q: req.query.q || '', van: req.query.van || '', tot: req.query.tot || '', categorie: req.query.categorie || '', betaling: req.query.betaling || '', leverancier: req.query.leverancier || '', sort: req.query.sort || 'date', dir: req.query.dir || 'desc' };
    let rows = E.listExpenses(db, { q: q.q, from: q.van, to: q.tot, categoryId: q.categorie ? Number(q.categorie) : null, payStatus: q.betaling, supplierId: q.leverancier ? Number(q.leverancier) : null });
    rows = sortRows(rows, q.sort, q.dir, { date: r => r.expense_date, amount: r => r.total_cents, due: r => r.due_date || '9999', category: r => r.category_name, open: r => r.outstanding });
    const cols = [
      { label: 'Datum', sort: 'date', render: r => date(r.expense_date), csv: r => r.expense_date },
      { label: 'Omschrijving', render: r => html`<a href="/uitgaven/${r.id}">${r.description}</a>${r.attachments.length ? html` <span title="Bijlage" aria-label="heeft bijlage">📎</span>` : ''}<br><small class="muted">${r.supplier_name || r.payee || ''}</small>`, csv: r => r.description },
      { label: 'Leverancier / ontvanger', render: r => r.supplier_name || r.payee || '', csv: r => r.supplier_name || r.payee || '', hide: true },
      { label: 'Categorie', sort: 'category', render: r => r.category_name, csv: r => r.category_name },
      { label: 'Excl. btw', num: true, render: r => money(r.amount_excl_cents), csv: r => csvMoney(r.amount_excl_cents) },
      { label: 'Btw', num: true, render: r => html`${money(r.vat_cents)}${!r.vat_recoverable && r.vat_cents ? html`<br><small class="muted">niet terugvorderbaar</small>` : ''}`, csv: r => csvMoney(r.vat_cents) },
      { label: 'Btw %', render: r => pct(r.vat_rate_bp), csv: r => csvPercent(r.vat_rate_bp), hide: true },
      { label: 'Totaal', num: true, sort: 'amount', render: r => money(r.total_cents), csv: r => csvMoney(r.total_cents) },
      { label: 'Vervaldatum', sort: 'due', render: r => html`${date(r.due_date)}${r.due_date && r.due_date < M.todayIso() && r.outstanding > 0 ? html` <span class="badge badge-danger">verlopen</span>` : ''}`, csv: r => r.due_date || '' },
      { label: 'Betaling', render: r => (r.status === 'cancelled' ? statusBadge('geannuleerd') : statusBadge(r.payStatus)), csv: r => (r.status === 'cancelled' ? 'geannuleerd' : r.payStatus) },
      { label: 'Openstaand', num: true, sort: 'open', render: r => money(r.outstanding), csv: r => csvMoney(r.outstanding) },
    ];
    if (req.query.format === 'csv') return sendCsv(res, 'uitgaven.csv', cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page);
    const active = rows.filter(r => r.status === 'active');
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Omschrijving, ontvanger, factuur', attrs: 'type="search"' })}
        ${field('Van', 'van', q.van, { type: 'date' })}${field('Tot en met', 'tot', q.tot, { type: 'date' })}
        ${field('Categorie', 'categorie', q.categorie, { type: 'select', blank: 'Alle', options: opts(C.lookups(db, 'expense_category', { includeArchived: true })) })}
        ${field('Betaling', 'betaling', q.betaling, { type: 'select', blank: 'Alle', options: ['onbetaald', 'gedeeltelijk betaald', 'betaald'].map(x => ({ value: x, label: x })) })}
        ${field('Leverancier', 'leverancier', q.leverancier, { type: 'select', blank: 'Alle', options: opts(catalog.listSuppliers(db, { status: null })) })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/uitgaven', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card"><p class="scope">${active.length} actieve uitgaven · excl. btw ${money(active.reduce((a, r) => a + r.amount_excl_cents, 0))} · openstaand ${money(active.reduce((a, r) => a + Math.max(0, r.outstanding), 0))}.
        Voorraadinkoop registreer je via <a href="/inkoop">Inkoop</a>, niet als uitgave (anders telt die dubbel).</p>
      ${table({ columns: cols.filter(c => !c.hide), rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/uitgaven', query: q, empty: html`Geen uitgaven gevonden. <a href="/uitgaven/nieuw">Voeg een uitgave toe</a>.` })}${pager(pg, '/uitgaven', q)}</div>`;
    page(req, res, { title: 'Uitgaven', active: 'uitgaven', body, actions: html`<a class="btn" href="/uitgaven/nieuw">+ Uitgave</a>` });
  });

  function form(req, res, e, v = null, errors = {}, status = 200) {
    const val = (k, d) => (v && v[k] !== undefined ? v[k] : e ? e[k] : d);
    const body = html`<form method="post" class="card form" enctype="multipart/form-data" novalidate data-expense-form>
      ${csrfInput(req)}${e ? '' : idemInput()}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Datum (factuur/bon)', 'expense_date', val('expense_date', M.todayIso()), { type: 'date', required: true, errors })}
        ${field('Categorie', 'category_id', val('category_id'), { type: 'select', required: true, options: opts(C.lookups(db, 'expense_category')), errors })}
        ${field('Omschrijving', 'description', val('description'), { required: true, errors, class: 'span-2' })}
        ${field('Leverancier (uit lijst)', 'supplier_id', val('supplier_id'), { type: 'select', blank: 'Geen / andere ontvanger', options: opts(catalog.listSuppliers(db, { status: 'active' })), errors })}
        ${field('Of ontvanger', 'payee', val('payee'), { errors, placeholder: 'bijv. Meta, PostNL, Shopify', attrs: 'list="payees"' })}
        ${field('Bedrag is', 'amount_mode', v?.amount_mode || 'excl', { type: 'select', blank: false, options: [{ value: 'excl', label: 'exclusief btw' }, { value: 'incl', label: 'inclusief btw' }] })}
        ${moneyField('Bedrag', 'amount', v ? v.amount : e?.amount_excl_cents ?? '', { required: true, errors })}
        ${field('Btw-tarief %', 'vat_rate', v ? v.vat_rate : e ? M.bpToInput(e.vat_rate_bp) : M.bpToInput(req.settings.defaultVatBp), { inputmode: 'decimal', errors, help: '0 bij buitenlandse diensten zonder Nederlandse btw' })}
        ${moneyField('Btw-bedrag (optioneel)', 'vat_amount', v ? v.vat_amount : '', { errors, help: 'Alleen invullen als het afwijkt van de berekening.' })}
        ${field('Vervaldatum', 'due_date', val('due_date'), { type: 'date', errors })}
        ${field('Factuurnummer', 'invoice_ref', val('invoice_ref'), { errors })}
        ${field('Betaalmethode', 'payment_method_id', val('payment_method_id'), { type: 'select', options: opts(C.lookups(db, 'payment_method')) })}
        ${field('Campagne', 'campaign_id', val('campaign_id'), { type: 'select', blank: 'Geen', options: opts(db.all('SELECT id, name FROM campaigns WHERE archived = 0 ORDER BY name')) })}
        ${field('Marketingkanaal', 'marketing_channel_id', val('marketing_channel_id'), { type: 'select', blank: 'Geen', options: opts(C.lookups(db, 'marketing_channel')) })}
      </div>
      <datalist id="payees">${db.all("SELECT DISTINCT payee FROM expenses WHERE payee <> '' ORDER BY payee").map(r => html`<option value="${r.payee}">`)}</datalist>
      ${field('Btw is terugvorderbaar (voorbelasting)', 'vat_recoverable', v ? C.bool(v.vat_recoverable) : e ? e.vat_recoverable : req.settings.vatRecoverable, { type: 'checkbox', help: 'Niet terugvorderbare btw telt als kosten mee.' })}
      ${field('Notities', 'notes', val('notes'), { type: 'textarea', rows: 2 })}
      ${e ? '' : html`<fieldset class="options"><legend>Betaling en bijlage</legend>
        ${field('Al betaald (volledig, op de factuurdatum)', 'paid', v ? C.bool(v.paid) : false, { type: 'checkbox', help: 'Uit laten voor een onbetaalde factuur; die blijft dan als openstaand zichtbaar.' })}
        ${field('Factuur of bon (PDF, PNG, JPG of WEBP, max. 10 MB)', 'file', '', { type: 'file', attrs: 'accept="application/pdf,image/png,image/jpeg,image/webp"' })}
      </fieldset>`}
      ${errors.confirm_duplicate ? field('Ja, dit is een tweede, aparte uitgave', 'confirm_duplicate', 0, { type: 'checkbox', errors }) : ''}
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="${e ? `/uitgaven/${e.id}` : '/uitgaven'}">Annuleren</a></div>
    </form>`;
    page(req, res, { title: e ? 'Uitgave bewerken' : 'Nieuwe uitgave', active: 'uitgaven', body }, status);
  }
  const vatFlag = b => ({ ...b, vat_recoverable: C.bool(b.vat_recoverable) ? '1' : '0' });
  const checkCsrf = req => { if (!auth.csrfOk(req)) throw new M.ValidationError('Formulier verlopen; herlaad de pagina.'); };

  app.get('/uitgaven/nieuw', (req, res) => form(req, res, null));
  app.post('/uitgaven/nieuw', upload.single('file'), (req, res) => {
    try {
      checkCsrf(req);
      // Bestand eerst valideren, zodat een ongeldig bestand niets half opslaat.
      if (req.file && req.file.size > 0 && !A.detect(req.file.buffer)) throw new M.ValidationError('Bijlage: bestandstype niet toegestaan (PDF, PNG, JPG, WEBP).', 'file');
      const r = db.tx(() => {
        const out = E.saveExpense(db, vatFlag(req.body), req.user);
        if (!out.duplicate && req.file && req.file.size > 0) A.saveAttachment(db, config.uploadDir, { entity: 'expense', entityId: out.id, file: req.file }, req.user);
        return out;
      });
      req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze uitgave was al opgeslagen.' : 'Uitgave opgeslagen.');
      res.redirect(303, `/uitgaven/${r.id}`);
    } catch (e) { formError(e, errors => form(req, res, null, req.body, errors, 422)); }
  });
  app.get('/uitgaven/:id/bewerken', (req, res, next) => { const e = E.getExpense(db, Number(req.params.id)); if (!e) return next(); form(req, res, e); });
  app.post('/uitgaven/:id/bewerken', upload.none(), (req, res, next) => {
    const e = E.getExpense(db, Number(req.params.id)); if (!e) return next();
    try { checkCsrf(req); E.saveExpense(db, vatFlag(req.body), req.user, e.id); req.addFlash('success', 'Uitgave bijgewerkt.'); res.redirect(303, `/uitgaven/${e.id}`); }
    catch (err) { formError(err, errors => form(req, res, e, req.body, errors, 422)); }
  });
  app.post('/uitgaven/:id/bijlage', upload.single('file'), action((req, res) => {
    checkCsrf(req);
    const e = E.getExpense(db, Number(req.params.id));
    if (!e) throw new M.ValidationError('Uitgave niet gevonden.');
    A.saveAttachment(db, config.uploadDir, { entity: 'expense', entityId: e.id, file: req.file }, req.user);
    req.addFlash('success', 'Bijlage toegevoegd.');
    res.redirect(303, `/uitgaven/${e.id}`);
  }));
  app.post('/uitgaven/:id/betaling', action((req, res) => {
    const r = payments.recordPayment(db, { ...req.body, kind: 'expense', ref_id: Number(req.params.id) }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze betaling was al geregistreerd.' : 'Betaling geregistreerd.');
    res.redirect(303, `/uitgaven/${req.params.id}`);
  }));
  app.post('/uitgaven/:id/annuleren', action((req, res) => {
    E.cancelExpense(db, Number(req.params.id), req.body.reason, req.user);
    req.addFlash('success', 'Uitgave geannuleerd (blijft zichtbaar in de historie).');
    res.redirect(303, `/uitgaven/${req.params.id}`);
  }));

  app.get('/uitgaven/:id', (req, res, next) => {
    const e = E.getExpense(db, Number(req.params.id)); if (!e) return next();
    const canWrite = req.user.role === 'admin';
    const body = html`<div class="grid-2">
      <section class="card"><h2>${e.description}</h2>
        <p>${e.status === 'cancelled' ? statusBadge('geannuleerd') : statusBadge(e.payStatus)}</p>
        <dl class="dl">
          <dt>Datum</dt><dd>${date(e.expense_date)}</dd><dt>Vervaldatum</dt><dd>${date(e.due_date)}</dd>
          <dt>Leverancier / ontvanger</dt><dd>${e.supplier_id ? html`<a href="/leveranciers/${e.supplier_id}">${e.supplier_name}</a>` : e.payee || '–'}</dd>
          <dt>Categorie</dt><dd>${e.category_name}${e.is_marketing ? html` <span class="badge badge-info">marketing</span>` : ''}</dd>
          <dt>Factuurnummer</dt><dd>${e.invoice_ref || '–'}</dd>
          <dt>Campagne / kanaal</dt><dd>${[e.campaign_name, e.marketing_channel_name].filter(Boolean).join(' · ') || '–'}</dd>
          <dt>Betaalmethode</dt><dd>${e.method_name || '–'}</dd>
          ${e.notes ? html`<dt>Notities</dt><dd class="prewrap">${e.notes}</dd>` : ''}
          ${e.cancel_reason ? html`<dt>Geannuleerd</dt><dd>${e.cancel_reason}</dd>` : ''}
        </dl>
        ${canWrite && e.status === 'active' ? html`<div class="row-actions"><a class="btn btn-sm btn-ghost" href="/uitgaven/${e.id}/bewerken">Bewerken</a>
          ${e.paid === 0 ? html`<form method="post" action="/uitgaven/${e.id}/annuleren" class="inline">${csrfInput(req)}<input type="hidden" name="reason" value=""><button class="btn btn-sm btn-ghost" type="submit" data-prompt-reason="Reden van annulering">Annuleren</button></form>` : ''}</div>` : ''}
      </section>
      <section class="card"><h2>Bedragen</h2>
        <dl class="dl"><dt>Excl. btw</dt><dd>${money(e.amount_excl_cents)}</dd><dt>Btw (${pct(e.vat_rate_bp)})</dt><dd>${money(e.vat_cents)} <small class="muted">${e.vat_recoverable ? 'terugvorderbaar' : 'niet terugvorderbaar'}</small></dd>
        <dt><strong>Totaal</strong></dt><dd><strong>${money(e.total_cents)}</strong></dd><dt>Kosten in resultaat</dt><dd>${money(e.cost_cents)}</dd>
        <dt>Betaald</dt><dd>${money(e.paid)}</dd><dt>Openstaand</dt><dd>${money(e.outstanding)}</dd></dl>
      </section></div>
      <div class="grid-2">
      <section class="card"><h2>Betalingen</h2>${paymentsTable(req, e.payments)}
        ${canWrite && e.status === 'active' && e.outstanding > 0 ? html`<details class="mt" open><summary class="btn btn-ghost btn-sm">+ Betaling registreren</summary>${paymentForm(req, db, { action: `/uitgaven/${e.id}/betaling`, amount: e.outstanding, label: 'Betaald bedrag', methodId: e.payment_method_id })}</details>` : ''}
      </section>
      <section class="card"><h2>Bijlagen</h2>
        ${e.attachments.length ? html`<ul class="plain">${e.attachments.map(a => html`<li><a href="/bijlagen/${a.id}" target="_blank" rel="noopener">${a.original_name}</a> <small class="muted">${Math.ceil(a.size / 1024)} kB · ${M.formatDateTime(a.created_at)}</small></li>`)}</ul>` : html`<p class="muted">Nog geen factuur of bon.</p>`}
        ${canWrite ? html`<form method="post" action="/uitgaven/${e.id}/bijlage" enctype="multipart/form-data" class="stack compact">${csrfInput(req)}
          ${field('Bestand (PDF, PNG, JPG, WEBP; max. 10 MB)', 'file', '', { type: 'file', required: true, attrs: 'accept="application/pdf,image/png,image/jpeg,image/webp"' })}
          <button class="btn btn-sm" type="submit">Uploaden</button></form>` : ''}
      </section></div>`;
    page(req, res, { title: 'Uitgave', active: 'uitgaven', body, actions: html`<a class="btn btn-ghost" href="/uitgaven">← Alle uitgaven</a>` });
  });

  // Beveiligde bijlagen (alleen ingelogd; vaste, gecontroleerde MIME-types).
  app.get('/bijlagen/:id', (req, res, next) => {
    const a = A.getAttachment(db, Number(req.params.id)); if (!a) return next();
    const file = path.join(config.uploadDir, path.basename(a.stored_name));
    if (!fs.existsSync(file)) return next();
    res.set('Content-Type', a.mime);
    res.set('Content-Disposition', `inline; filename="${a.original_name.replace(/[^\w.\- ]/g, '_')}"`);
    res.set('Cache-Control', 'private, max-age=300');
    res.sendFile(file);
  });
};
void raw;
