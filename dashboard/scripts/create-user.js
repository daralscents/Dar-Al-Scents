'use strict';
// Gebruik: npm run create-user -- --email jij@voorbeeld.nl --name "Naam" [--role admin|viewer]
// Het wachtwoord wordt interactief gevraagd (of via omgevingsvariabele NEW_USER_PASSWORD).
const readline = require('node:readline');
const { getConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { createUser } = require('../src/auth');
const { ensureDefaults } = require('../src/services/common');

const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };

async function ask(q, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) rl._writeToOutput = s => { if (s.includes(q)) process.stdout.write(s); else process.stdout.write('*'); };
  return new Promise(r => rl.question(q, a => { rl.close(); if (hidden) process.stdout.write('\n'); r(a); }));
}

(async () => {
  const config = getConfig();
  const db = openDb(config.dbFile);
  ensureDefaults(db);
  const email = arg('email') || await ask('E-mailadres: ');
  const name = arg('name') || await ask('Naam: ');
  const role = arg('role') || 'admin';
  let password = process.env.NEW_USER_PASSWORD;
  if (!password) {
    password = await ask('Wachtwoord (min. 10 tekens): ', true);
    const again = await ask('Herhaal wachtwoord: ', true);
    if (password !== again) { console.error('Wachtwoorden komen niet overeen.'); process.exit(1); }
  }
  try { createUser(db, { email, name, password, role }); console.log(`Gebruiker ${email} (${role}) aangemaakt.`); }
  catch (e) { console.error(e.message); process.exit(1); }
  db.close();
})();
