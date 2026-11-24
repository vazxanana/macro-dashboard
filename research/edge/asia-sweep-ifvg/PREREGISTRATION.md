# Asia range swept in the London morning, entered on a 5-minute inversion fair value gap (pre-registration, 24 Nov 2026)

Written and committed alone BEFORE any run on real candles. Research only: nothing live reads this folder, nothing is placed, no
rule, size, stop or config changes, and no rule is proposed whatever the result.

## Why, and what is already tested

Two studies here already read the Asia range:

- `research/edge/session-sweep`: a sweep of the Asia range, then a 5-minute structure break (QM) back inside, target the other
  side. INCONCLUSIVE: 27 out-of-sample trades in two markets (the QM almost never forms inside the window).
- `research/edge/asia-box-london`: the first M15 close out of the 00:00-07:00 UTC box traded with it, faded, as a false break and
  as a second break. FAIL, 0 of 44 cells after costs.
- Near relatives: `grid7-wide-sweeps` (Asia sweeps with an M15 close back, FAIL), `smc-sweep-fvg` (an H1 sweep, a 5-minute change of
  character and a LIMIT resting in the gap it leaves, FAIL), `fx-asia-london-reversal`, `gold-asia-break`.

None of them uses the entry asked for here: a fair value gap left by the leg that made the sweep, entered when a later 5-minute
candle CLOSES back through that gap (the gap "inverts"), at market, with the stop past the sweep's extreme and the targets inside
the Asia range itself. That is this study. It differs from `session-sweep` only by the entry trigger (and by fixed UTC hours),
so the question is narrow: does the inversion close make the swept Asia range a tradable reversal after costs?

## Data

- OANDA mid 5-minute candles from the shared cache (`research/edge/_lib/edgekit.mjs` `load`), read only, no network.
- Markets (5): xau, eurusd, gbpusd, usdjpy, audusd (gold's candles start in March 2006).
- Costs: `research/edge/combo-grid-2` `COSTS` (imported; a round trip in price units: gold 0.30, EUR/USD 0.00006, GBP/USD 0.00008,
  USD/JPY 0.008, AUD/USD 0.00006), taken off every trade in R. No financing (every trade ends the same UTC day).
- Exclusions: `combo-grid-2` `exclusions(market)` (the data-quality bad intervals); a trade whose fill falls inside one is dropped.
- Windows by FILL time: **discovery 2005-01-01 to 2014-12-31** (120 calendar months), **confirmation 2015-01-01 to 2026-10-31**
  (142 calendar months). Month sums count every calendar month of the window, an empty month as 0.

## The rule (a SELL after a sweep of the Asia high; a BUY after a sweep of the Asia low mirrors every step)

All clocks are UTC. Days are UTC weekdays, Monday to Friday. Only closed 5-minute candles are read; "candle" below is M5.

1. **Asia range** of day D: highest high (AH) and lowest low (AL) of the candles that START in [00:00, 06:00). A day with fewer
   than 54 of those 72 candles, or AH = AL, is skipped. Mid = (AH + AL) / 2. Known at 06:00.
2. **Fresh side**: the Asia high is fresh when no candle starting in [06:00, 07:00) traded above AH.
3. **Sweep**: the first candle starting in [07:00, 10:00) whose high is above a fresh AH. No such candle: no setup on that side.
4. **Sweep extreme** at any later candle j: the highest high from the sweep candle to candle j, and the first candle that made it
   (the extreme candle).
5. **Leg gaps**: a three-candle up gap = consecutive candles a, b, c with low(c) above high(a); its lower edge is high(a). It
   belongs to the sweep leg, as read at candle j, when candle a starts no more than 60 minutes before the sweep candle starts (at
   most 12 candles back) and candle c is the extreme candle or earlier, and c is before candle j. A gap is spent once any candle
   after c has closed below its lower edge.
6. **Inversion (the trigger)**: the first candle j, from the sweep candle on and starting before 12:00, that closes below the lower
   edge of a leg gap not yet spent AND closes below AH (back inside the Asia range). A candle that closes below the edge but not
   below AH spends that gap without a trade.
7. **Cancelled**: the setup of that side ends, with no trade, as soon as a candle from the sweep candle on trades at or below the
   Mid (the candle that does so cannot be the trigger), or when no trigger has come by the last candle starting before 12:00.
8. **Entry**: market, at the open of the next candle after the trigger candle (skipped when that candle starts more than 5
   minutes after the trigger candle closed). **Stop**: the sweep extreme as read at the trigger candle, plus one round-trip
   cost of the market. Skipped when the risk (stop minus fill) is not above one round-trip cost.
9. **Exits** (edgekit `simulate` on M5): the stop, the target, or the close of the candle that ends at 16:00 of day D. A candle
   that holds both stop and target is a stop; a candle that opens past the stop exits at its open.
10. **One trade a market a day and cell**: of the two sides, the one whose trigger candle closes first.

## Cells (4; the first two are judged)

| Cell | Entry trigger | Target | Skipped when the target is nearer than |
|---|---|---|---|
| `ifvg mid` (judged) | step 6 | the Asia Mid | 0.5R from the fill |
| `ifvg far` (judged) | step 6 | the far side of the Asia range (AL for a sell) | 1.0R from the fill |
| `reclaim mid` (control) | the first candle from the sweep candle on, starting before 12:00, that closes back below AH; steps 7-10 the same | the Asia Mid | 0.5R |
| `reclaim far` (control) | the same | the far side | 1.0R |

The controls answer one thing: whether waiting for the gap inversion does better than simply entering on the first close back
inside the range. They are reported beside the judged cells (mean R, month t, and the plain difference of means) and never judged.

## Pass bar (each judged cell on its own, the five markets pooled)

n >= 300 in discovery AND in confirmation; mean R a trade AFTER costs above 0 in both windows; the t of the calendar-month sums
of after-cost R at least 2 in both windows; and the Holm-adjusted one-sided p of the confirmation month t (over the 2 judged cells)
under 0.05.

- **PASS**: at least one judged cell meets the whole bar.
- **INCONCLUSIVE**: no judged cell has 300 trades in both windows.
- **FAIL**: anything else.

## Reported, never judged

Before-cost and after-cost mean R, win rate and month t of every cell in both windows; the judged cells by market and by side; exits
by type; how many setups each step removes (days, fresh sweeps, cancelled, no gap or no inversion, skipped at entry); the last
candle on file. One run of the final code; no setting (hours, the 12-candle look-back, buffers, reward floors, the 16:00 exit) is
changed after a result. A PASS would be a hypothesis for a holdout test on other markets, never called an edge here.
