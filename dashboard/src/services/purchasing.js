'use strict';
// Inkooporders, ontvangsten en de berekening van de voorraadkostprijs (landed cost).
//
// Kostprijsberekening per orderregel (reproduceerbaar, volledig in hele centen):
//   netto (ordervaluta) = afronden(stukprijs × aantal × (1 − korting))
//   netto EUR           = afronden(netto × wisselkoers)
//   btw EUR             = afronden(netto EUR × btw%)
//   bijkomende kosten   = (verzending + invoerrechten + overige) verdeeld over de regels met de
//                         grootste-restmethode, naar regelwaarde (‘value’) of naar aantal (‘quantity’)
//   voorraadwaarde regel = netto EUR + toegerekende kosten (+ btw als die niet terugvorderbaar is)
// Bij een (gedeeltelijke) ontvangst krijgt die ontvangst het evenredige deel; de ontvangst die de
// regel volmaakt krijgt het exacte restant, zodat de som altijd gelijk is aan de regelwaarde.
const { ValidationError, divRound, parseMoney, parsePercent, parseFx, parseIntStrict, parseDate, toEur, vatFromNet, allocate } = require('../money');
const { audit, nextNumber, str, bool, getSettings } = require('./common');
const inventory = require('./inventory');

const STATUS_LABELS = { draft: 'Concept', ordered: 'Besteld', partial: 'Gedeeltelijk ontvangen', received: 'Ontvangen', cancelled: 'Geannuleerd' };
const ALLOCATION_LABELS = { value: 'Naar regelwaarde (netto EUR)', quantity: 'Naar aantal stuks' };

function getPo(db, id) {
  const po = db.get(`SELECT po.*, s.name AS supplier_name FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`, [id]);
  if (!po) return null;
  po.lines = db.all(`SELECT l.*, v.sku, v.name AS variant_name, p.name AS product_name,
      (SELECT COALESCE(SUM(rl.qty),0) FROM po_receipt_lines rl WHERE rl.po_line_id = l.id) AS received_qty,
      (SELECT COALESCE(SUM(rl.goods_cents),0) FROM po_receipt_lines rl WHERE rl.po_line_id = l.id) AS received_goods,
      (SELECT COALESCE(SUM(rl.extra_cents),0) FROM po_receipt_lines rl WHERE rl.po_line_id = l.id) AS received_extra
    FROM purchase_order_lines l JOIN variants v ON v.id = l.variant_id JOIN products p ON p.id = v.product_id
    WHERE l.po_id = ? ORDER BY l.sort, l.id`, [id]);
  calc(po);
  po.receipts = db.all('SELECT * FROM po_receipts WHERE po_id = ? ORDER BY id', [id]);
  for (const r of po.receipts) {
    r.lines = db.all(`SELECT rl.*, v.sku, p.name AS product_name, v.name AS variant_name FROM po_receipt_lines rl
      JOIN purchase_order_lines l ON l.id = rl.po_line_id JOIN variants v ON v.id = l.variant_id JOIN products p ON p.id = v.product_id
      WHERE rl.receipt_id = ?`, [r.id]);
  }
  po.payments = db.all(`SELECT pay.*, m.name AS method_name FROM payments pay LEFT JOIN lookups m ON m.id = pay.method_id WHERE pay.po_id = ? ORDER BY pay.pay_date, pay.id`, [id]);
  po.paid = po.payments.filter(p => !p.voided).reduce((a, p) => a + (p.direction === 'out' ? p.amount_cents : -p.amount_cents), 0);
  po.outstanding = po.status === 'cancelled' ? 0 : po.totals.payable - po.paid;
  po.payStatus = paymentStatus(po.status === 'cancelled' ? 0 : po.totals.payable, po.paid);
  return po;
}

function paymentStatus(due, paid) {
  if (due <= 0 && paid <= 0) return 'n.v.t.';
  if (paid <= 0) return 'onbetaald';
  if (paid < due) return 'gedeeltelijk betaald';
  if (paid === due) return 'betaald';
  return 'te veel betaald';
}

function calc(po) {
  const fx = po.fx_rate_micro;
  for (const l of po.lines) {
    l.net_cur = divRound(l.unit_price_cents * l.qty * (10000 - l.discount_bp), 10000);
    l.net_eur = toEur(l.net_cur, fx);
    l.vat_eur = vatFromNet(l.net_eur, l.vat_rate_bp);
  }
  const extras = po.shipping_cents + po.duties_cents + po.other_costs_cents;
  const weights = po.lines.map(l => (po.allocation_method === 'quantity' ? l.qty : l.net_eur));
  const alloc = allocate(extras, weights);
  po.lines.forEach((l, i) => {
    l.extra_eur = alloc[i];
    l.goods_eur = l.net_eur + (po.vat_recoverable ? 0 : l.vat_eur);
    l.landed_eur = l.goods_eur + l.extra_eur;
    l.landed_unit = l.qty > 0 ? divRound(l.landed_eur, l.qty) : 0;
    l.remaining_qty = l.qty - (l.received_qty || 0);
  });
  const sum = k => po.lines.reduce((a, l) => a + l[k], 0);
  po.totals = {
    net_cur: sum('net_cur'), net_eur: sum('net_eur'), vat_eur: sum('vat_eur'), extras,
    payable: sum('net_eur') + sum('vat_eur') + extras,
    landed: sum('landed_eur'),
    ordered_qty: sum('qty'), received_qty: po.lines.reduce((a, l) => a + (l.received_qty || 0), 0),
  };
  return po;
}

function parseLines(db, rawLines) {
  const arr = Array.isArray(rawLines) ? rawLines : Object.values(rawLines || {});
  const lines = [];
  arr.forEach((r, i) => {
    if (!r || (!r.variant_id && !r.qty && !r.unit_price)) return;
    const n = i + 1;
    const variantId = Number(r.variant_id);
    if (!variantId || !db.get('SELECT 1 FROM variants WHERE id = ?', [variantId])) throw new ValidationError(`Regel ${n}: kies een product.`);
    lines.push({
      variant_id: variantId,
      qty: parseIntStrict(r.qty, { required: true, min: 1, label: `Regel ${n}: aantal` }),
      unit_price_cents: parseMoney(r.unit_price, { required: true, field: 'lines' }),
      discount_bp: parsePercent(r.discount, {}) ?? 0,
      vat_rate_bp: parsePercent(r.vat, {}) ?? 2100,
    });
  });
  if (!lines.length) throw new ValidationError('Voeg minimaal één orderregel toe.', 'lines');
  return lines;
}

function parseHeader(db, input) {
  const supplierId = Number(input.supplier_id);
  if (!supplierId || !db.get('SELECT 1 FROM suppliers WHERE id = ?', [supplierId])) throw new ValidationError('Kies een leverancier.', 'supplier_id');
  const currency = (str(input.currency, { max: 3 }) || 'EUR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError('Valuta moet een ISO-code van 3 letters zijn (bijv. EUR, USD, AED).', 'currency');
  const fx = currency === 'EUR' ? 1000000 : parseFx(input.fx_rate, { field: 'fx_rate' });
  if (currency !== 'EUR' && !String(input.fx_rate ?? '').trim()) throw new ValidationError('Vul de wisselkoers naar EUR in.', 'fx_rate');
  const method = input.allocation_method === 'quantity' ? 'quantity' : 'value';
  return {
    supplier_id: supplierId,
    order_date: parseDate(input.order_date, { required: true, field: 'order_date', label: 'Besteldatum' }),
    expected_date: parseDate(input.expected_date, { field: 'expected_date', label: 'Verwachte leverdatum' }),
    reference: str(input.reference, { max: 200 }),
    currency, fx_rate_micro: fx,
    shipping_cents: parseMoney(input.shipping, { field: 'shipping' }) ?? 0,
    duties_cents: parseMoney(input.duties, { field: 'duties' }) ?? 0,
    other_costs_cents: parseMoney(input.other_costs, { field: 'other_costs' }) ?? 0,
    allocation_method: method,
    vat_recoverable: input.vat_recoverable === undefined ? (getSettings(db).vatRecoverable ? 1 : 0) : (bool(input.vat_recoverable) ? 1 : 0),
    notes: str(input.notes, { max: 4000 }),
  };
}

function savePo(db, input, user, id = null) {
  return db.tx(() => {
    if (!id && input.idem) {
      const dup = db.get('SELECT id FROM purchase_orders WHERE idempotency_key = ?', [input.idem]);
      if (dup) return dup.id;
    }
    const h = parseHeader(db, input);
    const lines = parseLines(db, input.lines);
    if (id) {
      const po = db.get('SELECT * FROM purchase_orders WHERE id = ?', [id]);
      if (!po) throw new ValidationError('Inkooporder niet gevonden.');
      if (!['draft', 'ordered'].includes(po.status) || db.get('SELECT 1 FROM po_receipts WHERE po_id = ?', [id])) {
        throw new ValidationError('Deze inkooporder heeft al ontvangsten of is afgesloten en kan niet meer worden gewijzigd.');
      }
      db.run(`UPDATE purchase_orders SET supplier_id=:supplier_id, order_date=:order_date, expected_date=:expected_date, reference=:reference, currency=:currency,
        fx_rate_micro=:fx_rate_micro, shipping_cents=:shipping_cents, duties_cents=:duties_cents, other_costs_cents=:other_costs_cents,
        allocation_method=:allocation_method, vat_recoverable=:vat_recoverable, notes=:notes, updated_at=datetime('now') WHERE id=:id`, { ...h, id });
      db.run('DELETE FROM purchase_order_lines WHERE po_id = ?', [id]);
    } else {
      const number = nextNumber(db, 'IO', h.order_date);
      id = db.insert(`INSERT INTO purchase_orders(number, supplier_id, order_date, expected_date, reference, currency, fx_rate_micro, shipping_cents, duties_cents,
        other_costs_cents, allocation_method, vat_recoverable, notes, status, idempotency_key) VALUES (:number, :supplier_id, :order_date, :expected_date, :reference, :currency, :fx_rate_micro,
        :shipping_cents, :duties_cents, :other_costs_cents, :allocation_method, :vat_recoverable, :notes, :status, :idem)`, { ...h, number, status: input.status === 'ordered' ? 'ordered' : 'draft', idem: input.idem || null });
    }
    lines.forEach((l, i) => db.run(`INSERT INTO purchase_order_lines(po_id, variant_id, qty, unit_price_cents, discount_bp, vat_rate_bp, sort)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, l.variant_id, l.qty, l.unit_price_cents, l.discount_bp, l.vat_rate_bp, i]));
    audit(db, user, 'purchase_order', id, 'save', { lines: lines.length });
    return id;
  });
}

function setStatus(db, id, action, user, reason) {
  return db.tx(() => {
    const po = getPo(db, id);
    if (!po) throw new ValidationError('Inkooporder niet gevonden.');
    if (action === 'order') {
      if (po.status !== 'draft') throw new ValidationError('Alleen een concept kan als besteld worden gemarkeerd.');
      db.run("UPDATE purchase_orders SET status = 'ordered', updated_at = datetime('now') WHERE id = ?", [id]);
    } else if (action === 'cancel') {
      if (!['draft', 'ordered'].includes(po.status) || po.receipts.length) throw new ValidationError('Een order met ontvangsten kan niet worden geannuleerd.');
      if (po.paid !== 0) throw new ValidationError('Er staan betalingen op deze order. Markeer die eerst als vervallen of registreer een terugbetaling.');
      db.run("UPDATE purchase_orders SET status = 'cancelled', notes = TRIM(COALESCE(notes,'') || char(10) || ?), updated_at = datetime('now') WHERE id = ?", [`Geannuleerd: ${reason || '-'}`, id]);
    } else throw new ValidationError('Onbekende actie.');
    audit(db, user, 'purchase_order', id, action, { reason });
  });
}

// Ontvangst registreren. `quantities` = { [po_line_id]: aantal }. Idempotent via `idem`:
// een herhaald verzoek met dezelfde sleutel levert de bestaande ontvangst op en verandert niets.
function receive(db, id, { date, quantities, notes, idem }, user) {
  if (!idem) throw new ValidationError('Ontbrekende verwerkingssleutel; herlaad het formulier.');
  return db.tx(() => {
    const dup = db.get('SELECT id FROM po_receipts WHERE idempotency_key = ?', [idem]);
    if (dup) return { receiptId: dup.id, duplicate: true };
    const po = getPo(db, id);
    if (!po) throw new ValidationError('Inkooporder niet gevonden.');
    if (!['ordered', 'partial'].includes(po.status)) throw new ValidationError(po.status === 'draft' ? 'Markeer de order eerst als besteld.' : 'Op deze order kan niets meer worden ontvangen.');
    const recvDate = parseDate(date, { required: true, label: 'Ontvangstdatum' });
    const todo = [];
    for (const l of po.lines) {
      const q = parseIntStrict(quantities?.[l.id] ?? quantities?.[String(l.id)] ?? '', { min: 0, label: `Aantal voor ${l.sku}` }) || 0;
      if (q === 0) continue;
      if (q > l.remaining_qty) throw new ValidationError(`${l.sku}: maximaal ${l.remaining_qty} nog te ontvangen (ingevuld ${q}).`);
      todo.push({ l, q });
    }
    if (!todo.length) throw new ValidationError('Vul bij minimaal één regel een ontvangen aantal in.');
    const receiptId = db.insert('INSERT INTO po_receipts(po_id, received_date, idempotency_key, notes, user_id) VALUES (?, ?, ?, ?, ?)',
      [id, recvDate, idem, str(notes, { max: 2000 }), user?.id]);
    for (const { l, q } of todo) {
      const completes = l.received_qty + q === l.qty;
      const goods = completes ? l.goods_eur - l.received_goods : divRound(l.goods_eur * q, l.qty);
      const extra = completes ? l.extra_eur - l.received_extra : divRound(l.extra_eur * q, l.qty);
      const rlId = db.insert('INSERT INTO po_receipt_lines(receipt_id, po_line_id, qty, goods_cents, extra_cents) VALUES (?, ?, ?, ?, ?)', [receiptId, l.id, q, goods, extra]);
      inventory.addStock(db, { variantId: l.variant_id, qty: q, value: goods + extra, date: recvDate, type: 'purchase', reason: `Ontvangst ${po.number}`, receiptLineId: rlId, user });
    }
    const totals = db.get(`SELECT SUM(l.qty) AS ordered, (SELECT COALESCE(SUM(rl.qty),0) FROM po_receipt_lines rl JOIN purchase_order_lines l2 ON l2.id = rl.po_line_id WHERE l2.po_id = ?) AS received
      FROM purchase_order_lines l WHERE l.po_id = ?`, [id, id]);
    db.run("UPDATE purchase_orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [totals.received >= totals.ordered ? 'received' : 'partial', id]);
    audit(db, user, 'purchase_order', id, 'receive', { receiptId, lines: todo.map(t => [t.l.id, t.q]) });
    return { receiptId, duplicate: false };
  });
}

function listPos(db, { q, status, supplierId, payStatus } = {}) {
  const rows = db.all(`SELECT po.id FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
    WHERE (:q IS NULL OR po.number LIKE :ql OR s.name LIKE :ql OR po.reference LIKE :ql)
      AND (:status IS NULL OR po.status = :status) AND (:sid IS NULL OR po.supplier_id = :sid)
    ORDER BY po.order_date DESC, po.id DESC`, { q: q || null, ql: `%${q || ''}%`, status: status || null, sid: supplierId || null });
  const out = rows.map(r => getPo(db, r.id));
  return payStatus ? out.filter(p => p.payStatus === payStatus) : out;
}

module.exports = { STATUS_LABELS, ALLOCATION_LABELS, getPo, calc, savePo, setStatus, receive, listPos, paymentStatus };
