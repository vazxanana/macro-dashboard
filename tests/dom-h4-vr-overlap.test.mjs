// tests/dom-h4-vr-overlap.test.mjs - offline: the box, the set rule and the committed result of research/edge/dom-h4-vr-overlap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as K from '../research/edge/_lib/edgekit.mjs';
import { frames } from '../research/edge/combo-grid-3/run.mjs';
import { domTrades } from '../research/edge/dom-vb-side/run.mjs';
import { vrBoxes, boxAt, classify, tradesOf, analyse, verdictLine, CELLS, MIN_N } from '../research/edge/dom-h4-vr-overlap/run.mjs';

const DIR = new URL('../research/edge/dom-h4-vr-overlap/', import.meta.url);
const T0 = Date.UTC(2016, 0, 4) / 1000;
// a seeded 5-minute market (weekdays only), EUR/USD-sized
function seeded(seed, days = 150) {
  const rnd = K.rng(seed), out = []; let p = 1.1, drift = 0;
  for (let d = 0; d < days; d++) {
    const day = T0 + d * 86400; if ([0, 6].includes(new Date(day * 1000).getUTCDay())) continue;
    for (let i = 0; i < 288; i++) {
      if (rnd() < 0.004) drift = (rnd() - 0.5) * 0.0002;
      const o = p, c = o + drift + (rnd() - 0.5) * 0.0008, h = Math.max(o, c) + rnd() * 0.0003, l = Math.min(o, c) - rnd() * 0.0003;
      out.push({ t: day + i * 300, o, h, l, c, e: day + i * 300 + 300 }); p = c;
    }
  }
  return out;
}
const M5 = seeded(11), F = frames(M5), BX = vrBoxes(F['4h'], F['1h']);

test('the box: an H1 counter-break after an H4 break, extreme on the break side, known only at a close, never overlapping in time', () => {
  assert.ok(BX.length >= 10, 'boxes on the seeded market: ' + BX.length);
  const ev = K.structure(F['4h'], 3).events;
  for (let i = 0; i < BX.length; i++) {
    const b = BX[i]; assert.ok(b.top > b.bot); assert.ok(b.at > b.evT && b.end >= b.at);
    assert.ok(ev.some((e) => e.t === b.evT && e.dir === b.D));
    if (i) assert.ok(BX[i - 1].end <= b.at, 'one current box at a time');
    // the counter-break candle closed through the level on the side against the H4 break
    const j = F['1h'].findIndex((x) => x.e === b.at), c = F['1h'][j].c;
    assert.ok(b.D > 0 ? c < b.bot : c > b.top);
    // the extreme is the move's own: no H1 candle from the H4 break candle's start to the counter-break trades past it
    const h4 = F['4h'].find((x) => x.e === b.evT);
    for (const x of F['1h']) if (x.t >= h4.t && x.e <= b.at) assert.ok(b.D > 0 ? x.h <= b.top : x.l >= b.bot);
  }
});

test('no look-ahead: boxes known before a cut are the same from the cut series; later prices change nothing before it', () => {
  for (const frac of [0.4, 0.63, 0.81]) {
    const T = Math.floor((M5[Math.floor(M5.length * frac)].t) / 14400) * 14400;
    const cut = M5.filter((b) => b.e <= T), Fc = frames(cut), key = (b) => [b.D, b.bot, b.top, b.at, b.evT, Math.min(b.end, T)].join('|');
    const B = new Set(vrBoxes(Fc['4h'], Fc['1h']).map(key)), A = BX.filter((b) => b.at <= T);
    assert.ok(A.length > 2); for (const b of A) assert.ok(B.has(key(b)), 'box at ' + b.at);
    // every later price changed: the trades armed and finished before the cut keep their set and result
    const mod = M5.map((b) => (b.e <= T ? b : { ...b, o: b.o * 1.03, h: b.h * 1.03, l: b.l * 1.03, c: b.c * 1.03 }));
    const a = tradesOf('eurusd', T0 + 40 * 86400, T, M5).filter((x) => x.t + 3 * 86400 <= T), m = tradesOf('eurusd', T0 + 40 * 86400, T, mod).filter((x) => x.t + 3 * 86400 <= T);
    assert.deepEqual(m.map((x) => [x.ts, x.t, x.set, x.r2]), a.map((x) => [x.ts, x.t, x.set, x.r2]));
  }
});

test('the order: a stop on the losing side, the 2R result bounded, and the list is the dominant-zone study\'s own', () => {
  const from = T0 + 40 * 86400, to = M5[M5.length - 1].e, mine = tradesOf('eurusd', from, to, M5), theirs = domTrades('eurusd', from, to, M5);
  assert.ok(mine.length > 100, 'trades: ' + mine.length);
  assert.equal(mine.length, theirs.length);
  mine.forEach((x, i) => {
    assert.ok(x.side * (x.entry - x.stop) > 0 && x.risk > 0, 'stop on the losing side');
    assert.ok(x.r2 <= 2 + 1e-9 && x.r2 >= -3, 'r2 ' + x.r2);
    assert.equal(x.t, theirs[i].t); assert.equal(x.ts, theirs[i].ts); assert.equal(x.side, theirs[i].side);
    assert.ok(Math.abs(x.trail - theirs[i].trail) < 1e-12);
    assert.ok([0, 1, 2].includes(x.set));
  });
  assert.ok(mine.some((x) => x.set === 1) && mine.some((x) => x.set === 2) && mine.some((x) => x.set === 0));
});

test('the set rule: current box only, overlap of the zone body, side against the H4 break', () => {
  const boxes = [{ D: 1, bot: 10, top: 12, at: 100, end: 200 }, { D: -1, bot: 5, top: 6, at: 300, end: 400 }];
  assert.equal(boxAt(boxes, 99), null); assert.equal(boxAt(boxes, 100), boxes[0]); assert.equal(boxAt(boxes, 200), null); assert.equal(boxAt(boxes, 350), boxes[1]);
  assert.equal(classify({ d: 1, bot: 11.5, top: 13 }, 150, boxes), 1);
  assert.equal(classify({ d: -1, bot: 11.5, top: 13 }, 150, boxes), 2);
  assert.equal(classify({ d: 1, bot: 12.1, top: 13 }, 150, boxes), 0);
  assert.equal(classify({ d: 1, bot: 11.5, top: 13 }, 250, boxes), 0);
  assert.equal(classify({ d: -1, bot: 5.5, top: 7 }, 350, boxes), 1);
});

test('result.json: the bar, the verdict, and RESULT.md says the same', () => {
  const R = JSON.parse(fs.readFileSync(new URL('result.json', DIR), 'utf8')), md = fs.readFileSync(new URL('RESULT.md', DIR), 'utf8');
  const ok = (x) => x.n >= MIN_N && x.net > 0 && x.t >= 2;
  for (const k of CELLS) { const s = R.sets[k]; assert.equal(R.cells[k].pass, ok(s.disc) && ok(s.conf) && R.cells[k].holm < 0.05, k);
    for (const w of ['disc', 'conf']) assert.ok(Math.abs(s[w].R - s[w].costR - s[w].net) < 2e-4, `${k} ${w}: net = R - cost`); }
  const pass = CELLS.some((k) => R.cells[k].pass);
  assert.equal(R.verdict, pass ? 'PASS' : CELLS.some((k) => R.cells[k].enough) ? 'FAIL' : 'INCONCLUSIVE');
  for (const w of ['disc', 'conf']) { assert.equal(R.sets.in[w].n + R.sets.out[w].n, R.sets.all[w].n); assert.equal(R.sets.inWith[w].n + R.sets.inAgainst[w].n, R.sets.in[w].n); }
  for (const c of R.cut) assert.equal(c.diff, 0, c.market + ' ' + c.cut);
  const lines = md.split('\n');
  assert.equal(lines[2], verdictLine(R));
  assert.match(lines[2], new RegExp(`^\\*\\*Verdict: ${R.verdict}\\. `));
  const b = R.sets[R.best].conf, sg = (v) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3);
  assert.ok(lines[2].includes(sg(b.net) + 'R') && lines[2].includes('n ' + b.n.toLocaleString('en-US')));
  assert.ok(!/\bedge\b/i.test(lines[2]));
});

test('analyse on made-up rows: counts, Holm over three cells, INCONCLUSIVE under 300', () => {
  const rows = []; const t = Date.UTC(2010, 0, 15) / 1000, t2 = Date.UTC(2020, 0, 15) / 1000;
  for (let i = 0; i < 40; i++) for (const tt of [t, t2]) rows.push({ m: 'x', t: tt + i * 86400 * 20, r2: i % 3 ? -1 : 2, trail: 0, cr: 0.1, set: i % 3 });
  const A = analyse(rows);
  assert.equal(A.verdict, 'INCONCLUSIVE'); assert.equal(A.sets.all.disc.n, 40); assert.equal(A.sets.in.disc.n + A.sets.out.disc.n, 40);
  assert.equal(A.sets.out.disc.R, 2); assert.equal(A.sets.in.conf.net, -1.1);
});
