// research/edge/fade-limit-entry/run.mjs - the two Equinox fade rules entered on a resting LIMIT further in the break's
// direction instead of at market (PREREGISTRATION.md, 24 Nov 2026): X in {0.1, 0.25, 0.5} ATR, valid 4 M15 candles, fills on
// 5-minute mid candles only when price trades THROUGH the limit by a tick, the fill candle can only stop the trade; variant A
// keeps the market trade's distances from the new entry, variant B its prices. Ten markets, discovery 2005-14, confirmation
// 2015 to Oct 2026, judged AFTER the full edgekit round trip on month sums; a random-limit control of matched frequency.
// Research only: nothing live imports it, nothing is placed. Each study's signal code is imported, never edited.
//   node research/edge/fade-limit-entry/run.mjs market <m> <outDir>
//   node research/edge/fade-limit-entry/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { MARKETS, ASSUMED, FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1, welch } from '../grid7-wide-core/run.mjs';
import { signals as fadeSignals, exits, CAP } from '../grid7-wide-fade/run.mjs';
import { signals as bigSignals, trade as bigTrade } from '../big-candle-fade/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { MARKETS, ASSUMED };
export const XS = [0.1, 0.25, 0.5], VARS = ['A', 'B'], RULES = ['R1', 'R2'];
export const RULE_NAME = { R1: 'grid7-wide-fade m15 none atr 2R all', R2: 'big-candle-fade m15 k1.5 nobreak half' };
export const N_CANDLES = 4, VALID = N_CANDLES * 900, HOLD = CAP['15m'], SENS = 0.5, SEED = 20261124;
export const TICK = { xau: 0.01, xag: 0.001, usdjpy: 0.001, eurjpy: 0.001 };
export const tickOf = (m) => TICK[m] ?? 0.00001;
export const COST = K.COSTS;
export const GATE = { R1: { n: 201769, mean: 0.042 }, R2: { n: 54443, mean: 0.193 } };
export const NCELL = RULES.length * XS.length * VARS.length; // 12
export const cellOf = (r, x, v) => (r * XS.length + x) * VARS.length + v;
export const cellName = (c) => { const v = c % 2, x = ((c - v) / 2) % 3, r = (c - v - 2 * x) / 6; return { rule: RULES[r], x: XS[x], variant: VARS[v], name: `${RULES[r]} X${XS[x]} ${VARS[v]}` }; };
// streams: 0,1 = market baseline R1 / R2; 2..13 = limit cells; 14..25 = their random controls
export const NS = 2 + 2 * NCELL;
const sLimit = (c) => 2 + c, sCtl = (c) => 2 + NCELL + c;

// ---- one resting limit on 5-minute candles ---------------------------------------------------------------------------
// s: side (+1 buy, -1 sell); L: limit; stop / target: prices; t0: order time; expire: unix s (candles starting before it
// may fill); cap: seconds after the fill candle's start; tick: the through-amount. Uses the candles up to the fill to decide
// the fill, then the candles after it for the exit. Returns { status: 'nofill' } | { status: 'open' } |
// { status: 'done', fi, fill, risk, R, reason }.
export function limitTrade(M5, s, L, stop, target, t0, expire, cap, tick) {
  let fi = -1, fill = null;
  for (let i = startIdx(M5, t0); i < M5.length && M5[i].t < expire; i++) {
    const b = M5[i];
    if (s < 0 ? b.h >= L + tick : b.l <= L - tick) { fi = i; fill = s < 0 ? Math.max(b.o, L) : Math.min(b.o, L); break; }
  }
  if (fi < 0) return { status: 'nofill' };
  // R is in units of the ORDER's planned risk |L - stop| (also for a gap fill at a better open): normalising by the
  // fill-to-stop distance made a gap fill just short of the stop worth thousands of R (first run, 24 Nov 2026; RESULT.md).
  const risk = Math.abs(L - stop);
  if (!(s * (fill - stop) > 0)) return { status: 'done', fi, fill, risk, R: 0, reason: 'past stop' };
  const dl = M5[fi].t + cap;
  const done = (px, reason) => ({ status: 'done', fi, fill, risk, R: (s * (px - fill)) / risk, reason });
  for (let j = fi; j < M5.length; j++) {
    const b = M5[j], adv = s > 0 ? b.l : b.h, fav = s > 0 ? b.h : b.l;
    if (j > fi) {
      if (s * (b.o - stop) <= 0) return done(b.o, 'stop');
      if (s * (b.o - target) >= 0) return done(b.o, 'target');
    }
    if (s * (adv - stop) <= 0) return done(stop, 'stop');
    if (j > fi && s * (fav - target) >= 0) return done(target, 'target');
    if (b.e >= dl) return done(b.c, 'time');
  }
  return { status: 'open' };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

function newAcc() {
  const z = (n) => new Float64Array(n);
  return { n: z(NS * 2), g: z(NS * 2), net: z(NS * 2), sens: z(NS * 2), cr: z(NS * 2), sq: z(NS * 2), win: z(NS * 2),
    ms: z(NS * NM), msS: z(NS * NM),
    sig: z(NS * 2), ord: z(NS * 2), nofill: z(NS * 2), open: z(NS * 2), noorder: z(NS * 2),
    pdN: z(NCELL * 2), pdSum: z(NCELL * 2), pdSq: z(NCELL * 2), pdMs: z(NCELL * NM),
    fmN: z(NCELL * 2), fmSum: z(NCELL * 2), fmSq: z(NCELL * 2), umN: z(NCELL * 2), umSum: z(NCELL * 2), umSq: z(NCELL * 2),
    fmNet: z(NCELL * 2), umNet: z(NCELL * 2) };
}
function addTrade(A, st, w, m, R, cost, risk) {
  const cr = cost / risk, net = R - cr, sens = R - SENS * cr, k = st * 2 + w;
  A.n[k]++; A.g[k] += R; A.net[k] += net; A.sens[k] += sens; A.cr[k] += cr; A.sq[k] += net * net; if (net > 0) A.win[k]++;
  A.ms[st * NM + m] += net; A.msS[st * NM + m] += sens; return net;
}

// the market trade of each rule's signals, as each study computes it: { t, w, m, s, fill, stop, target, risk, R, ref, A }
export function marketTrades(M5, F, market) {
  const cost = COST[market], X = exclusions(market), T = F['15m'], out = { R1: [], R2: [] };
  let dropped = 0;
  const live = (ts) => { const fi = startIdx(M5, ts); if (fi >= M5.length) return null; const t = M5[fi].t;
    if (t < FROM || t >= TO) return null; if (X.length && inBad(X, t)) { dropped++; return null; } return { fi, t }; };
  // R1: grid7-wide-fade, tf M15 (1), context none (0), atr stop, 2R; inclusion exactly as that study (all three targets
  // and the mirror resolved)
  for (const g of fadeSignals(F)) {
    if (g.tf !== 1 || g.cx !== 0) continue; const L0 = live(g.ts); if (!L0) continue; const { fi, t } = L0;
    const fill = M5[fi].o, s = -g.d, stop = fill + g.d * g.a, risk = s * (fill - stop);
    if (!(risk > 0) || risk < cost) continue;
    const sr = g.opp == null ? NaN : (s * (g.opp - fill)) / risk; const ks = [1, 2, sr > 0 ? sr : NaN];
    const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), HOLD);
    const p = exits(M5, -s, fi, fill + s * risk, ks.map((k) => (Number.isFinite(k) ? fill - s * k * risk : NaN)), HOLD);
    if (!r || !p) continue;
    out.R1.push({ t, s, d: g.d, fill, stop, target: fill + s * 2 * risk, risk, k0: 2, R: r.R[1], ref: T[g.j].c, A: g.a, j: g.j });
  }
  // R2: big-candle-fade, tf M15 (0), k1.5 (kmax >= 0), not a break, the half target; its own trade()
  for (const g of bigSignals(F).big) {
    if (g.tf !== 0 || g.brk || g.kmax < 0) continue; const L0 = live(g.ts); if (!L0) continue; const { t } = L0;
    const r = bigTrade(M5, g, cost); if (!r || r.skip || !Number.isFinite(r.ks[2])) continue;
    out.R2.push({ t, s: r.s, d: g.d, fill: r.fill, stop: r.stop, target: r.fill + r.s * r.ks[2] * r.risk, risk: r.risk, k0: r.ks[2], R: r.R[2], ref: T[g.j].c, A: g.a, j: g.j });
  }
  out.dropped = dropped;
  return out;
}

// the order of a cell for one signal: { L, stop, target } or null (no order)
export function orderOf(sg, X, variant, cost) {
  const s = sg.s, L = sg.ref - s * X * sg.A; // d = -s: L = close + d x X x A
  if (variant === 'A') return { L, stop: L - s * sg.risk, target: L + s * sg.k0 * sg.risk };
  if (!(s * (L - sg.stop) > 0) || s * (L - sg.stop) < cost) return null;
  return { L, stop: sg.stop, target: sg.target };
}

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5); const T = F['15m'];
  const cost = COST[market], tick = tickOf(market), X = exclusions(market);
  const atr = atr14(T); const MT = marketTrades(M5, F, market); const A = newAcc();
  // the M15 candles of each calendar month (by close), for the control
  const byMonth = new Map(); T.forEach((b, i) => { if (b.e < FROM || b.e >= TO) return; const m = monthOf(b.e); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(i); });
  const rnd = K.rng(SEED + MARKETS.indexOf(market) * 1009);
  RULES.forEach((rk, r) => {
    for (const sg of MT[rk]) {
      const w = sg.t < SPLIT ? 0 : 1, m = monthOf(sg.t);
      A.sig[r * 2 + w]++; const mNet = addTrade(A, r, w, m, sg.R, cost, sg.risk);
      for (let x = 0; x < XS.length; x++) for (let v = 0; v < 2; v++) {
        const c = cellOf(r, x, v), st = sLimit(c), k = st * 2 + w; A.sig[k]++;
        const o = orderOf(sg, XS[x], VARS[v], cost);
        let lim = 0, filled = false;
        if (!o) A.noorder[k]++;
        else { A.ord[k]++;
          const res = limitTrade(M5, sg.s, o.L, o.stop, o.target, sg.t, sg.t + VALID, HOLD, tick);
          if (res.status === 'nofill') A.nofill[k]++;
          else if (res.status === 'open') A.open[k]++;
          else { filled = true; lim = addTrade(A, st, w, m, res.R, cost, res.risk); } }
        const dd = lim - mNet, pk = c * 2 + w; A.pdN[pk]++; A.pdSum[pk] += dd; A.pdSq[pk] += dd * dd; A.pdMs[c * NM + m] += dd;
        if (filled) { A.fmN[pk]++; A.fmSum[pk] += sg.R; A.fmSq[pk] += sg.R * sg.R; A.fmNet[pk] += mNet; }
        else { A.umN[pk]++; A.umSum[pk] += sg.R; A.umSq[pk] += sg.R * sg.R; A.umNet[pk] += mNet; }
        // control: the same order shape at a random M15 close of the same month, random side
        const pool = byMonth.get(m); if (!pool || !o) continue;
        const sc = sCtl(c), kc = sc * 2 + w; A.sig[kc]++;
        const j = pool[Math.floor(rnd() * pool.length)], dside = rnd() < 0.5 ? 1 : -1, s = -dside;
        const a = r === 0 ? atr[j] : atr[j - 1]; if (!(a > 0)) { A.noorder[kc]++; continue; }
        const ts = T[j].e; if (X.length && inBad(X, ts)) { A.noorder[kc]++; continue; }
        const L = T[j].c - s * XS[x] * a, f = a / sg.A;
        const stop = L - s * Math.abs(o.L - o.stop) * f, target = L + s * Math.abs(o.target - o.L) * f;
        if (Math.abs(L - stop) < cost) { A.noorder[kc]++; continue; }
        A.ord[kc]++;
        const res = limitTrade(M5, s, L, stop, target, ts, ts + VALID, HOLD, tick);
        if (res.status === 'nofill') A.nofill[kc]++; else if (res.status === 'open') A.open[kc]++;
        else addTrade(A, sc, ts < SPLIT ? 0 : 1, monthOf(ts), res.R, cost, res.risk);
      }
    }
  });
  const J = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(7))]));
  return { market, cost, tick, assumed: ASSUMED.includes(market), first: M5[0]?.t ?? null, last: M5.at(-1)?.t ?? null,
    n: { R1: MT.R1.length, R2: MT.R2.length }, dropped: MT.dropped, acc: J(A) };
}

// ---- pooled statistics ----------------------------------------------------------------------------------------------------
export function pool(list) { const A = newAcc(); for (const d of list) for (const k of Object.keys(A)) { const S = d.acc[k]; for (let i = 0; i < A[k].length; i++) A[k][i] += S[i]; } return A; }
const mean = (s, n) => (n ? s / n : null);
export function streamStats(A, st) {
  const win = (w) => { const k = st * 2 + w, n = A.n[k], a = w ? DM : 0, b = w ? NM : DM;
    return { sig: A.sig[k], orders: A.ord[k], noorder: A.noorder[k], nofill: A.nofill[k], open: A.open[k], n, fillRate: A.ord[k] ? n / A.ord[k] : null,
      gross: mean(A.g[k], n), net: mean(A.net[k], n), sens: mean(A.sens[k], n), costR: mean(A.cr[k], n), win: mean(A.win[k], n),
      tNet: mstat(A.ms.subarray(st * NM, (st + 1) * NM), a, b).t, tSens: mstat(A.msS.subarray(st * NM, (st + 1) * NM), a, b).t, months: b - a,
      _w: { n, sum: A.net[k], sq: A.sq[k] } }; };
  return { d: win(0), c: win(1) };
}
export function pairStats(A, c) {
  const win = (w) => { const k = c * 2 + w, a = w ? DM : 0, b = w ? NM : DM;
    const sd = (n, s, q) => (n > 1 ? Math.sqrt(Math.max(0, (q - (s * s) / n) / (n - 1))) : null);
    const wf = { n: A.fmN[k], sum: A.fmSum[k], sq: A.fmSq[k] }, wu = { n: A.umN[k], sum: A.umSum[k], sq: A.umSq[k] };
    return { n: A.pdN[k], diff: mean(A.pdSum[k], A.pdN[k]), tMonth: mstat(A.pdMs.subarray(c * NM, (c + 1) * NM), a, b).t,
      filledMkt: mean(A.fmSum[k], A.fmN[k]), filledMktNet: mean(A.fmNet[k], A.fmN[k]), nFilled: A.fmN[k],
      unfilledMkt: mean(A.umSum[k], A.umN[k]), unfilledMktNet: mean(A.umNet[k], A.umN[k]), nUnfilled: A.umN[k], welchSel: welch(wf, wu),
      _sd: sd(A.pdN[k], A.pdSum[k], A.pdSq[k]) }; };
  return { d: win(0), c: win(1) };
}
export const passOf = (x, h) => x.d.n >= 200 && x.c.n >= 200 && x.d.net > 0 && x.c.net > 0 && x.c.tNet >= 2 && h < 0.05;
export const ctlClears = (x) => x.d.net > 0 && x.c.net > 0 && x.c.tNet >= 2;

export function judge(data) {
  const A = pool(data); const base = RULES.map((rk, r) => ({ rule: rk, ...streamStats(A, r) }));
  const rows = [];
  for (let c = 0; c < NCELL; c++) {
    const s = streamStats(A, sLimit(c)), ct = streamStats(A, sCtl(c)), pr = pairStats(A, c);
    rows.push({ cell: c, ...cellName(c), d: s.d, c: s.c, p: p1(s.c.tNet, s.c.months - 1), ctl: ct, pair: pr,
      welchCtl: { d: welch(s.d._w, ct.d._w), c: welch(s.c._w, ct.c._w) } });
  }
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = H[i]; r.checks = { n: r.d.n >= 200 && r.c.n >= 200, disc: r.d.net > 0, conf: r.c.net > 0, t: r.c.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = passOf(r, H[i]); r.ctlClears = ctlClears(r.ctl); });
  return { base, rows };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US'), pc = (x) => (x == null ? 'n/a' : (100 * x).toFixed(1) + ' %');
const r6 = (x) => (x == null ? null : +x.toFixed(6));
const slim = (w) => Object.fromEntries(Object.entries(w).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, typeof v === 'number' ? r6(v) : v]));

export function report(dir) {
  const data = MARKETS.filter((m) => fs.existsSync(path.join(dir, m + '.json'))).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const { base, rows } = judge(data);
  const gate = RULES.map((rk, r) => { const b = base[r].c, G = GATE[rk];
    return { rule: rk, n: b.n, want: G.n, gross: r6(b.gross), wantGross: G.mean, ok: Math.abs(b.n - G.n) <= 0.005 * G.n && Math.abs(b.gross - G.mean) <= 0.002 }; });
  const gateOk = gate.every((g) => g.ok) && data.length === MARKETS.length;
  const pass = rows.filter((r) => r.pass);
  const verdict = !gateOk ? 'INCONCLUSIVE' : pass.length ? 'PASS' : 'FAIL';
  const best = [...rows].sort((a, b) => b.c.net - a.c.net)[0];
  const headline = verdict === 'PASS'
    ? `${pass.length} of 12 limit cells pass after the full cost; best ${best.name}, ${f3(best.c.net)}R a filled trade in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; 2005-14 ${f3(best.d.net)}R)`
    : verdict === 'FAIL'
      ? `0 of 12 limit cells are positive after the full cost with a confirmation month t of 2; the best, ${best.name}, made ${f3(best.c.net)}R a filled trade after costs in 2015-26 (n ${N(best.c.n)}, month t ${f2(best.c.tNet)}; 2005-14 ${f3(best.d.net)}R, n ${N(best.d.n)}), against the market entry's ${f3(base[RULES.indexOf(best.rule)].c.net)}R`
      : 'the baseline gate failed: nothing is judged';
  const out = { study: 'fade-limit-entry', built: '2026-11-24', verdict, headline,
    basis: 'judged AFTER the full edgekit round trip on calendar-month sums of filled trades (pre-registered); 0.5 x cost beside as a labelled sensitivity, never the verdict',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' },
    rules: RULE_NAME, xs: XS, nCandles: N_CANDLES, ticks: Object.fromEntries(data.map((d) => [d.market, d.tick])), markets: data.map((d) => d.market),
    assumedCosts: ASSUMED, costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), gate, gateOk,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), signalsR1: d.n.R1, signalsR2: d.n.R2, dropped: d.dropped })),
    market: base.map((b) => ({ rule: b.rule, disc: slim(b.d), conf: slim(b.c) })),
    passed: pass.map((r) => r.name), passedButControlToo: pass.filter((r) => r.ctlClears).map((r) => r.name), best: best.name,
    cells: rows.map((r) => ({ cell: r.name, rule: r.rule, x: r.x, variant: r.variant, disc: slim(r.d), conf: slim(r.c), holm: r6(r.holm), checks: r.checks, pass: r.pass,
      paired: { disc: slim(r.pair.d), conf: slim(r.pair.c) }, control: { disc: slim(r.ctl.d), conf: slim(r.ctl.c), clears: r.ctlClears },
      welchVsControl: { disc: r6(r.welchCtl.d), conf: r6(r.welchCtl.c) } })) };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, base, rows));
  return out;
}

function resultMd(o, base, rows) {
  const L = [];
  L.push('# Fade on a resting limit instead of at market (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants. These years were read by both source studies: this measures an',
    'execution change, not new evidence of a signal.', '',
    '## What was run', '',
    `Two fade rules, each study's own signal code imported: **R1** = ${o.rules.R1}; **R2** = ${o.rules.R2}. Instead of the market`,
    'entry at the next 5-minute open, a limit FURTHER in the break\'s direction: L = signal close + d x X x ATR (a fade of an up-move',
    `is a sell limit above the close), X in {${o.xs.join(', ')}}, valid ${o.nCandles} M15 candles (one hour). It fills on a 5-minute mid candle only`,
    'when price trades through it by one tick (the open when it gaps past); on the fill candle only the stop counts. Variant **A**',
    'keeps the market trade\'s stop distance and target in R from the new entry; variant **B** keeps its stop and target PRICES. Ten',
    'markets pooled, OANDA mid 5-minute candles; windows by the signal\'s market fill time (the moment the order is placed).',
    'Judged AFTER the FULL `edgekit` round trip; "0.5 x cost" is a labelled sensitivity (an upper bound of what a passive entry',
    `saves), never the verdict. Costs **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## Gate: the market baselines reproduce the source cells', '',
    '| Rule | n 2015-26 | wanted | R before costs | wanted | ok |', '|---|---:|---:|---:|---:|---|');
  for (const g of o.gate) L.push(`| ${g.rule} | ${N(g.n)} | ${N(g.want)} | ${f3(g.gross)} | ${f3(g.wantGross)} | ${g.ok ? 'yes' : 'NO'} |`);
  L.push('', '## The bar, cell by cell', '',
    `- At least 200 fills in each window: ${rows.filter((r) => r.checks.n).length} of 12.`,
    `- After the full cost, mean R > 0 in 2005-14: ${rows.filter((r) => r.checks.disc).length}; in 2015-26: ${rows.filter((r) => r.checks.conf).length}.`,
    `- Confirmation month t >= 2 after costs: ${rows.filter((r) => r.checks.t).length}; Holm-adjusted one-sided p < 0.05: ${rows.filter((r) => r.checks.holm).length}.`,
    `- **All: ${o.passed.length}${o.passed.length ? ' (' + o.passed.join('; ') + ')' : ''}.**${o.passedButControlToo.length ? ' Of those, the random control clears the same bar too: ' + o.passedButControlToo.join('; ') + ' (not the signal).' : ''}`, '',
    '## Market entry (baseline) and every limit cell', '',
    'Per FILLED trade: R before costs, after the full cost (month-sum t), after 0.5 x cost (sensitivity), mean cost in R; fill rate =',
    'fills / orders. B places no order when its limit is at or past the original stop (or the risk is under the cost).', '',
    '| Stream | 05-14 fills (rate) | 05-14 gross | 05-14 net (t) | 15-26 fills (rate) | 15-26 gross | 15-26 net (t) | 15-26 0.5x cost | cost R 15-26 | Holm | Pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  base.forEach((b) => L.push(`| ${b.rule} market | ${N(b.d.n)} | ${f3(b.d.gross)} | ${f3(b.d.net)} (${f2(b.d.tNet)}) | ${N(b.c.n)} | ${f3(b.c.gross)} | ${f3(b.c.net)} (${f2(b.c.tNet)}) | ${f3(b.c.sens)} | ${f2(b.c.costR)} | | |`));
  for (const r of rows) L.push(`| ${r.name} | ${N(r.d.n)} (${pc(r.d.fillRate)}) | ${f3(r.d.gross)} | ${f3(r.d.net)} (${f2(r.d.tNet)}) | ${N(r.c.n)} (${pc(r.c.fillRate)}) | ${f3(r.c.gross)} | ${f3(r.c.net)} (${f2(r.c.tNet)}) | ${f3(r.c.sens)} | ${f2(r.c.costR)} | ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## Adverse selection and the paired difference (2015-26)', '',
    'The MARKET trade\'s R before costs on the signals the limit filled against those it did not; Welch t of the two. "Per signal" =',
    'the limit\'s after-cost R with an unfilled order as 0R, minus the market trade\'s after-cost R on the same signal (month t).', '',
    '| Cell | filled: market R (n) | unfilled: market R (n) | Welch t | per signal limit - market | month t | 2005-14 same |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const r of rows) { const p = r.pair.c, q = r.pair.d;
    L.push(`| ${r.name} | ${f3(p.filledMkt)} (${N(p.nFilled)}) | ${f3(p.unfilledMkt)} (${N(p.nUnfilled)}) | ${f2(p.welchSel)} | ${f3(p.diff)} | ${f2(p.tMonth)} | ${f3(q.diff)} (t ${f2(q.tMonth)}) |`); }
  L.push('', '## Random-limit control', '',
    'The same order shape (X, stop and target distances in ATR units, one hour, the fill rule) at the close of a random M15 candle of',
    'the same market and month, random side, one per signal. After the full cost, per filled trade.', '',
    '| Cell | control 05-14 net (n) | control 15-26 net (t, n) | variant - control Welch t 15-26 | clears the bar |', '|---|---:|---:|---:|---|');
  for (const r of rows) L.push(`| ${r.name} | ${f3(r.ctl.d.net)} (${N(r.ctl.d.n)}) | ${f3(r.ctl.c.net)} (${f2(r.ctl.c.tNet)}, ${N(r.ctl.c.n)}) | ${f2(r.welchCtl.c)} | ${r.ctlClears ? 'yes' : 'no'} |`);
  L.push('', '## Data', '', '| Market | candles from | R1 signals | R2 signals | dropped (bad data) |', '|---|---|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signalsR1)} | ${N(m.signalsR2)} | ${m.dropped} |`);
  L.push('', '## What it means', '', ...meaning(o, base, rows), '');
  return L.join('\n');
}

function meaning(o, base, rows) {
  const L = []; const byR = (rk) => rows.filter((r) => r.rule === rk);
  for (const rk of RULES) { const b = base[RULES.indexOf(rk)].c, rs = byR(rk);
    const bestNet = [...rs].sort((a, z) => z.c.net - a.c.net)[0];
    const sel = rs.map((r) => r.pair.c.filledMkt - r.pair.c.unfilledMkt);
    L.push(`**${rk}.** At market ${f3(b.gross)}R before and ${f3(b.net)}R after costs a trade (cost ${f2(b.costR)}R). The best limit cell after costs is ${bestNet.name}:`,
      `${f3(bestNet.c.net)}R a filled trade (cost ${f2(bestNet.c.costR)}R, fill rate ${pc(bestNet.c.fillRate)}, month t ${f2(bestNet.c.tNet)}). Adverse selection: the filled signals' market R`,
      `minus the unfilled ones' ranges ${f3(Math.min(...sel))} to ${f3(Math.max(...sel))}R across its cells.`, ''); }
  if (o.verdict === 'PASS') L.push('A pass on mid candles is not a broker fill: a forward record at the broker\'s quotes would be the next step, and it needs the owner. Nothing is adopted.');
  else L.push('**Why it fails.** The better price does not lower the cost in R: variant A keeps the stop distance, so the cost in R is the',
    'same as at market, and variant B keeps the stop PRICE, so the stop gets closer and the cost in R rises. What the limit changes',
    'is WHICH signals trade, and that works against the fade: the signals whose price never came back up to the limit are the',
    'market fade\'s best trades (they went straight to the target), and the ones that filled are the ones where the break kept',
    'going. Before costs every limit cell is at or below zero (-0.003R to -0.120R a filled trade in 2015-26), against +0.042R and',
    '+0.193R at market; the 0.5 x cost sensitivity is negative in every cell too. The few positive "per signal" differences',
    '(R1 X0.5 A, R2 X0.25 B, R2 X0.5 B) only mean that skipping a losing trade loses less than taking it: the limit still loses',
    'per signal. Against the random-limit control the R1 cells are a little better (Welch t 1.0 to 4.7) and the R2 cells worse:',
    'all of them, and every control, lose after costs.', '',
    'Entering the two Equinox fades on a resting limit does not rescue them on this bar. Do not re-test X, N or the fill rule on',
    'these years. Nothing live changed; no rule is proposed.');
  L.push('', '**Run note (said plainly).** The first full run measured R against the distance from the FILL to the stop. A limit that',
    'filled on a gap open just short of its stop then had a tiny risk, and a few such trades booked hundreds to thousands of R (one',
    'USD/CHF R1 X0.25 A trade of 21 Nov 2018: +3,227R). The pre-registration fixed the fill price but not this normalisation; it was',
    'set after seeing those trades to the ORDER\'s planned risk |L - stop| (cost in R the same way) and the run was repeated. The',
    'verdict is the same either way (0 of 12; in the first run the best after-cost cell was -0.153R with that outlier inside it).');
  return L;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'R1', r.n.R1, 'R2', r.n.R2, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | report <dir>');
}
