# Coach review: 2026-11-02

_Data as of 21:05 UTC. Paper trading only._

**Live:** 15 closed: 1 win, 5 break-even, 9 losses, **−6.06R**. 7 still open.
**Shadow:** 62 closed, 16 wins, −5.0R.
The only live win was USD/CHF Intraday sell, +2.94R.

## Trade by trade (live)

| Trade | Result | What happened | Verdict |
|---|---|---|---|
| USD/CHF Intraday sell | +2.94R | Hit target, then ran another 4.26R. | Market (left money) |
| Gold Retrace H1→M5 buy | 0R | +2.59R, stopped at break-even, then went to target (+7.29R after). | **System**: break-even at +1R |
| GBP/USD Scalp buy | 0R | +4.71R, stopped at break-even, then ran 19R. | **System**: break-even at +1R |
| BTC Retrace H1→M5 buy | −1R | Reached +0.94R and turned. | Market |
| BTC Retrace H1→M5 buy | −1R | Reached +0.65R and turned. | Market |
| XRP Scalp buy | −1R | Signal was 8+ candles old. Internal structure. | System (late) |
| XRP Scalp buy | −1R | Asia, internal structure; never went for us. | Market |
| XRP Intraday sell | −1R | Against D1, Asia. | System (against) |
| SOL Scalp buy | −1R | Against D1; stopped in 2 minutes, then ran 10.7R the other way. | Market (real reversal) |
| SOL Scalp buy | −1R | Against D1, Asia. | System (against) |
| SOL Scalp buy | 0R | Break-even saved a loser. | — |
| EUR/USD Scalp sell | −1R | +2.13R, target 91R away, gave it all back. | **System**: target too far |
| EUR/USD Retrace M15→M1 sell | 0R | Break-even saved a loser. | — |
| EUR/USD Retrace M15→M1 sell | −1R | The retracement never came (London). | Market |
| XRP Scalp buy | 0R | Break-even saved a loser. | — |

## What we learn

1. **Session matters more than D1 direction.** Asia: 29 trades (live and shadow), 2 wins, −15.9R. New York: 13 trades, 7 wins, +12.9R. Scalp loses both ways in D1 (against: −7.3R over 28; with: −9.5R over 15), so flipping its D1 filter doesn't fix it.
2. **Targets far away get given back.** Five trades reached +2R and failed to win. The EUR/USD Scalp target was 91R away. Break-even at +1R isn't the answer: it saved about 3R and cost two trades that went on to target (≈12R). The backtest turning it off was right.
3. **Too many rule changes in one day.** The Scalp D1 filter changed twice, break-even went on and off, Retrace H1→M5 was paused and resumed within 2 hours, and its target rule changed twice. Nothing can be measured at this speed.

## Did the rules help?

| Blocking reason | Shadow trades | R | Read |
|---|---|---|---|
| D1 only | 4 | −4.0 | Helped |
| Minimum reward:risk only | 5 | −2.5 | Helped |
| Dollar cap only | 6 | −5.0 | Helped |
| Exposure (incl. +usd) | 19 | +4.6 | Blocked winners |
| Paused + exposure + usd | 4 | +13.7 | Blocked winners (USD/CHF) |

USD/CHF made +19R over 13 trades (live and shadow), mostly blocked by the exposure limit and the dollar cap. Gold went 0 for 14 (−12R), mostly shadow trades.

## Changes

- **coach-ai: `scalp` and `rscalp` skip the Asia session** (`noSession: ["asia"]`). Blocked Asia trades still run as shadow; the rule drops itself if they make +0.2R over 5.
- No other changes. **Hold the rules steady for 2–3 days** so the current set can be measured.

## For the owner (needs an engine change on main)

- Take a partial or trail the stop at +2R when the target is more than 5R away. This would have caught most of today's five give-backs.
- Gold: take Retrace trades only right after a clean higher-timeframe VR.
