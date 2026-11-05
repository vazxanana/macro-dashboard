# Daily review, 2026-11-05: the live systems sat out a one-way day; the filters and the gate did their job.

## Today
- **Live systems (gold replica, NQ open run, crypto trend, Mosha BO): no trade opened, none closed.** Gold fired 11 replica signals between 03:53 and 20:51 UTC and every one failed the entry filter (clean H1 / star plus stop size); 7 of the 11 were sells against the daily trend. The volatility gate was off anyway (20-day range 1.35% vs the top-fifth level 2.42%). Followed on paper, those 11 signals are −1R net with 4 still open.
- NQ: no open-run signal. The index fell from 28,205 at the 09:30 ET open to 26,914 without one 1-minute close back above the open, so there was no reclaim to trade. The 2-SD fade tracker (research only) lost 1R.
- Mosha BO: no H4 → H1 → M15 chain completed. Crypto trend: BTC 15%, ETH 26%, SOL 40%, XRP 36% under their 55-day highs; nothing to do.
- Retired desk strategies (shadow only): 87 opened, 78 closed, −11.1R. Scalp 6 wins / 26 losses; Retrace-scalp 13 wins / 19 losses.

## What worked / what didn't
- Worked: the gate and the daily-trend filter. The gold sells against the daily trend (4138.6 → 4100 region) looked right on the day, but the replay says those signals lose over 2023–26; today they were a coin flip (2 wins, 3 losses, 4 open). Staying out cost nothing.
- Didn't: the legacy Scalp on gold (41 closed over 30 days, 12% wins, −23R) and on GBP/USD (−10.7R) keep losing in shadow. They are retired; nothing to change.
- Bug fixed today (PR #239): the news veto from the morning threw on every replica signal; two rounds on the fixed code show zero errors.

## Patterns over the last 30 days (shadow, 408 closed)
- Per setup: Scalp gold −0.56R a trade (n41), Scalp AUD/USD +0.21 (37), Retrace-scalp gold +0.09 (34), Scalp USD/CAD −0.46 (22), Retrace-scalp BTC +0.34 (15), Scalp BTC +1.05 (13, carried by two trades). Only Retrace-scalp is positive across markets (+18.9R over 113 since 1 Nov); it goes to the long-history test before any reconsideration.
- D1 agreement did not separate: with D1 −0.07R (213), against −0.03R (194). Structure: main −0.02R (171), internal −0.30R (88): internal-structure entries lose, as the retired rules already said.

## Rule changes
No change. The live systems took no trade; the legacy setups are retired (retireLegacy on) and only run as shadow, so buf / minRR / pauses would change nothing that trades.

## Watch tomorrow
- Gold: the replica stays off until the 20-day range climbs back toward 2.4%; the engine shows Position buy and Retrace sell as Ready, but those are legacy setups (shadow only). Weekly structure is bearish, so a Mosha BO chain would be a sell.
- NQ: Friday open; after today's 1,300-point drop the 00:00 ET open will sit well above the 09:30 open, which favours a SELL open-run if the reclaim pattern appears.
- Crypto: no coin within 15% of a breakout; BTC closest.
