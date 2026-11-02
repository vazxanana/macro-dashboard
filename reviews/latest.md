# Daily review, 2026-11-02

**Verdict:** a losing first full day (−6.06R live). Asia did the damage and New York paid. The rules changed too often to measure anything, so they now hold steady except for one Asia filter.

_Data as of 21:26 UTC. Paper trading only. The council has run since Sun 1 Nov 20:09 UTC, so "30 days" below is really about 25 hours._

## Today

- **Opened:** 105 signals, 16 live and the rest shadow (blocked by a rule; followed, never scored).
- **Closed live:** 15: 1 win, 5 break-even, 9 losses, **−6.06R**. 7 live trades are still open: AUD/USD Intraday and Scalp sells, ETH Intraday sell, EUR/USD Position buy, USD/CHF Intraday and Swing sells, BTC Retrace M15→M1 buy.
- **Closed shadow:** 63: 17 wins, −3.0R.

| Live, by market | Trades | Wins | R |
|---|---|---|---|
| USD/CHF | 1 | 1 | +2.94 |
| Gold | 1 | 0 | 0.00 |
| GBP/USD | 1 | 0 | 0.00 |
| BTC | 2 | 0 | −2.00 |
| EUR/USD | 3 | 0 | −2.00 |
| SOL | 3 | 0 | −2.00 |
| XRP | 4 | 0 | −3.00 |

| Live, by setup | Trades | Wins | R |
|---|---|---|---|
| Intraday | 2 | 1 | +1.94 |
| Retrace M15→M1 | 2 | 0 | −1.00 |
| Retrace H1→M5 | 3 | 0 | −2.00 |
| Scalp | 8 | 0 | −5.00 |

## What worked

- **USD/CHF Intraday sell, +2.94R.** Opened Sun 23:01, closed at the target 09:03. Main structure, inside the H1 Origin. Price ran another 4.26R after the target, so it left money.
- **New York session:** 13 trades (live and shadow), 7 wins, **+12.9R**. Scalp trades opened after 12:00 UTC made +6.26R over 14.
- **USD/CHF overall:** 8 wins in 13 trades (+19R), mostly as shadow trades blocked by the exposure limit and the dollar cap.

## What didn't

- **Asia session:** 29 trades, 2 wins, **−15.9R**. All 8 live Asia trades lost (−6R): SOL Scalp buys against D1, XRP Scalp buys in internal structure, XRP Intraday sell against D1, EUR/USD Scalp sell, BTC Retrace H1→M5 buy.
- **Break-even at +1R (on 06:04 – 11:52):** saved 3 losers (SOL, EUR/USD, XRP) but stopped two trades at the entry that then went to their targets. Gold Retrace H1→M5 was +2.59R and then ran 7.3R; GBP/USD Scalp was +4.71R and then ran 19R. That cost about 12R to save 3R. The backtest turned it off; correct.
- **Far targets given back:** the EUR/USD Scalp sell reached +2.13R with its target 91R away and then hit its stop. With gold and GBP/USD that makes five trades that were +2R or more and didn't win.
- **Gold:** 0 wins in 14 (−12R), almost all shadow: Retrace M15→M1 buys that never got going and Scalp sells against D1.
- **XRP Scalp buys:** 4 live, 0 wins. Internal structure (under the 50% line) each time, and one signal was 8+ candles old (late).

## Patterns over the last 30 days (≈ 25 hours)

| Setup | Live: trades, wins, R | Live + shadow: trades, wins, R | Expectancy (all) |
|---|---|---|---|
| Intraday | 2, 1, +1.94 | 4, 3, +7.40 | **+1.85R** |
| Retrace H1→M5 | 3, 0, −2.00 | 12, 4, +1.82 | +0.15R |
| Retrace M15→M1 | 4, 0, −3.00 | 24, 8, −4.30 | −0.18R |
| Scalp | 9, 0, −6.00 | 45, 6, −15.74 | **−0.35R** |

- **D1:** against D1, 45 trades, −6.0R (−0.13 each); with D1, 39 trades, −3.8R (−0.10 each). No real difference yet. Scalp loses both ways (against −7.3R over 28, with −9.5R over 15).
- **Structure:** internal −0.28R each (18 trades); main −0.11R each (31). Internal is worse, but it's within noise at this size.
- **Session is the one split that clearly matters** (see above).

## Rule changes

- **21:25, `coach-ai`: Scalp and Retrace M15→M1 skip the Asia session** (`noSession: ["asia"]`). Asia lost −15.9R over 29 trades. Blocked Asia trades keep running as shadow, and the rule drops itself if they make +0.2R over 5.
- **No other change.** `buf` (0.15) and `minRR` (1.2) stay. No setup has 5+ closed trades showing a stop-placement problem: only 1 "hunt" today, and the minimum reward:risk filter kept the council out of losers (5 blocked, −2.5R). The automated Coach resumed Scalp early at 21:13 (its paused shadow trades made +0.70R each over 11); I'm leaving that, since the Asia filter now covers the worst of it.
- **Hold the rules for 2–3 days.** Today the Scalp D1 filter changed twice, break-even went on and off, and Retrace H1→M5 was paused and resumed within 2 hours.
- **Pending, needs the owner to merge:** half off at +2R when the target is more than 5R away. Draft PR #138 on `main`; the backtest will measure it.

## Watch tomorrow

From the 21:25 snapshot. Setups that line up with D1 come first.

1. **USD/CAD buy** (up on D1, H4 and H1, price 1.39941). Intraday is READY: buy 1.39956, stop past 1.39590 (2.03R). Swing is READY at 1.40251, stop past 1.36013 (2R, main structure).
2. **ETH sell** (down on D1, H4 and H1, price 2,247.33). Intraday is READY: sell 2,241.53, stop past 2,264.62 (3.1R, main structure). Swing sits in the H4 Origin, waiting for H1 to break down.
3. **AUD/USD sell** (down on D1, H4 and H1, price 0.69962). Intraday is READY: sell 0.69978, stop past 0.70081 (2R). Position is READY at 0.70162, stop past 0.71339 (9.19R, a target far enough for the partial). Both are in internal structure.
4. **GBP/USD sell** (down on D1, H4 and H1, price 1.34077). Swing is READY: sell 1.33026, stop past 1.35837 (2R, internal structure).
5. **SOL sell** (down on D1, H4 and H1, price 91.5). Swing and Intraday are IN ORIGIN, waiting for H1 / M5 to break down.

Against D1, so lower quality: USD/CHF Intraday sell READY at 0.81821 (D1 up); XRP Intraday sell READY at 1.2433 (D1 and H4 up).
Gold, BTC and EUR/USD: the D1 Position buys are IN ORIGIN, waiting for H1 to break up. That is the with-D1 trade there; skip the sells.

**News:** US midterms Tue 3 Nov (expect gaps overnight into Wednesday); NFP Fri 6 Nov 13:30 UTC. newsGuard is off.
