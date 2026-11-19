# Gold H4 regime switch (trend breakout / range fade): pre-registration (14 Nov 2026)

Written and pushed alone, before any trade, regime label or statistic of this rule was computed.

## Question

The owner's notes say breakout systems work in trends and fail in ranges. On spot gold H4, does a switch that trades a
20-bar breakout when the market is trending and fades a Bollinger Band close when it is ranging (and does nothing in between)
make money after costs, and does it beat the same rules with the regime labels shuffled?

A NEW stand-alone rule. It is not a gate, exit, entry or size of the live gold book. Gold trend (`gtrend`) is a DAILY 20-day
breakout, long only, with a trailing stop and an add, always on; this is an H4 rule, both sides, that trades the breakout
only while an H4 efficiency-ratio label says "trending" and trades the opposite (a fade) while it says "ranging". It reads
none of the book's records and no candle before 2016 (docs/owner-decisions.md item 44). Paper research only: nothing live
changes and nothing here is read by the council, the mirror or the page.

## Dedupe (done before writing this)

- `regime-switch` (main, FAIL): VOL / TREND / META switches turning the council's EXISTING systems on and off (NQ open run,
  gold systems), daily indicators. Not a rule that changes what is traded by regime, not H4, no range fade.
- `regime` (main, FAIL): regime splits of the existing systems' records. Same difference.
- `gold-drd-er` (main, FAIL): the 20-day ER of DAILY closes as a filter on the playbook's daily rejection long. Daily, long
  only, one entry type.
- `gold-squeeze` (branch, FAIL): Bollinger-inside-Keltner squeeze, then a band-close BREAKOUT on H4. No ER regime, no fade.
- `gold-tsmom` (branch, FAIL): 12-month momentum. `trend-breadth-h1` (main, FAIL): the live daily trend rule on H1 candles of
  other markets. `gold-vwap` (branch, FAIL): session VWAP 2 sd fade / follow, intraday, no regime. `metals-rsi2` (branch,
  FAIL): 2-day RSI pullback. `nr7-breakout` (branch, FAIL): narrow-range day bracket. None combines a trend breakout and a
  band fade under one regime label, none on gold H4 with an ER switch.
- The untested backlog (`research/proposals/2026-11-14-untested-backlog.md`, branch `untested-backlog`) does not list it.

## Market and data (fixed now)

- One market: spot gold, OANDA mid XAU/USD, H4, UTC alignment, through the candle proxy `https://meridianx.dev/md/bars`
  (`sym=xau&tf=4h`), fetched by `fetch.mjs` from 2016-01-01 00:00 UTC to the run date. Candles before 2016-01-01 are dropped
  even if a cache holds them; indicators warm up inside January 2016 (no signal until every indicator is defined). Complete
  candles only. The cache is kept out of git.

## Indicators (on closed candles; bar i includes its own close; nothing after bar i is read)

- **Regime measure (the ONE pre-registered measure): the 20-bar efficiency ratio**
  ER(i) = |C(i) − C(i−20)| / Σ_{j=i−19..i} |C(j) − C(j−1)| (0 when the sum is 0).
  - TREND when ER(i) > 0.35; RANGE when ER(i) < 0.20; NEUTRAL otherwise (0.20 ≤ ER ≤ 0.35). ADX is not used.
  - Trend direction D(i) = sign(C(i) − C(i−20)).
- ATR(14) = simple mean of the last 14 true ranges (true range uses the previous close).
- Donchian: H20(i) = max high of bars i−20 … i−1, L20(i) = min low of bars i−20 … i−1 (the 20 bars BEFORE i).
  Exit channel: H10 / L10 the same over bars i−10 … i−1.
- Bollinger: middle M(i) = SMA(20) of the close; bands M ± 2 × population sd of the last 20 closes.

## Rules

Both legs: entry at market at the open of bar i+1; stop 1.5 × ATR(14) of bar i from the fill (every trade has it); a candle
that opens beyond the stop fills at its open (gap); the stop is checked on every candle from the entry candle on, before any
other exit; time exit at the close of the 30th H4 candle after entry (five trading days). Every other exit is a close-based
signal filled at the NEXT candle's open. A trade whose exit candle is not yet printed is left out (still open).

- **Breakout leg (TREND only)**: regime(i) = TREND and C(i) > H20(i) and D(i) = +1 → buy; regime(i) = TREND and
  C(i) < L20(i) and D(i) = −1 → sell. Exit on a close below L10 (buy) / above H10 (sell), the stop, or time.
- **Fade leg (RANGE only)**: regime(i) = RANGE and C(i) > upper band(i) → sell; regime(i) = RANGE and C(i) < lower band(i)
  → buy. Exit on a close back at or through the middle band (sell: C ≤ M; buy: C ≥ M), the stop, or time.
- NEUTRAL: nothing new is opened. An open trade is managed by its own exits whatever the regime later becomes.
- One position at a time per test stream; a signal while that stream's position is open is skipped (not queued).

## Tests (three, Holm over the three)

- **T1 (primary)**: the switch: both legs in one stream, one position at a time.
- **T2**: the breakout leg alone (TREND regimes only), its own stream.
- **T3**: the fade leg alone (RANGE regimes only), its own stream.

Descriptive only, never a test: the breakout on every bar whatever the regime, the fade on every bar whatever the regime
(so the reader sees what the labels add), the share of bars in each regime, results by side and by year.

## Costs

- $0.30 a round trip (spot gold spread, as `gold-squeeze`) plus half a spread of slippage on the market entry and half a
  spread on the market exit: $0.60 a trade in price, divided by the risk (1.5 × ATR(14)) for R. Stop and time exits are market
  orders too, so every trade pays the same $0.60.
- Financing on buys: `council/fills.mjs` `nights(entry, exit)` × `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's XAUUSD swap of 11 Nov 2026) × entry price / risk. Sells are credited nothing.
- 2× costs doubles spread, slippage and financing.

## Windows and statistics

- In sample: entries 2016-01-01 to 2020-12-31. Out of sample: entries 2021-01-01 to the last complete candle.
- R per trade, gross and net. t = mean / sd × √n of calendar-month sums of net R (empty months count as 0) over the window,
  one-sided p from the normal tail, Holm over T1-T3.
- **Placebo (40 seeds, 1-40)**: the regime label series (TREND / RANGE / NEUTRAL per bar) is cut into blocks of 20 bars and
  the blocks are shuffled (seeded); trend direction, channels, bands, ATR, stops and exits are the real ones. The same test is
  run on the shuffled labels; its OOS mean net R a trade per seed gives the placebo median and 95th percentile.

## Pass bar (a test passes only on all four)

1. OOS net t ≥ 2 and its Holm-adjusted p ≤ 0.05;
2. in-sample net R a trade > 0 (same sign);
3. OOS net R a trade > 0 at 2× costs;
4. OOS net R a trade above the placebo's 95th percentile.

**The verdict is T1's.** T2 and T3 are reported with their own checks. A pass would be a candidate for the owner, never a
live rule; a fail ends this reading (no re-cut of the ER thresholds, the channel lengths or the stop on this data).
