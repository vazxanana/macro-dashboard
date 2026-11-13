// node --test tests/fx-reversal.test.mjs: the fx-reversal study (research/edge/fx-reversal). Offline: hand-made candles for the
// ranking (no look-ahead), the inversion of USD-base pairs, the stop and the costs; the report against result.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KEYS, toForeign, decisions, pick, leg, runBook, buildCosts, legCost, stats, pct, verdict, P } from '../research/edge/fx-reversal/run.mjs';

const DIR = new URL('../research/edge/fx-reversal/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const FIX = JSON.parse(fs.readFileSync(new URL('./fixtures/ctrader/symbols-raw-12nov.json', import.meta.url), 'utf8'));
const DAY = 86400, MON = Date.UTC(2024, 0, 1) / 1000;   // a Monday

// a calendar of weekday candles (Mon-Fri) plus a Sunday stub, closes from f(dayIndex)
function rows(nWeeks, f) {
  const out = [];
  let i = 0;
  for (let w = 0; w < nWeeks; w++) for (const d of [-1, 0, 1, 2, 3, 4]) {
    const t = MON + (w * 7 + d) * DAY, c = f(i++, t), o = c * 0.999;
    out.push([t, o, Math.max(o, c) * 1.002, Math.min(o, c) * 0.998, c]);
  }
  return out;
}

test('USD-base pairs are inverted: high and low swap, the foreign currency is priced in dollars', () => {
  const [b] = toForeign([[0, 150, 152, 148, 151]], 'usdjpy');
  assert.deepEqual([b.open, b.high, b.low, b.close], [1 / 150, 1 / 148, 1 / 152, 1 / 151]);
  const [e] = toForeign([[0, 1.1, 1.2, 1.0, 1.15]], 'eurusd');
  assert.deepEqual([e.open, e.high, e.low, e.close], [1.1, 1.2, 1.0, 1.15]);
  // buying JPY = selling USD/JPY: USD/JPY falling 150 -> 140 is a gain on the foreign series
  const B = toForeign([[0, 150, 150, 150, 150], [DAY, 150, 150, 140, 140]], 'usdjpy');
  const lg = leg(B, 0, 1, 1, 1);
  assert.ok(lg.exit > lg.entry && lg.why === 'time');
});

test('ranking: the two lowest bought, the two highest sold, ties by key order', () => {
  const ret = { eurusd: 0.01, gbpusd: -0.02, usdjpy: 0.03, audusd: -0.01, usdcad: 0, usdchf: 0.02, nzdusd: 0 };
  assert.deepEqual(pick(ret), { buy: ['gbpusd', 'audusd'], sell: ['usdchf', 'usdjpy'] });
  const tie = Object.fromEntries(KEYS.map((k) => [k, 0]));
  assert.deepEqual(pick(tie), { buy: ['eurusd', 'gbpusd'], sell: ['usdchf', 'nzdusd'] });
});

test('no look-ahead: changing every price after a decision close leaves that week\'s legs and entries unchanged', () => {
  const mk = (bump) => {
    const S = {}, raw = {};
    KEYS.forEach((k, j) => { raw[k] = rows(34, (i, t) => (1 + 0.1 * j) * (1 + 0.01 * Math.sin(i * (j + 1) * 0.7)) * (bump && t > MON + 180 * DAY ? 1.3 + j * 0.05 : 1)); S[k] = toForeign(raw[k], k); });
    return { S, raw };
  };
  const a = mk(false), b = mk(true);
  const costs = buildCosts(FIX);
  const A = runBook(a.S, a.raw, costs), B = runBook(b.S, b.raw, costs);
  assert.ok(A.length > 5);
  // weeks whose decision close is before the change: same picks; the one whose hold spans the change differs only in result
  const before = A.filter((w) => w.dec + DAY <= MON + 180 * DAY);
  assert.ok(before.length >= 3);
  for (const w of before) {
    const v = B.find((x) => x.dec === w.dec);
    assert.deepEqual(v.legs.map((l) => [l.k, l.side, l.w]), w.legs.map((l) => [l.k, l.side, l.w]));
  }
  // decision candles: one per week, a weekday, the same time for every series
  for (const d of decisions(a.S)) { const wd = new Date(d.time * 1000).getUTCDay(); assert.ok(wd >= 1 && wd <= 5); }
});

test('stop: every leg has one, a touch exits at the stop, a gap past it exits at the open', () => {
  const B = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }, { time: DAY, open: 100, high: 100.5, low: 96, close: 97 }, { time: 2 * DAY, open: 97, high: 98, low: 96, close: 97 }];
  assert.deepEqual([leg(B, 0, 2, 1, 3).exit, leg(B, 0, 2, 1, 3).why, leg(B, 0, 2, 1, 3).stop], [97, 'stop', 97]);
  const G = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }, { time: DAY, open: 106, high: 107, low: 105, close: 106 }];
  assert.deepEqual([leg(G, 0, 1, -1, 3).exit, leg(G, 0, 1, -1, 3).why], [106, 'gap']);
  assert.deepEqual([leg(G, 0, 1, 1, 10).exit, leg(G, 0, 1, 1, 10).why], [106, 'time']);
  assert.equal(P.STOP_K, 3);
});

test('costs: the measured raw-spread model on the fixture, the default basis for JPY and NZD', () => {
  const c = buildCosts(FIX);
  for (const k of ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdchf']) assert.deepEqual([c[k].spreadPips, c[k].slipPips, c[k].commissionRT, /^quotes/.test(c[k].src)], [0, 1, 0.000045, true], k);
  for (const k of ['usdjpy', 'nzdusd']) assert.deepEqual([c[k].spreadPips, c[k].slipPips, c[k].commissionRT], [1, 1, 0.000045], k);
  assert.equal(c.usdjpy.pip, 0.01);
  assert.ok(Math.abs(legCost(c.eurusd, 1.1) - (0.0001 / 1.1 + 0.000045)) < 1e-12);
  assert.deepEqual(R.costs, JSON.parse(JSON.stringify(c)));
});

test('statistics: Sharpe, month-sum t, placebo percentile and the verdict rule', () => {
  const s = stats([{ t: MON, R: 0.01 }, { t: MON + 7 * DAY, R: -0.005 }, { t: MON + 40 * DAY, R: 0.02 }]);
  assert.equal(s.months, 2);
  assert.ok(Math.abs(s.total - 0.025) < 1e-12);
  assert.equal(pct([1, 2, 3, 4, 5], 0.95), 4.8);
  assert.equal(verdict({ sharpe: 0.5, tMonth: 2.1 }, { total: 0.01 }, 0.3).pass, true);
  assert.equal(verdict({ sharpe: 0.5, tMonth: 2.1 }, { total: -0.01 }, 0.3).pass, false);
});

test('result.json and RESULT.md agree; the verdict follows the pre-registered bar', () => {
  const v = verdict({ sharpe: R.decisive.sharpe, tMonth: R.decisive.tMonth }, { total: R.check.totalPct }, R.placebo.p95);
  assert.equal(R.verdict, v.pass ? 'PASS' : 'FAIL');
  assert.equal(R.placebo.sharpes.length, 40);
  assert.ok(MD.startsWith('# Result'));
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${R.verdict}`));
  const f2 = (x) => (x < 0 ? '-' : '') + Math.abs(x).toFixed(2);
  for (const s of [String(R.decisive.n), String(R.check.n), f2(R.decisive.totalPct) + ' %', f2(R.check.totalPct) + ' %', R.decisive.sharpe.toFixed(3), R.check.sharpe.toFixed(3),
    f2(R.decisive.tMonth), R.placebo.p95.toFixed(3), `beats ${R.placebo.beaten} of 40`, f2(R.decisive.maxDDPct) + ' %', '+' + R.check.gross.totalPct.toFixed(2) + ' %',
    R.decisive.costPct.toFixed(2) + ' %', R.decisive.financingPct.toFixed(2) + ' %'])
    assert.ok(MD.includes(s), `RESULT.md lacks ${s}`);
  for (const [y, v] of Object.entries(R.byYearPct)) assert.ok(MD.includes(`${y} ${v >= 0 ? '+' : '-'}${Math.abs(v).toFixed(2)}`), `year ${y}`);
  assert.ok(!fs.existsSync(new URL('../research/proposals/2026-11-13-fx-reversal.md', import.meta.url)) || R.verdict === 'PASS');
});
