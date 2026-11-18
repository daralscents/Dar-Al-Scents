'use strict';
// Uitgaven (kostenregistratie) en overige posten (overige inkomsten en financiering).
// De kosten tellen in het resultaat op de uitgavedatum; de betaling is een aparte kasstroom.
// Inkoop van voorraad hoort NIET als uitgave: die loopt via inkooporders en komt via de
// kostprijs van verkochte goederen in het resultaat. Dat voorkomt dubbeltelling.
const { ValidationError, parseMoney, parsePercent, parseDate, vatFromNet, splitGross, centsToInput } = require('../money');
const { audit, str, bool, requireLookup, getSettings } = require('./common');
const { paymentStatus } = require('./purchasing');

const ENTRY_TYPES = {
  other_income: { label: 'Overige inkomsten', direction: 'in', financing: false },
  loan_in: { label: 'Lening ontvangen', direction: 'in', financing: true },
  owner_deposit: { label: 'Privéstorting', direction: 'in', financing: true },
  loan_repayment: { label: 'Aflossing lening', direction: 'out', financing: true },
  owner_withdrawal: { label: 'Privéopname', direction: 'out', financing: true },
};

function getExpense(db, id) {
  const e = db.get(`SELECT e.*, c.name AS category_name, c.is_marketing, s.name AS supplier_name, m.name AS method_name,
      camp.name AS campaign_name, mc.name AS marketing_channel_name
    FROM expenses e JOIN lookups c ON c.id = e.category_id LEFT JOIN suppliers s ON s.id = e.supplier_id
    LEFT JOIN lookups m ON m.id = e.payment_method_id LEFT JOIN campaigns camp ON camp.id = e.campaign_id
    LEFT JOIN lookups mc ON mc.id = e.marketing_channel_id WHERE e.id = ?`, [id]);
  if (!e) return null;
  e.payments = db.all('SELECT pay.*, m.name AS method_name FROM payments pay LEFT JOIN lookups m ON m.id = pay.method_id WHERE pay.expense_id = ? ORDER BY pay.pay_date, pay.id', [id]);
  e.paid = e.payments.filter(p => !p.voided).reduce((a, p) => a + p.amount_cents, 0);
  e.due = e.status === 'cancelled' ? 0 : e.total_cents;
  e.outstanding = e.due - e.paid;
  e.payStatus = paymentStatus(e.due, e.paid);
  // Kosten in het resultaat: excl. btw, plus btw als die niet terugvorderbaar is.
  e.cost_cents = e.amount_excl_cents + (e.vat_recoverable ? 0 : e.vat_cents);
  e.attachments = db.all("SELECT * FROM attachments WHERE entity = 'expense' AND entity_id = ? ORDER BY id", [id]);
  return e;
}

function parseExpense(db, input) {
  const settings = getSettings(db);
  const amountMode = input.amount_mode === 'incl' ? 'incl' : 'excl';
  const vatBp = parsePercent(input.vat_rate, { field: 'vat_rate' }) ?? settings.defaultVatBp;
  let excl, vat;
  const entered = parseMoney(input.amount, { required: true, field: 'amount' });
  if (String(input.vat_amount ?? '').trim() !== '') {
    vat = parseMoney(input.vat_amount, { field: 'vat_amount' });
    excl = amountMode === 'incl' ? entered - vat : entered;
    if (excl < 0) throw new ValidationError('Btw-bedrag is hoger dan het totaalbedrag.', 'vat_amount');
  } else if (amountMode === 'incl') {
    const r = splitGross(entered, vatBp); excl = r.net; vat = r.vat;
  } else { excl = entered; vat = vatFromNet(entered, vatBp); }
  const categoryId = requireLookup(db, 'expense_category', input.category_id, 'kostencategorie');
  if (!categoryId) throw new ValidationError('Kies een kostencategorie.', 'category_id');
  const supplierId = input.supplier_id ? Number(input.supplier_id) : null;
  if (supplierId && !db.get('SELECT 1 FROM suppliers WHERE id = ?', [supplierId])) throw new ValidationError('Kies een geldige leverancier.', 'supplier_id');
  const campaignId = input.campaign_id ? Number(input.campaign_id) : null;
  if (campaignId && !db.get('SELECT 1 FROM campaigns WHERE id = ?', [campaignId])) throw new ValidationError('Kies een geldige campagne.', 'campaign_id');
  const date = parseDate(input.expense_date, { required: true, label: 'Datum', field: 'expense_date' });
  const due = parseDate(input.due_date, { label: 'Vervaldatum', field: 'due_date' });
  if (due && due < date) throw new ValidationError('De vervaldatum ligt vóór de factuurdatum.', 'due_date');
  return {
    expense_date: date, due_date: due, supplier_id: supplierId, payee: str(input.payee, { max: 200 }),
    category_id: categoryId,
    description: str(input.description, { required: true, max: 500, label: 'Omschrijving', field: 'description' }),
    amount_excl_cents: excl, vat_rate_bp: vatBp, vat_cents: vat, total_cents: excl + vat,
    vat_recoverable: input.vat_recoverable === undefined ? (settings.vatRecoverable ? 1 : 0) : (bool(input.vat_recoverable) ? 1 : 0),
    payment_method_id: requireLookup(db, 'payment_method', input.payment_method_id, 'betaalmethode'),
    campaign_id: campaignId,
    marketing_channel_id: requireLookup(db, 'marketing_channel', input.marketing_channel_id, 'marketingkanaal'),
    invoice_ref: str(input.invoice_ref, { max: 200 }), notes: str(input.notes, { max: 4000 }),
  };
}

function saveExpense(db, input, user, id = null) {
  return db.tx(() => {
    if (!id && input.idem) {
      const dup = db.get('SELECT id FROM expenses WHERE idempotency_key = ?', [input.idem]);
      if (dup) return { id: dup.id, duplicate: true };
    }
    const e = parseExpense(db, input);
    if (!e.payee && !e.supplier_id) throw new ValidationError('Vul een leverancier of ontvanger in.', 'payee');
    if (!id && !bool(input.confirm_duplicate)) {
      const same = e.invoice_ref && db.get("SELECT id FROM expenses WHERE status != 'cancelled' AND invoice_ref = ? AND COALESCE(supplier_id, 0) = ? AND COALESCE(payee, '') = ?", [e.invoice_ref, e.supplier_id || 0, e.payee || '']);
      const recent = same || db.get(`SELECT id FROM expenses WHERE status != 'cancelled' AND created_at >= datetime('now', '-10 minutes') AND expense_date = ? AND total_cents = ?
        AND COALESCE(supplier_id, 0) = ? AND COALESCE(payee, '') = ? AND description = ?`, [e.expense_date, e.total_cents, e.supplier_id || 0, e.payee || '', e.description]);
      if (recent) throw new ValidationError(same ? `Factuur ${e.invoice_ref} van deze leverancier is al geboekt (uitgave #${same.id}). Vink hieronder aan als dit echt een andere factuur is.` : `Een identieke uitgave (#${recent.id}) is zojuist al opgeslagen. Vink hieronder aan als dit echt een tweede uitgave is.`, 'confirm_duplicate');
    }
    if (id) {
      const cur = getExpense(db, id);
      if (!cur) throw new ValidationError('Uitgave niet gevonden.');
      if (cur.status === 'cancelled') throw new ValidationError('Een geannuleerde uitgave kan niet worden gewijzigd.');
      if (e.total_cents < cur.paid) throw new ValidationError('Het nieuwe totaal is lager dan wat al betaald is.');
      db.run(`UPDATE expenses SET expense_date=:expense_date, due_date=:due_date, supplier_id=:supplier_id, payee=:payee, category_id=:category_id, description=:description,
        amount_excl_cents=:amount_excl_cents, vat_rate_bp=:vat_rate_bp, vat_cents=:vat_cents, total_cents=:total_cents, vat_recoverable=:vat_recoverable,
        payment_method_id=:payment_method_id, campaign_id=:campaign_id, marketing_channel_id=:marketing_channel_id, invoice_ref=:invoice_ref, notes=:notes WHERE id=:id`, { ...e, id });
      audit(db, user, 'expense', id, 'update', { before: { amount: cur.amount_excl_cents, date: cur.expense_date }, after: { amount: e.amount_excl_cents, date: e.expense_date } });
    } else {
      id = db.insert(`INSERT INTO expenses(expense_date, due_date, supplier_id, payee, category_id, description, amount_excl_cents, vat_rate_bp, vat_cents, total_cents,
        vat_recoverable, payment_method_id, campaign_id, marketing_channel_id, invoice_ref, notes, idempotency_key) VALUES (:expense_date, :due_date, :supplier_id, :payee, :category_id,
        :description, :amount_excl_cents, :vat_rate_bp, :vat_cents, :total_cents, :vat_recoverable, :payment_method_id, :campaign_id, :marketing_channel_id, :invoice_ref, :notes, :idem)`,
      { ...e, idem: input.idem || null });
      audit(db, user, 'expense', id, 'create', { amount: e.amount_excl_cents });
      if (bool(input.paid)) {
        require('./payments').recordPayment(db, { kind: 'expense', ref_id: id, date: input.paid_date || e.expense_date, amount: centsToInput(e.total_cents), method_id: e.payment_method_id, idem: `${input.idem || 'exp-' + id}:pay` }, user);
      }
    }
    return { id, duplicate: false };
  });
}

function cancelExpense(db, id, reason, user) {
  return db.tx(() => {
    const e = getExpense(db, id);
    if (!e) throw new ValidationError('Uitgave niet gevonden.');
    if (e.paid > 0) throw new ValidationError('Er zijn betalingen geregistreerd. Markeer die eerst als vervallen.');
    const why = str(reason, { required: true, max: 500, label: 'Reden' });
    db.run("UPDATE expenses SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [why, id]);
    audit(db, user, 'expense', id, 'cancel', { reason: why });
  });
}

function listExpenses(db, { q, from, to, categoryId, payStatus, campaignId, supplierId, marketingOnly } = {}) {
  const ids = db.all(`SELECT e.id FROM expenses e JOIN lookups c ON c.id = e.category_id LEFT JOIN suppliers s ON s.id = e.supplier_id
    WHERE (:q IS NULL OR e.description LIKE :ql OR e.payee LIKE :ql OR s.name LIKE :ql OR e.invoice_ref LIKE :ql)
      AND (:from IS NULL OR e.expense_date >= :from) AND (:to IS NULL OR e.expense_date <= :to)
      AND (:cat IS NULL OR e.category_id = :cat) AND (:camp IS NULL OR e.campaign_id = :camp) AND (:sup IS NULL OR e.supplier_id = :sup)
      AND (:mkt = 0 OR c.is_marketing = 1 OR e.campaign_id IS NOT NULL)
    ORDER BY e.expense_date DESC, e.id DESC`, { q: q || null, ql: `%${q || ''}%`, from: from || null, to: to || null, cat: categoryId || null, camp: campaignId || null, sup: supplierId || null, mkt: marketingOnly ? 1 : 0 });
  const out = ids.map(r => getExpense(db, r.id));
  return payStatus ? out.filter(e => e.payStatus === payStatus) : out;
}

// Overige posten ---------------------------------------------------------------
function getEntry(db, id) {
  const e = db.get('SELECT oe.*, c.name AS category_name FROM other_entries oe LEFT JOIN lookups c ON c.id = oe.category_id WHERE oe.id = ?', [id]);
  if (!e) return null;
  e.typeInfo = ENTRY_TYPES[e.type];
  e.payments = db.all('SELECT pay.*, m.name AS method_name FROM payments pay LEFT JOIN lookups m ON m.id = pay.method_id WHERE pay.entry_id = ? ORDER BY pay.pay_date, pay.id', [id]);
  e.paid = e.payments.filter(p => !p.voided).reduce((a, p) => a + p.amount_cents, 0);
  e.due = e.status === 'cancelled' ? 0 : e.total_cents;
  e.outstanding = e.due - e.paid;
  e.payStatus = paymentStatus(e.due, e.paid);
  return e;
}

function saveEntry(db, input, user) {
  return db.tx(() => {
    if (input.idem) {
      const dup = db.get('SELECT id FROM other_entries WHERE idempotency_key = ?', [input.idem]);
      if (dup) return { id: dup.id, duplicate: true };
    }
    const type = input.type;
    const info = ENTRY_TYPES[type];
    if (!info) throw new ValidationError('Kies een soort post.', 'type');
    const amount = parseMoney(input.amount, { required: true, field: 'amount' });
    if (amount <= 0) throw new ValidationError('Bedrag moet groter dan 0 zijn.', 'amount');
    const vatBp = info.financing ? 0 : (parsePercent(input.vat_rate, { field: 'vat_rate' }) ?? 0);
    const vat = vatFromNet(amount, vatBp);
    const date = parseDate(input.entry_date, { required: true, label: 'Datum', field: 'entry_date' });
    const id = db.insert(`INSERT INTO other_entries(entry_date, type, category_id, description, amount_excl_cents, vat_rate_bp, vat_cents, total_cents, notes, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [date, type, info.financing ? null : requireLookup(db, 'income_category', input.category_id, 'inkomstencategorie'),
      str(input.description, { required: true, max: 500, label: 'Omschrijving', field: 'description' }), amount, vatBp, vat, amount + vat, str(input.notes, { max: 2000 }), input.idem || null]);
    audit(db, user, 'other_entry', id, 'create', { type, amount });
    // Financiering is per definitie een kasstroom: direct de betaling vastleggen (tenzij uitgezet).
    if (info.financing || bool(input.paid)) {
      require('./payments').recordPayment(db, { kind: info.financing ? 'financing' : 'other_income', ref_id: id, date: input.paid_date || date, amount: centsToInput(amount + vat), method_id: input.payment_method_id, idem: `${input.idem || 'entry-' + id}:pay` }, user);
    }
    return { id, duplicate: false };
  });
}

function cancelEntry(db, id, reason, user) {
  return db.tx(() => {
    const e = getEntry(db, id);
    if (!e) throw new ValidationError('Post niet gevonden.');
    if (e.paid > 0) throw new ValidationError('Markeer eerst de bijbehorende betaling als vervallen.');
    const why = str(reason, { required: true, max: 500, label: 'Reden' });
    db.run("UPDATE other_entries SET status = 'cancelled', cancel_reason = ? WHERE id = ?", [why, id]);
    audit(db, user, 'other_entry', id, 'cancel', { reason: why });
  });
}

function listEntries(db, { from, to, type } = {}) {
  return db.all(`SELECT id FROM other_entries WHERE (:from IS NULL OR entry_date >= :from) AND (:to IS NULL OR entry_date <= :to) AND (:type IS NULL OR type = :type)
    ORDER BY entry_date DESC, id DESC`, { from: from || null, to: to || null, type: type || null }).map(r => getEntry(db, r.id));
}

module.exports = { ENTRY_TYPES, getExpense, saveExpense, cancelExpense, listExpenses, getEntry, saveEntry, cancelEntry, listEntries };
