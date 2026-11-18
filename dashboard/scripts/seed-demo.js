'use strict';
// Vult een APARTE demo-database (standaard map demo-data/) met herkenbare voorbeeldgegevens.
// Je echte administratie (data/) wordt nooit aangeraakt.
//   npm run seed:demo      → maakt demo-data/dar-al-scents-demo.sqlite opnieuw aan
//   npm run demo           → start het dashboard op de demo-database (inlog: demo@voorbeeld.nl / demo-wachtwoord)
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../src/config');
const { openDb } = require('../src/db');
const C = require('../src/services/common');
const auth = require('../src/auth');
const catalog = require('../src/services/catalog');
const inv = require('../src/services/inventory');
const P = require('../src/services/purchasing');
const S = require('../src/services/sales');
const E = require('../src/services/expenses');
const pay = require('../src/services/payments');
const M = require('../src/money');

const dir = path.join(ROOT, 'demo-data');
const file = path.join(dir, 'dar-al-scents-demo.sqlite');
if (path.resolve(file) === path.resolve(ROOT, 'data', 'dar-al-scents.sqlite')) throw new Error('Weiger: demo-seed mag niet in de echte database.');
fs.rmSync(dir, { recursive: true, force: true });
const db = openDb(file);
C.ensureDefaults(db);
C.setSetting(db, 'demo_mode', '1');
C.setSetting(db, 'company_name', 'Dar Al Scents (demo)');
auth.createUser(db, { email: 'demo@voorbeeld.nl', name: 'Demo Beheerder', password: 'demo-wachtwoord', role: 'admin' });
const u = { id: 1 };
const L = (t, n) => C.lookupId(db, t, n);
const today = M.todayIso();
const d = n => M.addDays(today, -n);
let k = 0; const idem = () => `demo-${++k}`;

const sup1 = catalog.saveSupplier(db, { name: 'DEMO Aroma Groothandel', contact_name: 'Sara de Vries', email: 'inkoop@demo-aroma.example', country: 'Duitsland', payment_terms: '14 dagen', vat_number: 'DE000000000' }, u);
const sup2 = catalog.saveSupplier(db, { name: 'DEMO Oud Trading LLC', contact_name: 'Omar K.', email: 'sales@demo-oud.example', country: 'Verenigde Arabische Emiraten', payment_terms: 'Vooruitbetaling' }, u);
const sup3 = catalog.saveSupplier(db, { name: 'DEMO Verpakking BV', email: 'info@demo-verpakking.example', country: 'Nederland', payment_terms: '30 dagen' }, u);

const products = [
  ['Oud Royal Eau de Parfum', 'Parfumflessen', 'Signature', [['DEMO-OUD-100', '100 ml', 100, '79,95', 6], ['DEMO-OUD-S3', 'Sample 3 ml', 3, '4,95', 25]]],
  ['Amber Nights Extrait', 'Parfumflessen', 'Nights', [['DEMO-AMB-50', '50 ml', 50, '64,95', 5], ['DEMO-AMB-S3', 'Sample 3 ml', 3, '4,95', 25]]],
  ['Rose Musk Eau de Parfum', 'Parfumflessen', 'Garden', [['DEMO-ROS-100', '100 ml', 100, '59,95', 5]]],
  ['Discovery Set (5 × 3 ml)', 'Discovery sets', 'Signature', [['DEMO-DISC-5', 'Set', null, '19,95', 8]]],
  ['Cadeauverpakking luxe', 'Cadeauverpakkingen', null, [['DEMO-GIFT', 'Doos + lint', null, '4,95', 20]]],
];
const vid = {};
for (const [name, cat, brand, vars] of products) {
  catalog.saveProduct(db, { name, category_id: L('product_category', cat), brand, description: `Demo-product: ${name}.`, variants: vars.map(([sku, vn, ml, price, min]) => ({ sku, name: vn, size_ml: ml == null ? '' : String(ml), price_incl: price, vat: '21', min_stock: String(min) })) }, u);
  for (const v of vars) vid[v[0]] = db.get('SELECT id FROM variants WHERE sku = ?', [v[0]]).id;
}
const link = (s, sku, price, cur, pref) => catalog.saveSupplierItem(db, { supplier_id: s, variant_id: vid[sku], price, currency: cur, preferred: pref ? '1' : '', lead_days: '7', quote_date: d(60) }, u);
link(sup1, 'DEMO-OUD-100', '24,50', 'EUR', true); link(sup2, 'DEMO-OUD-100', '95,00', 'AED', false);
link(sup1, 'DEMO-AMB-50', '21,00', 'EUR', true); link(sup1, 'DEMO-ROS-100', '18,75', 'EUR', true);
link(sup1, 'DEMO-OUD-S3', '0,90', 'EUR', true); link(sup1, 'DEMO-AMB-S3', '0,85', 'EUR', true);
link(sup3, 'DEMO-GIFT', '1,10', 'EUR', true); link(sup1, 'DEMO-DISC-5', '5,20', 'EUR', true);

// Beginvoorraad 90 dagen geleden.
for (const [sku, qty, cost] of [['DEMO-OUD-100', 8, '23,80'], ['DEMO-AMB-50', 6, '20,50'], ['DEMO-ROS-100', 14, '18,00'], ['DEMO-OUD-S3', 40, '0,90'], ['DEMO-AMB-S3', 30, '0,85'], ['DEMO-DISC-5', 16, '5,00'], ['DEMO-GIFT', 30, '1,10']]) {
  inv.recordOpening(db, { variant_id: vid[sku], qty: String(qty), unit_cost: cost, date: d(90), reason: 'Demo-beginvoorraad', idem: idem() }, u);
}
// Inkooporder in EUR (volledig ontvangen en betaald) en in AED (gedeeltelijk).
const po1 = P.savePo(db, { supplier_id: sup1, order_date: d(45), currency: 'EUR', shipping: '24,95', allocation_method: 'value', status: 'ordered', lines: [{ variant_id: vid['DEMO-OUD-100'], qty: '12', unit_price: '24,50', vat: '21' }, { variant_id: vid['DEMO-AMB-50'], qty: '10', unit_price: '21,00', vat: '21' }], idem: idem() }, u);
let po = P.getPo(db, po1);
P.receive(db, po1, { date: d(40), quantities: Object.fromEntries(po.lines.map(l => [l.id, String(l.qty)])), idem: idem() }, u);
pay.recordPayment(db, { kind: 'purchase', ref_id: po1, date: d(38), amount: M.centsToInput(P.getPo(db, po1).outstanding), method_id: L('payment_method', 'Bankoverschrijving'), idem: idem() }, u);
const po2 = P.savePo(db, { supplier_id: sup2, order_date: d(20), currency: 'AED', fx_rate: '0,2510', shipping: '45,00', duties: '18,40', allocation_method: 'quantity', status: 'ordered', lines: [{ variant_id: vid['DEMO-OUD-100'], qty: '10', unit_price: '95,00', vat: '0' }], idem: idem() }, u);
po = P.getPo(db, po2);
P.receive(db, po2, { date: d(10), quantities: { [po.lines[0].id]: '6' }, idem: idem() }, u);
pay.recordPayment(db, { kind: 'purchase', ref_id: po2, date: d(19), amount: '150,00', currency: 'AED', original_amount: '597,61', fx_rate: '0,2510', method_id: L('payment_method', 'Bankoverschrijving'), idem: idem() }, u);

// Campagnes en marketingkosten.
const camp = db.insert('INSERT INTO campaigns(name, channel_id, start_date, end_date, budget_cents) VALUES (?, ?, ?, ?, ?)', ['DEMO Instagram najaar', L('marketing_channel', 'Instagram'), d(35), d(5), 30000]);
const camp2 = db.insert('INSERT INTO campaigns(name, channel_id, start_date, end_date, budget_cents) VALUES (?, ?, ?, ?, ?)', ['DEMO TikTok creators', L('marketing_channel', 'TikTok'), d(25), today, 20000]);
E.saveExpense(db, { expense_date: d(30), category_id: L('expense_category', 'Marketing en advertenties'), description: 'Instagram-advertenties', payee: 'Meta (demo)', amount: '120,00', vat_rate: '0', campaign_id: camp, paid: '1', vat_recoverable: '1', idem: idem() }, u);
E.saveExpense(db, { expense_date: d(15), category_id: L('expense_category', 'Influencers en content'), description: 'Creatorvideo’s', payee: 'Creator (demo)', amount: '150,00', vat_rate: '21', campaign_id: camp2, paid: '1', vat_recoverable: '1', idem: idem() }, u);
E.saveExpense(db, { expense_date: d(28), category_id: L('expense_category', 'Software en abonnementen'), description: 'Webshopabonnement', payee: 'Webshopplatform (demo)', amount: '36,00', vat_rate: '21', paid: '1', vat_recoverable: '1', idem: idem() }, u);
E.saveExpense(db, { expense_date: d(12), supplier_id: sup3, category_id: L('expense_category', 'Verpakking'), description: 'Verzenddozen en vulmateriaal', amount: '85,00', vat_rate: '21', due_date: M.addDays(d(12), 30), invoice_ref: 'DEMO-F-1001', vat_recoverable: '1', idem: idem() }, u);
E.saveExpense(db, { expense_date: d(3), category_id: L('expense_category', 'Verzending'), description: 'Verzendlabels', payee: 'Vervoerder (demo)', amount: '42,30', vat_rate: '21', paid: '1', vat_recoverable: '1', idem: idem() }, u);

// Verkopen verspreid over de laatste 40 dagen.
const channels = ['Webshop', 'Instagram', 'TikTok', 'WhatsApp', 'Markten en evenementen'];
const methods = ['iDEAL', 'iDEAL', 'Betaalprovider', 'Contant', 'Bankoverschrijving'];
const combos = [['DEMO-OUD-100', 1], ['DEMO-AMB-50', 1], ['DEMO-OUD-S3', 3], ['DEMO-DISC-5', 1], ['DEMO-ROS-100', 1], ['DEMO-AMB-S3', 2], ['DEMO-GIFT', 1]];
const saleIds = [];
for (let i = 0; i < 26; i++) {
  const day = d(38 - i - (i % 3));
  const c = i % channels.length;
  const lines = [combos[i % combos.length], combos[(i * 3 + 1) % combos.length]].filter((x, j, a) => a.findIndex(y => y[0] === x[0]) === j)
    .map(([sku, q]) => ({ variant_id: vid[sku], qty: String(q), discount: i % 5 === 0 ? '10%' : '' }));
  const campaignId = c === 1 ? camp : c === 2 ? camp2 : null;
  const unpaid = i === 24 || i === 25;
  const r = S.createSale(db, { sale_date: day, channel_id: L('sales_channel', channels[c]), payment_method_id: L('payment_method', methods[c]), campaign_id: campaignId, customer_ref: `demo-klant-${100 + (i % 17)}`,
    new_customer: campaignId ? (i % 4 === 0 ? '0' : '1') : '', marketing_source: c === 1 ? 'Instagram-story' : c === 2 ? 'TikTok-video' : '', shipping: c === 0 ? '4,95' : '', lines,
    fulfill: i !== 25, paid: !unpaid, idem: idem() }, u);
  saleIds.push(r.id);
}
// Een retour met terugbetaling.
const rs = S.getSale(db, saleIds[4]);
S.processReturn(db, rs.id, { date: d(25), quantities: { [rs.lines[0].id]: '1' }, restock: '1', reason: 'Demo: geur bevalt niet', idem: idem() }, u);
const after = S.getSale(db, rs.id);
if (after.outstanding < 0) pay.recordPayment(db, { kind: 'refund', ref_id: rs.id, date: d(24), amount: M.centsToInput(-after.outstanding), idem: idem() }, u);
// Beschadiging en samples weggegeven.
inv.recordManual(db, { type: 'damage', variant_id: vid['DEMO-ROS-100'], qty: '1', date: d(18), reason: 'Demo: flacon gebroken bij inpakken', idem: idem() }, u);
inv.recordManual(db, { type: 'giveaway', variant_id: vid['DEMO-OUD-S3'], qty: '5', date: d(9), reason: 'Demo: samples voor markt', idem: idem() }, u);
// Financiering: privéstorting.
E.saveEntry(db, { type: 'owner_deposit', entry_date: d(60), description: 'Demo: privéstorting startkapitaal', amount: '1000,00', idem: idem() }, u);

console.log(`Demo-database aangemaakt: ${file}`);
console.log('Start met `npm run demo` en log in met demo@voorbeeld.nl / demo-wachtwoord');
db.close();
