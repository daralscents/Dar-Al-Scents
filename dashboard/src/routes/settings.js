'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { html, raw, field, table, badge } = require('../views/html');
const M = require('../money');
const { page, action, csrfInput, requireAdmin } = require('../web');
const auth = require('../auth');
const C = require('../services/common');

module.exports = (app, { db, config }) => {
  app.get('/instellingen', (req, res) => {
    const s = req.settings;
    const isAdmin = req.user.role === 'admin';
    const users = isAdmin ? db.all('SELECT id, email, name, role, active, created_at FROM users ORDER BY id') : [];
    const body = html`
    <nav class="tabs" aria-label="Instellingen"><a href="#bedrijf">Bedrijf</a><a href="#btw">Btw</a><a href="#lijsten">Keuzelijsten</a>${isAdmin ? html`<a href="#gebruikers">Gebruikers</a>` : ''}<a href="#wachtwoord">Wachtwoord</a><a href="/import">Import</a>${isAdmin ? html`<a href="#backup">Back-up</a><a href="/instellingen/audit">Audit-log</a>` : ''}</nav>
    <section class="card" id="bedrijf"><h2>Bedrijfsgegevens</h2>
      <form method="post" action="/instellingen/algemeen" class="form">${csrfInput(req)}
        <div class="grid-form">
          ${field('Bedrijfsnaam (in het dashboard)', 'company_name', s.company_name, { required: true })}
          ${field('Statutaire naam', 'company_legal_name', s.company_legal_name)}
          ${field('Adres', 'company_address', s.company_address, { type: 'textarea', rows: 2 })}
          ${field('Btw-nummer', 'company_vat_number', s.company_vat_number)}
          ${field('KvK-nummer', 'company_coc_number', s.company_coc_number)}
          ${field('Standaard minimale voorraad', 'low_stock_default', s.low_stock_default, { inputmode: 'numeric' })}
        </div>
        <p class="help">Valuta: EUR. Datums en bedragen in Nederlandse notatie (dd-mm-jjjj, 1.234,56).</p>
        ${isAdmin ? html`<button class="btn" type="submit">Opslaan</button>` : ''}
      </form></section>
    <section class="card" id="btw"><h2>Btw</h2>
      <form method="post" action="/instellingen/btw" class="form">${csrfInput(req)}
        <div class="grid-form">
          ${field('Standaard btw-tarief %', 'default_vat', M.bpToInput(s.defaultVatBp), { inputmode: 'decimal' })}
          ${field('Beschikbare tarieven % (komma-gescheiden met ;)', 'vat_rates', s.vatRates.map(M.bpToInput).join('; '), { help: 'bijv. 21; 9; 0' })}
          ${field('Btw over verzendopbrengst %', 'shipping_vat', M.bpToInput(s.shippingVatBp), { inputmode: 'decimal' })}
        </div>
        ${field('Ik ben btw-plichtig ondernemer: voorbelasting is standaard terugvorderbaar', 'vat_recoverable', s.vatRecoverable, { type: 'checkbox', help: 'Uit (bijv. bij de kleineondernemersregeling): btw op inkoop en kosten telt dan standaard als kosten/kostprijs. Per inkooporder en uitgave aan te passen.' })}
        <div class="explain"><strong>Aannames:</strong> verkoopprijzen zijn inclusief btw (consumentenverkoop); de btw wordt per regel exact in centen uitgerekend en samen met het gebruikte tarief opgeslagen, zodat latere tariefwijzigingen historische transacties niet raken.
        Het btw-rapport is indicatief en geen aangifte.</div>
        ${isAdmin ? html`<button class="btn" type="submit">Opslaan</button>` : ''}
      </form></section>
    <section class="card" id="lijsten"><h2>Keuzelijsten</h2>
      <p class="help">Waarden die al in gebruik zijn kun je archiveren; ze blijven dan zichtbaar in de historie maar zijn niet meer te kiezen.</p>
      <div class="grid-3">${Object.entries(C.LOOKUP_LABELS).map(([type, label]) => html`<div class="subcard"><h3>${label}</h3>
        <ul class="lookup-list">${C.lookups(db, type, { includeArchived: true }).map(l => html`<li class="${l.archived ? 'muted' : ''}">
          ${isAdmin ? html`<form method="post" action="/instellingen/lijsten/${l.id}" class="lookup-row">${csrfInput(req)}
            <label class="sr-only" for="lk-${l.id}">Naam</label><input id="lk-${l.id}" name="name" value="${l.name}" class="w-lg">
            ${type === 'expense_category' ? html`<label class="tiny"><input type="checkbox" name="is_marketing" value="1"${l.is_marketing ? raw(' checked') : ''}> marketing</label>` : ''}
            <label class="tiny"><input type="checkbox" name="archived" value="1"${l.archived ? raw(' checked') : ''}> archief</label>
            <button class="btn btn-ghost btn-xs" type="submit">Opslaan</button></form>` : html`${l.name}${l.archived ? ' (archief)' : ''}`}</li>`)}</ul>
        ${isAdmin ? html`<form method="post" action="/instellingen/lijsten" class="lookup-row">${csrfInput(req)}<input type="hidden" name="type" value="${type}">
          <label class="sr-only" for="new-${type}">Nieuwe waarde</label><input id="new-${type}" name="name" placeholder="Nieuwe waarde" class="w-lg" required><button class="btn btn-xs" type="submit">Toevoegen</button></form>` : ''}
      </div>`)}</div></section>
    ${isAdmin ? html`<section class="card" id="gebruikers"><h2>Gebruikers</h2>
      ${table({ columns: [{ label: 'Naam', key: 'name' }, { label: 'E-mail', key: 'email' }, { label: 'Rol', render: u => (u.role === 'admin' ? 'Beheerder' : 'Alleen lezen') },
        { label: 'Status', render: u => badge(u.active ? 'actief' : 'gedeactiveerd', u.active ? 'ok' : 'muted') },
        { label: '', render: u => (u.id === req.user.id ? html`<small class="muted">jij</small>` : html`<form method="post" action="/instellingen/gebruikers/${u.id}" class="inline">${csrfInput(req)}
          <select name="role" aria-label="Rol"><option value="admin"${u.role === 'admin' ? raw(' selected') : ''}>Beheerder</option><option value="viewer"${u.role === 'viewer' ? raw(' selected') : ''}>Alleen lezen</option></select>
          <label class="tiny"><input type="checkbox" name="active" value="1"${u.active ? raw(' checked') : ''}> actief</label>
          <label class="sr-only" for="pw-${u.id}">Nieuw tijdelijk wachtwoord voor ${u.name}</label><input id="pw-${u.id}" type="password" name="new_password" placeholder="Nieuw wachtwoord (optioneel)" autocomplete="new-password" class="w-md"><button class="btn btn-ghost btn-xs" type="submit">Opslaan</button></form>`) }], rows: users })}
      <h3>Gebruiker toevoegen</h3>
      <form method="post" action="/instellingen/gebruikers" class="form">${csrfInput(req)}<div class="grid-form">
        ${field('Naam', 'name', '', { required: true })}${field('E-mail', 'email', '', { type: 'email', required: true, autocomplete: 'off' })}
        ${field('Tijdelijk wachtwoord (min. 10 tekens)', 'password', '', { type: 'password', required: true, autocomplete: 'new-password' })}
        ${field('Rol', 'role', 'viewer', { type: 'select', blank: false, options: [{ value: 'viewer', label: 'Alleen lezen' }, { value: 'admin', label: 'Beheerder' }] })}
      </div><button class="btn" type="submit">Toevoegen</button></form></section>` : ''}
    <section class="card" id="wachtwoord"><h2>Eigen wachtwoord wijzigen</h2>
      <form method="post" action="/instellingen/wachtwoord" class="form">${csrfInput(req)}<div class="grid-form">
        ${field('Huidig wachtwoord', 'current', '', { type: 'password', required: true, autocomplete: 'current-password' })}
        ${field('Nieuw wachtwoord (min. 10 tekens)', 'password', '', { type: 'password', required: true, autocomplete: 'new-password' })}
        ${field('Herhaal nieuw wachtwoord', 'password2', '', { type: 'password', required: true, autocomplete: 'new-password' })}
      </div><button class="btn" type="submit">Wijzigen</button></form></section>
    ${isAdmin ? html`<section class="card" id="backup"><h2>Back-up en herstel</h2>
      <p>Database: <code>${config.dbFile}</code><br>Bijlagen: <code>${config.uploadDir}</code></p>
      <ol><li><strong>Back-up maken:</strong> <code>npm run backup</code> (maakt een consistente kopie van database en bijlagen in <code>${config.backupDir}</code>), of download hieronder een momentopname van de database.</li>
      <li><strong>Herstellen:</strong> stop de applicatie, voer <code>npm run restore -- &lt;map-van-back-up&gt;</code> uit en start opnieuw. Zie README voor details.</li></ol>
      <form method="post" action="/instellingen/backup">${csrfInput(req)}<button class="btn btn-ghost" type="submit">Database-momentopname downloaden</button></form>
      <p class="help">Bewaar back-ups versleuteld en buiten deze server (bijv. versleutelde cloudopslag). Bijlagen worden alleen door <code>npm run backup</code> meegenomen.</p>
    </section>` : ''}`;
    page(req, res, { title: 'Instellingen', active: 'instellingen', body });
  });

  app.post('/instellingen/algemeen', requireAdmin, action((req, res) => {
    const b = req.body;
    db.tx(() => {
      C.setSetting(db, 'company_name', C.str(b.company_name, { required: true, max: 100, label: 'Bedrijfsnaam' }));
      for (const k of ['company_legal_name', 'company_address', 'company_vat_number', 'company_coc_number']) C.setSetting(db, k, C.str(b[k], { max: 500 }) || '');
      C.setSetting(db, 'low_stock_default', String(M.parseIntStrict(b.low_stock_default, { min: 0, label: 'Minimale voorraad' }) ?? 0));
      C.audit(db, req.user, 'settings', null, 'update', { section: 'algemeen' });
    });
    req.addFlash('success', 'Instellingen opgeslagen.');
    res.redirect(303, '/instellingen');
  }));
  app.post('/instellingen/btw', requireAdmin, action((req, res) => {
    const b = req.body;
    const rates = String(b.vat_rates || '').split(/[;|]/).map(x => x.trim()).filter(Boolean).map(x => M.parsePercent(x, { required: true }));
    if (!rates.length) throw new M.ValidationError('Vul minimaal één btw-tarief in.');
    const def = M.parsePercent(b.default_vat, { required: true });
    if (!rates.includes(def)) rates.unshift(def);
    db.tx(() => {
      C.setSetting(db, 'default_vat_bp', String(def));
      C.setSetting(db, 'vat_rates', [...new Set(rates)].join(','));
      C.setSetting(db, 'shipping_vat_bp', String(M.parsePercent(b.shipping_vat, { required: true })));
      C.setSetting(db, 'vat_recoverable', C.bool(b.vat_recoverable) ? '1' : '0');
      C.audit(db, req.user, 'settings', null, 'update', { section: 'btw' });
    });
    req.addFlash('success', 'Btw-instellingen opgeslagen. Bestaande transacties behouden hun oorspronkelijke tarief.');
    res.redirect(303, '/instellingen#btw');
  }));
  app.post('/instellingen/lijsten', requireAdmin, action((req, res) => {
    const type = req.body.type;
    if (!C.LOOKUP_LABELS[type]) throw new M.ValidationError('Onbekende lijst.');
    const name = C.str(req.body.name, { required: true, max: 100, label: 'Naam' });
    if (db.get('SELECT 1 FROM lookups WHERE type = ? AND name = ? COLLATE NOCASE', [type, name])) throw new M.ValidationError('Deze waarde bestaat al.');
    db.insert('INSERT INTO lookups(type, name, sort) VALUES (?, ?, 999)', [type, name]);
    req.addFlash('success', `“${name}” toegevoegd.`);
    res.redirect(303, '/instellingen#lijsten');
  }));
  app.post('/instellingen/lijsten/:id', requireAdmin, action((req, res) => {
    const l = db.get('SELECT * FROM lookups WHERE id = ?', [Number(req.params.id)]);
    if (!l) throw new M.ValidationError('Niet gevonden.');
    const name = C.str(req.body.name, { required: true, max: 100, label: 'Naam' });
    const clash = db.get('SELECT id FROM lookups WHERE type = ? AND name = ? COLLATE NOCASE', [l.type, name]);
    if (clash && clash.id !== l.id) throw new M.ValidationError('Deze naam bestaat al.');
    db.run('UPDATE lookups SET name = ?, archived = ?, is_marketing = ? WHERE id = ?', [name, C.bool(req.body.archived) ? 1 : 0, l.type === 'expense_category' && C.bool(req.body.is_marketing) ? 1 : 0, l.id]);
    C.audit(db, req.user, 'lookup', l.id, 'update', { name });
    req.addFlash('success', 'Opgeslagen.');
    res.redirect(303, '/instellingen#lijsten');
  }));
  app.post('/instellingen/gebruikers', requireAdmin, action((req, res) => {
    const id = auth.createUser(db, req.body);
    C.audit(db, req.user, 'user', id, 'create', { email: req.body.email, role: req.body.role });
    req.addFlash('success', 'Gebruiker toegevoegd. Laat de gebruiker het wachtwoord direct wijzigen.');
    res.redirect(303, '/instellingen#gebruikers');
  }));
  app.post('/instellingen/gebruikers/:id', requireAdmin, action((req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw new M.ValidationError('Je kunt je eigen rol niet wijzigen.');
    const role = req.body.role === 'admin' ? 'admin' : 'viewer';
    const active = C.bool(req.body.active) ? 1 : 0;
    db.tx(() => {
      db.run('UPDATE users SET role = ?, active = ? WHERE id = ?', [role, active, id]);
      const pw = String(req.body.new_password || '');
      if (pw) { auth.validatePassword(pw); db.run('UPDATE users SET password_hash = ? WHERE id = ?', [auth.hashPassword(pw), id]); }
      if (!active || pw) db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
      if (!db.get("SELECT 1 FROM users WHERE role = 'admin' AND active = 1")) throw new M.ValidationError('Er moet minimaal één actieve beheerder blijven.');
      C.audit(db, req.user, 'user', id, 'update', { role, active, passwordReset: !!pw });
    });
    req.addFlash('success', 'Gebruiker bijgewerkt.');
    res.redirect(303, '/instellingen#gebruikers');
  }));
  app.post('/instellingen/wachtwoord', action((req, res) => {
    const u = db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!auth.verifyPassword(String(req.body.current || ''), u.password_hash)) throw new M.ValidationError('Huidig wachtwoord is onjuist.');
    if (req.body.password !== req.body.password2) throw new M.ValidationError('De nieuwe wachtwoorden komen niet overeen.');
    auth.validatePassword(req.body.password);
    db.tx(() => {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [auth.hashPassword(req.body.password), u.id]);
      db.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', [u.id, req.sessionHash]);
      C.audit(db, req.user, 'user', u.id, 'password');
    });
    req.addFlash('success', 'Wachtwoord gewijzigd. Andere sessies zijn uitgelogd.');
    res.redirect(303, '/instellingen#wachtwoord');
  }, { back: '/instellingen#wachtwoord' }));
  app.post('/instellingen/backup', requireAdmin, (req, res) => {
    fs.mkdirSync(config.backupDir, { recursive: true });
    const file = path.join(config.backupDir, `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`);
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    C.audit(db, req.user, 'backup', null, 'download');
    res.download(file, path.basename(file));
  });

  app.get('/instellingen/audit', requireAdmin, (req, res) => {
    const rows = db.all('SELECT a.*, u.name AS user_name FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300');
    const body = html`<div class="card"><p class="help">Laatste 300 wijzigingen. Transacties worden nooit verwijderd; correcties zijn hier en in de mutatie- en betalingshistorie terug te vinden.</p>
      ${table({ columns: [{ label: 'Tijdstip', render: r => M.formatDateTime(r.created_at) }, { label: 'Gebruiker', render: r => r.user_name || 'systeem' }, { label: 'Onderdeel', render: r => `${r.entity}${r.entity_id ? ' #' + r.entity_id : ''}` },
        { label: 'Actie', key: 'action' }, { label: 'Details', render: r => html`<code class="small">${r.details || ''}</code>` }], rows })}</div>`;
    page(req, res, { title: 'Audit-log', active: 'instellingen', body, actions: html`<a class="btn btn-ghost" href="/instellingen">← Instellingen</a>` });
  });
};
