// research/edge/gold-psar: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { psar, sarTrade, runSar, signals, smaAt, placeboTrade, baseline, monthSums, holm, toDays, TESTS, P } from '../research/edge/gold-psar/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
const next = (ds) => { let t = ds.length ? ds.at(-1).time + D : T0; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };
// a steady rise of `n` days from p, step s
function rise(ds, n, p, s) { for (let k = 0; k < n; k++) { const o = p + s * k; add(ds, o, o + s + 2, o - 1, o + s); } return ds; }

test('SAR by hand: seed, acceleration, clamp to the last two lows, flip to the old extreme', () => {
  const ds = [];
  add(ds, 100, 102, 99, 101); add(ds, 101, 104, 100, 103); // day 1 close up -> long, SAR(2) from low(0)=99, EP 104
  add(ds, 103, 106, 102, 105); // new high: EP 106, AF 0.04
  const { sar } = psar(ds, 0.02, 0.02, 0.2);
  // SAR(2) = 99 + 0.02 x (104 - 99) = 99.1, clamped by lows 100 and 99 -> 99
  assert.equal(sar[2], 99);
  // SAR(3) = 99 + 0.04 x (106 - 99) = 99.28, clamp min(102, 100) -> 99.28
  assert.ok(Math.abs(psar([...ds, { time: 0, open: 105, high: 107, low: 104, close: 106 }], 0.02, 0.02, 0.2).sar[3] - 99.28) < 1e-9);
  const d2 = [...ds]; add(d2, 105, 105.5, 95, 96); // day 3 low under the SAR -> flip short, new SAR = old EP 106
  const r = psar(d2, 0.02, 0.02, 0.2);
  assert.equal(r.flip[3], -1);
  add(d2, 96, 97, 94, 95);
  const r2 = psar(d2, 0.02, 0.02, 0.2);
  // SAR(4) = 106 + 0.02 x (95 - 106) = 105.78, clamped to at least the highs of days 3 and 2 (105.5, 106) -> 106
  assert.equal(r2.sar[4], 106);
});

test('no look-ahead: SAR and flips up to a day do not change with later days; the 200-day average uses closes to i', () => {
  const ds = rise([], 40, 1000, 3); add(ds, 1120, 1121, 1050, 1060);
  const k = ds.length - 1, a = psar(ds, 0.02, 0.02, 0.2);
  add(ds, 1060, 5000, 1, 4000); add(ds, 4000, 4001, 3, 10);
  const b = psar(ds, 0.02, 0.02, 0.2);
  assert.deepEqual(b.sar.slice(0, k + 1), a.sar.slice(0, k + 1)); assert.deepEqual(b.flip.slice(0, k + 1), a.flip.slice(0, k + 1));
  assert.equal(smaAt(ds, 5, 10), null); assert.equal(smaAt(ds, 9, 10), ds.slice(0, 10).reduce((s, x) => s + x.close, 0) / 10);
});

test('a SAR trade: entry next open, the first stop is that day SAR, the stop trails, financing on buys only', () => {
  const ds = rise([], 30, 1000, 3);
  const flipDay = add(ds, 1090, 1091, 1040, 1045); // a deep fall: flip to short
  const { sar, flip } = psar(ds, 0.02, 0.02, 0.2);
  assert.equal(flip[flipDay], -1);
  for (let k = 0; k < 6; k++) add(ds, 1045 - 5 * k, 1046 - 5 * k, 1038 - 5 * k, 1040 - 5 * k);
  add(ds, 1015, 1100, 1014, 1095); // rallies through any SAR -> exit at the SAR
  const r = psar(ds, 0.02, 0.02, 0.2);
  const tr = sarTrade(ds, r.sar, flipDay, -1);
  assert.equal(tr.entry, 1045); assert.equal(tr.stop0, r.sar[flipDay + 1]); assert.ok(tr.risk > 10);
  assert.equal(tr.why, 'sar'); assert.equal(tr.xi, ds.length - 1); assert.equal(tr.exit, r.sar[ds.length - 1]);
  assert.ok(r.sar[ds.length - 1] < r.sar[flipDay + 1]); // the stop moved down with the trade
  assert.equal(tr.finR, 0); assert.ok(Math.abs(tr.costR - P.cost / tr.risk) < 1e-12);
  assert.ok(Math.abs(tr.net - (tr.R - tr.costR)) < 1e-12);
  // the same entry as a buy pays financing
  const lg = rise([], 80, 1000, 0.1), fake = new Array(lg.length).fill(900);
  const b = sarTrade(lg, fake, 5, 1);
  const nn = nights(lg[6].time, lg[b.xi].time + D);
  assert.equal(b.why, 'time'); assert.equal(b.held, P.maxHold); assert.equal(b.nights, nn);
  assert.ok(Math.abs(b.finR - nn * FIN.xau.long * lg[6].open / b.risk) < 1e-12);
  const x2 = sarTrade(lg, fake, 5, 1, 2); assert.ok(Math.abs(x2.finR - 2 * b.finR) < 1e-12);
  // an entry on the wrong side of its first stop is skipped; still open at the data end -> null
  const bad = r.sar.slice(); bad[flipDay + 1] = 1050; assert.equal(sarTrade(ds, bad, flipDay, 1), null);
  assert.equal(sarTrade(ds.slice(0, flipDay + 3), psar(ds.slice(0, flipDay + 3), 0.02, 0.02, 0.2).sar, flipDay, -1), null);
});

test('a gap through the SAR fills at the open; one position at a time; T3 keeps flips on the 200-day side only', () => {
  const ds = rise([], 30, 1000, 3);
  const f = add(ds, 1090, 1091, 1040, 1045); add(ds, 1045, 1046, 1040, 1042); add(ds, 1200, 1210, 1190, 1205);
  const { sar } = psar(ds, 0.02, 0.02, 0.2);
  const tr = sarTrade(ds, sar, f, -1); assert.equal(tr.why, 'gap'); assert.equal(tr.exit, 1200);
  const T = runSar(ds, sar, [{ i: f, side: -1 }, { i: f + 1, side: 1 }]);
  assert.equal(T.length, 1);
  const up = rise([], 210, 1000, 1); up.push({ ...up.at(-1), time: next(up) });
  const fl = new Array(up.length).fill(0); fl[205] = 1; fl[206] = -1;
  assert.deepEqual(signals(up, fl, true), [{ i: 205, side: 1 }]);
  assert.deepEqual(signals(up, fl, false).map((s) => s.side), [1, -1]);
});

test('placebo trade keeps entry, risk and exit day; baseline; month sums; Holm; weekend fold; parameters', () => {
  const ds = rise([], 20, 1000, 1);
  const x = { ei: 5, xi: 9, risk: 50 };
  const pb = placeboTrade(ds, x, 1); assert.equal(pb.why, 'exit'); assert.equal(pb.exit, ds[9].open); assert.equal(pb.entry, ds[5].open);
  const ps = placeboTrade(ds, { ei: 5, xi: 9, risk: 2 }, -1); assert.equal(ps.why, 'stop'); assert.equal(ps.exit, ds[5].open + 2);
  const bl = baseline(rise([], 60, 1000, 1), 1); assert.ok(bl.length > 0 && bl.every((t) => t.held <= P.baseHold));
  assert.deepEqual(monthSums([{ d: '2024-01-05', net: 1 }, { d: '2024-03-02', net: -2 }], '2024-01-01', '2024-04-30'), [1, 0, -2, 0]);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  assert.equal(toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]).length, 2);
  assert.equal(P.cost, 0.60); assert.equal(P.seeds, 40); assert.equal(P.maxHold, 60); assert.equal(P.smaN, 200);
  assert.deepEqual(TESTS.map((t) => [t.af, t.sma]), [[[0.02, 0.02, 0.2], false], [[0.01, 0.01, 0.1], false], [[0.02, 0.02, 0.2], true]]);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-psar/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-psar/RESULT.md', import.meta.url), 'utf8');
  const vl = md.split('\n').find((l) => l.startsWith('**Verdict:'));
  assert.ok(vl.startsWith(`**Verdict: ${r.verdict}:`)); assert.ok(vl.length < 220);
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const id of ['T1', 'T2', 'T3']) {
    const g = r.gold.tests[id], c = r.gold.checks[id], row = md.split('\n').find((l) => l.startsWith(`| ${id} `));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1), [String(g.is.n), f(g.isGross.mean), f(g.is.mean), g.is.monthT.toFixed(2), String(g.oos.n), f(g.oosGross.mean), f(g.oos.mean), g.oos.monthT.toFixed(2), c.holmP.toFixed(4), f(g.oos2x.mean), f(g.half1.mean), f(g.half2.mean), `${g.placebo.beaten} of 40`, c.pass ? 'yes' : 'no']);
  }
  assert.equal(r.verdict, r.gold.checks.T1.pass ? 'PASS' : 'FAIL');
  assert.ok(md.includes(`${r.gold.data.days.toLocaleString('en-US')} trading days`));
  assert.ok(md.includes(`Median stop $${r.gold.tests.T1.stopUsd.median.toFixed(2)}`));
  assert.ok(r.gold.tests.T1.stopUsd.median >= 10);
  assert.ok(md.includes('Item 44'));
});
