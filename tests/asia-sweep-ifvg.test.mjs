// tests/asia-sweep-ifvg.test.mjs - the Asia sweep + 5-minute gap inversion study: the pre-registration, a hand-made day, no
// look-ahead and stop side on seeded candles, RESULT.md against result.json, the verdict against the bar. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { signals, sideRun, tradeOf, CELLS, resultMd, MARKETS } from '../research/edge/asia-sweep-ifvg/run.mjs';

const DIR = new URL('../research/edge/asia-sweep-ifvg/', import.meta.url);
const pre = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const D0 = Date.UTC(2021, 2, 1) / 1000; // a Monday
const bar = (t, o, h, l, c) => ({ t, o, h, l, c, e: t + 300 });

// a flat Asia session 99..101, then whatever `after` gives from 06:00 on ([o, h, l, c] a candle)
function day(after, d = D0) {
  const B = [];
  for (let i = 0; i < 72; i++) B.push(bar(d + i * 300, 100, i === 10 ? 101 : 100.4, i === 20 ? 99 : 99.6, 100));
  after.forEach((x, i) => B.push(bar(d + 6 * 3600 + i * 300, ...x)));
  return B;
}
const quiet = [100, 100.3, 99.8, 100];
const hour6 = Array(12).fill(quiet);

test('pre-registration fixes the cells, the windows, the bar and the controls', () => {
  for (const w of ['2005-01-01 to 2014-12-31', '2015-01-01 to 2026-10-31', 'Holm', '[00:00, 06:00)', '[07:00, 10:00)', 'reclaim', 'n >= 300', 'AFTER costs', 'session-sweep', 'asia-box-london'])
    assert.ok(pre.includes(w), w);
  assert.equal(CELLS.length, 4); assert.equal(CELLS.filter((c) => c.judged).length, 2);
  assert.deepEqual(MARKETS, ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd']);
});

test('a hand-made day: sweep of the Asia high, a gap in the leg, the inversion close sells with the stop above the extreme', () => {
  const after = [...hour6,
    [100, 100.4, 99.9, 100.3],      // 07:00  a
    [100.3, 100.9, 100.3, 100.8],   // 07:05  b
    [100.8, 101.4, 100.6, 101.2],   // 07:10  c: low 100.6 > high(a) 100.4 = an up gap, edge 100.4; also the sweep (high > 101)
    [101.2, 101.3, 100.7, 100.8],   // 07:15  closes back inside the range (reclaim), still above the edge
    [100.8, 100.9, 100.2, 100.3],   // 07:20  closes below 100.4 = the inversion; low 100.2 stays above the middle (100)
    [100.3, 100.35, 100.1, 100.2],  // 07:25  the fill candle (open 100.3)
    [100.2, 100.2, 99.9, 99.95],    // 07:30  trades to the middle
    [99.95, 100, 98.9, 99],         // 07:35  trades to the far side
  ];
  const M5 = day(after); const cost = 0.02; const S = signals(M5, cost);
  const iv = S.find((x) => x.kind === 'ifvg'), rc = S.find((x) => x.kind === 'reclaim');
  assert.equal(iv.side, -1); assert.equal(iv.t, D0 + 7 * 3600 + 25 * 60); assert.ok(Math.abs(iv.stop - 101.42) < 1e-9);
  assert.equal(rc.t, D0 + 7 * 3600 + 20 * 60); assert.equal(iv.ah, 101); assert.equal(iv.al, 99); assert.equal(iv.mid, 100);
  const mid = tradeOf(M5, iv, CELLS[0], cost), far = tradeOf(M5, iv, CELLS[1], cost);
  assert.equal(mid.skip, 'target too near');                        // 0.3 to the middle against 1.12 of risk
  assert.equal(far.reason, 'target'); assert.ok(far.stop > far.fill); assert.ok(Math.abs(far.R - 1.3 / 1.12) < 1e-9); assert.ok(far.Rnet < far.R);
  // no gap in the leg: no inversion signal, the control still fires
  const noGap = after.map((x) => [...x]); noGap[12] = [100, 100.7, 99.9, 100.3];
  const S2 = signals(day(noGap), cost); assert.ok(!S2.some((x) => x.kind === 'ifvg')); assert.ok(S2.some((x) => x.kind === 'reclaim'));
  // a candle that trades to the middle before any trigger cancels the side
  const cut = after.map((x) => [...x]); cut[15] = [101.2, 101.3, 99.95, 100.3]; cut[16] = quiet;
  assert.equal(signals(day(cut), cost).length, 0);
  // the Asia high already traded through between 06:00 and 07:00: not fresh
  const stale = after.map((x) => [...x]); stale[3] = [100, 101.1, 99.9, 100];
  assert.equal(signals(day(stale), cost).length, 0);
});

test('the buy mirrors the sell', () => {
  const sell = [...hour6, [100, 100.4, 99.9, 100.3], [100.3, 100.9, 100.3, 100.8], [100.8, 101.4, 100.6, 101.2], [101.2, 101.3, 100.7, 100.8], [100.8, 100.9, 100.2, 100.3], [100.3, 100.35, 100.1, 100.2]];
  const flip = (B) => B.map((b) => ({ ...b, o: 200 - b.o, h: 200 - b.l, l: 200 - b.h, c: 200 - b.c }));
  const A = signals(day(sell), 0.02), B = signals(flip(day(sell)), 0.02);
  assert.equal(A.length, B.length); assert.ok(A.length >= 2);
  A.forEach((a, i) => { assert.equal(B[i].side, -a.side); assert.equal(B[i].t, a.t); assert.ok(Math.abs(B[i].stop - (200 - a.stop)) < 1e-9); });
});

function seeded(seed, days = 700) {
  const r = K.rng(seed); const B = []; let p = 100;
  for (let d = 0; d < days; d++) for (let i = 0; i < 288; i++) {
    const t = D0 + d * 86400 + i * 300; const hot = i >= 84 && i < 144 ? 3 : 1;
    const o = p, c = o + (r() - 0.5) * 0.12 * hot, h = Math.max(o, c) + r() * 0.05 * hot, l = Math.min(o, c) - r() * 0.05 * hot; p = c;
    B.push(bar(t, o, h, l, c));
  }
  return B;
}

test('seeded candles: no look-ahead (a cut series gives the same signals) and every stop is on the losing side', () => {
  const M5 = seeded(11); const cost = 0.01; const all = signals(M5, cost);
  assert.ok(all.filter((x) => x.kind === 'ifvg').length >= 20, 'ifvg signals ' + all.filter((x) => x.kind === 'ifvg').length);
  assert.ok(all.some((x) => x.side > 0) && all.some((x) => x.side < 0));
  const r = K.rng(5);
  for (let k = 0; k < 40; k++) {
    const cutI = 2000 + Math.floor(r() * (M5.length - 2100)); const part = signals(M5.slice(0, cutI), cost); const T = M5[cutI - 1].e;
    assert.deepEqual(part, all.filter((x) => x.t <= T), 'cut at ' + cutI);
  }
  // changing every later price leaves earlier signals alone
  const cutI = Math.floor(M5.length / 2), T = M5[cutI - 1].e;
  const M2 = M5.map((b, i) => (i < cutI ? b : { ...b, o: b.o + 7, h: b.h + 9, l: b.l + 5, c: b.c + 7 }));
  assert.deepEqual(signals(M2, cost).filter((x) => x.t <= T), all.filter((x) => x.t <= T));
  let n = 0;
  for (const sg of all) {
    assert.ok(sg.side < 0 ? sg.stop > sg.ah : sg.stop < sg.al, 'stop beyond the swept side');
    const b = M5[sg.j]; assert.ok(b.c < sg.ah && b.c > sg.al, 'the trigger closes inside the range'); assert.equal(sg.t, b.e);
    const h = new Date(b.t * 1000).getUTCHours(); assert.ok(h >= 7 && h < 12);
    for (const cell of CELLS.filter((c) => c.kind === sg.kind)) {
      const tr = tradeOf(M5, sg, cell, cost); if (tr.skip) continue; n++;
      assert.ok(tr.side * (tr.fill - tr.stop) > 0, 'stop on the losing side'); assert.ok(tr.side * (tr.target - tr.fill) > 0, 'target on the winning side');
      assert.ok(tr.fillT >= sg.t); assert.ok(tr.exitT <= sg.day + 16 * 3600); assert.ok(tr.R >= -1.5 && tr.Rnet < tr.R);
    }
  }
  assert.ok(n >= 20, 'trades ' + n);
});

test('sideRun: a spent gap gives no trigger', () => {
  const after = [...hour6, [100, 100.4, 99.9, 100.3], [100.3, 100.9, 100.3, 100.8], [100.8, 100.95, 100.6, 100.9], [100.9, 100.9, 100.2, 100.3], // gap, then spent before any sweep
    [100.3, 101.3, 100.3, 101.2], [101.2, 101.25, 100.2, 100.3]];
  const M5 = day(after); const r = sideRun(M5, 72 + 16, D0 + 12 * 3600, -1, 101, 99, 0.02);
  assert.equal(r.ifvg, null); assert.ok(r.reclaim);
});

test('RESULT.md agrees with result.json and the verdict follows the bar', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')); const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line = md.split('\n')[2];
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. `), line); assert.ok(line.includes(R.headline)); assert.ok(line.endsWith('.**'));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
  assert.equal(md, resultMd(R));
  assert.deepEqual(R.cells.map((c) => c.cell), CELLS.map((c) => c.name));
  const J = R.cells.filter((c) => c.judged);
  for (const c of J) {
    const ok = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.after > 0 && c.conf.after > 0 && c.disc.tAfter >= 2 && c.conf.tAfter >= 2 && c.holm < 0.05;
    assert.equal(c.pass, ok, c.cell);
    assert.equal(c.disc.n, Object.values(c.markets).reduce((a, m) => a + m.disc.n, 0)); assert.equal(c.conf.n, Object.values(c.markets).reduce((a, m) => a + m.conf.n, 0));
    assert.ok(c.conf.after <= c.conf.before && c.disc.after <= c.disc.before, 'costs only take away');
  }
  const enough = J.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  assert.equal(R.verdict, J.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE');
  const best = R.cells.find((c) => c.cell === R.best); const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(R.headline.includes(f3(best.conf.after) + 'R')); assert.ok(R.headline.includes(best.conf.tAfter.toFixed(2)));
  assert.ok(!/\bedge\b/i.test(md.replace(/sweep-leg|lower edge/g, '')), 'never called an edge');
});
