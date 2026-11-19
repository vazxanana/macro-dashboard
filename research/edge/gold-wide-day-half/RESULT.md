# Result: a limit at the midpoint of a wide gold day, traded with that day's direction (14 Nov 2026)

**Verdict: FAIL: 0 of 3 tests pass; buying the midpoint of a wide up day made +0.094R a trade net in 2017-26 (n 91, month t 0.98); best OOS t 0.98.**

Pre-registered in PREREGISTRATION.md (pushed alone first). The test ran once; nothing was changed after the result. Paper research:
nothing live changed and no proposal follows. **Item 44**: a new stand-alone daily rule judged on 2017-26; it is not a gate,
exit, entry or size of the gold book (Gold trend / Gold daily engulf) and says nothing about it. This page is written by
`run.mjs` from `result.json`.

## Data and rule
OANDA mid daily XAU_USD, council-data `research/daily/xau.json` (git show, no network), 2006-03-20 to 2026-11-13, weekend
candles folded into the next weekday (`foldWeekend`): 5,369 trading days. A wide day: range >= 1.25 x ATR(14) of the 14 days
before, close in the outer third in its direction. A limit at the wide day's midpoint, live three days; filled at the open
when the day opens through it. Stop 1.5 x ATR(14) from the fill, out at the close of the 5th day held. One position or
waiting limit at a time. Costs $0.60 a round trip plus `FIN.xau.long` financing on buys (`nights` x 0.000148 of price).
t = calendar-month sums (every month counts), one-sided, Holm over three. Excess = each trade's net R minus the same-side
every-day baseline's net R a trade in the same year (baseline: market at the open, same stop and hold).

## The three tests (R a trade)

| Test | IS n | IS gross | IS net | IS t | OOS n | OOS gross | OOS net | OOS t | Holm p | OOS net 2x | Excess | Excess t | Placebo beaten | Pass |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 98 | +0.115 | +0.053 | 0.62 | 91 | +0.161 | +0.094 | 0.98 | 0.4935 | +0.028 | +0.003 | 0.03 | 25 of 40 | no |
| T2 | 109 | -0.031 | -0.054 | -0.68 | 106 | -0.219 | -0.239 | -2.94 | 1 | -0.259 | -0.105 | -1.31 | 1 of 40 | no |
| T3 | 161 | +0.060 | +0.020 | 0.29 | 148 | -0.047 | -0.090 | -1.27 | 1 | -0.132 | -0.079 | -1.13 | 9 of 40 | no |

- **T1** (buy the midpoint after a wide up day, hold 5 days): 532 wide days, 196 limits filled, 172 expired unfilled. OOS halves +0.011 / +0.180R;
  exits stop 25, gap 0, time 66; OOS costs 1.754R spread + 4.301R financing; placebo median +0.060, max +0.357.
- **T2** (sell the midpoint after a wide down day, hold 5 days): 505 wide days, 223 limits filled, 126 expired unfilled. OOS halves -0.243 / -0.233R;
  exits stop 37, gap 1, time 68; OOS costs 2.118R spread + 0R financing; placebo median -0.107, max +0.124.
- **T3** (both sides pooled, one position at a time, hold 5 days): 1037 wide days, 321 limits filled, 230 expired unfilled. OOS halves -0.113 / -0.065R;
  exits stop 51, gap 0, time 97; OOS costs 2.785R spread + 3.481R financing; placebo median -0.022, max +0.179.

## Baseline (same side, every day, market at the open)

- Buy: IS -0.004R (n 589), OOS +0.060R (n 572, t 1.42).
- Sell: IS -0.068R (n 586), OOS -0.131R (n 590, t -3.48).

## Reading

No test met the pre-registered bar. Not an edge; never use the wide-day midpoint as a gold entry on this evidence.

Counts: the pre-registration counted fills before the one-at-a-time rule (143 / 144 up, 165 / 137 down); after it T1 has 98 / 91
trades and T2 109 / 106 (in / out of sample), so T1 sits just under 100 a window.
T2 lost clearly out of sample (t -2.94); its mirror (buying after a wide down day) was not pre-registered and is not a finding.
