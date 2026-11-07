// node --test tests/param-pins.test.mjs — pins the live parameters of every live system to the values the out-of-sample studies
// tested (research/edge/param-drift/RESULT.md: #512 replica, #530 gold systems, #511 NQ open run, #526 ICT). A failing pin means a
// live rule or a study harness moved: move the pin in the same PR and say in that study's RESULT.md that it no longer covers the
// live rule (or re-run it). council/trader.mjs is a script (it trades on import), so its constants are read from the source text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { P, MIN_GRADE, RISK_FLOOR, RISK_CAP, RISK_TIGHT, TIGHT_SIZE, DOL_ROOM, ROOM_SIZE, MARKETS } from '../ict/tracker.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const trader = read('../council/trader.mjs'), tracker = read('../ict/tracker.mjs'), ictReplay = read('../ict/replay.mjs'), page = read('../market-structure.html');
const has = (src, s, what) => assert.ok(src.includes(s), `${what || 'pin'} not found: ${s}`);
const ruleAt = (id) => { const i = trader.indexOf(`{ id: '${id}'`); assert.ok(i >= 0, `USER_RULES has no ${id}`); return i; };
const rule = (id, apply) => has(trader, `{ id: '${id}', apply: (c) => { ${apply} }`, `USER_RULES ${id}`);

test('gold replica: the live rule chain and code path are what #512 tested', () => {
  rule('gold-top-be', 'c.goldVolMin = null; c.goldVolPct = 80; c.goldBeR = 2;');
  rule('gold-add', 'c.goldAdd = { atR: 2, size: 1 }; c.goldRun = { atR: 4, trail: 1 };');
  rule('gold-add-1.5', 'c.goldAdd = { atR: 1.5, size: 1 };');
  rule('gold-d1-with', 'c.goldD1With = true;');
  rule('gold-no-eg', 'c.goldEgBarrier = false;');
  rule('gold-news-veto', 'c.goldNewsVeto = [[505, 525]];');
  rule('replica-msnr-size', 'c.replicaMsnrSize = { against: 1.5, with: 0.5 };');
  rule('gold-4r', 'c.goldFixedR = 4;');   // dead knob: goldRun overrides it (RESULT.md item 6); pinned so a removal is a conscious change
  // the chain applies in array order on a fresh config: the later rule must come later
  assert.ok(ruleAt('gold-add') < ruleAt('gold-add-1.5')); assert.ok(ruleAt('gold-vol-gate') < ruleAt('gold-top-be'));
  assert.ok(ruleAt('gold-adaptive-gate') < ruleAt('gold-top-be')); assert.ok(ruleAt('gold-eg-barrier') < ruleAt('gold-no-eg'));
  assert.ok(ruleAt('gold-shadow') < ruleAt('gold-vol-gate') && ruleAt('pairs-live') < ruleAt('pairs-best'), 'replicaLive ends as [xau]');
  // code path
  has(trader, "const entry = price, buf = key === 'xau' ? Math.max(0.1 * g.atr, 0.3) : 0.1 * g.atr", 'stop floor 0.30');
  has(trader, 'if (Math.abs(stop0 - rn) <= 2) stop = g.sell ? rn + 0.5 : rn - 0.5;', 'round-number stop');
  has(trader, 'pass = (h1clear || g.star) && riskAtr >= 1', 'v4 filter');
  has(trader, "v5 = pass && h4 === 'against'", 'v5 = against the H4 trend');
  has(trader, 'const lag = now - g.tc - 300, stale = lag > 480;', '8-minute stale rule');
  has(trader, "x.status === 'open' && !x.addOf).length >= 3;", '3-open cap');
  has(trader, 'dayStop = dayR <= -1.5;', 'daily stop');
  has(trader, 'if (hist.length > 50) {', 'equity filter'); has(trader, 'eq.slice(-50)', 'equity filter window');
  has(trader, "const dvb = src['1d'].bars.slice(-21, -1)", '20 closed days');
  has(trader, 'const past = ser.slice(-367, -2).sort((a, b) => a - b);', 'percentile window');
  has(trader, 'const dirOk = !config.goldD1With || d1w || (config.goldEgBarrier && atEG);', 'direction rule');
  has(trader, "maxHold: 48 * 3600, noBe: true, entryMode: 'market', lag, drift,", '48 h, no Coach break-even');
  has(trader, "msnrDir = msnrDirection(src['4h'].bars.slice(0, -1), src['1d'].bars.slice(0, -1));", 'MSNR with the defaults');
  has(trader, 'function msnrDirection(H4, D, n4 = 5, nD = 2)', 'MSNR defaults');
  has(trader, 'src[id].A = msAnalyze(src[id].bars, 6);', 'structure N = 6');
  has(trader, "trail: [config.goldRun.atR, config.goldRun.trail], runAfter: config.goldRun.atR", 'run after +4R');
  // the study's harness carries the same config
  const study = read('../research/edge/replica-oos/replay.mjs');
  has(study, 'const CFG = { volPct: 80, d1With: true, newsVeto: [[505, 525]], msnrSize: { against: 1.5, with: 0.5 }, beR: 2, add: { atR: 1.5 }, run: { atR: 4, trail: 1 }, maxHold: 48 * 3600 };', '#512 CFG');
  has(study, 'const stale = lag > 480;', '#512 stale'); has(study, 'dayStop = dayR <= -1.5;', '#512 day stop');
  has(study, 'ser.slice(-367, -2)', '#512 percentile window'); has(study, 'buf = Math.max(0.1 * g.atr, 0.3)', '#512 stop floor');
});

test('Mosha BO: the live constants are the gold-systems "live" variant (no untouched-data test yet)', () => {
  rule('mosha-bo', 'c.moshaBo = true;'); rule('mosha-bo-weekly', 'c.moshaBoWeekly = true;');
  rule('mosha-add', 'c.moshaBeR = 1.5; c.moshaAdd = { atR: 1.5, size: 1 }; c.moshaRun = { atR: 3, trail: 1 };');
  rule('mosha-slow', 'c.moshaSlow = 12;');
  has(trader, 'const entry = +e3.level.toFixed(2), stop = +(d < 0 ? e3.top + 0.3 : e3.bot - 0.3).toFixed(2), r0 = Math.abs(entry - stop);', 'limit at the M15 level, 0.3 past the Origin');
  has(trader, "if (r0 > 0.5) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'mosha-bo'", 'r0 > 0.5');
  has(trader, "validFor: 24 * 3600, maxHold: 72 * 3600, noBe: true, entryMode: 'limit',", '24 h / 72 h');
  has(trader, "openBo >= 2 && 'cap'", 'cap 2'); has(trader, "pull < config.moshaSlow) && 'momentum'", 'slow rule');
  has(trader, 'const wEv = msAnalyze(wk, 3).events', 'weekly swing 3'); has(trader, 'if (e3 && now - e3.t <= 3600)', 'M15 break within 1 h');
  has(trader, "snapshot.goldW1Src = feed === 'OANDA' ? 'oanda' : 'paxg'", 'weekly fallback labelled by feed');
  const study = read('../research/edge/gold-systems/mosha.mjs');
  has(study, "live: { weekly: true, cap: true, slow: 12, mg: 'live' }", 'gold-systems live variant');
  has(study, 'trail: [3, 1], beAt: 1.5, addAt: 1.5', 'gold-systems live exits');
});

test('gold trend, H4 trendline and daily engulf: the live config is what #530 tested', () => {
  rule('gold-trend', 'c.goldTrend = { n: 20, k: 2 };'); rule('gold-trend-add', 'c.goldTrendAdd = { atR: 1 };');
  rule('gold-h4-trendline', 'c.goldTL = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 };');
  rule('gold-daily-engulf', 'c.goldEG = { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 };');
  rule('gold-trend-fast', 'c.goldTrendFast = { n: 5, k: 2 };'); rule('gold-trend-fast-shadow', 'c.goldTrendFastShadow = true;');
  has(trader, 'const dir = msnrDirection(H, D, TL.n4, 2); state.dir = dir;', 'trendline direction SOP');
  has(trader, "if (r0 > 0 && price > entry) trades.push({ id, market: key, label: M.label, dec: M.dec, k: 'geg'", 'engulf limit only below price');
  has(trader, 'now - (last.time + 86400) < 86400', 'daily signal within 24 h'); has(trader, 'now - (last.time + 14400) < 3600', 'H4 signal within 1 h');
  has(trader, "last.close - open.entry >= config.goldTrendAdd.atR * open.r0", 'trend add at +1R on a daily close');
  assert.equal((trader.match(/trail: \[2, 1\]/g) || []).length, 2, 'gtl and geg trail 1R behind from +2R');
  const study = read('../research/edge/gold-systems-oos/replay.mjs');
  has(study, 'const CFG = { goldTrend: { n: 20, k: 2 }, goldTrendFast: { n: 5, k: 2 }, goldTrendAdd: { atR: 1 },', '#530 CFG');
  has(study, 'goldTL: { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }, goldEG: { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 } };', '#530 CFG');
  has(study, 'LIVE.msnrDirection(L.H, D1.slice(Math.max(0, nd - W), nd), TL.n4, 2)', '#530 SOP'); has(study, 'if (r0 > 0 && price > entry) book.push', '#530 engulf limit');
});

test('NQ New York open run: 0.08% run, 2-point buffer, 15-min reclaim, midnight filter, runner [2, 1], out 11:00 ET (#511)', () => {
  rule('nq-runner', 'c.nqRun = { atR: 2, trail: 1 };');
  has(trader, 'const g = nqOpenSweep(bars, ny.d, 570, 0, 0.0008);', 'live call');
  has(trader, 'function nqOpenSweep(bars, today, o, tFree, minPen = 15) {', 'signature');
  const fn = trader.slice(trader.indexOf('function nqOpenSweep('), trader.indexOf('\ntry {', trader.indexOf('function nqOpenSweep(')));
  has(fn, 'if (minPen < 1) minPen *= O;', 'run as a fraction of the open');
  has(fn, 'if (b.time - v.t > 900 || Math.abs(v.ext - O) < minPen) continue;', '15-min reclaim');
  has(fn, 'stop: v.ext - 2,', 'buy stop 2 points'); has(fn, 'stop: v.ext + 2,', 'sell stop 2 points');
  assert.doesNotMatch(fn, /0\.00011|0\.011|buf\b/, 'the unused 0.011% buffer stays gone');
  has(trader, "NQ_ON.nyflip && !['Sat', 'Sun'].includes(ny.wd) && ny.m > 571 && ny.m < 660", 'signal window');
  has(trader, 'const ndoOk = g && ndoBar && (ndoBar.open - g.entry) * (g.sell ? 1 : -1) > 0;', 'midnight-open filter');
  has(trader, "exitAt: g.t + (660 - g.m) * 60, exitLabel: '11:00 ET'", 'out at 11:00 ET');
  has(trader, 'const sell = !g.sell, r0 = Math.abs(g.entry - g.stop), stop = g.entry + (sell ? r0 : -r0), t1 = g.entry + (sell ? -2 : 2) * r0;', 'flipped, mirrored stop');
  has(trader, 'trail: [config.nqRun.atR, config.nqRun.trail] } : {}), opened: g.t + 60, filled: g.t + 60, checked: g.t + 60', 'runner, fill minute not checked');
  assert.match(trader, /NQ_ON = \{[^}]*nyflip: true/, 'nyflip is the live NQ block');
  const lib = read('../research/edge/nq-open-oos/lib.mjs'), run = read('../research/edge/nq-open-oos/run.mjs');
  has(lib, 'export function nqOpenSweep(D, o = 570, minPen = 0.0008, opt = {}) {', '#511 signature');
  has(lib, 'const buf = opt.bufPct ? 0.00011 * O : 2;', '#511 2-point buffer (0.011% only as a sensitivity)');
  has(lib, 'if (b.time - v.t > 900 || Math.abs(v.ext - O) < minPen) continue;', '#511 reclaim'); has(run, 'const COST = 1;', '#511 cost 1 point');
});

test('ICT A-setups: the tracker exports #526 imported', () => {
  assert.deepEqual(P, { piv: 3, look: 96, vmax: 6, rr: 3, trail: [2, 1.5], mark: 2, holdH: 36, maxAtr: 8, fresh: 3 * 3600, be: 1.5 });
  assert.equal(MIN_GRADE, 3); assert.equal(RISK_FLOOR, 0.3); assert.equal(RISK_CAP, 0.75); assert.equal(RISK_TIGHT, 0.15); assert.equal(TIGHT_SIZE, 0.5);
  assert.equal(DOL_ROOM, 2); assert.deepEqual(ROOM_SIZE, [0.5, 1.5]);
  assert.deepEqual(Object.keys(MARKETS), ['nq', 'es', 'ym', 'rty', 'gc']); assert.equal(MARKETS.gc.aRule, 'gold');
  for (const k of ['nq', 'es', 'ym', 'rty']) assert.equal(MARKETS[k].aRule, undefined, `${k} runs the index rule`);
  has(tracker, "const aBase = (g) => !!g.feat && g.feat.bias === 'against' && g.grade && g.grade.total >= 7 && !nfpMorning(g.close ?? g.signalAt);", 'index A base');
  has(tracker, 'gold: (g) => !!g.feat && g.side > 0 && g.feat.atrR != null && g.feat.atrR >= RISK_FLOOR && g.feat.atrR < RISK_CAP,', 'gold rule');
  has(tracker, "if (trades.some((x) => x.market === key && x.status === 'open' && (!aset || x.aset))) continue;", 'busy rule');
  has(tracker, 'if ((entry - g.stop) * s <= 0 || r0 > 1.6 * g.r0) continue;', 'entry guard 1.6 x r0');
  has(tracker, 'be: M.aRule ? null : P.be', 'break-even on indices only'); has(tracker, 'const e = H[c].close, stop = lo - 2 * tick, r0 = e - stop;', 'stop 2 ticks past the sweep');
  has(ictReplay, 'const beAt = M.aRule ? null : P.be;', 'replay break-even as the tracker'); has(ictReplay, 'const trail = opt.strail ? null : P.trail;', 'replay trail as the tracker');
});

test('the page shows the gate the Trader runs (goldVolP), not the retired 1.5% leg', () => {
  has(page, 'const legs = [sn.goldVolMin, sn.goldVolP].filter((x) => x != null), mn = legs.length ? Math.min(...legs) : null;', 'gate line');
  assert.doesNotMatch(page, /sn\.goldVolMin \|\| 1\.5/, 'retired 1.5% default');
  has(trader, 'snapshot.goldVolP = goldP; snapshot.goldVolPn = past.length;', 'the Trader publishes the percentile gate');
});

// The live council-data config, when that branch is fetched (not in CI): the effective values must equal the pins above.
test('council-data config.json carries the pinned values', (t) => {
  let cfg; try { cfg = JSON.parse(execFileSync('git', ['show', 'origin/council-data:config.json'], { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'ignore'] }).toString()); }
  catch (e) { t.skip('origin/council-data not fetched'); return; }
  assert.deepEqual(cfg.replicaLive, ['xau']); assert.equal(cfg.goldVolMin, null); assert.equal(cfg.goldVolPct, 80); assert.equal(cfg.goldD1With, true); assert.equal(cfg.goldEgBarrier, false);
  assert.equal(cfg.goldBeR, 2); assert.deepEqual(cfg.goldAdd, { atR: 1.5, size: 1 }); assert.deepEqual(cfg.goldRun, { atR: 4, trail: 1 }); assert.deepEqual(cfg.goldNewsVeto, [[505, 525]]);
  assert.deepEqual(cfg.replicaMsnrSize, { against: 1.5, with: 0.5 }); assert.equal(cfg.goldFixedR, 4);
  assert.equal(cfg.moshaBo, true); assert.equal(cfg.moshaBoWeekly, true); assert.equal(cfg.moshaBeR, 1.5); assert.deepEqual(cfg.moshaAdd, { atR: 1.5, size: 1 }); assert.deepEqual(cfg.moshaRun, { atR: 3, trail: 1 }); assert.equal(cfg.moshaSlow, 12);
  assert.deepEqual(cfg.goldTrend, { n: 20, k: 2 }); assert.deepEqual(cfg.goldTrendAdd, { atR: 1 }); assert.deepEqual(cfg.goldTL, { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 });
  assert.deepEqual(cfg.goldEG, { k: 3, life: 20, hold: 240, sma: 20, pad: 0.3, maxOpen: 3 }); assert.deepEqual(cfg.nqRun, { atR: 2, trail: 1 });
  assert.equal(cfg.goldTrendFastShadow, true); assert.equal(cfg.cryptoTrendShadow, true);
  for (const id of ['gold-top-be', 'gold-add-1.5', 'gold-no-eg', 'replica-msnr-size', 'mosha-slow', 'gold-trend-add', 'nq-runner']) assert.ok(cfg.userRules.includes(id), `${id} applied`);
});
