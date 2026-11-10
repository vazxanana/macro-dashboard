// node --test tests/mosha-replay.test.mjs: the Mosha desk's chart (assets/mosha-replay.js): the owner's five example trades with
// their marks, the two bigger pictures from the earlier screenshots, the replay's pure pieces, the page wiring and the hand-over
// to ChronosTrade. Offline: no candle is fetched.
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
  assert.match(JS, /addEventListener\('input', function \(ev\) \{ var v = \+ev\.target\.value; stop\(\); show\(v\); \}\)/, 'the slider reads its value before the replay stops (stop redraws it at the old place)');
  assert.ok(!/require\(|import /.test(JS)); assert.ok(!/prompt\(|confirm\(|alert\(/.test(JS)); assert.ok(!/api\/(mosha|run|ctrader|bridge)/.test(JS), 'the chart reads candles only');
  assert.deepEqual([...JS.matchAll(/fetch\('([^']+)'/g)].map((m) => m[1]), ['/md/bars?sym=']);
  // the owner's light-mode candles stay grey up / black down here too
  assert.match(JS, /light\(\) \? \{ upColor: '#c9ccd2', downColor: '#131722'/);
});

test('the bigger pictures: the earlier screenshots as two studies, shown only as far as the replay has reached', () => {
  assert.deepEqual(R.STUDIES.map((e) => e.id), ['cycle', 'oct29e']); assert.equal(R.EXAMPLES.length, 5, 'the trades list is unchanged');
  for (const e of R.STUDIES) {
    const base = { '5m': 300, '15m': 900 }[e.base]; assert.ok(base, e.id); assert.equal(e.market, 'xau'); assert.ok(e.label && e.title && e.yours);
    assert.ok(e.from < e.fillFrom && e.fillFrom < e.to && e.to - e.from <= 4900 * base, e.id + ': one candle request covers it');
    assert.deepEqual(R.tfsOf(e), e.tfs); assert.ok(e.tfs.includes(e.view) && e.tfs.every((x) => x >= base), e.id + ': never candles smaller than the ones fetched');
    assert.ok(e.handFrom > e.from && e.handFrom < e.to);
    for (const m of e.marks) { assert.ok(['level', 'vr', 'bvr', 'zone'].includes(m.kind)); assert.ok(m.a >= e.from && m.b <= e.to && m.a < m.b, `${e.id} ${m.label}`); if (m.kind === 'level') assert.ok(m.p > 0); else assert.ok(m.top > m.bot);
      assert.ok(m.at != null && m.at >= m.a && m.at <= m.b, `${e.id} ${m.label}: appears only once its high or low is in`); if (m.relabel) assert.ok(m.relabel.at >= m.at && /^BO sell /.test(m.relabel.label) && !/BO sell/.test(m.label), 'a line is called BO sell only once the break is in'); }
    const ts = e.steps.filter((x) => typeof x.t === 'number').map((x) => x.t); assert.deepEqual(ts, [...ts].sort((a, b) => a - b), e.id + ': steps in time order'); assert.ok(ts[0] >= e.from && ts.at(-1) <= e.to);
  }
  assert.deepEqual(R.tfsOf(R.EXAMPLES[0]), [300, 900, 3600]);
  // the top-down picture carries the 28 Oct sell, same levels, with its stop
  const cy = R.STUDIES[0], s28 = R.EXAMPLES.find((x) => x.id === 'oct28'); assert.deepEqual([cy.side, cy.entry, cy.stop, cy.target], [s28.side, s28.entry, s28.stop, s28.target]); assert.ok(cy.stop > cy.entry);
  assert.deepEqual([cy.base, cy.view, cy.h4off], ['15m', 3600, 3600]); assert.ok(cy.steps.some((x) => x.t === 'fill') && cy.steps.some((x) => x.t === 'exit'));
  const at = (x) => R.marksAt(cy, U(x)).map((m) => m.label);
  assert.deepEqual(at('2026-10-07T12:50'), []); assert.deepEqual(at('2026-10-12T02:00'), ['H4 low 4066.5'], 'the high is not named while it is still being made');
  assert.deepEqual(at('2026-10-20T00:00'), ['H4 low 4066.5', 'High 4217.4']); assert.deepEqual(at('2026-10-22T17:00'), ['BO sell 4066.5', 'High 4217.4']);
  assert.equal(at('2026-10-23T14:30').includes('M15 VR'), false); assert.equal(at('2026-10-23T14:45').includes('M15 VR'), true); assert.equal(at('2026-10-30T20:00').length, cy.marks.length);
  assert.equal(cy.marks[0].label, 'H4 low 4066.5', 'the picture itself is not changed by the replay');
  // the second one has no position on the screenshot, so none is invented
  const ev = R.STUDIES[1]; assert.deepEqual([ev.entry, ev.stop, ev.target], [null, null, null]); assert.equal(R.outcome(ev, [bar(ev.fillFrom, 4008, 4010, 4005, 4006)]).fill, null); assert.deepEqual(ev.watch, { t: U('2026-10-29T23:45'), side: 'sell' });
  assert.equal(R.stepsOf(ev, { fill: null }).length, ev.steps.length);
});

test('a picture without a position: what price did after the candle it points at; H4 candles from 17:00 New York', () => {
  const t0 = U('2026-10-29T23:45'), sp = { watch: { t: t0, side: 'sell' } };
  const B = [bar(t0 - 300, 12, 13, 11, 12), bar(t0, 12, 12.5, 9.5, 10), bar(t0 + 300, 10, 11.5, 9, 9.2), bar(t0 + 600, 9.2, 9.4, 4, 5), bar(t0 + 900, 5, 13, 4.5, 12)];
  assert.deepEqual(R.follow(sp, B), { t: t0, px: 10, best: 6, bestT: t0 + 600, bestPx: 4, worst: 1.5 }, 'the move against it counts only on the way to the furthest point');
  assert.deepEqual(R.follow({ watch: { t: t0, side: 'buy' } }, B), { t: t0, px: 10, best: 3, bestT: t0 + 900, bestPx: 13, worst: 6 });
  assert.equal(R.follow(sp, B.slice(0, 1)), null); assert.equal(R.follow({}, B), null); assert.equal(R.follow(sp, []), null);
  const h = U('2026-10-22T12:00'), H1 = [0, 1, 2, 3, 4, 5].map((i) => bar(h + i * 3600, 10 + i, 11 + i, 9 + i, 10.5 + i));
  assert.deepEqual(R.aggBars(H1, 14400, 3600).map((x) => x.time), [U('2026-10-22T09:00'), U('2026-10-22T13:00'), U('2026-10-22T17:00')]); assert.deepEqual(R.aggBars(H1, 14400).map((x) => x.time), [U('2026-10-22T12:00'), U('2026-10-22T16:00')]);
  assert.deepEqual(R.aggBars(H1, 14400, 3600)[1], bar(U('2026-10-22T13:00'), 11, 15, 10, 14.5));
});

test('the bigger pictures hand over to ChronosTrade too, and the page offers them apart from the trades', () => {
  const cy = R.handoff(R.STUDIES[0], 5), ev = R.handoff(R.STUDIES[1], 5);
  assert.deepEqual([cy.tf, cy.start, cy.days], ['5m', U('2026-10-28T20:15'), 3]); assert.ok(cy.draw.length >= 2 && cy.draw.every((d) => d.t1 >= cy.start - 86400 && d.t2 <= cy.start && d.t1 < d.t2), 'a line from weeks back starts a day before the session');
  assert.match(cy.name, /4048\.59 \/ 4076\.69 \/ 3971\.09$/); assert.equal(ev.name, 'Mosha 29 Oct evening', 'no levels in the name when no position is drawn'); assert.equal(ev.start, U('2026-10-29T20:15')); assert.equal(ev.draw.length, 5);
  assert.match(JS, /STUDIES\.map\(pick\)/); assert.match(JS, /The bigger picture/); assert.match(JS, /'&tf=' \+ \(BASE\[spec\.base\] \? spec\.base : '5m'\)/); assert.match(JS, /no position is drawn on this screenshot/);
  assert.match(JS, /\[14400, 'H4'\]/); assert.match(JS, /sec === 14400 \? R\.spec\.h4off : 0/);
  const sec = PAGE.slice(PAGE.indexOf('id="v-mosha"'), PAGE.indexOf('id="v-lit"')); assert.match(sec, /"The bigger picture" holds the higher-timeframe views/); assert.match(sec, /<i class="bv"><\/i>A range, your green box/);
});
