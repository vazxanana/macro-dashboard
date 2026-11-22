// The Mosha method replayed on the last two weeks (assets/mosha-sop.js): the desk's reading of the sequence (BO, VR, CF) and of
// the barrier entry on past candles, listed on the Mosha desk like the council's trades with a log per trade. Display only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), M = require('../assets/mosha-sop.js');
const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8'), src = fs.readFileSync(new URL('../assets/mosha-sop.js', import.meta.url), 'utf8');
const fn = (name) => { const i = html.indexOf(`function ${name}(`); let d = 0; for (let k = html.indexOf('{', i); ; k++) { if (html[k] === '{') d++; else if (html[k] === '}' && !--d) return html.slice(i, k + 1); } };
const F = { msAnalyze: new Function(`${fn('msAnalyze')}; return msAnalyze;`)(), msMosha: new Function(`${fn('msMosha')}; return msMosha;`)(), msZones: new Function(`${fn('msZones')}; return msZones;`)(), msInternal: new Function(`const MS_IPIV = 6; ${fn('msInternal')}; return msInternal;`)() };

// a seeded one-minute walk with swings, grouped into every timeframe the replay reads
function makeMarket(days, seed) {
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const T0 = 1790000000 - (1790000000 % 86400), m1 = []; let p = 4000, drift = 0;
  for (let i = 0; i < days * 1440; i++) { if (i % 180 === 0) drift = (rnd() - 0.5) * 0.5; const o = p, c = o + drift + (rnd() - 0.5) * 2.4, h = Math.max(o, c) + rnd() * 0.8, l = Math.min(o, c) - rnd() * 0.8; m1.push({ time: T0 + i * 60, open: o, high: h, low: l, close: c }); p = c; }
  const B = { '1m': m1 };
  for (const tf of ['5m', '15m', '30m', '1h', '4h', '1d']) { const sec = M.SEC[tf], out = []; for (const b of m1) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } B[tf] = out; }
  return B;
}
// 22 Nov 2026: the failed-QM entries (a trade with the direction at a barrier against it) have their own shape and their own
// test at the end of this file; every older test reads the barrier list without them (BT = the whole list).
const BT = M.barrierTrades; M.barrierTrades = (B, Fx, o) => BT(B, Fx, o).filter((r) => !r.qmFail && !r.tap);
// 22 Nov 2026: a SOP inside the SOP (the VR and the CF each start a lower-timeframe sequence) has its own shape and its own
// test at the end of this file; every older test reads the sequence list without it (ST = the whole list). nest: false is
// the same list as the whole one less the nested records (that test compares the two), and does not run their walk.
// Same day: the CF is read one timeframe under the VR (the method's table); cf: 'same' is the reading until then, which the
// older tests pin. Its own test is at the end too.
// Same day ("Both"): a CF counts only once price is back at the BO level, and a limit at the CF line is recorded beside the EG entry;
// cfBack: false and cfLimit: false read as before.
const OLDWAY = { nest: false, cf: 'same', cfBack: false, cfLimit: false };
const ST = M.sopTrades; M.sopTrades = (B, Fx, o) => ST(B, Fx, { ...OLDWAY, ...(o || {}) }).filter((r) => !r.nest);
// Every market and every replay is worked out ONCE and shared by the tests below (21 Nov 2026: the file had grown to about a
// quarter of an hour, most of it the same replay run again by each test). A replay is keyed by its candles, its cut and its
// options; nothing a test asserts was dropped for it.
const MEMO = new Map(), memo = (k, f) => { if (!MEMO.has(k)) MEMO.set(k, f()); return MEMO.get(k); };
const market = (days, seed) => memo('mk|' + days + '|' + seed, () => makeMarket(days, seed));
const cut = (B, T) => Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.filter((b) => b.time + M.SEC[tf] <= T)]));
const endOf = (seed) => market(26, seed)['1m'].at(-1).time + 60, fr20 = (seed) => endOf(seed) - 20 * 86400, fr14 = (seed) => endOf(seed) - 14 * 86400;
const sopOf = (seed, fr, o = {}) => memo(['sop', seed, fr, JSON.stringify(o)].join('|'), () => M.sopTrades(market(26, seed), F, { from: fr, ...o }));
const barOf = (seed, fr, o = {}) => memo(['bar', seed, fr, JSON.stringify(o)].join('|'), () => M.barrierTrades(market(26, seed), F, { from: fr, ...o }));
const keyOf = (r) => [r.id, r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4), r.withDir, r.withWeekly, r.er20, !!r.case2].join('|');
// the replay as the tracker runs it over the last 20 days (the sequence hands its CF zones and VR boxes to the barrier entry),
// on the whole market or on the candles CLOSED by a moment T
const ALL = (seed, T = 0) => memo('all|' + seed + '|' + T, () => { const X = T ? cut(market(26, seed), T) : market(26, seed), fr = fr20(seed), z = [], sop = M.sopTrades(X, F, { from: fr, cfOut: z }), bar = M.barrierTrades(X, F, { from: fr, extra: z }), rows = sop.concat(bar);
  return { fr, z, sop, bar, rows, keys: new Set(rows.map(keyOf)) }; });
// when a record can first be seen: a sequence entry at its EG's close (a VR-retest limit once the candle of the touch closed),
// the repeat of the SOP after a CF at its EG's close, a barrier entry once the barrier-timeframe candle of the return has
// closed (the replay reads that candle whole)
const knownAt = (r) => r.kind === 'sop' ? (r.retest === 'level' ? r.t - (r.t % M.SEC[r.l]) + M.SEC[r.l] : r.t) : r.nested ? r.t : Math.max(r.t + 300, r.log[1].t - (r.log[1].t % M.SEC[r.h]) + M.SEC[r.h]);
const rule1 = (r) => r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry;
// NO HINDSIGHT, one pool of cuts a market shared by every test. For each kind of record (each reading) the FIRST record of
// the market gets a tight cut of its own: 7 minutes after a sequence entry is known, 37 minutes after a barrier entry is
// (unaligned on purpose); two late unaligned cuts cover the rest of the window. `verify` then checks every record handed in
// against the earliest cut at or after the moment it is known: it must be there, with the same levels and tags. So each
// reading has a record checked within minutes of its entry, and every other record is checked too (before, two a test).
const feats = (r) => r.kind === 'sop' ? [r.case2 ? 'c2' : r.retest ? 'retest-' + r.retest : r.ibo ? 'ibo' : 'sop'] : [r.nested ? 'nested' : r.rsop ? 'rsop' : r.janda ? (r.jandaM1 ? 'jandaM1' : 'janda') : 'qm'].concat(/CF barrier/.test(r.label) ? ['cf'] : [], /VR barrier/.test(r.label) ? ['vr'] : [], r.sweep ? ['sweep'] : [], r.m5 ? ['m5'] : [], r.alt ? ['alt'] : [], r.h === '30m' ? ['m30'] : [], r.visit > 1 ? ['visit'] : [], r.atZone ? ['zone'] : [], r.withDir === true ? ['with'] : r.withDir === false ? ['against'] : []);
const POOL_SEEDS = [7, 11, 23];
const POOL = (seed) => memo('pool|' + seed, () => { const e = endOf(seed), first = new Map();
  for (const r of ALL(seed).rows.slice().sort((a, b) => knownAt(a) - knownAt(b))) for (const f of feats(r)) if (!first.has(f)) first.set(f, knownAt(r) + (r.kind === 'sop' || r.nested ? 7 : 37) * 60);
  return { first, Ts: [...new Set([...first.values(), e - 6 * 86400 + 37 * 60, e - 2 * 86400 - 11 * 60])].filter((t) => t <= e).sort((a, b) => a - b) }; });
const cutFor = (seed, t) => POOL(seed).Ts.find((T) => T >= t);
function verify(seed, rows) {
  let n = 0; if (!POOL_SEEDS.includes(seed)) return n;
  for (const r of rows) { const T = cutFor(seed, knownAt(r)); if (T == null) continue; n++;
    assert.ok(ALL(seed, T).keys.has(keyOf(r)), `seed ${seed}: found only with later candles, or changed by them: ${r.id}`); }
  return n;
}
const B = market(26, 7), END = endOf(7), from = fr14(7);
const sop = sopOf(7, from), bar = barOf(7, from);

test('the replay finds entries of both kinds, each with a stop on its losing side, a target on the winning side and a log', () => {
  assert.ok(sop.length >= 1, 'sequence entries: ' + sop.length); assert.ok(bar.length >= 3, 'barrier entries: ' + bar.length);
  for (const r of sop.concat(bar)) {
    assert.ok(r.side === 1 || r.side === -1); assert.ok(r.r0 > 0);
    assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1: ' + r.id);
    assert.ok(r.t >= from && r.t <= END); assert.ok(['target', 'stopped', 'open'].includes(r.status));
    assert.ok(r.log.length >= 4 && r.log.every((x) => typeof x.text === 'string' && x.text.length > 10));
    const ts = r.log.map((x) => x.t).filter(Boolean); assert.deepEqual(ts, ts.slice().sort((a, b) => a - b), 'the log runs in time order');
    if (r.status === 'stopped') assert.equal(r.R, -1); if (r.status === 'target') assert.ok(r.R > 0); if (r.status === 'open') assert.equal(r.R, null);
  }
  // the two tags that change no trade are on every sequence record
  for (const r of sop) { assert.ok(r.withWeekly === null || typeof r.withWeekly === 'boolean'); assert.ok(r.er20 === null || (r.er20 >= 0 && r.er20 <= 1)); assert.match(r.id, /^sop-/); }
  for (const r of sop.filter((x) => !x.retest)) { assert.match(r.log[0].text, /BO (buy|sell)/); assert.match(r.log[1].text, / VR: the first BO Structure \(QM\) against the BO/); assert.match(r.log[2].text, / CF.*BO Structure \(QM\) back with the BO/); assert.ok(r.deep === null || typeof r.deep === 'boolean'); }
  // the return to the barrier is a moment on the finest candles, and the confirmation closes after it (never a QM from before price was there)
  for (const r of bar) { const z = r.marks[0], t0 = r.log[1].t, fine = B['1m'] && B['1m'].length && B['1m'][0].time <= t0 ? B['1m'] : B['5m'], c = fine.find((b) => b.time === t0);
    assert.ok(c, 'the return is a fine candle: ' + r.id); assert.ok(r.side < 0 ? c.high >= z.bot : c.low <= z.top, 'that candle trades into the barrier'); assert.ok(r.log[2].t > t0, 'the CF closes after the return'); }
  for (const r of bar) { assert.match(r.log[0].text, r.sweep ? /barrier: the swing (high|low)/ : /barrier: a fresh (supply|demand) zone/); assert.match(r.log[2].text, / CF: a QM \(BO Structure\)/); assert.match(r.log[r.rsop ? 5 : r.janda ? 4 : 3].text, r.rsop ? /pulled back into the CF zone and an EG closed/ : r.janda ? /pulled back to the engulf zone/ : r.atZone ? /pulled back to the zone's near side/ : /pulled back to the level/); if (r.janda) assert.match(r.log[3].text, / Janda: the next break (buy|sell) is a normal BO/); assert.deepEqual([r.h, r.l], r.jandaM1 ? [r.h, M.JANDA_ALT[r.h]] : r.m5 ? [r.h, M.M5_ALT[r.h]] : r.alt ? [r.h, M.ALT2[r.h]] : M.BARRIER.concat(M.BARRIER30).find((p) => p[0] === r.h), 'the confirmation timeframe of the method\'s two tables (or the owner\'s M5)'); if (!r.rsop) assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - M.BARRIER_R) < 1e-9); }
});

test('no look-ahead: an entry found with the candles cut at a moment is the entry found with everything after it', () => {
  const T = END - 5 * 86400, Bc = cut(B, T), key = (r) => [r.id, r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4)].join('|');
  const early = M.sopTrades(Bc, F, { from }).concat(M.barrierTrades(Bc, F, { from })).map(key);
  const later = new Set(sop.concat(bar).filter((r) => r.t <= T).map(key));
  assert.ok(early.length >= 2);
  for (const k of early) assert.ok(later.has(k), 'changed once later candles were read: ' + k);
  // and every later price changed: the early entries stay what they were
  const B2 = Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.map((b) => b.time + M.SEC[tf] <= T ? b : { time: b.time, open: b.open + 300, high: b.high + 300, low: b.low + 300, close: b.close + 300 })]));
  const moved = new Set(M.sopTrades(B2, F, { from }).concat(M.barrierTrades(B2, F, { from })).map(key));
  for (const k of early) assert.ok(moved.has(k), 'depends on later prices: ' + k);
});

test('no hindsight: every entry of the full replay already exists when the candles are cut just after it (unaligned cuts, three markets)', () => {
  let seen = 0;
  for (const seed of POOL_SEEDS) { const A = ALL(seed), P = POOL(seed); seen += verify(seed, A.rows);
    // each reading on these candles has its own tight cut, and the pool's cuts are not aligned to a candle of any timeframe above M1
    assert.ok(P.first.size >= 10, 'readings with a tight cut of their own, seed ' + seed + ': ' + P.first.size); assert.ok(P.Ts.some((T) => T % 300 !== 0));
    for (const [f, T] of P.first) { const r = A.rows.find((x) => feats(x).includes(f) && knownAt(x) + (x.kind === 'sop' || x.nested ? 7 : 37) * 60 === T); assert.ok(r && ALL(seed, T).keys.has(keyOf(r)), `seed ${seed}: the first ${f} record is there ${r.kind === 'sop' ? 7 : 37} minutes after it is known`); } }
  assert.ok(seen >= 200, 'entries checked: ' + seen);
  assert.match(src, /M\.trade\.fillT !== L\[i\]\.time/); assert.match(src, /sort\(function \(x, y\) \{ return x\.breakIdx - y\.breakIdx; \}\)/);
});

test('outcome: the stop first when one candle holds both, a target in R, an open trade has no result', () => {
  const tr = { side: -1, entry: 100, stop: 104, target: 88 };
  assert.deepEqual(M.outcome(tr, [{ time: 10, high: 105, low: 87, close: 90 }], 10), { status: 'stopped', R: -1, endT: 10, exit: 104, mfe: 0 });
  const o = M.outcome(tr, [{ time: 5, high: 200, low: 0, close: 1 }, { time: 10, high: 101, low: 95, close: 96 }, { time: 20, high: 97, low: 88, close: 89 }], 10);
  assert.deepEqual([o.status, o.R, o.endT, o.exit], ['target', 3, 20, 88]); assert.equal(o.mfe, 1.25);
  const p = M.outcome(tr, [{ time: 10, high: 101, low: 98, close: 99 }], 10); assert.deepEqual([p.status, p.R, p.float], ['open', null, 0.25]);
  // 21 Nov 2026 (review): an entry at a close whose NEXT candle already opens beyond the stop exits at that open, worse than −1R
  // (it booked exactly −1R); a limit's own fill candle still stops at the stop, and a later candle that gaps books the gap
  const gapS = M.outcome(tr, [{ time: 10, open: 106, high: 107, low: 105, close: 106 }], 10); assert.deepEqual([gapS.status, gapS.R, gapS.exit, gapS.endT], ['stopped', -1.5, 106, 10]);
  const gapB = M.outcome({ side: 1, entry: 100, stop: 97, target: 109 }, [{ time: 10, open: 92, high: 93, low: 91, close: 92 }], 10); assert.deepEqual([gapB.status, gapB.exit], ['stopped', 92]); assert.ok(Math.abs(gapB.R + 8 / 3) < 1e-12, 'entry 100, stop 97, open 92: −2.67R');
  const lim = M.outcome(tr, [{ time: 10, open: 106, high: 107, low: 99, close: 106 }], 10, true); assert.deepEqual([lim.R, lim.exit], [-1, 104], 'a limit fills inside its candle: stopped at the stop');
  const limLater = M.outcome(tr, [{ time: 10, open: 100, high: 101, low: 99, close: 100 }, { time: 20, open: 106, high: 107, low: 105, close: 106 }], 10, true); assert.deepEqual([limLater.R, limLater.exit], [-1.5, 106]);
  assert.equal(M.outcome(tr, [{ time: 10, open: 103, high: 105, low: 102, close: 103 }], 10).R, -1, 'an open short of the stop: the stop');
  assert.doesNotMatch(src, /'Stopped: −1\.00R'/, 'the log says the booked R');
  const sm = M.summary([{ R: 3 }, { R: -1 }, { R: -1 }, { R: null }]); assert.deepEqual([sm.n, sm.closed, sm.open, sm.wins, sm.total], [4, 3, 1, 1, 1]);
  assert.ok(Math.abs(sm.mean - 1 / 3) < 1e-12 && Math.abs(sm.t - 0.25) < 1e-9, 'mean 0.333R, sd 2.309R, t 0.25');
});

test('the ladder is one timeframe lower at every step, with M30 between H1 and M15', () => {
  assert.deepEqual(M.LADDER, [['1d', '4h'], ['4h', '1h'], ['1h', '30m'], ['30m', '15m'], ['15m', '5m']]);
});

test('the card: on the Mosha desk, never for the teacher or a guest, and the code only reads candles and writes text', () => {
  assert.match(html, /<script src="\/assets\/mosha-sop\.js" defer><\/script>/); assert.match(html, /id="mo-sopr"/);
  assert.ok(html.indexOf('id="mo-sopr"') > html.indexOf('id="mo-sys"') && html.indexOf('id="mo-sopr"') < html.indexOf('id="mo-rules"'));
  assert.match(html, /html\[data-mosha="teach"\]:not\(\[data-role="owner"\]\) #v-mosha #mo-sopr \{ display: none; \}/);
  assert.equal(M.visible({ role: 'owner', mosha: 'teach' }), true); assert.equal(M.visible({ role: 'reviewer' }), true);
  assert.equal(M.visible({ role: 'viewer', mosha: 'teach' }), false); assert.equal(M.visible({ role: 'public' }), false);
  assert.doesNotMatch(src, /localStorage|sessionStorage|\/cdata|\/api\/|method:\s*'POST'|\.stop\s*=[^=]/, 'no storage, no API call, no stop moved');
  assert.deepEqual([...src.matchAll(/\.json\('([^']+)'\)/g)].map((m) => m[1]), ['mosha/desk.json'], 'the one council file it reads is the tracker\'s own record (21 Nov 2026), read only');
  assert.deepEqual([...src.matchAll(/fetch\('([^']+)'/g)].map((m) => m[1]), ['/md/bars?sym=xau&tf='], 'candles only');
  assert.match(src, /not Luxus\\'s trades and not the council\\'s, nothing was traded/); assert.match(src, /Too few to judge/); assert.match(src, /not a tested rule/);
  assert.doesNotMatch(src.replace(/not a tested (rule|edge)/g, ''), /\bedge\b(?!-lab)/i, 'never called an edge');
});

test('the replay leads the desk: closed R by day, and the card comes first for the owner and readers', () => {
  const d = M.byDay([{ R: 1, endT: 1794960000 }, { R: -1, endT: 1794960000 + 3600 }, { R: 3, endT: 1794960000 + 86400 }, { R: null, endT: null }, { R: 2, endT: null }]);
  assert.deepEqual(d.map((x) => [x.n, x.R]), [[2, 0], [1, 3]]);
  assert.equal(d.length, 2); assert.ok(d[0].day < d[1].day);
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  assert.match(html, /#v-mosha #mo-sopr \{ order: -10; \}/); assert.match(html, /#v-mosha #mo-replay \{ order: -9; \}/);
  assert.match(html, /c\.id === 'mo-rec' \|\| c\.id === 'mo-sopr'/);
  const js = fs.readFileSync(new URL('../assets/mosha-sop.js', import.meta.url), 'utf8');
  for (const k of ['mo-sop-ans', 'mo-sop-tiles', 'Open now', 'P&amp;L calendar', 'Too few']) assert.ok(js.includes(k), k);
});

test('another market gets the same reading at the same share of price: gold candles scaled to a forex price give the same trades, scaled', () => {
  const q = 1.15 / 4000, Bq = Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.map((b) => ({ time: b.time, open: b.open * q, high: b.high * q, low: b.low * q, close: b.close * q }))]));
  // gold's own sizes are dollars written near 4,000; at exactly that share of price the two readings must agree
  const g = sop.concat(bar);
  const e = M.sopTrades(Bq, F, { from, market: 'eurusd' }).concat(M.barrierTrades(Bq, F, { from, market: 'eurusd' }));
  assert.ok(e.length >= 3, 'entries on the scaled market: ' + e.length);
  for (const r of e) { assert.equal(r.market, 'eurusd'); assert.match(r.id, /^eurusd:(sop|bar)-/);
    assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1: ' + r.id);
    const z = M.sizes('eurusd', r.entry); assert.ok(r.r0 > 0 && r.r0 <= z.rmax * 1.0001 || r.kind === 'sop', 'risk within the scaled limit: ' + r.id);
    assert.doesNotMatch(r.log.map((x) => x.text).join(' '), /\$/, 'no dollar sign on a forex price'); }
  const same = e.filter((r) => g.some((x) => r.id === 'eurusd:' + x.id && x.side === r.side && Math.abs(x.entry * q - r.entry) < 1e-9));
  assert.ok(same.length >= Math.floor(0.8 * Math.max(e.length, g.length)), `same trades on both: ${same.length} of ${e.length} / ${g.length}`);
  for (const r of g) { assert.equal(r.market, 'xau'); assert.doesNotMatch(r.id, /:/); }
  assert.deepEqual(M.sizes('xau', 9999), { buf: 0.3, rmin: 0.8, rmax: 25, zmin: 0.5 }, 'gold keeps its dollar figures at any price');
  assert.deepEqual(Object.keys(M.MARKETS), ['xau', 'xag', 'eurusd', 'gbpusd', 'nas100']);
});

test('a CF inside the VR is the "likely to fail" case: recorded as its own reading (sop-c2-), never under the clean sequence\'s ids; off with case2: false', () => {
  let n2 = 0;
  for (const seed of [7, 11, 23, 31]) { const a = ALL(seed).sop, c2 = a.filter((r) => r.case2); n2 += c2.length;
    assert.ok(a.filter((r) => !r.case2).every((r) => r['case'] !== 2 && !/sop-c2-/.test(r.id)), 'no CF inside the VR among the clean sequence\'s records');
    for (const r of c2) { assert.equal(r['case'], 2); assert.match(r.id, /^sop-c2-(i-)?(4h|1h|30m|15m|5m)-\d+$/); assert.match(r.label, / VR, CF · CF inside the VR$/); assert.equal(r.kind, 'sop'); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.match(r.log[2].text, /inside the VR: the kind that often fails/); assert.ok(!a.some((q) => !q.case2 && q.id.replace('sop-', 'sop-c2-') === r.id), 'its id is its own'); }
    verify(seed, c2); }
  assert.ok(n2 >= 3, 'the case does occur on these candles: ' + n2);
  // off on request: every other entry is untouched; and the research option reads them as ordinary entries, as before
  const a = ALL(7).sop, off = sopOf(7, fr20(7), { case2: false }), mixed = sopOf(7, fr20(7), { case2: true });
  assert.deepEqual(off.map(keyOf), a.filter((r) => !r.case2).map(keyOf), 'the other entries are untouched');
  assert.ok(mixed.every((r) => !r.case2 && !/sop-c2-/.test(r.id))); assert.ok(mixed.some((r) => r['case'] === 2));
  // deduplicated only against its own kind: the same order under a clean id and a c2 id are two records, two c2 ids are one
  const o = { market: 'xau', kind: 'sop', h: '1h', l: '30m', side: 1, t: 1000, entry: 100, stop: 98, target: 104 };
  assert.deepEqual(M.uniq([{ ...o, id: 'sop-30m-1' }, { ...o, id: 'sop-c2-30m-1', case2: true }, { ...o, id: 'sop-c2-i-30m-1', case2: true, ibo: true }]).map((r) => r.id), ['sop-30m-1', 'sop-c2-30m-1']);
});

test('one order is recorded once: the major sequence over the internal one, the sequence over the repeat of the SOP, the higher timeframe\'s VR retest over the lower\'s', () => {
  const o = { market: 'xau', kind: 'sop', h: '1h', l: '30m', side: 1, t: 1000, entry: 4397.57, stop: 4393.99, target: 4403.87 };
  const ids = (rows) => M.uniq(rows).map((r) => r.id);
  // whatever order the rows come in, the kept one is the first by the fixed priority; the rows keep their order
  assert.deepEqual(ids([{ ...o, id: 'sop-i-30m-1', ibo: true }, { ...o, id: 'sop-30m-1' }]), ['sop-30m-1']);
  assert.deepEqual(ids([{ ...o, id: 'bar-sop-1h-b1000', kind: 'barrier', rsop: true }, { ...o, id: 'sop-i-30m-1', ibo: true }]), ['sop-i-30m-1'], 'the sequence, even an internal one, over the repeat of the SOP');
  assert.deepEqual(ids([{ ...o, id: 'sop-vr-5m-s1', h: '15m', l: '5m', retest: 'level' }, { ...o, id: 'sop-vr-15m-s1', h: '30m', l: '15m', retest: 'level' }]), ['sop-vr-15m-s1']);
  assert.deepEqual(ids([{ ...o, id: 'bar-1h-b1000', kind: 'barrier' }, { ...o, id: 'bar-1h-c15-b1000', kind: 'barrier' }]), ['bar-1h-b1000'], 'two barrier records: the first');
  // another side, fill, entry, stop or market is another order
  assert.equal(M.uniq([o, { ...o, side: -1 }, { ...o, t: 1060 }, { ...o, entry: 4397.58 }, { ...o, stop: 4393.98 }, { ...o, market: 'eurusd' }].map((r, i) => ({ ...r, id: 'x' + i }))).length, 6);
  // on seeded candles, as the tracker joins the two lists: no order twice, nothing else lost, and the sequence's record is the one kept
  let drops = 0;
  for (const seed of [3, 7, 11, 23, 31, 47]) { const A = ALL(seed), u = M.uniq(A.rows), gone = A.rows.filter((r) => !u.includes(r)); drops += gone.length;
    assert.equal(new Set(u.map(M.orderKey)).size, u.length, 'an order twice, seed ' + seed); assert.equal(new Set(u.map((r) => r.id)).size, u.length, 'an id twice');
    assert.equal(new Set(A.sop.map(M.orderKey)).size, A.sop.length, 'the sequence list alone holds no order twice (the BO\'s and the iBO\'s sequence, two ladder steps\' VR retest), seed ' + seed);
    for (const g of gone) { const k = u.find((r) => M.orderKey(r) === M.orderKey(g)); assert.ok(k, 'a dropped record has its kept twin'); assert.ok(k.kind === 'sop' || g.kind === 'barrier', 'never a sequence record dropped for a barrier one: ' + g.id + ' / ' + k.id);
      assert.deepEqual([k.side, k.t, k.entry, k.stop], [g.side, g.t, g.entry, g.stop]); } }
  assert.ok(drops >= 3, 'orders found under two ids on these candles: ' + drops);
  assert.match(fs.readFileSync(new URL('../council/mosha-desk.mjs', import.meta.url), 'utf8'), /SOP\.uniq\(seq\.concat\(SOP\.barrierTrades\(/);
});

test('two tags on every sequence record that change no trade: the weekly direction (last completed week against the one before) and the 20-day efficiency ratio, from Daily candles closed by the entry', () => {
  // hand-made Daily candles: Monday 2 Nov 2026 on, weekdays plus a Sunday stub each week; closes rise 10 a day for 5 weeks, then fall
  const d0 = Date.UTC(2026, 10, 2) / 1000, D = []; let c = 1000;
  for (let i = 0; i < 49; i++) { const t = d0 + i * 86400, wd = new Date(t * 1000).getUTCDay(); if (wd === 6) continue; if (wd === 0) { D.push({ time: t, open: c, high: c + 1, low: c - 1, close: c + 500 }); continue; }   // the stub's wild close must never be read
    c += i < 35 ? 10 : -10; D.push({ time: t, open: c, high: c + 1, low: c - 1, close: c }); }
  const mon = (w) => d0 + w * 7 * 86400 + 3600;   // an entry early on a Monday of week w
  assert.deepEqual(M.dayTags(D, mon(1), 1), { withWeekly: null, er20: null }, 'one completed week: no direction yet');
  assert.deepEqual(M.dayTags(D, mon(2), 1), { withWeekly: true, er20: null }); assert.equal(M.dayTags(D, mon(2), -1).withWeekly, false);
  assert.deepEqual(M.dayTags(D, mon(5), 1), { withWeekly: true, er20: 1 }, '25 closed trading days, every close up: efficiency 1, the Sunday stubs left out');
  assert.deepEqual(M.dayTags(D, mon(6), -1), { withWeekly: true, er20: 0.5 }, 'week 6 closed below week 5 (of the last 20 days 15 up then 5 down: a net 100 on a path of 200)');
  // an entry later in a week reads the same two COMPLETED weeks; the week's own days move only the efficiency ratio
  assert.equal(M.dayTags(D, mon(6) + 3 * 86400, -1).withWeekly, true); assert.equal(M.dayTags(D, mon(5) + 4 * 86400, 1).withWeekly, true, 'Friday of week 5: still weeks 3 and 4');
  // nothing after the entry is read: later candles changed or cut away give the same tags
  for (const t of [mon(2), mon(5) + 2 * 86400, mon(6)]) { const cutD = D.filter((b) => b.time + 86400 <= t), wild = D.map((b) => b.time + 86400 <= t ? b : { ...b, close: b.close * 3 });
    assert.deepEqual(M.dayTags(cutD, t, 1), M.dayTags(D, t, 1)); assert.deepEqual(M.dayTags(wild, t, 1), M.dayTags(D, t, 1)); }
  assert.deepEqual(M.dayTags([], 5, 1), { withWeekly: null, er20: null }); assert.deepEqual(M.dayTags(undefined, 5, 1), { withWeekly: null, er20: null });
  // on the replay: every sequence record carries what the Daily candles closed by its entry give, and the cut replays agree (keyOf holds both tags)
  let w = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed);
    for (const r of ALL(seed).sop) { assert.deepEqual({ withWeekly: r.withWeekly, er20: r.er20 }, M.dayTags(X['1d'].filter((b) => b.time + 86400 <= r.t), r.t, r.side), r.id); if (r.withWeekly != null) w++; }
    assert.ok(ALL(seed).bar.every((r) => !('er20' in r) && !('withWeekly' in r)), 'sequence records only'); }
  assert.ok(w >= 5, 'records with a weekly direction: ' + w);
  // with enough Daily history the ratio is a number on the replay's own records
  const X = market(26, 7), pre = Array.from({ length: 40 }, (_, i) => { const t = X['1d'][0].time - (40 - i) * 86400, p = 3900 + 2.5 * i; return { time: t, open: p, high: p + 3, low: p - 3, close: p + 1 }; }), D1 = pre.concat(X['1d']);
  const long = M.sopTrades({ ...X, '1d': D1 }, F, { from: endOf(7) - 5 * 86400 }); assert.ok(long.length >= 1);
  for (const r of long) { assert.ok(r.er20 > 0 && r.er20 <= 1 && typeof r.withWeekly === 'boolean', r.id); assert.equal(r.er20, +r.er20.toFixed(2)); assert.deepEqual({ withWeekly: r.withWeekly, er20: r.er20 }, M.dayTags(D1.filter((b) => b.time + 86400 <= r.t), r.t, r.side)); }
});

test('a barrier trade says whether it is with or against the direction of the timeframe above, read on candles closed at the return', () => {
  let w = 0, a = 0, n = 0;
  for (const seed of POOL_SEEDS) { const rows = ALL(seed).bar, dir = [];
    for (const r of rows) { if (r.h === '1d') { assert.equal(r.withDir, null); continue; }
      if (r.withDir == null) { assert.ok(!/with |against /.test(r.label)); continue; }
      r.withDir ? w++ : a++; assert.match(r.label, r.withDir ? / · with (D1|H4|H1)$/ : / · against (D1|H4|H1)$/); assert.ok(r.log.some((x) => /direction/.test(x.text))); dir.push(r); }
    // the same answer with every candle after the return cut away (the record's key holds it)
    n += verify(seed, dir); }
  assert.ok(w >= 1 && a >= 1, 'both kinds occur: ' + w + ' / ' + a); assert.ok(n >= 50, 'checked against a cut: ' + n);
});

test('the CF as a barrier: the sequence hands its clean CF zones over, and the barrier entry reads them without hindsight', () => {
  let n = 0;
  for (const seed of [3, 7, 11, 23, 31]) { const A = ALL(seed), X = market(26, seed), cfz = A.z;
    assert.ok(cfz.every((z) => (z.kind === 'cf' || z.kind === 'vr') && z.hi > z.lo && z.known > 0 && (z.dir === 1 || z.dir === -1)));
    assert.equal(new Set(cfz.map((z) => z.tf + '|' + z.lo + '|' + z.hi + '|' + z.known)).size, cfz.length, 'each CF zone once');
    if (seed === 7) assert.ok(barOf(7, A.fr).every((r) => !/(CF|VR) barrier/.test(r.label)), 'without the hand-over nothing changes');
    const cf = A.bar.filter((r) => /CF barrier/.test(r.label));
    for (const r of cf) { n++; assert.match(r.id, /bar-(j-|sop-)?cf-/); assert.equal(r.kind, 'barrier'); assert.ok(rule1(r), 'rule 1');
      if (!r.rsop) assert.ok(Math.abs(r.target - r.entry) / r.r0 >= 1 - 1e-9); assert.ok(r.log[0].t <= r.log[1].t && r.log[1].t <= r.log[2].t && r.log[2].t <= r.t, 'known, then the return, then the QM, then the fill');
      // the sequence's rule: no entry once price reached the VR's extreme after the CF was known
      const fine = X['1m'], tg = r.zone.tgt; if (isFinite(tg)) assert.ok(!fine.some((b) => b.time >= r.zone.known && b.time < r.t && (r.side > 0 ? b.high >= tg : b.low <= tg)), 'no entry after the VR extreme was reached: ' + r.id); }
    // cut just after it is known: the same entry is already there
    verify(seed, cf); }
  assert.ok(n >= 1, 'CF barrier entries on these candles: ' + n);
});

// 21 Nov 2026: the parts of the method's pages the replay did not yet apply
test('the CF hand-over: only on the candle whose close made the CF, never a CF from before the window, and the same with later candles cut', () => {
  let n = 0, c = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), fr = fr20(seed), z = ALL(seed).z; n += z.length;
    for (const q of z) { assert.ok(q.known >= fr, 'handed over inside the window: ' + q.known);
      assert.ok(X[q.tf].some((b) => b.time + M.SEC[q.tf] === q.known), 'known = the close of a candle of its timeframe');
      const T = cutFor(seed, q.known); if (T == null) continue; c++;
      assert.ok(ALL(seed, T).z.some((p) => p.kind === q.kind && p.tf === q.tf && p.known === q.known && p.lo === q.lo && p.hi === q.hi), 'already there in the first cut after its own close'); }
    if (seed !== 7) continue;
    // exactly at its own close too
    for (const q of z.slice(0, 2)) { const z2 = []; M.sopTrades(cut(X, q.known), F, { from: fr, cfOut: z2 }); assert.ok(z2.some((p) => p.kind === q.kind && p.tf === q.tf && p.known === q.known && p.lo === q.lo && p.hi === q.hi), 'already there at its own close'); }
    // a CF that closed before the window is not handed over at the window's first candle
    const late = fr + 3 * 86400, z3 = []; M.sopTrades(X, F, { from: late, cfOut: z3 });
    assert.ok(z3.every((q) => q.known >= late)); }
  assert.ok(n >= 4 && c >= 4, 'zones handed over: ' + n + ', checked against a cut: ' + c);
});

test('the Janda: a QM at the barrier, then the next break the same way is a normal BO; the limit at the engulf zone inside that BO\'s leg, a stop on the losing side, no hindsight', () => {
  let n = 0;
  for (const seed of [7, 11, 23, 31]) { const X = market(26, seed), J = ALL(seed).bar.filter((r) => r.janda);
    for (const r of J) { n++; assert.match(r.id, /bar-j-/); assert.match(r.label, / · Janda/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const qmL = Number(/closed (?:above|below) ([0-9]+\.[0-9]+)/.exec(r.log[2].text)[1]), boL = Number(/closed (?:above|below) ([0-9]+\.[0-9]+)/.exec(r.log[3].text)[1]), ez = /engulf zone inside that BO's leg runs ([0-9.]+) to ([0-9.]+)/.exec(r.log[3].text);
      assert.ok(r.side > 0 ? boL > qmL : boL < qmL, 'the Janda BO is beyond the QM');
      // 21 Nov 2026: the limit rests at the near side of the engulf zone inside the second BO's leg, on the pullback side of that BO's level, never at the level itself
      assert.ok(ez, 'the engulf zone is named: ' + r.id); assert.ok(Math.abs(r.entry - Number(r.side > 0 ? ez[2] : ez[1])) < 0.006, 'the limit is the zone\'s near side');
      const boC = X[r.l].find((b) => b.time + M.SEC[r.l] === r.log[3].t); assert.ok(boC && (r.side > 0 ? r.entry < boC.close : r.entry > boC.close), 'the limit waits on the pullback side of the BO candle\'s close: ' + r.id);
      const zm = r.marks.find((m) => / Janda EG zone$/.test(m.label)); assert.ok(zm && zm.top > zm.bot && zm.a <= r.log[3].t, 'the zone is on the chart, from a candle closed by the BO');
      // the zone is the PAIR: the candle against the break and the first candle after it that closes beyond its far edge, both closed by the BO
      const C1 = X[r.l], i0 = C1.findIndex((b) => b.time === zm.a), i1 = C1.findIndex((b, q) => q > i0 && b.time + M.SEC[r.l] <= r.log[3].t && (r.side < 0 ? b.close < C1[i0].low : b.close > C1[i0].high));
      assert.ok(i0 >= 0 && i1 > i0, 'the engulfing candle exists: ' + r.id); assert.ok(Math.abs(r.entry - (r.side < 0 ? Math.min(C1[i0].low, C1[i1].low) : Math.max(C1[i0].high, C1[i1].high))) < 1e-9, 'the near side is the pair\'s, not only the engulfed candle\'s');
      assert.ok(r.log[2].t <= r.log[3].t && r.log[3].t <= r.t, 'QM, then the BO, then the fill'); }
    verify(seed, J); }
  assert.ok(n >= 1, 'Janda entries on these candles: ' + n);
  // the older reading on request: the limit at the level the second BO broke
  const old = barOf(7, fr20(7), { janda: 'level' }).filter((r) => r.janda);
  assert.ok(old.length >= 1); for (const r of old) { assert.equal(r.entry.toFixed(2), /closed (?:above|below) ([0-9]+\.[0-9]+)/.exec(r.log[3].text)[1]); assert.ok(!r.marks.some((m) => /Janda EG zone/.test(m.label))); }
});

test('the VR box as a barrier the other way, from the moment its CF made a range; a stop on the losing side, no hindsight', () => {
  let n = 0, c = 0;
  for (const seed of [7, 11, 23, 31, 47]) { const A = ALL(seed), z = A.z;
    for (const v of z.filter((q) => q.kind === 'vr')) { const cf = z.find((q) => q.kind === 'cf' && q.known === v.known && q.tf === v.tf); assert.ok(cf && cf.dir === -v.dir, 'a VR goes with its CF, the other way'); }
    const V = A.bar.filter((r) => /VR barrier/.test(r.label));
    for (const r of V) { n++; assert.match(r.id, /bar-(j-|sop-)?vr-/); assert.ok(rule1(r), 'rule 1: ' + r.id); }
    c += verify(seed, V); }
  assert.ok(n >= 1 && c >= 1, 'VR barrier entries on these candles: ' + n + ', checked against a cut: ' + c);
});

test('an internal BO starts the same BO, VR, CF sequence, recorded apart; off with ibo: false; no hindsight', () => {
  let n = 0, c = 0;
  for (const seed of [3, 11, 23, 31]) { const s = ALL(seed).sop, I = s.filter((r) => r.ibo);
    if (seed === 11) assert.deepEqual(sopOf(seed, fr20(seed), { ibo: false }).map(keyOf), s.filter((r) => !r.ibo).map(keyOf), 'the major sequence is untouched');
    assert.ok(I.filter((r) => !r.case2).every((r) => r['case'] !== 2), 'the case-2 rule holds for internal sequences too');
    for (const r of I) { n++; assert.match(r.id, /sop-(c2-)?i-/); assert.match(r.label, / iBO → /); assert.match(r.log[0].text, / iBO (buy|sell): /); assert.ok(rule1(r), 'rule 1: ' + r.id); }
    c += verify(seed, I); }
  assert.ok(n >= 3 && c >= 1, 'iBO sequence entries on these candles: ' + n + ', checked against a cut: ' + c);
});

test('the Janda\'s second table: an H4 barrier may also confirm on M1 and an H1 barrier on M1, only where one-minute candles exist', () => {
  assert.deepEqual(M.JANDA_ALT, { '4h': '1m', '1h': '1m' });
  let n = 0, c = 0;
  for (const seed of POOL_SEEDS) { const full = ALL(seed).rows, A = full.filter((r) => r.jandaM1);
    for (const r of A) { n++; assert.ok(r.janda && r.l === '1m' && (r.h === '4h' || r.h === '1h'), r.id); assert.match(r.id, /bar-j-.*-1m-/); assert.match(r.label, / · Janda \(M1\)/); assert.ok(rule1(r), 'rule 1: ' + r.id); }
    c += verify(seed, A);
    assert.ok(full.filter((r) => r.kind === 'barrier' && !r.janda && !r.m5 && !r.alt && !r.nested).every((r) => r.l === M.BARRIER.concat(M.BARRIER30).find((p) => p[0] === r.h)[1]));
    if (seed !== 7) continue;
    // no one-minute candles: no M1 alternative, and the simple CF never uses it
    const no1 = { ...market(26, seed) }; delete no1['1m']; const z = []; M.sopTrades(no1, F, { from: fr20(seed), cfOut: z });
    assert.ok(M.barrierTrades(no1, F, { from: fr20(seed), extra: z }).every((r) => !r.jandaM1)); }
  assert.ok(n >= 1 && c >= 1, 'M1 Janda entries on these candles: ' + n);
});

// 21 Nov 2026: the owner's four readings, decided after comparing the desk with his own example trades. Each is its own record
// beside the older ones (the older records are pinned below exactly as the code before gave them).
// 21 Nov 2026 (later): the second table's confirmations (r.alt, M30 barriers) and the repeat of the SOP (r.rsop) are new readings too
const isNew = (r) => !!(r.jandaM1 || r.m5 || r.atZone || r.visit > 1 || r.sweep || r.alt || r.rsop || r.h === '30m' || r.eg);
test('the older records still appear exactly as before, and every new reading is recorded beside them', async () => {
  const { createHash } = await import('node:crypto'), key = (r) => [r.id.replace(/-[bs](\d+)$/, '-$1'), r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4), r.status].join('|');
  // hashes of the code before these readings (the sequence with the protected-swing VR, the barriers without the new readings)
  // pins = the code of 495073158 with an M1 Janda counted as its own reading (review, 21 Nov 2026)
  const PIN = { 7: [55, 'bb53a8ed7f0db3e3'], 11: [52, 'b6d7de54ab81d515'] }, seen = { m5: 0, atZone: 0, sweep: 0, visit: 0 };
  for (const seed of [7, 11]) { const fr = fr14(seed), bars = barOf(seed, fr);
    // the pages applied to the detail (21 Nov 2026) changed three rules on purpose: the VR and CF read the small swings, a barrier's
    // box runs from the broken level to the origin extreme, the Janda's limit rests at the engulf zone. Each keeps an option that
    // reads it the older way (vr 'major', box 'candle', janda 'level', and qm 'internal' for the QM at a barrier): with them the older records are exactly the pinned ones.
    // (case2 false: a CF inside the VR was not recorded then; it is its own reading since 21 Nov 2026)
    const olds = barOf(seed, fr, { box: 'candle', janda: 'level', qm: 'internal', rr: 3 });   // rr 3: the barrier target until 22 Nov 2026 (1R since, the owner's choice)
    const old = sopOf(seed, fr, { near: false, retest: false, vr: 'major', case2: false }).concat(olds).filter((r) => !isNew(r)).map(key).sort();
    // review 21 Nov 2026: a buy and a sell filled in one minute are two records (the side is in the id), and no id twice
    assert.equal(new Set(bars.map((r) => r.id)).size, bars.length, 'no barrier id twice, seed ' + seed); assert.ok(bars.every((r) => /-[bs]\d+$/.test(r.id)), 'the side is in the id');
    assert.deepEqual([old.length, createHash('sha256').update(old.join('\n')).digest('hex').slice(0, 16)], PIN[seed], 'seed ' + seed + ': the older records changed');
    for (const r of bars.filter(isNew)) { if (r.m5) seen.m5++; if (r.atZone) seen.atZone++; if (r.sweep) seen.sweep++; if (r.visit > 1) seen.visit++;
      assert.ok(rule1(r), 'rule 1: ' + r.id); const g = M.readings({ id: r.id }); assert.deepEqual([g.m5, g.atZone, g.sweep, g.visit, g.alt, g.rsop, g.m30], [!!r.m5, !!r.atZone, !!r.sweep, r.visit, r.alt || null, !!r.rsop, r.h === '30m'], 'the reading is read back from the id alone: ' + r.id);
      // a new reading never repeats an order already recorded (same side, price and fill)
      assert.ok(!bars.some((q) => q !== r && !isNew(q) && q.side === r.side && q.t === r.t && Math.abs(q.entry - r.entry) < 1e-9), 'a duplicate order: ' + r.id); } }
  for (const k of Object.keys(seen)) assert.ok(seen[k] >= 1, k + ' records on these candles: ' + seen[k]);
});

test('entry at the zone: a second limit at the barrier zone\'s near side, only when the QM closed outside it; stop on the losing side; no hindsight', () => {
  let n = 0, c = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), Z = ALL(seed).rows.filter((r) => r.atZone);
    for (const r of Z) { n++; assert.match(r.id, /-z-[bs]\d+$/); assert.match(r.label, / · at the zone/); assert.ok(!r.janda, 'the simple CF only'); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.equal(r.entry, r.side < 0 ? r.zone.lo : r.zone.hi, 'the limit sits at the near side of the barrier');
      const qm = M.SEC[r.l], cd = X[r.l].find((b) => b.time + qm === r.log[2].t); assert.ok(cd && (r.side < 0 ? cd.close < r.entry : cd.close > r.entry), 'the QM candle closed outside the zone');
      assert.ok(r.log[2].t <= r.t, 'placed at the QM, filled after'); }
    c += verify(seed, Z); }
  assert.ok(n >= 1 && c >= 1, 'entries at the zone: ' + n);
});

test('M5 confirm: H4 and M15 barriers also confirmed on M5 (never D1, never H1, whose table timeframe is M5 already); no hindsight', () => {
  assert.deepEqual(M.M5_ALT, { '4h': '5m', '15m': '5m' });
  let n = 0, c = 0;
  for (const seed of POOL_SEEDS) { const A = ALL(seed).rows.filter((r) => r.m5);
    for (const r of A) { n++; assert.ok((r.h === '4h' || r.h === '15m') && r.l === '5m', r.id); assert.match(r.id, /-m5-/); assert.match(r.label, / · M5 confirm/); assert.ok(rule1(r), 'rule 1: ' + r.id); }
    c += verify(seed, A); }
  assert.ok(n >= 1 && c >= 1, 'M5-confirmed entries: ' + n);
});

test('sweep barrier: a swing that a candle trades beyond and closes back inside; a close beyond is a break, not a sweep (hand-made candles)', () => {
  const c = (t, o, h, l, cl) => ({ time: t * 900, open: o, high: h, low: l, close: cl }), base = [100, 101, 102, 103, 104, 103, 102, 101, 100].map((p, i) => c(i, p - 0.5, p, p - 1, p - 0.5));
  // swing high 104 at index 4 (3 candles a side); candle 9 wicks to 105 and closes at 103.5: a sell sweep barrier from 104 to 105
  const sw = M.sweepsOf('15m', { '15m': base.concat([c(9, 100, 105, 99.5, 103.5), c(10, 103, 103.5, 101, 101)]) }).filter((z) => z.dir < 0);
  assert.equal(sw.length, 1); assert.deepEqual([sw[0].lo, sw[0].hi, sw[0].level, sw[0].x0, sw[0].touch, sw[0].wait, sw[0].known], [104, 105, 104, 105, 9 * 900, 10 * 900, 8 * 900]);
  // the same wick closing ABOVE the swing breaks it: no barrier
  assert.equal(M.sweepsOf('15m', { '15m': base.concat([c(9, 100, 105, 99.5, 104.5)]) }).filter((z) => z.dir < 0).length, 0);
  // only the first candle beyond decides: a later sweep of an already broken swing is not a barrier
  assert.equal(M.sweepsOf('15m', { '15m': base.concat([c(9, 100, 104.6, 99.5, 104.2), c(10, 104, 105, 103, 103.5)]) }).filter((z) => z.dir < 0).length, 0);
  // seeded: every sweep record's barrier candle took the swing and closed back, and its confirmation closed after that candle
  let n = 0, k = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), S = ALL(seed).rows.filter((r) => r.sweep);
    for (const r of S) { n++; assert.match(r.id, /bar-(j-|sop-)?sw-/); assert.match(r.label, /sweep barrier · swing (high|low)/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const H = X[r.h], b = H[H.findIndex((q) => q.time === r.zone.touch)], p = r.zone.level;
      assert.ok(r.side < 0 ? b.high > p && b.close <= p : b.low < p && b.close >= p, 'swept and closed back: ' + r.id);
      assert.ok(r.log[2].t >= r.zone.wait + M.SEC[r.l], 'the QM closed after the sweeping candle closed'); }
    k += verify(seed, S); }
  assert.ok(n >= 1 && k >= 1, 'sweep entries: ' + n);
});

test('second visits: a zone taken again after price left it and came back, before it was broken; the visits are the same with later candles cut', () => {
  let n = 0, z2 = 0, c = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), e = endOf(seed);
    for (const tf of ['1h', '15m']) { const H = X[tf], zs = M.zonesOf(tf, X, F), T = e - 6 * 86400, cutZ = M.zonesOf(tf, cut(X, T), F);
      for (const z of zs) { const all = [z.touch].concat(z.visits); if (!z.visits.length) continue; z2++;
        for (let v = 1; v < all.length; v++) { const a = H.findIndex((b) => b.time === all[v - 1]), b = H.findIndex((q) => q.time === all[v]); assert.ok(b > a);
          assert.ok(H.slice(a + 1, b).some((q) => z.dir < 0 ? q.high < z.lo : q.low > z.hi), 'price left the zone in between');
          assert.ok(z.dir < 0 ? H[b].high >= z.lo : H[b].low <= z.hi, 'the visit candle trades into it');
          assert.ok(!H.slice(H.findIndex((q) => q.time + M.SEC[tf] === z.known), b).some((q) => z.dir < 0 ? q.close > z.hi : q.close < z.lo), 'not broken before the visit'); }
        const cz = cutZ.find((q) => q.known === z.known && q.lo === z.lo && q.hi === z.hi && q.dir === z.dir);
        if (cz) assert.deepEqual(cz.visits, z.visits.filter((t) => t + M.SEC[tf] <= T), 'the same visits with later candles cut'); } }
    const V = ALL(seed).rows.filter((r) => r.visit > 1);
    for (const r of V) { n++; assert.match(r.id, /-v\d+-/); assert.match(r.label, r.visit === 2 ? / · second visit/ : / · visit \d/); assert.ok(rule1(r), 'rule 1: ' + r.id); assert.match(r.log[1].text, /left the barrier and came back/); }
    c += verify(seed, V); }
  assert.ok(z2 >= 1 && n >= 1 && c >= 1, 'zones with later visits: ' + z2 + ', entries: ' + n);
});

test('the VR from the nearest swing (msMosha o.near): the box ends at the last internal swing before the extreme, known when the VR formed', () => {
  // a buy BO at t 0; the leg rises with a swing low at 104 (3 candles a side) before the extreme 112; the VR (a sell QM) breaks the protected low 100
  const p = [101, 103, 105, 107, 106, 105, 104, 105, 106, 107, 109, 111, 112, 110, 108, 106, 104, 102, 99];
  const bars = p.map((x, i) => ({ time: (i + 1) * 300, open: x, high: x + 0.5, low: x - 0.5, close: x }));
  const V = { dir: -1, level: 100, t: 19 * 300, fromT: 300, top: 101, bot: 99, structure: true }, htf = { dir: 1, level: 98, t: 0, ext: NaN, far: 90 };
  const old = F.msMosha(htf, { events: [V], bars }, 0.3), nr = F.msMosha(htf, { events: [V], bars }, 0.3, { near: true });
  assert.deepEqual([old.vr.lo, old.vr.hi, !!old.vr.near], [100, 112.5, false], 'without o: the protected level, as the charts read it');
  assert.deepEqual([nr.vr.lo, nr.vr.hi, nr.vr.near, nr.vr.ext], [103.5, 112.5, true, 112.5], 'with o.near: the nearest swing low before the extreme');
  // a swing low at 104 whose third candle after it closes only after the VR formed is not known yet: the box stays as before
  const q = [101, 103, 105, 107, 106, 105, 104, 106, 112, 105, 103].map((x, i) => ({ time: (i + 1) * 300, open: x, high: x + 0.5, low: x - 0.5, close: x }));
  assert.equal(F.msMosha(htf, { events: [{ ...V, t: 9 * 300 }], bars: q }, 0.3, { near: true }).vr.lo, 100);
  assert.equal(F.msMosha(htf, { events: [{ ...V, t: 10 * 300 }], bars: q }, 0.3, { near: true }).vr.lo, 103.5, 'once confirmed it is taken');
  // the sequence uses it by default; the older reading's entries all remain (a smaller box only turns a CF inside the VR into a clean one) with the same levels
  for (const seed of [7, 11]) { const fr = fr14(seed), a = sopOf(seed, fr, { near: false, retest: false, vr: 'major', case2: false }), b = sopOf(seed, fr, { retest: false, vr: 'major', case2: false });
    for (const r of a) { const x = b.find((y) => y.id === r.id); assert.ok(x, 'the older entry remains: ' + r.id); assert.deepEqual([x.entry, x.stop, x.target], [r.entry, r.stop, r.target]); }
    assert.ok(b.every((r) => r['case'] !== 2 && rule1(r))); }
});

// 21 Nov 2026 (owner, on two EUR/USD buys: "this should be a sell"): once the chart under the BO has turned the other way on its
// small swings, the BO gives no more entries; the VR level is traded the other way on its retest (at the level, stop past the
// VR's top; or a new CF after the touch, stop past the CF box), target the last low.
test('after a turn the VR is retested the other way: a stop on the losing side, the last low as target, no hindsight; off with retest: false', () => {
  let n = 0, c = 0;
  for (const seed of [3, 7, 11, 23, 31, 47]) { const s = ALL(seed).sop, R = s.filter((r) => r.retest);
    if (seed === 7) assert.ok(sopOf(seed, fr20(seed), { retest: false }).every((r) => !r.retest));
    // a retest needs price to have gone 1R past the VR level first; the old BO's entries stop only from then
    assert.ok(R.every((r) => r.log.some((x) => / turned (buy|sell)/.test(x.text))));
    for (const r of R) { n++; assert.ok(rule1(r), 'rule 1: ' + r.id); assert.match(r.id, /sop-v[rc]-/); assert.match(r.label, / turned → .* VR retest/);
      const lt = r.log.map((x) => x.t).filter(Boolean); assert.ok(lt.every((t, i) => !i || t >= lt[i - 1]), 'log in time order: ' + r.id);   // an open trade's last line has no time
      assert.equal(r.log.filter((x) => /^(Stopped|Target reached|Still open)/.test(x.text)).length, 1, 'one result line: ' + r.id);
      // a limit's own fill candle can only stop it: never a target booked on the candle that filled it
      if (r.retest === 'level' && r.status === 'target') assert.ok(r.endT > r.t, 'the fill candle is not a target: ' + r.id); }
    // a limit at the level rests from the touch candle's open and is seen once that candle closed; a new CF at its close (knownAt)
    c += verify(seed, R); }
  assert.ok(n >= 1 && c >= 10, 'VR retest entries on these candles: ' + n + ', checked against a cut: ' + c);
});

// 21 Nov 2026 (owner: "build", after the page-by-page review): the method's pictures and tables applied to the detail. Three
// are rule changes with an option that reads the older way (vr 'major', box 'candle', janda 'level'); two add records of their
// own (the second confirmation table, the repeat of the SOP at a barrier).
test('a barrier\'s box runs from the swing level the break took to the origin extreme of the leg; box "candle" keeps the charts\' one-candle zone', () => {
  // hand-made M15 candles: a swing high 105 (3 a side), a pullback to 101, a close above 105: the demand box is 101 (the leg's low) to 105 (the level)
  const px = [100, 102, 103, 105, 104, 103, 102, 101.5, 103, 104, 106, 107], H = px.map((p, i) => ({ time: i * 900, open: p - 0.4, high: p, low: i === 7 ? 101 : p - 0.8, close: p - 0.2 }));
  const F1 = { msAnalyze: () => ({ events: [] }), msInternal: () => [{ dir: 1, level: 105, fromIdx: 3, breakIdx: 10 }], msZones: F.msZones };
  const z = M.zonesOf('15m', { '15m': H }, F1, { eg: false }), zc = M.zonesOf('15m', { '15m': H }, F1, { box: 'candle' });
  assert.deepEqual([z.length, z[0].dir, z[0].lo, z[0].hi, z[0].known, z[0].touch], [1, 1, 101, 105, 11 * 900, null], 'level to the origin low, known at the break candle\'s close');
  assert.equal(zc.length, 1); assert.ok(zc[0].hi < 105 && zc[0].lo === 101, 'the charts\' zone is the last opposite candle at the origin: ' + zc[0].lo + ' to ' + zc[0].hi);
  // price back at the level touches the box at once; a close under the origin low breaks it
  const back = H.concat([{ time: 12 * 900, open: 106.5, high: 107, low: 104.9, close: 106 }]);
  assert.equal(M.zonesOf('15m', { '15m': back }, F1, { eg: false })[0].touch, 12 * 900); assert.equal(M.zonesOf('15m', { '15m': back }, F1, { box: 'candle' })[0].touch, null, 'the one-candle zone is not reached yet');
  // seeded: every box has the break candle closing beyond its near side, and no candle of the leg beyond its far side; the same box with later candles cut
  let n = 0;
  for (const seed of [7, 11]) { const X = market(26, seed), e = endOf(seed);
    for (const tf of ['4h', '1h', '15m']) { const Hx = X[tf], zs = M.zonesOf(tf, X, F, { eg: false }), T = e - 6 * 86400, cz = M.zonesOf(tf, cut(X, T), F, { eg: false });
      for (const q of zs) { n++; assert.ok(q.hi > q.lo && (q.kind === 'bo' || q.kind === 'ibo'));
        const bi = Hx.findIndex((b) => b.time + M.SEC[tf] === q.known), b = Hx[bi]; assert.ok(q.dir > 0 ? b.close > q.hi : b.close < q.lo, 'the break candle closed beyond the level');
        let oi = bi - 1; while (oi > 0 && (q.dir > 0 ? Hx[oi].low !== q.lo : Hx[oi].high !== q.hi)) oi--;
        assert.ok(Hx.slice(oi, bi).every((c) => q.dir > 0 ? c.low >= q.lo : c.high <= q.hi), 'the far side is the leg\'s extreme');
        if (q.known <= T) { const c = cz.find((p) => p.known === q.known && p.dir === q.dir && p.lo === q.lo && p.hi === q.hi); assert.ok(c, 'the same box when later candles are cut'); if (q.touch && q.touch + M.SEC[tf] <= T) assert.equal(c.touch, q.touch); } }
      assert.equal(new Set(zs.map((q) => q.dir + '|' + q.lo + '|' + q.hi + '|' + q.known)).size, zs.length, 'no box twice'); } }
  assert.ok(n >= 50, 'boxes checked: ' + n);
});

test('the VR and the CF are breaks of the chart\'s small swings (3 a side): the VR is the close through the small swing right before the extreme; vr "major" reads the protected swing', () => {
  // a BO above 110, a higher low 113.8, the top 130.2, then a shallow dip (123.8) and a lower high (128.2) UNDER the top, then the fall.
  // The swing the last leg to the top came from is 113.8: its break is the BO Structure and the VR runs 113.8 to 130.2. The dip
  // formed after the extreme is not a level (until 21 Nov 2026 the first small-swing reading took it: VR 123.8 to 130.2).
  const leg = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n); let p = [100]; const go = (to, n) => { p = p.concat(leg(p.at(-1), to, n)); };
  go(110, 5); go(104, 5); go(120, 6); go(114, 4); go(130, 6); go(124, 4); go(128, 4); go(118, 5); go(121, 4); go(108, 6); go(112, 4); go(104, 5); go(116, 6); go(111, 3); go(125, 6);
  const W = p.slice(1).map((b, i) => ({ time: (i + 1) * 3600, open: p[i], close: b, high: Math.max(p[i], b) + 0.2, low: Math.min(p[i], b) - 0.2 })), r1 = (v) => Math.round(v * 10) / 10;
  const sw = M.swingEv(F, W), qms = sw.filter((e) => e.structure);
  assert.deepEqual(qms.map((e) => [e.dir, r1(e.level), r1(e.dir < 0 ? e.hi : e.lo)]), [[-1, 113.8, 130.2], [1, 112.2, 103.8]], 'the QM down breaks the last swing before the top; the QM up the last swing high before the low; each box reaches the extreme');
  assert.ok(F.msInternal(W, W.length, 3).some((e) => e.structure && r1(e.level) === 123.8), 'the page\'s internal breaks do take the dip after the top: not what the sequence reads');
  assert.ok(sw.every((e) => r1(e.level) !== 123.8 && r1(e.level) !== 128.2), 'no level from a pivot formed after the extreme');
  const ev = M.smallEv(F, W), bo = sw.find((e) => e.dir > 0 && r1(e.level) === 110.2);
  const m = F.msMosha({ dir: 1, level: 110.2, t: W[bo.breakIdx].time, ext: NaN, far: 103.8 }, { events: ev, bars: W }, 0.3, { near: true });
  assert.deepEqual([r1(m.vr.lo), r1(m.vr.hi), r1(m.cf.lo), r1(m.cf.hi), m['case']], [113.8, 130.2, 103.8, 112.2, 1], 'the VR box: the last swing before the extreme to the extreme; the CF zone holds the retracement low');
  // on seeded candles: every QM's swing was made before the extreme of the move it ends
  for (const seed of [7, 11]) { const L = market(8, seed)['15m'], E = M.swingEv(F, L); let n = 0;
    for (const [k, e] of E.entries()) { if (!e.structure) continue; n++; let xi = E[k - 1].breakIdx; for (let q = xi; q <= e.breakIdx; q++) if (e.dir < 0 ? L[q].high > L[xi].high : L[q].low < L[xi].low) xi = q;
      assert.ok(e.fromIdx <= xi || (e.dir < 0 ? L[e.fromIdx].low === e.level : L[e.fromIdx].high === e.level) && L.slice(e.fromIdx, e.breakIdx).every((b) => (e.dir < 0 ? b.close >= e.level : b.close <= e.level)), 'a QM breaks the swing before the extreme (or that level moved to a wick that swept it)');
      if (e.fromIdx > xi) assert.ok(E.slice(0, k).some((q) => q.dir !== e.dir), 'only a swept level sits after the extreme'); }
    assert.ok(n >= 5, 'QMs checked: ' + n); }
  // an event at a candle reads nothing after it: the same events with later candles cut away
  for (const seed of [7, 11]) { const L = market(8, seed)['5m'], all = M.smallEv(F, L), k = L.length - 400, part = M.smallEv(F, L.slice(0, k));
    assert.deepEqual(part, all.filter((e) => e.t <= L[k - 1].time), 'small breaks do not change when later candles arrive'); assert.ok(all.every((e) => e.top > e.bot && (e.dir > 0 ? e.top === e.level : e.bot === e.level))); }
  // the sequence reads them by default; the older reading on request
  // the sequence reads them by default; the older reading on request
  const a7 = ALL(7).sop, b7 = sopOf(7, fr20(7), { vr: 'major' });
  assert.ok(a7.every(rule1) && b7.every(rule1)); assert.notEqual(JSON.stringify(a7.map(keyOf)), JSON.stringify(b7.map(keyOf)), 'the two readings differ on these candles');
  for (const seed of [7, 11]) assert.ok(verify(seed, ALL(seed).sop.filter((x) => !x.retest)) >= 3, 'sequence entries checked against a cut, seed ' + seed);
  assert.match(src, /o\.vr === 'major'/); assert.ok(src.includes("o.qm === 'internal' ? F.msInternal(W, W.length, 3) : swingEv(F, W)"), 'the QM at a barrier reads the same swings');
});

test('the second confirmation table: an H4 barrier also on M30, an H1 barrier on M15, an M30 barrier on M5; M30 built from M15 where none is handed in; no hindsight', () => {
  assert.deepEqual(M.ALT2, { '4h': '30m', '1h': '15m' }); assert.deepEqual(M.BARRIER30, [['30m', '5m']]);
  assert.deepEqual(M.BARRIER, [['1d', '1h'], ['4h', '15m'], ['1h', '5m'], ['15m', '1m']], 'the first table is unchanged');
  // M30 from M15: whole half hours only
  const q = [0, 900, 1800, 2700, 3600].map((t, i) => ({ time: t, open: 10 + i, high: 12 + i, low: 9 + i, close: 11 + i }));
  assert.deepEqual(M.m30of(q), [{ time: 0, open: 10, high: 13, low: 9, close: 12 }, { time: 1800, open: 12, high: 15, low: 11, close: 14 }], 'the half hour whose second quarter has not closed is left out');
  let na = 0, n30 = 0, c = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), fr = fr20(seed), full = ALL(seed).rows, A = full.filter((r) => r.alt), T30 = full.filter((r) => r.kind === 'barrier' && r.h === '30m');
    for (const r of A) { na++; assert.ok((r.h === '4h' && r.l === '30m' && r.alt === '30m') || (r.h === '1h' && r.l === '15m' && r.alt === '15m'), r.id); assert.match(r.id, r.l === '30m' ? /-c30-/ : /-c15-/); assert.match(r.label, r.l === '30m' ? / · M30 confirm/ : / · M15 confirm/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.match(r.log[1].text, /the second table's M(30|15), besides the first table's M(15|5)/); }
    for (const r of T30) { n30++; assert.equal(r.l, r.nested ? '15m' : r.janda && r.jandaM1 ? '1m' : '5m'); assert.match(r.id, /bar-(j-|sop-)?((cf|vr|sw|eg)-)?30m-/); assert.match(r.label, /^M30 /); assert.ok(rule1(r), 'rule 1: ' + r.id); assert.ok(r.withDir == null || / · (with|against) H1$/.test(r.label)); }
    c += verify(seed, A) + verify(seed, T30);
    if (seed !== 7) continue;
    // without the second table every other record is what it was; without M30 candles they are built from M15 and nothing changes
    const z = ALL(seed).z, withT = ALL(seed).bar, noT = M.barrierTrades(X, F, { from: fr, extra: z, table2: false });
    assert.ok(noT.every((r) => !r.alt && r.h !== '30m')); assert.deepEqual(noT.filter((r) => !isNew(r)).map(keyOf), withT.filter((r) => !isNew(r)).map(keyOf), 'the older kinds of record are untouched');
    const no30 = { ...X }; delete no30['30m']; assert.deepEqual(M.barrierTrades(no30, F, { from: fr, extra: z }).map(keyOf), withT.map(keyOf), 'M30 built from M15 gives the same records'); assert.equal(no30['30m'], undefined, 'the caller\'s candles are not changed');
    // M5 for an M15 barrier is the second table's own; for an H4 barrier it is the owner's reading
    for (const r of withT.filter((x) => x.m5)) assert.match(r.log[1].text, r.h === '15m' ? /the second table's M5/ : /the owner's M5 confirmation/); }
  assert.ok(na >= 1 && n30 >= 1 && c >= 2, 'second-table entries: ' + na + ', M30 barrier entries: ' + n30);
});

test('repeat the SOP at a barrier: after the QM, a VR and its CF one timeframe lower, the sequence\'s own entry; a stop on the losing side; off with rsop: false; no hindsight', () => {
  assert.deepEqual(M.LOWER, { '1h': '30m', '30m': '15m', '15m': '5m', '5m': '1m' });
  let n = 0, c = 0;
  for (const seed of POOL_SEEDS) { const X = market(26, seed), fr = fr20(seed), full = ALL(seed).rows, R = full.filter((r) => r.rsop && !r.nested);
    for (const r of R) { n++; const low = M.LOWER[r.l]; assert.ok(low && r.ll === low, r.id); assert.match(r.id, /bar-sop-/); assert.doesNotMatch(r.id, /bar-sop-cf-/, 'a CF zone has its own repeat, with no QM'); assert.match(r.label, / · repeat SOP/); assert.ok(!r.janda && !r.atZone && r.kind === 'barrier'); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.ok(r.log.slice(0, 6).every((x, i) => !i || x.t >= r.log[i - 1].t), 'the barrier, the return, the QM, the VR, the CF, the entry: in time order');
      assert.match(r.log[2].text, / CF: a QM \(BO Structure\).*The SOP is repeated one timeframe lower/); assert.match(r.log[3].text, / VR: the first BO Structure \(QM\) against the /); assert.match(r.log[4].text, / CF.*back with the .* clear of the VR/); assert.notEqual(r['case'], 2);
      assert.ok(r.log[3].t > r.log[2].t, 'the VR forms after the QM closed'); assert.ok(X[low].some((b) => b.time + M.SEC[low] === r.t), 'the entry is the close of a lower-timeframe candle (its EG)');
      // the target is the VR's extreme and the trade starts after its entry candle
      const vr = r.marks.find((m) => m.kind === 'vr' || m.kind === 'bvr'); assert.ok(vr && Math.abs(r.target - (r.side > 0 ? vr.top : vr.bot)) < 1e-9, 'target = the VR\'s extreme');
      if (r.endT) assert.ok(r.endT >= r.t); }
    c += verify(seed, R);
    if (seed !== 7) continue;
    const a = ALL(seed).bar, b = M.barrierTrades(X, F, { from: fr, extra: ALL(seed).z, rsop: false });
    assert.ok(b.every((r) => !r.rsop)); assert.deepEqual(b.filter((r) => !isNew(r)).map(keyOf), a.filter((r) => !isNew(r)).map(keyOf), 'the older kinds of record are untouched');
    assert.ok(a.filter((r) => !r.rsop).every((r) => b.some((x) => keyOf(x) === keyOf(r))), 'no other record is lost to a repeat-SOP record');
    assert.equal(new Set(a.map((r) => r.id)).size, a.length, 'no id twice'); }
  assert.ok(n >= 3 && c >= 3, 'repeat-SOP entries on these candles: ' + n + ', checked against a cut: ' + c);
  assert.doesNotMatch(src.slice(src.indexOf('REPEAT THE SOP (21 Nov 2026'), src.indexOf("if (C.length) { run(ctf, C, 'table')")), /Lc\[kk \+ 1\]|Lc\.slice\(a0\)\b/, 'the walk reads candles up to its own only');
});

// 21 Nov 2026 (review of the method's own page on it): after the sequence's CF the SOP is repeated with NO QM first: one timeframe
// lower a VR forms, then a CF whose zone sits inside the parent CF zone. Hand-made candles (the pattern is rare on a random walk).
test('repeat the SOP after the CF: no QM first, a VR then a CF one timeframe lower, the nested CF inside the parent CF zone; nothing read after the entry', () => {
  // M30 closes: a break above 110.2 (read as the parent H1 CF's close), a higher low, the top 130.2, the M30 VR (the close through
  // 113.8), the fall to 103.8, the M30 CF (the close through 112.2: its zone 103.8 to 112.2), a pullback to 111 and the EG
  const leg = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 1) / n); let p = [100]; const go = (to, n) => { p = p.concat(leg(p.at(-1), to, n)); };
  go(110, 5); go(104, 5); go(120, 6); go(114, 4); go(130, 6); go(124, 4); go(128, 4); go(118, 5); go(121, 4); go(108, 6); go(112, 4); go(104, 5); go(116, 6); go(111, 3); go(125, 6);
  const T0 = 1790035200, W = p.slice(1).map((b, i) => ({ time: T0 + i * 1800, open: p[i], close: b, high: Math.max(p[i], b) + 0.2, low: Math.min(p[i], b) - 0.2 })), r1 = (v) => Math.round(v * 10) / 10;
  const H1 = []; for (const b of W) { const t = b.time - (b.time % 3600), x = H1.at(-1); if (x && x.time === t) { x.high = Math.max(x.high, b.high); x.low = Math.min(x.low, b.low); x.close = b.close; } else H1.push({ ...b, time: t }); }
  const bo = M.swingEv(F, W).find((e) => e.dir > 0 && r1(e.level) === 110.2), known = W[bo.breakIdx].time + 1800;
  const run = (lo, hi, tgt, o = {}, Wx = W) => M.barrierTrades({ '1h': H1, '30m': Wx, '5m': [] }, F, { from: 0, extra: [{ tf: '1h', dir: 1, lo, hi, kind: 'cf', known, of: 'H4 BO', tgt }], ...o }).filter((r) => r.rsop);
  const got = run(103, 112.5, 140); assert.equal(got.length, 1); const r = got[0];
  assert.deepEqual([r.id, r.label, r.kind, r.h, r.l, r.side, r.nested, r.rsop, r['case']], ['bar-sop-cf-1h-b' + r.t, 'H1 CF barrier · H4 BO · repeat SOP', 'barrier', '1h', '30m', 1, true, true, 1]);
  assert.deepEqual([r1(r.entry), r1(r.stop), r1(r.target)], [113.3, 110.5, 130.2], 'the EG\'s close, 0.30 under the pullback\'s low 110.8, the nested VR\'s extreme'); assert.ok(rule1(r));
  assert.ok(W.some((b) => b.time + 1800 === r.t), 'the entry is the close of an M30 candle (its EG)');
  assert.match(r.log[0].text, /^H1 CF buy of the H4 BO: its zone runs 103\.00 to 112\.50\. The SOP is repeated after the CF, one timeframe lower: the M30 VR, then the M30 CF inside this zone \(no QM first\)\./);
  assert.match(r.log[1].text, /^M30 VR: the first BO Structure \(QM\) against the H1 CF\. The VR runs 113\.80 to 130\.20/); assert.match(r.log[2].text, /^M30 CF: .* Its zone 103\.80 to 112\.20 sits inside the H1 CF zone, clear of the VR\./);
  assert.ok(!r.log.some((x) => / CF: a QM \(BO Structure\)/.test(x.text)), 'no QM line: none is waited for');
  assert.ok(r.log.slice(0, 4).every((x, i) => !i || x.t > r.log[i - 1].t) && r.log[3].t === r.t, 'the parent CF, the VR, the CF, the entry: in time order');
  assert.deepEqual(M.readings({ id: r.id }).rsop, true); assert.deepEqual(r.marks.map((m) => m.label), ['H1 CF zone (parent)', 'M30 VR', 'M30 CF zone']);
  // the nested CF must sit INSIDE the parent CF zone, both sides: a parent zone that ends under its top, or above its low, gives no entry
  assert.equal(run(103, 111, 140).length, 0, 'the nested CF reaches above the parent zone'); assert.equal(run(103.9, 112.5, 140).length, 0, 'the nested CF reaches below the parent zone');
  assert.equal(run(105, 112.5, 140).length, 0, 'a close through the parent zone\'s far side: the parent CF failed'); assert.equal(run(103, 112.5, 125).length, 0, 'price reached the parent VR\'s extreme first: the move is done');
  assert.equal(run(103, 112.5, 140, { rsop: false }).length, 0, 'off with rsop: false');
  // nothing after the entry candle is read: the same record with every later candle cut away, and none one candle earlier
  const k = W.findIndex((b) => b.time + 1800 === r.t), c1 = run(103, 112.5, 140, {}, W.slice(0, k + 1));
  assert.deepEqual([c1.length, c1[0].id, c1[0].entry, c1[0].stop, c1[0].target], [1, r.id, r.entry, r.stop, r.target]); assert.equal(run(103, 112.5, 140, {}, W.slice(0, k)).length, 0);
  // and a CF zone no longer gets the barrier's QM-first repeat
  for (const seed of POOL_SEEDS) assert.ok(ALL(seed).bar.filter((x) => x.rsop && /CF barrier/.test(x.label)).every((x) => x.nested));
  assert.deepEqual(M.DOWN, { '4h': '1h', '1h': '30m', '30m': '15m', '15m': '5m' });
});

test('the VR retest of a BUY is worded as a buy: the VR\'s bottom and the last high, never "top" and "last low"', () => {
  let b = 0, s = 0;
  for (const seed of [3, 7, 11, 23, 31, 47]) {
    for (const r of ALL(seed).sop.filter((x) => x.retest)) { const txt = r.log.map((x) => x.text).join(' '), tm = r.marks.find((m) => / · target$/.test(m.label));
      if (r.side > 0) { b++; assert.match(txt, /target the last high /); assert.doesNotMatch(txt, /last low|VR's top/); assert.equal(tm.label, 'Last high · target'); if (r.retest === 'level') assert.match(txt, /past the VR's bottom /); else assert.match(txt, /past the CF box low /); assert.ok(r.target > r.entry && r.stop < r.entry); }
      else { s++; assert.match(txt, /target the last low /); assert.doesNotMatch(txt, /last high|VR's bottom/); assert.equal(tm.label, 'Last low · target'); } } }
  assert.ok(b >= 1 && s >= 1, 'buy and sell retests on these candles: ' + b + ' / ' + s);
});

test('an engulf (EG) zone is a barrier too: the desks\' one engulf definition, its own id and label, a stop on the losing side, off with eg: false, no hindsight', async () => {
  const G = await import('../council/eg-methods.mjs');
  // the same zones as council/eg-methods.mjs `zones` (base wick to wick, known at the completing close), on seeded candles
  for (const seed of [7, 11]) for (const tf of ['4h', '1h', '15m']) { const H = market(26, seed)[tf], a = M.egBoxes(H), b = G.zones(H, tf);
    assert.ok(a.length > 5, 'engulf zones on ' + tf + ': ' + a.length);
    assert.deepEqual(a.map((z) => [z.dir, z.lo, z.hi, H[z.i].time, H[z.breakIdx].time + M.SEC[tf]]), b.map((z) => [z.dir, z.bot, z.top, z.base, z.at]), 'seed ' + seed + ' ' + tf + ': the page copy equals the desks\' engulf'); }
  let n = 0;
  for (const seed of [7, 11]) { const fr = fr20(seed), on = barOf(seed, fr), off = barOf(seed, fr, { eg: false }), E = on.filter((r) => r.eg);
    assert.ok(E.length >= 1, 'EG barrier entries, seed ' + seed + ': ' + E.length); assert.ok(off.every((r) => !r.eg && !/bar-(j-|sop-)?eg-/.test(r.id)), 'none with eg: false');
    for (const r of E) { n++; assert.match(r.id, /bar-(j-|sop-)?eg-/); assert.match(r.label, / EG barrier/); assert.ok(rule1(r), 'rule 1: ' + r.id); assert.ok(M.readings(r).eg && M.readings({ id: r.id }).eg, 'read back from the id alone');
      assert.ok(r.marks.some((m) => / EG zone \(barrier\)$/.test(m.label)) && /an engulf \(EG\) zone/.test(r.log[0].text)); }
    // every record that is not an EG barrier is a record of the run without them (an EG zone only adds, or gives way to a BO origin of the same order)
    const ids = new Set(off.map((r) => r.id)); for (const r of on) if (!r.eg && !/Janda \(M1\)/.test(r.label)) assert.ok(ids.has(r.id), 'unchanged beside the EG barriers: ' + r.id);
    // no hindsight: an EG barrier entry found on the whole history is found with the candles cut just after its fill
    for (const r of E.slice(0, 6)) { const T = cutFor(seed, r.t + 3600); if (!T) continue; const c = M.barrierTrades(cut(market(26, seed), T), F, { from: fr }).find((x) => x.id === r.id); assert.ok(c, 'found when cut: ' + r.id); assert.deepEqual([c.entry, c.stop, c.target], [r.entry, r.stop, r.target]); } }
  assert.ok(n >= 2);
});

// 22 Nov 2026 (owner: "add the old barrier as different separate", "the one with higher R"): the barrier with its older 3R
// target is recorded beside the current one under its own ids, never mixed into it
test('the barrier with the older 3R target is a reading of its own: the current entries and stops, a 3R target, its own ids and flag', () => {
  const seed = 7, X = market(26, seed), fr = fr20(seed), z = ALL(seed).z;
  const old = M.oldBarrierTrades(X, F, { from: fr, extra: z }), all = BT(X, F, { from: fr, extra: z }), by = new Map(all.map((r) => [r.id, r]));
  assert.ok(old.length > 0); assert.equal(new Set(old.map((r) => r.id)).size, old.length); assert.deepEqual(M.OLD_BARRIER, { rr: 3 });
  let same = 0;
  for (const r of old) { assert.match(r.id, /^bar-old-/); assert.equal(r.kind, 'barrier'); assert.equal(r.old, true); assert.ok(M.readings({ id: r.id }).old, 'read back from a stored id'); assert.match(r.label, / · 3R target$/);
    assert.ok(r.side > 0 ? r.stop < r.entry : r.stop > r.entry, 'a stop on the losing side');
    assert.ok(Math.abs(Math.abs(r.target - r.entry) / Math.abs(r.entry - r.stop) - 3) < 1e-6, 'the 3R target');
    const c = by.get(r.id.replace('bar-old-', 'bar-')); if (c) { same++; assert.equal(c.entry, r.entry); assert.equal(c.stop, r.stop); assert.equal(c.side, r.side); assert.equal(c.t, r.t);
      assert.ok(Math.abs(Math.abs(c.target - c.entry) / c.r0 - M.BARRIER_R) < 1e-6, 'its current twin has the current target'); }
    const a = M.readings({ id: r.id }), b = M.readings({ id: r.id.replace('bar-old-', 'bar-') }); assert.deepEqual({ ...a, old: false }, b); }
  assert.ok(same >= old.length * 0.8, 'the 3R records are the current entries: ' + same + ' of ' + old.length);
  assert.ok(all.every((r) => !M.readings(r).old), 'no current record reads as old');
  const src = fs.readFileSync(new URL('../council/mosha-desk.mjs', import.meta.url), 'utf8');
  assert.match(src, /\.concat\(SOP\.oldBarrierTrades\(B, F, \{ from, market, extra: cfz \}\)\)/);
});

// 22 Nov 2026 (owner on a GBP/USD buy: "this should be a sell", "there is no new BO"): at a barrier against the direction a QM
// that price closed back through gives no repeat-SOP entry; the trade is taken with the direction instead
test('a failed QM at a barrier against the direction: no repeat-SOP entry after it, a trade with the direction with its stop past the VR, no hindsight', () => {
  let n = 0, c = 0;
  for (const seed of [7, 11]) { const X = market(26, seed), fr = fr20(seed), z = ALL(seed).z, all = BT(X, F, { from: fr, extra: z }), was = BT(X, F, { from: fr, extra: z, fail: false });
    const f = all.filter((r) => M.readings(r).qmFail); n += f.length;
    for (const r of f) { assert.match(r.id, /bar-sop-f-/); assert.equal(r.withDir, true); assert.equal(r.qmFail, true); assert.ok(M.readings({ id: r.id }).qmFail);
      assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'stop on the losing side, target on the winning side'); assert.match(r.label, /QM failed · with /); assert.match(r.log.at(-2).text, /No new BO (buy|sell)/); }
    assert.ok(was.every((r) => !M.readings(r).qmFail), 'fail: false reads it as before');
    const ids = new Set(all.map((r) => r.id)), gone = was.filter((r) => !ids.has(r.id));
    assert.ok(gone.every((r) => r.rsop && r.withDir === false), 'only repeat-SOP entries at barriers against the direction are dropped, seed ' + seed);
    // no hindsight: the record exists, with the same levels, on the candles closed just after its entry
    for (const r of f.slice(0, 4)) { const T = cutFor(seed, r.t + 3600); if (!T) continue; const k = BT(cut(X, T), F, { from: fr, extra: ALL(seed, T).z }).find((q) => q.id === r.id);
      assert.ok(k, 'seen on the cut: ' + r.id); assert.equal(k.entry, r.entry); assert.equal(k.stop, r.stop); assert.equal(k.target, r.target); c++; } }
  assert.ok(n > 0 && c > 0, 'failed-QM entries: ' + n + ', checked against a cut: ' + c);
});

// 22 Nov 2026 (owner: "when tap he could wait M1 BO buy to take the trade, SL at M1 BO low")
test('M1 BO at the tap of a barrier: a market entry at the M1 close, the stop past the M1 BO\'s low, its own id and reading, no hindsight', () => {
  let n = 0, c = 0;
  for (const seed of [7, 11]) { const X = market(26, seed), fr = fr20(seed), z = ALL(seed).z, all = BT(X, F, { from: fr, extra: z }), t = all.filter((r) => r.tap); n += t.length;
    assert.ok(BT(X, F, { from: fr, extra: z, tap: false }).every((r) => !r.tap), 'tap: false leaves it out');
    assert.deepEqual(BT(X, F, { from: fr, extra: z, tap: false }).map(keyOf), all.filter((r) => !r.tap).map(keyOf), 'no other record changes');
    assert.equal(new Set(t.map((r) => r.id)).size, t.length);
    for (const r of t) { assert.match(r.id, /bar-tap-/); assert.equal(r.l, '1m'); assert.ok(M.readings({ id: r.id }).tap); assert.match(r.label, / · M1 BO at the tap/); assert.match(r.log.at(-2).text, /M1 BO (buy|sell) at the tap/);
      assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry);
      const bar = X['1m'].find((b) => b.time + 60 === r.t); assert.ok(bar && bar.close === r.entry, 'the entry is the close of the M1 candle that ended at its time'); }
    for (const r of t.slice(0, 4)) { const T = cutFor(seed, r.t + 60); if (!T) continue; const k = BT(cut(X, T), F, { from: fr, extra: ALL(seed, T).z }).find((q) => q.id === r.id);
      assert.ok(k, 'seen on the cut: ' + r.id); assert.equal(k.entry, r.entry); assert.equal(k.stop, r.stop); c++; } }
  assert.ok(n > 0 && c > 0, 'tap entries: ' + n + ', checked against a cut: ' + c);
});

test('a SOP inside the SOP: the VR starts a lower-timeframe sequence against the BO and the CF one with it; a stop on the losing side; off with nest: false; no hindsight', async () => {
  let nv = 0, nc = 0, cuts = 0;
  for (const seed of [7, 11]) { const X = market(26, seed), fr = fr20(seed), all = ST(X, F, { from: fr }), n = all.filter((r) => r.nest), off = ST(X, F, { from: fr, nest: false });
    for (const q of [{ cf: 'same', cfBack: false }]) { const a2 = ST(X, F, { from: fr, ...q }); assert.deepEqual(a2.filter((r) => !r.nest).map(keyOf), sopOf(seed, fr).map(keyOf), 'with the CF on the VR timeframe the main list is the pinned one'); assert.ok(a2.filter((r) => r.nest).every((r) => r.l === (M.LOWER[r.h] || M.DOWN[r.h]))); }
    assert.ok(n.some((r) => r.nest === 'vr') && n.some((r) => r.nest === 'cf'), `seed ${seed}: both legs give records`);
    assert.equal(off.filter((r) => r.nest).length, 0);
    assert.deepEqual(all.filter((r) => !r.nest).map(keyOf), off.map(keyOf), 'the main sequence is unchanged: nest false is the old list');
    assert.equal(new Set(all.map((r) => r.id)).size, all.length, 'ids are unique');
    for (const r of n) { const v = r.nest === 'vr'; v ? nv++ : nc++;
      assert.equal(r.kind, 'sop'); assert.ok(rule1(r), 'a stop on the losing side, a target on the winning side: ' + r.id);
      assert.ok(r.of === 1 || r.of === -1); assert.equal(r.side, v ? -r.of : r.of, 'the VR leg trades against the first BO, the CF leg with it');
      assert.match(r.id, v ? /^sop-nv-(1h|30m|15m|5m|1m)-[bs]\d+$/ : /^sop-nc-(1h|30m|15m|5m|1m)-[bs]\d+$/); assert.equal(r.id.endsWith((r.side > 0 ? 'b' : 's') + r.t), true);
      assert.equal(r.l, M.LOWER[r.h] || M.DOWN[r.h] || r.h, 'one timeframe lower (M1 stays M1)'); if (!v) assert.ok(['1h', '30m', '15m', '5m', '1m'].includes(r.h), 'the SOP inside the CF starts from the CF timeframe'); assert.match(r.label, v ? / VR → M?\w+ SOP inside the VR$/ : / CF → M?\w+ SOP inside the CF$/);
      assert.ok(r.t >= fr && r.r0 > 0 && r.log.length >= (v ? 5 : 6) && r.marks.length >= (v ? 4 : 5));
      const ts = r.log.filter((x) => x.t != null).map((x) => x.t); assert.deepEqual(ts, ts.slice().sort((a, b) => a - b), 'the log is in time order');
      assert.ok(r.log.slice(0, -1).every((x) => x.t <= r.t), 'nothing in the log before the result is later than the entry');
      // the entry is the close of the EG candle of the lower timeframe
      const c = X[r.l].find((b) => b.time + M.SEC[r.l] === r.t); assert.ok(c && Math.abs(c.close - r.entry) < 1e-9, 'entered at the close of its EG candle'); }
    // NO HINDSIGHT: one minute after the entry (an unaligned cut) the same record is there with the same levels, and at the pool's cut too
    const pick = n.filter((r) => r.nest === 'cf').slice(0, 1).concat(n.filter((r) => r.nest === 'vr').slice(0, 1), n.filter((r) => r.nest === 'vr').slice(-1));
    for (const r of pick) { for (const T of [r.t + 60, cutFor(seed, r.t + 60)]) { if (!T) continue; cuts++;
        const k = ST(cut(X, T), F, { from: fr }).find((q) => q.id === r.id); assert.ok(k, `seed ${seed}: found only with later candles: ${r.id}`);
        assert.deepEqual([k.side, k.entry, k.stop, k.target, k.of], [r.side, r.entry, r.stop, r.target, r.of]); }
      assert.equal(ST(cut(X, r.t - 1), F, { from: fr }).some((q) => q.id === r.id), false, 'not before its EG candle closed: ' + r.id); cuts++; } }
  assert.ok(nv >= 2 && nc >= 2 && cuts >= 12, `VR legs ${nv}, CF legs ${nc}, cuts ${cuts}`);
  // an order another reading already gave is recorded once, under the other reading's id
  const a = { id: 'sop-5m-1', kind: 'sop', h: '15m', side: 1, t: 100, entry: 4000, stop: 3998 }, b = { ...a, id: 'bar-sop-x', kind: 'barrier' }, c = { ...a, id: 'sop-nc-1m-b100', h: '5m', nest: 'cf' };
  assert.deepEqual(M.uniq([c, b]).map((r) => r.id), ['bar-sop-x']); assert.deepEqual(M.uniq([c, a, b]).map((r) => r.id), ['sop-5m-1']); assert.deepEqual(M.uniq([c]).map((r) => r.id), ['sop-nc-1m-b100']);
  // the tracker's store: the reading survives from the id alone, and a nested record beside a plain one is never a re-read of it
  const TK = await import('../council/mosha-desk.mjs'), rec = (o) => ({ kind: 'sop', h: '5m', l: '1m', side: -1, t: 1000, entry: 100, stop: 102, target: 94, status: 'open', R: null, log: [{ t: 990, text: 'x' }], ...o });
  const st = TK.clean(rec({ id: 'sop-nv-1m-s1000', nest: 'vr', of: 1, label: 'M15 BO → M5 VR → M1 SOP inside the VR' })); assert.deepEqual([st.id, st.kind, st.label, 'nest' in st], ['sop-nv-1m-s1000', 'sop', 'M15 BO → M5 VR → M1 SOP inside the VR', false]);
  const prev = [{ ...TK.clean(rec({ id: 'sop-1m-940' })), first: 1, src: 'replay' }], mg = TK.merge(prev, [rec({ id: 'sop-1m-940' }), rec({ id: 'sop-nv-1m-s1000' }), rec({ id: 'sop-nc-1m-s1000' })], 5000);
  assert.deepEqual(mg.map((r) => r.id).sort(), ['sop-1m-940', 'sop-nc-1m-s1000', 'sop-nv-1m-s1000']);
  assert.equal(TK.merge(mg, [rec({ id: 'sop-nv-1m-s1300', t: 1300 })], 6000).length, 3, 'the same nested trade re-read under another id is still left out');
  // the desk names them and lists them apart from the plain sequence
  assert.match(src, /SOP inside the VR \(against the BO\)/); assert.match(src, /SOP inside the CF \(with the BO\)/); assert.match(src, /line\('BO, VR, CF: entry on the EG', sop\.filter\(function \(r\) \{ return !isC2\(r\) && !isNest\(r\) && !isLim\(r\); \}\)\)/);
});

test('the CF one timeframe under the VR (the method\'s table): the CF, the EG and the fill are on that timeframe, the VR is unchanged; cf "same" is the reading before; no hindsight', () => {
  assert.deepEqual(M.CFTF, { '4h': '1h', '1h': '15m', '30m': '15m', '15m': '5m', '5m': '1m', '1m': '1m' });
  let n = 0, cuts = 0; const tfs = new Set();
  for (const seed of [7, 11]) { const X = market(26, seed), fr = fr20(seed), NB = { nest: false, cfBack: false, cfLimit: false }, all = ST(X, F, { from: fr, ...NB }), seq = all.filter((r) => !r.retest), old = sopOf(seed, fr);
    assert.deepEqual(ST(X, F, { from: fr, ...NB, cf: 'same' }).map(keyOf), old.map(keyOf), 'cf "same" gives exactly the list before');
    assert.equal(new Set(all.map((r) => r.id)).size, all.length); assert.ok(seq.length >= 10);
    for (const r of seq) { n++; tfs.add(r.l + '>' + r.ll);
      assert.equal(r.ll, M.CFTF[r.l], 'the CF timeframe is the table\'s: ' + r.id); assert.ok(rule1(r), r.id);
      const c = X[r.ll].find((b) => b.time + M.SEC[r.ll] === r.t); assert.ok(c && Math.abs(c.close - r.entry) < 1e-9, 'entered at the close of a candle of the CF timeframe: ' + r.id);
      assert.match(r.label, new RegExp('^\\S+ i?BO → \\S+ VR → ' + ({ '1h': 'H1', '30m': 'M30', '15m': 'M15', '5m': 'M5', '1m': 'M1' })[r.ll] + ' CF'));
      // the VR is the VR timeframe's own: its box is closed by a candle of that timeframe, and the target is its extreme
      const vm = r.marks.find((m) => m.kind === 'vr' || m.kind === 'bvr'), zm = r.marks.find((m) => m.kind === 'zone'); assert.equal(vm.at - vm.a, M.SEC[r.l]); assert.equal(zm.at - zm.a, M.SEC[r.ll]);
      assert.ok(Math.abs(r.target - (r.side > 0 ? vm.top : vm.bot)) < 1e-9, 'target the VR\'s extreme'); assert.ok(zm.at <= r.t && vm.at <= zm.at);
      const ts = r.log.filter((x) => x.t != null).map((x) => x.t); assert.deepEqual(ts, ts.slice().sort((a, b) => a - b)); }
    // NO HINDSIGHT: a minute after its EG closed the record is there with the same levels; a second before, it is not
    for (const r of [seq[0], seq[Math.floor(seq.length / 2)], seq.at(-1)]) { cuts++;
      const k = ST(cut(X, r.t + 60), F, { from: fr, ...NB }).find((q) => q.id === r.id); assert.ok(k, `seed ${seed}: found only with later candles: ${r.id}`); assert.deepEqual([k.side, k.entry, k.stop, k.target, k.case2], [r.side, r.entry, r.stop, r.target, r.case2]);
      assert.equal(ST(cut(X, r.t - 1), F, { from: fr, ...NB }).some((q) => q.id === r.id), false, 'not before its EG candle closed'); } }
  assert.ok(n >= 40 && cuts >= 6 && tfs.has('5m>1m') && tfs.has('15m>5m'), [...tfs].join(' '));
  // with no candles of the CF timeframe the CF is read on the VR's, as before, and the log says so
  const X = { ...market(26, 7) }; delete X['1m']; const fb = ST(X, F, { from: fr20(7), nest: false, cfBack: false, cfLimit: false }).filter((r) => r.l === '5m' && !r.retest);
  const was = new Set(sopOf(7, fr20(7)).map(keyOf)); assert.ok(fb.length >= 5 && fb.every((r) => was.has(keyOf(r)) && r.ll == null), 'the M5 records are the ones of the reading before (one that is the very order of a higher step is recorded once, there)'); assert.ok(fb.every((r) => /no M1 candles on file: the CF is read on M5/.test(r.log[2].text)));
});

test('"Both": a CF counts only once price is back at the level the BO broke, and a limit at the CF line is recorded beside the EG entry; a stop past the CF zone; off with cfBack / cfLimit false; no hindsight', async () => {
  let nl = 0, ne = 0, cuts = 0;
  for (const seed of [7, 11]) { const X = market(26, seed), fr = fr20(seed), all = ST(X, F, { from: fr, nest: false }), seq = all.filter((r) => !r.retest), lim = seq.filter((r) => r.cfLimit), eg = seq.filter((r) => !r.cfLimit);
    assert.deepEqual(ST(X, F, { from: fr, ...OLDWAY }).map(keyOf), sopOf(seed, fr).map(keyOf), 'every old-way option together gives exactly the list before');
    assert.deepEqual(ST(X, F, { from: fr, nest: false, cfLimit: false }).map(keyOf), all.filter((r) => !r.cfLimit).map(keyOf), 'the limit is recorded beside the other entries: without it they are the same');
    assert.equal(new Set(all.map((r) => r.id)).size, all.length); assert.ok(lim.length >= 5 && eg.length >= 5, `seed ${seed}: ${lim.length} limits, ${eg.length} EG entries`);
    for (const r of seq) { r.cfLimit ? nl++ : ne++;
      const bo = r.marks[0], vm = r.marks.find((m) => m.kind === 'vr' || m.kind === 'bvr'), zm = r.marks.find((m) => m.kind === 'zone'), C = X[r.ll];
      assert.equal(r.back, true); assert.ok(rule1(r), r.id); assert.match(r.log[2].text, /after price came back to the BO level/);
      // on the candles: after the VR and by the CF's own candle, a candle of the CF timeframe traded at or through the BO level
      assert.ok(C.some((b) => b.time >= vm.at && b.time + M.SEC[r.ll] <= zm.at && (r.side > 0 ? b.low <= bo.p : b.high >= bo.p)), 'price was back at the BO level before the CF: ' + r.id);
      if (!r.cfLimit) continue;
      assert.match(r.id, /^sop-l-(i-)?(4h|1h|30m|15m|5m)-[bs]\d+$/); assert.match(r.label, / CF · limit at the CF line$/); assert.equal(r.case2, undefined); assert.equal(r.kind, 'sop');
      assert.equal(r.entry, r.side > 0 ? zm.top : zm.bot, 'the entry is the CF line, the level the CF\'s break took'); assert.ok(r.side > 0 ? r.stop < zm.bot : r.stop > zm.top, 'the stop is past the CF zone\'s far side');
      assert.ok(Math.abs(Math.abs(r.stop - (r.side > 0 ? zm.bot : zm.top)) - 0.3) < 1e-9, 'by the desk\'s buffer'); assert.equal(r.target, r.side > 0 ? vm.top : vm.bot, 'target the VR\'s extreme');
      const fb = X[r.ll === '1m' ? '1m' : '5m'].find((b) => b.time === r.t); assert.ok(fb && (r.side > 0 ? fb.low <= r.entry : fb.high >= r.entry), 'filled by a candle that reached the line');
      assert.ok(r.t >= zm.at && r.t < zm.at + M.CF_LIMIT * M.SEC[r.ll] && r.known > r.t && r.known - r.t <= M.SEC[r.ll], 'filled after the CF candle closed, within the wait');
      if (r.status === 'stopped' && r.endT === r.t) assert.ok(r.R <= -1 + 1e-9, 'the fill candle can only stop it'); if (r.status === 'target') assert.ok(r.endT > r.t); }
    // NO HINDSIGHT: a minute after the candle of the fill closed the record is there with the same levels; a second before that close, it is not
    for (const r of [lim[0], lim.at(-1), eg[0]]) { const kn = r.cfLimit ? r.known : r.t; cuts++;
      const k = ST(cut(X, kn + 60), F, { from: fr, nest: false }).find((q) => q.id === r.id); assert.ok(k, `seed ${seed}: found only with later candles: ${r.id}`); assert.deepEqual([k.side, k.entry, k.stop, k.target], [r.side, r.entry, r.stop, r.target]);
      assert.equal(ST(cut(X, kn - 1), F, { from: fr, nest: false }).some((q) => q.id === r.id), false, 'not before it was known: ' + r.id); }
    // the nested legs read the same rule on their own BO (the VR / CF break they start from)
    for (const r of ST(X, F, { from: fr }).filter((q) => q.nest)) { assert.equal(r.back, true); assert.match(r.log.at(-3).text, /after price came back to the level/); } }
  assert.ok(nl >= 12 && ne >= 12 && cuts >= 6, `limits ${nl}, EG entries ${ne}`);
  // backEv on hand-made breaks: a break with the BO before price is back at the BO level is no CF; one after is
  const W = [10, 11, 12, 13, 14, 15].map((t, i) => ({ time: t, open: 105, high: 106, low: i === 4 ? 99.5 : 101, close: 105 })), E = [{ dir: -1, level: 104, structure: true, t: 11 }, { dir: 1, level: 105, structure: true, t: 13 }, { dir: 1, level: 105.5, structure: true, t: 15 }];
  const be = M.backEv(E, W, 1, 100, 9); assert.equal(be.backT, 14); assert.deepEqual(be.ev.map((e) => e.structure), [true, false, true]); assert.equal(M.backEv(E.slice(1), W, 1, 100, 9).backT, null);
  // its own reading: never taken for the EG entry of the same minute, in the replay's own list or in the tracker's store
  const a = { id: 'sop-5m-1', kind: 'sop', h: '15m', side: 1, t: 100, entry: 4000, stop: 3998 }, b = { ...a, id: 'sop-l-5m-b100', cfLimit: true }; assert.equal(M.uniq([a, b]).length, 2);
  const TK = await import('../council/mosha-desk.mjs'), rec = (o) => ({ kind: 'sop', h: '15m', l: '5m', side: -1, t: 1000, entry: 100, stop: 102, target: 94, status: 'open', R: null, log: [{ t: 990, text: 'x' }], ...o });
  const prev = [{ ...TK.clean(rec({ id: 'sop-5m-700' })), first: 1, src: 'replay' }], mg = TK.merge(prev, [rec({ id: 'sop-5m-700' }), rec({ id: 'sop-l-5m-s900', t: 900, cfLimit: true })], 5000);
  assert.deepEqual(mg.map((r) => r.id).sort(), ['sop-5m-700', 'sop-l-5m-s900']); assert.equal(TK.merge(mg, [rec({ id: 'sop-l-5m-s1200', t: 1200 })], 6000).length, 2, 'the same limit re-read under another id is still left out');
  assert.match(src, /line\('BO, VR, CF: limit at the CF line', sop\.filter\(isLim\)/);
});

test('scalp / intraday / swing tag by the top timeframe (display only)', () => {
  const S = M.styleOf;
  assert.equal(S({ h: '1d' }), 'swing'); assert.equal(S({ h: '4h' }), 'intraday');
  for (const h of ['1h', '30m', '15m']) assert.equal(S({ h }), 'scalp');
  assert.equal(S({ h: '15m', up: '4h' }), 'intraday', 'a SOP inside the SOP takes the main BO\'s timeframe');
  assert.equal(S({}), '');
});

test('Open now on a phone: one line a trade, the first three, then a button for the rest (22 Nov 2026)', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const sop = fs.readFileSync(new URL('../assets/mosha-sop.js', import.meta.url), 'utf8'), dt = fs.readFileSync(new URL('../assets/desk-trades.js', import.meta.url), 'utf8');
  assert.match(html, /#v-mosha \.mo-open-c:not\(\[data-all\]\) \.mo-open li:not\(\.empty\):nth-child\(n\+4\) \{ display: none; \}/);
  assert.match(html, /#v-mosha \.mo-open-more \{ display: none; \}\n@media \(max-width: 640px\)/);
  assert.match(sop, /openMore\(box, open\.length\)/);
  assert.match(dt, /SOP\.openMore\(ob, open\.length\)/);
  assert.match(sop, /var OPEN_PHONE = 3;/);
});

test('a desk trade\'s chart window shows its chart in the phone\'s simple view (22 Nov 2026)', () => {
  const html = fs.readFileSync(new URL('../market-structure.html', import.meta.url), 'utf8');
  const hide = html.indexOf('html[data-phone="simple"] [data-ps]:not([data-ps-open]) { display: none !important; }'), show = html.indexOf('html[data-phone="simple"] #mo-rp-dlg #mo-replay[data-ps] { display: block !important; }');
  assert.ok(hide > 0 && show > hide);   // the folded chart card is the one the window borrows: it must be open there
});
