// D1 ADX(14), the exact computation of the regime research (research/edge/regime/replay.mjs, dailyFeatures): true range,
// Wilder-smoothed +DM / -DM / TR over 14, DX, then ADX = 14-period average of DX followed by Wilder smoothing.
// Used only to TAG Swing signals (feat.adx / feat.adxBand, paper sleeve "swing-adx"); no rule, filter or Coach step reads it.
function trs(B) { return B.map((b, i) => i ? Math.max(b.high - b.low, Math.abs(b.high - B[i - 1].close), Math.abs(b.low - B[i - 1].close)) : b.high - b.low); }
function wilder(x, n) { const o = new Array(x.length).fill(null); let s = 0; for (let i = 0; i < x.length; i++) { if (i < n) { s += x[i]; if (i === n - 1) o[i] = s / n; } else o[i] = (o[i - 1] * (n - 1) + x[i]) / n; } return o; }
export function adxSeries(D) {
  const n = D.length, tr = trs(D);
  const up = D.map((b, i) => i ? Math.max(b.high - D[i - 1].high, 0) : 0), dn = D.map((b, i) => i ? Math.max(D[i - 1].low - b.low, 0) : 0);
  const pdm = up.map((u, i) => u > dn[i] ? u : 0), mdm = dn.map((d, i) => d > up[i] ? d : 0);
  const sTR = wilder(tr, 14), sP = wilder(pdm, 14), sM = wilder(mdm, 14);
  const dx = D.map((_, i) => sTR[i] ? (() => { const p = 100 * sP[i] / sTR[i], m = 100 * sM[i] / sTR[i]; return p + m ? 100 * Math.abs(p - m) / (p + m) : 0; })() : null);
  const adx = new Array(n).fill(null); { let s = 0, k = 0; for (let i = 0; i < n; i++) { if (dx[i] == null) continue; if (k < 14) { s += dx[i]; k++; if (k === 14) adx[i] = s / 14; } else adx[i] = (adx[i - 1] * 13 + dx[i]) / 14; } }
  return adx;
}
// the research band (research/edge/regime/proposal.md: 19.4-29.2; OOS 2024-26 +0.290R a trade over 67, t 1.46: inconclusive, paper only)
export const ADX_BAND = [19.4, 29.2];
// ADX(14) of the last CLOSED daily candle at unix time t: a candle counts once its open time + 1 day <= t (the forming one is dropped)
export function d1AdxFeat(bars, t) {
  const D = (bars || []).filter((b) => b.time + 86400 <= t);
  const a = D.length >= 30 ? adxSeries(D).at(-1) : null;
  if (a == null || !isFinite(a)) return { adx: null, adxBand: null };
  return { adx: +a.toFixed(2), adxBand: a >= ADX_BAND[0] && a <= ADX_BAND[1] };
}
