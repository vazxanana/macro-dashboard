# Pre-registration: gold, the share of the day's range New York made, followed or faded for 2-5 days (14 Nov 2026)

Pushed alone, before any trade or return of this rule was computed. Only the event counts below were read (`run.mjs count`).
A new stand-alone rule on spot gold (XAU/USD), paper research only: it is **not a gate, exit, entry or size of the live gold
book**, and it reads none of the book's 2006-17 positions (docs/owner-decisions.md item 44). Nothing live changes and no
proposal is written whatever the result.

## Idea

Gold's most liquid hours are New York's (13:00-21:00 UTC: the COMEX open, US data, the London PM fix). Asia and London trade
first. Two readings, neither tested here before:
- When New York **made most of the day's range** (pushed the price well beyond what Asia and London had already traded), the
  day's information arrived in the most liquid session: follow New York's move for the next days.
- When New York **made almost none of it** (stayed inside the range Asia and London had made), the earlier move was not taken
  further by the deepest session: fade the 00:00-13:00 UTC move for the next days.

How it differs from studies already run: `gold-session-agreement` asked whether all three sessions moved the same way (sign
agreement, next day); `gold-overlap-lead`, `gold-late-ny`, `gold-us-asia`, `gold-session-drift` trade a session's move into the
next session the same night; `gold-day-range-used` fades a day range already used up inside the same day; `gold-vwap` trades
around an intraday VWAP; `gold-intraday-efficiency` reads the path's straightness. None measures which session MADE the range,
and none holds 2-5 days.

## Data (named before any result)

- OANDA mid XAU/USD H1 through the site's keyless candle proxy (`/md/bars`, `run.mjs fetch`), 19 Mar 2006 to 30 Oct 2026,
  125,474 candles; kept out of git (scratch directory, deleted at the end). One market only: XAU/USD.
- Day = UTC calendar day; Saturday / Sunday candles belong to the next Monday; a day needs 18 or more H1 candles.

## Rule

- Segments by the UTC hour a H1 candle opens, candles of that UTC date only: **pre** = 00-12 (Asia + London, at least 10
  candles), **NY** = 13-20 (at least 6 candles). 21-23 UTC unused.
- R = max(high) - min(low) over both segments. **NY share** = 1 - (pre high - pre low) / R = the part of the 00:00-21:00 UTC
  range lying outside what 00:00-13:00 UTC had already made. (0 = New York stayed inside the earlier range; 1 = the earlier
  range was a point.)
- NY move = close of the last NY candle - open of the first; pre move likewise.
- **T1 (primary)**: NY share >= 0.60 and NY move != 0 → trade the sign of the NY move, entry at the first H1 open of the next
  day, out at the close of the 5th day (signal day + 5), stop 2 x ATR(14) of the daily candles up to the signal day (every
  trade has a stop; a stop fills at the stop, or at the open when gapped through).
- **T2**: NY share <= 0.10 and pre move != 0 → trade AGAINST the pre move, same entry, stop, 5-day hold.
- **T3**: T1's signal, 2-day hold.
- Signals use only candles of the signal day and before; the trade starts the next day.
- Each signal is its own trade (overlap allowed); R = move / stop distance.

## Costs

$0.60 a round trip on every trade (each R charged 0.60 / stop distance), plus overnight financing on buys:
`nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, 0.000148 of price a rollover, the demo broker's XAUUSD
swap.long of 11 Nov 2026; Wednesday counts three); sells are credited nothing. A 2x cost run doubles both.

## Baseline and measures

- Baseline = the **same-side every-day trade**: on every eligible day a long and a short trade with the same entry, stop, hold
  and costs. Excess of a signal trade = its net R minus the mean net R of the baseline trades of the same side entered in the
  same calendar year.
- t = on calendar-month sums of the excess (months with no signal count as 0), two-sided p (Student t).
- Windows: in sample 2007-01-01 → 2016-12-31; out of sample 2017-01-01 → 2026-10-31 (halves 2017-21 / 2022-26 reported).
- Holm over the three tests' out-of-sample p.

## Event counts (read before this file was written; no outcome read)

| Test | in sample 2007-16 | out of sample 2017-26 |
|---|---|---|
| T1 / T3 (NY share >= 0.60) | 258 | 198 |
| T2 (NY share <= 0.10) | 663 | 636 |

Eligible days 5,236 in all.

## Placebo and control

- **Placebo** (40 seeds, mulberry32 1-40): the real signal days, each given a random side; out-of-sample excess month t.
- **Control** (40 seeds): per calendar year, as many random eligible days as that year has signal days, each traded on that
  day's own rule side (keeps each year's drift, volatility and side mix; drops which days were signals).

## Pass bar (per test; the verdict is T1's)

All of: out-of-sample excess month t >= 2 with Holm p < 0.05; out-of-sample net R a trade > 0 with net month t >= 2; in-sample
excess > 0; out-of-sample excess and net still > 0 at 2x costs; the real t above at least 38 of 40 placebo AND 38 of 40
control draws; n >= 100 in both windows. Otherwise FAIL. Never called an edge without n and t.
