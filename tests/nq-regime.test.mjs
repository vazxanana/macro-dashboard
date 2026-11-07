// node --test tests/nq-regime.test.mjs — regime tags on the NQ New York open run (council/regime.mjs) checked against the regime
// study's own definitions (research/edge/regime-switch: run.mjs `series` for TREND, the trailing-365-day sum for META, its
// end-of-data states in result.json), the trend-on shadow stream's gating, where the shadow may and may not appear (alerts, the
// page's live list, the week report), and the live nyflip rule in council/trader.mjs staying byte for byte what it was. Offline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { REGIME, dailyRows, lastClosed, trendStrength, metaR, trendOn, regimeOf, regimeShadow, fetchDaily, isNyflipClosed } from '../council/regime.mjs';
import { alertable } from '../council/alerts.mjs';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const I = JSON.parse(read('../research/edge/regime-switch/inputs.json')), RES = JSON.parse(read('../research/edge/regime-switch/result.json'));
const trader = read('../council/trader.mjs'), page = read('../market-structure.html');
const DAY = 86400, YEAR = 365 * DAY, utc = (s) => Date.parse(s + 'T00:00:00Z') / 1000, r3 = (x) => +x.toFixed(3);
const NQ = I.d1.nq, TR = I.systems.nqopen.map(([entry, exit, net, net2, market]) => ({ entry, exit, net, net2, market }));

// ── the study's own code (research/edge/regime-switch/run.mjs), copied verbatim: daily closes -> 6-month trend strength ──
function studySeries(rows) {
  const t = rows.map((r) => r[0]), c = rows.map((r) => r[1]), n = c.length, ret = [NaN];
  for (let i = 1; i < n; i++) ret.push(Math.log(c[i] / c[i - 1]));
  const sd = (a, b) => { let s = 0, q = 0; for (let k = a; k <= b; k++) { s += ret[k]; q += ret[k] ** 2; } const m = s / (b - a + 1); return Math.sqrt((q - (b - a + 1) * m * m) / (b - a)); };
  const ts = new Array(n).fill(null);
  for (let i = 0; i < n; i++) if (i >= 126) ts[i] = Math.log(c[i] / c[i - 126]) / (sd(i - 125, i) * Math.sqrt(126));
  return { t, ts };
}
const studyLastClosed = (S, T) => { let lo = 0, hi = S.t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (S.t[m] + DAY <= T) lo = m + 1; else hi = m; } return lo - 1; };
const studyMeta = (all, x) => all.filter((y) => y.market === x.market && y.exit < x.entry && y.exit >= x.entry - YEAR).reduce((p, y) => p + y.net, 0);

test('TREND: |TS| at entry equals the study series() for every NQ open run trade of 2004-26 (1,869 trades); null inside the 126-day warm-up', () => {
  const S = studySeries(NQ); let n = 0;
  for (const x of TR) {
    const i = studyLastClosed(S, x.entry), want = S.ts[i], got = trendStrength(NQ, x.entry);
    assert.ok(want != null && got, 'the NQ daily data starts a year before the first trade');
    assert.ok(Math.abs(got.abs - Math.abs(want)) < 1e-12, `${x.entry}: ${got.abs} vs ${Math.abs(want)}`);
    assert.ok(Math.abs(got.ts - want) < 1e-12); assert.equal(got.asOf, new Date(S.t[i] * 1000).toISOString().slice(0, 10)); n++;
  }
  assert.equal(n, TR.length); assert.equal(n, 1869);
  // the study's series() has no reading before index 126: neither does the trader
  const S2 = studySeries(NQ.slice(0, 200));
  assert.equal(S2.ts[125], null); assert.equal(trendStrength(NQ.slice(0, 200), NQ[125][0] + DAY), null);
  assert.ok(S2.ts[126] != null); assert.ok(Math.abs(trendStrength(NQ.slice(0, 200), NQ[126][0] + DAY).ts - S2.ts[126]) < 1e-12);
});

test('TREND and META reproduce the study\'s end-of-data state: |TS| 0.25 OFF, META +30.32 ON on 3 Nov 2026', () => {
  const now = RES.systems.nqopen.now.nq, T = utc('2026-11-04');   // the study's `to` for nqopen
  const t = trendStrength(NQ, T);
  assert.equal(t.asOf, now.asOf); assert.equal(+t.abs.toFixed(2), now.TREND.value); assert.equal(trendOn(t.abs), now.TREND.on);
  const recs = TR.map((x, i) => ({ id: 's' + i, k: 'nq-open', session: 'nyflip', status: x.net > 0 ? 'win' : x.net < 0 ? 'loss' : 'be', closed: x.exit, R: x.net }));
  const m = metaR(recs, T);
  assert.equal(+m.R.toFixed(2), now.META.value); assert.equal(m.R >= 0, now.META.on);
  assert.equal(RES.systems.nqopen.indicators.TREND.rule.cut, REGIME.trendMin, 'the frozen cut is the study\'s');
  assert.equal(RES.systems.nqopen.indicators.TREND.rule.dir, '>=');
});

test('META: the trailing 365-day net R of the stream\'s trades closed before the entry, as the study sums it', () => {
  const recs = TR.map((x, i) => ({ id: 's' + i, k: 'nq-open', session: 'nyflip', status: x.net > 0 ? 'win' : x.net < 0 ? 'loss' : 'be', closed: x.exit, R: x.net }));
  for (const x of TR.slice(-120)) assert.equal(metaR(recs, x.entry).R, r3(studyMeta(TR, x)), `entry ${x.entry}`);
  // Rnet (cost-adjusted) when a record carries it, raw R otherwise; other streams, open, void, shadow and skipped records never count
  const T = 1_800_000_000, base = { k: 'nq-open', session: 'nyflip', status: 'win', closed: T - DAY };
  assert.deepEqual(metaR([{ ...base, R: 2, Rnet: 1.8 }, { ...base, R: 1 }], T), { R: 2.8, n: 2 });
  assert.deepEqual(metaR([{ ...base, R: 2, closed: T }, { ...base, R: 2, closed: T - YEAR - 1 }, { ...base, R: 2, closed: T - YEAR }], T), { R: 2, n: 1 }, 'closed < T and >= T - 365 d');
  for (const bad of [{ session: 'nyflip-x' }, { session: 'nyflip-trend', shadow: true }, { k: 'gold-nyrun' }, { status: 'open', closed: undefined }, { void: true }, { R: null }])
    assert.equal(isNyflipClosed({ ...base, R: 2, ...bad }), false, JSON.stringify(bad));
});

test('causality and cleaning: forming and weekend candles are dropped; a candle closed less than 24 h before entry is not seen', () => {
  const mon = utc('2026-11-02'), rows = dailyRows([
    { time: utc('2026-10-31'), close: 1 }, { time: utc('2026-11-01'), close: 2 },   // Saturday, Sunday: OANDA's stub
    { time: mon, close: 3 }, { time: mon + DAY, close: 4 }, { time: mon + DAY, close: 4.5 }, { time: mon + 2 * DAY, close: 5, live: true }, { time: 'x', close: 6 }]);
  assert.deepEqual(rows, [[mon, 3], [mon + DAY, 4.5]], 'weekday starts, closed, one per start (the later copy wins)');
  assert.equal(lastClosed(rows, mon + DAY + 3600), 0, 'Tuesday has not closed at 01:00 Tuesday');
  assert.equal(lastClosed(rows, mon + 2 * DAY), 1); assert.equal(lastClosed(rows, mon), -1);
  assert.equal(trendStrength(rows, mon + 3 * DAY), null, 'fewer than 127 closes');
  // a flat series has no volatility: no reading rather than a division by zero
  const flat = []; for (let i = 0; i < 200; i++) flat.push([mon + i * DAY, 100]);
  assert.equal(trendStrength(flat, mon + 300 * DAY), null);
});

test('the switch: |TS| >= 0.295 is ON (inclusive), below or unknown is OFF', () => {
  assert.equal(trendOn(0.295), true); assert.equal(trendOn(0.2949), false); assert.equal(trendOn(null), false); assert.equal(trendOn(NaN), false);
  assert.equal(trendOn(0.5, 0.6), false);
});

// a live record as the trader pushes it (research.json, session nyflip)
const LIVE = { id: 'nq-nyflip-2026-11-09', market: 'nq', label: 'NQ', dec: 2, k: 'nq-open', session: 'nyflip', name: 'NQ New York open run', day: '2026-11-09', side: 'sell',
  entry: 25000, stop: 25020, t1: 24800, rr: 10, tp1: 24960, trail: [2, 1], opened: 1_800_000_060, filled: 1_800_000_060, checked: 1_800_000_060, status: 'open', R: null, exitAt: 1_800_005_400, exitLabel: '11:00 ET',
  seenAt: 1_800_000_300, entrySeen: 24990, level: 'OPEN', levelPrice: 25010, ext: 25030, ndo: 24900, note: 'Research (paper only): ...' };
const CFG = { trendMin: 0.295 };

test('regimeOf: the tag carries TREND, META and the switch; without daily data the trend is unknown and the switch OFF', () => {
  const T = LIVE.opened, rows = []; for (let i = 0; i < 300; i++) { const t = T - (300 - i) * DAY; if (![0, 6].includes(new Date(t * 1000).getUTCDay())) rows.push([t, 100 * Math.exp(0.004 * i)]); }
  const closed = [{ k: 'nq-open', session: 'nyflip', status: 'win', closed: T - 5 * DAY, R: 2 }, { k: 'nq-open', session: 'nyflip', status: 'loss', closed: T - 9 * DAY, R: -1, Rnet: -1.05 }];
  const rg = regimeOf(rows, closed, T, CFG);
  assert.ok(rg.trend > 0.295 && rg.on === true, 'a steady rise is a strong trend'); assert.equal(rg.ts, rg.trend); assert.equal(rg.cut, 0.295);
  assert.deepEqual([rg.meta, rg.metaN], [0.95, 2]); assert.match(rg.trendAsOf, /^\d{4}-\d{2}-\d{2}$/);
  const down = regimeOf(rows.map(([t, c]) => [t, 1 / c]), closed, T, CFG); assert.equal(down.on, true); assert.ok(down.ts < 0 && down.trend === -down.ts, '|TS|: two-sided');
  const none = regimeOf(null, closed, T, CFG);
  assert.deepEqual(none, { trend: null, ts: null, trendAsOf: null, meta: 0.95, metaN: 2, on: false, cut: 0.295 });
  assert.equal(regimeOf(rows, [], T, undefined).cut, REGIME.trendMin, 'no config: the study\'s cut');
});

test('regimeShadow: a paper copy of the live trade only when the trend is on; same entry, stop, target, runner and exit', () => {
  const on = regimeShadow(LIVE, { trend: 0.295, ts: -0.295, trendAsOf: '2026-11-06', meta: 3, metaN: 4, on: true, cut: 0.295 }, CFG);
  assert.ok(on, 'taken at the cut');
  assert.equal(on.id, 'nq-nyflipt-2026-11-09'); assert.equal(on.session, 'nyflip-trend'); assert.equal(on.shadow, true); assert.deepEqual(on.blockedBy, ['regime-shadow']);
  assert.equal(on.of, LIVE.id); assert.equal(on.k, 'nq-open'); assert.equal(on.market, 'nq'); assert.equal(on.status, 'open');
  for (const f of ['side', 'entry', 'stop', 't1', 'rr', 'tp1', 'trail', 'opened', 'filled', 'checked', 'exitAt', 'exitLabel', 'day', 'levelPrice', 'ext', 'ndo']) assert.deepEqual(on[f], LIVE[f], f);
  assert.notEqual(on.trail, LIVE.trail, 'its own arrays: the manage loop mutates records');
  assert.match(on.note, /^Shadow \(paper, regime-shadow\)/); assert.match(on.note, /0\.295/);
  assert.equal(regimeShadow(LIVE, { trend: 0.294, on: false, cut: 0.295 }, CFG), null, 'below the cut: no shadow');
  assert.equal(regimeShadow(LIVE, { trend: null, on: false, cut: 0.295 }, CFG), null, 'unknown trend: no shadow (the study excluded warm-up trades)');
  assert.equal(regimeShadow(LIVE, { trend: 0.9, on: true, cut: 0.295 }, undefined), null, 'no owner rule: no shadow');
  assert.equal(regimeShadow(LIVE, { trend: 0.4, on: true, cut: 0.295 }, { trendMin: 0.5 }), null, 'the config cut rules');
  assert.equal(LIVE.shadow, undefined, 'the live record is untouched'); assert.equal(LIVE.session, 'nyflip');
});

test('fetchDaily: OANDA answers only, enough closed weekday candles, null on any failure', async () => {
  const T = utc('2026-11-06'), bars = []; for (let i = 0; i < 400; i++) bars.push({ time: T - (400 - i) * DAY, open: 1, high: 1, low: 1, close: 100 + i });
  const ok = async () => ({ ok: true, json: async () => ({ src: 'OANDA', bars }) });
  const rows = await fetchDaily('https://x/md/', ok);
  assert.ok(rows.length > 126 && rows.length < 400, 'weekend starts dropped'); assert.ok(rows.every(([t]) => ![0, 6].includes(new Date(t * 1000).getUTCDay())));
  let url = ''; await fetchDaily('https://x/md/', async (u) => { url = u; return ok(); }); assert.equal(url, 'https://x/md/bars?sym=nas100&tf=1d&n=400');
  assert.equal(await fetchDaily('https://x/md/', async () => ({ ok: true, json: async () => ({ src: 'Kraken', bars }) })), null, 'not OANDA');
  assert.equal(await fetchDaily('https://x/md/', async () => ({ ok: true, json: async () => ({ src: 'OANDA', bars: bars.slice(0, 50) }) })), null, 'too short');
  assert.equal(await fetchDaily('https://x/md/', async () => ({ ok: false })), null); assert.equal(await fetchDaily('https://x/md/', async () => { throw new Error('net'); }), null);
});

test('the live nyflip rule in council/trader.mjs is byte for byte what it was before the tags (sha256 pin of the signal-to-push block)', () => {
  const a = trader.indexOf('      if (g && ndoOk) {\n'), end = 'out at 11:00 ET.` });\n', b = trader.indexOf(end, a) + end.length;
  assert.ok(a > 0 && b > a, 'the live block');
  const seg = trader.slice(a, b);
  assert.equal(crypto.createHash('sha256').update(seg).digest('hex'), '2da5590676fdf9021daa14e48fd3802f5c5a7ef9c6bf82a56fb58a0826c6a4f4', 'the live push changed: that is a rule change, not a tag');
  assert.ok(seg.includes('research.push({ id: `nq-nyflip-${ny.d}`'), 'the block is the live push'); assert.equal((seg.match(/research\.push/g) || []).length, 1);
  assert.ok(trader.includes('const g = nqOpenSweep(bars, ny.d, 570, 0, 0.0008);'), 'signal call'); assert.ok(trader.includes('const ndoOk = g && ndoBar && (ndoBar.open - g.entry) * (g.sell ? 1 : -1) > 0;'), 'midnight filter');
  // the tags come after the push, inside the same block, and only add fields / a second record
  const tail = trader.slice(b, trader.indexOf('\n      }\n', b));
  assert.ok(tail.includes('const live = research.find((x) => x.id === `nq-nyflip-${ny.d}`), rows = await regimeDaily(MD_BASE);'), 'tag source');
  assert.ok(tail.includes('live.regime = regimeOf(rows, research, live.opened, config.nqRegimeShadow);'), 'the tag is a field on the live record');
  assert.ok(tail.includes('const sh = regimeShadow(live, live.regime, config.nqRegimeShadow); if (sh) research.push(sh);'), 'the shadow is a second record');
  assert.ok(/^\s*(\/\/.*|try \{|\} catch \(e\) \{ snapshot\.errors\.nqRegime = String\(e\.message \|\| e\); \}|const live = .*|live\.regime = .*|if \(!rows\) snapshot\.errors\.nqRegime = .*|const sh = .*)$/m.test(tail) && !/\b(live|research\[\d\])\.(entry|stop|t1|rr|tp1|trail|side|exitAt|status|opened) *=/.test(tail), 'nothing in the tag block writes a trade field');
  assert.ok(trader.includes("{ id: 'nq-regime-shadow', apply: (c) => { c.nqRegimeShadow = { trendMin: 0.295 }; }"), 'owner rule with the frozen cut');
  assert.ok(trader.includes("const ny = nyParts(now), openNq = research.filter((x) => x.k === 'nq-open' && x.status === 'open');"), 'the open-trade loop manages every nq-open record, the shadow included');
  assert.ok(trader.includes("'nyflip', 'nyflip-x', 'nyflip-trend',"), 'snapshot.research counts the shadow stream');
  assert.ok(trader.includes("research.filter((x) => x.k === 'nq-open' && x.session === 'nyflip' && (x.status === 'open' || (x.closed || x.opened || 0) >= cut))"), 'the MT5 feed takes nyflip only');
});

test('the shadow stream is never alerted or ticketed, is not the page\'s live NQ list, and lands in the week report\'s shadow book', () => {
  const sh = { ...regimeShadow(LIVE, { trend: 0.4, on: true, cut: 0.295 }, CFG), status: 'win', R: 2, closed: LIVE.opened + 3600 };
  const live = { ...LIVE, status: 'win', R: 2, closed: LIVE.opened + 3600 }, skipped = { ...live, id: 'x', session: 'nyflip-x' };
  assert.deepEqual(alertable([], [live, sh, skipped]).map((x) => x.id), [live.id]);
  const m = page.match(/<script id="ms-wk-js">([\s\S]*?)<\/script>/); const W = {}; vm.runInNewContext(m[1], { window: W });
  const rows = W.MS_WEEK.records({ research: [live, sh, skipped] });
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId[live.id].grp, 'live'); assert.equal(byId[live.id].key, 'm:nq-open');
  assert.equal(byId[sh.id].grp, 'shadow'); assert.equal(byId[sh.id].key, 'm:nq-open:nyflip-trend'); assert.equal(byId[sh.id].name, 'NQ open run, trend-on only (shadow)');
  assert.equal(byId.x.grp, 'research', 'a skipped variant stays research');
  const open = W.MS_WEEK.openNow({ research: [{ ...LIVE }, regimeShadow(LIVE, { trend: 0.4, on: true, cut: 0.295 }, CFG)], snap: { nqLast: { price: 24950, at: LIVE.opened + 60 } } });
  assert.equal(open.list.length, 1); assert.equal(open.shadow, 1);
  // the main page: the system lists take session nyflip only, so the shadow is not "our system" anywhere
  assert.ok(page.includes("const NQ_SYS = ['nyflip'], nqSys = (x) => x.market !== 'nq' || NQ_SYS.includes(x.session);"));
  assert.ok(page.includes("x.k === 'nq-open' && x.session === 'nyflip' && done(x)"), 'system journal');
  assert.ok(page.includes("var nqLive = function (x) { return x.k === 'nq-open' && !x.shadow && !/-x$/.test(x.session || ''); };"));
});
