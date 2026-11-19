# Pre-registration: does an efficient intraday path on gold predict the next day? (14 Nov 2026)

Written and pushed ALONE before any candle was read for a result. Stand-alone paper research on XAU/USD only: it reads and
changes nothing of the live gold book (Gold trend, Gold daily engulf), tests no gate, exit, entry or size of it (owner
item 44), touches nothing under `ict/`, `council/` or any live file, and changes no rule. Paper and demo only.

## Hypothesis

A day on which gold travelled from its open to its close in a nearly straight line (little back-and-forth on the hourly
path) carries information about the next day that an ordinary day does not: informed, one-sided order flow that keeps
going. **Continuation**: after an efficient up day buy the next day, after an efficient down day sell it; the trade earns
more than the same-side trade taken on every eligible day of the same month (so gold's drift and plain one-day momentum
are not counted as signal).

Why it is new: earlier gold studies read multi-day trend quality (`gold-trend-r2`, `metals-fade-clean-trend`: R squared
of a 60-day line), multi-day staircases (`gold-staircase`), close location (`gold-ibs`, `gold-wick-pressure`), the
first-to-last-hour link inside one day (`gold-intraday-momentum`) and range expansion (`gold-range-expansion`). None
measured how straight the hourly path inside one day was.

## Data (named before any result)

- OANDA mid XAU/USD H1 candles through the site's keyless candle proxy (`/md/bars`), the first candle OANDA serves
  (March 2006) to 2026-11-07, complete candles only; cache kept outside git and deleted at the end.
- Day = UTC calendar day of the candle's open time; Saturday / Sunday candles belong to the next Monday. A day counts
  only with at least 18 H1 candles (holiday half days and gaps drop out).
- Daily ATR(14) built from those days (true range on the day's high / low / close).

## The rule

- **Efficiency** of day d: `E = |C_last - O_first| / L`, where `L = |C_1 - O_first| + sum over i >= 2 of |C_i - C_(i-1)|`
  over the day's H1 closes. Direction = sign of `C_last - O_first`.
- **Signal**: `E_d` at or above the 80th percentile of E over the 250 eligible days strictly before d (no look-ahead;
  needs 250 prior days). Fixed now, never tuned.
- **Trade**: entry at the first H1 open of the next eligible day; stop 1 x ATR(14) of day d from the entry, never moved,
  checked on every H1 candle (a gap through the stop fills at the candle's open); out at the close of the last H1 candle
  of the exit day (1-day hold: the entry day; 5-day hold: the 5th eligible day counting the entry day). Every trade has a
  stop. Each signal is its own trade (trades may overlap; the per-month statistic handles it).
- **Baseline**: the same trade (same hold, stop, costs) on the SAME SIDE on every eligible day. Excess of a signal trade =
  its net R minus the mean net R of all baseline trades of the same side entered in the same calendar month.

## Costs

$0.60 a round trip; buys pay `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, the demo's measured
XAUUSD long swap, 0.000148 of price a rollover, imported, not edited); sells are charged and credited nothing. R = price
move / stop distance; cost and financing in R by the same distance. A 2x-costs run doubles both.

## Tests (Holm over these three, on the OOS month-sum p values)

- **T1 (primary)**: continuation, both sides, 1-day hold; excess vs the same-side same-month baseline.
- **T2**: continuation after efficient UP days only (buys), 1-day hold; excess vs every-day buys.
- **T3**: continuation, both sides, 5-day hold; excess vs the same-side 5-day baseline.

Statistic: excess summed by calendar month of entry (every calendar month of the window counts, empty = 0), t = mean /
(sd / sqrt(months)), two-sided p. Signal trades' own net R and month t are reported beside it.

## Windows

In sample: first signal (about early 2007) to 2016-12-31. Out of sample: 2017-01-01 to 2026-11-07 (entries).
OOS halves 2017-21 / 2022-26 shown for stability only.

## Placebo

40 seeded draws (seeds 1-40, mulberry32): within each calendar year of the OOS window, the same number of eligible days
as there are signals is drawn at random and marked as signals (each with its own day's direction); the T1 month t is
recomputed. Reported: how many of the 40 the real T1 t beats.

## Pass bar (T1 decides the verdict; all must hold)

1. OOS excess month t >= 2 and Holm-adjusted p < 0.05;
2. IS mean excess > 0 (same sign);
3. at 2x costs the OOS mean excess > 0 AND the OOS signal trades' mean net R > 0;
4. real T1 t above at least 38 of the 40 placebos;
5. at least 100 OOS signal trades.

Anything else is FAIL. T2 and T3 are reported with the same checks but do not change the verdict; a T2 / T3 pass with a
T1 fail is a lead to replicate, never an edge. Nothing found here goes live or into a proposal without its own
pre-registration on other data and the owner.
