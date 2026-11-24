// tests/h1-qm-h4-turn-m15-eg.test.mjs - the H1 quasimodo at an H4 turn level with the M15 engulf entry: the pre-registration,
// RESULT.md agrees with result.json, the verdict follows the bar, and on seeded candles the orders have their stop on the
// losing side and do not move when every later price changes; the limit walker on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames, turns, lastTurn, engulfAt, setups, walk, judge, verdictOf, cellStats, CELLS, MARKETS } from '../research/edge/h1-qm-h4-turn-m15-eg/run.mjs';

const DIR = new URL('../research/edge/h1-qm-h4-turn-m15-eg/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(n, seed, from = 0, base = null) { // a 5-minute random walk with volatility clusters; candles before `from` copied from base
  const r = K.rng(seed), out = []; let p = 1.2, vol = 0.0004;
  for (let i = 0; i < n; i++) {
    if (base && i < from) { out.push({ ...base[i] }); p = base[i].c; continue; }
    if (r() < 0.01) vol = 0.0002 + 0.0006 * r();
    const o = p, c = o + (r() - 0.5) * 2 * vol, h = Math.max(o, c) + r() * vol * 0.6, l = Math.min(o, c) - r() * vol * 0.6;
    out.push({ t: 1.2e9 + i * 300, o, h, l, c, e: 1.2e9 + (i + 1) * 300 }); p = c;
  }
  return out;
}
const key = (o) => [o.kind, o.s, o.t0, o.entry, o.stop, o.level].join('|');

test('pre-registration: the rule, the four cells, the windows, the after-cost bar', () => {
  for (const s of ['left shoulder', 'M15 engulf', 'eg 2R', 'eg 3R', 'now 2R', 'now 3R', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'n >= 300', 'Holm', 'AFTER costs', 'grid6-qm-keylevel', 'barrier-qm-janda', 'trendline-qm'])
    assert.ok(pre.includes(s), s);
  assert.deepEqual(CELLS, ['eg 2R', 'eg 3R', 'now 2R', 'now 3R']);
});

test('RESULT.md agrees with result.json and the verdict follows the bar', () => {
  const lines = md.split('\n');
  assert.equal(lines[2], `**Verdict: ${R.verdict}. ${R.headline[0].toUpperCase() + R.headline.slice(1)}.**`);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.deepEqual(R.markets, MARKETS); assert.equal(R.cells.length, 4);
  const eg = R.cells.filter((r) => r.cell.startsWith('eg'));
  const want = eg.some((r) => r.pass) ? 'PASS' : eg.every((r) => !(r.disc.n >= 300 && r.conf.n >= 300)) ? 'INCONCLUSIVE' : 'FAIL';
  assert.equal(R.verdict, want);
  for (const r of R.cells) {
    assert.equal(r.pass, r.disc.n >= 300 && r.conf.n >= 300 && r.disc.meanNet > 0 && r.disc.tNet >= 2 && r.conf.meanNet > 0 && r.conf.tNet >= 2 && r.holm < 0.05);
    if (r.conf.n) assert.ok(md.includes(`| ${r.cell} | ${Math.round(r.disc.n).toLocaleString('en-US')} | ${f3(r.disc.mean)} (${r.disc.t.toFixed(2)}) | ${f3(r.disc.meanNet)} (${r.disc.tNet.toFixed(2)}) | ${Math.round(r.conf.n).toLocaleString('en-US')} | ${f3(r.conf.mean)} (${r.conf.t.toFixed(2)}) | ${f3(r.conf.meanNet)} (${r.conf.tNet.toFixed(2)})`), r.cell);
    if (r.conf.n && r.conf.costR > 0) assert.ok(r.conf.meanNet < r.conf.mean, 'costs are charged');
  }
  const best = R.cells.find((r) => r.cell === R.best);
  assert.ok(R.headline.includes(`${f3(best.conf.meanNet)}R`) && R.headline.includes(`month t ${best.conf.tNet.toFixed(2)}`) && R.headline.includes(`n ${Math.round(best.conf.n).toLocaleString('en-US')}`));
  for (const c of R.cut) assert.equal(c.missing + c.extra, 0, 'cut test on real candles');
  assert.ok(!/\bedge\b/i.test(lines[2]));
});

test('seeded candles: orders exist, every stop is on the losing side, and nothing known by a cut moves when later prices change', () => {
  const n = 160000, cost = 0.00006, A = seeded(n, 11), SA = setups(frames(A), cost);
  assert.ok(SA.length >= 20, `${SA.length} orders`); assert.ok(SA.some((o) => o.kind === 0), 'engulf orders');
  for (const o of SA) { assert.ok(o.s * (o.entry - o.stop) > 0, 'stop on the losing side'); assert.ok(o.t0 >= o.ts && o.expire > o.t0);
    assert.ok(o.s * (o.level - (o.stop + o.s * cost / 2)) >= 0, 'the head reached the H4 level'); }
  for (const cutI of [50000, 90000, 130000]) {
    const T = A[cutI].t, B = seeded(n, 999, cutI, A), SB = setups(frames(B), cost);
    const a = SA.filter((o) => o.t0 <= T).map(key), b = SB.filter((o) => o.t0 <= T).map(key);
    assert.ok(a.length > 0); assert.deepEqual(b, a, `cut ${cutI}`);
    const C = setups(frames(A.slice(0, cutI)), cost).filter((o) => o.t0 <= T).map(key); assert.deepEqual(C, a, `truncated ${cutI}`);
  }
  // the walker reads nothing before the order time: a filled trade's fill is at or after t0
  for (const o of SA.slice(0, 40)) { const r = walk(A, o, cost); if (r && !r.open) { assert.ok(r.fillT >= o.t0 && r.fillT < o.expire); assert.ok(r.R.every((x) => x >= -1 - 1e-9 || r.risk > 0)); } }
});

test('H4 turns: known two candles later, broken by a close beyond, the last unbroken one is picked', () => {
  const cl = [1, 2, 3, 5, 4, 3, 2, 4.5, 3, 2.5, 6, 5, 4]; const H4 = cl.map((c, i) => ({ t: i * 14400, o: c, h: c + 0.2, l: c - 0.2, c, e: (i + 1) * 14400 }));
  const T = turns(H4); const pk = T[-1];
  assert.deepEqual(pk.map((x) => x.level), [5, 4.5, 6]);
  assert.equal(pk[0].known, 6 * 14400); assert.equal(pk[0].broken, 11 * 14400); assert.equal(pk[1].broken, 11 * 14400);
  assert.equal(lastTurn(pk, 10 * 14400, 10 * 14400).level, 4.5);
  assert.equal(lastTurn(pk, 10 * 14400, 11 * 14400), null, 'both broken by the close of the candle at 6');
  assert.equal(lastTurn(pk, 5 * 14400, 5 * 14400), null, 'not known yet');
});

test('M15 engulf at the shoulder: needs the touch, the close beyond the base, and no trade at the stop', () => {
  const mk = (rows) => rows.map(([o, h, l, c], i) => ({ t: 1000 * 900 + i * 900, o, h, l, c, e: 1000 * 900 + (i + 1) * 900 }));
  const ts = 1000 * 900, sh = 100, stop = 102;
  const ok = mk([[99, 99.5, 98.8, 99.2], [99.2, 100.3, 99.1, 100.1], [100.1, 100.2, 98.5, 98.7]]);
  assert.deepEqual(engulfAt(ok, -1, ts, sh, stop), { j: 2, t: ok[2].e });
  const noTouch = mk([[99, 99.5, 98.8, 99.2], [99.2, 99.9, 99.1, 99.8], [99.8, 99.85, 98.5, 98.7]]);
  assert.equal(engulfAt(noTouch, -1, ts, sh, stop), null);
  const noClose = mk([[99, 99.5, 98.8, 99.2], [99.2, 100.3, 99.1, 100.1], [100.1, 100.2, 99.0, 99.3]]);
  assert.equal(engulfAt(noClose, -1, ts, sh, stop), null);
  const voided = mk([[99, 99.5, 98.8, 99.2], [99.2, 102.1, 99.1, 100.1], [100.1, 100.2, 98.5, 98.7]]);
  assert.deepEqual(engulfAt(voided, -1, ts, sh, stop), { void: true });
  const buy = mk([[101, 101.2, 100.5, 100.8], [100.8, 100.9, 99.7, 99.9], [99.9, 101.5, 99.8, 101.3]]);
  assert.deepEqual(engulfAt(buy, 1, ts, 100, 98), { j: 2, t: buy[2].e });
});

test('the limit walker: trade-through fill, only the stop on the fill candle, stop first, gaps at the open, time exit', () => {
  const mk = (rows) => rows.map(([o, h, l, c], i) => ({ t: i * 300, o, h, l, c, e: (i + 1) * 300 }));
  const o = { s: -1, entry: 100, stop: 102, t0: 0, expire: 3600 }, cost = 0.2;
  assert.equal(walk(mk([[99, 100.05, 98.9, 99.5], [99.5, 99.8, 99, 99.2]]), o, cost), null, 'a touch is not a fill');
  let r = walk(mk([[99, 100.2, 93, 99.5], [99.5, 99.6, 95.9, 96], [96, 96.1, 93.9, 94]]), o, cost);
  assert.deepEqual(r.R, [2, 3]); assert.equal(r.fill, 100); assert.equal(r.risk, 2);
  r = walk(mk([[99, 102.5, 98, 99.5]]), o, cost); assert.deepEqual(r.R, [-1, -1], 'fill candle reaching the stop');
  r = walk(mk([[99, 100.2, 99, 99.5], [99.5, 102, 95, 96]]), o, cost); assert.deepEqual(r.R, [-1, -1], 'stop first');
  r = walk(mk([[99, 100.2, 99, 99.5], [103, 103.5, 102.5, 103]]), o, cost); assert.deepEqual(r.R, [-1.5, -1.5], 'gap past the stop exits at the open');
  r = walk(mk([[99, 100.2, 99, 99.5], [99.5, 99.6, 99.4, 99.5]]), o, cost); assert.ok(r.open, 'unresolved at the data end');
  r = walk(mk([[100.5, 100.6, 100.4, 100.5], [100.5, 100.6, 95.9, 96], [96, 96, 93, 93]]), o, cost); assert.equal(r.fill, 100.5); assert.deepEqual(r.R.map((x) => +x.toFixed(6)), [2, 3]);
  const tr = [[0, Date.UTC(2010, 0, 5) / 1000, 2, 3, 0.1], [0, Date.UTC(2020, 0, 5) / 1000, -1, -1, 0.1], [1, Date.UTC(2020, 0, 5) / 1000, 2, -1, 0.2]];
  const s = cellStats(tr, 0); assert.equal(s.d.n, 1); assert.equal(s.d.mean, 2); assert.equal(s.d.meanNet, 1.9); assert.equal(s.c.meanNet, -1.1);
  assert.equal(cellStats(tr, 3).c.meanNet, -1.2);
  const rows = judge(tr); assert.equal(rows.length, 4); assert.equal(verdictOf(rows), 'INCONCLUSIVE');
});
