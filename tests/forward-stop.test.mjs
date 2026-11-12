// node --test tests/forward-stop.test.mjs
// 12 Nov 2026, the owner on items 41-46: "Yes to all". Item 43 adopted the forward-test protocol of
// research/proposals/2026-11-12-path-to-live.md (section 3): "any one [stop line]: the book goes back to a paper shadow and you are
// told; no trade is closed by it, every open trade keeps its stop and runs to its own exit". council/forward.mjs stopSwitch is that
// consequence, applied by the Trader at the start of a round from the last reading. Pinned here offline: the crossing, the one-time
// switch, open trades untouched, no return by itself, execution checks never switch, the Trader's wiring and the one alert.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildForward, loadProtocol, stopSwitch, SWITCH_K, QUOTE, START } from '../council/forward.mjs';
import { spotSkip, stopFill, exitR, fillBarAmbiguous, ownStream } from '../council/fills.mjs';
import { alertable } from '../council/alerts.mjs';

const P = loadProtocol(), DOC = fs.readFileSync(new URL('../research/proposals/2026-11-12-path-to-live.md', import.meta.url), 'utf8');
const TRADER = fs.readFileSync(new URL('../council/trader.mjs', import.meta.url), 'utf8');
const DAY = 86400;
let seq = 0;
const T = (o) => ({ id: `xau-${o.k || 'geg'}-${++seq}`, k: 'geg', market: 'xau', side: 'buy', entry: 4000, stop: 3960, r0: 40, status: 'win', filled: START + DAY * seq, closed: START + DAY * seq + 3600, R: 1, Rnet: 0.95, ...o });
const CONFIG = () => ({ ownerShadow: { replica: 1794434536, 'mosha-bo': 1794434536, gtl: 1794434536, gmp: 1794434536, 'nq-open': 1794434536 }, history: [{ at: 'x', by: 'user', change: 'older' }], goldTrend: { n: 20, k: 2 }, goldEG: { sma: 20 } });
// a reading whose S1 is crossed (25 losers of -1R), and one where nothing is crossed (but E2 fails: no copy file)
const losers = Array.from({ length: 25 }, (_, i) => T({ Rnet: -1, filled: START + i * 3600, closed: START + i * 3600 + 60 }));
const BAD = buildForward({ trades: losers, protocol: P, mirrors: [], accounts: null }, { now: START + 30 * DAY });
const FEW = buildForward({ trades: [T({ filled: START + 3600, closed: START + 7200 })], protocol: P, mirrors: [], accounts: null }, { now: START + 2 * DAY });
const EONLY = buildForward({ trades: Array.from({ length: 12 }, (_, i) => T({ Rnet: i % 2 ? -0.8 : 0.1, filled: START + i * 3600, closed: START + i * 3600 + 60 })), protocol: P }, { now: START + 7 * DAY });
const NOW = START + 30 * DAY + 600;

test('the quoted rule is the protocol\'s own sentence, and the book switched is the protocol\'s (Gold trend, Gold daily engulf; not the Mosha cycle)', () => {
  assert.ok(DOC.replace(/\s+/g, ' ').includes('(' + QUOTE + ')'), 'QUOTE is section 3\'s text');
  assert.deepEqual(SWITCH_K, ['gtrend', 'geg']); assert.ok(!SWITCH_K.includes('mcycle'));
  assert.equal(BAD.status, 'stop'); assert.ok(BAD.stops.some((s) => s.id === 'S1' && s.state === 'crossed'));
});

test('a crossed stop line: gtrend and geg join ownerShadow with the time, the other entries kept; forwardStop and ONE by-user history line quoting the protocol', () => {
  const c = CONFIG(), before = structuredClone(c), sw = stopSwitch(c, BAD, NOW);
  assert.ok(sw); assert.deepEqual(sw.lines, ['S1']);
  assert.deepEqual(c.ownerShadow, { ...before.ownerShadow, gtrend: Math.floor(NOW), geg: Math.floor(NOW) });
  assert.deepEqual([c.forwardStop.at, c.forwardStop.lines, c.forwardStop.systems, c.forwardStop.reading], [Math.floor(NOW), ['S1'], ['gtrend', 'geg'], BAD.at]);
  assert.equal(c.history.length, 2); const h = c.history[1];
  assert.equal(h.by, 'user'); assert.ok(h.why.includes(QUOTE)); assert.match(h.why, /adopted by the owner on 12 Nov 2026 \("Yes to all", docs\/owner-decisions\.md item 43/);
  assert.match(h.change, /stop line S1 crossed; Gold trend and Gold daily engulf go back to paper shadows \(new trades only; open trades run to their own exits with their stops\)/);
  assert.match(sw.alert.title, /stop line crossed/); assert.match(sw.alert.msg, /No open trade was closed and every stop stays; nothing goes back by itself/);
  // nothing else in the config moved (no rule, size, filter or stop key)
  const { ownerShadow, forwardStop, history, ...rest } = c, { ownerShadow: o0, history: h0, ...rest0 } = before;
  assert.deepEqual(rest, rest0);
});

test('once: a later reading with the line still crossed, or another line crossed, changes nothing; an entry already in ownerShadow keeps its date', () => {
  const c = CONFIG(); stopSwitch(c, BAD, NOW); const snap = structuredClone(c);
  assert.equal(stopSwitch(c, BAD, NOW + DAY), null); assert.deepEqual(c, snap);
  const S2 = structuredClone(BAD); S2.stops = S2.stops.map((s) => (s.id === 'S2' ? { ...s, state: 'crossed', value: -11 } : s));
  assert.equal(stopSwitch(c, S2, NOW + 400 * DAY), null); assert.deepEqual(c, snap);
  const d = CONFIG(); d.ownerShadow.geg = 123; stopSwitch(d, BAD, NOW); assert.equal(d.ownerShadow.geg, 123); assert.equal(d.ownerShadow.gtrend, Math.floor(NOW));
});

test('no return by itself: a reading that clears, or no reading at all, never removes the two from ownerShadow', () => {
  const c = CONFIG(); stopSwitch(c, BAD, NOW); const snap = structuredClone(c);
  for (const fw of [FEW, EONLY, null, undefined, { error: 'no protocol file' }]) { assert.equal(stopSwitch(c, fw, NOW + 5 * DAY), null); assert.deepEqual(c, snap); }
  // nothing in the Trader or forward.mjs deletes an ownerShadow key or clears forwardStop
  const FWD = fs.readFileSync(new URL('../council/forward.mjs', import.meta.url), 'utf8');
  assert.ok(!/delete\s+[\w.]*ownerShadow|ownerShadow\s*=\s*(null|\{\s*\})|forwardStop\s*=\s*(null|undefined)|delete\s+[\w.]*forwardStop/.test(TRADER + FWD));
});

test('execution checks only report: a failing E check with no crossed line switches nothing; nor does an error or a reading with no lines', () => {
  assert.ok(EONLY.exec.checks.some((x) => x.state === 'fail')); assert.ok(EONLY.stops.every((s) => s.state !== 'crossed'));
  for (const fw of [EONLY, FEW, { error: 'x', stops: [{ id: 'S1', state: 'crossed', rule: 'r', value: 30, line: 21.9 }] }, { stops: [] }, {}]) { const c = CONFIG(), b = structuredClone(c); assert.equal(stopSwitch(c, fw, NOW), null); assert.deepEqual(c, b); }
  assert.equal(stopSwitch(null, BAD, NOW), null);
});

// the Trader's own "Manage open trades" loop, lifted as tests/supported-book.test.mjs lifts it
const M1 = '// ─── Manage open trades on this market with the candles since the last check ───', M2 = '// ─── Review closed trades';
const liveLoop = new Function('trades', 'key', 'src', 'M', 'config', 'now', 'spotSkip', 'stopFill', 'exitR', 'fillBarAmbiguous', 'startReview', 'NEWS', 'WAIT', 'FEED', TRADER.slice(TRADER.indexOf(M1), TRADER.indexOf(M2)));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
const T0 = Date.UTC(2026, 10, 13, 10) / 1000;
function path() { const bars = []; let p = 4000, t = T0 + 60; const step = (to, n) => { for (let i = 0; i < n; i++) { const q = p + (to - p) / (n - i); bars.push({ time: t, open: p, high: Math.max(p, q) + 0.6, low: Math.min(p, q) - 0.6, close: q }); p = q; t += 60; } };
  step(3992, 20); step(4046, 60); step(4031, 20); step(4071, 60); step(4020, 60); return bars; }

test('open and pending trades of the book are untouched by the switch: the same exits, stops and live flags with or without it', () => {
  const body = TRADER.slice(TRADER.indexOf(M1), TRADER.indexOf(M2));
  assert.ok(!/ownerSh\(|ownerShadow|forwardStop/.test(body), 'the management loop never reads the switch');
  const mk = () => [
    { id: 'xau-gtrend-1', market: 'xau', k: 'gtrend', side: 'buy', entry: 4000, stop: 3980, t1: 400000, rr: 99, trail: [1e6, 0], r0: 20, opened: T0, filled: T0, checked: T0, status: 'open', R: null, noBe: true, entryMode: 'market', shadow: false, blockedBy: [] },
    { id: 'xau-geg-1', market: 'xau', k: 'geg', side: 'buy', entry: 4010, stop: 3990, t1: 4210, tp1: 4050, rr: 10, trail: [2, 1], r0: 20, opened: T0, checked: T0, status: 'pending', R: null, validFor: 5 * DAY, maxHold: 10 * DAY, noBe: true, entryMode: 'limit', shadow: false, blockedBy: [] }];
  const bars = path(), go = (config) => { const tr = mk(); const src = { '1m': { bars }, '5m': { bars }, '15m': { bars } };
    liveLoop(tr, 'xau', src, { group: 'Metals' }, { be: null, ...config }, bars.at(-1).time + 60, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'oanda'); return tr; };
  const c = CONFIG(); stopSwitch(c, BAD, NOW);
  const A = go({}), B = go(c);
  assert.deepEqual(B, A, 'the switched config changes nothing in how open and pending trades are managed');
  for (const x of B) { assert.equal(x.shadow, false); assert.deepEqual(x.blockedBy, []); assert.ok(Number.isFinite(x.stop)); }
  // still the live trades they were: alerted, in the system's own stream
  assert.equal(alertable(B, []).length, B.length); assert.ok(B.every(ownStream));
});

test('the Trader: applies the switch right after the owner rules (before any system block), from coach.json forward, and sends one alert marked in state', () => {
  const a = TRADER.indexOf('for (const u of USER_RULES) if (!config.userRules.includes(u.id))'), s = TRADER.indexOf("const sw = stopSwitch(config, (rd('coach.json', {}) || {}).forward, now);"), legs = TRADER.indexOf("for (const LEG of [{ cfg: config.goldTrend, k: 'gtrend'");
  assert.ok(a > 0 && s > a && legs > s);
  assert.ok(TRADER.indexOf("wr('config.json', config);") > s, 'written with the config of that round');
  assert.match(TRADER, /if \(!quiet && fs0 && fs0\.alert && state\.forwardStopSent !== fs0\.at\) \{ const e = await sendAlerts\(\[fs0\.alert\], \{ topic, tgTok, tgChat \}\)/);
  assert.match(TRADER, /if \(Object\.keys\(e\)\.length < tried\) \{ state\.forwardStopSent = fs0\.at; wr\('state\.json', state\); \}/);
  // the two systems read the owner switch for NEW trades only (the push), as the five shadows of 11 Nov do
  assert.ok(TRADER.includes("const sh = (LEG.k === 'gtrend5' && !!config.goldTrendFastShadow) || ownerSh(LEG.k);"));
  assert.ok(TRADER.includes("const egSh = ownerSh('geg'), mine = trades.filter((x) => x.k === 'geg' && x.market === key && ownStream(x));"));
  assert.ok(TRADER.includes("shadow: egSh, blockedBy: egSh ? ['owner-shadow'] : [],"));
  // the protocol's book in the tracker is still these two: the Mosha cycle is never counted
  const fw = buildForward({ trades: [T({ k: 'mcycle' }), T({ k: 'gtrend' })], protocol: P }, { now: START + 3 * DAY });
  assert.equal(fw.record.n, 1);
});
