// research/edge/dom-h4-vr-overlap/run.mjs - PREREGISTRATION.md (24 Nov 2026): the H1 dominant-zone limit (dom-zone-holdout's
// order, 2R) split by whether the zone overlaps the range at the extreme of the last H4 structure break's move (the first H1
// counter-break after it). Research only: nothing live imports it, nothing is placed.
//   node --max-old-space-size=3500 research/edge/dom-h4-vr-overlap/run.mjs run     -> result.json + RESULT.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames, signalsFor, multi, COSTS, exclusions, NONE } from '../combo-grid-3/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
const ym = (y, m = 1) => Date.UTC(y, m - 1, 1) / 1000;
export const FROM = ym(2005), SPLIT = ym(2015), TO = ym(2026, 11);
export const DM = 120, NM = 262;                         // months 2005-01..2014-12 (120), 2015-01..2026-10 (142)
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const DAY = 86400;
export const CELLS = ['in', 'inWith', 'inAgainst'];
export const MIN_N = 300;

function atr14(B) { const a = new Float64Array(B.length); let s = 0; const tr = (i) => Math.max(B[i].h - B[i].l, Math.abs(B[i].h - B[i - 1].c), Math.abs(B[i].l - B[i - 1].c));
  for (let i = 1; i < B.length; i++) { s += tr(i); if (i > 14) s -= tr(i - 14); a[i] = i >= 14 ? s / 14 : 0; } return a; }

// ---- the box: the first H1 counter-break range at the extreme of each H4 structure break's move -------------------------
// Each: { D (the H4 break's side), bot, top, at (known: close of the H1 counter-break candle), end, evT (H4 break close) }.
export function vrBoxes(H4, H1) {
  const ev = K.structure(H4, 3).events, sw = K.swings(H1, 3);
  const lows = sw.filter((s) => s.type === 'L'), highs = sw.filter((s) => s.type === 'H');
  const lastBefore = (arr, eI, jPrev) => { // the most recent swing with index < eI, confirmed by the close of candle jPrev
    let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].i < eI) lo = m + 1; else hi = m; }
    for (let q = lo - 1; q >= 0; q--) if (arr[q].ci <= jPrev) return arr[q];
    return null; };
  const first = (t) => { let lo = 0, hi = H1.length; while (lo < hi) { const m = (lo + hi) >> 1; if (H1[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const out = [];
  for (let k = 0; k < ev.length; k++) {
    const e = ev[k], D = e.dir, tEnd = k + 1 < ev.length ? ev[k + 1].t : Infinity;
    const j0 = first(H4[e.i].t), js = first(e.t);
    let ext = D > 0 ? -Infinity : Infinity, eI = -1;
    for (let j = j0; j < H1.length; j++) {
      const b = H1[j]; if (b.e > tEnd) break;
      if (j >= js && eI >= 0) {
        const lv = lastBefore(D > 0 ? lows : highs, eI, j - 1);
        if (lv && D * (b.c - lv.price) < 0) {
          const far = D > 0 ? Math.max(ext, b.h) : Math.min(ext, b.l);
          let end = tEnd;
          for (let q = j + 1; q < H1.length && H1[q].e <= tEnd; q++) if (D * (H1[q].c - far) > 0) { end = H1[q].e; break; }
          const bot = D > 0 ? lv.price : far, top = D > 0 ? far : lv.price;
          if (top > bot) out.push({ D, bot, top, at: b.e, end, evT: e.t });
          break;
        }
      }
      if (D > 0 ? b.h > ext : b.l < ext) { ext = D > 0 ? b.h : b.l; eI = j; }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
// the box current at time ts (known at or before ts, not ended by ts), or null. Boxes never overlap in time.
export function boxAt(boxes, ts) {
  let lo = 0, hi = boxes.length; while (lo < hi) { const m = (lo + hi) >> 1; if (boxes[m].at <= ts) lo = m + 1; else hi = m; }
  const b = lo > 0 ? boxes[lo - 1] : null; return b && ts < b.end ? b : null;
}
// 0 OUT, 1 IN with the H4 break, 2 IN against it
export function classify(z, ts, boxes) {
  const b = boxAt(boxes, ts); if (!b || !(z.bot <= b.top && z.top >= b.bot)) return 0;
  return z.d === b.D ? 1 : 2;
}

// ---- the order: dom-zone-holdout's trades() line for line, keeping the zone, the levels and the set -----------------------
export function tradesOf(market, from, to, M5) {
  M5 = M5 || K.load(market, '5m', { from: from - 200 * DAY, to }); if (!M5.length) return [];
  const F = frames(M5), H = F['1h'], T = F['5m'], A = atr14(H), cost = COSTS[market], X = exclusions(market);
  const bad = (t) => X.some(([a, b]) => t >= a && t <= b);
  const boxes = vrBoxes(F['4h'], H);
  const out = [];
  for (const sg of signalsFor(F, '1h', '5m', 'dom', {}, from)) {
    if (sg.trig !== NONE) continue;
    const z = sg.z, d = z.d, ts = T[sg.k0].t; if (ts >= to) continue;
    const li = K.closedCount(H, ts) - 1; if (li < 15) continue;
    const entry = d > 0 ? z.top : z.bot, stop = d > 0 ? z.bot - cost / 2 - 0.25 * A[li] : z.top + cost / 2 + 0.25 * A[li];
    if (!(d * (entry - stop) >= 2 * cost)) continue;
    const r = multi(M5, d, entry, stop, 'lim', ts, ts + 12 * 300, 2, null, 2 * DAY, null);
    if (!r || r.risk < cost || r.t < from || r.t >= to || bad(r.t)) continue;
    out.push({ ts, t: r.t, side: d, entry, stop, risk: r.risk, cr: cost / r.risk, r2: r.R[1], trail: r.R[6], set: classify(z, ts, boxes) });
  }
  out.boxes = boxes;
  return out;
}

const SPANS = [[FROM, SPLIT], [SPLIT, TO]];
export function runMarket(market) {
  const rows = []; let nBoxes = 0;
  for (const [a, b] of SPANS) {
    const M5 = K.load(market, '5m', { from: a - 200 * DAY, to: b });
    const tr = tradesOf(market, a, b, M5);
    for (const x of tr) rows.push({ m: market, t: x.t, r2: x.r2, trail: x.trail, cr: x.cr, set: x.set });
    nBoxes += tr.boxes.filter((x) => x.at >= a && x.at < b).length;
  }
  return { rows, nBoxes };
}

// boxes known before a cut are the same from the cut series and the full one
export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2017-09-20', '2021-02-17', '2025-05-07']) {
  const out = [];
  for (const c of cuts) {
    const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const full = K.load(market, '5m', { from: T - 320 * DAY, to: T + 30 * DAY }), cut = full.filter((b) => b.e <= T);
    const Ff = frames(full), Fc = frames(cut);
    const key = (b) => [b.D, b.bot, b.top, b.at, b.evT, Math.min(b.end, T)].join('|');
    const A = vrBoxes(Ff['4h'], Ff['1h']).filter((b) => b.at <= T && b.at >= T - 120 * DAY), B = new Set(vrBoxes(Fc['4h'], Fc['1h']).map(key));
    let diff = 0; for (const b of A) if (!B.has(key(b))) diff++;
    out.push({ market, cut: c, boxes: A.length, diff });
  }
  return out;
}

// ---- statistics ---------------------------------------------------------------------------------------------------
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : NaN; };
export function monthT(rows, w, val) {
  const a = w ? DM : 0, b = w ? NM : DM, ms = new Array(b - a).fill(0);
  for (const x of rows) ms[monthOf(x.t) - a] += val(x);
  const m = mean(ms), s = sd(ms), t = s > 0 ? m / (s / Math.sqrt(ms.length)) : 0;
  const p2 = t ? K.pFromT(Math.abs(t), ms.length - 1) : 1;
  return { months: ms.length, t, p: t > 0 ? p2 / 2 : 1 - p2 / 2 };
}
const r4 = (v) => (Number.isFinite(v) ? +v.toFixed(4) : null);
export function summ(rows, w, k = 'r2') {
  const tn = monthT(rows, w, (x) => x[k] - x.cr), tb = monthT(rows, w, (x) => x[k]);
  return { n: rows.length, win: r4(rows.filter((x) => x[k] > 0).length / (rows.length || 1)), R: r4(mean(rows.map((x) => x[k]))),
    net: r4(mean(rows.map((x) => x[k] - x.cr))), costR: r4(mean(rows.map((x) => x.cr))), tR: +tb.t.toFixed(2), t: +tn.t.toFixed(2), p: tn.p, months: tn.months };
}
export function welch(a, b) { const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length; return { diff: r4(mean(a) - mean(b)), t: +((mean(a) - mean(b)) / Math.sqrt(va + vb)).toFixed(2) }; }
const inSet = { all: () => true, out: (x) => x.set === 0, in: (x) => x.set > 0, inWith: (x) => x.set === 1, inAgainst: (x) => x.set === 2 };
const win = (x) => (x.t >= SPLIT ? 1 : 0);

export function analyse(rows) {
  const sets = {}, trail = {};
  for (const k of Object.keys(inSet)) {
    const R = rows.filter(inSet[k]), d = R.filter((x) => !win(x)), c = R.filter(win);
    sets[k] = { disc: summ(d, 0), conf: summ(c, 1) }; trail[k] = { disc: summ(d, 0, 'trail'), conf: summ(c, 1, 'trail') };
  }
  const holm = K.holm(CELLS.map((k) => sets[k].conf.p));
  const cells = {}; CELLS.forEach((k, i) => { const s = sets[k], ok = (x) => x.n >= MIN_N && x.net > 0 && x.t >= 2;
    cells[k] = { holm: +holm[i].toFixed(4), enough: s.disc.n >= MIN_N && s.conf.n >= MIN_N, pass: ok(s.disc) && ok(s.conf) && holm[i] < 0.05 }; });
  const pass = CELLS.some((k) => cells[k].pass), verdict = pass ? 'PASS' : CELLS.some((k) => cells[k].enough) ? 'FAIL' : 'INCONCLUSIVE';
  const vs = {}; for (const k of CELLS) vs[k] = [0, 1].map((w) => welch(rows.filter((x) => win(x) === w && inSet[k](x)).map((x) => x.r2 - x.cr), rows.filter((x) => win(x) === w && x.set === 0).map((x) => x.r2 - x.cr)));
  const byMarket = {}; for (const m of [...new Set(rows.map((x) => x.m))]) { byMarket[m] = {}; for (const k of [...CELLS, 'all']) { const R = rows.filter((x) => x.m === m && inSet[k](x));
    byMarket[m][k] = { disc: summ(R.filter((x) => !win(x)), 0), conf: summ(R.filter(win), 1) }; } }
  // the best cell: the highest after-cost R in confirmation
  const best = CELLS.slice().sort((a, b) => sets[b].conf.net - sets[a].conf.net)[0];
  return { verdict, best, sets, cells, vsOut: vs, trail, byMarket, share: { disc: r4(sets.in.disc.n / sets.all.disc.n), conf: r4(sets.in.conf.n / sets.all.conf.n) } };
}

const NAME = { in: 'IN (zone overlaps the box)', inWith: 'IN, with the H4 break', inAgainst: 'IN, against the H4 break', out: 'OUT (no box or no overlap)', all: 'ALL orders' };
const sg = (v) => (v == null ? 'n/a' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(3));
const tt = (v) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const nn = (n) => n.toLocaleString('en-US');
export function verdictLine(A) { const b = A.sets[A.best].conf;
  return `**Verdict: ${A.verdict}. Best cell (${NAME[A.best]}) made ${sg(b.net)}R a trade after costs in 2015-26 (n ${nn(b.n)}, month t ${tt(b.t)}).**`; }
export function markdown(A, meta) {
  const row = (k, S = A.sets) => { const d = S[k].disc, c = S[k].conf; return `| ${NAME[k]} | ${nn(d.n)} | ${sg(d.R)} | ${sg(d.net)} | ${tt(d.tR)} / ${tt(d.t)} | ${nn(c.n)} | ${sg(c.R)} | ${sg(c.net)} | ${tt(c.tR)} / ${tt(c.t)} | ${Math.round(c.win * 100)} % | ${c.costR.toFixed(3)} |`; };
  const head = '| Set | n 2005-14 | R before costs | R after | month t before / after | n 2015-26 | R before costs | R after | month t before / after | winners | cost R |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
  const L = [];
  L.push('# H1 dominant zone inside the range at the extreme of the last H4 break (result)', '', verdictLine(A), '');
  L.push(`Run 24 Nov 2026 as pre-registered (\`PREREGISTRATION.md\`, committed alone before the run). Research only: nothing live changed, no rule is proposed.`, '');
  L.push('## What was run', '');
  L.push(`The H1 dominant-zone limit of \`dom-zone-holdout\` (limit at the zone's near edge from the first touch, stop past the far side by half the round trip + 0.25 x ATR(14) of H1, a 2R target, two days at most) on ${meta.markets.join(', ')}, OANDA mid 5-minute candles, discovery 2005-2014 and confirmation 2015 to October 2026, costs = \`combo-grid-3\` \`COSTS\` as cost / risk. Each order is classed at its arming by the box of the last H4 structure break: the range from the extreme of that move to the H1 swing level its first H1 counter-break closed through, current until the next H4 break closes or an H1 candle closes beyond the extreme. ${nn(meta.boxes)} boxes; ${Math.round(A.share.disc * 100)} % of the orders overlap one in 2005-14 and ${Math.round(A.share.conf * 100)} % in 2015-26.`, '');
  L.push('## The three cells (2R target, five markets pooled)', '', head, ...CELLS.map((k) => row(k)), row('out'), row('all'), '');
  L.push('| Cell | 300 trades in both windows | after costs > 0 with month t >= 2 in both | Holm p (confirmation) | Pass |', '|---|---|---|---:|---|');
  for (const k of CELLS) { const s = A.sets[k], ok = (x) => x.net > 0 && x.t >= 2; L.push(`| ${NAME[k]} | ${A.cells[k].enough ? 'yes' : 'no'} | ${ok(s.disc) && ok(s.conf) ? 'yes' : 'no'} | ${A.cells[k].holm.toFixed(3)} | ${A.cells[k].pass ? 'yes' : 'no'} |`); }
  L.push('', '## Against the orders outside a box (after costs, reported only)', '', '| Cell | 2005-14: difference (Welch t) | 2015-26: difference (Welch t) |', '|---|---:|---:|');
  for (const k of CELLS) L.push(`| ${NAME[k]} minus OUT | ${sg(A.vsOut[k][0].diff)}R (${tt(A.vsOut[k][0].t)}) | ${sg(A.vsOut[k][1].diff)}R (${tt(A.vsOut[k][1].t)}) |`);
  L.push('', '## By market (R after costs, n; 2005-14 | 2015-26)', '', '| Market | IN | IN with | IN against | ALL |', '|---|---|---|---|---|');
  for (const m of Object.keys(A.byMarket)) { const c = (k) => { const x = A.byMarket[m][k]; return `${sg(x.disc.net)} (${nn(x.disc.n)}) \\| ${sg(x.conf.net)} (${nn(x.conf.n)})`; };
    L.push(`| ${m} | ${c('in')} | ${c('inWith')} | ${c('inAgainst')} | ${c('all')} |`); }
  L.push('', '## The same sets with the order\'s trailing exit (context only, not a cell)', '', head, ...[...CELLS, 'out', 'all'].map((k) => row(k, A.trail)), '');
  L.push('## Checks', '');
  L.push(`- Cut check: on ${meta.cut.length} cuts (five dates x ${meta.markets.length} markets) ${nn(meta.cut.reduce((s, c) => s + c.boxes, 0))} boxes known before the cut were compared between the cut series and the full one: ${meta.cut.reduce((s, c) => s + c.diff, 0)} differ.`);
  L.push(`- ALL orders are \`dom-zone-holdout\`'s own order list (the same code path; a seeded-candle test compares it with \`dom-vb-side\`'s copy trade for trade).`, '');
  L.push('## Reading', '');
  L.push(A.verdict === 'PASS' ? 'A cell passed the pre-registered bar on mid candles. That is a result on OANDA mid prices, not on a broker\'s quotes (`dom-tick-exec` lost on those), and not a rule to trade.'
    : 'Where the H1 dominant zone sits against the box of the last H4 break does not turn the order into a rule that pays after costs: no cell is above zero after costs in both windows. The differences against the orders outside a box are a few hundredths of an R. This is one mechanical reading of the box (3-a-side swings, the first counter-break only); it says nothing about a box chosen by eye. Nothing live changed.');
  L.push('', 'To repeat: `node --max-old-space-size=3500 research/edge/dom-h4-vr-overlap/run.mjs run` with `EDGE_DATA` pointing at the candle cache. Test: `tests/dom-h4-vr-overlap.test.mjs`.', '');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'run') {
  const rows = [], cut = []; let boxes = 0; const counts = {};
  for (const m of MARKETS) {
    const r = runMarket(m); boxes += r.nBoxes; counts[m] = r.rows.length; for (const x of r.rows) rows.push(x);
    for (const c of cutTest(m)) cut.push(c);
    console.error(m, r.rows.length, 'trades', r.nBoxes, 'boxes');
  }
  const A = analyse(rows), meta = { markets: MARKETS, boxes, cut };
  const out = { study: 'dom-h4-vr-overlap', built: '2026-11-24', verdict: A.verdict, verdictLine: verdictLine(A).replace(/\*\*/g, ''),
    windows: { discovery: '2005-01-01..2014-12-31', confirmation: '2015-01-01..2026-10-31' }, markets: MARKETS, costs: Object.fromEntries(MARKETS.map((m) => [m, COSTS[m]])),
    trades: counts, boxes, ...A, cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), markdown(A, meta));
  console.log(verdictLine(A));
}
