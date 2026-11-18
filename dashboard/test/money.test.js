'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/money');
const { parseCsv, toCsv } = require('../src/csv');

test('bedragen invoeren in NL- en internationaal formaat → centen', () => {
  assert.equal(M.parseMoney('12,34'), 1234);
  assert.equal(M.parseMoney('€ 1.234,56'), 123456);
  assert.equal(M.parseMoney('1234.56'), 123456);
  assert.equal(M.parseMoney('1.234'), 123400);
  assert.equal(M.parseMoney('0,1'), 10);
  assert.equal(M.parseMoney(''), null);
  assert.throws(() => M.parseMoney('-5'), M.ValidationError);
  assert.throws(() => M.parseMoney('12,345'), M.ValidationError);
  assert.throws(() => M.parseMoney('abc'), M.ValidationError);
  assert.throws(() => M.parseMoney('', { required: true }), M.ValidationError);
});

test('btw-berekeningen zijn exact in centen en tellen sluitend op', () => {
  assert.equal(M.netFromGross(12100, 2100), 10000);
  assert.equal(M.vatFromNet(10000, 2100), 2100);
  for (const gross of [1, 99, 495, 1595, 7995, 123457]) {
    for (const bp of [0, 900, 2100]) {
      const { net, vat } = M.splitGross(gross, bp);
      assert.equal(net + vat, gross, `${gross} @ ${bp}`);
      assert.ok(Number.isInteger(net) && Number.isInteger(vat));
    }
  }
  assert.equal(M.divRound(5, 2), 3);
  assert.equal(M.divRound(-5, 2), -3);
});

test('verdelen van extra kosten: som klopt altijd, grootste-rest-methode', () => {
  assert.deepEqual(M.allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(M.allocate(1000, [0, 0]), [500, 500]);
  const parts = M.allocate(2495, [2940, 2100, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 2495);
  assert.deepEqual(M.allocate(0, [3, 4]), [0, 0]);
});

test('wisselkoers en percentages', () => {
  assert.equal(M.parseFx('0,2510'), 251000);
  assert.equal(M.toEur(9500, 251000), 2385);
  assert.equal(M.parsePercent('21'), 2100);
  assert.equal(M.parsePercent('9,5%'), 950);
  assert.throws(() => M.parsePercent('150'), M.ValidationError);
});

test('Nederlandse opmaak en datums', () => {
  assert.equal(M.formatMoney(123456).replace(/\s/g, ' '), '€ 1.234,56');
  assert.equal(M.formatDate('2026-11-18'), '18-11-2026');
  assert.equal(M.parseDate('18-11-2026'), '2026-11-18');
  assert.equal(M.parseDate('2026-11-18'), '2026-11-18');
  assert.throws(() => M.parseDate('31-02-2026'), M.ValidationError);
  assert.equal(M.centsToInput(1050), '10,50');
  const p = M.periodRange('month', { today: '2026-11-18' });
  assert.equal(p.from, '2026-11-01'); assert.equal(p.to, '2026-11-30');
});

test('CSV: scheidingsteken herkennen, aanhalingstekens, formule-injectie geblokkeerd', () => {
  const p = parseCsv('a;b\n"x;y";"z ""q"""\n');
  assert.equal(p.delimiter, ';');
  assert.equal(p.records[0].a, 'x;y'); assert.equal(p.records[0].b, 'z "q"');
  assert.equal(parseCsv('a,b\n1,2').delimiter, ',');
  const out = toCsv([{ key: 'k', label: 'K' }], [{ k: '=SUM(A1)' }]);
  assert.ok(out.includes("'=SUM(A1)"));
});

test('formulierparser behoudt regel-id’s als sleutel en negeert prototype-sleutels', () => {
  const { parseForm } = require('../src/formparser');
  const b = parseForm('qty[5]=1&qty[120]=2&lines[0][qty]=1&lines[n9][qty]=3&vat_recoverable=0&vat_recoverable=1&__proto__[x]=1&name=Jan+%26+Co');
  assert.deepEqual({ ...b.qty }, { 5: '1', 120: '2' });
  assert.deepEqual(Object.keys(b.lines), ['0', 'n9']);
  assert.deepEqual(b.vat_recoverable, ['0', '1']);
  assert.equal(b.name, 'Jan & Co');
  assert.equal({}.x, undefined);
});
