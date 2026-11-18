'use strict';
// Bijlagen (facturen, bonnetjes, productafbeeldingen). Bestanden worden buiten de publieke map
// opgeslagen onder een willekeurige naam en alleen via een ingelogde route uitgeleverd.
// Validatie op inhoud (magic bytes), niet alleen op extensie of opgegeven MIME-type.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { ValidationError } = require('../money');
const { audit } = require('./common');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const TYPES = [
  { mime: 'application/pdf', ext: '.pdf', test: b => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: '.png', test: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: '.jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: '.webp', test: b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

function detect(buf) { return TYPES.find(t => buf.length >= 12 && t.test(buf)) || null; }

function saveAttachment(db, uploadDir, { entity, entityId, file, imagesOnly = false }, user) {
  if (!file) throw new ValidationError('Geen bestand ontvangen.');
  if (file.size > MAX_BYTES) throw new ValidationError('Bestand is te groot (max. 10 MB).');
  const t = detect(file.buffer);
  if (!t) throw new ValidationError('Bestandstype niet toegestaan. Toegestaan: PDF, PNG, JPG en WEBP.');
  if (imagesOnly && !t.mime.startsWith('image/')) throw new ValidationError('Kies een afbeelding (PNG, JPG of WEBP).');
  fs.mkdirSync(uploadDir, { recursive: true });
  const stored = crypto.randomBytes(16).toString('hex') + t.ext;
  const sha = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const original = path.basename(String(file.originalname || 'bestand')).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || 'bestand';
  fs.writeFileSync(path.join(uploadDir, stored), file.buffer, { mode: 0o600 });
  try {
    const id = db.insert('INSERT INTO attachments(entity, entity_id, stored_name, original_name, mime, size, sha256, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [entity, entityId, stored, original, t.mime, file.size, sha, user?.id]);
    audit(db, user, entity, entityId, 'attachment', { id, name: original });
    return id;
  } catch (e) { fs.rmSync(path.join(uploadDir, stored), { force: true }); throw e; }
}

function getAttachment(db, id) { return db.get('SELECT * FROM attachments WHERE id = ?', [id]); }

module.exports = { MAX_BYTES, saveAttachment, getAttachment, detect };
