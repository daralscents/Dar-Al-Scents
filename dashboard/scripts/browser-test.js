'use strict';
// Browsertest van de belangrijkste gebruikersstromen (Playwright + Chromium).
//   npm run test:browser            → draait op een tijdelijke, lege database
//   SCREENSHOTS=map npm run test:browser  → bewaart schermafbeeldingen (desktop + mobiel)
// Je echte administratie wordt niet gebruikt.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { freshDb, admin, startServer } = require('../test/helpers');
const C = require('../src/services/common');

const shotDir = process.env.SCREENSHOTS ? path.resolve(process.env.SCREENSHOTS) : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const steps = [];

(async () => {
  const db = freshDb(); admin(db);
  const srv = await startServer(db);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/status of (401|422)/.test(m.text())) errors.push(m.text()); }); // 401/422 = bewust fout wachtwoord / validatie
  page.on('dialog', d => d.type() === 'prompt' ? d.accept('Testreden') : d.accept());
  const go = p => page.goto(srv.base + p);
  const shot = async name => { if (shotDir) await page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true }); };
  const submit = async sel => { await Promise.all([page.waitForLoadState('load'), page.click(sel)]); await page.waitForLoadState('load'); };
  const flashOk = async () => { const err = await page.locator('.flash-error, .field-error').allTextContents(); assert.deepEqual(err.filter(t => t.trim()), [], 'foutmelding op pagina: ' + err.join(' | ')); };
  const step = async (name, fn) => { const t = Date.now(); try { await fn(); steps.push(`✓ ${name} (${Date.now() - t} ms)`); } catch (e) { steps.push(`✗ ${name}: ${e.message}`); await shot('FOUT-' + name.replace(/\W+/g, '-')); throw e; } };

  try {
    await step('Inloggen (fout wachtwoord, daarna goed)', async () => {
      await go('/');
      assert.match(page.url(), /inloggen/);
      await page.fill('[name=email]', 'admin@test.nl'); await page.fill('[name=password]', 'verkeerd-wachtwoord');
      await submit('button[type=submit]');
      assert.match(await page.textContent('body'), /onjuist/i);
      await page.fill('[name=email]', 'admin@test.nl'); await page.fill('[name=password]', 'Test-wachtwoord-123');
      await submit('button[type=submit]');
      assert.equal(new URL(page.url()).pathname, '/');
      await shot('01-overzicht-leeg');
    });

    await step('Leverancier aanmaken', async () => {
      await go('/leveranciers/nieuw');
      await page.fill('[name=name]', 'Browser Aroma GmbH'); await page.fill('[name=country]', 'Duitsland'); await page.fill('[name=email]', 'inkoop@voorbeeld.test');
      await submit('form.form button[type=submit]'); await flashOk();
      assert.match(await page.textContent('h1'), /Browser Aroma/);
    });

    await step('Product met twee varianten aanmaken', async () => {
      await go('/producten/nieuw');
      await page.fill('[name=name]', 'Browser Oud');
      await page.selectOption('[name=category_id]', String(C.lookupId(db, 'product_category', 'Parfumflessen')));
      await page.fill('[name="variants[0][sku]"]', 'BR-100'); await page.fill('[name="variants[0][name]"]', '100 ml'); await page.fill('[name="variants[0][price_incl]"]', '59,95'); await page.fill('[name="variants[0][min_stock]"]', '2');
      await page.click('[data-add-line]');
      const row = page.locator('[data-lines] tbody tr').nth(1);
      await row.locator('input[name$="[sku]"]').fill('BR-S3'); await row.locator('input[name$="[name]"]').fill('Sample 3 ml'); await row.locator('input[name$="[price_incl]"]').fill('4,95');
      await submit('form.form button[type=submit]:not([data-add-line])'); await flashOk();
      assert.equal(db.get("SELECT COUNT(*) n FROM variants WHERE sku LIKE 'BR-%'").n, 2);
    });
    const big = db.get("SELECT id FROM variants WHERE sku = 'BR-100'").id;
    const small = db.get("SELECT id FROM variants WHERE sku = 'BR-S3'").id;
    const sup = db.get("SELECT id FROM suppliers WHERE name = 'Browser Aroma GmbH'").id;

    await step('Inkoopprijs koppelen aan leverancier', async () => {
      await go(`/producten/${db.get('SELECT product_id p FROM variants WHERE id = ?', [big]).p}`);
      const f = page.locator('form[action="/leverancier-artikelen"]');
      await page.locator('details:has(form[action="/leverancier-artikelen"]) summary').click();
      await f.locator('[name=supplier_id]').selectOption(String(sup));
      await f.locator('[name=variant_id]').selectOption(String(big));
      await f.locator('[name=price]').fill('22,50');
      await Promise.all([page.waitForLoadState('load'), f.locator('button[type=submit]').click()]); await flashOk();
      assert.equal(db.get('SELECT COUNT(*) n FROM supplier_items').n, 1);
    });

    await step('Beginvoorraad registreren', async () => {
      await go('/voorraad/beginvoorraad');
      await page.selectOption('[name=variant_id]', String(small));
      await page.fill('[name=qty]', '20'); await page.fill('[name=unit_cost]', '0,90');
      await submit('form.form button[type=submit]'); await flashOk();
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [small]).q, 20);
    });

    let poId;
    await step('Inkooporder: aanmaken, deels ontvangen, opnieuw ontvangen, betalen', async () => {
      await go('/inkoop/nieuw');
      await page.selectOption('[name=supplier_id]', String(sup));
      await page.selectOption('[name="lines[0][variant_id]"]', String(big));
      assert.equal(await page.inputValue('[name="lines[0][unit_price]"]'), '22,50', 'inkoopprijs van leverancier ingevuld');
      await page.fill('[name="lines[0][qty]"]', '10');
      await page.fill('[name=shipping]', '15,00');
      await page.check('[name=status][type=checkbox]');
      await submit('form.form button[type=submit]:not([data-add-line])'); await flashOk();
      poId = Number(/\/inkoop\/(\d+)/.exec(page.url())[1]);
      const lineId = db.get('SELECT id FROM purchase_order_lines WHERE po_id = ?', [poId]).id;
      const rf = page.locator(`form[action="/inkoop/${poId}/ontvangen"]`);
      await rf.locator(`[name="qty[${lineId}]"]`).fill('4');
      await Promise.all([page.waitForLoadState('load'), rf.locator('button[type=submit]').click()]); await flashOk();
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [big]).q, 4);
      assert.match(await page.textContent('main'), /gedeeltelijk ontvangen/i);
      await page.goBack(); await page.reload({ waitUntil: 'load' });
      await shot('02-inkooporder-deels');
      const rf2 = page.locator(`form[action="/inkoop/${poId}/ontvangen"]`);
      await rf2.locator(`[name="qty[${lineId}]"]`).fill('6');
      await Promise.all([page.waitForLoadState('load'), rf2.locator('button[type=submit]').click()]); await flashOk();
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [big]).q, 10);
      const pf = page.locator(`form[action="/inkoop/${poId}/betalen"]`);
      await pf.locator('[name=amount]').fill('100,00');
      await Promise.all([page.waitForLoadState('load'), pf.locator('button[type=submit]').click()]); await flashOk();
      assert.match(await page.textContent('main'), /gedeeltelijk betaald/i);
    });

    let saleId;
    await step('Verkoop invoeren met live totaal, uitleveren en betaald', async () => {
      await go('/verkopen/nieuw');
      await page.selectOption('[name=channel_id]', String(C.lookupId(db, 'sales_channel', 'Instagram')));
      await page.selectOption('[name="lines[0][variant_id]"]', String(big));
      await page.fill('[name="lines[0][qty]"]', '2');
      await page.fill('[name="lines[0][discount]"]', '10%');
      await page.fill('[name=shipping]', '4,95');
      const total = (await page.textContent('[data-order-total]')).replace(/\s/g, ' ');
      assert.match(total, /112,86/, 'live totaal 2 × 59,95 − 10% + 4,95');
      await page.check('[name=fulfill][type=checkbox]'); await page.check('[name=paid][type=checkbox]');
      await shot('03-verkoop-formulier');
      await submit('form.form button[type=submit]:not([data-add-line])'); await flashOk();
      saleId = Number(/\/verkopen\/(\d+)/.exec(page.url())[1]);
      const s = db.get('SELECT status, fulfillment_status FROM sales WHERE id = ?', [saleId]);
      assert.deepEqual({ ...s }, { status: 'completed', fulfillment_status: 'fulfilled' });
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [big]).q, 8);
    });

    await step('Dubbel indienen: terug + opnieuw versturen boekt niets dubbel', async () => {
      const n = db.get('SELECT COUNT(*) n FROM sales').n;
      await page.goBack(); await page.waitForLoadState('load');
      if (await page.locator('[name=idem]').count()) {
        await page.locator('form.form button[type=submit]:not([data-add-line])').evaluate(b => { b.disabled = false; });
        await submit('form.form button[type=submit]:not([data-add-line])');
        assert.match(await page.textContent('main'), /identieke verkoop/i, 'waarschuwing voor dubbele invoer');
        assert.equal(await page.locator('[name=confirm_duplicate]').count(), 1);
        await shot('03b-dubbele-invoer-waarschuwing');
      }
      assert.equal(db.get('SELECT COUNT(*) n FROM sales').n, n);
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [big]).q, 8);
    });

    await step('Retour + terugbetaling', async () => {
      await go(`/verkopen/${saleId}`);
      const lineId = db.get('SELECT id FROM sale_lines WHERE sale_id = ?', [saleId]).id;
      await page.locator('details:has(form[action$="/retour"]) summary').click();
      const rf = page.locator(`form[action="/verkopen/${saleId}/retour"]`);
      await rf.locator(`[name="qty[${lineId}]"]`).fill('1');
      await rf.locator('[name=reason]').fill('Geur bevalt niet');
      await Promise.all([page.waitForLoadState('load'), rf.locator('button[type=submit]').click()]); await flashOk();
      assert.equal(db.get('SELECT SUM(qty) q FROM stock_movements WHERE variant_id = ?', [big]).q, 9);
      const pf = page.locator(`form[action="/verkopen/${saleId}/betaling"]`);
      await Promise.all([page.waitForLoadState('load'), pf.locator('button[type=submit]').click()]); await flashOk();
      assert.equal(db.get("SELECT SUM(amount_cents) s FROM payments WHERE kind = 'refund'").s, 5396);
      await shot('04-verkoop-retour');
    });

    await step('Marketinguitgave met factuur (PDF) en campagne', async () => {
      db.insert('INSERT INTO campaigns(name, channel_id) VALUES (?, ?)', ['Browsertest campagne', C.lookupId(db, 'marketing_channel', 'Instagram')]);
      const pdf = path.join(db.dir, 'factuur.pdf'); fs.writeFileSync(pdf, '%PDF-1.4\n% testfactuur\n');
      await go('/uitgaven/nieuw');
      await page.selectOption('[name=category_id]', String(C.lookupId(db, 'expense_category', 'Marketing en advertenties')));
      await page.fill('[name=description]', 'Instagram-advertenties'); await page.fill('[name=payee]', 'Meta');
      await page.fill('[name=amount]', '50,00');
      await page.selectOption('[name=campaign_id]', { label: 'Browsertest campagne' });
      await page.setInputFiles('[name=file]', pdf);
      await page.check('[name=paid][type=checkbox]');
      await submit('form.form button[type=submit]'); await flashOk();
      assert.equal(db.get('SELECT COUNT(*) n FROM attachments').n, 1);
      await go('/marketing?periode=year');
      assert.match(await page.textContent('main'), /Browsertest campagne/);
      await shot('05-marketing');
    });

    await step('Prijswijziging in prijslijst laat oude verkoop ongewijzigd', async () => {
      await go('/producten/prijslijst');
      await page.fill(`[name="changes[${big}][price_incl]"]`, '64,95');
      await submit('form[action="/producten/prijslijst"] button[type=submit]'); await flashOk();
      assert.equal(db.get('SELECT price_incl_cents p FROM variants WHERE id = ?', [big]).p, 6495);
      assert.equal(db.get('SELECT unit_price_incl_cents p FROM sale_lines WHERE sale_id = ?', [saleId]).p, 5995);
    });

    await step('CSV-import van producten met preview', async () => {
      const csv = path.join(db.dir, 'producten.csv');
      fs.writeFileSync(csv, 'sku;product;variant;prijs;btw\nCSV-1;CSV Amber;50 ml;39,95;21\n');
      await go('/import');
      await page.setInputFiles('[name=file]', csv);
      await submit('form[action="/import"] button[type=submit]'); await flashOk();
      assert.match(await page.textContent('main'), /1 aanmaken|1<\/strong> aanmaken|aanmaken/);
      await submit('form[action$="/verwerken"] button[type=submit]'); await flashOk();
      assert.equal(db.get("SELECT COUNT(*) n FROM variants WHERE sku = 'CSV-1'").n, 1);
    });

    await step('Overzicht met KPI’s, uitsplitsing en CSV-export', async () => {
      await go('/?periode=year');
      await shot('06-overzicht');
      await page.click('a[href^="/overzicht/omzet"]');
      assert.match(await page.textContent('h1'), /omzet/i);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('a[href*="format=csv"]')]);
      assert.match(dl.suggestedFilename(), /\.csv$/);
      await go('/rapporten/btw?periode=year');
      await shot('07-rapport-btw');
    });

    await step('Mobiel: menu werkt en geen horizontale scroll', async () => {
      const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await m.addCookies(await ctx.cookies());
      const mp = await m.newPage();
      mp.on('pageerror', e => errors.push('mobiel: ' + e.message));
      for (const p of ['/?periode=year', '/verkopen', `/verkopen/${saleId}`, `/inkoop/${poId}`, '/voorraad', '/producten/prijslijst', '/rapporten/maandelijks?periode=year', '/verkopen/nieuw', '/inkoop/nieuw', '/uitgaven/nieuw', '/marketing', '/instellingen', '/import', '/voorraad/mutaties', '/producten/nieuw']) {
        await mp.goto(srv.base + p);
        // Vergelijk met de echte schermbreedte (390): een te brede layout vergroot innerWidth zelf.
        const r = await mp.evaluate(() => ({ w: Math.max(document.documentElement.scrollWidth, innerWidth), sticking: [...document.querySelectorAll('main *')].filter(e => !e.closest('.table-wrap, template, .sr-only') && e.getBoundingClientRect().right > 391).slice(0, 3).map(e => e.tagName + '.' + e.className) }));
        assert.ok(r.w <= 391, `${p}: pagina ${r.w}px breed op een scherm van 390px`);
        assert.deepEqual(r.sticking, [], `${p}: elementen buiten beeld`);
      }
      await mp.goto(srv.base + '/?periode=year');
      await mp.click('[data-nav-toggle]');
      assert.equal(await mp.getAttribute('[data-nav-toggle]', 'aria-expanded'), 'true');
      if (shotDir) await mp.screenshot({ path: path.join(shotDir, '08-mobiel-menu.png') });
      await mp.keyboard.press('Escape');
      await mp.goto(srv.base + `/verkopen/${saleId}`);
      if (shotDir) await mp.screenshot({ path: path.join(shotDir, '09-mobiel-verkoop.png'), fullPage: true });
      await m.close();
    });

    await step('Uitloggen', async () => {
      await go('/');
      await submit('form[action="/uitloggen"] button');
      await go('/verkopen');
      assert.match(page.url(), /inloggen/);
    });

    assert.deepEqual(errors, [], 'JavaScript-fouten in de browser: ' + errors.join(' | '));
    console.log(steps.join('\n'));
    console.log(`\nAlle ${steps.length} browserstappen geslaagd.`);
  } catch (e) {
    console.log(steps.join('\n'));
    console.error('\nBrowsertest MISLUKT:', e.message);
    if (errors.length) console.error('Browserfouten:', errors.join(' | '));
    process.exitCode = 1;
  } finally {
    await browser.close(); await srv.close(); db.close();
  }
})();
