'use strict';
// Verkopen. Elke verkoopregel slaat de werkelijk gebruikte prijs, korting en btw op
// (inclusief berekende netto- en btw-bedragen). Latere prijswijzigingen raken historische
// verkopen dus niet.
//
// Momenten:
//   * Uitlevering: voorraad wordt afgeboekt en de kostprijs (COGS) wordt per regel vastgelegd.
//     Omzet wordt in rapportages erkend op de uitleverdatum, zodat omzet en kostprijs in
//     dezelfde periode vallen.
//   * Betaling: alleen een kasstroom; veroorzaakt nooit een voorraadmutatie.
//   * Retour: verlaagt de omzet op de retourdatum; bij ‘terug op voorraad’ komt de voorraad
//     terug tegen de oorspronkelijke kostprijs en daalt de COGS evenredig.
const { ValidationError, divRound, parseMoney, parsePercent, parseIntStrict, parseDate, splitGross, todayIso, centsToInput } = require('../money');
const { audit, nextNumber, str, requireLookup, getSettings, bool } = require('./common');
const inventory = require('./inventory');
const { paymentStatus } = require('./purchasing');

const STATUS_LABELS = { open: 'Open', completed: 'Afgerond', cancelled: 'Geannuleerd' };
const FULFILLMENT_LABELS = { unfulfilled: 'Niet uitgeleverd', fulfilled: 'Uitgeleverd', partially_returned: 'Gedeeltelijk geretourneerd', returned: 'Geretourneerd' };

function getSale(db, id) {
  const s = db.get(`SELECT s.*, ch.name AS channel_name, pm.name AS method_name, c.name AS campaign_name
    FROM sales s LEFT JOIN lookups ch ON ch.id = s.channel_id LEFT JOIN lookups pm ON pm.id = s.payment_method_id
    LEFT JOIN campaigns c ON c.id = s.campaign_id WHERE s.id = ?`, [id]);
  if (!s) return null;
  s.lines = db.all(`SELECT sl.*, p.name AS product_name, v.name AS variant_name FROM sale_lines sl JOIN variants v ON v.id = sl.variant_id JOIN products p ON p.id = v.product_id
    WHERE sl.sale_id = ? ORDER BY sl.id`, [id]);
  s.returns = db.all('SELECT * FROM sale_returns WHERE sale_id = ? ORDER BY id', [id]);
  for (const r of s.returns) {
    r.lines = db.all('SELECT rl.*, sl.sku, sl.description FROM sale_return_lines rl JOIN sale_lines sl ON sl.id = rl.sale_line_id WHERE rl.return_id = ?', [r.id]);
  }
  s.payments = db.all('SELECT pay.*, m.name AS method_name FROM payments pay LEFT JOIN lookups m ON m.id = pay.method_id WHERE pay.sale_id = ? ORDER BY pay.pay_date, pay.id', [id]);
  const sum = (arr, k) => arr.reduce((a, x) => a + x[k], 0);
  const retLines = s.returns.flatMap(r => r.lines);
  s.totals = {
    lines_gross: sum(s.lines, 'gross_cents'), lines_net: sum(s.lines, 'net_cents'), lines_vat: sum(s.lines, 'vat_cents'),
    discount: sum(s.lines, 'discount_cents'),
    shipping_gross: s.shipping_gross_cents, shipping_net: s.shipping_net_cents,
    total: sum(s.lines, 'gross_cents') + s.shipping_gross_cents,
    net: sum(s.lines, 'net_cents') + s.shipping_net_cents,
    vat: sum(s.lines, 'vat_cents') + s.shipping_vat_cents,
    returned_gross: sum(retLines, 'gross_cents'), returned_net: sum(retLines, 'net_cents'),
    cogs: s.lines.reduce((a, l) => a + (l.cogs_cents || 0), 0), cogs_reversed: sum(retLines, 'cogs_reversed_cents'),
  };
  const live = s.payments.filter(p => !p.voided);
  s.received = live.filter(p => p.kind === 'sale').reduce((a, p) => a + p.amount_cents, 0);
  s.refunded = live.filter(p => p.kind === 'refund').reduce((a, p) => a + p.amount_cents, 0);
  s.paid = s.received - s.refunded;
  s.amountDue = s.status === 'cancelled' ? 0 : s.totals.total - s.totals.returned_gross;
  s.outstanding = s.amountDue - s.paid;
  s.payStatus = s.refunded > 0 && s.paid <= 0 && s.amountDue <= 0 ? 'terugbetaald' : paymentStatus(s.amountDue, s.paid);
  s.grossProfit = s.fulfillment_status === 'unfulfilled' ? null : (s.totals.net - s.totals.returned_net) - (s.totals.cogs - s.totals.cogs_reversed);
  return s;
}

function refreshStatus(db, id) {
  const s = getSale(db, id);
  if (!s || s.status === 'cancelled') return;
  const done = s.fulfillment_status !== 'unfulfilled' && s.outstanding === 0;
  db.run('UPDATE sales SET status = ? WHERE id = ?', [done ? 'completed' : 'open', id]);
}

function computeLine(db, r, n, settings) {
  const variantId = Number(r.variant_id);
  const v = variantId ? db.get('SELECT v.*, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?', [variantId]) : null;
  if (!v) throw new ValidationError(`Regel ${n}: kies een product.`);
  const qty = parseIntStrict(r.qty, { required: true, min: 1, label: `Regel ${n}: aantal` });
  const unit = r.unit_price === undefined || String(r.unit_price).trim() === '' ? v.price_incl_cents : parseMoney(r.unit_price, { required: true });
  const vat = r.vat === undefined || String(r.vat).trim() === '' ? v.vat_rate_bp : parsePercent(r.vat, { required: true });
  let discount = 0;
  const ds = String(r.discount ?? '').trim();
  if (ds.endsWith('%')) discount = divRound(unit * qty * parsePercent(ds), 10000);
  else discount = parseMoney(ds) ?? 0;
  if (discount > unit * qty) throw new ValidationError(`Regel ${n}: korting is hoger dan het regelbedrag.`);
  const gross = unit * qty - discount;
  const { net, vat: vatCents } = splitGross(gross, vat);
  const label = [v.product_name, v.name].filter(Boolean).join(' – ');
  return { variant_id: v.id, description: label, sku: v.sku, qty, unit_price_incl_cents: unit, discount_cents: discount, vat_rate_bp: vat, gross_cents: gross, net_cents: net, vat_cents: vatCents };
}

function parseSale(db, input) {
  const settings = getSettings(db);
  const raw = Array.isArray(input.lines) ? input.lines : Object.values(input.lines || {});
  const lines = [];
  raw.forEach((r, i) => { if (r && (r.variant_id || r.qty)) lines.push(computeLine(db, r, i + 1, settings)); });
  if (!lines.length) throw new ValidationError('Voeg minimaal één productregel toe.', 'lines');
  const shipGross = parseMoney(input.shipping, { field: 'shipping' }) ?? 0;
  const shipVat = parsePercent(input.shipping_vat, {}) ?? settings.shippingVatBp;
  const ship = splitGross(shipGross, shipVat);
  const campaignId = input.campaign_id ? Number(input.campaign_id) : null;
  if (campaignId && !db.get('SELECT 1 FROM campaigns WHERE id = ?', [campaignId])) throw new ValidationError('Kies een geldige campagne.', 'campaign_id');
  const nc = String(input.new_customer ?? '');
  const extRef = str(input.external_ref, { max: 100 });
  return {
    header: {
      sale_date: parseDate(input.sale_date, { required: true, label: 'Verkoopdatum', field: 'sale_date' }),
      channel_id: requireLookup(db, 'sales_channel', input.channel_id, 'verkoopkanaal'),
      payment_method_id: requireLookup(db, 'payment_method', input.payment_method_id, 'betaalmethode'),
      campaign_id: campaignId,
      marketing_source: str(input.marketing_source, { max: 200 }),
      customer_ref: str(input.customer_ref, { max: 200 }),
      new_customer: nc === '1' ? 1 : nc === '0' ? 0 : null,
      external_ref: extRef,
      shipping_gross_cents: shipGross, shipping_vat_bp: shipVat, shipping_net_cents: ship.net, shipping_vat_cents: ship.vat,
      notes: str(input.notes, { max: 4000 }),
    },
    lines,
  };
}

function insertLines(db, saleId, lines) {
  for (const l of lines) {
    db.run(`INSERT INTO sale_lines(sale_id, variant_id, description, sku, qty, unit_price_incl_cents, discount_cents, vat_rate_bp, gross_cents, net_cents, vat_cents)
      VALUES (:sale_id, :variant_id, :description, :sku, :qty, :unit_price_incl_cents, :discount_cents, :vat_rate_bp, :gross_cents, :net_cents, :vat_cents)`, { ...l, sale_id: saleId });
  }
}

// Inhoudelijke vingerafdruk om per ongeluk dubbel ingevoerde verkopen te herkennen (bijv. na "terug" in de browser).
function signature(h, lines) {
  const l = lines.map(x => `${x.variant_id}:${x.qty}:${x.gross_cents}`).sort().join(',');
  return [h.sale_date, h.channel_id, h.customer_ref || '', h.external_ref || '', h.shipping_gross_cents, l].join('|');
}

// Nieuwe verkoop. Opties: fulfill (direct uitleveren) en paid (direct volledige betaling registreren).
function createSale(db, input, user) {
  return db.tx(() => {
    if (input.idem) {
      const dup = db.get('SELECT id FROM sales WHERE idempotency_key = ?', [input.idem]);
      if (dup) return { id: dup.id, duplicate: true };
    }
    const { header, lines } = parseSale(db, input);
    if (header.external_ref && db.get('SELECT 1 FROM sales WHERE external_ref = ?', [header.external_ref])) {
      throw new ValidationError(`Er bestaat al een verkoop met extern ordernummer "${header.external_ref}".`, 'external_ref');
    }
    if (!input.import_batch_id && !bool(input.confirm_duplicate)) {
      const sig = signature(header, lines);
      const recent = db.all("SELECT id, number FROM sales WHERE status != 'cancelled' AND created_at >= datetime('now', '-10 minutes') ORDER BY id DESC");
      const hit = recent.find(r => { const x = getSale(db, r.id); return signature(x, x.lines) === sig; });
      if (hit) throw new ValidationError(`Een identieke verkoop (${hit.number}) is zojuist al opgeslagen. Vink hieronder aan als dit echt een tweede, aparte verkoop is.`, 'confirm_duplicate');
    }
    const number = nextNumber(db, 'VK', header.sale_date);
    const id = db.insert(`INSERT INTO sales(number, external_ref, import_batch_id, sale_date, channel_id, payment_method_id, campaign_id, marketing_source, customer_ref, new_customer,
      shipping_gross_cents, shipping_vat_bp, shipping_net_cents, shipping_vat_cents, notes, idempotency_key)
      VALUES (:number, :external_ref, :batch, :sale_date, :channel_id, :payment_method_id, :campaign_id, :marketing_source, :customer_ref, :new_customer,
      :shipping_gross_cents, :shipping_vat_bp, :shipping_net_cents, :shipping_vat_cents, :notes, :idem)`, { ...header, number, batch: input.import_batch_id || null, idem: input.idem || null });
    insertLines(db, id, lines);
    audit(db, user, 'sale', id, 'create', { number });
    if (input.fulfill) fulfill(db, id, { date: input.fulfill_date || header.sale_date, idem: input.idem ? `${input.idem}:fulfill` : null }, user);
    if (input.paid) {
      const s = getSale(db, id);
      if (s.outstanding > 0) require('./payments').recordPayment(db, { kind: 'sale', ref_id: id, date: input.paid_date || header.sale_date, amount: centsToInput(s.outstanding), method_id: header.payment_method_id, idem: `${input.idem || 'sale-' + id}:pay` }, user);
    }
    refreshStatus(db, id);
    return { id, number, duplicate: false };
  });
}

function updateSale(db, id, input, user) {
  return db.tx(() => {
    const s = db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!s) throw new ValidationError('Verkoop niet gevonden.');
    if (s.status === 'cancelled' || s.fulfillment_status !== 'unfulfilled') throw new ValidationError('Alleen niet-uitgeleverde, niet-geannuleerde verkopen kunnen worden gewijzigd.');
    const { header, lines } = parseSale(db, input);
    if (header.external_ref && db.get('SELECT 1 FROM sales WHERE external_ref = ? AND id <> ?', [header.external_ref, id])) {
      throw new ValidationError(`Er bestaat al een verkoop met extern ordernummer "${header.external_ref}".`, 'external_ref');
    }
    db.run(`UPDATE sales SET external_ref=:external_ref, sale_date=:sale_date, channel_id=:channel_id, payment_method_id=:payment_method_id, campaign_id=:campaign_id,
      marketing_source=:marketing_source, customer_ref=:customer_ref, new_customer=:new_customer, shipping_gross_cents=:shipping_gross_cents, shipping_vat_bp=:shipping_vat_bp,
      shipping_net_cents=:shipping_net_cents, shipping_vat_cents=:shipping_vat_cents, notes=:notes WHERE id=:id`, { ...header, id });
    db.run('DELETE FROM sale_lines WHERE sale_id = ?', [id]);
    insertLines(db, id, lines);
    audit(db, user, 'sale', id, 'update', {});
    const after = getSale(db, id);
    if (after.outstanding < 0) throw new ValidationError('Het nieuwe totaal is lager dan wat al is betaald. Registreer eerst een terugbetaling.');
    refreshStatus(db, id);
    return id;
  });
}

// Uitleveren: boekt voorraad af en legt COGS vast. Idempotent: een tweede verzoek voor een al
// uitgeleverde verkoop verandert niets (en een unieke index voorkomt dubbele mutaties per regel).
function fulfill(db, id, { date, idem } = {}, user) {
  return db.tx(() => {
    const s = db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!s) throw new ValidationError('Verkoop niet gevonden.');
    if (s.status === 'cancelled') throw new ValidationError('Een geannuleerde verkoop kan niet worden uitgeleverd.');
    if (s.fulfillment_status !== 'unfulfilled') return { duplicate: true };
    const d = parseDate(date || todayIso(), { required: true, label: 'Uitleverdatum' });
    const lines = db.all('SELECT * FROM sale_lines WHERE sale_id = ?', [id]);
    // Eerst alle beschikbaarheid controleren (ook bij meerdere regels van dezelfde variant).
    const need = new Map();
    for (const l of lines) need.set(l.variant_id, (need.get(l.variant_id) || 0) + l.qty);
    for (const [vid, q] of need) inventory.outgoingValue(db, vid, q);
    // Status eerst vastleggen zodat de vergrendel-trigger daarna geldt; COGS mag nog wel worden ingevuld.
    db.run("UPDATE sales SET fulfillment_status = 'fulfilled', fulfilled_date = ? WHERE id = ?", [d, id]);
    for (const l of lines) {
      const { value } = inventory.removeStock(db, { variantId: l.variant_id, qty: l.qty, date: d, type: 'sale', reason: `Verkoop ${s.number}`, saleLineId: l.id, user });
      db.run('UPDATE sale_lines SET cogs_cents = ? WHERE id = ?', [value, l.id]);
    }
    audit(db, user, 'sale', id, 'fulfill', { date: d });
    refreshStatus(db, id);
    return { duplicate: false };
  });
}

function cancelSale(db, id, reason, user) {
  return db.tx(() => {
    const s = db.get('SELECT * FROM sales WHERE id = ?', [id]);
    if (!s) throw new ValidationError('Verkoop niet gevonden.');
    if (s.status === 'cancelled') return;
    if (s.fulfillment_status !== 'unfulfilled') throw new ValidationError('Een uitgeleverde verkoop kan niet worden geannuleerd. Verwerk een retour.');
    const why = str(reason, { required: true, max: 500, label: 'Reden' });
    db.run("UPDATE sales SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [why, id]);
    audit(db, user, 'sale', id, 'cancel', { reason: why });
  });
}

// Retour verwerken. `quantities` = { [sale_line_id]: aantal }.
function processReturn(db, id, { date, quantities, restock, reason, idem }, user) {
  if (!idem) throw new ValidationError('Ontbrekende verwerkingssleutel; herlaad het formulier.');
  return db.tx(() => {
    const dup = db.get('SELECT id FROM sale_returns WHERE idempotency_key = ?', [idem]);
    if (dup) return { returnId: dup.id, duplicate: true };
    const s = getSale(db, id);
    if (!s) throw new ValidationError('Verkoop niet gevonden.');
    if (s.fulfillment_status === 'unfulfilled') throw new ValidationError('Alleen uitgeleverde verkopen kunnen worden geretourneerd. Annuleer anders de verkoop.');
    const d = parseDate(date, { required: true, label: 'Retourdatum' });
    if (d < s.fulfilled_date) throw new ValidationError('De retourdatum ligt vóór de uitleverdatum.');
    const back = restock === true || restock === '1' || restock === 'on' ? 1 : 0;
    const todo = [];
    for (const l of s.lines) {
      const q = parseIntStrict(quantities?.[l.id] ?? quantities?.[String(l.id)] ?? '', { min: 0, label: `Retouraantal ${l.sku}` }) || 0;
      if (!q) continue;
      if (q > l.qty - l.returned_qty) throw new ValidationError(`${l.sku}: maximaal ${l.qty - l.returned_qty} te retourneren.`);
      todo.push({ l, q });
    }
    if (!todo.length) throw new ValidationError('Vul bij minimaal één regel een retouraantal in.');
    const returnId = db.insert('INSERT INTO sale_returns(sale_id, return_date, restock, reason, idempotency_key, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, d, back, str(reason, { max: 1000 }), idem, user?.id]);
    for (const { l, q } of todo) {
      const prev = db.get('SELECT COALESCE(SUM(qty),0) AS qty, COALESCE(SUM(gross_cents),0) AS gross, COALESCE(SUM(net_cents),0) AS net, COALESCE(SUM(vat_cents),0) AS vat, COALESCE(SUM(cogs_share_cents),0) AS cogs FROM sale_return_lines WHERE sale_line_id = ?', [l.id]);
      const all = prev.qty + q === l.qty;
      const part = (total, done) => (all ? total - done : divRound(total * q, l.qty));
      const gross = part(l.gross_cents, prev.gross);
      const net = part(l.net_cents, prev.net);
      const vat = gross - net;
      // Evenredig deel van de bij uitlevering vastgelegde kostprijs (exact restant bij de laatste retour).
      const cogsPart = part(l.cogs_cents, prev.cogs);
      const rlId = db.insert('INSERT INTO sale_return_lines(return_id, sale_line_id, qty, gross_cents, net_cents, vat_cents, cogs_share_cents, cogs_reversed_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [returnId, l.id, q, gross, net, vat, cogsPart, back ? cogsPart : 0]);
      if (back) inventory.addStock(db, { variantId: l.variant_id, qty: q, value: cogsPart, date: d, type: 'return', reason: `Retour ${s.number}`, returnLineId: rlId, user });
      db.run('UPDATE sale_lines SET returned_qty = returned_qty + ? WHERE id = ?', [q, l.id]);
    }
    const left = db.get('SELECT SUM(qty - returned_qty) AS left FROM sale_lines WHERE sale_id = ?', [id]).left;
    db.run('UPDATE sales SET fulfillment_status = ? WHERE id = ?', [left === 0 ? 'returned' : 'partially_returned', id]);
    audit(db, user, 'sale', id, 'return', { returnId, restock: back });
    refreshStatus(db, id);
    return { returnId, duplicate: false };
  });
}

function listSales(db, { q, from, to, channelId, status, fulfillment, payStatus, campaignId } = {}) {
  const ids = db.all(`SELECT s.id FROM sales s WHERE (:q IS NULL OR s.number LIKE :ql OR s.external_ref LIKE :ql OR s.customer_ref LIKE :ql
      OR EXISTS (SELECT 1 FROM sale_lines sl WHERE sl.sale_id = s.id AND (sl.sku LIKE :ql OR sl.description LIKE :ql)))
    AND (:from IS NULL OR s.sale_date >= :from) AND (:to IS NULL OR s.sale_date <= :to)
    AND (:ch IS NULL OR s.channel_id = :ch) AND (:st IS NULL OR s.status = :st) AND (:ff IS NULL OR s.fulfillment_status = :ff)
    AND (:camp IS NULL OR s.campaign_id = :camp)
    ORDER BY s.sale_date DESC, s.id DESC`, { q: q || null, ql: `%${q || ''}%`, from: from || null, to: to || null, ch: channelId || null, st: status || null, ff: fulfillment || null, camp: campaignId || null });
  const out = ids.map(r => getSale(db, r.id));
  return payStatus ? out.filter(s => s.payStatus === payStatus) : out;
}

module.exports = { STATUS_LABELS, FULFILLMENT_LABELS, getSale, refreshStatus, createSale, updateSale, fulfill, cancelSale, processReturn, listSales, computeLine };
