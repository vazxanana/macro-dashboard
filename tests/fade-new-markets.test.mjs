// tests/fade-new-markets.test.mjs - the fade-new-markets study: its report agrees with its result.json, the gate, the bar,
// and the runner's pieces on hand-made candles (offline: no candle cache needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as S from '../research/edge/fade-new-markets/run.mjs';

const DIR = new URL('../research/edge/fade-new-markets/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

test('RESULT.md line 3 carries the verdict and the headline of result.json', () => {
  const line = MD.split('\n')[2];
  assert.equal(line, `**Verdict: ${R.verdict}. ${R.headline}.**`);
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE'].includes(R.verdict));
});

test('the five rules are the pre-registered ones, and the gate reproduced grid7-wide-fade exactly', () => {
  assert.deepEqual(R.rules.map((r) => r.rule), S.RULES.map((r) => r.name));
  for (const r of S.RULES) assert.ok(PRE.includes(`**${r.name}**`), r.name);
  assert.equal(R.gate.length, 5); assert.ok(R.gateOk);
  const g7 = JSON.parse(fs.readFileSync(new URL('../research/edge/grid7-wide-fade/result.json', import.meta.url), 'utf8'));
  for (const g of R.gate) { const want = g7.perMarket[g.rule].find((x) => x.market === 'eurusd').c;
    for (const k of ['n', 'mean', 't', 'meanNet']) assert.equal(g.got[k], want[k], g.rule + ' ' + k); }
});

test('the bar: mean > 0, month t >= 2 and Holm p < 0.05 on both tests; the verdict follows', () => {
  for (const r of R.rules) {
    const ok = (w, h) => w.mean > 0 && w.t >= 2 && h < 0.05;
    assert.equal(r.passA, ok(r.A, r.holmA), r.rule); assert.equal(r.passB, ok(r.B, r.holmB), r.rule);
    assert.equal(r.pass, r.passA && r.passB);
  }
  const want = !R.gateOk || R.marketsA.length < 6 || R.marketsB.length < 6 ? 'INCONCLUSIVE' : R.rules.some((r) => r.pass) ? 'PASS' : 'FAIL';
  assert.equal(R.verdict, want);
  assert.deepEqual(R.passed, R.rules.filter((r) => r.pass).map((r) => r.rule));
  assert.deepEqual(R.marketsA, S.A_MARKETS); assert.deepEqual(R.marketsB, S.B_MARKETS);
});

test('the RESULT.md table shows every rule\'s figures from result.json', () => {
  for (const r of R.rules) {
    const row = MD.split('\n').find((l) => l.startsWith(`| ${r.rule} | ${Math.round(r.A.n).toLocaleString('en-US')} |`));
    assert.ok(row, r.rule);
    assert.ok(row.includes(`${f3(r.A.mean)} (${r.A.t.toFixed(2)})`) && row.includes(`${f3(r.B.mean)} (${r.B.t.toFixed(2)})`), r.rule);
    assert.ok(row.endsWith(r.pass ? '| yes |' : '| no |'));
  }
});

test('the cut test found no signal that moves when the candles are cut', () => {
  assert.ok(R.cut.length >= 10);
  for (const c of R.cut) { assert.equal(c.missing, 0, c.series + ' ' + c.cut); assert.equal(c.extra, 0, c.series + ' ' + c.cut); }
});

test('costs are said to be assumed where they are, and nothing names an edge', () => {
  assert.deepEqual(R.assumedCostsA, S.A_MARKETS);
  assert.ok(/ASSUMED, not measured/.test(MD));
  assert.ok(!/\bis an edge\b|\bproven edge\b/i.test(MD));
});

// ---- the runner on hand-made candles ------------------------------------------------------------------------------------
function walk(n, seed = 7) { let x = seed; const r = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let p = 100; const t0 = Date.UTC(2019, 0, 7) / 1000;
  for (let i = 0; i < n; i++) { const o = p, c = o + (r() - 0.5) * 0.4 + Math.sin(i / 50) * 0.05; const h = Math.max(o, c) + r() * 0.1, l = Math.min(o, c) - r() * 0.1;
    out.push({ t: t0 + i * 300, o, h, l, c, e: t0 + i * 300 + 300 }); p = c; }
  return out; }

test('runSeries: every fade trade is booked against the break and the mirror is its opposite at 2R', () => {
  const M5 = walk(6000);
  const r = S.runSeries(M5, { market: 'eurusd', cost: 0.01, from: M5[0].t, to: M5[M5.length - 1].e });
  assert.equal(r.wrong, 0); assert.ok(r.sims > 50);
  r.acc.forEach((a) => { const n = a.fade.n.reduce((p, q) => p + q, 0); const nb = a.buy.n.reduce((p, q) => p + q, 0), ns = a.sell.n.reduce((p, q) => p + q, 0);
    assert.equal(n, nb + ns); assert.equal(n, a.mirror.n.reduce((p, q) => p + q, 0)); });
});

test('the cut test helper: signals known by a date do not change when later candles are removed', () => {
  const M5 = walk(5000, 11); const T = new Date((M5[3000].t) * 1000).toISOString().slice(0, 10);
  const out = S.cutSignals(M5, 'walk', [T]);
  assert.equal(out.length, 1); assert.ok(out[0].n > 0); assert.equal(out[0].missing + out[0].extra, 0);
});
