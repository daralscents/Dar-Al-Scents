'use strict';
// Gedeelde hulpfuncties voor routes.
const crypto = require('node:crypto');
const { ValidationError, periodRange } = require('./money');
const { html, raw } = require('./views/html');
const { layout } = require('./views/layout');
const { toCsv } = require('./csv');

const idem = () => crypto.randomUUID();
const csrfInput = req => html`<input type="hidden" name="_csrf" value="${req.csrf}">`;
const idemInput = () => html`<input type="hidden" name="idem" value="${idem()}">`;

function page(req, res, opts, status = 200) {
  res.status(status).type('html').send(String(layout(req, opts)));
}

// Voert een schrijfactie uit; validatiefouten worden als melding getoond en de gebruiker gaat
// terug naar het formulier/de vorige pagina.
function action(fn, { back } = {}) {
  return async (req, res, next) => {
    try { await fn(req, res, next); }
    catch (e) {
      if (e instanceof ValidationError || e?.code === 'ERR_SQLITE_ERROR' && /RAISE|constraint/i.test(e.message)) {
        req.addFlash('error', e instanceof ValidationError ? e.message : friendlySqlError(e));
        const to = typeof back === 'function' ? back(req) : back;
        return res.redirect(303, to || safeReferer(req) || '/');
      }
      next(e);
    }
  };
}

// Formulier opnieuw tonen met ingevulde waarden en foutmelding (HTTP 422).
function formError(e, render) {
  if (e instanceof ValidationError) return render({ [e.field || '_form']: e.message, _message: e.message });
  if (e?.code === 'ERR_SQLITE_ERROR' && /UNIQUE|constraint|RAISE/i.test(e.message)) return render({ _message: friendlySqlError(e) });
  throw e;
}

function friendlySqlError(e) {
  const m = String(e.message || '');
  if (/UNIQUE constraint failed: variants\.sku/.test(m)) return 'Deze SKU bestaat al.';
  if (/UNIQUE constraint failed/.test(m)) return 'Deze gegevens bestaan al (dubbele invoer voorkomen).';
  const raised = /RAISE|ABORT/.test(m) ? m.replace(/^.*?:\s*/, '') : null;
  return raised || 'De wijziging is geweigerd omdat die de administratie inconsistent zou maken.';
}

function safeReferer(req) {
  const r = req.get('referer');
  if (!r) return null;
  try { const u = new URL(r); return u.host === req.get('host') ? u.pathname + u.search : null; } catch { return null; }
}

function getPeriod(req) {
  try { return periodRange(req.query.periode || 'month', { from: req.query.van, to: req.query.tot }); }
  catch (e) { req.flash.push({ type: 'error', msg: e.message }); return periodRange('month'); }
}

function periodForm(req, period, extra = {}) {
  const keys = [['today', 'Vandaag'], ['week', 'Deze week'], ['month', 'Deze maand'], ['quarter', 'Dit kwartaal'], ['year', 'Dit jaar'], ['custom', 'Eigen bereik']];
  return html`<form class="period" method="get" role="search" aria-label="Periode kiezen">
    ${Object.entries(extra).filter(([, v]) => v != null && v !== '').map(([k, v]) => html`<input type="hidden" name="${k}" value="${v}">`)}
    <div class="seg" role="radiogroup" aria-label="Periode">${keys.map(([k, l]) => html`<label class="${period.key === k ? 'on' : ''}"><input type="radio" name="periode" value="${k}"${period.key === k ? raw(' checked') : ''} data-autosubmit> ${l}</label>`)}</div>
    <div class="custom-range" data-custom-range ${period.key === 'custom' ? '' : raw('hidden')}>
      <label>Van <input type="date" name="van" value="${period.from}"></label>
      <label>Tot en met <input type="date" name="tot" value="${period.to}"></label>
      <button class="btn btn-sm" type="submit">Toepassen</button>
    </div>
  </form>`;
}

function sendCsv(res, filename, columns, rows) {
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.-]/g, '_')}"`);
  res.send(toCsv(columns, rows));
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).type('html').send(String(layout(req, { title: 'Geen toegang', body: html`<div class="card"><p>Je account heeft alleen leesrechten.</p></div>` })));
  next();
}

const num = v => (v == null || v === '' ? null : Number(v));

module.exports = { idem, csrfInput, idemInput, page, action, formError, friendlySqlError, safeReferer, getPeriod, periodForm, sendCsv, requireAdmin, num };
