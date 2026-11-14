# Pre-registration: does gold's Sydney/Tokyo overlap (22:00-01:59 UTC) lead the rest of the day? (14 Nov 2026)

Written and pushed ALONE before any outcome was read. Only the event counts below were computed (they read the overlap
candles and the previous day's range, no price after 01:59 UTC of a signal day and no trade result). Stand-alone paper
research on XAU/USD only: it reads and changes nothing of the live gold book (Gold trend, Gold daily engulf), uses none of
its 2006-17 positions, tests no gate, exit, entry or size of it (owner item 44), touches nothing under `ict/`, `council/`
or any live file, and changes no rule. Paper and demo only.

## Hypothesis

The first four hours of gold's trading day (the Sydney session plus the Tokyo open, 22:00-01:59 UTC: the Sunday reopen on
Mondays, the hour after the daily maintenance break on other days) are thin, but they are the first prices after the
New York close and they carry overnight news and Asian physical demand. **Follow**: when the overlap moves gold by at
least a tenth of the previous day's range, take the same side from 02:00 UTC to 20:00 UTC (Tokyo, London and New York);
the trade earns more than the same-side trade taken on every eligible day of the same calendar year.

Why it is new: `gold-us-asia` (New York into 00:00-07:00 Asia), `gold-asia-break` (breakout of the 00:00-06:59 London range
into London), `gold-session-drift` / `gold-session-agreement` (sessions starting at 00:00 UTC), `gold-weekend-gap` (fading
the Sunday reopen gap), `tokyo-fix-daily` (00:55 fix) and `gold-ny-open-overnight-fail` never used the 22:00-01:59 UTC
block as a lead for the same day's later hours. The near misses named by the coordinator (Nikkei drop, carry crash, euro
divergence, low-vol hold) are not touched.

## Data (named before any result)

- OANDA mid XAU/USD H1 candles through the site's keyless candle proxy (`/md/bars`), 2006-06-01 to 2026-10-30 (124,242
  candles), complete candles only; cache kept outside git and deleted at the end. Market set: XAU/USD only.
- Session day = 22:00 UTC of the previous date to 21:59 UTC (a candle's UTC hour + 2 decides its day); Sunday's reopen
  belongs to Monday; session days on Saturday / Sunday are dropped; a day counts with at least 16 H1 candles. ATR(14) of
  session days (true range).
- **Overlap** = the H1 candles opening 22:00, 23:00, 00:00, 01:00 UTC of the session day (at least 3; in northern winter
  the 22:00 candle is in the maintenance break). Overlap move = close of its last candle minus open of its first (so a
  Sunday gap is not counted). Ratio = |overlap move| / (high - low of the previous session day).

## The rule

- **Signal**: ratio >= threshold and move non-zero; direction = sign of the move. Known at 02:00 UTC.
- **Trade**: entry at the open of the 02:00 UTC candle of the same session day (no 02:00 candle, no trade); stop 1 x
  ATR(14) of the session days BEFORE the signal day, from the entry, never moved, checked on every H1 candle (a gap through
  the stop fills at the candle's open, otherwise at the stop); out at the close of the 19:00 UTC candle (20:00 UTC, before
  the earliest 17:00 New York rollover, so no financing night in practice; financing is still computed by `nights`).
  Every trade has a stop. One trade per day.
- **Baseline (control)**: the same trade (entry, stop, exit, costs) on the SAME SIDE on every eligible day. Excess of a
  signal trade = its net R minus the mean net R of all baseline trades of the same side entered in the same calendar year.
  This keeps gold's drift and the year's volatility and removes only the overlap's information.

## Tests (three, Holm over the three OOS p-values)

| Test | Signal | Sides |
|---|---|---|
| **T1 (primary)** | ratio >= 0.10 | both (follow) |
| T2 | ratio >= 0.10, up overlap only | buys only |
| T3 | ratio >= 0.25 (strong overlap) | both (follow) |

## Event counts (computed before this file; no outcome read)

5,239 eligible session days.

| Test | In sample (2007-16) | Out of sample (2017 to 2026-10) |
|---|---|---|
| T1 | 1,405 | 1,482 |
| T2 | 753 | 801 |
| T3 | 452 | 541 |

At least 100 events in each window for every test.

## Costs

$0.60 a round trip; buys pay `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, the demo's measured XAUUSD
long swap of 11 Nov 2026, 0.000148 of price a rollover, imported, not edited); sells are charged and credited nothing.
R = price move / stop distance; cost and financing in R by the same distance. A 2x-costs run doubles both.

## Statistics and the pass bar

- Windows: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31 (by entry time).
- t = mean / standard error of calendar-month sums of excess R (months without a trade count as 0), two-sided p, Holm over
  T1-T3.
- **Placebo**: 40 seeded draws (seeds 1-40, mulberry32); per calendar year of the OOS window, the same number of random
  eligible days as signal days, each given one of that year's signal directions (shuffled); the placebo month t is computed
  the same way.
- A test **passes** only when all hold: OOS month t >= 2 and Holm p < 0.05; in-sample mean excess > 0; at 2x costs the OOS
  mean excess > 0 and the OOS mean net R > 0; OOS t above at least 38 of the 40 placebo t; n >= 100 in both windows.
- **Verdict** = PASS when T1 passes; T2 and T3 are reported with their own pass lines. A PASS is a paper-research finding
  only: no live rule, size or config changes without the owner.

## Reported, not tested

Gross and net R a trade of the signal trades, the baseline per side, OOS halves (2017-21, 2022-26), win rate, stops, median
stop.
