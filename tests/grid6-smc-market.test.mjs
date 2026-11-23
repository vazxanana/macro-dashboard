// tests/grid6-smc-market.test.mjs - grid 6 (research/edge/grid6-smc-market): the cell count, the pieces on hand-made candles,
// no look-ahead on seeded candles, the bar on a hand-made accumulator, and RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NCELL, NVALID, NM, IS_M, MONTHS, MARKETS, cellIndex, cellName, valid, confirmations, lim50Of, gapZones, sessionOf,
  tradesOf, accumulator, bar } from '../research/edge/grid6-smc-market/run.mjs';

const DIR = new URL('../research/edge/grid6-smc-market/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const bar0 = (t, o, h, l, c, sec = 900) => ({ t, o, h, l, c, e: t + sec });

test('16,800 valid cells a scope, 120 months split 60 / 60, names round-trip', () => {
  assert.equal(NCELL, 5 * 4 * 6 * 2 * 4 * 2 * 2 * 5); assert.equal(NVALID, 16800);
  assert.equal(NM, 120); assert.equal(IS_M, 60); assert.equal(MONTHS[IS_M], Date.UTC(2015, 0, 1) / 1000);
  const k = cellIndex(2, 1, 3, 1, 1, 0, 1, 4);
  assert.deepEqual(cellName(k), { poi: 'fvg4', liq: 'pd', conf: 'm5choch', pd: 'with', sess: 'lon', entry: 'mkt', stop: 'sweep', exit: 'trail' });
  assert.equal(valid(cellIndex(0, 0, 0, 0, 0, 0, 1, 0)), false); // no sweep stop without a sweep
});

test('pieces on hand-made candles: an inverse gap, a displacement, the 50 % limit, a gap zone, the session', () => {
  const t0 = Date.UTC(2014, 2, 3) / 1000; const C = [];
  for (let i = 0; i < 20; i++) C.push(bar0(t0 + i * 900, 1.10, 1.1005, 1.0995, 1.10));
  // a down gap: candle 20 high under candle 18 low
  C.push(bar0(t0 + 20 * 900, 1.0995, 1.0996, 1.0985, 1.0986)); C.push(bar0(t0 + 21 * 900, 1.0986, 1.0987, 1.0975, 1.0976));
  C.push(bar0(t0 + 22 * 900, 1.0976, 1.0980, 1.0970, 1.0978));
  // then a big up candle closing above candle 20's low... above the gap's top (candle 20 low = 1.0985)
  C.push(bar0(t0 + 23 * 900, 1.0978, 1.1020, 1.0977, 1.1018));
  const ev = confirmations(C);
  assert.ok(ev.some((e) => e.kind === 1 && e.s === 1 && e.j === 23), 'inverse gap buy at the close above the gap');
  assert.ok(ev.some((e) => e.kind === 2 && e.s === 1 && e.j === 23), 'displacement buy');
  // an up gap inside the last candles: low[k] > high[k-2]; limit at its 50 % below the close
  const D = [bar0(t0, 1, 1.01, 0.99, 1.0), bar0(t0 + 900, 1.0, 1.03, 1.0, 1.03), bar0(t0 + 1800, 1.03, 1.05, 1.02, 1.045), bar0(t0 + 2700, 1.045, 1.06, 1.04, 1.055)];
  assert.equal(lim50Of(D, 3, 1), (1.03 + 1.04) / 2); // the most recent gap (candles 1-3), not the older one (0-2)
  assert.equal(lim50Of(D, 3, -1), null);
  const Z = gapZones(D); assert.equal(Z[0].d, 1); assert.equal(Z[0].bot, 1.01); assert.equal(Z[0].top, 1.02);
  assert.equal(sessionOf(Date.UTC(2014, 2, 3, 8) / 1000), 1); assert.equal(sessionOf(Date.UTC(2014, 2, 3, 13) / 1000), 2); assert.equal(sessionOf(Date.UTC(2014, 2, 3, 20) / 1000), 3);
});

function seeded(n, seed = 5) {
  let a = seed, px = 1.2; const out = []; const t0 = Date.UTC(2014, 5, 2) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0016);
    const h = Math.max(o, px) + Math.abs(r) * 0.0006, l = Math.min(o, px) - Math.abs(r) * 0.0006; const t = t0 + i * 300;
    if (new Date(t * 1000).getUTCDay() === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
test('no look-ahead: trades on cut candles equal the full run; every stop on the losing side', () => {
  const M5 = seeded(36000), cut = M5[30000].t, start = M5[14000].t;
  const row = (tr) => JSON.stringify([tr.conf, tr.s, tr.tc, tr.entry, tr.stopKind, tr.liq, tr.poi, tr.sess, tr.pdOk, tr.swept, tr.t, tr.R, tr.pl]);
  const part = M5.filter((x) => x.t < cut), lastE = part[part.length - 1].e, safe = (tr) => tr.tc + 12 * 900 + 86400 + 3600 < lastE;
  const A = [], B = []; let n = 0;
  tradesOf(M5, 'eurusd', { start, end: cut, sink: (tr) => { n++; if (safe(tr)) A.push(row(tr)); } });
  tradesOf(part, 'eurusd', { start, end: cut, sink: (tr) => { if (safe(tr)) B.push(row(tr)); } });
  assert.ok(A.length > 50, 'enough trades to compare: ' + A.length);
  assert.deepEqual(B.sort(), A.sort());
  // the stop is on the losing side of every order (the run throws otherwise) and every real result is finite or a missing opp
  tradesOf(M5, 'eurusd', { start, end: cut, sink: (tr) => { if (tr.R) for (let x = 0; x < 5; x++) assert.ok(Number.isFinite(tr.R[x]) || x === 3); } });
  assert.ok(n > 0);
});

test('the bar: a cell positive in both halves passes, a flat one does not; placebo arrays are read apart', () => {
  const A = accumulator(), good = cellIndex(0, 0, 0, 0, 0, 0, 0, 1);
  for (let m = 0; m < NM; m++) for (let k = 0; k < 4; k++) {
    const t = MONTHS[m] + 86400 * (1 + k), R = (k % 2 ? 1 : -1) + 0.4 + 0.01 * (m % 3);
    A.add({ conf: 0, s: 1, tc: t, poi: [0], sess: 1, pdOk: false, swept: {}, entry: 0, stopKind: 0, liq: 0, t, cr: 0.01, R: [k % 2 ? 1 : -1, R, -1, NaN, 0], pl: null });
  }
  const PM = {}; for (const m of MARKETS) PM[m] = m === 'xau' ? A : accumulator();
  const B = bar(PM, 'before'), keys = B.confirmedList.map((x) => `${x.scope} ${x.poi} ${x.conf} ${x.sess} ${x.exit}`);
  assert.ok(keys.includes('pool ob4 m15choch any 2R') && keys.includes('xau ob4 m15choch lon 2R'));
  assert.ok(!keys.some((k) => k.endsWith(' 1R')), 'the flat 1R exit fails');
  assert.ok(B.confirmedList.every((x) => x.exit === '2R'));
  assert.equal(bar(PM, 'before', 'p').discovery, 0);
  assert.ok(A.n[good * 2] > 0 && A.n[good * 2 + 1] > 0);
});

test('RESULT.md is pinned to result.json', () => {
  assert.equal(R.verdict, 'FAIL');
  assert.ok(MD.split('\n')[2].startsWith('**Verdict: FAIL.'));
  const fmt = (n) => n.toLocaleString('en-US');
  for (const [b, label] of [[R.before, 'Real, before costs'], [R.after, 'Real, after costs'], [R.placeboBefore, 'Side-flipped placebo, before costs'], [R.placeboAfter, 'Side-flipped placebo, after costs']]) {
    const line = MD.split('\n').find((l) => l.startsWith('| ' + label + ' |'));
    assert.ok(line, label);
    const cells = line.split('|').map((x) => x.trim().replace(/\*/g, ''));
    assert.deepEqual(cells.slice(2, 8), [fmt(b.withN100), fmt(b.discovery), fmt(b.discoveryWithConf), fmt(b.rawConfirmed), String(b.expectedByChance), fmt(b.holmConfirmed)]);
  }
  const top = R.before.topConfirmationT[0];
  assert.equal(top.poi, 'fvg4'); assert.equal(top.conf, 'm5choch'); assert.equal(top.sess, 'lon'); assert.equal(top.exit, 'trail');
  assert.ok(MD.includes(`n ${fmt(top.oosN)}, month t ${top.oosT}, Holm p ${+top.holm.toFixed(2)}`));
  assert.ok(MD.includes(`+${top.oosMean.toFixed(3)}R a trade`));
  assert.ok(R.cuts.length === 5 && R.cuts.every((c) => c.ok && c.diff === 0));
  for (const c of R.cuts) assert.ok(MD.includes(`${c.market} ${fmt(c.fullTrades)}`), c.market);
  assert.ok(R.headline.startsWith('FAIL'));
});
