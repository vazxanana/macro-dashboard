// research/edge/ict-smile/analyse.mjs: the Dollar Smile out-of-sample test (paper research). Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classify, analyse, passes, run, fxBars, SMILE_SERIES } from '../research/edge/ict-smile/analyse.mjs';
import { LAG } from '../council/macro.mjs';

const DAY = 86400, D0 = Date.UTC(2019, 0, 7) / 1000;   // a Monday
const days = (n) => Array.from({ length: n }, (_, i) => D0 + i * DAY).filter((t) => { const w = new Date(t * 1000).getUTCDay(); return w >= 1 && w <= 5; });
const series = (fn, n = 120) => days(n).map((t) => ({ t, v: fn(t) }));
// flat dollar, calm VIX, flat spreads: every day is 'mid'
function calm(over = {}) {
  const fred = { BAMLH0A0HYM2: series(() => 4), SWPT: series(() => 10), VIXCLS: series(() => 15), SOFR: series(() => 2.4), EFFR: series(() => 2.4), DFII10: series(() => 0.8), DGS2: series(() => 2.5), ...over };
  const fx = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) fx[k] = days(120).map((t) => [t, k === 'eurusd' ? 1.15 : k === 'usdjpy' ? 110 : k === 'gbpusd' ? 1.3 : 1.0]);
  return { fred, bars: fxBars(fx), cot: [], cal: [] };
}
const trade = (t, R, i = 0) => ({ id: `nq-b-${t}-${i}`, market: 'nq', side: 'buy', signalAt: t + 14 * 3600, closed: t + 20 * 3600 + i, R, net: R - 0.05 });

test('macro.mjs phases come through unchanged: calm is mid, VIX >= 28 is left', () => {
  const T = D0 + 50 * DAY;
  assert.equal(classify(calm(), [trade(T, 1)])[0].rg.smile, 'mid');
  const hot = calm({ VIXCLS: series(() => 30) });
  assert.equal(classify(hot, [trade(T, 1)])[0].rg.smile, 'left');
});

test('no look-ahead: a VIX spike inside the publication lag does not reach the trade', () => {
  const T = D0 + 51 * DAY;   // a Wednesday; LAG.VIXCLS = 2 -> the last usable print is Monday's
  const spike = (from) => calm({ VIXCLS: series((t) => (t >= from ? 35 : 15)) });
  assert.equal(classify(spike(T - DAY), [trade(T, 1)])[0].rg.smile, 'mid');       // Tuesday's print: not yet published
  assert.equal(classify(spike(T - 2 * DAY), [trade(T, 1)])[0].rg.smile, 'left');  // Monday's print: usable
  // the 1-day sensitivity sees Tuesday's print, and restores macro.mjs's lag afterwards
  assert.equal(classify(spike(T - DAY), [trade(T, 1)], 1)[0].rg.smile, 'left');
  assert.equal(LAG.VIXCLS, 2); assert.equal(LAG.VXVCLS, 2);
});

test('the pass bar: n >= 30, t <= -2, both halves negative', () => {
  const mk = (rs) => rs.map((R, i) => ({ ...trade(D0 + 40 * DAY, R, i), rg: { smile: 'left' } }));
  const lose = mk(Array.from({ length: 40 }, (_, i) => (i % 4 === 0 ? 1 : -1)));   // mean -0.5, t about -3.2
  assert.equal(analyse(lose).H.pass, true);
  assert.equal(analyse(lose.slice(0, 20)).H.pass, false);   // too few
  const late = mk([...Array.from({ length: 20 }, () => 1.2), ...Array.from({ length: 40 }, () => -1)]);
  assert.equal(passes(analyse(late).H.dropped), false);     // first half positive
});

test('run(): FRED down gives an incomplete result and no verdict', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-smile-'));
  fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify({ window: ['a', 'b'], source: 'test', trades: [trade(D0 + 50 * DAY, 1)] }));
  fs.writeFileSync(path.join(dir, 'fx-daily.json'), JSON.stringify({}));
  let calls = 0;
  const res = await run({ dataDir: dir, fetchImpl: async () => { calls++; return { ok: false, status: 403 }; } });
  assert.equal(res.status, 'incomplete'); assert.equal(res.verdict, null);
  assert.ok(calls < 40, `gives up on FRED quickly (${calls} calls)`);
});

test('run(): with data it classifies, tests H and reports every split', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ict-smile-'));
  const d = calm({ VIXCLS: series((t) => (t >= D0 + 60 * DAY ? 30 : 15)) });
  const fx = {}; for (const k of ['eurusd', 'usdjpy', 'gbpusd', 'usdcad', 'usdchf']) fx[k] = d.bars[k].map((b) => [b.time, b.close]);
  const tr = days(110).filter((t) => t >= D0 + 30 * DAY).map((t, i) => trade(t, t >= D0 + 62 * DAY ? (i % 4 === 0 ? 1 : -1) : 1, i));
  fs.writeFileSync(path.join(dir, 'trades.json'), JSON.stringify({ window: ['2019-01-01', '2019-05-01'], source: 'test', trades: tr }));
  fs.writeFileSync(path.join(dir, 'fx-daily.json'), JSON.stringify(fx));
  const csv = (id) => 'observation_date,' + id + '\n' + d.fred[id].map((o) => `${new Date(o.t * 1000).toISOString().slice(0, 10)},${o.v}`).join('\n');
  const res = await run({ dataDir: dir, fetchImpl: async (url) => { const id = (String(url).match(/id=(\w+)/) || [])[1];
    return d.fred[id] ? { ok: true, status: 200, text: async () => csv(id) } : { ok: false, status: 404 }; } });
  assert.equal(res.status, 'ok');
  for (const id of SMILE_SERIES) assert.match(res.sources[id], /FRED ok/);
  assert.ok(res.primary.H.dropped.n >= 30 && res.primary.H.dropped.exp < 0);
  assert.equal(res.verdict, 'pass');
  assert.ok(res.primary.byMarket.nq && res.primary.byYear['2019']);
  assert.ok(res.sensitivity['net of costs'] && res.sensitivity['VIX lag 1 day (#507)'] && res.sensitivity['HY-covered days only']);
});
