# Do big crude-oil days (and big copper days) lead spot gold? Pre-registration

Written and committed **before** any number below was computed (14 Nov 2026). The data, the markets, the signal, the trade,
the costs, the statistics and the pass bar are fixed here; anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **This is a standalone cross-asset signal study.** It is not a gate, filter, size step, entry or exit
for the live gold book (Gold trend, Gold daily engulf) and must never be read as one. Owner decision 44 (docs/owner-decisions.md)
stopped further tests of gates, exits, entries or sizes on that book's 2006-17 window; this study tests no lever of that
book, takes none of its trades, and is judged on its own out-of-sample window (2017 on). The 2006-16 window is used only as
the in-sample half of this signal, never to judge or adjust the gold book. No live rule, size, filter, stop, config, cost
constant or council member changes, whatever the outcome.

## Question

After a crude-oil day whose close-to-close move is unusually large (beyond two standard deviations of its own recent daily
returns), does spot gold move in the same direction over the next three trading days (an inflation-expectations channel),
or the other way, by enough to trade on gold after costs? And does the same hold after an unusually large copper day?

## Dedupe (read before writing this)

- `intermarket-lead` (branch `intermarket-lead`): MONTHLY leaders (US500, copper, the dollar into the metals); not a
  daily oil or copper shock into gold. FAIL.
- `copper-gold` (#854): the 13-week copper / gold ratio as a risk signal for US indices, weekly. FAIL. Not gold as the
  traded market, not daily.
- `gold-silver-divergence` (#870), `gold-silver-ratio` (#829): gold vs silver divergence / ratio mean reversion. Not a
  big-day lead.
- `gold-haven-shock` (branch): equity shock days into gold (1 and 5 days). FAIL. Same trade shape, other signal market.
- `gold-shock-revert` (branch): gold's OWN extreme day into the next day. FAIL. This covers "gold leads itself"; "gold leads
  oil" is not tradeable on gold and is not tested here.
- `macro-gold` (main): real yields, breakevens; no oil. `brent-wti-spread` (#933): the oil spread, oil traded. `commodity-fx-lead`
  (#899): big WTI days into USD/CAD, FAIL. `yield-fx-weekly` (#942): 2-year yields into the dollar.
- No committed study tests a big oil day (or a big copper day) into gold over the next days. This is new.

## Data (no network)

- OANDA mid daily candles, UTC alignment, from the council's research cache on the `council-data` branch
  (`research/daily/xau.json`, `wtico.json`, `bco.json`, `xcu.json`; read with `git show origin/council-data:<path>`; the commit
  is recorded in `result.json`). At the time of writing: xau 2006-03-20, wtico 2003-01-23, bco 2003-08-19, xcu 2003-03-31,
  all to 2026-11-06. `node run.mjs fetch <dir>` copies them out of git (kept out of the repository); `node run.mjs full <dir>`
  runs the study.
- Weekend candles (the Sunday reopen stub, rare Saturday prints) are folded into the next weekday with `council/fills.mjs`
  `foldWeekend` (imported), the same way for every market, so each row is a Monday-Friday UTC day.
- **Market set, fixed now**: signal markets `wtico` (WTI, tests T1 and T2), `xcu` (copper, test T3); `bco` (Brent) is run with
  the T1 rule as an informational replication only (no test, not in Holm, not in the verdict). Traded market: `xau` only.
  Silver is not a signal market here (it moves with gold on the same day; the gold / silver studies above cover it).

## Signal

- Signal-market day return `r_D = close_D / close_{D-1} - 1` on the folded candles.
- `sd_D` = sample standard deviation of the 60 returns `r_{D-60} … r_{D-1}` (days strictly before D; D's own return is not
  in it). A day needs 61 earlier closes to be eligible.
- **Big day**: `|r_D| > 2 × sd_D`. Direction `s = sign(r_D)` (+1 an up day, −1 a down day).
- **Alignment.** The OANDA UTC daily candle of day D closes at 00:00 UTC of D+1 for oil, copper and gold alike. The signal
  is known at that moment. The first gold price after it is the open of gold's first folded daily candle whose day is
  **later than D** (D+1 Monday-Thursday; after a Friday signal the Monday candle). **Entry = that candle's open.** No price of
  that candle or later is used by the signal, the ATR or the stop. Oil and gold days are matched by their UTC day stamp,
  never by row number.

## Trade (every trade has a stop)

- **T1 (primary) follow oil**: trade gold in direction `s` (long after a big oil up day, short after a big oil down day).
- **T2 fade oil**: trade gold in direction `−s` on the same WTI signal days.
- **T3 follow copper**: trade gold in direction `s` after a big copper day.
- **Stop** = 2 × gold's ATR(20) from the entry (below a long, above a short). ATR(20) = simple mean of the 20 true ranges of
  the folded gold candles before the entry candle (none of the entry candle). 1R = the stop distance.
- **Exit** at the close of the 3rd gold candle, counting the entry candle as the first. Before that, the stop: on the entry
  candle a low (long) / high (short) through the stop exits at the stop; on a later candle an open through the stop exits at
  that open (gap), else a low / high through the stop exits at the stop. A trade whose gold candles end before its exit is
  left out (open).
- **One position at a time** per test: a signal whose entry candle is not after the open trade's exit candle is skipped.
- **Costs** (net R):
  - $0.30 spread a round trip plus half a spread ($0.15) of slippage per market order; entry, the time exit and a stop are
    all market orders, so $0.30 + 2 × $0.15 = **$0.60 a trade**, ÷ risk.
  - Financing on **longs only** by `council/fills.mjs` `nights` and `FIN.xau.long` (imported, not copied; the demo broker's
    XAUUSD long swap, 0.000148 of price a rollover, Wednesday three, source in fills.mjs): `nights(entryT, exitT) ×
    FIN.xau.long × entry ÷ risk`. Shorts are charged and credited nothing (`FIN.xau.short` 0, as every model here). Entry
    stamp = the entry candle's day 00:00 UTC; exit stamp = the exit candle's day end (23:59:59 UTC) Monday-Thursday and
    21:59:59 UTC on Friday; a stop exit is stamped at its candle's end too (the cautious side). Today's rate for every year.
  - **2x costs**: the $0.60 and the financing both doubled.
- Gross R = s_trade × (exit − entry) ÷ risk.

## Windows

- **In sample (IS)**: signal days from the first day with gold's ATR and the 60-day sd available (gold from 2006-03-20) to
  2016-12-31.
- **Out of sample (OOS)**: signal days from 2017-01-01 to 2026-10-31.
- Reading of decision 44: these windows serve this signal only; IS overlaps the gold book's history but no result here is
  read as evidence about, or a change to, that book.

## Statistics

- Per test and window: n (long / short), win rate, mean gross R, mean net R, total net R, stop count, mean net R at 2x
  costs, t on **calendar-month sums of net R** (months by exit stamp; every calendar month of the window counts, empty ones
  as 0), and the plain per-trade t. Gross month t too.
- **p** = one-sided normal upper tail of the OOS month-sum t of net R. **Holm** over the three tests (T1, T2, T3).
- **Placebo**: 40 seeds (1-40, a seeded generator). Each draws, from the OOS window's eligible days of that test's signal
  market, the same number of days as the real signal days, at random, and gives them the real days' sides in a random order
  (the same long / short mix), then runs the identical trade and statistics (one at a time). Reported: each seed's OOS
  month-sum t, how many reach t ≥ 2, how many reach the real t, the median. Informational, not part of the bar.

## Pass bar (per test)

1. OOS month-sum t of net R ≥ 2 **and** Holm-adjusted p < 0.05;
2. IS mean net R a trade > 0 (the same sign);
3. OOS mean net R at 2x costs > 0;
4. OOS n ≥ 30.

Verdict: **PASS** if T1 (the primary) passes; **PARTIAL** if T2 or T3 passes but T1 does not; **FAIL** if none passes. A
pass makes this a paper lead worth a forward record with its own proposal, nothing more: no live change follows from
this study.

## What is not tested

Other thresholds, look-backs or holds; intraday entries at the oil settlement; gold leading oil (not tradeable on gold);
silver or other metals as signal markets; natural gas; any use inside the gold book. A changed rule after seeing results
is post hoc and must say so.
