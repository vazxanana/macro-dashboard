# The honest book: pre-registration

Written and committed **before** any book-level number was computed. The books, windows, sources, sizing, metrics and the
decision rule below are fixed; nothing in them changes after the results are seen. Anything added later is labelled post hoc
in `RESULT.md`. Paper research only: no live rule, size, filter, config, tracker, replay or site code changes, whatever the
outcome. The output is a written proposal; the owner decides.

## Question

The council runs eight systems live on paper and two as shadows. Every one has now been tested on long data its rule never
saw, and council-data `coach.json` `expect` (read 8 Nov 2026 00:03 UTC) carries each system's honest out-of-sample
expectancy:

| id | system | live | honest window | n | honest R a trade | built on |
|---|---|---|---|---|---|---|
| `replica` | Gold replica | live | 2017-22 (#512) | 115 | **−0.052** | 2023-26 |
| `mosha-bo` | Mosha BO | live | 2006-17 (mosha-oos) | 62 | +0.137 | 2018-26 (weekly 2019-26; add / run / slow rule 2023-26) |
| `gtrend` | Gold trend N20 | live | 2006-17 (#530) | 75 | +0.489 | 2018-26 |
| `gtrend5` | Gold trend fast N5 | shadow | 2006-17 (#530) | 129 | +0.372 | 2018-26 |
| `gtl` | Gold H4 trendline | live | 2006-17 (#530) | 402 | +0.048 | 2018-26 |
| `geg` | Gold daily engulf | live | 2006-17 (#530) | 256 | +0.186 | 2018-26 |
| `gmp` | Gold momentum pullback | live | 2018-22 (robustness rebuild, #486) | 633 | **−0.043** | 2023-26 |
| `nq-open` | NQ New York open run | live | 2004-22 (#511) | 1,560 | **−0.018** | 2023-26 |
| `ict-a` | ICT A-setups (GC, NQ, ES, YM) | live | 2008-17 (#526) | 2,235 | **−0.013** | 2018-26 |
| `trend` | Crypto trend v3 | shadow | June 2025 on (#508, decayed) | 20 | −0.133 | 2017-26 |

Four live systems have a negative honest expectancy. Would a book made only of the systems with a positive honest
expectancy have been a better book, on data none of the rules saw, than the book the council runs today? And does adding the
shadow Gold trend fast N5 (honest +0.37, but 0.92 correlated with Gold trend N20) help or just double one bet?

## The three books

| book | systems (1R per position each) |
|---|---|
| **A, the live book** | `replica`, `mosha-bo`, `gtrend`, `gtl`, `geg`, `gmp`, `nq-open`, `ict-a` |
| **B, the honest-positive book** | `gtrend`, `geg`, `mosha-bo`, `gtl` (replica, gmp, nq-open, ict-a go to shadow) |
| **C, B plus the fast trend leg** | `gtrend`, `geg`, `mosha-bo`, `gtl`, `gtrend5` |

Crypto trend is a shadow in every book and is not used. The ICT shadow variants and the scalp sleeve are not in any book.

## Sizing: the council's fixed 1R, as `research/edge/sizing` found it should stay

Every position is taken **as its source study recorded it at fixed 1R**: one unit of risk on the first entry, with the
system's own live rules inside the position (the gold trend add, the Mosha add at size 1 (× 1.5 as live), the replica's
add and MSNR size tilt, the ICT desk's `sizeOf` tight-A+ sizes). No weighting between systems: a system that trades 200
times a year puts 200R of risk into the book, one that trades 6 times puts 6R. That is what "equal 1R risk per trade" means
in the live book today, and it is the comparison the owner asked for. Books therefore differ in size as well as in shape;
return/drawdown, Sharpe-like t and share of positive months are scale-free and are the metrics the verdict uses. Total R
and R a year are reported for scale.

## Sources of the per-position records (all already committed by earlier studies; nothing is re-run)

| system | file | fields used | booked on | costs x1 / x2 |
|---|---|---|---|---|
| `gtrend`, `gtrend5`, `gtl`, `geg` | `research/edge/gold-systems-oos/result.json` `positions` (OANDA M5–D1 harness, live config of 7 Nov 2026) | `sys`, `c` (close, UTC), `n`, `n2` | close | `n` (0.30 a unit) / `n2` (0.60) |
| `mosha-bo` | `research/edge/mosha-oos/result.json` `positions` (same harness) | `c`, `n`, `n2` | close | `n` / `n2` |
| `replica` | `research/edge/sizing/inputs.json` `systems.replica` (the #512 OANDA replay positions with their leg close times, live sizing) | `[entry, close, market, net1, net2]` | close | `net1` (0.30 a unit) / `net2` (0.60) |
| `gmp` | `research/edge/robustness/out/gmp.json` `trades` (HistData M1 rebuild of the live block, #486) | `t` (entry), `R` (net at the claimed 0.15 round trip), `gross` | **entry** (no close time is recorded; the trade is an intraday H1 pullback scalp that lasts hours) | `R` (0.15) / `gross − 2 (gross − R)` (0.30) |
| `nq-open` | `research/edge/nq-open-oos/result.json` `trades` (OANDA 1m, live rule, clean years 2004-26) | `d` (trade day), `R` (net of 1 point), `gross` | the trade day (out by 11:00 ET) | `R` / `2R − gross` (2 points) |
| `ict-a` | `research/edge/sizing/inputs.json` `systems['ict-a']` (the #526 OANDA 5m run of the desk's own code, A-setups, `cfg` rule, 4 markets, live `sizeOf`) | `[entry, close, market, net1, net2]` | close | `net1` (#526 costs) / `net2` (2 ×) |

Gold daily returns for the beta regression: OANDA XAU_USD daily mid closes, UTC daily buckets, copied into
`gold-1d.json` in this folder from the `research/edge/sizing` fetch cache (2006-03-20 to 2026-11-06). Return of day d =
close(d) / close(previous candle) − 1, in %, on weekday candles (Saturday / Sunday-dated stub candles are dropped).

## Daily series

- The unit of time is the UTC calendar day. A position's net R is booked on the day named above. A booking dated Saturday or
  Sunday (UTC) moves to the following Monday.
- A book's daily R is the sum of its systems' bookings that day. Every weekday (Monday–Friday, UTC) in the window is a day
  of the series; a day with no closed position is 0R. The daily series starts at 0 on the first day of the window.
- A system contributes only inside the span its record covers (see the gaps below). Nothing is interpolated.

## Windows (by booking date), halves inside each, and what is untouched in them

| window | span | halves | status of the data for each book |
|---|---|---|---|
| **W1, untouched** | 2006-07-01 .. 2017-12-31 | H1 2006-07 .. 2011-12 (the gold bull); H2 2012-01 .. 2017-12 (the gold bear and range) | Untouched for every system present: the four gold systems and Mosha BO (built on 2018-26), NQ open run (built on 2023-26), ICT A-setups (built on 2018-26). **This is the window the verdict is decided on.** |
| W1-overlap (sensitivity) | 2008-01-01 .. 2017-12-31 | 2008-01 .. 2012-12; 2013-01 .. 2017-12 | the sub-span of W1 in which every system present in a book has a record for the whole span |
| **W2, built-on** | 2018-01-01 .. 2026-10-31 | 2018-01 .. 2022-12; 2023-01 .. 2026-10 | In-sample for the gold systems, Mosha BO and ICT (built on 2018-26); the first half is untouched for the replica, NQ open run and gmp (built on 2023-26), the second half is in-sample for every system. **Reported, never a test of an edge.** |
| **W3, recent** | 2023-01-01 .. 2026-10-31 | 2023-01 .. 2024-11; 2024-12 .. 2026-10 | In-sample for every system. Reported because the owner will ask about recent years. |

2026-10-31 is the last full month in every source. Positions booked in November 2026 are not used.

**Gaps (stated now).** In W1 book A has **no record for the Gold replica** (the #512 replay starts 2017-01 and has no 2017
position; the first position is 2018-02-08) and **none for the Gold momentum pullback** (the rebuild starts 2018-02); in W1
book A is therefore the six live systems that have a record there (`mosha-bo`, `gtrend`, `gtl`, `geg`, `nq-open`,
`ict-a`), and the ICT record starts 2008-01-02, so 2006-07 .. 2007-12 of W1 has no ICT bookings (W1-overlap removes that).
In W2 the replica record ends 2026-04-23 (the replay ran to 2026-11-06 and has no later position) and the Mosha record's
last position closes 2026-08-19. These are the only gaps; no system is dropped for its result.

## Metrics (per book, per window and half, at x1 and at x2 costs)

- Total net R; **R a year** = total / (days in span ÷ 365.25).
- **Worst drawdown**: largest peak-to-trough fall of the cumulative daily R, the peak floored at 0 (R).
- **Return / drawdown** = total R ÷ worst drawdown (undefined when the drawdown is 0).
- **Sharpe-like t** = mean daily R ÷ sd daily R × √(weekdays in the span); annualised Sharpe = mean ÷ sd × √252.
- **Share of months positive** = calendar months with a net R > 0 ÷ all calendar months in the span (a month without a
  closed position counts as not positive); also the share among months with at least one booking.
- Positive years ÷ years in the span.
- **Pairwise Pearson correlation of the gold systems' daily R** over the window's weekdays, zeros included, for every pair
  among `gtrend`, `gtrend5`, `gtl`, `geg`, `mosha-bo` and, where they have a record, `replica` and `gmp`.
- **Long-gold beta**: OLS of the book's daily R on gold's daily % return over the window's weekdays (days on which the gold
  series has a return). Reported: beta (R per 1 % gold day), its t, alpha (R a day) and **its t**, R², the correlation, and
  the beta share = beta × Σ gold % ÷ total R (how much of the total a constant long-gold position of that beta would have
  made).
- **Per market**: total R of each book by market of the position (gold; Nasdaq = `nq-open` + ICT NQ; S&P = ICT ES;
  Dow = ICT YM).
- By year: each book's R and each system's R.

## Noise test (decided now)

Paired block bootstrap by calendar month: the months of the window are resampled with replacement (the same draw of months
for every book), the drawn months' daily series are concatenated in draw order, and every metric is recomputed; 2,000 draws,
seed 1. Reported for each pair of books (B − A, C − A, C − B): the 90 % interval of the difference in return/drawdown and in
Sharpe-like t, and the share of draws in which the difference is above 0.

## Decision rule for the verdict line

On **W1 at x1 costs**, the best book is the one with the highest return/drawdown. The difference between it and the
runner-up is **more than noise** only if all three hold: (1) the paired bootstrap gives P(difference in return/drawdown > 0)
≥ 0.95; (2) the best book also has the higher return/drawdown in **both** halves of W1; (3) it also has the higher
return/drawdown at x2 costs. Otherwise the difference is **within noise** and the verdict says so. W2 and W3 cannot change
the verdict; they are reported next to it, labelled as built-on data.

Three books, one window, one metric: no selection among variants. The W1-overlap, the x2 run and the halves are
sensitivities on the same three books, not new candidates.

## What the verdict feeds

A written proposal to the owner on which systems should carry live paper risk and which should run as shadows, with the
sizes of the effects and the noise around them. Nothing in `council/`, `ict/`, the trackers, the replay or the site changes.
