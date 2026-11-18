'use strict';
// Start het dashboard op de aparte demo-database (zie scripts/seed-demo.js).
const path = require('node:path');
process.env.DATA_DIR = path.join(__dirname, '..', 'demo-data');
process.env.DB_FILE = 'dar-al-scents-demo.sqlite';
process.env.PORT = process.env.PORT || '3001';
require('../src/server');
