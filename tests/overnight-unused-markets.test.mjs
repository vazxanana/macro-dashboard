// research/edge/overnight-unused-markets: index-overnight's frozen rule on fourteen unused index CFDs (offline).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as F from '../research/edge/overnight-unused-markets/frozen.mjs';
import * as W from '../research/edge/overnight-unused-markets/run.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'research', 'edge', 'overnight-unused-markets');
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(DIR, f))).digest('hex');
const DGS2 = JSON.parse(fs.readFileSync(path.join(DIR, 'rates.json'))).DGS2;

// a deterministic M30 path, every half hour Monday to Friday (UTC), from..to
function synth(from, to, seed = 7) {
  const rnd = F.mulberry32(seed), rows = []; let px = 4000;
  for (let t = Date.parse(from + 'T00:00:00Z') / 1000; t < Date.parse(to + 'T00:00:00Z') / 1000; t += 1800) {
    const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue;
    const o = px, c = o * (1 + (rnd() - 0.5) * 0.004), h = Math.max(o, c) * (1 + rnd() * 0.001), l = Math.min(o, c) * (1 - rnd() * 0.001);
    rows.push([t, o, h, l, c]); px = c;
  }
  return F.makeSeries(rows);
}

test('frozen.mjs is index-overnight run.mjs byte for byte, rates.json its copy', () => {
  assert.equal(sha('frozen.mjs'), 'cb28b48d05fd40cb336c4893f096192b8022f51cf84abf0c80279fbdef362f6c');
  const pre = fs.readFileSync(path.join(DIR, 'PREREGISTRATION.md'), 'utf8');
  assert.match(pre, /copied byte for byte as `frozen.mjs`/);
  assert.ok(DGS2.length > 500 && DGS2[0][0] <= '2006-01-06');
});

test('the wrapper given New York sessions gives the frozen runMarket trades exactly', () => {
  const S = synth('2015-11-01', '2016-03-01');
  const fr = F.runMarket(S, DGS2, 'overnight').trades, mine = W.trades('us2000', S, DGS2).trades;
  assert.ok(fr.length > 40);
  assert.equal(mine.length, fr.length);
  for (let i = 0; i < fr.length; i++) for (const k of ['date', 't0', 't1', 'entry', 'stop', 'exit', 'R', 'how', 'nights', 'spreadR', 'finR', 'net', 'net2']) assert.equal(mine[i][k], fr[i][k], `${i} ${k}`);
});

test('exchange sessions convert to UTC with each zone\'s own daylight saving', () => {
  const at = (k, d, which) => { const m = W.MARKETS[k], [h, mm] = typeof m[which] === 'function' ? m[which](d) : m[which]; return new Date(W.localAt(m.zone, d, h, mm) * 1000).toISOString().slice(11, 16); };
  assert.equal(at('de40', '2020-07-15', 'close'), '15:30'); assert.equal(at('de40', '2020-01-15', 'close'), '16:30');
  assert.equal(at('uk100', '2020-07-15', 'open'), '07:00'); assert.equal(at('uk100', '2020-01-15', 'open'), '08:00');
  assert.equal(at('jp225', '2020-07-15', 'close'), '06:00'); assert.equal(at('jp225', '2025-07-15', 'close'), '06:30');
  assert.equal(at('jp225', '2020-07-15', 'open'), '00:00');
  assert.equal(at('au200', '2020-01-15', 'close'), '05:00'); assert.equal(at('au200', '2020-07-15', 'close'), '06:00');
  assert.equal(at('hk33', '2010-07-15', 'open'), '02:00'); assert.equal(at('hk33', '2012-07-15', 'open'), '01:30');
  assert.equal(at('in50', '2020-07-15', 'open'), '04:00'); assert.equal(at('in50', '2020-07-15', 'close'), '10:00');
  assert.equal(at('cn50', '2020-07-15', 'open'), '01:30'); assert.equal(at('sg30', '2020-07-15', 'close'), '09:00');
  // every open and close is an M30 boundary, all year
  for (const k of Object.keys(W.MARKETS)) if (!W.MARKETS[k].nyse) for (const d of ['2010-01-15', '2010-07-15', '2025-03-28', '2025-10-30']) for (const x of ['open', 'close']) {
    const m = W.MARKETS[k], [h, mm] = typeof m[x] === 'function' ? m[x](d) : m[x]; assert.equal(W.localAt(m.zone, d, h, mm) % 1800, 0, `${k} ${d} ${x}`);
  }
  assert.equal(Object.keys(W.MARKETS).length, 14);
  for (const used of ['spx500', 'nas100', 'us30']) assert.ok(!(used in W.MARKETS));
});

test('cash days need both candles; a gap over five days is not held; every trade has a stop under its entry', () => {
  const S = synth('2019-12-01', '2020-04-01', 3);
  // remove the 17:00-17:30 Berlin candle of 2020-02-12 (winter: 16:00 UTC) and a whole week
  const cut = W.localAt('Europe/Berlin', '2020-02-12', 17, 0), wk0 = Date.parse('2020-03-09T00:00:00Z') / 1000, wk1 = Date.parse('2020-03-16T00:00:00Z') / 1000;
  const S2 = F.makeSeries(S.bars.filter((b) => b[0] !== cut && !(b[0] >= wk0 && b[0] < wk1)));
  const ses = W.sessions('de40', S2, '2020-01-01', '2020-03-31');
  assert.ok(!ses.some((s) => s.date === '2020-02-12'));
  assert.ok(!ses.some((s) => s.date >= '2020-03-09' && s.date < '2020-03-14'));
  const r = W.trades('de40', S2, DGS2);
  assert.ok(r.drop.gap >= 1);
  assert.ok(r.trades.length > 40);
  for (const t of r.trades) { assert.ok(t.stop < t.entry); assert.ok(t.R >= -1 || t.how === 'gap' || t.how === 'gap-open'); assert.equal(t.t0 % 1800, 0); }
  // Friday close to Monday open pays three nights
  const fri = r.trades.find((t) => new Date(t.date + 'T00:00:00Z').getUTCDay() === 5 && t.how !== 'stop' && t.how !== 'gap');
  assert.equal(fri.nights, 3);
});

test('pooled: monthly sums added across markets, mean R a trade = total / n', () => {
  const tr = (d, R, net) => ({ t0: Date.parse(d + 'T12:00:00Z') / 1000, date: d, R, net, net2: net - 0.01, spreadR: 0.01, finR: 0.005 });
  const a = [tr('2020-01-02', 0.1, 0.05), tr('2020-02-03', -0.2, -0.25), tr('2020-03-02', 0.3, 0.2)];
  const b = [tr('2020-01-09', 0.2, 0.1), tr('2020-03-05', 0.1, 0.0)];
  const p = W.pooled([a, b]);
  assert.equal(p.n, 5); assert.equal(p.months, 3); assert.equal(p.grossR, 0.1); assert.equal(p.netR, 0.02);
  assert.equal(p.tGross, Math.round(F.tStat([0.3, -0.2, 0.4]) * 100) / 100);
  assert.equal(W.medianHold([{ nights: 1, hold: 55800 }, { nights: 3, hold: 228600 }, { nights: 1, hold: 55790 }]), 55800);
});

test('result.json follows the pre-registered verdict rules and RESULT.md quotes it', { skip: !fs.existsSync(path.join(DIR, 'result.json')) }, () => {
  const res = JSON.parse(fs.readFileSync(path.join(DIR, 'result.json'), 'utf8'));
  const md = fs.readFileSync(path.join(DIR, 'RESULT.md'), 'utf8');
  assert.ok(md.includes(res.verdict));
  assert.ok(res.gate && res.gate.rows && res.gate.wrapper.spx500.identical && res.gate.wrapper.nas100.identical);
  if (res.qualifying.length < 3) { assert.match(res.verdictClass, /^NOT MEASURABLE/); return; }
  const d = res.pooled.decisive, r = res.pooled.replication;
  const h1 = d.grossR > 0 && d.tGross >= 2 && r.grossR > 0 && res.primary.H1.pHolm < 0.05, h2 = d.netR > 0 && d.t >= 2 && res.primary.H2.pHolm < 0.05;
  assert.equal(res.primary.H1.holds, h1); assert.equal(res.primary.H2.holds, h2);
  assert.equal(res.verdictClass, `${h1 ? 'REPLICATES' : 'DOES NOT REPLICATE'} / ${h2 ? 'PASS' : 'FAIL'}`);
  for (const k of res.qualifying) { assert.ok(res.markets[k].decisive.n >= 300); assert.ok(!['spx500', 'nas100', 'us30'].includes(k)); }
  assert.equal(res.pooled.decisive.n, res.qualifying.reduce((a, k) => a + res.markets[k].decisive.n, 0));
  assert.equal(res.placebo.seeds, 40);
});
