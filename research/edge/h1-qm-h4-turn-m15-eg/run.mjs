// research/edge/h1-qm-h4-turn-m15-eg/run.mjs - the study of PREREGISTRATION.md (24 Nov 2026): an H1 quasimodo whose head
// reached the last unbroken H4 turn of the closes, entered by a limit at the left shoulder only after a 15-minute engulf
// with the trade completed there ("eg"), beside the same limit placed at once ("now", the control); stop past the head,
// targets 2R and 3R. Five markets, discovery 2005-14, confirmation 2015 to Oct 2026, judged AFTER costs on month sums.
// Research only: nothing live imports it, nothing is placed.
//   EDGE_DATA=<cache> node research/edge/h1-qm-h4-turn-m15-eg/run.mjs run <outDir>      (every market, the cut test, the report)
//   node research/edge/h1-qm-h4-turn-m15-eg/run.mjs report <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as K from '../_lib/edgekit.mjs';
import { exclusions } from '../combo-grid-2/run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const y = (yr, m = 0) => Date.UTC(yr, m, 1) / 1000;
export const MARKETS = ['xau', 'eurusd', 'gbpusd', 'usdjpy', 'audusd'];
export const FROM = y(2005), SPLIT = y(2015), TO = y(2026, 10), NM = 262, DM = 120;
export const KINDS = ['eg', 'now'], KS = [2, 3];
export const CELLS = ['eg 2R', 'eg 3R', 'now 2R', 'now 3R'];
export const P = { K: 3, turn: 2, egWait: 86400, egBack: 3, egLife: 12 * 3600, nowLife: 86400, hold: 2 * 86400, minRisk: 2 };
export const monthOf = (t) => { const d = new Date(t * 1000); return (d.getUTCFullYear() - 2005) * 12 + d.getUTCMonth(); };
const lower = (B, t) => { let lo = 0, hi = B.length; while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].t < t) lo = m + 1; else hi = m; } return lo; };

export function frames(M5) { return { '5m': M5, '15m': K.resample(M5, 900), '1h': K.resample(M5, 3600), '4h': K.resample(M5, 14400) }; }

// H4 turns of the closes: d -1 = a peak (serves sells), +1 = a trough (serves buys). known = the close of the second candle
// after it; broken = the close time of the first later candle closing beyond the level (Infinity while none).
export function turns(H4, n = P.turn) {
  const out = { '-1': [], 1: [] };
  for (let m = n; m + n < H4.length; m++) { const c = H4[m].c; let hi = true, lo = true;
    for (let j = 1; j <= n; j++) { if (!(c > H4[m - j].c && c > H4[m + j].c)) hi = false; if (!(c < H4[m - j].c && c < H4[m + j].c)) lo = false; }
    if (!hi && !lo) continue; const d = hi ? -1 : 1; let broken = Infinity;
    for (let j = m + n + 1; j < H4.length; j++) if (d < 0 ? H4[j].c > c : H4[j].c < c) { broken = H4[j].e; break; }
    out[d].push({ d, level: c, t: H4[m].t, known: H4[m + n].e, broken }); }
  return out;
}
// the most recent turn of side d known by `by` and not broken by `ts`
export function lastTurn(list, by, ts) {
  let lo = 0, hi = list.length; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].known <= by) lo = m + 1; else hi = m; }
  for (let k = lo - 1; k >= 0; k--) if (list[k].broken > ts) return list[k];
  return null;
}

// the first 15-minute engulf with the trade at the shoulder after ts: { j, t (order time) } | { void: true } | null
export function engulfAt(M15, s, ts, shoulder, stop) {
  const a = lower(M15, ts);
  for (let j = a; j < M15.length && M15[j].e <= ts + P.egWait; j++) { const c = M15[j];
    if (s > 0 ? c.l <= stop : c.h >= stop) return { void: true };
    if (!(s > 0 ? c.c > c.o : c.c < c.o)) continue;
    let b = -1; for (let k = j - 1; k >= j - P.egBack && k >= a; k--) if (s > 0 ? M15[k].c < M15[k].o : M15[k].c > M15[k].o) { b = k; break; }
    if (b < 0) continue; const B = M15[b];
    if (!(s > 0 ? c.c > B.h : c.c < B.l)) continue;
    let ok = true, ext = s > 0 ? Infinity : -Infinity;
    for (let k = b; k <= j; k++) { const x = M15[k]; ext = s > 0 ? Math.min(ext, x.l) : Math.max(ext, x.h);
      if (k > b && k < j && (x.c > B.h || x.c < B.l)) ok = false; }
    if (!ok) continue;
    if (!(s * (shoulder - ext) >= 0)) continue;          // it traded at the shoulder
    if (!(s * (ext - stop) > 0)) continue;               // and never at the stop
    if (!(s * (c.c - shoulder) > 0)) continue;           // and closed back on the price side of the shoulder
    return { j, t: c.e };
  }
  return null;
}

// ---- orders (closed candles only): { kind, s, t0, expire, entry, stop, ts } ------------------------------------------------
export function setups(F, cost) {
  const H1 = F['1h'], M15 = F['15m'], T = turns(F['4h']); const out = []; const cnt = { qm: 0, atLevel: 0, small: 0, void: 0, eg: 0 };
  for (const q of K.qms(H1, P.K)) { const s = q.side, ts = q.t; cnt.qm++;
    const lv = lastTurn(T[s], H1[q.headI].t, ts); if (!lv) continue;
    if (!(s * (lv.level - q.head) >= 0)) continue;       // the head reached the level
    cnt.atLevel++;
    const entry = q.shoulder, stop = q.head - s * cost / 2;
    if (!(s * (entry - stop) > 0)) throw new Error('stop on the wrong side');
    if (s * (entry - stop) < P.minRisk * cost) { cnt.small++; continue; }
    out.push({ kind: 1, s, t0: ts, expire: ts + P.nowLife, entry, stop, ts, level: lv.level });
    const e = engulfAt(M15, s, ts, entry, stop);
    if (e && e.void) cnt.void++;
    else if (e) { cnt.eg++; out.push({ kind: 0, s, t0: e.t, expire: e.t + P.egLife, entry, stop, ts, level: lv.level }); }
  }
  out.cnt = cnt; return out;
}

// ---- one limit order on 5-minute candles: null (no fill) | { open: true } | { fillT, fill, risk, R: [2R, 3R] } before costs --
export function walk(M5, o, cost, ks = KS) {
  const { s, entry, stop } = o; let i = lower(M5, o.t0), fi = -1;
  for (; i < M5.length && M5[i].t < o.expire; i++) { const b = M5[i]; if (s > 0 ? b.l <= entry - cost / 2 : b.h >= entry + cost / 2) { fi = i; break; } }
  if (fi < 0) return null;
  const f = M5[fi], fill = s > 0 ? Math.min(f.o, entry) : Math.max(f.o, entry), risk = s * (fill - stop);
  if (!(risk > 0)) return { fillT: f.t, fill, risk: s * (entry - stop), R: ks.map(() => 0) };
  const R = ks.map(() => NaN); let left = ks.length; const dl = f.t + P.hold;
  const fin = (k, px) => { if (Number.isNaN(R[k])) { R[k] = (s * (px - fill)) / risk; left--; } };
  for (let j = fi; j < M5.length && left; j++) { const b = M5[j];
    if (j > fi) { if (s * (b.o - stop) <= 0) ks.forEach((_, k) => fin(k, b.o)); else ks.forEach((x, k) => { if (s * (b.o - (fill + s * x * risk)) >= 0) fin(k, b.o); }); }
    if (s > 0 ? b.l <= stop : b.h >= stop) ks.forEach((_, k) => fin(k, stop));
    if (j > fi) ks.forEach((x, k) => { const tg = fill + s * x * risk; if (s > 0 ? b.h >= tg : b.l <= tg) fin(k, tg); });
    if (b.e >= dl) ks.forEach((_, k) => fin(k, b.c)); }
  return left ? { open: true } : { fillT: f.t, fill, risk, R };
}

const inBad = (X, t) => { let lo = 0, hi = X.length; while (lo < hi) { const m = (lo + hi) >> 1; if (X[m][0] <= t) lo = m + 1; else hi = m; } return lo > 0 && t <= X[lo - 1][1]; };

export function runMarket(market) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }); const F = frames(M5), cost = K.COSTS[market], X = exclusions(market);
  const S = setups(F, cost); const trades = []; const cnt = { ...S.cnt, orders: [0, 0], fills: [0, 0], nofill: [0, 0], dropped: 0, open: 0 };
  for (const o of S) { cnt.orders[o.kind]++;
    const r = walk(M5, o, cost); if (!r) { cnt.nofill[o.kind]++; continue; } if (r.open) { cnt.open++; continue; }
    if (r.fillT < FROM || r.fillT >= TO) continue;
    if (X.length && inBad(X, r.fillT)) { cnt.dropped++; continue; }
    cnt.fills[o.kind]++;
    trades.push([o.kind, r.fillT, +r.R[0].toFixed(5), +r.R[1].toFixed(5), +(cost / r.risk).toFixed(5)]); }
  return { market, cost, first: M5[0].t, last: M5[M5.length - 1].t, cnt, trades };
}

export function cutTest(market, cuts = ['2009-06-10', '2016-09-21', '2023-03-15']) {
  const M5 = K.load(market, '5m', { from: '2004-01-01', to: '2026-11-01' }), cost = K.COSTS[market];
  const key = (o) => [o.kind, o.s, o.t0, o.entry, o.stop, o.level].join('|'); const full = setups(frames(M5), cost); const out = [];
  for (const c of cuts) { const T = Date.parse(c + 'T00:00:00Z') / 1000;
    const A = new Set(setups(frames(M5.filter((b) => b.e <= T)), cost).filter((o) => o.t0 <= T).map(key)), B = new Set(full.filter((o) => o.t0 <= T).map(key));
    out.push({ market, cut: c, n: B.size, missing: [...B].filter((k) => !A.has(k)).length, extra: [...A].filter((k) => !B.has(k)).length }); }
  return out;
}

// ---- statistics -------------------------------------------------------------------------------------------------------------
function mstat(ms, a, b) { const n = b - a; let s = 0, q = 0; for (let m = a; m < b; m++) { s += ms[m]; q += ms[m] * ms[m]; }
  const mean = s / n, sd = Math.sqrt(Math.max(0, (q - n * mean * mean) / (n - 1))); return sd > 0 ? mean / (sd / Math.sqrt(n)) : 0; }
const p1 = (t, df) => { const p = K.pFromT(t, df); return p == null ? 1 : t > 0 ? p / 2 : 1 - p / 2; };
export function cellStats(trades, cell) { // trades: [kind, fillT, R2, R3, costR]
  const kind = cell >> 1, x = cell & 1; const ms = new Float64Array(NM), msn = new Float64Array(NM);
  const W = [0, 1].map(() => ({ n: 0, sum: 0, net: 0, win: 0, cr: 0 }));
  for (const t of trades) { if (t[0] !== kind) continue; const R = t[2 + x], w = t[1] < SPLIT ? 0 : 1, m = monthOf(t[1]);
    ms[m] += R; msn[m] += R - t[4]; const a = W[w]; a.n++; a.sum += R; a.net += R - t[4]; a.cr += t[4]; if (R > 0) a.win++; }
  const win = (w) => { const a = W[w], lo = w ? DM : 0, hi = w ? NM : DM;
    return { n: a.n, mean: a.n ? +(a.sum / a.n).toFixed(4) : null, t: +mstat(ms, lo, hi).toFixed(2), meanNet: a.n ? +(a.net / a.n).toFixed(4) : null, tNet: +mstat(msn, lo, hi).toFixed(2),
      win: a.n ? +(a.win / a.n).toFixed(3) : null, costR: a.n ? +(a.cr / a.n).toFixed(4) : null, months: hi - lo }; };
  return { d: win(0), c: win(1) };
}
export function judge(trades) {
  const rows = CELLS.map((name, i) => { const s = cellStats(trades, i); return { cell: name, disc: s.d, conf: s.c, p: p1(s.c.tNet, s.c.months - 1) }; });
  const H = K.holm(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.holm = +H[i].toFixed(4); r.p = +r.p.toFixed(4);
    r.checks = { n: r.disc.n >= 300 && r.conf.n >= 300, disc: r.disc.meanNet > 0 && r.disc.tNet >= 2, conf: r.conf.meanNet > 0 && r.conf.tNet >= 2, holm: H[i] < 0.05 };
    r.pass = r.checks.n && r.checks.disc && r.checks.conf && r.checks.holm; });
  return rows;
}
export function verdictOf(rows) { const eg = rows.filter((r) => r.cell.startsWith('eg'));
  return eg.some((r) => r.pass) ? 'PASS' : eg.every((r) => !r.checks.n) ? 'INCONCLUSIVE' : 'FAIL'; }

const f3 = (x) => (x == null ? 'n/a' : (x >= 0 ? '+' : '-') + Math.abs(x).toFixed(3)), f2 = (x) => (x == null ? 'n/a' : x.toFixed(2)), N = (x) => Math.round(x).toLocaleString('en-US');

export function report(dir) {
  const data = MARKETS.map((m) => JSON.parse(fs.readFileSync(path.join(dir, m + '.json'), 'utf8')));
  const cutF = path.join(dir, 'cut.json'), cut = fs.existsSync(cutF) ? JSON.parse(fs.readFileSync(cutF, 'utf8')) : [];
  const all = data.flatMap((d) => d.trades), rows = judge(all), verdict = verdictOf(rows);
  const eg = rows.filter((r) => r.cell.startsWith('eg')); const best = [...eg].sort((a, b) => (b.conf.meanNet ?? -9) - (a.conf.meanNet ?? -9))[0];
  const headline = `best cell ${best.cell}: ${f3(best.conf.meanNet)}R a trade after costs in 2015-26 (n ${N(best.conf.n)}, month t ${f2(best.conf.tNet)}); 2005-14 ${f3(best.disc.meanNet)}R (n ${N(best.disc.n)}, t ${f2(best.disc.tNet)})`;
  const perMarket = data.map((d) => ({ market: d.market, cost: d.cost, cells: [0, 1].map((i) => { const s = cellStats(d.trades, i); return { cell: CELLS[i], disc: s.d, conf: s.c }; }) }));
  const out = { study: 'h1-qm-h4-turn-m15-eg', built: '2026-11-24', verdict, headline, basis: 'judged after costs on calendar-month sums by fill month (pre-registered)',
    windows: { discovery: '2005-01-01 to 2014-12-31 (120 months)', confirmation: '2015-01-01 to 2026-10-31 (142 months)' }, markets: MARKETS,
    costs: Object.fromEntries(data.map((d) => [d.market, d.cost])), best: best.cell, cells: rows, perMarket,
    meta: data.map((d) => ({ market: d.market, first: new Date(d.first * 1000).toISOString().slice(0, 10), last: new Date(d.last * 1000).toISOString().slice(0, 10), ...d.cnt })), cut };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1) + '\n');
  fs.writeFileSync(path.join(HERE, 'RESULT.md'), resultMd(out));
  return out;
}

function resultMd(o) {
  const L = []; const row = (r) => `| ${r.cell} | ${N(r.disc.n)} | ${f3(r.disc.mean)} (${f2(r.disc.t)}) | ${f3(r.disc.meanNet)} (${f2(r.disc.tNet)}) | ${N(r.conf.n)} | ${f3(r.conf.mean)} (${f2(r.conf.t)}) | ${f3(r.conf.meanNet)} (${f2(r.conf.tNet)}) | ${r.conf.win == null ? 'n/a' : (r.conf.win * 100).toFixed(0) + ' %'} | ${r.conf.costR == null ? 'n/a' : r.conf.costR.toFixed(3)} |`;
  const nCut = o.cut.reduce((a, x) => a + x.n, 0), bad = o.cut.reduce((a, x) => a + x.missing + x.extra, 0);
  const cnt = (f) => o.cells.filter((r) => r.cell.startsWith('eg')).filter(f).length;
  L.push('# An H1 quasimodo at an H4 turn level, entered at the left shoulder after an M15 engulf (result)', '', `**Verdict: ${o.verdict}. ${o.headline[0].toUpperCase() + o.headline.slice(1)}.**`, '',
    'Run 24 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed, nothing',
    'is proposed. One run, no variants.', '',
    '## What was run', '',
    'An H1 quasimodo (for a sell: a swing high, a higher low, a higher high = the head, then an H1 close below the higher low;',
    '`edgekit` `qms`, swings 3 a side) whose head reached the last H4 peak of the closes (2 candles a side) still unbroken at the',
    'break. Entry: a limit at the left shoulder (the first swing high), stop past the head by half the round trip, target 2R or',
    '3R, out after 2 days. **eg** = the limit is placed only after a 15-minute engulf with the trade completed at the shoulder',
    '(within 24 hours of the break; the order then lives 12 hours); **now** = the same limit placed at the break (24 hours), the',
    'control. A limit fills only when a 5-minute candle trades through it by half the round trip; on the fill candle only the stop',
    `counts; a candle that holds stop and target is a stop. Buys mirror. Markets pooled: ${o.markets.join(', ')}; OANDA mid`,
    '5-minute candles. Discovery = fills 2005-2014, confirmation = 2015 to October 2026. Costs: the desk\'s demo round trips.', '',
    '## Every cell', '',
    'R a trade (month-sum t); "net" = after costs; win and cost R (mean round trip / risk) are for 2015-26.', '',
    '| Cell | n 05-14 | R 05-14 (t) | net 05-14 (t) | n 15-26 | R 15-26 (t) | net 15-26 (t) | win | cost R | Holm p | Pass |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
  for (const r of o.cells) L.push(row(r) + ` ${r.holm.toFixed(3)} | ${r.pass ? 'yes' : 'no'} |`);
  L.push('', '## The bar (after costs), the two `eg` cells', '',
    `- n >= 300 in both windows: ${cnt((r) => r.checks.n)} of 2.`,
    `- Mean R after costs > 0 and month t >= 2 in discovery: ${cnt((r) => r.checks.disc)}; in confirmation: ${cnt((r) => r.checks.conf)}.`,
    `- Holm-adjusted p < 0.05 (over the 4 cells): ${cnt((r) => r.checks.holm)}.`,
    `- **All of them: ${cnt((r) => r.pass)}.**`, '',
    '## Per market, the `eg` cells', '', '| Market | Cell | n 05-14 | R (t) | net (t) | n 15-26 | R (t) | net (t) | win | cost R |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.perMarket) for (const r of m.cells) L.push(`| ${m.market} ${row(r)}`);
  L.push('', '## Counts', '', '| Market | candles from | H1 QMs | head at the H4 level | risk under 2 x cost | void before an engulf | engulf found | fills eg | fills now | no fill eg | no fill now | dropped (bad data) | open at data end |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const m of o.meta) L.push(`| ${m.market} | ${m.first} | ${N(m.qm)} | ${N(m.atLevel)} | ${N(m.small)} | ${N(m.void)} | ${N(m.eg)} | ${N(m.fills[0])} | ${N(m.fills[1])} | ${N(m.nofill[0])} | ${N(m.nofill[1])} | ${m.dropped} | ${m.open} |`);
  const e2 = o.cells[0], n2 = o.cells[2];
  L.push('', '## Checks', '',
    `- Cut test (${[...new Set(o.cut.map((x) => x.market))].join(', ') || 'not run'}): ${o.cut.length} cuts, ${N(nCut)} orders known by the cut dates, ${bad} missing or extra when the candles are cut there.`,
    '- Every order has its stop on the losing side of its entry (the run throws otherwise).', '',
    '## What it means', '',
    o.verdict === 'PASS'
      ? 'An `eg` cell clears the pre-registered bar on mid candles with assumed fills. That is a result to be doubted and replicated, not an edge; nothing is adopted.'
      : o.verdict === 'INCONCLUSIVE'
        ? 'The setup is too rare on five markets to judge by the pre-registered bar (300 trades in each window). The figures above are descriptive only.'
        : 'Neither `eg` cell clears the bar after costs in both windows.',
    `Waiting for the 15-minute engulf against placing the limit at once, 2R target: ${f3(e2.conf.meanNet)}R against ${f3(n2.conf.meanNet)}R a trade after costs in 2015-26`,
    `(${f3(e2.disc.meanNet)}R against ${f3(n2.disc.meanNet)}R in 2005-14); descriptive, the two share most of their trades.`,
    'Do not re-test variants of these cells on these years. Nothing live changed; no rule is proposed.', '');
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, a] = process.argv.slice(2);
  if (cmd === 'run') { fs.mkdirSync(a, { recursive: true });
    for (const m of MARKETS) { const t0 = Date.now(); const r = runMarket(m); fs.writeFileSync(path.join(a, m + '.json'), JSON.stringify(r));
      console.log(m, JSON.stringify(r.cnt), ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
    const c = cutTest('eurusd'); fs.writeFileSync(path.join(a, 'cut.json'), JSON.stringify(c)); console.log(JSON.stringify(c));
    const o = report(a); console.log(o.verdict, o.headline); }
  else if (cmd === 'report') { const o = report(a); console.log(o.verdict, o.headline); }
  else console.log('usage: run.mjs run <dir> | report <dir>');
}
