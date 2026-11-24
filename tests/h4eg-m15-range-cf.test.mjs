// tests/h4eg-m15-range-cf.test.mjs - the H4 engulf zone > M15 break / range / confirmation study: pre-registration, the
// sequence on seeded candles (no look-ahead, stop on the losing side, the zone's side), the limit fill and the trade engine on
// hand-made candles, and RESULT.md against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { sequences, fillOf, manage, cellName, cellIndex, NCELL, verdictOf, WIN } from '../research/edge/h4eg-m15-range-cf/run.mjs';

const DIR = new URL('../research/edge/h4eg-m15-range-cf/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });

function seeded(seed, n = 60000) { // a 5-minute random walk, weekdays and weekends alike
  const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.15, l = Math.min(o, c) - rnd() * 0.15; p = c; B.push(bar(1600000200 + i * 300, o, h, l, c)); }
  return B;
}

test('pre-registration names the cells, the windows, the bar and the costs', () => {
  for (const w of ['8 cells', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'through', 'built', 'n >= 300', 'xau 0.30'])
    assert.ok(pre.includes(w), w);
});

test('the 8 cells are distinct and as pre-registered', () => {
  const names = Array.from({ length: NCELL }, (_, i) => cellName(i).name);
  assert.equal(new Set(names).size, 8);
  assert.deepEqual(names, ['any touch 1R', 'any touch 2R', 'any through 1R', 'any through 2R', 'built touch 1R', 'built touch 2R', 'built through 1R', 'built through 2R']);
  assert.equal(cellName(cellIndex(1, 0, 1)).name, 'built touch 2R');
  for (const n of names) assert.ok(pre.includes(n), n);
});

test('the sequence on seeded candles: found, stop on the losing side, order of its steps, inside the window', () => {
  const M5 = seeded(5), F = frames(M5), { list, meta } = sequences(F), T = F['15m'];
  assert.ok(list.length > 30, 'sequences found: ' + list.length);
  assert.ok(list.some((g) => g.d > 0) && list.some((g) => g.d < 0) && list.some((g) => g.built) && list.some((g) => !g.built));
  assert.equal(meta.found, list.length);
  for (const g of list) {
    assert.ok(g.jb < g.jc && g.jc - g.jb < WIN, 'break before confirmation');
    assert.equal(g.ts, T[g.jc].e);
    assert.ok(g.d * (g.level - g.stop) > 0, 'stop on the losing side of the limit');
    assert.ok(g.d * (g.ext - g.stop) > 0, 'stop past the extreme');
    assert.ok(g.d * (T[g.jc].c - g.level) > 0, 'the confirmation candle closed beyond the level');
    let ext = g.d > 0 ? Infinity : -Infinity; for (let j = g.jb; j <= g.jc; j++) ext = g.d > 0 ? Math.min(ext, T[j].l) : Math.max(ext, T[j].h);
    assert.equal(g.ext, ext);
    assert.ok(g.zAt <= T[g.jb].t, 'the zone was known before the break candle started');
  }
});

test('no look-ahead: cut candles give the same orders, and changing every later price moves none', () => {
  const M5 = seeded(9), full = sequences(frames(M5)).list;
  const key = (g) => [g.d, g.ts, g.level, g.stop, g.built, g.jb, g.jc].join('|');
  for (const cutI of [17001, 30007, 45011]) { const T0 = M5[cutI].e;
    const want = full.filter((g) => g.ts <= T0).map(key);
    assert.ok(want.length > 5);
    assert.deepEqual(sequences(frames(M5.slice(0, cutI + 1))).list.filter((g) => g.ts <= T0).map(key), want, 'cut at ' + cutI);
    const rnd = K.rng(77); let p = M5[cutI].c;
    const alt = M5.map((b, i) => { if (i <= cutI) return b; const o = p, c = o + (rnd() - 0.5) * 3, h = Math.max(o, c) + rnd(), l = Math.min(o, c) - rnd(); p = c; return bar(b.t, o, h, l, c); });
    assert.deepEqual(sequences(frames(alt)).list.filter((g) => g.ts <= T0).map(key), want, 'later prices changed at ' + cutI);
  }
});

test('the limit: touch against trade-through, the gap fill, expiry', () => {
  const M5 = [bar(0, 101, 101.5, 100.6, 101), bar(300, 101, 101.2, 100, 100.4), bar(600, 100.4, 100.5, 99.8, 100), bar(900, 99.5, 99.7, 99.2, 99.4)];
  assert.deepEqual(fillOf(M5, 1, 100, 0, 3000, 0), { fi: 1, fill: 100 });          // a touch fills
  assert.deepEqual(fillOf(M5, 1, 100, 0, 3000, 0.15), { fi: 2, fill: 100 });       // through by 0.15 needs a low of 99.85
  assert.deepEqual(fillOf(M5, 1, 100, 900, 3000, 0), { fi: 3, fill: 99.5 });       // opens below the level: filled at the open
  assert.equal(fillOf(M5, 1, 100, 0, 300, 0), null);                               // expired before the touch
  assert.equal(fillOf(M5, 1, 100, 300, 600, 0.15), null);
  assert.deepEqual(fillOf(M5.map((b) => bar(b.t, 200 - b.o, 200 - b.l, 200 - b.h, 200 - b.c)), -1, 100, 0, 3000, 0.15), { fi: 2, fill: 100 }); // the sell mirrors
});

test('the trade engine: only the stop on the fill candle, stop first, gaps, time limit', () => {
  // buy at 100, stop 99: the fill candle reaches 101 (not counted), the next candle reaches 101 and 102
  let r = manage([bar(0, 100.5, 101.2, 99.9, 100.2), bar(300, 100.2, 102.1, 100.1, 102)], 1, 0, 100, 99, [1, 2]);
  assert.deepEqual(r.R, [1, 2]);
  r = manage([bar(0, 100.5, 101.2, 98.9, 100.2)], 1, 0, 100, 99, [1, 2]); assert.deepEqual(r.R, [-1, -1]);            // stopped on the fill candle
  r = manage([bar(0, 100.5, 100.6, 99.9, 100.2), bar(300, 100.2, 101.1, 98.8, 100)], 1, 0, 100, 99, [1, 2]); assert.deepEqual(r.R, [-1, -1]); // both in one candle: the stop
  r = manage([bar(0, 100.5, 100.6, 99.9, 100.2), bar(300, 98, 98.5, 97.9, 98.2)], 1, 0, 100, 99, [1, 2]); assert.deepEqual(r.R, [-2, -2]);   // a gap through the stop
  r = manage([bar(0, 100.5, 100.6, 99.9, 100.2), bar(300, 101.5, 101.6, 101.2, 101.4), bar(600, 101.4, 101.5, 98.5, 99)], 1, 0, 100, 99, [1, 2]);
  assert.deepEqual(r.R, [1.5, -1]);                                                                                    // a gap through the 1R target fills at the open
  r = manage([bar(0, 100.5, 100.6, 99.9, 100.2), bar(300, 100.2, 100.5, 100.1, 100.4)], 1, 0, 100, 99, [1, 2], 600);
  assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9 && Math.abs(r.R[1] - 0.4) < 1e-9);                                           // time limit: the close
  assert.equal(manage([bar(0, 100, 100, 100, 100)], 1, 0, 100, 100.5, [1, 2]), null);                                  // a stop on the wrong side is no trade
  r = manage([bar(0, 99.5, 100.1, 99.4, 99.8), bar(300, 99.8, 100.2, 97.9, 98)], -1, 0, 100, 101, [1, 2]); assert.deepEqual(r.R, [1, 2]); // a sell
  assert.equal(manage([bar(0, 100.5, 100.6, 99.9, 100.2)], 1, 0, 100, 99, [1, 2]), null);                              // unresolved at the data's end
});

test('the verdict rule', () => {
  const w = (n) => ({ n, meanNet: -0.1, tNet: -1 });
  assert.equal(verdictOf([{ pass: false, d: w(500), c: w(500) }]), 'FAIL');
  assert.equal(verdictOf([{ pass: false, d: w(100), c: w(500) }]), 'INCONCLUSIVE');
  assert.equal(verdictOf([{ pass: true, d: w(500), c: w(500) }, { pass: false, d: w(10), c: w(10) }]), 'PASS');
});

test('RESULT.md agrees with result.json and the verdict follows the bar', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.endsWith('.**'), line);
  assert.ok(line.includes(R.headline), 'headline');
  assert.equal(R.cells.length, 8);
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.meanNet > 0 && c.conf.meanNet > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} | `) && l.includes('%')); assert.ok(row, c.cell);
    for (const w of [c.disc, c.conf]) assert.ok(row.includes(`${f3(w.mean)} (${w.t.toFixed(2)})`) && row.includes(`${f3(w.meanNet)} (${w.tNet.toFixed(2)})`), c.cell);
  }
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300) ? 'FAIL' : 'INCONCLUSIVE');
  assert.deepEqual(R.passed, R.cells.filter((c) => c.pass).map((c) => c.cell));
  const b = R.cells.find((c) => c.cell === R.best);
  assert.ok(R.headline.includes(`${f3(b.conf.meanNet)}R a trade after costs in 2015-26`) && R.headline.includes(`month t ${b.conf.tNet.toFixed(2)}`));
  assert.deepEqual(R.markets, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
  assert.ok(R.cut.length >= 5); for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
});
