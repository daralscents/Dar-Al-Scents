'use strict';
const { html, raw } = require('./html');

const NAV = [
  ['overzicht', '/', 'Overzicht', 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'],
  ['producten', '/producten', 'Producten', 'M20 7l-8-4-8 4v10l8 4 8-4V7zm-8 11.8L6 16V9.2l6 3v6.6zm1-8.4L7.2 7.5 12 5.1l4.8 2.4L13 9.4z'],
  ['leveranciers', '/leveranciers', 'Leveranciers', 'M3 21V8l9-5 9 5v13h-6v-7H9v7H3z'],
  ['inkoop', '/inkoop', 'Inkoop', 'M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5.2 4H2V2h4.6l.9 2H21l-3.4 8H8.2l-.9 2H19v2H5l2.4-4.6L5.2 4z'],
  ['voorraad', '/voorraad', 'Voorraad', 'M4 4h16v4H4V4zm1 6h14v10H5V10zm4 2v2h6v-2H9z'],
  ['verkopen', '/verkopen', 'Verkopen', 'M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8 2 2z'],
  ['uitgaven', '/uitgaven', 'Uitgaven', 'M21 7H3V5h18v2zm0 2H3v10h18V9zm-4 6h-4v-2h4v2z'],
  ['marketing', '/marketing', 'Marketing', 'M3 10v4h3l5 5V5L6 10H3zm13.5 2A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a7 7 0 010 13.4v2.1A9 9 0 0014 3.2z'],
  ['rapporten', '/rapporten', 'Rapporten', 'M5 3h14v18H5V3zm3 4v2h8V7H8zm0 4v2h8v-2H8zm0 4v2h5v-2H8z'],
  ['instellingen', '/instellingen', 'Instellingen', 'M19.4 13a7.5 7.5 0 000-2l2.1-1.6-2-3.5-2.5 1a7.3 7.3 0 00-1.7-1L15 3h-4l-.4 2.9a7.3 7.3 0 00-1.7 1l-2.5-1-2 3.5L6.5 11a7.5 7.5 0 000 2l-2.1 1.6 2 3.5 2.5-1c.5.4 1.1.7 1.7 1L11 21h4l.4-2.9c.6-.3 1.2-.6 1.7-1l2.5 1 2-3.5-2.2-1.6zM13 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z'],
];

function icon(path) { return raw(`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}"/></svg>`); }

function layout(req, { title, active, body, actions }) {
  const s = req.settings || {};
  const user = req.user;
  const flash = req.flash || [];
  const canWrite = user && user.role === 'admin';
  return html`<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title ? `${title} · ` : ''}${s.company_name || 'Dar Al Scents'}</title>
<link rel="stylesheet" href="/static/app.css">
<script src="/static/app.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Naar inhoud</a>
${s.demo ? html`<div class="demo-banner" role="note">Demo-omgeving met voorbeeldgegevens — niet je echte administratie.</div>` : ''}
<div class="shell">
  <aside class="sidebar" id="sidebar">
    <a class="brand" href="/" aria-label="${s.company_name || 'Dar Al Scents'} – overzicht">
      <span class="brand-mark" aria-hidden="true">D</span>
      <span class="brand-name">${s.company_name || 'Dar Al Scents'}<small>Bedrijfsdashboard</small></span>
    </a>
    <nav aria-label="Hoofdmenu">
      <ul>${NAV.map(([key, href, label, path]) => html`<li><a href="${href}"${key === active ? raw(' aria-current="page" class="active"') : ''}>${icon(path)}<span>${label}</span></a></li>`)}</ul>
    </nav>
    ${user ? html`<div class="sidebar-user">
      <span>${user.name}<small>${user.role === 'admin' ? 'Beheerder' : 'Alleen lezen'}</small></span>
      <form method="post" action="/uitloggen"><input type="hidden" name="_csrf" value="${req.csrf}"><button class="btn btn-ghost btn-sm" type="submit">Uitloggen</button></form>
    </div>` : ''}
  </aside>
  <div class="main-col">
    <header class="topbar">
      <button class="nav-toggle" type="button" aria-controls="sidebar" aria-expanded="false" data-nav-toggle><span class="sr-only">Menu</span>☰</button>
      <h1 class="page-title">${title || ''}</h1>
      ${canWrite ? html`<div class="quick" aria-label="Snelle acties">
        <a class="btn btn-sm" href="/verkopen/nieuw">+ Verkoop</a>
        <a class="btn btn-sm btn-ghost" href="/uitgaven/nieuw">+ Uitgave</a>
        <a class="btn btn-sm btn-ghost" href="/inkoop/nieuw">+ Inkooporder</a>
        <a class="btn btn-sm btn-ghost" href="/inkoop?status=ordered">Voorraad ontvangen</a>
      </div>` : ''}
    </header>
    <main id="main" tabindex="-1">
      ${flash.map(f => html`<div class="flash flash-${f.type}" role="${f.type === 'error' ? 'alert' : 'status'}">${f.msg}</div>`)}
      ${actions ? html`<div class="page-actions">${actions}</div>` : ''}
      ${body}
    </main>
    <footer class="foot">Managementinformatie op basis van de ingevoerde administratie · bedragen in EUR</footer>
  </div>
</div>
</body>
</html>`;
}

function bare(req, { title, body }) {
  const s = req.settings || {};
  return html`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${title} · ${s.company_name || 'Dar Al Scents'}</title><link rel="stylesheet" href="/static/app.css"></head>
<body class="bare"><main id="main" class="auth-card">
<div class="auth-brand"><span class="brand-mark" aria-hidden="true">D</span><div>${s.company_name || 'Dar Al Scents'}<small>Bedrijfsdashboard</small></div></div>
${(req.flash || []).map(f => html`<div class="flash flash-${f.type}" role="alert">${f.msg}</div>`)}
${body}</main></body></html>`;
}

module.exports = { layout, bare };
