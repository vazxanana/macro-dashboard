// mosha-cf-cases-2020: the report against result.json, and the study's own pieces on hand-made data (offline, no candle cache).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { welch, deepBeforeCF, KEEP, PRIMARY, OTHERS } from '../research/edge/mosha-cf-cases-2020/run.mjs';

const DIR = new URL('../research/edge/mosha-cf-cases-2020/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');
const f = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);

test('RESULT.md line 3 carries the verdict and headline of result.json', () => {
  const line = MD.split('\n')[2];
  assert.match(line, /^\*\*Verdict: (PASS|FAIL|INCONCLUSIVE)\. /);
  assert.ok(line.startsWith(`**Verdict: ${R.verdict}. ${R.headline}.**`));
  assert.ok(['PASS', 'FAIL', 'INCONCLUSIVE', 'INVALID'].includes(R.verdict));
});

test('the verdict follows the pre-registered rule', () => {
  const T = R.tests;
  assert.equal(R.cutTest.ok, true);
  const inconc = [T.T1, T.T2, T.T3].some((t) => /^INCONCLUSIVE/.test(t.verdict));
  assert.equal(R.verdict, T.T3.verdict === 'PASS' ? 'PASS' : inconc ? 'INCONCLUSIVE' : 'FAIL');
  for (const id of ['T1', 'T2', 'T3']) if (T[id].verdict === 'PASS') assert.ok(Object.values(T[id].checks).every(Boolean), id);
  assert.ok(T.T3.holm >= T.T3.p - 1e-12 && T.T1.holm >= T.T1.p - 1e-12 && T.T2.holm >= T.T2.p - 1e-12);
});

test('the tables of RESULT.md are the figures of result.json', () => {
  const T = R.tests;
  for (const id of ['T1', 'T2']) for (const w of ['disc', 'conf']) { const x = T[id][w];
    assert.ok(MD.includes(`| ${x.a.n} | ${f(x.a.mean)} | ${x.b.n} | ${f(x.b.mean)} | ${f(x.diff)} | ${x.t} |`), `${id} ${w}`); }
  for (const w of ['disc', 'conf']) { const x = T.T3[w];
    assert.ok(MD.includes(`| ${x.net.n} | ${x.net.win} | ${f(x.net.mean)} | ${x.net.tMonth} | ${f(x.gross.mean)} | ${f(x.net2.mean)} |`), `T3 ${w}`); }
  for (const [mk, x] of Object.entries(R.perMarket)) assert.ok(MD.includes(`| ${mk} | ${x.kept} | ${x.case1} / ${x.case2} |`), mk);
  assert.equal(Object.keys(R.perMarket).length, PRIMARY.length + OTHERS.length);
});

test('the pre-registration names the three tests and the bar, and no outside source', () => {
  for (const s of ['**T1**', '**T2**', '**T3**', 'Holm over T1-T3', 'month-sum']) assert.ok(PRE.includes(s), s);
  for (const doc of [PRE, MD]) assert.doesNotMatch(doc, /zlankator|pitchou|egsolutions|berg\b|l3xus|luxus|private room|s\.code/i);
});

test('kept ids: the main sequence EG entries only', () => {
  for (const id of ['sop-15m-1', 'sop-c2-5m-2', 'sop-i-1h-3', 'sop-c2-i-4h-4', 'eurusd:sop-30m-5']) assert.ok(KEEP.test(id), id);
  for (const id of ['sop-vr-15m-s1', 'sop-vc-5m-b2', 'sop-l-15m-b3', 'sop-nv-5m-4', 'sop-nc-5m-5', 'bar-h4-1']) assert.ok(!KEEP.test(id), id);
});

test('Welch t on hand-made samples', () => {
  const w = welch([1, 2, 3, 4], [0, 0, 1, 1]);
  assert.ok(Math.abs(w.diff - 2) < 1e-12);
  assert.ok(Math.abs(w.t - 2 / Math.sqrt(1.6667 / 4 + 0.3333 / 4)) < 1e-3);
  assert.ok(w.p > 0 && w.p < 0.1);
  assert.equal(welch([1], [2, 3]).t, null);
});

test('pullback past 50 % before the CF: only candles after the extreme and closed by the CF candle count', () => {
  const bar = (t, h, l) => ({ t, o: (h + l) / 2, h, l, c: (h + l) / 2, e: t + 300 });
  // a buy: BO at 0, extreme 110 at t=600, 50 % line 100, CF candle closes at 1800
  const M5 = [bar(0, 105, 99), bar(300, 108, 102), bar(600, 110, 104), bar(900, 106, 101), bar(1200, 105, 102), bar(1500, 104, 103), bar(1800, 104, 95)];
  const rec = { side: 1, target: 110, marks: [{ kind: 'level', p: 101, a: 0 }, { kind: 'vr', a: 900, at: 1200 }, { kind: 'zone', a: 1500, at: 1800 }, { kind: 'level', p: 100, label: '50% of the range' }] };
  assert.equal(deepBeforeCF(rec, M5), false);       // the 95 low comes after the CF candle closed; the 99 low before the extreme does not count
  const M5b = M5.map((b) => (b.t === 1200 ? bar(1200, 105, 99.5) : b));
  assert.equal(deepBeforeCF(rec, M5b), true);
  assert.equal(deepBeforeCF({ ...rec, marks: rec.marks.slice(0, 3) }, M5), null);   // no 50 % line
});

test('the before-cost verdict leads, on the same bar without the cost checks', () => {
  assert.ok(MD.includes(`**Before costs (the owner's request after the pre-registration; a second verdict on the same bar with the cost checks dropped, its own Holm): ${R.verdictBeforeCosts}. ${R.headlineBeforeCosts}.**`));
  assert.ok(MD.indexOf('## Every test before costs') < MD.indexOf('## After costs'));
  const T = R.tests, inc = [T.T1.pre, T.T2.pre, T.T3.pre].some((x) => /^INCONCLUSIVE/.test(x.verdict));
  assert.equal(R.verdictBeforeCosts, T.T3.pre.verdict === 'PASS' ? 'PASS' : inc ? 'INCONCLUSIVE' : 'FAIL');
  for (const id of ['T1', 'T2']) { for (const k of ['disc', 'conf']) { const x = T[id].pre[k], y = T[id][k];
      assert.ok(MD.includes(`| ${x.a.n} | ${f(x.a.mean)} | ${x.a.tMonth ?? 'n/a'} | ${f(y.a.mean)} | ${y.a.tMonth ?? 'n/a'} |`), `${id} ${k} a`);
      assert.ok(MD.includes(`| ${f(x.diff)} (Welch t ${x.t ?? 'n/a'}) |`), `${id} ${k} diff`);
      assert.equal(x.a.n, y.a.n); assert.equal(x.b.n, y.b.n); }
    assert.ok(!('sameSignAt2xCost' in T[id].pre.checks)); }
  for (const k of ['disc', 'conf']) { const g = T.T3[k].gross, n = T.T3[k].net;
    assert.ok(MD.includes(`| clear-CF sequence | ${g.n} | ${f(g.mean)} | ${g.tMonth ?? 'n/a'} | ${f(n.mean)} | ${n.tMonth ?? 'n/a'} |`), k);
    assert.ok(g.mean >= n.mean); }
});
