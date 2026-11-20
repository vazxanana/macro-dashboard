// Hard-to-find data history (council/hard-data.mjs `hist`, `moves`, `bigOddsMove`, 20 Nov 2026): one compact reading an hour kept
// for 14 days, a failed source records nothing new, and the plain lines on how the odds, nowcast and GDPNow moved. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../council/hard-data.mjs';
import * as WA from '../council/week-ahead.mjs';

const T = (iso) => Date.parse(iso) / 1000;
const iso = (t) => new Date(t * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
const KAL = (hike) => [{ label: 'Hike 25bps', p: hike }, { label: 'Fed maintains rate', p: +(1 - hike - 0.01).toFixed(2) }, { label: 'Cut 25bps', p: 0.01 }, { label: 'Hike 50bps', p: 0 }];
// A collect() output as hard-data.mjs writes it.
const outAt = (t, { hike = 0.92, corePce = 0.27, gdp = 3.2, ok = {} } = {}) => ({
  at: iso(t),
  sources: { nowcast: ok.nowcast || 'ok', gdpnow: ok.gdpnow || 'ok', fed: 'ok', odds: ok.odds || 'ok' },
  odds: { meeting: '2026-12-09', kalshi: KAL(hike), polymarket: null },
  nowcast: { months: [
    { month: '2026-09', now: { cpi: 0.2, coreCpi: 0.2, pce: 0.2, corePce: 0.21 }, actual: { cpi: 0.3, coreCpi: 0.3, pce: 0.2, corePce: 0.22 } },
    { month: '2026-10', now: { cpi: 0.24, coreCpi: 0.21, pce: 0.31, corePce }, actual: { cpi: 0.35, coreCpi: 0.3 } },
    { month: '2026-11', now: { cpi: 0.07, coreCpi: 0.21, pce: 0.17, corePce: 0.26 }, actual: {} }] },
  gdpnow: { quarter: '2026 Q4', value: gdp, prev: 3.27 },
});
// Build a history the way the loop would: one run per step, each carried into the next.
function run(steps) { let hist = []; for (const [t, o] of steps) hist = H.addHist(hist, H.histEntry(outAt(t, o)), t); return hist; }

test('an entry is compact: Kalshi top 3, the nowcast months still waiting for a print (printed series null), GDPNow with its quarter', () => {
  const e = H.histEntry(outAt(T('2026-11-20T10:00:00Z')));
  assert.deepEqual(e.odds, { meeting: '2026-12-09', top: [{ label: 'Hike 25bps', p: 0.92 }, { label: 'Fed maintains rate', p: 0.07 }, { label: 'Cut 25bps', p: 0.01 }] });
  assert.deepEqual(e.nowcast, [{ month: '2026-10', corePce: 0.27, pce: 0.31, coreCpi: null, cpi: null },
    { month: '2026-11', corePce: 0.26, pce: 0.17, coreCpi: 0.21, cpi: 0.07 }]);   // September fully printed: left out
  assert.deepEqual(e.gdpnow, { quarter: '2026 Q4', value: 3.2 });
});

test('one entry per UTC hour: a second run in the same hour merges into it, the next hour adds one', () => {
  const t0 = T('2026-11-20T10:05:00Z');
  const h = run([[t0, { hike: 0.90 }], [t0 + 1800, { hike: 0.92 }], [t0 + 3600, { hike: 0.93 }]]);
  assert.equal(h.length, 2);
  assert.equal(h[0].at, iso(t0 + 1800)); assert.equal(h[0].odds.top[0].p, 0.92);
  assert.equal(h[1].odds.top[0].p, 0.93);
  // a merge keeps an earlier part this run did not read fresh
  const h2 = H.addHist(h, H.histEntry(outAt(t0 + 3700, { ok: { odds: 'failed: HTTP 503 (last good copy kept)' } })), t0 + 3700);
  assert.equal(h2.length, 2); assert.equal(h2[1].odds.top[0].p, 0.93); assert.ok(h2[1].nowcast && h2[1].gdpnow);
});

test('the 14-day cut, and entries from the future or unreadable are dropped', () => {
  const now = T('2026-11-20T10:00:00Z');
  const old = [{ at: iso(now - 15 * 86400), gdpnow: { quarter: '2026 Q4', value: 2 } }, { at: iso(now - 13 * 86400), gdpnow: { quarter: '2026 Q4', value: 2.5 } },
    { at: iso(now + 7200), gdpnow: { quarter: '2026 Q4', value: 9 } }, { at: 'nonsense' }, null];
  const h = H.addHist(old, H.histEntry(outAt(now)), now);
  assert.deepEqual(h.map((x) => x.at), [iso(now - 13 * 86400), iso(now)]);
  assert.equal(H.HIST_DAYS, 14);
});

test('a failed source records nothing new for its part; all failed = no entry; collect carries prev.hist', async () => {
  const now = T('2026-11-20T10:00:00Z');
  const e = H.histEntry(outAt(now, { ok: { odds: 'failed: x (last good copy kept)', gdpnow: 'failed: y' } }));
  assert.ok(e.nowcast && !e.odds && !e.gdpnow);
  assert.equal(H.histEntry(outAt(now, { ok: { odds: 'failed', gdpnow: 'failed', nowcast: 'failed' } })), null);
  const prevHist = [{ at: iso(now - 7 * 86400), gdpnow: { quarter: '2026 Q4', value: 2.9 } }];
  const fail = async () => ({ ok: false, status: 503, text: async () => '' });
  const out = await H.collect({ now, fetchFn: fail, prev: { hist: prevHist, gdpnow: { quarter: '2026 Q4', value: 2.9, prev: null, at: 'x' } } });
  assert.deepEqual(out.hist, prevHist);   // the kept copy of GDPNow is not written in again as if new
});

test('moves: a day and a week back, plain lines, the odds named as what traders pay', () => {
  const now = T('2026-11-20T10:00:00Z');
  const hist = run([[now - 7 * 86400, { hike: 0.85, corePce: 0.25, gdp: 2.9 }], [now - 86400, { hike: 0.90, corePce: 0.27, gdp: 3.1 }], [now, { hike: 0.92, corePce: 0.27, gdp: 3.2 }]]);
  const M = H.moves({ hist }, now), txt = M.map((m) => m.text);
  assert.ok(txt.includes('Kalshi odds of a 25 bp hike at the 9 Dec Fed meeting: 92% now, 90% a day ago, 85% a week ago. What traders pay, not a forecast of ours.'), txt.join('\n'));
  assert.ok(txt.includes('Cleveland Fed core PCE nowcast for October: +0.27% now, +0.27% a day ago, +0.25% a week ago (a model\'s estimate, month on month).'));
  assert.ok(txt.includes('Atlanta Fed GDPNow for 2026 Q4: 3.2% now, 3.1% a day ago, 2.9% a week ago (annualized).'));
  assert.ok(!txt.some((l) => /October.*core CPI|CPI nowcast for October/.test(l)), 'a printed series has no nowcast line');
  const odds = M.find((m) => m.kind === 'odds'); assert.equal(odds.week, 0.07); assert.equal(odds.day, 0.02);
  assert.ok(!/signal|edge/i.test(txt.join(' ')));
  const big = H.bigOddsMove({ hist }, now);
  assert.equal(big.d, 0.07); assert.match(big.text, /moved from 85% to 92%: what traders pay, not a forecast of ours/);
  // under 5 points over the week: no top line
  const calm = run([[now - 7 * 86400, { hike: 0.90 }], [now, { hike: 0.92 }]]);
  assert.equal(H.bigOddsMove({ hist: calm }, now), null);
});

test('moves says nothing when the history is too short, stale, or the meeting / quarter changed', () => {
  const now = T('2026-11-20T10:00:00Z');
  assert.deepEqual(H.moves({ hist: run([[now, {}]]) }, now), []);
  assert.deepEqual(H.moves({ hist: run([[now - 3 * 3600, {}], [now, {}]]) }, now), []);   // nothing a day or a week back
  assert.deepEqual(H.moves({ hist: run([[now - 8 * 86400 + 600, {}], [now - 7 * 86400, {}]]) }, now), []);  // newest reading too old
  assert.deepEqual(H.moves({}, now), []); assert.deepEqual(H.moves(null, now), []);
  const hist = run([[now - 7 * 86400, {}], [now, {}]]);
  hist[0].odds.meeting = '2026-10-28'; hist[0].gdpnow.quarter = '2026 Q3';
  const kinds = H.moves({ hist }, now).map((m) => m.kind);
  assert.ok(!kinds.includes('odds') && !kinds.includes('gdpnow') && kinds.includes('nowcast'));
  assert.equal(H.bigOddsMove({ hist }, now), null);
});

test('outcome words in plain English', () => {
  assert.equal(H.outcomeWords('Hike 25bps'), 'a 25 bp hike');
  assert.equal(H.outcomeWords('25 bps increase'), 'a 25 bp hike');
  assert.equal(H.outcomeWords('Cut 50bps'), 'a 50 bp cut');
  assert.equal(H.outcomeWords('Fed maintains rate'), 'no change');
});

test('the Week ahead adds the moves to the frame and the biggest odds move to the top lines', () => {
  const now = T('2026-11-20T10:00:00Z');
  const hist = run([[now - 7 * 86400, { hike: 0.85, corePce: 0.25 }], [now, { hike: 0.92 }]]);
  const cur = outAt(now);
  const hd = { ...cur, odds: { ...cur.odds, line: 'Prediction markets on the 9 Dec Fed decision: Kalshi Hike 25bps 92%. What traders pay, not a forecast of ours.' }, hist };
  const A = WA.build({ now, cal: [], rf: null, fc: null, v: null, hd });
  assert.ok(A.frame.lines.some((l) => /^Kalshi odds of a 25 bp hike .*92% now, 85% a week ago/.test(l)));
  assert.ok(A.frame.lines.some((l) => /core PCE nowcast for October: \+0\.27% now, \+0\.25% a week ago/.test(l)));
  assert.equal(A.lines.filter((l) => /^Over the week the Kalshi odds/.test(l)).length, 1);
  const B = WA.build({ now, cal: [], rf: null, fc: null, v: null, hd: { ...hd, hist: run([[now, {}]]) } });
  assert.ok(!B.frame.moves && !B.lines.some((l) => /Over the week/.test(l)));
});
