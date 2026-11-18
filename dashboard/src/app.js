'use strict';
const path = require('node:path');
const express = require('express');
const { ValidationError } = require('./money');
const auth = require('./auth');
const { ensureDefaults, getSettings } = require('./services/common');
const { html, field } = require('./views/html');
const { bare, layout } = require('./views/layout');
const { csrfInput } = require('./web');

function createApp({ db, config }) {
  ensureDefaults(db);
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.locals.db = db;
  app.locals.config = config;

  // Beveiligingsheaders.
  app.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cache-Control': 'no-store',
    });
    if (config.cookieSecure) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use('/static', express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', setHeaders: res => res.set('Cache-Control', 'public, max-age=3600') }));
  app.use(require('./formparser').formMiddleware({ limit: 2 * 1024 * 1024, parameterLimit: 20000 }));
  app.use(auth.sessionMiddleware(db, config));
  app.use((req, res, next) => { req.settings = getSettings(db); next(); });

  // Inloggen ---------------------------------------------------------------------
  app.get('/inloggen', (req, res) => {
    if (req.user) return res.redirect('/');
    const noUsers = !db.get('SELECT 1 FROM users LIMIT 1');
    res.type('html').send(String(bare(req, { title: 'Inloggen', body: loginForm(req, {}, noUsers) })));
  });
  app.post('/inloggen', (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const key = `${req.ip}|${email}`;
    const fail = (msg, status = 401) => { req.flash = [{ type: 'error', msg }]; res.status(status).type('html').send(String(bare(req, { title: 'Inloggen', body: loginForm(req, { email }) }))); };
    if (!auth.loginAllowed(key)) return fail('Te veel mislukte pogingen. Probeer het over 15 minuten opnieuw.', 429);
    const u = db.get('SELECT * FROM users WHERE email = ? AND active = 1', [email]);
    if (!u || !auth.verifyPassword(String(req.body.password || ''), u.password_hash)) { auth.loginFailed(key); return fail('Onjuist e-mailadres of wachtwoord.'); }
    auth.loginSucceeded(key);
    const token = auth.createSession(db, u.id);
    res.cookie(auth.SESSION_COOKIE, token, auth.cookieOptions(config));
    res.redirect(303, '/');
  });

  // Eerste beheerder aanmaken via de browser kan alleen als er nog geen gebruikers zijn
  // én SETUP_TOKEN is ingesteld (anders via `npm run create-user`).
  app.get('/installeren', (req, res) => {
    if (db.get('SELECT 1 FROM users LIMIT 1') || !config.setupToken) return res.redirect('/inloggen');
    res.type('html').send(String(bare(req, { title: 'Installeren', body: setupForm({}, {}) })));
  });
  app.post('/installeren', (req, res) => {
    if (db.get('SELECT 1 FROM users LIMIT 1') || !config.setupToken) return res.redirect('/inloggen');
    const b = req.body;
    const render = (errors) => res.status(422).type('html').send(String(bare(req, { title: 'Installeren', body: setupForm(b, errors) })));
    if (String(b.setup_token || '') !== config.setupToken) return render({ setup_token: 'Onjuiste installatiecode (SETUP_TOKEN).' });
    if (b.password !== b.password2) return render({ password2: 'Wachtwoorden komen niet overeen.' });
    try {
      const id = auth.createUser(db, { email: b.email, name: b.name, password: b.password, role: 'admin' });
      const token = auth.createSession(db, id);
      res.cookie(auth.SESSION_COOKIE, token, auth.cookieOptions(config));
      res.redirect(303, '/');
    } catch (e) { if (e instanceof ValidationError) return render({ [e.field || 'email']: e.message }); throw e; }
  });

  // Alles hieronder vereist een sessie.
  app.use((req, res, next) => {
    if (!req.user) {
      if (req.method === 'GET') return res.redirect(`/inloggen`);
      return res.status(401).send('Niet ingelogd');
    }
    next();
  });
  // CSRF voor alle niet-multipart POST-verzoeken (multipart: na multer, zie routes).
  app.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    if (req.is('multipart/form-data')) return next();
    if (!auth.csrfOk(req)) return res.status(403).type('html').send(String(layout(req, { title: 'Verlopen formulier', body: html`<div class="card"><p>Het formulier is verlopen of ongeldig. Ga terug, herlaad de pagina en probeer opnieuw.</p></div>` })));
    next();
  });
  // Rollen: alleen-lezen accounts mogen niets wijzigen (behalve uitloggen en eigen wachtwoord).
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.user.role !== 'admin' && !['/uitloggen', '/instellingen/wachtwoord'].includes(req.path)) {
      return res.status(403).type('html').send(String(layout(req, { title: 'Geen toegang', body: html`<div class="card"><p>Je account heeft alleen leesrechten.</p></div>` })));
    }
    next();
  });

  app.post('/uitloggen', (req, res) => {
    db.run('DELETE FROM sessions WHERE token_hash = ?', [req.sessionHash]);
    res.clearCookie(auth.SESSION_COOKIE, { path: '/' });
    res.redirect(303, '/inloggen');
  });

  // Numerieke id-parameters: anders door naar de volgende route (bijv. /producten/prijslijst).
  for (const name of ['id', 'lineId', 'pid']) app.param(name, (req, res, next, v) => (/^\d+$/.test(v) ? next() : next('route')));

  const ctx = { db, config };
  require('./routes/dashboard')(app, ctx);
  require('./routes/products')(app, ctx);
  require('./routes/suppliers')(app, ctx);
  require('./routes/purchasing')(app, ctx);
  require('./routes/inventory')(app, ctx);
  require('./routes/sales')(app, ctx);
  require('./routes/expenses')(app, ctx);
  require('./routes/marketing')(app, ctx);
  require('./routes/reports')(app, ctx);
  require('./routes/imports')(app, ctx);
  require('./routes/settings')(app, ctx);

  app.use((req, res) => {
    res.status(404).type('html').send(String(layout(req, { title: 'Niet gevonden', body: html`<div class="card"><p>Deze pagina bestaat niet (meer).</p><p><a href="/">Naar het overzicht</a></p></div>` })));
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ValidationError) {
      return res.status(422).type('html').send(String(layout(req, { title: 'Controleer de invoer', body: html`<div class="card"><p class="error-text">${err.message}</p><p><a href="javascript:history.back()">Terug</a></p></div>` })));
    }
    if (err?.code === 'LIMIT_FILE_SIZE') {
      req.addFlash?.('error', 'Bestand is te groot (max. 10 MB).');
      return res.redirect(303, req.get('referer') || '/');
    }
    console.error(err);
    res.status(500).type('html').send(String(layout(req, { title: 'Er ging iets mis', body: html`<div class="card"><p>Er is een onverwachte fout opgetreden. Er is niets half opgeslagen: financiële en voorraadwijzigingen worden in één databasetransactie verwerkt.</p><p><a href="/">Naar het overzicht</a></p></div>` })));
  });
  return app;
}

function loginForm(req, v, noUsers) {
  return html`<h1>Inloggen</h1>
  <form method="post" action="/inloggen" class="stack">
    ${field('E-mailadres', 'email', v.email, { type: 'email', required: true, autocomplete: 'username', attrs: 'autofocus' })}
    ${field('Wachtwoord', 'password', '', { type: 'password', required: true, autocomplete: 'current-password' })}
    <button class="btn" type="submit">Inloggen</button>
  </form>
  ${noUsers ? html`<p class="help">Nog geen account? Maak de eerste beheerder aan met <code>npm run create-user</code> of via <a href="/installeren">installeren</a> (vereist SETUP_TOKEN).</p>` : ''}`;
}

function setupForm(v, errors) {
  return html`<h1>Eerste beheerder aanmaken</h1>
  <form method="post" action="/installeren" class="stack">
    ${field('Installatiecode (SETUP_TOKEN)', 'setup_token', '', { type: 'password', required: true, errors })}
    ${field('Naam', 'name', v.name, { required: true, errors })}
    ${field('E-mailadres', 'email', v.email, { type: 'email', required: true, errors, autocomplete: 'username' })}
    ${field('Wachtwoord (min. 10 tekens)', 'password', '', { type: 'password', required: true, errors, autocomplete: 'new-password' })}
    ${field('Herhaal wachtwoord', 'password2', '', { type: 'password', required: true, errors, autocomplete: 'new-password' })}
    <button class="btn" type="submit">Aanmaken en inloggen</button>
  </form>`;
}

module.exports = { createApp, csrfInput };
