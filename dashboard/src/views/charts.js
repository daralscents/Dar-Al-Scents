'use strict';
// Server-side SVG-grafieken (geen externe bibliotheken of scripts nodig). Elke grafiek heeft
// een beschrijvende titel en een uitklapbare tabel met dezelfde gegevens voor toegankelijkheid.
const { html, raw, money, esc } = require('./html');

const COLORS = { revenue: '#8a6d3b', cogs: '#c9b48a', expenses: '#6b7a8f' };

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
function shortEur(cents) {
  const e = cents / 100;
  if (Math.abs(e) >= 1000) return '€' + (e / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + 'k';
  return '€' + Math.round(e).toLocaleString('nl-NL');
}

// Gegroepeerde staafgrafiek: omzet vs. kosten per periode.
function revenueCostChart(series) {
  const W = 760, H = 260, L = 56, R = 12, T = 16, B = 34;
  const keys = [['revenue', 'Netto-omzet'], ['cogs', 'Kostprijs verkopen'], ['expenses', 'Bedrijfskosten en afboekingen']];
  const max = niceMax(Math.max(1, ...series.flatMap(s => keys.map(([k]) => s[k]))));
  const iw = W - L - R, ih = H - T - B;
  const n = Math.max(series.length, 1);
  const gw = iw / n;
  const bw = Math.max(2, Math.min(16, (gw - 4) / 3));
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ct-rc"><title id="ct-rc">Netto-omzet, kostprijs verkopen en bedrijfskosten per periode</title>`;
  for (let i = 0; i <= 4; i++) {
    const y = T + ih - (ih * i) / 4;
    svg += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 4}" class="axis" text-anchor="end">${esc(shortEur((max * i) / 4))}</text>`;
  }
  const every = Math.ceil(n / 12);
  series.forEach((s, i) => {
    const gx = L + i * gw + (gw - bw * 3) / 2;
    keys.forEach(([k], j) => {
      const v = Math.max(0, s[k]);
      const h = (ih * v) / max;
      svg += `<rect x="${gx + j * bw}" y="${T + ih - h}" width="${bw - 1}" height="${h}" fill="${COLORS[k]}"><title>${esc(s.label)}: ${esc(money(s[k]))}</title></rect>`;
    });
    if (i % every === 0) svg += `<text x="${L + i * gw + gw / 2}" y="${H - 12}" class="axis" text-anchor="middle">${esc(s.label)}</text>`;
  });
  svg += '</svg>';
  return html`<figure class="chart-fig">${raw(svg)}
    <figcaption class="legend">${keys.map(([k, l]) => html`<span><i style="background:${COLORS[k]}"></i>${l}</span>`)}</figcaption>
    <details class="chart-data"><summary>Toon als tabel</summary>
      <div class="table-wrap"><table><thead><tr><th scope="col">Periode</th>${keys.map(([, l]) => html`<th scope="col" class="num">${l}</th>`)}</tr></thead>
      <tbody>${series.map(s => html`<tr><td>${s.label}</td>${keys.map(([k]) => html`<td class="num">${money(s[k])}</td>`)}</tr>`)}</tbody></table></div>
    </details></figure>`;
}

// Horizontale staven (bijv. omzet per kanaal, kosten per categorie).
function hbars(rows, { title, empty = 'Geen gegevens in deze periode.', color = '#8a6d3b', link } = {}) {
  if (!rows.length) return html`<p class="muted">${empty}</p>`;
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return html`<ul class="hbars" aria-label="${title || ''}">${rows.map(r => {
    const w = Math.max(1, Math.round((Math.abs(r.value) / max) * 100));
    const share = total ? Math.round((r.value / total) * 100) : 0;
    const label = link ? html`<a href="${link(r)}">${r.name}</a>` : r.name;
    return html`<li><div class="hbar-head"><span>${label}</span><span class="num">${money(r.value)} <small class="muted">${share}%</small></span></div>
      <div class="hbar-track"><div class="hbar" style="width:${w}%;background:${color}"></div></div></li>`;
  })}</ul>`;
}

module.exports = { revenueCostChart, hbars };
