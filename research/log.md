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
