// research/edge/mcycle-oos: the live Mosha cycle rule on untouched gold 2007-19. Offline: hand-made candles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evClosed, replay, recordOf, netOf, positionsOf, verdictText, buildTf, framesOf, placeboTrades, mulberry32, holm, pOne, analyse, K, TF } from '../research/edge/mcycle-oos/run.mjs';
import { msAnalyze } from '../council/engine.mjs';
import { cycleTrades } from '../council/mosha-cycle.mjs';

const DIR = new URL('../research/edge/mcycle-oos/', import.meta.url);
// the Trader's own mapping (council/trader.mjs, mcycle block) on a feed whose last candle is forming
const evTrader = (bb, sec) => msAnalyze(bb, 6).events.filter((e) => e.breakIdx < bb.length - 1)
  .map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure }));

function walk(days, seed = 3, t0 = Date.UTC(2011, 2, 1) / 1000) {
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = []; let px = 1400, drift = 0;
  for (let t = t0; t < t0 + days * 86400; t += 300) {
    const d = new Date(t * 1000), wd = d.getUTCDay(), h = d.getUTCHours();
    if (wd === 6 || wd === 0 || (wd === 5 && h >= 21)) continue;
    if (rnd() < 0.01) drift = (rnd() - 0.5) * 0.3;
    const o = px, c = o + drift + (rnd() - 0.5) * 2.4, hi = Math.max(o, c) + rnd() * 0.8, lo = Math.min(o, c) - rnd() * 0.8;
    out.push({ time: t, open: +o.toFixed(2), high: +hi.toFixed(2), low: +lo.toFixed(2), close: +c.toFixed(2) }); px = c;
  }
  return out;
}

test('higher timeframes built from M5: UTC buckets, first open, extremes, last close', () => {
  const t = Date.UTC(2010, 0, 4) / 1000;
  const m5 = [0, 1, 2, 3].map((i) => ({ time: t + 600 + i * 300, open: 10 + i, high: 12 + i, low: 9 - i, close: 11 + i }));
  const h = buildTf(m5, 3600);
  assert.equal(h.length, 1); assert.deepEqual(h[0], { time: t, open: 10, high: 15, low: 6, close: 14 });
  const q = buildTf(m5, 900); assert.deepEqual(q.map((b) => b.time), [t, t + 900]);
  const F = framesOf(m5); assert.deepEqual(Object.keys(F).sort(), Object.keys(TF).sort());
});

test('the harness is the Trader block: same mapping, same record fields', () => {
  const tr = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
  assert.match(tr, /src\[id\]\.A = msAnalyze\(src\[id\]\.bars, 6\)/);
  assert.ok(tr.includes("const ev = (id, sec) => { const bb = src[id].bars; return src[id].A.events.filter((e) => e.breakIdx < bb.length - 1).map((e) => ({ t: bb[e.breakIdx].time + sec, dir: e.dir, level: e.level, top: e.top, bot: e.bot, flip: e.structure })); };"));
  assert.ok(tr.includes("cycleTrades({ E4: ev('4h', 14400), E1: ev('1h', 3600), E15: ev('15m', 900), E5: ev('5m', 300), h1: src['1h'].bars.slice(0, -1) }, now)"));
  assert.ok(tr.includes('const t1 = o.t1 != null && o.room ? o.t1 : +(o.entry + d * 2 * o.r0).toFixed(2);'));
  assert.ok(tr.includes("opened: now, checked: now, status: 'pending', R: null, r0: o.r0, validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',"));
  const r = recordOf({ leg: 'pull', tf: '5m', t: 100, side: 'sell', entry: 2000, stop: 2003, r0: 3, t1: 2002, rr: 0.67, room: false, h4: { t: 9 } }, [], 1999, 200);
  assert.equal(r.t1, 1994); assert.equal(r.rr, 2); assert.deepEqual(r.blockedBy, ['room']); assert.equal(r.shadow, true);
  const busy = recordOf({ leg: 'main', tf: '5m', t: 100, side: 'buy', entry: 2000, stop: 1997, r0: 3, t1: 2009, rr: 3, room: true, h4: { t: 9 } }, [{ k: 'mcycle', leg: 'main', status: 'open', shadow: false }], 2001, 200);
  assert.deepEqual(busy.blockedBy, ['cap']);
});

test('the forming candle cannot shape a kept event', () => {
  const m5 = walk(40);
  for (const [id, sec] of Object.entries(TF)) {
    const a = id === '5m' ? m5 : buildTf(m5, sec);
    for (const end of [800, a.length - 3]) {
      if (end > a.length - 1 || end < 300) continue;
      const closed = a.slice(Math.max(0, end - K.WIN), end), forming = { ...a[end], close: a[end].open + 50, high: a[end].open + 60, low: a[end].open - 60 };
      assert.deepEqual(evClosed(closed, sec), evTrader(closed.concat([forming]), sec));
    }
  }
});

test('replay: signals as the Trader sees them, stops on the losing side; no look-ahead', () => {
  const m5 = walk(70), D = framesOf(m5), from = m5[0].time + 25 * 86400;
  const A = replay(D, { from });
  assert.ok(A.length >= 2, `signals ${A.length}`);
  for (const tr of A) {
    assert.ok(tr.side === 'sell' ? tr.stop > tr.entry : tr.stop < tr.entry);
    const now = tr.opened, ev = {}, h1 = [];
    for (const [id, sec] of Object.entries(TF)) {
      const a = D[id]; let f = a.length - 1; for (let i = 0; i < a.length; i++) if (a[i].time <= now) f = i;
      const feed = a.slice(Math.max(0, f - K.WIN), f).concat([{ ...a[f] }]);
      ev[id] = evTrader(feed, sec); if (id === '1h') h1.push(...feed.slice(0, -1));
    }
    const o = cycleTrades({ E4: ev['4h'], E1: ev['1h'], E15: ev['15m'], E5: ev['5m'], h1 }, now).trades.find((x) => x.fresh && `xau-mcycle-${x.leg}-${x.h4.t}` === tr.id);
    assert.ok(o, tr.id); assert.equal(o.entry, tr.entry); assert.equal(o.stop, tr.stop);
  }
  const T = A[Math.floor(A.length / 2)].opened;
  const m5b = m5.map((b) => (b.time >= T ? { ...b, open: b.open + 37, high: b.high + 45, low: b.low + 30, close: b.close + 40 } : b));
  const B = replay(framesOf(m5b), { from });
  const pick = (L) => L.filter((x) => x.opened < T).map((x) => [x.id, x.entry, x.stop, x.t1, x.blockedBy.join()]);
  assert.deepEqual(pick(B), pick(A));
});

test('costs: $0.60 a round trip in R, financing on buys only, 2x doubles both', () => {
  const base = { entry: 2000, r0: 3, R: 2, filled: Date.UTC(2014, 0, 7, 10) / 1000, closed: Date.UTC(2014, 0, 7, 12) / 1000 };
  assert.equal(netOf({ ...base, side: 'sell' }), +(2 - 0.2).toFixed(4));
  assert.equal(netOf({ ...base, side: 'buy' }, 0), 2);
  const over = { ...base, closed: Date.UTC(2014, 0, 8, 23) / 1000 };   // Tue 22:00 + Wed 22:00 (x3) = 4 nights
  const fin = 4 * 0.000148 * 2000 / 3;
  assert.equal(netOf({ ...over, side: 'buy' }), +(2 - 0.2 - fin).toFixed(4));
  assert.equal(netOf({ ...over, side: 'buy' }, 2), +(2 - 0.4 - 2 * fin).toFixed(4));
  assert.equal(netOf({ ...over, side: 'sell' }, 2), +(2 - 0.4).toFixed(4));
});

test('statistics: Holm and the one-sided p; the placebo keeps side, risk and reward:risk and is seeded', () => {
  assert.ok(Math.abs(pOne(1.96) - 0.025) < 0.001); assert.ok(Math.abs(pOne(0) - 0.5) < 1e-6);
  assert.deepEqual(holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06]);
  const m5 = walk(60), real = [{ side: 'buy', r0: 2, rr: 1.5, leg: 'pull', opened: m5[100].time }, { side: 'sell', r0: 3, rr: 2, leg: 'main', opened: m5[200].time }];
  const P1 = placeboTrades(m5, real, mulberry32(7)), P2 = placeboTrades(m5, real, mulberry32(7));
  assert.deepEqual(P1.map((x) => [x.entry, x.R]), P2.map((x) => [x.entry, x.R]));
  for (const p of P1) {
    const d = p.side === 'sell' ? -1 : 1; assert.ok(Math.abs((p.entry - p.stop) * d - p.r0) < 0.011); assert.ok(Math.abs((p.t1 - p.entry) * d - p.rr * p.r0) < 0.011);
    assert.ok(p.R >= -1.5 && p.R <= p.rr + 1e-9);
  }
});

test('result: RESULT.md, result.json and positions.json agree; the pass rule is the pre-registered one', () => {
  const out = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8'));
  const md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8'), pos = JSON.parse(fs.readFileSync(new URL('positions.json', DIR), 'utf8'));
  assert.equal(out.verdict, verdictText(out));
  assert.ok(md.includes(`**Verdict: ${out.verdict}**`));
  assert.ok(out.verdict.length < 220);
  for (const [k, T] of Object.entries(out.tests)) {
    const c = T.checks;
    assert.equal(c.t2Holm, T.dec.net.tMonth >= 2 && T.pHolm < 0.05, k);
    assert.equal(c.sameSign2020, T.rec.net.avg > 0 && T.dec.net.avg > 0, k);
    assert.equal(c.x2, T.dec.x2.avg > 0, k);
    assert.equal(c.placebo, T.placebo.beaten >= 38, k); assert.equal(T.placebo.t.length, 40);
    assert.equal(T.pass, c.t2Holm && c.sameSign2020 && c.x2 && c.placebo, k);
    assert.ok(md.includes(`| ${T.dec.net.n} |`));
  }
  assert.equal(out.pass, out.tests.T3.pass);
  assert.equal(out.verdict.startsWith('PASS'), out.pass);
  const T3 = out.tests.T3, inDec = pos.filter((r) => r[2] >= K.W.dec[0] && r[2] < K.W.dec[1]);
  assert.equal(inDec.length, T3.dec.net.n);
  assert.equal(inDec.filter((r) => r[5] === 'pull').length, out.tests.T1.dec.net.n);
  assert.ok(Math.abs(inDec.reduce((a, r) => a + r[3], 0) - T3.dec.net.total) < 0.05 + inDec.length * 0.0006);
  for (const r of pos) { assert.ok(r[0] <= r[1] && r[1] <= r[2]); assert.ok(r[4] === 1 || r[4] === -1); assert.ok(r[2] < K.END); }
  assert.equal(pos.filter((r) => r[2] >= K.W.rec[0]).length, T3.rec.net.n);
});

test('analyse on hand-made trades: shadows and unfilled orders never count', () => {
  const t = Date.UTC(2010, 5, 2, 12) / 1000, mk = (o) => ({ market: 'xau', side: 'sell', entry: 1200, r0: 2, rr: 2, opened: t, filled: t + 300, closed: t + 3600, ...o });
  const L = [mk({ leg: 'pull', status: 'win', R: 2, shadow: false }), mk({ leg: 'main', status: 'loss', R: -1, shadow: true, blockedBy: ['room'] }),
    mk({ leg: 'main', status: 'expired', R: 0, shadow: false, filled: undefined })];
  const m5 = walk(30, 5, Date.UTC(2010, 5, 1) / 1000);
  const A = analyse(L, m5);
  assert.equal(A.tests.T3.dec.net.n, 1); assert.equal(A.tests.T2.dec.net.n, 0); assert.equal(A.tests.T1.dec.net.avg, +(2 - 0.3).toFixed(3));
  assert.equal(positionsOf(L).length, 1);
});
