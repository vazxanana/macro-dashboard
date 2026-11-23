// tests/drd-h4-2020.test.mjs - research/edge/drd-h4-2020: the report says what result.json says, no look-ahead on a seeded
// market, every trade's stop on the losing side, the pip sizes, the 2-a-day cap. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signals, trades, pip, P, MARKETS } from '../research/edge/drd-h4-2020/run.mjs';

const dir = new URL('../research/edge/drd-h4-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', dir), 'utf8'));
const md = fs.readFileSync(new URL('RESULT.md', dir), 'utf8');

test('RESULT.md line 3 carries the verdict and the T1 figures of result.json', () => {
  const l3 = md.split('\n')[2];
  assert.match(l3, new RegExp(`^\\*\\*Verdict: ${R.verdict}\\.`));
  const t = R.tests.T1.conf;
  assert.ok(l3.includes(String(t.n)) && l3.includes(t.meanR.toFixed(3)) && l3.includes(t.tMonth.toFixed(2)), l3);
  for (const T of ['T1', 'T2', 'T3']) for (const w of ['disc', 'conf']) {
    const x = R.tests[T][w]; assert.ok(md.includes(`| ${T} | ${w === 'disc' ? 'discovery' : 'confirmation'} | ${x.n} | ${x.meanR.toFixed(3)} | ${x.tMonth.toFixed(2)} |`), T + ' ' + w); }
  assert.equal(R.markets.length, 18); assert.deepEqual(R.markets, MARKETS);
  assert.equal(R.cutTest.mismatchedCuts, 0); assert.ok(R.cutTest.signalsChecked > 100);
});

test('the pass bar as pre-registered', () => {
  for (const T of ['T1', 'T2', 'T3']) { const j = R.tests[T];
    const ok = j.disc.n >= 100 && j.disc.meanR > 0 && j.disc.tMonth >= 2 && j.conf.n >= 50 && j.conf.meanR > 0 && j.conf.tMonth >= 2 && j.pConfHolm <= 0.0228 && j.disc2x > 0 && j.conf2x > 0;
    assert.equal(j.pass, ok, T); }
  const n = ['T1', 'T2', 'T3'].filter((T) => R.tests[T].pass).length;
  if (n) assert.equal(R.verdict, 'PASS'); else assert.notEqual(R.verdict, 'PASS');
});

test('pips: 30 pips in each market\'s own pip', () => {
  assert.equal(pip('xau'), 0.1); assert.equal(pip('xag'), 0.01); assert.equal(pip('nas100'), 1);
  assert.ok(Math.abs(pip('eurusd') - 0.0001) < 1e-12); assert.equal(pip('euraud'), 0.0001); assert.equal(pip('eurgbp'), 0.0001);
  assert.ok(Math.abs(pip('usdjpy') - 0.01) < 1e-12); assert.equal(pip('cadjpy'), 0.01); assert.equal(P.stopPips, 30); assert.equal(P.rr, 3);
});

function seeded(n, seed = 11) {
  let a = seed, px = 1.3; const out = []; const t0 = Date.UTC(2019, 9, 1) / 1000;
  for (let i = 0; i < n; i++) { a = (a * 1103515245 + 12345) % 2147483648; const r = a / 2147483648 - 0.5; const o = px; px = Math.max(0.5, px + r * 0.0016);
    const h = Math.max(o, px) + Math.abs(r) * 0.0005, l = Math.min(o, px) - Math.abs(r) * 0.0005; const t = t0 + i * 300;
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue; out.push({ t, o, h, l, c: px, e: t + 300 }); }
  return out;
}
const M5 = seeded(130000);
const key = (s) => [s.side, s.t, s.level, s.boT, s.strong, s.rejLo, s.rejHi].join('|');

test('no look-ahead: signals from cut candles equal the whole-file signals known by the cut', () => {
  const full = signals(M5); let n = 0;
  for (const k of [60000, 90000, 120000]) { const T = M5[k].e;
    const a = signals(M5.filter((b) => b.e <= T)).filter((s) => s.t <= T).map(key), b = full.filter((s) => s.t <= T).map(key);
    assert.deepEqual(a, b); n += b.length; }
  assert.ok(n > 30, 'signals ' + n);
});

test('every trade has its stop on the losing side; at most 2 fills a UTC day', () => {
  const sig = signals(M5).map((s) => ({ ...s, t: Math.max(s.t, Date.UTC(2020, 0, 1) / 1000) }));
  for (const T of ['T1', 'T2', 'T3']) { const xs = trades(M5, sig, 'eurusd', T);
    assert.ok(xs.length > 0, T);
    const per = {}; for (const x of xs) { const d = Math.floor(x.t / 86400); per[d] = (per[d] || 0) + 1; assert.ok(per[d] <= 2);
      assert.ok(x.side * (x.entry - x.stop) > 0, 'stop on the losing side'); assert.ok(x.costR > 0); assert.ok(x.R >= -1.5 && x.R <= 3.0001, String(x.R)); } }
});
