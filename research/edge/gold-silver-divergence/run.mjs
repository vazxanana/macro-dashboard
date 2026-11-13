// Edge research · gold-silver-divergence: intraday gold / silver divergence ("SMT" as a plain statistical rule) on OANDA mid H1,
// fade and follow, as fixed in PREREGISTRATION.md. A new stand-alone intraday rule on gold; it reads nothing of the gold book.
// Paper research only.
//   node --use-env-proxy research/edge/gold-silver-divergence/run.mjs fetch <dir>   OANDA mid H1 XAU + XAG via the site's proxy
//   node research/edge/gold-silver-divergence/run.mjs full <dir>                     the study → result.json next to this file
// Candle files (<dir>/xau-h1.json, xag-h1.json, rows [t, o, h, l, c]) stay out of git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIN, nights } from '../../../council/fills.mjs';

export const LOOK = 24, ATR_N = 24, HOLD = 12, TARGET_R = 1.5, COST = 0.30, H = 3600;
export const ROLL_HOURS = [21, 22];
export const DECISIVE = { from: Date.UTC(2020, 0, 1) / 1000, to: Infinity };
export const REPLICATION = { from: Date.UTC(2008, 0, 1) / 1000, to: Date.UTC(2020, 0, 1) / 1000 };
export const SEEDS = 40;

// inner join of two H1 series on the candle start: [{ t, g: {o,h,l,c}, s: {o,h,l,c} }]
export function joinBars(gold, silver) {
  const sm = new Map(silver.map((r) => [r[0], r]));
  const out = [];
  for (const r of gold) { const s = sm.get(r[0]); if (s) out.push({ t: r[0], g: { o: r[1], h: r[2], l: r[3], c: r[4] }, s: { o: s[1], h: s[2], l: s[3], c: s[4] } }); }
  return out.sort((a, b) => a.t - b.t);
}

// events on closed candle i (only candles 0..i are read). kind 'div' = gold new extreme, silver not; 'gold' = gold condition only
export function eventAt(J, i, kind = 'div') {
  if (i < LOOK) return null;
  let gmax = -Infinity, gmin = Infinity, smax = -Infinity, smin = Infinity;
  for (let k = i - LOOK; k < i; k++) { const g = J[k].g.c, s = J[k].s.c; if (g > gmax) gmax = g; if (g < gmin) gmin = g; if (s > smax) smax = s; if (s < smin) smin = s; }
  const g = J[i].g.c, s = J[i].s.c;
  if (g > gmax && (kind === 'gold' || s < smax)) return 'high';
  if (g < gmin && (kind === 'gold' || s > smin)) return 'low';
  return null;
}

// simple ATR over the 24 gold candles ending with i
export function atrAt(J, i, n = ATR_N) {
  if (i < n) return null;
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) { const b = J[k].g, pc = J[k - 1].g.c; s += Math.max(b.h - b.l, Math.abs(b.h - pc), Math.abs(b.l - pc)); }
  return s / n;
}

// entry checks: next joined candle exactly one hour later and not starting in the rollover hours
export function entryOk(J, i) {
  const e = J[i + 1];
  if (!e || e.t !== J[i].t + H) return false;
  return !ROLL_HOURS.includes(new Date(e.t * 1000).getUTCHours());
}

export function signals(J, kind = 'div') {
  const out = [];
  for (let i = LOOK; i < J.length - 1; i++) {
    const ev = eventAt(J, i, kind);
    if (!ev || !entryOk(J, i)) continue;
    const atr = atrAt(J, i);
    if (!(atr > 0)) continue;
    out.push({ i, ev, atr });
  }
  return out;
}

export const sideOf = (ev, variant) => (variant === 'fade') === (ev === 'high') ? 'sell' : 'buy';

// one trade from signal at candle i: entry at the open of i+1, managed from that candle on
export function simTrade(J, sig, side) {
  const e = sig.i + 1, entry = J[e].g.o, d = sig.atr, dir = side === 'buy' ? 1 : -1;
  const stop = entry - dir * d, target = entry + dir * TARGET_R * d;
  let exit = null, how = null, k = e;
  for (; k < J.length && k < e + HOLD; k++) {
    const b = J[k].g;
    if (dir > 0 ? b.o <= stop : b.o >= stop) { exit = b.o; how = 'stop-gap'; break; }
    const hitS = dir > 0 ? b.l <= stop : b.h >= stop, hitT = dir > 0 ? b.h >= target : b.l <= target;
    if (hitS) { exit = stop; how = 'stop'; break; }
    if (hitT) { exit = target; how = 'target'; break; }
  }
  if (exit == null) {
    if (k < e + HOLD) return null; // data ended before the exit: no trade
    k = e + HOLD - 1; exit = J[k].g.c; how = 'time';
  }
  const t0 = J[e].t, t1 = J[k].t + H;
  const gross = dir * (exit - entry) / d, costR = COST / d;
  const nn = side === 'buy' ? nights(t0, t1) : 0, finR = side === 'buy' ? nn * FIN.xau.long * entry / d : 0;
  return { t: t0, closed: t1, exitIdx: k, side, ev: sig.ev, entry, stop, target, exit, how, atr: d, gross, costR, finR, nights: nn, net: gross - costR - finR };
}

// one stream over the whole history, one open trade at a time
export function stream(J, sigs, variant) {
  const out = [];
  let busyTo = -Infinity;
  for (const s of sigs) {
    if (J[s.i + 1].t < busyTo) continue;
    const tr = simTrade(J, s, sideOf(s.ev, variant));
    if (!tr) continue;
    out.push(tr); busyTo = tr.closed;
  }
  return out;
}

const inW = (w) => (x) => x.t >= w.from && x.t < w.to;
const mean = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0;
const sd = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1)); };
const r3 = (x) => Math.round(x * 1000) / 1000;
const r2 = (x) => Math.round(x * 100) / 100;

// calendar months from the month of `from` to the month of `to` inclusive, net R summed per month of entry
export function monthSums(trades, from, to) {
  const key = (t) => { const d = new Date(t * 1000); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  const a = key(from), b = key(to), sums = new Array(b - a + 1).fill(0);
  for (const x of trades) { const k = key(x.t) - a; if (k >= 0 && k < sums.length) sums[k] += x.net; }
  return sums;
}
export const tStat = (a) => { const s = sd(a); return s > 0 ? mean(a) / (s / Math.sqrt(a.length)) : 0; };
// one-sided p from the normal approximation
export function pOne(t) { return 0.5 * erfc(t / Math.SQRT2); }
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z); const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
// Holm over a map name → p; returns name → pass at alpha
export function holm(ps, alpha = 0.05) {
  const names = Object.keys(ps).sort((a, b) => ps[a] - ps[b]), out = {};
  let ok = true;
  names.forEach((n, k) => { ok = ok && ps[n] <= alpha / (names.length - k); out[n] = ok; });
  return out;
}
export function pct(vals, q) { const s = [...vals].sort((a, b) => a - b), x = q * (s.length - 1), lo = Math.floor(x), hi = Math.ceil(x); return s[lo] + (s[hi] - s[lo]) * (x - lo); }
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function sample(arr, n, rand) { const a = arr.slice(); for (let k = 0; k < n && k < a.length; k++) { const j = k + Math.floor(rand() * (a.length - k)); [a[k], a[j]] = [a[j], a[k]]; } return a.slice(0, n).sort((p, q) => p.i - q.i); }

function dd(trades) { let eq = 0, pk = 0, w = 0; for (const x of trades) { eq += x.net; pk = Math.max(pk, eq); w = Math.min(w, eq - pk); } return w; }
export function stats(trades, w, lastT) {
  const x = trades.filter(inW(w)), nets = x.map((q) => q.net);
  const months = x.length ? monthSums(x, w.from, Math.min(w.to - 1, lastT)) : [];
  const tm = tStat(months);
  return { n: x.length, net: r3(mean(nets)), gross: r3(mean(x.map((q) => q.gross))), total: r2(nets.reduce((p, q) => p + q, 0)),
    win: x.length ? r2(100 * x.filter((q) => q.net > 0).length / x.length) : 0, tTrade: r2(tStat(nets)), months: months.length,
    tMonth: r2(tm), pMonth: +pOne(tm).toFixed(4), dd: r2(dd(x)), costR: r3(mean(x.map((q) => q.costR))), finR: r3(mean(x.map((q) => q.finR))) };
}

export function study(J) {
  const lastT = J.at(-1).t, div = signals(J, 'div'), gold = signals(J, 'gold');
  const out = { variants: {}, placebo: {} };
  for (const v of ['fade', 'follow']) {
    const tr = stream(J, div, v);
    const byYear = {};
    for (const q of tr) { const y = new Date(q.t * 1000).getUTCFullYear(); (byYear[y] ||= { n: 0, R: 0 }); byYear[y].n++; byYear[y].R += q.net; }
    for (const y in byYear) byYear[y].R = r2(byYear[y].R);
    const split = {};
    for (const ev of ['high', 'low']) split[ev] = stats(tr.filter((q) => q.ev === ev), DECISIVE, lastT);
    const pl = [];
    for (let s = 1; s <= SEEDS; s++) { const st = stream(J, sample(gold, div.length, rng(s)), v); pl.push(mean(st.filter(inW(DECISIVE)).map((q) => q.net))); }
    out.placebo[v] = { p95: r3(pct(pl, 0.95)), median: r3(pct(pl, 0.5)), min: r3(Math.min(...pl)), max: r3(Math.max(...pl)), values: pl.map(r3) };
    out.variants[v] = { decisive: stats(tr, DECISIVE, lastT), replication: stats(tr, REPLICATION, lastT), decisiveBySide: split, byYear,
      exits: Object.fromEntries(['stop', 'stop-gap', 'target', 'time'].map((h) => [h, tr.filter((q) => q.how === h && inW(DECISIVE)(q)).length])) };
  }
  const h = holm(Object.fromEntries(Object.entries(out.variants).map(([k, v]) => [k, v.decisive.pMonth])));
  for (const [k, v] of Object.entries(out.variants)) {
    const d = v.decisive, rp = v.replication, plc = out.placebo[k];
    v.checks = { netPositive: d.net > 0, tMonth2: d.tMonth >= 2, holm: h[k], replicationSameSign: rp.net > 0, beatsPlacebo: d.net > plc.p95 };
    v.pass = Object.values(v.checks).every(Boolean);
  }
  out.events = { divergent: div.length, goldOnly: gold.length, divHigh: div.filter((s) => s.ev === 'high').length, divLow: div.filter((s) => s.ev === 'low').length };
  out.verdict = Object.values(out.variants).some((v) => v.pass) ? 'PASS' : 'FAIL';
  return out;
}

async function fetchAll(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), END = Math.floor(Date.now() / 1000), FROM = Date.UTC(2006, 0, 1) / 1000;
  for (const sym of ['xau', 'xag']) {
    const f = path.join(dir, `${sym}-h1.json`), part = f + '.part';
    if (fs.existsSync(f)) { console.log(`${sym}: exists`); continue; }
    const rows = fs.existsSync(part) ? JSON.parse(fs.readFileSync(part, 'utf8')) : [];
    for (let a = rows.length ? rows.at(-1)[0] + H : FROM; a < END;) {
      const b = Math.min(END, a + 4999 * H);
      let j = null;
      for (let k = 0; k < 6 && !j; k++) {
        try { const r = await fetch(`https://meridianx.dev/md/bars?sym=${sym}&tf=1h&from=${a}&to=${b}`, { signal: AbortSignal.timeout(40000) }); const x = r.ok ? await r.json() : null; if (x && Array.isArray(x.bars)) j = x; } catch {}
        if (!j) await sleep(2000 * (k + 1));
      }
      if (!j) throw new Error(`${sym} ${new Date(a * 1000).toISOString()}: no answer`);
      for (const x of j.bars) if (!x.live && x.time >= a && x.time < b) rows.push([+x.time, +x.open, +x.high, +x.low, +x.close]);
      fs.writeFileSync(part, JSON.stringify(rows)); a = b; await sleep(300);
    }
    fs.renameSync(part, f); console.log(`${sym}: ${rows.length} candles`);
  }
}

function full(dir) {
  const read = (s) => JSON.parse(fs.readFileSync(path.join(dir, `${s}-h1.json`), 'utf8'));
  const J = joinBars(read('xau'), read('xag'));
  const res = study(J);
  const out = { built: '2026-11-13', study: 'gold-silver-divergence', rule: 'stand-alone intraday rule on gold H1; not the gold book (item 44 untouched)',
    data: { src: 'OANDA mid H1 XAU_USD and XAG_USD via the site proxy, inner join', from: new Date(J[0].t * 1000).toISOString().slice(0, 16), to: new Date(J.at(-1).t * 1000).toISOString().slice(0, 16), candles: J.length },
    params: { look: LOOK, atr: ATR_N, hold: HOLD, targetR: TARGET_R, cost: COST, rollHours: ROLL_HOURS, fin: FIN.xau.long, seeds: SEEDS }, ...res };
  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'result.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify({ verdict: out.verdict, events: out.events, ...Object.fromEntries(Object.entries(out.variants).map(([k, v]) => [k, { d: v.decisive, r: v.replication, checks: v.checks, pl: out.placebo[k].p95 }])) }, null, 1));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, dir] = process.argv.slice(2);
  if (cmd === 'fetch' && dir) await fetchAll(dir); else if (cmd === 'full' && dir) full(dir); else console.log('usage: run.mjs fetch|full <dir>');
}
