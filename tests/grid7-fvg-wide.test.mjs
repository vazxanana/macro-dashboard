// tests/grid7-fvg-wide.test.mjs - the wide fair-value-gap grid: pre-registration, RESULT.md agrees with result.json, the
// verdict follows the bar, and the gap events on hand-made candles. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eventsOf, slotIndex, slotName, CELLS, NSLOT, welch } from '../research/edge/grid7-fvg-wide/run.mjs';

const DIR = new URL('../research/edge/grid7-fvg-wide/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('pre-registration names the cells, the windows, the bar and the assumed costs', () => {
  const p = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
  for (const w of ['54', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'Welch', 'ASSUMED', 'side-flipped', 'random bands', 'trades THROUGH'])
    assert.ok(p.includes(w), w);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}.`), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the verdict follows the pre-registered bar', () => {
  assert.equal(R.cells.length, 54);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2
      && c.holm < 0.05 && c.vsControl.d != null && c.vsControl.d >= 2 && c.vsControl.c >= 2;
    assert.equal(c.pass, ok, c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : 'FAIL');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  assert.deepEqual(R.assumedCosts, ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy']);
  assert.equal(R.markets.length, 10);
  for (const c of R.passed) assert.equal(R.perMarket[c].length, 10, c);
});

test('RESULT.md lists every cell with its figures from result.json', () => {
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    assert.ok(row.includes(`${f3(c.disc.mean)} (${c.disc.t.toFixed(2)})`), c.cell + ' disc');
    assert.ok(row.includes(`${f3(c.conf.mean)} (${c.conf.t.toFixed(2)})`), c.cell + ' conf');
    assert.ok(row.endsWith(c.pass ? '| yes |' : '| no |'), c.cell + ' pass');
  }
});

test('the cut test found nothing that a cut series would not know', () => {
  assert.ok(R.cut.length >= 10);
  assert.ok(R.cut.every((x) => x.n > 0));
  assert.equal(R.cut.reduce((a, x) => a + x.missing + x.extra, 0), 0);
});

test('slots index correctly; 54 cells', () => {
  for (let i = 0; i < NSLOT; i++) { const n = slotName(i); assert.equal(slotIndex(n.g, n.e, n.s, n.x), i); }
  assert.equal(CELLS.length, 54);
  assert.ok(Math.abs(welch({ n: 3, sum: 3, sq: 3.02 }, { n: 3, sum: 0, sq: 0.02 })) > 2);
});

test('gap events on hand-made candles: the close inside, the limit traded through, the inverse gap, stops on the losing side', () => {
  const c = (t, o, h, l, cl, sec) => ({ t, o, h, l, c: cl, e: t + sec });
  // the gap timeframe = M15 here; a bullish gap 101..103 formed at candle 2 (known at its close, t 2700)
  const G = [c(0, 100, 101, 99, 100.5, 900), c(900, 100.5, 104, 100.5, 103.8, 900), c(1800, 103.8, 105, 103, 104.5, 900),
    c(2700, 104.5, 104.6, 102.5, 102.6, 900), c(3600, 102.6, 102.7, 100.0, 100.2, 900), c(4500, 100.2, 100.4, 99.8, 100.0, 900)];
  const M5 = []; for (const g of G) for (let k = 0; k < 3; k++) M5.push(c(g.t + k * 300, g.o, g.h, g.l, g.c, 300));
  const b = { d: 1, bot: 101, top: 103, i: 2, at: G[2].e, atr: 2 };
  const ev = eventsOf(b, G, G, G.map(() => 1), M5, 0.2);
  const mkt = ev.find((x) => x.kind === 0), lim = ev.find((x) => x.kind === 1), inv = ev.find((x) => x.kind === 2);
  assert.equal(mkt.et, G[3].e); assert.equal(mkt.fill, G[4].o); assert.ok(mkt.s > 0 && mkt.stop < mkt.fill); assert.equal(mkt.stop, 101 - 0.2);
  assert.ok(lim && lim.s > 0 && lim.fill <= 102 && lim.stop < lim.fill && lim.firstFull === false);
  assert.equal(inv.et, G[4].e); assert.equal(inv.s, -1); assert.ok(inv.stop > inv.fill); assert.equal(inv.stop, G[4].h + 0.1);
  // no limit when the middle is only touched, not traded through by half the round trip
  const B2 = { ...b, bot: 102.55, top: 102.65 };
  assert.ok(eventsOf(B2, G.slice(0, 4), G.slice(0, 4), [1, 1, 1, 1], M5.slice(0, 12), 1).every((x) => x.kind !== 1));
});
