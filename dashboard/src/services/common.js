'use strict';
const { ValidationError } = require('../money');

const DEFAULT_SETTINGS = {
  company_name: 'Dar Al Scents',
  company_legal_name: '',
  company_address: '',
  company_vat_number: '',
  company_coc_number: '',
  currency: 'EUR',
  default_vat_bp: '2100',
  vat_rates: '2100,900,0',
  vat_recoverable: '1',          // btw-ondernemer: voorbelasting is terugvorderbaar
  prices_include_vat: '1',
  low_stock_default: '3',
  shipping_vat_bp: '2100',
  demo_mode: '0',
};

const DEFAULT_LOOKUPS = {
  product_category: ['Parfumflessen', 'Samples', 'Discovery sets', 'Cadeauverpakkingen', 'Overig'],
  sales_channel: ['Webshop', 'Instagram', 'TikTok', 'WhatsApp', 'Markten en evenementen', 'Zakelijke verkoop', 'Overig'],
  payment_method: ['iDEAL', 'Bankoverschrijving', 'Contant', 'Betaalprovider', 'Creditcard', 'PayPal'],
  expense_category: ['Marketing en advertenties', 'Influencers en content', 'Verpakking', 'Verzending', 'Software en abonnementen', 'Betaalproviderkosten', 'Fotografie en ontwerp', 'Kantoor en administratie', 'Overige bedrijfskosten'],
  income_category: ['Overige opbrengsten', 'Subsidies', 'Vergoedingen'],
  marketing_channel: ['Instagram', 'TikTok', 'Facebook', 'Google', 'E-mail', 'Influencers', 'Overig'],
};
const MARKETING_EXPENSE_CATEGORIES = new Set(['Marketing en advertenties', 'Influencers en content']);

const LOOKUP_LABELS = {
  product_category: 'Productcategorieën',
  sales_channel: 'Verkoopkanalen',
  payment_method: 'Betaalmethoden',
  expense_category: 'Kostencategorieën',
  income_category: 'Inkomstencategorieën',
  marketing_channel: 'Marketingkanalen',
};

function ensureDefaults(db) {
  db.tx(() => {
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) db.run('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)', [k, v]);
    const has = db.get('SELECT COUNT(*) AS n FROM lookups').n;
    if (!has) {
      for (const [type, names] of Object.entries(DEFAULT_LOOKUPS)) {
        names.forEach((name, i) => db.run('INSERT INTO lookups(type, name, sort, is_marketing) VALUES (?, ?, ?, ?)', [type, name, i, type === 'expense_category' && MARKETING_EXPENSE_CATEGORIES.has(name) ? 1 : 0]));
      }
    }
  });
}

function getSettings(db) {
  const s = { ...DEFAULT_SETTINGS };
  for (const r of db.all('SELECT key, value FROM settings')) s[r.key] = r.value;
  s.vatRates = s.vat_rates.split(',').map(x => Number(x)).filter(x => Number.isInteger(x));
  s.defaultVatBp = Number(s.default_vat_bp);
  s.vatRecoverable = s.vat_recoverable === '1';
  s.lowStockDefault = Number(s.low_stock_default);
  s.shippingVatBp = Number(s.shipping_vat_bp);
  s.demo = s.demo_mode === '1';
  return s;
}

function setSetting(db, key, value) {
  if (!(key in DEFAULT_SETTINGS)) throw new ValidationError(`Onbekende instelling: ${key}`);
  db.run('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, String(value)]);
}

function lookups(db, type, { includeArchived = false } = {}) {
  return db.all(`SELECT * FROM lookups WHERE type = ? ${includeArchived ? '' : 'AND archived = 0'} ORDER BY sort, name`, [type]);
}
function lookupId(db, type, value, { create = false } = {}) {
  if (value == null || String(value).trim() === '') return null;
  const v = String(value).trim();
  if (/^\d+$/.test(v)) {
    const r = db.get('SELECT id FROM lookups WHERE type = ? AND id = ?', [type, Number(v)]);
    if (r) return r.id;
  }
  const r = db.get('SELECT id FROM lookups WHERE type = ? AND name = ? COLLATE NOCASE', [type, v]);
  if (r) return r.id;
  if (create) return db.insert('INSERT INTO lookups(type, name, sort) VALUES (?, ?, 999)', [type, v]);
  throw new ValidationError(`Onbekende waarde "${v}" voor ${LOOKUP_LABELS[type] || type}.`);
}
function requireLookup(db, type, id, label) {
  if (id == null || id === '') return null;
  const r = db.get('SELECT id FROM lookups WHERE type = ? AND id = ?', [type, Number(id)]);
  if (!r) throw new ValidationError(`Kies een geldige ${label}.`);
  return r.id;
}

// Doorlopende documentnummers per soort en jaar, bijv. VK-2026-0001.
function nextNumber(db, prefix, dateIso) {
  const year = (dateIso || new Date().toISOString()).slice(0, 4);
  const name = `${prefix}-${year}`;
  return db.tx(() => {
    db.run('INSERT INTO counters(name, value) VALUES (?, 0) ON CONFLICT(name) DO NOTHING', [name]);
    db.run('UPDATE counters SET value = value + 1 WHERE name = ?', [name]);
    const v = db.get('SELECT value FROM counters WHERE name = ?', [name]).value;
    return `${name}-${String(v).padStart(4, '0')}`;
  });
}

function audit(db, user, entity, entityId, action, details) {
  db.run('INSERT INTO audit_log(user_id, entity, entity_id, action, details) VALUES (?, ?, ?, ?, ?)',
    [user?.id ?? null, entity, entityId ?? null, action, details == null ? null : JSON.stringify(details)]);
}

function str(v, { max = 2000, required = false, label = 'Veld', field } = {}) {
  const s = String(v ?? '').trim();
  if (!s) { if (required) throw new ValidationError(`${label} is verplicht.`, field); return null; }
  if (s.length > max) throw new ValidationError(`${label} is te lang (max. ${max} tekens).`, field);
  return s;
}
function bool(v) { return v === true || v === 1 || v === '1' || v === 'on' || v === 'true' || v === 'ja'; }

module.exports = {
  DEFAULT_SETTINGS, DEFAULT_LOOKUPS, LOOKUP_LABELS, ensureDefaults, getSettings, setSetting,
  lookups, lookupId, requireLookup, nextNumber, audit, str, bool,
};
