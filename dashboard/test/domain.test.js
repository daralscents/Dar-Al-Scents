'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { freshDb, admin, U, uid } = require('./helpers');
const C = require('../src/services/common');
const catalog = require('../src/services/catalog');
const inv = require('../src/services/inventory');
const P = require('../src/services/purchasing');
const S = require('../src/services/sales');
const E = require('../src/services/expenses');
const pay = require('../src/services/payments');
const R = require('../src/services/reports');
const { ValidationError } = require('../src/money');

function setup() {
  const db = freshDb(); admin(db);
  const sup = catalog.saveSupplier(db, { name: 'Leverancier A', country: 'Nederland' }, U);
  catalog.saveProduct(db, { name: 'Testgeur', category_id: C.lookupId(db, 'product_category', 'Parfumflessen'), variants: [
    { sku: 'T-100', name: '100 ml', size_ml: '100', price_incl: '60,50', vat: '21', min_stock: '2' },
    { sku: 'T-S', name: 'Sample', size_ml: '3', price_incl: '4,95', vat: '21', min_stock: '0' }] }, U);
  const v = sku => db.get('SELECT id FROM variants WHERE sku = ?', [sku]).id;
  return { db, sup, big: v('T-100'), small: v('T-S') };
}
const L = (db, t, n) => C.lookupId(db, t, n);

test('beginvoorraad, gewogen gemiddelde en geen stille negatieve voorraad', () => {
  const { db, big } = setup();
  inv.recordOpening(db, { variant_id: big, qty: '4', unit_cost: '20,00', date: '2026-10-01', idem: uid() }, U);
  assert.throws(() => inv.recordOpening(db, { variant_id: big, qty: '1', unit_cost: '1', date: '2026-10-01', idem: uid() }, U), ValidationError, 'tweede beginvoorraad geweigerd');
  inv.addStock(db, { variantId: big, qty: 4, value: 10000, date: '2026-10-02', type: 'correction', idem: uid(), user: U });
  let s = inv.stockOf(db, big);
  assert.deepEqual([s.qty, s.value], [8, 18000]);
  assert.equal(s.avg, 2250);
  inv.recordManual(db, { type: 'damage', variant_id: big, qty: '1', date: '2026-10-03', reason: 'gebroken', idem: uid() }, U);
  s = inv.stockOf(db, big);
  assert.deepEqual([s.qty, s.value], [7, 15750]);
  assert.throws(() => inv.recordManual(db, { type: 'giveaway', variant_id: big, qty: '8', date: '2026-10-03', reason: 'x', idem: uid() }, U), /Onvoldoende voorraad/);
  assert.equal(inv.stockOf(db, big).qty, 7);
  // Mutaties zijn onveranderlijk (alleen tegenboeken).
  assert.throws(() => db.run('DELETE FROM stock_movements'));
  assert.throws(() => db.run('UPDATE stock_movements SET qty = 99'));
});

test('inkooporder in vreemde valuta: deelontvangst, landed cost en idempotente ontvangst', () => {
  const { db, sup, big, small } = setup();
  const id = P.savePo(db, { supplier_id: sup, order_date: '2026-10-01', currency: 'USD', fx_rate: '0,9', shipping: '10,00', duties: '5,00', allocation_method: 'value', status: 'ordered', vat_recoverable: '1',
    lines: [{ variant_id: big, qty: '10', unit_price: '20,00', vat: '21' }, { variant_id: small, qty: '100', unit_price: '0,50', vat: '21' }], idem: uid() }, U);
  let po = P.getPo(db, id);
  // 10 × $20 + 100 × $0,50 = $250 → €225; extra €15 verdeeld 180:45 → 12 en 3.
  assert.equal(po.totals.net_eur, 22500);
  assert.equal(po.totals.extras, 1500);
  assert.equal(po.totals.payable, 22500 + 4725 + 1500);
  const lb = po.lines.find(l => l.variant_id === big);
  const idem = uid();
  P.receive(db, id, { date: '2026-10-05', quantities: { [lb.id]: '3' }, idem }, U);
  const again = P.receive(db, id, { date: '2026-10-05', quantities: { [lb.id]: '3' }, idem }, U);
  assert.equal(again.duplicate, true, 'zelfde ontvangst twee keer = geen tweede boeking');
  assert.equal(db.get('SELECT COUNT(*) n FROM po_receipts').n, 1);
  assert.equal(inv.stockOf(db, big).qty, 3);
  po = P.getPo(db, id);
  assert.equal(po.status, 'partial');
  assert.throws(() => P.receive(db, id, { date: '2026-10-06', quantities: { [lb.id]: '8' }, idem: uid() }, U), ValidationError, 'meer ontvangen dan besteld');
  P.receive(db, id, { date: '2026-10-07', quantities: Object.fromEntries(po.lines.map(l => [l.id, String(l.qty - l.received_qty)])), idem: uid() }, U);
  po = P.getPo(db, id);
  assert.equal(po.status, 'received');
  // Totale voorraadwaarde = goederen + extra kosten (btw terugvorderbaar → niet in kostprijs).
  const total = inv.stockOf(db, big).value + inv.stockOf(db, small).value;
  assert.equal(total, 22500 + 1500);
  // Big: €180 goederen + €12 extra over 10 stuks.
  assert.equal(inv.stockOf(db, big).value, 19200);
});

test('verkoop: uitlevering boekt voorraad af, historische prijs blijft bij prijswijziging', () => {
  const { db, big } = setup();
  inv.recordOpening(db, { variant_id: big, qty: '5', unit_cost: '20,00', date: '2026-10-01', idem: uid() }, U);
  const r = S.createSale(db, { sale_date: '2026-10-10', channel_id: L(db, 'sales_channel', 'Webshop'), payment_method_id: L(db, 'payment_method', 'iDEAL'),
    shipping: '4,95', lines: [{ variant_id: big, qty: '2', discount: '10%' }], fulfill: true, paid: true, idem: uid() }, U);
  let s = S.getSale(db, r.id);
  // 2 × 60,50 = 121,00 − 10% = 108,90 incl. → netto 90,00; verzending 4,95 incl. → 4,09 netto.
  assert.equal(s.lines[0].gross_cents, 10890);
  assert.equal(s.lines[0].net_cents, 9000);
  assert.equal(s.lines[0].cogs_cents, 4000);
  assert.equal(inv.stockOf(db, big).qty, 3);
  assert.equal(s.status, 'completed');
  assert.equal(s.outstanding, 0);
  // Prijs wijzigen: oude verkoop ongewijzigd, prijshistorie vastgelegd.
  catalog.updatePrices(db, [{ variant_id: big, price_incl: '70,00', vat: '21' }], U);
  s = S.getSale(db, r.id);
  assert.equal(s.lines[0].unit_price_incl_cents, 6050);
  assert.ok(db.get('SELECT COUNT(*) n FROM price_history WHERE variant_id = ?', [big]).n >= 2);
  // Nieuwe verkoop gebruikt de nieuwe prijs.
  const r2 = S.createSale(db, { sale_date: '2026-10-11', channel_id: L(db, 'sales_channel', 'Webshop'), lines: [{ variant_id: big, qty: '1' }], idem: uid() }, U);
  assert.equal(S.getSale(db, r2.id).lines[0].unit_price_incl_cents, 7000);
  // Onvoldoende voorraad → uitlevering geweigerd, niets afgeboekt.
  const r3 = S.createSale(db, { sale_date: '2026-10-12', channel_id: L(db, 'sales_channel', 'Webshop'), lines: [{ variant_id: big, qty: '9' }], idem: uid() }, U);
  assert.throws(() => S.fulfill(db, r3.id, { date: '2026-10-12', idem: uid() }, U), /Onvoldoende voorraad/);
  assert.equal(inv.stockOf(db, big).qty, 3);
  assert.equal(S.getSale(db, r3.id).fulfillment_status, 'unfulfilled');
});

test('dubbele verkoop met dezelfde sleutel wordt niet twee keer geboekt', () => {
  const { db, big } = setup();
  inv.recordOpening(db, { variant_id: big, qty: '5', unit_cost: '20,00', date: '2026-10-01', idem: uid() }, U);
  const input = { sale_date: '2026-10-10', channel_id: L(db, 'sales_channel', 'Webshop'), lines: [{ variant_id: big, qty: '1' }], fulfill: true, paid: true, idem: 'dubbel-1' };
  const a = S.createSale(db, input, U);
  const b = S.createSale(db, input, U);
  assert.equal(a.id, b.id);
  assert.equal(db.get('SELECT COUNT(*) n FROM sales').n, 1);
  assert.equal(db.get("SELECT COUNT(*) n FROM payments WHERE kind = 'sale'").n, 1);
  assert.equal(inv.stockOf(db, big).qty, 4);
});

test('retour en terugbetaling: omzet, kostprijs en voorraad corrigeren evenredig', () => {
  const { db, big } = setup();
  inv.recordOpening(db, { variant_id: big, qty: '5', unit_cost: '20,00', date: '2026-10-01', idem: uid() }, U);
  const r = S.createSale(db, { sale_date: '2026-10-10', channel_id: L(db, 'sales_channel', 'Webshop'), lines: [{ variant_id: big, qty: '3' }], fulfill: true, paid: true, idem: uid() }, U);
  let s = S.getSale(db, r.id);
  const idem = uid();
  S.processReturn(db, r.id, { date: '2026-10-15', quantities: { [s.lines[0].id]: '1' }, restock: '1', reason: 'bevalt niet', idem }, U);
  assert.equal(S.processReturn(db, r.id, { date: '2026-10-15', quantities: { [s.lines[0].id]: '1' }, restock: '1', reason: 'x', idem }, U).duplicate, true);
  assert.equal(inv.stockOf(db, big).qty, 3);
  s = S.getSale(db, r.id);
  assert.equal(s.outstanding, -6050, 'klant tegoed van 1 fles');
  pay.recordPayment(db, { kind: 'refund', ref_id: r.id, date: '2026-10-16', amount: '60,50', idem: uid() }, U);
  assert.throws(() => pay.recordPayment(db, { kind: 'refund', ref_id: r.id, date: '2026-10-16', amount: '0,01', idem: uid() }, U), ValidationError, 'meer terugbetalen dan tegoed');
  assert.throws(() => S.processReturn(db, r.id, { date: '2026-10-16', quantities: { [s.lines[0].id]: '3' }, restock: '1', reason: 'x', idem: uid() }, U), ValidationError);
  const k = R.summary(db, '2026-10-01', '2026-10-31');
  assert.equal(k.revenue.net, 3 * 5000 - 5000);
  assert.equal(k.cogs.cogs, 4000);
  assert.equal(k.grossProfit, 6000);
  assert.equal(k.cash.salesIn, 18150);
  assert.equal(k.cash.refundsOut, 6050);
});

test('KPI-definities: geen dubbeltelling van inkoop en uitgaven, financiering buiten omzet', () => {
  const { db, sup, big } = setup();
  const po = P.savePo(db, { supplier_id: sup, order_date: '2026-10-01', currency: 'EUR', allocation_method: 'value', status: 'ordered', vat_recoverable: '1', lines: [{ variant_id: big, qty: '10', unit_price: '20,00', vat: '21' }], idem: uid() }, U);
  const p = P.getPo(db, po);
  P.receive(db, po, { date: '2026-10-02', quantities: { [p.lines[0].id]: '10' }, idem: uid() }, U);
  pay.recordPayment(db, { kind: 'purchase', ref_id: po, date: '2026-10-03', amount: '100,00', idem: uid() }, U);
  assert.equal(P.getPo(db, po).payStatus, 'gedeeltelijk betaald');
  pay.recordPayment(db, { kind: 'purchase', ref_id: po, date: '2026-10-04', amount: '142,00', idem: uid() }, U);
  assert.equal(P.getPo(db, po).payStatus, 'betaald');
  assert.throws(() => pay.recordPayment(db, { kind: 'purchase', ref_id: po, date: '2026-10-04', amount: '1,00', idem: uid() }, U), ValidationError, 'dubbele betaling geblokkeerd');
  const camp = db.insert('INSERT INTO campaigns(name, channel_id) VALUES (?, ?)', ['Najaar', L(db, 'marketing_channel', 'Instagram')]);
  const ex = E.saveExpense(db, { expense_date: '2026-10-05', category_id: L(db, 'expense_category', 'Marketing en advertenties'), description: 'Ads', payee: 'Meta', amount: '121,00', amount_mode: 'incl', vat_rate: '21', campaign_id: camp, idem: uid() }, U).id;
  pay.recordPayment(db, { kind: 'expense', ref_id: ex, date: '2026-10-06', amount: '50,00', idem: uid() }, U);
  assert.equal(E.getExpense(db, ex).payStatus, 'gedeeltelijk betaald');
  E.saveEntry(db, { type: 'loan_in', entry_date: '2026-10-01', description: 'Lening', amount: '500,00', idem: uid() }, U);
  E.saveEntry(db, { type: 'other_income', entry_date: '2026-10-01', description: 'Cashback', amount: '10,00', vat_rate: '21', paid: '1', idem: uid() }, U);
  S.createSale(db, { sale_date: '2026-10-10', channel_id: L(db, 'sales_channel', 'Instagram'), campaign_id: camp, new_customer: '1', customer_ref: 'k1', lines: [{ variant_id: big, qty: '2' }], fulfill: true, paid: true, idem: uid() }, U);
  const k = R.summary(db, '2026-10-01', '2026-10-31');
  assert.equal(k.revenue.net, 10000, 'lening en overige inkomsten tellen niet als omzet');
  assert.equal(k.cogs.cogs, 4000, 'alleen verkochte stuks, niet de hele inkoop');
  assert.equal(k.expenses, 10000, 'uitgave excl. terugvorderbare btw, inkoop zit niet in kosten');
  assert.equal(k.otherIncome, 1000);
  assert.equal(k.operatingResult, 10000 - 4000 - 10000 + 1000);
  assert.equal(k.cash.purchaseOut, 24200);
  assert.equal(k.cash.expenseOut, 5000);
  assert.equal(k.cash.financingIn, 50000);
  assert.equal(k.cash.operatingNet, 12100 + 1210 - 24200 - 5000);
  assert.equal(k.inventoryValue, 16000);
  assert.equal(k.payables, 12100 - 5000);
  // Marketing: ROAS = omzet / kosten van de campagne, CAC alleen met klantdata.
  const m = R.marketing(db, '2026-10-01', '2026-10-31');
  const c = m.campaigns.find(x => x.id === camp);
  assert.equal(c.spend, 10000);
  assert.equal(c.revenue, 10000);
  assert.equal(c.roasBp, 10000);
  assert.equal(c.cac, 10000);
});

test('betaling vervallen verklaren heropent het openstaande bedrag', () => {
  const { db, big } = setup();
  inv.recordOpening(db, { variant_id: big, qty: '5', unit_cost: '20,00', date: '2026-10-01', idem: uid() }, U);
  const r = S.createSale(db, { sale_date: '2026-10-10', channel_id: L(db, 'sales_channel', 'Webshop'), lines: [{ variant_id: big, qty: '1' }], fulfill: true, paid: true, idem: uid() }, U);
  const p = db.get("SELECT id FROM payments WHERE kind = 'sale' AND sale_id = ?", [r.id]);
  pay.voidPayment(db, p.id, 'chargeback', U);
  const s = S.getSale(db, r.id);
  assert.equal(s.outstanding, 6050);
  assert.notEqual(s.status, 'completed');
  assert.throws(() => db.run('DELETE FROM payments'));
});
