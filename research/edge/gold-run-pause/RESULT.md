# Result: gold after a run of daily closes broken by one opposite close (14 Nov 2026)

**Verdict: FAIL, 0 of 3: buying the first down close after 3+ up closes made +0.051R a trade net 2017-26 (n 174, month t 0.77), −0.009R under buying any day; 13 of 40 controls beaten.**

Pre-registered in PREREGISTRATION.md (pushed alone first, commit a8105e79b). The test ran once; nothing was changed after the
result. Paper research: nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on
2017-26; it is not a gate, exit, entry or size of the gold book (Gold trend / Gold daily engulf) and reads none of its positions.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (`git show`, no network), 2006-03-20 to 2026-11-13, weekend
candles folded into the next weekday (`council/fills.mjs` `foldWeekend`): 5,369 trading days. Signal day = the first opposite
close after a run of 3 or more closes one way (an equal close ends a run). Entry at the next open, stop 2 x ATR(14) on the
losing side (gap through it exits at the open), out at the close of the fifth trading day; one position at a time per test.
Costs: $0.60 a round trip and, on buys, `nights` x `FIN.xau.long` (0.000148 of price a rollover) x entry. t = calendar-month
sums of net R (every month counts), one-sided, Holm over three. Signal days (before the one-position rule): up-run pauses IS
172 / OOS 185; down-run pauses IS 137 / OOS 124 (126 when the count ran to the end of 2026 for the pre-registration; the OOS
window ends 31 Oct 2026).

## Tests (R a trade; IS 2007-16, OOS 2017-01 to 2026-10)
| Test | Window | n | Gross | Net | Month t (net) | Same-side baseline net | Excess (Welch t) | Net at 2x costs | Holm p | Placebo beaten | Control beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy after 3+ up closes broken by one down close | IS | 162 | +0.007 | −0.042 | −0.71 | −0.001 | −0.041 (−0.66) |  |  |  |  |  |
|  | OOS | 174 | +0.104 | +0.051 | 0.77 | +0.061 | −0.009 (−0.15) | −0.002 | 0.665 | 35 of 40 | 13 of 40 | no |
| T2 sell after 3+ down closes broken by one up close | IS | 127 | +0.145 | +0.129 | 1.90 | −0.061 | +0.190 (2.81) |  |  |  |  |  |
|  | OOS | 117 | +0.023 | +0.009 | 0.13 | −0.108 | +0.117 (1.67) | −0.005 | 0.894 | 29 of 40 | 39 of 40 | no |
| T3 buy after 3+ down closes broken by one up close | IS | 135 | −0.130 | −0.175 | −2.67 | −0.001 | −0.173 (−2.73) |  |  |  |  |  |
|  | OOS | 119 | −0.004 | −0.055 | −0.85 | +0.061 | −0.116 (−1.79) | −0.107 | 0.894 | 16 of 40 | 2 of 40 | no |

Baselines (same side, stop, hold and costs entered after every trading day, overlapping, not a test): buy IS −0.001R net
(+0.047R gross, n 2,602), OOS +0.061R net (+0.113R gross, n 2,552); sell IS −0.061R, OOS −0.108R.
Placebo = the same OOS trade days with the side drawn at random (median −0.029R T1, −0.026R T2 / T3); control = the same
number of trades per year on random trading days of that year, same side (median +0.077R T1, −0.097R T2, +0.031R T3).

## Reading
- **T1 (primary) fails every line.** Buying the first dip of an up-run made +0.051R net out of sample only because gold rose:
  buying any day made +0.061R, and random days of the same years beat the rule in 27 of 40 draws. In sample it lost
  (−0.042R). The "pause inside a run" carries no information for a buyer.
- **T2 is the one figure worth naming, and it is not a pass.** Selling the first up close after a fall beat selling on any day
  in both windows (excess +0.190R, Welch t 2.81 in sample; +0.117R, t 1.67 out of sample; 39 of 40 controls beaten), but that
  excess is mostly relief from gold's drift being absent on those days: the trade itself made +0.009R net out of sample
  (month t 0.13), lost at twice the costs, and did not beat the random-side placebo (29 of 40). A short on gold after a
  falling run is still a short against gold's drift. Not an edge; nothing follows from it without a new pre-registration on
  other data.
- **T3 is the same days read the other way and it loses**: the first up close after a fall does not mark a turn (IS −0.175R,
  t −2.67; OOS −0.055R).
- Exits mostly by time (T1 145 of 174, T2 99 of 117, T3 101 of 119). OOS costs: T1 2.5R spread + 6.8R financing; T2 1.6R;
  T3 1.7R + 4.5R.
- Not an edge, no proposal; nothing live changed.

## Files
`run.mjs` (`fetch <dir>`, then `full <dir>`; the candle copy stays out of git and was deleted), `result.json` (every figure
above, years, placebo and control draws, checks), test `tests/gold-run-pause.test.mjs`.
