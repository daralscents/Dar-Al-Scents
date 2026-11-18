'use strict';
const { html, raw, money, date, pct, num, qs, field, moneyField, opts, table, statusBadge, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, idemInput, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const C = require('../services/common');
const catalog = require('../services/catalog');
const S = require('../services/sales');
const E = require('../services/expenses');
const payments = require('../services/payments');
const { paymentsTable, paymentForm } = require('./purchasing');

module.exports = (app, { db }) => {
  app.get('/verkopen', (req, res) => {
    const q = { q: req.query.q || '', van: req.query.van || '', tot: req.query.tot || '', kanaal: req.query.kanaal || '', status: req.query.status || '', uitlevering: req.query.uitlevering || '', betaling: req.query.betaling || '', campagne: req.query.campagne || '', sort: req.query.sort || 'date', dir: req.query.dir || 'desc' };
    let rows = S.listSales(db, { q: q.q, from: q.van, to: q.tot, channelId: q.kanaal ? Number(q.kanaal) : null, status: q.status, fulfillment: q.uitlevering, payStatus: q.betaling, campaignId: q.campagne ? Number(q.campagne) : null });
    rows = sortRows(rows, q.sort, q.dir, { date: r => r.sale_date, number: r => r.number, total: r => r.totals.total, open: r => r.outstanding, channel: r => r.channel_name || '' });
    const cols = [
      { label: 'Verkoop', sort: 'number', render: r => html`<a href="/verkopen/${r.id}">${r.number}</a>${r.external_ref ? html`<br><small class="muted">${r.external_ref}</small>` : ''}`, csv: r => r.number },
      { label: 'Extern ordernr.', render: r => r.external_ref || '', csv: r => r.external_ref || '', hide: true },
      { label: 'Datum', sort: 'date', render: r => date(r.sale_date), csv: r => r.sale_date },
      { label: 'Kanaal', sort: 'channel', render: r => html`${r.channel_name || '–'}${r.campaign_name ? html`<br><small class="muted">${r.campaign_name}</small>` : ''}`, csv: r => r.channel_name || '' },
      { label: 'Klant', render: r => r.customer_ref || '–', csv: r => r.customer_ref || '' },
      { label: 'Status', render: r => html`${statusBadge(S.STATUS_LABELS[r.status].toLowerCase())} ${statusBadge(S.FULFILLMENT_LABELS[r.fulfillment_status].toLowerCase())} ${statusBadge(r.payStatus)}`, csv: r => `${S.STATUS_LABELS[r.status]} / ${S.FULFILLMENT_LABELS[r.fulfillment_status]} / ${r.payStatus}` },
      { label: 'Totaal incl. btw', num: true, sort: 'total', render: r => money(r.totals.total), csv: r => csvMoney(r.totals.total) },
      { label: 'Netto excl. btw', num: true, render: r => money(r.totals.net), csv: r => csvMoney(r.totals.net) },
      { label: 'Openstaand', num: true, sort: 'open', render: r => money(r.outstanding), csv: r => csvMoney(r.outstanding) },
    ];
    if (req.query.format === 'csv') return sendCsv(res, 'verkopen.csv', cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page);
    const totals = rows.filter(r => r.status !== 'cancelled').reduce((a, r) => ({ total: a.total + r.totals.total - r.totals.returned_gross, open: a.open + Math.max(0, r.outstanding) }), { total: 0, open: 0 });
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Ordernummer, klant of SKU', attrs: 'type="search"' })}
        ${field('Van', 'van', q.van, { type: 'date' })}${field('Tot en met', 'tot', q.tot, { type: 'date' })}
        ${field('Kanaal', 'kanaal', q.kanaal, { type: 'select', blank: 'Alle', options: opts(C.lookups(db, 'sales_channel', { includeArchived: true })) })}
        ${field('Orderstatus', 'status', q.status, { type: 'select', blank: 'Alle', options: Object.entries(S.STATUS_LABELS).map(([value, label]) => ({ value, label })) })}
        ${field('Uitlevering', 'uitlevering', q.uitlevering, { type: 'select', blank: 'Alle', options: Object.entries(S.FULFILLMENT_LABELS).map(([value, label]) => ({ value, label })) })}
        ${field('Betaling', 'betaling', q.betaling, { type: 'select', blank: 'Alle', options: ['onbetaald', 'gedeeltelijk betaald', 'betaald', 'te veel betaald', 'terugbetaald'].map(x => ({ value: x, label: x })) })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/verkopen', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card"><p class="scope">${rows.length} verkopen · totaal incl. btw (na retour, excl. geannuleerd) ${money(totals.total)} · openstaand ${money(totals.open)}</p>
      ${table({ columns: cols.filter(c => !c.hide), rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/verkopen', query: q, empty: html`Geen verkopen gevonden. <a href="/verkopen/nieuw">Registreer een verkoop</a>.` })}${pager(pg, '/verkopen', q)}</div>`;
    page(req, res, { title: 'Verkopen', active: 'verkopen', body, actions: html`<a class="btn" href="/verkopen/nieuw">+ Verkoop</a><a class="btn btn-ghost" href="/verkopen/overig">Overige inkomsten &amp; financiering</a><a class="btn btn-ghost" href="/import?type=sales">Importeren</a>` });
  });

  function form(req, res, sale, v = null, errors = {}, status = 200) {
    const variants = catalog.variantOptions(db);
    const val = (k, d) => (v && v[k] !== undefined ? v[k] : sale ? sale[k] : d);
    const lines = v?.lines ? (Array.isArray(v.lines) ? v.lines : Object.values(v.lines)) : sale ? sale.lines.map(l => ({ variant_id: l.variant_id, qty: l.qty, unit_price: M.centsToInput(l.unit_price_incl_cents), discount: l.discount_cents ? M.centsToInput(l.discount_cents) : '', vat: M.bpToInput(l.vat_rate_bp) })) : [{ qty: 1 }];
    const row = (l, i) => html`<tr data-line>
      <td><label class="sr-only" for="sl-v-${i}">Product</label><select id="sl-v-${i}" name="lines[${i}][variant_id]" required data-variant-select data-fill-price>
        <option value="">— Kies product —</option>${variants.map(x => html`<option value="${x.id}" data-price="${M.centsToInput(x.price_incl_cents)}" data-vat="${M.bpToInput(x.vat_rate_bp)}" data-stock="${x.stock}"${String(x.id) === String(l.variant_id ?? '') ? raw(' selected') : ''}>${x.product_name} – ${x.sku}${x.name ? ` (${x.name})` : ''} · voorraad ${x.stock}</option>`)}</select></td>
      <td><label class="sr-only" for="sl-q-${i}">Aantal</label><input id="sl-q-${i}" name="lines[${i}][qty]" value="${l.qty ?? ''}" inputmode="numeric" class="w-sm" required data-calc></td>
      <td><label class="sr-only" for="sl-p-${i}">Stukprijs incl. btw</label><input id="sl-p-${i}" name="lines[${i}][unit_price]" value="${l.unit_price ?? ''}" inputmode="decimal" class="w-md" placeholder="prijslijst" data-unit-price data-calc></td>
      <td><label class="sr-only" for="sl-d-${i}">Korting</label><input id="sl-d-${i}" name="lines[${i}][discount]" value="${l.discount ?? ''}" class="w-sm" placeholder="€ of %" data-calc></td>
      <td><label class="sr-only" for="sl-b-${i}">Btw %</label><input id="sl-b-${i}" name="lines[${i}][vat]" value="${l.vat ?? ''}" inputmode="decimal" class="w-sm" placeholder="auto" data-line-vat data-calc></td>
      <td class="num" data-line-total>–</td>
      <td><button type="button" class="btn btn-ghost btn-sm" data-remove-line aria-label="Regel verwijderen">✕</button></td></tr>`;
    const body = html`<form method="post" class="card form" novalidate data-sale-form>
      ${csrfInput(req)}${sale ? '' : idemInput()}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Verkoopdatum', 'sale_date', val('sale_date', M.todayIso()), { type: 'date', required: true, errors })}
        ${field('Verkoopkanaal', 'channel_id', val('channel_id'), { type: 'select', options: opts(C.lookups(db, 'sales_channel')), errors })}
        ${field('Betaalmethode', 'payment_method_id', val('payment_method_id'), { type: 'select', options: opts(C.lookups(db, 'payment_method')), errors })}
        ${field('Extern ordernummer', 'external_ref', val('external_ref'), { errors, help: 'Optioneel, bijv. webshopordernummer. Moet uniek zijn.' })}
        ${field('Klantreferentie', 'customer_ref', val('customer_ref'), { errors, placeholder: 'naam, e-mail of klantnummer' })}
        ${field('Klanttype', 'new_customer', val('new_customer') == null ? '' : String(val('new_customer')), { type: 'select', blank: 'Onbekend', options: [{ value: '1', label: 'Nieuwe klant' }, { value: '0', label: 'Bestaande klant' }], help: 'Nodig voor betrouwbare CAC-berekening.' })}
        ${field('Campagne', 'campaign_id', val('campaign_id'), { type: 'select', blank: 'Geen', options: opts(db.all('SELECT id, name FROM campaigns WHERE archived = 0 ORDER BY name')) })}
        ${field('Marketingbron', 'marketing_source', val('marketing_source'), { errors, placeholder: 'bijv. Instagram-post, influencer, mond-tot-mond', attrs: 'list="sources"' })}
      </div>
      <datalist id="sources">${db.all("SELECT DISTINCT marketing_source AS s FROM sales WHERE marketing_source <> '' ORDER BY 1").map(r => html`<option value="${r.s}">`)}</datalist>
      <h2>Producten</h2>
      <p class="help">Prijs incl. btw wordt uit de prijslijst ingevuld en als historische prijs op de regel opgeslagen. Korting als bedrag (€) of percentage (bijv. 10%).</p>
      <div class="table-wrap"><table class="lines" data-lines><thead><tr><th>Product *</th><th>Aantal *</th><th>Stukprijs incl.</th><th>Korting</th><th>Btw %</th><th class="num">Regeltotaal</th><th><span class="sr-only">Acties</span></th></tr></thead>
        <tbody>${lines.map(row)}</tbody></table></div>
      <template data-line-template>${row({ qty: 1 }, '__i__')}</template>
      <button type="button" class="btn btn-ghost btn-sm" data-add-line>+ Regel toevoegen</button>
      <div class="grid-form mt">
        ${moneyField('Verzendopbrengst incl. btw', 'shipping', v ? v.shipping : sale ? sale.shipping_gross_cents : '', { errors, attrs: 'data-calc data-shipping' })}
        ${field('Btw over verzending %', 'shipping_vat', v ? v.shipping_vat : sale ? M.bpToInput(sale.shipping_vat_bp) : M.bpToInput(req.settings.shippingVatBp), { inputmode: 'decimal' })}
        <div class="field"><span class="label-like">Ordertotaal incl. btw</span><output class="big" data-order-total>–</output></div>
      </div>
      ${field('Notities', 'notes', val('notes'), { type: 'textarea', rows: 2 })}
      ${sale ? '' : html`<fieldset class="options"><legend>Direct verwerken</legend>
        ${field('Direct uitleveren (voorraad afboeken)', 'fulfill', v ? v.fulfill : 1, { type: 'checkbox', help: 'Uit voor bestellingen die later worden verzonden.' })}
        ${field('Volledig betaald ontvangen', 'paid', v ? v.paid : 0, { type: 'checkbox', help: 'Registreert een betaling voor het volledige bedrag op de verkoopdatum.' })}
      </fieldset>`}
      ${errors.confirm_duplicate ? field('Ja, dit is een tweede, aparte verkoop', 'confirm_duplicate', 0, { type: 'checkbox', errors }) : ''}
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="${sale ? `/verkopen/${sale.id}` : '/verkopen'}">Annuleren</a></div>
    </form>`;
    page(req, res, { title: sale ? `${sale.number} bewerken` : 'Nieuwe verkoop', active: 'verkopen', body }, status);
  }
  const normalize = b => ({ ...b, fulfill: C.bool(b.fulfill), paid: C.bool(b.paid) });
  app.get('/verkopen/nieuw', (req, res) => form(req, res, null));
  app.post('/verkopen/nieuw', (req, res) => {
    try {
      const r = S.createSale(db, normalize(req.body), req.user);
      req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze verkoop was al opgeslagen (dubbel verzonden formulier).' : `Verkoop ${r.number} opgeslagen.`);
      res.redirect(303, `/verkopen/${r.id}`);
    } catch (e) { formError(e, errors => form(req, res, null, req.body, errors, 422)); }
  });
  app.get('/verkopen/:id/bewerken', (req, res, next) => { const s = S.getSale(db, Number(req.params.id)); if (!s) return next(); form(req, res, s); });
  app.post('/verkopen/:id/bewerken', (req, res, next) => {
    const s = S.getSale(db, Number(req.params.id)); if (!s) return next();
    try { S.updateSale(db, s.id, req.body, req.user); req.addFlash('success', 'Verkoop bijgewerkt.'); res.redirect(303, `/verkopen/${s.id}`); }
    catch (e) { formError(e, errors => form(req, res, s, req.body, errors, 422)); }
  });
  app.post('/verkopen/:id/uitleveren', action((req, res) => {
    const r = S.fulfill(db, Number(req.params.id), { date: req.body.date }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze verkoop was al uitgeleverd; er is niets dubbel afgeboekt.' : 'Uitgeleverd: voorraad afgeboekt en kostprijs vastgelegd.');
    res.redirect(303, `/verkopen/${req.params.id}`);
  }));
  app.post('/verkopen/:id/betaling', action((req, res) => {
    const kind = req.body.kind === 'refund' ? 'refund' : 'sale';
    const r = payments.recordPayment(db, { ...req.body, kind, ref_id: Number(req.params.id) }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze betaling was al geregistreerd.' : kind === 'refund' ? 'Terugbetaling geregistreerd.' : 'Betaling ontvangen en geregistreerd.');
    res.redirect(303, `/verkopen/${req.params.id}`);
  }));
  app.post('/verkopen/:id/retour', action((req, res) => {
    const r = S.processReturn(db, Number(req.params.id), { date: req.body.date, quantities: req.body.qty || {}, restock: req.body.restock, reason: req.body.reason, idem: req.body.idem }, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze retour was al verwerkt.' : 'Retour verwerkt. Registreer zo nodig de terugbetaling.');
    res.redirect(303, `/verkopen/${req.params.id}`);
  }));
  app.post('/verkopen/:id/annuleren', action((req, res) => {
    S.cancelSale(db, Number(req.params.id), req.body.reason, req.user);
    req.addFlash('success', 'Verkoop geannuleerd.');
    res.redirect(303, `/verkopen/${req.params.id}`);
  }));
  app.post('/betalingen/:id/vervallen', action((req, res) => {
    payments.voidPayment(db, Number(req.params.id), req.body.reason, req.user);
    req.addFlash('success', 'Betaling gemarkeerd als vervallen.');
    res.redirect(303, req.get('referer') && new URL(req.get('referer')).host === req.get('host') ? new URL(req.get('referer')).pathname : '/');
  }));

  app.get('/verkopen/:id', (req, res, next) => {
    const s = S.getSale(db, Number(req.params.id)); if (!s) return next();
    const canWrite = req.user.role === 'admin';
    const unfulfilled = s.fulfillment_status === 'unfulfilled';
    const cancelled = s.status === 'cancelled';
    const returnable = !unfulfilled && s.lines.some(l => l.qty > l.returned_qty);
    const body = html`
    <div class="grid-2">
      <section class="card"><h2>${s.number}${s.external_ref ? html` <small class="muted">${s.external_ref}</small>` : ''}</h2>
        <p>${statusBadge(S.STATUS_LABELS[s.status].toLowerCase())} ${statusBadge(S.FULFILLMENT_LABELS[s.fulfillment_status].toLowerCase())} ${statusBadge(s.payStatus)}</p>
        <dl class="dl">
          <dt>Verkoopdatum</dt><dd>${date(s.sale_date)}</dd>
          <dt>Uitgeleverd op</dt><dd>${date(s.fulfilled_date)}</dd>
          <dt>Kanaal</dt><dd>${s.channel_name || '–'}</dd>
          <dt>Betaalmethode</dt><dd>${s.method_name || '–'}</dd>
          <dt>Klant</dt><dd>${s.customer_ref || '–'} ${s.new_customer === 1 ? html`<span class="badge badge-info">nieuwe klant</span>` : s.new_customer === 0 ? html`<span class="badge">bestaande klant</span>` : ''}</dd>
          <dt>Marketing</dt><dd>${[s.campaign_name, s.marketing_source].filter(Boolean).join(' · ') || '–'}</dd>
          ${s.notes ? html`<dt>Notities</dt><dd class="prewrap">${s.notes}</dd>` : ''}
          ${s.cancel_reason ? html`<dt>Geannuleerd</dt><dd>${s.cancel_reason}</dd>` : ''}
        </dl>
        ${canWrite && !cancelled ? html`<div class="row-actions">
          ${unfulfilled ? html`<a class="btn btn-sm btn-ghost" href="/verkopen/${s.id}/bewerken">Bewerken</a>
            <form method="post" action="/verkopen/${s.id}/uitleveren" class="inline">${csrfInput(req)}<input type="hidden" name="date" value="${M.todayIso()}"><button class="btn btn-sm" type="submit">Uitleveren (vandaag)</button></form>
            <form method="post" action="/verkopen/${s.id}/annuleren" class="inline">${csrfInput(req)}<input type="hidden" name="reason" value=""><button class="btn btn-sm btn-ghost" type="submit" data-prompt-reason="Reden van annulering">Annuleren</button></form>` : ''}
        </div>` : ''}
      </section>
      <section class="card"><h2>Bedragen</h2>
        <dl class="dl">
          <dt>Producten incl. btw</dt><dd>${money(s.totals.lines_gross)}${s.totals.discount ? html` <small class="muted">(na ${money(s.totals.discount)} korting)</small>` : ''}</dd>
          <dt>Verzending incl. btw</dt><dd>${money(s.totals.shipping_gross)}</dd>
          <dt><strong>Totaal incl. btw</strong></dt><dd><strong>${money(s.totals.total)}</strong></dd>
          <dt>Waarvan btw</dt><dd>${money(s.totals.vat)}</dd>
          <dt>Netto-omzet excl. btw</dt><dd>${money(s.totals.net)}</dd>
          ${s.totals.returned_gross ? html`<dt>Geretourneerd incl. btw</dt><dd>−${money(s.totals.returned_gross)}</dd>` : ''}
          <dt>Ontvangen</dt><dd>${money(s.received)}${s.refunded ? html` · terugbetaald ${money(s.refunded)}` : ''}</dd>
          <dt>${s.outstanding < 0 ? 'Terug te betalen' : 'Openstaand'}</dt><dd class="${s.outstanding !== 0 ? 'warn-text' : ''}">${money(Math.abs(s.outstanding))}</dd>
          ${s.grossProfit != null ? html`<dt>Kostprijs (COGS)</dt><dd>${money(s.totals.cogs - s.totals.cogs_reversed)}</dd><dt>Brutowinst</dt><dd>${money(s.grossProfit)} <small class="muted">(${pct(M.marginBp(s.grossProfit, s.totals.net - s.totals.returned_net))})</small></dd>` : ''}
        </dl>
      </section>
    </div>
    <section class="card"><h2>Regels</h2>
      ${table({ columns: [
        { label: 'Product', render: l => html`${l.description}<br><small class="muted">${l.sku}</small>` },
        { label: 'Aantal', num: true, render: l => html`${num(l.qty)}${l.returned_qty ? html`<br><small class="muted">${l.returned_qty} retour</small>` : ''}` },
        { label: 'Stukprijs incl.', num: true, render: l => money(l.unit_price_incl_cents) },
        { label: 'Korting', num: true, render: l => (l.discount_cents ? `−${money(l.discount_cents)}` : '–') },
        { label: 'Btw', num: true, render: l => pct(l.vat_rate_bp) },
        { label: 'Incl. btw', num: true, render: l => money(l.gross_cents) },
        { label: 'Excl. btw', num: true, render: l => money(l.net_cents) },
        { label: 'Kostprijs', num: true, render: l => (l.cogs_cents == null ? html`<small class="muted">bij uitlevering</small>` : money(l.cogs_cents)) },
      ], rows: s.lines })}
      <p class="help">Prijs, korting en btw zijn bij het vastleggen opgeslagen; latere wijzigingen van de prijslijst veranderen deze verkoop niet.</p>
    </section>
    <div class="grid-2">
      <section class="card"><h2>Betalingen</h2>
        ${paymentsTable(req, s.payments)}
        ${canWrite && !cancelled && s.outstanding > 0 ? html`<details class="mt" open><summary class="btn btn-ghost btn-sm">+ Betaling ontvangen</summary>
          ${paymentForm(req, db, { action: `/verkopen/${s.id}/betaling`, amount: s.outstanding, label: 'Ontvangen bedrag', methodId: s.payment_method_id })}</details>` : ''}
        ${canWrite && s.outstanding < 0 ? html`<details class="mt" open><summary class="btn btn-ghost btn-sm">+ Terugbetaling registreren</summary>
          <form method="post" action="/verkopen/${s.id}/betaling" class="stack compact">${csrfInput(req)}${idemInput()}<input type="hidden" name="kind" value="refund">
          <div class="grid-form">${field('Datum', 'date', M.todayIso(), { type: 'date', required: true })}${field('Terug te betalen (EUR)', 'amount', M.centsToInput(-s.outstanding), { required: true, inputmode: 'decimal' })}
          ${field('Methode', 'method_id', s.payment_method_id, { type: 'select', options: opts(C.lookups(db, 'payment_method')) })}${field('Referentie', 'reference', '')}</div>
          <button class="btn btn-sm" type="submit">Terugbetaling registreren</button></form></details>` : ''}
      </section>
      <section class="card"><h2>Retouren</h2>
        ${s.returns.length ? s.returns.map(r => html`<div class="subcard"><strong>${date(r.return_date)}</strong> · ${r.restock ? 'terug op voorraad' : 'niet terug op voorraad'}${r.reason ? html` · ${r.reason}` : ''}
          <ul class="plain">${r.lines.map(l => html`<li>${l.qty} × ${l.sku}: −${money(l.gross_cents)} incl. btw (−${money(l.net_cents)} excl.)</li>`)}</ul></div>`) : html`<p class="muted">Geen retouren.</p>`}
        ${canWrite && returnable ? html`<details class="mt"><summary class="btn btn-ghost btn-sm">+ Retour verwerken</summary>
          <form method="post" action="/verkopen/${s.id}/retour" class="stack compact">${csrfInput(req)}${idemInput()}
            <div class="grid-form">${field('Retourdatum', 'date', M.todayIso(), { type: 'date', required: true })}${field('Reden', 'reason', '')}</div>
            <div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">Max.</th><th class="num">Retour</th></tr></thead><tbody>
            ${s.lines.filter(l => l.qty > l.returned_qty).map(l => html`<tr><td>${l.sku}</td><td class="num">${l.qty - l.returned_qty}</td><td class="num"><label class="sr-only" for="ret-${l.id}">Retour ${l.sku}</label><input id="ret-${l.id}" name="qty[${l.id}]" value="0" inputmode="numeric" class="w-sm num"></td></tr>`)}
            </tbody></table></div>
            ${field('Terug op voorraad (product is verkoopbaar)', 'restock', true, { type: 'checkbox', help: 'Uit bij beschadigde retouren: de kostprijs blijft dan als verlies in het resultaat.' })}
            <button class="btn btn-sm" type="submit">Retour verwerken</button></form></details>` : ''}
      </section>
    </div>`;
    page(req, res, { title: `Verkoop ${s.number}`, active: 'verkopen', body, actions: html`<a class="btn btn-ghost" href="/verkopen">← Alle verkopen</a>` });
  });

  // Overige inkomsten en financiering ------------------------------------------------------
  app.get('/verkopen/overig', (req, res) => {
    const rows = E.listEntries(db, { from: req.query.van, to: req.query.tot, type: req.query.type });
    const canWrite = req.user.role === 'admin';
    const types = Object.entries(E.ENTRY_TYPES).map(([value, t]) => ({ value, label: t.label }));
    const body = html`<div class="card"><p class="help">Overige inkomsten (bijv. vergoedingen) tellen als overige opbrengsten in het operationeel resultaat. Leningen, aflossingen, privéstortingen en -opnames zijn financieringskasstromen: ze tellen mee in de kasstroom maar niet in omzet of resultaat.</p>
      ${table({ columns: [
        { label: 'Datum', render: r => date(r.entry_date) },
        { label: 'Soort', render: r => html`${r.typeInfo.label}${r.typeInfo.financing ? html` <span class="badge badge-info">financiering</span>` : ''}` },
        { label: 'Omschrijving', render: r => html`<a href="/verkopen/overig/${r.id}">${r.description}</a>${r.category_name ? html` <small class="muted">${r.category_name}</small>` : ''}` },
        { label: 'Bedrag', num: true, render: r => html`<span class="${r.typeInfo.direction === 'out' ? 'neg' : ''}">${r.typeInfo.direction === 'out' ? '−' : ''}${money(r.total_cents)}</span>` },
        { label: 'Status', render: r => (r.status === 'cancelled' ? statusBadge('geannuleerd') : statusBadge(r.payStatus)) },
      ], rows, empty: 'Nog geen overige posten.' })}</div>
      ${canWrite ? html`<section class="card" id="nieuw"><h2>Nieuwe post</h2>
        <form method="post" action="/verkopen/overig" class="form">${csrfInput(req)}${idemInput()}
          <div class="grid-form">
            ${field('Soort', 'type', 'other_income', { type: 'select', blank: false, required: true, options: types })}
            ${field('Datum', 'entry_date', M.todayIso(), { type: 'date', required: true })}
            ${field('Omschrijving', 'description', '', { required: true, class: 'span-2' })}
            ${moneyField('Bedrag excl. btw', 'amount', '', { required: true })}
            ${field('Btw % (alleen overige inkomsten)', 'vat_rate', '0', { inputmode: 'decimal' })}
            ${field('Inkomstencategorie', 'category_id', '', { type: 'select', options: opts(C.lookups(db, 'income_category')) })}
            ${field('Betaalmethode', 'payment_method_id', '', { type: 'select', options: opts(C.lookups(db, 'payment_method')) })}
          </div>
          ${field('Bedrag is al ontvangen', 'paid', true, { type: 'checkbox', help: 'Financieringsposten worden altijd direct als kasstroom vastgelegd.' })}
          <button class="btn" type="submit">Opslaan</button></form></section>` : ''}`;
    page(req, res, { title: 'Overige inkomsten & financiering', active: 'verkopen', body, actions: html`<a class="btn btn-ghost" href="/verkopen">← Verkopen</a>` });
  });
  app.post('/verkopen/overig', action((req, res) => {
    const r = E.saveEntry(db, req.body, req.user);
    req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Al opgeslagen.' : 'Post opgeslagen.');
    res.redirect(303, `/verkopen/overig/${r.id}`);
  }));
  app.get('/verkopen/overig/:id', (req, res, next) => {
    const e = E.getEntry(db, Number(req.params.id)); if (!e) return next();
    const canWrite = req.user.role === 'admin';
    const body = html`<div class="grid-2"><section class="card"><h2>${e.description}</h2>
      <p>${e.typeInfo.label} ${e.status === 'cancelled' ? statusBadge('geannuleerd') : statusBadge(e.payStatus)}</p>
      <dl class="dl"><dt>Datum</dt><dd>${date(e.entry_date)}</dd><dt>Bedrag excl. btw</dt><dd>${money(e.amount_excl_cents)}</dd><dt>Btw</dt><dd>${money(e.vat_cents)}</dd><dt>Totaal</dt><dd>${money(e.total_cents)}</dd>
      ${e.category_name ? html`<dt>Categorie</dt><dd>${e.category_name}</dd>` : ''}${e.cancel_reason ? html`<dt>Geannuleerd</dt><dd>${e.cancel_reason}</dd>` : ''}</dl>
      ${canWrite && e.status === 'active' && e.paid === 0 ? html`<form method="post" action="/verkopen/overig/${e.id}/annuleren">${csrfInput(req)}<input type="hidden" name="reason" value=""><button class="btn btn-ghost btn-sm" type="submit" data-prompt-reason="Reden van annulering">Annuleren</button></form>` : ''}
      </section><section class="card"><h2>Betalingen</h2>${paymentsTable(req, e.payments)}
      ${canWrite && e.status === 'active' && e.outstanding > 0 ? paymentForm(req, db, { action: `/verkopen/overig/${e.id}/betaling`, amount: e.outstanding, label: e.typeInfo.direction === 'in' ? 'Ontvangen' : 'Betaald' }) : ''}</section></div>`;
    page(req, res, { title: e.typeInfo.label, active: 'verkopen', body, actions: html`<a class="btn btn-ghost" href="/verkopen/overig">← Overige posten</a>` });
  });
  app.post('/verkopen/overig/:id/betaling', action((req, res) => {
    const e = E.getEntry(db, Number(req.params.id));
    payments.recordPayment(db, { ...req.body, kind: e?.typeInfo.financing ? 'financing' : 'other_income', ref_id: Number(req.params.id) }, req.user);
    req.addFlash('success', 'Betaling geregistreerd.');
    res.redirect(303, `/verkopen/overig/${req.params.id}`);
  }));
  app.post('/verkopen/overig/:id/annuleren', action((req, res) => {
    E.cancelEntry(db, Number(req.params.id), req.body.reason, req.user);
    req.addFlash('success', 'Post geannuleerd.');
    res.redirect(303, `/verkopen/overig/${req.params.id}`);
  }));
};
