// The trader's M15 CHoCH, shared by the backtest and the live Trader. In the trader's words (2 Nov): "M15 CHoCH is a
// sign to enter: it tells when the trend is changing, or we move from pullback/retracement to continuation and vice
// versa." Gold, 2 Nov: the pullback 3,918 -> lower high 3,905 -> 3,891, then an M15 close back above 3,905 ended it
// and the buy ran to 3,965. (The engine's VR confirmation only counts swings beyond the break level, so a straight
// drop like that never confirms; its structure flip came only at the 13:30 breakout.)
const atr = (bars, n = 14) => { const b = bars.slice(-n - 1); let s = 0; for (let i = 1; i < b.length; i++) s += Math.max(b[i].high - b[i].low, Math.abs(b[i].high - b[i - 1].close), Math.abs(b[i].low - b[i - 1].close)); return b.length > 1 ? s / (b.length - 1) : 0; };

// the trader's M15 CHoCH on one side: the leg, the level, and the closed candle that closed through it (iC, or -1)
export function m15Choch(B, sell) {
  const n = B.length, L = 48;
  if (n < L + 5) return null;
  const piv = (j, hi) => { for (let k = 1; k <= 2; k++) { if (j - k < 0 || j + k > n - 2) return false; if (hi ? (B[j - k].high > B[j].high || B[j + k].high >= B[j].high) : (B[j - k].low < B[j].low || B[j + k].low <= B[j].low)) return false; } return true; };
  const x = (b) => sell ? b.high : -b.low, y = (b) => sell ? -b.low : b.high;
  // the leg: from the last 12 h's high (low), closed candles, to the lowest low (highest high) after it: the pullback
  // the CHoCH ends (2 Nov: 3,918 at 05:45 -> 3,891 at 08:00; Sunday's lower open is before the high and doesn't count)
  let iS = n - 2; for (let j = n - 2; j >= n - 1 - L; j--) if (y(B[j]) > y(B[iS])) iS = j;
  let iE = iS; for (let j = iS + 1; j <= n - 2; j++) if (x(B[j]) > x(B[iE])) iE = j;
  const ext = sell ? B[iE].high : B[iE].low, legH = Math.abs((sell ? B[iS].low : B[iS].high) - ext);
  if (iS === iE || legH < 2 * atr(B)) return { leg: false };
  // the last swing against the leg before its extreme: the lower high (higher low) a CHoCH closes through
  let iP = -1; for (let j = iE - 1; j > iS; j--) if (piv(j, !sell)) { iP = j; break; }
  const lvl = iP >= 0 ? (sell ? B[iP].low : B[iP].high) : (sell ? B[iS].low : B[iS].high);
  let iC = -1; for (let j = iE + 1; j <= n - 2; j++) if (sell ? B[j].close < lvl : B[j].close > lvl) { iC = j; break; }
  return { leg: true, iS, iE, iP, iC, ext, lvl };
}
// every signal: did the trader's M15 CHoCH in its direction close within the last hour (4 M15 candles)?
export const m15cFeat = (B, sell, t) => { const c = m15Choch(B, sell); return c && c.leg && c.iC >= 0 && t - (B[c.iC].time + 900) <= 4 * 900 ? 'yes' : 'no'; };
