// research/edge/gold-shock-revert: the rule's pieces on hand-made candles, and RESULT.md against result.json (offline)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { atrAt, events, trade, run, holm, toDays, P } from '../research/edge/gold-shock-revert/run.mjs';
import { FIN, nights } from '../council/fills.mjs';

const D = 86400, T0 = Date.UTC(2024, 0, 1) / 1000; // a Monday
// flat weekday candles: range 10 around 1000 (true range 10), then whatever the test appends
function flat(n) { const ds = []; let t = T0; while (ds.length < n) { const w = new Date(t * 1000).getUTCDay(); if (w && w !== 6) ds.push({ time: t, open: 1000, high: 1005, low: 995, close: 1000 }); t += D; } return ds; }
const next = (ds) => { let t = ds.at(-1).time + D; while ([0, 6].includes(new Date(t * 1000).getUTCDay())) t += D; return t; };
const add = (ds, o, h, l, c) => { ds.push({ time: next(ds), open: o, high: h, low: l, close: c }); return ds.length - 1; };

test('ATR uses prior days only', () => {
  const ds = flat(25), i = add(ds, 1000, 1100, 1000, 1090);
  assert.equal(atrAt(ds, i), 10);
  assert.equal(atrAt(ds, 20), null); // fewer than 21 prior days
  ds[i].high = 5000; assert.equal(atrAt(ds, i), 10); // day i's own range never enters
  assert.equal(atrAt(ds, i + 0) === atrAt(ds, i), true);
});

test('event detection: over 2 x ATR, with three days after it', () => {
  const ds = flat(25), i = add(ds, 1000, 1025, 1000, 1021); // move 21 > 20
  add(ds, 1021, 1022, 1020, 1021); add(ds, 1021, 1022, 1020, 1021); add(ds, 1021, 1022, 1020, 1021);
  const ev = events(ds); assert.equal(ev.length, 1); assert.equal(ev[0].i, i); assert.equal(ev[0].dir, 1);
  const ds2 = flat(25); add(ds2, 1000, 1025, 1000, 1020); add(ds2, 1, 1, 1, 1); add(ds2, 1, 1, 1, 1); add(ds2, 1, 1, 1, 1);
  assert.equal(events(ds2).filter((e) => e.i === 25).length, 0); // exactly 2 x ATR is not an event
  const ds3 = flat(25); add(ds3, 1000, 1030, 1000, 1030); add(ds3, 1030, 1031, 1029, 1030);
  assert.equal(events(ds3).length, 0); // no three days after it
});

test('entry at the next open, 3-day close exit, financing on buys only', () => {
  const ds = flat(25), i = add(ds, 1000, 1030, 1000, 1030);
  add(ds, 1031, 1035, 1028, 1033); add(ds, 1033, 1036, 1030, 1034); add(ds, 1034, 1040, 1031, 1038); add(ds, 1038, 1039, 900, 900);
  const ev = events(ds)[0], tr = trade(ds, ev, 1);
  assert.equal(tr.entry, 1031); assert.equal(tr.stop, 1021); assert.equal(tr.why, 'time'); assert.equal(tr.exit, 1038);
  assert.equal(tr.R, 0.7); assert.equal(tr.costR, 0.03);
  const nn = nights(ds[i + 1].time, ds[i + 3].time + D); assert.ok(nn >= 3);
  assert.ok(Math.abs(tr.finR - nn * FIN.xau.long * 1031 / 10) < 1e-12);
  const s = trade(ds, ev, -1); assert.equal(s.finR, 0); assert.equal(s.nights, 0);
  assert.ok(Math.abs(tr.net - (0.7 - 0.03 - tr.finR)) < 1e-12);
});

test('stop first: a touched stop exits at the stop, a gap at the open', () => {
  const ds = flat(25); add(ds, 1000, 1030, 1000, 1030);
  add(ds, 1031, 1050, 1020, 1045); add(ds, 1045, 1046, 1040, 1041); add(ds, 1041, 1042, 1040, 1041);
  const ev = events(ds)[0], tr = trade(ds, ev, 1);
  assert.equal(tr.why, 'stop'); assert.equal(tr.exit, 1021); assert.equal(tr.R, -1); assert.equal(tr.xi, ev.i + 1);
  const g = flat(25); add(g, 1000, 1030, 1000, 1030); add(g, 1031, 1032, 1025, 1026); add(g, 1010, 1012, 1005, 1008); add(g, 1008, 1009, 1000, 1001);
  const tg = trade(g, events(g)[0], 1); assert.equal(tg.why, 'gap'); assert.equal(tg.exit, 1010);
  // reversal sells into an up shock; continuation buys
  assert.equal(run(ds, [ev], 'R')[0].side, -1); assert.equal(run(ds, [ev], 'C')[0].side, 1);
});

test('one position at a time; Holm; weekend folded', () => {
  const ds = flat(40), evs = [{ i: 25, dir: 1, atr: 10 }, { i: 26, dir: 1, atr: 10 }, { i: 29, dir: -1, atr: 10 }];
  assert.deepEqual(run(ds, evs, 'C').map((x) => x.ei), [26, 30]);
  assert.deepEqual(holm([0.01, 0.04]), [0.02, 0.04]);
  const sat = Date.UTC(2024, 0, 6) / 1000;
  const days = toDays([[sat - D, 1, 2, 0.5, 1.5, 1], [sat + D, 1.5, 3, 1.4, 1.6, 1], [sat + 2 * D, 1.6, 1.7, 1.2, 1.3, 1]]);
  assert.equal(days.length, 2); assert.equal(days[1].open, 1.5); assert.equal(days[1].high, 3); assert.equal(days[1].low, 1.2);
  assert.equal(P.k, 2); assert.equal(P.atrN, 20); assert.equal(P.hold, 3);
});

test('RESULT.md agrees with result.json', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../research/edge/gold-shock-revert/result.json', import.meta.url), 'utf8'));
  const md = fs.readFileSync(new URL('../research/edge/gold-shock-revert/RESULT.md', import.meta.url), 'utf8');
  assert.match(md, new RegExp(`\\*\\*Verdict: ${r.verdict}\\.\\*\\*`));
  const f = (v) => (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(3);
  for (const k of ['R', 'C']) {
    const g = r.gold.rules[k], d = g.decisive, b = g.replication, row = md.split('\n').find((l) => l.startsWith(`| ${k} (`));
    const cells = row.split('|').map((s) => s.trim()).filter(Boolean);
    assert.deepEqual(cells.slice(1, 10), [String(d.n), f(d.mean), d.t.toFixed(2), r.gold.checks[k].holmP.toFixed(4), String(b.n), f(b.mean), b.t.toFixed(2), f(r.gold.placebo[k].p95), r.gold.checks[k].pass ? 'yes' : 'no']);
  }
  assert.ok(md.includes(`${r.gold.data.days} trading days`)); assert.ok(md.includes(`${r.gold.data.events} events`));
  assert.ok(md.includes('item 44'));
});
