// Edge research · gold-release-quotes: the demo broker's gold quotes around US CPI, payrolls and FOMC (PREREGISTRATION.md).
// Part A: the quoted spread around the release minute (descriptive). Part B: N4 of the owner's news register on executable
// quotes, B1 continuation and B2 reversal from T+5 to T+60 minutes with a stop of the first five minutes' move.
//   node research/edge/gold-release-quotes/run.mjs <ticks-XAUUSD.json> [probeCommit]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const A_MARKS = [-300, -60, 5, 15, 30, 60, 300, 900, 3600];
export const ENTRY = 300, EXIT = 3600, REF = -60, GAP = 75 * 60, MIN_N = 30;
const med = (a) => { const v = a.slice().sort((x, y) => x - y), n = v.length; return n ? (n % 2 ? v[n >> 1] : (v[n / 2 - 1] + v[n / 2]) / 2) : null; };
const pct = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.min(v.length - 1, Math.floor(p * (v.length - 1) + 0.5))] : null; };
const r4 = (v) => (Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null), r6 = (v) => (Number.isFinite(v) ? +v.toPrecision(6) : null);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
export function tStat(v) { if (v.length < 2) return null; const m = mean(v), sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)); return sd > 0 ? m / (sd / Math.sqrt(v.length)) : null; }
export const normP = (t) => 0.5 * erfc(t / Math.SQRT2);
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215224 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
export function holm(ps) { const o = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]), out = Array(ps.length); let m = 0; o.forEach(([p, i], k) => { m = Math.max(m, Math.min(1, (ps.length - k) * p)); out[i] = m; }); return out; }

// the quote [bid, ask] at offset s (seconds from T) of an event, or null
export const q = (e, s) => { const i = e.marks.indexOf(s); return i >= 0 ? e.quotes[i] : null; };
const mid = (x) => (x[0] + x[1]) / 2;
// events once each: one closer than GAP to the previous kept one is dropped
export function dedupe(events) { const o = []; for (const e of [...events].sort((a, b) => a.t - b.t)) if (!o.length || e.t - o[o.length - 1].t >= GAP) o.push(e); return o; }

// one N4 trade: dir +1 continuation / -1 reversal of the first five minutes' move; { R, Rmid, stopped } or { skip }
export function trade(e, mode) {
  const a = q(e, REF), b = q(e, ENTRY), z = q(e, EXIT); if (!a || !b || !z) return { skip: 'missing quote' };
  const move = mid(b) - mid(a); if (!(Math.abs(move) > 0)) return { skip: 'no move' };
  const d = Math.sign(move) * (mode === 'reversal' ? -1 : 1), dist = Math.abs(move);
  const entry = d > 0 ? b[1] : b[0], entryMid = mid(b), stop = entry - d * dist;
  let exitPx = d > 0 ? z[0] : z[1], exitMid = mid(z), stopped = false;
  for (let s = ENTRY + 60; s < EXIT; s += 60) { const x = q(e, s); if (!x) continue; const px = d > 0 ? x[0] : x[1];
    if (d * (px - stop) <= 0) { exitPx = px; exitMid = mid(x); stopped = true; break; } }
  return { R: (d * (exitPx - entry)) / dist, Rmid: (d * (exitMid - entryMid)) / dist, stopped, type: e.type };
}

export function partA(events, profile) {
  const by = {}, all = [];
  const grp = (k) => (by[k] = by[k] || { n: 0, marks: Object.fromEntries(A_MARKS.map((s) => [s, []])), minuteT: [], hourMed: [] });
  for (const e of events) {
    for (const g of [grp(e.type), grp('ALL')]) { g.n++;
      for (const s of A_MARKS) { const x = q(e, s); if (x && x[1] >= x[0]) g.marks[s].push((x[1] - x[0]) / mid(x)); }
      const iT = e.marks.indexOf(0), wT = e.widest && e.widest[(0 - (-600)) / 60], x0 = q(e, 0); if (wT != null && x0) g.minuteT.push(wT / mid(x0));
      const h = new Date(e.t * 1000).getUTCHours(); if (profile && profile[h] && profile[h].frac != null) g.hourMed.push(profile[h].frac); void iT; }
    all.push(e);
  }
  const out = {};
  for (const [k, g] of Object.entries(by)) out[k] = { n: g.n, hourMedianFrac: r6(med(g.hourMed)), minuteTWidest: { median: r6(med(g.minuteT)), p90: r6(pct(g.minuteT, 0.9)) },
    marks: Object.fromEntries(A_MARKS.map((s) => [s, { n: g.marks[s].length, median: r6(med(g.marks[s])), p90: r6(pct(g.marks[s], 0.9)) }])) };
  return out;
}

export function partB(events) {
  const res = {};
  for (const mode of ['continuation', 'reversal']) {
    const tr = events.map((e) => trade(e, mode)), ok = tr.filter((x) => !x.skip), R = ok.map((x) => x.R), noF = ok.filter((x) => x.type !== 'FOMC').map((x) => x.R);
    const t = tStat(R);
    res[mode] = { n: ok.length, skipped: tr.length - ok.length, meanR: r4(R.length ? mean(R) : NaN), t: r4(t), meanRmid: r4(ok.length ? mean(ok.map((x) => x.Rmid)) : NaN), tMid: r4(tStat(ok.map((x) => x.Rmid))),
      stopped: ok.filter((x) => x.stopped).length, won: ok.filter((x) => x.R > 0).length, noFomcMeanR: r4(noF.length ? mean(noF) : NaN), noFomcN: noF.length, p: t == null ? null : r4(normP(t)) };
  }
  const adj = holm([res.continuation.p ?? 1, res.reversal.p ?? 1]);
  for (const [i, mode] of ['continuation', 'reversal'].entries()) { const x = res[mode]; x.pHolm = r4(adj[i]);
    x.verdict = x.n < MIN_N ? 'TOO FEW' : x.meanR > 0 && adj[i] < 0.05 && x.noFomcMeanR > 0 ? 'PASS' : 'FAIL'; }
  return res;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [file, commit] = process.argv.slice(2), P = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ev = dedupe((P.events || []).filter((e) => Array.isArray(e.marks)));
  const A = partA(ev, P.hourProfile), B = partB(ev);
  const verdict = `B1 continuation ${B.continuation.verdict} (n ${B.continuation.n}, ${B.continuation.meanR}R a trade, t ${B.continuation.t}); B2 reversal ${B.reversal.verdict} (n ${B.reversal.n}, ${B.reversal.meanR}R, t ${B.reversal.t})`;
  const out = { study: 'gold-release-quotes', built: new Date().toISOString().slice(0, 10), probe: { at: P.at, commit: commit || null, reachDays: P.reachDays }, events: ev.length,
    byType: ev.reduce((m, e) => ((m[e.type] = (m[e.type] || 0) + 1), m), {}), from: ev[0] && ev[0].at, to: ev.length ? ev[ev.length - 1].at : null, partA: A, partB: B, verdict };
  fs.writeFileSync(path.join(HERE, 'result.json'), JSON.stringify(out, null, 1));
  console.log(verdict);
}
