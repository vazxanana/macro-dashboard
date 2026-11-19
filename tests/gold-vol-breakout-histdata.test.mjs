// research/edge/gold-vol-breakout-histdata: the frozen gold-vol-breakout T1 on HistData XAU/USD M1. Offline: hand-made
// candles for the loader, the guard and the rule; the committed result.json for the report.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as R from '../research/edge/gold-vol-breakout-histdata/run.mjs';

const DIR = new URL('../research/edge/gold-vol-breakout-histdata/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, DIR));
const RES = JSON.parse(read('result.json'));
const DAY = 86400;

// one weekday of M5 rows 00:00-23:55 UTC, flat at p unless path(i) gives [o,h,l,c]
function day(d0, p, path = () => null) {
  const out = [];
  for (let i = 0; i < 288; i++) { const x = path(i) || [p, p + 0.5, p - 0.5, p]; out.push([d0 + i * 300, ...x]); }
  return out;
}
const MON = Date.UTC(2024, 0, 8) / 1000;   // Monday 8 Jan 2024

test('the rule is the original, byte for byte', () => {
  assert.equal(crypto.createHash('sha256').update(read('original.mjs')).digest('hex'), R.ORIG_SHA);
  assert.equal(RES.originalSha256, R.ORIG_SHA);
  assert.equal(R.T1.k, 0.5); assert.equal(R.T1.sides, 'both');
  assert.equal(RES.planSha256, crypto.createHash('sha256').update(read('PREREGISTRATION.md')).digest('hex'));
});

test('loader: labels go through the shared clock, a repeated time is dropped, M5 on UTC boundaries', () => {
  const txt = ['20240711 083000;2400;2401;2399;2400.5;0', '20240711 083100;2400.5;2403;2400;2402;0', '20240711 083100;9;9;9;9;0',
    '20240711 083400;2402;2402;2390;2391;0', '20240711 083500;2391;2392;2391;2392;0', ''].join('\n');
  const m1 = R.parseHist(txt);
  assert.equal(m1.length, 4, 'the repeated minute is dropped');
  assert.equal(new Date(m1[0][0] * 1000).toISOString(), '2024-07-11T12:30:00.000Z', 'Europe summer: label + 4 h');
  const m5 = R.toM5(m1);
  assert.deepEqual(m5[0], [m1[0][0], 2400, 2403, 2390, 2391]);
  assert.equal(m5[1][0], m1[0][0] + 300);
  const src = fs.readFileSync(new URL('run.mjs', DIR), 'utf8');
  assert.match(src, /import \{ histStampUtc \} from '..\/..\/..\/council\/histdata.mjs'/);
});

test('T1 on a hand-made day: buy stop at open + 0.5 x the previous range, stop at the open, out at 21:00', () => {
  const rows = [...day(MON, 100, (i) => [100, 104, 96, 100])];             // Monday range 8
  rows.push(...day(MON + DAY, 100, (i) => (i === 24 ? [100, 105, 100.2, 104.5] : i > 24 && i < 252 ? [104.5, 106, 104.4, 105] : null)));
  const days = R.daysOf(rows), { tr } = R.trades(days, ['2024-01-01', '2024-12-31']);
  const t = tr.find((x) => x.day === '2024-01-09');
  assert.ok(t, 'Tuesday trades');
  assert.equal(t.side, 1); assert.equal(t.entry, 104); assert.equal(t.stop, 100); assert.equal(t.how, 'time');
  assert.ok(Math.abs(t.R - (105 - 104) / 4) < 1e-9);
  assert.ok(Math.abs(t.net - (t.R - 0.6 / 4)) < 1e-9, '$0.60 a round trip');
});

test('no look-ahead: prices after 21:00 and on later days do not change a trade', () => {
  const base = [...day(MON, 100, () => [100, 104, 96, 100]), ...day(MON + DAY, 100, (i) => (i === 30 ? [100, 100.5, 95, 95.5] : null))];
  const a = R.trades(R.daysOf(base), ['2024-01-09', '2024-01-09']).tr[0];
  const late = base.map((r) => (r[0] >= MON + DAY + 21 * 3600 ? [r[0], 50, 300, 10, 200] : r));
  const next = [...base, ...day(MON + 2 * DAY, 500, () => [500, 900, 10, 600])];
  for (const v of [late, next]) assert.deepEqual(R.trades(R.daysOf(v), ['2024-01-09', '2024-01-09']).tr[0], a);
  assert.equal(a.side, -1);
});

test('data guard: a previous day more than 4 calendar days back is skipped (prevgap), a weekend is not', () => {
  const rows = [...day(MON, 100, () => [100, 104, 96, 100]), ...day(MON + 7 * DAY, 100)];   // Monday, then the next Monday
  const sk = R.trades(R.daysOf(rows), ['2024-01-01', '2024-12-31']).skips;
  assert.equal(sk.prevgap, 1);
  const fri = Date.UTC(2024, 0, 12) / 1000;
  const wk = [...day(fri, 100, () => [100, 104, 96, 100]), ...day(fri + 3 * DAY, 100)];
  assert.equal(R.trades(R.daysOf(wk), ['2024-01-01', '2024-12-31']).skips.prevgap, undefined);
});

test('agreement and the bar', () => {
  const t = (day, side, net, how = 'time') => ({ day, side, net, R: net + 0.1, how, fillT: 0, entry: 1, r: 1, finR: 0, net2: net - 0.1, exit: 1 });
  const ag = R.agreement([t('a', 1, 1), t('b', -1, -1), t('c', 1, 0.5), t('d', 1, 2)], [t('a', 1, 0.8), t('b', 1, -0.5), t('c', 1, 0.4), t('e', 1, 1)]);
  assert.equal(ag.both, 3); assert.equal(ag.histOnly, 1); assert.equal(ag.oandaOnly, 1);
  assert.equal(ag.sameSide, 2); assert.equal(ag.sameSideShare, 0.667);
  assert.equal(R.decide({ netR: 0.01, grossT: 2 }, { sameSideShare: 0.7 }).pass, true);
  assert.equal(R.decide({ netR: 0.01, grossT: 1.99 }, { sameSideShare: 0.9 }).pass, false);
  assert.equal(R.decide({ netR: -0.01, grossT: 3 }, { sameSideShare: 0.9 }).pass, false);
  assert.equal(R.decide({ netR: 0.01, grossT: 3 }, { sameSideShare: 0.69 }).pass, false);
});

test('report: RESULT.md is the report of result.json, the verdict follows the bar', () => {
  assert.equal(read('RESULT.md').toString(), R.report(RES));
  const d = R.decide(RES.feeds.hist.W, RES.agreement);
  assert.deepEqual(d, RES.decision);
  assert.equal(RES.verdict, R.verdictLine(RES));
  assert.ok(RES.verdict.startsWith(d.pass ? 'PASS' : 'FAIL'));
  assert.ok(RES.verdict.length < 220, 'headline under 220 characters');
  assert.deepEqual(RES.window, ['2018-01-01', '2026-10-31']);
  assert.equal(RES.cost, 0.6);
  assert.equal(RES.placebo.means.length, 40);
  for (const k of ['hist', 'oanda']) assert.equal(RES.feeds[k].W.n, RES.feeds[k].A.n + RES.feeds[k].B.n);
  assert.ok(read('RESULT.md').toString().includes(`**Verdict: ${RES.verdict}**`));
});
