# Daily review, 2026-11-04: a quiet −1.5R day as the old setups were retired; the new volatility gate kept gold out of a −3R afternoon

## Today

**Live:** 7 closed, 3 wins, 4 losses, **−1.53R**. Two opened, both gold replica, before the new gold rules took effect.

| Market | Closed | R |
|---|---|---|
| Gold | 3 | 0.00 |
| ETH | 1 | −1.00 |
| BTC | 1 | −1.00 |
| USD/CHF | 1 | +0.44 |
| EUR/USD | 1 | +0.03 |

| Setup | Closed | R |
|---|---|---|
| Replica (gold, M5 CHoCH) | 2 | +1.00 |
| Scalp M15→M1 | 1 | −1.00 |
| Intraday H1→M5 | 1 | −1.00 |
| Retrace H1→M5 | 1 | −1.00 |
| Swing / Position (closed at market when retired) | 2 | +0.47 |

**Not traded live:**
- **NQ New York open run:** no setup today (no 15-point run and close back across the 09:30 ET open).
- **Mosha BO system:** no setup. The weekly structure turned **bearish** (spot gold closed the week of 26 Oct through the weekly low at 3,886), so it only takes sells.
- **Gold replica, gated:** gold's 20-day average daily range is 1.25%, under the 1.5% gate. The six gold replica signals after the gate went in were research only: 2 wins, 4 losses, **−3R**. The gate saved those.

## What worked / What didn't

**Worked**
- **Gold replica buy at 3,949.82** (stop 3,926.45, target 3,996.56, 04:15, with the daily trend): target at 05:54 for **+2R**, a clean run.
- **USD/CHF swing sell at 0.82021** and **EUR/USD position buy at 1.12262**: closed at market at 15:11 when the old setups were retired, for +0.44R and +0.03R.

**Didn't**
- **Gold replica sell at 3,924.0** (stop 3,941.86, 00:35, against the daily trend): stopped at 01:15 (−1R) when the up-move simply carried on. Under today's rules it would not trade: it was against the daily trend and not at an H1 engulfing barrier.
- **Gold scalp sell at 3,933.11** (opened 3 Nov, against D1): stopped at 05:34 (−1R) on the same rally.
- **BTC Retrace H1→M5 buy at 76,986.8** and **ETH Intraday sell at 2,288.24**: both stopped (−1R each). These are the last trades of the retired setups.
- **Gated gold signals in the afternoon chop:** sells at 4,041.55, 4,041.97 and 4,061.21, buys at 4,063.40 and 4,063.74 were stopped; one buy at 4,043.72 made +2R. Gold churned in a $25 range around 4,040–4,065, the kind of calm market the gate exists for.

## Patterns over the last 30 days

| Setup | Live closed | Win rate | Expectancy |
|---|---|---|---|
| Scalp M15→M1 (retired) | 16 | 6% | −0.62R |
| Retrace M15→M1 (retired) | 6 | 0% | −0.83R |
| Intraday H1→M5 (retired) | 5 | 40% | +0.41R |
| Retrace H1→M5 (retired) | 5 | 0% | −0.80R |
| Gold replica | 2 | 50% | +0.50R |

- **The old engine setups are retired** (owner's call): live they made −16.4R over 29 closed trades.
- **D1 agreement:** today's live trades with the daily trend were flat (0.0R over 4), against it −1.56R over 3. That's too few to read on its own. The gold rule now requires the daily trend, or an H1 engulfing barrier, for live replica trades.
- **Main vs internal structure:** no live retracement trade today, so nothing new.

## Rule changes

**No change.** The coach's knobs (`buf`, `minRR`, pauses) only steer the retired engine setups. The three live systems (NQ open run, gold replica, Mosha BO) run on the owner's rules and have fewer than 5 forward trades each.

Two things changed on the research side today:
- The Mosha BO system now trades only with the weekly structure.
- That rule failed an out-of-sample check on six other markets, so it runs as a forward test with an expectation near 0R.

## Watch tomorrow

- **Gold (4,063):** daily trend up, H4 down, H1 up.
  - The replica stays research-only until the 20-day range reaches 1.5% (now 1.25%).
  - The Mosha BO system needs, in order:
    1. an H4 sell BO;
    2. then an H1 buy BO (the pullback);
    3. then an M15 sell BO back down.

    It only sells while the weekly is bearish.
- **NQ:** New York open at 14:30 UTC. A 15-point run through the open that closes back across within 15 minutes, with the midnight open ahead, is the setup.
- **Other markets:** research only (replica shadow). Nothing to act on.
