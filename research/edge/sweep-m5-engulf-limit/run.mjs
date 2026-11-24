// research/edge/sweep-m5-engulf-limit/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): a 15-minute sweep of the Asia
// range or of the previous trading day in London / the New York morning, entered by a limit at the near edge of the first
// 5-minute engulf back inside, stop past the sweep's extreme, target 2R or the level's other side. 8 cells, five markets
// pooled, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on calendar-month sums.
// Research only: nothing live imports it, it places nothing. Usage: node run.mjs run   (writes result.json and RESULT.md)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { engulfAt } from '../../../council/eg-methods.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const LEVELS = ['asia', 'day'], SESS = ['london', 'ny'], TARGETS = ['2R', 'far'];
export const WIN_H = [[7, 12], [12, 17]];
export const BACK = 3, HOUR = 3600, DAY = 86400, STOP_ATR = 0.1, ASIA_MIN = 60, MIN_N = 300;
const y = (yr, m = 0) => Date.UTC(yr, m, 1) / 1000;
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10);   // fills 2005-01-01 .. 2026-10-31
export const NM = 262, DM = 120;                                   // months 2005-01 .. 2026-10; discovery 0..119
export const NCELL = 8;
export const cellIndex = (lv, se, x) => (lv * 2 + se) * 2 + x;
export const cellName = (i) => `${LEVELS[i >> 2]} ${SESS[(i >> 1) & 1]} ${TARGETS[i & 1]}`;
const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const lb = (A, t) => { let lo = 0, hi = A.length; while (lo < hi) { const m = (lo + hi) >> 1; if (A[m].t < t) lo = m + 1; else hi = m; } return lo; };
const adapt = (b) => ({ open: b.o, high: b.h, low: b.l, close: b.c });

// Every order of one market: { lv, se, s, t (the engulf candle's close = the order time), jT, mE, edge, X, entry, stop, far }.
// Depends only on 5-minute candles closed by t.
export function signals(M5) {
  const out = []; if (M5.length < 500) return out;
  const M15 = K.resample(M5, 900), D = K.dailyNY(M5);
  const atr = new Float64Array(M15.length); { let s = 0; const tr = new Float64Array(M15.length);
    for (let i = 0; i < M15.length; i++) { const b = M15[i], pc = i ? M15[i - 1].c : b.o; tr[i] = Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc));
      s += tr[i]; if (i >= 14) s -= tr[i - 14]; atr[i] = i >= 13 ? s / 14 : NaN; } }
  const d0 = Math.floor(M5[0].t / DAY) * DAY, d1 = M5[M5.length - 1].t;
  for (let D0 = d0; D0 <= d1; D0 += DAY) {
    const wd = new Date(D0 * 1000).getUTCDay(); if (wd === 0 || wd === 6) continue;
    let asia = null; { const a = lb(M5, D0), b = lb(M5, D0 + 7 * HOUR);
      if (b - a >= ASIA_MIN) { let hi = -Infinity, lo = Infinity; for (let i = a; i < b; i++) { if (M5[i].h > hi) hi = M5[i].h; if (M5[i].l < lo) lo = M5[i].l; } asia = { hi, lo }; } }
    for (let se = 0; se < 2; se++) {
      const start = D0 + WIN_H[se][0] * HOUR, end = D0 + WIN_H[se][1] * HOUR;
      let day = null; { const n = K.closedCount(D, start); const d = n ? D[n - 1] : null; if (d && start - d.e <= 4 * DAY) day = { hi: d.h, lo: d.l }; }
      const j0 = lb(M15, start);
      [asia, day].forEach((R, lv) => { if (!R) return;
        for (const s of [-1, 1]) {
          const edge = s < 0 ? R.hi : R.lo, far = s < 0 ? R.lo : R.hi;
          const beyond = (p) => (s < 0 ? p > edge : p < edge), inside = (p) => (s < 0 ? p < edge : p > edge);
          let j = -1, m = -1;
          for (let q = Math.max(j0, 1); q < M15.length && M15[q].t < end; q++) {
            if (!beyond(s < 0 ? M15[q].h : M15[q].l) || beyond(M15[q - 1].c)) continue;
            for (let r = q; r <= q + 2 && r < M15.length; r++) if (inside(M15[r].c)) { m = r; break; }
            if (m >= 0) { j = q; break; }
          }
          if (j < 0 || !(atr[m] > 0)) continue;
          const mE = M15[m].e, k0 = lb(M5, mE);
          for (let k = k0; k < M5.length && M5[k].t < mE + HOUR; k++) {
            const a = Math.max(0, k - BACK), w = M5.slice(a, k + 1).map(adapt), e = engulfAt(w, w.length - 1, BACK);
            if (!e || e.dir !== s || !inside(M5[k].c)) continue;
            const bi = a + e.j, base = M5[bi]; let gone = false;
            for (let q = bi + 1; q < k && !gone; q++) gone = s > 0 ? M5[q].c > base.h : M5[q].c < base.l;
            if (gone) continue;
            let X = s < 0 ? -Infinity : Infinity;
            for (let q = lb(M5, M15[j].t); q <= k; q++) X = s < 0 ? Math.max(X, M5[q].h) : Math.min(X, M5[q].l);
            const stop = X - s * STOP_ATR * atr[m], entry = s < 0 ? base.l : base.h;
            if (s * (entry - stop) > 0) out.push({ lv, se, s, t: M5[k].e, jT: M15[j].t, mE, edge, X, entry, stop, far });
            break;                                           // the first engulf of the hour, whether or not it gave an order
          }
        }
      });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}
export const sigKey = (g) => [g.lv, g.se, g.s, g.t, g.entry.toFixed(8), g.stop.toFixed(8), g.far.toFixed(8)].join('|');

// The trades of one order: [{ x (target index), ...simulate result }] for the cells it belongs to.
export function trades(g, M5, cost) {
  const risk = g.s * (g.entry - g.stop), out = [];
  if (!(risk > 0) || risk < cost) return out;
  const base = { side: g.s, entry: g.entry, stop: g.stop, t: g.t, type: 'limit', expire: g.t + HOUR, maxHold: DAY };
  const tg = [g.entry + g.s * 2 * risk, g.s * (g.far - g.entry) >= risk ? g.far : null];
  tg.forEach((target, x) => { if (target == null) return; const r = K.simulate({ ...base, target }, M5, { cost });
    if (r.status === 'win' || r.status === 'loss' || r.status === 'be') out.push({ x, planned: (g.s * (target - g.entry)) / risk, ...r }); });
  return out;
}

const newAcc = () => ({ n: new Float64Array(NCELL * 2), w: new Float64Array(NCELL * 2), sb: new Float64Array(NCELL * 2), sa: new Float64Array(NCELL * 2),
  mb: new Float64Array(NCELL * NM), ma: new Float64Array(NCELL * NM) });
export function runMarket(market, { from = '2004-12-01', to = '2026-11-08' } = {}) {
  const M5 = K.load(market, '5m', { from, to }), cost = K.COSTS[market], S = signals(M5), A = newAcc();
  const fun = { orders: S.length, tooSmall: 0, filled2R: 0 }; const planned = Array.from({ length: NCELL }, () => []);
  for (const g of S) {
    const risk = g.s * (g.entry - g.stop); if (risk < cost) { fun.tooSmall++; continue; }
    for (const r of trades(g, M5, cost)) {
      if (!(r.fillT >= FROM && r.fillT < TO)) continue;
      const c = cellIndex(g.lv, g.se, r.x), wn = r.fillT < SPLIT ? 0 : 1, mo = monthOf(r.fillT);
      A.n[c * 2 + wn]++; if (r.Rnet > 0) A.w[c * 2 + wn]++; A.sb[c * 2 + wn] += r.R; A.sa[c * 2 + wn] += r.Rnet;
      A.mb[c * NM + mo] += r.R; A.ma[c * NM + mo] += r.Rnet; if (r.x === 0) fun.filled2R++; else planned[c].push(r.planned);
    }
  }
  return { market, bars: M5.length, first: new Date(M5[0].t * 1000).toISOString().slice(0, 10), fun, A, planned };
}

export function mstat(ms, off, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[off + m]; q += ms[off + m] ** 2; }
  const mean = s / n, v = (q - n * mean * mean) / (n - 1); return v > 0 ? mean / Math.sqrt(v / n) : 0; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function cellRow(A, c) {
  const one = (wn, a, b) => { const n = A.n[c * 2 + wn];
    return { n, win: n ? A.w[c * 2 + wn] / n : null, before: n ? A.sb[c * 2 + wn] / n : null, after: n ? A.sa[c * 2 + wn] / n : null,
      tBefore: mstat(A.mb, c * NM, a, b), tAfter: mstat(A.ma, c * NM, a, b) }; };
  return { cell: cellName(c), disc: one(0, 0, DM), conf: one(1, DM, NM) };
}
export function judge(rows) {
  const ps = rows.map((r) => p1(r.conf.tAfter, NM - DM - 1)), hp = K.holm(ps);
  rows.forEach((r, i) => { r.pConf = ps[i]; r.holm = hp[i]; r.enough = r.disc.n >= MIN_N && r.conf.n >= MIN_N;
    r.pass = r.enough && r.disc.after > 0 && r.conf.after > 0 && r.disc.tAfter >= 2 && r.conf.tAfter >= 2 && r.holm < 0.05; });
  const pool = rows.some((r) => r.enough) ? rows.filter((r) => r.enough) : rows;
  const best = [...pool].sort((a, b) => b.conf.tAfter - a.conf.tAfter)[0];
  const verdict = rows.some((r) => r.pass) ? 'PASS' : rows.some((r) => r.enough) ? 'FAIL' : 'INCONCLUSIVE';
  return { verdict, best: best.cell, passed: rows.filter((r) => r.pass).map((r) => r.cell) };
}

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3));
const f2 = (x) => (x >= 0 ? '' : '-') + Math.abs(x).toFixed(2);
const nf = (n) => Math.round(n).toLocaleString('en-US');
export function headline(R) { const b = R.cells.find((c) => c.cell === R.best);
  return `${R.passed.length} of ${NCELL} cells pass; the best, ${b.cell}, made ${f3(b.conf.after)}R a trade after costs in 2015-26 (n ${nf(b.conf.n)}, month t ${f2(b.conf.tAfter)}; before costs ${f3(b.conf.before)}R; discovery ${f3(b.disc.after)}R after costs, n ${nf(b.disc.n)}, month t ${f2(b.disc.tAfter)})`; }
export function markdown(R) {
  const L = [];
  L.push('# M15 sweep of the Asia range or the previous day, limit at an M5 engulf back inside (result)', '');
  L.push(`**Verdict: ${R.verdict}. ${R.headline}.**`, '');
  L.push('Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, no rule is',
    'proposed. Five markets pooled (xau, eurusd, gbpusd, usdjpy, audusd), OANDA mid 5-minute candles, windows by fill time: discovery',
    '2005-01-01 to 2014-12-31, confirmation 2015-01-01 to 2026-10-31. R a trade; t = the t of calendar-month sums (every month of the',
    'window, empty months 0). Costs: the shared round trips of `edgekit` `COSTS`, charged as cost / risk.', '');
  L.push('## Cells', '', '| cell | disc n | disc before | disc after | disc t after | conf n | conf win | conf before | conf after | conf t before | conf t after | Holm p | pass |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const c of R.cells) L.push(`| ${c.cell} | ${nf(c.disc.n)} | ${f3(c.disc.before)} | ${f3(c.disc.after)} | ${f2(c.disc.tAfter)} | ${nf(c.conf.n)} | ${c.conf.win == null ? 'n/a' : (100 * c.conf.win).toFixed(0) + ' %'} | ${f3(c.conf.before)} | ${f3(c.conf.after)} | ${f2(c.conf.tBefore)} | ${f2(c.conf.tAfter)} | ${c.holm.toFixed(3)} | ${c.pass ? 'yes' : 'no'} |`);
  L.push('', 'The bar: n >= 300 in each window, mean R after costs > 0 with month t >= 2 in both windows, Holm p < 0.05 over the 8 cells.', '');
  L.push('## Funnel (orders with their stop on the losing side, all dates loaded)', '', '| market | first candle | orders | risk under the cost | 2R trades filled in the windows |', '|---|---|---:|---:|---:|');
  for (const m of R.markets) L.push(`| ${m.market} | ${m.first} | ${nf(m.orders)} | ${nf(m.tooSmall)} | ${nf(m.filled2R)} |`);
  L.push('', `## The best cell by market (${R.best})`, '', '| market | disc n | disc after | conf n | conf before | conf after | conf t after |', '|---|---:|---:|---:|---:|---:|---:|');
  for (const m of R.bestByMarket) L.push(`| ${m.market} | ${nf(m.disc.n)} | ${f3(m.disc.after)} | ${nf(m.conf.n)} | ${f3(m.conf.before)} | ${f3(m.conf.after)} | ${f2(m.conf.tAfter)} |`);
  L.push('', '## Planned reward of the `far` cells (median, in R)', '');
  for (const p of R.farPlanned) L.push(`- ${p.cell}: ${p.median == null ? 'n/a' : p.median.toFixed(2) + 'R'} (n ${nf(p.n)})`);
  L.push('', '## Reading', '', R.reading, '');
  L.push('## Limits', '', '- OANDA mid candles: a limit is filled when the mid trades to it; a real fill needs the bid / ask to reach it, so the fill rate is',
    '  flattered. Costs are today\'s round trips charged on every year.', '- No data-quality exclusion list is applied (pre-registered).',
    '- Five markets pooled; trades of one sweep in the `2R` and `far` cells, and of the Asia and day levels when they coincide, are not independent.',
    '- One run, no variants. A paper study: never an edge by itself.', '');
  return L.join('\n');
}

export function main() {
  const res = [], P = newAcc();
  for (const m of MARKETS) { const r = runMarket(m); res.push(r); for (const k of Object.keys(P)) for (let i = 0; i < P[k].length; i++) P[k][i] += r.A[k][i];
    console.error(m, r.bars, 'bars', JSON.stringify(r.fun)); }
  const cells = Array.from({ length: NCELL }, (_, c) => cellRow(P, c)); const J = judge(cells); const bi = cells.findIndex((c) => c.cell === J.best);
  const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, q) => x - q); return s[s.length >> 1]; };
  const R = { title: 'M15 sweep of the Asia range or the previous day, limit at an M5 engulf back inside', built: '2026-11-24', verdict: J.verdict, best: J.best, passed: J.passed,
    windows: { discovery: '2005-01-01 to 2014-12-31', confirmation: '2015-01-01 to 2026-10-31' }, markets: res.map((r) => ({ market: r.market, first: r.first, bars: r.bars, ...r.fun })),
    costs: Object.fromEntries(MARKETS.map((m) => [m, K.COSTS[m]])), cells,
    bestByMarket: res.map((r) => ({ market: r.market, ...cellRow(r.A, bi) })),
    farPlanned: [1, 3, 5, 7].map((c) => { const all = res.flatMap((r) => r.planned[c]); return { cell: cellName(c), n: all.length, median: med(all) }; }) };
  R.headline = headline(R);
  const b = cells[bi], pos = cells.filter((c) => c.conf.after > 0).length, posB = cells.filter((c) => c.conf.before > 0).length;
  R.reading = `Before costs ${posB} of ${NCELL} cells are above zero in 2015-26 and after costs ${pos} of ${NCELL}. The best cell by its confirmation month t after costs is ${b.cell}: ` +
    `${f3(b.conf.before)}R before and ${f3(b.conf.after)}R after costs (n ${nf(b.conf.n)}, month t ${f2(b.conf.tAfter)}, Holm p ${b.holm.toFixed(3)}); in discovery ${f3(b.disc.before)}R before and ${f3(b.disc.after)}R after costs ` +
    `(n ${nf(b.disc.n)}, month t ${f2(b.disc.tAfter)}). ` + (J.verdict === 'PASS' ? 'A cell clears the pre-registered bar: a hypothesis for a holdout on other markets, not an edge.' :
      J.verdict === 'FAIL' ? 'No cell clears the pre-registered bar. The limit at the engulf zone does not turn the sweep into a rule that survives costs in both windows. Nothing is tuned after this result.' :
        'No cell has 300 trades in both windows: too few to judge.');
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), markdown(R));
  console.log(R.verdict, R.headline);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'run') main();
