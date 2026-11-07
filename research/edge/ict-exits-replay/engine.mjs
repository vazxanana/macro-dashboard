// Exit engine on a per-trade series of sub-bars in R units (sign-adjusted): {hi, lo, cl, h (H1 candle index from 0), last (last sub-bar of its H1 candle)}.
// Order per sub-bar, as the replay: stop first, then partial / target, then MFE -> break-even -> trail; H1-close rules at the candle's last sub-bar.
export function sim(B, isIdx, v) {
  const beAt = v.be === undefined ? (isIdx ? 1.5 : null) : (v.be && typeof v.be === 'object') ? (isIdx ? v.be.idx : v.be.gold) : v.be;
  const trail = v.trail === undefined ? [2, 1.5] : v.trail, hold = v.hold || 36;
  let stop = -1, mfe = 0, pos = 1, R = 0, exit = null, moved = false, be = false;
  const swings = [], hc = []; let cur = null;
  for (let i = 0; i < B.length; i++) { const b = B[i];
    if (b.lo <= stop) { R += pos * stop; exit = moved ? 'trail' : be ? 'be' : 'stop'; pos = 0; break; }
    if (v.partial && pos === 1 && b.hi >= v.partial.at) { R += v.partial.frac * v.partial.at; pos = 1 - v.partial.frac; if (stop < 0) { stop = 0; be = true; } }
    if (v.target && b.hi >= v.target) { R += pos * v.target; pos = 0; exit = 'target'; break; }
    mfe = Math.max(mfe, b.hi);
    if (beAt != null && !be && mfe >= beAt && stop < 0) { stop = 0; be = true; }
    if (trail && mfe >= trail[0]) { const ns = mfe - trail[1]; if (ns > stop) { stop = ns; moved = true; } }
    if (!cur || cur.h !== b.h) cur = { h: b.h, hi: b.hi, lo: b.lo, cl: b.cl }; else { cur.hi = Math.max(cur.hi, b.hi); cur.lo = Math.min(cur.lo, b.lo); cur.cl = b.cl; }
    if (b.last) { hc.push(cur); cur = null;
      if (v.struct) { const n = v.struct.piv, j = hc.length - 1 - n;
        if (j >= n) { let ok = true; for (let q = j - n; q <= j + n; q++) if (hc[q].lo < hc[j].lo) { ok = false; break; } if (ok) swings.push(hc[j].lo); }
        if (mfe >= v.struct.from && swings.length) { const ns = swings.at(-1) - (v.struct.buf || 0); if (ns > stop) { stop = ns; moved = true; } } }
      if (v.timeStop && hc.length === v.timeStop.n && mfe < v.timeStop.need) { R += pos * b.cl; pos = 0; exit = 'tstop'; break; }
      if (hc.length >= hold) { R += pos * b.cl; pos = 0; exit = 'time'; break; } }
  }
  if (pos > 0) return null;   // the data does not cover the window
  return { R, exit, mfe };
}

// the 7 variants of the study (live first); STRUCT_GRID only for the robustness check of the one candidate
export const VARIANTS = {
  live: {},
  be1: { be: { idx: 1.0, gold: null } },
  nobe: { be: null },
  half1: { partial: { at: 1, frac: 0.5 } },
  half2: { partial: { at: 2, frac: 0.5 } },
  tgt3: { target: 3 },
  tstop12: { timeStop: { n: 12, need: 1 } },
  struct: { struct: { from: 2, piv: 2 }, trail: null },
};
export const STRUCT_GRID = {};
for (const from of [1.5, 2, 2.5, 3]) for (const piv of [1, 2, 3]) STRUCT_GRID[`st_f${from}_p${piv}`] = { struct: { from, piv }, trail: null };
STRUCT_GRID['st_f2_p2_keeptrail'] = { struct: { from: 2, piv: 2 } };   // structure OR the 1.5R trail, whichever is tighter

export function stats(a) {
  const n = a.length; if (!n) return { n: 0 };
  const m = a.reduce((q, y) => q + y, 0) / n, sd = Math.sqrt(a.reduce((q, y) => q + (y - m) ** 2, 0) / Math.max(1, n - 1));
  let eq = 0, pk = 0, dd = 0; for (const y of a) { eq += y; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }
  return { n, win: +(100 * a.filter((y) => y > 0).length / n).toFixed(1), exp: +m.toFixed(3), R: +(m * n).toFixed(1), dd: +dd.toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
export function paired(a, b) {   // mean and t of a - b
  const d = a.map((x, i) => x - b[i]), n = d.length, m = d.reduce((q, y) => q + y, 0) / n, sd = Math.sqrt(d.reduce((q, y) => q + (y - m) ** 2, 0) / Math.max(1, n - 1));
  return { perTrade: +m.toFixed(3), total: +(m * n).toFixed(1), t: sd > 0 ? +(m / (sd / Math.sqrt(n))).toFixed(2) : 0 };
}
