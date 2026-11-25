# NAS100 breakout, long: focused study (25 Nov 2026)

**Verdict: PASS on the pre-registered tests (gate and T1-T5): a CANDIDATE for a pre-registered forward record, not an edge.**
Pre-registration committed first (0caaabdb0a), one wording amendment before any result (T5), `run.mjs`, `result.json`.

Rule (the auto-researcher's lead, unchanged): OANDA NAS100 H1, long when the close beats the previous 20 highs, entry hour
14-21 UTC, close above the 200-bar average; stop 1 ATR(14), target 4R, out after 96 hours, one position at a time.

**Gate.** The engine on the full candle file (131,132 H1 bars from 2 Jan 2005) reproduces the lead exactly: A 2005-14 n 1,018
+0.1975R t 3.17; B 2015-19 n 473 +0.3695R t 3.34; C 2020 on n 645 +0.4843R t 5.06; the second implementation equals the
engine on every window at cost 0 and 4e-5. (A first run read a local 2019-on cache and the gate rightly refused it; a second
read nothing because Node's fetch needs `--use-env-proxy` here; the result is from the third, on the full file.)

| Test | Result | |
|---|---|---|
| T1 costs | at 6e-5 of price a round trip: A +0.174R, B +0.340R, C +0.464R (n 645, month t 4.86); at 1.2e-4 C +0.443R (t 4.65) | pass |
| T2 against the drift | filter-only long (same hours, same 200-bar filter, no breakout) +0.098R (n 1,856, t 2.10); 2,000 random draws of 645 filter-only entries average −0.069R, 95th percentile +0.040R; none reached the rule's +0.464R; rule minus filter-only Welch t 3.57 | pass |
| T3 plateau | 16 of 16 one-at-a-time neighbours positive in A, B and C (C from +0.21R to +0.49R) | pass |
| T4 other indices (fresh data) | US500 +0.155R (n 678, t 2.53), DE40 +0.167R (n 368, t 1.57), US30 +0.082R (t 1.02), US2000 +0.060R (t 0.84), JP225 +0.004R (t 0.04); pooled +0.095R (n 2,716, month t 2.28); 5 of 5 positive | pass |
| T5 where the R comes from | best year 2023 holds 25 % of the C total (+298.9R); best three months 21 %; max drawdown 27.6R; 2022 +0.348R (n 68) | pass |

## What it does and does not say
- The breakout itself adds something to the drift: the same long filters without it make +0.10R, with it +0.46R, and no random
  draw of the filter-only entries comes near.
- The result is not a lone setting: every neighbour (breakout length 10-50, stop 0.75-1.5 ATR, targets 2-6R, other hours, no
  trend filter) is positive in all three windows. The neighbours are not independent of each other: they share most trades.
- **The honest weak point is T4.** Other indices are the only data the rule was not chosen on, and they are positive but about
  one fifth the size of NAS100 (+0.09R pooled against +0.46R), mostly each under t 2; they also move with NAS100, so they are one
  bull market seen five times, not five confirmations. Expect the forward figure nearer +0.1R than +0.46R.
- **2026 is a negative year so far** (n 74, −0.05R, a partial year). 2005, 2006 and 2008 were negative too (−0.05R to −0.10R).
- The rule was chosen out of 118 million tries (about 8,500 chance candidates expected at the pre-registered bars); the C
  window and these tests are not independent of that choice. Costs here are an assumed 6e-5 of price, not a futures quote:
  the research ran at no cost by the owner's word, and a real futures fill has not been measured.
- The tests are before slippage on stop exits and before the margin and roll costs of a futures position.

## Next (needs the owner)
A pre-registered forward record on days from 26 Nov 2026 (as the gold and USD/JPY breakouts have), judged against month-block
bands of the 2010-26 trades; then a measured cost at the broker's quotes (`usdchf-*-exec` style). Nothing live changed.
