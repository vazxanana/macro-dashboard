// node --test tests/mosha-replay.test.mjs: the Mosha desk's chart (assets/mosha-replay.js): the owner's five example trades with
// their marks, the replay's pure pieces, the page wiring and the hand-over to ChronosTrade. Offline: no candle is fetched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../assets/mosha-replay.js');
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const PAGE = rd('../market-structure.html'), JS = rd('../assets/mosha-replay.js'), DESK = rd('../assets/mosha-desk.js'), CT = rd('../backtest.html');
const U = (s) => Date.parse(s + ':00Z') / 1000, bar = (t, o, h, l, c) => ({ time: t, open: o, high: h, low: l, close: c });

test('the five example trades are the owner\'s own, each with a stop on the losing side', () => {
  assert.deepEqual(R.EXAMPLES.map((e) => e.id), ['nov10', 'oct28', 'oct29', 'nov2s', 'nov2b']);
  const want = { nov10: ['sell', 4120.42, 4128.92, 4072.84], oct28: ['sell', 4048.59, 4076.69, 3971.09], oct29: ['sell', 4035.72, 4045.96, 3988.44], nov2s: ['sell', 3908.27, 3916.10, 3878.42], nov2b: ['buy', 3900.709, 3896.786, 3965.077] };
  for (const e of R.EXAMPLES) {
    assert.deepEqual([e.side, e.entry, e.stop, e.target], want[e.id], e.id); assert.equal(e.market, 'xau');
    assert.ok(e.side === 'sell' ? e.stop > e.entry && e.target < e.entry : e.stop < e.entry && e.target > e.entry, e.id + ': stop and target on the right sides');
    assert.ok(e.from < e.fillFrom && e.fillFrom < e.to && e.to - e.from <= 4900 * 300, e.id + ': one candle request covers it');
    for (const m of e.marks) { assert.ok(['level', 'vr', 'bvr', 'zone', 'htf'].includes(m.kind)); assert.ok(m.a >= e.from && m.b <= e.to && m.a < m.b, `${e.id} ${m.label}: inside the window`); if (m.kind === 'level') assert.ok(m.p > 0); else assert.ok(m.top > m.bot); assert.ok(m.at == null || (m.at >= m.a && m.at <= m.b)); }
    const ts = e.steps.filter((s) => typeof s.t === 'number').map((s) => s.t); assert.deepEqual(ts, [...ts].sort((a, b) => a - b), e.id + ': steps in time order'); assert.equal(e.steps.at(-1).t, 'exit'); assert.ok(e.steps.some((s) => s.t === 'fill'));
    assert.ok(e.label && e.yours && e.title);
  }
  // the sells' VR is the red "5 mn" box above the entry; the buy's is the green box around it
  for (const id of ['nov10', 'oct28', 'nov2s']) { const e = R.EXAMPLES.find((x) => x.id === id), vr = e.marks.find((m) => m.kind === 'vr'); assert.ok(vr && vr.top > e.entry && vr.b <= e.fillFrom + 3 * 3600, id); }
  assert.ok(R.EXAMPLES.find((x) => x.id === 'nov2b').marks.some((m) => m.kind === 'bvr'));
  // the screenshots' clock is New York: 15:25 on 9 Nov is 20:25 UTC, 16:00 on 28 Oct (still summer time) is 20:00 UTC
  assert.equal(R.EXAMPLES[0].steps[1].t, U('2026-11-09T20:25')); assert.equal(R.EXAMPLES[1].steps[1].t, U('2026-10-28T20:00'));
  assert.equal(R.EXAMPLES.find((x) => x.id === 'nov2s').exit.p, 3891.46);
});

test('the trade on the candles: fill at the entry price, stop first, a hand exit when the owner closed it', () => {
  const t0 = U('2026-11-10T05:00'), sp = { side: 'sell', entry: 100, stop: 102, target: 94, fillFrom: t0 };
  const B = [bar(t0 - 300, 99, 100.5, 98.5, 99), bar(t0, 99, 99.6, 98.8, 99.4), bar(t0 + 300, 99.4, 100.2, 99.3, 100.1), bar(t0 + 600, 100.1, 101.5, 99, 99.2), bar(t0 + 900, 99.2, 99.4, 93.5, 94)];
  assert.deepEqual(R.outcome(sp, B), { fill: t0 + 300, fillI: 2, exit: t0 + 900, exitI: 4, kind: 'target', R: 3, worst: 0.75, px: 94 });
  assert.equal(R.outcome(sp, [bar(t0, 100, 102.5, 93, 95)]).kind, 'stop'); assert.equal(R.outcome(sp, [bar(t0, 100, 102.5, 93, 95)]).R, -1);
  assert.equal(R.outcome(sp, B.slice(0, 4)).kind, 'open'); assert.equal(R.outcome(sp, [bar(t0, 105, 106, 104, 105)]).fill, null); assert.equal(R.outcome(sp, []).fill, null);
  const hand = R.outcome({ ...sp, exit: { p: 97, t: t0 + 600 } }, B); assert.deepEqual([hand.kind, hand.R, hand.exit], ['hand', 1.5, t0 + 600]);
  const buy = R.outcome({ side: 'buy', entry: 100, stop: 98, target: 106, fillFrom: t0 }, [bar(t0, 100.5, 101, 99.9, 100.8), bar(t0 + 300, 100.8, 106.2, 100.4, 106)]); assert.deepEqual([buy.kind, buy.R], ['target', 3]);
});

test('the replay shows only what was known: marks from their time, cut at the cursor; steps by time', () => {
  const e = R.EXAMPLES[0], at = (s) => R.marksAt(e, U(s));
  assert.deepEqual(at('2026-11-09T16:00').map((m) => m.kind), ['level', 'htf']);
  assert.equal(at('2026-11-09T20:27').some((m) => m.kind === 'vr'), false, 'the VR is not drawn before the extreme is in');
  const vr = at('2026-11-09T22:00').find((m) => m.kind === 'vr'); assert.equal(vr.b, U('2026-11-09T22:00'), 'the box grows with the replay'); assert.equal(e.marks.find((m) => m.kind === 'vr').b, U('2026-11-10T02:15'), 'the example itself is not changed');
  assert.equal(at('2026-11-10T02:00').some((m) => m.kind === 'zone'), false); assert.equal(at('2026-11-10T03:00').some((m) => m.kind === 'zone'), true); assert.equal(at('2026-11-10T11:00').length, e.marks.length);
  const oc = { fill: U('2026-11-10T05:20'), exit: U('2026-11-10T10:55') }, steps = R.stepsOf(e, oc);
  assert.equal(steps.length, 7); assert.equal(steps[5].t, oc.fill); assert.equal(steps[6].t, oc.exit);
  assert.equal(R.stepAt(steps, e.from - 1), -1); assert.equal(R.stepAt(steps, U('2026-11-09T20:26')), 1); assert.equal(R.stepAt(steps, U('2026-11-10T05:19')), 4); assert.equal(R.stepAt(steps, U('2026-11-10T11:00')), 6);
  assert.equal(R.stepsOf(e, { fill: null, exit: null }).length, 5, 'no fill on the candles: the fill and exit steps are left out');
});

test('candles: M15 and H1 are built from M5; the bar at a time', () => {
  const t0 = U('2026-11-10T05:00'), B = [bar(t0, 1, 3, 0.5, 2), bar(t0 + 300, 2, 4, 1.5, 3), bar(t0 + 600, 3, 3.5, 1, 1.2), bar(t0 + 900, 1.2, 2, 1.1, 1.9)];
  assert.deepEqual(R.aggBars(B, 900), [bar(t0, 1, 4, 0.5, 1.2), bar(t0 + 900, 1.2, 2, 1.1, 1.9)]); assert.equal(R.aggBars(B, 300), B); assert.deepEqual(R.aggBars(B, 3600), [bar(t0, 1, 4, 0.5, 1.9)]);
  assert.equal(R.barAt(B, t0 - 1), -1); assert.equal(R.barAt(B, t0), 0); assert.equal(R.barAt(B, t0 + 599), 1); assert.equal(R.barAt(B, t0 + 9999), 3);
});

test('a logged trade opens in the same chart; the hand-over to ChronosTrade carries only what was known before the entry', () => {
  const now = U('2026-11-10T12:00'), t = { id: 'x1', market: 'xau', side: 'sell', at: U('2026-11-10T05:20'), entry: 4120.42, stop: 4128.92, target: 4072.84, status: 'closed', exit: 4072.84, exitAt: U('2026-11-10T10:55'), R: 5.598 };
  const sp = R.specOfTrade(t, now); assert.equal(sp.from, t.at - 12 * 3600); assert.equal(sp.to, t.exitAt + 7200); assert.deepEqual(sp.exit, { p: 4072.84, t: t.exitAt }); assert.equal(sp.marks.length, 0); assert.match(sp.yours, /^\+5\.60R/);
  const open = R.specOfTrade({ ...t, status: 'open', exit: null, exitAt: null, R: null }, now); assert.equal(open.to, now); assert.equal(open.exit, null); assert.equal(open.yours, 'still open');
  const h = R.handoff(R.EXAMPLES[0], 123); assert.deepEqual([h.made, h.sym, h.tf, h.start, h.days], [123, 'xau', '5m', U('2026-11-09T20:30'), 3]); assert.match(h.name, /^Mosha 10 Nov sell · 4120\.42 \/ 4128\.92 \/ 4072\.84$/);
  assert.deepEqual(h.draw.map((d) => d.type), ['t', 'r', 'r']); assert.ok(h.draw.every((d) => d.t2 <= h.start), 'nothing from after the start is drawn'); assert.deepEqual([h.draw[0].p1, h.draw[0].p2], [4146.9, 4146.9]);
  // ChronosTrade reads it once, checks it and removes it; a stale or foreign hand-over is ignored
  assert.match(CT, /localStorage\.getItem\('btLab:handoff'\) \|\| 'null'\); localStorage\.removeItem\('btLab:handoff'\)/); assert.match(CT, /MARKETS\.some\(\(m\) => m\[0\] === HAND\.sym\)/); assert.match(CT, /Date\.now\(\) - \(\+HAND\.made \|\| 0\) < 10 \* 60e3/);
  assert.match(CT, /S\.draw = handDraw\(\);/); assert.match(CT, /d\.type === 't' \|\| d\.type === 'r'/); assert.match(CT, /\.slice\(0, 24\)/);
});

test('page wiring: the chart card on the Mosha desk, members only, nothing that trades', () => {
  assert.ok(PAGE.includes('<script src="/assets/mosha-replay.js" defer></script>'));
  const sec = PAGE.slice(PAGE.indexOf('id="v-mosha"'), PAGE.indexOf('id="v-lit"'));
  for (const id of ['mo-replay', 'mo-rp-pick', 'mo-rp-chart', 'mo-rp-ov', 'mo-rp-msg', 'mo-rp-cap', 'mo-rp-start', 'mo-rp-back', 'mo-rp-play', 'mo-rp-fwd', 'mo-rp-end', 'mo-rp-slider', 'mo-rp-steps', 'mo-rp-tf', 'mo-rp-speed', 'mo-rp-ct', 'mo-rp-res']) assert.ok(sec.includes(`id="${id}"`), id);
  assert.match(sec, /id="mo-rp-cap" aria-live="polite"/); assert.match(sec, /id="mo-rp-slider"[^>]*aria-label=/); assert.match(sec, /examples you picked, so they show the pattern, not how often it wins/);
  assert.match(DESK, /data-mo-replay=/); assert.match(DESK, /if \(root\.msMoshaReplay\) root\.msMoshaReplay\(\)/); assert.match(JS, /root\.msMoshaReplayTrade = function/);
  assert.ok(!/require\(|import /.test(JS)); assert.ok(!/prompt\(|confirm\(|alert\(/.test(JS)); assert.ok(!/api\/(mosha|run|ctrader|bridge)/.test(JS), 'the chart reads candles only');
  assert.deepEqual([...JS.matchAll(/fetch\('([^']+)'/g)].map((m) => m[1]), ['/md/bars?sym=']);
  // the owner's light-mode candles stay grey up / black down here too
  assert.match(JS, /light\(\) \? \{ upColor: '#c9ccd2', downColor: '#131722'/);
});
