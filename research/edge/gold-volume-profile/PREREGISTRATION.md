# Pre-registration: does gold trade back to yesterday's volume point of control? (14 Nov 2026)

Written and pushed alone, before any candle of this study was read or any code run. Paper research only: no live rule, size,
filter, stop or config changes. **Item 44**: a new stand-alone intraday rule, judged on its own; it is not a gate, exit, entry
or size of the gold book (Gold trend / Gold daily engulf) and reads none of its positions. ICT and council files are untouched.

## Why this topic
Market-profile traders read the previous day's volume profile: the price where most volume traded (the point of control, POC)
and the value area around it (70 % of the volume). Two opposite claims are taught: an open OUTSIDE yesterday's value area tends
to rotate back toward value and the POC (the "magnet"), or an open outside value that holds starts a move away from it
(acceptance). No study here built a volume profile (checked: `research/edge/*`, every remote branch, the 14 Nov untested
backlog, the topics list). Nearest: `gold-vwap` (a volume-weighted average, not the distribution's mode or value area),
`gold-pdhl-break` / `gold-premium-discount` (price levels without volume), `gold-gap-open` (the open against the prior close).

## Data (fixed now)
- One market: spot gold, OANDA XAU_USD mid H1 candles with OANDA tick volume, through the site's keyless candle proxy
  (`/md/bars?sym=xau&tf=1h`), from the first candle served (2006) to 2026-10-31. Cache kept out of git and deleted at the end.
- Trading day = UTC date of the H1 candle; Saturday and Sunday candles belong to the next Monday. Daily OHLC and ATR(14) (mean
  true range of the 14 trading days up to and including the profile day) are built from those H1 candles.

## The profile of day D-1 (all candles closed before day D starts)
- Price grid of bin width ATR(14) / 25 (at least $0.05) over the day's low..high. Each H1 candle's tick volume is spread evenly
  over the bins its low..high covers.
- POC = the bin with the most volume (a tie goes to the bin nearer the day's close). Value area: start at the POC bin and add,
  one bin at a time, the neighbour (above or below) with more volume (a tie goes up) until the bins hold at least 70 % of the
  day's volume. VAH / VAL = the top of the highest and the bottom of the lowest bin in it. A day with zero volume has no
  profile (no trade the next day).

## Trade (one a day; intraday, so never two at once)
- Entry at the open of day D's first H1 candle. Stop 1.0 x ATR(14) of day D-1 on the losing side. Exit at the close of the
  20:00 UTC H1 candle (21:00 UTC), or the day's last candle if the market closes earlier, or the stop: an H1 candle opening
  through the stop fills at its open, one touching it fills at the stop. No target.
- R = (exit − entry) / stop distance x side.
- Costs: $0.60 a round trip in R (0.60 / stop distance), plus financing on buys = `nights(entry, exit)` x `FIN.xau.long`
  (0.000148 of price a rollover: the demo broker's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`, applied to every year) x
  entry / stop distance. Sells pay nothing. 2x costs = both doubled.

## Tests (two, both fixed now)
- **T1 (primary), fade to the POC**: day D opens above D-1's VAH → sell; opens below VAL → buy.
- **T2, acceptance**: the same days, the other side (above VAH → buy; below VAL → sell).
- Baseline for the excess: the same trade (same side, entry, stop, exit) on EVERY day with a profile. A trade's excess = its net
  R minus the window's mean net R of baseline trades of the same side.

## Windows and statistics
- In sample (IS) 2007-01-01 → 2016-12-31; out of sample (OOS) 2017-01-01 → 2026-10-31, by entry day.
- t on calendar-month sums (every month of the window counts, 0 when no trade), one-sided normal p. Holm over the two tests.
- Placebo: 40 seeds (mulberry32, seeds 1..40): as many random OOS days with a profile as the test has OOS trades, each given
  the side of a signal trade (the signal sides shuffled with the same seed); compare mean net R.

## Pass bar (per test; the verdict is PASS only if T1 or T2 passes every line)
1. OOS mean net R > 0 and OOS month-sum t ≥ 2 with Holm-adjusted p ≤ 0.025.
2. IS mean net R > 0 (same sign).
3. OOS mean net R still > 0 at 2x costs.
4. OOS excess: mean > 0 and month-sum t of the excess ≥ 2 (beats the same-side trade on every day: not gold's drift).
5. Beats at least 38 of the 40 placebo draws.

## Reported, never judged
OOS halves (2017-21 | 2022-26), by side, by year, exits, share of days opening outside value, a version with the stop at 1.5 x
ATR. Nothing is changed after the result; no other bin width, value-area share, stop or exit is tried.
