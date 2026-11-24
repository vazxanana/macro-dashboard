// tests/pair-divergence-ifvg.test.mjs - pair divergence at an H1 sweep with an M15 inversion-gap entry: the pre-registration,
// RESULT.md agrees with result.json, the verdict follows the bar, and on seeded candles the signal has no look-ahead, its
// stop is on the losing side, the partner classes are as written and the trade engine takes the stop first. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { signals, sweeps, liveLevels, exits, cellStat, CELLS, MARKETS, PARTNER } from '../research/edge/pair-divergence-ifvg/run.mjs';

const DIR = new URL('../research/edge/pair-divergence-ifvg/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

// two correlated seeded 5-minute markets
function seeded(seed, n = 60000) {
  const r = K.rng(seed), A = [], B = []; let p = 100, q = 50;
  for (let i = 0; i < n; i++) { const z = (r() - 0.5) * 0.4, t = 1e9 + i * 300;
    const mk = (o, d) => { const c = o + d, h = Math.max(o, c) + r() * 0.1, l = Math.min(o, c) - r() * 0.1; return { o, h, l, c }; };
    const a = mk(p, z + (r() - 0.5) * 0.12), b = mk(q, z * 0.5 + (r() - 0.5) * 0.08); p = a.c; q = b.c;
    A.push({ t, ...a, e: t + 300 }); B.push({ t, ...b, e: t + 300 }); }
  return { A, B };
}

test('pre-registration names the cells, the windows, the bar and the assumed cost', () => {
  for (const w of ['12', '2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'ASSUMED', 'AFTER costs', 'n ≥ 300', 'div', 'nolevel']) assert.ok(pre.includes(w), w);
  assert.equal(CELLS.length, 12); assert.equal(new Set(CELLS.map((c) => c.name)).size, 12);
  assert.deepEqual(MARKETS.map((m) => PARTNER[PARTNER[m]]), MARKETS);
});

test('line 3 is the verdict line and matches result.json', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.endsWith('.**'), line);
  assert.ok(line.toLowerCase().includes(R.headline.toLowerCase()), 'headline');
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  const best = R.cells.find((c) => c.cell === R.best);
  assert.ok(R.headline.includes(f3(best.conf.net)) && R.headline.includes(best.conf.tNet.toFixed(2)) && R.headline.includes(best.conf.n.toLocaleString('en-US')));
});

test('the verdict follows the pre-registered bar; every cell row is in RESULT.md', () => {
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS.map((c) => c.name));
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.tNet >= 2 && c.conf.tNet >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of [c.disc, c.conf]) assert.ok(row.includes(f3(w.net)) && row.includes(f3(w.gross)) && row.includes(w.tNet.toFixed(2)), c.cell);
  }
  const div = R.cells.filter((c) => c.group === 'div');
  assert.equal(R.verdict, div.some((c) => c.pass) ? 'PASS' : div.every((c) => c.disc.n < 300 || c.conf.n < 300) ? 'INCONCLUSIVE' : 'FAIL');
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut test ' + x.market + ' ' + x.cut);
  assert.equal(R.cut.length, 12); assert.deepEqual(R.assumedCosts, ['xag']);
});

test('seeded candles: no look-ahead, the stop on the losing side, the entry after the sweep closes', () => {
  const { A, B } = seeded(5); const P1 = K.resample(B, 3600);
  const full = signals(A, P1, 0.01); assert.ok(full.sig.length > 40, 'signals ' + full.sig.length);
  assert.ok(['div', 'conf', 'nolevel'].every((c) => full.sig.some((s) => s.cls === c)));
  const key = (s) => [s.sweepT, s.side, s.cls, s.entryT, s.stop.toFixed(6), s.opp.join(',')].join('|');
  for (const frac of [0.31, 0.52, 0.77]) {
    const c = A[Math.floor(A.length * frac)].e;
    // every later price changed: the signals known by the cut must not move
    const A2 = A.map((b) => (b.e <= c ? b : { ...b, o: b.o * 1.3, h: b.h * 1.5, l: b.l * 0.6, c: b.c * 1.1 }));
    const P2 = K.resample(B.map((b) => (b.e <= c ? b : { ...b, o: b.o * 0.7, h: b.h * 1.4, l: b.l * 0.5, c: b.c * 0.9 })), 3600);
    const a = full.sig.filter((s) => s.entryT <= c).map(key), b = signals(A2, P2, 0.01).sig.filter((s) => s.entryT <= c).map(key);
    assert.deepEqual(b, a); assert.ok(a.length > 5);
    const cutSig = signals(A.filter((x) => x.e <= c), P1.filter((x) => x.e <= c), 0.01).sig.filter((s) => s.entryT <= c).map(key);
    assert.deepEqual(cutSig, a);
  }
  const M15 = K.resample(A, 900);
  for (const s of full.sig) {
    assert.ok(s.entryT >= s.T && s.entryT <= s.T + 24 * 900 + 3600, 'entry inside the wait');
    const i = A.findIndex((b) => b.t >= s.entryT); if (i < 0) continue;
    const k = K.closedCount(M15, s.entryT) - 1;           // the inversion candle, closed
    assert.ok(s.side * (M15[k].c - s.stop) > 0, 'stop beyond the inversion close');
    assert.ok(s.side < 0 ? s.stop > s.level : s.stop < s.level, 'stop past the swept level');
    const r = exits(A, i, s.side, s.stop, [A[i].o + s.side * 2 * Math.abs(A[i].o - s.stop), NaN]);
    if (r) { assert.ok(s.side * (r.fill - s.stop) > 0); }
  }
});

test('the sweep and the partner classes are as written', () => {
  const { A, B } = seeded(9, 30000); const H1 = K.resample(A, 3600), P1 = K.resample(B, 3600);
  const sw = sweeps(H1, P1), LA = liveLevels(H1), LB = liveLevels(P1); assert.ok(sw.length > 50);
  const S = K.swings(H1, 3), SP = K.swings(P1, 3);
  for (const s of sw.slice(0, 200)) {
    const b = H1[s.j];
    // the level is the most recent swing confirmed before j, untouched since, traded through by j and closed back
    const last = S.filter((x) => x.type === (s.side < 0 ? 'H' : 'L') && x.ci < s.j).sort((p, q) => p.ci - q.ci).pop();
    assert.equal(last.price, s.level);
    for (let m = last.i + 1; m < s.j; m++) assert.ok(s.side < 0 ? H1[m].h <= s.level : H1[m].l >= s.level);
    assert.ok(s.side < 0 ? b.h > s.level && b.c < s.level : b.l < s.level && b.c > s.level);
    const q0 = P1.findIndex((x) => x.t === b.t - 7200); const w = P1.slice(q0, q0 + 3);
    const pl = SP.filter((x) => x.type === (s.side < 0 ? 'H' : 'L') && x.ci < q0).sort((p, q) => p.ci - q.ci).pop();
    let live = !!pl; if (pl) for (let m = pl.i + 1; m < q0; m++) if (s.side < 0 ? P1[m].h > pl.price : P1[m].l < pl.price) live = false;
    const took = live && (s.side < 0 ? Math.max(...w.map((x) => x.h)) > pl.price : Math.min(...w.map((x) => x.l)) < pl.price);
    assert.equal(s.cls, !live ? 'nolevel' : took ? 'conf' : 'div');
  }
  assert.equal(LA.hi.length, H1.length); assert.equal(LB.lo.length, P1.length);
});

test('the trade engine: stop first, gaps, several targets, time limit; month t', () => {
  const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  let r = exits([bar(0, 100, 100.2, 99.8, 100), bar(300, 100, 100.1, 98.5, 99), bar(600, 99, 101.5, 99, 101)], 0, -1, 101, [99, 98, NaN], 86400);
  assert.deepEqual(r.R.slice(0, 2), [1, -1]); assert.ok(Number.isNaN(r.R[2]));
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 100, 101.2, 98.9, 100)], 0, -1, 101, [99], 86400); assert.equal(r.R[0], -1);
  r = exits([bar(0, 100, 100, 100, 100), bar(300, 102, 102.5, 101.8, 102)], 0, -1, 101, [99], 86400); assert.equal(r.R[0], -2);
  r = exits([bar(0, 100, 100.1, 99.9, 100), bar(300, 100, 100.2, 99.6, 99.6)], 0, -1, 101, [98], 600); assert.ok(Math.abs(r.R[0] - 0.4) < 1e-9);
  assert.equal(exits([bar(0, 100, 100, 100, 100)], 0, -1, 99, [98], 600), null);
  r = exits([bar(0, 100, 100.1, 99.9, 100)], 0, 1, 99, [103], 86400); assert.equal(r.R[0], null);
  const d = (y, m) => Date.UTC(y, m, 5) / 1000;
  const s = cellStat([{ t: d(2020, 0), g: 1, n: 0.9 }, { t: d(2020, 0), g: -1, n: -1.1 }, { t: d(2020, 3), g: 2, n: 1.9 }]);
  assert.equal(s.n, 3); assert.equal(s.months, 4); assert.ok(Math.abs(s.net - 1.7 / 3) < 1e-9); assert.ok(Math.abs(s.costR - 0.1) < 1e-9);
});
