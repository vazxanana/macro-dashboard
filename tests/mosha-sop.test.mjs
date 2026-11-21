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
function market(days, seed) {
  let s = seed >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const T0 = 1790000000 - (1790000000 % 86400), m1 = []; let p = 4000, drift = 0;
  for (let i = 0; i < days * 1440; i++) { if (i % 180 === 0) drift = (rnd() - 0.5) * 0.5; const o = p, c = o + drift + (rnd() - 0.5) * 2.4, h = Math.max(o, c) + rnd() * 0.8, l = Math.min(o, c) - rnd() * 0.8; m1.push({ time: T0 + i * 60, open: o, high: h, low: l, close: c }); p = c; }
  const B = { '1m': m1 };
  for (const tf of ['5m', '15m', '30m', '1h', '4h', '1d']) { const sec = M.SEC[tf], out = []; for (const b of m1) { const t = b.time - (b.time % sec), q = out[out.length - 1]; if (q && q.time === t) { q.high = Math.max(q.high, b.high); q.low = Math.min(q.low, b.low); q.close = b.close; } else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close }); } B[tf] = out; }
  return B;
}
const cut = (B, T) => Object.fromEntries(Object.entries(B).map(([tf, a]) => [tf, a.filter((b) => b.time + M.SEC[tf] <= T)]));
const B = market(26, 7), END = B['1m'].at(-1).time + 60, from = END - 14 * 86400;
const sop = M.sopTrades(B, F, { from }), bar = M.barrierTrades(B, F, { from });

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
  for (const r of sop.filter((x) => !x.retest)) { assert.match(r.log[0].text, /BO (buy|sell)/); assert.match(r.log[1].text, / VR: the first BO Structure \(QM\) against the BO/); assert.match(r.log[2].text, / CF.*BO Structure \(QM\) back with the BO/); assert.ok(r.deep === null || typeof r.deep === 'boolean'); }
  // the return to the barrier is a moment on the finest candles, and the confirmation closes after it (never a QM from before price was there)
  for (const r of bar) { const z = r.marks[0], t0 = r.log[1].t, fine = B['1m'] && B['1m'].length && B['1m'][0].time <= t0 ? B['1m'] : B['5m'], c = fine.find((b) => b.time === t0);
    assert.ok(c, 'the return is a fine candle: ' + r.id); assert.ok(r.side < 0 ? c.high >= z.bot : c.low <= z.top, 'that candle trades into the barrier'); assert.ok(r.log[2].t > t0, 'the CF closes after the return'); }
  for (const r of bar) { assert.match(r.log[0].text, r.sweep ? /barrier: the swing (high|low)/ : /barrier: a fresh (supply|demand) zone/); assert.match(r.log[2].text, / CF: a QM \(BO Structure\)/); assert.match(r.log[r.janda ? 4 : 3].text, r.atZone ? /pulled back to the zone's near side/ : /pulled back to the level/); if (r.janda) assert.match(r.log[3].text, / Janda: the next break (buy|sell) is a normal BO/); assert.deepEqual([r.h, r.l], r.jandaM1 ? [r.h, M.JANDA_ALT[r.h]] : r.m5 ? [r.h, M.M5_ALT[r.h]] : M.BARRIER.find((p) => p[0] === r.h), 'the confirmation timeframe of the method\'s table (or the owner\'s M5)'); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - M.BARRIER_R) < 1e-9); }
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
  const key = (r) => [r.id, r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4)].join('|'); let seen = 0;
  for (const seed of [3, 7, 11]) { const Bx = seed === 7 ? B : market(26, seed), full = M.sopTrades(Bx, F, { from }).concat(M.barrierTrades(Bx, F, { from }));
    for (const T of [END - 6 * 86400 + 37 * 60, END - 2 * 86400 - 11 * 60]) { const Bc = cut(Bx, T), early = new Set(M.sopTrades(Bc, F, { from }).concat(M.barrierTrades(Bc, F, { from })).map(key));
      // a sequence entry is known at its EG's close; a barrier entry once the barrier-timeframe candle of the return has closed (the replay reads that candle whole)
      for (const r of full) { const known = r.kind === 'sop' ? r.t : Math.max(r.t + 300, r.log[1].t - (r.log[1].t % M.SEC[r.h]) + M.SEC[r.h]); if (known > T) continue; seen++;
        assert.ok(early.has(key(r)), `seed ${seed}: found only with later candles: ${r.id}`); } } }
  assert.ok(seen >= 20, 'entries checked: ' + seen);
  assert.match(src, /M\.trade\.fillT !== L\[i\]\.time/); assert.match(src, /sort\(function \(x, y\) \{ return x\.breakIdx - y\.breakIdx; \}\)/);
});

test('outcome: the stop first when one candle holds both, a target in R, an open trade has no result', () => {
  const tr = { side: -1, entry: 100, stop: 104, target: 88 };
  assert.deepEqual(M.outcome(tr, [{ time: 10, high: 105, low: 87, close: 90 }], 10), { status: 'stopped', R: -1, endT: 10, exit: 104, mfe: 0 });
  const o = M.outcome(tr, [{ time: 5, high: 200, low: 0, close: 1 }, { time: 10, high: 101, low: 95, close: 96 }, { time: 20, high: 97, low: 88, close: 89 }], 10);
  assert.deepEqual([o.status, o.R, o.endT, o.exit], ['target', 3, 20, 88]); assert.equal(o.mfe, 1.25);
  const p = M.outcome(tr, [{ time: 10, high: 101, low: 98, close: 99 }], 10); assert.deepEqual([p.status, p.R, p.float], ['open', null, 0.25]);
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
  const g = M.sopTrades(B, F, { from, buf: undefined }).concat(M.barrierTrades(B, F, { from }));
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

test('a CF inside the VR is the "likely to fail" case: the sequence waits and records no entry', () => {
  let n2 = 0;
  for (const seed of [7, 11, 23, 31]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400;
    const a = M.sopTrades(X, F, { from: fr }), b = M.sopTrades(X, F, { from: fr, case2: true });
    assert.ok(a.every((r) => r['case'] !== 2), 'no entry on a CF inside the VR');
    assert.deepEqual(a.map((r) => r.id), b.filter((r) => r['case'] !== 2).map((r) => r.id), 'the other entries are untouched');
    n2 += b.filter((r) => r['case'] === 2).length; }
  assert.ok(n2 >= 1, 'the case does occur on these candles: ' + n2);
});

test('a barrier trade says whether it is with or against the direction of the timeframe above, read on candles closed at the return', () => {
  let w = 0, a = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, rows = M.barrierTrades(X, F, { from: e - 20 * 86400 });
    for (const r of rows) { if (r.h === '1d') { assert.equal(r.withDir, null); continue; }
      if (r.withDir == null) { assert.ok(!/with |against /.test(r.label)); continue; }
      r.withDir ? w++ : a++; assert.match(r.label, r.withDir ? / · with (D1|H4|H1)$/ : / · against (D1|H4|H1)$/); assert.ok(r.log.some((x) => /direction/.test(x.text)));
      // the same answer with every candle after the return cut away
      const again = M.barrierTrades(cut(X, r.endT ? r.endT + 60 : e), F, { from: e - 20 * 86400 }).find((q) => q.id === r.id); if (again) assert.equal(again.withDir, r.withDir); } }
  assert.ok(w >= 1 && a >= 1, 'both kinds occur: ' + w + ' / ' + a);
});

test('the CF as a barrier: the sequence hands its clean CF zones over, and the barrier entry reads them without hindsight', () => {
  let n = 0;
  for (const seed of [7, 11, 23, 31, 47]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, cfz = [];
    M.sopTrades(X, F, { from: fr, cfOut: cfz });
    assert.ok(cfz.every((z) => (z.kind === 'cf' || z.kind === 'vr') && z.hi > z.lo && z.known > 0 && (z.dir === 1 || z.dir === -1)));
    assert.equal(new Set(cfz.map((z) => z.tf + '|' + z.lo + '|' + z.hi + '|' + z.known)).size, cfz.length, 'each CF zone once');
    const plain = M.barrierTrades(X, F, { from: fr }), all = M.barrierTrades(X, F, { from: fr, extra: cfz }), cf = all.filter((r) => /CF barrier/.test(r.label));
    assert.ok(plain.every((r) => !/(CF|VR) barrier/.test(r.label)), 'without the hand-over nothing changes');
    for (const r of cf) { n++; assert.match(r.id, /bar-(j-)?cf-/); assert.equal(r.kind, 'barrier'); assert.ok(r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry, 'rule 1');
      assert.ok(Math.abs(r.target - r.entry) / r.r0 >= 1 - 1e-9); assert.ok(r.log[0].t <= r.log[1].t && r.log[1].t <= r.log[2].t && r.log[2].t <= r.t, 'known, then the return, then the QM, then the fill');
      // the sequence's rule: no entry once price reached the VR's extreme after the CF was known
      const fine = X['1m'], tg = r.zone.tgt; if (isFinite(tg)) assert.ok(!fine.some((b) => b.time >= r.zone.known && b.time < r.t && (r.side > 0 ? b.high >= tg : b.low <= tg)), 'no entry after the VR extreme was reached: ' + r.id);
      // cut just after the fill: the same entry is already there
      const c2 = cut(X, r.t + 120), z2 = []; M.sopTrades(c2, F, { from: fr, cfOut: z2 });
      const again = M.barrierTrades(c2, F, { from: fr, extra: z2 }).find((q) => q.id === r.id); assert.ok(again, 'found when cut: ' + r.id); assert.deepEqual([again.entry, again.stop, again.target], [r.entry, r.stop, r.target]); } }
  assert.ok(n >= 1, 'CF barrier entries on these candles: ' + n);
});

// 21 Nov 2026: the parts of the method's pages the replay did not yet apply
const keyOf = (r) => [r.id, r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4)].join('|');
const allOf = (X, fr, T) => { const Y = T ? cut(X, T) : X, z = []; const s = M.sopTrades(Y, F, { from: fr, cfOut: z }); return s.concat(M.barrierTrades(Y, F, { from: fr, extra: z })); };
const knownAt = (r) => r.kind === 'sop' ? r.t : Math.max(r.t + 300, r.log[1].t - (r.log[1].t % M.SEC[r.h]) + M.SEC[r.h]);
const rule1 = (r) => r.side > 0 ? r.stop < r.entry && r.target > r.entry : r.stop > r.entry && r.target < r.entry;

test('the CF hand-over: only on the candle whose close made the CF, never a CF from before the window, and the same with later candles cut', () => {
  let n = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, z = [];
    M.sopTrades(X, F, { from: fr, cfOut: z }); n += z.length;
    for (const [qi, q] of z.entries()) { assert.ok(q.known >= fr, 'handed over inside the window: ' + q.known);
      assert.ok(X[q.tf].some((b) => b.time + M.SEC[q.tf] === q.known), 'known = the close of a candle of its timeframe');
      if (qi >= 4) continue; const z2 = []; M.sopTrades(cut(X, q.known), F, { from: fr, cfOut: z2 });
      assert.ok(z2.some((p) => p.kind === q.kind && p.tf === q.tf && p.known === q.known && p.lo === q.lo && p.hi === q.hi), 'already there at its own close'); }
    // a CF that closed before the window is not handed over at the window's first candle
    const late = fr + 3 * 86400, z3 = []; M.sopTrades(X, F, { from: late, cfOut: z3 });
    assert.ok(z3.every((q) => q.known >= late)); }
  assert.ok(n >= 4, 'zones handed over: ' + n);
});

test('the Janda: a QM at the barrier, then the next break the same way is a normal BO; the limit at that BO\'s level, a stop on the losing side, no hindsight', () => {
  let n = 0;
  for (const seed of [7, 11, 23, 31]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, full = allOf(X, fr), J = full.filter((r) => r.janda);
    let cuts = 0; for (const r of J) { n++; assert.match(r.id, /bar-j-/); assert.match(r.label, / · Janda/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.ok(r.side > 0 ? r.entry > Number(/closed above ([0-9]+\.[0-9]+)/.exec(r.log[2].text)[1]) : r.entry < Number(/closed below ([0-9]+\.[0-9]+)/.exec(r.log[2].text)[1]), 'the Janda BO is beyond the QM');
      assert.ok(r.log[2].t <= r.log[3].t && r.log[3].t <= r.t, 'QM, then the BO, then the fill');
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'Janda entries on these candles: ' + n);
});

test('the VR box as a barrier the other way, from the moment its CF made a range; a stop on the losing side, no hindsight', () => {
  let n = 0;
  for (const seed of [7, 11, 23, 31, 47]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, z = [];
    M.sopTrades(X, F, { from: fr, cfOut: z });
    for (const v of z.filter((q) => q.kind === 'vr')) { const c = z.find((q) => q.kind === 'cf' && q.known === v.known && q.tf === v.tf); assert.ok(c && c.dir === -v.dir, 'a VR goes with its CF, the other way'); }
    const V = allOf(X, fr).filter((r) => /VR barrier/.test(r.label));
    let cuts = 0; for (const r of V) { n++; assert.match(r.id, /bar-(j-)?vr-/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'VR barrier entries on these candles: ' + n);
});

test('an internal BO starts the same BO, VR, CF sequence, recorded apart; off with ibo: false; no hindsight', () => {
  let n = 0;
  // on these random walks every internal sequence that reaches an EG has its CF inside the VR, so they are read with case2 on
  for (const seed of [3, 7, 11]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, s = M.sopTrades(X, F, { from: fr, case2: true }), I = s.filter((r) => r.ibo);
    assert.deepEqual(M.sopTrades(X, F, { from: fr, ibo: false, case2: true }).map((r) => r.id), s.filter((r) => !r.ibo).map((r) => r.id), 'the major sequence is untouched');
    assert.ok(M.sopTrades(X, F, { from: fr }).filter((r) => r.ibo).every((r) => r['case'] !== 2), 'the case-2 rule holds for internal sequences too');
    for (const r of I) { n++; assert.match(r.id, /sop-i-/); assert.match(r.label, / iBO → /); assert.match(r.log[0].text, / iBO (buy|sell): /); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const c = M.sopTrades(cut(X, r.t + 7 * 60), F, { from: fr, case2: true }); assert.ok(c.map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'iBO sequence entries on these candles: ' + n);
});

test('the Janda\'s second table: an H4 barrier may also confirm on M1 and an H1 barrier on M1, only where one-minute candles exist', () => {
  assert.deepEqual(M.JANDA_ALT, { '4h': '1m', '1h': '1m' });
  let n = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, full = allOf(X, fr), A = full.filter((r) => r.jandaM1);
    let cuts = 0; for (const r of A) { n++; assert.ok(r.janda && r.l === '1m' && (r.h === '4h' || r.h === '1h'), r.id); assert.match(r.id, /bar-j-.*-1m-/); assert.match(r.label, / · Janda \(M1\)/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); }
    // no one-minute candles: no M1 alternative, and the simple CF never uses it
    const no1 = { ...X }; delete no1['1m']; const z = []; M.sopTrades(no1, F, { from: fr, cfOut: z });
    assert.ok(M.barrierTrades(no1, F, { from: fr, extra: z }).every((r) => !r.jandaM1));
    assert.ok(full.filter((r) => r.kind === 'barrier' && !r.janda && !r.m5).every((r) => r.l === M.BARRIER.find((p) => p[0] === r.h)[1])); }
  assert.ok(n >= 1, 'M1 Janda entries on these candles: ' + n);
});

// 21 Nov 2026: the owner's four readings, decided after comparing the desk with his own example trades. Each is its own record
// beside the older ones (the older records are pinned below exactly as the code before gave them).
const isNew = (r) => !!(r.jandaM1 || r.m5 || r.atZone || r.visit > 1 || r.sweep);
test('the older records still appear exactly as before, and every new reading is recorded beside them', async () => {
  const { createHash } = await import('node:crypto'), key = (r) => [r.id.replace(/-[bs](\d+)$/, '-$1'), r.side, r.entry.toFixed(4), r.stop.toFixed(4), r.target.toFixed(4), r.status].join('|');
  // hashes of the code before these readings (the sequence with the protected-swing VR, the barriers without the new readings)
  // pins = the code of 495073158 with an M1 Janda counted as its own reading (review, 21 Nov 2026)
  const PIN = { 7: [55, 'bb53a8ed7f0db3e3'], 11: [52, 'b6d7de54ab81d515'] }, seen = { m5: 0, atZone: 0, sweep: 0, visit: 0 };
  for (const seed of [7, 11]) { const X = seed === 7 ? B : market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 14 * 86400, bars = M.barrierTrades(X, F, { from: fr });
    const old = M.sopTrades(X, F, { from: fr, near: false, retest: false }).concat(bars).filter((r) => !isNew(r)).map(key).sort();
    // review 21 Nov 2026: a buy and a sell filled in one minute are two records (the side is in the id), and no id twice
    assert.equal(new Set(bars.map((r) => r.id)).size, bars.length, 'no barrier id twice, seed ' + seed); assert.ok(bars.every((r) => /-[bs]\d+$/.test(r.id)), 'the side is in the id');
    assert.deepEqual([old.length, createHash('sha256').update(old.join('\n')).digest('hex').slice(0, 16)], PIN[seed], 'seed ' + seed + ': the older records changed');
    for (const r of bars.filter(isNew)) { if (r.m5) seen.m5++; if (r.atZone) seen.atZone++; if (r.sweep) seen.sweep++; if (r.visit > 1) seen.visit++;
      assert.ok(rule1(r), 'rule 1: ' + r.id); const g = M.readings({ id: r.id }); assert.deepEqual([g.m5, g.atZone, g.sweep, g.visit], [!!r.m5, !!r.atZone, !!r.sweep, r.visit], 'the reading is read back from the id alone: ' + r.id);
      // a new reading never repeats an order already recorded (same side, price and fill)
      assert.ok(!bars.some((q) => q !== r && !isNew(q) && q.side === r.side && q.t === r.t && Math.abs(q.entry - r.entry) < 1e-9), 'a duplicate order: ' + r.id); } }
  for (const k of Object.keys(seen)) assert.ok(seen[k] >= 1, k + ' records on these candles: ' + seen[k]);
});

test('entry at the zone: a second limit at the barrier zone\'s near side, only when the QM closed outside it; stop on the losing side; no hindsight', () => {
  let n = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, full = allOf(X, fr), Z = full.filter((r) => r.atZone);
    let cuts = 0; for (const r of Z) { n++; assert.match(r.id, /-z-[bs]\d+$/); assert.match(r.label, / · at the zone/); assert.ok(!r.janda, 'the simple CF only'); assert.ok(rule1(r), 'rule 1: ' + r.id);
      assert.equal(r.entry, r.side < 0 ? r.zone.lo : r.zone.hi, 'the limit sits at the near side of the barrier');
      const qm = M.SEC[r.l], c = X[r.l].find((b) => b.time + qm === r.log[2].t); assert.ok(c && (r.side < 0 ? c.close < r.entry : c.close > r.entry), 'the QM candle closed outside the zone');
      assert.ok(r.log[2].t <= r.t, 'placed at the QM, filled after');
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'entries at the zone: ' + n);
});

test('M5 confirm: H4 and M15 barriers also confirmed on M5 (never D1, never H1, whose table timeframe is M5 already); no hindsight', () => {
  assert.deepEqual(M.M5_ALT, { '4h': '5m', '15m': '5m' });
  let n = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, full = allOf(X, fr), A = full.filter((r) => r.m5);
    let cuts = 0; for (const r of A) { n++; assert.ok((r.h === '4h' || r.h === '15m') && r.l === '5m', r.id); assert.match(r.id, /-m5-/); assert.match(r.label, / · M5 confirm/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'M5-confirmed entries: ' + n);
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
  let n = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, S = allOf(X, fr).filter((r) => r.sweep);
    let cuts = 0; for (const r of S) { n++; assert.match(r.id, /bar-(j-)?sw-/); assert.match(r.label, /sweep barrier · swing (high|low)/); assert.ok(rule1(r), 'rule 1: ' + r.id);
      const H = X[r.h], k = H.findIndex((b) => b.time === r.zone.touch), b = H[k], p = r.zone.level;
      assert.ok(r.side < 0 ? b.high > p && b.close <= p : b.low < p && b.close >= p, 'swept and closed back: ' + r.id);
      assert.ok(r.log[2].t >= r.zone.wait + M.SEC[r.l], 'the QM closed after the sweeping candle closed');
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'sweep entries: ' + n);
});

test('second visits: a zone taken again after price left it and came back, before it was broken; the visits are the same with later candles cut', () => {
  let n = 0, z2 = 0;
  for (const seed of [7, 11, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400;
    for (const tf of ['1h', '15m']) { const H = X[tf], zs = M.zonesOf(tf, X, F), T = e - 6 * 86400, cutZ = M.zonesOf(tf, cut(X, T), F);
      for (const z of zs) { const all = [z.touch].concat(z.visits); if (!z.visits.length) continue; z2++;
        for (let v = 1; v < all.length; v++) { const a = H.findIndex((b) => b.time === all[v - 1]), b = H.findIndex((q) => q.time === all[v]); assert.ok(b > a);
          assert.ok(H.slice(a + 1, b).some((q) => z.dir < 0 ? q.high < z.lo : q.low > z.hi), 'price left the zone in between');
          assert.ok(z.dir < 0 ? H[b].high >= z.lo : H[b].low <= z.hi, 'the visit candle trades into it');
          assert.ok(!H.slice(H.findIndex((q) => q.time + M.SEC[tf] === z.known), b).some((q) => z.dir < 0 ? q.close > z.hi : q.close < z.lo), 'not broken before the visit'); }
        const c = cutZ.find((q) => q.known === z.known && q.lo === z.lo && q.hi === z.hi && q.dir === z.dir);
        if (c) assert.deepEqual(c.visits, z.visits.filter((t) => t + M.SEC[tf] <= T), 'the same visits with later candles cut'); } }
    const V = allOf(X, fr).filter((r) => r.visit > 1);
    let cuts = 0; for (const r of V) { n++; assert.match(r.id, /-v\d+-/); assert.match(r.label, r.visit === 2 ? / · second visit/ : / · visit \d/); assert.ok(rule1(r), 'rule 1: ' + r.id); assert.match(r.log[1].text, /left the barrier and came back/);
      const T = knownAt(r) + 37 * 60; if (T > e || ++cuts > 2) continue; assert.ok(allOf(X, fr, T).map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(z2 >= 1 && n >= 1, 'zones with later visits: ' + z2 + ', entries: ' + n);
});

test('the VR from the nearest swing (msMosha o.near): the box ends at the last internal swing before the extreme, known when the VR formed', () => {
  // a buy BO at t 0; the leg rises with a swing low at 104 (3 candles a side) before the extreme 112; the VR (a sell QM) breaks the protected low 100
  const p = [101, 103, 105, 107, 106, 105, 104, 105, 106, 107, 109, 111, 112, 110, 108, 106, 104, 102, 99];
  const bars = p.map((x, i) => ({ time: (i + 1) * 300, open: x, high: x + 0.5, low: x - 0.5, close: x }));
  const V = { dir: -1, level: 100, t: 19 * 300, fromT: 300, top: 101, bot: 99, structure: true }, htf = { dir: 1, level: 98, t: 0, ext: NaN, far: 90 };
  const old = F.msMosha(htf, { events: [V], bars }, 0.3), nr = F.msMosha(htf, { events: [V], bars }, 0.3, { near: true });
  assert.deepEqual([old.vr.lo, old.vr.hi, !!old.vr.near], [100, 112.5, false], 'without o: the protected level, as the charts read it');
  assert.deepEqual([nr.vr.lo, nr.vr.hi, nr.vr.near, nr.vr.ext], [103.5, 112.5, true, 112.5], 'with o.near: the nearest swing low before the extreme');
  // a swing confirmed only after the VR formed is not used
  // a swing low at 104 whose third candle after it closes only after the VR formed is not known yet: the box stays as before
  const q = [101, 103, 105, 107, 106, 105, 104, 106, 112, 105, 103].map((x, i) => ({ time: (i + 1) * 300, open: x, high: x + 0.5, low: x - 0.5, close: x }));
  assert.equal(F.msMosha(htf, { events: [{ ...V, t: 9 * 300 }], bars: q }, 0.3, { near: true }).vr.lo, 100);
  assert.equal(F.msMosha(htf, { events: [{ ...V, t: 10 * 300 }], bars: q }, 0.3, { near: true }).vr.lo, 103.5, 'once confirmed it is taken');
  // the sequence uses it by default; the older reading's entries all remain (a smaller box only turns a CF inside the VR into a clean one) with the same levels
  for (const seed of [7, 23]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, a = M.sopTrades(X, F, { from: fr, near: false, retest: false }), b = M.sopTrades(X, F, { from: fr, retest: false });
    for (const r of a) { const q = b.find((x) => x.id === r.id); assert.ok(q, 'the older entry remains: ' + r.id); assert.deepEqual([q.entry, q.stop, q.target], [r.entry, r.stop, r.target]); }
    assert.ok(b.every((r) => r['case'] !== 2 && rule1(r))); }
});

// 21 Nov 2026 (owner, on two EUR/USD buys: "this should be a sell"): once the chart under the BO has turned the other way on its
// small swings, the BO gives no more entries; the VR level is traded the other way on its retest (at the level, stop past the
// VR's top; or a new CF after the touch, stop past the CF box), target the last low.
test('after a turn the VR is retested the other way: a stop on the losing side, the last low as target, no hindsight; off with retest: false', () => {
  let n = 0;
  for (const seed of [3, 7, 11, 23, 31, 47]) { const X = market(26, seed), e = X['1m'].at(-1).time + 60, fr = e - 20 * 86400, s = M.sopTrades(X, F, { from: fr }), R = s.filter((r) => r.retest);
    assert.ok(M.sopTrades(X, F, { from: fr, retest: false }).every((r) => !r.retest));
    // a retest needs price to have gone 1R past the VR level first; the old BO's entries stop only from then
    assert.ok(R.every((r) => r.log.some((x) => / turned (buy|sell)/.test(x.text))));
    for (const r of R) { n++; assert.ok(rule1(r), 'rule 1: ' + r.id); assert.match(r.id, /sop-v[rc]-/); assert.match(r.label, / turned → .* VR retest/);
      assert.ok(r.log.every((x, i) => !i || x.t >= r.log[i - 1].t), 'log in time order: ' + r.id);
      // a limit at the level rests from the touch candle's open and is seen once that candle closed; a new CF at its close
      const T = r.retest === 'level' ? r.t - (r.t % M.SEC[r.l]) + M.SEC[r.l] : r.t + 7 * 60;
      const c = M.sopTrades(cut(X, T), F, { from: fr }); assert.ok(c.map(keyOf).includes(keyOf(r)), 'found only with later candles: ' + r.id); } }
  assert.ok(n >= 1, 'VR retest entries on these candles: ' + n);
});
