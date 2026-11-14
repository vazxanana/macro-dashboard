// node --test tests/gold-weekly-vol-breakout.test.mjs — research/edge/gold-weekly-vol-breakout (14 Nov 2026): the week open ±
// k × previous-week-range breakout on hand-made candles (fills, gaps, fill and stop in one candle, stops, costs and financing),
// the weeks with no look-ahead, the placebo, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as S from '../research/edge/gold-weekly-vol-breakout/run.mjs';
import { studyVerdict } from '../research/edge/verdict.mjs';
import { FIN } from '../council/fills.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)), DIR = path.join(HERE, '..', 'research', 'edge', 'gold-weekly-vol-breakout');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');
const MON = Date.parse('2024-03-04T00:00:00Z') / 1000;         // a Monday
const near = (a, b) => Math.abs(a - b) < 1e-9;
// a week's trading-window candles every hour from Sunday 22:00 to Friday 20:55 (flat at 100, high 100.5, low 99.5), patched by index
const week = (patch = {}) => {
  const out = []; let i = 0;
  for (let t = MON - 2 * 3600; t <= S.lastStart(MON); t += 3600, i++) { const p = patch[i] || [100, 100.5, 99.5, 100]; out.push({ t, o: p[0], h: p[1], l: p[2], c: p[3] }); }
  return out;
};
const T1 = { ...S.TESTS.T1, prevRange: 10, cost: 0 };          // k 0.5 → levels 105 / 95, stop at 100

test('weeks: Sunday belongs to the next Monday, the window ends at Friday 20:55 UTC', () => {
  assert.equal(S.mondayOf(MON - 2 * 3600), MON, 'Sunday 22:00 → next Monday');
  assert.equal(S.mondayOf(MON + 4 * 86400 + 21 * 3600), MON, 'Friday 21:00 → same week');
  assert.equal(S.mondayOf(MON + 5 * 86400 + 3600), MON, 'Saturday → previous Monday');
  assert.equal(new Date(S.lastStart(MON) * 1000).toISOString(), '2024-03-08T20:55:00.000Z');
});

test('T1: buy stop at open + 0.5 × range, stop at the open, out at the Friday close; financing on buys', () => {
  const b = week({ 10: [100, 105.5, 100.2, 105.2] });
  for (let i = 11; i < b.length; i++) b[i] = { ...b[i], o: 106, h: 106.5, l: 105.5, c: 106 };
  b[b.length - 1].c = 108;
  const x = S.wvbTrade(b, T1);
  assert.equal(x.side, 1); assert.equal(x.up, 105); assert.equal(x.dn, 95); assert.equal(x.entry, 105); assert.equal(x.stop, 100);
  assert.equal(x.r, 5); assert.equal(x.how, 'time'); assert.equal(x.exit, 108); assert.ok(near(x.R, 0.6));
  assert.equal(x.nights, 6, 'Monday to Friday: Mon, Tue, Wed ×3, Thu');
  assert.ok(near(x.finR, 6 * FIN.xau.long * 105 / 5));
  const c = S.wvbTrade(b, { ...T1, cost: 0.6 });
  assert.ok(near(c.net, 0.6 - 0.12 - c.finR)); assert.ok(near(c.net2, 0.6 - 0.24 - 2 * c.finR));
  // a sell pays no financing
  const q = week({ 10: [100, 99.8, 94.5, 94.8] }); for (let i = 11; i < q.length; i++) q[i] = { ...q[i], o: 94, h: 94.5, l: 93.5, c: 94 };
  const s = S.wvbTrade(q, T1); assert.equal(s.side, -1); assert.equal(s.entry, 95); assert.equal(s.finR, 0); assert.ok(near(s.R, 0.2));
});

test('fill mechanics: gap at the open, fill and stop in one candle = the stop, gap through the stop, no fill', () => {
  const after = (b, px) => { for (let i = 11; i < b.length; i++) b[i] = { ...b[i], o: px, h: px + 0.3, l: px - 0.3, c: px }; return b; };
  const g = S.wvbTrade(after(week({ 10: [106, 106.5, 105.8, 106] }), 106), T1);
  assert.equal(g.entry, 106, 'opens above the buy level: fills at its open'); assert.equal(g.r, 6);
  const one = S.wvbTrade(after(week({ 10: [101, 105.5, 99.8, 103] }), 103), T1);
  assert.equal(one.how, 'stop'); assert.equal(one.R, -1, 'fill and stop in one candle: the stop counts');
  const b = after(week({ 10: [100, 105.5, 100.2, 105.2] }), 106); b[30] = { ...b[30], o: 98, h: 98.5, l: 97, c: 97.5 };
  const gs = S.wvbTrade(b, T1); assert.equal(gs.how, 'stop'); assert.equal(gs.exit, 98); assert.ok(near(gs.R, -1.4));
  assert.equal(S.wvbTrade(week(), T1).skip, 'nofill');
  // T2 k 0.3 levels; T3 places no sell
  assert.equal(S.wvbTrade(week({ 10: [100, 103.5, 100, 103] }), { ...S.TESTS.T2, prevRange: 10, cost: 0 }).entry, 103);
  assert.equal(S.wvbTrade(week({ 10: [100, 99.8, 94.5, 94.8] }), { ...S.TESTS.T3, prevRange: 10, cost: 0 }).skip, 'nofill');
});

test('no look-ahead: the previous week\'s range comes from earlier candles only; a week\'s own candles never change its levels', () => {
  const rows = [];
  for (let w = 0; w < 3; w++) {
    const m = MON + w * 7 * 86400;
    for (let t = m - 2 * 3600; t < m + 4 * 86400 + 22 * 3600; t += 300) rows.push([t, 100 + w, 100 + w + 2 * (w + 1), 100 + w - 1, 100 + w]);
  }
  const ws = S.buildWeeks(rows);
  assert.equal(ws.length, 3); assert.equal(ws[0].prevRange, null); assert.equal(S.weekSkip(ws[0]), 'noprev');
  assert.equal(ws[1].prevRange, 3); assert.equal(ws[2].prevRange, 5);
  assert.ok(ws[1].bars.every((b) => b.t <= S.lastStart(ws[1].m)), 'only candles up to Friday 20:55');
  assert.ok(ws[1].bars.length >= S.MIN_BARS); assert.equal(S.weekSkip(ws[1]), null);
  const m2 = ws[2].m, rows2 = rows.map((r) => (S.mondayOf(r[0]) === m2 ? [r[0], 1, 999, 0.5, 1] : r));
  const ws2 = S.buildWeeks(rows2);
  assert.equal(ws2[2].prevRange, ws[2].prevRange); assert.equal(ws2[1].prevRange, ws[1].prevRange);
  // the trade does not change when candles after the exit change
  const b = week({ 10: [100, 99.8, 94.5, 94.8], 11: [94.8, 100.5, 94.5, 100.2] });
  const x1 = S.wvbTrade(b, T1), b2 = b.map((c, i) => (i > 20 ? { ...c, o: 50, h: 50, l: 50, c: 50 } : c));
  assert.deepEqual(S.wvbTrade(b2, T1), x1);
});

test('placebo trade, comparison entry and statistics', () => {
  const x = S.marketTrade(week(), { startT: MON + 3600 + 1, side: 1, dist: 1, cost: 0 });
  assert.equal(x.entry, 100); assert.equal(x.stop, 99); assert.equal(x.how, 'time'); assert.equal(x.R, 0);
  const tr = [{ exitMonth: '2021-01', net: 1 }, { exitMonth: '2021-01', net: 1 }, { exitMonth: '2021-02', net: 3 }, { exitMonth: '2021-03', net: 2 }];
  const m = S.monthT(tr); assert.equal(m.months, 3); assert.ok(Math.abs(m.t - 7) < 1e-9);
  S.holm([0.01, 0.04, 0.03]).forEach((v, i) => assert.ok(Math.abs(v - [0.03, 0.06, 0.06][i]) < 1e-12));
  assert.equal(S.rng(7)(), S.rng(7)());
});

test('the report is run.mjs\'s function of result.json, pre-registration hash and the verdict line', () => {
  const R = JSON.parse(read('result.json'));
  assert.equal(read('RESULT.md'), S.report(R));
  assert.equal(R.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
  assert.equal(R.verdict, S.verdictLine(R.tests, R.decision));
  assert.ok(R.verdict.length < 220);
  const pl = Object.fromEntries(Object.entries(R.placebo).map(([k, v]) => [k, v.means]));
  for (const k of ['T1', 'T2', 'T3']) assert.equal(pl[k].length, 40);
  assert.deepEqual(S.decide(R.tests, pl), R.decision);
  const v = studyVerdict(R, read('RESULT.md')); assert.equal(v.verdict, R.decision.T1.pass ? 'pass' : 'fail');
  assert.ok(v.headline.length <= 221);
  for (const k of ['T1', 'T2', 'T3']) for (const w of ['IS', 'OOS']) assert.ok(R.tests[k][w].n >= 30, `${k} ${w}`);
});

test('stand-alone: only council/fills.mjs is imported; stated as never part of the gold book', () => {
  const src = read('run.mjs');
  const imps = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((p) => p.startsWith('.'));
  assert.deepEqual(imps, ['../../../council/fills.mjs']);
  assert.equal(S.WINDOWS.IS[0], '2007-01-01'); assert.equal(S.WINDOWS.OOS[0], '2017-01-01');
  assert.match(read('PREREGISTRATION.md'), /never a gate, exit, entry or size of the live gold book/);
});
