// tests/h1-box-retest-engulf.test.mjs - the H1 box break / retest / M15 engulf study: the pre-registration, RESULT.md against
// result.json, the verdict against the bar, and the signal on seeded and hand-made candles (no look-ahead, stop side). Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { setups, trade, monthT, CELLS, P } from '../research/edge/h1-box-retest-engulf/run.mjs';

const DIR = new URL('../research/edge/h1-box-retest-engulf/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function seeded(seed, n) { const rnd = K.rng(seed); let p = 100; const B = [];
  for (let i = 0; i < n; i++) { const o = p, c = o + (rnd() - 0.5) * 0.4, h = Math.max(o, c) + rnd() * 0.15, l = Math.min(o, c) - rnd() * 0.15; p = c; B.push({ t: i * 300, o, h, l, c, e: i * 300 + 300 }); }
  return B; }

test('pre-registration: the cells, the windows, the bar', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', 'n >= 300', 'boxesClose', 'engulfAt', '96 M15', '12th M15', '48 hours']) assert.ok(pre.includes(w), w);
  assert.equal(CELLS.length, 8); for (const c of CELLS) assert.ok(pre.includes('`' + c.name + '`'), c.name);
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS.map((c) => c.name));
  assert.deepEqual(P, { retestWithin: 96, engulfWithin: 12, hold: 172800 });
});

test('line 3 is the verdict line; every cell row equals result.json; the verdict follows the bar', () => {
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `) && line.includes(R.headline), line);
  for (const c of R.cells) {
    const row = md.split('\n').find((l) => l.startsWith(`| ${c.cell} |`)); assert.ok(row, c.cell);
    for (const w of [c.disc, c.conf]) { assert.ok(row.includes(`| ${w.n} |`)); assert.ok(row.includes(`${f3(w.gross)} (${w.tGross.toFixed(2)})`)); assert.ok(row.includes(`${f3(w.net)} (${w.t.toFixed(2)})`)); }
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.net > 0 && c.conf.net > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    assert.ok(c.disc.net < c.disc.gross && c.conf.net < c.conf.gross, 'costs are charged');
  }
  const enough = R.cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, R.cells.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE');
  const best = R.cells.find((c) => c.cell === R.best); assert.ok(R.headline.includes(f3(best.conf.net)) && R.headline.includes('n ' + best.conf.n) && R.headline.includes(best.conf.t.toFixed(2)));
  assert.ok(!/\bedge\b/i.test(line.replace('broken edge', '')), 'the verdict line claims nothing');
});

test('seeded candles: signals exist, the stop is on the losing side, and nothing looks ahead', () => {
  const M5 = seeded(5, 60000), H1 = K.resample(M5, 3600), M15 = K.resample(M5, 900), cost = 0.01;
  for (const span of [3, 1]) {
    const full = setups(H1, M15, span, cost).signals; assert.ok(full.length > 50, 'signals ' + full.length);
    assert.ok(full.some((s) => s.side > 0) && full.some((s) => s.side < 0));
    for (const s of full) {
      const c = M15[s.i]; assert.equal(c.e, s.t);
      assert.ok(s.side * (c.c - s.stop) > 0, 'stop on the losing side of the engulf close');
      assert.ok(s.retestT >= s.boxBt && s.t > s.boxBt && s.i - M15.findIndex((b) => b.t === s.retestT) <= 12);
      assert.ok(s.side > 0 ? c.c > c.o : c.c < c.o, 'the engulf candle has the break\'s colour');
      const tr = trade(s, M5, cost); if (tr) { assert.ok(tr.fillT >= s.t && tr.risk > cost); for (const k of ['1R', 'box']) if (tr.R[k] != null) assert.ok(tr.R[k] >= -3); }
    }
    // cut the series at several moments: every signal known by the cut is found, and nothing else
    for (const cutT of [M5[20000].t, M5[33333].t, M5[51234].t]) {
      const m5 = M5.filter((b) => b.e <= cutT), h1 = K.resample(m5, 3600).filter((b) => b.e <= cutT), m15 = K.resample(m5, 900).filter((b) => b.e <= cutT);
      const got = setups(h1, m15, span, cost).signals.map((s) => `${s.t}|${s.side}|${s.stop}|${s.edge}`);
      const want = full.filter((s) => s.t <= cutT).map((s) => `${s.t}|${s.side}|${s.stop}|${s.edge}`);
      assert.deepEqual(got, want, 'cut at ' + cutT);
    }
    // changing every later price does not move an earlier signal
    const at = M5[40000].t, M5b = M5.map((b) => (b.t >= at ? { ...b, o: b.o * 2, h: b.h * 2, l: b.l * 2, c: b.c * 2 } : b));
    const alt = setups(K.resample(M5b, 3600), K.resample(M5b, 900), span, cost).signals.filter((s) => s.t <= at);
    assert.deepEqual(alt, full.filter((s) => s.t <= at));
  }
});

test('a hand-made break up, retest and engulf: the levels', () => {
  const H = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 3600 }), M = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 900 });
  // box: three H1 candles between 99 and 101 (the first one starts it by closing above a tiny earlier box), then a close at 101.5
  const H1 = [H(0, 98, 98.2, 97.9, 98), H(3600, 98, 101, 99, 100), H(7200, 100, 100.8, 99.5, 100.2), H(10800, 100.2, 100.9, 99.6, 100.5), H(14400, 100.5, 101.6, 100.4, 101.5)];
  const box = K.boxesClose(H1).find((b) => b.bi === 4); assert.equal(box.hi, 101); assert.equal(box.lo, 99); assert.equal(box.dir, 1);
  const t0 = 18000;
  const M15 = [M(t0, 101.5, 101.7, 101.3, 101.6), M(t0 + 900, 101.6, 101.6, 100.9, 101.1) /* retest, red */, M(t0 + 1800, 101.1, 101.8, 101.0, 101.7) /* closes above 101.6: engulf */, M(t0 + 2700, 101.7, 101.9, 101.6, 101.8)];
  const S = setups(H1, M15, 3, 0.05); assert.equal(S.signals.length, 1); const s = S.signals[0];
  assert.equal(s.side, 1); assert.equal(s.t, t0 + 2700); assert.equal(s.edge, 101); assert.equal(s.height, 2); assert.equal(s.len, 3);
  assert.ok(Math.abs(s.stop - (100.9 - 0.05)) < 1e-9); assert.equal(s.retestT, t0 + 900);
  // 5-minute candles after the engulf: fill 101.7, risk 0.85; 1R = 102.55, box target = 103; price runs to 103.2
  const b5 = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });
  const tr = trade(s, [b5(t0 + 2700, 101.7, 101.9, 101.6, 101.8), b5(t0 + 3000, 101.8, 102.6, 101.7, 102.5), b5(t0 + 3300, 102.5, 103.2, 102.4, 103.1)], 0.05);
  assert.ok(Math.abs(tr.risk - 0.85) < 1e-9); assert.ok(Math.abs(tr.R['1R'] - 1) < 1e-9); assert.ok(Math.abs(tr.R.box - 1.3 / 0.85) < 1e-9);
  // a candle that holds stop and target is a stop
  const tr2 = trade(s, [b5(t0 + 2700, 101.7, 101.9, 101.6, 101.8), b5(t0 + 3000, 101.8, 103.5, 100.5, 102)], 0.05); assert.equal(tr2.R['1R'], -1); assert.equal(tr2.R.box, -1);
  // an M15 close below the box low before the engulf ends the setup; no retest, no trade
  assert.equal(setups(H1, [M15[0], M(t0 + 900, 101.6, 101.6, 98.5, 98.8), M15[2]], 3, 0.05).signals.length, 0);
  assert.equal(setups(H1, [M15[0], M(t0 + 900, 101.6, 101.9, 101.2, 101.3), M(t0 + 1800, 101.3, 102, 101.25, 101.95)], 3, 0.05).signals.length, 0);
});

test('monthT counts empty months as zero', () => {
  const t = (y, m) => Date.UTC(y, m, 5) / 1000; const r = monthT([[t(2020, 0), 1], [t(2020, 0), 1], [t(2020, 3), 2]]);
  assert.equal(r.n, 3); assert.equal(r.months, 4); assert.ok(Math.abs(r.mean - 4 / 3) < 1e-12); assert.ok(Math.abs(r.t - 1 / (Math.sqrt(4 / 3) / 2)) < 1e-9);
});
