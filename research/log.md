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

### 3 Nov afternoon: learning the trader's 3 Nov gold trades

The trader sold 3,948.59 at 01:30 UTC (stop 3,964.33, target 3,908.27, +2.6R) and bought 3,901.13 at 09:45 (stop 3,891.93,
about +2.8R by 12:54). In engine terms (H1 BO sell of 29 Oct, Origin 4,021.47–4,040.75, VR 3,890): his "BO BUY" ≈ the VR
confirmation, his demand box 3,891.5–3,916.1 ≈ the VR box, his 3,964 levels ≈ the 50% line (3,965.4). The engine never
saw a BO buy (it flips only above 4,040.75), so its Retrace H1→M5 waited for an M5 BO and bought 3 hours late, while four
Scalp sells went into his demand box (−3R live).

| Idea | Result | Verdict |
|---|---|---|
| Block entries inside an opposing live H1/H4 Origin | Under the rules, Scalp inside an opposing H1 Origin is +32R/+26R (scalps trade against D1); blocking costs both halves | ❌ |
| Retrace M15→M1 allowed in Asia inside a same-way Origin (his 01:30 sell) | H4 version: signals +7/+22R, portfolio +1/+43R vs −8/+49R; H1 version the reverse | ❌ inconsistent |
| Origin entry (live H1/H4 BO Origin after its run, LTF CHoCH, target the opposing Origin) | H1/M1 +0.00R (207), H1/M5 −0.21R, H4 versions small and negative in the last third; gold/forex H1/M1 +0.26R (96) | ❌ (did not catch his trades) |
| VR-box retest (vb*) and 50%-line (f*) setups | Reproduce both trades on a hand-built 3 Nov; only 2–40 trades each in 150 days, no conclusion. In the real replay the H1 VR box is 3,890–4,003.98 (the straight drop had no smaller swing), never confirmed, so they never fired | ❌ wrong box |
| M30 setups (M30→M5, M30→M1): his BO BUY 3,916 and box 3,891.5–3,916.1 are M30 structure | M30→M5 −0.03R/−0.15R a trade (717/465), against D1 −0.03R/+0.01R; M30→M1 −0.14R/−0.20R. At his 09:45 buy the M30 trend was already down again (the drop from 3,964 broke M30), so no buy setup existed | ❌ |

| Photon-sized swings everywhere (msAnalyze N=3 / N=2 instead of 6) | N=2 makes H1 show his cycle turn (BO buy 3,934, Origin 3,905–3,934, VR 3,973.7) and catches both trades (Scalp sells 3,951–3,964 +2 to +3.6R; M30→M1 buy 3,907.8 +21R). Portfolio over 150 days: N=3 −117R, N=2 −108R vs +46R (entries too noisy) | ❌ |
| Photon swings on D1/H4/H1 only (entries N=6) | Portfolio N=3 −14R (−13/−7); N=2 +32R (−20 train / +51 test) vs +46R (+5/+40); did not catch his trades | ❌ mixed |

**What the gap is:** the trader picks which leg is the main structure (here the M30 leg up from the 1 Nov low) and reads
the moves against it as pullbacks into its Origin; the engine always takes the latest break on each timeframe as the trend.
H1 was too slow (still bearish from 4,040.75), M30 too fast (bearish again after 3,964). Reproducing him needs a rule for
choosing the leg, which a few examples can't pin down: keep collecting his marked trades in `council/examples.json`.


**Shipped to the live trader today:** bad-print clipping (#144), lone forex wicks (#146, #147), forex exits wait 3 minutes
and the 7 trades closed by bad prints were reopened (#148), gold trade chart on spot (#145).
