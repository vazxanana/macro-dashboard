// h4-zone-trail: the harness on made-up candles, and the report against result.json
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { trades, clean, stats, FROM } from '../research/edge/h4-zone-trail/run.mjs';
const rd = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
function mb(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const walk = (seed, n) => { const rnd = mb(seed), rows = []; let p = 1.2, t = FROM - 40 * 86400; for (let i = 0; i < n; i++, t += 3600) { const o = p; let h = o, l = o; for (let k = 0; k < 60; k++) { p += (rnd() - 0.5) * 0.0004; h = Math.max(h, p); l = Math.min(l, p); } rows.push([t, o, h, l, p]); } return clean(rows); };

test('h4-zone-trail: every trade has its stop on the losing side, one at a time, never worse than -1R but for a gap, and a random market gives about zero', () => {
  const T = trades(walk(1, 60000), 'eurusd', {}); assert.ok(T.length > 500, 'trades: ' + T.length);
  for (const x of T) { assert.ok(x.side > 0 ? x.stop < x.entry : x.stop > x.entry, 'rule 1'); if (x.how !== 'gap') assert.ok(x.R >= -1 - 1e-9); const h = new Date(x.t * 1000).getUTCHours(); assert.ok(h < 17, 'no fill 17-24 UTC'); }
  for (let i = 1; i < T.length; i++) assert.ok(T[i].t >= T[i - 1].endT, 'one position at a time');
  const g = T.reduce((a, x) => a + x.R, 0) / T.length; assert.ok(Math.abs(g) < 0.12, 'no bias on a random walk: ' + g.toFixed(3));
  assert.ok(stats(T).n === T.filter((x) => x.t >= FROM).length);
});
test('h4-zone-trail: the report says what result.json holds, and the pre-registration came first', () => {
  const r = JSON.parse(rd('research/edge/h4-zone-trail/result.json')), md = rd('research/edge/h4-zone-trail/RESULT.md');
  assert.equal(r.verdict, 'FAIL'); assert.match(md, /\*\*Verdict: FAIL\.\*\*/);
  assert.ok(md.includes(r.pooled.all.n.toLocaleString('en-US')) && md.includes(String(r.pooled.all.net)) && md.includes(String(r.pooled.all.monthT)));
  for (const k of ['xau', 'eurusd', 'gbpusd']) assert.ok(md.includes(r.markets[k].all.n.toLocaleString('en-US')) && md.includes(String(Math.abs(r.markets[k].all.net))), k);
  assert.match(rd('research/edge/h4-zone-trail/PREREGISTRATION.md'), /committed before any candle of the test window was read/);
});
