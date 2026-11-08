// Edge research · gold-systems-oos: pre-declared diagnostic (not part of the verdict). A random-entry control for the two
// trend legs: the same run loop, 2 ATR chandelier, daily ratchet and +1R add as replay.mjs, but the entry is a coin flip on the
// first run of each new day while the leg is flat (probability = the real leg's entries / its flat days in the OOS window).
// The real-rule path of the same function is checked against replay.mjs's legs first (identical R), so the control differs from
// the real leg only in when it enters.
//   CANDLES=<dir> node control.mjs <replay trades.json> [seeds=1000] > control.json
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { stopFill, exitR, spotSkip } from '../../../council/fills.mjs';

const [REP, SEEDS = '1000'] = process.argv.slice(2);
const DIR = process.env.CANDLES;
const load = (tf) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, `xau-${tf}.json.gz`)))).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
const M5 = load('5m'), D1 = load('1d'), NM = M5.length;
const SKIP = new Uint8Array(NM); for (let i = 0; i < NM; i++) SKIP[i] = spotSkip(M5[i].time) ? 1 : 0;
const fx = (v) => +v.toFixed(2), COST = 0.30;
const T0 = Date.parse('2006-07-01T00:00:00Z') / 1000, T1 = Date.parse('2018-01-01T00:00:00Z') / 1000;
const tr14 = (i) => Math.max(D1[i].high - D1[i].low, Math.abs(D1[i].high - D1[i - 1].close), Math.abs(D1[i].low - D1[i - 1].close));
const ATR = new Float64Array(D1.length); for (let i = 14; i < D1.length; i++) { let a = 0; for (let j = i - 13; j <= i; j++) a += tr14(j); ATR[i] = a / 14; }
// closed daily count at each run (c = M5 close)
const ND = new Int32Array(NM); { let p = 0; for (let j = 0; j < NM; j++) { const c = M5[j].time + 300; while (p < D1.length && D1[p].time + 86400 <= c) p++; ND[j] = p; } }
const jFrom = M5.findIndex((b) => b.time >= T0 - 86400 * 30), jTo = M5.findIndex((b) => b.time >= T1 + 86400 * 400);

function manage(tr, i) {   // replay.mjs manage(), for a market-entry leg with no target / time exit / trail
  const b = M5[i]; if (SKIP[i]) return;
  if (b.low <= tr.stop) { const px = stopFill(b, false, tr.stop, b.time > tr.filled), gapped = px !== tr.stop;
    tr.R = tr.trailMoved ? exitR(false, tr.entry, px, tr.r0) : gapped ? exitR(false, tr.entry, px, tr.r0) : -1; tr.closed = b.time; tr.done = true; }
}
// one trend leg over [jFrom, jTo): enter(j, nd, last) -> true to buy at this run while flat
function runLeg(N, enter) {
  const pos = []; let open = null, add = null, flatDays = 0, lastND = -1;
  for (let j = jFrom; j < jTo && j < NM - 1; j++) {
    const c = M5[j].time + 300, now = c + 240;
    for (const tr of [open, add]) if (tr && !tr.done) { for (let i = tr.ptr; i <= j && !tr.done; i++) { manage(tr, i); tr.ptr = i + 1; } if (tr.ptr <= j) tr.ptr = j + 1; }
    if (open && open.done && (!add || add.done)) { pos.push({ t: open.filled, c: Math.max(open.closed, add ? add.closed : 0), legs: [open, add].filter(Boolean) }); open = null; add = null; }
    else if (open && open.done) { /* the add is still open: live keeps managing it, but no new entry (find() sees the add as open) */ }
    const nd = ND[j]; if (nd < 40) continue;
    const hasEntry = M5[j + 1].time === c, price = hasEntry ? M5[j + 1].close : M5[j].close, last = D1[nd - 1];
    const canEnter = hasEntry && now >= T0 && now < T1;
    const live = open && !open.done ? open : add && !add.done ? add : null;
    if (live) {
      if (last.time > (live.lastD || 0)) { const ns = fx(last.close - 2 * ATR[nd - 1]);
        for (const tr of [open, add]) if (tr && !tr.done && ns > tr.stop) { tr.stop = ns; tr.trailMoved = true; }
        live.lastD = last.time; if (add) add.lastD = last.time;
        if (live === open && !add && last.close - open.entry >= open.r0 && hasEntry) { const ae = fx(price), rA = ae - open.stop;
          if (rA > 0) add = { entry: ae, stop: open.stop, r0: rA, filled: now, ptr: j + 2, lastD: last.time }; } }
      continue;
    }
    if (nd !== lastND) { lastND = nd; if (now - (last.time + 86400) < 86400 && canEnter) flatDays++; }
    if (canEnter && now - (last.time + 86400) < 86400 && enter(j, nd, last)) {
      const A = ATR[nd - 1], entry = fx(price), stop = fx(entry - 2 * A), r0 = entry - stop;
      if (r0 > 0) { open = { entry, stop, r0, filled: now, ptr: j + 2, lastD: last.time, day: last.time }; add = null; }
    }
  }
  if (open) pos.push({ t: open.filled, c: Infinity, legs: [open, add].filter(Boolean), open: true });
  return { pos: pos.filter((p) => p.t >= T0 && p.t < T1 && !p.open), flatDays };
}
const netOf = (p) => p.legs.reduce((a, x) => a + x.R - COST / x.r0, 0);
const rep = JSON.parse(fs.readFileSync(REP, 'utf8'));
const out = {};
for (const [k, N] of [['gtrend', 20], ['gtrend5', 5]]) {
  // the real rule through this function, checked against replay.mjs
  const used = new Set();
  const real = runLeg(N, (j, nd, last) => { const id = last.time; if (used.has(id)) return false; const hi = Math.max(...D1.slice(nd - 1 - N, nd - 1).map((b) => b.high)); if (last.close > hi && ATR[nd - 1] > 0) { used.add(id); return true; } return false; });
  const R1 = rep.filter((x) => x.k === k && !x.addOf && x.opened >= T0 && x.opened < T1);
  const same = R1.length === real.pos.length && R1.every((x, i) => Math.abs(x.R - real.pos[i].legs[0].R) < 0.011 && Math.abs(x.entry - real.pos[i].legs[0].entry) < 0.011);
  if (process.env.DUMP) for (const p of real.pos) console.error(k, new Date(p.t * 1000).toISOString().slice(0, 16), p.legs.map((x) => `${x.entry}/${x.R}`).join(' '), netOf(p).toFixed(3));
  const realMean = real.pos.reduce((a, p) => a + netOf(p), 0) / real.pos.length;
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  // one coin flip per signal day (the real rule also acts at most once per day)
  const coin = (p) => { const dec = new Map(); return (j, nd, last) => { if (!dec.has(last.time)) dec.set(last.time, rnd() < p); const d = dec.get(last.time); dec.set(last.time, false); return d; }; };
  const runSeeds = (p, S, s0) => { const means = [], counts = []; for (let s = 0; s < S; s++) { seed = s0 + s * 7919; const r = runLeg(N, coin(p)); if (r.pos.length) { means.push(r.pos.reduce((a, q) => a + netOf(q), 0) / r.pos.length); counts.push(r.pos.length); } } return { means, counts }; };
  // random entries are stopped sooner, leaving more flat days: a 50-seed pilot rescales the coin so the median count matches the real leg
  let prob = real.pos.length / real.flatDays;
  { const pc = runSeeds(prob, 50, 777).counts.sort((a, b) => a - b); prob *= real.pos.length / pc[pc.length >> 1]; }
  const { means, counts } = runSeeds(prob, +SEEDS, 1000);
  means.sort((a, b) => a - b);
  const pct = means.filter((m) => m < realMean).length / means.length;
  out[k] = { checkedAgainstReplay: same, realN: real.pos.length, realMeanNet: +realMean.toFixed(3), flatDays: real.flatDays, prob: +prob.toFixed(4), seeds: means.length,
    controlMeanNet: { p5: +means[Math.floor(0.05 * means.length)].toFixed(3), median: +means[Math.floor(0.5 * means.length)].toFixed(3), p95: +means[Math.floor(0.95 * means.length)].toFixed(3), mean: +(means.reduce((a, b) => a + b, 0) / means.length).toFixed(3) },
    controlN: { median: counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)] }, realPercentile: +(100 * pct).toFixed(1) };
  console.error(k, JSON.stringify(out[k]));
}
console.log(JSON.stringify(out, null, 1));
