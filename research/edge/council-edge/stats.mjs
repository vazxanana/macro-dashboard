// Council edge · pure statistics for a list of trade results in R (no I/O). Used by breakdown.mjs and walkforward.mjs,
// tested in tests/council-edge.test.mjs.
//   summarize(rs)  -> { n, wins, losses, win, winLo, winHi, mean, sd, se, t, lo, hi, total, maxDD, pf, neg }
//     win / winLo / winHi: win rate (R > 0) with its Wilson 95% interval
//     mean / lo / hi: expectancy in R a trade with a 95% Student-t interval; t = mean / se
//     maxDD: worst peak-to-trough fall of the running total, in R, in the order given (<= 0)
//     neg: "statistically negative" = the 95% interval of the mean lies wholly below 0 (needs n >= 5)
//   groupBy(rows, keyFn) -> Map key -> rows, keys in first-seen order
//   pairedDiff(a, b) -> summarize(a[i] - b[i]) for two equal-length results on the same trades

// two-sided 97.5% Student-t quantile for df degrees of freedom (table to 30, then the normal limit with a small correction)
const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
export const tq = (df) => df < 1 ? NaN : df <= 30 ? T975[df] : 1.96 + 2.4 / df;

export function wilson(k, n, z = 1.96) {
  if (!(n > 0)) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

export function maxDrawdown(rs) {
  let run = 0, peak = 0, dd = 0;
  for (const r of rs) { run += r; if (run > peak) peak = run; if (run - peak < dd) dd = run - peak; }
  return dd;
}

const r3 = (v) => Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null;

export function summarize(rs) {
  const a = rs.filter(Number.isFinite), n = a.length;
  const total = a.reduce((s, v) => s + v, 0), mean = n ? total / n : NaN;
  const sd = n > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : NaN;
  const se = n > 1 ? sd / Math.sqrt(n) : NaN, t = se > 0 ? mean / se : NaN, q = tq(n - 1);
  const wins = a.filter((v) => v > 0).length, losses = a.filter((v) => v < 0).length, [wl, wh] = wilson(wins, n);
  const gw = a.filter((v) => v > 0).reduce((s, v) => s + v, 0), gl = -a.filter((v) => v < 0).reduce((s, v) => s + v, 0);
  const lo = mean - q * se, hi = mean + q * se;
  return { n, wins, losses, win: r3(n ? wins / n : NaN), winLo: r3(wl), winHi: r3(wh), mean: r3(mean), sd: r3(sd), se: r3(se), t: r3(t),
    lo: r3(lo), hi: r3(hi), total: r3(total), maxDD: r3(maxDrawdown(a)), pf: gl > 0 ? r3(gw / gl) : null, neg: n >= 5 && hi < 0 };
}

export function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

export function pairedDiff(a, b) {
  if (a.length !== b.length) throw new Error('pairedDiff: lengths differ');
  return summarize(a.map((v, i) => v - b[i]));
}

// the session a UTC time falls in, as the council names them (trader.mjs feat.session): asia 00-07, london 07-12, overlap 12-16,
// newyork 16-21, late 21-24 UTC
export function sessionOf(t) {
  const h = new Date(t * 1000).getUTCHours();
  return h < 7 ? 'asia' : h < 12 ? 'london' : h < 16 ? 'overlap' : h < 21 ? 'newyork' : 'late';
}

// hold time bucket from seconds
export function holdBucket(sec) {
  if (!Number.isFinite(sec) || sec < 0) return null;
  const h = sec / 3600;
  return h < 1 ? '< 1 h' : h < 4 ? '1-4 h' : h < 12 ? '4-12 h' : h < 48 ? '12-48 h' : '>= 48 h';
}
