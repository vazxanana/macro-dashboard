// Cost floor map (research/edge/cost-floor-map): offline. The formulas on hand-made inputs, and the committed report
// against the committed result.json, rebuilt from the committed collected.json. Needs no other branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaleOf, breakEvenCost, t2Cost, grossT, demoPct, demoCost, analyse, report, tableRow } from '../research/edge/cost-floor-map/run.mjs';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'cost-floor-map');
const collected = JSON.parse(readFileSync(join(DIR, 'collected.json'), 'utf8'));
const result = JSON.parse(readFileSync(join(DIR, 'result.json'), 'utf8'));
const md = readFileSync(join(DIR, 'RESULT.md'), 'utf8');
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('break-even cost is the gross mean; t-2 cost is gross - 2 s', () => {
  // gross 0.30, net 0.10 at t 1: s = 0.10 a unit of t, so t = 2 at a mean of 0.20, i.e. a cost of 0.10.
  const row = { gross: 0.3, net: 0.1, tNet: 1, tGross: null };
  close(breakEvenCost(row), 0.3);
  close(scaleOf(row).s, 0.1);
  close(t2Cost(row), 0.1);
  close(grossT(row), 3);
  // At the t-2 cost the net t is exactly 2, at the break-even cost the net mean is exactly 0.
  const s = scaleOf(row).s;
  close((row.gross - t2Cost(row)) / s, 2);
  close(row.gross - breakEvenCost(row), 0);
});

test('both t stored: s from their difference; small differences fall back', () => {
  close(scaleOf({ gross: 0.2, net: -0.1, tNet: -1, tGross: 2 }).s, 0.1);
  assert.equal(scaleOf({ gross: 0.2, net: -0.1, tNet: -1, tGross: 2 }).how, 'both t stored');
  // tGross - tNet under 0.1: use net / tNet.
  close(scaleOf({ gross: 0.21, net: 0.2, tNet: 2, tGross: 2.05 }).s, 0.1);
  // no usable t at all
  assert.equal(scaleOf({ gross: 0.1, net: 0.0, tNet: 0.05, tGross: null }).s, null);
  assert.equal(t2Cost({ gross: 0.1, net: 0.0, tNet: 0.05, tGross: null }), null);
  // a negative t-2 cost: t 2 not reached even at zero cost (gross t 1.5)
  const r = { gross: 0.15, net: 0.05, tNet: 0.5, tGross: null };
  assert.ok(t2Cost(r) < 0);
  close(grossT(r), 1.5);
});

test('demo cost: spread / price + commission, in R through the stop, plus financing', () => {
  const demo = { symbols: { EURUSD: { bid: 1.1, spreadMedian: 0, commissionRT: 0.000045, pipPosition: 4 }, US500: { bid: 7500, spreadMedian: 0.3, commissionRT: 0, pipPosition: 1 } } };
  close(demoPct(demo.symbols.EURUSD), 0.0045);
  close(demoPct(demo.symbols.US500), 0.004);
  // 10 pip stop on 1.1 = 0.0909 % of price; 0.0045 / 0.0909 = 0.0495 R; financing = charged 0.10 less transaction 0.08.
  const d = demoCost({ inst: 'eurusd', unit: 'R', gross: 0.2, net: 0.1, stopPips: 10, trans: 0.08 }, demo);
  close(d.v, 0.0045 / (10 * 1e-4 / 1.1 * 100) + 0.02, 1e-12);
  // % rows: demo % plus the study's own financing in %
  close(demoCost({ inst: 'spx500', unit: '%', gross: 0.4, net: 0.3, finPct: 0.05 }, demo).v, 0.054, 1e-12);
  // no stop, or an instrument the demo does not quote: unknown with a reason
  assert.equal(demoCost({ inst: 'spx500', unit: 'R', gross: 0.1, net: 0 }, demo).v, null);
  assert.match(demoCost({ inst: 'usdjpy', unit: 'R', gross: 0.1, net: 0, stopPips: 20 }, demo).why, /not one instrument/);
});

test('result.json is what run.mjs makes of the committed collected.json', () => {
  const res = analyse(collected);
  assert.deepEqual(JSON.parse(JSON.stringify(res)), result);
  assert.equal(result.verdict, 'ACCOUNTING (no rule tested)');
  assert.ok(result.counts.studies >= 100 && result.counts.read > 150);
});

test('every ranked row: positive gross, floors by the formulas, ranked by gross t', () => {
  let prev = Infinity;
  for (const r of result.ranked) {
    assert.ok(r.gross > 0);
    close(r.breakEven, Math.round(r.gross * 1e4) / 1e4);
    if (r.s != null && r.s > 0) close(r.t2Cost, Math.round((r.gross - 2 * scaleOf(r).s) * 1e4) / 1e4, 1e-4);
    close(r.cost, Math.round((r.gross - r.net) * 1e4) / 1e4, 1e-4);
    const g = r.grossT ?? -99;
    assert.ok(g <= prev + 1e-9);
    prev = g;
    if (r.fitsDemo === 'yes') assert.ok(r.gross > r.demoCost);
    if (r.fitsDemo === 'unknown') assert.equal(r.demoCost, null);
  }
  for (const r of result.noGross) assert.ok(!(r.gross > 0));
});

test('RESULT.md carries the ranked table row for row, and the counts', () => {
  assert.equal(report(result).trim(), md.trim());
  for (const r of result.ranked) assert.ok(md.includes(tableRow(r)), `row ${r.rank} ${r.topic}`);
  assert.match(md, /Verdict: ACCOUNTING \(no rule tested\)/);
  assert.ok(md.includes(`${result.counts.studies} studies of pull requests #815-#943`));
  assert.ok(!/\bis an edge\b|\bproven edge\b/i.test(md.replace(/no row below is an edge/, '')));
});

test('the collected snapshot is self-contained: demo symbols and futures sources are in it', () => {
  assert.ok(collected.demo.symbols.EURUSD && collected.demo.at);
  assert.ok(collected.futures.length >= 5 && collected.futures.every((f) => /#900|#943/.test(f.src)));
  for (const r of collected.rows) assert.ok(r.status === 'read' || r.why, `${r.topic} ${r.test}`);
});
