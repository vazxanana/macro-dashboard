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


### 3 Nov evening: live trader vs replay

Matched today's live/shadow trades against the replay (same market, setup, side, within 20 min). Where both took a trade
they agree: 49 of 63 same result, reward:risk within about 8%. But the live trader takes 1.5–3× more trades on every market
and setup (2–3 Nov: 171 vs 80), most likely because it analyses Kraken's still-forming 1m candle while the replay uses only
closed 1m candles. Since 28 Oct the extra live signals made +10.6R over 86 closed (+0.12R/trade, 29% win) against −6.8R over
66 for the matched ones, so they are not worse; no change. Caveat: replay totals understate how many trades live takes.
News check: trades that closed with high-impact news in their window made +13.6R over 13 (live +2.2R/4, shadow +11.4R/9)
vs −9.4R over 149 without, so the news guard stays off (the Coach turns it on after 3 news-caused losses).

### 3 Nov night: replicating the trader's gold trades (gold-only, local 150-day candle dump)

Rule that fires on all four marked trades (2–3 Nov): leg ≥ 2 M15 ATR within the last 3 h or 6 h, then an M5 close (1-candle
swings) back through the last swing against the leg. M15 versions and a 12 h leg window miss them (he trades the latest swing).
His entries sit at about the 30–50% retest between the extreme and the CHoCH level; his targets are the leg start or the
bigger 12 h leg start. "Swept prior 24 h liquidity" did not help (negative in both halves).

| Version (gold, 1,164 signals / 150 days) | First 100 days | Last 50 days | His four trades |
|---|---|---|---|
| Market entry, target 2R | +0.035R (751) | +0.000R (413) | −1, +1.9, −1, +2.0 |
| Market entry, target 3R / leg start / 12 h start | +0.04 / −0.01 / −0.00 | −0.16 / −0.07 / −0.07 | |
| 30% retest, target leg start | −0.032R (474) | +0.011R (288) | not filled, +2.1, +0.8, +1.7 |
| 50% retest, target 12 h leg start | −0.131R | +0.020R | not filled, +7.4, not filled, +8.1 |
| Market 2R, H4 trend against the trade | +0.080R (380) | +0.045R (222) | keeps 3 of 4 |

Verdict: replicates his trades, not his edge (break-even overall). Shipped as a paper research setup on gold (#153,
`research.json` k = replica) to compare with his trades day by day. Also shipped: gold-only (#151), gold M30 → M1 against
D1 (#152, +12R → +33R portfolio on gold), take-all (#150, user's call; gold take-all was −146R vs +53R with rules in 150 days).

**Replica v2 (#154):** engine and engulfing context on the 1,164 gold replica signals (market entry, 2R). Clear of every live
H1 Origin (engine N=6): +0.093R / +0.060R, keeps 4/4 of his trades, not concentrated (+23R of +33R without the top 5).
M5 engulfing at the extreme: +0.045R / +0.065R; without one, −0.175R in the last third. Clear of H1 OR M5 engulfing:
+0.075R (593) / +0.077R (352), t 1.7 / 1.4, +72R in 150 days, keeps 4/4 — shipped as the replica's filter (paper).
Rejected: entry at the engulfing candle's open (−24R / +51R), H1-clear AND engulfing (+0.074 / −0.016), retest entries
with the filter (negative), D1-against (+0.063 / +0.133 but keeps only 2/4).

**Replica tick (targets, sessions) and v3 (#155):** filtered replica targets: 2R is the only one positive in both halves
(1.5R +0.073/+0.040, 2.5R and 3R negative in the last third); sessions mixed (late +0.27/+0.28, New York +0.02/−0.09), no
session filter added. Platform engulfing (gold-trading.html detectEngulfings, size + tolerance) at the extreme: on M5
+0.105/+0.013, on M15 +0.374/−0.157 (flips). With its ★ (mid within 0.12% of PDH/PDL, Asia H/L, $50/$100): +0.314R (163,
t 3.3) / +0.160R (104); every month positive, +58R of +68R without the top 5, buys and sells, all sessions. Shipped as the
replica's ★ tag; pass = H1 clear or ★ (+0.142 / +0.074, keeps 4/4). Candidate for live once forward ★ trades confirm.

**Replica v4 (#156), selection after the 3 Nov range day (8 signals, −2.9R; he took 2):** range location of the extreme
(12/24/48 h) — no consistent bucket (edge 0.85+: +0.067 / −0.018); room to the far side of 24 h — noisy (3R+: +0.060 /
+0.047). Stop size in M15 ATR: under 1 ATR −0.035 / −0.134 (the mid-range turns), 1–2 ATR +0.090 / +0.055, all his trades
1.1–3.4 ATR. Filter H1 clear or ★ AND stop ≥ 1 ATR: +0.188R (319, t 2.9) / +0.125R (208, t 1.9), no losing month,
keeps 4/4; 3 Nov 5 signals +0.4R. Shipped (paper).

**Replica v4, last weeks and two fixes (rejected):** last week (26–30 Oct) v4 +2.1R over 32 (all signals +2.9R/57); last
6 weeks v4 +19.3R over 197 (+0.10R/trade; all signals −8.3R/371; ★ +13.0R/82) but lumpy (3 of 7 weeks positive, 5 Oct
+17.4R). Fixes for the losing weeks: cooldown (no opposite trade within 1/2/4 h, or none while one is open) — 2 h improves
R/trade both halves (+0.241/+0.141) but total 82R vs 86R and last week −3.5R vs +2.1R; trend guard (skip if the 8/24 h move
against the trade > k M15 ATR) — 24 h > 15 ATR: +0.176/+0.157, June −4R, total 84R; both 78R. All within noise of v4 (86R):
not adopted.

**Shipped to the live trader today:** bad-print clipping (#144), lone forex wicks (#146, #147), forex exits wait 3 minutes
and the 7 trades closed by bad prints were reopened (#148), gold trade chart on spot (#145).

## 3 Nov 21:45 — Scalp re-entry after a loss (shipped, #157)

Question: today's live gold loss was five Scalp sells in a row (10:04–12:10), all −1R. Does re-entering after a loss lose?
Replay: xaum30.json (150 days gold, cleaned, take-all, every signal, R net of cost). "After loss" = same setup and side, a loss closed in the previous 3 h.

| setup | after loss, first 100 d | after loss, last 50 d | rest |
|---|---|---|---|
| scalp | −0.24R ×138 (t −1.8) | −0.52R ×91 (t −4.1) | −2.1R / −15.9R |
| rscalp | −0.24R ×62 | +0.14R ×34 | mixed |
| m30m1 | +0.01R ×134 | −0.42R ×96 | mixed (June +0.88R/tr) |

Scalp after a loss is negative in all six months (−5.1, −7.4, −16.7, −15.8, −31.2, −4.3); 1/2/6 h windows agree.
After a *win* is positive (+0.53R/tr last 50 d): scalps cluster by regime. Shipped: `reentry` blocker for Scalp only, a hard shadow under take-all.
Not shipped: rscalp/m30m1 (not consistent across halves). Side check: replica code runs clean on real candles; no signals live yet because it only went live at 20:33 UTC (last signal of the day 14:15).

## 3 Nov 22:10 — Replica v4 by session (rejected: no filter)

v4 passing signals, 2R market trades, 150 d gold (first 100 d | last 50 d, R/trade):
asia +0.19 | +0.15 · london +0.38 | +0.03 · overlap −0.08 | +0.25 · newyork +0.17 | −0.16 · late +0.32 | +0.45.
3-hour blocks and session × D1 the same: no block negative in both halves (12–15 UTC −0.16 | +0.11; 06–09 +0.30 | −0.21).
No session filter: every session is positive overall and the losers swap between halves. Late (21–24 UTC) is the steadiest,
which covers the first live replica signal (buy 3,927.40, stop 3,918.79, 2R 3,944.62, 21:36 UTC, H1 clear, engulfing at the extreme, risk 2.9 ATR).

## 3 Nov 22:40 — NQ New York open liquidity sweep (paper research, #161)

The trader's rule: after the 9:30 ET open, price takes liquidity (overnight / previous-day / pre-market high or low), then
trade the opposite way, target 1.2R. Data: Yahoo NQ=F, 5m 50 days (25 Aug – 3 Nov), 1m 21 days. Cost 0.5 pt.
- Reclaim close (first candle back inside the swept level, reversal colour), stop extreme + 2 pt, 1.2R, out 16:00:
  all six levels, first hour: 5m +0.02R ×35, 1m −0.06R ×15. Overnight only 5m −0.31R ×28; previous day −0.40R ×16.
- M5/M1 CHoCH after the sweep instead: 5m all levels 60 min +0.20R ×12 but 1m −0.18R ×16; halves flip everywhere.
- Min stop (1–2 ATR): no consistent help.
Verdict: no edge shown in 50 days (1.2R needs a 45.5% win rate; it runs 22–47%). Runs forward on paper (research.json k 'nq-open').

## 4 Nov 02:30 — Replica v4 by stop size (no change)

First live replica trade: sell 3,924.00 at 00:35, stop 3,941.86 (wide), stopped 01:15, −1R. Paper buy of 3 Nov 21:36 won +2R.
Question: do wide stops hurt? v4 passing signals by risk in M15 ATRs (first 100 d | last 50 d, R/trade):
1–1.5 +0.08 | +0.02 · 1.5–2 +0.35 | +0.13 · 2–3 +0.18 | +0.16 · 3–4 −0.03 | +0.53 · 4+ +0.96 (5) | −0.34 (9).
No consistent penalty for wide stops; the 1–1.5 ATR band is the weakest but still positive. No change (and no live rule change before ~30 live trades).

## 4 Nov 03:30 — Replica v4 target (2R confirmed)

v4 passing signals, same entries/stops, 48 h cap (first 100 d | last 50 d, R/trade):
1.5R +0.13 | +0.09 · **2R +0.19 | +0.13** · 2.5R +0.16 | −0.02 · 3R +0.14 | −0.03 · 4R +0.13 | −0.02 · leg start +0.04 | +0.01 ·
half at 2R + BE + rest 4R +0.20 | +0.09 · half at 1R + BE + rest 3R +0.08 | 0.00.
2R stays: best or tied in the first 100 days and clearly best in the last 50. Wider targets lose their edge out of sample.

## 4 Nov 04:30 — Replica v4 vs the higher-timeframe trend (v5 candidate, not shipped)

New live replica buy 04:15: 3,949.82 / stop 3,926.45 / 2R 3,996.56.
v4 passing signals split by trend at the signal (first 100 d | last 50 d, R/trade):
- H4 trend against the trade: +0.31 (164, t 2.7) | +0.21 (115, t 1.5) · H4 with: +0.06 | +0.03 ← the one split that holds in both halves
- D1 against +0.23 | +0.05, with +0.15 | +0.21 (flips) · H1 against +0.21 | +0.18, with +0.16 | +0.03 · Mosha N=6 trend splits flip between halves.
Reading: the replica is a counter-trend turn; it pays mostly when it fades the H4 trend. But an H4-against filter would drop the
trader's 2 Nov short (H4 with), and the live rules stay frozen until ~30 live trades. Kept as the first v5 candidate: re-test with
the forward record before any change.

## 4 Nov 05:30 — Gold M30 → M1 is a copy of the Scalp (finding, no change)

All 7 live-era gold m30m1 trades have exactly the Scalp's entry, stop and target, opened in the same run. Cause: the engine takes
entry, stop and target from the M1 confirming break (buildSetup), so when the M30 and M15 trends agree at an M1 CF both setups
produce the same order. M30 → M1 adds no new trades; it only re-labels Scalps that agree with M30 (and, with its D1-against rule,
the shadow split doubles the same result). No change while the engine runs as shadows on gold (live: the replica); if the engine
ever goes live on gold again, drop m30m1 or give it its own entry (the M30 Origin / an M5 confirmation).
Replica live buy 04:15 at +0.29R; Asia shadow sells (scalp/m30m1) keep losing into the rally.

## 4 Nov 06:30 — Replica: does the last result matter? (rejected; look-ahead trap noted)

Live: replica buy 04:15 won +2R at 05:54 (gold ran to 4,010); live replica 2 trades, +1R. Old 15:22 scalp sell stopped −1R.
First pass ("previous signal of the day won/lost") looked strong: after a win −0.15 | −0.40 (t −2.8), after a loss +0.34 | +0.49.
But that used the previous signal's final result before it had closed (look-ahead). Using only replica trades already closed at
the signal (6/12/24 h windows): after a win +0.02 | +0.18, after a loss +0.29 | −0.03 (6 h) — the groups swap between halves.
Nth signal of the day and "a replica trade already open" also show nothing consistent. No change.

## 4 Nov 07:30 — Replica v4 by volatility regime (no change)

Regime = the signal's M15 ATR vs the median M15 true range of the previous 10 days (no look-ahead); terciles at 1.25× and 1.72×.
calm +0.22 | +0.13 · normal +0.10 | +0.35 · volatile +0.25 | −0.11 (first 100 d | last 50 d, R/trade).
Volatile flips from best to worst between halves; no regime filter. Gold rallied to 4,019 this morning; the 04:15 live buy caught it (+2R).

## 4 Nov 08:30 — Live vs replay: the Trader catches every replica signal (check passed)

Replayed the Trader's replicaSignals on fresh Kraken PAXG candles (probe 08:25) for every M5 close since 3 Nov 20:35: 3 signals
(21:35 buy, 00:35 sell, 04:10 buy), all passing; all 3 are in research.json with the same side and verdict (the 04:10 one recorded at
04:15, the next run). No missed signals from the 10-minute CHoCH window. Entry prices differ by the spot shift (replay used today's
offset for the whole night). Shadows: the 07:09 rscalp sell lost −1R into the rally; gold 4,031.

## 4 Nov 09:30 — NQ sweep at the Tokyo (00:00 UTC) and Shanghai (01:30 UTC) opens (paper, #168)

Same rule as NY: liquidity = previous NY session high/low, evening high/low since the 18:00 ET reopen, high/low of the hour before
the open; first close back inside a swept level within the first hour → opposite, stop 2 pt past the extreme, 1.2R, out 07:00 UTC.
- Tokyo, all levels, 60 min: 5m 50 days −0.19R ×31 (first half −0.29, second −0.10); 1m 21 days +0.29R ×10. Lately good, not proven.
- Shanghai: 5m +0.03R ×23; 1m −0.30R ×6.
- 2-month replay (5m to 5 Oct, 1m after): Tokyo −1.35R ×25 (44% wins), Shanghai −0.73R ×20.
Picking one level type (e.g. evening/pre-open for Tokyo 1m +0.63R) would be fitting 8–10 trades. Both run on paper (research.json
k 'nq-open', session tokyo/shanghai). JS replay with a 10-min lag on the 1m history: Tokyo +2.0R ×9, Shanghai −1.6R ×6 (Python +2.9 / −1.8, before cost differences).

## 4 Nov 10:30 — Gold replica v4 from 1 Jan 2026: the out-of-sample months are flat (important)

Replayed with the live Trader's own code (replicaSignals + H1 Origins, market hours only) on Binance PAXGUSDT 1m.
Jan −4.9R (161) · Feb +2.4 (72) · Mar +0.8 (105) · Apr −1.6 (90) · May −7.7 (73) · Jun +12.2 (96) · Jul +18.3 (56) · Aug +20.8 (121) ·
Sep +28.9 (99) · Oct +14.6 (133) · 1–3 Nov −2.0 (14). Total +81.8R over 1,020 trades.
Jan–May (never used to design v4): −11.0R over 501 trades (−0.02R a trade). Jun–Nov (the 150-day window v4 was built and
filtered on): +92.8R over 519. The filter (H1 clear or ★ engulfing, risk ≥ 1 ATR) was chosen on Jun–Nov, so part of that edge is
fitted. Forward record so far: 2 live trades, +1R. Keep the live test running (paper) to ~30 trades before judging, and treat
v4's expected edge as closer to 0 than +0.15R until the forward record says otherwise.
Also: Dukascopy USATECHIDXUSD returns 503 to GitHub runners (4 Nov); NQ history stays from 3 Sep. NQ Asia replay now includes
Mondays: Tokyo −4.25R ×30, Shanghai +0.63R ×25 (3 Sep – 3 Nov).

## 4 Nov 11:00 — Replica v5 shipped: only against the H4 trend (out-of-sample confirmed on Jan–May)

Year replay, Trader's own code (all features recorded per signal): v4 pass Jan–Jun −0.01R ×518 | Jun–Nov +0.17R ×502.
v4 + H4 against: +0.08R ×252 | +0.22R ×248, positive in all four quarters; monthly 9 of 11 positive; year +74.8R ×500 vs v4 +81.5R ×1,020;
max DD −23.6R vs −29.9R. Pre-registered (logged 4 Nov 04:30 on Jun–Nov only), so Jan–May is out-of-sample.
Also seen in the same scan (not shipped: found by searching ~40 splits, could be luck): all signals against D1 +0.09 | +0.13;
v4 in Asia +0.32 | +0.18; leg 4–6 ATR +0.12 | +0.22. Candidates for later, to be re-tested on the forward record.
Rejected (flip between periods): sessions other than Asia, risk bands, ★ alone, H1/D1 with, leg window.

## 4 Nov 11:30 — Replica exit: trailing stop beats the fixed 2R on both halves of the year (shipped)

v5 trades, same entries: 2R +0.084 | +0.216 (year +74.8R); 3R +0.218 | +0.146 (+91.2); half at 2R, rest 4R +0.154 | +0.189 (+85.9);
trail 1R behind after +1.5R +0.165 | +0.231 (+98.7); trail 1.5R after +2R +0.172 | +0.243 (+103.5, 10/11 months).
Sensitivity: all 9 trail settings beat 2R on Jan–Jun; activation +1.5–2R best on Jun–Nov. Break-even moves and shorter caps hurt.
v4 + trail: +149.3R over 1,020 (Jan–Jun +0.09R a trade). Shipped: start +1.5R, trail 1R, cap 10R, 48 h.

## 4 Nov 12:00 — Walk-forward of the filter candidates (all rejected) → rules frozen

8 fixed rules on the trailing exit; each month from April the rule with the best R/trade on all prior months (≥30 trades) is applied
to the next month. The picker chose "v5 + Asia only" every month: walk-forward Apr–Nov +16.7R vs plain v5 +62.1R. Year totals:
v5 +98.7 (500) · v5+Asia +35.9 (126) · v5 not London +59.9 · v5 against D1 +50.9 · v5 leg ≥4 ATR +38.9 · v5 ∪ (D1 & H4 against)
+113.0 (726) · v4 +149.3 (1,020) · v4 against D1 +83.4. The extra filters only look good in hindsight.
Decision: freeze gold replica v5 + trailing stop (start +1.5R, trail 1R, cap 10R, 48 h) for the forward test (~30 live trades,
mid/late Nov). Judge at ~30 trades: keep if ≥ +0.1R a trade. Open option for the owner: v4 + trail (+149R, more trades, lower R/trade).

## 4 Nov 12:30 — Daily loss stop vs open-trade cap (owner: "stop after −2R?")

v5 + trailing, year: none +98.7R (DD −21.8, 21 days ≤ −3R) · daily stop −1R +52.4 · −1.5R/−2R +94.3 (DD −19.0, 14 such days; the 47
skipped trades netted +4.4R, 40% wins) · −3R +102.5 (DD −23.0). Max open: 1 → +53.6 · 2 → +89.3 · 3 → +101.5 (DD −20.8, both halves
slightly better). The −3R days come mostly from trades open together, not from trading after losses. Shipped: max 3 open (#174).
Daily stop rejected (costs profit).

## 4 Nov 13:00 — Best drawdown reduction (19 rules; shipped #175)

v5 + trailing, year, ranked by profit / max drawdown: none 4.52 · max 3 open 4.88 · daily −1.5R 5.24 · daily −2R 4.96 · half after a
losing day 4.63 · half after 3 losses 4.85 · equity filter 20 5.45 · equity filter 50 5.66 · max3 + eq50 6.03 · max3 + eq50 + daily −1.5R
6.42 (+91.2R, DD −14.2, worst month −8.4; DD lower in both halves) · max3 + eq50 + daily −3R 6.24 (+97.2, DD −15.6).
Shipped: max 3 open + daily stop −1.5R + half size below the 50-trade equity average (seeded with the replay).

## 4 Nov 14:00 — Edge research round (report: "Gold replica edge improvements"); 3 pre-registered tests

v5 + trailing (no risk rules): n 500, +0.197R, SD 1.54, t 2.87, per-trade Sharpe 0.128; Deflated Sharpe vs 60 trials 0.71 (gate 0.95)
→ borderline after the search; the forward record is the only clean holdout.
1. News blackout (leg or ±30 min contains NFP/CPI/FOMC, standard 2026 dates, 8:30/14:00 ET): removes 14 trades, −0.37R mean,
   t −1.11 (gate t ≤ −2) → FAIL, not shipped. NFP −1.4R (7), CPI −2.5R (4), FOMC −1.3R (3). Tag and re-check on the forward record.
2. Trailing stop on an M15 close beyond the trail (emergency stop at the original stop): paired −0.017R, t −0.68 → FAIL.
3. Equity filter vs random halving (same 110 trades, max 3 + daily −1.5R): filter ratio 6.35 vs no filter 5.24; only 4% of 500
   random halvings matched it → PASS (kept).
Forward test redefined: kill switch at the 5th percentile of a bootstrap of Jan–May trades (−7.2R at 30, −7.8R at 50, −5.9R at
100; drawdown beyond −23R); pass bar ~200 live trades with t ≥ 2. 30 trades cannot confirm the edge (negative ~23% of the time
even with a true +0.2R edge).

## 4 Nov (afternoon): NQ sweeps, the opens

- Yahoo refused every GitHub runner from 14:26 UTC (429); the NQ feed now falls back to CNBC @ND.1 1m (same contract, identical signals on overlap days). CNBC also serves 1m history: full days from 11 Sep.
- Trader's 4 Nov NQ buy = a sweep of the 03:30 ET M15 swing low (28,308.5) at 07:55, buy 08:02, 2R. Swing-sweep setup (paper) over 39 days: 38 trades +5.6R (+0.15R), Sep −4.6R / Oct +10.2R: unstable.
- Open sweeps (10 setups: open price and prior-range sweeps at 00:00, 02:00, 03:00, 08:30, 09:30 ET; 1m, 39 days): shallow sweeps lose (no depth rule −0.20R a trade over 282); the edge rises with sweep depth to +0.11R at 15–20 points, then fades; NY 09:30 sweeps lose at every depth (open price −0.45R over 27: they run).
- New paper setup: open-price sweeps of the midnight, London (03:00) and 08:30 opens, ≥ 15 points, 1m close back within 15 min, 2R, out 11:00 ET, one at a time: 38 trades +15.3R, +0.40R (t 1.7), Sep +11.7 / Oct +3.6, buys +4.7 / sells +10.6. Exclusion of NY and the 15 points chosen on this data → forward test.
- London-range sweep v2 (buys only): 5m history buys +0.47R over 27, sells −0.20R over 22. The NY open sweep setup (paper) is on the wrong side of the evidence above; kept for the record.

## 4 Nov (evening): NQ focus

- Same 1m history for every NQ setup: NY open run (flipped open sweep) +0.73R (27, t 2.8, both months, all depth/reclaim settings positive), open sweeps before NY +0.40R (38), London low +0.23R (19), swing +0.15R (38), NY reversal 0.00R (26), Tokyo −0.14R (30). Only the first two run; the page counts only them. October NQ on the calendar +7.7R/54 → +24.5R/40.
- Why open-sweep trades fail: 7 of 20 losers reached +1R first (break-even/partials/trailing all worse than 2R, kept 2R); trades on the daily-open side did better (+0.67R vs +0.25R) but the other side flipped sign between months, so no filter. NY sweeps run instead of reversing — hence the flip.
- Watch: the NY run's buys carried October (+11.8R over 10) in a rising market; check it holds in a falling month.

## 4 Nov (evening): gold, the NQ open rules carried over

- Pre-registered transfer of the NQ rules to gold 1m (227 days, 0.30 spread, depth 0.054% of price): pre-NY open reversals −0.12R over 301 (3/12 months) — no; NY open run +0.13R over 143 (7/11 months; Jan–Jun +19.6R, Jun–Nov −1.5R), every depth/reclaim cell positive. Added as research (gold-nyrun), not live.
- Replica filters: ~60 variants on the same 2026 data; the honest remaining gold levers are independent signals and forward trades, not more filters.

## 4 Nov (evening): the trader's XAUUSD price-action PDF

- A ChatGPT synthesis (15m direction / 5m location / 1m timing, structural stops, NY Fed stop-cluster evidence). Three testable ideas on the v5 + trailing replay (4 min lag):
  - Round-number stops: a stop within $2 in front of a $10 level moved $0.50 past it → the 76 affected trades +16.7R (+0.22R each, paired t 1.8), both halves; all $10 cells positive, $5 weaker. LIVE (PR #190).
  - Wick-sized buffer (mean 1m range of 15 bars): +0.190R vs +0.197R — no.
  - M15 direction gate: keeps 87/500 trades (+0.25R each) but −77R total — no.

## 4 Nov (night): NQ three-year out-of-sample test

- Trader's NQ futures 1m file (27 Dec 2022 – 11 Dec 2025, 763 days; timestamps = candle close). Rules unchanged:
  - NY open run: 447 trades +62.3R (+0.14R, t 2.15), 2023 +35.9 / 2024 +7.6 / 2025 +19.4, 24/37 months, buys +25.9 / sells +36.3 → KEPT.
  - Open sweeps (midnight/London/08:30): 352 trades −22.4R (−0.06R), 2023 −11.3 / 2024 +4.8 / 2025 −15.9 → OFF. The Sep–Oct 2026 +0.40R was period luck; Dukascopy Dec–Mar agreed (−4.9R over 52).
- Calendar NQ = NY open run only, from Dec 2022 (516 records, +89.9R incl. Dukascopy Dec–Mar and futures Sep–Nov). March–September 2026 still loading.

## 4 Nov (night): gold on 7 years of HistData; NQ report

- GOLD (HistData XAUUSD 1m, 2019–2025, the live v5 code + trailing + round stops + risk rules): −347.9R over 4,102 trades, every year negative, 18/84 months positive. Gross before the 0.30 spread ≈ 0 every year (−0.10 to +0.03R/trade). The 2026 PAXG replay (+0.2R) does not generalise; "against both H4 and D1 skipped" (pre-chosen) halves the loss but stays negative. COMEX GC 16 Sep – 14 Oct 2025 (strong rally): v5 −32.9R over 66 (1m and 5m exits agree). Pending: HistData 2026 months to compare the same period with PAXG.
- NQ report (trader's PDF): next-minute fills same (+0.14R); 1R–3R all positive; PDH/PDL fade −0.04R. Midnight-open filter (00:00 ET open ahead of the trade): file +0.22R over 237 vs +0.05R over 210; outside +0.68R over 29 vs +0.19R over 32 → LIVE (PR #193).

## 4 Nov (night, later): HistData time-zone fix

- HistData XAUUSD times are New York local WITH daylight saving (checked against Binance PAXG: winter aligned at +5 h, summer at +4 h). The first 7-year gold run used fixed UTC−5 (an hour off April–October). Corrected rerun, v5 live rules: 2019 −52.2 / 2020 −73.9 / 2021 −33.0 / 2022 −42.3 / 2023 −16.6 / 2024 −70.3 / 2025 −60.0 / 2026 +35.9 R; gross before spread ≈ 0 in 2019–2025, +0.08R/trade in 2026. Verdict unchanged: the gold replica's edge is 2026-specific; PAXG inflates 2026 further (+95.6R vs +35.9R on spot). Same 2026 signals on both feeds: only 88/493 coincide; matched trades +0.185R on PAXG vs +0.032R on spot.
- NQ New York open run, Dukascopy 9 Mar – 10 Sep 2026, midnight-open filter: 33 trades +19.3R → calendar.

## 4 Nov (night): DXY report + XAU/USD guide, tested on HistData gold 2019–2026

- DXY (HistData UDXUSD 1m, pre-registered): base v5 −0.070R/trade; veto (dollar >0.05%/60 min against) −0.081; confirmation only −0.083; confirmation in inverse regime (corr60 ≤ −0.3) −0.069. Fewer trades, same per-trade loss: no edge from DXY.
- Guide: v5 in London open/overlap windows −0.032R vs −0.089R outside (6/8 years still negative). Asian-range sweep at London open: reversal −0.30R/trade (t −7.7, 7/8 years negative); flipped continuation −0.18R at 1R–3R. Tight sweep stops vs 0.30 spread: no edge either way.
- Gold conclusion: no robust intraday gold setup found on 8 years of spot data; only 2026 is positive for the replica.

## 4 Nov (evening): NY open run on other indices + news days; gold volatility gate

- **S&P 500 (HistData SPXUSD 1m, 2018-Oct 2026)**, the NQ rule with thresholds as % of price (15 NQ pts ≈ 0.08%):
  all 962 trades −17.8R; NDO-ahead 506 trades −2.1R (−0.004R). **No edge on the S&P: ES not added.**
- **Nasdaq 100 cash (HistData NSXUSD 1m, 2018-Oct 2026)**, same rule: NDO-ahead 710 trades +84.3R (+0.12R, t 2.34);
  2023-2026 +76.9R (matches the futures file), but **2018-2022 (never seen before) +7.3R over ~380 trades, ~0.02R a trade**
  (2020 −3.8, 2021 −3.0). The edge is NQ-specific and much stronger since 2023; plan on +0.1-0.2R a trade, not +0.3R.
- **News days (NQ futures file)**: 08:30 release mornings and overnight-range splits flip sign between samples: no filter.
  FOMC days 7 live-rule trades −4.9R: too few to act on.
- **Gold replica by volatility (8 years spot)**: per-trade R rises with the 20-day avg daily range. Gate at 1.5% with the risk
  rules: 2019-2025 +18.9R (vs −312.5R ungated), 2026 +43.2R. Applied as user rule gold-vol-gate (PR #195).

## 4 Nov (night): gold gate walk-forward + feed check

- **Volatility gate walk-forward** (risk rules on, spot HistData): gate chosen on 2019-2022 = 1.5% (the same) → 2023-2026
  +47.3R (2023 −2.7, 2024 −10.7, 2025 +17.6, 2026 +43.2) vs −111.1R ungated. Reverse (choose on 2023-26 → 1.7%) → 2019-22
  −3.6R. The gate reliably removes the big losses; outside 2025-26 gated gold is about breakeven. Kept at 1.5%.
- **Feeds**: CNBC XAU= 1m is unusable (99.8% flat bars, last price only). CNBC @GC.1 (COMEX) 1m is real OHLC, live to the
  minute from GitHub runners, closes track spot twice as tightly as PAXG (0.59 vs 1.16 median deviation from the daily basis).
  But replica v5 signals Jan 12 - Oct 31 2026 matched against spot (same side, within 15 min): GC 160 of 469 spot signals (34%),
  PAXG 175 (37%). **No feed reproduces the spot signals: the M5 CHoCH trigger depends on single-wick details.** Feed not
  changed. Any broker's XAUUSD is another feed again, so live results will differ from every replay.

## 4 Nov (night): sturdier gold trigger?

- **M15 trigger** (same rules on 15-minute candles, 3 h / 6 h legs): v5 signals matched against spot Jan-Oct 2026 —
  GC 36%, PAXG 38% (M5: 34% / 37%). No gain in agreement; 2026 results flat (spot −3.4R, GC +0.6R, PAXG −40.9R, 2R exit).
- **Where the feeds diverge** (M5, share of spot signals reproduced): raw trigger GC 53% / PAXG 69%; + stop ≥ 1 ATR 52/67;
  + H1-clear-or-★ 39/45; + against H4 34/37. The structure filters (H1 Origins, ★, H4 trend) cause most of the disagreement.
- **Simpler filters on 8-year spot, 1.5% gate, risk rules, trailing**: v5 +61.1R (2019-25 +18.0, 2026 +43.2);
  no H1/★ filter +35.8R (2019-25 +30.5, 2026 +5.0); stop ≥ 1 ATR only −18.3R. No variant is both sturdier and better:
  **v5 kept unchanged.**

## 4 Nov (night): NQ New York open run — exits, a 10:00 window, volatility-scaled depth

Both datasets, live rule (NDO ahead). Futures file Dec 2022 - Dec 2025 (237 trades) | Nasdaq cash HistData 2018 - Oct 2026 (704).
- Live (2R, out 11:00): +51.1R (+0.216) | +83.0R (+0.118).
- Later cutoff 11:30 / 12:00: +46.2 / +43.1 | +69.0 / +65.4. Worse on both.
- Half at 1R + break-even: +40.5 | +66.8 (smoother, less total). 3R at 12:00: +37.2 | +71.8 with double the drawdown.
- Trailing (from 1.5R, 1R behind, cap 4R, 12:00): +45.8 | +90.5; (from 2R, 1.5R behind, cap 5R): +52.2 | +101.6 but drawdown
  −11.1 / −26.1. Better on cash only, flat on futures: not adopted.
- 10:00 open window alone: −29.0R | +3.8R. Rejected.
- Depth as a share of the 20-day average RTH range (0.04-0.10): futures +24.8 to +36.9 (all below the fixed 15 points);
  cash 0.08-0.10 +84-92R. Inconsistent: not adopted.
**No change: the live NQ rule is the best or tied on the futures file in every test.**

## 4 Nov (night): gold — where the gated edge lives, and a gold kill switch

Gated v5 with exit v2 (trail +2R/2R), per trade, 2019-22 | 2023-26: all +0.110 | +0.112. Consistent in both halves:
Asia 22-07 UTC +0.25 | +0.21 (NY 13-22 UTC −0.12 | +0.08); leg ≥ 4 ATR +0.29 | +0.28; ★ +0.14 | +0.14 vs H1-clear-only
+0.09 | +0.08; vol ≥ 2% +0.14 | +0.33 vs 1.5-2% +0.09 | −0.07. With risk rules none of the filters beats the live set on
total (live +44.8 | +87.4, max DD −38.5R; skip NY +42.6 | +74.5, DD −33.3; leg ≥ 4 ATR +13.8 | +58.2, DD −20.6): no change.
Gold kill switch set from the gated distribution (865 trades, +0.153R, SD 1.77R; 20,000 resamples): 5th percentile
−10.3R at 30 trades, −11.9R at 50, drawdown −19.7R within 60 trades → alert at −10.5R / −12R / −20R drawdown.

## 4 Nov (night): barrier vs pure market structure (gold 2023-2026, owner's question)

Rules fixed first (`ms/models.py` in the session scratchpad): H1 fractal swings (2/2), BOS on close; OB = last opposite
H1 candle before the BOS leg; EG = H1 engulfing with body ≥ 0.5 ATR (zone: pair's extreme to the engulfed open); zones die
on an H1 close through the far side or after 10 days. A = barrier touch + M5 CHoCH within 12 h (stop past the touch extreme);
B = H1 trend + M15 lower-high/higher-low + M15 CHoCH. Max 3 open, 0.30 spread.
- B (pure structure): −246R (2R) / −220R (trail) ungated; −43R / −16R gated. Loses.
- A all barriers: −157R / −67R ungated; gated trail −13.6R. OB loses everywhere (gated trail −73R); EG gated trail +37.6R
  (+6.0 | +31.6). Barrier against the H1 trend (reversal) gated trail +40.1R (+8.1 | +31.9); in-trend −72.5R.
- Barrier as target (next opposing zone ≥ 1.5R): worse than 2R or trailing in every group.
- Replica v5 gated, exit v2, by where its extreme sits: at an H1 EG 151 trades +0.293R (+6.6 | +37.6); at an OB −0.124R;
  not at a barrier +0.113R. Applied (PR #199): live = D1-with OR at-EG → 392 trades +71.9R, DD −15.8R.
- Mosha's 2 Nov sell: extreme 3,916 inside a fresh H1 bearish EG 3,914.8-3,927.7 (03:00 UTC). His buy's extreme 3,891 is
  ~10 below the nearest bullish EG (3,900.9-3,914.3): his barrier there was Friday's reversal Origin (higher timeframe).

## 4 Nov (night): M1 CHoCH entry vs M5 (gold 2023-2026)

Same leg (2+ M15 ATR on M5, 3 h / 6 h), trigger = the first M1 close back through the last M1 swing before the extreme;
entry at that M1 close, stop past the extreme as before. Gated, against H4, exit v2, risk rules.
- Median stop $12.60 (M5) vs $7.06 (M1).
- v5 filter: M5 617 trades +88.0R | M1 567 +19.1R. Live rule (v5 + D1-with or at-EG): M5 392 +71.9R (DD −15.8) |
  M1 265 +13.1R (DD −19.4). Without the stop ≥ 1 ATR filter: M1 +35.6R at best. At-EG only: M1 +28.9R vs M5 +4.8R.
- Exits re-tuned for M1 (1.5/1, 3/3, 4/3 trails): M1 +5.0 to +15.2R vs M5 +18.0 to +85.3R.
**M1 entries are earlier but get stopped more often; M5 kept.**

## 4 Nov (night): Mosha "Barrier style" from his Telegram posts (gold 2023-2026)

From the owner's screenshots of the Mosha Private Room: HTF BO = bias (mark High/Low); VR = the turn at the extreme
(phase 2 = pullback; "at least H1 make VR first"); Origin; CF = lower-timeframe confirmation (e.g. H1 BO buy → M30 BO →
M15 VR → M15 CF); external vs internal structure by the 0.382/0.5/0.618 of the leg; Case 4 = ranging between VR and CF →
"Barrier style": "price come to our strong Barrier (m30 VR) → trade M5 cf"; exits close 80% / hold 20%.
Test: barriers = the engine's VR boxes (born at the VR confirmation close) and post-VR CF boxes on M30/H1/H4; first touch,
then an M5 CF (CHoCH) away from the zone within 12 h; stop past the touch extreme; 2R / trail 2-2 / 80% at 2R + 20% trail.
- First pass looked strong (M30 CF +111.5R, both halves) but was hindsight: msAnalyze run once on the whole history keeps
  only each event's last 4 CF swings (`e.cf.slice(-4)`), which is only known after the event ends. The live trader runs it
  on bars up to now, so the live engine is not affected; only that research shortcut was.
- Causal zones (every post-VR CF swing, born when both the swing and the VR are confirmed, dead at the next break):
  all barriers 2,804 trades −371.7R (2R) / −408.3R (trail); M30 CF −202.7R; H1 CF −71.9R; VR barriers −72R over 142;
  gated 1.5% −81R. Only inside the H4 VR phase (Case 4): −271R; with H4 structure −105R, against −168R.
**Encoded barrier style loses. No change; the current gold system stays.**

## 4 Nov (night): Mosha SOP "BO → VR → CF, repeat" on a wide frame (gold 2023-2026, causal)

Engine msAnalyze (N=6) on the wide frame, run on bars up to each lower-timeframe close (no hindsight). Once the VR is fixed,
wait for the pullback, then enter on the first LTF close back through the last LTF swing (2/2) against the pullback, in the
BO direction; stop past the pullback extreme; one trade per VR. Exits 2R / trail 2-2 / target = the VR extreme.
- H4 → M15: 96 trades, −10.1R (2R), −4.3R (trail). H4 → M5: 107, −9.5R / −6.5R.
- H1 → M15: 418, −33.1R / −1.9R (2023-24 −29.8, 2025-26 +27.9); gated 1.5% trail +23.6R (132, 2023-24 −4.0).
- H1 → M5: 465, +13.0R (2R; 2023-24 −25.2, 2025-26 +38.2) / +3.7R trail; gated trail +19.0R (144, 2023-24 −4.6).
- Target at the VR extreme is worse everywhere; pullback depth (main past 50% vs internal) has no consistent sign.
**About breakeven over 4 years, positive only in 2025-26. Not better than the live gold replica (+71.9R, DD −15.8R).**

## 4 Nov (night): Mosha CF entry with the opposite zone as target (gold 2023-2026, causal)

Owner: "on CF you should enter, that's why it is called CF, and target the opposite zone". Two readings tested:
1. Entry at the moment the CF prints (LTF close back through the pullback's last swing after the W VR), target = the VR
   extreme (`ms/sop.mjs`, Rv): H1→M5 −11.0R (326), H1→M15 −26.9R (243), H4→M15 −10.0R (77), H4→M5 −30.0R (95).
   With an Origin wait first: H1→M5 −3.7R, H1→M15 −21.2R, H4 −12.5 / −21.2R.
2. Limit entry on the engine's CF box (near edge), stop past the box, target the VR box (`ms/cfentry.mjs`):
   M30 1,224 trades −462R (29% wins), H1 638 −221R, H4 183 −83R; reward ≥ 3R and the 1.5% gate still negative.
**Neither reading has an edge on gold as coded.** The CF box the engine draws (pivot ± 0.35 of the leg) is wide, so
entries at its near edge carry wide stops and small rewards; Mosha's CF zone is probably tighter.

## 4 Nov (night): top-down stack H4 → H1 → M15 → M5 (gold 2023-2026, causal)

The BO → VR → CF cycle on M15 (CF on M5 or M1) and on H1 (CF on M5 or M15), split by the H4 and H1 structure (engine trend
at entry). Full stack aligned (H4 + H1 agree with the trade): M15/M5 −25.1R (2R, 628), M15/M1 +16.6R (700, +0.024),
H1/M5 −12.7R (294), H1/M15 −33.1R (261). H4 against: H1/M5 +25.6R (171, +0.150, 2023-24 −4.9), H1/M15 0.0R.
**Stacking the timeframes in agreement adds no edge; the only positive split is the cycle against H4 (a pullback),
the same thing the live replica already trades.**

## 4 Nov (night): Mosha "Breakout System" (BO → opposite BO → BO, 3 timeframes, pullback entry) — gold

From the owner's TikTok screenshots (moshatrades, Nov 2024 / Jun 2025): "breakout only, 3 timeframes": sell = T1 BO sell →
T2 BO buy → T3 BO sell → wait for pullback & entry (buy mirrored); his table D1/H4/H1, H4/H1/M30, H1/M30/M15, M30/M15/M5.
Test (`ms/bo3.mjs`, engine events causal, T3 must flip structure, limit at the broken T3 level, stop $0.30 past the T3 Origin,
1:2 / 1:3, 72 h): 2023-26 H4→H1→M15 115 trades +10.8R / +18.0R (both halves +); H4→H1→M30 58, +3.9 / +4.0 (gated +13.8);
D1→H4→H1 39, ~0; H1→M30→M15 −16R; H1→M15→M5 −61.5R; M30→M15→M5 −2.7R. 2019-22 (never seen): H4→H1→M15 105 trades
+13.4R / +10.5R, H4→H1→M30 +9.5R, D1→H4→H1 −1.9R. With the trader's own limit rules (cancel if 3R is hit first): valid 3 h
weak; 12-24 h: 2019-22 +7.5 to +11.5R, 2023-26 +8.9 to +15.1R. **Applied H4→H1→M15, 3R, 24 h (PR #202, user rule mosha-bo).**
Note: his posted examples use H1→M30→M15, which lost here; the higher chain held.

## 4 Nov (night): "Sharp Entry / BOOM" — entry inside the breakout leg instead of at the broken level

Mosha: the broken level is a "No Trade Zone"; find the entry zone inside the breakout (BOOM on the lower timeframe).
Proxy test on the BO system (limit deeper into the M15 BO leg, same stop past the Origin, 24 h, missed rule):
H4→H1→M15 at the level 2019-22 +7.5R (3R) / 2023-26 +15.1R; 0.33 into the leg +9.6 / −14.2R; 0.5 into the leg −6.3 / −11.1R.
H4→H1→M30: level +4.9 / +4.0R; deeper entries flat to −6R. Deeper fills are fewer and worse (when price returns that deep the
breakout is failing). **Kept the entry at the broken level.** His BOOM 1 / BOOM 2 shapes themselves are not coded yet.

## 4 Nov (late): everything from Mosha's TikTok slides, tested on spot gold 2019-2026 (walk-forward 2019-22 vs 2023-26)

Owner: "test it in all the way possible". Engine events causal, limit fills on 1m candles, 0.30 spread, out after 72 h.
Grid: 6 timeframe chains (D1-H4-H1, H4-H1-M30, H4-H1-M15, H1-M30-M15, H1-M15-M5, M30-M15-M5) x swing size 3 and 6 x three
entries (broken level, 33% into the breakout candle, market) x exits (2R, 3R, leg-extreme target, trail), with filters
recorded (weekly "Father" direction, daily direction, M15 flip, first BO back, volatility, hour, retracement depth).

- **Breakout System H4 → H1 → M15, swing 6, limit at the broken level, 3R, weekly structure agrees** (weekly = Monday weeks,
  swing 3): 2019-22 +32.2R / 87 (+0.37R a trade), 2023-26 +27.3R / 101 (+0.27R); 7 of 8 years positive (2023 the loser,
  −7.1R); worst drawdown −18.4R. Weekly against: −28.3R / −8.9R. Old live rule (M15 flip only): +7.5R / +15.1R.
  With the weekly read the way the Trader can read it live (last 720 days of daily candles only): +32.2R / +34.2R (99).
  → **adopted** (user rule `mosha-bo-weekly`, PR #203). The M15 flip requirement is dropped: with the weekly agreeing,
  non-flip M15 BOs did better (+0.50R / +0.48R a trade, 84) than flips (+0.26R / +0.11R, 104).
- Daily direction on the same chain points the same way (agrees +0.20R / +0.19R, against −0.27R / +0.01R); weekly + daily
  together +0.41R / +0.21R (147): no better than weekly alone, so not added.
- **Caveat (multiple testing):** the weekly filter does NOT help the other chains (H4-H1-M30 +0.40R then −0.12R; H1-M15-M5
  −0.30R / −0.18R; swing 3 on H4-H1-M15 −0.19R / +0.01R). One good cell in a grid of ~70; it is kept because it is the
  owner's own top-down rule, both halves and 7 of 8 years agree, and the opposite side loses. Kill switch: −10R at 30
  trades, −12R at 50, drawdown beyond −18R.
- Targets on the adopted cell: 3R +32.2R / +27.3R; leg extreme (his "opposite zone") when ≥ 1R, else 3R +31.8R / +30.7R;
  leg extreme only (skip when < 1R) +0.55R / +0.49R a trade but only 114 trades; 80% at 2R + 20% trail +24.7R / +21.9R.
  3R kept (simplest, same total).
- Entries: broken-level limit best; market entry +45.0R / +21.9R (weaker in 2023-26); 33% into the breakout (BOOM-style)
  worse, as in the earlier BOOM test.
- **Feed check for the weekly:** PAXG daily candles give a different weekly structure (premium over spot drifts over months:
  on 3 Nov spot closed the week of 26 Oct through the weekly low 3,886 → bearish; PAXG still bullish). CNBC `XAU=` daily
  (probe on council-probe, keyless) matched the HistData spot weekly direction in 95 of 95 weeks since Jan 2025; COMEX
  @GC.1 daily also 95/95. Live uses CNBC XAU=, PAXG only as fallback. Stooq (JS wall) and Yahoo (429) failed from Actions.
- **Engulfing SOP** (EG at a level, entry on the retest, stop past the EG): negative on every timeframe and filter tried.
- **RSS / SRR strong levels:** strong levels beat weak ones, but limit entries at them lose. Best: H1 strong level + weekly
  agrees + an M15 BO confirming off it, 3R: +0.06R / +0.11R a trade, +22.4R over 271 trades. Too thin to trade; not added.
- **Replica (gold v5) + weekly filter:** inconsistent (gated, weekly agrees +0.03R / +0.21R; against +0.19R / +0.06R),
  so the replica stays as it is.

## 4 Nov (late): out-of-sample check of the Mosha BO system + another pass over the Private Room Notes PDF

**Out of sample (same rule, other markets, HistData 1m 2019-26, spread/stop buffer sized per market).** H4→H1→M15, swing 6,
weekly agrees, limit at the broken level, 3R — 2019-22 / 2023-26:
gold +32.2R / +27.3R (in sample) · silver −48.9R / +22.8R · EUR/USD −29.7R / −14.2R · GBP/USD −29.7R / +4.7R ·
USD/JPY −1.5R / −56.9R · Nasdaq +14.7R / −16.5R · S&P −45.8R / −19.3R. **0 of 6 other markets hold**; outside gold
about −220R over ~1,430 trades. Without the weekly filter the system is also negative everywhere but gold.
Placebo on gold (weekly direction shifted 26-350 weeks, 400 shifts): 3.3% of shifts beat +59.4R total, 2.0% beat it in
both halves — significant for that one cell alone, not after picking it from ~80 cells, and contradicted by the six markets.
**Verdict: the gold result is most likely luck.** The system stays on paper as a forward test with an expectation near 0.

**Private Room Notes PDF, rules not tested before (gold, H4→H1→M15, weekly agrees):**
- "50% of the range at least" as a retracement filter: depth ≥ 0.5 +0.15R / +0.34R vs < 0.5 +0.77R / +0.22R — flips.
- "QM > BO normal (for VR and CF)": the opposite held — M15 CF continuation +0.50R / +0.48R vs flip +0.26R / +0.11R;
  H1 VR continuation +0.62R / +0.44R vs VR flip +0.12R / −0.02R. But the VR effect appears only in this cell (other gold
  chains, Nasdaq, S&P: mixed or reversed), so it is noise.
- Janda (BO structure → the next BO the same way → pullback): +0.38R / +0.37R (45 trades), no better than the base.
- Sessions: no consistent pattern. Exits: 3R ≈ leg-extreme target > trail ≈ 2R. Market entry +0.46R / +0.19R.
- **Barrier formula** (zone TF → confirmation TF: D→H1, H4→M15, H1→M5; zone = lower half of the last zone-TF BO leg;
  Simple CF = confirmation-TF flip starting in the zone; Janda = the next continuation BO): negative or flat in 30 of 36
  cells; best H4→M15 Janda + weekly +10.2R over 26 trades (noise-sized).
- **"50% of the range" structure engine** (a pullback counts as a swing only if it retraces half the leg; strict version is
  scale-free and gives ~1 event a year on every timeframe, so the range was limited to the last 48 candles): BO system on it
  across gold, silver, EUR/USD, Nasdaq, S&P x 4 chains: results scatter around 0, signs flip between halves; no edge.

**Where an edge could still be:** the discretionary part (why a setup is skipped, "why failed?") is not in any mechanical
rule tested. The direct test is Mosha's own call record: with 50-100 of his Private Room calls (time, entry, stop, target),
his real hit rate can be measured and compared with what the engine flags at the same moments.

## 5 Nov: pairs join the council; the owner's NQ "opening 4H candle" idea

**Pairs (user rule `pairs-live`, PR #205).** The replica's live rules replayed on every council market (forex HistData 1m,
crypto Binance 5m; gate = 20-day range in the top fifth of the market's own last 365 daily candles; daily trend or H1 EG
barrier; trail from +2R; max 3 open, −1.5R daily stop), 2023 - Oct 2026: EUR/USD −15.5R (128), GBP/USD −31.2R (123),
AUD/USD −25.4R (142), USD/CAD −22.6R (115), USD/CHF −37.5R (106), BTC −46.2R (271), ETH +1.9R (293), SOL +10.5R (133),
XRP +4.3R (156) → pairs −161.7R over 1,467. 2019-22 forex also negative except EUR/USD +53R. Gold in the same harness
+86R over 377 (2023-26), which matches the live gold replay (+72R over 392). The pairs trade live on paper anyway (owner's
call) with a −10R kill switch per pair; their replay is in replay-2w.json so the council total shows the cost. Found and
fixed on the way: replica records rounded prices to 2 decimals (all forex research before 5 Nov is meaningless).

**NQ opening 4H candle (owner's TradingView indicator "NQ Opening 4H Candle High/Low").** Levels: the high/low of the first
4-hour candle of the CME day (18:00-22:00 ET = 23:00-03:00 UK), ±50% of its range beyond them, ±2x range ("2r"). Rule as
given: after that candle closes, when price reaches +50% or −50%, trade the opposite way (or to 2r). Tested every reading,
one trade a session, 22:00-16:00 ET, 0.5 pt (futures) / 1 pt (cash) cost:
- The ±50% line is reached on 741 of 767 sessions (NQ futures 2023-25): it is a normal day's range, not an extreme.
- Fade at the touch, 3 stops (the 2r line / 0.5 range / 0.25 range) x 6 targets (1R, 2R, the 4H edge, range mid, the
  opposite edge, the opposite 50% line): NQ futures between −0.047 and +0.055R a trade; NSX 2018-26 between −0.162 and
  +0.038R. The best pair on both (stop 0.5 range, target the opposite 50% line: +0.042 / +0.038R, ~800 trades) is far from
  significant (t ≈ 0.6) and has losing years on both (NQ 2025 −45R, NSX 2018 −24R).
- Follow-through to the 2r line (stop back at the 4H edge): NQ −0.025R, NSX +0.020R.
- Rejection version (5-minute close back inside the 50% line, stop past the sweep extreme): 2R −0.084R (NQ) / −0.196R (NSX);
  target the opposite 4H edge +0.158R on NQ but +0.006R in its first half and −0.108R on NSX 2018-26.
Verdict: no edge in any reading on 3 years of NQ futures or 8 years of Nasdaq cash. Not added. If the owner has the exact
stop/entry rules, test that version only.

## 5 Nov: best settings and edge for the pairs (owner: "not NQ and gold")

Walk-forward throughout (forex: pick on 2019-22, judge on 2023-26; crypto intraday: 2022-23 vs 2024-26; crypto daily: Binance
2018-21 vs 2022-26). Costs: forex spread 1.2-1.8 pips; crypto 0.04% intraday (too kind for Kraken, whose spot fees are about
0.25-0.4% a side), 0.3% and 0.8% round trip for the daily systems.
- **Replica grid** (lab/pairs_grid.py; filter x stop 0.5/1/1.5 ATR x H4 against/with/any x D1 with/against/any x own-history
  volatility high/low/any x EG barrier x session x 7 exits ≈ 11,000 settings a pair): best-on-train lost on test on 7 of 9
  pairs (only USD/CAD +0.63R on 22 trades and XRP +0.09R positive); top-20 on train averaged −0.33 to +0.02R on test; 7-21%
  of settings positive on test. No edge.
- **Session systems** (lab/pairs_alt.py): Asia range (00:00-07:00 UTC) breakout at London (stop mid-range, 1R/2R) and fade
  (wick out, close back in): −0.05 to −0.27R a trade on forex and crypto. Open sweeps at 07:00 / 13:00 UTC (0.1 / 0.2 ADR,
  with / fade): negative except "13:00, with the sweep, 0.2 ADR" on forex (+0.27 / +0.16R, 24 + 31 trades: too few).
- **Daily trend on forex**: Donchian 20/55/100 with 2/3/4 ATR, MA 20/100 and 50/200, long+short: 2023-26 negative on every
  pair for every rule (0/5).
- **Daily trend on crypto** (lab/crypto_trend.py, 10 coins): wide trails work, tight trails don't (2 ATR: −0.13 to −0.33R on
  every rule, 1-2 coins positive). Donchian 55 / exit 27, 4 ATR trail, long only: train +1.05R, test +0.30-0.33R (8/10 coins);
  N100: +0.97 / +0.42-0.45R (9/10); N20: +0.70 / +0.22-0.25R (8/10). MA 20/100 long-only +5.5 / +0.68-0.72R (9/10; R per trade
  inflated by 2020 runaway winners). 2022 negative, 2023-24 positive, 2025-26 slightly negative.
  Council coins, N55 long 4 ATR, 0.8%: 2022-26 BTC +6.5R (13), ETH +5.0R (13), SOL +9.6R (13), XRP +12.9R (10); drawdowns 2-4R.
**Adopted (PR #207, user rule pairs-best):** crypto trend live on paper on BTC/ETH/SOL/XRP (N55 long-only 4 ATR); forex and
the crypto replica research only. Expect roughly +0.3R a trade, ~12 trades a year across the four coins, long flat spells.

## 5 Nov: NQ opening 4H candle, owner's exact entry (first opposite 1-minute candle after ±50%)

Rule from the owner: opening 4H candle 18:00-22:00 ET; after it closes, when price reaches 4h+50% (4l−50%), enter on the first
1-minute candle that closes the opposite colour (bearish → sell, bullish → buy) at its close. One trade a session.
Stops tested: 1 pt past the extreme since the touch / 1 pt past the entry candle / the 2r line; targets 1R, 2R, 3R, the 4H
edge, mid, the opposite edge, the opposite 50% line; cost 0.5 pt (futures) / 1 pt (cash). Script: nq4h/opp1m.py.
- NQ futures 2023-25 (741 trades): stop past the extreme, 2R −67.0R (−0.090R a trade; gross of costs −0.013R); every
  extreme/candle-stop variant negative (−0.05 to −0.16R); 2r-line stop ≈ 0 (−0.002 to −0.028R).
- Nasdaq cash 2018-26 (824): stop past the extreme, 2R −204R (−0.248R; gross −0.055R); 2r-line stop ≈ 0.
- Sub-cases: Asia entries (before 03:00 ET) worst (−0.22R futures, −0.41R cash); 09:30-16:00 ET −0.03R; "touch candle
  excluded", "within 5 min", 3 pt buffer: no change.
- Recent: NSX Nov 2025 - Mar 2026 positive months (+6.5, +3.8, +3.5, +8.1, +0.5R) and NQ Nov-Dec 2025 positive, a streak after
  years of losses; NQ 14 Sep - 4 Nov 2026 (37 trades): −8.8R.
Verdict: no edge as a mechanical rule; the 1-minute stops (median 6-7.5 pts) make costs alone 0.07-0.16R a trade.

## 5 Nov: NQ opening 4H candle as standard-deviation projections (owner: "it's a standard deviation")

Levels = the opening 4H candle's range projected beyond its high/low in SD units (1 SD = one range): the indicator's "+50%" is
0.5 SD, "2r" is 2 SD. Reach rates after 22:00 ET (NQ futures 2023-25 / NSX 2018-26): 0.5 SD 97/95%, 1 SD 87/83%, 1.5 SD 76/68%,
2 SD 65/57%, 2.5 SD 54/46%, 3 SD 44/35%, 4 SD 29/22%. Fades at every level (first opposite 1-minute candle after the touch;
stop 1 pt past the extreme or at the next half SD; targets 2R, 3R, the previous half SD, back to the 4H edge), script
nq4h/sd.py, ~54 cells per dataset:
- 0.5 SD: NQ −0.07 to +0.02R a trade, NSX −0.17 to −1.0R. Back to the 4H edge: NQ +1.4R / 1,037 (≈0), NSX −189.6R / 1,114.
- 2 SD ("2r") fade back to the 4H edge: NQ +4.8R / 549 (+0.009R, t 0.06), NSX +50.5R / 527 (+0.096R, t 0.57); without each
  side's 5 biggest winners (17-33R each): −100R / −81R. Lottery-shaped, not significant; 2023 −60R on futures vs +13R on cash.
- 2.5 SD fade back to the edge: NQ +63.5R (+0.14R, both halves +) but NSX −84.1R (−0.20R). 4 SD: small samples, mixed.
- Recent NQ 14 Sep - 4 Nov 2026: 0.5 SD fade back to the 4H edge +16.3R over 48 (+0.34R): a hot streak (also Nov 2025 -
  Mar 2026 on NSX) inside a flat-to-negative 8-year record. That streak is likely what the owner sees on the chart.
Verdict: no level/stop/target combination holds on both Nasdaq histories. Not added to the council.

## 5 Nov: NQ opening-4H SD levels with a 1-minute IFVG entry (owner's entry model)

At SD level k (0.5-4), after the touch: fade = an FVG left by the push into the level is inverted by a 1m close through its
far side (enter at that close, within 60 min); continuation = an opposite FVG inverted with the move. Stops 1 pt past the
extreme / past the FVG; targets the next half SD back ("next opposite one"), one full SD back, the 4H edge, 2R. Costs 0.5 /
1 pt. NSX uses the DST-fixed sessions. Script nq4h/ifvg.py. R a trade, NQ 2023-24 | NQ 2025 | NSX 2018-26 | Sep-Nov 2026:
- Fade 0.5 SD, target next (= 4H edge): +0.055 | +0.120 | −0.052 (t −1.7, n 2,771) | +0.229 (48).
- Fade 2 SD ("2r"), stop past extreme, target 1 SD back: +0.068 | +0.162 | +0.040 | −0.078 (16); target the 4H edge:
  +0.072 | +0.327 | +0.047 | −0.095. Best consistent family, but every t ≤ 1.5.
- Next-half-SD targets ≈ 0 or negative at most levels; 2.5-4 SD fades and all continuation IFVGs negative on NSX.
Verdict: the IFVG entry is better than the opposite-candle entry (the 2 SD fade turns mildly positive on three of four
samples) but nothing is statistically significant. Paper-track candidate only.

## 5 Nov (loop 1): HistData time convention settled

The 08:30 and 09:30 New York volatility spikes sit on the same HistData labels in winter and summer (NSXUSD, EURUSD, GBPUSD 2024),
so HistData labels are New York wall-clock time including daylight saving, not fixed EST as its docs say.
- The NQ New York open run's 8-year Nasdaq cash check (idx/run.py parses labels as New York time) was right: NDO-ahead +89.3R
  over 642 (+0.139R, t 2.64). Parsing as fixed EST instead gives ~0R, which shows how timing-sensitive the open run is.
- Loaders that added a fixed 5 h (lab/core2.mjs for forex / NSX / SPX, nq4h/load.py) were 1 hour late in US summer. Affected:
  the pairs' replica / session-system studies and the bo_mkt NSX/SPX runs (summer sessions shifted 1 h); daily systems barely.
  The forex "no edge" verdict rests on many families and both seasons, so it stands; the SD-level study after the DST fix
  (sdx_*, ifvg.py) already used corrected NSX sessions. core2 now converts with New York DST.
- Gold HistData (hd/xau_*.json) was converted from New York local time correctly.

## 5 Nov (loop 2): Mosha SOP with closing-price market structure

Structure built on closes only (line chart: every candle's open/high/low = its close, so swings, BOs, VR and CF all come
from closing prices); the chain H4 BO → H1 BO against (VR) → M15 BO back (CF), plus H4-H1-M30, H1-M15-M5, D1-H4-H1; swing
size 3 and 6; filters weekly (close-based) agrees / against, daily agrees, CF is a flip; limit at the broken close level or
market; 2R / 3R / leg-extreme targets; real 1-minute fills and costs. Gold, EUR/USD, Nasdaq cash, silver 2019-26 (lab/bo_close.mjs,
lab/bomc_rep.py). 1,129 cells: positive in both 2019-22 and 2023-26 in 18% (gold), 15% (Nasdaq), 1% (EUR/USD, silver); mean R
negative everywhere. No configuration is positive in both periods on 3 of the 4 markets. Best gold cell: H4-H1-M15, swing 6,
weekly agrees + M15 flip, limit, 3R: +0.306R (82) / +0.316R (97), t 1.6 / 1.9 — about the same as the live wick-based rule
(+0.370 / +0.270). Verdict: closing-price structure neither adds nor removes the gold result; no change to the live rule.

## 5 Nov (loop 2, cont.): NQ SD trackers live (paper) and crypto trend v2

- NQ opening-4H SD trackers in the trader as research (PR #208): `sd2ifvg` (2 SD + 1-minute IFVG fade, target 1 SD back)
  and `sd3mom` (3 SD with the move, stop 0.25 range, target 4 SD). Signal replay Sep-Nov 2026: 15 / 10 vs 16 / 9 backtest.
- Crypto trend walk-forward (Binance daily, 10 coins, pick 2018-21 / check 2022-26, 0.8%): trail 3.5/4/5/6 ATR on 2018-21
  +0.54 / +1.03 / +1.90 / +1.59R → 5 ATR, 2022-26 +0.40R (live 4 ATR +0.30R); exit channel 10/20/27/40/55 days: no real
  difference; BTC-above-100/200-day filter: 2018-21 slightly worse, not used; 55 + 100-day slots (5 ATR) 2022-26 +96.5R / 186
  (+0.52R), N100 alone +0.73R / 68. Council coins two-slot +52.3R / 70 (+0.75R), dd −7.9R. Adopted (PR #209); replay records
  for the council coins rebuilt (2023 - Oct 2026).

## 5 Nov (loop 3): gold replica settings, walk-forward

Full replay of the replica on spot gold 2019-26 (lab/replica_full.mjs XAU, 18,913 raw signals; costs 0.30), grid around the live
rules (filter, stop size 0.5/1/1.5 ATR, H4 against/any, direction D1-or-EG / D1 / any, volatility gate 1.0-2.0%, session, 7 exits):
4,858 configs; pick on 2019-22, judge on 2023-26. Live config (v5, D1 or EG, gate 1.5%, trail 2/2): 2019-22 +0.093R (214),
2023-26 +0.164R (443, +72.8R). Train→test rank correlation 0.09; the 15 best on 2019-22 averaged +0.145R on 2023-26 (below live).
Single changes from live: skipping 21:00-24:00 UTC entries +0.102 / +0.194R (only consistent gain, ~+0.01-0.03R, noise-sized);
3R fixed ≈ trail; gate 1.75% / 2.0% worse on 2019-22. Verdict: no change; the live gold rules are about as good as anything
that can be picked honestly from this grid.

## 2026-11-05 — Mosha rulebook re-read (97 photos + Private Room PDF) and a faithful test

Rebuilt a mechanical rulebook from every upload (BO → VR → CF, BO-BO-BO one-TF step-down table, 50% external range, QM confirmation, Janda, BOOM / "no trade zone" at the broken level, layered limits, 80/20 partials, father/mother/son direction). Tested on 1m data 2019–2026 (gold, Nasdaq, EUR/USD, silver), picked on 2019–22, judged on 2023–26, all costs in.

- Chains (his table): D1-H4-H1, H4-H1-M30, H1-M30-M15, M30-M15-M5. Entries: broken level, 25% / 50% into the CF origin, and layered (half at the level, half at 50% of the origin). Exits: 3R, opposite external extreme, 2R trail, 80% at 3R + 20% trailed runner. Filters: CF is a structure flip, retracement ≥ 50%, weekly agrees, D1 agrees, VR is also a flip (QM), Janda (BO after BO Structure), first BO back.
- **No robust edge.** Gold M30-M15-M5 faithful (flip + 50% + weekly) at the broken level: +0.18R / +0.01R (n86 / 70). Origin entries are not consistently better than the level. Silver negative almost everywhere; EUR/USD negative in 2019–22.
- **Filters don't separate.** On gold M30-M15-M5 the controls do as well as the rules: D1 against +0.24R vs D1 with +0.26R; weekly against +0.18R; retracement under 50% +0.28R.
- **Layered entries:** looked like +0.3R at first, but that counted a half fill as a full one. With correct sizing (each half risks 0.5R; an unfilled half earns 0) the gain is gone: gold M30-M15-M5 faithful +0.20 / −0.04R.
- Only weak lead: Nasdaq D1-H4-H1 flip, layered, +0.19 / +0.20R 3R (n49 / 40), +0.26 / +0.25R trail. Small n, one of ~120 cells; not adopted, noted for the NQ tracker list.
- 80/20 partials ≈ the average of 3R and trail; they change nothing on their own.
- **Decision:** the live Mosha BO paper system stays as it is (H4→H1→M15, weekly, level limit, 3R) as a forward test; every chain, including blocked ones, is already recorded with `blockedBy` since PR #210.

## 2026-11-05 — NQ open run: walk-forward filters, S&P cross-check

Script `idx/run_feat.py` (NSX 1m 2018 – Oct 2026, 15-pt equivalent, costs in). Live rule (midnight open ahead): n710, +0.119R, t 2.3. **By period: 2018–22 +0.02R (n435), 2023–26 +0.28R (n275, t 3.3).** The edge is a recent one; expect it to be weaker if the regime turns.
- Filters chosen on 2018–22 terciles, judged on 2023–26 (base +0.28R): gap direction, prior-day direction, entry vs the opening 4H candle (18–22 ET), position in the overnight range, overnight range size, run size, stop size, weekday. **None beats the base out of sample.** The two best in 2018–22 (entry far below the 4H candle +0.25R; mid-size stop +0.20R) did +0.27R and +0.24R later, i.e. no gain. Mondays −0.05R in 2023–26 (n55) but +0.08R before: noise.
- **S&P 500 (SPX 1m, same rule):** live rule n506, −0.00R; 2022 −34R. On days only SPX triggers: +0.06R. The setup is not a general index effect; it is NQ-specific.
- Decision: no change to the NQ rule.
- Crypto trend fees (loop item 9): `lab/crypto_trend.py` already charges 0.3% and 0.8% round trip (Kraken Pro taker is 0.4% a side = 0.8%); v2 was chosen under the 0.8% case. Done.
- **Same run-and-reverse rule at other NQ opens** (`idx/run_open.py`, 90-min window and exit): London 03:00 ET n587 +0.07R (2018–22 +0.02R, 2023–26 +0.19R, n187), midnight-open filter doesn't help there; 08:00, 08:30, 10:00, 20:00 ET all ≤ 0 in 2023–26. London is a lead with the same "recent only" shape as New York; not adopted (t 1.4).

## 2026-11-05 — Owner's video: Chart Fanatics "Worlds BEST NQ Scalper Reveals His A+ Trading Strategy" (youtu.be/HNuRp9Z1bMs)

YouTube is blocked from this environment, so no transcript; the guest is unconfirmed. Tested the auction-market-theory toolkit publicly attributed to that channel's NQ scalper (Fabio Valentini): opening range, value area, 80% rule. Order-flow parts (footprint, delta, absorption) need tick volume we don't have. Value area = 70% of prior-day RTH time-at-price (TPO, 2-pt bins), NSX 1m 2018 – Oct 2026, costs in. Scripts `idx/amt.py`, `idx/amt80.py`.
- 30-min opening range breakout (stop mid-range, 2R, out 12:00): +0.02R / −0.01R (n1178 / 810). Nothing.
- Fade the first touch of VAH/VAL when the open is inside value (stop 0.25 VA, target POC): −0.01R / −0.12R. Nothing.
- **80% rule** (open outside yesterday's value area; 30 consecutive 1m closes back inside before 12:00 ET; target the far VA edge; stop just past the open-side extreme; out 16:00): **+0.10R / +0.12R (n120 / 89), t 2.2 over 2018–26, 76% win**, ~25 trades a year. Neighbours agree: 15-min acceptance +0.07 / +0.06R; VA-edge stop +0.12 / +0.15R. S&P 500 same rule: +0.01 / +0.08R (weaker, not negative).
- Verdict: the first candidate in a while that is positive in both halves with the textbook setting (one 30-min period). Next: add as an NQ research tracker (session '80pct'), not live.

## 2026-11-05 — Chart Fanatics strategy library (owner's link)

Deep research (report: reports/Chart Fanatics strategy library.md in the working copy; site itself unreachable, rules from search excerpts). ~48 strategies; ~20 price-only testable. First tests (1m cash index CFDs 2018 – Oct 2026, costs in):
- **Noise-area intraday momentum** (Zarattini/Aziz/Barbon benchmark; boundary = open × (1 ± 14-day mean move at that time), checks every 30 min from 10:00, out at close, no VWAP): Nasdaq 2018–22 +14.3%/yr Sharpe 1.58, 2023–26 +4.8%/yr Sharpe 0.61; S&P 2018–22 Sharpe 1.23, 2023–26 −0.42. Decaying; S&P fails recently. Candidate only for NQ, not adopted.
- **Forrest Knight 1H failed break** (hourly RTH candle through PDH/PDL/ONH/ONL, close back inside, stop past wick, target opposite overnight extreme): all −0.02R (2023–26, n749) on Nasdaq, −0.07R on S&P. No edge.
- Queue: JJ Simon fair price (09:30 / 14:00 displacement + structure), Kane Lab model (10:00 4H sweep + NQ/SPX SMT + iFVG), TG Capital London Trident on gold/FX.
- **JJ Simon fair price** (`idx/jj.py`, proxy: 1m displacement ≥2× avg range, counter-wick ≤20%, close through last 2-2 swing; fair price = 09:30 open / 14:00 price): toward fair price −0.28R (Nasdaq 2023–26, n164); away from the open +0.11R in 2023–26 but −0.01R in 2018–22; 14:00 window negative on both indices. No robust edge.
- **Trader Kane Lab model** (`idx/kane.py`, proxy: sweep of the 06–10 ET (or 02–06) 4H high/low between 10:00–13:00, SMT = S&P did not sweep its own, 1m iFVG entry, stop past sweep, 2R or 4H-mid target): best cell +0.10R in 2018–22 but −0.08R in 2023–26; with SMT −0.11 to +0.01R in 2023–26. SMT adds nothing. No edge.
- **Vincent break & retest** (`idx/vbr.py`, proxy: 5m close ≥0.1 ATR beyond PDH/PDL or premarket H/L between 09:35–11:30, retest within 12 bars, 1m confirm, stop 0.25 ATR past the level, 2R): Nasdaq +0.00R / +0.02R (n777 / 489); S&P −0.08R / −0.02R. No edge. Continuation at the same levels fails as the fade did.
- Second survey report: reports/Chart Fanatics library expanded rules.md (working copy). Remaining queue: TG Capital London Trident and NBB PO3 fib on gold/FX, Crooks ChoCh + EMA21 pocket.

## 2026-11-05 — CORRECTION: 80% rule; TG Trident; 80% rule tweaks

- **Correction.** `idx/amt.py` / `idx/amt80.py` dropped trades still open at 16:00 (sim returned None at the session end). Re-run with time-outs closed at 16:00 (`idx/amt80b.py`): base 80% rule +0.04R (2018–22, n153) / +0.05R (2023–26, n106), t ≈ 1 — weak, not +0.10 / +0.12R. The live tracker was always right (closes at 16:00). PR #212 fixes the notes. ORB and VA-fade results were affected the same way; both were already ≤ 0. The NQ open run (`idx/run.py`) was checked: 0 trades dropped; +0.119R (n710) stands.
- 80% rule tweaks (walk-forward, all post-hoc, none adopted): deadline 11:00 +0.07 / +0.06R; sells only +0.10 / +0.10R (n74 / 52); open beyond yesterday's range +0.08 / +0.09R; 60% value area and POC targets negative.
- **TG Capital London Trident** (`lab/trident.py`, 30m, EMA 5/9/13/21 + 200, FVG → doji at 50% → confirm, 03:00–06:30 NY; FX 10-pip stop, gold close stop): gold −0.34 / −0.00R at 20R, +0.16 / −0.00R at 3R (n85 / 46); EUR/USD −0.19 / −0.06R; GBP/USD −0.05 / −0.06R; USD/JPY +0.06 / −0.08R. The 20R target is almost never hit. No edge.
- **NQ open run, calendar effects** (live rule, NDO ahead; 2018–22 | 2023–26): month-end (day ≥ 26) +0.09R (n81) | +0.35R (n49); first 3 days +0.14 | +0.07R; mid-month −0.02 | +0.28R; OPEX Friday −0.16 | +0.21R (n18 / 11); quarter-end months +0.09 | +0.41R. Month-end a touch better in both halves but samples are small; no filter adopted.
