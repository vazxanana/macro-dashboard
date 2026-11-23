// node --test tests/storyline-daily-gold.test.mjs - the Daily storyline study on gold (research/edge/storyline-daily-gold),
// offline: no look-ahead (every price after a moment changed, the orders known by then must not move), every order and
// trade has its stop on the losing side, and RESULT.md says what result.json says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import * as S from '../research/edge/storyline-daily-gold/run.mjs';

const DIR = new URL('../research/edge/storyline-daily-gold/', import.meta.url);
const T0 = Date.UTC(2024, 0, 8) / 1000; // a Monday
// a trending, swinging walk of 5-minute candles (weekends skipped, as the market is)
function market(days = 200, seed = 11) {
  const r = K.rng(seed); const out = []; let p = 2000; let drift = 0;
  for (let i = 0; i < days * 288 * 7 / 5; i++) {
    const t = T0 + i * 300; const wd = new Date(t * 1000).getUTCDay();
    if (wd === 6 || (wd === 0 && new Date(t * 1000).getUTCHours() < 22) || (wd === 5 && new Date(t * 1000).getUTCHours() >= 21)) continue;
    if (i % 250 === 0) drift = (r() - 0.5) * 0.6;
    const o = p, c = o + drift + (r() - 0.5) * 1.5; const h = Math.max(o, c) + r() * 0.8, l = Math.min(o, c) - r() * 0.8;
    out.push({ t, o, h, l, c, e: t + 300 }); p = c;
  }
  return out;
}
const key = (o) => [o.side, o.t, o.entry, o.stop, o.target, o.level, ['no target', 'under 1.5R', 'weekly disagrees'].includes(o.skip) ? o.skip : '-'].join('|');

test('no look-ahead: orders known by a moment do not move when every later price changes', () => {
  let checked = 0;
  for (const seed of [1, 5, 7, 8]) for (const v of ['P', 'S1', 'S2', 'S3']) {
    const B = market(200, seed);
    const full = S.study(B, v).orders;
    for (const f of [0.35, 0.6, 0.85]) {
      const T = B[Math.floor(B.length * f)].t;
      const A = B.map((b) => (b.t < T ? b : { ...b, o: b.o + 60, h: b.h + 95, l: b.l - 95, c: b.c - 45 }));
      const cut = S.study(A, v).orders;
      const a = full.filter((o) => o.t <= T).map(key), b = cut.filter((o) => o.t <= T).map(key);
      assert.deepEqual(b, a, v + ' cut at ' + T); checked += a.length;
    }
  }
  assert.ok(checked > 20, 'orders compared: ' + checked);
});

test('every order and trade has its stop on the losing side, and the target on the winning side', () => {
  for (const seed of [1, 5, 7, 8]) for (const v of ['P', 'S1', 'S2', 'S3']) {
    const B = market(200, seed);
    const { orders, trades } = S.study(B, v);
    for (const o of orders.filter((x) => x.entry != null)) { assert.ok(o.side * (o.entry - o.stop) > 0, 'stop side'); assert.ok(o.side * (o.target - o.entry) > 0, 'target side'); }
    for (const x of trades) { const s = x.side === 'buy' ? 1 : -1; assert.ok(s * (x.entry - x.stop) > 0, 'trade stop'); assert.ok(x.R >= -1 - 1e-9 || x.reason === 'stop', 'loss at most the stop unless gapped'); }
  }
});

test('the 1.5R rule and the cost are applied', () => {
  let n = 0;
  for (const seed of [1, 2, 7, 8]) for (const x of S.study(market(200, seed), 'P').trades) { n++;
    assert.ok(x.rrPlan >= 1.5 - 1e-6 || x.type === 'market');
    if (x.Rnet != null) assert.ok(x.Rnet < x.R && x.R2x < x.Rnet);
  }
  assert.ok(n > 0, 'synthetic trades');
});

test('RESULT.md says what result.json says', { skip: !fs.existsSync(new URL('result.json', DIR)) }, () => {
  const res = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  assert.match(md.split('\n').slice(0, 6).join('\n'), new RegExp('\\*\\*Verdict: ' + res.verdict));
  const P = res.variants.P.windows;
  for (const w of ['REP', 'IS', 'OOS']) {
    if (!P[w].net.n) continue;
    assert.ok(md.includes(P[w].net.meanR.toFixed(3)), w + ' mean R in RESULT.md');
    assert.ok(md.includes(String(P[w].net.n)), w + ' n in RESULT.md');
  }
  assert.ok(md.includes(P.OOS.net.tMonth.toFixed(2)), 'OOS month t');
  const trades = JSON.parse(fs.readFileSync(new URL('trades.json', DIR), 'utf8'));
  for (const x of trades) { const s = x.side === 'buy' ? 1 : -1; assert.ok(s * (x.entry - x.stop) > 0); }
});
