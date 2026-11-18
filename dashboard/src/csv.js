'use strict';
// CSV lezen/schrijven. Export gebruikt ‘;’ als scheidingsteken en een UTF-8 BOM, zodat
// Nederlandse Excel-installaties het bestand direct correct openen.

function detectDelimiter(text) {
  const first = text.split(/\r?\n/).find(l => l.trim() !== '') || '';
  const count = ch => { let n = 0, q = false; for (const c of first) { if (c === '"') q = !q; else if (!q && c === ch) n++; } return n; };
  const semi = count(';'), comma = count(','), tab = count('\t');
  if (tab > semi && tab > comma) return '\t';
  return semi >= comma && semi > 0 ? ';' : ',';
}

function parseCsv(text, delimiter) {
  text = String(text).replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(text);
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"' && field === '') q = true;
    else if (c === d) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (q) throw new Error('CSV-bestand bevat een niet-afgesloten aanhalingsteken.');
  row.push(field);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  if (!rows.length) return { headers: [], records: [], delimiter: d };
  const headers = rows[0].map(h => h.trim());
  const records = rows.slice(1).map((r, idx) => {
    const o = { __line: idx + 2 };
    headers.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
    return o;
  });
  return { headers, records, delimiter: d };
}

function cell(v) {
  if (v == null) return '';
  let s = String(v);
  // Formule-injectie voorkomen bij openen in spreadsheetprogramma's.
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
  return /[;"\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns, rows) {
  const lines = [columns.map(c => cell(c.label)).join(';')];
  for (const r of rows) lines.push(columns.map(c => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// Bedragen in CSV: 1234,56 (zonder valutateken).
function csvMoney(cents) { if (cents == null) return ''; const neg = cents < 0; const a = Math.abs(cents); return `${neg ? '-' : ''}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`; }
function csvPercent(bp) { if (bp == null) return ''; return (bp / 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ','); }

module.exports = { parseCsv, toCsv, csvMoney, csvPercent, detectDelimiter };
