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
  for (const r of sop) { assert.match(r.log[0].text, /BO (buy|sell)/); assert.match(r.log[1].text, / VR: the first BO Structure \(QM\) against the BO/); assert.match(r.log[2].text, / CF.*BO Structure \(QM\) back with the BO/); assert.ok(r.deep === null || typeof r.deep === 'boolean'); }
  // the return to the barrier is a moment on the finest candles, and the confirmation closes after it (never a QM from before price was there)
  for (const r of bar) { const z = r.marks[0], t0 = r.log[1].t, fine = B['1m'] && B['1m'].length && B['1m'][0].time <= t0 ? B['1m'] : B['5m'], c = fine.find((b) => b.time === t0);
    assert.ok(c, 'the return is a fine candle: ' + r.id); assert.ok(r.side < 0 ? c.high >= z.bot : c.low <= z.top, 'that candle trades into the barrier'); assert.ok(r.log[2].t > t0, 'the CF closes after the return'); }
  for (const r of bar) { assert.match(r.log[0].text, /barrier: a fresh (supply|demand) zone/); assert.match(r.log[2].text, / CF: a QM \(BO Structure\)/); assert.match(r.log[3].text, /pulled back to the level/); assert.deepEqual([r.h, r.l], M.BARRIER.find((p) => p[0] === r.h), 'the confirmation timeframe of the method\'s table'); assert.ok(Math.abs(Math.abs(r.target - r.entry) / r.r0 - M.BARRIER_R) < 1e-9); }
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
