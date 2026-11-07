// The pre-registered trend-side gate (preregistration.md), shared by run.mjs and replaycheck.mjs. D = daily candles stamped so that
// time + 86400 = the candle's close (dailyNY() / the tracker's D). The candle read is the last one closed before the signal's H1
// close, the same candle signals() uses for the 50-day bias.
export const SMA_N = 200;
// true = that close is below the simple average of the last 200 daily closes up to and including it; null = fewer than 200 closes
export function belowSma(g, D) {
  const di = D.findLastIndex((d) => d.time + 86400 <= g.close); if (di < SMA_N - 1) return null;
  let s = 0; for (let k = di - SMA_N + 1; k <= di; k++) s += D[k].close;
  return D[di].close < s / SMA_N;
}
// index A-setups: buys always pass; a sell passes only when belowSma() is true (unknown = not taken)
export const passes = (g, D) => g.side > 0 || belowSma(g, D) === true;
