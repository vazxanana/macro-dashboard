// research/edge/msnr-switch-complements/run.mjs - the MSNR switch triggers with complements from other studies (wider stop on the
// working chart's ATR, day hours, Daily structure agreeing), selected AFTER costs on 2005-14 of ten markets and judged on eight
// untouched markets (PREREGISTRATION.md, 24 Nov 2026). Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/msnr-switch-complements/run.mjs market <m> <outDir>
//   EDGE_DATA=<cache> node research/edge/msnr-switch-complements/run.mjs cut <m> <outDir>
//   node research/edge/msnr-switch-complements/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { frames } from '../combo-grid-3/run.mjs';
import { COSTS, exclusions } from '../combo-grid-2/run.mjs';
import { atr14, startIdx } from '../dom-trade-through/run.mjs';
import { FROM, SPLIT, TO, NM, DM, monthOf, mstat, p1 } from '../grid7-wide-core/run.mjs';
import { exits } from '../grid7-wide-fade/run.mjs';
import { LADDERS, keyLevels, keyTarget } from '../msnr-switch-fade/run.mjs';
import { direction } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const S_MARKETS = ['xau', 'xag', 'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy'];
export const H_MARKETS = ['nas100', 'spx500', 'de40', 'gbpjpy', 'audjpy', 'cadjpy', 'eurgbp', 'euraud'];
export const ASSUMED = ['xag', 'nzdusd', 'usdcad', 'usdchf', 'eurjpy', ...H_MARKETS];
export const TRIGS = ['a', 'b', 'c'], STOPS = ['swing', 'watr'], HOURS = ['all', 'day'], HTF = ['any', 'd1'], EXITS = ['2R', 'key'];
export const ATRK = 0.1, KSW = 3, MAXAGE = 5, NCELL = 96, MAXSEL = 3;
export const cellIndex = (tr, l, st, hr, ht, x) => ((((tr * 2 + l) * 2 + st) * 2 + hr) * 2 + ht) * 2 + x;
export function cellName(i) { const x = i % 2; let r = (i - x) / 2; const ht = r % 2; r = (r - ht) / 2; const hr = r % 2; r = (r - hr) / 2;
  const st = r % 2; r = (r - st) / 2; const l = r % 2; const tr = (r - l) / 2;
  return { tr, l, st, hr, ht, x, name: `${LADDERS[l].name} ${TRIGS[tr]} ${STOPS[st]} ${HOURS[hr]} ${HTF[ht]} ${EXITS[x]}` }; }
export const dayHour = (t) => { const h = new Date(t * 1000).getUTCHours(); return h >= 7 && h < 20; };
const conv = (B) => B.map((b) => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c }));

// ---- signals (closed candles only): { l, tr, s, ts, stop (swing), watr, day, d1 } ---------------------------------------
export function signals(F) {
  const out = []; const D = F['1d'], dSide = K.structure(D, 3).side;
  const d1At = (t) => { const i = K.closedCount(D, t) - 1; return i >= 0 ? dSide[i] : 0; };
  LADDERS.forEach((L, l) => {
    const W = F[L.work], A = F[L.key], T = F[L.trig], atr = atr14(T), watr = atr14(W);
    const keyOf = (t) => { const k = K.barAt(A, t); return k < 0 ? t : A[k].t; };
    const Dc = direction(conv(W), keyOf, L.keySec);
    const push = (tr, s, ts, stop, wi) => { const wa = wi >= 0 ? watr[wi] : 0; if (!Number.isFinite(stop) || !(wa > 0)) return;
      out.push({ l, tr, s, ts, stop, watr: wa, day: dayHour(ts), d1: d1At(ts) === s }); };
    const seen = new Set();
    for (const e of K.structure(T, KSW).events) {
      const j = e.i, a = atr[j]; if (!(a > 0)) continue; const ts = T[j].e;
      const wi = K.closedCount(W, ts) - 1; if (wi < 0) continue;
      const c = Dc.call[wi], li = Dc.last[wi]; if (!c || li < 0) continue;
      const ev = Dc.events[li], age = wi - ev.i; if (T[j].t < W[ev.i].e || age > MAXAGE) continue;
      const t = e.dir === -c ? 0 : 1, key = li + ':' + t; if (seen.has(key)) continue; seen.add(key);
      let lo = Infinity, hi = -Infinity; for (let q = e.from; q <= j; q++) { if (T[q].l < lo) lo = T[q].l; if (T[q].h > hi) hi = T[q].h; }
      push(t, c, ts, c > 0 ? lo - ATRK * a : hi + ATRK * a, wi);
    }
    for (const ev of Dc.events) { const ts = W[ev.i].e, jj = K.closedCount(T, ts) - 1, a = jj >= 0 ? atr[jj] : 0; if (!(a > 0)) continue;
      push(2, ev.s, ts, ev.s > 0 ? ev.bottom - ATRK * a : ev.top + ATRK * a, ev.i); }
  });
  return out;
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };
function newAcc() { return { ms: new Float64Array(NCELL * NM), msNet: new Float64Array(NCELL * NM), mc: new Float64Array(NCELL * NM), net: new Float64Array(NCELL * NM), cr: new Float64Array(NCELL * NM) }; }

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); if (!M5.length) return { market, empty: true };
  const F = frames(M5), sigs = signals(F), cost = COSTS[market], X = exclusions(market);
  const lv = LADDERS.map((L) => { const A = F[L.key], levels = keyLevels(A); return { A, levels, byM: new Map(levels.map((x) => [x.m, x])) }; });
  const acc = newAcc(); const cnt = { signals: sigs.length, sims: 0, dropped: 0, bad: 0, small: 0, open: 0 };
  for (const g of sigs) {
    const fi = startIdx(M5, g.ts); if (fi >= M5.length) continue; const t = M5[fi].t; if (t < FROM || t >= TO) continue;
    if (X.length && inBad(X, t)) { cnt.dropped++; continue; }
    const fill = M5[fi].o, s = g.s, m = monthOf(t);
    for (let st = 0; st < 2; st++) {
      const stop = st === 0 ? g.stop : fill - s * g.watr, risk = s * (fill - stop);
      if (!(risk > 0)) { cnt.bad++; continue; }
      if (risk < cost) { cnt.small++; continue; }
      if (!(s * (fill - stop) > 0)) throw new Error('stop on the wrong side');
      const kp = keyTarget(lv[g.l].A, lv[g.l].levels, lv[g.l].byM, s, fill, t), kr = Number.isFinite(kp) ? (s * (kp - fill)) / risk : NaN;
      const ks = [2, kr >= 1 ? kr : NaN];
      const r = exits(M5, s, fi, stop, ks.map((k) => (Number.isFinite(k) ? fill + s * k * risk : NaN)), LADDERS[g.l].cap); cnt.sims++;
      if (!r) { cnt.open++; continue; }
      const cr = cost / risk;
      for (let hr = 0; hr < 2; hr++) { if (hr === 1 && !g.day) continue;
        for (let ht = 0; ht < 2; ht++) { if (ht === 1 && !g.d1) continue;
          for (let x = 0; x < 2; x++) { if (!Number.isFinite(ks[x])) continue; const k = cellIndex(g.tr, g.l, st, hr, ht, x) * NM + m;
            acc.ms[k] += r.R[x]; acc.msNet[k] += r.R[x] - cr; acc.mc[k]++; acc.cr[k] += cr; } } }
    }
  }
  const J = (A) => Object.fromEntries(Object.entries(A).filter(([k]) => k !== 'net').map(([k, v]) => [k, Array.from(v, (z) => +z.toFixed(6))]));
  return { market, cost, assumed: ASSUMED.includes(market), first: M5[0].t, last: M5[M5.length - 1].t, ...cnt, acc: J(acc) };
}

export function cutTest(market, cuts = ['2008-06-11', '2012-03-14', '2016-09-21', '2021-02-17', '2025-05-07']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' });
  const key = (g) => [g.l, g.tr, g.s, g.ts, g.stop.toFixed(8), g.watr.toFixed(8), g.day, g.d1].join('|');
  const full = signals(frames(M5)); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const cut = signals(frames(M5.filter((b) => b.e <= T))).filter((g) => g.ts <= T).map(key);
    const want = full.filter((g) => g.ts <= T).map(key); const A = new Set(cut), B = new Set(want);
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- pooled statistics over a set of markets and a range of months -------------------------------------------------------
export function stat(list, c, a, b) {
  const ms = new Float64Array(NM), msn = new Float64Array(NM); let n = 0, sum = 0, net = 0, cr = 0;
  for (const d of list) for (let m = a; m < b; m++) { const k = c * NM + m; ms[m] += d.acc.ms[k]; msn[m] += d.acc.msNet[k]; n += d.acc.mc[k]; sum += d.acc.ms[k]; net += d.acc.msNet[k]; cr += d.acc.cr[k]; }
  return { n, mean: n ? sum / n : null, t: mstat(ms, a, b).t, meanNet: n ? net / n : null, tNet: mstat(msn, a, b).t, costR: n ? cr / n : null, months: b - a };
}
export const eligible = (s) => s.n >= 300 && s.meanNet > 0 && s.tNet >= 2;
export function select(rows) { return rows.filter((r) => eligible(r.S)).sort((p, q) => q.S.tNet - p.S.tNet).slice(0, MAXSEL).map((r) => r.cell); }
export function judge(S, H, rows) {
  const sel = select(rows); const H1p = K.holm(sel.map((c) => p1(rows[c].H1.tNet, rows[c].H1.months - 1)));
  for (const r of rows) { r.selected = sel.includes(r.cell); r.pass = false; r.h1 = null; }
  sel.forEach((c, i) => { const r = rows[c], h = r.H1;
    r.h1 = { holm: H1p[i], n: h.n >= 300, sign: h.meanNet > 0, t: h.tNet >= 2, holmOk: H1p[i] < 0.05, h2: r.H2.meanNet > 0 };
    r.pass = r.h1.n && r.h1.sign && r.h1.t && r.h1.holmOk && r.h1.h2; });
  let verdict = 'FAIL';
  if (rows.some((r) => r.pass)) verdict = 'PASS';
  else if (sel.some((c) => { const h = rows[c].h1; return h.sign && h.t; })) verdict = 'INCONCLUSIVE';
  return { sel, verdict };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null || !isFinite(x) ? 'n/a' : (x >= 0 ? '' : '-') + Math.abs(x).toFixed(2));
const N = (x) => Math.round(x).toLocaleString('en-US');
const slim = (s) => ({ n: s.n, mean: s.mean == null ? null : +s.mean.toFixed(6), t: +s.t.toFixed(4), meanNet: s.meanNet == null ? null : +s.meanNet.toFixed(6), tNet: +s.tNet.toFixed(4), costR: s.costR == null ? null : +s.costR.toFixed(4) });

export function report(dir) {
  const rd = (m) => { const f = path.join(dir, m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
  const S = S_MARKETS.map(rd).filter((d) => d && !d.empty), H = H_MARKETS.map(rd).filter((d) => d && !d.empty);
  const cut = [...S_MARKETS, ...H_MARKETS].flatMap((m) => { const f = path.join(dir, 'cut-' + m + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const rows = Array.from({ length: NCELL }, (_, c) => ({ cell: c, ...cellName(c), S: stat(S, c, 0, DM), H2: stat(S, c, DM, NM), H1: stat(H, c, 0, NM) }));
  const { sel, verdict } = S.length < 10 || H.length < 8 ? { sel: [], verdict: 'INCONCLUSIVE' } : judge(S, H, rows);
  const best = sel.length ? [...sel].map((c) => rows[c]).sort((p, q) => q.H1.tNet - p.H1.tNet)[0] : [...rows].sort((p, q) => q.S.tNet - p.S.tNet)[0];
  const pass = rows.filter((r) => r.pass);
  const headline = !sel.length
    ? `no cell is eligible on 2005-14 after costs (best ${best.name}: ${f3(best.S.meanNet)}R a trade after costs, n ${N(best.S.n)}, month t ${f2(best.S.tNet)}), so nothing reaches the holdout`
    : `${pass.length} of ${sel.length} selected cells pass; ${best.name} on the eight untouched markets made ${f3(best.H1.meanNet)}R a trade after costs (n ${N(best.H1.n)}, month t ${f2(best.H1.tNet)}; ${f3(best.H1.mean)}R before costs), ${f3(best.H2.meanNet)}R on 2015-26 of the selection markets (n ${N(best.H2.n)})`;
  const perMarket = {}; for (const c of sel) perMarket[rows[c].name] = [...S, ...H].map((d) => ({ market: d.market, assumed: d.assumed,
    S: S.includes(d) ? slim(stat([d], c, 0, DM)) : null, H2: S.includes(d) ? slim(stat([d], c, DM, NM)) : null, H1: H.includes(d) ? slim(stat([d], c, 0, NM)) : null }));
  const out = { study: 'msnr-switch-complements', built: '2026-11-24', verdict, headline,
    basis: 'selected AFTER costs on 2005-14 of ten markets; judged AFTER costs on eight untouched markets (H1) and on 2015-26 of the ten (H2, sign only)',
    selectionMarkets: S_MARKETS, holdoutMarkets: H_MARKETS, assumedCosts: ASSUMED, costs: Object.fromEntries([...S, ...H].map((d) => [d.market, d.cost])),
    meta: [...S, ...H].map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10),
      signals: d.signals, sims: d.sims, dropped: d.dropped, bad: d.bad, small: d.small, open: d.open })),
    selected: sel.map((c) => rows[c].name), passed: pass.map((r) => r.name), cut,
    cells: rows.map((r) => ({ cell: r.name, S: slim(r.S), H1: slim(r.H1), H2: slim(r.H2), eligible: eligible(r.S), selected: r.selected,
      h1: r.h1 ? { ...r.h1, holm: +r.h1.holm.toFixed(4) } : null, pass: r.pass })), perMarket };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out, rows));
  return out;
}

function resultMd(o, rows) {
  const L = [], nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  L.push('# The MSNR switch with complements: picked on old years, judged on untouched markets (result)', '', `**Verdict: ${o.verdict}. ${o.headline}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Research only: nothing live',
    'changed, nothing is proposed. One run, no variants.', '',
    '## What was run', '',
    'The three switch triggers of `msnr-switch-fade` (a: fade the first lower-timeframe break against a fresh call; b: the first',
    'break with it; c: the switch candle), call age 0-5, on its two ladders (L4: H4 / Daily levels / M15; LH: H1 / H4 levels / M5),',
    'with four complements taken from other studies: the stop (`swing` as before, or `watr` = 1 ATR of the working chart), the',
    'hours (`all`, or `day` = 07-20 UTC, away from the daily roll), the Daily structure (`any`, or `d1` = agrees with the call) and',
    'the exit (`2R` or the next opposite key level). 96 cells. Selection AFTER costs on the ten markets\' 2005-14 fills (n >= 300,',
    'after-cost mean > 0 and month t >= 2; the best three by month t); judged AFTER costs on eight markets no switch study had',
    'read (H1: ' + o.holdoutMarkets.join(', ') + ', 2005 to Oct 2026; n >= 300, month t >= 2, Holm over the selected), and on 2015-26',
    'of the ten (H2, positive only).', `Costs: demo figures for gold and the four majors; **ASSUMED, not measured** for ${o.assumedCosts.join(', ')}.`, '',
    '## Selection', '', `Eligible on 2005-14 after costs: ${o.cells.filter((c) => c.eligible).length} of 96. Selected: ${o.selected.length ? o.selected.join('; ') : 'none'}.`, '');
  if (o.selected.length) { L.push('## The selected cells on the holdouts (after costs)', '', '| Cell | S n | S net (t) | H1 n | H1 R | H1 net (t) | H1 Holm | H2 n | H2 net (t) | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const name of o.selected) { const c = o.cells.find((x) => x.cell === name);
      L.push(`| ${name} | ${N(c.S.n)} | ${f3(c.S.meanNet)} (${f2(c.S.tNet)}) | ${N(c.H1.n)} | ${f3(c.H1.mean)} | ${f3(c.H1.meanNet)} (${f2(c.H1.tNet)}) | ${c.h1.holm.toFixed(3)} | ${N(c.H2.n)} | ${f3(c.H2.meanNet)} (${f2(c.H2.tNet)}) | ${c.pass ? 'yes' : 'no'} |`); }
    L.push(''); for (const [name, list] of Object.entries(o.perMarket)) { L.push(`### ${name}, per market (after costs; * = cost ASSUMED)`, '', '| Market | set | n | R before | net (t) |', '|---|---|---:|---:|---:|');
      for (const x of list) for (const k of ['S', 'H2', 'H1']) if (x[k]) L.push(`| ${x.market}${x.assumed ? '*' : ''} | ${k} | ${N(x[k].n)} | ${f3(x[k].mean)} | ${f3(x[k].meanNet)} (${f2(x[k].tNet)}) |`);
      L.push(''); } }
  L.push('## Every cell', '', 'R a trade before costs / after costs (month t of after-cost R). S = ten markets 2005-14 (selection); H1 = eight untouched',
    'markets 2005-26; H2 = ten markets 2015-26. "cost R" = mean round trip / risk on S.', '',
    '| Cell | S n | S R | S net (t) | cost R | H1 n | H1 R | H1 net (t) | H2 n | H2 R | H2 net (t) | sel |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of o.cells) L.push(`| ${c.cell} | ${N(c.S.n)} | ${f3(c.S.mean)} | ${f3(c.S.meanNet)} (${f2(c.S.tNet)}) | ${c.S.costR == null ? 'n/a' : c.S.costR.toFixed(3)} | ${N(c.H1.n)} | ${f3(c.H1.mean)} | ${f3(c.H1.meanNet)} (${f2(c.H1.tNet)}) | ${N(c.H2.n)} | ${f3(c.H2.mean)} | ${f3(c.H2.meanNet)} (${f2(c.H2.tNet)}) | ${c.selected ? 'yes' : c.eligible ? 'eligible' : ''} |`);
  L.push('', '## Checks', '',
    `- Cut test: ${o.cut.length} cuts on ${[...new Set(o.cut.map((x) => x.market))].join(', ')}: ${N(nCut)} signals known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every trade has its stop on the losing side (the run throws otherwise); a risk under the round trip is no trade.', '',
    '| Market | candles from | signals | simulated | dropped | past the stop | risk under cost | unresolved |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.signals)} | ${N(m.sims)} | ${m.dropped} | ${N(m.bad)} | ${N(m.small)} | ${m.open} |`);
  L.push('', '## What it means', '');
  if (o.verdict === 'PASS') L.push('A cell picked on old years held up after costs on markets the switch work had never read. A candidate for a forward paper',
    'record (its own pre-registration), never a live rule without the owner; costs on the holdout markets are assumed, not measured.');
  else if (!o.selected.length) L.push('No combination of the switch triggers with the complements makes money after costs on 2005-14, so nothing went to the holdout.',
    'The wider stop and the filters do not turn the switch into something that pays the spread. Do not re-test variants on these years.');
  else L.push('The cells picked on old years did not hold up after costs on the untouched markets. The complements do not make the switch an edge.',
    'Do not re-test variants on these years or markets; nothing live changed, no rule is proposed.');
  L.push('');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'market') { fs.mkdirSync(b, { recursive: true }); const t0 = Date.now(); const r = runMarket(a);
    fs.writeFileSync(path.join(b, a + '.json'), JSON.stringify(r)); console.log(a, 'signals', r.signals, 'sims', r.sims, ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
  else if (cmd === 'cut') { fs.mkdirSync(b, { recursive: true }); const r = cutTest(a); fs.writeFileSync(path.join(b, 'cut-' + a + '.json'), JSON.stringify(r)); console.log(JSON.stringify(r)); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs market <m> <dir> | cut <m> <dir> | report <dir>');
}
