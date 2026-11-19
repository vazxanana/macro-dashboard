// research/edge/index-52w-high: the pre-registered 52-week-high anchor study (offline: hand-made candles + the committed files)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { P, priorHighs, atrAt, signalsOf, tradeAt, stream, rateAt, monthT, holm, normP, candles } from '../research/edge/index-52w-high/run.mjs';

const DIR = new URL('../research/edge/index-52w-high/', import.meta.url);
const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
const MD = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
const PRE = fs.readFileSync(new URL('PREREGISTRATION.md', DIR), 'utf8');

const day = (i) => 1451865600 + i * 86400; // weekdays only below (folding is tested apart)
function bars(closes, rng = 1) { return closes.map((c, i) => ({ time: day(i), open: i ? closes[i - 1] : c, high: Math.max(c, i ? closes[i - 1] : c) + rng / 2, low: Math.min(c, i ? closes[i - 1] : c) - rng / 2, close: c })); }

test('prior high uses only the 252 closes before the day', () => {
  const c = Array.from({ length: 600 }, (_, i) => 100 + 10 * Math.sin(i / 17) + i * 0.01);
  const b = bars(c), hi = priorHighs(b);
  for (let i = 0; i < b.length; i++) {
    if (i < 252) { assert.equal(hi[i], null); continue; }
    assert.equal(hi[i], Math.max(...c.slice(i - 252, i)));
  }
  // changing every close from day i on never changes hi[i]
  const c2 = c.map((v, k) => (k >= 400 ? v * 3 : v));
  assert.equal(priorHighs(bars(c2))[400], hi[400]);
});

test('signal: within 1 % of the prior high (a new high counts); deep: more than 20 % below', () => {
  const c = Array(300).fill(100); c[299] = 99.2; const b = bars(c, 0.5);
  assert.equal(signalsOf(b, 'near')[299], true);
  c[299] = 98.9; assert.equal(signalsOf(bars(c, 0.5), 'near')[299], false);
  c[299] = 150; assert.equal(signalsOf(bars(c, 0.5), 'near')[299], true);
  c[299] = 79.9; assert.equal(signalsOf(bars(c, 0.5), 'deep')[299], true);
  c[299] = 80.1; assert.equal(signalsOf(bars(c, 0.5), 'deep')[299], false);
});

test('every trade has a 2 ATR stop, a gap fills at the open, else out at the 20th close', () => {
  const c = Array.from({ length: 80 }, (_, i) => 100 + i * 0.1); const b = bars(c, 1);
  const tr = tradeAt(b, 30, 1, []);
  assert.equal(tr.entry, b[31].open);
  assert.ok(Math.abs(tr.S - 2 * atrAt(b, 30)) < 1e-12 && tr.S > 0);
  assert.equal(tr.stop, tr.entry - tr.S);
  assert.equal(tr.x, 50); assert.equal(tr.exit, b[50].close); assert.equal(tr.how, 'time');
  // a gap down through the stop on day 35 fills at that open
  const g = b.map((x) => ({ ...x })); g[35] = { ...g[35], open: tr.stop - 5, low: tr.stop - 6 };
  const tg = tradeAt(g, 30, 1, []);
  assert.equal(tg.x, 35); assert.equal(tg.exit, tr.stop - 5); assert.equal(tg.how, 'stop');
  // a short's stop is above
  const ts = tradeAt(b, 30, -1, []); assert.equal(ts.stop, ts.entry + ts.S);
  // no 20th day yet: no trade
  assert.equal(tradeAt(b, 70, 1, []), null);
});

test('costs: 0.04 % round trip and financing at 2Y + 2.5 % for a long, never credited on a short', () => {
  const c = Array.from({ length: 80 }, () => 100); const b = bars(c, 1);
  const rates = [['2010-01-01', 5]];
  const tl = tradeAt(b, 30, 1, rates), ts = tradeAt(b, 30, -1, rates);
  const days = (b[tl.x].time - b[tl.e].time) / 86400;
  assert.ok(Math.abs(tl.cost - (0.0004 * 100 + (0.05 + 0.025) / 365 * days * 100) / tl.S) < 1e-12);
  assert.ok(Math.abs(ts.cost - 0.0004 * 100 / ts.S) < 1e-12); // 2.5 % - 5 % < 0: nothing charged, nothing credited
  assert.deepEqual(rateAt(rates, Date.parse('2009-06-01') / 1000), { r: 0.04, src: 'fixed' });
  assert.equal(rateAt([['2010-01-01', 5], ['2010-01-08', 6]], Date.parse('2010-01-07') / 1000).r, 0.05);
  assert.equal(tradeAt(b, 30, 1, rates, 2).cost, 2 * tl.cost);
});

test('one position at a time; weekend candles folded into Monday', () => {
  const c = Array.from({ length: 120 }, (_, i) => 100 + i * 0.1); const b = bars(c, 1);
  const s = stream(b, () => true, 1, [], 0, 1e12);
  for (let k = 1; k < s.length; k++) assert.ok(s[k].i >= s[k - 1].x);
  const sat = Date.parse('2026-11-07T00:00:00Z') / 1000;
  const f = candles([[sat - 86400, 1, 2, 0.5, 1.5, 1], [sat + 86400, 1.6, 3, 1.4, 1.7, 1], [sat + 2 * 86400, 1.8, 2.2, 1.0, 2, 1]]);
  assert.equal(f.length, 2); assert.equal(f[1].open, 1.6); assert.equal(f[1].high, 3); assert.equal(f[1].low, 1.0); assert.equal(f[1].close, 2);
});

test('statistics: month t, one-sided p, Holm', () => {
  assert.ok(Math.abs(normP(1.6448536) - 0.05) < 1e-4); assert.ok(Math.abs(normP(0) - 0.5) < 1e-6);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const t0 = Date.parse('2020-01-15') / 1000, m = 31 * 86400;
  const trades = [0, 1, 2, 3].map((k) => ({ t: t0 + k * m, net: [1, 2, 3, 2][k] }));
  const r = monthT([{ trades, mu: 0 }], Date.parse('2020-01-01') / 1000, Date.parse('2020-05-01') / 1000);
  assert.equal(r.months, 4);
  const x = [1, 2, 3, 2], mean = 2, sd = Math.sqrt(x.reduce((s, v) => s + (v - mean) ** 2, 0) / 3);
  assert.ok(Math.abs(r.t - mean / (sd / 2)) < 1e-12);
});

test('result.json and RESULT.md agree with the pre-registration and each other', () => {
  assert.match(PRE, /Written and pushed alone/);
  assert.equal(R.topic, 'index-52w-high');
  assert.equal(R.tests.length, 3);
  assert.deepEqual(R.tests.map((t) => t.id), ['T1', 'T2', 'T3']);
  assert.equal(R.params.NEAR, 0.99); assert.equal(R.params.LOOK, 252); assert.equal(R.params.HOLD, 20); assert.equal(R.params.STOP_ATR, 2);
  assert.equal(R.params.RT, 0.0004); assert.equal(R.params.MARKUP, 0.025); assert.equal(R.params.RATE_FALLBACK, 0.04);
  const pass = R.tests.map((t) => t.decisive.D > 0 && t.replication.D > 0 && t.holm < 0.05 && t.decisive.n >= 30);
  assert.deepEqual(R.tests.map((t) => t.pass.pass), pass);
  assert.equal(R.verdict.startsWith('PASS'), pass[0]);
  assert.match(MD, new RegExp(`\\*\\*Verdict: ${pass[0] ? 'PASS' : 'FAIL'}`));
  for (const t of R.tests) {
    assert.equal(t.placebo.seeds, 40);
    const sg = (v) => (v > 0 ? '+' : '-') + Math.abs(v).toFixed(3);
    assert.ok(MD.includes(`**${sg(t.decisive.D)}**`), `${t.id} decisive D in RESULT.md`);
    assert.ok(MD.includes(`**${sg(t.replication.D)}**`), `${t.id} replication D in RESULT.md`);
    assert.ok(MD.includes(`| ${t.decisive.n} |`) && MD.includes(`| ${t.replication.n} |`));
  }
  // nothing live: the study imports only the pure weekend fold
  const src = fs.readFileSync(new URL('run.mjs', DIR), 'utf8');
  const imports = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((s) => !s.startsWith('node:'));
  assert.deepEqual(imports, ['../../../council/fills.mjs']);
  assert.doesNotMatch(src, /\bxau\b/);
});
