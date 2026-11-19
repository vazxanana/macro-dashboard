// mmxm-pdhl-raid-gold: the rule on hand-made candles (raid, shift, entry, target, filter, fills), no look-ahead, and the
// report against result.json. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { days, setupDay, findTarget, findRaid, findMSS, KZ, P, holm, pOne, monthT, months } from '../research/edge/mmxm-pdhl-raid-gold/run.mjs';

const DIR = new URL('../research/edge/mmxm-pdhl-raid-gold/', import.meta.url);
// New York (EDT, UTC-4) wall time on 2024-04-08 / 09 -> unix
const et = (day, hh, mm = 0) => Date.UTC(2024, 3, day, hh + 4, mm) / 1000;

function world({ mo = 100, gap = true, afterFill = null } = {}) {
  const m15 = [];
  // previous day: Sun 7 Apr 17:00 ET to Mon 8 Apr 17:00 ET, flat 100 with one high 101 and one low 99
  for (let t = et(7, 17); t < et(8, 17); t += 900) {
    const h = t === et(8, 10) ? 101 : 100.1, l = t === et(8, 11) ? 99 : 99.9;
    m15.push([t, 100, h, l, 100]);
  }
  // day D: Mon 17:00 ET to Tue 17:00 ET, flat until 08:00
  for (let t = et(8, 17); t < et(9, 8); t += 900) m15.push([t, t === et(9, 0) ? mo : 100, 100.1, 99.9, 100]);
  const seq = [
    [100.9, 101.5, 100.9, 101.2],   // 08:00 raid of PDH 101
    [101.2, 101.4, 100.8, 101.0],   // 08:15
    [101.0, 101.1, 100.5, 100.7],   // 08:30 swing low 100.5
    [100.7, 101.6, 100.7, 101.5],   // 08:45
    [101.5, 101.8, 101.3, 101.4],   // 09:00 extreme 101.8; confirms the swing
    [101.4, 101.45, 100.3, 100.4],  // 09:15 MSS: close below 100.5
    [100.4, 101.1, 100.3, 100.9],   // 09:30 fills the limit at 101.05
    afterFill || [100.9, 100.95, 97.9, 98.2],   // 09:45 target 98
  ];
  seq.forEach((b, i) => m15.push([et(9, 8, 15 * i), ...b]));
  for (let t = et(9, 10); t < et(9, 17); t += 900) m15.push([t, 98.2, 98.4, 98.1, 98.2]);
  // H1: an unfilled bullish gap 97..98 on 5 Apr, then candles that stay above 98.4 (no nearer gap)
  const h1 = [];
  h1.push([et(5, 9), 96, 97, 95.5, 96.8], [et(5, 10), 96.8, 98.5, 96.8, 98.3], [et(5, 11), 98.3, 99, 98, 98.8]);
  if (!gap) h1[2][3] = 96.9;   // candle 3's low under candle 1's high: no gap
  for (let t = et(5, 12); t < et(9, 9); t += 3600) h1.push([t, 99.6, 100.2, 98.4, 100]);
  return { m15, h1 };
}
const run = (w, opt = { kz: KZ.ny, filter: true }) => { const D = days(w.m15); return setupDay(w.m15, w.h1, D[1], D[0], opt, {}); };

test('the rule on a hand-made day: raid, shift, 50 % entry, stop past the extreme, target the H1 gap', () => {
  const x = run(world());
  assert.ok(x, 'a trade');
  assert.equal(x.s, 1);
  assert.equal(x.X, 101.8);
  assert.ok(Math.abs(x.E - 101.05) < 1e-9);
  assert.ok(Math.abs(x.S - (101.8 + P.buf)) < 1e-9);
  assert.equal(x.Tg, 98);
  assert.equal(x.why, 'target');
  assert.ok(Math.abs(x.R - (101.05 - 98) / (102.1 - 101.05)) < 1e-9);
});

test('no H1 gap, no trade; the midnight-open filter blocks a sell under the open', () => {
  assert.equal(run(world({ gap: false })), null);
  assert.equal(run(world({ mo: 102 })), null);
  assert.ok(run(world({ mo: 102 }), { kz: KZ.ny, filter: false }));
});

test('a level already traded through before the kill zone is not a raid; the London zone sees no raid here', () => {
  const w = world(); const D = days(w.m15);
  const i = w.m15.findIndex((b) => b[0] === et(9, 3)); w.m15[i] = [et(9, 3), 100, 101.2, 99.9, 100];
  const D2 = days(w.m15);
  const rd = findRaid(w.m15, D2[1], D2[0], KZ.ny);   // the high side is used; the first new break is the 09:45 low (a buy)
  assert.equal(rd.s, -1); assert.equal(w.m15[rd.r][0], et(9, 9, 45));
  assert.equal(findRaid(world().m15, D[1], D[0], KZ.london), null);
});

test('stop first: a candle after the fill that reaches the stop and the target is a loss', () => {
  const x = run(world({ afterFill: [100.9, 102.5, 97.5, 98] }));
  assert.equal(x.why, 'stop'); assert.equal(x.R, -1);
});

test('no look-ahead: later candles never change the setup, the target ignores unclosed H1 candles', () => {
  const a = world(), b = world();
  // change everything after the MSS candle's close in b except what is needed to fill
  const jT = et(9, 9, 15);
  for (const bar of b.m15) if (bar[0] > et(9, 9, 45)) { bar[2] = 120; bar[3] = 80; }
  const xa = run(a), xb = run(b);
  assert.equal(xa.E, xb.E); assert.equal(xa.S, xb.S); assert.equal(xa.Tg, xb.Tg);
  // an H1 candle that closes after the MSS close and would fill the gap is not seen
  const h = b.h1.slice(); h.push([et(9, 9), 100, 100, 96, 99]);
  assert.equal(findTarget(h, jT + 900, 1, xa.E, 100), 98);
  // the shift is found from candles up to its own close only
  const D = days(a.m15), r = a.m15.findIndex((x) => x[0] === et(9, 8));
  const ms = findMSS(a.m15.slice(0, r + 6), r, 1, r + 6);
  assert.equal(a.m15[ms.j][0], jT);
});

test('statistics helpers: Holm, one-sided p, month t', () => {
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  assert.ok(Math.abs(pOne(2.0, 60) - 0.025) < 0.003);
  const mt = monthT([{ day: '2021-01-05', net: 1 }, { day: '2021-02-05', net: 1 }, { day: '2021-03-05', net: 2 }], months('2021-01', '2021-03'));
  assert.equal(mt.months, 3); assert.ok(mt.t > 0);
});

test('the report says what result.json says', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR)));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const v = md.match(/\*\*Verdict: ([^*]+)\*\*/);
  assert.ok(v && v[1].startsWith(r.verdict), 'verdict line');
  assert.ok(v[1].length < 220);
  const t1 = r.tests.T1;
  assert.ok(md.includes(`| T1 NY kill zone + midnight filter (primary) | ${t1.is.n} | ${t1.is.gross.toFixed(3)} | ${t1.is.avg.toFixed(3)} | ${t1.is.tMonth.toFixed(2)} | ${t1.oos.n} |`));
  for (const k of ['T1', 'T2', 'T3', 'T4']) {
    const o = r.tests[k].oos;
    assert.ok(md.includes(`| ${o.n} | ${o.gross.toFixed(3)} | ${o.avg.toFixed(3)} | ${o.total.toFixed(2)} | ${o.tMonth.toFixed(2)} | ${o.holm} | ${r.tests[k].oos2x.avg.toFixed(3)} |`), k);
  }
  assert.ok(md.includes(`beats ${r.placebo.beaten} of 40 draws`));
  assert.equal(r.verdict, 'FAIL');
  assert.ok(md.includes('no\ncandle before 1 Jan 2018') || md.includes('no candle before 1 Jan 2018'));
  // no candle before 2018 was used (owner decision 44)
  assert.ok(r.data.from >= '2018-01-01');
});
