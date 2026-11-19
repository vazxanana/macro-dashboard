// research/edge/gold-rate-spread: the rule on hand-made candles, no look-ahead, and the report against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DAY, RT, LOOK, T1, gapZ, signalDays, entryIndex, tradeAt, simulate, excess, holm, normP, monthly, placeboDays, rng,
} from '../research/edge/gold-rate-spread/run.mjs';

const DIR = new URL('../research/edge/gold-rate-spread/', import.meta.url);
const T0 = Date.UTC(2020, 0, 6) / 1000;   // a Monday
function bars(n, fn, skip = () => false) {
  const out = []; let d = T0, i = 0;
  while (out.length < n) {
    const wd = new Date(d * 1000).getUTCDay();
    if (wd !== 0 && wd !== 6 && !skip(d)) { const c = fn(i++); out.push({ time: d, open: c, high: c + 1, low: c - 1, close: c }); }
    d += DAY;
  }
  return out;
}
const wiggle = (i) => 100 * Math.exp(0.002 * Math.sin(i * 0.7) + 0.001 * Math.cos(i * 1.3));

test('gap move: US bond minus Bund over 20 common days, z from the 250 days before only', () => {
  const us = bars(320, wiggle), de = bars(320, (i) => 100);
  const z = gapZ(us, de, T1);
  assert.equal(z[0].t, us[20 + LOOK].time, 'needs 20 days for S, then 250 earlier S values');
  const r = z[0], i = 20 + LOOK;
  assert.ok(Math.abs(r.s - Math.log(us[i].close / us[i - 20].close)) < 1e-12, 'Bund flat: S is the US move');
  // a day missing in the Bund is not a common day
  const de2 = bars(320, () => 100, (d) => d === us[300].time);
  assert.ok(!gapZ(us, de2, T1).some((x) => x.t === us[300].time));
  // the sign: Bund up alone (German yields down) makes S negative
  const de3 = bars(320, (i) => (i >= 295 ? 110 : 100));
  assert.ok(gapZ(us, de3, T1).find((x) => x.t === us[300].time).z < -1);
});

test('no look-ahead: changing later bond prices never changes an earlier z', () => {
  const us = bars(330, wiggle), us2 = us.map((b, i) => (i >= 310 ? { ...b, close: b.close * 1.05 } : b)), de = bars(330, () => 100);
  const a = gapZ(us, de, T1), b = gapZ(us2, de, T1), cut = us[310].time;
  assert.deepEqual(a.filter((x) => x.t < cut), b.filter((x) => x.t < cut));
});

test('signal days: gold\'s last candle of the week; z > 1 long, z < -1 short, else none', () => {
  const g = bars(20, () => 100);
  const zs = [{ t: g[4].time, z: 1.5 }, { t: g[9].time, z: -1.2 }, { t: g[14].time, z: 0.5 }, { t: g[12].time, z: 3 }];
  const d = signalDays(g, zs);
  assert.deepEqual(d.map((x) => [x.t, x.s]), [[g[4].time, 1], [g[9].time, -1], [g[14].time, 0]]);
  assert.ok(d.every((x) => new Date(x.t * 1000).getUTCDay() === 5));
});

test('trade: next open, stop 2 x ATR(20), held 10 candles, financing on longs only, one at a time', () => {
  const g = bars(60, () => 100);   // true range 2 -> ATR 2, risk 4
  const j = entryIndex(g, g[25].time);
  assert.equal(j, 26);
  const L = tradeAt(g, j, 1, 10), S = tradeAt(g, j, -1, 10);
  assert.equal(L.risk, 4); assert.equal(L.stop, 96); assert.equal(S.stop, 104);
  assert.equal(L.k, j + 9); assert.ok(L.fin > 0 && L.nights >= 9); assert.equal(S.fin, 0);
  assert.ok(Math.abs(S.net + RT / 4) < 1e-12);
  const g2 = bars(60, (i) => (i === 30 ? 90 : 100)); g2[30].open = 90;
  const x = tradeAt(g2, 26, 1, 10);
  assert.equal(x.kind, 'gap'); assert.equal(x.exit, 90);
  const tr = simulate([{ t: g[25].time, s: 1 }, { t: g[30].time, s: -1 }, { t: g[36].time, s: 1 }], g, 10);
  assert.equal(tr.length, 2, 'the overlapping signal is skipped');
});

test('statistics: excess over a baseline, Holm, month sums, a seeded placebo keeps the side mix', () => {
  const c = Date.UTC(2020, 0, 10) / 1000, from = Date.UTC(2020, 0, 1) / 1000, to = Date.UTC(2020, 1, 28) / 1000;
  const e = excess([{ c, net: 1 }, { c, net: 0 }], [{ net: 0.25 }, { net: 0.25 }], from, to);
  assert.equal(e.excess, 0.25); assert.equal(e.months, 2);
  assert.deepEqual(holm([0.01, 0.04, 0.5]).map((p) => +p.toFixed(3)), [0.03, 0.08, 0.5]);
  assert.ok(Math.abs(normP(1.96) - 0.025) < 0.001);
  assert.equal(monthly([{ c, net: 1 }], from, to, 'net').months, 2);
  const el = Array.from({ length: 50 }, (_, i) => ({ t: i })), sides = [1, 1, -1];
  const a = placeboDays(el, sides, rng(7));
  assert.deepEqual(a, placeboDays(el, sides, rng(7)));
  assert.deepEqual(a.map((d) => d.s).sort(), [-1, 1, 1]);
});

test('report: the verdict line and tables agree with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.councilData, '60e9d956cd79c2d9e64ebb8363f608abdd0f6733');
  const line = md.match(/\*\*Verdict: (.+?)\*\*/)[1];
  assert.ok(line.length < 220 && line.startsWith('FAIL, 0 of 3'));
  const [t1, t2, t3] = r.tests;
  assert.ok(r.tests.every((t) => !t.pass));
  const sgn = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);
  assert.ok(line.includes(`${sgn(t1.oos.net)}R`) && line.includes(`n ${t1.oos.n}`) && line.includes(`month t ${t1.oos.tMonth.toFixed(2)}`));
  assert.ok(line.includes(`${sgn(t1.is.net)}R`));
  for (const w of ['is', 'oos']) assert.ok(md.includes(`| ${t1[w].n} (${t1[w].long} / ${t1[w].short}) |`), `T1 ${w} n`);
  for (const L of [t2, t3]) for (const w of ['is', 'oos']) assert.ok(md.includes(`| ${L[w].n} | ${sgn(L[w].net)} | ${L[w].baseN} | ${sgn(L[w].baseNet)} | ${sgn(L[w].excess)} |`), `${L.id} ${w}`);
  assert.ok(md.includes(`**${t2.oos.tMonth.toFixed(2)}**`) && md.includes(`**${t3.oos.tMonth.toFixed(2)}**`));
  assert.ok(md.includes(`${t1.placebo.atLeastReal} of 40`) && md.includes(`95th percentile ${t1.placebo.p95}`));
  assert.ok(md.includes(`median $${t1.is.medianStop}`) && md.includes(`$${t1.oos.medianStop} out of sample`));
  assert.ok(t1.is.medianStop >= 10 && t1.oos.medianStop >= 10);
  assert.equal(t1.placebo.seeds, 40);
  assert.ok(fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8').includes('decision 44'));
});
