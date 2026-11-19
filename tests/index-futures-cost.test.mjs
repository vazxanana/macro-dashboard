// index-futures-cost: the trades of index-overnight, index-ibs and turn-of-month re-costed as CME micro futures
// (research/edge/index-futures-cost). Offline: the gates from the stored rows, the cost model on hand-made trades, and
// RESULT.md / result.json against what run.mjs computes now.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../research/edge/index-futures-cost/run.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'research/edge/index-futures-cost');
const rates = JSON.parse(fs.readFileSync(path.join(DIR, 'rates.json'), 'utf8'));
const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
const now = JSON.parse(JSON.stringify(M.analyse(M.loadRows(), rates)));   // as written to result.json

test('gates: the stored rows reproduce every published figure of the three studies', () => {
  assert.equal(now.gates.G2G3, 'passed', now.gates.failures.join('; '));
  assert.deepEqual(now.gates.failures, []);
  // a few by hand, against the branches' result.json (PUBLISHED)
  const o = now.studies.overnight.tests, i = now.studies.ibs.tests, t = now.studies.tom.tests;
  assert.equal(o.T1.decisive.n, 2721); assert.equal(o.T1.decisive.gross, 0.023); assert.equal(o.T1.decisive.cfdNet, -0.022);
  assert.equal(o.T2.replication.t_gross, 4.65);
  assert.equal(i.T2.decisive.gross, 0.096); assert.equal(i.T2.decisive.cfdNet, 0.056); assert.equal(i.T2.decisive.t_cfdNet, 1.65);
  assert.equal(i.P.decisive.n, 1414);
  assert.equal(t.spx500.oos.gross, 0.102); assert.equal(t.nas100.oos.gross, 0.389); assert.equal(t.spx500.oos.tt_cfdNet, -0.1);
  assert.deepEqual(i.T2.decisive.placebo.cfd, M.PUBLISHED.ibs['T2.decisive'].place);
  assert.deepEqual(o.T1.decisive.placebo.cfd, M.PUBLISHED.overnight['T1.decisive'].place);
});

test('the trades are the studies\' own: same counts, never re-selected', () => {
  const R = M.loadRows();
  assert.equal(R.overnight.tests.T1.rows.length, R.overnight.tests.T2.rows.length);
  for (const [s, ids] of [['overnight', ['T1', 'T2']], ['ibs', ['T1', 'T2', 'T3']], ['tom', ['spx500', 'us30', 'nas100']]])
    for (const id of ids) for (const r of R[s].tests[id].rows) {
      const entry = s === 'overnight' ? r[3] : r[2], stop = s === 'overnight' ? r[4] : r[3];
      assert.ok(stop < entry, `${s} ${id}: every trade is a long with its stop under the entry`);
    }
});

test('cost model on hand-made trades', () => {
  const R2 = { before2006: 3.85, DGS2: [['2020-01-03', 2], ['2024-01-05', 4]], divYield: { spx: { 2005: 1.5, 2020: 1.5, 2024: 1.5 }, ndx: { 2005: 1, 2024: 1 }, dji: { 2005: 2, 2024: 2 } } };
  const x = { entry: 5000, stop: 4950, entryD: '2024-03-01', exitD: '2024-03-02', days: 1 };
  const c = M.futCost(x, 'spx500', R2);
  assert.equal(c.tick, 0.5); assert.ok(Math.abs(c.comm - 0.248) < 1e-12);
  assert.ok(Math.abs(c.carry - (0.04 - 0.015) * 1 / 365 * 5000) < 1e-12);
  assert.equal(c.rolls, 0); assert.ok(Math.abs(c.total - (0.5 + 0.248 + c.carry)) < 1e-12);
  // in R: (0.748 + carry) / 50
  const k = M.costed('ibs', 'spx500', { ...x, gross: 0.1, cfdNet: 0.05 }, R2);
  assert.ok(Math.abs(k.fut - (0.1 - c.total / 50)) < 1e-12);
  // F2 all-in, F3 no dividend, doubled trading cost
  assert.ok(Math.abs(M.futCost(x, 'spx500', R2, { mode: 'F2' }).total - (1.0 + c.carry)) < 1e-12);
  assert.ok(Math.abs(M.futCost(x, 'spx500', R2, { mode: 'F3' }).carry - 0.04 / 365 * 5000) < 1e-12);
  assert.ok(Math.abs(M.futCost(x, 'spx500', R2, { mult: 2 }).total - (1.496 + c.carry)) < 1e-12);
  // MNQ and MYM ticks and commission in points
  const n = M.futCost({ ...x, entry: 20000, stop: 19700 }, 'nas100', R2), y = M.futCost({ ...x, entry: 40000, stop: 39600 }, 'us30', R2);
  assert.equal(n.tick, 0.5); assert.ok(Math.abs(n.comm - 0.62) < 1e-12);
  assert.equal(y.tick, 2); assert.ok(Math.abs(y.comm - 2.48) < 1e-12);
  // carry is a credit when the dividend yield is above the rate (not floored), before 2006 the stated 3.85 %
  const old = M.futCost({ ...x, entryD: '2005-06-01', exitD: '2005-06-02' }, 'us30', R2);
  assert.equal(old.r, 3.85);
  const low = M.futCost({ ...x, entryD: '2020-06-01', exitD: '2020-06-02' }, 'us30', { ...R2, DGS2: [['2020-01-03', 0.2]] });
  assert.ok(low.carry < 0);
  // days from dates when none is given; turn-of-month's unit is 1 % of the entry
  assert.equal(M.futCost({ entry: 5000, entryD: '2024-03-01', exitD: '2024-03-05' }, 'spx500', R2).days, 4);
  assert.equal(M.unitOf('tom', { entry: 5000, stop: 4800 }), 50);
  assert.equal(M.unitOf('overnight', { entry: 5000, stop: 4800 }), 200);
  // rolls: 8 days before the third Friday of a quarter month (council/futures.mjs index rule)
  assert.equal(M.rollDate(2026, 3), '2026-03-12');
  assert.equal(M.rollDate(2026, 12), '2026-12-10');
  assert.equal(M.rollsBetween('2026-03-10', '2026-03-15'), 1);
  assert.equal(M.rollsBetween('2026-03-12', '2026-03-13'), 0);
  const rolled = M.futCost({ entry: 5000, entryD: '2026-03-10', exitD: '2026-03-15' }, 'spx500', R2);
  assert.ok(Math.abs(rolled.roll - 0.748) < 1e-12);
});

test('rates: DGS2 is the gold-carry copy; dividend yields are marked as from memory', () => {
  const gc = JSON.parse(fs.readFileSync(path.join(ROOT, 'research/edge/gold-carry/rates.json'), 'utf8'));
  assert.deepEqual(rates.DGS2, gc.DGS2);
  assert.match(rates.note, /FROM MEMORY, NOT VERIFIED/);
  for (const k of ['spx', 'ndx', 'dji']) for (let y = 2005; y <= 2026; y++) assert.ok(rates.divYield[k][y] > 0 && rates.divYield[k][y] < 4, `${k} ${y}`);
});

test('result.json is what run.mjs computes now, and RESULT.md is its report', () => {
  for (const s of ['overnight', 'ibs', 'tom']) {
    assert.deepEqual(res.studies[s].tests, now.studies[s].tests, s);
    assert.deepEqual(res.studies[s].conditions, now.studies[s].conditions, s);
    assert.equal(res.studies[s].verdictOnFutures, now.studies[s].verdictOnFutures);
    assert.equal(res.studies[s].published, 'FAIL');
  }
  assert.equal(res.verdict, M.verdictLine(res));
  assert.match(res.verdict, /^INCONCLUSIVE \(cost accounting, no rule tested; no study's verdict changes\)/);
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.equal(md, M.report(res));
  assert.ok(md.includes('not evidence of an edge') && md.includes('own forward record'));
  // the figures quoted in the reading are the result's
  const i = res.studies.ibs.tests.T2.decisive, o = res.studies.overnight.tests.T2;
  assert.ok(md.includes(`+${i.fut.toFixed(3)}R a trade on 2016-now (n ${i.n}, month-sum t ${i.t_fut.toFixed(2)}, Holm p ${res.studies.ibs.conditions.T2.holmP}`));
  assert.ok(md.includes(`+${o.decisive.fut.toFixed(3)}R, t ${o.decisive.t_fut.toFixed(2)}, Holm p ${res.studies.overnight.conditions.T2.holmP}`));
});

test('cost accounting only: no council, mirror or live import', () => {
  for (const f of ['run.mjs', 'dump.mjs']) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
    for (const m of imports) assert.ok(m.startsWith('node:') || m === './run.mjs', `${f} imports ${m}`);
  }
});
