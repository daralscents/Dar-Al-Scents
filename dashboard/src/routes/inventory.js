'use strict';
const { html, raw, money, date, num, qs, field, moneyField, table, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, idemInput, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const I = require('../services/inventory');
const catalog = require('../services/catalog');

module.exports = (app, { db }) => {
  app.get('/voorraad', (req, res) => {
    const q = { q: req.query.q || '', filter: req.query.filter || '', peildatum: req.query.peildatum || '', sort: req.query.sort || 'product', dir: req.query.dir || 'asc' };
    let asOf = null;
    try { asOf = M.parseDate(q.peildatum, { label: 'Peildatum' }); } catch (e) { req.flash.push({ type: 'error', msg: e.message }); }
    let rows = I.stockOverview(db, { asOf, includeArchived: q.filter === 'all' });
    if (q.q) rows = rows.filter(r => `${r.product_name} ${r.variant_name} ${r.sku} ${r.brand || ''}`.toLowerCase().includes(q.q.toLowerCase()));
    if (q.filter === 'low') rows = rows.filter(r => r.low && r.status === 'active');
    if (q.filter === 'instock') rows = rows.filter(r => r.qty > 0);
    rows = sortRows(rows, q.sort, q.dir, { product: r => `${r.product_name} ${r.variant_name}`, sku: r => r.sku, qty: r => r.qty, value: r => r.value, avg: r => r.avg });
    const totalValue = rows.reduce((a, r) => a + r.value, 0);
    const cols = [
      { label: 'Product', sort: 'product', render: r => html`<a href="/voorraad/variant/${r.id}">${r.product_name}</a>${r.variant_name ? html` <small class="muted">${r.variant_name}</small>` : ''}`, csv: r => `${r.product_name} ${r.variant_name || ''}`.trim() },
      { label: 'SKU', sort: 'sku', key: 'sku', csv: r => r.sku },
      { label: 'Voorraad', num: true, sort: 'qty', render: r => html`<span class="${r.low ? 'warn-text' : ''}">${num(r.qty)}</span>${r.qty < 0 ? html` <span class="badge badge-danger">negatief</span>` : r.low ? html` <span class="badge badge-warn">laag</span>` : ''}`, csv: r => r.qty },
      { label: 'Minimum', num: true, render: r => num(r.min_stock), csv: r => r.min_stock },
      { label: 'Gem. kostprijs', num: true, sort: 'avg', render: r => money(r.avg), csv: r => csvMoney(r.avg) },
      { label: 'Voorraadwaarde', num: true, sort: 'value', render: r => money(r.value), csv: r => csvMoney(r.value) },
    ];
    if (req.query.format === 'csv') return sendCsv(res, `voorraad${asOf ? '-' + asOf : ''}.csv`, cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page, 100);
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Product of SKU', attrs: 'type="search"' })}
        ${field('Toon', 'filter', q.filter, { type: 'select', blank: 'Actieve varianten', options: [{ value: 'low', label: 'Alleen lage voorraad' }, { value: 'instock', label: 'Alleen op voorraad' }, { value: 'all', label: 'Inclusief gearchiveerd' }] })}
        ${field('Peildatum', 'peildatum', q.peildatum, { type: 'date', help: 'Leeg = vandaag' })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/voorraad', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card"><p class="scope">Totale voorraadwaarde${asOf ? ` per ${date(asOf)}` : ''}: <strong>${money(totalValue)}</strong> · waardering: gewogen gemiddelde kostprijs. Voorraad wordt afgeboekt bij uitlevering van een verkoop; een betaling verandert de voorraad nooit.</p>
      ${table({ columns: cols, rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/voorraad', query: q, empty: html`Nog geen varianten. <a href="/producten/nieuw">Voeg een product toe</a>.` })}${pager(pg, '/voorraad', q)}</div>`;
    page(req, res, { title: 'Voorraad', active: 'voorraad', body, actions: html`<a class="btn" href="/voorraad/mutatie">+ Mutatie</a><a class="btn btn-ghost" href="/voorraad/beginvoorraad">Beginvoorraad</a><a class="btn btn-ghost" href="/voorraad/mutaties">Mutatiehistorie</a><a class="btn btn-ghost" href="/inkoop?status=ordered">Ontvangen</a>` });
  });

  function movementsTable(req, rows, { showVariant = true } = {}) {
    const canWrite = req.user.role === 'admin';
    return table({ columns: [
      { label: 'Datum', render: r => date(r.move_date) },
      ...(showVariant ? [{ label: 'Product', render: r => html`<a href="/voorraad/variant/${r.variant_id}">${r.sku}</a> <small class="muted">${r.product_name}</small>` }] : []),
      { label: 'Soort', render: r => html`${I.TYPE_LABELS[r.type]}${r.reverses_id ? html` <span class="badge badge-muted">tegenboeking #${r.reverses_id}</span>` : ''}${r.reversed_by ? html` <span class="badge badge-muted">tegengeboekt</span>` : ''}` },
      { label: 'Document / reden', render: r => html`${r.sale_id ? html`<a href="/verkopen/${r.sale_id}">${r.sale_number}</a> ` : ''}${r.po_id ? html`<a href="/inkoop/${r.po_id}">${r.po_number}</a> ` : ''}${r.reason || ''}` },
      { label: 'Aantal', num: true, render: r => html`<span class="${r.qty < 0 ? 'neg' : 'pos'}">${r.qty > 0 ? '+' : ''}${num(r.qty)}</span>` },
      { label: 'Waarde', num: true, render: r => money(r.value_cents) },
      ...(showVariant ? [] : [{ label: 'Saldo', num: true, render: r => num(r.balance) }, { label: 'Waarde saldo', num: true, render: r => money(r.balance_value) }]),
      { label: 'Door', render: r => r.user_name || '–' },
      { label: '', render: r => (canWrite && ['opening', ...I.MANUAL_TYPES].includes(r.type) && !r.reverses_id && !r.reversed_by ? html`<form method="post" action="/voorraad/mutaties/${r.id}/tegenboeken" class="inline">${csrfInput(req)}<input type="hidden" name="reason" value="">
          <button class="btn btn-ghost btn-xs" type="submit" data-prompt-reason="Reden van de tegenboeking">Tegenboeken</button></form>` : '') },
    ], rows, empty: 'Nog geen mutaties.' });
  }

  const MOVE_SQL = `SELECT m.*, v.sku, p.name AS product_name, u.name AS user_name,
      sl.sale_id, s.number AS sale_number, r.po_id, po.number AS po_number,
      (SELECT id FROM stock_movements x WHERE x.reverses_id = m.id) AS reversed_by
    FROM stock_movements m JOIN variants v ON v.id = m.variant_id JOIN products p ON p.id = v.product_id
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN sale_lines sl ON sl.id = COALESCE(m.sale_line_id, (SELECT sale_line_id FROM sale_return_lines WHERE id = m.return_line_id))
    LEFT JOIN sales s ON s.id = sl.sale_id
    LEFT JOIN po_receipt_lines rl ON rl.id = m.receipt_line_id LEFT JOIN po_receipts r ON r.id = rl.receipt_id LEFT JOIN purchase_orders po ON po.id = r.po_id`;

  app.get('/voorraad/mutaties', (req, res) => {
    const q = { type: req.query.type || '', van: req.query.van || '', tot: req.query.tot || '', q: req.query.q || '' };
    const rows = db.all(`${MOVE_SQL} WHERE (:type IS NULL OR m.type = :type) AND (:van IS NULL OR m.move_date >= :van) AND (:tot IS NULL OR m.move_date <= :tot)
      AND (:q IS NULL OR v.sku LIKE :ql OR p.name LIKE :ql OR m.reason LIKE :ql) ORDER BY m.move_date DESC, m.id DESC`,
    { type: q.type || null, van: q.van || null, tot: q.tot || null, q: q.q || null, ql: `%${q.q}%` });
    if (req.query.format === 'csv') {
      return sendCsv(res, 'voorraadmutaties.csv', [{ label: 'Datum', value: r => r.move_date }, { label: 'SKU', value: r => r.sku }, { label: 'Product', value: r => r.product_name },
        { label: 'Soort', value: r => I.TYPE_LABELS[r.type] }, { label: 'Document', value: r => r.sale_number || r.po_number || '' }, { label: 'Reden', value: r => r.reason || '' },
        { label: 'Aantal', value: r => r.qty }, { label: 'Waarde', value: r => csvMoney(r.value_cents) }, { label: 'Tegenboeking van', value: r => r.reverses_id || '' }], rows);
    }
    const pg = paginate(rows, req.query.page, 100);
    const body = html`<form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'SKU, product of reden', attrs: 'type="search"' })}
        ${field('Soort', 'type', q.type, { type: 'select', blank: 'Alle', options: Object.entries(I.TYPE_LABELS).map(([value, label]) => ({ value, label })) })}
        ${field('Van', 'van', q.van, { type: 'date' })}${field('Tot en met', 'tot', q.tot, { type: 'date' })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/voorraad/mutaties', { ...q, format: 'csv' })}">CSV-export</a></div></form>
      <div class="card">${movementsTable(req, pg.rows)}${pager(pg, '/voorraad/mutaties', q)}
      <p class="help">Mutaties zijn onveranderlijk. Fouten herstel je met een tegenboeking (handmatige mutaties en beginvoorraad), een retour (verkopen) of een correctie met reden.</p></div>`;
    page(req, res, { title: 'Voorraadmutaties', active: 'voorraad', body, actions: html`<a class="btn btn-ghost" href="/voorraad">← Voorraad</a>` });
  });

  app.get('/voorraad/variant/:id', (req, res, next) => {
    const v = db.get('SELECT v.*, p.name AS product_name, p.id AS pid FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?', [Number(req.params.id)]);
    if (!v) return next();
    const rows = db.all(`${MOVE_SQL} WHERE m.variant_id = ? ORDER BY m.move_date, m.id`, [v.id]);
    let bal = 0, balV = 0;
    for (const r of rows) { bal += r.qty; balV += r.value_cents; r.balance = bal; r.balance_value = balV; }
    rows.reverse();
    const s = I.stockOf(db, v.id);
    const body = html`<div class="card"><h2>${v.product_name} <small class="muted">${v.name} · ${v.sku}</small></h2>
      <p class="scope">Actuele voorraad <strong>${num(s.qty)}</strong> · waarde <strong>${money(s.value)}</strong> · gem. kostprijs <strong>${money(s.avg)}</strong> · minimum ${v.min_stock}</p>
      ${movementsTable(req, rows, { showVariant: false })}</div>`;
    page(req, res, { title: `Voorraad ${v.sku}`, active: 'voorraad', body, actions: html`<a class="btn btn-ghost" href="/producten/${v.pid}">Naar product</a><a class="btn" href="/voorraad/mutatie?variant=${v.id}">+ Mutatie</a>` });
  });

  // Beginvoorraad --------------------------------------------------------------------
  function openingForm(req, res, v = {}, errors = {}, status = 200) {
    const variants = catalog.variantOptions(db).filter(x => !db.get("SELECT 1 FROM stock_movements WHERE variant_id = ? AND type = 'opening'", [x.id]));
    const body = html`<form method="post" class="card form" novalidate>${csrfInput(req)}${idemInput()}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <p class="help">Leg per variant eenmalig de voorraad vast waarmee je start, met de kostprijs per stuk. Dit is geen inkoop en geen kostenpost; het vormt de startwaarde van je voorraad.</p>
      <div class="grid-form">
        ${field('Productvariant', 'variant_id', v.variant_id ?? req.query.variant, { type: 'select', required: true, errors, options: variants.map(x => ({ value: x.id, label: `${x.product_name} – ${x.sku}${x.name ? ` (${x.name})` : ''}` })), help: variants.length ? null : 'Alle varianten hebben al een beginvoorraad.' })}
        ${field('Aantal', 'qty', v.qty, { required: true, inputmode: 'numeric', errors })}
        ${moneyField('Kostprijs per stuk', 'unit_cost', v.unit_cost ?? '', { required: true, errors })}
        ${field('Datum', 'date', v.date || M.todayIso(), { type: 'date', required: true, errors })}
        ${field('Toelichting', 'reason', v.reason, { errors, class: 'span-2', placeholder: 'bijv. voorraadtelling 1 januari' })}
      </div>
      <div class="form-actions"><button class="btn" type="submit">Beginvoorraad vastleggen</button><a class="btn btn-ghost" href="/voorraad">Annuleren</a></div></form>`;
    page(req, res, { title: 'Beginvoorraad', active: 'voorraad', body }, status);
  }
  app.get('/voorraad/beginvoorraad', (req, res) => openingForm(req, res));
  app.post('/voorraad/beginvoorraad', (req, res) => {
    try {
      const r = I.recordOpening(db, req.body, req.user);
      req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Al verwerkt.' : 'Beginvoorraad vastgelegd.');
      res.redirect(303, '/voorraad/beginvoorraad');
    } catch (e) { formError(e, errors => openingForm(req, res, req.body, errors, 422)); }
  });

  // Handmatige mutatie ---------------------------------------------------------------
  function mutationForm(req, res, v = {}, errors = {}, status = 200) {
    const variants = catalog.variantOptions(db);
    const body = html`<form method="post" class="card form" novalidate>${csrfInput(req)}${idemInput()}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Soort', 'type', v.type || 'correction', { type: 'select', blank: false, required: true, errors, options: I.MANUAL_TYPES.map(t => ({ value: t, label: I.TYPE_LABELS[t] })),
          help: 'Beschadiging en sample/weggeefactie verlagen altijd de voorraad (kosten: voorraadafboeking). Correctie kan + of − zijn.' })}
        ${field('Productvariant', 'variant_id', v.variant_id ?? req.query.variant, { type: 'select', required: true, errors, options: variants.map(x => ({ value: x.id, label: `${x.product_name} – ${x.sku}${x.name ? ` (${x.name})` : ''} · voorraad ${x.stock}` })) })}
        ${field('Aantal', 'qty', v.qty, { required: true, errors, help: 'Bij correctie: negatief getal om af te boeken, positief om bij te boeken.' })}
        ${moneyField('Kostprijs per stuk (alleen bij positieve correctie)', 'unit_cost', v.unit_cost ?? '', { errors, help: 'Leeg = huidige gemiddelde kostprijs.' })}
        ${field('Datum', 'date', v.date || M.todayIso(), { type: 'date', required: true, errors })}
        ${field('Reden', 'reason', v.reason, { required: true, errors, class: 'span-2', placeholder: 'bijv. gebroken flacon bij inpakken' })}
      </div>
      <div class="form-actions"><button class="btn" type="submit">Mutatie boeken</button><a class="btn btn-ghost" href="/voorraad">Annuleren</a></div></form>`;
    page(req, res, { title: 'Voorraadmutatie', active: 'voorraad', body }, status);
  }
  app.get('/voorraad/mutatie', (req, res) => mutationForm(req, res));
  app.post('/voorraad/mutatie', (req, res) => {
    try {
      const r = I.recordManual(db, req.body, req.user);
      req.addFlash(r.duplicate ? 'info' : 'success', r.duplicate ? 'Deze mutatie was al verwerkt.' : 'Mutatie geboekt.');
      res.redirect(303, `/voorraad/variant/${req.body.variant_id}`);
    } catch (e) { formError(e, errors => mutationForm(req, res, req.body, errors, 422)); }
  });
  app.post('/voorraad/mutaties/:id/tegenboeken', action((req, res) => {
    const m = db.get('SELECT variant_id FROM stock_movements WHERE id = ?', [Number(req.params.id)]);
    I.reverseMovement(db, Number(req.params.id), req.body.reason, req.user);
    req.addFlash('success', 'Tegenboeking vastgelegd.');
    res.redirect(303, m ? `/voorraad/variant/${m.variant_id}` : '/voorraad/mutaties');
  }));
};
void raw;
