'use strict';
// Geld-, btw- en datumhulpfuncties. Alle bedragen zijn gehele getallen in centen;
// er wordt nergens met drijvende komma gerekend voor opgeslagen bedragen.

class ValidationError extends Error {
  constructor(message, field) { super(message); this.name = 'ValidationError'; this.field = field; this.status = 422; }
}

// Exacte afronding van n/d (gehele getallen) naar het dichtstbijzijnde gehele getal,
// bij precies .5 weg van nul (commercieel afronden).
function divRound(n, d) {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0) throw new Error(`divRound: ongeldige invoer ${n}/${d}`);
  if (d < 0) { n = -n; d = -d; }
  const neg = n < 0;
  const a = Math.abs(n);
  let q = Math.floor(a / d);
  let r = a - q * d;
  while (r < 0) { q--; r += d; }
  while (r >= d) { q++; r -= d; }
  if (2 * r >= d) q++;
  return neg ? -q : q;
}

// "1.234,56" / "1234,56" / "1234.56" / "€ 12" → centen
function parseMoney(input, { field, required = false, allowNegative = false } = {}) {
  let s = String(input ?? '').trim().replace(/[€\s]/g, '').replace(/^EUR/i, '');
  if (s === '') {
    if (required) throw new ValidationError('Bedrag is verplicht.', field);
    return null;
  }
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let intPart, frac = '';
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? ',' : '.';
    const thou = dec === ',' ? '.' : ',';
    const parts = s.split(dec);
    if (parts.length !== 2) throw new ValidationError(`Ongeldig bedrag: "${input}".`, field);
    intPart = parts[0].split(thou).join('');
    frac = parts[1];
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    if (parts.length !== 2) throw new ValidationError(`Ongeldig bedrag: "${input}".`, field);
    [intPart, frac] = parts;
  } else if (lastDot >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) { intPart = s.split('.').join(''); }
    else {
      const parts = s.split('.');
      if (parts.length !== 2) throw new ValidationError(`Ongeldig bedrag: "${input}".`, field);
      [intPart, frac] = parts;
    }
  } else {
    intPart = s;
  }
  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(frac) || frac.length > 2) {
    throw new ValidationError(`Ongeldig bedrag: "${input}" (maximaal 2 decimalen).`, field);
  }
  const cents = Number(intPart) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents > 1e13) throw new ValidationError('Bedrag is te groot.', field);
  if (neg && !allowNegative) throw new ValidationError('Bedrag mag niet negatief zijn.', field);
  return neg ? -cents : cents;
}

// "21" / "21,5" / "9%" → basispunten (2100 / 2150 / 900)
function parsePercent(input, { field, required = false, max = 100 } = {}) {
  let s = String(input ?? '').trim().replace('%', '').replace(',', '.');
  if (s === '') { if (required) throw new ValidationError('Percentage is verplicht.', field); return null; }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new ValidationError(`Ongeldig percentage: "${input}".`, field);
  const [i, f = ''] = s.split('.');
  const bp = Number(i) * 100 + Number((f + '00').slice(0, 2));
  if (bp > max * 100) throw new ValidationError(`Percentage mag niet hoger zijn dan ${max}%.`, field);
  return bp;
}

// Wisselkoers "1,0850" → micro-eenheden (1085000). Betekenis: EUR per 1 eenheid vreemde valuta.
function parseFx(input, { field } = {}) {
  let s = String(input ?? '').trim().replace(',', '.');
  if (s === '') return 1000000;
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new ValidationError(`Ongeldige wisselkoers: "${input}" (max. 6 decimalen).`, field);
  const [i, f = ''] = s.split('.');
  const micro = Number(i) * 1e6 + Number((f + '000000').slice(0, 6));
  if (micro <= 0) throw new ValidationError('Wisselkoers moet groter dan 0 zijn.', field);
  return micro;
}

function parseIntStrict(input, { field, required = false, min = null, max = null, label = 'Waarde' } = {}) {
  const s = String(input ?? '').trim();
  if (s === '') { if (required) throw new ValidationError(`${label} is verplicht.`, field); return null; }
  if (!/^-?\d+$/.test(s)) throw new ValidationError(`${label} moet een geheel getal zijn.`, field);
  const n = Number(s);
  if (!Number.isSafeInteger(n)) throw new ValidationError(`${label} is te groot.`, field);
  if (min != null && n < min) throw new ValidationError(`${label} moet minimaal ${min} zijn.`, field);
  if (max != null && n > max) throw new ValidationError(`${label} mag maximaal ${max} zijn.`, field);
  return n;
}

function parseDate(input, { field, required = false, label = 'Datum' } = {}) {
  const s = String(input ?? '').trim();
  if (s === '') { if (required) throw new ValidationError(`${label} is verplicht.`, field); return null; }
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  let y, mo, d;
  if (m) { [, y, mo, d] = m; }
  else if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s))) { [, d, mo, y] = m; }
  else throw new ValidationError(`${label}: ongeldige datum "${s}" (gebruik dd-mm-jjjj).`, field);
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dt = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== iso) throw new ValidationError(`${label}: ongeldige datum "${s}".`, field);
  return iso;
}

// Btw ----------------------------------------------------------------------------
function netFromGross(grossCents, vatBp) { return divRound(grossCents * 10000, 10000 + vatBp); }
function vatFromNet(netCents, vatBp) { return divRound(netCents * vatBp, 10000); }
function splitGross(grossCents, vatBp) { const net = netFromGross(grossCents, vatBp); return { net, vat: grossCents - net }; }
function grossFromNet(netCents, vatBp) { return netCents + vatFromNet(netCents, vatBp); }

// Valuta naar EUR met een koers in micro-eenheden.
function toEur(amountCents, fxMicro) { return divRound(amountCents * fxMicro, 1000000); }

// Verdeel een geheel bedrag over gewichten (grootste-resttelling). Som is altijd exact gelijk
// aan het totaal; bij gelijke resten krijgt de eerdere regel de cent. Reproduceerbaar.
function allocate(total, weights) {
  if (weights.length === 0) return [];
  // BigInt voor exacte tussenresultaten (geen afrondingsfouten bij grote bedragen).
  let w = weights.map(x => BigInt(Math.max(0, x)));
  let sum = w.reduce((a, b) => a + b, 0n);
  if (sum === 0n) { w = weights.map(() => 1n); sum = BigInt(w.length); }
  const T = BigInt(total);
  const parts = w.map(x => (T * x) / sum); // BigInt-deling = afkappen (T >= 0)
  let rest = T - parts.reduce((a, b) => a + b, 0n);
  const order = w.map((x, i) => ({ i, rem: T * x - parts[i] * sum }))
    .sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.i - b.i));
  for (let k = 0; rest > 0n; k = (k + 1) % order.length, rest--) parts[order[k].i]++;
  return parts.map(Number);
}

// Weergave -------------------------------------------------------------------------
const eurFmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const fmtCache = new Map();
function formatMoney(cents, currency = 'EUR') {
  if (cents == null) return '–';
  if (currency === 'EUR') return eurFmt.format(cents / 100);
  let f = fmtCache.get(currency);
  if (!f) {
    try { f = new Intl.NumberFormat('nl-NL', { style: 'currency', currency }); } catch { f = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    fmtCache.set(currency, f);
  }
  return f.format(cents / 100);
}
// Voor invoervelden: 1234,56 (zonder valutateken, met komma)
function centsToInput(cents) {
  if (cents == null) return '';
  const neg = cents < 0; const a = Math.abs(cents);
  return `${neg ? '-' : ''}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`;
}
function formatPercent(bp, digits = 1) {
  if (bp == null || Number.isNaN(bp)) return '–';
  return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(bp / 100) + '%';
}
function bpToInput(bp) { if (bp == null) return ''; return (bp % 100 === 0 ? String(bp / 100) : (bp / 100).toFixed(2).replace('.', ',')); }
function fxToInput(micro) { if (micro == null) return ''; return (micro / 1e6).toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', ','); }
const numFmt = new Intl.NumberFormat('nl-NL');
function formatNumber(n) { return n == null ? '–' : numFmt.format(n); }
function formatDate(iso) {
  if (!iso) return '–';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}
function formatDateTime(ts) {
  if (!ts) return '–';
  const d = new Date(ts.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(d);
}
// Marge in basispunten: winst / netto-omzet.
function marginBp(profit, revenue) { return revenue > 0 ? divRound(profit * 10000, revenue) : null; }

// Datums en periodes (tijdzone Europe/Amsterdam) --------------------------------------
function todayIso(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // en-CA geeft YYYY-MM-DD
}
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function periodRange(key, { from, to, today = todayIso() } = {}) {
  const [y, m] = today.split('-').map(Number);
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7; // ma=0
  const pad = n => String(n).padStart(2, '0');
  const lastDay = (yy, mm) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  switch (key) {
    case 'today': return { key, from: today, to: today, label: 'Vandaag' };
    case 'week': return { key, from: addDays(today, -dow), to: addDays(today, 6 - dow), label: 'Deze week' };
    case 'quarter': {
      const qs = Math.floor((m - 1) / 3) * 3 + 1;
      return { key, from: `${y}-${pad(qs)}-01`, to: `${y}-${pad(qs + 2)}-${lastDay(y, qs + 2)}`, label: `Dit kwartaal (K${(qs + 2) / 3})` };
    }
    case 'year': return { key, from: `${y}-01-01`, to: `${y}-12-31`, label: `Dit jaar (${y})` };
    case 'custom': {
      const f = parseDate(from, { label: 'Vanaf' }) || `${y}-${pad(m)}-01`;
      const t = parseDate(to, { label: 'Tot en met' }) || today;
      if (f > t) throw new ValidationError('De begindatum ligt na de einddatum.');
      return { key, from: f, to: t, label: `${formatDate(f)} t/m ${formatDate(t)}` };
    }
    case 'month':
    default: return { key: 'month', from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${lastDay(y, m)}`, label: 'Deze maand' };
  }
}

module.exports = {
  ValidationError, divRound, parseMoney, parsePercent, parseFx, parseIntStrict, parseDate,
  netFromGross, vatFromNet, splitGross, grossFromNet, toEur, allocate,
  formatMoney, centsToInput, formatPercent, bpToInput, fxToInput, formatNumber, formatDate, formatDateTime,
  marginBp, todayIso, addDays, periodRange,
};
