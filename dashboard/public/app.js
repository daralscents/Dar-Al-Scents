/* Kleine progressieve verbeteringen; alle formulieren werken ook zonder JavaScript. */
(function () {
  'use strict';
  // NL-bedrag → centen (alleen voor live voorbeeldberekeningen; de server rekent definitief).
  function cents(v) {
    var s = String(v || '').replace(/[€\s]/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = Number(s);
    return isFinite(n) ? Math.round(n * 100) : null;
  }
  function pctBp(v) { var s = String(v || '').replace('%', '').replace(',', '.').trim(); if (!s) return null; var n = Number(s); return isFinite(n) ? Math.round(n * 100) : null; }
  var fmt = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
  function eur(c) { return c == null ? '–' : fmt.format(c / 100); }

  document.addEventListener('DOMContentLoaded', function () {
    // Mobiel menu
    var tog = document.querySelector('[data-nav-toggle]');
    var side = document.getElementById('sidebar');
    if (tog && side) {
      tog.addEventListener('click', function () { var open = side.classList.toggle('open'); tog.setAttribute('aria-expanded', open ? 'true' : 'false'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) { side.classList.remove('open'); tog.setAttribute('aria-expanded', 'false'); tog.focus(); } });
    }
    // Periodekiezer
    document.querySelectorAll('input[data-autosubmit]').forEach(function (r) {
      r.addEventListener('change', function () {
        var form = r.form; var custom = form.querySelector('[data-custom-range]');
        form.querySelectorAll('.seg label').forEach(function (l) { l.classList.toggle('on', l.contains(r)); });
        if (r.value === 'custom') { if (custom) { custom.hidden = false; var i = custom.querySelector('input'); if (i) i.focus(); } }
        else form.submit();
      });
    });
    document.querySelectorAll('[data-autosubmit-file]').forEach(function (i) { i.addEventListener('change', function () { if (i.files.length) i.form.submit(); }); });

    // Bevestigingen en redenen
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-confirm]');
      if (b && !window.confirm(b.getAttribute('data-confirm'))) { e.preventDefault(); return; }
      var p = e.target.closest('[data-prompt-reason]');
      if (p) {
        var q = p.getAttribute('data-prompt-reason') || 'Reden';
        var ans = window.prompt(q + ':');
        if (ans === null || !ans.trim()) { e.preventDefault(); return; }
        var inp = p.form.querySelector('input[name="reason"]'); if (inp) inp.value = ans.trim();
      }
    });

    // Dubbel indienen voorkomen (de server is daarnaast idempotent).
    document.querySelectorAll('form[method="post"]').forEach(function (f) {
      f.addEventListener('submit', function () {
        setTimeout(function () { f.querySelectorAll('button[type="submit"]').forEach(function (b) { b.disabled = true; b.setAttribute('aria-busy', 'true'); }); }, 0);
      });
    });

    // Regels toevoegen/verwijderen
    document.querySelectorAll('[data-add-line]').forEach(function (btn) {
      var form = btn.closest('form');
      var tbody = form.querySelector('[data-lines] tbody');
      var tpl = form.querySelector('[data-line-template]');
      btn.addEventListener('click', function () {
        var idx = 'n' + Date.now() + Math.floor(Math.random() * 1000);
        var html = tpl.innerHTML.replace(/__i__/g, idx);
        var tmp = document.createElement('tbody'); tmp.innerHTML = html;
        var row = tmp.firstElementChild; tbody.appendChild(row);
        var first = row.querySelector('select, input:not([type=hidden])'); if (first) first.focus();
        wire(form);
      });
    });
    document.addEventListener('click', function (e) {
      var r = e.target.closest('[data-remove-line]');
      if (!r) return;
      var tr = r.closest('tr'); var form = r.closest('form');
      if (tr.parentNode.querySelectorAll('tr').length > 1) tr.remove();
      else tr.querySelectorAll('input:not([type=hidden]), select').forEach(function (i) { i.value = ''; });
      calc(form);
    });

    document.querySelectorAll('form[data-sale-form], form[data-po-form]').forEach(function (f) { wire(f); calc(f); });

    // Prijslijst: live marge
    document.querySelectorAll('[data-price-input], [data-vat-input]').forEach(function (el) { el.addEventListener('input', priceRow); el.addEventListener('change', priceRow); });
  });

  function priceRow(e) {
    var id = e.target.getAttribute('data-row');
    var p = document.querySelector('[data-price-input][data-row="' + id + '"]');
    var v = document.querySelector('[data-vat-input][data-row="' + id + '"]');
    var price = cents(p.value); var vat = pctBp(v ? v.value : '21') || 0;
    var excl = price == null ? null : Math.round(price * 10000 / (10000 + vat));
    var avg = p.getAttribute('data-avg') === '' ? null : Number(p.getAttribute('data-avg'));
    document.querySelector('[data-excl="' + id + '"]').textContent = eur(excl);
    var m = document.querySelector('[data-margin="' + id + '"]');
    if (avg == null || excl == null) m.textContent = '–';
    else { var prof = excl - avg; m.textContent = eur(prof) + ' (' + (excl > 0 ? (prof / excl * 100).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) : '–') + '%)'; m.className = prof < 0 ? 'neg' : ''; }
    p.closest('tr').classList.add('changed');
  }

  function wire(form) {
    form.querySelectorAll('[data-variant-select]').forEach(function (sel) {
      if (sel.dataset.wired) return; sel.dataset.wired = '1';
      sel.addEventListener('change', function () {
        var tr = sel.closest('tr');
        var price = tr.querySelector('[data-unit-price]'); var vat = tr.querySelector('[data-line-vat]');
        if (form.hasAttribute('data-sale-form')) {
          var o = sel.selectedOptions[0];
          if (o && o.dataset.price != null) { price.value = o.dataset.price; if (vat && !vat.value) vat.value = o.dataset.vat; }
        } else if (form.hasAttribute('data-po-form')) {
          fillPo(form, tr);
        }
        calc(form);
      });
    });
    form.querySelectorAll('[data-calc]').forEach(function (i) { if (i.dataset.wired) return; i.dataset.wired = '1'; i.addEventListener('input', function () { calc(form); }); });
    var sup = form.querySelector('[data-supplier-select]');
    if (sup && !sup.dataset.wired) { sup.dataset.wired = '1'; sup.addEventListener('change', function () { form.querySelectorAll('[data-lines] tbody tr').forEach(function (tr) { fillPo(form, tr, true); }); }); }
  }

  function fillPo(form, tr, onlyEmpty) {
    var map = {}; try { map = JSON.parse(form.getAttribute('data-supplier-prices') || '{}'); } catch (e) { /* leeg */ }
    var sup = form.querySelector('[data-supplier-select]').value;
    var sel = tr.querySelector('[data-variant-select]'); if (!sel) return;
    var hit = map[sup + ':' + sel.value]; if (!hit) return;
    var price = tr.querySelector('[data-unit-price]'); var vat = tr.querySelector('[data-line-vat]');
    if (!onlyEmpty || !price.value) price.value = hit.p;
    if (vat && hit.v != null) vat.value = hit.v;
    var cur = form.querySelector('[data-currency]'); if (cur && !cur.value) cur.value = hit.c;
  }

  function calc(form) {
    if (!form || !form.hasAttribute('data-sale-form')) return;
    var total = 0;
    form.querySelectorAll('[data-lines] tbody tr').forEach(function (tr) {
      var q = Number(tr.querySelector('input[name$="[qty]"]').value || 0);
      var sel = tr.querySelector('[data-variant-select]'); var o = sel && sel.selectedOptions[0];
      var pInput = tr.querySelector('[data-unit-price]');
      var unit = cents(pInput.value); if (unit == null && o && o.dataset.price) unit = cents(o.dataset.price);
      var d = tr.querySelector('input[name$="[discount]"]').value.trim(); var disc = 0;
      if (d.slice(-1) === '%') disc = Math.round((unit || 0) * q * (pctBp(d) || 0) / 10000); else disc = cents(d) || 0;
      var line = unit == null || !q ? null : unit * q - disc;
      var out = tr.querySelector('[data-line-total]'); if (out) out.textContent = eur(line);
      if (line) total += line;
      if (o && o.dataset.stock != null && q > Number(o.dataset.stock)) tr.classList.add('low'); else tr.classList.remove('low');
    });
    var ship = form.querySelector('[data-shipping]'); total += cents(ship && ship.value) || 0;
    var t = form.querySelector('[data-order-total]'); if (t) t.textContent = eur(total);
  }
})();
