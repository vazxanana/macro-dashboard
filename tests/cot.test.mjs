// node --test tests/cot.test.mjs — COT positioning desk (council/cot.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRow, features, sigExtreme, sigFlow, evaluate, build } from '../council/cot.mjs';
const DAY = 86400, W = 7 * DAY, t0 = Date.UTC(2019, 0, 1) / 1000;
test('rows parse from either report, by field pattern', () => {
  const a = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03T00:00:00.000', cftc_contract_market_code: '099741', lev_money_positions_long: '120', lev_money_positions_short: '20', traders_lev_money_long_all: '40', traders_lev_money_short_all: '25', open_interest_all: '700' }, 'tff');
  assert.equal(a.net, 100); assert.equal(a.tL, 40); assert.equal(a.oi, 700);
  const b = parseRow({ report_date_as_yyyy_mm_dd: '2026-11-03', m_money_positions_long_all: '5', m_money_positions_short_all: '9' }, 'dis');
  assert.equal(b.net, -4); assert.equal(parseRow({ report_date_as_yyyy_mm_dd: 'x' }, 'dis'), null);
});
test('features have no look-ahead; signals fire at extremes and big weekly flows', () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ t: t0 + i * W, net: Math.round(1000 * Math.sin(i / 9)), long: 0, short: 0, tL: 50 + (i % 5), tS: 40, oi: 1000 }));
  rows.push({ t: t0 + 300 * W, net: 5000, long: 0, short: 0, tL: 60, tS: 40, oi: 1000 });
  const F = features(rows), last = F.at(-1);
  assert.equal(last.pct, 100); assert.equal(sigExtreme(last), -1); assert.equal(sigFlow(last), 1); assert.ok(last.z > 1.5);
  assert.equal(F[10].pct, null, 'needs a year of history');
});
test('evaluation scores signals against later prices, and build marks missing markets', () => {
  const rows = Array.from({ length: 400 }, (_, i) => ({ t: t0 + i * W, net: i % 20 < 10 ? i * 10 : -i * 10, long: 1, short: 1, tL: 1, tS: 1, oi: 1 }));
  const px = Array.from({ length: 3000 }, (_, i) => ({ t: t0 + i * DAY, v: 100 + i * 0.01 }));
  const r = evaluate(features(rows), px, 1); assert.ok(r.extreme5 && r.flow20); assert.ok(r.flow5.base > 0.9);
  const out = build({ '099741': rows }, { eurusd: px }); assert.equal(out.find((m) => m.k === 'eur').missing, undefined); assert.equal(out.find((m) => m.k === 'gold').missing, true);
});
