'use strict';
const { html, money, date, pct, num, qs, table, statusBadge, badge } = require('../views/html');
const { revenueCostChart, hbars } = require('../views/charts');
const { page, getPeriod, periodForm, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const R = require('../services/reports');
const inventory = require('../services/inventory');
const sales = require('../services/sales');
const { KIND_LABELS } = require('../services/payments');

const KPI = {
  omzet: { title: 'Omzet excl. btw', how: 'Netto regelbedragen (na korting) + netto verzendopbrengst van verkopen met uitleverdatum in de periode, minus netto retouren met retourdatum in de periode. Geannuleerde en niet-uitgeleverde verkopen tellen niet mee.' },
  ontvangen: { title: 'Ontvangen betalingen', how: 'Som van niet-vervallen klantbetalingen met betaaldatum in de periode. Terugbetalingen worden apart getoond.' },
  debiteuren: { title: 'Openstaande klantbetalingen', how: 'Per vandaag: totaal incl. btw van niet-geannuleerde verkopen (minus retouren) min ontvangen betalingen (plus terugbetalingen). Alleen positieve saldi.' },
  inkoop: { title: 'Inkoopuitgaven', how: 'Betalingen aan leveranciers voor inkooporders met betaaldatum in de periode (kasbasis). Voorraadinkoop is geen kostenpost: die komt via de kostprijs verkopen in het resultaat.' },
  kosten: { title: 'Overige bedrijfskosten', how: 'Uitgaven met uitgavedatum in de periode, excl. terugvorderbare btw (niet-terugvorderbare btw telt mee), plus voorraadafboekingen (beschadiging, samples, correcties).' },
  brutowinst: { title: 'Brutowinst', how: 'Netto-omzet minus kostprijs verkopen. De kostprijs wordt bij uitlevering vastgelegd tegen het gewogen gemiddelde; bij retour op voorraad komt het evenredige deel terug.' },
  resultaat: { title: 'Operationeel resultaat', how: 'Brutowinst − bedrijfskosten − voorraadafboekingen + overige opbrengsten. Leningen en privéstortingen tellen niet mee.' },
  kasstroom: { title: 'Netto kasstroom', how: 'Alle ontvangen min alle betaalde bedragen (niet-vervallen betalingen) met betaaldatum in de periode, inclusief financiering.' },
  voorraad: { title: 'Voorraadwaarde', how: 'Som van de waarde van alle voorraadmutaties tot en met de einddatum van de periode (gewogen gemiddelde kostprijs).' },
  'lage-voorraad': { title: 'Lage voorraad', how: 'Actieve varianten waarvan de actuele voorraad gelijk aan of lager is dan de ingestelde minimale voorraad.' },
  crediteuren: { title: 'Openstaande leveranciersbetalingen', how: 'Per vandaag: totaal incl. btw en bijkomende kosten van bestelde/ontvangen inkooporders plus actieve uitgaven, min betalingen.' },
};

module.exports = (app, { db }) => {
  app.get('/', (req, res) => {
    const p = getPeriod(req);
    const s = R.summary(db, p.from, p.to);
    const pq = { periode: p.key, van: p.key === 'custom' ? p.from : null, tot: p.key === 'custom' ? p.to : null };
    const link = key => qs(`/overzicht/${key}`, pq);
    const card = (key, value, sub, tone) => html`<a class="kpi${tone ? ' kpi-' + tone : ''}" href="${link(key)}">
      <span class="kpi-label">${KPI[key].title}</span><span class="kpi-value">${value}</span>${sub ? html`<span class="kpi-sub">${sub}</span>` : ''}
      <span class="kpi-how">${KPI[key].how}</span></a>`;
    const series = R.timeseries(db, p.from, p.to);
    const perf = R.productPerformance(db, p.from, p.to);
    const topQty = [...perf].sort((a, b) => b.qty - a.qty).filter(r => r.qty > 0).slice(0, 5);
    const topProfit = [...perf].filter(r => !r.cogsUnknown).sort((a, b) => b.gross - a.gross).filter(r => r.gross !== 0).slice(0, 5);
    const unknownCost = perf.filter(r => r.cogsUnknown);
    const recent = R.recentTransactions(db, 10);
    const empty = !db.get('SELECT 1 FROM sales UNION ALL SELECT 1 FROM expenses UNION ALL SELECT 1 FROM purchase_orders UNION ALL SELECT 1 FROM stock_movements LIMIT 1');
    const body = html`
    ${periodForm(req, p)}
    <p class="scope">Periode: <strong>${p.label}</strong> (${date(p.from)} t/m ${date(p.to)}). Openstaande posten en lage voorraad zijn per vandaag.</p>
    ${empty ? html`<div class="card onboarding"><h2>Welkom</h2><p>Je administratie is nog leeg. Een logische volgorde:</p>
      <ol><li><a href="/leveranciers/nieuw">Leveranciers toevoegen</a></li><li><a href="/producten/nieuw">Producten en varianten aanmaken</a> (of <a href="/import">importeren via CSV</a>)</li>
      <li><a href="/voorraad/beginvoorraad">Beginvoorraad vastleggen</a></li><li><a href="/verkopen/nieuw">Verkopen</a> en <a href="/uitgaven/nieuw">uitgaven</a> registreren</li></ol></div>` : ''}
    <section class="kpis" aria-label="Kerncijfers">
      ${card('omzet', money(s.revenue.net), html`Producten ${money(s.revenue.products)} · verzending ${money(s.revenue.shipping)}${s.revenue.returns ? html` · retour −${money(s.revenue.returns)}` : ''}`)}
      ${card('brutowinst', money(s.grossProfit), html`Brutomarge ${pct(s.grossMarginBp)} · kostprijs ${money(s.cogs.cogs)}`)}
      ${card('resultaat', money(s.operatingResult), html`Kosten ${money(s.expenses + s.writeoffs)}${s.otherIncome ? html` · overige opbrengsten ${money(s.otherIncome)}` : ''}`, s.operatingResult < 0 ? 'neg' : 'pos')}
      ${card('kasstroom', money(s.cash.net), html`In ${money(s.cash.totalIn)} · uit ${money(s.cash.totalOut)}${s.cash.financingIn || s.cash.financingOut ? html` · financiering ${money(s.cash.financingIn - s.cash.financingOut)}` : ''}`, s.cash.net < 0 ? 'neg' : null)}
      ${card('ontvangen', money(s.cash.salesIn), s.cash.refundsOut ? html`Terugbetaald ${money(s.cash.refundsOut)}` : 'Klantbetalingen')}
      ${card('debiteuren', money(s.receivables), `${s.receivablesCount} verkopen${s.unfulfilledCount ? ` · ${s.unfulfilledCount} nog niet uitgeleverd` : ''}`, s.receivables ? 'warn' : null)}
      ${card('inkoop', money(s.cash.purchaseOut), 'Betaald aan leveranciers')}
      ${card('kosten', money(s.expenses + s.writeoffs), html`Uitgaven ${money(s.expenses)}${s.writeoffs ? html` · afboekingen ${money(s.writeoffs)}` : ''}`)}
      ${card('voorraad', money(s.inventoryValue), `${num(s.inventoryQty)} stuks per ${date(p.to)}`)}
      ${card('lage-voorraad', String(s.lowStock.length), s.lowStock.length ? s.lowStock.slice(0, 3).map(r => r.sku).join(', ') + (s.lowStock.length > 3 ? ' …' : '') : 'Alles op peil', s.lowStock.length ? 'warn' : null)}
      ${card('crediteuren', money(s.payables), `${s.payablesCount} posten`, s.payables ? 'warn' : null)}
    </section>
    <div class="grid-2">
      <section class="card span-2"><h2>Omzet en kosten door de tijd</h2>${revenueCostChart(series)}</section>
      <section class="card"><h2>Omzet per verkoopkanaal</h2>${hbars(R.revenueByChannel(db, p.from, p.to), { title: 'Omzet per verkoopkanaal' })}</section>
      <section class="card"><h2>Kosten per categorie</h2>${hbars(R.costsByCategory(db, p.from, p.to), { title: 'Kosten per categorie', color: '#6b7a8f' })}</section>
      <section class="card"><h2>Bestverkochte producten</h2>
        ${table({ columns: [{ label: 'Product', render: r => html`${r.description}<br><small class="muted">${r.sku}</small>` }, { label: 'Aantal', num: true, render: r => num(r.qty) }, { label: 'Netto-omzet', num: true, render: r => money(r.net) }], rows: topQty, empty: 'Nog geen uitgeleverde verkopen in deze periode.' })}</section>
      <section class="card"><h2>Hoogste brutowinst</h2>
        ${table({ columns: [{ label: 'Product', render: r => html`${r.description}<br><small class="muted">${r.sku}</small>` }, { label: 'Brutowinst', num: true, render: r => money(r.gross) }, { label: 'Marge', num: true, render: r => pct(r.marginBp) }], rows: topProfit, empty: 'Nog geen brutowinst in deze periode.' })}
        ${unknownCost.length ? html`<p class="help warn-text">Let op: ${unknownCost.length} verkochte ${unknownCost.length === 1 ? 'product heeft' : 'producten hebben'} geen inkoopprijs (samen ${money(unknownCost.reduce((a, r) => a + r.net, 0))} netto-omzet). De brutowinst is daardoor te hoog. Zie <a href="/rapporten/producten">Productprestaties</a>.</p>` : ''}</section>
      <section class="card span-2"><h2>Recente transacties</h2>
        ${table({ columns: [
          { label: 'Datum', render: r => date(r.date) },
          { label: 'Soort', render: r => ({ sale: 'Verkoop', expense: 'Uitgave', payment: 'Betaling', po: 'Inkooporder' })[r.type] },
          { label: 'Omschrijving', render: r => html`<a href="${({ sale: `/verkopen/${r.id}`, expense: `/uitgaven/${r.id}`, payment: `/rapporten/betalingen`, po: `/inkoop/${r.id}` })[r.type]}">${r.type === 'payment' ? (KIND_LABELS[r.info] || r.ref) : r.ref}</a>${r.type !== 'payment' && r.info ? html` <small class="muted">· ${r.info}</small>` : ''}` },
          { label: 'Bedrag', num: true, render: r => (r.amount == null ? '' : html`<span class="${r.dir === 'out' ? 'neg' : ''}">${r.dir === 'out' ? '−' : ''}${money(r.amount)}</span>`) },
        ], rows: recent, empty: 'Nog geen transacties.' })}</section>
    </div>`;
    page(req, res, { title: 'Overzicht', active: 'overzicht', body });
  });

  app.get('/overzicht/:kpi', (req, res) => {
    const key = req.params.kpi;
    const k = KPI[key];
    if (!k) return res.redirect('/');
    const p = getPeriod(req);
    const pq = { periode: p.key, van: p.key === 'custom' ? p.from : null, tot: p.key === 'custom' ? p.to : null };
    const { columns, rows, total, note } = drill(db, key, p);
    if (req.query.format === 'csv') {
      return sendCsv(res, `${key}-${p.from}-${p.to}.csv`, columns.map(c => ({ label: c.label, value: c.csv || (r => (typeof c.render === 'function' ? String(c.render(r)).replace(/<[^>]+>/g, '') : r[c.key])) })), rows);
    }
    const body = html`${periodForm(req, p)}
      <div class="card"><h2>${k.title}: ${total}</h2><p class="explain"><strong>Berekening:</strong> ${k.how}</p>
      <p class="scope">Periode ${date(p.from)} t/m ${date(p.to)}${note ? html` · ${note}` : ''}</p>
      <p><a class="btn btn-ghost btn-sm" href="${qs(`/overzicht/${key}`, { ...pq, format: 'csv' })}">Exporteer CSV</a> <a class="btn btn-ghost btn-sm" href="${qs('/', pq)}">← Terug naar overzicht</a></p>
      ${table({ columns, rows, empty: 'Geen records in deze periode.' })}</div>`;
    page(req, res, { title: k.title, active: 'overzicht', body });
  });
};

function drill(db, key, p) {
  const s = R.summary(db, p.from, p.to);
  const saleLink = r => html`<a href="/verkopen/${r.id}">${r.number}</a>`;
  if (key === 'omzet' || key === 'brutowinst') {
    const rows = db.all(`SELECT s.id, s.number, s.fulfilled_date AS d, ch.name AS channel, 'verkoop' AS kind,
        (SELECT SUM(net_cents) FROM sale_lines WHERE sale_id = s.id) + s.shipping_net_cents AS net,
        (SELECT COALESCE(SUM(cogs_cents),0) FROM sale_lines WHERE sale_id = s.id) AS cogs
      FROM sales s LEFT JOIN lookups ch ON ch.id = s.channel_id WHERE s.fulfillment_status <> 'unfulfilled' AND s.fulfilled_date BETWEEN ? AND ?
      UNION ALL
      SELECT s.id, s.number, r.return_date, ch.name, CASE WHEN r.restock = 1 THEN 'retour (terug op voorraad)' ELSE 'retour (niet op voorraad)' END,
        -SUM(rl.net_cents), -SUM(rl.cogs_reversed_cents)
      FROM sale_returns r JOIN sale_return_lines rl ON rl.return_id = r.id JOIN sales s ON s.id = r.sale_id LEFT JOIN lookups ch ON ch.id = s.channel_id
      WHERE r.return_date BETWEEN ? AND ? GROUP BY r.id ORDER BY 3`, [p.from, p.to, p.from, p.to]);
    const cols = [{ label: 'Datum', render: r => date(r.d), csv: r => r.d }, { label: 'Verkoop', render: saleLink, csv: r => r.number }, { label: 'Soort', key: 'kind' }, { label: 'Kanaal', render: r => r.channel || '–', csv: r => r.channel || '' },
      { label: 'Netto-omzet', num: true, render: r => money(r.net), csv: r => csvMoney(r.net) }];
    if (key === 'brutowinst') cols.push({ label: 'Kostprijs', num: true, render: r => money(r.cogs), csv: r => csvMoney(r.cogs) }, { label: 'Brutowinst', num: true, render: r => money(r.net - r.cogs), csv: r => csvMoney(r.net - r.cogs) });
    return { columns: cols, rows, total: money(key === 'omzet' ? s.revenue.net : s.grossProfit), note: key === 'brutowinst' ? `marge ${pct(s.grossMarginBp)}` : null };
  }
  if (key === 'ontvangen' || key === 'inkoop' || key === 'kasstroom') {
    const where = key === 'ontvangen' ? "AND p.kind IN ('sale','refund')" : key === 'inkoop' ? "AND p.kind = 'purchase'" : '';
    const rows = db.all(`SELECT p.*, s.number AS sale_number, po.number AS po_number, e.description AS expense_desc, oe.description AS entry_desc, m.name AS method
      FROM payments p LEFT JOIN sales s ON s.id = p.sale_id LEFT JOIN purchase_orders po ON po.id = p.po_id LEFT JOIN expenses e ON e.id = p.expense_id
      LEFT JOIN other_entries oe ON oe.id = p.entry_id LEFT JOIN lookups m ON m.id = p.method_id
      WHERE p.voided = 0 AND p.pay_date BETWEEN ? AND ? ${where} ORDER BY p.pay_date, p.id`, [p.from, p.to]);
    const doc = r => r.sale_id ? html`<a href="/verkopen/${r.sale_id}">${r.sale_number}</a>` : r.po_id ? html`<a href="/inkoop/${r.po_id}">${r.po_number}</a>` : r.expense_id ? html`<a href="/uitgaven/${r.expense_id}">${r.expense_desc}</a>` : html`<a href="/verkopen/overig/${r.entry_id}">${r.entry_desc}</a>`;
    const total = key === 'ontvangen' ? money(s.cash.salesIn) : key === 'inkoop' ? money(s.cash.purchaseOut) : money(s.cash.net);
    return {
      columns: [{ label: 'Betaaldatum', render: r => date(r.pay_date), csv: r => r.pay_date }, { label: 'Soort', render: r => KIND_LABELS[r.kind], csv: r => KIND_LABELS[r.kind] }, { label: 'Document', render: doc, csv: r => r.sale_number || r.po_number || r.expense_desc || r.entry_desc },
        { label: 'Methode', render: r => r.method || '–', csv: r => r.method || '' }, { label: 'Bedrag', num: true, render: r => html`<span class="${r.direction === 'out' ? 'neg' : ''}">${r.direction === 'out' ? '−' : '+'}${money(r.amount_cents)}</span>`, csv: r => csvMoney(r.direction === 'out' ? -r.amount_cents : r.amount_cents) }],
      rows, total, note: key === 'kasstroom' ? `operationeel ${money(s.cash.operatingNet)}, financiering ${money(s.cash.financingIn - s.cash.financingOut)}` : key === 'ontvangen' && s.cash.refundsOut ? `terugbetaald ${money(s.cash.refundsOut)}` : null,
    };
  }
  if (key === 'debiteuren') {
    const rows = R.receivables(db);
    return { columns: [{ label: 'Verkoop', render: saleLink, csv: r => r.number }, { label: 'Datum', render: r => date(r.sale_date), csv: r => r.sale_date }, { label: 'Klant', render: r => r.customer_ref || '–', csv: r => r.customer_ref || '' },
      { label: 'Uitlevering', render: r => statusBadge(sales.FULFILLMENT_LABELS[r.fulfillment_status].toLowerCase()), csv: r => sales.FULFILLMENT_LABELS[r.fulfillment_status] },
      { label: 'Te ontvangen', num: true, render: r => money(r.amountDue), csv: r => csvMoney(r.amountDue) }, { label: 'Ontvangen', num: true, render: r => money(r.paid), csv: r => csvMoney(r.paid) }, { label: 'Openstaand', num: true, render: r => money(r.outstanding), csv: r => csvMoney(r.outstanding) }],
      rows, total: money(s.receivables), note: 'peildatum vandaag' };
  }
  if (key === 'kosten') {
    const rows = db.all(`SELECT e.id, e.expense_date AS d, e.description, c.name AS category, e.amount_excl_cents + CASE WHEN e.vat_recoverable = 1 THEN 0 ELSE e.vat_cents END AS cost, 'expense' AS t
        FROM expenses e JOIN lookups c ON c.id = e.category_id WHERE e.status = 'active' AND e.expense_date BETWEEN ? AND ?
      UNION ALL SELECT m.id, m.move_date, v.sku || ': ' || COALESCE(m.reason,''), 'Voorraadafboeking', -m.value_cents, 'movement'
        FROM stock_movements m JOIN variants v ON v.id = m.variant_id WHERE m.type IN ('damage','giveaway','correction') AND m.move_date BETWEEN ? AND ? ORDER BY 2`, [p.from, p.to, p.from, p.to]);
    return { columns: [{ label: 'Datum', render: r => date(r.d), csv: r => r.d }, { label: 'Omschrijving', render: r => (r.t === 'expense' ? html`<a href="/uitgaven/${r.id}">${r.description}</a>` : html`<a href="/voorraad/mutaties">${r.description}</a>`), csv: r => r.description },
      { label: 'Categorie', key: 'category' }, { label: 'Kosten', num: true, render: r => money(r.cost), csv: r => csvMoney(r.cost) }], rows, total: money(s.expenses + s.writeoffs) };
  }
  if (key === 'resultaat') {
    const rows = [
      { label: 'Netto-omzet excl. btw', v: s.revenue.net, href: '/overzicht/omzet' },
      { label: 'Kostprijs verkopen', v: -s.cogs.cogs, href: '/overzicht/brutowinst' },
      { label: 'Brutowinst', v: s.grossProfit, strong: true },
      { label: 'Bedrijfskosten (uitgaven)', v: -s.expenses, href: '/overzicht/kosten' },
      { label: 'Voorraadafboekingen', v: -s.writeoffs, href: '/voorraad/mutaties' },
      { label: 'Overige opbrengsten', v: s.otherIncome, href: '/verkopen/overig' },
      { label: 'Operationeel resultaat', v: s.operatingResult, strong: true },
    ];
    return { columns: [{ label: 'Onderdeel', render: r => (r.href ? html`<a href="${r.href}">${r.label}</a>` : html`<strong>${r.label}</strong>`), csv: r => r.label }, { label: 'Bedrag', num: true, render: r => (r.strong ? html`<strong>${money(r.v)}</strong>` : money(r.v)), csv: r => csvMoney(r.v) }], rows, total: money(s.operatingResult) };
  }
  if (key === 'voorraad' || key === 'lage-voorraad') {
    const rows = key === 'voorraad' ? inventory.stockOverview(db, { asOf: p.to, includeArchived: true }).filter(r => r.qty !== 0 || r.value !== 0) : s.lowStock;
    return { columns: [{ label: 'Product', render: r => html`<a href="/producten/${r.product_id}">${r.product_name}</a> ${r.variant_name ? html`<small class="muted">${r.variant_name}</small>` : ''}`, csv: r => `${r.product_name} ${r.variant_name || ''}`.trim() },
      { label: 'SKU', key: 'sku' }, { label: 'Voorraad', num: true, render: r => num(r.qty), csv: r => r.qty }, { label: 'Minimum', num: true, render: r => num(r.min_stock), csv: r => r.min_stock },
      { label: 'Gem. kostprijs', num: true, render: r => money(r.avg), csv: r => csvMoney(r.avg) }, { label: 'Waarde', num: true, render: r => money(r.value), csv: r => csvMoney(r.value) }],
    rows, total: key === 'voorraad' ? money(s.inventoryValue) : String(rows.length), note: key === 'voorraad' ? `peildatum ${date(p.to)}` : 'peildatum vandaag' };
  }
  if (key === 'crediteuren') {
    const pay = R.payables(db);
    const rows = [...pay.pos.map(p2 => ({ kind: 'Inkooporder', href: `/inkoop/${p2.id}`, ref: p2.number, party: p2.supplier_name, date: p2.order_date, due: p2.status === 'cancelled' ? 0 : p2.totals.payable, paid: p2.paid, open: p2.outstanding })),
      ...pay.expenses.map(e => ({ kind: 'Uitgave', href: `/uitgaven/${e.id}`, ref: e.description, party: e.supplier_name || e.payee, date: e.due_date || e.expense_date, due: e.total_cents, paid: e.paid, open: e.outstanding }))];
    return { columns: [{ label: 'Soort', key: 'kind' }, { label: 'Document', render: r => html`<a href="${r.href}">${r.ref}</a>`, csv: r => r.ref }, { label: 'Leverancier / ontvanger', render: r => r.party || '–', csv: r => r.party || '' },
      { label: 'Datum / vervaldatum', render: r => date(r.date), csv: r => r.date }, { label: 'Totaal', num: true, render: r => money(r.due), csv: r => csvMoney(r.due) }, { label: 'Betaald', num: true, render: r => money(r.paid), csv: r => csvMoney(r.paid) }, { label: 'Openstaand', num: true, render: r => money(r.open), csv: r => csvMoney(r.open) }],
    rows, total: money(pay.total), note: 'peildatum vandaag' };
  }
  return { columns: [], rows: [], total: '' };
}

module.exports.KPI = KPI;
void badge;
