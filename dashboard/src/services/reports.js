'use strict';
// Managementinformatie op basis van de ingevoerde administratie.
//
// Definities (consequent toegepast):
//   Netto-omzet excl. btw  = netto regelbedragen + netto verzendopbrengst van verkopen met uitleverdatum
//                            in de periode, minus netto bedragen van retouren met retourdatum in de periode.
//                            (Kortingen zijn al van de regelbedragen afgetrokken.)
//   Kostprijs verkopen      = waarde van voorraadmutaties ‘verkoop’ in de periode minus teruggenomen
//                            kostprijs van retouren (‘retour’) in de periode.
//   Brutowinst              = netto-omzet − kostprijs verkopen.
//   Bedrijfskosten          = uitgaven op uitgavedatum, excl. terugvorderbare btw (niet-terugvorderbare btw telt mee).
//   Voorraadafboekingen     = waarde van beschadiging, samples/weggeefacties en correcties in de periode.
//   Operationeel resultaat  = brutowinst − bedrijfskosten − voorraadafboekingen + overige opbrengsten.
//   Netto kasstroom         = alle ontvangen − alle betaalde bedragen (niet-vervallen betalingen) in de periode,
//                            inclusief financiering (apart getoond).
// Voorraadinkoop is geen kostenpost: de betaling is een kasuitgave; via de kostprijs verkopen komt
// de inkoop in het resultaat zodra de producten zijn verkocht. Zo wordt niets dubbel geteld.
const { divRound, marginBp, addDays } = require('../money');
const sales = require('./sales');
const purchasing = require('./purchasing');
const expenses = require('./expenses');
const inventory = require('./inventory');

function revenueParts(db, from, to, extra = '', params = {}) {
  const p = { from, to, ...params };
  const lines = db.get(`SELECT COALESCE(SUM(sl.net_cents),0) AS net, COALESCE(SUM(sl.vat_cents),0) AS vat, COALESCE(SUM(sl.discount_cents),0) AS disc
    FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id WHERE s.fulfillment_status <> 'unfulfilled' AND s.fulfilled_date BETWEEN :from AND :to ${extra}`, p);
  const ship = db.get(`SELECT COALESCE(SUM(s.shipping_net_cents),0) AS net, COALESCE(SUM(s.shipping_vat_cents),0) AS vat FROM sales s
    WHERE s.fulfillment_status <> 'unfulfilled' AND s.fulfilled_date BETWEEN :from AND :to ${extra}`, p);
  const ret = db.get(`SELECT COALESCE(SUM(rl.net_cents),0) AS net, COALESCE(SUM(rl.vat_cents),0) AS vat FROM sale_return_lines rl JOIN sale_returns r ON r.id = rl.return_id
    JOIN sales s ON s.id = r.sale_id WHERE r.return_date BETWEEN :from AND :to ${extra}`, p);
  return { products: lines.net, shipping: ship.net, returns: ret.net, discounts: lines.disc, net: lines.net + ship.net - ret.net, outputVat: lines.vat + ship.vat - ret.vat };
}

function cogs(db, from, to) {
  const r = db.get(`SELECT COALESCE(SUM(CASE WHEN type = 'sale' THEN -value_cents ELSE 0 END),0) AS sold,
      COALESCE(SUM(CASE WHEN type = 'return' THEN value_cents ELSE 0 END),0) AS returned,
      COALESCE(SUM(CASE WHEN type IN ('damage','giveaway','correction') THEN -value_cents ELSE 0 END),0) AS writeoffs
    FROM stock_movements WHERE move_date BETWEEN ? AND ?`, [from, to]);
  return { cogs: r.sold - r.returned, sold: r.sold, returned: r.returned, writeoffs: r.writeoffs };
}

function expenseCost(db, from, to) {
  const r = db.get(`SELECT COALESCE(SUM(amount_excl_cents + CASE WHEN vat_recoverable = 1 THEN 0 ELSE vat_cents END),0) AS cost,
      COALESCE(SUM(CASE WHEN vat_recoverable = 1 THEN vat_cents ELSE 0 END),0) AS inputVat
    FROM expenses WHERE status = 'active' AND expense_date BETWEEN ? AND ?`, [from, to]);
  return r;
}

function otherIncome(db, from, to) {
  return db.get(`SELECT COALESCE(SUM(amount_excl_cents),0) AS v, COALESCE(SUM(vat_cents),0) AS vat FROM other_entries
    WHERE status = 'active' AND type = 'other_income' AND entry_date BETWEEN ? AND ?`, [from, to]);
}

function cash(db, from, to) {
  const rows = db.all(`SELECT kind, direction, COALESCE(SUM(amount_cents),0) AS v FROM payments WHERE voided = 0 AND pay_date BETWEEN ? AND ? GROUP BY kind, direction`, [from, to]);
  const g = (kind, dir) => rows.filter(r => r.kind === kind && r.direction === dir).reduce((a, r) => a + r.v, 0);
  const c = {
    salesIn: g('sale', 'in'), refundsOut: g('refund', 'out'), purchaseOut: g('purchase', 'out'), expenseOut: g('expense', 'out'),
    otherIn: g('other_income', 'in'), financingIn: g('financing', 'in'), financingOut: g('financing', 'out'),
  };
  c.totalIn = rows.filter(r => r.direction === 'in').reduce((a, r) => a + r.v, 0);
  c.totalOut = rows.filter(r => r.direction === 'out').reduce((a, r) => a + r.v, 0);
  c.net = c.totalIn - c.totalOut;
  c.operatingNet = c.net - c.financingIn + c.financingOut;
  return c;
}

function receivables(db) {
  const ids = db.all("SELECT id FROM sales WHERE status <> 'cancelled' ORDER BY sale_date").map(r => r.id);
  return ids.map(id => sales.getSale(db, id)).filter(s => s.outstanding > 0);
}
function payables(db) {
  const pos = db.all("SELECT id FROM purchase_orders WHERE status NOT IN ('draft','cancelled') ORDER BY order_date").map(r => purchasing.getPo(db, r.id)).filter(p => p.outstanding > 0);
  const exps = db.all("SELECT id FROM expenses WHERE status = 'active' ORDER BY COALESCE(due_date, expense_date)").map(r => expenses.getExpense(db, r.id)).filter(e => e.outstanding > 0);
  return { pos, expenses: exps, total: pos.reduce((a, p) => a + p.outstanding, 0) + exps.reduce((a, e) => a + e.outstanding, 0) };
}

function inventoryValue(db, asOf) {
  return db.get('SELECT COALESCE(SUM(value_cents),0) AS v, COALESCE(SUM(qty),0) AS q FROM stock_movements WHERE move_date <= ?', [asOf]);
}

function summary(db, from, to) {
  const rev = revenueParts(db, from, to);
  const c = cogs(db, from, to);
  const exp = expenseCost(db, from, to);
  const oi = otherIncome(db, from, to);
  const cs = cash(db, from, to);
  const gross = rev.net - c.cogs;
  const recv = receivables(db);
  const pay = payables(db);
  const inv = inventoryValue(db, to);
  const low = inventory.stockOverview(db).filter(r => r.low);
  const unfulfilled = db.all("SELECT id FROM sales WHERE status <> 'cancelled' AND fulfillment_status = 'unfulfilled'").map(r => sales.getSale(db, r.id));
  return {
    from, to,
    revenue: rev, cogs: c, grossProfit: gross, grossMarginBp: marginBp(gross, rev.net),
    expenses: exp.cost, inputVatExpenses: exp.inputVat, writeoffs: c.writeoffs, otherIncome: oi.v,
    operatingResult: gross - exp.cost - c.writeoffs + oi.v,
    cash: cs,
    receivables: recv.reduce((a, s) => a + s.outstanding, 0), receivablesCount: recv.length,
    payables: pay.total, payablesCount: pay.pos.length + pay.expenses.length,
    inventoryValue: inv.v, inventoryQty: inv.q,
    lowStock: low,
    unfulfilledValue: unfulfilled.reduce((a, s) => a + s.totals.net, 0), unfulfilledCount: unfulfilled.length,
  };
}

// Tijdreeks voor de grafiek: per dag (≤ 31 dagen) of per maand.
function timeseries(db, from, to) {
  const days = Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
  const buckets = [];
  if (days <= 31) {
    for (let d = from; d <= to; d = addDays(d, 1)) buckets.push({ label: `${d.slice(8, 10)}-${d.slice(5, 7)}`, from: d, to: d });
  } else {
    let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
    for (;;) {
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const end = `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
      if (start > to) break;
      buckets.push({ label: ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][m - 1] + (from.slice(0, 4) !== to.slice(0, 4) ? ` ${String(y).slice(2)}` : ''), from: start < from ? from : start, to: end > to ? to : end });
      m++; if (m > 12) { m = 1; y++; }
    }
  }
  return buckets.map(b => {
    const rev = revenueParts(db, b.from, b.to).net;
    const c = cogs(db, b.from, b.to);
    const e = expenseCost(db, b.from, b.to).cost;
    return { ...b, revenue: rev, cogs: c.cogs, expenses: e + c.writeoffs };
  });
}

function revenueByChannel(db, from, to) {
  const rows = db.all("SELECT id, name FROM lookups WHERE type = 'sales_channel' ORDER BY sort, name");
  const out = rows.map(r => ({ id: r.id, name: r.name, value: revenueParts(db, from, to, 'AND s.channel_id = :ch', { ch: r.id }).net }));
  const none = revenueParts(db, from, to, 'AND s.channel_id IS NULL').net;
  if (none) out.push({ id: null, name: 'Geen kanaal', value: none });
  return out.filter(r => r.value !== 0).sort((a, b) => b.value - a.value);
}

function costsByCategory(db, from, to) {
  const rows = db.all(`SELECT c.id, c.name, SUM(e.amount_excl_cents + CASE WHEN e.vat_recoverable = 1 THEN 0 ELSE e.vat_cents END) AS value
    FROM expenses e JOIN lookups c ON c.id = e.category_id WHERE e.status = 'active' AND e.expense_date BETWEEN ? AND ? GROUP BY c.id ORDER BY value DESC`, [from, to]);
  const w = cogs(db, from, to).writeoffs;
  if (w) rows.push({ id: null, name: 'Voorraadafboekingen', value: w });
  return rows.sort((a, b) => b.value - a.value);
}

// Per product (variant): verkochte aantallen, netto-omzet, kostprijs en brutowinst van regels
// die in de periode zijn uitgeleverd, minus retouren in de periode.
function productPerformance(db, from, to) {
  const sold = db.all(`SELECT sl.variant_id, sl.sku, MAX(sl.description) AS description, SUM(sl.qty) AS qty, SUM(sl.net_cents) AS net, SUM(COALESCE(sl.cogs_cents,0)) AS cogs
    FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id WHERE s.fulfillment_status <> 'unfulfilled' AND s.fulfilled_date BETWEEN ? AND ? GROUP BY sl.variant_id`, [from, to]);
  const ret = db.all(`SELECT sl.variant_id, SUM(rl.qty) AS qty, SUM(rl.net_cents) AS net, SUM(rl.cogs_reversed_cents) AS cogs
    FROM sale_return_lines rl JOIN sale_returns r ON r.id = rl.return_id JOIN sale_lines sl ON sl.id = rl.sale_line_id WHERE r.return_date BETWEEN ? AND ? GROUP BY sl.variant_id`, [from, to]);
  const map = new Map(sold.map(r => [r.variant_id, { ...r }]));
  for (const r of ret) {
    const m = map.get(r.variant_id) || (() => { const v = db.get('SELECT v.sku, p.name AS pn, v.name AS vn FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?', [r.variant_id]); const o = { variant_id: r.variant_id, sku: v.sku, description: [v.pn, v.vn].filter(Boolean).join(' – '), qty: 0, net: 0, cogs: 0 }; map.set(r.variant_id, o); return o; })();
    m.qty -= r.qty; m.net -= r.net; m.cogs -= r.cogs;
  }
  // Kostprijs 0 bij een verkocht product = inkoopprijs onbekend: geen (schijnbare) 100%-marge tonen.
  return [...map.values()].map(r => { const unknown = r.cogs === 0 && r.net > 0; return { ...r, gross: r.net - r.cogs, cogsUnknown: unknown, marginBp: unknown ? null : marginBp(r.net - r.cogs, r.net) }; });
}

function recentTransactions(db, limit = 10) {
  const rows = db.all(`SELECT * FROM (
      SELECT 'sale' AS type, s.id, s.sale_date AS date, s.number AS ref, (SELECT COALESCE(SUM(gross_cents),0) FROM sale_lines WHERE sale_id = s.id) + s.shipping_gross_cents AS amount, s.created_at, 'in' AS dir, CASE WHEN s.status = 'cancelled' THEN COALESCE(ch.name, '') || ' · geannuleerd' ELSE ch.name END AS info
        FROM sales s LEFT JOIN lookups ch ON ch.id = s.channel_id
      UNION ALL SELECT 'expense', e.id, e.expense_date, e.description, e.total_cents, e.created_at, 'out', CASE WHEN e.status = 'cancelled' THEN c.name || ' · geannuleerd' ELSE c.name END FROM expenses e JOIN lookups c ON c.id = e.category_id
      UNION ALL SELECT 'payment', p.id, p.pay_date, COALESCE(p.reference, p.kind), p.amount_cents, p.created_at, p.direction, p.kind FROM payments p WHERE p.voided = 0
      UNION ALL SELECT 'po', po.id, po.order_date, po.number, NULL, po.created_at, 'out', s.name FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
    ) ORDER BY created_at DESC, date DESC LIMIT ?`, [limit]);
  return rows;
}

function monthly(db, from, to) {
  return timeseriesMonthly(db, from, to).map(b => {
    const rev = revenueParts(db, b.from, b.to);
    const c = cogs(db, b.from, b.to);
    const e = expenseCost(db, b.from, b.to).cost;
    const oi = otherIncome(db, b.from, b.to).v;
    const gross = rev.net - c.cogs;
    return { label: b.label, from: b.from, to: b.to, revenue: rev.net, cogs: c.cogs, gross, marginBp: marginBp(gross, rev.net), expenses: e, writeoffs: c.writeoffs, otherIncome: oi, operating: gross - e - c.writeoffs + oi };
  });
}
function timeseriesMonthly(db, from, to) {
  const out = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const names = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  for (;;) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    if (start > to) break;
    const end = `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
    out.push({ label: `${names[m - 1]} ${y}`, from: start < from ? from : start, to: end > to ? to : end });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function purchasesBySupplier(db, from, to) {
  return db.all('SELECT id, name FROM suppliers ORDER BY name').map(s => {
    const pos = db.all("SELECT id FROM purchase_orders WHERE supplier_id = ? AND status NOT IN ('draft','cancelled') AND order_date BETWEEN ? AND ?", [s.id, from, to]).map(r => purchasing.getPo(db, r.id));
    const received = db.get(`SELECT COALESCE(SUM(rl.goods_cents + rl.extra_cents),0) AS v FROM po_receipt_lines rl JOIN po_receipts r ON r.id = rl.receipt_id
      JOIN purchase_orders po ON po.id = r.po_id WHERE po.supplier_id = ? AND r.received_date BETWEEN ? AND ?`, [s.id, from, to]).v;
    const paid = db.get(`SELECT COALESCE(SUM(p.amount_cents),0) AS v FROM payments p JOIN purchase_orders po ON po.id = p.po_id WHERE po.supplier_id = ? AND p.voided = 0 AND p.pay_date BETWEEN ? AND ?`, [s.id, from, to]).v;
    const open = db.all("SELECT id FROM purchase_orders WHERE supplier_id = ? AND status NOT IN ('draft','cancelled')", [s.id]).map(r => purchasing.getPo(db, r.id)).reduce((a, p) => a + Math.max(0, p.outstanding), 0);
    return { id: s.id, name: s.name, orders: pos.length, ordered: pos.reduce((a, p) => a + p.totals.net_eur + p.totals.extras, 0), received, paid, open };
  }).filter(r => r.orders || r.received || r.paid || r.open);
}

// Btw-overzicht (indicatief, geen aangifte): af te dragen btw op omzet en overige opbrengsten,
// terug te vorderen voorbelasting op uitgaven en inkooporders (besteldatum, alleen als terugvorderbaar).
function vatOverview(db, from, to) {
  const rev = revenueParts(db, from, to);
  const oi = otherIncome(db, from, to);
  const exp = expenseCost(db, from, to);
  const poVat = db.all("SELECT id FROM purchase_orders WHERE status NOT IN ('draft','cancelled') AND vat_recoverable = 1 AND order_date BETWEEN ? AND ?", [from, to])
    .map(r => purchasing.getPo(db, r.id)).reduce((a, p) => a + p.totals.vat_eur, 0);
  const output = rev.outputVat + oi.vat;
  const input = exp.inputVat + poVat;
  return { outputSales: rev.outputVat, outputOther: oi.vat, output, inputExpenses: exp.inputVat, inputPurchases: poVat, input, balance: output - input };
}

// Marketing ------------------------------------------------------------------------
function marketing(db, from, to) {
  const campaigns = db.all('SELECT c.*, l.name AS channel_name FROM campaigns c LEFT JOIN lookups l ON l.id = c.channel_id ORDER BY c.start_date DESC, c.name');
  const campRows = campaigns.map(c => {
    const spend = db.get("SELECT COALESCE(SUM(amount_excl_cents + CASE WHEN vat_recoverable = 1 THEN 0 ELSE vat_cents END),0) AS v FROM expenses WHERE status = 'active' AND campaign_id = ? AND expense_date BETWEEN ? AND ?", [c.id, from, to]).v;
    const rev = revenueParts(db, from, to, 'AND s.campaign_id = :camp', { camp: c.id }).net;
    const salesRows = db.all("SELECT new_customer FROM sales WHERE campaign_id = ? AND status <> 'cancelled' AND fulfillment_status <> 'unfulfilled' AND fulfilled_date BETWEEN ? AND ?", [c.id, from, to]);
    return metrics({ id: c.id, name: c.name, channel: c.channel_name, budget: c.budget_cents, start: c.start_date, end: c.end_date, archived: c.archived }, spend, rev, salesRows);
  }).filter(r => r.spend || r.revenue || !r.archived);
  const channels = db.all("SELECT id, name FROM lookups WHERE type = 'marketing_channel' ORDER BY sort, name").map(ch => {
    const spend = db.get(`SELECT COALESCE(SUM(e.amount_excl_cents + CASE WHEN e.vat_recoverable = 1 THEN 0 ELSE e.vat_cents END),0) AS v FROM expenses e LEFT JOIN campaigns c ON c.id = e.campaign_id
      WHERE e.status = 'active' AND e.expense_date BETWEEN ? AND ? AND (e.marketing_channel_id = ? OR (e.marketing_channel_id IS NULL AND c.channel_id = ?))`, [from, to, ch.id, ch.id]).v;
    const rev = revenueParts(db, from, to, 'AND s.campaign_id IN (SELECT id FROM campaigns WHERE channel_id = :ch)', { ch: ch.id }).net;
    const salesRows = db.all(`SELECT s.new_customer FROM sales s JOIN campaigns c ON c.id = s.campaign_id WHERE c.channel_id = ? AND s.status <> 'cancelled'
      AND s.fulfillment_status <> 'unfulfilled' AND s.fulfilled_date BETWEEN ? AND ?`, [ch.id, from, to]);
    return metrics({ id: ch.id, name: ch.name }, spend, rev, salesRows);
  }).filter(r => r.spend || r.revenue);
  const totalSpend = db.get(`SELECT COALESCE(SUM(e.amount_excl_cents + CASE WHEN e.vat_recoverable = 1 THEN 0 ELSE e.vat_cents END),0) AS v FROM expenses e JOIN lookups c ON c.id = e.category_id
    WHERE e.status = 'active' AND e.expense_date BETWEEN ? AND ? AND (c.is_marketing = 1 OR e.campaign_id IS NOT NULL OR e.marketing_channel_id IS NOT NULL)`, [from, to]).v;
  const unattributed = revenueParts(db, from, to, 'AND s.campaign_id IS NULL').net;
  const sources = db.all(`SELECT COALESCE(NULLIF(TRIM(s.marketing_source),''),'(onbekend)') AS source, COUNT(*) AS orders FROM sales s
    WHERE s.status <> 'cancelled' AND s.sale_date BETWEEN ? AND ? GROUP BY 1 ORDER BY orders DESC`, [from, to]);
  return { campaigns: campRows, channels, totalSpend, unattributed, sources };
}

function metrics(base, spend, revenue, salesRows) {
  const orders = salesRows.length;
  const known = salesRows.filter(r => r.new_customer !== null).length;
  const newCustomers = salesRows.filter(r => r.new_customer === 1).length;
  const missing = [];
  let roasBp = null, cac = null;
  if (spend > 0 && revenue > 0) roasBp = divRound(revenue * 10000, spend);
  else { if (!spend) missing.push('geen advertentiekosten gekoppeld'); if (!revenue) missing.push('geen toegeschreven omzet'); }
  if (spend > 0 && orders > 0 && known === orders && newCustomers > 0) cac = divRound(spend, newCustomers);
  else if (spend > 0) {
    if (!orders) missing.push('geen toegeschreven verkopen voor CAC');
    else if (known < orders) missing.push(`${orders - known} van ${orders} verkopen zonder klanttype (nieuw/bestaand)`);
    else if (!newCustomers) missing.push('geen nieuwe klanten geregistreerd');
  }
  return { ...base, spend, revenue, orders, newCustomers, knownCustomerType: known, roasBp, cac, missing };
}

module.exports = {
  revenueParts, cogs, expenseCost, otherIncome, cash, receivables, payables, inventoryValue, summary, timeseries,
  revenueByChannel, costsByCategory, productPerformance, recentTransactions, monthly, purchasesBySupplier, vatOverview, marketing,
};
