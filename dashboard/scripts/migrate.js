'use strict';
const { getConfig } = require('../src/config');
const { openDb } = require('../src/db');
const config = getConfig();
const db = openDb(config.dbFile);
console.log(`Database ${config.dbFile} is bijgewerkt (${db.all('SELECT name FROM schema_migrations').length} migraties toegepast).`);
db.close();
