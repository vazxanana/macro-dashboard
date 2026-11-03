# Daily review, 2026-11-03: a small live loss (−3.8R) on a range day; the blocked trades made +19.6R, almost all from two gold sells

## Today

**Live:** 10 closed, 2 wins, 8 losses, **−3.78R** (9 opened).

| Market | Closed | R |
|---|---|---|
| AUD/USD | 2 | +4.22 |
| BTC | 3 | −3.00 |
| Gold | 3 | −3.00 |
| GBP/USD | 1 | −1.00 |
| USD/CHF | 1 | −1.00 |

| Setup | Closed | R |
|---|---|---|
| Intraday H1→M5 | 2 | +1.11 |
| Scalp M15→M1 | 5 | −1.89 |
| Retrace M15→M1 | 2 | −2.00 |
| Retrace H1→M5 | 1 | −1.00 |

**Shadow (blocked):** 73 closed, 28 wins, **+19.62R**. Gold contributed +17.71R (13 trades) and AUD/USD +7.42R. USD/CHF lost −6.03R and SOL −4.00R. By setup, Retrace M15→M1 made +22.4R over 24 trades; Scalp was flat (+0.17R over 38).

Seven shadow trades closed by bad prints (AUD/USD 10:12, USD/CAD 06:14) were reopened and finished on cleaned candles, all as losses. The fake +2.03R USD/CAD win is gone.

## What worked / What didn't

**Worked**
- **AUD/USD Intraday and Scalp sells at 0.70188** (stop 0.70374, target 0.69795, opened 1 Nov 23:01): both hit the target at 03:31 for **+2.11R each**, a clean run from the H1 Origin.
- **Gold Retrace M15→M1 sells into the 3,946–3,969 supply (shadow):**
  - 2 Nov 16:48 at 3,969.0: **+10.29R**; 17:14 at 3,968.2: **+9.74R**. Both were blocked by the old D1 rule, which the 07:06 research rule set removed, so they would trade live now.
  - 00:41 at 3,956.7: +2.56R; 01:13 at 3,954.6: +1.90R. Both were blocked by the Asia rule.
  - These match the trader's own 01:30 sell at 3,948.59 (stop 3,964.33, target 3,908.27, +2.6R).

**Didn't**
- **Gold Scalp sells into the trader's demand box** (3,891.5–3,916.1, the Origin of the M30 BO buy):
  - 10:04 at 3,910.9: was **+4.75R** before reversing to the stop.
  - 10:26 at 3,906.9 and 11:27 at 3,905.6: stopped.
  - That's −3R. The trader bought this box at 09:45 (3,901.13).
- **BTC:**
  - Retrace M15→M1 buy at 76,696: was +1.2R, then gave it back.
  - Retrace H1→M5 buy at 76,873: the retracement failed.
  - Scalp sell at 76,402: −1R against the move.
  - That's −3R.
- **The 15:00 US data stopped two trades:**
  - USD/CHF Intraday at 0.81985 (had been +1.91R).
  - GBP/USD Retrace M15→M1 at 1.3407.
  - Over the log, trades closing near news are still net positive (+13.6R over 13), so the news guard stays off.
- **Three of the 8 live losers were +1R or more first** (+4.75R, +1.91R, +1.2R). Over 150 days, break-even at +1R still costs more than it saves (−60R vs −10R on the last 50 days), so no change.

## Patterns over the last 30 days

| Setup | Live | Shadow |
|---|---|---|
| Intraday H1→M5 | 4, 50% win, +0.76R a trade | 10, 40%, +0.42R |
| Retrace H1→M5 | 4, 0%, −0.75R | 13, 46%, +0.18R |
| Retrace M15→M1 | 6, 0%, −0.83R | 46, 52%, **+0.48R** |
| Scalp M15→M1 | 14, 7%, **−0.56R** | 74, 23%, −0.13R |

- **D1 agreement** made little difference this month: against D1 +0.10R over 85, with D1 −0.02R over 85. Over the cleaned 150-day replay it matters a lot for Scalp: removing the "only against D1" rule costs −127R and −189R.
- **Structure:** main +0.03R (54) and internal −0.25R (48).
- **Sessions:** New York +1.10R (34), late +0.28R (23), Asia −0.29R (54), London −0.50R (30).

## Rule changes

**No change.** The trader's rules from today now decide what trades:

- **Take-all** (19:47): every signal trades on paper, with its blockers recorded.
- **Gold only** (20:10).
- **Gold M30 → M1, against D1** (20:17).
- **No pauses** (07:27).

So the filters no longer block anything. Live Scalp has 14 closed at −0.56R a trade, enough to pause under the Coach's limits, but the trader asked for no pauses. buf (0.15) and minRR (1.2) have no gold-only evidence behind a change yet.

The automated check added "Retrace M15→M1: skip the overlap session" at 18:05. Under take-all it only records.

All of today's research is in `research/log.md`, including the gold replica of the trader's trades (paper, v4).

## Watch tomorrow (gold first)

- **Gold 3,924.5:**
  - Scalp sell READY (1.75R) and M30→M1 sell READY (1.75R).
  - Position buy and Swing sell both inside their Origins.
  - Two live Scalp sells are open (15:22 at 3,933.1 and 19:58 at 3,922.6).
  - The trader's levels to watch: demand 3,891.5–3,916.1, supply 3,950–3,970.
- **Other markets (shadow only):**
  - USD/CAD: Position, Swing and Intraday buys READY (Intraday 7.5R).
  - GBP/USD: Swing sell READY.
  - SOL: Swing sell READY.
  - BTC: Retrace H1→M5 buy READY.
  - USD/CHF: Scalp buy READY.
