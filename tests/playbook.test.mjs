// node --test tests/playbook.test.mjs — the veteran's event playbook (council/playbook.mjs): releases within 72 h grouped into
// one card, expectations never invented, the hot / in-line / cool table, history cut at `now` (no look-ahead), the release-day
// call (issued only before the release, recorded once, scored by the new dayUp / dayDown kinds, calibrated), the committed
// event-base.json and the pre-registered test, the veteran wiring and the Macro desk card.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as P from '../council/playbook.mjs';
import * as V from '../council/veteran.mjs';
import { callsLedger, resolveCall, callsScore } from '../council/outlook.mjs';
import { calibration, records } from '../council/calibration.mjs';

const DAY = 86400, NOW = Date.UTC(2026, 10, 9, 8, 0) / 1000;   // Mon 9 Nov 2026 08:00 UTC
const T_CPI = Date.UTC(2026, 10, 10, 13, 30) / 1000;
const iso = (t) => new Date(t * 1000).toISOString();
const day = (t) => iso(t).slice(0, 10);
const RULE = 'hot if ≥ 0.3%, cool if ≤ 0.1%, in line in between (one reporting step; ±1 SD once 8 surprises are logged)';
const pb = (o = {}) => ({ at: iso(T_CPI), country: 'USD', title: 'Core CPI m/m', consensus: '0.2%', previous: '0.3%', actual: null, rule: RULE, expMovePct: { gold: 1.01 },
  scenarios: [{ name: 'hot', moves: { gold: 'down' } }, { name: 'in line', moves: { gold: 'little' } }, { name: 'cool', moves: { gold: 'up' } }], ...o });
// daily UTC closes, weekdays only, ending the day before `end`; up on even days
function closesTo(end, n = 2800, f = (i) => 1000 + i + (i % 2 ? -0.5 : 0.5)) { const out = []; for (let t = Math.floor(end / DAY) * DAY - DAY, i = 0; out.length < n; t -= DAY) { const w = new Date(t * 1000).getUTCDay(); if (w === 0 || w === 6) continue; out.unshift({ t, v: 0 }); }
  out.forEach((o, i) => { o.v = +f(i).toFixed(2); }); return out; }
const row = (d, o = {}) => ({ type: 'CPI', d, t: Date.parse(d + 'T13:30:00Z') / 1000, g5: 0.1, g60: 0.2, g5to60: 0.1, dx5: -0.1, dx60: -0.1, ...o });

test('upcoming: releases within 72 h, grouped by time and country with Core first; a released one stays 12 h', () => {
  const L = [pb({ title: 'CPI m/m', consensus: '0.3%' }), pb(), pb({ at: iso(NOW + 74 * 3600), country: 'USD', title: 'PPI m/m' }), pb({ at: iso(NOW + 40 * 3600), country: 'GBP', title: 'GDP m/m' }), pb({ at: iso(NOW - 13 * 3600), title: 'Old' })];
  const G = P.upcoming(L, NOW);
  assert.deepEqual(G.map((g) => g.title), ['Core CPI m/m', 'GDP m/m']);
  assert.equal(G[0].items.length, 2); assert.equal(G[0].type, 'CPI'); assert.equal(G[1].type, null, 'a non-US release has no history type');
  assert.equal(P.upcoming(L, T_CPI + 3600)[0].released, true);
  assert.equal(P.typeOf('Non-Farm Employment Change'), 'NFP'); assert.equal(P.typeOf('Federal Funds Rate'), 'FOMC'); assert.equal(P.typeOf('CPI y/y', 'EUR'), null);
});

test('expectations: the captured consensus first, the cluster only where the repository has one, the range n/a, nothing invented', () => {
  const g = P.upcoming([pb(), pb({ title: 'CPI m/m', consensus: '0.3%', previous: '0.6%' })], NOW)[0];
  const exp = [{ key: '2026-11-10T13:30|Core CPI m/m', expectation: { consensus: '0.2%', previous: '0.3%', capturedAtUtc: '2026-11-09T01:05:16.000Z' }, firstPrint: null }];
  const pilot = { releaseUtc: '2026-11-10T13:30:00Z', point: 0.255, issuedAt: '2026-11-08T14:12:31Z', status: 'unresolved', comparator: { value: 0.21, capturedAt: '2026-11-08T14:05:33Z' } };
  const E = P.expectationsOf(g, exp, pilot);
  assert.equal(E[0].consensus, '0.2%'); assert.equal(E[0].captured, '2026-11-09T01:05:16.000Z'); assert.equal(E[0].range, null); assert.match(E[0].rangeNote, /n\/a/);
  assert.deepEqual(E[0].cluster.map((c) => c.value), [0.2, 0.255, 0.21]);
  assert.deepEqual(E[1].cluster, [], 'the pilot is a core forecast: never attached to headline CPI'); assert.equal(E[1].captured, null);
  const bare = P.expectationsOf(P.upcoming([pb({ consensus: null, previous: null })], NOW)[0], [], null)[0];
  assert.equal(bare.consensus, null); assert.equal(bare.previous, null); assert.deepEqual(bare.cluster, []); assert.equal(bare.source, null);
  assert.deepEqual(P.bandsOf(RULE), { cool: 0.1, hot: 0.3 }); assert.deepEqual(P.bandsOf(''), { cool: null, hot: null });
});

test('scenarios: Fed path, dollar, gold and the action; act after the release, not before, at a quarter-size starter', () => {
  const g = P.upcoming([pb()], NOW)[0], st = P.reaction({ rows: [row('2025-01-15', { dx5: 0.2, g60: -0.4 }), row('2025-02-12', { dx5: -0.2, g60: 0.3 })] }, 'CPI', [], NOW);
  const S = P.scenarios(g, st);
  assert.deepEqual(S.map((s) => s.k), ['hot', 'inline', 'cool']); assert.equal(S[0].when, '≥ 0.3%'); assert.equal(S[1].when, '> 0.1% and < 0.3%'); assert.equal(S[2].when, '≤ 0.1%');
  assert.equal(S[0].usd, 'USD up'); assert.match(S[0].gold, /^Down/); assert.match(S[2].gold, /^Up/); assert.match(S[0].path, /later cuts/);
  for (const s of [S[0], S[2]]) { assert.match(s.action, /^Act after the release, not before/); assert.match(s.action, /¼ starter/); }
  assert.match(S[1].action, /No event trade/); assert.equal(S[0].history, 'n 1: gold\'s first hour median −0.40%, up 0%');
  assert.match(P.scenarios(P.upcoming([pb({ country: 'GBP', title: 'GDP m/m' })], NOW)[0], null)[0].path, /BoE/);
});

test('reaction: only releases before now, release days only once their close is final; descriptive unless the test passed', () => {
  const closes = [{ t: Date.UTC(2025, 0, 14) / 1000, v: 100 }, { t: Date.UTC(2025, 0, 15) / 1000, v: 101 }, { t: Date.UTC(2026, 10, 9) / 1000, v: 200 }, { t: Date.UTC(2026, 10, 10) / 1000, v: 150 }];
  const base = { rows: [row('2025-01-15', { dx5: 0.2, g60: -0.4 }), row('2026-11-10', { dx5: 0.2, g60: 9 })], test: { CPI: { n: 40, hits: 30, hit: 0.75, p: 0.001, pass: false, halves: {} } } };
  const st = P.reaction(base, 'CPI', closes, NOW);
  assert.equal(st.n, 1, 'a release at or after now is never counted'); assert.equal(st.firstHour.hot.median, -0.4);
  assert.equal(st.day.all.n, 1); assert.equal(st.day.all.median, 1); assert.deepEqual(st.day.all.pts, [['2025-01-15', 1]]);
  // on the release day itself, before the close: still 1 (the day is not final); the next day the row and its day count
  assert.equal(P.reaction(base, 'CPI', closes, T_CPI + 3600).day.all.n, 1);
  assert.equal(P.reaction(base, 'CPI', closes, T_CPI + DAY).day.all.n, 2);
  assert.equal(st.tested, false); assert.equal(st.label, P.DESCRIPTIVE);
  assert.equal(P.reaction({ ...base, test: { CPI: { ...base.test.CPI, pass: true } } }, 'CPI', closes, NOW).tested, true);
  assert.equal(P.reaction(base, null, closes, NOW), null); assert.equal(P.reaction(null, 'CPI', closes, NOW), null);
});

test('the pre-registered test: opposite sign to the dollar, both halves, the binomial bar', () => {
  assert.equal(P.binomUpper(0, 10), 1); assert.ok(Math.abs(P.binomUpper(10, 10) - 1 / 1024) < 1e-12); assert.ok(Math.abs(P.binomUpper(8, 10) - 56 / 1024) < 1e-12);
  const mk = (n, hits, d) => Array.from({ length: n }, (_, i) => ({ d, dx5: 0.2, g5to60: i < hits ? -0.1 : 0.1 }));
  const pass = P.testRows([...mk(20, 14, '2019-05-01'), ...mk(20, 14, '2023-05-01'), { d: '2023-06-01', dx5: 0.01, g5to60: -1 }]);
  assert.equal(pass.n, 40, 'a weak dollar read is not in the test'); assert.equal(pass.hits, 28); assert.ok(pass.p < 0.05); assert.equal(pass.pass, true);
  assert.equal(P.testRows([...mk(20, 9, '2019-05-01'), ...mk(20, 19, '2023-05-01')]).pass, false, 'a half at or below 50% fails');
  assert.equal(P.testRows(mk(20, 20, '2023-05-01')).pass, false, 'n < 30 fails');
  assert.equal(P.testRows([{ d: '2023-01-01', dx5: 0.2, g5to60: 0 }]).hits, 0, 'a zero move is a miss');
});

test('the call: P(gold up on the release day) from past release days shrunk to every weekday; only before the release, one per day', () => {
  const closes = closesTo(NOW), rows = Array.from({ length: 30 }, (_, i) => row(day(closes[closes.length - 40 - i * 20].t)));
  const base = { rows }, st = P.reaction(base, 'CPI', closes, NOW), g = P.upcoming([pb()], NOW)[0];
  const c = P.eventCall(g, { closes, now: NOW, stats: st }), b = P.dayBase(closes, NOW);
  assert.equal(c.id, 'evt:2026-11-10:gold:dayUp'); assert.equal(c.kind, 'dayUp'); assert.equal(c.by, '2026-11-10'); assert.equal(c.src, P.CALL_SRC); assert.equal(c.baseP, b.up);
  const k = Math.round(st.day.all.up * st.day.all.n), want = (k + P.SHRINK * b.up) / (st.day.all.n + P.SHRINK);
  assert.equal(c.p, +Math.min(P.P_BAND[1], Math.max(P.P_BAND[0], want)).toFixed(2));
  assert.equal(P.eventCall({ ...g, released: true }, { closes, now: T_CPI + 60, stats: st }), null, 'never after the release');
  assert.equal(P.eventCall(g, { closes, now: T_CPI, stats: st }), null);
  assert.equal(P.eventCall({ ...g, type: null }, { closes, now: NOW, stats: null }), null, 'no history type, no call');
  const two = P.playbooks({ fc: { playbook: [pb(), pb({ at: iso(T_CPI + 3600), title: 'Federal Funds Rate' })] }, expectations: [], closes, base: { rows: [...rows, ...rows.map((r) => ({ ...r, type: 'FOMC' }))] }, now: NOW });
  assert.equal(two.length, 2); assert.ok(two[0].call); assert.equal(two[1].call, null, 'one call per release day'); assert.match(two[1].callNote, /One call per release day/);
  assert.match(P.playbookLine(two[0]), /Act after the release, not before \(¼ starter\)/);
});

test('dayUp / dayDown resolve on the release day\'s UTC close against the close before it; never early, never from a missing day', () => {
  const C = [{ t: Date.UTC(2026, 10, 9) / 1000, v: 100 }, { t: Date.UTC(2026, 10, 10) / 1000, v: 101 }];
  const c = { kind: 'dayUp', by: '2026-11-10', issued: '2026-11-09' };
  assert.equal(resolveCall(c, C, T_CPI + 3600), null, 'the close is not final');
  assert.equal(resolveCall(c, C, Date.UTC(2026, 10, 12) / 1000), true); assert.equal(resolveCall({ ...c, kind: 'dayDown' }, C, Date.UTC(2026, 10, 12) / 1000), false);
  assert.equal(resolveCall({ ...c, issued: '2026-11-10' }, C, Date.UTC(2026, 10, 12) / 1000), true, 'issued on the release day, before the print');
  assert.equal(resolveCall({ ...c, issued: '2026-11-11' }, C, Date.UTC(2026, 10, 13) / 1000), null, 'a call dated after its day is void');
  assert.equal(resolveCall(c, C.slice(0, 1), Date.UTC(2026, 10, 13) / 1000), null, 'no bar on the day: unresolved, never guessed');
});

test('the calls ledger records the event call once (the first probability), scores it, and calibration counts it as an event call', () => {
  const call = { id: 'evt:2026-11-10:gold:dayUp', claim: 'Gold up', p: 0.58, baseP: 0.54, asset: 'gold', kind: 'dayUp', by: '2026-11-10', src: P.CALL_SRC, level: null };
  let L = callsLedger([], { outlook: null, closesBy: { gold: [] }, now: NOW, extra: [call] });
  L = callsLedger(L, { outlook: null, closesBy: { gold: [] }, now: NOW + 3600, extra: [{ ...call, p: 0.61 }] });
  assert.equal(L.length, 1); assert.equal(L[0].p, 0.58); assert.equal(L[0].baseP, 0.54); assert.equal(L[0].issued, '2026-11-09');
  const C = [{ t: Date.UTC(2026, 10, 9) / 1000, v: 100 }, { t: Date.UTC(2026, 10, 10) / 1000, v: 99 }], later = Date.UTC(2026, 10, 12, 1) / 1000;
  L = callsLedger(L, { outlook: null, closesBy: { gold: C }, now: later });
  assert.equal(L[0].hit, false); assert.equal(L[0].brier, +(0.58 ** 2).toFixed(4));
  const R = records({ calls: L }); assert.equal(R[0].src, 'event'); assert.equal(R[0].base, 0.54);
  assert.equal(calibration({ calls: L }).bySource.event.n, 1); assert.equal(callsScore(L).n, 1);
  const ev = [{ at: iso(T_CPI), call: { ...call, p: 0.6 } }], rec = V.freezeEventCalls(ev, L);
  assert.equal(ev[0].call.p, 0.58); assert.equal(ev[0].call.live, 0.6); assert.equal(ev[0].call.hit, false); assert.equal(ev[0].call.recorded, true); assert.equal(rec.n, 1);
});

test('the committed event-base.json: rows before the build, the pre-registered test result, no future release', () => {
  const B = V.eventBase(); assert.ok(B, 'council/event-base.json is committed');
  assert.equal(B.readPct, P.READ_PCT); assert.ok(B.rows.length > 100);
  for (const r of B.rows) { assert.ok(['CPI', 'NFP', 'FOMC'].includes(r.type)); assert.ok(r.t < Date.parse(B.built) / 1000); for (const k of ['g5', 'g60', 'dx5']) assert.ok(Number.isFinite(r[k]), `${r.d} ${k}`); }
  assert.equal(typeof B.test.CPI.pass, 'boolean'); assert.match(B.test.verdict, /^(PASS|FAIL)/);
  const R = JSON.parse(fs.readFileSync(new URL('../research/edge/event-reaction/result.json', import.meta.url), 'utf8')); assert.equal(R.test.CPI.n, B.test.CPI.n);
  assert.ok(fs.existsSync(new URL('../research/edge/event-reaction/preregistration.md', import.meta.url)));
});

test('the veteran: build publishes the cards with a calibrated call; run records it in veteran-calls.json once', () => {
  const closes = closesTo(NOW), base = { rows: Array.from({ length: 30 }, (_, i) => row(day(closes[closes.length - 40 - i * 20].t))), test: { CPI: { n: 30, hits: 15, hit: 0.5, p: 0.5, pass: false, halves: { a: {}, b: {} } } } };
  const fc = { at: iso(NOW - 600), assets: { gold: { pUp: 0.54, fit: { base: 0.536 }, drivers: [] } }, regime: {}, drivers: [], goldScore: { score: 0.1, ok: true }, playbook: [pb(), pb({ title: 'CPI m/m', consensus: '0.3%' })] };
  const { v } = V.build({ fc, cache: { fred: {} }, daily: { gold: closes, dxy: [] }, now: NOW, evBase: base });
  assert.equal(v.events.length, 1); const e = v.events[0];
  assert.equal(e.type, 'CPI'); assert.equal(e.titles.length, 2); assert.ok(e.call && e.call.pRaw === e.call.p, 'calibration waiting: p as computed, raw kept');
  assert.equal(e.label, P.DESCRIPTIVE); assert.equal(e.paperOnly, true); assert.match(v.brief, /Event playbook: USD Core CPI m\/m/);
  assert.match(V.veteranSection({ ...v, debate: [] }), /Event playbook: USD Core CPI m\/m/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vetpb-')); fs.mkdirSync(path.join(dir, 'macro'));
  fs.writeFileSync(path.join(dir, 'macro', 'forecast.json'), JSON.stringify(fc)); fs.writeFileSync(path.join(dir, 'macro', 'cache.json'), '{}');
  // no gold candles in council-data: no call is made, never a guess
  V.run({ dir, now: NOW, log: () => {} });
  let vj = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran.json'), 'utf8')); assert.equal(vj.events[0].call, null); assert.match(vj.events[0].callNote, /Not enough gold history/);
  // with the candles (and the committed event history): recorded once over two runs, the first probability kept
  fs.mkdirSync(path.join(dir, 'research', 'daily'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'research', 'daily', 'xau.json'), JSON.stringify({ rows: closes.map((o) => [o.t, o.v, o.v, o.v, o.v, 1]) }));
  V.run({ dir, now: NOW, log: () => {} }); V.run({ dir, now: NOW + 1800, log: () => {} });
  const CL = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran-calls.json'), 'utf8')).filter((r) => r.src === P.CALL_SRC);
  assert.equal(CL.length, 1); assert.equal(CL[0].id, 'evt:2026-11-10:gold:dayUp'); assert.equal(CL[0].issued, '2026-11-09'); assert.ok(Number.isFinite(CL[0].baseP));
  vj = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran.json'), 'utf8')); assert.equal(vj.events[0].call.recorded, true); assert.equal(vj.events[0].call.p, CL[0].p);
  // after the release the card stays (12 h) with the recorded call and makes no new one
  V.run({ dir, now: T_CPI + 600, log: () => {} });
  vj = JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran.json'), 'utf8')); assert.equal(vj.events[0].released, true); assert.equal(vj.events[0].call.id, CL[0].id);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'macro', 'veteran-calls.json'), 'utf8')).filter((r) => r.src === P.CALL_SRC).length, 1);
});

test('the Macro desk: a Next release card near the top that reads only fields the playbook writes; no infinite animation', () => {
  const html = fs.readFileSync(new URL('../macro-desk.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('id="c-next"') > html.indexOf('id="c-glance"') && html.indexOf('id="c-next"') < html.indexOf('id="c-score"'));
  assert.match(html, /renderGlance\(v\); renderNext\(v\);/);
  for (const f of ['expectations', 'scenarios', 'stats', 'call', 'callNote', 'bands', 'titles', 'released', 'eventsRecord', 'firstHour', 'after5', 'absMedian', 'readNote', 'cluster', 'captured']) assert.ok(html.includes('.' + f), f);
  const css = html.slice(html.indexOf('Next release (9 Nov 2026'), html.indexOf('</style>')); assert.doesNotMatch(css, /infinite/);
  assert.doesNotMatch(html.slice(html.indexOf('1b. the next release'), html.indexOf('  function load() {')), /innerHTML = [^;]*\+ (e|x0|c|r|y|z)\.(title|claim|consensus|path|action|usd|gold|when)\b(?![^;]*esc)/);
});
