'use strict';
const { html, raw, money, date, num, qs, field, table, statusBadge, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const catalog = require('../services/catalog');
const purchasing = require('../services/purchasing');
const { supplierItemForm } = require('./products');

module.exports = (app, { db }) => {
  app.get('/leveranciers', (req, res) => {
    const q = { q: req.query.q || '', status: req.query.status || 'active', land: req.query.land || '', sort: req.query.sort || 'name', dir: req.query.dir || 'asc' };
    let rows = catalog.listSuppliers(db, { q: q.q, status: q.status === 'all' ? null : q.status, country: q.land });
    rows = sortRows(rows, q.sort, q.dir, { name: r => r.name, country: r => r.country || '', spent: r => r.spent, items: r => r.item_count, open: r => r.open_orders });
    const cols = [
      { label: 'Leverancier', sort: 'name', render: r => html`<a href="/leveranciers/${r.id}">${r.name}</a>${r.contact_name ? html`<br><small class="muted">${r.contact_name}</small>` : ''}`, csv: r => r.name },
      { label: 'Land', sort: 'country', render: r => r.country || '–', csv: r => r.country || '' },
      { label: 'Contact', render: r => html`${r.email ? html`<a href="mailto:${r.email}">${r.email}</a>` : ''}${r.phone ? html`<br>${r.phone}` : ''}`, csv: r => [r.email, r.phone].filter(Boolean).join(' / ') },
      { label: 'Artikelen', num: true, sort: 'items', render: r => num(r.item_count), csv: r => r.item_count },
      { label: 'Open orders', num: true, sort: 'open', render: r => num(r.open_orders), csv: r => r.open_orders },
      { label: 'Besteed (betaald)', num: true, sort: 'spent', render: r => money(r.spent), csv: r => csvMoney(r.spent) },
      { label: 'Status', render: r => statusBadge(r.status === 'active' ? 'actief' : 'gearchiveerd'), csv: r => r.status },
    ];
    if (req.query.format === 'csv') return sendCsv(res, 'leveranciers.csv', cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page);
    const countries = db.all("SELECT DISTINCT country FROM suppliers WHERE country IS NOT NULL AND country <> '' ORDER BY country");
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Naam, contact of e-mail', attrs: 'type="search"' })}
        ${field('Land', 'land', q.land, { type: 'select', blank: 'Alle landen', options: countries.map(c => ({ value: c.country, label: c.country })) })}
        ${field('Status', 'status', q.status, { type: 'select', blank: false, options: [{ value: 'active', label: 'Actief' }, { value: 'archived', label: 'Gearchiveerd' }, { value: 'all', label: 'Alle' }] })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/leveranciers', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card">${table({ columns: cols, rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/leveranciers', query: q, empty: html`Nog geen leveranciers. <a href="/leveranciers/nieuw">Voeg een leverancier toe</a>.` })}${pager(pg, '/leveranciers', q)}</div>`;
    page(req, res, { title: 'Leveranciers', active: 'leveranciers', body, actions: html`<a class="btn" href="/leveranciers/nieuw">+ Leverancier</a><a class="btn btn-ghost" href="/import?type=suppliers">Importeren</a>` });
  });

  function form(req, res, s, v = {}, errors = {}, status = 200) {
    const val = k => (v[k] !== undefined ? v[k] : s?.[k]);
    const body = html`<form method="post" class="card form" novalidate>${csrfInput(req)}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Bedrijfsnaam', 'name', val('name'), { required: true, errors, class: 'span-2' })}
        ${field('Contactpersoon', 'contact_name', val('contact_name'), { errors })}
        ${field('E-mail', 'email', val('email'), { type: 'email', errors })}
        ${field('Telefoon', 'phone', val('phone'), { type: 'tel', errors })}
        ${field('Website', 'website', val('website'), { errors, placeholder: 'https://' })}
        ${field('Land', 'country', val('country'), { errors })}
        ${field('Btw-nummer', 'vat_number', val('vat_number'), { errors })}
        ${field('Adres', 'address', val('address'), { type: 'textarea', rows: 2, errors, class: 'span-2' })}
        ${field('Betaalvoorwaarden', 'payment_terms', val('payment_terms'), { errors, placeholder: 'bijv. 14 dagen, vooruitbetaling' })}
        ${field('Notities', 'notes', val('notes'), { type: 'textarea', rows: 3, errors, class: 'span-2' })}
      </div>
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="${s ? `/leveranciers/${s.id}` : '/leveranciers'}">Annuleren</a></div></form>`;
    page(req, res, { title: s ? `${s.name} bewerken` : 'Nieuwe leverancier', active: 'leveranciers', body }, status);
  }
  app.get('/leveranciers/nieuw', (req, res) => form(req, res, null));
  app.post('/leveranciers/nieuw', (req, res) => {
    try { const id = catalog.saveSupplier(db, req.body, req.user); req.addFlash('success', 'Leverancier opgeslagen.'); res.redirect(303, `/leveranciers/${id}`); }
    catch (e) { formError(e, errors => form(req, res, null, req.body, errors, 422)); }
  });
  app.get('/leveranciers/:id/bewerken', (req, res, next) => { const s = catalog.getSupplier(db, Number(req.params.id)); if (!s) return next(); form(req, res, s); });
  app.post('/leveranciers/:id/bewerken', (req, res, next) => {
    const s = catalog.getSupplier(db, Number(req.params.id)); if (!s) return next();
    try { catalog.saveSupplier(db, req.body, req.user, s.id); req.addFlash('success', 'Wijzigingen opgeslagen.'); res.redirect(303, `/leveranciers/${s.id}`); }
    catch (e) { formError(e, errors => form(req, res, s, req.body, errors, 422)); }
  });
  app.post('/leveranciers/:id/status', action((req, res) => {
    catalog.setSupplierStatus(db, Number(req.params.id), req.body.status, req.user);
    req.addFlash('success', req.body.status === 'archived' ? 'Leverancier gearchiveerd; historie blijft bewaard.' : 'Leverancier weer actief.');
    res.redirect(303, `/leveranciers/${req.params.id}`);
  }));

  app.get('/leveranciers/:id', (req, res, next) => {
    const s = catalog.getSupplier(db, Number(req.params.id)); if (!s) return next();
    const canWrite = req.user.role === 'admin';
    const variants = catalog.variantOptions(db);
    const body = html`
    <div class="grid-2">
      <section class="card"><h2>${s.name} ${statusBadge(s.status === 'active' ? 'actief' : 'gearchiveerd')}</h2>
        <dl class="dl">
          <dt>Contactpersoon</dt><dd>${s.contact_name || '–'}</dd>
          <dt>E-mail</dt><dd>${s.email ? html`<a href="mailto:${s.email}">${s.email}</a>` : '–'}</dd>
          <dt>Telefoon</dt><dd>${s.phone || '–'}</dd>
          <dt>Website</dt><dd>${s.website ? html`<a href="${s.website}" rel="noopener noreferrer" target="_blank">${s.website}</a>` : '–'}</dd>
          <dt>Land</dt><dd>${s.country || '–'}</dd>
          <dt>Adres</dt><dd class="prewrap">${s.address || '–'}</dd>
          <dt>Btw-nummer</dt><dd>${s.vat_number || '–'}</dd>
          <dt>Betaalvoorwaarden</dt><dd>${s.payment_terms || '–'}</dd>
          ${s.notes ? html`<dt>Notities</dt><dd class="prewrap">${s.notes}</dd>` : ''}
        </dl>
        ${canWrite ? html`<div class="row-actions"><a class="btn btn-sm" href="/leveranciers/${s.id}/bewerken">Bewerken</a>
          <a class="btn btn-sm btn-ghost" href="/inkoop/nieuw?leverancier=${s.id}">+ Inkooporder</a>
          <form method="post" action="/leveranciers/${s.id}/status">${csrfInput(req)}<input type="hidden" name="status" value="${s.status === 'active' ? 'archived' : 'active'}">
          <button class="btn btn-ghost btn-sm" type="submit">${s.status === 'active' ? 'Archiveren' : 'Activeren'}</button></form></div>` : ''}
      </section>
      <section class="card"><h2>Financieel</h2>
        <dl class="dl">
          <dt>Besteed aan inkooporders (betaald)</dt><dd>${money(s.spentPurchases)}</dd>
          <dt>Besteed aan uitgaven (betaald)</dt><dd>${money(s.spentExpenses)}</dd>
          <dt>Ontvangen goederenwaarde</dt><dd>${money(s.receivedValue)}</dd>
          <dt>Openstaand te betalen (orders)</dt><dd>${money(s.openPayable)}</dd>
          <dt>Openstaande orders</dt><dd>${num(s.openOrders.length)}</dd>
        </dl>
      </section>
    </div>
    <section class="card"><h2>Producten bij deze leverancier</h2>
      ${table({ columns: [
        { label: 'Product', render: r => html`<a href="/producten/${r.product_id}">${r.product_name}</a> <small class="muted">${r.variant_name || ''}</small>` },
        { label: 'SKU / art.nr. leverancier', render: r => html`${r.sku}${r.supplier_sku ? html`<br><small class="muted">${r.supplier_sku}</small>` : ''}` },
        { label: 'Inkoopprijs', num: true, render: r => html`${money(r.price_cents, r.currency)}${r.preferred ? html` <span class="badge badge-ok">voorkeur</span>` : ''}` },
        { label: 'Btw', render: r => ({ standard: M.formatPercent(r.vat_rate_bp), reverse_charge: 'verlegd', exempt: 'vrijgesteld' })[r.vat_treatment] },
        { label: 'MOQ', num: true, render: r => num(r.moq) },
        { label: 'Levertijd', render: r => (r.lead_days != null ? `${r.lead_days} d` : '–') },
        { label: 'Prijsopgave', render: r => date(r.quote_date) },
        { label: 'Prijshistorie', render: r => html`<details><summary>${r.history.length} wijziging(en)</summary><ul class="plain">${r.history.map(h => html`<li>${date(h.quote_date) !== '–' ? date(h.quote_date) : M.formatDateTime(h.changed_at)}: ${money(h.price_cents, h.currency)}</li>`)}</ul></details>` },
      ], rows: s.items, empty: 'Nog geen producten gekoppeld.' })}
      ${canWrite ? html`<details class="mt"><summary class="btn btn-ghost btn-sm">+ Product / inkoopprijs toevoegen of bijwerken</summary>
        ${supplierItemForm(req, { variants: variants.map(v => ({ ...v })), suppliers: [], back: `/leveranciers/${s.id}`, supplierId: s.id })}</details>` : ''}
    </section>
    <section class="card"><h2>Inkooporders</h2>
      ${table({ columns: [
        { label: 'Order', render: r => html`<a href="/inkoop/${r.id}">${r.number}</a>` },
        { label: 'Besteldatum', render: r => date(r.order_date) },
        { label: 'Status', render: r => statusBadge(purchasing.STATUS_LABELS[r.status].toLowerCase()) },
        { label: 'Betaling', render: r => statusBadge(r.payStatus) },
        { label: 'Totaal (EUR)', num: true, render: r => money(r.totals.payable) },
        { label: 'Openstaand', num: true, render: r => money(r.outstanding) },
      ], rows: s.orders, empty: 'Nog geen inkooporders.' })}
    </section>`;
    page(req, res, { title: s.name, active: 'leveranciers', body, actions: html`<a class="btn btn-ghost" href="/leveranciers">← Alle leveranciers</a>` });
  });
};
void raw;
