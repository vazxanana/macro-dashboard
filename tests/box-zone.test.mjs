import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { boxes, zones, candidates, fold } from '../research/edge/box-zone/run.mjs';

const bar = (i, o, h, l, c, sec = 86400) => ({ time: 1262563200 + i * sec, open: o, high: h, low: l, close: c });

test('a box follows price while closes stay inside, the closing-out candle starts the next', () => {
  const C = [bar(0, 1, 2, 0, 1), bar(1, 1, 1.8, 0.5, 1.5), bar(2, 1.5, 1.9, 1, 1.2), bar(3, 1.2, 3, 1.1, 2.5), bar(4, 2.5, 2.8, 2.2, 2.4)];
  const B = boxes(C, 86400);
  assert.equal(B.length, 1);
  assert.deepEqual([B[0].hi, B[0].lo, B[0].dir, B[0].n, B[0].bi], [2, 0, 1, 3, 3]);
});

test('a turn box is a zone; one that breaks the same way as the break before is not', () => {
  // up box (3 candles), then a box that breaks down (3 candles) = supply zone
  const C = [bar(0, 1, 2, 0.9, 1), bar(1, 1, 1.5, 1, 1.2), bar(2, 1.2, 1.6, 1, 1.3), bar(3, 1.3, 2.6, 1.3, 2.5),
    bar(4, 2.5, 2.7, 2.2, 2.4), bar(5, 2.4, 2.6, 2.3, 2.5), bar(6, 2.5, 2.5, 1.1, 1.2), bar(7, 1.2, 1.3, 1.1, 1.2)];
  const Z = zones(C);
  assert.equal(Z.length, 1);
  assert.equal(Z[0].dir, -1);
  assert.equal(Z[0].hi, 2.7);
});

test('weekend candles fold into Monday', () => {
  const sat = Date.UTC(2026, 10, 21) / 1000, mon = Date.UTC(2026, 10, 23) / 1000;
  const F = fold([{ time: sat, open: 1, high: 3, low: 1, close: 2 }, { time: mon, open: 2, high: 2.5, low: 0.5, close: 2.2 }]);
  assert.deepEqual(F, [{ time: mon, open: 1, high: 3, low: 0.5, close: 2.2 }]);
});

test('every candidate has its stop on the losing side and its target on the winning side', () => {
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const H = []; let p = 1.1;
  for (let i = 0; i < 6000; i++) { const o = p; p += (rnd() - 0.5) * 0.004 + Math.sin(i / 300) * 0.0004; H.push(bar(i, o, Math.max(o, p) + rnd() * 0.001, Math.min(o, p) - rnd() * 0.001, p, 14400)); }
  const D = []; for (let k = 0; k < H.length; k += 6) { const g = H.slice(k, k + 6); D.push({ time: g[0].time, open: g[0].open, high: Math.max(...g.map((x) => x.high)), low: Math.min(...g.map((x) => x.low)), close: g.at(-1).close }); }
  const C = candidates(D, H);
  assert.ok(C.length > 0);
  for (const c of C) { assert.ok(c.d > 0 ? c.stop < c.entry && c.tgt > c.entry : c.stop > c.entry && c.tgt < c.entry); }
});

test('the report matches result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/box-zone/result.json', import.meta.url)));
  assert.equal(r.verdict, 'FAIL');
  assert.equal(r.pool.n, 1029);
  const md = fs.readFileSync(new URL('../research/edge/box-zone/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, /FAIL, 1 of 4/);
  assert.match(md, new RegExp(r.pool.n.toLocaleString('en-US')));
});
