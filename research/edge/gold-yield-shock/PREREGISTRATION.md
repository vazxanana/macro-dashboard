# Pre-registration: spot gold after a US 10-year yield shock day (14 Nov 2026)

Written and pushed before any gold return after an event was computed. Paper research only: a stand-alone cross-asset rule,
never a gate, exit, entry or size change of the live gold book (decision 44), and it does not use the book's 2006-17
positions. Nothing live changes.

## Question

On a day when the US 10-year Treasury price falls (yield spikes) or rises (yield drops) by an unusual amount, gold usually
moves against the yield the same day. Does gold then **revert** over the next days, so that a gold trade against the
same-day reaction earns more than the same-side trade taken on any day of that year?

Why not a duplicate (checked 14 Nov against `research/edge/`, `git branch -r` and the 14 Nov backlog):
`gold-bond-lead` (weekly 10-year move that gold LAGGED, gold the bond's way; daily 2-year with a lag condition),
`gold-rate-spread` (4-week US-Bund gap), `gold-curve-slope` (2s10s / 2s30s slope), `gold-haven-shock` (equity shock days),
`gold-shock-revert` / `gold-hourly-shock` (gold's own extreme days). None trades gold against its reaction to a one-day
10-year yield shock, with no lag condition, measured against a same-year baseline.

## Data (fixed before any result)

- council-data `research/daily/xau.json` and `research/daily/usb10y.json` (OANDA mid, UTC days, commit
  `83e686fccd8183638b4b2532188acd93c3b17304`), weekend stubs folded into Monday with `council/fills.mjs` `foldWeekend`.
  Only these two markets. Gold starts 20 Mar 2006, the bond CFD in 2003.
- Bond daily return = close / previous close on the common UTC days (days on which gold has a candle).
  `z` = that return / the sample standard deviation of the 250 previous common-day returns (only earlier days).

## Event counts (counted before this file; no gold return was read)

With |z| >= 1.5: in sample (2007 - 2016) 159 bond-down and 161 bond-up days; out of sample (2017 - Oct 2026) 158 and 162.
At 1.75 the counts were 102-111 a side and window, at 2.0 72-77: **the threshold 1.5 is fixed on these counts only** (each
window needs at least 100 events).

## Rules

- Event day d: `z <= -1.5` (bond price down = **yield-up shock**) or `z >= +1.5` (**yield-down shock**).
- Entry: gold's next daily candle's open after day d. Stop: 2 x the 20-day ATR of gold before entry. Exit: the stop (a gap
  through it fills at the open), else the close of the hold's last candle. One trade at a time per test.
- **T1 (primary)**: yield-up shock -> **buy** gold, hold 5 candles.
- **T2**: yield-down shock -> **sell** gold, hold 5 candles.
- **T3**: yield-up shock -> buy gold, hold 1 candle.
- **Baseline** for each test: the same-side, same-hold trade entered at the open of **every** gold candle of the same
  calendar year (overlap allowed: it is a mean). A trade's **excess** = its net R minus the baseline's mean net R of its
  entry year.
- Costs: $0.60 a round trip (spread $0.30 + half-spread slippage each way, as `gold-bond-lead`), plus on buys
  `nights(entry, exit) x FIN.xau.long x entry` (`council/fills.mjs`, the demo broker's XAUUSD swap of 11 Nov 2026, today's
  rate for every year; sells pay and earn nothing). All in R of the trade's stop distance.

## Windows and statistics

- In sample 2007 - 2016 (from the first day with 250 earlier returns), out of sample 1 Jan 2017 - 31 Oct 2026.
- t on calendar-month sums of the excess (months without a trade count as 0), and the same for net R.
- Holm over the three tests on the OOS excess month t (one-sided normal p).
- Placebo: 40 seeded draws (seeds 1-40) of the same number of random eligible days in the OOS window, same side and hold,
  same one-at-a-time and same yearly baseline; reported: how many draws reach the real excess t.

## Pass bar (per test; the study passes only if T1 does)

1. OOS excess month t >= 2 and Holm p < 0.05;
2. in-sample excess mean > 0;
3. OOS net mean > 0 at 2x costs and OOS excess > 0 at 2x costs (baseline also at 2x);
4. at least 100 events in each window (met by the counts above);
5. the real excess t above at least 38 of the 40 placebos.

Anything else is FAIL. Reported but never in the verdict: gross figures, the same-day gold move on event days.
