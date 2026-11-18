'use strict';
// Eigen parser voor formulieren (application/x-www-form-urlencoded).
// Waarom niet express.urlencoded({ extended: true })? Die maakt van `qty[5]=1` een
// ingedikte array (['1']) zodat de sleutel (regel-id) verloren gaat. Hier worden
// geneste sleutels altijd objecten; een herhaalde gewone sleutel (verborgen veld +
// vinkje) wordt een array. Gevaarlijke sleutels (__proto__ e.d.) worden genegeerd.
const BAD = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 5;

function parseForm(text, { parameterLimit = 20000 } = {}) {
  const out = Object.create(null);
  const params = new URLSearchParams(text);
  let n = 0;
  for (const [key, value] of params) {
    if (++n > parameterLimit) { const e = new Error('Te veel formuliervelden.'); e.status = 413; throw e; }
    const m = /^([^[\]]+)((?:\[[^[\]]*\])*)$/.exec(key);
    const path = m ? [m[1], ...(m[2].match(/\[([^[\]]*)\]/g) || []).map(s => s.slice(1, -1))] : [key];
    if (path.length > MAX_DEPTH + 1 || path.some(p => BAD.has(p))) continue;
    let o = out;
    for (let i = 0; i < path.length - 1; i++) {
      const k = path[i] === '' ? String(Object.keys(o).length) : path[i];
      if (typeof o[k] !== 'object' || o[k] === null || Array.isArray(o[k])) o[k] = Object.create(null);
      o = o[k];
    }
    let last = path[path.length - 1];
    if (last === '' && path.length > 1) last = String(Object.keys(o).length);
    if (last in o) o[last] = Array.isArray(o[last]) ? [...o[last], value] : (typeof o[last] === 'string' ? [o[last], value] : o[last]);
    else o[last] = value;
  }
  return out;
}

function formMiddleware({ limit = 2 * 1024 * 1024, parameterLimit = 20000 } = {}) {
  return (req, res, next) => {
    if (req.method !== 'POST' || !/^application\/x-www-form-urlencoded\b/i.test(req.headers['content-type'] || '')) return next();
    const chunks = []; let size = 0, done = false;
    req.on('data', c => { if (done) return; size += c.length; if (size > limit) { done = true; const e = new Error('Formulier te groot.'); e.status = 413; next(e); req.resume(); return; } chunks.push(c); });
    req.on('end', () => { if (done) return; done = true; try { req.body = parseForm(Buffer.concat(chunks).toString('utf8'), { parameterLimit }); next(); } catch (e) { next(e); } });
    req.on('error', e => { if (!done) { done = true; next(e); } });
  };
}

module.exports = { parseForm, formMiddleware };
