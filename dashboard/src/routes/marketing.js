'use strict';
const { html, money, date, num, qs, field, moneyField, opts, table } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, getPeriod, periodForm, sendCsv } = require('../web');
const { csvMoney } = require('../csv');
const C = require('../services/common');
const R = require('../services/reports');

function roas(bp) { return bp == null ? null : (bp / 10000).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '×'; }

module.exports = (app, { db }) => {
  app.get('/marketing', (req, res) => {
    const p = getPeriod(req);
    const m = R.marketing(db, p.from, p.to);
    const metricCols = first => [
      first,
      { label: 'Kosten', num: true, render: r => money(r.spend), csv: r => csvMoney(r.spend) },
      { label: 'Toegeschreven netto-omzet', num: true, render: r => money(r.revenue), csv: r => csvMoney(r.revenue) },
      { label: 'Orders', num: true, render: r => num(r.orders), csv: r => r.orders },
      { label: 'Nieuwe klanten', num: true, render: r => (r.orders ? html`${num(r.newCustomers)} <small class="muted">(${r.knownCustomerType}/${r.orders} bekend)</small>` : '–'), csv: r => r.newCustomers },
      { label: 'ROAS', num: true, render: r => roas(r.roasBp) || html`<span class="muted">n.v.t.</span>`, csv: r => roas(r.roasBp) || '' },
      { label: 'CAC', num: true, render: r => (r.cac != null ? money(r.cac) : html`<span class="muted">n.v.t.</span>`), csv: r => (r.cac != null ? csvMoney(r.cac) : '') },
      { label: 'Ontbrekende meetgegevens', render: r => (r.missing.length ? html`<small class="warn-text">${r.missing.join('; ')}</small>` : html`<small class="muted">compleet</small>`), csv: r => r.missing.join('; ') },
    ];
    const campCols = metricCols({ label: 'Campagne', render: r => html`<a href="/marketing/campagnes/${r.id}">${r.name}</a><br><small class="muted">${[r.channel, r.start ? `${date(r.start)} – ${date(r.end)}` : null].filter(Boolean).join(' · ')}</small>`, csv: r => r.name });
    const chanCols = metricCols({ label: 'Kanaal', render: r => r.name, csv: r => r.name });
    if (req.query.format === 'csv') return sendCsv(res, `marketing-${p.from}-${p.to}.csv`, campCols.map(c => ({ label: c.label, value: c.csv })), m.campaigns);
    const pq = { periode: p.key, van: p.key === 'custom' ? p.from : null, tot: p.key === 'custom' ? p.to : null };
    const body = html`${periodForm(req, p)}
      <section class="kpis kpis-3">
        <div class="kpi static"><span class="kpi-label">Marketinguitgaven</span><span class="kpi-value">${money(m.totalSpend)}</span><span class="kpi-sub">Categorieën gemarkeerd als marketing + uitgaven met campagne of marketingkanaal (excl. terugvorderbare btw)</span></div>
        <div class="kpi static"><span class="kpi-label">Toegeschreven omzet</span><span class="kpi-value">${money(m.campaigns.reduce((a, c) => a + c.revenue, 0))}</span><span class="kpi-sub">Netto-omzet van uitgeleverde verkopen met een gekoppelde campagne</span></div>
        <div class="kpi static"><span class="kpi-label">Niet toegeschreven omzet</span><span class="kpi-value">${money(m.unattributed)}</span><span class="kpi-sub">Verkopen zonder campagne</span></div>
      </section>
      <div class="card"><h2>Per campagne</h2>
        ${table({ columns: campCols, rows: m.campaigns, empty: html`Nog geen campagnes. <a href="/marketing/campagnes/nieuw">Maak een campagne</a> en koppel uitgaven en verkopen eraan.` })}
        <p class="help"><strong>Omzetbasis:</strong> netto-omzet excl. btw (na korting en retouren) van verkopen met uitleverdatum in de periode.
        <strong>Attributiemethode:</strong> handmatige toewijzing — een verkoop telt voor de campagne die bij de verkoop is vastgelegd (één campagne per verkoop, 100%).
        <strong>ROAS</strong> = toegeschreven netto-omzet ÷ marketingkosten, alleen als beide beschikbaar zijn.
        <strong>CAC</strong> = marketingkosten ÷ aantal nieuwe klanten, alleen als bij álle toegeschreven verkopen het klanttype (nieuw/bestaand) is vastgelegd.</p>
        <p><a class="btn btn-ghost btn-sm" href="${qs('/marketing', { ...pq, format: 'csv' })}">CSV-export campagnes</a></p>
      </div>
      <div class="card"><h2>Per marketingkanaal</h2>${table({ columns: chanCols, rows: m.channels, empty: 'Geen kosten of toegeschreven omzet per kanaal in deze periode.' })}
        <p class="help">Kosten per kanaal: uitgaven met dat marketingkanaal, of met een campagne in dat kanaal. Omzet: verkopen met een campagne in dat kanaal.</p></div>
      <div class="card"><h2>Opgegeven marketingbronnen (aantal orders)</h2>
        ${table({ columns: [{ label: 'Bron', key: 'source' }, { label: 'Orders', num: true, render: r => num(r.orders) }], rows: m.sources, empty: 'Geen verkopen in deze periode.' })}
        <p class="help">Vrij tekstveld bij een verkoop (bijv. “Instagram-story”), op verkoopdatum. Indicatief; wordt niet gebruikt voor ROAS.</p></div>`;
    page(req, res, { title: 'Marketing', active: 'marketing', body, actions: html`<a class="btn" href="/marketing/campagnes/nieuw">+ Campagne</a><a class="btn btn-ghost" href="/uitgaven/nieuw">+ Marketinguitgave</a>` });
  });

  function form(req, res, c, v = {}, errors = {}, status = 200) {
    const val = k => (v[k] !== undefined ? v[k] : c?.[k]);
    const body = html`<form method="post" class="card form" novalidate>${csrfInput(req)}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Naam', 'name', val('name'), { required: true, errors, class: 'span-2' })}
        ${field('Marketingkanaal', 'channel_id', val('channel_id'), { type: 'select', options: opts(C.lookups(db, 'marketing_channel')), errors })}
        ${moneyField('Budget (optioneel)', 'budget', v.budget !== undefined ? v.budget : c?.budget_cents ?? '', { errors })}
        ${field('Startdatum', 'start_date', val('start_date'), { type: 'date', errors })}
        ${field('Einddatum', 'end_date', val('end_date'), { type: 'date', errors })}
        ${field('Notities', 'notes', val('notes'), { type: 'textarea', rows: 2, class: 'span-2' })}
      </div>
      ${c ? field('Gearchiveerd', 'archived', v.archived !== undefined ? C.bool(v.archived) : c.archived, { type: 'checkbox' }) : ''}
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="/marketing">Annuleren</a></div></form>`;
    page(req, res, { title: c ? `Campagne ${c.name}` : 'Nieuwe campagne', active: 'marketing', body }, status);
  }
  function save(req, id) {
    const b = req.body;
    const data = {
      name: C.str(b.name, { required: true, max: 200, label: 'Naam', field: 'name' }),
      channel_id: C.requireLookup(db, 'marketing_channel', b.channel_id, 'marketingkanaal'),
      budget_cents: M.parseMoney(b.budget, { field: 'budget' }),
      start_date: M.parseDate(b.start_date, { label: 'Startdatum', field: 'start_date' }),
      end_date: M.parseDate(b.end_date, { label: 'Einddatum', field: 'end_date' }),
      notes: C.str(b.notes, { max: 2000 }), archived: C.bool(b.archived) ? 1 : 0,
    };
    if (data.start_date && data.end_date && data.end_date < data.start_date) throw new M.ValidationError('Einddatum ligt vóór de startdatum.', 'end_date');
    const clash = db.get('SELECT id FROM campaigns WHERE name = ? COLLATE NOCASE', [data.name]);
    if (clash && clash.id !== id) throw new M.ValidationError('Er bestaat al een campagne met deze naam.', 'name');
    if (id) db.run('UPDATE campaigns SET name=:name, channel_id=:channel_id, budget_cents=:budget_cents, start_date=:start_date, end_date=:end_date, notes=:notes, archived=:archived WHERE id=:id', { ...data, id });
    else id = db.insert('INSERT INTO campaigns(name, channel_id, budget_cents, start_date, end_date, notes) VALUES (:name, :channel_id, :budget_cents, :start_date, :end_date, :notes)', data);
    C.audit(db, req.user, 'campaign', id, 'save', { name: data.name });
    return id;
  }
  app.get('/marketing/campagnes/nieuw', (req, res) => form(req, res, null));
  app.post('/marketing/campagnes/nieuw', (req, res) => {
    try { save(req); req.addFlash('success', 'Campagne opgeslagen.'); res.redirect(303, '/marketing'); }
    catch (e) { formError(e, errors => form(req, res, null, req.body, errors, 422)); }
  });
  app.get('/marketing/campagnes/:id', (req, res, next) => {
    const c = db.get('SELECT * FROM campaigns WHERE id = ?', [Number(req.params.id)]); if (!c) return next();
    form(req, res, c);
  });
  app.post('/marketing/campagnes/:id', (req, res, next) => {
    const c = db.get('SELECT * FROM campaigns WHERE id = ?', [Number(req.params.id)]); if (!c) return next();
    try { save(req, c.id); req.addFlash('success', 'Campagne bijgewerkt.'); res.redirect(303, '/marketing'); }
    catch (e) { formError(e, errors => form(req, res, c, req.body, errors, 422)); }
  });
  void action;
};
