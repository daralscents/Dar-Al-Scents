'use strict';
const multer = require('multer');
const { html, raw, money, date, pct, num, qs, field, moneyField, opts, table, statusBadge, sortRows, paginate, pager } = require('../views/html');
const M = require('../money');
const { page, action, formError, csrfInput, sendCsv } = require('../web');
const auth = require('../auth');
const { csvMoney, csvPercent } = require('../csv');
const C = require('../services/common');
const catalog = require('../services/catalog');
const attachments = require('../services/attachments');
const { TYPE_LABELS } = require('../services/inventory');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: attachments.MAX_BYTES, files: 1 } });

function vatOptions(req) { return req.settings.vatRates.map(bp => ({ value: M.bpToInput(bp), label: M.formatPercent(bp) })); }

module.exports = (app, { db, config }) => {
  app.get('/producten', (req, res) => {
    const q = { q: req.query.q || '', categorie: req.query.categorie || '', status: req.query.status || 'active', merk: req.query.merk || '', sort: req.query.sort || 'name', dir: req.query.dir || 'asc' };
    let rows = catalog.listProducts(db, { q: q.q, categoryId: q.categorie, status: q.status === 'all' ? null : q.status, brand: q.merk });
    rows = sortRows(rows, q.sort, q.dir, { name: r => r.name, category: r => r.category || '', stock: r => r.stock, value: r => r.stock_value, price: r => r.min_price });
    const cols = [
      { label: 'Product', sort: 'name', render: r => html`<a href="/producten/${r.id}">${r.name}</a>${r.brand ? html`<br><small class="muted">${r.brand}</small>` : ''}`, csv: r => r.name },
      { label: 'Categorie', sort: 'category', render: r => r.category || '–', csv: r => r.category || '' },
      { label: 'Varianten', num: true, render: r => num(r.variant_count), csv: r => r.variant_count },
      { label: 'Prijs incl. btw', num: true, sort: 'price', render: r => (r.min_price == null ? '–' : r.min_price === r.max_price ? money(r.min_price) : html`${money(r.min_price)} – ${money(r.max_price)}`), csv: r => csvMoney(r.min_price) },
      { label: 'Voorraad', num: true, sort: 'stock', render: r => html`${num(r.stock)}${r.low_count ? html` <span class="badge badge-warn" title="Varianten met lage voorraad">${r.low_count} laag</span>` : ''}`, csv: r => r.stock },
      { label: 'Voorraadwaarde', num: true, sort: 'value', render: r => money(r.stock_value), csv: r => csvMoney(r.stock_value) },
      { label: 'Status', render: r => statusBadge(r.status === 'active' ? 'actief' : 'gearchiveerd'), csv: r => r.status },
    ];
    if (req.query.format === 'csv') return sendCsv(res, 'producten.csv', cols.map(c => ({ label: c.label, value: c.csv })), rows);
    const pg = paginate(rows, req.query.page);
    const brands = db.all("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand <> '' ORDER BY brand");
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Naam, merk of SKU', attrs: 'type="search"' })}
        ${field('Categorie', 'categorie', q.categorie, { type: 'select', blank: 'Alle categorieën', options: opts(C.lookups(db, 'product_category')) })}
        ${field('Merk / collectie', 'merk', q.merk, { type: 'select', blank: 'Alle', options: brands.map(b => ({ value: b.brand, label: b.brand })) })}
        ${field('Status', 'status', q.status, { type: 'select', blank: false, options: [{ value: 'active', label: 'Actief' }, { value: 'archived', label: 'Gearchiveerd' }, { value: 'all', label: 'Alle' }] })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/producten', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <div class="card">${table({ columns: cols, rows: pg.rows, sort: q.sort, dir: q.dir, baseUrl: '/producten', query: q, empty: html`Nog geen producten. <a href="/producten/nieuw">Voeg je eerste product toe</a> of <a href="/import?type=products">importeer een CSV</a>.` })}
      ${pager(pg, '/producten', q)}</div>`;
    page(req, res, { title: 'Producten', active: 'producten', body, actions: html`<a class="btn" href="/producten/nieuw">+ Product</a><a class="btn btn-ghost" href="/producten/prijslijst">Prijslijst</a><a class="btn btn-ghost" href="/import?type=products">Importeren</a>` });
  });

  // Formulier ----------------------------------------------------------------------
  function productForm(req, res, product, values, errors = {}, status = 200) {
    const v = values || {};
    const variants = v.variants ? (Array.isArray(v.variants) ? v.variants : Object.values(v.variants)) : product ? product.variants.map(x => ({
      id: x.id, sku: x.sku, name: x.name, size_ml: x.size_ml ?? '', edition: x.edition || '', price_incl: M.centsToInput(x.price_incl_cents), vat: M.bpToInput(x.vat_rate_bp), min_stock: x.min_stock, status: x.status,
    })) : [{ vat: M.bpToInput(req.settings.defaultVatBp), min_stock: req.settings.lowStockDefault }];
    const vatOpts = vatOptions(req);
    const row = (x, i) => html`<tr data-line>
      <td><input type="hidden" name="variants[${i}][id]" value="${x.id || ''}"><label class="sr-only" for="v-sku-${i}">SKU</label><input id="v-sku-${i}" name="variants[${i}][sku]" value="${x.sku || ''}" required maxlength="64"></td>
      <td><label class="sr-only" for="v-name-${i}">Variantnaam</label><input id="v-name-${i}" name="variants[${i}][name]" value="${x.name || ''}" placeholder="bijv. 100 ml"></td>
      <td><label class="sr-only" for="v-ml-${i}">Inhoud ml</label><input id="v-ml-${i}" name="variants[${i}][size_ml]" value="${x.size_ml ?? ''}" inputmode="numeric" class="w-sm"></td>
      <td><label class="sr-only" for="v-ed-${i}">Uitvoering</label><input id="v-ed-${i}" name="variants[${i}][edition]" value="${x.edition || ''}" placeholder="bijv. tester"></td>
      <td><label class="sr-only" for="v-price-${i}">Prijs incl. btw</label><input id="v-price-${i}" name="variants[${i}][price_incl]" value="${x.price_incl || ''}" inputmode="decimal" class="w-md" placeholder="0,00"></td>
      <td><label class="sr-only" for="v-vat-${i}">Btw</label><select id="v-vat-${i}" name="variants[${i}][vat]">${vatOpts.map(o => html`<option value="${o.value}"${String(o.value) === String(x.vat ?? '') ? raw(' selected') : ''}>${o.label}</option>`)}</select></td>
      <td><label class="sr-only" for="v-min-${i}">Minimale voorraad</label><input id="v-min-${i}" name="variants[${i}][min_stock]" value="${x.min_stock ?? ''}" inputmode="numeric" class="w-sm"></td>
      <td><label class="sr-only" for="v-st-${i}">Status</label><select id="v-st-${i}" name="variants[${i}][status]"><option value="active">Actief</option><option value="archived"${x.status === 'archived' ? raw(' selected') : ''}>Gearchiveerd</option></select></td>
      <td>${x.id ? '' : html`<button type="button" class="btn btn-ghost btn-sm" data-remove-line aria-label="Regel verwijderen">✕</button>`}</td></tr>`;
    const body = html`<form method="post" class="card form" novalidate>
      ${csrfInput(req)}
      ${errors._message ? html`<div class="flash flash-error" role="alert">${errors._message}</div>` : ''}
      <div class="grid-form">
        ${field('Productnaam', 'name', v.name ?? product?.name, { required: true, errors, class: 'span-2' })}
        ${field('Categorie', 'category_id', v.category_id ?? product?.category_id, { type: 'select', options: opts(C.lookups(db, 'product_category')), errors, help: 'Categorieën beheer je bij Instellingen.' })}
        ${field('Merk of collectie', 'brand', v.brand ?? product?.brand, { errors, attrs: 'list="brand-list"' })}
        ${field('Omschrijving', 'description', v.description ?? product?.description, { type: 'textarea', errors, class: 'span-2' })}
      </div>
      <datalist id="brand-list">${db.all("SELECT DISTINCT brand FROM products WHERE brand <> '' ORDER BY brand").map(b => html`<option value="${b.brand}">`)}</datalist>
      <h2>Varianten</h2>
      <p class="help">Elke variant (inhoud, uitvoering) heeft een eigen SKU, prijs en voorraad. Prijzen zijn inclusief btw. Een historisch gebruikte variant kun je archiveren, niet verwijderen.</p>
      <div class="table-wrap"><table class="lines" data-lines><thead><tr><th>SKU *</th><th>Variant</th><th>ml</th><th>Uitvoering</th><th>Prijs incl.</th><th>Btw</th><th>Min. voorraad</th><th>Status</th><th><span class="sr-only">Acties</span></th></tr></thead>
      <tbody>${variants.map(row)}</tbody></table></div>
      <template data-line-template>${row({ vat: M.bpToInput(req.settings.defaultVatBp), min_stock: req.settings.lowStockDefault }, '__i__')}</template>
      <button type="button" class="btn btn-ghost btn-sm" data-add-line>+ Variant toevoegen</button>
      <div class="form-actions"><button class="btn" type="submit">Opslaan</button><a class="btn btn-ghost" href="${product ? `/producten/${product.id}` : '/producten'}">Annuleren</a></div>
    </form>`;
    page(req, res, { title: product ? `${product.name} bewerken` : 'Nieuw product', active: 'producten', body }, status);
  }

  app.get('/producten/nieuw', (req, res) => productForm(req, res, null, null));
  app.post('/producten/nieuw', (req, res) => {
    try { const id = catalog.saveProduct(db, req.body, req.user); req.addFlash('success', 'Product opgeslagen.'); res.redirect(303, `/producten/${id}`); }
    catch (e) { formError(e, errors => productForm(req, res, null, req.body, errors, 422)); }
  });
  app.get('/producten/:id/bewerken', (req, res, next) => {
    const p = catalog.getProduct(db, Number(req.params.id)); if (!p) return next();
    productForm(req, res, p, null);
  });
  app.post('/producten/:id/bewerken', (req, res, next) => {
    const p = catalog.getProduct(db, Number(req.params.id)); if (!p) return next();
    try { catalog.saveProduct(db, req.body, req.user, p.id); req.addFlash('success', 'Wijzigingen opgeslagen.'); res.redirect(303, `/producten/${p.id}`); }
    catch (e) { formError(e, errors => productForm(req, res, p, req.body, errors, 422)); }
  });
  app.post('/producten/:id/status', action((req, res) => {
    catalog.setProductStatus(db, Number(req.params.id), req.body.status, req.user);
    req.addFlash('success', req.body.status === 'archived' ? 'Product gearchiveerd. Historische verkopen en mutaties blijven bewaard.' : 'Product weer actief.');
    res.redirect(303, `/producten/${req.params.id}`);
  }));
  app.post('/producten/:id/afbeelding', upload.single('file'), action((req, res) => {
    if (!auth.csrfOk(req)) throw new M.ValidationError('Formulier verlopen; probeer opnieuw.');
    const id = Number(req.params.id);
    const aid = attachments.saveAttachment(db, config.uploadDir, { entity: 'product', entityId: id, file: req.file, imagesOnly: true }, req.user);
    catalog.setImage(db, id, aid);
    req.addFlash('success', 'Afbeelding opgeslagen.');
    res.redirect(303, `/producten/${id}`);
  }));

  app.get('/producten/:id', (req, res, next) => {
    const p = catalog.getProduct(db, Number(req.params.id)); if (!p) return next();
    const canWrite = req.user.role === 'admin';
    const suppliers = catalog.listSuppliers(db, {});
    const history = db.all(`SELECT ph.*, v.sku, u.name AS user_name FROM price_history ph JOIN variants v ON v.id = ph.variant_id LEFT JOIN users u ON u.id = ph.user_id
      WHERE v.product_id = ? ORDER BY ph.id DESC LIMIT 30`, [p.id]);
    const body = html`
    <div class="grid-2">
      <section class="card">
        <div class="product-head">
          ${p.image_id ? html`<img class="product-img" src="/bijlagen/${p.image_id}" alt="${p.name}">` : html`<div class="product-img placeholder" aria-hidden="true">${p.name.slice(0, 1)}</div>`}
          <div><h2>${p.name}</h2><p class="muted">${[p.category, p.brand].filter(Boolean).join(' · ') || 'Geen categorie'}</p>${statusBadge(p.status === 'active' ? 'actief' : 'gearchiveerd')}</div>
        </div>
        ${p.description ? html`<p class="prewrap">${p.description}</p>` : ''}
        ${canWrite ? html`<div class="row-actions">
          <a class="btn btn-sm" href="/producten/${p.id}/bewerken">Bewerken</a>
          <form method="post" action="/producten/${p.id}/status">${csrfInput(req)}<input type="hidden" name="status" value="${p.status === 'active' ? 'archived' : 'active'}">
            <button class="btn btn-ghost btn-sm" type="submit"${p.status === 'active' ? raw(' data-confirm="Product archiveren? Het blijft zichtbaar in de historie."') : ''}>${p.status === 'active' ? 'Archiveren' : 'Activeren'}</button></form>
          <form method="post" action="/producten/${p.id}/afbeelding" enctype="multipart/form-data" class="inline-upload">${csrfInput(req)}
            <label class="btn btn-ghost btn-sm">Afbeelding kiezen<input type="file" name="file" accept="image/png,image/jpeg,image/webp" class="sr-only" data-autosubmit-file></label></form>
        </div>` : ''}
      </section>
      <section class="card"><h2>Leveranciers</h2>
        ${table({ columns: [
          { label: 'Leverancier', render: r => html`<a href="/leveranciers/${r.supplier_id}">${r.supplier_name}</a>${r.preferred ? html` <span class="badge badge-ok">voorkeur</span>` : ''}` },
          { label: 'Variant', key: 'sku' },
          { label: 'Inkoopprijs', num: true, render: r => money(r.price_cents, r.currency) },
          { label: 'Levertijd', render: r => (r.lead_days != null ? `${r.lead_days} dagen` : '–') },
          { label: 'MOQ', num: true, render: r => num(r.moq) },
        ], rows: p.supplierItems, empty: 'Nog niet gekoppeld aan een leverancier.' })}
        ${canWrite && p.variants.length ? html`<details class="mt"><summary class="btn btn-ghost btn-sm">+ Leverancier koppelen</summary>
          ${supplierItemForm(req, { variants: p.variants, suppliers, back: `/producten/${p.id}` })}</details>` : ''}
      </section>
    </div>
    <section class="card"><h2>Varianten, voorraad en marge</h2>
      ${table({ columns: [
        { label: 'SKU', render: r => html`${r.sku}${r.status === 'archived' ? html` <span class="badge badge-muted">gearchiveerd</span>` : ''}` },
        { label: 'Variant', render: r => [r.name, r.size_ml != null ? `${r.size_ml} ml` : null, r.edition].filter(Boolean).join(' · ') || '–' },
        { label: 'Prijs incl.', num: true, render: r => money(r.price_incl_cents) },
        { label: 'Prijs excl.', num: true, render: r => money(r.margin.excl) },
        { label: 'Btw', num: true, render: r => pct(r.vat_rate_bp) },
        { label: 'Voorraad', num: true, render: r => html`<span class="${r.stock <= r.min_stock ? 'warn-text' : ''}">${num(r.stock)}</span> <small class="muted">/ min ${r.min_stock}</small>` },
        { label: 'Gem. kostprijs', num: true, render: r => money(r.avg) },
        { label: 'Voorraadwaarde', num: true, render: r => money(r.stock_value) },
        { label: 'Indicatieve marge', num: true, render: r => (r.margin.bp == null ? html`<span class="muted">geen kostprijs</span>` : html`${money(r.margin.profit)} <small>(${pct(r.margin.bp)})</small>`) },
        { label: '', render: r => html`<a href="/voorraad/variant/${r.id}">Mutaties</a>` },
      ], rows: p.variants })}
      <p class="help">Indicatieve marge = prijs excl. btw − gewogen gemiddelde voorraadkostprijs, gedeeld door prijs excl. btw.</p>
    </section>
    <section class="card"><h2>Prijshistorie</h2>
      ${table({ columns: [{ label: 'Datum', render: r => M.formatDateTime(r.changed_at) }, { label: 'SKU', key: 'sku' }, { label: 'Oud', num: true, render: r => (r.old_price_incl_cents == null ? 'nieuw' : money(r.old_price_incl_cents)) },
        { label: 'Nieuw', num: true, render: r => money(r.new_price_incl_cents) }, { label: 'Btw', num: true, render: r => pct(r.new_vat_rate_bp) }, { label: 'Door', render: r => r.user_name || '–' }], rows: history, empty: 'Geen prijswijzigingen.' })}
      <p class="help">Prijswijzigingen gelden alleen voor nieuwe verkopen; bestaande verkoopregels bewaren hun eigen prijs, korting en btw.</p>
    </section>`;
    page(req, res, { title: p.name, active: 'producten', body, actions: html`<a class="btn btn-ghost" href="/producten">← Alle producten</a>` });
  });

  // Prijslijst -------------------------------------------------------------------------
  app.get('/producten/prijslijst', (req, res) => {
    const q = { q: req.query.q || '', categorie: req.query.categorie || '', merk: req.query.merk || '', status: req.query.status || 'active', sort: req.query.sort || 'product', dir: req.query.dir || 'asc' };
    let rows = catalog.priceList(db, { q: q.q, categoryId: q.categorie, brand: q.merk, status: q.status });
    rows = sortRows(rows, q.sort, q.dir, { product: r => `${r.product_name} ${r.variant_name}`, sku: r => r.sku, price: r => r.price_incl_cents, margin: r => r.margin.bp, cost: r => r.avg, stock: r => r.qty });
    if (req.query.format === 'csv') {
      return sendCsv(res, 'prijslijst.csv', [
        { label: 'Product', value: r => r.product_name }, { label: 'Variant', value: r => r.variant_name }, { label: 'SKU', value: r => r.sku }, { label: 'Merk', value: r => r.brand || '' }, { label: 'Categorie', value: r => r.category || '' },
        { label: 'Prijs incl. btw', value: r => csvMoney(r.price_incl_cents) }, { label: 'Btw %', value: r => csvPercent(r.vat_rate_bp) }, { label: 'Prijs excl. btw', value: r => csvMoney(r.margin.excl) },
        { label: 'Gem. kostprijs', value: r => csvMoney(r.avg) }, { label: 'Marge', value: r => csvMoney(r.margin.profit) }, { label: 'Marge %', value: r => csvPercent(r.margin.bp) }, { label: 'Voorraad', value: r => r.qty },
        { label: 'Voorkeursleverancier', value: r => r.preferred?.supplier_name || '' }, { label: 'Inkoopprijs leverancier', value: r => (r.preferred ? csvMoney(r.preferred.price_cents) : '') }, { label: 'Valuta', value: r => r.preferred?.currency || '' },
      ], rows);
    }
    const canWrite = req.user.role === 'admin';
    const vatOpts = vatOptions(req);
    const brands = db.all("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand <> '' ORDER BY brand");
    const body = html`
      <form class="filters" method="get" role="search">
        ${field('Zoeken', 'q', q.q, { placeholder: 'Product, SKU of merk', attrs: 'type="search"' })}
        ${field('Categorie', 'categorie', q.categorie, { type: 'select', blank: 'Alle', options: opts(C.lookups(db, 'product_category')) })}
        ${field('Merk', 'merk', q.merk, { type: 'select', blank: 'Alle', options: brands.map(b => ({ value: b.brand, label: b.brand })) })}
        ${field('Status', 'status', q.status, { type: 'select', blank: false, options: [{ value: 'active', label: 'Actief' }, { value: 'archived', label: 'Gearchiveerd' }, { value: 'all', label: 'Alle' }] })}
        <div class="filter-actions"><button class="btn btn-sm" type="submit">Filteren</button><a class="btn btn-ghost btn-sm" href="${qs('/producten/prijslijst', { ...q, format: 'csv' })}">CSV-export</a></div>
      </form>
      <form method="post" action="/producten/prijslijst" class="card">
        ${csrfInput(req)}
        <p class="help">Pas prijzen (incl. btw) aan; de marge wordt direct opnieuw berekend tegen de gewogen gemiddelde kostprijs. Alleen gewijzigde regels worden opgeslagen en in de prijshistorie vastgelegd.</p>
        ${table({ columns: [
          { label: 'Product', sort: 'product', render: r => html`<a href="/producten/${r.product_id}">${r.product_name}</a>${r.variant_name ? html`<br><small class="muted">${r.variant_name}</small>` : ''}` },
          { label: 'SKU', sort: 'sku', key: 'sku' },
          { label: 'Gem. kostprijs', num: true, sort: 'cost', render: r => money(r.avg) },
          { label: 'Inkoop (voorkeur)', num: true, render: r => (r.preferred ? html`${money(r.preferred.price_cents, r.preferred.currency)}<br><small class="muted">${r.preferred.supplier_name}</small>` : '–') },
          { label: 'Prijs incl. btw', num: true, sort: 'price', render: (r) => (canWrite ? html`<input type="hidden" name="changes[${r.id}][variant_id]" value="${r.id}">
              <label class="sr-only" for="pl-${r.id}">Prijs ${r.sku}</label><input id="pl-${r.id}" class="w-md num" name="changes[${r.id}][price_incl]" value="${M.centsToInput(r.price_incl_cents)}" inputmode="decimal" data-price-input data-avg="${r.avg ?? ''}" data-row="${r.id}">` : money(r.price_incl_cents)) },
          { label: 'Btw', render: r => (canWrite ? html`<label class="sr-only" for="plv-${r.id}">Btw ${r.sku}</label><select id="plv-${r.id}" name="changes[${r.id}][vat]" data-vat-input data-row="${r.id}">${vatOpts.map(o => html`<option value="${o.value}"${o.value === M.bpToInput(r.vat_rate_bp) ? raw(' selected') : ''}>${o.label}</option>`)}</select>` : pct(r.vat_rate_bp)) },
          { label: 'Excl. btw', num: true, render: r => html`<span data-excl="${r.id}">${money(r.margin.excl)}</span>` },
          { label: 'Marge', num: true, sort: 'margin', render: r => html`<span data-margin="${r.id}">${r.margin.bp == null ? '–' : html`${money(r.margin.profit)} (${pct(r.margin.bp)})`}</span>` },
          { label: 'Voorraad', num: true, sort: 'stock', render: r => num(r.qty) },
        ], rows, sort: q.sort, dir: q.dir, baseUrl: '/producten/prijslijst', query: q, empty: 'Geen varianten gevonden.' })}
        ${canWrite && rows.length ? html`<div class="form-actions sticky-actions"><button class="btn" type="submit">Prijswijzigingen opslaan</button></div>` : ''}
      </form>`;
    page(req, res, { title: 'Prijslijst', active: 'producten', body, actions: html`<a class="btn btn-ghost" href="/producten">← Producten</a>` });
  });
  app.post('/producten/prijslijst', action((req, res) => {
    const changes = Object.values(req.body.changes || {});
    const n = catalog.updatePrices(db, changes, req.user);
    req.addFlash('success', n ? `${n} prijs${n === 1 ? '' : 'zen'} bijgewerkt. Historische verkopen zijn ongewijzigd.` : 'Geen wijzigingen.');
    res.redirect(303, '/producten/prijslijst');
  }));

  // Leverancier koppelen (vanuit product of leverancier).
  app.post('/leverancier-artikelen', action((req, res) => {
    catalog.saveSupplierItem(db, req.body, req.user);
    req.addFlash('success', 'Inkoopprijs opgeslagen.');
    const back = String(req.body.back || '/');
    res.redirect(303, back.startsWith('/') && !back.startsWith('//') ? back : '/');
  }));
};

function supplierItemForm(req, { variants, suppliers, back, supplierId, item }) {
  const vatTreat = [{ value: 'standard', label: 'Normaal (btw-tarief)' }, { value: 'reverse_charge', label: 'Btw verlegd / intracommunautair' }, { value: 'exempt', label: 'Vrijgesteld / geen btw' }];
  return html`<form method="post" action="/leverancier-artikelen" class="stack compact">
    ${csrfInput(req)}<input type="hidden" name="back" value="${back}">
    ${supplierId ? html`<input type="hidden" name="supplier_id" value="${supplierId}">` : field('Leverancier', 'supplier_id', item?.supplier_id, { type: 'select', required: true, options: suppliers.map(s => ({ value: s.id, label: s.name })) })}
    ${field('Productvariant', 'variant_id', item?.variant_id, { type: 'select', required: true, options: variants.map(v => ({ value: v.id, label: `${v.product_name ? v.product_name + ' – ' : ''}${v.sku}${v.name ? ' (' + v.name + ')' : ''}` })) })}
    <div class="grid-form">
      ${field('Artikelnummer leverancier', 'supplier_sku', item?.supplier_sku)}
      ${field('Inkoopprijs (excl. btw)', 'price', item ? M.centsToInput(item.price_cents) : '', { required: true, inputmode: 'decimal', placeholder: '0,00' })}
      ${field('Valuta', 'currency', item?.currency || 'EUR', { attrs: 'maxlength="3" pattern="[A-Za-z]{3}"', help: 'ISO-code, bijv. EUR, USD, AED' })}
      ${field('Btw-behandeling', 'vat_treatment', item?.vat_treatment || 'standard', { type: 'select', blank: false, options: vatTreat })}
      ${field('Btw-tarief', 'vat_rate', item ? M.bpToInput(item.vat_rate_bp) : '21', { inputmode: 'decimal' })}
      ${field('Min. bestelhoeveelheid', 'moq', item?.moq ?? 1, { inputmode: 'numeric' })}
      ${field('Levertijd (dagen)', 'lead_days', item?.lead_days ?? '', { inputmode: 'numeric' })}
      ${field('Datum prijsopgave', 'quote_date', item?.quote_date || M.todayIso(), { type: 'date' })}
    </div>
    ${field('Voorkeursleverancier voor deze variant', 'preferred', item?.preferred, { type: 'checkbox' })}
    ${field('Notities', 'notes', item?.notes, { type: 'textarea', rows: 2 })}
    <button class="btn btn-sm" type="submit">Opslaan</button>
  </form>`;
}

module.exports.supplierItemForm = supplierItemForm;
void date; void moneyField; void TYPE_LABELS;
