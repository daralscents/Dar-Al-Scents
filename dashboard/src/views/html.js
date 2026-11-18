'use strict';
// Minimale, veilige templating: alle geïnterpoleerde waarden worden ge-escaped, tenzij ze
// expliciet als `raw()` zijn gemarkeerd (alleen voor eigen, gecontroleerde HTML).
const M = require('../money');

class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
const raw = s => new Raw(String(s));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s).replace(/[&<>"']/g, c => ESC[c]);
function render(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}
function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += render(vals[i]); });
  return new Raw(out);
}

const money = (c, cur) => M.formatMoney(c, cur);
const date = d => M.formatDate(d);
const pct = bp => M.formatPercent(bp);
const num = n => M.formatNumber(n);

function qs(base, params) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.set(k, v);
  const s = u.toString();
  return s ? `${base}?${s}` : base;
}

// Formulierveld met label, foutmelding en hulptekst (toegankelijk gekoppeld via aria-describedby).
function field(label, name, value, opts = {}) {
  const id = opts.id || `f-${name.replace(/[^a-z0-9]+/gi, '-')}`;
  const err = opts.errors?.[name] || opts.error;
  const describedBy = [opts.help ? `${id}-help` : null, err ? `${id}-err` : null].filter(Boolean).join(' ') || null;
  const common = html`id="${id}" name="${name}"${opts.required ? raw(' required') : ''}${describedBy ? html` aria-describedby="${describedBy}"` : ''}${err ? raw(' aria-invalid="true"') : ''}${opts.attrs ? raw(' ' + opts.attrs) : ''}`;
  let control;
  if (opts.type === 'select') {
    control = html`<select ${common}>${opts.blank !== false ? html`<option value="">${opts.blank || '— Kies —'}</option>` : ''}${(opts.options || []).map(o => html`<option value="${o.value}"${String(o.value) === String(value ?? '') ? raw(' selected') : ''}${o.attrs ? raw(' ' + o.attrs) : ''}>${o.label}</option>`)}</select>`;
  } else if (opts.type === 'textarea') {
    control = html`<textarea ${common} rows="${opts.rows || 3}">${value ?? ''}</textarea>`;
  } else if (opts.type === 'checkbox') {
    return html`<div class="field field-check${opts.class ? ' ' + opts.class : ''}"><label for="${id}"><input type="checkbox" ${common} value="1"${value ? raw(' checked') : ''}> ${label}</label>
      ${err ? html`<p class="field-error" id="${id}-err">${err}</p>` : ''}${opts.help ? html`<p class="help" id="${id}-help">${opts.help}</p>` : ''}</div>`;
  } else {
    control = html`<input type="${opts.type || 'text'}" ${common} value="${value ?? ''}"${opts.placeholder ? html` placeholder="${opts.placeholder}"` : ''}${opts.inputmode ? html` inputmode="${opts.inputmode}"` : ''}${opts.step ? html` step="${opts.step}"` : ''}${opts.min != null ? html` min="${opts.min}"` : ''}${opts.autocomplete ? html` autocomplete="${opts.autocomplete}"` : ''}>`;
  }
  return html`<div class="field${opts.class ? ' ' + opts.class : ''}${err ? ' has-error' : ''}">
    <label for="${id}">${label}${opts.required ? html`<span class="req" aria-hidden="true"> *</span>` : ''}</label>
    ${opts.prefix ? html`<div class="input-affix"><span class="affix">${opts.prefix}</span>${control}</div>` : control}
    ${opts.help ? html`<p class="help" id="${id}-help">${opts.help}</p>` : ''}
    ${err ? html`<p class="error-text" id="${id}-err">${err}</p>` : ''}
  </div>`;
}
const moneyField = (label, name, cents, opts = {}) => field(label, name, typeof cents === 'number' ? M.centsToInput(cents) : cents, { inputmode: 'decimal', prefix: '€', placeholder: '0,00', ...opts });
const opts = (rows, labelKey = 'name', valueKey = 'id') => rows.map(r => ({ value: r[valueKey], label: typeof labelKey === 'function' ? labelKey(r) : r[labelKey] }));

function badge(text, tone = 'neutral') { return html`<span class="badge badge-${tone}">${text}</span>`; }
function statusBadge(status) {
  const map = {
    concept: 'neutral', open: 'warn', besteld: 'info', 'gedeeltelijk ontvangen': 'info', ontvangen: 'ok', geannuleerd: 'muted', afgerond: 'ok',
    onbetaald: 'warn', 'gedeeltelijk betaald': 'info', betaald: 'ok', 'te veel betaald': 'danger', terugbetaald: 'muted', 'n.v.t.': 'muted',
    'niet uitgeleverd': 'warn', uitgeleverd: 'ok', 'gedeeltelijk geretourneerd': 'info', geretourneerd: 'muted', actief: 'ok', gearchiveerd: 'muted',
  };
  return badge(status, map[String(status).toLowerCase()] || 'neutral');
}

// Tabel met sorteerbare kolomkoppen (via querystring) en lege toestand.
function table({ columns, rows, sort, dir, baseUrl, query = {}, empty = 'Nog geen gegevens.', foot, caption, rowAttrs }) {
  if (!rows.length) return html`<div class="empty"><p>${empty}</p></div>`;
  const head = columns.map(c => {
    const cls = c.num ? 'num' : '';
    if (!c.sort || !baseUrl) return html`<th scope="col" class="${cls}">${c.label}</th>`;
    const active = sort === c.sort;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    const aria = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return html`<th scope="col" class="${cls}" aria-sort="${aria}"><a href="${qs(baseUrl, { ...query, sort: c.sort, dir: nextDir })}">${c.label}${active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}</a></th>`;
  });
  return html`<div class="table-wrap"><table>${caption ? html`<caption class="sr-only">${caption}</caption>` : ''}<thead><tr>${head}</tr></thead>
    <tbody>${rows.map(r => html`<tr${rowAttrs ? raw(' ' + rowAttrs(r)) : ''}>${columns.map(c => html`<td class="${c.num ? 'num' : ''}${c.class ? ' ' + c.class : ''}" data-label="${c.label}">${c.render ? c.render(r) : r[c.key]}</td>`)}</tr>`)}</tbody>
    ${foot ? html`<tfoot>${foot}</tfoot>` : ''}</table></div>`;
}

function sortRows(rows, sort, dir, keys) {
  const fn = keys[sort];
  if (!fn) return rows;
  const m = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = fn(a), y = fn(b);
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (typeof x === 'string' ? x.localeCompare(y, 'nl') : x - y) * m;
  });
}

function paginate(rows, page, per = 50) {
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  return { rows: rows.slice((p - 1) * per, p * per), page: p, pages, total: rows.length };
}
function pager(pg, baseUrl, query) {
  if (pg.pages <= 1) return '';
  return html`<nav class="pager" aria-label="Paginering">
    ${pg.page > 1 ? html`<a class="btn btn-ghost btn-sm" href="${qs(baseUrl, { ...query, page: pg.page - 1 })}">← Vorige</a>` : ''}
    <span>Pagina ${pg.page} van ${pg.pages} (${pg.total} regels)</span>
    ${pg.page < pg.pages ? html`<a class="btn btn-ghost btn-sm" href="${qs(baseUrl, { ...query, page: pg.page + 1 })}">Volgende →</a>` : ''}
  </nav>`;
}

module.exports = { html, raw, esc, Raw, money, date, pct, num, qs, field, moneyField, opts, badge, statusBadge, table, sortRows, paginate, pager };
