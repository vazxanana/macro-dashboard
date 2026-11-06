# Daily review, 2026-11-06: a big shadow day (+88R) that the long history says not to chase; live systems quiet, one gold limit order waiting.

## Today
- **Live systems: none closed.** One order is live: the gold engulfing desk (geg) has a buy limit pending at 3979.36 (stop 3907.61) at the top of the H4 demand zone 3912–3984, with price 4091 above the 50-SMA 4043.
- Gold replica: the volatility gate stayed off (20-day range 1.39% vs the top-fifth level 2.42%). Gold trend: 4091 vs the 20-day high 4204, no breakout. Weekly structure still bearish.
- NQ: no open-run trade; last 27,118. Crypto trend: BTC 15% and ETH 26% under their 55-day highs; nothing to do.
- Shadow (retired desk setups): 131 opened, 103 closed, 43 wins / 60 losses, **+88.1R**. Biggest: gold Scalp +20.75R (14), gold M30→M1 +22.75R (12, the same entries as the gold Scalp, counted twice: dedupe merged today, PR #259), XRP Scalp +16.5R, gold Retrace-intraday 5/5 +14.9R, EUR/USD Scalp +7.8R, GBP/USD Scalp +6.1R. Losers: XRP Retrace-scalp −3.9R, SOL Scalp −3R.

## What worked / what didn't
- Worked: the shadow setups caught a one-way gold move. Without the m30m1 duplicates the day is still about +65R.
- Didn't: one good day doesn't change the long history. The 150-day shadow replay (Jun–Oct, 8,134 setups) runs about −0.15R a trade, and the 2023–26 gold backtest loses in both halves. Yesterday the same setups were −11R.
- Owner loss reviews: none written yet (ownerReviews n=0), so no candidates to test.

## Patterns over the last 30 days (all closed, live + shadow)
- Scalp 266 trades, 26% wins, +0.07R a trade (live part 16, −0.62R). Retrace-scalp 153, 40%, +0.04R (live 6, −0.83R). Intraday 43, +0.12R. Retrace-intraday 31, 45%, +0.32R (live 5, −0.8R). M30→M1 28, +0.71R (inflated by today's duplicates).
- Against the daily trend looks better than with it (Scalp +0.21 vs −0.05; Retrace-scalp +0.24 vs −0.23; Retrace-intraday +0.76 vs −0.08). This lean was tested on gold 2023–26 and failed the both-halves rule, so it stays a note, not a rule.
- Structure: main +0.16R (194) vs internal −0.16R (72) on Scalp: internal entries still lose, as the retired rules say.

## Rule changes
No change. The live part of every setup has fewer than 5 closed trades in 30 days or is already retired; buf 0.15 / minRR 1.2 stay. The positive 30-day shadow numbers come mostly from today and contradict the 2023–26 test.

## Watch tomorrow
- Gold: geg buy limit 3979.36 (stop 3907.61); it fills only on a pullback of ~110 points into the demand zone. Replica stays off while the 20-day range sits near 1.4%.
- Shadow m30m1 should now stop duplicating the gold Scalp; check that tomorrow's counts match.
- NQ and crypto: no setup near; BTC closest at 15% under its high.
