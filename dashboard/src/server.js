'use strict';
const { getConfig } = require('./config');
const { openDb } = require('./db');
const { createApp } = require('./app');

const config = getConfig();
const db = openDb(config.dbFile);
const app = createApp({ db, config });
const server = app.listen(config.port, config.host, () => {
  const users = db.get('SELECT COUNT(*) AS n FROM users').n;
  console.log(`Dar Al Scents dashboard draait op http://${config.host}:${config.port}`);
  console.log(`Database: ${config.dbFile}`);
  if (!users) console.log('Nog geen gebruikers: maak een beheerder aan met `npm run create-user`' + (config.setupToken ? ' of via /installeren.' : '.'));
});
function shutdown() { server.close(() => { db.close(); process.exit(0); }); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
