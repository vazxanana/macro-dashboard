# Pre-registration: spot gold after a 10-year bond shock it shrugged off (14 Nov 2026)

Written and pushed alone, before any return, R or t of this rule was computed. Only the event counts below were looked at.
Paper research only: a **stand-alone rule on gold**, never a gate, entry, exit or size of the live gold book, and none of the
book's 2006-17 positions is read (docs/owner-decisions.md item 44). Nothing live changes; no proposal follows from a FAIL.

## Idea

On a day the US 10-year Treasury moves hard, gold usually moves against yields (`gold-yield-shock`: about -0.5 % to -0.8 % on a
yield-up shock day). Some days gold does not react at all. Hypothesis: gold that **ignores** a rates shock is showing its own
demand (resilience), so it drifts the "unbothered" way in the next days: yields up hard and gold flat -> buy gold.

How this differs from the studies already run:
- `gold-yield-shock`: traded every 1.5 sd yield shock day whatever gold did; here only days gold did NOT move (|gold z| < 0.5).
- `gold-bond-lead`: a CATCH-UP bet (gold lagged the bond, trade gold the bond's way: bond down -> sell gold). This is the
  opposite bet on the same kind of day (bond down, gold held -> buy gold), and it is defined by gold's absolute non-reaction,
  not by a beta-adjusted lag, on the 10-year daily, held 5 days.
- `gold-bond-vol-spike` (bond volatility regime) and `gold-bond-52w-extreme` (bond level) read neither a single day's shock
  nor gold's reaction to it.

## Data (fixed now)

- council-data `research/daily/xau.json` (traded) and `research/daily/usb10y.json` (signal), OANDA mid daily candles, UTC days,
  at council-data commit `38d484d7`; weekends folded into Monday with `council/fills.mjs` `foldWeekend`. Market set: gold and
  the 10-year Treasury CFD only. `usb10y` is the bond PRICE (down = yields up).
- Common days = UTC days both have a candle. For each common day: bond return and gold return (close to close over the previous
  common day), each divided by the sample sd of that market's 250 previous common-day returns (the day itself excluded).

## Event

- **Yields-up shrug** (T1, T3): bond z <= -1.0 AND |gold z| < 0.5 the same day.
- **Yields-down shrug** (T2): bond z >= +1.0 AND |gold z| < 0.5.
- Counted before this was written (eligible days from 2007-03-14): yields-up 135 events in sample (2007-16), 115 out of sample
  (2017 to Oct 2026); yields-down 139 and 101. Both at least 100 per window.

## Trade

- Entry at gold's next daily open after the event day; stop 2 x ATR(20) of the 20 gold candles before the entry (1R); a gap
  through the stop fills at the open; stop first; otherwise out at the close of the hold's last candle. One trade at a time.
- Costs: $0.60 a round trip ($0.30 spread + $0.15 slippage on each market order) plus, on buys, `nights(entry, exit)` x
  `FIN.xau.long` (0.000148 of price a rollover, the demo broker's long swap, 11 Nov 2026) x entry / risk. Sells charged no
  financing and credited nothing.

## Tests (three, Holm over the three)

| Test | Event | Side | Hold |
|---|---|---|---|
| T1 (primary) | yields-up shrug | buy | 5 candles |
| T2 | yields-down shrug | sell | 5 candles |
| T3 | yields-up shrug | buy | 1 candle |

- Measure: **excess** = a trade's net R minus the mean net R of the same side and hold entered at every gold candle of the same
  calendar year (the same-side every-day baseline). Also reported: gross and net R, net at 2x costs.
- t on calendar-month sums of excess R (every month of the window, empty months 0), by exit month. One-sided normal p for
  excess > 0 out of sample; Holm over T1-T3.
- Windows: in sample 2007-01-01 to 2016-12-31, out of sample 2017-01-01 to 2026-10-31.

## Placebo and control (out of sample, 40 seeds each)

- **Placebo**: the same number of random eligible OOS common days (seeds 1-40), same side, hold, stop and baseline.
- **Control** (keeps drift and volatility, removes the signal's information): the bond's z values are shuffled among the common
  days of each calendar year (seeds 1001-1040), gold's own days and its |z| < 0.5 filter are kept real, the events are taken
  again and traded the same way. It asks whether the BOND shock adds anything beyond "gold had a quiet day".

## Pass bar (a test passes only if all hold)

1. OOS month-sum t of excess >= 2 and Holm p < 0.05;
2. in-sample excess > 0 (same sign);
3. OOS net R > 0 and OOS excess > 0 at 2x costs;
4. at least 100 events in each window;
5. the real OOS excess t is above at least 38 of the 40 placebo draws;
6. the real OOS excess t is above at least 38 of the 40 control draws.

The verdict is PASS only if T1 passes. T2 and T3 can only be reported. Even a PASS is a paper finding, not an edge for live use,
until a forward record exists.

## Files

`run.mjs` (`fetch <dir>` copies the two caches out of origin/council-data, no network; `full <dir>` runs and writes
`result.json`), `RESULT.md`, `result.json`, `tests/gold-rates-shrug.test.mjs`. Candle caches stay out of git and are deleted.
