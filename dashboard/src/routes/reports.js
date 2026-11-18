'use strict';
const { html, money, date, pct, num, qs, table } = require('../views/html');
const { page, getPeriod, periodForm, sendCsv } = require('../web');
const { csvMoney, csvPercent } = require('../csv');
const R = require('../services/reports');
const I = require('../services/inventory');
const payments = require('../services/payments');

const REPORTS = {
  maandelijks: 'Maandelijkse omzet, brutowinst en operationeel resultaat',
  producten: 'Omzet en brutowinst per product',
  kanalen: 'Omzet per verkoopkanaal',
  uitgaven: 'Uitgaven per categorie',
  inkoop: 'Inkoop per leverancier',
  openstaand: 'Openstaande klant- en leveranciersbetalingen',
  voorraad: 'Voorraad en voorraadwaarde',
  btw: 'Btw-overzicht (indicatief)',
  betalingen: 'Alle betalingen (kasboek)',
};

module.exports = (app, { db }) => {
  app.get('/rapporten', (req, res) => {
    const p = getPeriod(req);
    const pq = { periode: p.key, van: p.key === 'custom' ? p.from : null, tot: p.key === 'custom' ? p.to : null };
    const body = html`${periodForm(req, p)}<div class="card"><ul class="report-list">${Object.entries(REPORTS).map(([k, t]) => html`<li><a href="${qs(`/rapporten/${k}`, pq)}">${t}</a></li>`)}</ul>
      <p class="help">Alle rapporten tonen de gekozen periode en zijn als CSV te exporteren. Het is managementinformatie op basis van de ingevoerde administratie, geen jaarrekening of btw-aangifte.</p></div>`;
    page(req, res, { title: 'Rapporten', active: 'rapporten', body });
  });

  app.get('/rapporten/:key', (req, res, next) => {
    const key = req.params.key;
    if (!REPORTS[key]) return next();
    const p = key === 'maandelijks' && !req.query.periode ? require('../money').periodRange('year') : getPeriod(req);
    const pq = { periode: p.key, van: p.key === 'custom' ? p.from : null, tot: p.key === 'custom' ? p.to : null };
    const { columns, rows, foot, note } = build(db, key, p);
    if (req.query.format === 'csv') return sendCsv(res, `${key}-${p.from}-${p.to}.csv`, columns.map(c => ({ label: c.label, value: c.csv || (r => r[c.key]) })), rows);
    const body = html`${periodForm(req, p)}<div class="card">
      <p class="scope">${REPORTS[key]} · periode ${date(p.from)} t/m ${date(p.to)}${note ? html` · ${note}` : ''}</p>
      <p><a class="btn btn-ghost btn-sm" href="${qs(`/rapporten/${key}`, { ...pq, format: 'csv' })}">CSV-export</a> <a class="btn btn-ghost btn-sm" href="${qs('/rapporten', pq)}">← Alle rapporten</a></p>
      ${table({ columns, rows, foot, empty: 'Geen gegevens voor deze periode.' })}</div>`;
    page(req, res, { title: REPORTS[key], active: 'rapporten', body });
  });
};

const m = (label, key, extra = {}) => ({ label, num: true, render: r => money(r[key]), csv: r => csvMoney(r[key]), ...extra });
const footRow = (cols, rows) => html`<tr>${cols.map((c, i) => (i === 0 ? html`<th scope="row">Totaal</th>` : c.sum ? html`<td class="num"><strong>${money(rows.reduce((a, r) => a + (r[c.sum] || 0), 0))}</strong></td>` : html`<td></td>`))}</tr>`;

function build(db, key, p) {
  if (key === 'maandelijks') {
    const rows = R.monthly(db, p.from, p.to);
    const columns = [{ label: 'Maand', key: 'label' }, m('Netto-omzet', 'revenue', { sum: 'revenue' }), m('Kostprijs verkopen', 'cogs', { sum: 'cogs' }), m('Brutowinst', 'gross', { sum: 'gross' }),
      { label: 'Brutomarge', num: true, render: r => pct(r.marginBp), csv: r => csvPercent(r.marginBp) }, m('Bedrijfskosten', 'expenses', { sum: 'expenses' }), m('Voorraadafboekingen', 'writeoffs', { sum: 'writeoffs' }),
      m('Overige opbrengsten', 'otherIncome', { sum: 'otherIncome' }), m('Operationeel resultaat', 'operating', { sum: 'operating' })];
    return { columns, rows, foot: footRow(columns, rows), note: 'omzet op uitleverdatum, kosten op uitgavedatum' };
  }
  if (key === 'producten') {
    const rows = R.productPerformance(db, p.from, p.to).sort((a, b) => b.net - a.net);
    const columns = [{ label: 'Product', render: r => html`${r.description}<br><small class="muted">${r.sku}</small>`, csv: r => r.description }, { label: 'SKU', key: 'sku', csv: r => r.sku },
      { label: 'Aantal (netto)', num: true, render: r => num(r.qty), csv: r => r.qty }, m('Netto-omzet', 'net', { sum: 'net' }), m('Kostprijs', 'cogs', { sum: 'cogs' }), m('Brutowinst', 'gross', { sum: 'gross' }),
      { label: 'Marge', num: true, render: r => (r.cogsUnknown ? html`<span class="warn-text">kostprijs onbekend</span>` : pct(r.marginBp)), csv: r => (r.cogsUnknown ? 'kostprijs onbekend' : csvPercent(r.marginBp)) }];
    return { columns, rows, foot: footRow(columns, rows), note: 'uitgeleverde regels minus retouren in de periode; excl. verzendopbrengst' };
  }
  if (key === 'kanalen') {
    const rows = R.revenueByChannel(db, p.from, p.to).map(r => ({ ...r, orders: db.get(`SELECT COUNT(*) AS n FROM sales WHERE fulfillment_status <> 'unfulfilled' AND fulfilled_date BETWEEN ? AND ? AND ${r.id == null ? 'channel_id IS NULL' : 'channel_id = ?'}`, r.id == null ? [p.from, p.to] : [p.from, p.to, r.id]).n }));
    const columns = [{ label: 'Kanaal', key: 'name' }, { label: 'Orders', num: true, render: r => num(r.orders), csv: r => r.orders }, m('Netto-omzet', 'value', { sum: 'value' })];
    return { columns, rows, foot: footRow(columns, rows), note: 'incl. verzendopbrengst, na retouren' };
  }
  if (key === 'uitgaven') {
    const rows = R.costsByCategory(db, p.from, p.to);
    const columns = [{ label: 'Categorie', key: 'name' }, m('Kosten (excl. terugvorderbare btw)', 'value', { sum: 'value' })];
    return { columns, rows, foot: footRow(columns, rows), note: 'op uitgavedatum' };
  }
  if (key === 'inkoop') {
    const rows = R.purchasesBySupplier(db, p.from, p.to);
    const columns = [{ label: 'Leverancier', render: r => html`<a href="/leveranciers/${r.id}">${r.name}</a>`, csv: r => r.name }, { label: 'Orders (besteldatum)', num: true, render: r => num(r.orders), csv: r => r.orders },
      m('Besteld excl. btw + kosten', 'ordered', { sum: 'ordered' }), m('Ontvangen (voorraadwaarde)', 'received', { sum: 'received' }), m('Betaald in periode', 'paid', { sum: 'paid' }), m('Openstaand (vandaag)', 'open', { sum: 'open' })];
    return { columns, rows, foot: footRow(columns, rows) };
  }
  if (key === 'openstaand') {
    const rec = R.receivables(db).map(s => ({ kind: 'Te ontvangen', href: `/verkopen/${s.id}`, ref: s.number, party: s.customer_ref || '', date: s.sale_date, open: s.outstanding }));
    const pay = R.payables(db);
    const out = [...pay.pos.map(x => ({ kind: 'Te betalen', href: `/inkoop/${x.id}`, ref: x.number, party: x.supplier_name, date: x.order_date, open: -x.outstanding })),
      ...pay.expenses.map(e => ({ kind: 'Te betalen', href: `/uitgaven/${e.id}`, ref: e.description, party: e.supplier_name || e.payee || '', date: e.due_date || e.expense_date, open: -e.outstanding }))];
    const rows = [...rec, ...out];
    const columns = [{ label: 'Soort', key: 'kind' }, { label: 'Document', render: r => html`<a href="${r.href}">${r.ref}</a>`, csv: r => r.ref }, { label: 'Partij', key: 'party' },
      { label: 'Datum / vervaldatum', render: r => date(r.date), csv: r => r.date }, m('Saldo (+ ontvangen / − betalen)', 'open', { sum: 'open' })];
    return { columns, rows, foot: footRow(columns, rows), note: 'peildatum vandaag' };
  }
  if (key === 'voorraad') {
    const rows = I.stockOverview(db, { asOf: p.to, includeArchived: true }).filter(r => r.qty !== 0 || r.value !== 0);
    const columns = [{ label: 'Product', render: r => `${r.product_name} ${r.variant_name || ''}`, csv: r => `${r.product_name} ${r.variant_name || ''}`.trim() }, { label: 'SKU', key: 'sku' },
      { label: 'Voorraad', num: true, render: r => num(r.qty), csv: r => r.qty }, m('Gem. kostprijs', 'avg'), m('Waarde', 'value', { sum: 'value' })];
    return { columns, rows, foot: footRow(columns, rows), note: `peildatum ${date(p.to)}, gewogen gemiddelde kostprijs` };
  }
  if (key === 'btw') {
    const v = R.vatOverview(db, p.from, p.to);
    const rows = [
      { label: 'Btw op omzet (uitgeleverd, na retouren)', v: v.outputSales }, { label: 'Btw op overige opbrengsten', v: v.outputOther }, { label: 'Totaal af te dragen', v: v.output, strong: true },
      { label: 'Voorbelasting uitgaven (terugvorderbaar)', v: -v.inputExpenses }, { label: 'Voorbelasting inkooporders (besteldatum, terugvorderbaar)', v: -v.inputPurchases }, { label: 'Totaal voorbelasting', v: -v.input, strong: true },
      { label: 'Indicatief saldo (+ betalen / − terugvragen)', v: v.balance, strong: true },
    ];
    return { columns: [{ label: 'Onderdeel', render: r => (r.strong ? html`<strong>${r.label}</strong>` : r.label), csv: r => r.label }, { label: 'Bedrag', num: true, render: r => money(r.v), csv: r => csvMoney(r.v) }],
      rows, note: 'indicatief: aangifte gebeurt op factuurdatum en kan afwijken (bijv. verleggingsregelingen, KOR)' };
  }
  if (key === 'betalingen') {
    const rows = payments.listPayments(db, { from: p.from, to: p.to });
    const columns = [{ label: 'Datum', render: r => date(r.pay_date), csv: r => r.pay_date }, { label: 'Soort', render: r => payments.KIND_LABELS[r.kind], csv: r => payments.KIND_LABELS[r.kind] },
      { label: 'Document', render: r => r.sale_number || r.po_number || r.expense_desc || r.entry_desc || '', csv: r => r.sale_number || r.po_number || r.expense_desc || r.entry_desc || '' },
      { label: 'Methode', render: r => r.method_name || '', csv: r => r.method_name || '' }, { label: 'Referentie', render: r => r.reference || '', csv: r => r.reference || '' },
      { label: 'Bedrag', num: true, render: r => html`<span class="${r.direction === 'out' ? 'neg' : ''}">${money(r.direction === 'out' ? -r.amount_cents : r.amount_cents)}</span>`, csv: r => csvMoney(r.direction === 'out' ? -r.amount_cents : r.amount_cents), sum: 'signed' }];
    rows.forEach(r => { r.signed = r.direction === 'out' ? -r.amount_cents : r.amount_cents; });
    return { columns, rows, foot: footRow(columns, rows), note: 'netto kasstroom = totaal' };
  }
  return { columns: [], rows: [] };
}
