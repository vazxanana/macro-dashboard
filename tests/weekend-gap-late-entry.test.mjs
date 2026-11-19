// research/edge/weekend-gap-late-entry: Rule G of fx-weekend-gap (#880) frozen, entered later. Offline: the frozen file's
// hash, the late-entry wrapper on hand-made candles (filled / stopped / small / late, the stop level kept, delay 0 = ruleG),
// the added entry spread, Holm, the bar, the candle join, and RESULT.md against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { FROZEN_SHA256, lateTrade, holmAdj, bar, join, ENTRY, SPREAD, ALL, withSpread } from '../research/edge/weekend-gap-late-entry/run.mjs';
import { ruleG, costPx, K } from '../research/edge/weekend-gap-late-entry/frozen.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'weekend-gap-late-entry');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

test('frozen.mjs is #880\'s run.mjs byte for byte (pinned sha256)', () => {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, 'frozen.mjs'))).digest('hex');
  assert.equal(h, FROZEN_SHA256);
  assert.equal(FROZEN_SHA256, '3dfd1dd71f1c1bb2512c5ee0f26573bcb38944f152634ccd622efc1b7002b273');
});

// a hand-made weekend on EUR/USD: Friday's close 1.1000, the reopen gaps down to 1.0950 and its candle closes at 1.0955, so
// Rule G buys at 1.0955, target 1.1000, stop 1.0910 (risk 45 pips). ATR 0.0100 (the 0.1 x ATR floor is 10 pips).
const t0 = 1_700_000_000 - (1_700_000_000 % 300);
function week(path5) { // path5: [o, h, l, c] per candle from the reopen candle on
  const M5 = path5.map(([o, h, l, c], i) => ({ time: t0 + i * 300, open: o, high: h, low: l, close: c }));
  const w = { F: t0 - 48 * 3600, fri: '2023-11-10', iR: 0, fc: 1.1, ro: path5[0][0], atr: 0.01, noon: t0 + 19 * 3600, gapAtr: 0.5 };
  return { M5, w, g: ruleG('eurusd', M5, w) };
}
const flat = (px, n) => Array.from({ length: n }, () => [px, px + 0.0002, px - 0.0002, px]);

test('Rule G\'s trade on the hand-made weekend', () => {
  const { g } = week([[1.095, 1.0958, 1.0948, 1.0955], ...flat(1.096, 30)]);
  assert.equal(g.side, 1); assert.equal(g.entry, 1.0955); assert.equal(g.target, 1.1);
  assert.ok(Math.abs(g.stop - 1.091) < 1e-12);
});

test('delay 0 is Rule G\'s own trade', () => {
  const { M5, w, g } = week([[1.095, 1.0958, 1.0948, 1.0955], ...flat(1.096, 12), [1.096, 1.1005, 1.0958, 1.0999], ...flat(1.0999, 5)]);
  const t = lateTrade('eurusd', M5, w, g, 0);
  for (const k of ['side', 'entry', 'r0', 'exitPx', 'exit', 'R', 'filled']) assert.equal(t[k], g[k], k);
  assert.equal(t.exit, 'target'); assert.equal(t.R, 1);
});

test('late entry keeps the target and Rule G\'s stop level; risk is measured from the new entry', () => {
  // 12 candles of 1.0960, the 60-minute candle closes at 1.0970, later the target is reached
  const p = [[1.095, 1.0958, 1.0948, 1.0955], ...flat(1.096, 11), [1.096, 1.0972, 1.0958, 1.097], ...flat(1.097, 3), [1.097, 1.1003, 1.0968, 1.1]];
  const { M5, w, g } = week(p);
  const t = lateTrade('eurusd', M5, w, g, 60);
  assert.equal(t.filled, t0 + 12 * 300 + 300);              // the close of the candle starting at reopen + 60 min
  assert.equal(t.entry, 1.097); assert.equal(t.target, 1.1);
  assert.ok(Math.abs(t.stop - 1.091) < 1e-12);
  assert.ok(Math.abs(t.r0 - 0.006) < 1e-12);
  assert.equal(t.exit, 'target'); assert.ok(Math.abs(t.R - 0.5) < 1e-9);
  assert.ok(Math.abs(t.rr - 0.5) < 1e-4);
  // base cost = the frozen formula at the pair's spread + the entry spread (0.6 pip on EUR/USD)
  const cB = withSpread(SPREAD.eurusd, () => costPx('eurusd', 1.097)) + 0.6 * 0.0001;
  assert.ok(Math.abs(t.costB - cB / 0.006) < 1e-4);
  assert.ok(Math.abs(t.netB - (t.R - cB / 0.006)) < 1e-4);
  assert.ok(Math.abs(t.net2x - (t.R - 2 * cB / 0.006)) < 1e-4);
});

test('no trade when the gap closed, the stop was touched, the risk is small or the entry is too late', () => {
  const head = [1.095, 1.0958, 1.0948, 1.0955];
  const filled = week([head, ...flat(1.096, 5), [1.096, 1.1001, 1.0959, 1.0965], ...flat(1.0965, 20)]);
  assert.equal(lateTrade('eurusd', filled.M5, filled.w, filled.g, 60).skip, 'filled');
  assert.equal(lateTrade('eurusd', filled.M5, filled.w, filled.g, 0).skip, undefined);   // Rule G itself trades
  const stopped = week([head, ...flat(1.096, 5), [1.096, 1.0961, 1.0905, 1.093], ...flat(1.093, 20)]);
  assert.equal(lateTrade('eurusd', stopped.M5, stopped.w, stopped.g, 60).skip, 'stopped');
  const both = week([head, ...flat(1.096, 5), [1.096, 1.1002, 1.0905, 1.093], ...flat(1.093, 20)]);
  assert.equal(lateTrade('eurusd', both.M5, both.w, both.g, 60).skip, 'stopped');          // stop first in one candle
  const small = week([head, ...flat(1.0915, 20)]);                                          // entry 5 pips over the stop
  assert.equal(lateTrade('eurusd', small.M5, small.w, small.g, 60).skip, 'small');
  const short = week([head, ...flat(1.096, 5)]);
  assert.equal(lateTrade('eurusd', short.M5, short.w, short.g, 60).skip, 'late');
});

test('entry spread 0.6 pip on the dollar pairs, 1.0 on the rest; 18 pairs', () => {
  assert.equal(ALL.length, 18); assert.equal(new Set(ALL).size, 18);
  assert.equal(ALL.filter((p) => ENTRY[p] === 0.6).length, 7);
  assert.equal(ENTRY.eurjpy, 1.0); assert.equal(ENTRY.usdcad, 0.6); assert.equal(ENTRY.audnzd, 1.0);
  for (const p of ALL) assert.ok(SPREAD[p] > 0, p);
  assert.equal(K.SPREAD_PIPS, 0.3);    // withSpread puts the frozen parameter back
});

test('Holm and the pre-registered bar', () => {
  assert.deepEqual(holmAdj([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const s = (m, tm, x2) => ({ base: { mean: m, tMonth: tm }, x2: { mean: x2 } });
  assert.equal(bar(s(0.1, 2.1, 0.01), s(0.01, 0, 0)).pass, true);
  assert.equal(bar(s(0.1, 1.99, 0.01), s(0.01, 0, 0)).pass, false);
  assert.equal(bar(s(0.1, 2.1, -0.01), s(0.01, 0, 0)).pass, false);
  assert.equal(bar(s(0.1, 2.1, 0.01), s(-0.01, 0, 0)).pass, false);
});

test('candle join: the later file wins from its first candle, overlap compared', () => {
  const j = join([[1, 1, 1, 1, 1], [2, 2, 2, 2, 2], [3, 3, 3, 3, 3]], [[2, 2, 2, 2, 2], [3, 3, 3, 3, 9], [4, 4, 4, 4, 4]]);
  assert.deepEqual(j.rows.map((r) => r[0]), [1, 2, 3, 4]);
  assert.equal(j.rows[2][4], 9); assert.deepEqual(j.overlap, { both: 2, diff: 1 });
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(read('result.json')), md = read('RESULT.md');
  assert.equal(r.gate.pass, true);
  assert.equal(r.frozenSha256, FROZEN_SHA256);
  assert.match(md.split('\n').find((l) => l.startsWith('**Verdict')), new RegExp(`^\\*\\*Verdict: ${r.verdict.split(' ')[0]}`));
  const P = r.tests[r.primary], f3 = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3);
  assert.equal(r.bar.pass, r.verdict.startsWith('PASS'));
  for (const w of ['dec', 'rep']) {
    assert.ok(md.includes(`| ${P[w].n} |`), `n ${w}`);
    for (const k of ['gross', 'base', 'x2']) assert.ok(md.includes(f3(P[w][k].mean)), `${w} ${k}`);
    assert.ok(md.includes(P[w].base.tMonth.toFixed(2)), `${w} tMonth`);
  }
  for (const d of [30, 120]) assert.ok(md.includes(r.tests[d].pAdj.toFixed(4)), `pAdj ${d}`);
  assert.ok(!/\bedge\b/i.test(md.split('\n')[2] || '') || /not an edge/i.test(md));
});
