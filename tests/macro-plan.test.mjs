// Macro desk "Your read" (18 Nov 2026, owner: "we don't need 'check a trade', find ways to be able to use it daily weekly and
// monthly"). Runs the page's own pure block (window.MD_PLAN) on a hand-made reading: today's leans, ranges and releases, the
// week's and the month's calls beside their base rates, levels from the price now, and wording that never calls an edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const PAGE = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
const a = PAGE.indexOf('  var MD_PLAN = window.MD_PLAN = (function () {'), b = PAGE.indexOf('  var PL = { view:');
const window = {}; new Function('window', PAGE.slice(a, b))(window);
const P = window.MD_PLAN;
const NOW = Date.parse('2026-11-18T12:00:00Z');
const fc = { goldScore: { ok: true, score: -0.95, hist: [['2026-10-30', 0.2], ['2026-11-06', -0.5], ['2026-11-13', -0.95]] }, regime: { vix: 18, vixTermRatio: 0.9 },
  assets: { gold: { pUp: 0.56, last: 4000, expMovePct: 1, volRatio: 1 }, eurusd: { pUp: 0.5, last: 1.1, expMovePct: 0.4, volRatio: 1.4 },
    usdjpy: { pUp: 0.44, last: 150, expMovePct: 0.5, volRatio: 1 }, nq: { pUp: 0.5, last: 20000, expMovePct: 1.5 }, es: { pUp: 0.5, last: 6000, expMovePct: 1 } },
  playbook: [{ at: '2026-11-18T12:30:00Z', country: 'USD', title: 'CPI m/m' }, { at: '2026-11-21T06:00:00Z', country: 'EUR', title: 'German PMI' }] };
const v = { summary: { levels: { mark: { px: 4000 } } },
  briefing: { levels: { gold: { list: [{ price: 4100, label: "Last week's high", kind: 'week' }, { price: 4050, label: '20-day average', kind: 'sma' }, { price: 3950, label: "Last week's low", kind: 'week' }, { price: 3700, label: 'October low', kind: 'month' }] } },
    hypotheses: [{ slot: 'H1', horizon: 'week', p: 0.4, base: { all: 0.5 }, claim: 'Gold tests $4,050 first', invalid: 'a close below $3,950', by: '2026-11-20' }, { slot: 'H3', horizon: 'month', p: 0.66, base: { all: 0.49 }, claim: 'DXY lower', by: '2026-12-11' }] },
  outlook: { week: { by: '2026-11-20', from: '$4,000', list: [{ claim: 'Gold closes 2026-11-20 above $4,000', p: 0.54, baseP: 0.55, asset: 'gold', kind: 'closeAbove' }, { claim: "Gold's close lands between $3,950 and $4,060", p: 0.6, baseP: 0.6, asset: 'gold', kind: 'range', lo: 3950, hi: 4060 }, { claim: 'Gold closes at or above $4,200 (stretch)', p: 0.1, baseP: 0.1, asset: 'gold', kind: 'touchUp' }] },
    month: { by: '2026-12-11', from: '$4,000', list: [{ claim: 'Gold closes 2026-12-11 above $4,000', p: 0.55, baseP: 0.57, asset: 'gold', kind: 'closeAbove' }, { claim: 'DXY closes below 103', p: 0.5, baseP: 0.5, asset: 'dxy', kind: 'pairDown' }] } },
  changes: { sinceWeek: '2026-11-07', items: [{ area: 'price', text: 'Gold $4,100 → $4,000' }] }, calibration: { n: 13, need: { scored: 30 }, state: 'waiting' }, ledger: { issued: 2, resolved: 0 } };
const cot = { markets: [{ k: 'gold', pct1y: 95, chg1: 8000, who: 'managed money', asOf: '2026-11-10' }, { k: 'jpy', pct1y: 95, chg1: -500, who: 'leveraged funds' }] };

test('today: leans, a normal day as prices, the release within the hour means wait, nearest gold levels from the price now', () => {
  const d = P.day(fc, v, cot, NOW), g = d.rows.find((r) => r.m === 'gold');
  assert.equal(g.lean, 'up'); assert.equal(g.lo, 3960); assert.equal(g.hi, 4040); assert.equal(g.wait, true); assert.equal(g.cot.crowded, 'buy');
  assert.equal(d.rows.find((r) => r.m === 'usdjpy').cot.crowded, 'sell', 'yen longs crowded = USD/JPY sell side');
  assert.equal(d.gold.above.price, 4050); assert.equal(d.gold.below.price, 3950);
  assert.equal(d.mood.wide[0], 'EUR/USD'); assert.match(d.take, /Leans, not calls/); assert.match(d.take, /wait for the print/);
  assert.equal(d.events.length, 1, 'the EUR release three days out is not today');
});

test('this week: calls beside their base, stretch calls apart, the range in the headline, week levels, positioning, score against last week', () => {
  const w = P.week(fc, v, cot, NOW);
  assert.equal(w.calls.length, 2); assert.equal(w.stretch.length, 1); assert.equal(w.hyps.length, 1);
  assert.match(w.take, /54% chance gold closes above \$4,000 \(base 55%\)/); assert.match(w.take, /\$3,950–\$4,060/);
  assert.deepEqual(w.levels.map((l) => l.price), [4100, 3950]); assert.equal(w.events.length, 2);
  assert.equal(w.score.now, -0.95); assert.equal(w.score.prev, -0.5); assert.equal(w.positioning.length, 2);
});

test('this month: month calls, the dollar apart, slower levels, the score path, and "too few to judge" under the calibration minimum', () => {
  const m = P.month(fc, v, NOW);
  assert.equal(m.calls.length, 1); assert.equal(m.other[0].asset, 'dxy'); assert.equal(m.hyps[0].slot, 'H3');
  assert.deepEqual(m.levels.map((l) => l.price), [4050, 3700]); assert.equal(m.score.length, 3);
  assert.equal(m.track.judged, false); assert.match(m.take, /13 of 30 calls scored, too few to judge/);
});

test('nothing on file: every view still answers in words', () => {
  const e = { assets: {} };
  assert.match(P.day(e, null, null, NOW).take, /No macro lean/); assert.match(P.week(e, null, null, NOW).take, /No week call/); assert.match(P.month(e, null, NOW).take, /No month call/);
});

test('the check-a-trade form is gone and the wording never calls a reading an edge or advice', () => {
  assert.doesNotMatch(PAGE, /id="tc-form"|MD_CHECK|Check a trade/);
  const sec = PAGE.slice(PAGE.indexOf('id="s-plan"'), PAGE.indexOf('<!-- 2. Next release'));
  const all = sec + JSON.stringify([P.day(fc, v, cot, NOW), P.week(fc, v, cot, NOW), P.month(fc, v, NOW)]);
  assert.doesNotMatch(all, /take (this|the) trade|proven edge|guarantee/i); assert.match(sec, /not a signal/); assert.match(sec, /no direction edge/);
});

test('where each call stands now: price against the level, days left, the next release, the copyable text', () => {
  const S = (x, g, d) => P.status(x, g, d);
  assert.deepEqual(S({ kind: 'closeAbove', level: 3885 }, 3734).ok, false); assert.match(S({ kind: 'closeAbove', level: 3885 }, 3734).text, /needs \+4\.0%/);
  assert.equal(S({ kind: 'touchDown', level: 3860 }, 3734).ok, true); assert.equal(S({ kind: 'touchUp', level: 3920 }, 3734).ok, null);
  assert.match(S({ kind: 'range', lo: 3840, hi: 3950 }, 3734).text, /^2\.8% below the band/);
  assert.equal(S({ kind: 'stayInside', lo: 3853, hi: 4149 }, 3734).ok, false);
  assert.equal(S({ kind: 'bigMove', level: 3885, pct: 0.0256 }, 3734).ok, true);
  // a race is read by its geometry (target above the guard = up), not by its name
  assert.equal(S({ kind: 'firstTouchDown', level: 4000, guard: 3853 }, 3734).ok, false);
  assert.equal(S({ kind: 'firstTouchUp', level: 4000, guard: 3853 }, 3900).ok, null);
  assert.equal(S({ kind: 'pairDown', level: 103.45, asset: 'dxy' }, 3734, 103.82).ok, false);
  assert.equal(S({ kind: 'closeAbove', level: 1 }, null), null, 'no price, no status');
  const wed = Date.parse('2026-11-18T23:00:00Z');
  assert.equal(P.daysLeft('2026-11-20', wed), 2); assert.equal(P.daysLeft('2026-11-18', wed), -1, 'Wednesday\'s close is in'); assert.equal(P.daysLeft('2026-11-17', wed), -1);
  assert.equal(P.daysLeft('2026-11-23', wed), 3, 'the weekend is not counted');
  const thu = Date.parse('2026-11-19T00:20:00Z'); assert.equal(P.daysLeft('2026-11-20', thu), 2, 'today\'s close is still to come');
  assert.equal(P.daysLeft('2026-11-19', Date.parse('2026-11-19T15:00:00Z')), 1);
  const w = P.week(fc, v, cot, NOW); assert.ok(w.calls.every((c) => 'now' in c && c.left));
  const v2 = { ...v, events: [{ at: '2026-11-18T13:30:00Z', country: 'USD', title: 'CPI', released: false, expectations: [{ consensus: '0.3%', previous: '0.2%' }], scenarios: [{ name: 'Hot', when: '≥ 0.4%', usd: 'USD up', gold: 'down' }] }] };
  const d = P.day(fc, v2, cot, NOW); assert.equal(d.release.consensus, '0.3%'); assert.equal(d.release.scenarios[0].name, 'Hot');
  const t = P.text('week', w, NOW); assert.match(t, /This week/); assert.match(t, /now: /); assert.match(t, /not a signal/); assert.doesNotMatch(t, /<[a-z]/);
  assert.match(P.text('day', d, NOW), /Next release: USD CPI/);
  const aud = { ...v, events: [{ at: '2026-11-18T13:00:00Z', country: 'AUD', title: 'Employment Change', released: false }] }, fc2 = { ...fc, playbook: [] };
  assert.match(P.day(fc2, aud, cot, NOW).take, /1 release in the next 24 hours \(AUD: none of these five markets directly\)/);
});
