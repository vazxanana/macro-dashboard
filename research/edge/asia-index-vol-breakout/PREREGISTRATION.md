# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on Asian index CFDs (JP225, AU200, HK33), 24 Nov 2026

Written and pushed alone, before any trade of this rule on these markets is computed. The test runs once; nothing below is
changed after a result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads
it. Not part of the ICT edge.

## Why, and what was read first
- T1 (UTC open ± 0.5 × the previous day's range, stop at the open, out at 21:00 UTC) passed on gold and USD/JPY; the gain sits
  in early fills: `vb-early-exec` (fill before 06:00 UTC beat later fills at the broker's own ticks, pooled Welch t 2.42) and
  `holdout-vb-early` (early fills on the untouched holdout +0.063R, month t 2.22, FAIL on Holm and 2x costs). Before 06:00 UTC
  is the Asian session. The question: does T1 hold on the Asian index CFDs, whose own cash session is those hours?
- Dedupe: `index-vol-breakout` (T1 on NAS100 / SPX500: FAIL, gross +, net ≈ 0), `nas-vol-breakout-early`, `index-vol-breakout-hourcost`
  (US indices only); `gotobi-jp225` (a fixed-time fade on JP225, FAIL), `us-asia-lead` (US session direction into JP225 / HK33,
  FAIL), `intl-index-orb` (5-minute opening range breakout on JP225 / AU200 among others, FAIL). None places T1's stop orders on
  JP225, AU200 or HK33. Not answered before.

## Data (named before any result)
- OANDA mid M5 through the candle proxy into the edgekit cache outside git: `jp225` (JP225_USD), `au200` (AU200_AUD), `hk33`
  (HK33_HKD), 2005 → 24 Nov 2026. Only their span, rows per year, the UTC hours that carry candles and the count of weekdays with
  200+ candles in 00:00-20:55 UTC were looked at (no price statistic, no trade). Seen on JP225: before 2012 the file carries no
  candles in the Asian hours (US-session only), so those days have no 00:00 candle and are skipped by the rule's own skip;
  JP225 days with 200+ candles: 9 in 2010, 12 in 2011, 187 in 2012, 246-259 a year from 2013. AU200: 200+ candle days 29-65 a
  year 2007-2013 (gappy file), 220 in 2014, 247-251 a year from 2015; its 00:00 UTC hour carries candles.
- **HK33 cannot be tested with the rule unchanged, and is dropped before any trade is computed.** OANDA's HK33 CFD carries no
  candle in 00:00-00:55 UTC in any year (session from about 01:00 UTC, halts around 04:00, 08:00 and 19:00-24:00 UTC) and no
  weekday in 2005-2026 has 200 candles in 00:00-20:55 UTC: every day would be skipped by T1's own skips ("noopen" / "thin").
  Moving the open or the 200-candle floor would be a different rule, which needs its own pre-registration; it is not done here.
  So the tests are JP225, AU200 and their pool (three, not four).
- Trading days = UTC Monday to Friday; the forming last day is left out; every market ends on the earliest last complete day.

## Rule (T1, unchanged)
- `vbTrade`, `buildDays`, `daySkip`, `placeboTrade`, `summary`, `monthT`, `normP`, `holm`, `rng`, `quantile` imported unchanged
  from `research/edge/index-vol-breakout/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f,
  checked at run time), and the index `recost` from `research/edge/index-vol-breakout/run.mjs`. k 0.5, both sides, O = open of
  the first M5 candle 00:00-00:55 UTC, prevRange = previous weekend-folded UTC D1 range, stop at O, out at the close of the last
  candle before 21:00 UTC. Skips: no previous day, flat previous day, no 00:00-00:55 candle, fewer than 200 candles.

## Costs (preset)
- Round trip **0.04 % of the trade's entry price** for both markets (HK33 would have had the same) (`gotobi-jp225`'s JP225 figure; assumed, not measured
  on the demo account). Taken off every trade in R. 2x as a check.
- Financing: index-vol-breakout's formula (DGS2 assumed 5 %), per 22:00 UTC rollover; exits are at 21:00 UTC so it is 0.

## Windows
- Discovery: each file's start to 2015-12-31 (in practice from when each file carries Asian-hour candles). Confirmation:
  2016-01-01 to the last complete day.

## Tests (3) and statistics
- T-JP225, T-AU200, T-Pool (both markets' trades together). Statistic: t of calendar-month sums of net R in the confirmation
  window; one-sided normal p; Holm over the three.
- Placebo, 40 seeds (seeds 1-40), confirmation window, per market (pool = both markets' placebo trades of the same seed):
  on every day the rule could trade, one market entry at a random 5-minute mark 01:00-18:00 UTC, side by a fair coin, stop
  0.5 × prevRange away, out at 21:00 UTC or the stop, the same cost.
- Reported only, never a test: early (fill candle before 06:00 UTC) against late fills, by side, by year, gross figures.

## Pass bar (index-vol-breakout's, with this study's n)
A test passes only when ALL hold: net R a trade > 0 in discovery AND confirmation; confirmation month t ≥ 2 AND Holm p < 0.05;
confirmation net R > 0 at 2x cost; the real confirmation mean beats ≥ 38 of 40 placebo means; n ≥ 200 in confirmation and
≥ 30 in discovery. A pass is paper research only, at most a hypothesis for a forward record with its own pre-registration.
Gross positive and net not: "a before-cost tilt is not an edge".
