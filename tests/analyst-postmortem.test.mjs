// node --test tests/analyst-postmortem.test.mjs — the Analyst's loss post-mortems (fake trades)
import test from 'node:test';
import assert from 'node:assert/strict';
import { postMortem, analystReviews, postMortemSection, opensNear, PM_START, PM_END } from '../council/analyst.mjs';

const T0 = Date.UTC(2026, 10, 4, 3, 0) / 1000;   // Wed 4 Nov 2026 03:00 UTC: no session open within 30 min
const loss = (o = {}) => ({
  id: 'eth-scalp-1', market: 'eth', label: 'ETH/USD', k: 'scalp', name: 'Scalp', pair: 'M15 → M1', h: '15m', side: 'sell',
  entry: 100, stop: 101, t1: 98, rr: 2, opened: T0, filled: T0, closed: T0 + 2700, status: 'loss', R: -1, mfe: 0.2, mae: 0.98, shadow: false,
  feat: { d1: 'with', session: 'asia' }, ctx: { atr: 1, stopAtr: 1, stopSpreads: 20, sigAge: 2, planned: 100, trend: { '1d': -1, '4h': -1, '1h': -1 } },
  pm: { phase: 'done', until: T0 + 2700 + 4 * 3600, after: { best: 0, worst: 3, hitT1: null }, news: [], slip: 0 }, ...o,
});

test('session opens follow local time (daylight saving) and skip weekends', () => {
  assert.equal(opensNear(Date.UTC(2026, 10, 6, 8, 10) / 1000)[0].name, 'London open');   // Nov: London 08:00 = 08:00 UTC
  assert.equal(opensNear(Date.UTC(2026, 6, 6, 7, 5) / 1000)[0].name, 'London open');    // Jul: London 08:00 = 07:00 UTC
  assert.equal(opensNear(Date.UTC(2026, 10, 6, 14, 40) / 1000)[0].name, 'US cash open'); // Nov: 09:30 New York = 14:30 UTC
  assert.deepEqual(opensNear(Date.UTC(2026, 10, 7, 8, 5) / 1000), []);                    // Saturday
  assert.deepEqual(opensNear(T0), []);
});

test('price came back to the target just past the stop -> hunt, with the evidence', () => {
  const pm = postMortem(loss({ mfe: 0.8, pm: { phase: 'done', until: T0 + 20000, after: { best: 2.4, worst: 1.3, worstPre: 1.3, hitT1: T0 + 2700 + 5400 }, news: [] } }));
  assert.deepEqual(pm.tags, ['hunt']);
  assert.equal(pm.title, 'Stop swept, then the target');
  assert.equal(pm.by, 'analyst');
  assert.equal(pm.evidence.after.pastStopR, 0.3);
  assert.equal(pm.evidence.after.toTargetH, 1.5);
  assert.match(pm.text, /best \+0\.80R \(MFE\)/);
  assert.match(pm.text, /stopped 45 min after the fill/);
  assert.match(pm.text, /went only 0\.30R past it, then reached the target 1\.5 h later/);
});

test('target reached only after a deep run past the stop is not a hunt', () => {
  const pm = postMortem(loss({ pm: { phase: 'done', until: T0 + 20000, after: { best: 2.4, worst: 3, worstPre: 2.5, hitT1: T0 + 9000 }, news: [] } }));
  assert.deepEqual(pm.tags, []);
  assert.match(pm.text, /not tagged a stop hunt/);
});

test('no MFE and a long run against -> wrong direction, no tag', () => {
  const pm = postMortem(loss());
  assert.deepEqual(pm.tags, []);
  assert.equal(pm.title, 'Wrong direction; the stop did its job');
  assert.match(pm.text, /No session open within 30 min/);
  assert.match(pm.text, /None was against the trade/);
});

test('news shortly before the stop -> news tag; news long before it is reported but not tagged', () => {
  const near = postMortem(loss({ pm: { phase: 'done', until: T0 + 20000, after: { best: 0, worst: 3, hitT1: null }, news: [{ t: T0 + 1800, title: 'CPI', country: 'USD' }] } }));
  assert.ok(near.tags.includes('news')); assert.equal(near.title, 'News during the trade');
  assert.match(near.text, /USD CPI at 03:30 UTC \(15 min before the stop\)/);
  const far = postMortem(loss({ closed: T0 + 5 * 3600, pm: { phase: 'done', until: T0 + 9 * 3600, after: { best: 0, worst: 3, hitT1: null }, news: [{ t: T0 + 600, title: 'CPI', country: 'USD' }] } }));
  assert.ok(!far.tags.includes('news')); assert.match(far.text, /not tagged news/);
  const ev = postMortem(loss(), { events: [{ t: T0 + 2400, title: 'NFP', impact: 'High', country: 'USD' }, { t: T0 + 2400, title: 'Minor', impact: 'Low' }] });
  assert.ok(ev.tags.includes('news')); assert.ok(!/Minor/.test(ev.text));
});

test('tight stop -> noise; late fill or stale signal -> late', () => {
  assert.ok(postMortem(loss({ ctx: { stopAtr: 0.3, stopSpreads: 12, trend: {} } })).tags.includes('noise'));
  assert.ok(postMortem(loss({ ctx: { stopAtr: 1, stopSpreads: 4, trend: {} } })).tags.includes('noise'));
  assert.ok(postMortem(loss({ pm: { phase: 'done', until: T0 + 9e3, after: { best: 0, worst: 3, hitT1: null }, news: [], slip: -0.4 } })).tags.includes('late'));
  assert.ok(postMortem(loss({ ctx: { stopAtr: 1, stopSpreads: 20, sigAge: 12 } })).tags.includes('late'));
  assert.ok(!postMortem(loss({ pm: { phase: 'done', until: T0 + 9e3, after: { best: 0, worst: 3, hitT1: null }, news: [], slip: 0.4 } })).tags.includes('late'), 'a better-than-planned fill is not late');
});

test('a stop that gapped is reported with its size', () => {
  const pm = postMortem(loss({ R: -1.4, gapR: 0.4 }));
  assert.equal(pm.evidence.gapR, 0.4); assert.equal(pm.evidence.maeR, 1.4);
  assert.match(pm.text, /The stop candle gapped: filled 0\.40R past the stop\./);
});

test('higher timeframes against the trade are named; retracement setups are marked as by design', () => {
  const pm = postMortem(loss({ ctx: { stopAtr: 1, stopSpreads: 20, trend: { '1d': 1, '4h': 1, '1h': -1 } } }));
  assert.deepEqual(pm.evidence.htfAgainst, ['D1', 'H4']);
  assert.match(pm.text, /The sell was against D1 and H4\./);
  const r = postMortem(loss({ k: 'rscalp', mfe: 0.1, pm: { phase: 'done', until: T0 + 9e3, after: { best: 0, worst: 1.2, hitT1: null }, news: [] }, ctx: { stopAtr: 1, stopSpreads: 20, trend: { '1d': 1, '4h': -1, '1h': -1 } } }));
  assert.match(r.text, /by design/); assert.notEqual(r.title, 'Against the D1 trend');
});

test('analystReviews: live closed losses only, once the watch is done; stable `at`; reopened losses dropped', () => {
  const trades = [loss(), loss({ id: 'sh', shadow: true }), loss({ id: 'w', status: 'win', R: 2 }), loss({ id: 'watching', pm: { phase: 'watch', after: { best: 0, worst: 0 } } }), loss({ id: 'open', status: 'open', closed: null })];
  const a = analystReviews({ trades, prev: {}, now: T0 + 9e4 });
  assert.deepEqual(Object.keys(a.reviews), ['eth-scalp-1']); assert.equal(a.changed, true); assert.equal(a.reviews['eth-scalp-1'].at, T0 + 9e4);
  const b = analystReviews({ trades, prev: a.reviews, now: T0 + 9e5 });
  assert.equal(b.changed, false); assert.equal(b.reviews['eth-scalp-1'].at, T0 + 9e4, 'unchanged findings keep their time');
  const c = analystReviews({ trades: [loss({ status: 'open', R: null })], prev: a.reviews, now: T0 + 9e5 });
  assert.equal(c.changed, true); assert.deepEqual(c.reviews, {});
  const d = analystReviews({ trades: [], prev: a.reviews, now: T0 + 9e5 });
  assert.equal(d.changed, false); assert.ok(d.reviews['eth-scalp-1'], 'kept when the trade left trades.json');
});

test('report block: tags, small-sample warning, owner comparison, empty case', () => {
  const now = T0 + 86400;
  const a = analystReviews({ trades: [loss(), loss({ id: 'h', mfe: 0.8, pm: { phase: 'done', until: T0 + 20000, after: { best: 2.4, worst: 1.3, worstPre: 1.3, hitT1: T0 + 8100 }, news: [] } })], now }).reviews;
  const md = postMortemSection({ reviews: a, owner: { h: { tags: ['hunt'], by: 'owner' } }, now });
  assert.ok(md.startsWith(PM_START) && md.endsWith(PM_END));
  assert.match(md, /\*\*2 losses:\*\* /); assert.match(md, /Small sample/);
  assert.match(md, /\(owner: hunt\)/); assert.match(md, /matched the owner on 1 of 1/);
  assert.match(postMortemSection({ reviews: {}, now }), /No live loss with a finished post-mortem/);
});
