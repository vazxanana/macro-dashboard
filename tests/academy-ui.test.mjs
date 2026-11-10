// node --test tests/academy-ui.test.mjs — the Academy page (academy.html, assets/academy-ui.js, scripts/academy-dev.mjs).
// Offline. The page's pure helpers, the page's static promises, the recorded candle fixtures (real OANDA candles, see
// tests/fixtures/academy/manifest.json) and the whole learning loop run the way the page runs it: the real modules
// (MXR / MXA / MXK), the real API handler on an in-memory store, real candidates and outcomes. The browser side of the same
// loop is scripts/audit/academy.cjs (Playwright).
//
// Two tests are marked `todo`: they describe bugs found in OTHER modules while building the page (the page works around
// both). They fail today on purpose and do not fail the run; whoever fixes the module drops the `todo`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const MXAC = require('../assets/academy-ui.js');
const MXR = require('../assets/academy-replay.js');
const MXA = require('../assets/academy-core.js');
const MXK = require('../assets/academy-risk.js');
const { handle, _t } = require('../api/academy.js');
const ST = require('../api/_academy-store.js');
const { EDGES } = await import('../academy/edges.mjs');
const src = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const json = (f) => JSON.parse(src(f));
const DAY = 86400;

// ---- the recorded window: real candles, real candidates -------------------------------------------------------------------
const MAN = json('tests/fixtures/academy/manifest.json');
const SERIES = Object.fromEntries(MXAC.TFS.map((tf) => [tf, json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).bars.map((b) => ({ time: b[0], open: b[1], high: b[2], low: b[3], close: b[4] }))]));
const EDGE = EDGES.find((e) => e.id === MAN.edge);
const usable = (c) => c.t >= MAN.from && c.t < MAN.to && !(c.rule && (c.rule.clockShift || c.rule.pre2020));
const CANDS = json(`academy/data/cand-${MAN.edge}.json`).filter(usable).sort((a, b) => a.t - b.t);
const TRAIN = CANDS.filter((c) => c.pool !== 'exam'), EXAM = CANDS.filter((c) => c.pool === 'exam');
const SETUP = { edge: EDGE, riskPct: 0.25, cost: EDGE.costPerRoundTrip, balance: 100000 };
const CAL = json('academy/data/calendar.json');
// the page's snapOf: the edge's context timeframes, 300 closed bars each, the release calendar cut at t, no dollar index
function snapOf(c, t = c.t) {
  const o = { edge: EDGE.id, market: EDGE.market, t, cand: c, series: MXAC.snapshotSeries(EDGE, SERIES), dataVersion: 'OANDA (recorded) XAU_USD' }, cut = MXAC.calendarCut(CAL, t);
  if (cut.events) o.events = cut.events; if (cut.schedule) o.schedule = cut.schedule;
  return MXR.snapshot(o);
}
function decideOn(snap, lessons, thesis, history = []) {   // the page's decideOn: the risk engine first, then the policy
  const c = snap.cand, acct = MXK.roll(MXK.account(SETUP.balance, { t: MAN.from }), snap.t);
  const risk = MXK.check({ market: c.market, side: c.side, entry: c.entry, stop: c.stop, target: c.target, t: snap.t }, acct, { riskPct: SETUP.riskPct });
  return { risk, decision: MXA.decide(snap, { lessons, thesis: thesis || MXA.thesis.start(snap), history, risk, edgeDef: { version: EDGE.version, cost: SETUP.cost } }) };
}
// the API as the dev server mounts it: the real handler, an owner session, the generated files narrowed to the window
function mkApi() {
  const store = ST.memoryStore(), base = _t.fileData(new URL('..', import.meta.url).pathname); let clock = Date.UTC(2026, 10, 10, 12);
  const deps = { env: {}, store, who: async () => ({ u: 'owner' }), sameOrigin: () => true, now: () => (clock += 1000), data: base };
  const listed = { ...deps, data: { ...base, candidates: async (e) => (await base.candidates(e)).filter((c) => c.t >= MAN.from && c.t < MAN.to) } };   // only the LIST of setups is narrowed; past cases keep the whole history
  const call = async (method, payload) => { const out = {}, res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return out; } }; await handle(method === 'GET' ? { method, headers: {}, query: payload } : { method, headers: {}, body: payload }, res, method === 'GET' && payload.get === 'candidates' ? listed : deps); return out; };
  const ok = async (method, payload) => { const r = await call(method, payload); assert.equal(r.code, 200, `${method} ${JSON.stringify(payload).slice(0, 80)} → ${r.code} ${JSON.stringify(r.body)}`); return r.body; };
  return { get: (q) => ok('GET', q), post: (b) => ok('POST', b), raw: call };
}
const attemptBody = (c, mode, d, lessons, hash, f) => ({ action: 'attempt', attempt: { candidateId: c.id, edge: EDGE.id, mode, decision: d, sessionId: null, lessonsAvailable: lessons.map((l) => l.id), snapshotHash: hash }, features: f });

// ---- pure helpers -----------------------------------------------------------------------------------------------------------
test('lookback: every timeframe reaches back far enough for its 300 closed bars, on real candles', () => {
  for (const tf of MXAC.TFS) assert.ok(MXAC.lookbackSec(tf) >= 300 * MXR.TF[tf] * 1.4 + 2 * DAY, tf);
  assert.equal(MXAC.lookbackSec('5m'), 389700);
  // the fixtures were recorded with exactly this lookback: the earliest and the latest setup of the window both get 300 bars
  for (const c of [CANDS[0], CANDS[CANDS.length - 1]]) { const s = snapOf(c); for (const tf of MXAC.TFS) assert.equal(s.bars[tf].length, 300, `${c.id} ${tf}`); }
});

test('default range: the last 60 days of the candidates, never before the first one; the end is exclusive', () => {
  assert.equal(MXAC.defaultRange([], 60), null);
  const t = Date.UTC(2026, 3, 27, 10, 39) / 1000, far = [{ t: t - 400 * DAY }, { t: t - 10 * DAY }, { t }];
  assert.deepEqual(MXAC.defaultRange(far, 60), { from: MXAC.dayStart(t - 60 * DAY), to: MXAC.dayStart(t) + DAY });
  const near = [{ t: t - 3 * DAY }, { t }];
  assert.equal(MXAC.defaultRange(near, 60).from, MXAC.dayStart(t - 3 * DAY), 'a short list starts on its first setup, not 60 empty days earlier');
  assert.equal(MXAC.isoDay(MXAC.dayToSec('2024-05-02')), '2024-05-02'); assert.equal(MXAC.dayToSec('02/05/2024'), null);
  const r = MXAC.defaultRange(TRAIN, 60); assert.equal(MXAC.isoDay(r.from), '2024-05-02'); assert.equal(MXAC.isoDay(r.to - DAY), '2024-05-17');
});

test('the clock reaches a setup: the first one not yet handled between the last reposition and now', () => {
  const cs = [{ id: 'a', t: 100 }, { id: 'b', t: 200 }, { id: 'c', t: 200 }, { id: 'd', t: 300 }], done = new Set();
  assert.equal(MXAC.dueCandidate(cs, 0, 99, done), null);
  assert.equal(MXAC.dueCandidate(cs, 0, 100, done).id, 'a', 'a setup exactly at the tick is due');
  done.add('a'); assert.equal(MXAC.dueCandidate(cs, 0, 150, done), null);
  assert.equal(MXAC.dueCandidate(cs, 0, 1000, done).id, 'b', 'a big step never jumps over the earliest setup');
  done.add('b'); assert.equal(MXAC.dueCandidate(cs, 0, 200, done).id, 'c', 'two setups at the same time are taken one after the other');
  assert.equal(MXAC.dueCandidate(cs, 250, 1000, new Set()).id, 'd', 'setups before a jump target are not fired afterwards');
});

test('chart timeframe, difficulty, costs', () => {
  const tf = Object.fromEntries(EDGES.map((e) => [e.id, MXAC.chartTfOf(e)]));
  assert.deepEqual(tf, { replica: '5m', 'mosha-bo': '15m', gtrend: '1d', gtl: '4h', geg: '1d', gmp: '5m', 'nq-open': '5m' }, 'nq-open fires on 1m: the page loads and charts 5m');
  assert.deepEqual(['5m', '15m', '1h', '4h', '1d'].map(MXAC.htfFor), ['1h', '1h', '4h', '1d', '1d']);
  assert.ok(MXAC.difficultyAllows('expert', 'expert') && MXAC.difficultyAllows('advanced', 'beginner') && !MXAC.difficultyAllows('beginner', 'intermediate') && !MXAC.difficultyAllows('advanced', 'expert'));
  assert.equal(MXAC.costTotal({ spread: 0.15, commission: 0.05, slippage: 0.1 }), 0.3); assert.equal(MXAC.costTotal({ spread: -1, commission: null }), 0);
  const o = { R: -1, netR: -1.0144, reason: 'stop' };
  assert.equal(MXAC.netRAt(o, 0.15, 0.15), -1.0144, 'the study\'s own cost: its net R');
  assert.equal(MXAC.netRAt(o, 0.15, 0.30), -1.0288, 'twice the cost: twice the charge');
  assert.equal(MXAC.netRAt(o, 0.15, 0), -1, 'no cost: the gross R');
  assert.equal(MXAC.netRAt({ netR: 0.5 }, 0.15, 0.3), 0.5, 'without a gross R nothing is rescaled');
  assert.ok(MXAC.unfilled({ reason: 'missed' }) && MXAC.unfilled({ reason: 'expired' }) && MXAC.unfilled({ reason: 'cancelled' }) && !MXAC.unfilled({ reason: 'stop' }) && !MXAC.unfilled(null));
});

test('a lesson reads in plain English and a typed value becomes the contract\'s value', () => {
  const L = { when: [{ f: 'biasAlign', op: 'eq', v: 'against' }, { f: 'session', op: 'eq', v: 'asia' }], then: { action: 'WAIT', adjust: {} } };
  assert.equal(MXAC.lessonText(L), 'When: higher-timeframe bias against the trade AND session = asia → Then: WAIT');
  assert.equal(MXAC.condText({ f: 'rr', op: 'between', v: [1.5, 2.5] }), 'reward to risk between 1.5 and 2.5');
  assert.equal(MXAC.condText({ f: 'oppLiq', op: 'gte', v: 1 }), 'levels in the way at least 1');
  assert.equal(MXAC.condText({ f: 'regime', op: 'in', v: ['ranging', 'reversal'] }), 'regime is one of ranging, reversal');
  assert.equal(MXAC.condText({ f: 'eventNear', op: 'eq', v: true }), 'high-impact event near = yes');
  assert.equal(MXAC.lessonText({ when: [], then: {} }), 'When: no condition yet → Then: nothing yet');
  assert.match(MXAC.lessonText({ when: [{ f: 'confirm', op: 'eq', v: 'strong' }], then: { action: 'TAKE', adjust: { stop: { ref: 'sweepLevel', k: -0.2, unit: 'atr', text: 'stop = 0.2 ATR behind the swept level' } } } }), /Then: TAKE the edge's trade; stop = 0\.2 ATR behind the swept level$/);
  assert.deepEqual(MXAC.parseValue('eq', ' asia '), { ok: true, v: 'asia' }); assert.deepEqual(MXAC.parseValue('eq', 'yes'), { ok: true, v: true }); assert.deepEqual(MXAC.parseValue('eq', '2'), { ok: true, v: 2 });
  assert.deepEqual(MXAC.parseValue('in', 'asia, london'), { ok: true, v: ['asia', 'london'] }); assert.deepEqual(MXAC.parseValue('between', '1.5 .. 2.5'), { ok: true, v: [1.5, 2.5] }); assert.deepEqual(MXAC.parseValue('between', '1 to 3'), { ok: true, v: [1, 3] });
  for (const [op, raw] of [['eq', ''], ['gte', 'high'], ['between', '3 .. 1'], ['between', '2'], ['in', ' , ']]) assert.equal(MXAC.parseValue(op, raw).ok, false, `${op} "${raw}"`);
  for (const c of [{ op: 'between', v: [1, 2] }, { op: 'in', v: ['a', 'b'] }, { op: 'eq', v: 'x' }, { op: 'gte', v: 3 }]) assert.deepEqual(MXAC.parseValue(c.op, MXAC.valueToInput(c)).v, c.v, 'a value survives the round trip through its text box');
});

test('the mentor\'s form: what is sent, and what cannot be saved', () => {
  const d = { action: 'SELL', entry: 2299.34, stop: 2306.32, target: 2229.54 };
  const wait = MXAC.buildCorrection({ choice: 'WAIT', entry: 1, stop: 2, target: 3, reasons: ['session'], text: ' too early ', bias: 'neutral', annotations: [{ kind: 'liquidity', t: 5, price: 2300 }] }, 'at_1');
  assert.deepEqual(wait, { attemptId: 'at_1', verdict: 'change', action: 'WAIT', entry: null, stop: null, target: null, bias: 'neutral', edge: null, reasons: ['session'], text: 'too early', annotations: [{ kind: 'liquidity', t: 5, price: 2300, t2: null, price2: null, note: '' }] });
  assert.deepEqual(MXAC.correctionProblems(wait, d), []);
  assert.deepEqual([MXAC.buildCorrection({ choice: 'approve' }, 'a').verdict, MXAC.buildCorrection({ choice: 'reject' }, 'a').action], ['approve', null]);
  assert.deepEqual(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'approve' }, 'a'), d), [], 'an approval needs no reason');
  assert.match(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'reject' }, 'a'), d).join(' '), /Say why/);
  assert.match(MXAC.correctionProblems(MXAC.buildCorrection({ choice: 'WAIT', text: 'x' }, 'a'), { action: 'WAIT' }).join(' '), /already said WAIT/);
  const sell = (o) => MXAC.buildCorrection({ choice: 'SELL', entry: 2299.34, stop: 2306.32, target: 2229.54, text: 'x', ...o }, 'a');
  assert.match(MXAC.correctionProblems(sell(), d).join(' '), /engine's own answer/);
  assert.deepEqual(MXAC.correctionProblems(sell({ stop: 2310 }), d), [], 'the same action with another stop is a real correction');
  assert.match(MXAC.correctionProblems(sell({ stop: 2290 }), d).join(' '), /stop must be above the entry/);
  assert.match(MXAC.correctionProblems(sell({ target: 2400 }), d).join(' '), /target must be below the entry/);
  assert.match(MXAC.correctionProblems(sell({ stop: null }), d).join(' '), /every trade has a stop/);
  assert.match(MXAC.correctionProblems({}, d).join(' '), /Choose Approve/);
});

test('new-setup numbers: matched, changed, net R with and without, and "too few" under 20 graded', () => {
  const row = (wl, wo, rW, rWo, ids = [], out = { reason: 'stop' }) => ({ withLessons: wl, withoutLessons: wo, rWith: rW, rWithout: rWo, lessonIds: ids, outcome: out });
  const W = { action: 'WAIT' }, S = { action: 'SELL', entry: 10, stop: 11, target: 5 };
  const s = MXAC.examSummary([row(W, S, 0, -1.0144, ['ls_1']), row(S, S, 0.5, 0.5), row(W, W, 0, 0, ['ls_1']), row({ action: 'BUY', entry: 10, stop: 9, target: 12 }, S, null, 0.25, ['ls_2']), row(S, S, 0, 0, [], { reason: 'expired' })]);
  assert.deepEqual(s, { n: 5, matched: 3, changed: 2, graded: 4, netWith: 0.5, netWithout: -0.514, neverFilled: 1, tooFew: true });
  assert.equal(MXAC.examSummary(Array.from({ length: 20 }, () => row(W, W, 0, 0))).tooFew, false);
  assert.deepEqual(MXAC.examSummary(null), { n: 0, matched: 0, changed: 0, graded: 0, netWith: 0, netWithout: 0, neverFilled: 0, tooFew: true });
  assert.ok(!MXAC.sameAnswer(S, { ...S, stop: 12 }), 'the same action on another stop is a changed answer');
});

test('candle errors are said in words the owner can act on', () => {
  assert.match(MXAC.candleError({ code: 'NO_SOURCE' }), /^The server has no candle source configured/);
  assert.match(MXAC.candleError({ code: 'NETWORK' }), /could not be reached/); assert.match(MXAC.candleError({ code: 'UPSTREAM' }), /Try again/);
  assert.match(MXAC.candleError(new Error('boom')), /could not be loaded: boom/);
});

test('registerTab: the hook for the sections built next', () => {
  assert.throws(() => MXAC.registerTab('progress', {}), /render/); assert.throws(() => MXAC.registerTab('Bad Id', { render() {} }), /short id/);
  assert.doesNotThrow(() => MXAC.registerTab('progress', { title: 'Progress', render() {} }));
  assert.deepEqual(MXAC.TABS.map((t) => t[0]), ['train', 'session', 'blind', 'progress', 'lessons', 'research', 'models', 'costs', 'audit']);
});

// ---- the page's static promises ---------------------------------------------------------------------------------------------
test('academy.html: owner card, the nine sections, the scripts in order, built by the build script', () => {
  const html = src('academy.html'), ui = src('assets/academy-ui.js');
  assert.match(html, /<title>MeridianX Academy<\/title>/); assert.match(html, /<h1>MeridianX Academy<\/h1>/);
  assert.match(html, /The Academy is for the desk owner\. Sign in on the desk\./);
  for (const [id] of MXAC.TABS) assert.match(html, new RegExp(`<section id="ac-${id}" role="tabpanel"`), id);
  for (const id of ['session', 'blind', 'progress', 'lessons', 'research', 'models', 'costs', 'audit']) assert.match(html, new RegExp(`<section id="ac-${id}"[^>]*hidden></section>`), `${id} ships empty: nothing that looks as if it worked`);
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(scripts, ['/assets/lightweight-charts-4.1.3.js', '/assets/backtest-engine.js', '/assets/academy-replay.js', '/assets/academy-core.js', '/assets/academy-risk.js', '/assets/mx-nav.js', '/assets/academy-ui.js']);
  assert.ok(!/\son[a-z]+="/.test(html), 'no inline event handlers');
  assert.match(ui, /Coming in the next build step\./);
  assert.match(ui, /if \(!me \|\| me\.u !== 'owner'\) \{ \$\('ac-gate'\)\.hidden = false; return; \}/, 'anyone but the owner gets the card and the page stops there');
  assert.match(ui, /Passing the same trade shows recall, not generalisation\./);
  assert.match(src('scripts/build.sh'), /^cp .*\bacademy\.html\b.* out\/$/m);
  assert.ok(json('vercel.json').rewrites.some((r) => r.source === '/academy' && r.destination === '/academy.html'));
  assert.equal(src('out/academy.html').includes('MeridianX Academy'), true, 'out/ carries the page');
});

test('the page talks to the Academy API and the candle proxy only: no broker, no order, no other service', () => {
  const ui = src('assets/academy-ui.js');
  const urls = [...ui.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.deepEqual(urls, ['url, init'], 'one fetch call, inside the api helper');
  assert.deepEqual([...new Set([...ui.matchAll(/'(\/(?:api|md|cdata)\/[a-z-]+)[?']/g)].map((m) => m[1]))].sort(), ['/api/academy']);
  assert.ok(!/ctrader|\/api\/bridge|tradovate|websocket|new WebSocket|localStorage|sessionStorage/i.test(ui), 'no broker code, no socket, no browser storage of results');
  // POSTs are queued: the store has no compare-and-swap
  assert.match(ui, /const p = chain\.then\(run, run\); chain = p\.catch\(\(\) => \{\}\); return p;/);
});

test('rule 6: no model names in the Academy page files', () => {
  for (const f of ['academy.html', 'assets/academy.css', 'assets/academy-ui.js', 'scripts/academy-dev.mjs', 'scripts/audit/academy.cjs', 'tests/academy-ui.test.mjs', 'tests/fixtures/academy/manifest.json'])
    assert.ok(!new RegExp(['clau' + 'de', 'anthro' + 'pic', 'open' + 'ai', 'gp' + 't-', 'gem' + 'ini', 'son' + 'net', 'op' + 'us\\b', 'hai' + 'ku'].join('|'), 'i').test(src(f)), f);
});

test('academy.css: 12 px text at least, no endless animation, touch height from the shared token', () => {
  const css = src('assets/academy.css');
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 12, `font size ${m[1]}px`);
  assert.ok(!/infinite/.test(css)); assert.ok(!/@keyframes/.test(css));
  assert.match(css, /input, select, textarea \{[^}]*min-height: var\(--tap\)/);
  assert.match(css, /@media \(max-width: 1080px\) \{ \.ac-grid \{ grid-template-columns: minmax\(0, 1fr\); \} \}/, 'one column on narrow screens (the chart column comes first in the markup)');
  const html = src('academy.html'); assert.ok(html.indexOf('class="ac-chart-col"') < html.indexOf('class="ac-side"'));
});

// ---- the fixtures: real candles, small, complete ------------------------------------------------------------------------------
test('fixtures: real recorded candles for one window, well formed, and several train and exam setups inside it', () => {
  assert.equal(MAN.edge, 'gmp'); assert.match(MAN.source, /meridianx\.dev\/md\/bars/); assert.ok(TRAIN.length >= 3 && EXAM.length >= 3, `${TRAIN.length} train, ${EXAM.length} exam`);
  assert.deepEqual(MAN.candidates, { train: TRAIN.length, exam: EXAM.length });
  let bytes = 0;
  for (const tf of MXAC.TFS) {
    const f = json(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`), bars = SERIES[tf], sec = MXR.TF[tf]; bytes += src(`tests/fixtures/academy/bars-${MAN.sym}-${tf}.json`).length;
    assert.equal(f.src, 'OANDA'); assert.equal(f.inst, 'XAU_USD'); assert.equal(bars.length, MAN.tfs[tf].n);
    assert.equal(f.from, MAN.from - MXAC.lookbackSec(tf), `${tf}: only the window and its lookback`); assert.equal(f.to, MAN.to);
    for (let i = 0; i < bars.length; i++) { const b = bars[i]; assert.ok(MXR.cleanBar(b), `${tf}[${i}] is a well-formed bar`); assert.ok(b.time % sec === 0 && b.time >= f.from && b.time < f.to); if (i) assert.ok(b.time > bars[i - 1].time); }
    assert.ok(new Set(bars.map((b) => b.close)).size > bars.length / 4, `${tf}: prices move like a market, not a generator`);
  }
  assert.ok(bytes < 450 * 1024, `fixtures stay small (${bytes} bytes)`);
  // a 4h bar rebuilt from the 5m candles is the recorded 4h bar: the files are one consistent feed
  const agg = MXR.aggregate(SERIES['5m'], '5m', '4h', MAN.to), ref = new Map(SERIES['4h'].map((b) => [b.time, b])); let same = 0;
  for (const b of agg.slice(2)) { const r = ref.get(b.time); if (r && Math.abs(r.high - b.high) < 0.5 && Math.abs(r.low - b.low) < 0.5) same++; }
  assert.ok(same >= agg.length - 4, `${same} of ${agg.length} 4h bars agree`);
});

// ---- the loop, as the page runs it ----------------------------------------------------------------------------------------------
test('no look-ahead: a snapshot at a setup holds only closed bars, and a candidate reaches it only at its own time', () => {
  for (const c of CANDS) {
    const s = snapOf(c); assert.ok(MXAC.snapshotClean(s)); MXR.guard(s); MXA.assertNoFuture(s);
    for (const tf of MXAC.TFS) { const last = s.bars[tf][s.bars[tf].length - 1]; assert.ok(last.time + MXR.TF[tf] <= c.t, `${c.id} ${tf}`); }
    assert.ok(!Object.keys(s.cand).some((k) => ['R', 'netR', 'exitT', 'exit', 'mfeR', 'maeR'].includes(k)));
    assert.throws(() => snapOf(c, c.t - 60), (e) => e.code === 'LOOKAHEAD', 'one minute early the candidate is refused');
    for (const e of s.events || []) assert.ok(e.t <= c.t && e.t > c.t - 7 * DAY); for (const e of s.schedule || []) { assert.ok(e.t > c.t && e.t <= c.t + 72 * 3600); assert.deepEqual(Object.keys(e).sort(), ['impact', 't', 'title']); }
  }
  const dirty = snapOf(CANDS[0]); dirty.bars['5m'].push({ time: CANDS[0].t, open: 1, high: 1, low: 1, close: 1 }); assert.equal(MXAC.snapshotClean(dirty), false);
  // the chart's forming bar is display only: the snapshot builder never lets one in
  const c = TRAIN[0], forming = MXR.formingAt(SERIES['5m'], '1h', c.t, '5m'); assert.equal(forming.forming, true);
  assert.throws(() => MXR.guard({ v: 1, t: c.t, bars: { '1h': [forming] } }), (e) => e.code === 'LOOKAHEAD');
  assert.ok(!snapOf(c).bars['1h'].some((b) => b.time === forming.time), 'the bar still forming at t is not in the snapshot');
});

test('the learning loop on real data: decide, store, correct, save the lesson, replay the same trade → learned; then new setups', async () => {
  const api = mkApi();
  // 1. the first train setup the engine takes
  let cand = null, snap = null, first = null;
  const hist = async (c) => { const h = await api.get({ get: 'history', edge: EDGE.id, cand: c.id }); assert.equal(h.available, true); assert.ok(h.rows.every((r) => r.t < c.t && r.exitT < c.t), 'past cases had finished before the setup'); return h.rows; };
  const seenGates = [];
  for (const c of TRAIN) { const s = snapOf(c), r = decideOn(s, [], null, await hist(c)); seenGates.push(...r.decision.gates.map((g) => g.code)); if (r.decision.action !== 'WAIT') { cand = c; snap = s; first = r; break; } }
  assert.ok(seenGates.includes('event'), 'the calendar reaches the decision: the setup hours before payrolls waits on event risk');
  assert.ok(first.decision.similar.n >= 20 && Number.isFinite(first.decision.similar.winRate), `similar past cases come from the history route (n = ${first.decision.similar.n})`);
  assert.ok(cand, 'the recorded window holds a train setup the engine takes'); assert.equal(first.risk.allowed, true); assert.ok(first.risk.size > 0 && Math.abs(first.risk.riskCash - 250) < 1, 'sized at 0.25 % of 100,000');
  const f = MXA.features(snap), hash = MXR.hash(snap);
  const a1 = await api.post(attemptBody(cand, 'train', first.decision, [], hash, f));
  assert.equal(a1.n, 1); assert.equal(a1.attempt.decision.action, first.decision.action); assert.equal(a1.attempt.snapshotHash, hash);
  // 2. the mentor: WAIT, missing confirmation
  const c = MXAC.buildCorrection({ choice: 'WAIT', reasons: ['session', 'wrong-structure'], text: 'Not in this session.', bias: 'neutral', annotations: [{ kind: 'liquidity', t: cand.t, price: cand.entry }, { kind: 'supply-demand', t: cand.t - 3600, price: cand.entry, t2: cand.t, price2: cand.stop }] }, a1.attempt.id);
  assert.deepEqual(MXAC.correctionProblems(c, first.decision), []);
  const errorClass = MXA.classifyError(first.decision, c, null); assert.ok(MXA.ERROR_CLASSES.includes(errorClass));
  const k = (await api.post({ action: 'correct', edge: EDGE.id, correction: { ...c, errorClass } })).correction;
  assert.equal(k.action, 'WAIT'); assert.equal(k.annotations.length, 2); assert.equal(k.errorClass, errorClass);
  // 3. the draft, edited the way the mentor would: one condition removed, validated, saved
  const draft = MXA.lessons.fromCorrection(first.decision, k, f);
  assert.equal(draft.then.action, 'WAIT'); assert.ok(draft.when.length >= 2 && draft.when[0].f === 'session'); assert.match(MXAC.lessonText(draft), /^When: session = \w+ AND .+ → Then: WAIT$/);
  draft.when = draft.when.filter((w) => w.f === 'session'); assert.deepEqual(MXA.lessons.validate(draft), []);
  assert.ok(MXA.lessons.validate({ ...draft, when: [] }).length > 0, 'a lesson without a condition is refused');
  const saved = (await api.post({ action: 'lesson.save', lesson: { edge: draft.edge, title: draft.title, text: draft.text, when: draft.when, then: draft.then, source: draft.source, active: true } })).lesson;
  assert.equal(saved.version, 1); assert.equal(saved.source.correctionId, k.id); assert.equal(saved.source.attemptId, a1.attempt.id);
  // 4. replay the same trade: the same snapshot, the lessons from the server, a fresh thesis
  const lessons = (await api.get({ get: 'lessons', edge: EDGE.id, active: '1' })).lessons; assert.equal(lessons.length, 1);
  const again = snapOf(cand); assert.equal(MXR.hash(again), a1.attempt.snapshotHash, 'the same decision point');
  const second = decideOn(again, lessons, MXA.thesis.start(again), await hist(cand));
  assert.equal(second.decision.action, 'WAIT'); assert.notEqual(second.decision.action, first.decision.action);
  assert.equal(second.decision.lessonsApplied.length, 1); assert.equal(second.decision.lessonsApplied[0].id, saved.id); assert.equal(second.decision.lessonsApplied[0].applied, true);
  const cmp = MXA.compare(first.decision, second.decision, k);
  assert.equal(cmp.verdict, 'learned'); assert.equal(cmp.lessonApplied, true); assert.deepEqual(cmp.lessonIds, [saved.id]); assert.ok(cmp.changed.some((x) => x.field === 'action'));
  const a2 = await api.post(attemptBody(cand, 'replay-same', second.decision, lessons, MXR.hash(again), MXA.features(again)));
  assert.equal(a2.n, 2);
  await api.post({ action: 'lesson.stats', id: saved.id, inc: { applied: 1, replayPass: 1 } });
  const stored = (await api.get({ get: 'attempts', edge: EDGE.id, cand: cand.id })).attempts;
  assert.deepEqual(stored.map((a) => [a.n, a.mode, a.decision.action]), [[1, 'train', first.decision.action], [2, 'replay-same', 'WAIT']]);
  // the page's work-around after a reload: the stored decisions still give the same verdict
  assert.equal(MXA.compare(MXAC.restoreApplied(stored[0].decision), MXAC.restoreApplied(stored[1].decision), k).verdict, 'learned');
  // the paper trade may only be read now that the attempt is stored
  const out = (await api.get({ get: 'outcome', id: cand.id, edge: EDGE.id })).outcome; assert.ok(Number.isFinite(out.netR) && out.exitT > cand.t);
  let acct = MXK.open(MXK.roll(MXK.account(100000, { t: MAN.from }), cand.t), { id: cand.id, market: cand.market, side: cand.side, units: first.risk.size, entry: cand.entry, stop: cand.stop, target: cand.target, t: cand.t });
  assert.equal(acct.positions.length, 1);
  acct = MXK.apply(acct, { id: cand.id, netR: MXAC.netRAt(out, EDGE.costPerRoundTrip, SETUP.cost), riskCash: first.risk.riskCash, exitT: out.exitT });
  assert.equal(acct.positions.length, 0); assert.ok(Math.abs(acct.balance - (100000 + out.netR * first.risk.riskCash)) < 0.02);

  // 5. new setups: unseen exam candidates, without and with the lesson; the outcome is refused until the attempt is stored
  const pool = (await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000 })).candidates; assert.equal(pool.length, EXAM.length);
  assert.equal((await api.raw('GET', { get: 'outcome', id: pool[0].id, edge: EDGE.id })).code, 403, 'no peeking before the decision');
  const lite = (d) => ({ action: d.action, entry: d.entry, stop: d.stop, target: d.target, confidence: d.confidence });
  for (const x of pool) {
    const s = snapOf(x), h = await hist(x), without = decideOn(s, [], null, h).decision, withL = decideOn(s, lessons, null, h).decision;
    const att = await api.post(attemptBody(x, 'exam', withL, lessons, MXR.hash(s), MXA.features(s)));
    await api.post({ action: 'exam.result', result: { edge: EDGE.id, candidateId: x.id, lessonIds: withL.lessonsApplied.map((l) => l.id), withLessons: lite(withL), withoutLessons: lite(without), attemptId: att.attempt.id } });
    assert.equal((await api.raw('POST', attemptBody(x, 'train', withL, lessons, MXR.hash(s), MXA.features(s)))).code, 400, 'an exam setup is never a training setup');
  }
  const ex = await api.get({ get: 'exams', edge: EDGE.id }), sum = MXAC.examSummary(ex.exams);
  assert.equal(sum.n, EXAM.length); assert.equal(sum.graded, EXAM.length); assert.equal(sum.tooFew, true, 'a handful of setups is too few to judge');
  assert.ok(sum.matched >= 1 && sum.changed >= 1, `the lesson matches and changes unseen setups in this window (${sum.matched} matched, ${sum.changed} changed)`);
  assert.equal(sum.netWith, Math.round(ex.exams.reduce((s, r) => s + r.rWith, 0) * 1000) / 1000);
  assert.equal((await api.get({ get: 'candidates', edge: EDGE.id, pool: 'exam', limit: 5000 })).candidates.length, 0, 'every exam setup is used once');
  // a replay position round-trips through the session store
  const replay = MXR.session.save({ edge: EDGE.id, market: EDGE.market, tf: '5m', t: cand.t, from: MAN.from, to: MAN.to, speed: 100, balance: acct.balance, risk: { riskPct: 0.25 }, costs: { spread: 0.15, commission: 0, slippage: 0 }, difficulty: 'expert', mode: 'train', openDecisions: [a1.attempt.id], savedAt: '2026-11-10T12:00:00Z' });
  const se = (await api.post({ action: 'session.save', session: { edge: EDGE.id, title: 'test', kind: 'replay', status: 'paused', candidateId: cand.id, t: cand.t, state: { replay, account: acct, done: [cand.id] } } })).session;
  const back = (await api.get({ get: 'session', id: se.id })).session; assert.deepEqual(MXR.session.restore(back.state.replay), replay); assert.equal(back.state.account.balance, acct.balance);
});

// ---- bugs found in other modules while building the page (the page works around both) --------------------------------------------
// api/academy.js decisionOf() keeps only { id, version, effect } of decision.lessonsApplied, so a STORED decision no longer
// says whether a lesson was applied. MXA.compare() reads `applied !== false`, so on stored attempts a lesson that matched but
// was NOT applied counts as applied. Work-around on the page: MXAC.restoreApplied() reads it back from the effect text.
test('a stored decision keeps lessonsApplied[].applied, so compare() on stored attempts does not over-count (fixed in api/academy.js)', async () => {
  const api = mkApi(), c = TRAIN[0], s = snapOf(c), d = { ...decideOn(s, []).decision, action: 'WAIT' };
  const notApplied = { ...d, action: 'WAIT', lessonsApplied: [{ id: 'ls_x1', version: 1, effect: 'TAKE not applied: blocked by rr (a lesson cannot override it)', applied: false, correctionId: 'co_1', title: 'x' }] };
  await api.post(attemptBody(c, 'train', { ...d, action: 'WAIT' }, [], MXR.hash(s), null)); await api.post(attemptBody(c, 'replay-same', notApplied, [], MXR.hash(s), null));
  const [A, B] = (await api.get({ get: 'attempts', edge: EDGE.id, cand: c.id })).attempts;
  assert.equal(MXA.compare({ ...d, action: 'WAIT' }, notApplied, { verdict: 'change', action: 'SELL' }).lessonApplied, false, 'in memory the comparison is right');
  assert.equal(MXA.compare(MXAC.restoreApplied(A.decision), MXAC.restoreApplied(B.decision), { verdict: 'change', action: 'SELL' }).lessonApplied, false, 'and with the page\'s work-around');
  assert.equal(B.decision.lessonsApplied[0].applied, false, 'the stored decision should still say the lesson was not applied');
  assert.equal(MXA.compare(A, B, { verdict: 'change', action: 'SELL' }).lessonApplied, false);
});
test('the work-around: restoreApplied reads "applied" back from the engine\'s effect text', () => {
  const r = MXAC.restoreApplied({ lessonsApplied: [{ id: 'a', effect: 'WAIT: changed SELL to WAIT' }, { id: 'b', effect: 'TAKE not applied: blocked by rr (a lesson cannot override it)' }, { id: 'c', effect: 'matched, nothing to change' },
    { id: 'd', effect: 'WAIT: agrees with lesson a; stop rule not applied: the decision is WAIT' }, { id: 'e', effect: 'stop rule rejected: it would put the stop or target on the wrong side of the entry' }, { id: 'f', effect: 'whatever', applied: false }] });
  assert.deepEqual(r.lessonsApplied.map((l) => l.applied), [true, false, false, true, false, false]);
  assert.equal(MXAC.restoreApplied(null), null); assert.deepEqual(MXAC.restoreApplied({ action: 'WAIT' }), { action: 'WAIT' });
});
// assets/academy-core.js evidenceOf() writes the thesis start as raw epoch seconds into text the mentor reads
// ("In line with the running thesis (bias down since 1714608000)."). The page shows it as a date; the stored text keeps the number.
test('evidence text gives the thesis start as a UTC date, never raw epoch seconds (fixed in assets/academy-core.js)', () => {
  const c = TRAIN.find((x) => decideOn(snapOf(x), []).decision.action !== 'WAIT'), d = decideOn(snapOf(c), []).decision;
  const texts = d.supporting.concat(d.contradicting).map((x) => x.text).filter((t) => /running thesis/.test(t));
  assert.ok(texts.length > 0); for (const t of texts) assert.doesNotMatch(t, /since \d{9,}/, t);
});
test('the work-around: the page shows that time as a UTC date', () => {
  assert.equal(MXAC.humanize('In line with the running thesis (bias down since 1714608000).'), 'In line with the running thesis (bias down since 2024-05-02 00:00 UTC).');
  assert.equal(MXAC.humanize('a wick through the swing level 2286.185 7 bars ago'), 'a wick through the swing level 2286.185 7 bars ago'); assert.equal(MXAC.humanize(null), '');
});
