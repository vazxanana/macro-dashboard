# Hikkake (a failed break of an inside day) on spot gold: result (2026-11-14)

**Verdict: FAIL, 0 of 3: the gold hikkake made −0.157R a trade net out of sample (n 69, month t −1.48), −0.172R over the every-day same-side trade (t −1.65); in sample +0.177R.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed; sha256 in `result.json`). A new stand-alone
daily rule, not a gate, exit, entry or size of the gold book (docs/owner-decisions.md item 44); nothing of that book was read.
Paper research only: nothing live changed and no proposal is written. This page is written by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- OANDA mid H1 XAU/USD, 17:00 New York days (weekend hours dropped, `gold-drd-long` `days()`), ATR(20) of daily true ranges.
- Inside day i (high below, low above the day before). Day i+1 breaks ONE side only: low under day i's low with its high not
  above day i's high = a buy setup (the break down failed); the mirror = a sell setup.
- A buy stop at day i's high + $0.30 works from the first H1 candle of day i+2 to the end of day i+4; cancelled once price
  trades at or under day i+1's low first (a candle reaching both is cancelled). **Stop = day i+1's low − $0.30 on every trade.**
- Out at the close of the 3rd day after the fill day (T1, T2) or at a 2R target first (T3); a stop gapped through fills at the
  open; the fill candle counts only against the stop. One position at a time.
- Costs: $0.60 a round trip (2x = $1.20); financing on buys = nights x FIN.xau.long (0.000148) x entry.
- T2 control: for every trade, the same-side trade entered at the first H1 open of EVERY eligible day of its calendar year with the
  same stop in ATR(20) units, the same hold, target rule and costs; excess = the trade's net R minus that mean.
- In sample 2007-01-01 to 2016-12-31, out of sample (decisive) 2017-01-01 to 2026-10-31 by entry date; t on calendar-month sums
  (every month, 0 when nothing closed); Holm over the three out-of-sample one-sided p values; placebo = 40 seeds.

Data: OANDA mid H1 XAU_USD via the site proxy (fetch.mjs), 17:00 New York days (gold-drd-long days()), 2006-03-20 to 2026-11-12 (125704 H1 candles, 5351 days).

## Results

| Test | Window | n (buys / sells) | Gross R | Measure | Value | At 2x costs | Win % | Stop / target / time | Total | Worst DD | Month t | Month t gross | Median risk $ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | IS 2007-16 | 108 (58 / 50) | +0.229 | net R | +0.177 | +0.125 | 56.48 | 29 / 0 / 79 | +19.12 | −6.19 | +1.86 | +2.37 | 19.91 |
| T1 | OOS 2017-26 | 69 (38 / 31) | −0.115 | net R | −0.157 | −0.198 | 42.03 | 26 / 0 / 43 | −10.81 | −16.23 | −1.48 | −1.10 | 27.03 |
| T2 | IS 2007-16 | 108 (58 / 50) | +0.229 | excess R | +0.214 | +0.214 | 56.48 | 29 / 0 / 79 | +23.09 | −5.80 | +2.26 | +2.37 | 19.91 |
| T2 | OOS 2017-26 | 69 (38 / 31) | −0.115 | excess R | −0.172 | −0.170 | 42.03 | 26 / 0 / 43 | −11.90 | −16.22 | −1.65 | −1.10 | 27.03 |
| T3 | IS 2007-16 | 108 (58 / 50) | +0.293 | net R | +0.242 | +0.191 | 58.33 | 28 / 12 / 68 | +26.12 | −4.09 | +2.42 | +2.90 | 19.91 |
| T3 | OOS 2017-26 | 69 (38 / 31) | −0.069 | net R | −0.110 | −0.151 | 43.48 | 25 / 3 / 41 | −7.58 | −14.90 | −1.01 | −0.64 | 27.03 |

Tests: T1 hikkake, both sides, net R (primary); T2 hikkake, both sides, net R minus the same-side trade on every day (primary); T3 hikkake, both sides, 2R target, net R.

T2 control means (net R a trade of the same-side trade on every day): IS −0.037, OOS +0.016.

## The checks

| Test | OOS value > 0 | OOS t ≥ 2 | Holm p ≤ 0.05 | IS value > 0 | OOS at 2x > 0 | Beats ≥ 38 of 40 placebos | OOS n ≥ 30 | Pass |
|---|---|---|---|---|---|---|---|---|
| T1 | no | no | no (1) | yes | no | no | yes | no |
| T2 | no | no | no (1) | yes | no | n/a | yes | no |
| T3 | no | no | no (1) | yes | no | no | yes | no |

## Placebo (out of sample, 40 seeds)

Each OOS trade is replaced by the control trade of a random eligible day of the same year (same side, stop in ATR, hold, target rule, costs). T2 has no placebo of its own (its control is the every-day mean).

| Test | Real net R a trade | Seeds beaten | Placebo median | Placebo 95th pct | Placebo min / max |
|---|---|---|---|---|---|
| T1 | −0.157 | 4 of 40 | +0.012 | +0.240 | −0.275 / +0.536 |
| T3 | −0.110 | 5 of 40 | 0.000 | +0.203 | −0.273 / +0.365 |

## Setups (reported)

Inside days 880; one-side false breaks 647 (buy 295, sell 352); filled 192; traded one at a time (T1) 180.

## Reading

- T1: in sample +0.177R a trade net (n 108, t +1.86), out of sample −0.157R (n 69, t −1.48), −0.198R at twice the costs; costs +0.025R and financing +0.017R a trade out of sample.
- T2 (the signal against gold's own drift): the trade minus the same-side trade on every day of its year, +0.214R in sample (t +2.26), −0.172R out of sample (t −1.65).
- T3 (2R target): +0.242R in sample, −0.110R out of sample (t −1.01).
- Fewer trades than the pre-registration expected (108 in sample, 69 out of sample against 120-180): 192 of 647 setups filled, most were cancelled by a trade through the false-break extreme or never reached the order. The OOS t has little power at this n; the sign, not the size, decides.
- Not an edge: nothing is proposed and nothing live changes. Do not re-fit the waiting days, buffer, hold or target on these results.
