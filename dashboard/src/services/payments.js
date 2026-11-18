'use strict';
// Alle daadwerkelijke geldstromen. Een betaling hoort altijd bij precies één document
// (verkoop, inkooporder, uitgave of overige post). Dezelfde betaling kan daardoor nooit
// tegelijk als inkoopbetaling én als losse bedrijfskosten meetellen.
// Kostenregistratie (uitgave/inkooporder) en betaling zijn gescheiden: een onbetaalde factuur
// blijft als openstaand zichtbaar tot er een betaling is vastgelegd.
const { ValidationError, parseMoney, parseFx, parseDate, toEur } = require('../money');
const { audit, str, requireLookup } = require('./common');

const KIND_LABELS = {
  sale: 'Ontvangst verkoop', refund: 'Terugbetaling klant', purchase: 'Betaling inkooporder',
  expense: 'Betaling uitgave', other_income: 'Overige inkomsten', financing: 'Financiering',
};

// Bedrag dat nog betaald/ontvangen kan worden voor het gekoppelde document.
function openAmount(db, kind, ref) {
  const sales = require('./sales');
  const purchasing = require('./purchasing');
  const expenses = require('./expenses');
  if (kind === 'sale') { const s = sales.getSale(db, ref); return s ? s.outstanding : null; }
  if (kind === 'refund') { const s = sales.getSale(db, ref); return s ? s.paid - Math.max(0, s.amountDue) : null; }
  if (kind === 'purchase') { const p = purchasing.getPo(db, ref); return p ? p.outstanding : null; }
  if (kind === 'expense') { const e = expenses.getExpense(db, ref); return e ? e.outstanding : null; }
  if (kind === 'other_income' || kind === 'financing') { const e = expenses.getEntry(db, ref); return e ? e.outstanding : null; }
  return null;
}

function recordPayment(db, input, user) {
  if (!input.idem) throw new ValidationError('Ontbrekende verwerkingssleutel; herlaad het formulier.');
  return db.tx(() => {
    const dup = db.get('SELECT id FROM payments WHERE idempotency_key = ?', [input.idem]);
    if (dup) return { id: dup.id, duplicate: true };
    const kind = input.kind;
    if (!KIND_LABELS[kind]) throw new ValidationError('Onbekend betalingstype.');
    const refCol = { sale: 'sale_id', refund: 'sale_id', purchase: 'po_id', expense: 'expense_id', other_income: 'entry_id', financing: 'entry_id' }[kind];
    const ref = Number(input.ref_id);
    let direction;
    if (kind === 'sale' || kind === 'other_income') direction = 'in';
    else if (kind === 'refund' || kind === 'purchase' || kind === 'expense') direction = 'out';
    else {
      const e = db.get('SELECT type FROM other_entries WHERE id = ?', [ref]);
      if (!e) throw new ValidationError('Financieringspost niet gevonden.');
      direction = ['loan_in', 'owner_deposit'].includes(e.type) ? 'in' : 'out';
    }
    const date = parseDate(input.date, { required: true, label: 'Betaaldatum', field: 'date' });
    const currency = (str(input.currency, { max: 3 }) || 'EUR').toUpperCase();
    let amount, original = null, fx = null;
    if (currency === 'EUR') {
      amount = parseMoney(input.amount, { required: true, field: 'amount' });
    } else {
      original = parseMoney(input.original_amount ?? input.amount, { required: true, field: 'amount' });
      fx = parseFx(input.fx_rate, { field: 'fx_rate' });
      amount = toEur(original, fx);
    }
    if (amount <= 0) throw new ValidationError('Bedrag moet groter dan 0 zijn.', 'amount');
    const open = openAmount(db, kind, ref);
    if (open == null) throw new ValidationError('Gekoppeld document niet gevonden.');
    if (kind === 'sale' || kind === 'purchase' || kind === 'expense') {
      const doc = kind === 'sale' ? db.get('SELECT status FROM sales WHERE id = ?', [ref]) : kind === 'purchase' ? db.get('SELECT status FROM purchase_orders WHERE id = ?', [ref]) : db.get('SELECT status FROM expenses WHERE id = ?', [ref]);
      if (doc.status === 'cancelled') throw new ValidationError('Dit document is geannuleerd; er kan geen betaling op worden geboekt.');
    }
    if (amount > open && !input.allowOverpay) {
      throw new ValidationError(open <= 0
        ? 'Er staat niets meer open voor dit document. Een tweede, gelijke betaling wordt zo voorkomen.'
        : `Het bedrag is hoger dan wat openstaat (${(open / 100).toFixed(2).replace('.', ',')}).`, 'amount');
    }
    const id = db.insert(`INSERT INTO payments(direction, kind, pay_date, amount_cents, currency, original_amount_cents, fx_rate_micro, method_id, ${refCol},
        reference, notes, idempotency_key, user_id) VALUES (:direction, :kind, :date, :amount, :currency, :original, :fx, :method, :ref, :reference, :notes, :idem, :user)`, {
      direction, kind, date, amount, currency, original, fx,
      method: requireLookup(db, 'payment_method', input.method_id, 'betaalmethode'),
      ref, reference: str(input.reference, { max: 200 }), notes: str(input.notes, { max: 2000 }), idem: input.idem, user: user?.id,
    });
    audit(db, user, 'payment', id, 'create', { kind, ref, amount });
    if (kind === 'sale' || kind === 'refund') require('./sales').refreshStatus(db, ref);
    return { id, duplicate: false };
  });
}

function voidPayment(db, id, reason, user) {
  return db.tx(() => {
    const p = db.get('SELECT * FROM payments WHERE id = ?', [id]);
    if (!p) throw new ValidationError('Betaling niet gevonden.');
    if (p.voided) throw new ValidationError('Deze betaling is al vervallen.');
    const why = str(reason, { required: true, max: 500, label: 'Reden' });
    db.run('UPDATE payments SET voided = 1, void_reason = ? WHERE id = ?', [why, id]);
    audit(db, user, 'payment', id, 'void', { reason: why });
    if (p.sale_id) require('./sales').refreshStatus(db, p.sale_id);
  });
}

function listPayments(db, { from, to, direction, kind, q } = {}) {
  return db.all(`SELECT pay.*, m.name AS method_name,
      s.number AS sale_number, po.number AS po_number, e.description AS expense_desc, oe.description AS entry_desc
    FROM payments pay LEFT JOIN lookups m ON m.id = pay.method_id
    LEFT JOIN sales s ON s.id = pay.sale_id LEFT JOIN purchase_orders po ON po.id = pay.po_id
    LEFT JOIN expenses e ON e.id = pay.expense_id LEFT JOIN other_entries oe ON oe.id = pay.entry_id
    WHERE pay.voided = 0 AND (:from IS NULL OR pay.pay_date >= :from) AND (:to IS NULL OR pay.pay_date <= :to)
      AND (:dir IS NULL OR pay.direction = :dir) AND (:kind IS NULL OR pay.kind = :kind)
      AND (:q IS NULL OR pay.reference LIKE :ql OR s.number LIKE :ql OR po.number LIKE :ql OR e.description LIKE :ql OR oe.description LIKE :ql)
    ORDER BY pay.pay_date DESC, pay.id DESC`, { from: from || null, to: to || null, dir: direction || null, kind: kind || null, q: q || null, ql: `%${q || ''}%` });
}

module.exports = { KIND_LABELS, recordPayment, voidPayment, listPayments, openAmount };
