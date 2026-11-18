'use strict';
// Voorraad wordt uitsluitend berekend uit voorraadmutaties (qty en waarde in centen).
// Waardering: doorlopend gewogen gemiddelde. Bij een afboeking wordt de waarde bepaald als
// (huidige voorraadwaarde × aantal / huidige voorraad), afgerond op centen; bij de laatste
// eenheden gaat de volledige restwaarde mee, zodat de voorraadwaarde nooit ‘blijft hangen’.
const { ValidationError, divRound, parseIntStrict, parseMoney, parseDate, todayIso } = require('../money');
const { audit, str } = require('./common');

const TYPE_LABELS = {
  opening: 'Beginvoorraad',
  purchase: 'Inkoopontvangst',
  sale: 'Uitgeleverde verkoop',
  return: 'Retour',
  damage: 'Beschadiging',
  giveaway: 'Sample / weggeefactie',
  correction: 'Handmatige correctie',
};
const MANUAL_TYPES = ['damage', 'giveaway', 'correction'];

function stockOf(db, variantId, asOf = null) {
  const r = asOf
    ? db.get('SELECT COALESCE(SUM(qty),0) AS qty, COALESCE(SUM(value_cents),0) AS value FROM stock_movements WHERE variant_id = ? AND move_date <= ?', [variantId, asOf])
    : db.get('SELECT COALESCE(SUM(qty),0) AS qty, COALESCE(SUM(value_cents),0) AS value FROM stock_movements WHERE variant_id = ?', [variantId]);
  return { qty: r.qty, value: r.value, avg: r.qty > 0 ? divRound(r.value, r.qty) : null };
}

function insertMovement(db, m) {
  if (!Number.isInteger(m.qty) || m.qty === 0) throw new ValidationError('Aantal moet een geheel getal ongelijk aan 0 zijn.');
  const variant = db.get('SELECT id, sku FROM variants WHERE id = ?', [m.variantId]);
  if (!variant) throw new ValidationError('Onbekende productvariant.');
  const id = db.insert(`INSERT INTO stock_movements(variant_id, move_date, type, qty, value_cents, reason, receipt_line_id, sale_line_id, return_line_id, reverses_id, idempotency_key, user_id)
    VALUES (:variant_id, :move_date, :type, :qty, :value_cents, :reason, :receipt_line_id, :sale_line_id, :return_line_id, :reverses_id, :idem, :user_id)`, {
    variant_id: m.variantId, move_date: m.date, type: m.type, qty: m.qty, value_cents: m.value, reason: m.reason,
    receipt_line_id: m.receiptLineId, sale_line_id: m.saleLineId, return_line_id: m.returnLineId,
    reverses_id: m.reversesId, idem: m.idem, user_id: m.user?.id,
  });
  return id;
}

// Waarde van een uitgaande hoeveelheid tegen het gewogen gemiddelde. Gooit een fout bij
// onvoldoende voorraad, zodat negatieve voorraad nooit ongemerkt ontstaat.
function outgoingValue(db, variantId, qty) {
  const s = stockOf(db, variantId);
  if (qty > s.qty) {
    const v = db.get('SELECT sku FROM variants WHERE id = ?', [variantId]);
    throw new ValidationError(`Onvoldoende voorraad voor ${v?.sku ?? 'variant'}: beschikbaar ${s.qty}, nodig ${qty}. Registreer eerst een ontvangst of correctie.`);
  }
  return qty === s.qty ? s.value : divRound(s.value * qty, s.qty);
}

function removeStock(db, { variantId, qty, date, type, reason, saleLineId, idem, user }) {
  const value = outgoingValue(db, variantId, qty);
  const id = insertMovement(db, { variantId, qty: -qty, value: -value, date, type, reason, saleLineId, idem, user });
  return { id, value };
}

function addStock(db, { variantId, qty, value, date, type, reason, receiptLineId, returnLineId, idem, user }) {
  if (qty <= 0) throw new ValidationError('Aantal moet positief zijn.');
  if (value < 0) throw new ValidationError('Waarde mag niet negatief zijn.');
  return insertMovement(db, { variantId, qty, value, date, type, reason, receiptLineId, returnLineId, idem, user });
}

function findByIdem(db, idem) { return idem ? db.get('SELECT * FROM stock_movements WHERE idempotency_key = ?', [idem]) : null; }

// Beginvoorraad met beginkostprijs per stuk.
function recordOpening(db, input, user) {
  return db.tx(() => {
    const dup = findByIdem(db, input.idem);
    if (dup) return { id: dup.id, duplicate: true };
    const variantId = Number(input.variant_id);
    const qty = parseIntStrict(input.qty, { required: true, min: 1, label: 'Aantal', field: 'qty' });
    const unit = parseMoney(input.unit_cost, { required: true, field: 'unit_cost' });
    const date = parseDate(input.date, { required: true, field: 'date' });
    if (db.get("SELECT 1 FROM stock_movements WHERE variant_id = ? AND type = 'opening'", [variantId])) {
      throw new ValidationError('Voor deze variant is al een beginvoorraad vastgelegd. Gebruik een correctie.');
    }
    const id = addStock(db, { variantId, qty, value: unit * qty, date, type: 'opening', reason: str(input.reason, { max: 500 }) || 'Beginvoorraad', idem: input.idem, user });
    audit(db, user, 'stock_movement', id, 'opening', { variantId, qty, unit });
    return { id, duplicate: false };
  });
}

// Handmatige mutaties: beschadiging, sample/weggeefactie (altijd uitgaand) en correctie (+/-).
function recordManual(db, input, user) {
  return db.tx(() => {
    const dup = findByIdem(db, input.idem);
    if (dup) return { id: dup.id, duplicate: true };
    const type = input.type;
    if (!MANUAL_TYPES.includes(type)) throw new ValidationError('Kies een geldig mutatietype.', 'type');
    const variantId = Number(input.variant_id);
    if (!db.get('SELECT 1 FROM variants WHERE id = ?', [variantId])) throw new ValidationError('Kies een productvariant.', 'variant_id');
    const date = parseDate(input.date, { required: true, field: 'date' });
    const reason = str(input.reason, { required: true, max: 500, label: 'Reden', field: 'reason' });
    let qty = parseIntStrict(input.qty, { required: true, label: 'Aantal', field: 'qty' });
    if (qty === 0) throw new ValidationError('Aantal mag niet 0 zijn.', 'qty');
    if (type !== 'correction') qty = -Math.abs(qty);
    let id;
    if (qty < 0) {
      id = removeStock(db, { variantId, qty: -qty, date, type, reason, idem: input.idem, user }).id;
    } else {
      // Positieve correctie: standaard tegen huidige gemiddelde kostprijs, of opgegeven kostprijs.
      let unit = parseMoney(input.unit_cost, { field: 'unit_cost' });
      if (unit == null) {
        const s = stockOf(db, variantId);
        if (s.avg == null) throw new ValidationError('Geen gemiddelde kostprijs bekend: vul een kostprijs per stuk in.', 'unit_cost');
        unit = s.avg;
      }
      id = addStock(db, { variantId, qty, value: unit * qty, date, type, reason, idem: input.idem, user });
    }
    audit(db, user, 'stock_movement', id, type, { variantId, qty, reason });
    return { id, duplicate: false };
  });
}

// Tegenboeking van een handmatige mutatie of beginvoorraad (traceerbaar via reverses_id).
function reverseMovement(db, movementId, reason, user, date = todayIso()) {
  return db.tx(() => {
    const m = db.get('SELECT * FROM stock_movements WHERE id = ?', [movementId]);
    if (!m) throw new ValidationError('Mutatie niet gevonden.');
    if (!['opening', ...MANUAL_TYPES].includes(m.type)) throw new ValidationError('Alleen handmatige mutaties en beginvoorraad kunnen worden tegengeboekt. Gebruik voor verkopen een retour en voor inkoop een correctie.');
    if (m.reverses_id) throw new ValidationError('Een tegenboeking kan niet zelf worden tegengeboekt.');
    if (db.get('SELECT 1 FROM stock_movements WHERE reverses_id = ?', [m.id])) throw new ValidationError('Deze mutatie is al tegengeboekt.');
    const why = str(reason, { required: true, max: 500, label: 'Reden', field: 'reason' });
    if (m.qty > 0) {
      const s = stockOf(db, m.variant_id);
      if (s.qty < m.qty) throw new ValidationError(`Tegenboeken zou de voorraad negatief maken (beschikbaar ${s.qty}).`);
    }
    const id = insertMovement(db, { variantId: m.variant_id, qty: -m.qty, value: -m.value_cents, date, type: m.type, reason: `Tegenboeking #${m.id}: ${why}`, reversesId: m.id, user });
    audit(db, user, 'stock_movement', id, 'reverse', { of: m.id, reason: why });
    return id;
  });
}

// Overzicht per variant (actuele voorraad, waarde, gemiddelde kostprijs).
function stockOverview(db, { asOf = null, includeArchived = false } = {}) {
  const dateCond = asOf ? 'AND m.move_date <= :asOf' : '';
  return db.all(`SELECT v.id, v.sku, v.name AS variant_name, v.size_ml, v.edition, v.min_stock, v.price_incl_cents, v.vat_rate_bp, v.status,
      p.id AS product_id, p.name AS product_name, p.brand, c.name AS category,
      COALESCE(SUM(m.qty),0) AS qty, COALESCE(SUM(m.value_cents),0) AS value
    FROM variants v JOIN products p ON p.id = v.product_id
    LEFT JOIN lookups c ON c.id = p.category_id
    LEFT JOIN stock_movements m ON m.variant_id = v.id ${dateCond}
    WHERE (:inc = 1 OR (v.status = 'active' AND p.status = 'active'))
    GROUP BY v.id ORDER BY p.name, v.size_ml, v.name`, { asOf, inc: includeArchived ? 1 : 0 })
    .map(r => ({ ...r, avg: r.qty > 0 ? divRound(r.value, r.qty) : null, low: r.qty <= r.min_stock }));
}

module.exports = { TYPE_LABELS, MANUAL_TYPES, stockOf, outgoingValue, removeStock, addStock, recordOpening, recordManual, reverseMovement, stockOverview };
