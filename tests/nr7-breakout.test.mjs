// research/edge/nr7-breakout: NR7 detection, the bracket orders on hand-made candles, no look-ahead, the both-in-one-candle
// loss, costs, and the report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nr7, trade, stream, costs, netOf, tradingDays, hoursOf, monthT, holm, mulberry32, MARKETS } from '../research/edge/nr7-breakout/run.mjs';
import { FIN } from '../council/fills.mjs';

const D = 86400, H = 3600;
const MON = Date.UTC(2024, 0, 8) / 1000;                       // Monday 8 Jan 2024
const day = (k, o, h, l, c) => ({ time: MON + k * D, open: o, high: h, low: l, close: c });
// seven weekdays (Mon 8 .. Tue 16 with the weekend skipped): six wide days, then a narrow one (index 5 = Mon 15)
const wkd = (n) => { const out = []; let t = MON; while (out.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w < 6) out.push(t); t += D; } return out; };
function mkDays(ranges, mid = 100) { return wkd(ranges.length).map((t, i) => ({ time: t, open: mid, high: mid + ranges[i] / 2, low: mid - ranges[i] / 2, close: mid })); }
const hour = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });

test('NR7: strictly narrower than each of the six days before, ties do not count, range > 0', () => {
  assert.deepEqual(nr7(mkDays([10, 9, 8, 7, 6, 5, 4])), [6]);
  assert.deepEqual(nr7(mkDays([10, 9, 8, 7, 6, 4, 4])), []);        // a tie is not an NR7 (and day 5 has only five before it)
  assert.deepEqual(nr7(mkDays([10, 9, 8, 7, 6, 5, 4, 3])), [6, 7]);
  assert.deepEqual(nr7(mkDays([10, 9, 8, 7, 6, 5, 0])), []);        // a flat day is never one
  assert.deepEqual(nr7(mkDays([1, 9, 8, 7, 6, 5, 4])), []);         // a narrower day inside the six
});

test('trading days: a weekend stub folds into Monday (fills.mjs foldWeekend)', () => {
  const sun = MON - D;
  const rows = [[MON - 3 * D, 1, 2, 0.5, 1.5, 1], [sun, 1.4, 3, 1.2, 1.6, 1], [MON, 1.6, 2, 1, 1.8, 1]];
  const d = tradingDays(rows);
  assert.equal(d.length, 2);
  assert.equal(d[1].time, MON); assert.equal(d[1].open, 1.4); assert.equal(d[1].high, 3);
});

// days: 0..5 wide, NR7 on day 6 (Tue 16 Jan) with high 101, low 99; entry day 7 (Wed 17), exit day 8 (Thu 18)
const base = () => { const d = mkDays([10, 10, 10, 10, 10, 10, 2, 6, 6]); d[8].close = 104; return d; };

test('buy stop fills first, held to the close of the day after the entry; stop is the NR7 low', () => {
  const d = base(), e = d[7].time, f = d[8].time;
  const Hs = [hour(e + 2 * H, 100, 100.5, 99.5, 100.2), hour(e + 3 * H, 100.2, 101.5, 100.1, 101.4), hour(e + 4 * H, 101.4, 102, 99.2, 100), hour(f + H, 100, 104, 99.5, 104)];
  const tr = trade(Hs, d, 6);
  assert.equal(tr.side, 1); assert.equal(tr.fill, 101); assert.equal(tr.stop, 99); assert.equal(tr.r0, 2);
  assert.equal(tr.why, 'time'); assert.equal(tr.R, (104 - 101) / 2); assert.equal(tr.exitDay, 8);
});

test('both levels in one H1 candle = a loss of 1R, no financing', () => {
  const d = base(), e = d[7].time;
  const tr = trade([hour(e + H, 100, 101.2, 98.8, 100)], d, 6);
  assert.equal(tr.both, true); assert.equal(tr.R, -1);
  const c = costs(tr, 'xau', []);
  assert.equal(c.fin, 0); assert.equal(c.spread, 0.30 / 2);
});

test('no look-ahead: candles after the exit and the other side later do not change a trade', () => {
  const d = base(), e = d[7].time, f = d[8].time;
  const Hs = [hour(e + H, 100, 100.1, 98.8, 98.9), hour(e + 2 * H, 98.9, 101.3, 98.7, 99)];
  const a = trade(Hs, d, 6);
  assert.equal(a.side, -1); assert.equal(a.fill, 99);              // sell first; the later touch of the high is its stop
  assert.equal(a.why, 'stop'); assert.equal(a.R, -1);
  const later = [...Hs, hour(f + 5 * D, 50, 50, 10, 10)];
  assert.deepEqual(trade(later, d, 6), a);
  // the NR7 day's orders read only day 6 and before: changing day 8 cannot change the orders or the fill
  const d2 = base(); d2[8].high = 999;
  assert.equal(trade(Hs, d2, 6).fill, 99);
});

test('gap entry fills at the open; 2R target exits at the target; stop first when one candle holds both', () => {
  const d = base(), e = d[7].time, f = d[8].time;
  const gap = trade([hour(e + H, 101.5, 102, 101.3, 101.8)], d, 6);
  assert.equal(gap.fill, 101.5); assert.equal(gap.r0, 2.5);
  const tg = trade([hour(e + H, 100, 101.1, 100, 101), hour(e + 2 * H, 101, 105.5, 100.5, 105)], d, 6, { target: 2 });
  assert.equal(tg.why, 'target'); assert.equal(tg.R, 2);
  const both = trade([hour(e + H, 100, 101.1, 100, 101), hour(f + H, 101, 106, 98, 100)], d, 6, { target: 2 });
  assert.equal(both.why, 'stop'); assert.equal(both.R, -1);
});

test('one position per market: a signal while a trade is open is skipped', () => {
  const d = mkDays([10, 10, 10, 10, 10, 10, 2, 1.5, 6, 6]), e = d[7].time;
  const s = stream([hour(e + H, 100, 101.2, 100, 101)], d);
  assert.equal(s[0].i, 6); assert.ok(s[0].tr);
  assert.equal(s[1].i, 7); assert.equal(s[1].skipped, true);
});

test('costs: spread in R, gold long financing per rollover, index by DGS2 + 2.5 %, shorts of gold free', () => {
  const t = Date.UTC(2024, 0, 15, 10) / 1000, c = t + D;          // Monday 10:00 to Tuesday 10:00: one rollover
  const gl = costs({ side: 1, fill: 2000, r0: 10, t, c }, 'xau', []);
  assert.equal(gl.nights, 1); assert.ok(Math.abs(gl.fin - FIN.xau.long * 2000 / 10) < 1e-12);
  assert.equal(costs({ side: -1, fill: 2000, r0: 10, t, c }, 'xau', []).fin, 0);
  const dgs = [['2024-01-12', 4.5]];
  const ix = costs({ side: 1, fill: 18000, r0: 100, t, c }, 'nas100', dgs);
  assert.ok(Math.abs(ix.fin - (0.045 + 0.025) / 365 * 18000 / 100) < 1e-12);
  assert.equal(costs({ side: -1, fill: 18000, r0: 100, t, c }, 'nas100', dgs).fin, 0);  // 2.5 % - 4.5 % < 0: no credit
  assert.equal(ix.spread, MARKETS.nas100.cost / 100);
  assert.ok(Math.abs(netOf({ side: 1, fill: 18000, r0: 100, t, c, R: 1 }, 'nas100', dgs) - (1 - ix.spread - ix.fin)) < 1e-12);
});

test('hours of a Monday include the Sunday reopen hours', () => {
  const d = mkDays([1, 1, 1, 1, 1, 1]);                           // Mon 8 .. Mon 15
  const sunday = d[5].time - D + 22 * H;
  const hs = hoursOf([hour(sunday, 1, 1, 1, 1), hour(d[5].time + H, 1, 1, 1, 1), hour(d[5].time + D, 1, 1, 1, 1)], d, 5);
  assert.equal(hs.length, 2);
});

test('statistics: month-sum t counts empty months, Holm, seeded placebo RNG', () => {
  const t0 = Date.UTC(2020, 0, 15) / 1000;
  const m = monthT([{ c: t0, net: 1 }, { c: t0 + 31 * D, net: 1 }], Date.UTC(2020, 0, 1) / 1000, Date.UTC(2020, 3, 30) / 1000);
  assert.equal(m.months, 4);
  assert.deepEqual(holm([0.02, 0.04]), [true, true]);
  assert.deepEqual(holm([0.03, 0.04]), [false, false]);
  const a = mulberry32(7), b = mulberry32(7);
  assert.equal(a(), b());
});

test('RESULT.md opens with the verdict of result.json and quotes its pooled figures', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/nr7-breakout/result.json', import.meta.url)));
  const md = fs.readFileSync(new URL('../research/edge/nr7-breakout/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.`));
  assert.equal(r.verdict, Object.values(r.variants).some((v) => v.pass) ? 'PASS' : 'FAIL');
  const sg = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3);
  for (const [k, v] of Object.entries(r.variants)) for (const w of ['decisive', 'replication']) {
    const p = v.windows[w].pooled;
    assert.ok(md.includes(`| ${k} | `) && md.includes(`| ${p.n} | ${sg(p.gross)} | ${sg(p.net)} |`), `${k} ${w}`);
    for (const mk of Object.keys(r.markets)) assert.ok(md.includes(`| ${v.windows[w].markets[mk].n} | ${sg(v.windows[w].markets[mk].net)} |`), `${k} ${w} ${mk}`);
  }
  for (const v of Object.values(r.variants)) { assert.equal(v.placebo.means.length, 40); assert.ok(md.includes(sg(v.placebo.p95))); }
  assert.match(fs.readFileSync(new URL('../research/edge/nr7-breakout/PREREGISTRATION.md', import.meta.url), 'utf8'), /Item 44/);
});
