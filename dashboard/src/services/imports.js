'use strict';
// CSV-import met veldkoppeling, validatie, preview en bescherming tegen dubbele imports:
//   * hetzelfde bestand (SHA-256) kan per soort maar één keer worden verwerkt;
//   * per rij wordt een herkenbare sleutel gecontroleerd (SKU, leveranciersnaam, extern ordernummer):
//     bestaande records worden overgeslagen in plaats van dubbel aangemaakt.
const crypto = require('node:crypto');
const { ValidationError, parseMoney, parsePercent, parseIntStrict, parseDate, centsToInput, bpToInput } = require('../money');
const { parseCsv } = require('../csv');
const { audit, lookupId, bool } = require('./common');

const FIELDS = {
  products: [
    { key: 'product_name', label: 'Productnaam', required: true, aliases: ['product', 'naam', 'name', 'title', 'titel'] },
    { key: 'sku', label: 'SKU', required: true, aliases: ['artikelnummer', 'variant sku'] },
    { key: 'variant_name', label: 'Variantnaam', aliases: ['variant', 'uitvoering'] },
    { key: 'size_ml', label: 'Inhoud (ml)', aliases: ['ml', 'inhoud'] },
    { key: 'edition', label: 'Uitvoering/editie', aliases: ['editie'] },
    { key: 'category', label: 'Categorie', aliases: ['type', 'producttype'] },
    { key: 'brand', label: 'Merk / collectie', aliases: ['merk', 'vendor', 'collectie'] },
    { key: 'price_incl', label: 'Verkoopprijs incl. btw', aliases: ['prijs', 'price', 'verkoopprijs'] },
    { key: 'vat', label: 'Btw %', aliases: ['btw'] },
    { key: 'min_stock', label: 'Minimale voorraad', aliases: ['min voorraad'] },
    { key: 'description', label: 'Omschrijving', aliases: ['beschrijving', 'body'] },
    { key: 'opening_qty', label: 'Beginvoorraad (aantal)', aliases: ['beginvoorraad', 'voorraad', 'aantal', 'stock', 'qty'] },
    { key: 'opening_cost', label: 'Beginkostprijs per stuk', aliases: ['beginkostprijs', 'kostprijs', 'inkoopprijs', 'cost', 'unit_cost'] },
  ],
  suppliers: [
    { key: 'name', label: 'Bedrijfsnaam', required: true, aliases: ['leverancier', 'bedrijf', 'company'] },
    { key: 'contact_name', label: 'Contactpersoon', aliases: ['contact'] },
    { key: 'email', label: 'E-mail', aliases: ['e-mail', 'mail'] },
    { key: 'phone', label: 'Telefoon', aliases: ['tel', 'telefoonnummer'] },
    { key: 'website', label: 'Website', aliases: ['url'] },
    { key: 'country', label: 'Land', aliases: ['country'] },
    { key: 'address', label: 'Adres', aliases: [] },
    { key: 'vat_number', label: 'Btw-nummer', aliases: ['btw nummer', 'vat'] },
    { key: 'payment_terms', label: 'Betaalvoorwaarden', aliases: ['betaaltermijn'] },
    { key: 'notes', label: 'Notities', aliases: ['opmerkingen'] },
  ],
  sales: [
    { key: 'order_ref', label: 'Ordernummer (extern, uniek)', required: true, aliases: ['ordernummer', 'order', 'name', 'bestelnummer'] },
    { key: 'date', label: 'Verkoopdatum', required: true, aliases: ['datum', 'created at', 'orderdatum'] },
    { key: 'sku', label: 'SKU', required: true, aliases: ['lineitem sku', 'artikelnummer'] },
    { key: 'qty', label: 'Aantal', required: true, aliases: ['lineitem quantity', 'quantity', 'stuks'] },
    { key: 'unit_price_incl', label: 'Stukprijs incl. btw', aliases: ['lineitem price', 'prijs', 'price'] },
    { key: 'discount', label: 'Korting op regel (bedrag of %)', aliases: ['korting'] },
    { key: 'vat', label: 'Btw %', aliases: ['btw'] },
    { key: 'shipping', label: 'Verzendopbrengst incl. btw (per order)', aliases: ['verzending', 'shipping'] },
    { key: 'channel', label: 'Verkoopkanaal', aliases: ['kanaal'] },
    { key: 'payment_method', label: 'Betaalmethode', aliases: ['payment method', 'betaling'] },
    { key: 'customer_ref', label: 'Klantreferentie', aliases: ['klant', 'customer', 'email'] },
    { key: 'marketing_source', label: 'Marketingbron', aliases: ['bron', 'source', 'utm source'] },
    { key: 'campaign', label: 'Campagne', aliases: [] },
    { key: 'paid', label: 'Betaald (ja/nee)', aliases: ['betaald', 'financial status'] },
    { key: 'fulfilled', label: 'Uitgeleverd (ja/nee)', aliases: ['uitgeleverd', 'fulfillment status'] },
  ],
};

const EXAMPLES = {
  products: 'Productnaam;SKU;Variantnaam;Inhoud (ml);Categorie;Merk / collectie;Verkoopprijs incl. btw;Btw %;Minimale voorraad;Omschrijving;Beginvoorraad (aantal);Beginkostprijs per stuk\r\n' +
    'Oud Royal Eau de Parfum;DAS-OUD-100;100 ml;100;Parfumflessen;Signature;79,95;21;5;Warme oud met amber;12;24,50\r\n' +
    'Oud Royal Eau de Parfum;DAS-OUD-S3;Sample 3 ml;3;Samples;Signature;4,95;21;20;;50;0,85\r\n',
  suppliers: 'Bedrijfsnaam;Contactpersoon;E-mail;Telefoon;Website;Land;Adres;Btw-nummer;Betaalvoorwaarden;Notities\r\n' +
    'Voorbeeld Parfum Groothandel BV;Jan Jansen;inkoop@voorbeeld.nl;010-1234567;voorbeeld.nl;Nederland;Voorbeeldstraat 1, Rotterdam;NL000000000B01;14 dagen;\r\n',
  sales: 'Ordernummer (extern, uniek);Verkoopdatum;SKU;Aantal;Stukprijs incl. btw;Korting op regel (bedrag of %);Btw %;Verzendopbrengst incl. btw (per order);Verkoopkanaal;Betaalmethode;Klantreferentie;Marketingbron;Campagne;Betaald (ja/nee);Uitgeleverd (ja/nee)\r\n' +
    'WEB-1001;15-11-2026;DAS-OUD-100;1;79,95;;21;4,95;Webshop;iDEAL;klant-001;Instagram;;ja;ja\r\n' +
    'WEB-1001;15-11-2026;DAS-OUD-S3;2;4,95;10%;21;;Webshop;iDEAL;klant-001;Instagram;;ja;ja\r\n',
};

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();

function autoMapping(type, headers) {
  const map = {};
  for (const f of FIELDS[type]) {
    const cands = [f.label, f.key, ...f.aliases].map(norm);
    const h = headers.find(x => cands.includes(norm(x)));
    if (h) map[f.key] = h;
  }
  return map;
}

function createBatch(db, type, filename, buffer, user) {
  if (!FIELDS[type]) throw new ValidationError('Onbekend importtype.');
  if (!buffer || !buffer.length) throw new ValidationError('Het bestand is leeg.');
  if (buffer.length > 5 * 1024 * 1024) throw new ValidationError('CSV-bestand is te groot (max. 5 MB).');
  const text = buffer.toString('utf8');
  if (text.includes('\u0000')) throw new ValidationError('Dit lijkt geen tekstbestand (CSV) te zijn.');
  let parsed;
  try { parsed = parseCsv(text); } catch (e) { throw new ValidationError(e.message); }
  if (!parsed.headers.length || !parsed.records.length) throw new ValidationError('Geen kopregel of geen gegevensregels gevonden.');
  if (parsed.records.length > 5000) throw new ValidationError('Maximaal 5000 regels per import.');
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const done = db.get("SELECT id, created_at FROM import_batches WHERE type = ? AND sha256 = ? AND status = 'done'", [type, sha]);
  if (done) throw new ValidationError(`Dit bestand is al eerder geïmporteerd (import #${done.id}). Dubbele import voorkomen.`);
  const id = db.insert('INSERT INTO import_batches(type, filename, sha256, content, mapping, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [type, String(filename || 'import.csv').slice(0, 200), sha, text, JSON.stringify(autoMapping(type, parsed.headers)), user?.id]);
  return id;
}

function getBatch(db, id) {
  const b = db.get('SELECT * FROM import_batches WHERE id = ?', [id]);
  if (!b) return null;
  b.parsed = parseCsv(b.content);
  b.mappingObj = JSON.parse(b.mapping || '{}');
  b.optionsObj = JSON.parse(b.options || '{}');
  return b;
}

function val(rec, mapping, key) { const h = mapping[key]; return h ? (rec[h] ?? '').trim() : ''; }

// Valideert alle rijen en bepaalt per rij de actie (aanmaken / overslaan / fout).
function analyze(db, batch, mapping, options = {}) {
  const type = batch.type;
  for (const f of FIELDS[type]) if (f.required && !mapping[f.key]) throw new ValidationError(`Koppel een kolom aan het verplichte veld "${f.label}".`);
  const rows = [];
  if (type === 'products') {
    const seen = new Set();
    for (const r of batch.parsed.records) {
      const out = { line: r.__line, errors: [], action: 'create', data: {} };
      try {
        const d = out.data;
        d.product_name = val(r, mapping, 'product_name'); d.sku = val(r, mapping, 'sku');
        if (!d.product_name) out.errors.push('Productnaam ontbreekt.');
        if (!d.sku) out.errors.push('SKU ontbreekt.');
        d.variant_name = val(r, mapping, 'variant_name'); d.edition = val(r, mapping, 'edition'); d.brand = val(r, mapping, 'brand');
        d.description = val(r, mapping, 'description');
        d.size_ml = tryP(out, () => parseIntStrict(val(r, mapping, 'size_ml'), { min: 0, label: 'Inhoud (ml)' }));
        d.price_incl = tryP(out, () => parseMoney(val(r, mapping, 'price_incl')));
        d.vat = tryP(out, () => parsePercent(val(r, mapping, 'vat')));
        d.min_stock = tryP(out, () => parseIntStrict(val(r, mapping, 'min_stock'), { min: 0, label: 'Minimale voorraad' }));
        d.opening_qty = tryP(out, () => parseIntStrict(val(r, mapping, 'opening_qty'), { min: 0, label: 'Beginvoorraad' }));
        d.opening_cost = tryP(out, () => parseMoney(val(r, mapping, 'opening_cost')));
        if (d.opening_qty && d.opening_cost == null) out.errors.push('Beginkostprijs is verplicht bij een beginvoorraad.');
        const cat = val(r, mapping, 'category');
        d.category_id = cat ? tryP(out, () => lookupId(db, 'product_category', cat, { create: !!options.createLookups })) : null;
        if (d.sku) {
          const key = d.sku.toLowerCase();
          if (seen.has(key)) out.errors.push(`SKU ${d.sku} komt meerdere keren voor in het bestand.`);
          seen.add(key);
          if (db.get('SELECT 1 FROM variants WHERE sku = ? COLLATE NOCASE', [d.sku])) { out.action = 'skip'; out.note = 'SKU bestaat al – overgeslagen'; }
        }
      } catch (e) { out.errors.push(e.message); }
      if (out.errors.length) out.action = 'error';
      rows.push(out);
    }
  } else if (type === 'suppliers') {
    const seen = new Set();
    for (const r of batch.parsed.records) {
      const out = { line: r.__line, errors: [], action: 'create', data: {} };
      for (const f of FIELDS.suppliers) out.data[f.key] = val(r, mapping, f.key);
      if (!out.data.name) out.errors.push('Bedrijfsnaam ontbreekt.');
      if (out.data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out.data.email)) out.errors.push('Ongeldig e-mailadres.');
      const key = out.data.name.toLowerCase();
      if (key && seen.has(key)) out.errors.push('Leverancier komt meerdere keren voor in het bestand.');
      seen.add(key);
      if (out.data.name && db.get('SELECT 1 FROM suppliers WHERE name = ? COLLATE NOCASE', [out.data.name])) { out.action = 'skip'; out.note = 'Bestaat al – overgeslagen'; }
      if (out.errors.length) out.action = 'error';
      rows.push(out);
    }
  } else if (type === 'sales') {
    const groups = new Map();
    for (const r of batch.parsed.records) {
      const ref = val(r, mapping, 'order_ref');
      const out = { line: r.__line, errors: [], action: 'create', data: { order_ref: ref } };
      const d = out.data;
      if (!ref) out.errors.push('Ordernummer ontbreekt.');
      d.date = tryP(out, () => parseDate(val(r, mapping, 'date'), { required: true, label: 'Verkoopdatum' }));
      d.sku = val(r, mapping, 'sku');
      const v = d.sku ? db.get('SELECT id, price_incl_cents FROM variants WHERE sku = ? COLLATE NOCASE', [d.sku]) : null;
      if (!d.sku) out.errors.push('SKU ontbreekt.'); else if (!v) out.errors.push(`Onbekende SKU "${d.sku}". Importeer eerst de producten.`);
      d.variant_id = v?.id;
      d.qty = tryP(out, () => parseIntStrict(val(r, mapping, 'qty'), { required: true, min: 1, label: 'Aantal' }));
      const price = val(r, mapping, 'unit_price_incl');
      d.unit_price = price === '' ? '' : price;
      tryP(out, () => (price === '' ? null : parseMoney(price)));
      d.discount = val(r, mapping, 'discount');
      d.vat = val(r, mapping, 'vat');
      tryP(out, () => parsePercent(d.vat));
      d.shipping = val(r, mapping, 'shipping');
      tryP(out, () => parseMoney(d.shipping));
      d.channel_id = tryP(out, () => lookupId(db, 'sales_channel', val(r, mapping, 'channel'), { create: !!options.createLookups }));
      d.payment_method_id = tryP(out, () => lookupId(db, 'payment_method', val(r, mapping, 'payment_method'), { create: !!options.createLookups }));
      d.customer_ref = val(r, mapping, 'customer_ref');
      d.marketing_source = val(r, mapping, 'marketing_source');
      const camp = val(r, mapping, 'campaign');
      if (camp) { const c = db.get('SELECT id FROM campaigns WHERE name = ? COLLATE NOCASE', [camp]); if (c) d.campaign_id = c.id; else out.errors.push(`Onbekende campagne "${camp}".`); }
      d.paid = yes(val(r, mapping, 'paid'));
      d.fulfilled = mapping.fulfilled ? yes(val(r, mapping, 'fulfilled')) : !!options.defaultFulfilled;
      if (ref) {
        if (db.get('SELECT 1 FROM sales WHERE external_ref = ?', [ref])) { out.action = 'skip'; out.note = 'Order bestaat al – overgeslagen'; }
        if (!groups.has(ref)) groups.set(ref, []);
        groups.get(ref).push(out);
      }
      if (out.errors.length) out.action = 'error';
      rows.push(out);
    }
    // Consistentie binnen een order.
    for (const [ref, list] of groups) {
      const dates = new Set(list.map(x => x.data.date));
      if (dates.size > 1) list.forEach(x => { x.errors.push(`Order ${ref} heeft verschillende datums.`); x.action = 'error'; });
    }
  }
  const summary = { total: rows.length, create: rows.filter(r => r.action === 'create').length, skip: rows.filter(r => r.action === 'skip').length, error: rows.filter(r => r.action === 'error').length };
  return { rows, summary };
}

function yes(s) { return ['ja', 'j', 'yes', 'y', '1', 'true', 'paid', 'betaald', 'fulfilled', 'uitgeleverd', 'waar'].includes(String(s || '').trim().toLowerCase()); }
function tryP(out, fn) { try { return fn(); } catch (e) { out.errors.push(e.message); return null; } }

function commit(db, batchId, mapping, options, user) {
  const catalog = require('./catalog');
  const inventory = require('./inventory');
  const sales = require('./sales');
  return db.tx(() => {
    const batch = getBatch(db, batchId);
    if (!batch) throw new ValidationError('Import niet gevonden.');
    if (batch.status !== 'pending') throw new ValidationError('Deze import is al verwerkt of geannuleerd.');
    const { rows, summary } = analyze(db, batch, mapping, options);
    if (summary.error) throw new ValidationError(`Er zijn ${summary.error} rijen met fouten. Corrigeer het bestand of de koppeling en probeer opnieuw.`);
    let created = 0;
    if (batch.type === 'products') {
      for (const r of rows.filter(x => x.action === 'create')) {
        const d = r.data;
        const existing = db.get('SELECT id FROM products WHERE name = ? COLLATE NOCASE', [d.product_name]);
        const variant = { sku: d.sku, name: d.variant_name, size_ml: d.size_ml ?? '', edition: d.edition, price_incl: d.price_incl == null ? '' : centsToInput(d.price_incl), vat: d.vat == null ? '' : bpToInput(d.vat), min_stock: d.min_stock ?? '' };
        let pid;
        if (existing) {
          pid = existing.id;
          catalog.saveProduct(db, { name: d.product_name, ...currentProductFields(db, pid), variants: [variant] }, user, pid);
        } else {
          pid = catalog.saveProduct(db, { name: d.product_name, description: d.description, category_id: d.category_id, brand: d.brand, variants: [variant] }, user);
        }
        if (d.opening_qty) {
          const vid = db.get('SELECT id FROM variants WHERE sku = ? COLLATE NOCASE', [d.sku]).id;
          inventory.recordOpening(db, { variant_id: vid, qty: String(d.opening_qty), unit_cost: centsToInput(d.opening_cost), date: options.openingDate || require('../money').todayIso(), reason: `Import #${batchId}`, idem: `import-${batchId}-${r.line}` }, user);
        }
        created++;
      }
    } else if (batch.type === 'suppliers') {
      for (const r of rows.filter(x => x.action === 'create')) { catalog.saveSupplier(db, r.data, user); created++; }
    } else if (batch.type === 'sales') {
      const byRef = new Map();
      for (const r of rows.filter(x => x.action === 'create')) { if (!byRef.has(r.data.order_ref)) byRef.set(r.data.order_ref, []); byRef.get(r.data.order_ref).push(r.data); }
      for (const [ref, lines] of byRef) {
        const h = lines[0];
        sales.createSale(db, {
          external_ref: ref, sale_date: h.date, channel_id: h.channel_id, payment_method_id: h.payment_method_id, campaign_id: h.campaign_id,
          customer_ref: h.customer_ref, marketing_source: h.marketing_source, shipping: lines.map(l => l.shipping).find(s => s) || '',
          lines: lines.map(l => ({ variant_id: l.variant_id, qty: String(l.qty), unit_price: l.unit_price, discount: l.discount, vat: l.vat })),
          fulfill: h.fulfilled, paid: h.paid, import_batch_id: batchId, idem: `import-${batchId}-${ref}`,
        }, user);
        created++;
      }
    }
    db.run("UPDATE import_batches SET status = 'done', mapping = ?, options = ?, created_rows = ?, skipped_rows = ? WHERE id = ?",
      [JSON.stringify(mapping), JSON.stringify(options), created, summary.skip, batchId]);
    audit(db, user, 'import', batchId, 'commit', { type: batch.type, created, skipped: summary.skip });
    return { created, skipped: summary.skip };
  });
}

function currentProductFields(db, id) {
  const p = db.get('SELECT description, category_id, brand FROM products WHERE id = ?', [id]);
  return { description: p.description, category_id: p.category_id, brand: p.brand };
}

module.exports = { FIELDS, EXAMPLES, autoMapping, createBatch, getBatch, analyze, commit, yes, bool };
