# Daily review, 2026-11-13

No live paper trade opened or closed today. The shadow book closed 17 trades: 11 won, 6 lost, +19.49R before costs and +18.56R after. No rule change.

## Today
- **Live book** (Gold trend, Gold daily engulf, Mosha cycle): no trades. Gold closed at 3,880.77, under its 20-day high of 4,155.57 and under the 20-day average of 4,035.48, so the engulf rule takes no buy. The weekly structure is bearish.
- **Shadow book** (17 closed trades):
  - Crypto sells won: ETH scalp, intraday and swing; SOL position; XRP intraday and scalp. That is about +14.1R, one move counted several times.
  - Gold re-entry buys (rscalp): two won, +3.98R and +2.37R. One gold scalp sell lost, −1.01R. The gold momentum-pullback shadow sell lost −0.47R.
  - Forex: wins on GBP/USD intraday (+2.07R), AUD/USD intraday (+1.98R) and USD/CHF scalp (+1.95R). Losses on GBP/USD rscalp and scalp and USD/CHF scalp, each about −1.1R.
  - One SOL position sell was stopped for −1.16R.
- Opened today: 3 records. One is the SOL loss above; the other two are still open.

## What worked / What didn't
- **What worked:** with-trend sells on crypto. ETH swing from 2,082.93, stop 2,152.45, target 1,908.10, +2.46R. Gold buys off the 3,850-3,860 area: rscalp from 3,862.37, stop 3,846.72, target 3,898.85, +3.98R.
- **What didn't:** the forex scalps between the two sessions (GBP/USD scalp sell from 1.32315, stopped at 1.32454). The SOL position sell entered at 80.37 with its stop only $1.90 away (82.27) and was stopped as SOL bounced.
- **A caution:** one good day in the shadow book does not change its record. The 12 Nov study (research/edge/shadow-best) found none of the 32 engine shadow streams worth keeping out of sample.

## Patterns over the last 30 days (forward trades, closed, after costs)
| Setup | Book | n | Win % | R a trade |
|---|---|---|---|---|
| scalp | shadow | 495 | 34% | +0.016 |
| rscalp | shadow | 276 | 34% | −0.335 |
| intraday | shadow | 91 | 46% | +0.420 |
| rintra | shadow | 45 | 42% | −0.010 |
| scalp | live (legacy engine) | 15 | 0% | −0.942 |
| rscalp | live (legacy engine) | 6 | 0% | −1.242 |
| geg | live | 2 | 0% | −1.030 |
| replica | live | 2 | 50% | +0.475 |
- Only the shadow intraday stream is positive with any size, and its 30-day figure has no t of 2 behind it. The live systems have 1-2 trades each: too few to judge.
- The D1 and main-versus-internal splits were not recomputed today: no live sample is large enough to say anything.

## Rule changes
No change. Since 7 Nov live rule changes are the owner's, and the Coach only proposes (CLAUDE.md, absolute rule 3). Nothing has enough evidence to propose:
- buf stays 0.15 and minRR 1.2.
- No setup is paused.
- The shadow cut of 12 Nov stays: new scalp, intraday, rscalp and rintra shadows are no longer recorded.

## Watch tomorrow (snapshot.json)
- **Gold:** the Position sell is READY at 3,870.32 (shadow). The Mosha cycle reads the H4 moving down from 3,870.32 and waits for the H1 ChoCh that starts a pullback, which would aim at the H4 50% at 4,000.64. Nothing for the live trend or engulf rules while gold is under its 20-day average.
- **GBP/USD:** the Position sell is READY at 1.32213, R:R 1.26.
- **USD/CAD:** the Position buy is READY at 1.42654, R:R 2.
- **SOL:** the Position sell is READY at 80.37, R:R 1.32.
- **In origin:** BTC buy, ETH sell, XRP buy, EUR/USD sell, AUD/USD sell and USD/CHF buy.
