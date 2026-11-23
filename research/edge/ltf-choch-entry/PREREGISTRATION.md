# A lower-timeframe ChoCh as the entry at an H4 / H1 key zone: pre-registration (23 Nov 2026)

Written and committed before any trade of this rule is computed. Research only: nothing live changes, no proposal follows
unless the owner asks. The claim tested is the owner's: "an M5 / M1 ChoCh on entry is better". 2020-now has been read by many
studies of these zones (`combo-grid`, `combo-grid-2`, `ltf-structure`), but never with this entry; it is the only window with
1-minute candles in the cache, so it is used, split in two.

## The rule (written once, not tuned)
- **Zones** on H4 and H1 (5m candles resampled UTC-aligned, `combo-grid/run.mjs` `frames` / `buildZones`, closed candles only):
  kinds `eg` (engulf zone, up to 3 candles), `ef` (a failed engulf zone, served to the other side), `bar` (the origin candle of
  a structure break, `structure(L, 3)`), `dom` (two same-colour candles, the body of the first). A zone is known at the close of
  the candle that makes it and stands until a close through its far side (or the end of its life), exactly as in the grids.
- **Touch**: the first, and then the second, visit of price to a standing zone, read on 5-minute candles: a 5m candle starting
  at or after the zone is known that trades into it (low <= top and high >= bottom). A visit ends at a closed 5m candle wholly
  outside the zone. t0 = the start of the touching 5m candle.
- **Wait**: from t0, up to 12 hours for an H4 zone and 4 hours for an H1 zone, and only while the zone stands, for the FIRST
  ChoCh in the zone's direction on the entry timeframe: an event of `edgekit.structure(bars, 2)` with `dir` = the zone's side
  and `kind` 'ChoCh' (the entry timeframe's side was the other way), whose candle closes after t0. No such ChoCh = no trade.
- **Entry A (primary)**: market at the open of the first candle starting at or after the ChoCh candle's close.
  **Entry B (descriptive)**: a limit at the level the ChoCh broke, valid 12 entry-timeframe candles from the ChoCh close; a
  candle that closes past the stop before the fill cancels it (the grids' rule).
- **Stop**: past the extreme made since the touch (the lowest low for a buy, highest high for a sell, from t0 to the ChoCh
  candle's close, read on the simulation candles below), plus half the market's round-trip cost. A stop under 2 x the cost from
  the reference price (the ChoCh close for A, the level for B) = no trade (the grids' size floor).
- **Exits** (one pass, `combo-grid/run.mjs` `multi`): 2R, 3R, and the far target = the near edge of the nearest opposite H4 or
  D1 (17:00 New York days) `eg` / `ef` zone standing at the entry and ahead of the price, only when it is >= 3R away (else no
  trade for that exit). Time exit at the close of the candle reaching 5 days after the fill for H4 zones, 2 days for H1 zones.
- **Entry timeframes**: M15 (control), M5 (all 18 markets), M1 (xau, eurusd, gbpusd only: the 1-minute cache).
- **Simulation candles**: 1-minute candles for M1 entries, 5-minute candles for M15 and M5 entries (OANDA mid, the edgekit
  cache). On a limit's fill candle only the stop counts; a candle that holds both stop and target is a stop; a gap past the
  stop exits at the open.
- **One trade per ChoCh**: when several zone touches lead to the same entry-timeframe ChoCh, the trade of the earliest touch is
  kept (ties: H4 before H1, then `eg`, `ef`, `bar`, `dom`, then first visit before second). Concurrent trades are allowed.
- **Markets**: xau, eurusd, gbpusd, usdjpy, audusd, nzdusd, usdcad, usdchf, eurjpy, xag, gbpjpy, eurgbp, audjpy, cadjpy,
  euraud, nas100, spx500, de40. Costs: `combo-grid-2/run.mjs` `COSTS` (round trip in price units), taken off each trade in R of
  its own risk. Trades whose fill falls inside a `data-quality` bad interval (`combo-grid-2` `exclusions`) are dropped.

## Data windows
Fills from 2020-01-01 to the last candle in the cache: discovery 2020-01-01 to 2023-12-31, confirmation 2024-01-01 to the end.
Month sums by fill month, empty months counted as 0.

## Tests (Holm over the four one-sided confirmation p values)
1. **T1**: M5 ChoCh, entry A, 2R, all 18 markets pooled.
2. **T2**: M1 ChoCh, entry A, 2R, xau / eurusd / gbpusd pooled.
3. **T3**: M5 minus M15 (entry A, 2R, the same zones, all 18 markets): mean R a trade of the M5 trades minus that of the M15
   trades, Welch t on per-trade R after costs (the owner's claim that the lower timeframe is better).
4. **T4**: M1 minus M5 (entry A, 2R, the three markets), the same way.

## Pass bar
- **T1, T2** PASS only if: discovery n >= 100, mean R after costs > 0, month-sum t >= 2; confirmation n >= 50, mean > 0,
  month-sum t >= 2 and Holm-adjusted p < 0.05; confirmation mean > 0 at twice the cost.
- **T3, T4** PASS only if the difference is > 0 with Welch t >= 2 in BOTH windows, Holm-adjusted p < 0.05 on the confirmation
  one, it stays > 0 at twice the cost, and each side has n >= 100 in discovery and >= 50 in confirmation.
- **FAIL**: confirmation mean (or difference) <= 0, or discovery mean (or difference) <= 0, or negative at twice the cost.
- **INCONCLUSIVE**: positive everywhere but a t bar, a count or Holm missed.
- The study's verdict is PASS if T1 or T2 passes (a passing entry rule) and FAIL if every test fails; otherwise INCONCLUSIVE.
Reported only, no verdict: entry B, 3R, the far target, H4 against H1 zones, each zone kind, each market, before costs, the
year table. No other wait, swing size, stop, target or market set is tried after the result; a follow-up needs its own
pre-registration on other data. Never call a pass an edge beyond its n and t; a pass only earns a forward paper record.

## Look-ahead and checks
Every output uses candles closed by its moment: zones at their close, the ChoCh at its candle's close, the extreme from candles
closed by the ChoCh close. An offline test runs the whole rule on synthetic candles, changes every price after a cut and checks
that every trade closed before the cut is unchanged; another checks every trade's stop is on its losing side.

## Amendment before the run (23 Nov 2026)
The owner asked for the judgement BEFORE costs ("forget the costs, I only want to know before costs"). Committed before the
full run. Every pass / fail bar above (means, month-sum t, Welch t, Holm) is applied to R **before costs**; the condition
"positive at twice the cost" is dropped. The after-cost figures and the twice-cost figures are reported beside, with no
verdict. Costs still set the stop's half-cost buffer and the 2 x cost size floor (the rule itself is unchanged).
Said plainly: before this amendment one smoke run of the code was made on gold alone, with 1-minute candles for 2019-2020 only
(to check the code runs); its pooled 2020-26 figures for gold were seen (2R before costs about +0.03R a trade on M15, +0.005R
on M5, -0.02R on M1). No other market, window split or test statistic was computed.
