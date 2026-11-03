# Research log

Every idea tested on the 150-day replay, what it scored, and whether it shipped. Train = first 100 days, test = last 50;
"portfolio" = the replay with the live limits (2 per market, dollar cap 2). Newest first.

## 3 Nov 2026

**Data:** the replay is now cleaned of bad prints (Kraken-only spikes): 50-range rule on every series, plus the lone-wick
rule on forex 1m–30m. One 1,000-pip EUR/USD candle had made the old 5-month result look +168R; cleaned it is about
break-even (+19R over 1,411 portfolio trades, −17R train / +43R test).

| Idea | Result | Verdict |
|---|---|---|
| Scalp: hold to target 2 | Signals +170R (+0.11R/trade, t 1.4, 7/9 markets; Aug–Sep negative). Portfolio with real close times: +15R vs +19R, worse in both halves — longer holds block 212 other trades | ❌ rejected |
| Scalp + Intraday to target 2 | Portfolio −22R vs +19R | ❌ |
| Fixed take profit 2/3/4/5R (Scalp, Retrace M15→M1) | Scalp 3R: −45R/−14R vs −44R/+11R; cuts the 5–10R runners that carry the setup | ❌ |
| Scalp only reward:risk ≥ 3 (or ≥ 2.5) | Signals +22R/+17R (t 0.4–0.6); portfolio ≥2.5: +52R/+2R vs +11R/−10R | ⏸ watching forward |
| Break-even at +1R / +1.5R, half off at +2R, time stops 4/8/12 h | Portfolio test −37R to −60R vs −10R | ❌ |
| Retrace M15→M1 min reward:risk 4 or 5 (walk-forward pick) | Signals better; portfolio test −17R to −20R vs −10R | ❌ keep 3 |
| Intraday max reward:risk 6 (walk-forward pick) | Portfolio −3R train / +10R test | ❌ keep 10 |
| Retrace H4→H1 off; Retrace M15→M1 off | Both lose under the rules, but portfolio unchanged (freed slots go to equally weak trades) | ❌ |
| Position limits 1/3/4 per market, dollar cap 3/4/none, order replacement | All worse than 2 per market + cap 2; crowded-out trades lose −0.07R each | ❌ keep |
| Minimum stop size (skip spread > 10–30% of risk) | Train better, test worse | ❌ |
| Session skips (late for Scalp, Asia for Intraday) | Reverse between halves | ❌ |
| Fair value gaps (in HTF gap, displacement after CF), quarter key levels | None helps on top of the rules; Intraday near a key level is the one lead (+21R/+7R, t < 1) | ❌ (lead noted) |
| Every live rule re-checked on clean data | 9/12 still help in both halves; the 3 mixed ones are Coach rules | ✅ unchanged |
| Daily Cycle exit after 8 h | +0.17R/trade (t 2.1) vs +0.11R; only exit positive in the last third | ✅ shipped (#149, research only) |

**Shipped to the live trader today:** bad-print clipping (#144), lone forex wicks (#146, #147), forex exits wait 3 minutes
and the 7 trades closed by bad prints were reopened (#148), gold trade chart on spot (#145).
