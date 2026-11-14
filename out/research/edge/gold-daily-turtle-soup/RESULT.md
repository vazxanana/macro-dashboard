# Result: Turtle Soup (failed 20-day breaks) on spot gold daily (14 Nov 2026)

**Verdict: FAIL: the classic Turtle Soup lost −0.181R a trade net out of sample 2017-26 (n 156, month t −1.75) and −0.396R in 2007-16 (n 170, t −4.07); 0 of 3 tests pass.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit 9665d57f4). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; not a gate, exit, entry or size of the gold book. Gold trend BUYS a break of the prior 20 daily highs; this rule
fades a 20-day break that fails at once. Nothing here is a reading of Gold trend, and none is proposed.

Rule (a buy; sells mirror): on a 17:00 New York day i whose low goes below the lowest low of the 20 days before it, that
previous 20-day low made at least 3 days earlier, a buy stop at the old low + $0.30 works from the next H1 candle to the end of
day i+1 (T1); T2 (Plus One) needs day i to CLOSE below the old low and works the same stop order on day i+1 only. Stop = the
lowest low before the fill candle − $0.30; target 2R; else out at the close of the third day after the fill day. One position
at a time. Costs: $0.30 spread + $0.15 slippage on the stop-order entry and on a stop / time exit (none on a target limit),
`council/fills.mjs` `FIN.xau.long` on longs. t = calendar-month sums of net R (every month, 0 when nothing closed), Holm over
three. Data: OANDA mid H1 XAU_USD 2006-03-20 to 2026-11-12 (125,704 candles, 5,351 days; `fetch.mjs`, cache out of git).

## Tests

| Test | Window | n | Win | Stop / target / time | Gross R | Net R | Net at 2x costs | Month t (net) | Month t (gross) | Total net R | Worst DD R | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 classic Turtle Soup, both sides (primary) | OOS 2017-01 to 2026-10 | 156 | 35.26% | 99 / 47 / 10 | −0.026 | −0.181 | −0.337 | -1.75 | -0.25 | -28.3 | -32.8 | 1 |
|  | IS 2007-01 to 2016-12 | 170 | 27.65% | 117 / 36 / 17 | −0.220 | −0.396 | −0.572 | -4.07 | -2.39 | -67.34 | -69.69 |  |
| T2 Turtle Soup Plus One, both sides | OOS 2017-01 to 2026-10 | 56 | 46.43% | 28 / 19 / 9 | +0.223 | +0.153 | +0.082 | 0.89 | 1.3 | 8.55 | -5.23 | 0.5602 |
|  | IS 2007-01 to 2016-12 | 66 | 31.82% | 38 / 6 / 22 | −0.270 | −0.360 | −0.451 | -2.98 | -2.3 | -23.79 | -25.22 |  |
| T3 classic Turtle Soup, longs only | OOS 2017-01 to 2026-10 | 67 | 35.82% | 42 / 21 / 4 | +0.014 | −0.167 | −0.347 | -0.99 | 0.09 | -11.16 | -14.73 | 1 |
|  | IS 2007-01 to 2016-12 | 74 | 27.03% | 52 / 13 / 9 | −0.278 | −0.442 | −0.606 | -2.87 | -1.94 | -32.69 | -32.69 |  |

## Checks and placebo (each OOS trade moved to a random day of the same year, same side, same stop in ATR, 2R, same hold; 40 seeds)

| Test | OOS n >= 50 | OOS net > 0, t >= 2, Holm p < 0.05 | IS net > 0 | OOS net > 0 at 2x | Placebo seeds beaten (need 38) | Placebo median | Pass |
|---|---|---|---|---|---|---|---|
| T1 | yes | no | no | no | 16 of 40 | −0.161 | fail |
| T2 | yes | no | no | yes | 37 of 40 | −0.037 | fail |
| T3 | yes | no | no | no | 17 of 40 | −0.135 | fail |

## Reading
- **The classic rule is flat before costs out of sample (−0.026R, t −0.25) and loses before costs in sample (−0.220R,
  t −2.39).** The stops are tight (median $6.66 out of sample, $4.10 in sample), so $0.45-0.60 of spread and slippage is about
  0.15R a trade; that turns flat into −0.18R. It does no better than random entries with the same stops (16 of 40 seeds).
- Buys and sells both lose (T1 out of sample: buys −0.167R, n 67, t −0.99; sells −0.193R, n 89, t −1.37). Only 4 of 20 years
  are positive (2012, 2018, 2022, 2025).
- **T2 (Plus One) made +0.153R a trade out of sample (n 56, month t 0.89, Holm p 0.56) after losing −0.360R in 2007-16
  (n 66, t −2.98).** The out-of-sample plus comes from the sells (+0.300R, n 32, t 1.16); it beat 37 of 40 placebo seeds,
  one short of the bar, and is not apart from luck on its own t. It changed sign between the windows: not a finding.
- On gold, a fresh 20-day low (or high) that comes back inside its old extreme does not reverse often enough to pay for a
  stop just beyond the new extreme.

Not tested, and not to be read into this: other channel lengths, other markets, a trailing exit (Raschke's own management),
an entry on a lower-timeframe shift, the ICT version at H1 pools (`ict-concepts`). Reproduce: `node --use-env-proxy
research/edge/gold-daily-turtle-soup/fetch.mjs <dir>`, then `node research/edge/gold-daily-turtle-soup/run.mjs <dir>`.
