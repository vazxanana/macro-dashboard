// tests/h4-eg-cisd-m15.test.mjs - H4 engulf zone + an M15 change in the state of delivery: the pre-registration, RESULT.md
// agrees with result.json, the verdict follows the bar, and on seeded candles the signal has no look-ahead and every trade
// has its stop on the losing side. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { find, signals, trades, CELLS, TARGETS, P } from '../research/edge/h4-eg-cisd-m15/run.mjs';

const DIR = new URL('../research/edge/h4-eg-cisd-m15/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(seed, n = 24000) {
  const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.1, l = Math.min(o, c) - rnd() * 0.1; p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  return B;
}

test('pre-registration names the cells, the windows and the bar', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'AFTER costs', 'n >= 300', 'zone', 'away', '1R, 2R, origin', 'before `run.mjs` is run'])
    assert.ok(pre.includes(w), w);
  assert.deepEqual(CELLS, ['zone 1R', 'zone 2R', 'zone origin', 'away 1R', 'away 2R', 'away origin']);
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS);
});

test('line 3 is the verdict line and RESULT.md carries result.json figures', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.includes(R.headline), line);
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of ['disc', 'conf']) { assert.ok(row.includes(f3(c[w].net)) && row.includes(f3(c[w].gross)) && row.includes(c[w].t.toFixed(2)), c.cell + ' ' + w); }
  }
});

test('the verdict follows the pre-registered bar', () => {
  for (const c of R.cells) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
  }
  const zc = R.cells.filter((c) => c.cell.startsWith('zone'));
  assert.equal(R.verdict, zc.some((c) => c.pass) ? 'PASS' : zc.every((c) => c.disc.n < 300 || c.conf.n < 300) ? 'INCONCLUSIVE' : 'FAIL');
  for (const x of R.cut) assert.equal(x.missing + x.extra, 0, 'cut ' + x.market);
  assert.equal(R.cut.length, 15);
});

test('the signal: a close back through the open of the run, read from closed candles only', () => {
  const M5 = seeded(3), M15 = K.resample(M5, 900), S = signals(M15);
  assert.ok(S.length > 200);
  for (const s of S) {
    const col = -s.side, b = M15[s.i];
    assert.ok(s.last - s.start + 1 >= P.minRun && s.i > s.last && s.i - s.last <= P.wait);
    for (let q = s.start; q <= s.last; q++) assert.ok(col > 0 ? M15[q].c > M15[q].o : M15[q].c < M15[q].o);
    assert.equal(s.open, M15[s.start].o); assert.equal(s.T, b.e);
    assert.ok(col > 0 ? b.c < s.open : b.c > s.open);
    for (let q = s.last + 1; q < s.i; q++) assert.ok(col > 0 ? M15[q].c >= s.open : M15[q].c <= s.open, 'the FIRST close through');
    assert.ok(s.side < 0 ? s.stop > s.ext && s.ext >= b.h : s.stop < s.ext && s.ext <= b.l, 'stop past the extreme');
  }
});

test('no look-ahead: cutting the candles, or changing every later price, leaves the earlier signals and their context alone', () => {
  const M5 = seeded(8), key = (s) => `${s.T}|${s.side}|${s.ctx}|${s.stop}|${s.origin}`, full = find(M5);
  assert.ok(new Set(full.map((s) => s.ctx)).size === 3);
  for (const n of [9001, 15002, 20500]) {
    const cutT = M5[n - 1].e, want = full.filter((s) => s.T <= cutT).map(key);
    assert.deepEqual(find(M5.slice(0, n)).filter((s) => s.T <= cutT).map(key), want, 'cut ' + n);
    const alt = M5.map((b, i) => (i < n ? b : { ...b, o: b.o + 7, h: b.h + 9, l: b.l + 5, c: b.c + 6 }));
    assert.deepEqual(find(alt).filter((s) => s.T <= cutT).map(key), want, 'changed ' + n);
  }
});

test('every trade has its stop on the losing side, fills after the signal, and R is bounded by the stop', () => {
  const M5 = seeded(21), S = find(M5).filter((s) => s.ctx !== 'other'); let n = 0, near = 0;
  for (const s of S) for (const r of trades(s, M5, 0.01)) {
    assert.ok(TARGETS.includes(r.target));
    if (r.skip) { if (r.skip === 'near') near++; continue; }
    n++; assert.ok(r.fillT >= s.T && r.exitT > r.fillT);
    const i = M5.findIndex((b) => b.t === r.fillT), fill = M5[i].o;
    assert.ok(-s.side * (s.stop - fill) > 0, 'stop on the losing side'); assert.ok(r.risk >= 0.01);
    assert.ok(r.R <= (r.target === '1R' ? 1 : r.target === '2R' ? 2 : 50) + 1e-9); assert.ok(r.Rnet < r.R);
    if (r.target === 'origin') assert.ok(s.side * (s.origin - fill) >= P.minOrigin * r.risk);
  }
  assert.ok(n > 300 && near > 0);
  // a candle that holds both the stop and the target is a stop
  const s = { side: 1, T: 600, stop: 99, origin: 105, ext: 99.1 };
  const B = [{ t: 0, o: 100, h: 100, l: 100, c: 100, e: 300 }, { t: 300, o: 100, h: 100, l: 100, c: 100, e: 600 }, { t: 600, o: 100, h: 100.2, l: 99.9, c: 100, e: 900 }, { t: 900, o: 100, h: 103, l: 98.5, c: 101, e: 1200 }];
  for (const r of trades(s, B, 0.01)) { assert.equal(r.status, 'loss'); assert.ok(Math.abs(r.R + 1) < 1e-9); }
});
