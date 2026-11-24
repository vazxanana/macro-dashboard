// research/edge/h1-origin-h4-range/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): the last opposite H1 candle before
// an H1 structure break (the break's origin zone), a resting limit at its near edge on the first return, split by where the
// entry sits in the H4 dealing range (last confirmed H4 swing low to swing high): aligned (buy in the lower half, sell in the
// upper half) against opposite. Targets 1R and 2R. Five markets pooled, discovery 2005-14, confirmation 2015 to Oct 2026.
// Research only: nothing live imports it, nothing is placed.
//   node research/edge/h1-origin-h4-range/run.mjs run      (reads the shared candle cache; writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const P = { K1: 3, K4: 3, back: 20, atrN: 14, buf: 0.1, minCost: 2, life: 120 * 3600, hold: 120 * 3600 };
export const WIN = { disc: ['2005-01-01', '2015-01-01'], conf: ['2015-01-01', '2026-11-01'] };
export const CELLS = ['aligned 1R', 'aligned 2R', 'opposite 1R', 'opposite 2R'];
export const TARGETS = [1, 2];
const sec = (d) => Date.parse(d + 'T00:00:00Z') / 1000;

// H1 / H4 candles from 5-minute ones; a bucket the 5-minute candles do not yet finish is left out.
export function frames(M5) {
  const end = M5.length ? M5[M5.length - 1].e : 0;
  const cut = (B) => { while (B.length && B[B.length - 1].e > end) B.pop(); return B; };
  return { h1: cut(K.resample(M5, 3600)), h4: cut(K.resample(M5, 14400)) };
}

// Every order the rule makes from closed candles. Each: { side, entry, stop, t (order time = close of the break candle),
// expire, cls 'aligned' | 'opposite' | 'outside', zone [lo, hi], range [lo, hi] | null, j }.
export function orders(H1, H4, cost) {
  const out = []; const ev = K.structure(H1, P.K1).events;
  const sw = K.swings(H4, P.K4).sort((a, b) => a.ct - b.ct || a.i - b.i); let k = 0, SH = null, SL = null;
  const tr = (i) => Math.max(H1[i].h - H1[i].l, Math.abs(H1[i].h - H1[i - 1].c), Math.abs(H1[i].l - H1[i - 1].c));
  for (const e of ev) {
    const j = e.i, b = H1[j], t = b.e;
    while (k < sw.length && sw[k].ct <= t) { const s = sw[k++]; if (s.type === 'H') SH = s; else SL = s; }
    if (j < P.atrN + 1) continue;
    let z = -1;
    for (let i = j - 1; i >= Math.max(0, j - P.back); i--) if (e.dir > 0 ? H1[i].c < H1[i].o : H1[i].c > H1[i].o) { z = i; break; }
    if (z < 0) continue;
    const lo = H1[z].l, hi = H1[z].h;
    if (e.dir > 0 ? !(hi < b.c) : !(lo > b.c)) continue;
    let a = 0; for (let i = j - P.atrN + 1; i <= j; i++) a += tr(i); a /= P.atrN;
    const entry = e.dir > 0 ? hi : lo, stop = e.dir > 0 ? lo - P.buf * a : hi + P.buf * a;
    const risk = e.dir * (entry - stop);
    if (!(risk > 0)) throw new Error('stop on the wrong side');
    if (risk < P.minCost * cost) continue;
    let cls = 'outside', range = null;
    if (SH && SL && SH.price > SL.price) {
      range = [SL.price, SH.price]; const mid = (SH.price + SL.price) / 2;
      if (entry >= SL.price && entry <= SH.price && entry !== mid) cls = (e.dir > 0) === (entry < mid) ? 'aligned' : 'opposite';
    }
    out.push({ side: e.dir, entry, stop, t, expire: t + P.life, cls, zone: [lo, hi], range, j });
  }
  return out;
}

const inBad = (X, t) => X.some((x) => t >= x[0] && t <= x[1]);
const months = (w) => { const a = new Date(sec(WIN[w][0]) * 1000), b = new Date(sec(WIN[w][1]) * 1000); return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth(); };
const mIdx = (w, t) => { const a = new Date(sec(WIN[w][0]) * 1000), d = new Date(t * 1000); return (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth(); };
const blank = (w) => ({ n: 0, wins: 0, s: 0, s2: 0, g: 0, ms: new Array(months(w)).fill(0), mg: new Array(months(w)).fill(0) });

export function trade(o, M5, cost, rr) {
  const r0 = Math.abs(o.entry - o.stop);
  return K.simulate({ side: o.side, entry: o.entry, stop: o.stop, target: o.entry + o.side * rr * r0, t: o.t, type: 'limit', expire: o.expire, maxHold: P.hold }, M5, { cost });
}

function runMarket(market, acc, counts, perMarket, cutLog) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: WIN.conf[1] });
  const { h1, h4 } = frames(M5); const cost = COSTS[market], X = exclusions(market);
  const O = orders(h1, h4, cost);
  counts.breaks += K.structure(h1, P.K1).events.length; counts.orders += O.length;
  perMarket[market] = Object.fromEntries(CELLS.map((c) => [c, { n: 0, s: 0 }]));
  for (const o of O) {
    let first = true;
    for (let ti = 0; ti < TARGETS.length; ti++) {
      const r = trade(o, M5, cost, TARGETS[ti]);
      if (r.status === 'nofill' || r.status === 'bad' || r.status === 'open' || r.Rnet == null) break;
      if (r.fillT * 1 !== r.fillT) break;
      if (first) { first = false; if (inBad(X, r.fillT)) { counts.excluded++; break; } counts.fills++; if (o.cls === 'outside') counts.outside++; }
      if (o.cls === 'outside') break;
      const w = r.fillT >= sec(WIN.disc[0]) && r.fillT < sec(WIN.disc[1]) ? 'disc' : r.fillT >= sec(WIN.conf[0]) && r.fillT < sec(WIN.conf[1]) ? 'conf' : null;
      if (!w) break;
      if (!(o.side * (r.fill - o.stop) > 0) && r.reason !== 'stop') throw new Error('stop not on the losing side');
      const cell = `${o.cls} ${TARGETS[ti]}R`, A = acc[cell][w], m = mIdx(w, r.fillT);
      A.n++; if (r.Rnet > 0) A.wins++; A.s += r.Rnet; A.s2 += r.Rnet * r.Rnet; A.g += r.R; A.ms[m] += r.Rnet; A.mg[m] += r.R;
      if (w === 'conf') { perMarket[market][cell].n++; perMarket[market][cell].s += r.Rnet; }
    }
  }
  // cut test on the last 60,000 five-minute candles: orders from candles cut at a moment equal the full slice's up to it
  const S = M5.slice(-60000), full = orders(...Object.values(frames(S)), cost);
  for (const f of [0.35, 0.6, 0.85]) {
    const n = Math.floor(S.length * f), C = S.slice(0, n), T = C[C.length - 1].e;
    const a = orders(...Object.values(frames(C)), cost).map((o) => [o.t, o.side, o.entry, o.stop, o.cls].join('|'));
    const b = full.filter((o) => o.t <= T).map((o) => [o.t, o.side, o.entry, o.stop, o.cls].join('|'));
    const sa = new Set(a), sb = new Set(b);
    cutLog.push({ market, cut: new Date(T * 1000).toISOString().slice(0, 16), orders: b.length, missing: b.filter((x) => !sa.has(x)).length, extra: a.filter((x) => !sb.has(x)).length });
  }
}

function tOf(xs) { const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)); return sd > 0 ? m / (sd / Math.sqrt(n)) : 0; }
const r3 = (x) => Math.round(x * 1000) / 1000, r2 = (x) => Math.round(x * 100) / 100;
const f3 = (x) => (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3);

function main() {
  const acc = Object.fromEntries(CELLS.map((c) => [c, { disc: blank('disc'), conf: blank('conf') }]));
  const counts = { breaks: 0, orders: 0, fills: 0, outside: 0, excluded: 0 }, perMarket = {}, cut = [];
  for (const m of MARKETS) { runMarket(m, acc, counts, perMarket, cut); console.error(m, JSON.stringify(counts)); }
  const side = (A) => ({ n: A.n, win: A.n ? r3(A.wins / A.n) : null, mean: A.n ? r3(A.s / A.n) : null, t: A.n ? r2(tOf(A.ms)) : null,
    gross: A.n ? r3(A.g / A.n) : null, tGross: A.n ? r2(tOf(A.mg)) : null, months: A.ms.length });
  const cells = CELLS.map((c) => ({ cell: c, disc: side(acc[c].disc), conf: side(acc[c].conf) }));
  const ps = cells.map((c) => (c.conf.mean > 0 ? K.pFromT(c.conf.t, c.conf.months - 1) : 1)); const hp = K.holm(ps);
  cells.forEach((c, i) => { c.p = ps[i]; c.holm = hp[i];
    c.pass = c.disc.n >= 300 && c.conf.n >= 300 && c.disc.mean > 0 && c.conf.mean > 0 && c.disc.t >= 2 && c.conf.t >= 2 && c.holm < 0.05; });
  const enough = cells.some((c) => c.disc.n >= 300 && c.conf.n >= 300);
  const verdict = cells.some((c) => c.pass) ? 'PASS' : enough ? 'FAIL' : 'INCONCLUSIVE';
  const best = [...cells].sort((a, b) => b.conf.mean - a.conf.mean)[0];
  const diff = [];
  for (const rr of TARGETS) for (const w of ['disc', 'conf']) {
    const a = acc[`aligned ${rr}R`][w], o = acc[`opposite ${rr}R`][w];
    const va = (a.s2 - (a.s * a.s) / a.n) / (a.n - 1), vo = (o.s2 - (o.s * o.s) / o.n) / (o.n - 1);
    diff.push({ target: rr + 'R', window: w, diff: r3(a.s / a.n - o.s / o.n), welchT: r2((a.s / a.n - o.s / o.n) / Math.sqrt(va / a.n + vo / o.n)) });
  }
  const pm = {}; for (const m of MARKETS) pm[m] = Object.fromEntries(CELLS.map((c) => [c, { n: perMarket[m][c].n, mean: perMarket[m][c].n ? r3(perMarket[m][c].s / perMarket[m][c].n) : null }]));
  const headline = `0 of 4 cells pass; best ${best.cell}, ${f3(best.conf.mean)}R a trade after costs in 2015-26 (n ${best.conf.n.toLocaleString('en-US')}, month t ${best.conf.t.toFixed(2)}; before costs ${f3(best.conf.gross)}R; discovery ${f3(best.disc.mean)}R, n ${best.disc.n.toLocaleString('en-US')}, t ${best.disc.t.toFixed(2)})`
    .replace(/^0 of 4/, `${cells.filter((c) => c.pass).length} of 4`);
  const R = { study: 'h1-origin-h4-range', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums, trades by fill time',
    windows: WIN, markets: MARKETS, params: P, costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])), counts, passed: cells.filter((c) => c.pass).map((c) => c.cell),
    best: best.cell, cells, alignedMinusOpposite: diff, perMarket: pm, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  const row = (c) => `| ${c.cell} | ${c.disc.n} | ${(c.disc.win * 100).toFixed(1)}% | ${f3(c.disc.gross)} | ${f3(c.disc.mean)} | ${c.disc.t.toFixed(2)} | ${c.conf.n} | ${(c.conf.win * 100).toFixed(1)}% | ${f3(c.conf.gross)} | ${f3(c.conf.mean)} | ${c.conf.t.toFixed(2)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`;
  const md = `# An H1 break-origin zone, split by its place in the H4 dealing range (result)

**Verdict: ${verdict}. ${headline}.**

Run 24 Nov 2026 as pre-registered (\`PREREGISTRATION.md\`, committed alone first). Research only: nothing live changed, nothing
is proposed. One run, no variants.

## What was run

On closed H1 candles, every close beyond the last confirmed swing high or low (3 candles a side); the zone is the last H1 candle
of the other colour before that break, wick to wick. A resting limit at the zone's near edge from the break candle's close, alive
5 days, first return only; stop past the far edge by 0.1 x ATR(14) of H1; targets 1R and 2R; out 5 days after the fill; a candle
holding stop and target is a stop. Each order is classed by its entry inside the H4 dealing range (the last confirmed H4 swing
low to the last confirmed H4 swing high): **aligned** = a buy in the lower half or a sell in the upper half, **opposite** = the
reverse. Five markets pooled (${MARKETS.join(', ')}), OANDA mid 5-minute candles, the demo account's round-trip costs.
Discovery = fills 2005-2014, confirmation = fills 2015 to October 2026.

Counts: ${counts.breaks.toLocaleString('en-US')} H1 breaks, ${counts.orders.toLocaleString('en-US')} orders, ${counts.fills.toLocaleString('en-US')} filled, of which ${counts.outside.toLocaleString('en-US')} had their entry outside the H4 range (or no valid range) and are in neither class; ${counts.excluded} fills dropped by the data-quality exclusions.

## The four cells (R a trade; "before" = before costs, "after" = after costs; t = t of calendar-month sums after costs)

| cell | disc n | disc win | disc before | disc after | disc t | conf n | conf win | conf before | conf after | conf t | Holm p | pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${cells.map(row).join('\n')}

Month t before costs: ${cells.map((c) => `${c.cell} ${c.disc.tGross.toFixed(2)} / ${c.conf.tGross.toFixed(2)}`).join('; ')} (discovery / confirmation).

## The hypothesis itself: aligned minus opposite (after costs, Welch t on trades; no verdict)

| target | window | aligned - opposite (R) | Welch t |
|---|---|---|---|
${diff.map((d) => `| ${d.target} | ${d.window === 'disc' ? 'discovery' : 'confirmation'} | ${f3(d.diff)} | ${d.welchT.toFixed(2)} |`).join('\n')}

## By market, confirmation (n, mean R after costs)

| market | ${CELLS.join(' | ')} |
|---|---|---|---|---|
${MARKETS.map((m) => `| ${m} | ${CELLS.map((c) => `${pm[m][c].n}, ${pm[m][c].mean == null ? 'n/a' : f3(pm[m][c].mean)}`).join(' | ')} |`).join('\n')}

## Checks

- Cut test (orders made from candles cut at a moment against the full run's orders up to it, last 60,000 five-minute candles of
  each market, three cuts): ${cut.length} cuts, ${cut.reduce((a, x) => a + x.missing + x.extra, 0)} differences.
- Every filled trade had its stop on the losing side of the fill (the run throws otherwise).

## Limits

- Mid candles: a limit counts as filled on a touch, which flatters a limit entry; the real result is at best what is shown.
- Today's demo costs are charged for every year. Trades overlap (several open at once), so a per-trade t would overstate; the
  month-sum t is the one judged.
- The split is by a mechanical H4 swing range (3 candles a side), not a range chosen by eye.
- Whatever is above, this is a paper study of one reading; no other swing size, zone, range or target is tried on these years.
`;
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), md);
  console.log(verdict, headline);
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === 'run') main();
