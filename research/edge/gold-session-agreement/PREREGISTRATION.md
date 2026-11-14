# Pre-registration: when Asia, London and New York all move gold the same way, does the next day follow? (14 Nov 2026)

Written and pushed ALONE before any outcome was read. Only the event counts below were computed (they read no price after
a signal day and no trade result). Stand-alone paper research on XAU/USD only: it reads and changes nothing of the live gold
book (Gold trend, Gold daily engulf), uses none of its 2006-17 positions, tests no gate, exit, entry or size of it (owner
item 44), touches nothing under `ict/`, `council/` or any live file, and changes no rule. Paper and demo only.

## Hypothesis

Gold trades round the clock in three distinct crowds: Asia (Shanghai, Tokyo, Singapore, Indian demand), London (the
bullion market, the fixes) and New York (COMEX, US macro flows). On most days at least one session moves against the
others. A day on which **all three sessions moved gold the same way** is one where buyers (or sellers) in every time zone
agreed. **Follow**: after such an up day buy the next day, after such a down day sell it; the trade earns more than the
same-side trade taken on every eligible day of the same calendar year (so gold's drift and plain one-day momentum are not
counted as signal).

Why it is new: the earlier session studies on gold each linked ONE session to the next (`gold-us-asia`: New York into
Asia; `gold-late-ny`: late New York into Asia; `gold-london-reversal`: London faded in New York; `gold-session-drift`:
each session's own drift; `gold-asia-break`, `gold-london-orb`: one session's range). `gold-intraday-efficiency` measured
the straightness of the hourly path, `gold-extreme-timing` the hour of the day's extreme, `gold-intraday-momentum` the
first hour into the last. None asked whether the three sessions agreed, nor used that day-level agreement for the next day.

## Data (named before any result)

- OANDA mid XAU/USD H1 candles through the site's keyless candle proxy (`/md/bars`), the first candle OANDA serves
  (2006-03-19) to 2026-11-06, complete candles only; cache kept outside git and deleted at the end. Market set: XAU/USD only.
- Day = UTC calendar day of the candle's open time; Saturday / Sunday candles belong to the next Monday. A day counts only
  with at least 18 H1 candles. Daily ATR(14) from those days.
- Sessions by the UTC hour a candle opens: **Asia 00-06, London 07-12, New York 13-20** (21-23 UTC, the rollover and the
  next evening, belong to no session). A session counts with at least 4 candles; its move = close of its last candle minus
  open of its first. A day with a missing session is not eligible.

## The rule

- **Signal (agreement)**: the three session moves are non-zero and have the same sign; direction = that sign. Known at
  21:00 UTC of the day; nothing after that day is read.
- **Strong agreement** (T3): agreement and each session's |move| >= 0.10 x ATR(14) of the days BEFORE the signal day.
- **Trade**: entry at the first H1 open of the next eligible day (00:00 UTC); stop 1 x ATR(14) of the signal day from the
  entry, never moved, checked on every H1 candle (a gap through the stop fills at the candle's open); out at the close of
  the last H1 candle of the exit day (1-day hold: the entry day; 5-day hold: the 5th eligible day counting the entry day).
  Every trade has a stop. Each signal is its own trade (trades may overlap; the per-month statistic handles it).
- **Baseline**: the same trade (same hold, stop, costs) on the SAME SIDE on every eligible day. Excess of a signal trade =
  its net R minus the mean net R of all baseline trades of the same side entered in the same calendar year.

## Event counts (computed before this file; no outcome read)

5,291 eligible days in all.

| Window | Agreement days | Strong agreement days |
|---|---|---|
| In sample (2007-16) | 659 | 265 |
| Out of sample (2017 to 2026-11-06) | 640 | 267 |

At least 100 events in each window for every test.

## Costs

$0.60 a round trip; buys pay `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, the demo's measured XAUUSD
long swap of 11 Nov 2026, 0.000148 of price a rollover, imported, not edited; today's rate for every year); sells are
charged and credited nothing. R = price move / stop distance; cost and financing in R by the same distance. A 2x-costs run
doubles both.

## Tests (Holm over these three, on the OOS month-sum p values)

- **T1 (primary)**: follow agreement, both sides, 1-day hold; excess vs the same-side same-year baseline.
- **T2**: follow agreement, both sides, 5-day hold; excess vs the same-side same-year 5-day baseline.
- **T3**: follow STRONG agreement, both sides, 1-day hold; excess vs the same-side same-year baseline.

Statistic: excess summed by calendar month of entry (every calendar month of the window counts, empty = 0), t = mean /
(sd / sqrt(months)), two-sided p. Signal trades' own gross and net R and month t are reported beside it.

## Windows

In sample: entries 2007-01-01 to 2016-12-31 (2006 serves only as warm-up for the ATR). Out of sample: 2017-01-01 to 2026-11-06 (entries). OOS halves 2017-21 / 2022-26
shown for stability only.

## Placebo

40 seeded draws (seeds 1-40, mulberry32): within each calendar year of the OOS window, the same number of eligible days as
there are signals is drawn at random and marked as signals (each with its own day's open-to-close direction); the test's
month t is recomputed. Reported: how many of the 40 the real t beats.

## Pass bar (T1 decides the verdict; all must hold)

1. OOS excess month t >= 2 and Holm-adjusted p < 0.05;
2. IS mean excess > 0 (same sign);
3. at 2x costs the OOS mean excess > 0 AND the OOS signal trades' mean net R > 0;
4. real T1 t above at least 38 of the 40 placebos;
5. at least 100 OOS signal trades.

Anything else is FAIL. T2 and T3 are reported with the same checks but do not change the verdict; a T2 / T3 pass with a T1
fail is a lead to replicate on other data, never an edge. Nothing found here goes live or into a proposal without its own
pre-registration on other data and the owner.
