// dom-filters: the 13 combo-grid-3 filters on the H1 dominant-zone limit, 2010-2019 (research/edge/dom-filters, pre-registered).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { buildZones } from '../research/edge/combo-grid-3/run.mjs';
import { context, filterFlags, welch, monthT, compare, evaluate, FILTERS, MARKETS, MID } from '../research/edge/dom-filters/run.mjs';

const DIR = new URL('../research/edge/dom-filters/', import.meta.url);
const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');

function walk(n, seed, t0 = Date.UTC(2015, 0, 5) / 1000) {          // seeded 5-minute candles, weekdays only
  const r = K.rng(seed), out = []; let px = 100, t = t0;
  while (out.length < n) { const wd = new Date(t * 1000).getUTCDay();
    if (wd !== 6 && wd !== 0) { const o = px, c = o + (r() - 0.5) * 0.4, h = Math.max(o, c) + r() * 0.15, l = Math.min(o, c) - r() * 0.15; out.push({ t, o, h, l, c, e: t + 300 }); px = c; }
    t += 300; }
  return out;
}

test('the filters read nothing after the touch: a series cut there gives the same 13 flags', () => {
  const M5 = walk(22000, 3), { F, ctx } = context(M5), Z = buildZones('dom', F['1h']), r = K.rng(9);
  let n = 0;
  for (let c = 0; c < 40; c++) {
    const i = 9000 + Math.floor(r() * 12000), ts = M5[i].t, z = [...Z].reverse().find((x) => x.at <= ts - 3600); if (!z) continue;
    const full = filterFlags(ctx, z, ts);
    const cut = context(M5.slice(0, i)).ctx;   // only candles that started before ts
    assert.deepEqual(filterFlags(cut, z, ts), full, 'cut at ' + ts); n++;
  }
  assert.ok(n >= 30);
  const f = filterFlags(ctx, Z[Z.length - 1], M5[M5.length - 1].t); assert.deepEqual(Object.keys(f), FILTERS);
});

test('statistics: Welch t, month-sum t, kept minus dropped', () => {
  const w = welch([1, 2, 3, 4], [0, 1, 2, 3]); assert.equal(w.diff, 1); assert.ok(Math.abs(w.t - 1.095) < 0.01);
  const rows = []; for (let m = 0; m < 12; m++) for (let k = 0; k < 4; k++) rows.push({ t: Date.UTC(2012, m, 2 + k) / 1000, trail: k % 2 ? 1 : -0.5 + m * 0.01, cr: 0.1, f: { x: k % 2 === 1 } });
  assert.ok(monthT(rows, 'trail', false) > 2);
  const c = compare(rows, 'x'); assert.equal(c.kept.n, 24); assert.equal(c.dropped.n, 24); assert.ok(c.diff > 1 && c.t > 10);
  assert.equal(compare(rows, 'x', 'trail', true).diff, c.diff, 'the same cost on both sides leaves the difference');
});

test('the pre-registered bar: both halves, Holm over 13', () => {
  const rows = [], r = K.rng(4);
  for (const t0 of [Date.UTC(2011, 0, 3) / 1000, MID + 86400 * 3]) for (let k = 0; k < 2000; k++) {
    const f = Object.fromEntries(FILTERS.map((x) => [x, r() < 0.5])), good = f.london;
    rows.push({ market: MARKETS[k % 5], t: t0 + k * 40000, trail: (r() - 0.5) * 2 + (good ? 0.3 : 0), '1R': 0, '2R': 0, '4R': 0, cr: 0.05, f }); }
  const E = evaluate(rows); assert.equal(E.tests.length, 13);
  assert.equal(E.tests.find((x) => x.filter === 'london').pass, true);
  assert.equal(E.passes, 1);
});

test('RESULT.md is pinned to result.json', () => {
  assert.equal(res.study, 'dom-filters'); assert.equal(res.tests.length, 13);
  assert.deepEqual(res.tests.map((x) => x.filter), FILTERS);
  assert.equal(res.passes, res.tests.filter((x) => x.pass).length);
  assert.equal(res.verdict, res.passes ? 'PASS' : 'FAIL');
  const line = md.split('\n')[2]; assert.match(line, new RegExp(`^\\*\\*Verdict: ${res.verdict}\\. `));
  assert.ok(line.includes(`n ${res.ref.all.n}`) && line.includes(String(res.ref.all.before)) && line.includes(String(res.ref.all.tBefore)));
  for (const x of res.tests) { const row = md.split('\n').find((l) => l.startsWith(`| ${x.filter} |`)); assert.ok(row, x.filter);
    for (const h of ['2010-14', '2015-19']) assert.ok(row.includes(String(x.halves[h].diff)) && row.includes(String(x.halves[h].t)), x.filter + ' ' + h);
    assert.ok(row.includes(String(x.holm))); }
});
