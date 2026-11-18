'use strict';
const { ValidationError, parseMoney, parsePercent, parseIntStrict, parseDate, netFromGross, marginBp, divRound } = require('../money');
const { audit, str, bool, requireLookup, getSettings } = require('./common');
const inventory = require('./inventory');

// Indicatieve marge bij de actuele verkoopprijs: (prijs excl. btw − gemiddelde kostprijs) / prijs excl. btw.
function margin(priceIncl, vatBp, avgCost) {
  const excl = netFromGross(priceIncl, vatBp);
  if (avgCost == null) return { excl, profit: null, bp: null };
  const profit = excl - avgCost;
  return { excl, profit, bp: marginBp(profit, excl) };
}

function listProducts(db, { q, categoryId, status = 'active', brand } = {}) {
  return db.all(`SELECT p.*, c.name AS category,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id) AS variant_count,
      (SELECT MIN(v.price_incl_cents) FROM variants v WHERE v.product_id = p.id AND v.status = 'active') AS min_price,
      (SELECT MAX(v.price_incl_cents) FROM variants v WHERE v.product_id = p.id AND v.status = 'active') AS max_price,
      (SELECT COALESCE(SUM(m.qty),0) FROM stock_movements m JOIN variants v ON v.id = m.variant_id WHERE v.product_id = p.id) AS stock,
      (SELECT COALESCE(SUM(m.value_cents),0) FROM stock_movements m JOIN variants v ON v.id = m.variant_id WHERE v.product_id = p.id) AS stock_value,
      (SELECT COUNT(*) FROM variants v WHERE v.product_id = p.id AND v.status = 'active'
         AND (SELECT COALESCE(SUM(qty),0) FROM stock_movements WHERE variant_id = v.id) <= v.min_stock) AS low_count
    FROM products p LEFT JOIN lookups c ON c.id = p.category_id
    WHERE (:q IS NULL OR p.name LIKE :ql OR p.brand LIKE :ql OR EXISTS (SELECT 1 FROM variants v WHERE v.product_id = p.id AND v.sku LIKE :ql))
      AND (:cat IS NULL OR p.category_id = :cat) AND (:status IS NULL OR p.status = :status) AND (:brand IS NULL OR p.brand = :brand)
    ORDER BY p.name`, { q: q || null, ql: `%${q || ''}%`, cat: categoryId || null, status: status || null, brand: brand || null });
}

function getProduct(db, id) {
  const p = db.get('SELECT p.*, c.name AS category FROM products p LEFT JOIN lookups c ON c.id = p.category_id WHERE p.id = ?', [id]);
  if (!p) return null;
  p.variants = db.all('SELECT * FROM variants WHERE product_id = ? ORDER BY status, size_ml, name, id', [id]).map(v => {
    const s = inventory.stockOf(db, v.id);
    return { ...v, stock: s.qty, stock_value: s.value, avg: s.avg, margin: margin(v.price_incl_cents, v.vat_rate_bp, s.avg) };
  });
  p.supplierItems = db.all(`SELECT si.*, s.name AS supplier_name, s.status AS supplier_status, v.sku, v.name AS variant_name
    FROM supplier_items si JOIN suppliers s ON s.id = si.supplier_id JOIN variants v ON v.id = si.variant_id
    WHERE v.product_id = ? ORDER BY v.id, si.preferred DESC, s.name`, [id]);
  p.used = !!db.get(`SELECT 1 FROM variants v WHERE v.product_id = ? AND (EXISTS (SELECT 1 FROM sale_lines WHERE variant_id = v.id)
    OR EXISTS (SELECT 1 FROM purchase_order_lines WHERE variant_id = v.id) OR EXISTS (SELECT 1 FROM stock_movements WHERE variant_id = v.id))`, [id]);
  return p;
}

function saveProduct(db, input, user, id = null) {
  return db.tx(() => {
    const settings = getSettings(db);
    const h = {
      name: str(input.name, { required: true, max: 200, label: 'Productnaam', field: 'name' }),
      description: str(input.description, { max: 5000 }),
      category_id: requireLookup(db, 'product_category', input.category_id, 'categorie'),
      brand: str(input.brand, { max: 200 }),
    };
    if (id) {
      if (!db.get('SELECT 1 FROM products WHERE id = ?', [id])) throw new ValidationError('Product niet gevonden.');
      db.run("UPDATE products SET name=:name, description=:description, category_id=:category_id, brand=:brand, updated_at=datetime('now') WHERE id=:id", { ...h, id });
    } else {
      id = db.insert('INSERT INTO products(name, description, category_id, brand) VALUES (:name, :description, :category_id, :brand)', h);
    }
    const rows = (Array.isArray(input.variants) ? input.variants : Object.values(input.variants || {})).filter(v => v && (v.sku || v.id || v.price_incl));
    if (!rows.length && !db.get('SELECT 1 FROM variants WHERE product_id = ?', [id])) throw new ValidationError('Voeg minimaal één variant (met SKU) toe.', 'variants');
    rows.forEach((r, i) => {
      const n = i + 1;
      const v = {
        sku: str(r.sku, { required: true, max: 64, label: `Variant ${n}: SKU` }),
        name: str(r.name, { max: 120 }) || '',
        size_ml: parseIntStrict(r.size_ml, { min: 0, label: `Variant ${n}: inhoud (ml)` }),
        edition: str(r.edition, { max: 120 }),
        price_incl_cents: parseMoney(r.price_incl, { field: 'variants' }) ?? 0,
        vat_rate_bp: parsePercent(r.vat, {}) ?? settings.defaultVatBp,
        min_stock: parseIntStrict(r.min_stock, { min: 0, label: `Variant ${n}: minimale voorraad` }) ?? settings.lowStockDefault,
        status: r.status === 'archived' ? 'archived' : 'active',
      };
      const clash = db.get('SELECT id FROM variants WHERE sku = ? COLLATE NOCASE', [v.sku]);
      if (r.id) {
        const cur = db.get('SELECT * FROM variants WHERE id = ? AND product_id = ?', [Number(r.id), id]);
        if (!cur) throw new ValidationError(`Variant ${n} hoort niet bij dit product.`);
        if (clash && clash.id !== cur.id) throw new ValidationError(`SKU "${v.sku}" is al in gebruik.`);
        db.run('UPDATE variants SET sku=:sku, name=:name, size_ml=:size_ml, edition=:edition, price_incl_cents=:price_incl_cents, vat_rate_bp=:vat_rate_bp, min_stock=:min_stock, status=:status WHERE id=:id', { ...v, id: cur.id });
        if (cur.price_incl_cents !== v.price_incl_cents || cur.vat_rate_bp !== v.vat_rate_bp) logPrice(db, cur, v, user);
      } else {
        if (clash) throw new ValidationError(`SKU "${v.sku}" is al in gebruik.`);
        const vid = db.insert('INSERT INTO variants(product_id, sku, name, size_ml, edition, price_incl_cents, vat_rate_bp, min_stock, status) VALUES (:pid, :sku, :name, :size_ml, :edition, :price_incl_cents, :vat_rate_bp, :min_stock, :status)', { ...v, pid: id });
        logPrice(db, { id: vid, price_incl_cents: null, vat_rate_bp: null }, v, user);
      }
    });
    audit(db, user, 'product', id, 'save', { name: h.name });
    return id;
  });
}

function logPrice(db, cur, v, user) {
  db.run('INSERT INTO price_history(variant_id, old_price_incl_cents, new_price_incl_cents, old_vat_rate_bp, new_vat_rate_bp, user_id) VALUES (?, ?, ?, ?, ?, ?)',
    [cur.id, cur.price_incl_cents, v.price_incl_cents, cur.vat_rate_bp, v.vat_rate_bp, user?.id]);
}

function setProductStatus(db, id, status, user) {
  if (!['active', 'archived'].includes(status)) throw new ValidationError('Ongeldige status.');
  db.tx(() => {
    db.run("UPDATE products SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
    if (status === 'archived') db.run("UPDATE variants SET status = 'archived' WHERE product_id = ?", [id]);
    audit(db, user, 'product', id, status === 'archived' ? 'archive' : 'activate');
  });
}

function setImage(db, productId, attachmentId) { db.run('UPDATE products SET image_id = ? WHERE id = ?', [attachmentId, productId]); }

// Prijslijst ---------------------------------------------------------------------
function priceList(db, { q, categoryId, status = 'active', brand } = {}) {
  return inventory.stockOverview(db, { includeArchived: status !== 'active' })
    .filter(r => (status === 'archived' ? r.status === 'archived' : status === 'active' ? r.status === 'active' : true))
    .filter(r => !q || `${r.product_name} ${r.variant_name} ${r.sku} ${r.brand || ''}`.toLowerCase().includes(String(q).toLowerCase()))
    .filter(r => !brand || r.brand === brand)
    .filter(r => !categoryId || db.get('SELECT category_id FROM products WHERE id = ?', [r.product_id]).category_id === Number(categoryId))
    .map(r => ({ ...r, margin: margin(r.price_incl_cents, r.vat_rate_bp, r.avg), preferred: preferredPrice(db, r.id) }));
}

function preferredPrice(db, variantId) {
  return db.get(`SELECT si.price_cents, si.currency, s.name AS supplier_name FROM supplier_items si JOIN suppliers s ON s.id = si.supplier_id
    WHERE si.variant_id = ? ORDER BY si.preferred DESC, si.price_cents LIMIT 1`, [variantId]) || null;
}

// changes: [{ variant_id, price_incl, vat }]
function updatePrices(db, changes, user) {
  return db.tx(() => {
    let n = 0;
    for (const c of changes) {
      const cur = db.get('SELECT * FROM variants WHERE id = ?', [Number(c.variant_id)]);
      if (!cur) continue;
      const price = parseMoney(c.price_incl, { required: true });
      const vat = c.vat === undefined || c.vat === '' ? cur.vat_rate_bp : parsePercent(c.vat, { required: true });
      if (price === cur.price_incl_cents && vat === cur.vat_rate_bp) continue;
      db.run('UPDATE variants SET price_incl_cents = ?, vat_rate_bp = ? WHERE id = ?', [price, vat, cur.id]);
      logPrice(db, cur, { price_incl_cents: price, vat_rate_bp: vat }, user);
      n++;
    }
    audit(db, user, 'price_list', null, 'update', { changed: n });
    return n;
  });
}

function variantOptions(db, { includeArchived = false } = {}) {
  return db.all(`SELECT v.id, v.sku, v.name, v.price_incl_cents, v.vat_rate_bp, p.name AS product_name,
      (SELECT COALESCE(SUM(qty),0) FROM stock_movements WHERE variant_id = v.id) AS stock
    FROM variants v JOIN products p ON p.id = v.product_id
    WHERE (:inc = 1 OR (v.status = 'active' AND p.status = 'active')) ORDER BY p.name, v.size_ml, v.name`, { inc: includeArchived ? 1 : 0 });
}

// Leveranciers ---------------------------------------------------------------------
function listSuppliers(db, { q, status = 'active', country } = {}) {
  return db.all(`SELECT s.*,
      (SELECT COUNT(*) FROM supplier_items si WHERE si.supplier_id = s.id) AS item_count,
      (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id AND po.status IN ('ordered','partial')) AS open_orders,
      (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p JOIN purchase_orders po ON po.id = p.po_id WHERE po.supplier_id = s.id AND p.voided = 0)
        + (SELECT COALESCE(SUM(p.amount_cents),0) FROM payments p JOIN expenses e ON e.id = p.expense_id WHERE e.supplier_id = s.id AND p.voided = 0) AS spent
    FROM suppliers s WHERE (:q IS NULL OR s.name LIKE :ql OR s.contact_name LIKE :ql OR s.email LIKE :ql)
      AND (:status IS NULL OR s.status = :status) AND (:country IS NULL OR s.country = :country)
    ORDER BY s.name`, { q: q || null, ql: `%${q || ''}%`, status: status || null, country: country || null });
}

function getSupplier(db, id) {
  const s = db.get('SELECT * FROM suppliers WHERE id = ?', [id]);
  if (!s) return null;
  s.items = db.all(`SELECT si.*, v.sku, v.name AS variant_name, p.name AS product_name, p.id AS product_id
    FROM supplier_items si JOIN variants v ON v.id = si.variant_id JOIN products p ON p.id = v.product_id WHERE si.supplier_id = ? ORDER BY p.name, v.name`, [id]);
  for (const it of s.items) it.history = db.all('SELECT * FROM supplier_item_prices WHERE supplier_item_id = ? ORDER BY id DESC', [it.id]);
  const purchasing = require('./purchasing');
  s.orders = purchasing.listPos(db, { supplierId: id });
  s.openOrders = s.orders.filter(o => ['ordered', 'partial'].includes(o.status));
  s.spentPurchases = s.orders.reduce((a, o) => a + o.paid, 0);
  s.spentExpenses = db.get('SELECT COALESCE(SUM(p.amount_cents),0) AS v FROM payments p JOIN expenses e ON e.id = p.expense_id WHERE e.supplier_id = ? AND p.voided = 0', [id]).v;
  s.openPayable = s.orders.filter(o => o.status !== 'draft').reduce((a, o) => a + Math.max(0, o.outstanding), 0);
  s.receivedValue = db.get(`SELECT COALESCE(SUM(rl.goods_cents + rl.extra_cents),0) AS v FROM po_receipt_lines rl JOIN po_receipts r ON r.id = rl.receipt_id
    JOIN purchase_orders po ON po.id = r.po_id WHERE po.supplier_id = ?`, [id]).v;
  s.used = !!db.get('SELECT 1 FROM purchase_orders WHERE supplier_id = ? UNION SELECT 1 FROM expenses WHERE supplier_id = ?', [id, id]);
  return s;
}

function saveSupplier(db, input, user, id = null) {
  return db.tx(() => {
    const email = str(input.email, { max: 200 });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ValidationError('Ongeldig e-mailadres.', 'email');
    let website = str(input.website, { max: 300 });
    if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website;
    const s = {
      name: str(input.name, { required: true, max: 200, label: 'Bedrijfsnaam', field: 'name' }),
      contact_name: str(input.contact_name, { max: 200 }), email, phone: str(input.phone, { max: 50 }), website,
      country: str(input.country, { max: 100 }), address: str(input.address, { max: 1000 }), vat_number: str(input.vat_number, { max: 50 }),
      payment_terms: str(input.payment_terms, { max: 200 }), notes: str(input.notes, { max: 5000 }),
    };
    const clash = db.get('SELECT id FROM suppliers WHERE name = ? COLLATE NOCASE', [s.name]);
    if (clash && clash.id !== id) throw new ValidationError(`Er bestaat al een leverancier "${s.name}".`, 'name');
    if (id) {
      db.run('UPDATE suppliers SET name=:name, contact_name=:contact_name, email=:email, phone=:phone, website=:website, country=:country, address=:address, vat_number=:vat_number, payment_terms=:payment_terms, notes=:notes WHERE id=:id', { ...s, id });
    } else {
      id = db.insert('INSERT INTO suppliers(name, contact_name, email, phone, website, country, address, vat_number, payment_terms, notes) VALUES (:name, :contact_name, :email, :phone, :website, :country, :address, :vat_number, :payment_terms, :notes)', s);
    }
    audit(db, user, 'supplier', id, 'save', { name: s.name });
    return id;
  });
}

function setSupplierStatus(db, id, status, user) {
  if (!['active', 'archived'].includes(status)) throw new ValidationError('Ongeldige status.');
  db.run('UPDATE suppliers SET status = ? WHERE id = ?', [status, id]);
  audit(db, user, 'supplier', id, status === 'archived' ? 'archive' : 'activate');
}

// Leverancier ↔ variant met inkoopprijs en prijshistorie.
function saveSupplierItem(db, input, user) {
  return db.tx(() => {
    const supplierId = Number(input.supplier_id);
    const variantId = Number(input.variant_id);
    if (!db.get('SELECT 1 FROM suppliers WHERE id = ?', [supplierId])) throw new ValidationError('Kies een leverancier.', 'supplier_id');
    if (!db.get('SELECT 1 FROM variants WHERE id = ?', [variantId])) throw new ValidationError('Kies een productvariant.', 'variant_id');
    const currency = (str(input.currency, { max: 3 }) || 'EUR').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError('Valuta moet een ISO-code van 3 letters zijn.', 'currency');
    const vt = ['standard', 'reverse_charge', 'exempt'].includes(input.vat_treatment) ? input.vat_treatment : 'standard';
    const it = {
      supplier_sku: str(input.supplier_sku, { max: 100 }),
      price_cents: parseMoney(input.price, { required: true, field: 'price' }),
      currency, vat_treatment: vt,
      vat_rate_bp: vt === 'standard' ? (parsePercent(input.vat_rate, {}) ?? 2100) : 0,
      moq: parseIntStrict(input.moq, { min: 1, label: 'Minimale bestelhoeveelheid' }) ?? 1,
      lead_days: parseIntStrict(input.lead_days, { min: 0, label: 'Levertijd (dagen)' }),
      quote_date: parseDate(input.quote_date, { label: 'Datum prijsopgave' }),
      preferred: bool(input.preferred) ? 1 : 0,
      notes: str(input.notes, { max: 2000 }),
    };
    const cur = db.get('SELECT * FROM supplier_items WHERE supplier_id = ? AND variant_id = ?', [supplierId, variantId]);
    let id;
    if (cur) {
      db.run('UPDATE supplier_items SET supplier_sku=:supplier_sku, price_cents=:price_cents, currency=:currency, vat_treatment=:vat_treatment, vat_rate_bp=:vat_rate_bp, moq=:moq, lead_days=:lead_days, quote_date=:quote_date, preferred=:preferred, notes=:notes WHERE id=:id', { ...it, id: cur.id });
      id = cur.id;
      if (cur.price_cents !== it.price_cents || cur.currency !== it.currency || cur.quote_date !== it.quote_date) {
        db.run('INSERT INTO supplier_item_prices(supplier_item_id, price_cents, currency, quote_date, user_id) VALUES (?, ?, ?, ?, ?)', [id, it.price_cents, it.currency, it.quote_date, user?.id]);
      }
    } else {
      id = db.insert('INSERT INTO supplier_items(supplier_id, variant_id, supplier_sku, price_cents, currency, vat_treatment, vat_rate_bp, moq, lead_days, quote_date, preferred, notes) VALUES (:sid, :vid, :supplier_sku, :price_cents, :currency, :vat_treatment, :vat_rate_bp, :moq, :lead_days, :quote_date, :preferred, :notes)', { ...it, sid: supplierId, vid: variantId });
      db.run('INSERT INTO supplier_item_prices(supplier_item_id, price_cents, currency, quote_date, user_id) VALUES (?, ?, ?, ?, ?)', [id, it.price_cents, it.currency, it.quote_date, user?.id]);
    }
    if (it.preferred) db.run('UPDATE supplier_items SET preferred = 0 WHERE variant_id = ? AND id <> ?', [variantId, id]);
    audit(db, user, 'supplier_item', id, 'save', { supplierId, variantId, price: it.price_cents, currency });
    return id;
  });
}

function avgCostSummary(db, variantId) { const s = inventory.stockOf(db, variantId); return s.avg == null ? null : divRound(s.value, s.qty); }

module.exports = {
  margin, listProducts, getProduct, saveProduct, setProductStatus, setImage, priceList, updatePrices, variantOptions,
  listSuppliers, getSupplier, saveSupplier, setSupplierStatus, saveSupplierItem, preferredPrice, avgCostSummary,
};
