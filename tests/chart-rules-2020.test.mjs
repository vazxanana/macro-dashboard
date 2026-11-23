// chart-rules-2020: the two rules on seeded candles (no look-ahead, stops on the losing side, targets 3R or more) and
// RESULT.md pinned to result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signalsA, signalsB, targetZones, targetFor, frames, atrs, P } from '../research/edge/chart-rules-2020/run.mjs';

const DIR = new URL('../research/edge/chart-rules-2020/', import.meta.url);

function market(n = 60000, seed = 11) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const out = []; let p = 100; const t0 = Date.UTC(2021, 0, 4) / 1000;
  for (let i = 0; i < n; i++) {
    const o = p; p += (rnd() - 0.5) * 0.25 + Math.sin(i / 900) * 0.02;
    out.push({ t: t0 + i * 300, o, h: Math.max(o, p) + rnd() * 0.08, l: Math.min(o, p) - rnd() * 0.08, c: p, e: t0 + i * 300 + 300 });
  }
  return out;
}

test('ATR is known at the close of its candle', () => {
  const L = market(400).slice(0, 40); const A = atrs(L);
  assert.ok(Number.isNaN(A[12]) && Number.isFinite(A[13]));
  const B = L.map((x) => ({ ...x })); B[30].h += 50; const A2 = atrs(B);
  for (let i = 0; i < 30; i++) assert.ok(Object.is(A[i], A2[i]) || A[i] === A2[i]);
});

test('every signal has its stop on the losing side; targets used are 3R or more', () => {
  const F = frames(market()); const Z = targetZones(F['4h'], F['1d']);
  const sigs = [...signalsA(F['1h'], 3600, 0.02), ...signalsA(F['4h'], 14400, 0.02), ...signalsB(F['1h'], 0.02)];
  assert.ok(sigs.length > 100);
  let used = 0;
  for (const g of sigs) {
    assert.ok(g.s * (g.entry - g.stop) > 0, 'stop on the losing side');
    const tgt = targetFor(Z, g.s, g.entry, g.T);
    if (tgt != null) { assert.ok(g.s * (tgt - g.entry) > 0); if ((g.s * (tgt - g.entry)) / (g.s * (g.entry - g.stop)) >= P.minRR) used++; }
  }
  assert.ok(used > 0);
});

test('no look-ahead: signals and targets before a cut are the same from the cut candles', () => {
  const M5 = market(); const F = frames(M5); const Zf = targetZones(F['4h'], F['1d']);
  for (const frac of [0.37, 0.58, 0.81]) {
    const cut = M5[Math.floor(M5.length * frac)].t; const G = frames(M5.filter((b) => b.e <= cut)); const Zc = targetZones(G['4h'], G['1d']);
    const key = (list, Z) => list.filter((x) => x.T <= cut).map((x) => [x.s, x.T, x.entry, x.stop, targetFor(Z, x.s, x.entry, x.T)].join());
    assert.deepEqual(key(signalsA(F['1h'], 3600, 0.02), Zf), key(signalsA(G['1h'], 3600, 0.02), Zc));
    assert.deepEqual(key(signalsA(F['4h'], 14400, 0.02), Zf), key(signalsA(G['4h'], 14400, 0.02), Zc));
    assert.deepEqual(key(signalsB(F['1h'], 0.02), Zf), key(signalsB(G['1h'], 0.02), Zc));
  }
});

test('RESULT.md says what result.json says', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const line3 = md.split('\n')[2];
  assert.match(line3, new RegExp(`^\\*\\*Verdict: ${R.verdict}\\.`));
  assert.equal(R.judged.some((x) => x.pass), R.verdict === 'PASS');
  for (const k of ['T1', 'T2', 'T3']) {
    const c = R.tests[k].net.confirmation, d = R.tests[k].net.discovery;
    assert.ok(md.includes(c.n.toLocaleString('en-US')), `${k} confirmation n in RESULT.md`);
    assert.ok(md.includes(d.n.toLocaleString('en-US')), `${k} discovery n in RESULT.md`);
    assert.ok(md.includes(c.tMonth.toFixed(2)), `${k} confirmation t in RESULT.md`);
  }
});
