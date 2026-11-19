// stock-bond-corr study: the rule on hand-made data, no look-ahead, and the report against result.json. Offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { corr, join, monthEnds, months, netReturns, holm, sharpe, maxDD, rateFn, spells, SIDE_COST, LOOK } from '../research/edge/stock-bond-corr/run.mjs';
import { headlineOf, classify } from '../research/edge/verdict.mjs';

const dir = new URL('../research/edge/stock-bond-corr/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', dir)));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

// weekday dates from 2020-01-01
function dates(n) { const out = []; let t = Date.parse('2020-01-01'); while (out.length < n) { const d = new Date(t); if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); t += 864e5; } return out; }

test('correlation and join', () => {
  assert.ok(Math.abs(corr([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12);
  assert.ok(Math.abs(corr([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12);
  const j = join([{ d: 'a', c: 1 }, { d: 'b', c: 2 }, { d: 'c', c: 3 }], [{ d: 'b', c: 9 }, { d: 'c', c: 8 }]);
  assert.deepEqual(j, [{ d: 'b', a: 2, b: 9 }, { d: 'c', a: 3, b: 8 }]);
});

test('the signal: negative correlation → long next month, positive → flat', () => {
  const ds = dates(400); let a = 100, b = 100; const j = [];
  for (let i = 0; i < ds.length; i++) {
    const m = Number(ds[i].slice(5, 7)), s = Math.sin(i * 1.7) * 0.01;
    a *= 1 + s; b *= 1 + (m <= 6 ? -s : s);        // first half of the year: opposite moves; second half: together
    j.push({ d: ds[i], a, b });
  }
  const ends = monthEnds(j), rows = months(ends, rateFn([]));
  const by = Object.fromEntries(rows.map((r) => [r.from.slice(0, 7), r.on]));
  assert.equal(by['2020-05'], true);                 // the 60 days to end May are all opposite moves
  assert.equal(by['2020-11'], false);                // to end November all together
  for (const r of rows) assert.ok(r.fin > 0 && r.fin < 0.01);
});

test('no look-ahead: changing every price after a month end leaves its correlation unchanged', () => {
  const ds = dates(300); const j = ds.map((d, i) => ({ d, a: 100 + Math.sin(i) * 3 + i * 0.1, b: 100 + Math.cos(i * 0.7) * 2 }));
  const e1 = monthEnds(j), k = 7, cut = e1[k].i;
  const j2 = j.map((x, i) => (i > cut ? { ...x, a: x.a * 1.5 + 7, b: x.b * 0.3 } : x));
  const e2 = monthEnds(j2);
  for (let q = 0; q <= k; q++) assert.equal(e2[q].rho, e1[q].rho);
  assert.equal(e1.find((e) => e.i >= LOOK).rho != null, true);
});

test('costs: one side at each switch, financing only while long; switches counted', () => {
  const rows = [{ r: 0.01, fin: 0.004 }, { r: 0.02, fin: 0.004 }, { r: -0.03, fin: 0.004 }, { r: 0.01, fin: 0.004 }];
  const { rets, switches } = netReturns(rows, [true, false, false, true]);
  assert.ok(Math.abs(rets[0] - (0.01 - 0.004 - SIDE_COST)) < 1e-12);
  assert.ok(Math.abs(rets[1] - (-SIDE_COST)) < 1e-12);
  assert.equal(rets[2], 0);
  assert.equal(switches, 2);
  assert.deepEqual(netReturns(rows, [true, true, true, true], { gross: true }).rets, [0.01, 0.02, -0.03, 0.01]);
  assert.equal(spells([true, false, false, true]), 3);
  assert.ok(Math.abs(maxDD([0.1, -0.5, 0.2]) + 0.5) < 1e-12);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(sharpe([0.01, 0.02, 0.0, 0.01]) > 0);
});

test('the report says what result.json says', () => {
  assert.equal(res.verdict, 'FAIL');
  assert.equal(res.passed, 0);
  assert.deepEqual(res.tests.map((t) => t.market), ['spx500', 'nas100', 'us30']);
  const h = headlineOf(md);
  assert.equal(classify(h), 'fail');
  assert.ok(h.length <= 220, h);
  const f = (x, d) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d);
  for (const t of res.tests) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${t.id} ${t.market}`));
    assert.ok(row, t.id);
    assert.ok(row.includes(f(t.diffOOS, 3).replace('+', '')), `${t.id} diff`);
    assert.ok(row.includes(f(t.tOOS, 2).replace('+', '')), `${t.id} t`);
    assert.ok(row.includes(`${f(t.diffIS, 3)}, ${t.tIS.toFixed(2)}`), `${t.id} IS`);
    assert.ok(row.includes(f(t.diffOOS2x, 3)), `${t.id} 2x`);
    assert.ok(row.includes(`/ ${t.switchesOOS} `), `${t.id} switches`);
    assert.equal(t.pass, false);
    const p = res.markets[t.market].placebo;
    assert.ok(md.includes(`${p.atLeastReal} of 40`), `${t.id} placebo`);
  }
});
