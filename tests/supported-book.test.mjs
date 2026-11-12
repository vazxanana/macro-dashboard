// node --test tests/supported-book.test.mjs
// 11 Nov 2026, the owner on the edge review (research/proposals/2026-11-11-edge-review.md): "yes anything that is better for the
// system and that applies it". Three approved changes, each pinned here offline:
//   1. the live paper book is Gold trend (20-day) and Gold daily engulf; the replica, the momentum pullback, the NQ open run, the H4
//      trendline and Mosha BO are paper shadows from the rule on (same rule, same stop, same loop, never alerted);
//   2. overnight financing is part of the paper cost (council/fills.mjs), by the method and rate of research/edge/trend-breadth Part A;
//   3. the demo mirror opens no new copy of the replica's forex and crypto paper trades (tests/ctrader-mirror.test.mjs has the broker tests).
// Absolute rule 1 is checked throughout: no stop is removed, loosened or moved away by any of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { FIN, nights, financing, ownStream, tradeCost, annotateCosts, costSummary, addUnit, spotSkip, stopFill, exitR, fillBarAmbiguous } from '../council/fills.mjs';
import { alertable, alertEvents } from '../council/alerts.mjs';
import { SYSTEMS, SHADOW_11NOV, recordOf, buildDecay } from '../council/decay.mjs';
import { buildExpect, expectLine, loadExpectBase } from '../council/expect.mjs';
import { merNet } from '../council/digest.mjs';
import { isNyflipClosed, metaR, regimeShadow } from '../council/regime.mjs';
import { goldSystemsSection } from '../council/analyst.mjs';
import { P as STUDY, nights as studyNights } from '../research/edge/trend-breadth/run.mjs';

const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const TRADER = rd('council/trader.mjs'), PAGE = rd('market-structure.html');
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const seg = (s, a, b) => { const i = s.indexOf(a), j = s.indexOf(b, i); assert.ok(i > 0 && j > i, 'block not found: ' + a.slice(0, 50)); return s.slice(i, j + b.length); };
const ts = (s) => Date.parse(s) / 1000;
const SHADOWED = ['replica', 'mosha-bo', 'gtl', 'gmp', 'nq-open'];

// ─── the three owner rules, lifted out of the Trader and applied to a config shaped like council-data's ───
const rulesSrc = seg(TRADER, "  { id: 'supported-book', apply:", "Owner approved.' },\n];").replace(/\n\];$/, '');
const K = TRADER.match(/const OWNER_SHADOW_K = (\[[^\]]+\]);/);
const RULES = new Function('OWNER_SHADOW_K', 'return [' + rulesSrc + '];')(JSON.parse(K[1].replace(/'/g, '"')));
const CONFIG = () => ({ userRules: ['gold-trend', 'gold-daily-engulf', 'gold-trend-fast-shadow'], history: [], replicaLive: ['xau'], moshaBo: true, moshaBoWeekly: true, focus: ['none'], focusSetups: [],
  goldTrend: { n: 20, k: 2 }, goldTrendAdd: { atR: 1 }, goldEG: { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }, goldTL: { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 },
  goldMP: { mult: 1.5, top: 0.8, z1: 0.382, z2: 0.618, wait: 6, k: 2 }, goldTrendFast: { n: 5, k: 2 }, goldTrendFastShadow: true, nqRun: { atR: 2, trail: 1 }, mirrorShadow: undefined });

test('the owner rules: exactly three, each applied once by the Trader\'s own rule loop, each with the owner\'s words or approval in its reason', () => {
  assert.deepEqual(RULES.map((r) => r.id), ['supported-book', 'count-financing', 'replica-mirror-gold-only']);
  assert.deepEqual(JSON.parse(K[1].replace(/'/g, '"')), SHADOWED);
  assert.match(RULES[0].why, /"yes anything that is better for the system and that applies it"/);
  for (const r of RULES) { assert.ok(r.change.length > 40 && r.why.length > 40); assert.match(r.why, /Owner/); }
  // they sit at the END of USER_RULES, and the loop that applies a rule once and logs it is the one every earlier owner rule used
  assert.ok(TRADER.indexOf("{ id: 'supported-book'") > TRADER.indexOf("{ id: 'lit-shadow'"));
  assert.ok(TRADER.includes("for (const u of USER_RULES) if (!config.userRules.includes(u.id)) { u.apply(config); config.userRules.push(u.id); config.history.push({ at: nowISO, by: 'user', change: u.change, why: u.why }); }"));
  assert.ok(TRADER.indexOf('const OWNER_SHADOW_K') < TRADER.indexOf('for (const u of USER_RULES)'), 'the list exists before the rules run');
});

test('rule 1 writes only config.ownerShadow: the five systems, nothing of Gold trend or the daily engulf, no parameter of any system', () => {
  const c = CONFIG(), before = JSON.parse(JSON.stringify(c)), t0 = Math.floor(Date.now() / 1000);
  RULES[0].apply(c);
  assert.deepEqual(Object.keys(c.ownerShadow).sort(), SHADOWED.slice().sort());
  for (const k of SHADOWED) assert.ok(c.ownerShadow[k] >= t0 && c.ownerShadow[k] <= t0 + 5, 'the start time of the rule');
  assert.ok(!('gtrend' in c.ownerShadow) && !('geg' in c.ownerShadow) && !('gtrend5' in c.ownerShadow));
  const { ownerShadow, ...rest } = c; assert.deepEqual(JSON.parse(JSON.stringify(rest)), before, 'every other key is what it was: no entry, filter, size, stop or exit setting moved');
  assert.equal(c.goldTrendFastShadow, true, 'Gold trend fast stays a shadow');
  // a second application (a config that already has a start time) keeps the first time: history is never re-dated
  const first = { ...c.ownerShadow }; RULES[0].apply(c); assert.deepEqual(c.ownerShadow, first);
});

test('rules 2 and 3 write one key each: the financing start and the mirror\'s market list with its condition', () => {
  const c = CONFIG(), before = JSON.parse(JSON.stringify(c));
  RULES[1].apply(c); RULES[2].apply(c);
  assert.ok(Math.abs(Date.parse(c.financingFrom) - Date.now()) < 5000);
  assert.deepEqual(c.mirrorReplica.markets, ['xau']); assert.deepEqual([c.mirrorReplica.until.n, c.mirrorReplica.until.grossR], [200, 0]); assert.match(c.mirrorReplica.until.text, /200 or more.*before costs.*owner decides/);
  const { financingFrom, mirrorReplica, ...rest } = c; assert.deepEqual(JSON.parse(JSON.stringify(rest)), before);
});

// ─── 1. which systems are live, shadow, alerted ───
test('the two systems that stay live are byte for byte what they were: Gold trend / Gold trend fast loop and the daily engulf block', () => {
  const legs = seg(TRADER, "    for (const LEG of [{ cfg: config.goldTrend, k: 'gtrend'", '} catch (e) { snapshot.errors[LEG.snap] = String(e.message || e); }');
  const eg = seg(TRADER, "    if (key === 'xau' && config.goldEG) {", '} catch (e) { snapshot.errors.goldEG = String(e.message || e); }');
  // 12 Nov 2026 (owner: "Yes to all", item 43 adopted the forward-test protocol): the ONLY change since 11 Nov is that both read the
  // owner-shadow switch for NEW trades (a crossed stop line puts them in config.ownerShadow, council/forward.mjs stopSwitch); with
  // those lines put back as they were, each block is byte for byte the 11 Nov one (tests/forward-stop.test.mjs has the switch)
  const L_NEW = "        // forward-test protocol (owner, 12 Nov 2026): a crossed stop line puts gtrend in config.ownerShadow (stopSwitch): new trades shadow\n        const sh = (LEG.k === 'gtrend5' && !!config.goldTrendFastShadow) || ownerSh(LEG.k);";
  const E_NEW = "        // forward-test protocol (owner, 12 Nov 2026): a crossed stop line puts geg in config.ownerShadow (stopSwitch): new orders are paper\n        // shadows; the system's own orders (live, or shadow by the owner) keep the zone cancel and the cap as one stream\n        const egSh = ownerSh('geg'), mine = trades.filter((x) => x.k === 'geg' && x.market === key && ownStream(x));";
  assert.ok(legs.includes(L_NEW) && eg.includes(E_NEW) && eg.includes("shadow: egSh, blockedBy: egSh ? ['owner-shadow'] : [],"));
  const legs0 = legs.replace(L_NEW, "        const sh = LEG.k === 'gtrend5' && !!config.goldTrendFastShadow;");
  // 12 Nov 2026 (owner approved a fidelity fix, docs/owner-decisions.md item 52; tests/geg-trading-days.test.mjs): the engulf reads
  // trading days (the Sunday reopen stub folded into Monday) with the reopen freshness, as research/edge/gold-weekend tested; with
  // those lines also put back the block is byte for byte the 11 Nov one. The trend legs are untouched (that study: KEEP).
  const E_DAYS = "        // trading days (owner, 12 Nov 2026, fidelity fix, item 52; research/edge/gold-weekend): closed UTC days, the Sunday reopen stub\n        // (and any Saturday / Sunday candle) folded into the next weekday; a signal is fresh for 24 h from the reopen after its day\n        const EG = config.goldEG, D = foldWeekend(src['1d'].bars.filter((b) => b.time + 86400 <= now)), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);";
  const E_FRESH = 'if (base && up && !trades.some((x) => x.id === id) && gegFresh(last.time, now) && openCnt < EG.maxOpen) {';
  assert.ok(eg.includes(E_DAYS) && eg.includes(E_FRESH), 'the engulf reads trading days (item 52)');
  const eg0 = eg.replace(E_NEW, "        const mine = trades.filter((x) => x.k === 'geg' && x.market === key && !x.shadow);").replace("shadow: egSh, blockedBy: egSh ? ['owner-shadow'] : [],", 'shadow: false, blockedBy: [],')
    .replace(E_DAYS, "        const EG = config.goldEG, D = src['1d'].bars.slice(0, -1), n = D.length, last = D[n - 1], dp = Math.max(2, (M.dec ?? 2) + 1);")
    .replace(E_FRESH, 'if (base && up && !trades.some((x) => x.id === id) && now - (last.time + 86400) < 86400 && openCnt < EG.maxOpen) {');
  assert.equal(sha(legs0), 'ee3dfa27f9788c2917ec79a2b01e52c1dbf255161511b2a0c51519a6f57e573e', 'the trend legs changed beyond the owner switch: that is a rule change the owner did not approve');
  assert.equal(sha(eg0), '511e46164b69e41191d05b3e6d5b1b2b655f66b4191e89ec26e5cefe77544ac0', 'the daily engulf changed beyond the owner switch: that is a rule change the owner did not approve');
  assert.ok(!/ownerSh\(/.test(legs0 + eg0), 'apart from those lines neither reads the owner-shadow switch');
});

test('the five systems: a new trade is shadow with blockedBy owner-shadow only when the config says so; the entry, stop and exit text is untouched', () => {
  // H4 trendline: one position as before (its own stream), the same push with the flag
  const tl = seg(TRADER, "    if (key === 'xau' && config.goldTL) {", '} catch (e) { snapshot.errors.goldTL = String(e.message || e); }');
  assert.ok(tl.includes("const tlSh = ownerSh('gtl'), open = trades.find((x) => x.k === 'gtl' && x.market === key && ownStream(x) && (x.status === 'open' || x.status === 'pending'));"));
  assert.ok(tl.includes("shadow: tlSh, blockedBy: tlSh ? ['owner-shadow'] : [],"));
  assert.ok(tl.includes('const entry = +price.toFixed(dp), lo = Math.min(...H.slice(b).map((x) => x.low)), stop = +(lo - TL.pad).toFixed(dp), r0 = entry - stop;'), 'entry and stop as they were');
  assert.ok(tl.includes('rr: 10, trail: [2, 1], buf: CFG.buf, opened: now, filled: now, checked: now, status: \'open\', R: null, r0, maxHold: TL.hold * 3600, noBe: true'), 'exit as it was');
  assert.ok(tl.includes("if (r0 > 0) trades.push({ id, market: key"), 'no trade without a positive stop distance');
  // Mosha BO: the owner-shadow tag is one more reason in the list; the cap still counts the system's own chains
  const mo = seg(TRADER, "    if (key === 'xau' && config.moshaBo) {", '} catch (e) { snapshot.errors.moshaBo = String(e.message || e); }');
  assert.ok(mo.includes("!!(config.moshaSlow && pull != null && pull < config.moshaSlow) && 'momentum', ownerSh('mosha-bo') && 'owner-shadow'].filter(Boolean);"));
  assert.ok(mo.includes('shadow: blk.length > 0, blockedBy: blk,'));
  assert.ok(mo.includes("const openBo = trades.filter((x) => x.k === 'mosha-bo' && ownStream(x) && (x.status === 'open' || x.status === 'pending')).length;"));
  assert.ok(mo.includes("const entry = +e3.level.toFixed(2), stop = +(d < 0 ? e3.top + 0.3 : e3.bot - 0.3).toFixed(2), r0 = Math.abs(entry - stop);"));
  // Gold replica: same push, same risk rules reading its own stream
  assert.ok(TRADER.includes("shadow: ownerSh('replica'), blockedBy: ownerSh('replica') ? ['owner-shadow'] : [],"));
  assert.equal((TRADER.match(/x\.k === 'replica' && x\.market === key && ownStream\(x\)/g) || []).length, 3, 'the cap of 3, the daily stop / equity filter and the pair switch read the replica\'s own trades');
  assert.ok(!/x\.k === 'replica' && x\.market === key && !x\.shadow/.test(TRADER));
  assert.ok(TRADER.includes("(config.replicaLive || []).includes(key)) trades.push({ id: `${key}-replica-${now}-${g.sell ? 's' : 'b'}`"), 'the replica\'s own gates still decide whether it trades at all');
  // momentum pullback: already a test shadow since 6 Nov, untouched
  assert.ok(TRADER.includes("shadow: true, blockedBy: ['test'], test: true,"));
  // NQ open run: marked after the pinned push (tests/nq-regime.test.mjs keeps the sha256 of the push itself)
  const a = TRADER.indexOf('      if (g && ndoOk) {\n'), end = 'out at 11:00 ET.` });\n', b = TRADER.indexOf(end, a) + end.length, tail = TRADER.slice(b, TRADER.indexOf('\n      }\n', b));
  assert.ok(tail.includes("if (ownerSh('nq-open')) Object.assign(research.find((x) => x.id === `nq-nyflip-${ny.d}`), { shadow: true, blockedBy: ['owner-shadow'] });"));
  assert.ok(!/\.(entry|stop|t1|rr|tp1|trail|side|exitAt|status|opened) *=/.test(tail), 'the mark writes no trade level');
  // never alerted: the MT5 feed drops a shadow open run, and the "Mosha armed" heads-up is off while Mosha BO is a shadow
  assert.ok(TRADER.includes(".filter((x) => !x.shadow).map((x) => ({ ...x, k: 'nq-open', market: 'nq' })));"));
  assert.ok(TRADER.includes("const ma = quiet || !snapshot.moshaBo || ownerSh('mosha-bo') ? null : moshaArmed("));
  assert.ok(TRADER.includes("const rows = trades.filter((x) => !x.shadow && SYSK.includes(x.k)"), 'the MT5 feed never carried a shadow trade');
  assert.ok(TRADER.includes('const ownerSh = (k) => !!(config.ownerShadow || {})[k];'));
});

test('ownStream: a system\'s own trades are its live ones and the ones only the owner (or the 6 Nov test) made shadow; a trade another rule blocked is not', () => {
  assert.equal(ownStream({ shadow: false }), true); assert.equal(ownStream({}), true);
  assert.equal(ownStream({ shadow: true, blockedBy: ['owner-shadow'] }), true); assert.equal(ownStream({ shadow: true, blockedBy: ['test'] }), true);
  for (const blk of [['weekly'], ['weekly', 'owner-shadow'], ['cap', 'owner-shadow'], ['momentum'], ['focus'], ['replica'], [], undefined, ['regime-shadow']]) assert.equal(ownStream({ shadow: true, blockedBy: blk }), false, JSON.stringify(blk));
  assert.equal(ownStream(null), false);
});

const T0 = ts('2026-11-12T10:00:00Z');
const mk = (k, o = {}) => ({ id: `xau-${k}-${o.n || 1}`, market: 'xau', label: 'XAU/USD', dec: 2, k, name: k, pair: 'p', h: '4h', side: 'buy', entry: 4000, stop: 3980, t1: 4200, tp1: 4040, rr: 10, trail: [2, 1], r0: 20,
  opened: T0, filled: T0, checked: T0, status: 'open', R: null, noBe: true, entryMode: 'market', shadow: false, blockedBy: [], ...o });
const SH = { shadow: true, blockedBy: ['owner-shadow'] };

test('alerts: the two live systems alert; a shadow trade of the five never does; a trade already open as live still gets its close alert', () => {
  const liveOld = mk('gtl', { n: 'old' }), shNew = mk('gtl', { n: 'new', ...SH }), trend = mk('gtrend', { n: 't' }), eg = mk('geg', { n: 'e', status: 'pending', filled: undefined, entryMode: 'limit' });
  const rep = mk('replica', { n: 'r', ...SH }), mo = mk('mosha-bo', { n: 'm', ...SH, status: 'pending' }), gmp = mk('gmp', { n: 'g', shadow: true, blockedBy: ['test'], test: true });
  const nqOld = { id: 'nq-nyflip-2026-11-11', k: 'nq-open', session: 'nyflip', market: 'nq', label: 'NQ', name: 'NQ New York open run', dec: 2, side: 'buy', entry: 25000, stop: 24950, t1: 25500, tp1: 25100, rr: 10, status: 'open', opened: T0, filled: T0 };
  const nqNew = { ...nqOld, id: 'nq-nyflip-2026-11-12', ...SH };
  const A = alertable([liveOld, shNew, trend, eg, rep, mo, gmp], [nqOld, nqNew]);
  assert.deepEqual(A.map((x) => x.id).sort(), [liveOld.id, trend.id, eg.id, nqOld.id].sort(), 'live trades only: what was live before the rule, and the two live systems');
  const ev = alertEvents(A, T0 + 60).ev;
  assert.equal(ev.length, 4, 'one open / limit alert each'); assert.ok(!ev.some((e) => /replica|mosha|gmp/i.test(e.title)));
  assert.equal(alertEvents(alertable([shNew, rep, mo, gmp], [nqNew]), T0 + 60).ev.length, 0, 'no alert and no futures ticket for a shadow');
  // the live trade from before the rule runs to its exit and its close is alerted like any live close
  Object.assign(liveOld, { status: 'loss', R: -1, closed: T0 + 3600, exit: undefined });
  const c = alertEvents(alertable([liveOld], []), T0 + 3660).ev; assert.equal(c.length, 1); assert.match(c[0].title, /^Loss/);
});

// the Trader's own "Manage open trades" loop, lifted as tests/fills-live.test.mjs lifts it
const M1 = '// ─── Manage open trades on this market with the candles since the last check ───', M2 = '// ─── Review closed trades';
const liveLoop = new Function('trades', 'key', 'src', 'M', 'config', 'now', 'spotSkip', 'stopFill', 'exitR', 'fillBarAmbiguous', 'startReview', 'NEWS', 'WAIT', 'FEED', TRADER.slice(TRADER.indexOf(M1), TRADER.indexOf(M2)));
const WAIT = { '1d': 5 * 86400, '4h': 2 * 86400, '1h': 12 * 3600, '30m': 6 * 3600, '15m': 3 * 3600 };
function run(tr, bars, now) { const trades = [tr], src = { '1m': { bars }, '5m': { bars }, '15m': { bars } };
  liveLoop(trades, 'xau', src, { group: 'Metals' }, { be: null }, now, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'oanda'); return trades; }
// a deterministic gold path: up through +2R (the trail starts), on to +3.5R, then back through the trailed stop
function path() { const bars = []; let p = 4000, t = T0 + 60; const step = (to, n) => { for (let i = 0; i < n; i++) { const q = p + (to - p) / (n - i); bars.push({ time: t, open: p, high: Math.max(p, q) + 0.6, low: Math.min(p, q) - 0.6, close: q }); p = q; t += 60; } };
  step(3992, 20); step(4046, 60); step(4031, 20); step(4071, 60); step(4020, 60); return bars; }

test('a trade open as live when the rule starts is managed exactly as before, with its stop: the loop does not read the shadow flag', () => {
  const body = TRADER.slice(TRADER.indexOf(M1), TRADER.indexOf(M2));
  assert.ok(!/ownerSh\(|ownerShadow/.test(body), 'the management loop never reads the owner rule');
  const bars = path(), now = bars.at(-1).time + 60;
  const live = mk('gtl', { n: 'old', addAt: 1.5, addSize: 1, maxHold: 96 * 3600 }), shadow = { ...structuredClone(live), ...SH };
  // every stop the loop sets, in order, for the live trade
  const stops = [live.stop]; const tl = [live], srcOf = (b) => ({ '1m': { bars: b }, '5m': { bars: b }, '15m': { bars: b } });
  for (let i = 1; i <= bars.length && live.status === 'open'; i++) { liveLoop(tl, 'xau', srcOf(bars.slice(0, i)), { group: 'Metals' }, { be: null }, bars[i - 1].time + 60, spotSkip, stopFill, exitR, fillBarAmbiguous, () => {}, [], WAIT, 'oanda'); stops.push(live.stop); }
  assert.ok(stops.every((s, i) => i === 0 || s >= stops[i - 1]), 'a buy\'s stop never moves down'); assert.ok(stops.at(-1) > stops[0], 'the trail did move it up');
  assert.ok(['win', 'loss', 'be'].includes(live.status) && Number.isFinite(live.R) && live.R > 1, 'it ran to its own exit, a trailed stop above +1R');
  assert.equal(live.shadow, false, 'still the live trade it was'); assert.deepEqual(live.blockedBy, []);
  const liveAdd = tl.find((x) => x.addOf === live.id); assert.ok(liveAdd && liveAdd.shadow === false && liveAdd.stop >= live.entry, 'its add is a live unit with its stop at the first entry or better');
  // the same candles for an owner-shadow copy: the same fills, stops and result; only the shadow fields differ
  const B = run(shadow, bars, now), strip = (t) => { const { shadow: s, blockedBy, note, id, addOf, checked, ...rest } = t; return rest; };   // checked: the run pointer (one long run against candle-by-candle runs)
  assert.deepEqual(strip(shadow), strip(live), 'a shadow is managed by the same loop to the same exit');
  const shAdd = B.find((x) => x.addOf === shadow.id); assert.deepEqual([shAdd.shadow, shAdd.blockedBy], [true, ['owner-shadow']], 'a shadow\'s add is a shadow');
  assert.ok(B.every((t) => t.stop != null && (t.side === 'buy' ? t.stop < 4200 : true)));
  assert.equal(addUnit({ ...mk('gtl'), addAt: 1.5 }, bars[0]).shadow, false);
});

test('decay monitor: live = Gold trend, Gold daily engulf (and the ICT desk); a shadowed system keeps its record: live trades before, owner-shadow trades after', () => {
  assert.deepEqual(SYSTEMS.filter((s) => !s.shadow).map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  for (const id of SHADOWED) { const s = SYSTEMS.find((x) => x.id === id); assert.equal(s.shadow, true); assert.equal(s.since, SHADOW_11NOV); }
  assert.equal(SYSTEMS.find((x) => x.id === 'gtrend5').since, '2026-11-07'); assert.equal(SHADOW_11NOV, '2026-11-11');
  const closed = (o) => ({ status: 'win', R: 1, closed: T0 + 100, opened: T0, ...o });
  const trades = [closed({ id: 'a', k: 'mosha-bo', shadow: false }), closed({ id: 'b', k: 'mosha-bo', ...SH, closed: T0 + 200 }), closed({ id: 'c', k: 'mosha-bo', shadow: true, blockedBy: ['weekly', 'owner-shadow'], R: -1, closed: T0 + 300 }),
    closed({ id: 'd', k: 'geg', shadow: false }), closed({ id: 'e', k: 'geg', shadow: true, blockedBy: ['owner-shadow'], closed: T0 + 200 }), closed({ id: 'f', k: 'gmp', shadow: true, blockedBy: ['test'] })];
  const research = [closed({ id: 'n1', k: 'nq-open', session: 'nyflip' }), closed({ id: 'n2', k: 'nq-open', session: 'nyflip', ...SH, closed: T0 + 200 }), closed({ id: 'n3', k: 'nq-open', session: 'nyflip-trend', shadow: true, blockedBy: ['regime-shadow'] })];
  const D = { trades, research, replay: { trades: [] } }, rec = (id) => recordOf(SYSTEMS.find((s) => s.id === id), D).length;
  assert.equal(rec('mosha-bo'), 2, 'the live chain before and the owner-shadow chain after; the chain the weekly filter blocked is not Mosha BO\'s record');
  assert.equal(rec('geg'), 1, 'a live system counts live trades only'); assert.equal(rec('gmp'), 1, 'the test shadows are the momentum pullback\'s record');
  assert.equal(rec('nq-open'), 2, 'the open run before and after; the trend-on copy is another stream');
  // the regime tag's "own stream" follows it too, and the trend-on copy stays out
  assert.equal(isNyflipClosed(research[0]), true); assert.equal(isNyflipClosed(research[1]), true); assert.equal(isNyflipClosed(research[2]), false);
  assert.equal(metaR(research, T0 + 1000).n, 2);
  const sh = regimeShadow({ ...research[1], day: '2026-11-12' }, { trend: 0.4, trendAsOf: 'x', cut: 0.295 }, { trendMin: 0.295 });
  assert.deepEqual([sh.shadow, sh.blockedBy, sh.session], [true, ['regime-shadow'], 'nyflip-trend'], 'the trend-on copy of a shadow open run is still its own shadow stream');
  // the digest only names LIVE systems as decaying
  const base = { at: 'x', systems: Object.fromEntries(SYSTEMS.map((s) => [s.id, { ref: 0.4, sd: 1.3, h: 12, perYear: 20, maxDD: 10, mcDD: 12, n: 100, src: 't' }])) };
  const out = buildDecay({ trades: [], research: [], replay: { trades: [] } }, { now: T0, base });
  assert.deepEqual(out.systems.filter((s) => s.live).map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  assert.deepEqual(out.systems.filter((s) => s.shadowSince === SHADOW_11NOV).map((s) => s.id), ['replica', 'mosha-bo', 'gtl', 'gmp', 'nq-open']);
});

test('what to expect: live flags, shadow dates and the financing figures reach coach.json', () => {
  const base = loadExpectBase(), ex = buildExpect(null, { now: T0, base });
  assert.deepEqual(ex.systems.filter((s) => s.live).map((s) => s.id), ['gtrend', 'geg', 'ict-a']);
  for (const id of SHADOWED) assert.equal(ex.systems.find((s) => s.id === id).shadowSince, SHADOW_11NOV);
  const g = ex.systems.find((s) => s.id === 'gtrend');
  // since 12 Nov 2026 (item 42): every unit, the add included, from the book study's unit records (research/edge/supported-book)
  assert.deepEqual([g.fin.before.exp, g.honest.exp, g.honest.n], [0.436, 0.313, 74]); assert.match(g.line, /^Expect \+0\.31R a position after financing on every unit/);
  // the replica, Mosha BO and the momentum pullback: their buys are charged too since the follow-up of 11 Nov (small: they hold hours, not weeks)
  const rp = ex.systems.find((s) => s.id === 'replica'); assert.ok(rp.fin.perTrade > 0 && rp.fin.perTrade < 0.02); assert.match(rp.line, /after financing/);
  assert.equal(ex.systems.find((s) => s.id === 'nq-open').fin, null); assert.doesNotMatch(ex.systems.find((s) => s.id === 'nq-open').line, /financing/);
  // a shadow system outside its band is not a digest line
  const fake = { systems: [{ id: 'replica', name: 'Gold replica', live: false, forward: { out: 'below', exp: -1, n: 12, lo: -0.5, hi: 0.5 } }] };
  assert.equal(expectLine(fake), null);
});

test('the Analyst\'s system table says which book each system is in', () => {
  const cfg = { ...CONFIG() }; RULES[0].apply(cfg);
  const md = goldSystemsSection({ snapshot: { goldVol: 1, goldVolP: 2, goldW1: 1 }, config: cfg, trades: [mk('gtl', { n: 'old' }), mk('gtl', { n: 'x', ...SH, status: 'pending' }), mk('gtl', { n: 'y', shadow: true, blockedBy: ['focus'] })], research: [], now: T0 });
  const row = (n) => md.split('\n').find((l) => l.startsWith('| ' + n + ' |'));
  for (const n of ['Gold replica', 'Mosha BO', 'Gold H4 trendline', 'Gold momentum pullback', 'NQ New York open run']) assert.match(row(n), /\| shadow \(paper, owner 11 Nov/, n);
  assert.match(row('Gold trend'), /\| live \|/); assert.match(row('Gold daily engulf'), /\| live \|/); assert.match(row('Gold trend fast'), /\| shadow \|/);
  assert.match(row('Gold H4 trendline'), /1 open, 1 pending \|$/, 'its own stream: the live trade from before and the owner-shadow one');
  const before = goldSystemsSection({ snapshot: { goldVol: 1 }, config: CONFIG(), trades: [], research: [], now: T0 });
  assert.match(before.split('\n').find((l) => l.startsWith('| Gold H4 trendline |')), /\| live \|/, 'without the rule in the config nothing is called a shadow');
});

// ─── 2. overnight financing ───
test('financing: the rate, the rollover count and the formula are the study\'s (research/edge/trend-breadth Part A)', () => {
  assert.equal(FIN.xau.long, STUDY.FIN_GOLD); assert.equal(FIN.xau.long, 0.000148); assert.equal(FIN.xau.short, 0, 'a short is credited nothing');
  assert.equal(FIN.xau.asOf, '2026-11-11'); assert.match(FIN.xau.src, /swap\.long -5\.903 pips.*trend-breadth/);
  assert.deepEqual(Object.keys(FIN), ['xau'], 'only the market whose rate was measured');
  // 5.903 pips of 0.1 near 3,987 = the rate; about 5.3 % a year
  assert.ok(Math.abs(5.903 * 0.1 / 3987 - FIN.xau.long) < 2e-7); assert.ok(Math.abs(FIN.xau.long * 365 - 0.054) < 0.001);
  // the rollover counter is the study's, on 3,000 pseudo-random holds
  let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 3000; i++) { const t = ts('2015-01-01T00:00:00Z') + Math.floor(rnd() * 3.7e8), c = t + Math.floor(rnd() * 40 * 86400); assert.equal(nights(t, c), studyNights(t, c)); }
  // by hand: Monday 21:00 to Tuesday 23:00 UTC = two rollovers; through a Wednesday = three for that night; a weekend = none
  assert.equal(nights(ts('2026-11-09T21:00:00Z'), ts('2026-11-10T23:00:00Z')), 2);
  assert.equal(nights(ts('2026-11-11T21:00:00Z'), ts('2026-11-11T23:00:00Z')), 3, 'Wednesday counts three');
  assert.equal(nights(ts('2026-11-13T22:30:00Z'), ts('2026-11-15T23:00:00Z')), 0, 'Friday after the rollover to Sunday night');
  assert.equal(nights(ts('2026-11-10T10:00:00Z'), ts('2026-11-10T21:59:00Z')), 0, 'out before the rollover: nothing');
  assert.equal(nights(ts('2026-11-10T22:00:00Z'), ts('2026-11-10T23:00:00Z')), 0, 'opened at the rollover itself: not charged for it');
  assert.equal(nights(NaN, 5), 0);
  // the formula: nights x rate x entry / initial risk
  const t = { market: 'xau', side: 'buy', entry: 4000, stop: 3960, r0: 40, filled: ts('2026-11-09T21:00:00Z'), closed: ts('2026-11-10T23:00:00Z') };
  assert.deepEqual(financing(t), { finR: 2 * 0.000148 * 4000 / 40, nights: 2 });
  assert.equal(financing({ ...t, side: 'sell', stop: 4040 }).finR, 0); assert.equal(financing({ ...t, market: 'eurusd' }).finR, 0); assert.equal(financing({ ...t, market: 'btc' }).finR, 0);
  assert.equal(financing({ ...t, closed: undefined }).finR, 0, 'an open trade has no financing figure yet');
});

test('financing reproduces Part A of the study\'s result.json from the same position records', () => {
  const G = JSON.parse(rd('research/edge/gold-systems-oos/result.json')), A = JSON.parse(rd('research/edge/trend-breadth/result.json')).partA, GOLD = JSON.parse(rd('research/edge/honest-book/gold-1d.json')).bars;
  const sec = (x) => Date.parse(x + ':00Z') / 1000, px = (t) => { let lo = 0, hi = GOLD.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (GOLD[m][0] <= t) lo = m; else hi = m - 1; } return GOLD[lo][1]; };
  const W = { untouched: [ts('2006-07-01T00:00:00Z'), ts('2018-01-01T00:00:00Z')], '2018-01': [ts('2018-01-01T00:00:00Z'), ts('2026-11-01T00:00:00Z')], '2020-01': [ts('2020-01-01T00:00:00Z'), ts('2026-11-01T00:00:00Z')] };
  let rows = 0;
  for (const a of A) {
    const [from, to] = W[Object.keys(W).find((k) => a.window.startsWith(k))];
    const P = G.positions.filter((p) => p.sys === a.sys && sec(p.t) >= from && sec(p.t) < to);
    const f = P.map((p) => ({ n: p.n, ...financing({ market: 'xau', side: 'buy', entry: px(sec(p.t)), r0: p.r0, filled: sec(p.t), closed: sec(p.c) }) }));
    const mean = (v) => v.reduce((q, x) => q + x, 0) / v.length;
    assert.equal(P.length, a.n, `${a.sys} ${a.window}: n`);
    assert.ok(Math.abs(mean(f.map((x) => x.nights)) - a.nights) < 0.0006, `${a.sys} ${a.window}: nights`);
    assert.ok(Math.abs(mean(f.map((x) => x.finR)) - a.fin) < 0.0006, `${a.sys} ${a.window}: financing R ${mean(f.map((x) => x.finR))} vs ${a.fin}`);
    assert.ok(Math.abs(mean(f.map((x) => x.n - x.finR)) - a.afterF1) < 0.0006, `${a.sys} ${a.window}: after financing`);
    rows++;
  }
  assert.equal(rows, 12, 'four systems, three windows');
  const u = (k) => A.find((r) => r.sys === k && r.window.startsWith('untouched'));
  assert.deepEqual([u('gtrend').afterF1, u('geg').afterF1, u('gtl').afterF1, u('gtrend5').afterF1], [0.398, 0.141, 0.013, 0.289], 'the figures the review gave the owner');
});

test('the paper cost of a closed trade includes its financing, from the first close after the rule; a cost already recorded is never redone', () => {
  const M = { xau: { group: 'Metals', spot: true }, eurusd: { group: 'Forex' } };
  const held = { id: 'h', market: 'xau', side: 'buy', entry: 4000, stop: 3960, r0: 40, opened: ts('2026-11-09T12:00:00Z'), filled: ts('2026-11-09T12:00:00Z'), closed: ts('2026-11-13T12:00:00Z'), status: 'win', R: 2, entryMode: 'market', exit: 'trail' };
  const intraday = { ...held, id: 'i', closed: ts('2026-11-09T20:00:00Z') };
  const nn = nights(held.filled, held.closed); assert.equal(nn, 6, 'Mon, Tue, Wed x3, Thu');
  const c = tradeCost(held, M.xau), c0 = tradeCost(intraday, M.xau);
  assert.equal(c0.finR, 0); assert.equal(c0.nights, 0);
  assert.ok(Math.abs(c.costR - (c0.costR + 6 * 0.000148 * 4000 / 40)) < 1e-12, 'spread and slippage as before, plus the financing');
  assert.ok(Math.abs(c.finR - 0.0888) < 1e-9);
  // annotateCosts stamps it once
  const old = { ...held, id: 'old', costR: 0.011, costSrc: 'default', Rnet: 1.99 }, sell = { ...held, id: 's', side: 'sell', stop: 4040, R: -1, status: 'loss' }, fx = { ...held, id: 'f', market: 'eurusd', entry: 1.1, stop: 1.098, r0: 0.002 };
  const sized = { ...held, id: 'z', size: 1.5, rawR: 2, R: 3 }, open = { ...held, id: 'o', status: 'open', R: null, closed: undefined, costR: 9, finR: 9, nights: 9 };
  const T = annotateCosts([structuredClone(held), structuredClone(intraday), old, sell, fx, sized, open], M);
  const by = Object.fromEntries(T.map((t) => [t.id, t]));
  assert.deepEqual([by.h.finR, by.h.nights], [0.089, 6]); assert.equal(by.h.costR, +c.costR.toFixed(3)); assert.equal(by.h.Rnet, +(2 - by.h.costR).toFixed(2));
  assert.ok(!('finR' in by.i) && !('nights' in by.i), 'no financing fields on a trade that paid none');
  assert.deepEqual([by.old.costR, by.old.Rnet, by.old.finR], [0.011, 1.99, undefined], 'a trade closed and costed before the rule keeps its recorded cost');
  assert.ok(!('finR' in by.s) && !('finR' in by.f), 'no financing on a gold sell or on another market');
  assert.equal(by.z.Rnet, +(3 - by.z.costR * 1.5).toFixed(2), 'per unit, times the size, like the rest of the cost');
  assert.ok(!('costR' in by.o) && !('finR' in by.o) && !('nights' in by.o), 'an open trade carries no cost fields');
  // what reads the cost reads the financing with it: the digest's net R and the snapshot's cost summary
  assert.equal(merNet(by.h), by.h.Rnet);
  const S = costSummary(T, M); assert.ok(Math.abs(S.live.all.fin - (0.089 + 0.089 * 1.5)) < 0.011); assert.ok(S.live.all.Rnet < S.live.all.R);
  // no stop, target or R of any trade is touched by the cost model
  assert.deepEqual([by.h.stop, by.h.R, by.h.entry], [3960, 2, 4000]);
  assert.ok(TRADER.includes('snapshot.costs = { model, ...costSummary(trades, MARKETS), financing: { from: config.financingFrom || null,'));
});

// ─── the page, the guest files and the docs agree ───
test('the page: the system lists a guest is cut by are unchanged (history stays main, by its own shadow flag), and the scoreboard calls the five shadows', () => {
  // 'mcycle' (owner, 11 Nov: the Mosha cycle trades with the main system) joined the list after this test was written
  assert.ok(PAGE.includes("const SYS_K = ['replica', 'mosha-bo', 'mcycle', 'trend', 'gtrend', 'gtrend5', 'gtl', 'geg', 'gmp'];"));
  assert.ok(PAGE.includes("const NQ_SYS = ['nyflip'], nqSys = (x) => x.market !== 'nq' || NQ_SYS.includes(x.session);"));
  // every "main" reader takes a row only when it is not a shadow: a trade the five systems take after the rule is out by its own flag
  assert.ok(PAGE.includes("trades: (v) => Array.isArray(v) ? v.filter((x) => x && !x.shadow && SYS_K.includes(x.k)).map(guestRow) : v,"));
  assert.ok(PAGE.includes("research: (v) => Array.isArray(v) ? v.filter((x) => x && !x.shadow && x.k === 'nq-open' && nqSys(x)).map(guestRow) : v,"));
  assert.ok(PAGE.includes("const sysClosed = () => { const ok = (x) => !x.shadow && ['win', 'loss', 'be'].includes(x.status) && x.closed && x.R != null;"));
  assert.ok(PAGE.includes("var nqLive = function (x) { return x.k === 'nq-open' && !x.shadow && !/-x$/.test(x.session || ''); };"));
  const cut = rd('api/_guestcut.js'); assert.ok(/!x\.shadow/.test(cut), 'the server\'s guest cut drops shadow rows too');
  // the scoreboard
  const W = {}; vm.runInNewContext(PAGE.match(/<script id="ms-sb-js">([\s\S]*?)<\/script>/)[1], { window: W });
  const at = ts('2026-11-12T09:00:00Z'), cfg = { replicaLive: ['xau'], moshaBo: true, goldTrend: {}, goldEG: {}, goldTL: {}, goldMP: {}, ownerShadow: Object.fromEntries(SHADOWED.map((k) => [k, at])) };
  const cl = (k, i, o = {}) => ({ id: k + i, k, name: k, market: 'xau', side: 'buy', status: 'win', R: 1, closed: at - i * 3600, opened: at - i * 3600 - 60, ...o });
  const trades = ['replica', 'gtl', 'gtrend', 'geg'].flatMap((k) => [cl(k, 1), cl(k, 2)]).concat([cl('gtl', 3, SH)]);
  const rows = W.MS_SB.build({ trades, config: cfg, now: at + 100 }), st = (k, sk) => rows.find((r) => r.id === `mer-${k}-${sk}`);
  assert.equal(st('gtrend', 'live').status, 'live'); assert.equal(st('geg', 'live').status, 'live');
  for (const k of ['replica', 'gtl']) { assert.equal(st(k, 'live').status, 'shadow'); assert.match(st(k, 'live').statusWhy, /paper shadow by the owner since 2026-11-12.*earlier live trades stay in its record/); assert.match(st(k, 'live').ask.text, /moved it to shadow/); }
  assert.equal(st('gtl', 'live').pts.length, 2, 'its live trades from before are still its live-book row'); assert.equal(st('gtl', 'shadow').pts.length, 1, 'the trade after the rule is in its shadow-book row');
  const none = W.MS_SB.build({ trades, config: { ...cfg, ownerShadow: undefined }, now: at + 100 });
  assert.equal(none.find((r) => r.id === 'mer-gtl-live').status, 'live', 'without the rule in the config the page changes nothing');
  // the Systems pane says which systems are live, since when, and that financing is in the costs
  const card = PAGE.slice(PAGE.indexOf('id="ms-sys-book"'), PAGE.indexOf('id="ms-edge"'));
  assert.match(card, /Which systems trade live · since 11 Nov 2026/); assert.match(card, /<b>Live on paper:<\/b> Gold trend \(20-day breakout\), Gold daily engulf and, since 11 Nov by your choice, the Mosha cycle \(not a tested edge/);   // 12 Nov: the Mosha cycle named (owner's choice of 11 Nov)
  for (const n of ['Gold replica', 'Gold momentum pullback', 'NQ New York open run', 'Gold H4 trendline', 'Mosha BO']) assert.ok(card.includes(n), n);
  assert.match(card, /stays in the main record as the live trade it was/); assert.match(card, /none reaches t 2 after costs/);
  assert.match(card, /Costs now include overnight financing<\/b> on gold buys: 0\.0148% of the price/); assert.match(card, /trades closed before keep the cost they were recorded with/);
  assert.ok(PAGE.includes('<div class="card adm" id="ms-sys-book">'), 'owner and reviewers only (class adm): a rule description is never public');
  assert.ok(PAGE.includes('NQ New York open run · paper shadow since 11 Nov (our system before)')); assert.ok(PAGE.includes('Gold replica · paper shadow since 11 Nov · trades only when gold is volatile'));
  assert.match(PAGE, /id="ms-expect-foot">[^<]*<span id="ms-expect-fin">since 11 Nov 2026 also after overnight financing on gold buys/);
});

test('the owner\'s decisions are on record: three approved with the owner\'s words, two open, numbers never reused', () => {
  const doc = rd('docs/owner-decisions.md'), heads = [...doc.matchAll(/^### \[(.)\] (\d+)\. (.*)$/gm)], nums = heads.map((m) => +m[2]);
  // a number taken by an item written on another branch may be reserved in the file with <!-- reserved item N: … --> until
  // that branch merges; it is still never reused, and nothing is renumbered once on main.
  const reserved = [...doc.matchAll(/<!-- reserved item (\d+):/g)].map((m) => +m[1]), all = [...new Set(nums.concat(reserved))];
  assert.equal(new Set(nums).size, nums.length, 'no number twice');
  assert.deepEqual(all.sort((a, b) => a - b), all.map((_, i) => i + 1), 'every number 1..n once: none renumbered, none reused');
  assert.deepEqual(nums.slice(36, 41), [37, 38, 39, 40, 41], 'the five items of the edge review follow item 36 in order (later items are added after them: 42, the book study)');
  const item = (n) => { const a = doc.indexOf(`\n### [`, doc.search(new RegExp(`^### \\[.\\] ${n}\\. `, 'm')) - 1), b = doc.indexOf('\n### [', a + 5); return doc.slice(a, b < 0 ? undefined : b); };
  const five = [37, 38, 39, 40, 41].map(item), box = (n) => heads.find((m) => +m[2] === n)[1];
  for (const t of five.slice(0, 3)) { assert.match(t, /\*\*Status \(11 Nov 2026\): approved\.\*\*/); assert.match(t, /"yes anything that is better for the system and that applies it"/); }
  assert.deepEqual([37, 38, 39, 40, 41, 33].map(box), ['x', 'x', 'x', ' ', '~', ' ']);   // 41 answered on 12 Nov 2026; the account reset is the owner's
  assert.match(five[0], /Gold trend.*Gold daily engulf/s); assert.match(five[0], /keeps running as a live trade to its own exit, with its\s+stop/); assert.match(five[1], /financing/i); assert.match(five[1], /History is not rewritten/);
  assert.match(five[2], /forex and crypto/); assert.match(five[2], /200 trades/); assert.match(five[2], /Off-switch/); assert.match(five[2], /does \*\*not\*\* switch back by itself/);
  assert.match(five[3], /Mosha BO/); assert.match(five[3], /item 33/); assert.match(five[3], /\*\*Status \(11 Nov 2026\): open\*\*/);
  assert.match(five[4], /10-lot gold buy/); assert.match(five[4], /13:37 UTC/); assert.match(five[4], /4,427/); assert.match(five[4], /\*\*Status \(12 Nov 2026\): answered; the reset is yours to do\.\*\*/); assert.match(five[4], /"Yes to all": you placed the 10-lot buy yourself/); assert.match(five[4], /Nothing in this repository resets a demo balance/);
  assert.match(item(33), /see item 40/);
  const mx = rd('MERIDIAN-X.md'); assert.match(mx, /Gold trend/); assert.match(mx, /paper shadow/i); assert.match(mx, /11 Nov/); assert.match(mx, /financing/i);
});

test('nothing here touches the ICT edge, a live account or a stop', () => {
  for (const f of ['ict/tracker.mjs', 'ict/replay.mjs', 'ict/calendar.mjs']) assert.ok(!/ownerShadow|owner-shadow|financing\(|supported-book/.test(rd(f)), f);
  const fills = rd('council/fills.mjs'), fin = fills.slice(fills.indexOf('export const FIN ='), fills.indexOf('export const SLIP_SPREADS'));
  assert.ok(!/\.stop\s*=|\.t1\s*=|\.status\s*=/.test(fin), 'the financing and stream helpers write no trade level or state');
  assert.ok(!/fetch\(|process\.env|import /.test(fin), 'pure: no network, no environment, no import');
  const mirror = rd('council/ctrader-mirror.mjs'); assert.match(mirror, /DEMO ONLY/); assert.match(mirror, /isLive:false/);
});
