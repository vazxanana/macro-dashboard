// geg-silver: the Gold daily engulf rule on silver. The harness's rule against the Trader's block, its stops, the month-sum t,
// the pre-registration committed before the result, and the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { EG, SILVER, GOLD_GATE, WINDOWS, simulate, positions, monthT, verdictOf } from '../research/edge/geg-silver/run.mjs';

const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const TRADER = rd('../council/trader.mjs'), RUN = rd('../research/edge/geg-silver/run.mjs');
const DIR = '../research/edge/geg-silver/';

test('the rule parameters are the Trader\'s, and silver\'s numbers are the pre-registered ones', () => {
  const m = TRADER.match(/c\.goldEG = (\{[^}]+\})/); assert.ok(m, 'goldEG rule in trader.mjs');
  assert.deepEqual(EG, Function(`return ${m[1]}`)());
  assert.deepEqual(SILVER, { pad: 0.004, dp: 4, costPct: 0.001, finNight: 0.00015 });
  assert.equal(GOLD_GATE.pad, 0.3); assert.equal(GOLD_GATE.costAbs, 0.3);
  assert.deepEqual(WINDOWS, { rep: ['2006-07-01', '2020-01-01'], is: ['2020-01-01', '2024-01-01'], oos: ['2024-01-01', '2026-11-17'] });
  const pre = rd(DIR + 'PREREGISTRATION.md');
  for (const s of ['$0.004', '4 decimals', '0.10 % of the entry price', '0.015 % of the entry price', 'month-sum t >= 2.0', 'n within\n3 %']) assert.ok(pre.includes(s), s);
});

test('the signal, the order and the zone cancel are the Trader\'s block, word for word but for the names', () => {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  // the confirming candle and its base
  const tBase = 'if (last.close > last.open) for (let j = n - 2; j >= n - 1 - EG.k && j >= 0; j--) { const b = D[j]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }';
  const rBase = 'if (last.close > last.open) for (let q = nd - 2; q >= nd - 1 - EG.k && q >= 0; q--) { const b = D1[q]; if (b.open > b.close) { if (last.close > b.high) base = b; break; } if (b.close < b.open) break; }';
  assert.ok(norm(TRADER).includes(norm(tBase)), 'trader base walk'); assert.ok(norm(RUN).includes(norm(rBase)), 'harness base walk');
  // zone cancel, entry and stop
  const zone = "if (tr.zone && last.time > (tr.lastD || 0) && last.close < tr.zone[0]) { tr.status = 'expired'; tr.closed = now; tr.R = 0; tr.exit = 'zone failed'; }";
  assert.ok(TRADER.includes(zone) && RUN.includes(zone), 'zone cancel');
  assert.ok(TRADER.includes('const entry = +base.high.toFixed(dp), stop = +(base.low - EG.pad).toFixed(dp), r0 = entry - stop;'));
  assert.ok(RUN.includes('const entry = fx(base.high), stop = fx(base.low - pad), r0 = entry - stop;'));
  assert.ok(TRADER.includes('if (r0 > 0 && price > entry)') && RUN.includes('if (r0 > 0 && price > entry)'));
  for (const s of ['t1: +(entry + 10 * r0).toFixed(dp)', 'rr: 10, trail: [2, 1]', 'validFor: EG.life * 86400, maxHold: EG.hold * 3600']) assert.ok(TRADER.includes(s), s);
  for (const s of ['t1: fx(entry + 10 * r0), rr: 10, trail: [2, 1]', 'validFor: EG.life * 86400, maxHold: EG.hold * 3600']) assert.ok(RUN.includes(s), s);
  // trading days: both fold the weekend with fills.mjs foldWeekend; the Trader's freshness is gegFresh (the harness: the reopen window)
  assert.ok(/D = foldWeekend\(src\['1d'\]\.bars/.test(TRADER) && RUN.includes('D1 = foldWeekend(D1raw)'));
  assert.ok(TRADER.includes('gegFresh(last.time, now) && openCnt < EG.maxOpen') && RUN.includes('now - REOPEN[nd - 1] < 86400'));
});

// a synthetic gold-like path: weekdays only, a slow rise with daily swings, so the rule places and manages orders
function synth(days = 90, p0 = 25) {
  const M5 = [], D1 = []; let px = p0, t = Date.parse('2024-01-01T00:00:00Z') / 1000;
  for (let d = 0; d < days; d++, t += 86400) {
    const wd = new Date(t * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    const dir = Math.sin(d * 1.7) > -0.2 ? 1 : -1, o = px; let hi = px, lo = px;
    for (let i = 0; i < 288; i++) { const a = px, b = +(px + dir * 0.0012 + Math.sin(i / 9 + d) * 0.004).toFixed(4);
      const h = Math.max(a, b) + 0.002, l = Math.min(a, b) - 0.002; M5.push({ time: t + i * 300, open: a, high: h, low: l, close: b }); hi = Math.max(hi, h); lo = Math.min(lo, l); px = b; }
    D1.push({ time: t, open: o, high: hi, low: lo, close: px });
  }
  return { M5, D1 };
}

test('every order of the harness has its stop under its entry, and a closed trade has a finite R', () => {
  const { M5, D1 } = synth();
  const legs = simulate(M5, D1, { pad: SILVER.pad, dp: SILVER.dp });
  assert.ok(legs.length > 0, 'the synthetic path places orders');
  for (const x of legs) { assert.ok(x.stop < x.entry, x.id); assert.ok(x.r0 > 0); if (x.status === 'closed') assert.ok(Number.isFinite(x.R)); }
  const one = simulate(M5, D1, { pad: SILVER.pad, dp: SILVER.dp, maxOpen: 1 });
  for (const x of one) assert.ok(x.stop < x.entry);
  const P = positions(legs, { costPct: SILVER.costPct, finNight: SILVER.finNight });
  for (const p of P) { assert.ok(p.n <= p.g + 1e-12); assert.ok(p.n2 <= p.n + 1e-12); }
});

test('month-sum t counts every calendar month of the window, empty ones as 0', () => {
  const ts = (s) => Date.parse(s) / 1000;
  const rows = [{ c: ts('2024-01-10T00:00:00Z'), n: 1 }, { c: ts('2024-03-05T00:00:00Z'), n: 2 }, { c: ts('2024-05-01T00:00:00Z'), n: 1 }];
  const m = monthT(rows, '2024-01-01', '2024-04-01');
  assert.equal(m.months, 3); assert.equal(m.positive, 2);
  // [1, 0, 2 + 1 (closed after the window: its last month)] -> mean 4/3, sd sqrt(((1-4/3)^2 + (4/3)^2 + (3-4/3)^2) / 2)
  const mean = 4 / 3, sd = Math.sqrt(((1 - mean) ** 2 + mean ** 2 + (3 - mean) ** 2) / 2);
  assert.equal(m.t, Math.round(mean / sd * Math.sqrt(3) * 100) / 100);
});

test('the pre-registration was committed alone, before the result', (t) => {
  let log;
  try { log = (f) => execFileSync('git', ['log', '--diff-filter=A', '--format=%H %ct', '--', f], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim().split('\n').at(-1); }
  catch { t.skip('no git'); return; }
  const pre = log('research/edge/geg-silver/PREREGISTRATION.md'), res = log('research/edge/geg-silver/result.json');
  if (!pre || !res) { t.skip('history not available'); return; }
  const [ph, pt] = pre.split(' '), [rh, rt] = res.split(' ');
  if (ph === rh) { t.skip('shallow history: both files in one commit'); return; }
  assert.ok(+pt <= +rt, 'pre-registration first');
  const files = execFileSync('git', ['show', '--name-only', '--format=', ph], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(files, ['research/edge/geg-silver/PREREGISTRATION.md']);
});

test('the report says what result.json holds', () => {
  const r = JSON.parse(rd(DIR + 'result.json')), md = rd(DIR + 'RESULT.md');
  assert.ok(r.gate.passed, 'parity gate on gold');
  for (const w of Object.values(r.gate.windows)) assert.ok(md.includes(`n ${w.got.n}`) && md.includes(`${w.got.mean >= 0 ? '+' : '−'}${Math.abs(w.got.mean).toFixed(3)}R`));
  assert.ok(['PASS', 'FAIL'].includes(r.verdict));
  assert.deepEqual(verdictOf(r.silver.windows), r.decision);
  assert.equal(r.verdict, r.decision.verdict);
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}`));
  const sg = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}`;
  for (const k of ['rep', 'is', 'oos']) { const w = r.silver.windows[k];
    assert.ok(md.includes(`| ${w.x1.n} | ${sg(w.x1.mean)} | ${sg(w.x2.mean)} | ${w.x1.t.toFixed(2).replace('-', '−')} | ${w.month.t.toFixed(2).replace('-', '−')} |`), k); }
  if (r.verdict === 'PASS') assert.match(md, /paper shadow to watch, never live/);
  assert.ok(!/\bnow live\b/i.test(md));
});
