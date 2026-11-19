# Pre-registration: gold's move that its three usual drivers do not explain (14 Nov 2026)

Written and pushed alone, before any number of this study was computed. Paper research only: a **stand-alone rule on gold**,
not a gate, entry, exit or size of the live gold book; it does not use the book's 2006-17 positions or window (owner decision
44). Nothing live changes and no proposal follows from it.

## The idea, and why it is not one already tested

Gold's daily return is in good part explained by three liquid markets: the dollar (EUR/USD), US Treasury prices (the 10-year
note CFD) and US equities (the S&P 500 CFD). The part of gold's move that a rolling regression on those three does NOT explain
(the residual) is either noise that later comes back, or news that gold priced first and keeps. This study asks whether a
large residual over a week reverses (or continues) over the next days to weeks.

It is different from the studies already in the repository and on the branches: `gold-dollar-divergence` (one day, gold and
the dollar moving the same way, long only), `gold-bond-lead` (bond up-week that gold lagged), `gold-haven-catchup`,
`gold-silver-divergence`, `copper-gold` and the ratio studies each read ONE other market by sign or ratio; none fits a
multi-factor regression and none trades both sides of a residual. The signal is built to separate itself from gold's drift:
the regression has an intercept (gold's own trend over the fit window is taken out), the trades are both-sided, and the primary
test is measured against the same-side every-day baseline (below), so a rule that only rides gold's rise scores zero.

## Data (named before any result)

- Council-data daily candles (OANDA mid, UTC days): `research/daily/xau.json` (gold), `eurusd.json`, `usb10y.json`,
  `spx500.json`. Read with `git show origin/council-data:…`, no network. Weekend candles folded into the next weekday with
  `council/fills.mjs` `foldWeekend`, complete days only. Days are joined on gold's day; a day missing in any of the four is
  dropped from the regression and signal (gold's candles are still used for the trades).
- Returns: daily log close-to-close (each market's previous joined close).

## The rule

On the close of day i (everything known by then):

1. Fit `r_gold = a + b1 r_eurusd + b2 r_usb10y + b3 r_spx500` by ordinary least squares on the `W` = 60 joined days ending
   10 days before i (joined days i-69 .. i-10), so the days being judged are outside the fit. Residual standard deviation `s`
   from the fit (n - 4 degrees of freedom).
2. Residuals of the last `L` joined days (i-L+1 .. i) under that fit; `z = sum / (s * sqrt(L))`.
3. **Fade**: z >= +2 (gold richer than its drivers) -> sell; z <= -2 -> buy. **Follow** is the opposite side.
4. Entry at the next day's open. Stop = 2 x ATR(14) of the signal day from the entry, never moved; a day opening beyond the
   stop fills at the open. Exit at the open of the day `H` days after entry if not stopped. No target. One position at a time:
   a signal while a position is open is ignored.

## Tests (three, Holm over the three)

| Test | Direction | L (days of residual) | H (hold, days) |
|---|---|---|---|
| T1 (primary) | fade | 5 | 10 |
| T2 | fade | 20 | 20 |
| T3 | follow | 5 | 10 |

For T2 the fit window ends 25 joined days before i (days i-84 .. i-25) so that it never overlaps the 20 judged days.

## Costs

$0.60 a round trip on every trade; on buys, `nights(entry, exit) x FIN.xau.long x entry price` (council/fills.mjs, the
demo broker's long swap of 11 Nov 2026, today's rate for every year); shorts are charged and credited nothing. R = price move /
stop distance. The cost share (costs and financing as a share of gross R) is reported.

## Baseline (how signal is separated from drift)

For each test and side, the same trade (same stop, same hold, same costs) entered at EVERY day's open of the window, ignoring
the signal: the same-side every-day baseline. Each test trade's **excess** = its net R minus the baseline's mean net R for its
side in the same window (IS or OOS). The primary statistic is the t on calendar-month sums of excess R (by exit month, every
calendar month of the window counted, empty months as 0).

## Windows and statistics

- In sample: entries 2007-01-01 to 2016-12-31. Out of sample: entries 2017-01-01 to 2026-10-31.
- Per test, IS and OOS: n, win share, R a trade gross / net / net at 2x costs, excess R, total, worst drawdown, month t of
  net R and of excess R, the median stop in dollars, the cost share; OOS halves 2017-21 and 2022-26.
- Holm over the three tests' OOS excess month-t p-values (two-sided).
- Placebo: 40 seeded draws (seeds 1..40), each with the same number of OOS trades, the same sides, stop multiple and hold,
  on random OOS entry days; a test beats the placebo when its OOS mean net R is above at least 38 of the 40 placebo means.

## Pass bar (all of these, for a test to pass)

1. OOS excess month t >= 2 with Holm p < 0.05;
2. IS excess R a trade of the same sign (positive);
3. OOS net R a trade > 0 at 2x costs;
4. beats at least 38 of 40 placebos;
5. OOS n >= 30, median stop >= $10.

The study passes if T1 passes. T2 and T3 are reported with the same bar but cannot make the study pass on their own; any
pass of T2 / T3 alone would only be a hypothesis for its own pre-registration. Never called an edge without n and t.
