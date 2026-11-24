# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on gold priced in pounds (XAU/GBP) (24 Nov 2026)

Written and pushed alone, before any XAU/GBP trade of this rule is computed. The test runs once; nothing below is changed after
a result is seen. Paper research only: nothing live changes, no council member, page, mirror or config reads it.

## The question
`gold-eur-vol-breakout` found T1 (UTC open ± 0.5 × the previous folded day's range, stop back at the open, out at 21:00 UTC)
on gold priced in euros: +0.067R a trade net (n 3,873, month t 3.50, 40 of 40 placebos), with the later half alone at month t
1.66. `gold-vol-breakout` (and its replicate, histdata, k and exec studies) found it on XAU/USD; `index-vol-breakout`,
`silver-vol-breakout`, `pgm-vol-breakout`, `energy-vol-breakout` failed on other markets. **Is the breakout a gold effect
whatever the currency gold is priced in?** A third quote currency, the pound, where both the dollar and the euro legs are out.

- Dedupe (read before writing): `gold-eur-vol-breakout`, `gold-vol-breakout` (+ `-replicate`, `-histdata`, `-k`, `-hourcost`,
  `-exec`, `-forward`), `index-vol-breakout`, `fx-vol-breakout`, `yen-crosses-vol-breakout`. No study has run any rule of this
  family on XAU/GBP (a grep for `xaugbp` finds only daily-cache uses in other studies).
- **Stand-alone.** Never a gate, exit, entry or size of the live gold book (owner decision 44); no live record is read.
- **Only the market changes.** The trading functions are imported unchanged from
  `research/edge/index-vol-breakout/original.mjs` (sha256 `afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f`,
  checked at run time and in the test; byte-identical to `gold-eur-vol-breakout/original.mjs`): `buildDays`, `daySkip`,
  `vbTrade`, `placeboTrade`, `monthT`, `normP`, `rng`, `quantile`, `summary`, `TESTS.T1`, `SEEDS`, `PLACEBO`, `COST`.

## Data
OANDA mid XAU/GBP (`xaugbp`, instrument `XAU_GBP`) M5 candles read through the keyless candle proxy
(`/md/bars?sym=xaugbp&tf=5m&from=&to=`), cached out of git (`xaugbp-5m.json.gz`, rows `[t, o, h, l, c, v]`). Before this file
was written only the cache's shape and span were looked at (first served candle March 2006, as XAU/EUR). No price, range or
trade was computed. The forming last day is left out. D1 = the complete UTC day built from the M5 candles, Saturday / Sunday
folded into the next weekday (`foldWeekend`), as the original; day skips as the original.

## Rule (T1, unchanged)
O = open of the day's first M5 candle at or after 00:00 UTC; buy stop O + 0.5 × prevRange and sell stop O − 0.5 × prevRange
live 00:00-20:55 UTC, first filled wins, one trade a day; a gap fills at the candle's open; a candle reaching both: the level
nearer its open. Stop = O; out at the close of the last M5 candle starting before 21:00 UTC. No target.

## Costs (exactly gold-eur-vol-breakout's model)
- **0.016 % of the day's open a round trip** (`gold-eur-vol-breakout` `COST_PCT = 0.00016`: the XAU/USD study's $0.60 scaled
  to price at $3,700), passed per day as `vbTrade`'s `cost`. **Stated, not measured**: no XAU/GBP spread is measured in the
  repository and XAU/GBP's spread is likely wider than XAU/USD's.
- Financing: the original's `FIN.xau.long` × `nights` on buys (assumed for XAU/GBP; no T1 trade crosses the 22:00 rollover).
- 2x costs = twice both, reported and used in the bar.

## Windows
- **Discovery: the first full month served (2006-04-01) → 2015-12-31. Confirmation: 2016-01-01 → 2026-10-31.** Both are new
  for this market (no rule of this family was ever run on XAU/GBP); pooled reported.

## One test, the bar
One test (T1 on XAU/GBP); Holm over one test is its own p (one-sided normal p of the confirmation month t).
PASS only when ALL hold:
1. confirmation month-sum t of net R ≥ 2;
2. net R a trade > 0 in discovery AND in confirmation;
3. confirmation net R a trade > 0 at 2x costs;
4. **placebo**: on the confirmation window the real mean net R beats at least 38 of 40 placebo seed means (the original's
   placebo: every day T1 could trade, a market entry at a random M5 open 01:00-18:00 UTC, fair-coin side, stop 0.5 × prevRange
   away, out at 21:00 UTC or the stop, the same cost per day; seeds 1-40);
5. n ≥ 200 in confirmation.

## Secondary, descriptive (no pass / fail)
- T1 on XAU/USD (edgekit's OANDA mid xau 5m cache, the original's $0.60 a round trip) on the same windows.
- **Correlation of monthly net-R sums** of XAU/GBP T1 and XAU/USD T1 over the months both traded (expected high, which would
  mean XAU/GBP adds little to a book holding XAU/USD); also daily R correlation and the same-side share on days both traded.
- A pass says the breakout does not depend on the quote currency; it is not a second, independent stream and not an edge to
  trade. Whatever the verdict, nothing live changes and no proposal is written.
