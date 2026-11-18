// node --test tests/backtest-coach.test.mjs — ChronosTrade's trade coach (17 Nov 2026): the context of an entry from closed candles
// only, the sentence, the behaviour it can see, the "How you trade" splits and old sessions. Pure functions on BT, plus page wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const BT = createRequire(import.meta.url)('../assets/backtest-engine.js');
const page = readFileSync(new URL('../backtest.html', import.meta.url), 'utf8');
const M15 = 900, T0 = Date.UTC(2026, 0, 5, 0) / 1000;   // Mon 5 Jan 2026 00:00 UTC

// a deterministic path: a slow wave with noise, 15-minute candles
function path(n, seed = 7, drift = 0) { let s = seed, p = 2000; const out = []; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < n; i++) { const o = p; p += Math.sin(i / 37) * 1.4 + (rnd() - 0.5) * 3 + drift; out.push({ time: T0 + i * M15, open: o, high: Math.max(o, p) + rnd() * 1.5, low: Math.min(o, p) - rnd() * 1.5, close: p }); }
  return out; }
const bars = path(2400);

test('no look-ahead: changing every price after the moment changes nothing in the context', () => {
  for (const k of [700, 1200, 1999, 2300]) {
    const T = bars[k].time + M15, b = bars[k], o = { side: 'sell', entry: b.close, stop: b.close + 6, target: b.close - 12, at: b.time, riskSet: 1, riskPct: 1 };
    const a = BT.coachCtx(bars, M15, T, o, []);
    const fut = bars.map((x, i) => (i <= k ? x : { ...x, open: x.open * 3, high: x.high * 3 + 50, low: x.low / 3, close: x.close * 2 }));
    assert.deepEqual(BT.coachCtx(fut, M15, T, o, []), a, 'bar ' + k);
    // a candle still forming at T (it ends after T) is not read either
    const half = fut.map((x, i) => (i === k + 1 ? { ...x, high: 99999, low: 1, close: 5 } : x));
    assert.deepEqual(BT.coachCtx(half, M15, T, o, []), a);
    // and the candle that closed at T IS read: changing it changes the context
    const last = bars.map((x, i) => (i === k ? { ...x, high: x.high + 500, close: x.close + 400 } : x));
    assert.notDeepEqual(BT.coachCtx(last, M15, T, o, []), a);
  }
});

test('the context: session, trend with or against, ATR stop, R:R, yesterday, break, streak', () => {
  const up = path(1500, 3, 0.6), k = 1400, b = up[k], T = b.time + M15;
  const buy = BT.coachCtx(up, M15, T, { side: 'buy', entry: b.close, stop: b.close - 5, target: b.close + 10, at: b.time }, []);
  const sell = BT.coachCtx(up, M15, T, { side: 'sell', entry: b.close, stop: b.close + 5, target: b.close - 10, at: b.time }, []);
  assert.equal(buy.trend.htf, 'up'); assert.equal(buy.htfRel, 'with'); assert.equal(sell.htfRel, 'against');
  assert.ok(['H4', 'H1'].includes(buy.trend.htfName));
  assert.equal(buy.rr, 2); assert.ok(buy.stopAtr > 0);
  const h = new Date(b.time * 1000).getUTCHours(); assert.equal(buy.session, h >= 7 && h < 12 ? 'London' : h >= 12 && h < 21 ? 'New York' : 'Asia');
  assert.ok(buy.pd && buy.pd.hi > buy.pd.lo);
  // a fresh close through the last swing high
  const sw = [];
  for (let i = 0; i < 60; i++) sw.push({ time: T0 + i * M15, open: 100, high: 100 + (i === 50 ? 3 : 1), low: 99, close: 100 });
  sw.push({ time: T0 + 60 * M15, open: 100, high: 104, low: 100, close: 103.5 });
  assert.deepEqual(BT.swingBreak(sw), { dir: 'up', ago: 0, level: 103 });
  // streak: a loss closed 10 minutes before the entry
  const prior = [{ id: 1, side: 'buy', openedAt: b.time - 7200, closedAt: b.time - 600, net: -100, R: -1 }];
  const c2 = BT.coachCtx(up, M15, T, { side: 'buy', entry: b.close, stop: b.close - 5, target: null, at: b.time }, prior);
  assert.deepEqual(c2.prev, { res: 'loss', run: 1, min: 10 }); assert.equal(c2.revenge, true); assert.equal(c2.rr, null);
  // a trade that closed AFTER the entry is not "before" it
  const c3 = BT.coachCtx(up, M15, T, { side: 'buy', entry: b.close, stop: b.close - 5, at: b.time }, [{ ...prior[0], closedAt: b.time + 600 }]);
  assert.equal(c3.prev, undefined); assert.equal(c3.revenge, false);
});

test('the sentence', () => {
  const c = { side: 'sell', session: 'London', trend: { htf: 'up', htfName: 'H1' }, htfRel: 'against', stopAtr: 1.32, rr: 2, pd: { toHiAtr: 0.41, toLoAtr: 3.2 } };
  assert.equal(BT.coachSentence(c), "Selling in London, against the H1 uptrend, 1.3 ATR stop, 2R target, 0.4 ATR under yesterday's high.");
  assert.equal(BT.coachSentence({ ...c, side: 'buy', htfRel: 'with', trend: { htf: 'down', htfName: 'H4' }, rr: null, pd: { toHiAtr: -0.5, toLoAtr: 4 } }),
    "Buying in London, with the H4 downtrend, 1.3 ATR stop, no target, 0.5 ATR above yesterday's high.");
  assert.equal(BT.coachSentence({ ...c, trend: { htf: 'flat', htfName: 'H1' }, htfRel: 'flat', brk: { dir: 'down', ago: 2, rel: 'with' }, revenge: true, prev: { res: 'loss', min: 12 } }),
    "Selling in London, with no clear H1 trend, 1.3 ATR stop, 2R target, 0.4 ATR under yesterday's high, 2 bars after a break down through the last swing low, 12 min after a loss.");
  assert.equal(BT.coachSentence(null), 'No context recorded for this trade.');
  assert.equal(BT.coachSentence(undefined), 'No context recorded for this trade.');
});

test('behaviour: stop moved away / to break-even, early exit, revenge, oversized are suggestions with a mistake name', () => {
  const a = BT.newAccount(100000);
  const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 102, units: 1000 }, T0);
  p.stop = 98.5; BT.coachStop(p); assert.equal(p.stopAway, 0.5);
  p.stop = 99.2; BT.coachStop(p); assert.equal(p.stopAway, 0.5, 'the widest it ever was is kept');
  p.stop = 100; BT.coachStop(p); assert.equal(p.beMoved, true);
  assert.equal(p.stop, 100, 'coachStop never moves a stop');
  const t = BT.close(a, p, 100.5, T0 + 3600, 'manual');
  const f = BT.coachFlags(t, a.closed).map((x) => x.k); assert.deepEqual(f, ['away', 'be', 'early']);
  assert.equal(BT.coachFlags(t, a.closed).find((x) => x.k === 'away').mistake, 'Moved my stop');
  // a target close is never "early"; a stop out is never "early"
  const q = BT.place(a, { side: 'sell', type: 'market', price: 100, stop: 101, target: 99, units: 1000 }, T0 + 4000);
  const tq = BT.close(a, q, 101, T0 + 4600, 'stop'); assert.deepEqual(BT.coachFlags(tq, a.closed).map((x) => x.k), []);
  // revenge: opened 10 minutes after that loss; oversized: 2.5 % risked with 1 % set
  const r = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 103, units: 2500 }, T0 + 5200); r.riskSet = 1; r.riskPct = 2.5;
  const tr = BT.close(a, r, 103, T0 + 9000, 'target'); const fl = BT.coachFlags(tr, a.closed);
  assert.deepEqual(fl.map((x) => x.k), ['revenge', 'size']); assert.deepEqual(fl.map((x) => x.mistake), ['Revenge trade', 'Oversized']);
  // every suggested mistake is one the review dialog offers
  const MIST = /const MISTAKES = (\[[^\]]+\])/.exec(page)[1]; for (const m of ['Moved my stop', 'Exited early', 'Revenge trade', 'Oversized']) assert.ok(MIST.includes(`'${m}'`), m);
});

test('splits: "too few to judge" under 20, "your record, not a tested edge" from 20; the lead only with 20+ on both sides', () => {
  const mk = (i, rel, R) => ({ id: i, side: 'buy', openedAt: T0 + i * 3600, closedAt: T0 + i * 3600 + 900, net: R * 100, R, ctx: { side: 'buy', session: 'London', htfRel: rel, stopAtr: 1, prev: null } });
  const few = []; for (let i = 0; i < 19; i++) few.push(mk(i, 'with', i % 2 ? 2 : -1)); for (let i = 19; i < 40; i++) few.push(mk(i, 'against', -1));
  let sp = BT.coachSplits(few); const htf = sp.features.find((f) => f.k === 'htf');
  assert.equal(htf.groups.find((g) => g.label === 'With the trend').judge, 'too few to judge');
  assert.equal(htf.groups.find((g) => g.label === 'Against the trend').judge, 'your record, not a tested edge');
  assert.equal(sp.lead, null, 'no lead while one side has 19');
  few.push(mk(40, 'with', 2)); sp = BT.coachSplits(few);
  assert.ok(sp.lead && sp.lead.k === 'htf' && sp.lead.n >= 20 && sp.lead.restN >= 20, JSON.stringify(sp.lead));
  assert.match(sp.lead.text, /Your record, not a tested edge\.$/); assert.match(sp.lead.text, /n 20\b|n 21\b/);
  const g = BT.coachSplits(few).features.find((f) => f.k === 'htf').groups.find((x) => x.label === 'Against the trend');
  assert.equal(g.n, 21); assert.equal(g.meanR, -1); assert.equal(g.winRate, 0); assert.equal(g.t, null, 'no spread, no t');
});

test('old sessions: trades without ctx keep working and are counted apart', () => {
  const old = [{ id: 1, side: 'buy', openedAt: T0, closedAt: T0 + 900, net: 50, R: 0.5 }, { id: 2, side: 'sell', openedAt: T0 + 1800, closedAt: T0 + 2700, net: -100, R: -1 }];
  const sp = BT.coachSplits(old); assert.equal(sp.n, 2); assert.equal(sp.noCtx, 2); assert.equal(sp.lead, null);
  assert.ok(sp.features.every((f) => f.groups.length === 0));
  assert.deepEqual(BT.coachFlags(old[1], old), []);
  assert.equal(BT.stats(old, 1000).n, 2);
  // ctx survives export / import (JSON) and the journal merge of partial closes
  const a = BT.newAccount(10000); const p = BT.place(a, { side: 'buy', type: 'market', price: 100, stop: 99, target: 103, units: 100 }, T0); p.ctx = { side: 'buy', session: 'Asia' };
  BT.closePartial(a, p, 101, T0 + 900, 0.5); BT.close(a, p, 102, T0 + 1800, 'manual');
  const back = JSON.parse(JSON.stringify(a)); assert.deepEqual(BT.trades(back.closed)[0].ctx, { side: 'buy', session: 'Asia' });
});

test('page wiring: context recorded at every entry, stops tracked, sentence on the draft, journal, review and report, the card', () => {
  assert.match(page, /rec\.riskSet = \+\$\('o-risk'\)\.value \|\| 0; rec\.riskPct = coachRisk\(u, e, stop\); coachAt\(rec, mom\(\)\);/);   // instant
  assert.match(page, /if \(type === 'market'\) coachAt\(rec, mom\(\)\);/);   // draft confirm
  assert.match(page, /if \(e\.kind === 'fill'\) coachAt\(e\.pos, e\.pos\.openedAt\)/);   // a resting order filled
  assert.equal((page.match(/BT\.coachStop\(p\)/g) || []).length, 4, 'drag, typed stop, break-even, break-even on every trade in profit (18 Nov 2026)');
  assert.match(page, /class="dsay"/); assert.match(page, /class="say\$\{t\.ctx/); assert.match(page, /id="mist-seen"/); assert.match(page, /What the coach saw/);
  assert.match(page, /id="vc-coach"/); assert.match(page, /renderCoach\(RC\)/); assert.match(page, /coachBackfill\(\); render\(\);/);
  // the coach never places, closes or cancels anything: its helpers call no order function
  const helpers = page.slice(page.indexOf('// ---- trade coach (17 Nov 2026'), page.indexOf('// one click: a market order'));
  assert.ok(helpers.length > 200); assert.doesNotMatch(helpers, /BT\.(place|close|closePartial|cancel)\(|\.stop = /);
  // its CSS is not in the simple phone view's block, and no text under 12 px
  for (const sel of ['.dchip .dsay', '.jt td.lv small.say', '.mist-seen', '.co-t table']) { const i = page.indexOf(sel); assert.ok(i > 0, sel); }
  const css = page.match(/\.dchip \.dsay \{[^}]+\}|\.jt td\.lv small\.say \{[^}]+\}|\.co-t th \{[^}]+\}/g).join(' ');
  for (const m of css.matchAll(/(?:font-size:|font: \d+ )\s*([\d.]+)px/g)) assert.ok(+m[1] >= 12, m[0]);
});

test('drawings: levels against the entry, a trend line in time terms, only drawings made before the entry', () => {
  const T = T0 + 100 * M15, o = { side: 'sell', entry: 4120.4, stop: 4128.9, target: 4072.8, at: T - M15, dec: 2 }, atr = 4;
  const draw = [{ type: 'h', price: 4120, at: T - 3600 }, { type: 'h', price: 4070 }, { type: 'h', price: 4200, at: T + 900 }];
  const d = BT.coachDraw(draw, T, o, atr);
  assert.equal(d.n, 2, 'the line drawn after the entry is ignored; the one without a stamp counts as earlier');
  assert.equal(d.near.price, 4120); assert.equal(d.atLevel, true); assert.equal(d.near.dAtr, 0.1);
  assert.equal(d.stopBehind, true); assert.equal(d.stopBeyondAtr, 2.22); assert.equal(d.next.price, 4070); assert.equal(d.targetBefore, true);
  const c = { side: 'sell', session: 'London', stopAtr: 2.1, rr: 5.6, draw: d, dec: 2 };
  assert.equal(BT.coachSentence(c), 'Selling in London, 2.1 ATR stop, 5.6R target; selling at your drawn level 4,120.00 (0.1 ATR away), stop 2.2 ATR above it, target before your next line at 4,070.00.');
  // a box around the entry, and a trend line: its value at the entry time on the line through its two points
  const tl = { type: 't', t1: T0, p1: 4000, t2: T0 + 10 * M15, p2: 4010 };
  assert.equal(BT.lineAt(tl, T0 + 100 * M15), 4100);
  const d2 = BT.coachDraw([{ type: 'r', t1: T0, p1: 4110, t2: T0 + 5 * M15, p2: 4125 }, tl], T, { ...o, at: T0 + 100 * M15 }, atr);
  assert.equal(d2.inBox, true); const t = d2.items.find((x) => x.kind === 'trend line');
  assert.equal(t.value, 4100); assert.equal(t.side, 'above'); assert.equal(t.respects, false, 'a sell above the line goes against it');
  assert.match(BT.coachSentence({ side: 'sell', session: 'Asia', draw: d2, dec: 2 }), /selling inside your drawn box.*above your trend line \(4,100\.00 at entry, against it\)/);
  // away from the levels: the side and the distance, and the target against that same line
  const d3 = BT.coachDraw([{ type: 'h', price: 4100 }], T, { ...o, entry: 4110, stop: 4115, target: 4090 }, atr);
  assert.equal(BT.coachSentence({ side: 'sell', session: 'Asia', draw: d3, dec: 2 }), 'Selling in Asia, no target; 2.5 ATR above your nearest drawn level 4,100.00, target past it.');
  // no drawings, or all made later: nothing in the context
  assert.equal(BT.coachDraw([], T, o, atr), null); assert.equal(BT.coachDraw([{ type: 'h', price: 1, at: T + 1 }], T, o, atr), null);
  // in coachCtx: a drawing made after the moment changes nothing
  const k = 1500, b = bars[k], T2 = b.time + M15, o2 = { side: 'buy', entry: b.close, stop: b.close - 5, target: b.close + 10, at: b.time };
  const base = BT.coachCtx(bars, M15, T2, { ...o2, draw: [{ type: 'h', price: b.close - 1, at: T2 - 60 }] }, []);
  assert.deepEqual(BT.coachCtx(bars, M15, T2, { ...o2, draw: [{ type: 'h', price: b.close - 1, at: T2 - 60 }, { type: 'h', price: b.close + 3, at: T2 + 1 }] }, []), base);
  assert.equal(base.draw.atLevel, true);
});

test('drawings: "entered away from your drawn levels" is a suggestion, and the "Your levels" split', () => {
  const t = { id: 1, side: 'buy', openedAt: T0, closedAt: T0 + 900, net: -1, R: -1, reason: 'stop', ctx: { side: 'buy', draw: { n: 1, near: { kind: 'line', price: 1, dAtr: 1.6 }, atLevel: false, inBox: false } } };
  const f = BT.coachFlags(t, [t]).find((x) => x.k === 'levels'); assert.equal(f.mistake, 'Against my plan'); assert.match(f.text, /1\.6 ATR/);
  t.ctx.draw.near.dAtr = 0.8; assert.equal(BT.coachFlags(t, [t]).some((x) => x.k === 'levels'), false);
  const L = []; for (let i = 0; i < 25; i++) L.push({ id: i + 10, side: 'buy', openedAt: T0 + i * 3600, closedAt: T0 + i * 3600 + 900, net: i % 3 ? 100 : -100, R: i % 3 ? 1 : -1, ctx: { side: 'buy', draw: { n: 1, near: { dAtr: 0.2 }, atLevel: i < 21, inBox: false, stopBehind: i % 2 === 0 } } });
  const sp = BT.coachSplits(L), lv = sp.features.find((x) => x.k === 'lvl'), ls = sp.features.find((x) => x.k === 'lvlstop');
  assert.equal(lv.groups.find((g) => g.label === 'At a drawn level').n, 21); assert.equal(lv.groups.find((g) => g.label === 'At a drawn level').judge, 'your record, not a tested edge');
  assert.equal(lv.groups.find((g) => g.label === 'Away from your levels').judge, 'too few to judge');
  assert.deepEqual(ls.groups.map((g) => g.label).sort(), ['Stop behind a drawn level', 'Stop not behind one']);
});

test('page: new drawings carry the replay moment; drawings reach the coach', () => {
  // every new shape (any tool, 17 Nov 2026) is stamped at the moment it is drawn, then pushed; a clone is a new drawing
  assert.match(page, /const finish = \(pt\) => \{ const d = DT === 'h'[^\n]*\n\s*d\.at = mom\(\);[^\n]*S\.draw\.push\(d\)/);
  assert.match(page, /c\.at = mom\(\); delete c\.editedAt;/);
  assert.equal((page.match(/draw: S\.draw, dec: S\.dec/g) || []).length, 2);
});
