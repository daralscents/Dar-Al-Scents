-- Dar Al Scents dashboard – initieel schema
-- Conventies:
--   * Geldbedragen: INTEGER in eurocenten (of centen van de vermelde valuta).
--   * Percentages (btw, korting): INTEGER in basispunten (2100 = 21,00%).
--   * Wisselkoersen: INTEGER in micro-eenheden (EUR per 1 eenheid vreemde valuta × 1.000.000).
--   * Datums: TEXT 'YYYY-MM-DD'; tijdstempels: TEXT 'YYYY-MM-DD HH:MM:SS' (UTC).
--   * Transacties (voorraadmutaties, betalingen, ontvangsten, retouren) worden nooit verwijderd;
--     correcties gaan via tegenboekingen of het markeren als vervallen (met reden).

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','viewer')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  csrf       TEXT NOT NULL,
  flash      TEXT,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  action     TEXT NOT NULL,
  details    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX audit_entity ON audit_log(entity, entity_id);

-- Instelbare keuzelijsten: productcategorieën, verkoopkanalen, betaalmethoden,
-- kostencategorieën, inkomstencategorieën, marketingkanalen.
CREATE TABLE lookups (
  id       INTEGER PRIMARY KEY,
  type     TEXT NOT NULL CHECK (type IN ('product_category','sales_channel','payment_method','expense_category','income_category','marketing_channel')),
  name     TEXT NOT NULL,
  is_marketing INTEGER NOT NULL DEFAULT 0, -- alleen voor expense_category: telt als marketingkosten
  archived INTEGER NOT NULL DEFAULT 0,
  sort     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, name)
);

CREATE TABLE counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE attachments (
  id            INTEGER PRIMARY KEY,
  entity        TEXT NOT NULL CHECK (entity IN ('expense','product','purchase_order','sale','other_entry')),
  entity_id     INTEGER NOT NULL,
  stored_name   TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size          INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  user_id       INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX attachments_entity ON attachments(entity, entity_id);

-- Producten en varianten -------------------------------------------------------

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES lookups(id),
  brand       TEXT,
  image_id    INTEGER REFERENCES attachments(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE variants (
  id               INTEGER PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  sku              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name             TEXT NOT NULL DEFAULT '',
  size_ml          INTEGER CHECK (size_ml IS NULL OR size_ml >= 0),
  edition          TEXT,
  price_incl_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_incl_cents >= 0),
  vat_rate_bp      INTEGER NOT NULL DEFAULT 2100 CHECK (vat_rate_bp BETWEEN 0 AND 10000),
  min_stock        INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX variants_product ON variants(product_id);

CREATE TABLE price_history (
  id                   INTEGER PRIMARY KEY,
  variant_id           INTEGER NOT NULL REFERENCES variants(id),
  old_price_incl_cents INTEGER,
  new_price_incl_cents INTEGER NOT NULL,
  old_vat_rate_bp      INTEGER,
  new_vat_rate_bp      INTEGER NOT NULL,
  user_id              INTEGER REFERENCES users(id),
  changed_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leveranciers -----------------------------------------------------------------

CREATE TABLE suppliers (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  country       TEXT,
  address       TEXT,
  vat_number    TEXT,
  payment_terms TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE supplier_items (
  id            INTEGER PRIMARY KEY,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
  variant_id    INTEGER NOT NULL REFERENCES variants(id),
  supplier_sku  TEXT,
  price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
  currency      TEXT NOT NULL DEFAULT 'EUR',
  vat_treatment TEXT NOT NULL DEFAULT 'standard' CHECK (vat_treatment IN ('standard','reverse_charge','exempt')),
  vat_rate_bp   INTEGER NOT NULL DEFAULT 2100,
  moq           INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
  lead_days     INTEGER,
  quote_date    TEXT,
  preferred     INTEGER NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (supplier_id, variant_id)
);

CREATE TABLE supplier_item_prices (
  id               INTEGER PRIMARY KEY,
  supplier_item_id INTEGER NOT NULL REFERENCES supplier_items(id),
  price_cents      INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  quote_date       TEXT,
  user_id          INTEGER REFERENCES users(id),
  changed_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Marketing --------------------------------------------------------------------

CREATE TABLE campaigns (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  channel_id   INTEGER REFERENCES lookups(id),
  start_date   TEXT,
  end_date     TEXT,
  budget_cents INTEGER,
  notes        TEXT,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inkoop -----------------------------------------------------------------------

CREATE TABLE purchase_orders (
  id                INTEGER PRIMARY KEY,
  number            TEXT NOT NULL UNIQUE,
  supplier_id       INTEGER NOT NULL REFERENCES suppliers(id),
  order_date        TEXT NOT NULL,
  expected_date     TEXT,
  reference         TEXT,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  fx_rate_micro     INTEGER NOT NULL DEFAULT 1000000 CHECK (fx_rate_micro > 0),
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ordered','partial','received','cancelled')),
  shipping_cents    INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),   -- EUR, excl. btw
  duties_cents      INTEGER NOT NULL DEFAULT 0 CHECK (duties_cents >= 0),     -- EUR
  other_costs_cents INTEGER NOT NULL DEFAULT 0 CHECK (other_costs_cents >= 0),-- EUR, excl. btw
  allocation_method TEXT NOT NULL DEFAULT 'value' CHECK (allocation_method IN ('value','quantity')),
  vat_recoverable   INTEGER NOT NULL DEFAULT 1,
  notes             TEXT,
  idempotency_key   TEXT UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE purchase_order_lines (
  id                INTEGER PRIMARY KEY,
  po_id             INTEGER NOT NULL REFERENCES purchase_orders(id),
  variant_id        INTEGER NOT NULL REFERENCES variants(id),
  qty               INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0), -- in ordervaluta, excl. btw
  discount_bp       INTEGER NOT NULL DEFAULT 0 CHECK (discount_bp BETWEEN 0 AND 10000),
  vat_rate_bp       INTEGER NOT NULL DEFAULT 2100,
  sort              INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX pol_po ON purchase_order_lines(po_id);

CREATE TABLE po_receipts (
  id              INTEGER PRIMARY KEY,
  po_id           INTEGER NOT NULL REFERENCES purchase_orders(id),
  received_date   TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  notes           TEXT,
  user_id         INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE po_receipt_lines (
  id          INTEGER PRIMARY KEY,
  receipt_id  INTEGER NOT NULL REFERENCES po_receipts(id),
  po_line_id  INTEGER NOT NULL REFERENCES purchase_order_lines(id),
  qty         INTEGER NOT NULL CHECK (qty > 0),
  goods_cents INTEGER NOT NULL,  -- EUR-waarde goederen (excl. terugvorderbare btw)
  extra_cents INTEGER NOT NULL   -- toegerekende bijkomende kosten (EUR)
);

-- Verkopen ---------------------------------------------------------------------

CREATE TABLE import_batches (
  id           INTEGER PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN ('products','suppliers','sales')),
  filename     TEXT NOT NULL,
  sha256       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','discarded')),
  content      TEXT NOT NULL,
  mapping      TEXT,
  options      TEXT,
  created_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  user_id      INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX import_done_unique ON import_batches(type, sha256) WHERE status = 'done';

CREATE TABLE sales (
  id                 INTEGER PRIMARY KEY,
  number             TEXT NOT NULL UNIQUE,
  external_ref       TEXT UNIQUE,
  import_batch_id    INTEGER REFERENCES import_batches(id),
  sale_date          TEXT NOT NULL,
  channel_id         INTEGER REFERENCES lookups(id),
  payment_method_id  INTEGER REFERENCES lookups(id),
  campaign_id        INTEGER REFERENCES campaigns(id),
  marketing_source   TEXT,
  customer_ref       TEXT,
  new_customer       INTEGER CHECK (new_customer IS NULL OR new_customer IN (0,1)),
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled','fulfilled','partially_returned','returned')),
  fulfilled_date     TEXT,
  shipping_gross_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_gross_cents >= 0),
  shipping_vat_bp      INTEGER NOT NULL DEFAULT 2100,
  shipping_net_cents   INTEGER NOT NULL DEFAULT 0,
  shipping_vat_cents   INTEGER NOT NULL DEFAULT 0,
  notes              TEXT,
  cancel_reason      TEXT,
  idempotency_key    TEXT UNIQUE,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sales_date ON sales(sale_date);
CREATE INDEX sales_fulfilled ON sales(fulfilled_date);

CREATE TABLE sale_lines (
  id                    INTEGER PRIMARY KEY,
  sale_id               INTEGER NOT NULL REFERENCES sales(id),
  variant_id            INTEGER NOT NULL REFERENCES variants(id),
  description           TEXT NOT NULL,
  sku                   TEXT NOT NULL,
  qty                   INTEGER NOT NULL CHECK (qty > 0),
  unit_price_incl_cents INTEGER NOT NULL CHECK (unit_price_incl_cents >= 0),
  discount_cents        INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  vat_rate_bp           INTEGER NOT NULL,
  gross_cents           INTEGER NOT NULL,
  net_cents             INTEGER NOT NULL,
  vat_cents             INTEGER NOT NULL,
  cogs_cents            INTEGER,
  returned_qty          INTEGER NOT NULL DEFAULT 0 CHECK (returned_qty >= 0)
);
CREATE INDEX sl_sale ON sale_lines(sale_id);
CREATE INDEX sl_variant ON sale_lines(variant_id);

CREATE TABLE sale_returns (
  id              INTEGER PRIMARY KEY,
  sale_id         INTEGER NOT NULL REFERENCES sales(id),
  return_date     TEXT NOT NULL,
  restock         INTEGER NOT NULL DEFAULT 1,
  reason          TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id         INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sale_return_lines (
  id                  INTEGER PRIMARY KEY,
  return_id           INTEGER NOT NULL REFERENCES sale_returns(id),
  sale_line_id        INTEGER NOT NULL REFERENCES sale_lines(id),
  qty                 INTEGER NOT NULL CHECK (qty > 0),
  gross_cents         INTEGER NOT NULL,
  net_cents           INTEGER NOT NULL,
  vat_cents           INTEGER NOT NULL,
  cogs_share_cents    INTEGER NOT NULL DEFAULT 0, -- evenredig deel van de vastgelegde kostprijs
  cogs_reversed_cents INTEGER NOT NULL DEFAULT 0  -- deel dat terug op voorraad is genomen (0 als niet terug op voorraad)
);

-- Uitgaven en overige inkomsten/financiering -----------------------------------

CREATE TABLE expenses (
  id                  INTEGER PRIMARY KEY,
  expense_date        TEXT NOT NULL,
  due_date            TEXT,
  supplier_id         INTEGER REFERENCES suppliers(id),
  payee               TEXT,
  category_id         INTEGER NOT NULL REFERENCES lookups(id),
  description         TEXT NOT NULL,
  amount_excl_cents   INTEGER NOT NULL CHECK (amount_excl_cents >= 0),
  vat_rate_bp         INTEGER NOT NULL DEFAULT 2100,
  vat_cents           INTEGER NOT NULL DEFAULT 0 CHECK (vat_cents >= 0),
  total_cents         INTEGER NOT NULL,
  vat_recoverable     INTEGER NOT NULL DEFAULT 1,
  payment_method_id   INTEGER REFERENCES lookups(id),
  campaign_id         INTEGER REFERENCES campaigns(id),
  marketing_channel_id INTEGER REFERENCES lookups(id),
  invoice_ref         TEXT,
  notes               TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancel_reason       TEXT,
  idempotency_key     TEXT UNIQUE,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX expenses_date ON expenses(expense_date);

CREATE TABLE other_entries (
  id                INTEGER PRIMARY KEY,
  entry_date        TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('other_income','loan_in','owner_deposit','loan_repayment','owner_withdrawal')),
  category_id       INTEGER REFERENCES lookups(id),
  description       TEXT NOT NULL,
  amount_excl_cents INTEGER NOT NULL CHECK (amount_excl_cents > 0),
  vat_rate_bp       INTEGER NOT NULL DEFAULT 0,
  vat_cents         INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  cancel_reason     TEXT,
  notes             TEXT,
  idempotency_key   TEXT UNIQUE,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Betalingen (alle daadwerkelijke kasstromen) ------------------------------------

CREATE TABLE payments (
  id                    INTEGER PRIMARY KEY,
  direction             TEXT NOT NULL CHECK (direction IN ('in','out')),
  kind                  TEXT NOT NULL CHECK (kind IN ('sale','refund','purchase','expense','other_income','financing')),
  pay_date              TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0), -- EUR
  currency              TEXT NOT NULL DEFAULT 'EUR',
  original_amount_cents INTEGER,
  fx_rate_micro         INTEGER,
  method_id             INTEGER REFERENCES lookups(id),
  sale_id               INTEGER REFERENCES sales(id),
  po_id                 INTEGER REFERENCES purchase_orders(id),
  expense_id            INTEGER REFERENCES expenses(id),
  entry_id              INTEGER REFERENCES other_entries(id),
  reference             TEXT,
  notes                 TEXT,
  idempotency_key       TEXT NOT NULL UNIQUE,
  voided                INTEGER NOT NULL DEFAULT 0,
  void_reason           TEXT,
  user_id               INTEGER REFERENCES users(id),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((kind IN ('sale','refund') AND sale_id IS NOT NULL AND po_id IS NULL AND expense_id IS NULL AND entry_id IS NULL)
      OR (kind = 'purchase' AND po_id IS NOT NULL AND sale_id IS NULL AND expense_id IS NULL AND entry_id IS NULL)
      OR (kind = 'expense' AND expense_id IS NOT NULL AND sale_id IS NULL AND po_id IS NULL AND entry_id IS NULL)
      OR (kind IN ('other_income','financing') AND entry_id IS NOT NULL AND sale_id IS NULL AND po_id IS NULL AND expense_id IS NULL))
);
CREATE INDEX payments_date ON payments(pay_date);

-- Voorraadmutaties ---------------------------------------------------------------

CREATE TABLE stock_movements (
  id              INTEGER PRIMARY KEY,
  variant_id      INTEGER NOT NULL REFERENCES variants(id),
  move_date       TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('opening','purchase','sale','return','damage','giveaway','correction')),
  qty             INTEGER NOT NULL CHECK (qty <> 0),
  value_cents     INTEGER NOT NULL,
  reason          TEXT,
  receipt_line_id INTEGER REFERENCES po_receipt_lines(id),
  sale_line_id    INTEGER REFERENCES sale_lines(id),
  return_line_id  INTEGER REFERENCES sale_return_lines(id),
  reverses_id     INTEGER REFERENCES stock_movements(id),
  idempotency_key TEXT UNIQUE,
  user_id         INTEGER REFERENCES users(id),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX sm_variant ON stock_movements(variant_id, move_date);
CREATE UNIQUE INDEX sm_sale_line_once ON stock_movements(sale_line_id) WHERE type = 'sale';
CREATE UNIQUE INDEX sm_receipt_line_once ON stock_movements(receipt_line_id) WHERE receipt_line_id IS NOT NULL;
CREATE UNIQUE INDEX sm_reverse_once ON stock_movements(reverses_id) WHERE reverses_id IS NOT NULL;

-- Historie beschermen ----------------------------------------------------------------

CREATE TRIGGER sm_no_delete BEFORE DELETE ON stock_movements BEGIN SELECT RAISE(ABORT, 'Voorraadmutaties kunnen niet worden verwijderd; boek een correctie.'); END;
CREATE TRIGGER sm_no_update BEFORE UPDATE ON stock_movements BEGIN SELECT RAISE(ABORT, 'Voorraadmutaties kunnen niet worden gewijzigd; boek een correctie.'); END;
CREATE TRIGGER pay_no_delete BEFORE DELETE ON payments BEGIN SELECT RAISE(ABORT, 'Betalingen kunnen niet worden verwijderd; markeer als vervallen.'); END;
CREATE TRIGGER pay_only_void BEFORE UPDATE ON payments
  WHEN NEW.amount_cents <> OLD.amount_cents OR NEW.pay_date <> OLD.pay_date OR NEW.direction <> OLD.direction
    OR NEW.kind <> OLD.kind OR IFNULL(NEW.sale_id,0) <> IFNULL(OLD.sale_id,0) OR IFNULL(NEW.po_id,0) <> IFNULL(OLD.po_id,0)
    OR IFNULL(NEW.expense_id,0) <> IFNULL(OLD.expense_id,0) OR IFNULL(NEW.entry_id,0) <> IFNULL(OLD.entry_id,0)
    OR (OLD.voided = 1 AND NEW.voided = 0)
BEGIN SELECT RAISE(ABORT, 'Een geregistreerde betaling kan alleen als vervallen worden gemarkeerd.'); END;
CREATE TRIGGER rcpt_no_delete BEFORE DELETE ON po_receipts BEGIN SELECT RAISE(ABORT, 'Ontvangsten kunnen niet worden verwijderd.'); END;
CREATE TRIGGER rcptl_no_delete BEFORE DELETE ON po_receipt_lines BEGIN SELECT RAISE(ABORT, 'Ontvangsten kunnen niet worden verwijderd.'); END;
CREATE TRIGGER ret_no_delete BEFORE DELETE ON sale_returns BEGIN SELECT RAISE(ABORT, 'Retouren kunnen niet worden verwijderd.'); END;
CREATE TRIGGER sales_no_delete BEFORE DELETE ON sales BEGIN SELECT RAISE(ABORT, 'Verkopen kunnen niet worden verwijderd; annuleer de verkoop.'); END;
CREATE TRIGGER expenses_no_delete BEFORE DELETE ON expenses BEGIN SELECT RAISE(ABORT, 'Uitgaven kunnen niet worden verwijderd; annuleer de uitgave.'); END;
CREATE TRIGGER sl_locked_update BEFORE UPDATE OF qty, unit_price_incl_cents, discount_cents, vat_rate_bp, gross_cents, net_cents, vat_cents, variant_id ON sale_lines
  WHEN (SELECT fulfillment_status FROM sales WHERE id = OLD.sale_id) <> 'unfulfilled'
BEGIN SELECT RAISE(ABORT, 'Regels van een uitgeleverde verkoop zijn vergrendeld.'); END;
