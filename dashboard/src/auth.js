'use strict';
const crypto = require('node:crypto');
const { ValidationError } = require('./money');

const SESSION_COOKIE = 'das_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 uur, verlengd bij activiteit

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, N, r, p, salt, hash] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(hash, 'base64');
    const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
    return crypto.timingSafeEqual(expected, got);
  } catch { return false; }
}
function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 10) throw new ValidationError('Wachtwoord moet minimaal 10 tekens lang zijn.', 'password');
  if (pw.length > 200) throw new ValidationError('Wachtwoord is te lang.', 'password');
}

const tokenHash = t => crypto.createHash('sha256').update(t).digest('hex');

function createUser(db, { email, name, password, role = 'admin' }) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ValidationError('Vul een geldig e-mailadres in.', 'email');
  const n = String(name || '').trim();
  if (!n) throw new ValidationError('Vul een naam in.', 'name');
  validatePassword(password);
  if (!['admin', 'viewer'].includes(role)) throw new ValidationError('Ongeldige rol.', 'role');
  if (db.get('SELECT 1 FROM users WHERE email = ?', [e])) throw new ValidationError('Er bestaat al een gebruiker met dit e-mailadres.', 'email');
  return db.insert('INSERT INTO users(email, name, password_hash, role) VALUES (?, ?, ?, ?)', [e, n, hashPassword(password), role]);
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  db.run('DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  db.run('INSERT INTO sessions(token_hash, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)', [tokenHash(token), userId, csrf, Date.now() + SESSION_TTL_MS]);
  return token;
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieOptions(config) {
  return { httpOnly: true, sameSite: 'lax', secure: !!config.cookieSecure, path: '/', maxAge: SESSION_TTL_MS };
}

// Eenvoudige rem op inlogpogingen per IP + e-mail (in geheugen).
const attempts = new Map();
function loginAllowed(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > 15 * 60 * 1000) return true;
  return a.count < 8;
}
function loginFailed(key) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || now - a.first > 15 * 60 * 1000) attempts.set(key, { first: now, count: 1 });
  else a.count++;
}
function loginSucceeded(key) { attempts.delete(key); }

function sessionMiddleware(db, config) {
  return (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    req.user = null; req.flash = []; req.csrf = null; req.sessionHash = null;
    if (token) {
      const h = tokenHash(token);
      const s = db.get(`SELECT s.*, u.email, u.name, u.role, u.active FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, [h]);
      if (s && s.expires_at > Date.now() && s.active) {
        req.user = { id: s.user_id, email: s.email, name: s.name, role: s.role };
        req.csrf = s.csrf;
        req.sessionHash = h;
        if (s.flash) { try { req.flash = JSON.parse(s.flash); } catch { req.flash = []; } db.run('UPDATE sessions SET flash = NULL WHERE token_hash = ?', [h]); }
        // Glijdende verloopdatum (maximaal één keer per minuut bijwerken).
        if (s.expires_at - Date.now() < SESSION_TTL_MS - 60000) {
          db.run('UPDATE sessions SET expires_at = ? WHERE token_hash = ?', [Date.now() + SESSION_TTL_MS, h]);
          res.cookie(SESSION_COOKIE, token, cookieOptions(config));
        }
      } else if (s) {
        db.run('DELETE FROM sessions WHERE token_hash = ?', [h]);
      }
    }
    req.addFlash = (type, msg) => {
      if (!req.sessionHash) return;
      const cur = db.get('SELECT flash FROM sessions WHERE token_hash = ?', [req.sessionHash]);
      const list = cur?.flash ? JSON.parse(cur.flash) : [];
      list.push({ type, msg: String(msg) });
      db.run('UPDATE sessions SET flash = ? WHERE token_hash = ?', [JSON.stringify(list), req.sessionHash]);
    };
    next();
  };
}

function csrfOk(req) {
  const sent = req.body?._csrf || req.headers['x-csrf-token'];
  if (!req.csrf || typeof sent !== 'string' || sent.length !== req.csrf.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(req.csrf));
}

module.exports = {
  SESSION_COOKIE, hashPassword, verifyPassword, validatePassword, createUser, createSession, tokenHash, parseCookies, cookieOptions,
  loginAllowed, loginFailed, loginSucceeded, sessionMiddleware, csrfOk,
};
