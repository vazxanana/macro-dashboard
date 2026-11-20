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

test('the official calendar (council/events.mjs) is checked too: NFP tags news, jobless claims are only listed', () => {
  const nfp = Date.UTC(2026, 10, 6, 13, 30) / 1000;   // Fri 6 Nov 2026 08:30 New York
  const a = postMortem(loss({ opened: nfp - 3600, filled: nfp - 3600, closed: nfp + 1200 }));
  assert.ok(a.tags.includes('news')); assert.match(a.text, /USD Non-Farm Payrolls/);
  const claims = Date.UTC(2026, 10, 5, 13, 30) / 1000;   // Thu 5 Nov: Initial Jobless Claims (tier 2)
  const b = postMortem(loss({ opened: claims - 3600, filled: claims - 3600, closed: claims + 1200 }));
  assert.ok(!b.tags.includes('news')); assert.match(b.text, /Initial Jobless Claims/); assert.match(b.text, /not tagged news/);
  const c = postMortem(loss({ opened: nfp - 3600, filled: nfp - 3600, closed: nfp + 1200, pm: { phase: 'done', until: nfp + 9e3, after: { best: 0, worst: 3, hitT1: null }, news: [{ t: nfp, title: 'Non-Farm Employment Change', country: 'USD' }] } }));
  assert.equal(c.evidence.news.length, 1, 'the recorded item at the same time is the same release');
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

// ---- 20 Nov 2026 audit: time exits, moved stops, void records ----
test('a loss closed by its time limit was never stopped: no hunt, noise or news tag, and the words say so', () => {
  // closed by maxHold at -0.4R; price then went to the target without ever nearing the stop; the stop was 0.3x ATR; a release 1 h before the exit
  const x = loss({ k: 'geg', name: 'Gold daily engulf', R: -0.4, exitKind: 'time', exit: '240 h', closed: T0 + 240 * 3600, mfe: 1.3, ctx: { stopAtr: 0.3, stopSpreads: 3, sigAge: 2 },
    pm: { phase: 'done', until: T0 + 264 * 3600, after: { best: 3, worst: 0.5, worstPre: 0.5, hitT1: T0 + 250 * 3600 }, news: [] } });
  const pm = postMortem(x, { events: [{ t: T0 + 239 * 3600, title: 'CPI', impact: 'High', country: 'US' }] });
  assert.deepEqual(pm.tags, [], 'before the audit: hunt + news + noise');
  assert.equal(pm.evidence.exit, 'time'); assert.equal(pm.evidence.after.pastStopR, undefined);
  assert.match(pm.text, /closed by its time limit .* after the fill at −0\.40R, not by its stop/);
  assert.match(pm.text, /the time limit, not the stop, ended the trade/);
  assert.match(pm.text, /it is not tagged news/); assert.match(pm.text, /was not hit/);
  assert.doesNotMatch(pm.text, /stopped|Stop swept|inside one normal candle/);
  assert.equal(pm.title, 'Was +1.30R, then closed at a loss by the time limit');
  assert.equal(postMortem({ ...x, mfe: 0.2 }, { events: [] }).title, 'Closed at a loss by its time limit');
});

test('how far past the stop is measured from where the stop SAT: a trailed stop is not at 1R', () => {
  // a buy from 100, opening risk 1 (stop 99); the trail moved the stop to 99.7 and it was hit: -0.3R. Afterwards price went to
  // 98.9 (1.1R against the entry = 0.8R past the moved stop) and only then to the target: not a sweep of this stop
  const moved = loss({ side: 'buy', entry: 100, stop: 99.7, r0: 1, t1: 102, trailMoved: true, exitKind: 'stop', R: -0.3, mfe: 0.9,
    pm: { phase: 'done', until: T0 + 20000, after: { best: 2.4, worst: 1.1, worstPre: 1.1, hitT1: T0 + 9000 }, news: [] } });
  const pm = postMortem(moved, { events: [] });
  assert.equal(pm.evidence.stopAtR, 0.3); assert.equal(pm.evidence.after.pastStopR, 0.8);
  assert.deepEqual(pm.tags, [], 'before the audit: 1.1 - 1 = 0.1R past the stop, tagged a stop hunt');
  assert.match(pm.text, /The stop had been moved: it sat 0\.30R from the entry when it was hit/);
  // the same aftermath with the stop still at its opening distance is the hunt it always was
  const plain = postMortem(loss({ side: 'buy', entry: 100, stop: 99, r0: 1, t1: 102, R: -1, mfe: 0.9, pm: moved.pm }), { events: [] });
  assert.deepEqual(plain.tags, ['hunt']); assert.equal(plain.evidence.after.pastStopR, 0.1); assert.equal(plain.evidence.stopAtR, undefined);
});

test('a void loss gets no post-mortem (and loses an old one)', () => {
  const x = loss({ id: 'v1', void: true });
  const r = analystReviews({ trades: [x], prev: { v1: { id: 'v1', text: 'old' } }, now: T0 + 9e5 });
  assert.deepEqual(r.reviews, {}); assert.equal(r.changed, true);
  assert.equal(Object.keys(analystReviews({ trades: [{ ...x, void: false }], prev: {}, now: T0 + 9e5 }).reviews).length, 1);
});
