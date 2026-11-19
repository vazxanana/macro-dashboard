# Drift in the 24 hours before US CPI and payrolls: pre-registration

Written and committed **before** any candle was fetched or any return computed (14 Nov 2026). The event list, the rules, the
costs, the windows, the statistics, the placebo and the pass bar are fixed here; nothing in them changes after the results are
seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes; ICT is not involved. **This is a
stand-alone event rule.** Under the owner's rule of 12 Nov 2026 (docs/owner-decisions.md item 44) it is not, and can never
become by this study, a gate, exit, entry or size of the live gold book. A pass is a hypothesis for a forward paper shadow the
owner decides on, never a live rule.

## The question

Post-release follow-through after CPI and payrolls was tested (`cpi-follow`, `nfp-follow`: FAIL), and the 24 hours before
FOMC statements too (`pre-fomc-drift`, `pre-fomc-gold-usd`, `bond-fomc-drift`: FAIL). The hours BEFORE CPI and payrolls have
not been: does gold or the US dollar drift in a consistent direction in the 24 hours before these two releases (positioning,
hedging), as the pre-announcement literature reports for equities before FOMC?

## What is already known (seen before this was written)

- `event-reaction` (on main): gold and the dollar index from the release minute onward; nothing before it.
- `cpi-follow`, `nfp-follow`, `pre-fomc-gold-usd` (branches, FAIL): read for their code and cost model; their figures are
  for other windows. No return of the 24 hours before a CPI or payrolls release has been computed or seen for this study.
- `git ls-remote --heads origin` on 14 Nov 2026: no branch on this topic.

## Event list (source and count)

Only `council/event-base.json` (built 10 Nov 2026 by `research/edge/event-reaction/build.mjs`), its `rows` of type `CPI` and
`NFP`, with the release time `t` (UTC seconds, 08:30 New York) stored there. No date is added, moved or written by hand.
- **CPI: 86 rows, 14 Feb 2018 to 14 Oct 2026.** 2018-2021 from the BLS schedule list `CPI_EARLY` of that build script, kept
  only when the dollar index's release-minute range passed its spike check (15 dates dropped, listed in event-base `dropped`,
  not used here); 2022 on from `council/events.mjs` (`HISTORY` + `EVENTS`).
- **NFP: 51 rows, 7 Jan 2022 to 2 Oct 2026**, from `council/events.mjs`.
- event-base `missing` (15 CPI / NFP / FOMC dates its HistData candles did not cover) are NOT in `rows` and are not used as
  events here; they are used only to keep placebo dates away from releases (below).

## Data

OANDA mid candles through the site's keyless candle proxy (`/md/bars`, `node --use-env-proxy`): M5 and H1 of `xau`, `eurusd`,
`usdjpy`, `gbpusd`, 1 Jan 2018 to 14 Nov 2026, complete candles only (`live` dropped). Cache outside git (`/tmp`).

## Times

For a release at `T` (event-base `t`):
- **Start**: the close of the M5 candle that ENDS at `T − 24 h` (opens `T − 24 h − 5 min`).
- **End**: the close of the M5 candle that ends at `T − 5 min` (opens `T − 10 min`). Never later: no position is held into
  the print.
- Missing candle (a thin minute, a holiday): the last candle ending in the 30 minutes before that time; none → the event is
  skipped for that market and listed.

## Tests

Markets: `xau`; `eurusd`, `usdjpy`, `gbpusd`; and the **USD basket**: the dollar side derived as `pre-fomc-gold-usd` did it, an
equal-risk basket of legs at the same times, here oriented LONG USD: short EUR/USD, long USD/JPY, short GBP/USD (three legs:
only the three pairs of this study). Release types: CPI, NFP. So 5 x 2 = **10 cells**, each with two statistics:

1. **Drift** (percent move, Start to End, `100 x (End / Start − 1)`; for a long-USD view of EUR/USD and GBP/USD the sign is
   flipped; the basket's drift = the mean of its three legs' long-USD drifts).
   - **Gold: one-sided, long** (H1: mean > 0). Why long, fixed before any number: the pre-announcement literature (Lucca and
     Moench 2015 for equities before FOMC; Savor and Wilson 2013 and Ai and Bansal 2018 on the premium earned on scheduled
     macro-announcement days) describes a premium paid for bearing the risk of a scheduled announcement; for gold the matching
     reading is hedging demand into scheduled uncertainty, which buys gold. No gold-specific pre-CPI / pre-payrolls figure was
     looked up or is known to this study.
   - **Dollar pairs and basket: two-sided** (H1: mean ≠ 0).
2. **Trade**, one per event and market:
   - **Direction**: gold long. Pairs and basket: the sign of the **first half's** mean long-USD drift (positive or zero = long
     USD, negative = short USD), fixed from the first half alone and then applied to every event of both halves. The basket
     trades all three legs in that one direction.
   - **Entry** at Start; **stop 1.0 x ATR(14) on H1**: the simple mean of the true range of the 14 most recent complete H1
     candles that closed at or before the entry (true range with the previous H1 close), under a long / over a short. Every
     trade has its stop; it is never moved.
   - Managed on the M5 candles after the entry candle up to the End candle: a candle that opens through the stop exits at its
     open (gap); otherwise one that touches it exits at the stop; else **exit at End** (time exit, before the release).
   - R = direction x (exit − entry) / |entry − stop|. Basket R = the mean of its three legs' R (equal risk); traded only when
     all three legs can be priced.
   - **Costs, the frozen model of `cpi-follow` `costOf`**: gold $0.30 a round trip; forex `0.3 pip + 0.000045 x price + 2 pip`
     a round trip (pip 0.0001; 0.01 for USD/JPY). **Departure, declared now:** `cpi-follow` never held overnight; every trade
     here crosses at least one 22:00 UTC rollover, so a gold LONG also pays financing `nights(entry, exit) x FIN.xau.long x
     entry` (`council/fills.mjs`, imported; today's demo rate for every year, Wednesday three). Forex swaps are not charged
     (the frozen model has none; said in `RESULT.md`). Net R = R − cost / risk. 2x costs reported beside.
   - **p-value**: gold one-sided on net R; pairs and basket two-sided on net R in the chosen direction (twice the one-sided p,
     capped at 1: the honest price of choosing the direction from the first half).

**Holm over all 20 p-values** (10 drift + 10 trade). Student t across events (event-sum t: each event one observation).

## Windows

Per release type, the events of that type in date order are split into a first half (in sample: `floor(n / 2)` earliest) and
a second half (out of sample: the rest). Counted per cell after skips. CPI therefore splits around 2022, NFP around mid-2024.

## Placebo

For each cell, 40 seeded runs (seed = 1..40, mulberry32, seeded per cell from its index). A run draws, without replacement, as
many dates as the cell traded, from the eligible days: Tuesday to Friday (so the Start, 24 h earlier, is a weekday) between
that type's first and last event date, with **no CPI, NFP or FOMC release within 48 h** of 08:30 New York on that day (the
releases = every event-base `rows`, `missing` and `dropped` date, and every CPI / NFP / FOMC entry of `council/events.mjs`
`HISTORY` + `EVENTS`). `T` = 08:30 New York on that day. The run applies the cell's whole rule (direction from its OWN first
half for pairs and basket) and gives its mean net R. A day with a candle missing is redrawn. Reported: the 40 means, their
median and 95th percentile.

## Pass bar (all on one cell's TRADE, net of 1x costs)

1. n >= 20 events traded;
2. mean net R > 0 in the first half AND in the second half;
3. event-sum t >= 2 over all events, and its Holm-adjusted p < 0.05 (over the 20);
4. mean net R above the 95th percentile of that cell's 40 placebo means.

**PASS** if at least one cell meets all four (then only that cell is named, as a hypothesis, never an edge). **FAIL** if no
cell does and at least one cell has n >= 20. **NOT MEASURABLE (inconclusive: …)** if no cell reaches n >= 20. The drift
statistics are reported with their Holm p beside the trades; they do not decide the verdict.

## Outputs

`run.mjs` (`fetch <dir>`, `full <dir>`), `result.json`, `RESULT.md` in this folder; `tests/pre-release-drift.test.mjs`
(offline: the rules on hand-made candles, no candle after End is read, the event list equals event-base, the report against
result.json).
