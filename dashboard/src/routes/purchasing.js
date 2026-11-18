'use strict';
const { html, raw, money, date, pct, num, qs, field, moneyField, opts, table, statusBadge, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, idemInput, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const C = require('../services/common');
const catalog = require('../services/catalog');
const P = require('../services/purchasing');
const payments = require('../services/payments');

module.exports = (app, { db }) => {
  app.get('/inkoop', (req, res) => {
    const q = { q: req.query.q || '', status: req.query.status || '', leverancier: req.query.leverancier || '', betaling: req.query.betaling || '', sort: req.query.sort || 'date', dir: req.query.dir || 'desc' };
    let rows = P.listPos(db, { q: q.q, status: q.status, supplierId: q.leverancier ? Number(q.leverancier) : null, payStatus: q.betaling });
    rows = sortRows(rows, q.sort, q.dir, { date: r => r.order_date, number: r => r.number, supplier: r => r.supplier_name, total: r => r.totals.payable, open: r => r.outstanding });
    const cols = [
      { label: 'Order', sort: 'number', render: r => html`<a href="/inkoop/${r.id}">${r.number}</a>${r.reference ? html`<br><small class="muted">${r.reference}</small>` : ''}`, csv: r => r.number },
      { label: 'Leverancier', sort: 'supplier', render: r => r.supplier_name, csv: r => r.supplier_name },
      { label: 'Besteldatum', sort: 'date', render: r => date(r.order_date), csv: r => r.order_date },
      { label: 'Ontvangst', render: r => html`${statusBadge(P.STATUS_LABELS[r.status].toLowerCase())}<br><small class="muted">${r.totals.received_qty}/${r.totals.ordered_qty} stuks</small>`, csv: r => P.STATUS_LABELS[r.status] },
      { label: 'Betaling', render: r => statusBadge(r.payStatus), csv: r => r.payStatus },
      { label: 'Totaal incl. btw (EUR)', num: true, sort: 'total', render: r => html`${money(r.totals.payable)}${r.currency !== 'EUR' ? html`<br><small class="muted">${money(r.totals.net_cur, r.currency)} excl.</small>` : ''}`, csv: r => csvMoney(r.totals.payable) },
      { label: 'Openstaand', num: true, sort: 'open', render: r => money(r.outstanding), csv: r => csvMoney(r.outstanding) },
    ];
    if (req.query.format === 'csv') return sendCsv(res, 'inkooporders.csv', cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page);
    const statuses = Object.entries(P.STATUS_LABELS).map(([value, label]) => ({ value, label }));
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Ordernummer, leverancier, referentie', attrs: 'type="search"' })}
        ${field('Ontvangststatus', 'status', q.status, { type: 'select', blank: 'Alle', options: statuses })}
        ${field('Betaalstatus', 'betaling', q.betaling, { type: 'select', blank: 'Alle', options: ['onbetaald', 'gedeeltelijk betaald', 'betaald', 'te veel betaald'].map(x => ({ value: x, label: x })) })}
        ${field('Leverancier', 'leverancier', q.leverancier, { type: 'select', blank: 'Alle', options: opts(catalog.listSuppliers(db, { status: null })) })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/inkoop', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card">${table({ columns: cols, rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/inkoop', query: q, empty: html`Geen inkooporders gevonden. <a href="/inkoop/nieuw">Maak een inkooporder</a>.` })}${pager(pg, '/inkoop', q)}</div>`;
    page(req, res, { title: 'Inkoop', active: 'inkoop', body, actions: html`<a class="btn" href="/inkoop/nieuw">+ Inkooporder</a>` });
  });

  function form(req, res, po, v = null, errors = {}, status = 200) {
    const suppliers = catalog.listSuppliers(db, { status: 'active' });
    const variants = catalog.variantOptions(db);
    const prices = {};
    for (const r of db.all('SELECT supplier_id, variant_id, price_cents, currency, vat_rate_bp, vat_treatment FROM supplier_items')) prices[`${r.supplier_id}:${r.variant_id}`] = { p: M.centsToInput(r.price_cents), c: r.currency, v: M.bpToInput(r.vat_rate_bp) };
    const val = (k, d) => (v && v[k] !== undefined ? v[k] : po ? po[k] : d);
    const lines = v?.lines ? (Array.isArray(v.lines) ? v.lines : Object.values(v.lines)) : po ? po.lines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: M.centsToInput(l.unit_price_cents), discount: M.bpToInput(l.discount_bp), vat: M.bpToInput(l.vat_rate_bp) })) : [{ qty: 1, vat: '21' }];
    const row = (l, i) => html`<tr data-line>
      <td><label class="sr-only" for="pl-v-${i}">Product</label><select id="pl-v-${i}" name="lines[${i}][variant_id]" required data-variant-select><option value="">— Kies product —</option>${variants.map(x => html`<option value="${x.id}"${String(x.id) === String(l.variant_id ?? '') ? raw(' selected') : ''}>${x.product_name} – ${x.sku}${x.name ? ` (${x.name})` : ''}</option>`)}</select></td>
      <td><label class="sr-only" for="pl-q-${i}">Aantal</label><input id="pl-q-${i}" name="lines[${i}][qty]" value="${l.qty ?? ''}" inputmode="numeric" class="w-sm" required></td>
      <td><label class="sr-only" for="pl-p-${i}">Stukprijs excl. btw</label><input id="pl-p-${i}" name="lines[${i}][unit_price]" value="${l.unit_price ?? ''}" inputmode="decimal" class="w-md" placeholder="0,00" data-unit-price></td>
      <td><label class="sr-only" for="pl-d-${i}">Korting %</label><input id="pl-d-${i}" name="lines[${i}][discount]" value="${l.discount ?? ''}" inputmode="decimal" class="w-sm" placeholder="0"></td>
      <td><label class="sr-only" for="pl-b-${i}">Btw %</label><input id="pl-b-${i}" name="lines[${i}][vat]" value="${l.vat ?? '21'}" inputmode="decimal" class="w-sm" data-line-vat></td>
      <td><button type="button" class="btn btn-ghost btn-sm" data-remove-line aria-label="Regel verwijderen">✕</button></td></tr>`;
    const body = html`<form method="post" class="card form" novalidate data-po-form data-supplier-prices="${JSON.stringify(prices)}">
      ${csrfInput(req)}${po ? '' : idemInput()}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Leverancier', 'supplier_id', val('supplier_id', req.query.leverancier), { type: 'select', required: true, options: opts(suppliers), errors, attrs: 'data-supplier-select', help: suppliers.length ? null : 'Voeg eerst een leverancier toe.' })}
        ${field('Besteldatum', 'order_date', val('order_date', M.todayIso()), { type: 'date', required: true, errors })}
        ${field('Verwachte levering', 'expected_date', val('expected_date'), { type: 'date', errors })}
        ${field('Referentie leverancier', 'reference', val('reference'), { errors, placeholder: 'bijv. offerte- of ordernummer' })}
        ${field('Valuta', 'currency', val('currency', 'EUR'), { errors, attrs: 'maxlength="3" data-currency', help: 'Bedragen van de regels in deze valuta (excl. btw).' })}
        ${field('Wisselkoers naar EUR', 'fx_rate', v ? v.fx_rate : po ? M.fxToInput(po.fx_rate_micro) : '1', { errors, inputmode: 'decimal', help: 'Aantal euro per 1 eenheid vreemde valuta (bijv. 0,9215 voor USD). Wordt bij de order vastgelegd.' })}
      </div>
      <h2>Orderregels</h2>
      <div class="table-wrap"><table class="lines" data-lines><thead><tr><th>Product *</th><th>Aantal *</th><th>Stukprijs excl. btw</th><th>Korting %</th><th>Btw %</th><th><span class="sr-only">Acties</span></th></tr></thead>
        <tbody>${lines.map(row)}</tbody></table></div>
      <template data-line-template>${row({ qty: 1, vat: '21' }, '__i__')}</template>
      <button type="button" class="btn btn-ghost btn-sm" data-add-line>+ Regel toevoegen</button>
      <h2>Directe bijkomende kosten (in EUR, excl. btw)</h2>
      <div class="grid-form">
        ${moneyField('Verzendkosten', 'shipping', v ? v.shipping : po?.shipping_cents ?? '', { errors })}
        ${moneyField('Invoerrechten', 'duties', v ? v.duties : po?.duties_cents ?? '', { errors })}
        ${moneyField('Overige directe kosten', 'other_costs', v ? v.other_costs : po?.other_costs_cents ?? '', { errors })}
        ${field('Verdeelmethode', 'allocation_method', val('allocation_method', 'value'), { type: 'select', blank: false, options: Object.entries(P.ALLOCATION_LABELS).map(([value, label]) => ({ value, label })), help: 'Hoe bijkomende kosten over de producten worden verdeeld voor de voorraadkostprijs.' })}
      </div>
      ${field('Btw op deze inkoop is terugvorderbaar (voorbelasting)', 'vat_recoverable', v ? v.vat_recoverable : po ? po.vat_recoverable : (req.settings.vatRecoverable ? 1 : 0), { type: 'checkbox', help: 'Niet aangevinkt: de btw wordt onderdeel van de voorraadkostprijs.' })}
      <input type="hidden" name="vat_recoverable" value="0" data-checkbox-fallback>
      ${field('Notities', 'notes', val('notes'), { type: 'textarea', rows: 2 })}
      ${po ? '' : field('Direct markeren als besteld', 'status', v ? v.status === 'ordered' : true, { type: 'checkbox', attrs: 'data-status-ordered' })}
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="${po ? `/inkoop/${po.id}` : '/inkoop'}">Annuleren</a></div>
    </form>`;
    page(req, res, { title: po ? `${po.number} bewerken` : 'Nieuwe inkooporder', active: 'inkoop', body }, status);
  }

  const normalize = b => ({ ...b, status: b.status === '1' || b.status === 'ordered' ? 'ordered' : 'draft', vat_recoverable: Array.isArray(b.vat_recoverable) ? b.vat_recoverable.includes('1') ? '1' : '0' : b.vat_recoverable });
  app.get('/inkoop/nieuw', (req, res) => form(req, res, null));
  app.post('/inkoop/nieuw', (req, res) => {
    try { const id = P.savePo(db, normalize(req.body), req.user); req.addFlash('success', 'Inkooporder opgeslagen.'); res.redirect(303, `/inkoop/${id}`); }
    catch (e) { formError(e, errors => form(req, res, null, req.body, errors, 422)); }
  });
  app.get('/inkoop/:id/bewerken', (req, res, next) => { const po = P.getPo(db, Number(req.params.id)); if (!po) return next(); form(req, res, po); });
  app.post('/inkoop/:id/bewerken', (req, res, next) => {
    const po = P.getPo(db, Number(req.params.id)); if (!po) return next();
    try { P.savePo(db, normalize(req.body), req.user, po.id); req.addFlash('success', 'Inkooporder bijgewerkt.'); res.redirect(303, `/inkoop/${po.id}`); }
    catch (e) { formError(e, errors => form(req, res, po, req.body, errors, 422)); }
  });
  app.post('/inkoop/:id/status', action((req, res) => {
    P.setStatus(db, Number(req.params.id), req.body.action, req.user, req.body.reason);
    req.addFlash('success', req.body.action === 'order' ? 'Order gemarkeerd als besteld.' : 'Order geannuleerd.');
    res.redirect(303, `/inkoop/${req.params.id}`);
  }));
  app.post('/inkoop/:id/ontvangen', action((req, res) => {
    const r = P.receive(db, Number(req.params.id), { date: req.body.date, quantities: req.body.qty || {}, notes: req.body.notes, idem: req.body.idem }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze ontvangst was al verwerkt; er is niets dubbel geboekt.' : 'Ontvangst geboekt; voorraad is verhoogd.');
    res.redirect(303, `/inkoop/${req.params.id}`);
  }));
  app.post('/inkoop/:id/betalen', action((req, res) => {
    const r = payments.recordPayment(db, { ...req.body, kind: 'purchase', ref_id: Number(req.params.id) }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze betaling was al geregistreerd.' : 'Betaling geregistreerd.');
    res.redirect(303, `/inkoop/${req.params.id}`);
  }));

  app.get('/inkoop/:id', (req, res, next) => {
    const po = P.getPo(db, Number(req.params.id)); if (!po) return next();
    const canWrite = req.user.role === 'admin';
    const editable = ['draft', 'ordered'].includes(po.status) && !po.receipts.length;
    const canReceive = ['ordered', 'partial'].includes(po.status);
    const fx = po.currency !== 'EUR';
    const body = html`
    <div class="grid-2">
      <section class="card"><h2>${po.number}</h2>
        <p>${statusBadge(P.STATUS_LABELS[po.status].toLowerCase())} ${statusBadge(po.payStatus)}</p>
        <dl class="dl">
          <dt>Leverancier</dt><dd><a href="/leveranciers/${po.supplier_id}">${po.supplier_name}</a></dd>
          <dt>Besteldatum</dt><dd>${date(po.order_date)}</dd>
          <dt>Verwachte levering</dt><dd>${date(po.expected_date)}</dd>
          <dt>Referentie</dt><dd>${po.reference || '–'}</dd>
          <dt>Valuta</dt><dd>${po.currency}${fx ? html` · koers ${M.fxToInput(po.fx_rate_micro)} EUR per ${po.currency}` : ''}</dd>
          <dt>Btw</dt><dd>${po.vat_recoverable ? 'Terugvorderbaar (niet in kostprijs)' : 'Niet terugvorderbaar (in kostprijs)'}</dd>
          ${po.notes ? html`<dt>Notities</dt><dd class="prewrap">${po.notes}</dd>` : ''}
        </dl>
        ${canWrite ? html`<div class="row-actions">
          ${editable ? html`<a class="btn btn-sm btn-ghost" href="/inkoop/${po.id}/bewerken">Bewerken</a>` : ''}
          ${po.status === 'draft' ? html`<form method="post" action="/inkoop/${po.id}/status">${csrfInput(req)}<input type="hidden" name="action" value="order"><button class="btn btn-sm" type="submit">Markeer als besteld</button></form>` : ''}
          ${editable && po.paid === 0 ? html`<form method="post" action="/inkoop/${po.id}/status" class="inline">${csrfInput(req)}<input type="hidden" name="action" value="cancel"><input type="hidden" name="reason" value="Geannuleerd door gebruiker"><button class="btn btn-sm btn-ghost" type="submit" data-confirm="Inkooporder annuleren?">Annuleren</button></form>` : ''}
        </div>` : ''}
      </section>
      <section class="card"><h2>Bedragen</h2>
        <dl class="dl">
          ${fx ? html`<dt>Goederen excl. btw (${po.currency})</dt><dd>${money(po.totals.net_cur, po.currency)}</dd>` : ''}
          <dt>Goederen excl. btw (EUR)</dt><dd>${money(po.totals.net_eur)}</dd>
          <dt>Btw (EUR)</dt><dd>${money(po.totals.vat_eur)}</dd>
          <dt>Bijkomende kosten</dt><dd>${money(po.totals.extras)} <small class="muted">(verzending ${money(po.shipping_cents)}, invoer ${money(po.duties_cents)}, overig ${money(po.other_costs_cents)})</small></dd>
          <dt><strong>Te betalen</strong></dt><dd><strong>${money(po.status === 'cancelled' ? 0 : po.totals.payable)}</strong></dd>
          <dt>Betaald</dt><dd>${money(po.paid)}</dd>
          <dt>Openstaand</dt><dd>${money(po.outstanding)}</dd>
          <dt>Voorraadwaarde (landed)</dt><dd>${money(po.totals.landed)}</dd>
        </dl>
      </section>
    </div>
    <section class="card"><h2>Orderregels en kostprijs</h2>
      ${table({ columns: [
        { label: 'Product', render: l => html`${l.product_name} <small class="muted">${l.variant_name || ''}</small><br><small class="muted">${l.sku}</small>` },
        { label: 'Besteld', num: true, render: l => num(l.qty) },
        { label: 'Ontvangen', num: true, render: l => html`${num(l.received_qty)}${l.remaining_qty > 0 && po.status !== 'cancelled' ? html`<br><small class="muted">nog ${l.remaining_qty}</small>` : ''}` },
        { label: 'Stukprijs', num: true, render: l => money(l.unit_price_cents, po.currency) },
        { label: 'Korting', num: true, render: l => (l.discount_bp ? pct(l.discount_bp) : '–') },
        { label: 'Netto EUR', num: true, render: l => money(l.net_eur) },
        { label: 'Btw EUR', num: true, render: l => money(l.vat_eur) },
        { label: 'Toegerekende kosten', num: true, render: l => money(l.extra_eur) },
        { label: 'Kostprijs regel', num: true, render: l => money(l.landed_eur) },
        { label: 'Per stuk', num: true, render: l => money(l.landed_unit) },
      ], rows: po.lines })}
      <p class="help"><strong>Verdeelmethode:</strong> ${P.ALLOCATION_LABELS[po.allocation_method]}. Bijkomende kosten (${money(po.totals.extras)}) worden met de grootste-restmethode in hele centen over de regels verdeeld.
      Kostprijs regel = netto EUR + toegerekende kosten${po.vat_recoverable ? '' : ' + btw (niet terugvorderbaar)'}. Bij een gedeeltelijke ontvangst gaat het evenredige deel naar de voorraad; de laatste ontvangst van een regel krijgt het exacte restant.</p>
    </section>
    ${canWrite && canReceive ? html`<section class="card" id="ontvangen"><h2>Voorraad ontvangen</h2>
      <form method="post" action="/inkoop/${po.id}/ontvangen" class="form">${csrfInput(req)}${idemInput()}
        <div class="grid-form">${field('Ontvangstdatum', 'date', M.todayIso(), { type: 'date', required: true })}${field('Notities (bijv. pakbonnummer)', 'notes', '')}</div>
        <div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">Nog te ontvangen</th><th class="num">Nu ontvangen</th></tr></thead><tbody>
        ${po.lines.filter(l => l.remaining_qty > 0).map(l => html`<tr><td>${l.product_name} <small class="muted">${l.sku}</small></td><td class="num">${l.remaining_qty}</td>
          <td class="num"><label class="sr-only" for="rq-${l.id}">Ontvangen ${l.sku}</label><input id="rq-${l.id}" name="qty[${l.id}]" value="${l.remaining_qty}" inputmode="numeric" class="w-sm num"></td></tr>`)}
        </tbody></table></div>
        <p class="help">De voorraad wordt pas verhoogd bij deze registratie. Dubbel indienen wordt herkend en niet opnieuw verwerkt.</p>
        <button class="btn" type="submit">Ontvangst boeken</button>
      </form></section>` : ''}
    <div class="grid-2">
      <section class="card"><h2>Ontvangsten</h2>
        ${po.receipts.length ? po.receipts.map(r => html`<div class="subcard"><strong>${date(r.received_date)}</strong>${r.notes ? html` · ${r.notes}` : ''}
          <ul class="plain">${r.lines.map(l => html`<li>${l.qty} × ${l.sku} — goederen ${money(l.goods_cents)} + kosten ${money(l.extra_cents)} = ${money(l.goods_cents + l.extra_cents)}</li>`)}</ul></div>`) : html`<p class="muted">Nog niets ontvangen.</p>`}
      </section>
      <section class="card"><h2>Betalingen</h2>
        ${paymentsTable(req, po.payments)}
        ${canWrite && po.status !== 'cancelled' && po.status !== 'draft' && po.outstanding > 0 ? html`<details class="mt"${po.payments.length ? '' : raw(' open')}><summary class="btn btn-ghost btn-sm">+ Betaling registreren</summary>
          ${paymentForm(req, db, { action: `/inkoop/${po.id}/betalen`, amount: po.outstanding, currency: po.currency, fxRate: po.fx_rate_micro, label: 'Betaald aan leverancier' })}</details>` : ''}
        ${po.status === 'draft' ? html`<p class="help">Markeer de order eerst als besteld om betalingen te registreren.</p>` : ''}
      </section>
    </div>`;
    page(req, res, { title: `Inkooporder ${po.number}`, active: 'inkoop', body, actions: html`<a class="btn btn-ghost" href="/inkoop">← Alle inkooporders</a>` });
  });
};

function paymentsTable(req, list) {
  return table({ columns: [
    { label: 'Datum', render: p => date(p.pay_date) },
    { label: 'Methode', render: p => p.method_name || '–' },
    { label: 'Referentie', render: p => p.reference || '–' },
    { label: 'Bedrag', num: true, render: p => html`<span class="${p.voided ? 'strike' : ''}">${p.kind === 'refund' ? '−' : ''}${money(p.amount_cents)}</span>${p.currency !== 'EUR' && p.original_amount_cents ? html`<br><small class="muted">${money(p.original_amount_cents, p.currency)} @ ${M.fxToInput(p.fx_rate_micro)}</small>` : ''}` },
    { label: '', render: p => (p.voided ? html`<small class="muted">vervallen: ${p.void_reason}</small>` : req.user.role === 'admin' ? html`<form method="post" action="/betalingen/${p.id}/vervallen" class="inline">${csrfInput(req)}<input type="hidden" name="reason" value="Onjuist geregistreerd"><button class="btn btn-ghost btn-xs" type="submit" data-confirm="Betaling als vervallen markeren? Ze blijft zichtbaar in de historie." data-prompt-reason>Laten vervallen</button></form>` : '') },
  ], rows: list, empty: 'Nog geen betalingen.' });
}

function paymentForm(req, db, { action, amount, currency = 'EUR', fxRate, label = 'Betaling', methodId }) {
  return html`<form method="post" action="${action}" class="stack compact">${csrfInput(req)}${idemInput()}
    <div class="grid-form">
      ${field('Datum', 'date', M.todayIso(), { type: 'date', required: true })}
      ${field(`${label} (EUR)`, 'amount', M.centsToInput(amount), { required: true, inputmode: 'decimal', help: 'Bedrag in euro zoals afgeschreven/bijgeschreven.' })}
      ${field('Betaalmethode', 'method_id', methodId || '', { type: 'select', options: opts(C.lookups(db, 'payment_method')) })}
      ${field('Referentie', 'reference', '', { placeholder: 'bijv. transactie-ID' })}
    </div>
    ${currency !== 'EUR' ? html`<details><summary>Betaald in ${currency}?</summary><div class="grid-form">
      ${field('Valuta', 'currency', '', { placeholder: currency, help: `Vul ${currency} in om het oorspronkelijke bedrag vast te leggen.` })}
      ${field(`Oorspronkelijk bedrag`, 'original_amount', '', { inputmode: 'decimal' })}
      ${field('Wisselkoers naar EUR', 'fx_rate', M.fxToInput(fxRate), { inputmode: 'decimal' })}</div></details>` : ''}
    <button class="btn btn-sm" type="submit">Betaling registreren</button>
  </form>`;
}

module.exports.paymentsTable = paymentsTable;
module.exports.paymentForm = paymentForm;
