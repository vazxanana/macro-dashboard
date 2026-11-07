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

## 2026-11-05 — Live-edge improvement research (report: reports/Improving the live council edges.md in the working copy)
- NQ open run long/short: 2018–22 longs −0.02R (n211), shorts +0.06R (n224); 2023–26 longs +0.37R (n118), shorts +0.21R (n157); 2022 shorts +0.40R. Not just AI-rally long beta.
- **Threshold drift (PR #213):** the backtest used 0.08% of the open (≈20 pts now); live used a fixed 15 pts ≈ 0.06%. Live rule by threshold: 0.04% +0.059R; 0.06% +0.106R; 0.08% +0.119R; 0.10% +0.135R (2018–22 +0.047R); 0.14% +0.093R. Live now uses 0.08% / 0.011% of the open.
- Queue from the report: VIX/GVZ regime buckets (free daily closes), wide trailing exit for NQ, adaptive gold gate (percentile / GVZ), crypto lookback ensemble + vol sizing, CUSUM kill rule replacing the 30/50-trade checks.

## 2026-11-05 — Owner: "apply everything"; gold stop/target grid
- **Gold replica stop/target grid** (`lab/replica_grid.mjs`, live config, 2019–22 / 2023–26): MAE median 1.02 stop units; 45% of trades that reached +2R first went > 0.5 stop. Stop ×1 trail +0.09 / +0.16R; ×0.85 +0.00 / +0.16; ×0.7 +0.01 / +0.07; ×0.6 +0.03 / −0.02; ×0.5 −0.14 / −0.05. Fixed targets at ×1: 2R +0.06/+0.08, 2.5R +0.06/+0.11, 3R +0.07/+0.16, 3.5R +0.03/+0.15, 4R +0.08/+0.19. **Kept: current stop and trail.**
- **Gold adaptive gate (PR #215):** 1.5% OR top fifth of own year: +0.104R (341) / +0.192R (513) vs 1.5%: +0.093R (214) / +0.164R (443). Applied.
- **Crypto v3 exit (PR #214):** channel-midpoint ratchet exit: Sharpe 1.67 / 0.81 vs 1.50 / 0.58, max DD −28% / −21% vs −39% / −27%. 20–360 ensemble and vol-target sizing not better in 2022–26. BTC 200-day gate: tiny. Applied.
- **NQ wide exit** (half at 2R, rest trailed 1R or behind the time-weighted mean to 16:00): −0.04R / +0.27R vs +0.02R / +0.28R. Not applied.
- **Monitoring:** the scheduled check now uses CUSUM (k = half the edge, review at 12, pause proposal at 20) plus catastrophe checks, instead of the 30/50-trade cumulative-R rules.
- **NQ open run by volatility regime** (14-day avg RTH range %, terciles from 2018–22: 1.26 / 1.98%): low +0.01R (n144) | +0.30R (n130); mid +0.07R (144) | +0.25R (115); high −0.01R (145) | +0.33R (30). No volatility effect in either half; no filter. (VIX history not reachable from this environment; realised vol used instead.)
- **Mosha BO counter-weekly trades (owner: buys when H1/M15 bullish, "trading the retracement")**, spot gold H4→H1→M15, limit at broken level, 3R (2019–22 | 2023–26): weekly agrees (live) +0.37R (n87) | +0.27R (n101); weekly against all −0.25R (114) | −0.10R (92); against + daily agrees −0.01R (61) | −0.02R (9); against + daily against −0.52R | −0.11R; against, buys only −0.17R (47) | −0.06R (16); against, buys + daily agrees +0.38R (22) | none; against + M15 structure flip −0.08R (57) | +0.16R (57). In this chain H1 is the counter-move by definition, so "H1 bullish" at entry is never true; D1 agreement and the M15 flip are the closest tests. No counter-weekly variant is positive in both halves → not enabled live; such chains already record as shadow trades (blockedBy 'weekly') for a forward read.
- Header (PR #217): open trades count + floating R + account % (0.25% NQ/gold, 0.5% crypto per R) in the top-right corner.

## 2026-11-05 — Gold: judge on 2023–today only (owner: the edge changed)
From now on gold decisions use 2023 – Oct 2026 only, split 2023–24 | 2025–26 (signals, trail exit, before the max-3-open / daily-stop rules):
- Gate: none +0.09 | +0.01R; 1.25% +0.36 | +0.09R (+112R total, weaker recently); 1.5% +0.18 (n41) | +0.16R; **1.5% or top fifth (live) +0.31 (109) | +0.16R (404), +98R**; top fifth only +0.31 | +0.22R (+78R).
- Direction: D1 with OR at EG (live) +0.31 | +0.16R; D1 with only +0.49 | +0.15R; any +0.01 | +0.15R; D1 against −0.31 | +0.15R. H4 against (live) +0.31 | +0.16R vs H4 with +0.10 | +0.07R.
- Exit at the current stop: 2R +0.06 | +0.09R; 3R +0.12 | +0.16R; **4R +0.23 | +0.20R (+105R)**; trail (live) +0.31 | +0.16R (+98R). Tighter stops (0.85×, 0.7×) worse or equal in every column.
- Verdict: live gate, direction and H4 rules all hold on 2023+. 4R fixed is the only close alternative (better in 2025–26, worse in 2023–24, total +7R over ~510 trades: inside noise). Kept the trail.
- **Gold 4R adopted (PR #219, owner: weight the last 2–3 years).** Replay with live rules: 2024 +25.6R (trail +37.4R), 2025 +54.8R (+31.4R), 2026 +29.9R (+32.8R); 2023–26 +102.7R / 439 vs +95.2R / 456; worst drawdown −24.7R vs −15.8R. Calendar history rebuilt on 4R.
- **Gold EG exception off (PR #221).** With 4R, D1-against-at-EG trades: 2023 −5.6R (5), 2024 −4.6R (21), 2025 −2.8R (19), 2026 −2.1R (37); D1-with +0.42R (83) / +0.25R (348). History rebuilt: 359 trades +111.2R (2024 +36.2, 2025 +49.6, 2026 +27.6), worst drawdown −25.1R.
- Gold 2023+ by session (4R, live config): Asia 00–07 UTC +0.48 / +0.37R; London 07–12 +0.27 / +0.14R; NY 12–17 −0.02 / +0.15R; late 17–24 +0.13 / +0.06R. Buys +0.58 / +0.23R, sells −0.13 / +0.01R (bull-market artefact; D1-with handles it). Weekday: Tue −0.83R in 2023–24 (n18) but +0.18R in 2025–26: noise. Session filter not adopted yet; waiting for the regime research.

## 2026-11-05 — Gold: more profit, less drawdown (owner), judged on 2023+
Levers with the live risk rules (daily trend only, 4R): current gate +111.1R, worst DD −25.1R (ratio 4.4). Exits: 3R +84.6 / −18.8; 5R +104 / −26.5; half at 2R then 4R +66 / −18.6; BE@2R +101.5 / −21.0 (4.8); BE@1R +82.5 / −20. Risk: no daily stop +90 / −26.8; max open 1 +57 / −13.4; 2 +86 / −23; 4 +124 / −28.7; no equity filter +110 / −31.3; half after 2 losses +62 / −17. Sessions: skip NY 12–17 +95 / −24.7; Asia only +47 / −13.1. Worst DD: 29 Mar – 7 Oct 2026 (Apr 2026 −15R).
**Key split:** trades at ≥1.5% but below the top fifth +0.02R (n168, all 2025–26); top-fifth trades +0.40R / +0.39R. Top fifth only +88.3 / −14.8 (6.0); **+ BE@2R +93.0 / −11.7 (7.9), better in both halves (23–24 +37.9 vs +34.0; 25–26 +55.0 vs +54.4)**; + max open 4 +107 / −16.3 (fragile, 5 trades); vol-rising filters cut profit more than DD. **Adopted (PR gold-top-be):** gate = top fifth only, stop to breakeven at +2R. History rebuilt: 226 trades +93.7R (2024 +40.6, 2025 +19.0, 2026 +36.4), DD −11.7R, 20 breakeven exits.
- **Gold session sizing on the new rules (top fifth, 4R BE@2R; 2023–24 | 2025–26):** per signal Asia +0.93 | +0.42R, London +0.63 | +0.37, NY 12–17 −0.28 | +0.35, late +0.65 | +0.36: the session edge vanishes in 2025–26. With risk rules: Asia 1.0 / else 0.5 +64.2R / DD −7.5 (ratio 8.6 vs 7.9 base) but 2025–26 +33.6 vs +55.0; skip NY +97.2 / −12.7; Asia only +41.7 / −5.5; riskAtr ≥ 2.5 at half size +87.3 / −10.8 (mixed by half: those trades +0.59R in 2023–24, −0.04R in 2025–26); max open 4 +97.9 / −13.8. **Nothing beats the base on both profit and drawdown in both halves; no change.**
- **Gold stop placement (top fifth, 4R BE@2R, live rules):** stopped trades 155, sweep-type (back to +2R within 4 h) 17 = 11% (2023–24 8/46, 2025–26 9/109). ATR buffer past the extreme: +0.25 ATR +80.6R / DD −13.2; +0.5 +58.8 / −12.8; +1.0 +36.3 / −14.9 (base +93.0 / −11.7). Stop-size cap: reject riskAtr > 1.5 +32.9 / −7.2; > 2 +81.6 / −11.6; > 2.5 +95.4 / −11.8 (2023–24 +33.5 vs +37.9, 2025–26 +61.9 vs +55.0: not both halves). **No change.**

## 2026-11-05 — Gold: scale in and run winners (owner), top-fifth gate, D1 only, BE@2R, live risk rules, 2023–26
- MFE: 23% of signals reach +4R; after +4R the median peak before a 2R pullback is 6.7R (2023–24, n20) / 5.4R (2025–26, n41); 6R reached 60% / 29%, 8R 20% / 15%, 10R 10% / 7%.
- Exits/adds (total / 23–24 / 25–26 / DD / ratio): base 4R +93.0 / +37.9 / +55.0 / −11.7 / 7.9. Add 0.5 @2R +118.4 / −15.9 / 7.5; **add 1.0 @2R +157.6 / +63.1 / +94.5 / −17.4 / 9.1**; add 1.5 @2R +188.4 / −20.3 / 9.3; add 1.0 @1.5R +159.8 / −19.2 / 8.3; add 1.0 @2.5R +131.2 / 8.3; add + 5R target +125 / 6.9. Runner after 4R trailing 1R +103.8 / +43.3 / +60.5 / −12.4 / 8.4; trailing 2R +96.8 / 7.2; 6R target +89.6 (2025–26 +30). **Add 1.0 @2R + runner 1R after 4R: +185.9 / +73.9 / +112.0 / −17.6 / 10.6**, every year better than base (2024 +76 vs +40, 2025 +52 vs +19, 2026 +60 vs +36).
- Adopted (PR gold-add): add at +2R (stop at the first entry, counted as 2R risk), after +4R trail 1R (cap 10R). History rebuilt: 212 records (combined R per signal) +185.9R, DD −17.6R.
- Re-entry after an exit: no published study measures it; the replica already re-enters on each new M5 CHoCH signal in a trend (max 3 open), so a separate re-entry rule is not added.
- **NQ open run: adds and runners** (`idx/run_add.py`, live rule, 2018–22 | 2023–26, total / per / DD): base +7.4 / +0.017 / −23.4 | +76.9 / +0.280 / −7.7. Add 1.0 @+1R −17.0 / −52.5 | +103.4 / −9.1; add 0.5 −10.7 / −40.7 | +91.5; BE@1R −4.3 | +79.7; 3R BE@1R −2.2 | +95.4; **runner: after +2R trail 1R to 11:00 +21.1 / +0.048 / −19.3 | +93.7 / +0.341 / −7.9** (both halves better, DD not worse); trail 0.5R +15.9 | +87.7; add + runner +7.8 / −47.1 | +143.3. Adds rejected on NQ (2018–22 drawdown); runner adopted.
- Gold add/runner live logic unit-tested (t_add2.mjs): running path parent +5R, add +3R; reversal path parent BE, add −2R — matches the backtest accounting.
- **NQ runner adopted (PR nq-runner):** history rebuilt 299 trades +99.1R (was +85.1R): 2023 +29.5, 2024 +21.6, 2025 +6.8, 2026 +41.7; exits: 85 trailing stops, 65 at 11:00, 149 stopped.
- **Gold adopted rules, bootstrap (212 combined records):** mean +0.88R, SD 3.3R; observed worst DD −17.6R; trade-order bootstrap DD median −15.5R, 95th −24.3R, 99th −29.9R; year-block bootstrap 95th −22.7R. Without the top 5 winners (9.2–14.6R) the total is still +132.8R (+0.64R a signal). Sizing should assume a −25R to −30R drawdown, not −17.6R: at 0.5% per signal that is 12–15% of the account.
- **Gold re-entry after a trailing-stop exit** (`ms/gold_reentry.py`: break of the position's best price within 60 min, stop at the trail-exit level, one per signal): 17 triggers 2023–26, 1 winner; 4R BE@2R −0.76R (n6) | −0.58R (n11); 2R −0.10 | −0.76; 3R BE@1R −0.26 | −0.49. **Rejected**: after the 1R trail is hit the move is over far more often than it resumes.
- **Mosha BO 2023+ levers** (`lab/bo_lever.mjs`, H4-H1-M15, limit at level, weekly agrees, 101 fills; 2023–24 n36 | 2025–26 n65 | DD): 3R live +6.3 | +21.0 | −18.4; 2R +7.1 | +13.9; 4R +5.4 | +32.6; 3R BE@1 +3.5 | +22.7 | −13.4; 4R BE@2 +3.8 | +25.6; add 1 @1.5R BE1.5 3R +7.3 | +31.6 | −20.3; same 4R +4.3 | +44.9 | −23.4; 3R then run 1R +6.2 | +22.2; **add 1 @1.5R BE1.5, run 1R after 3R +8.8 | +35.3 | −20.3 (adopted, PR mosha-add)**. Caveat: 36 fills in the early half; the base system failed OOS on other markets.
- **Gold release-window veto** (`ms/gold_news.py`, top-fifth signals, 4R BE@2R): inside 08:25–08:45 ET 5 signals, all losers (−2.1R | −3.1R); inside Wed 13:55–14:15 ET (FOMC proxy) 3 signals +2.0R; outside both +0.51 | +0.39R. With risk rules: veto the 08:30 window +95.7R / −11.7 (23–24 +40.0, 25–26 +55.6) vs base +93.0 / −11.7. **Adopted for the 08:30 window only (PR gold-news-veto)**; n is tiny, the veto costs almost nothing and matches the news-spike evidence.
- **Crypto per-coin review (v3 exit, 2023–Oct 2026 replay):** BTC 55 +7.3R (n11), 100 +7.5R (5); ETH 55 +5.7R (11), 100 +2.6R (6); SOL 55 +8.4R (12), 100 +10.8R (6); XRP 55 +10.9R (9), 100 +8.4R (5). Every coin and both slots positive; worst per-slot DD −3.1R. By year: 2023 +33R, 2024 +29R, 2025 −0.6R, 2026 +0.1R — nothing since 2025 (no breakouts held). No coin or slot to drop; no change.
- **Gold add size and gate speed** (`ms/gold_scale3.py`, add + run 1R, live rules): add 1.0 +185.9R / DD −17.6 (boot 95th −24.6, 99th −30.5); 1.25 +204.3 / −19.0 (−26.5 / −33.2); 1.5 +222.7 / −20.4 (−28.8 / −35.3): near-linear, ratio 10.6 → 10.9, a risk-budget choice, not an edge; kept 1.0. Gate: 10-day top fifth +153.3 (2023–24 +33.2 vs +73.9); 10 OR 20 +176.0; 10 AND 20 +169.3 / −16.2; the 20-day gate stays.
- **Silver out-of-sample of the gold rules** (`lab/replica_live.mjs XAG 2023-01-01`: live replica signals on HistData XAGUSD 1m, H4 against + D1 with, 48 h cap, costs 0.025; 2023–24 | 2025–26 avg R per signal / DD): all signals (n1399 | 626) 4R −0.51 | +0.22; live set (4R, BE@2R, add 1.0@2R, run 1R after 4R) −0.58 | +0.30. **Top-fifth gate** (n185 | 229): 4R −0.23 | +0.38; 4R BE@2 −0.26 | +0.36; live −0.14 | +0.69 (DD −50.7 | −40.0); below the gate live −0.65 | +0.08. Gate + H1 clear (n59 | 36): live +0.13 | +1.83 (DD −25 | −12). The gold structure transfers: the gate separates ~0.5R per trade in both halves and the live exit set beats fixed 4R on the gated signals in both halves; silver's own replica edge is negative through 2023–24 (regime), so **no silver market is added**; the result supports the gate + add/run choice as not gold-curve-fitted. NQ add with BE@1R was already covered (add moves the stop to entry at +1R: −17.0R 2018–22); no rerun.
- **Half-size entry then scale in (owner question)** (`ms/gold_scale4.py`, gold 2023–26 top-fifth gate, live risk rules, R on the full original risk; total / 23–24 / 25–26 / maxDD / bootstrap 95th DD / total scaled to the live −24.6 DD budget): live 1.0 + add 1.0@2R +185.9 / +73.9 / +112.0 / −17.6 / −24.6 / +186.0. Start 0.5: + 0.5@2R +94.5 / −9.8 / −13.8 / +168.4; + 1.0@2R +134.7 / +49.6 / +85.1 / −12.2 / −17.5 / +189.6; + 1.5@2R +173.2 / +64.4 / +108.9 / −16.2 / −22.1 / +192.4; + 0.5@1R + 1.0@2R +167.5 / −17.2 / −24.1 / +170.7; same with BE at the 1R add +139.0 / +153.5; + 0.5@0.5R + 1.0@2R +174.6 / +170.9; 0.75 + 0.25@1R + 1.0@2R +179.0 / +182.5; 0.5 + 1.0@1R(BE) + 1.0@2R +150.8 / −21.6 / +127.1; no add at all +103.8 / −12.4 / +123.0. At equal drawdown budget every "start small, add at 2R" variant lands within ±4% of live (+186 → +168…+192): pyramiding at 2R is risk re-distribution, not an edge. Adds at +1R (with or without BE) are worse in both halves. **No change**; the 0.5 + 1.5@2R variant is the owner's option if a −0.5R loss on failed entries is preferred (−7% profit, −8% DD, same ratio).

## 2026-11-05 — Mosha rulebook, third pass: the rules never coded (impulse strength, sideways arrival, BOOM zone)

`lab/mosha_v3.mjs` on HistData 1m (gold, silver, Nasdaq, EUR/USD 2019–26), BO chain T1 → T2 against (VR) → T3 back (CF), limit at the broken T3 level, stop past the T3 origin, 3R, 24 h; periods 2019–22 | 2023–24 | 2025–26, avg R per trade.
- **"Break 2 or more levels in one movement" (RSS/SRR as a filter on the T1 breakout leg):** nearly every engine BO leg already crosses ≥2 prior T1 pivots, so the filter removes 0–10% of setups. On the live chain H4-H1-M15 the few weak legs lose (n14, −9R in 2023–26) but the sample is too small to matter. Not added.
- **Sideways arrival (pullback from the VR extreme to the CF measured in T2 bars; Mosha: "if price come into our zone with momentum… risky"):** gold, H4-H1-M15 + weekly, slow (≥22 H1 bars) +0.44 | +0.79 | +0.65R (n47/13/26) vs fast +0.29 | −0.17 | +0.11R; the same sign on H4-H1-M30 and D1-H4-H1 in 2023–26 and across thresholds 12–40. **But out of sample it reverses:** silver H4-H1-M15 slow −0.51 | −0.31 | −0.20 vs fast −0.25 | +0.15 | +0.50; Nasdaq mixed (slow better 2019–22, worse 2025–26). A gold-only pattern on a system that is itself gold-only and probably luck → not a rule; recorded on the live Mosha records as a forward-test field (`pull`, H1 bars from the VR extreme to the CF) so it can be judged on new trades.
- **BOOM / Sharp Entry** (after the T1 BO, two T2 pivot dips (N=3) beyond the broken level inside the leg; zone between them; limit at the near dip, stop past the far dip, 3R or 2R or trail): loses on every chain and period on gold: H4-H1 −0.31 | −0.01 | −0.59R (n92/64/30), H1-M30 −0.54 | −0.02 | −0.28 (n147/89/81), M30-M15 −0.39 | −0.18 | +0.02 (n340/142/173); D1-H4 8 trades. **Dead as coded.**
Rules now covered from the rulebook: BO/VR/CF chains (all table rows), 50% external range, QM/flip, Janda, layered limits, origin/BOOM entries, barrier style, EG SOP, RSS/SRR, father/mother direction, partials 80/20, opposite-extreme targets, closing-price structure, sideways arrival, impulse strength. What is left is the discretionary layer, which only his own call record could test.
- **Second pass over the photos (BOOM geometry, Telegram calls):** the BOOM lines sit on candle **body** lows of two dip clusters (2568.54 / 2571.72), spike wicks ignored; his real buys were at the broken H4 level (≈2576), above the zone, "entry after confirmation"; no stop is drawn anywhere. His Sep–Oct H4 sells (0.1 each at ≈4089 / 4118 / 4144 / 4166) were one idea scaled in while the pullback rose (averaging up against the pullback), 80% closed near the external Low (≈4040), 20% runner, then half of it on the expected pullback phase. Retest with body-low dips (`lab/mosha_v3b.mjs`): zone entry H4-H1 +0.17 | −0.64 | −0.36R (n80/52/28; weekly +0.55 then −0.91/−0.35), H1-M30 −0.29 | −0.34 | −0.45, M30-M15 −0.41 | −0.37 | −0.25; entry at the level with the stop under the BOOM zone −0.36 | −0.44 | −0.50 (H4-H1) and worse on the lower chains. **BOOM stays dead in both geometries.** Nothing else in the second pass changes a tested rule (the "repeat SOP" nesting is the chain table; layered/averaged limits were tested with correct sizing; the external-Low target ≈ 3R).

## 2026-11-05 — Crypto trend: money on the table, and scaling (owner request)

`lab/crypto_scale.py` / `crypto_scale2.py`, Binance daily 2018–26, 0.8% costs, R on the first unit's 5 ATR risk, periods 2018–22 | 2023–24 | 2025–26.
- **How much we keep (live midpoint exit, council coins):** mean best excursion +5.4R → realised +2.4R (45% kept) in 2018–22; +3.5R → +1.6R (45%) in 2023–24; +1.2R → 0.0R in 2025–26. Winners: MFE +6.4R → +3.6R realised. 54% of trades reach +1R, 38% reach +2R; the average giveback from the peak is 3–5R on those. **Every other exit keeps less:** 20-day low +131.9 | +45.6 | −4.9R vs live +143.1 | +62.1 | −0.5R; 10-day low +110 | +57 | −5.5; max(mid, 20-day low) +145 | +52 | −4; 3 ATR trail +72 | +50 | −4; 4 ATR trail +80 | +52 | −5; half off at +1R or +2R roughly halves the result. The midpoint exit stays.
- **Scaling (adds on a daily close, own 5 ATR stop, out with the first trade):** one add at +1R: council +256 | +109 | −5.3R, DD −9.4 | −5.5 | −6.7 (live −7.3 | −5.5 | −4.8); 2023–26 combined +103.6R / maxDD −6.7 / ratio 15.5 vs +61.6 / −5.5 / 11.3; bootstrap 95th DD −8.3 vs −5.7 (at equal bootstrap DD +70.8 vs +61.6). Six other coins 2023–26: +169.9 / −19.0 / 8.9 vs +106.2 / −16.9 / 6.3 (equal-DD +104.5 vs +106.2, i.e. neutral there). Add at +0.5R: DD doubles; +1.5R / +2R: less profit, same DD; two adds (+1R, +2R) and turtle pyramids (+1/+2/+3 ATR): profit up, drawdown up faster; add 0.5 at +1R: +82.6 / −5.5 (ratio 15.1). **Adopted: one add of 1.0 at +1R** (user rule `crypto-add`): more profit in every period that trends, the realised max drawdown ratio better on both coin sets, a small cost in the flat 2025–26 (−5.3R vs −0.5R on the council coins, +2.2 vs −0.6 on the others). Replay rebuilt with add records (`lab/crypto_replay_v4.py`): 65 trades + 31 adds, +103.6R (adds +42.0R, 16 of 31 adds lose).

## 2026-11-05 — Cost of mirroring the gold replica on MT5 a few minutes late (for the CouncilBridge EA)

`ms/gold_late.py` / `gold_late2.py`: live gold rules 2023–26 (top-fifth gate, D1, BE@2R, add 1.0@2R, run 1R after 4R, risk rules), entry at the 1-minute close k minutes after the signal, the council's stop/target/trail unchanged (what the EA does), R on the council's risk. Council itself +185.9R / DD −17.6 (212 signals).
- Skip band 0.3R both ways: 2 min +175.3R (26 skipped), 4 min +173.3R (33 skipped, DD −15.6), 6 min +173.7R (56 skipped). Entry drift itself costs only ~+0.01R a trade; the loss is the skipped signals.
- **Skip band 0.5R both ways: 2 min +188.6R (6 skipped), 4 min +190.0R (12 skipped, DD −15.6), 6 min +195.5R (22 skipped, DD −14.8)** — at or above the council in both halves (23–24 +77.3 / +81.8 / +86.9 vs +73.9; 25–26 +111.3 / +108.2 / +108.6 vs +112.0); the signals that run more than 0.5R in the first minutes are net losers. No band at all: +178R, DD −18.6.
- Asymmetric (take any adverse move, skip only when price ran ahead): no better than the symmetric 0.5R band.
**EA default changed to `InpMaxSlipR = 0.5`** (PR). The 4-minute bot cadence plus the 30 s poll costs nothing measurable on gold; the late-entry risk is on NQ only (10-min feed), which the EA does not mirror by default.

## 2026-11-05 — Execution layer (owner going live on MT5 Tradeify + cTrader IC Markets)

Engineering, not research: `mt5/CouncilBridge.mq5` (mirror of the council's trades from `mt5/signals.csv`, published by the bot each run; prop guards 1.5% day / 6% max / 2% open risk; compiled clean on the owner's terminal), `ctrader/CouncilBridge.cs` (same for cTrader), `mt5/NQOpenRun.mq5` (the NQ open run executed natively on NAS100 M1, port of `nqOpenSweep` + nyflip). Owner's symbols: XAUUSD, NAS100, BTCUSD, ETHUSD (no SOL/XRP). Challenge: $50k, target 5%, max DD 10%, daily 3%: replay 2025–26 at 0.25% risk per trade → +1.8%/month, worst DD −3.9%, worst day −1.3%, +5% after ~45 trades; 0.1% of shuffled sequences breach −8% before +5%. The NQ EA's unknown is the CFD spread at 09:30 ET; first fills to be compared with the council's nyflip research records.

## 2026-11-05 — Audit: every strategy tested so far, which ones make money (owner: "add the ones making money")

Re-read of this log. Live already: gold replica (gated, D1, 4R/BE/add/run), NQ New York open run (midnight filter, runner), crypto trend v3 (+add), Mosha BO (forward test, expectation ~0). Everything else:
- Old council desk strategies (Scalp, Retrace, Swing, Position, Intraday, EG zones): −0.16 to −0.22R a trade on the clean 2026 replay, never positive on long history → retired (PR retireLegacy). The "Scalp RR ≥ 2.5" and "Intraday near a key level" leads were t < 1 and died with them.
- NQ open sweeps (midnight / London / 08:30), London-low, swing sweep, Tokyo/Shanghai, NY reversal: negative or unstable on 3 years of futures → off. 80% rule +0.04R → tracker. Opening-4H candle fades (±50%, SD levels, IFVG): no level/stop/target holds on both Nasdaq histories → trackers `sd2ifvg`, `sd3mom` only.
- Pairs replica (EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF): −162R 2023–26; EUR/USD +53R in 2019–22 then −15R → research only. Forex daily trend 0/5 pairs. Crypto intraday replica negative.
- Chart Fanatics library (ORB, VA fades, JJ Simon, Kane Lab, Forrest Knight, Vincent, TG Trident, noise momentum): no edge. Mosha variants (barrier style, CF entries, Janda, EG SOP, BOOM, RSS/SRR, 50% rule, closing-price structure, sideways arrival): none beyond the one live chain.
- **New test for this audit: the NQ open-run rule on spot gold 1m** (`ms/gold_nyrun2.py`, 0.08% run, midnight filter, 2R then 1R runner, out 11:00 ET, 0.30 cost): 2019–20 +4.0R (n110), **2021–22 −31.4R (t −2.1)**, 2023–24 +6.5R (+0.06R, t 0.4), 2025–26 +23.4R (+0.19R, t 1.3); 2026 alone +28.2R of the total. 0.12%: same shape. A 2026 streak on an otherwise flat-to-negative record → not added (stays as the `gold-nyrun` research record).
**Nothing profitable is left out.** The only systems with a robust record are the four already live; the rest are trackers or research by design.

## 2026-11-05 — Owner's new PDFs (Arrow FX SOP, 411 Notes, Diera "Malaysian SNR"): Arrow FX tested first

**Arrow FX Capital SOP** (1 page): Daily reject / Daily EG mitigation → H4 breakout or H4 OB/EG at it → M30/M15 EG entry (or key level), BBMA/trendline as extra confluence. Coded (`lab/arrow_eg.mjs`, spot gold 1m 2019–26, costs 0.30): HTF engulfing zone (body ≥ 0.5 ATR, engulfed open to the pair extreme; D1 lives 60 days, H4 20, H1 10), first return into the zone ("mitigation"), then the first M15/M30 engulfing in the zone's direction with its pair extreme at the zone → market entry at its close, stop past that extreme, 2R / 3R / trail 2-2, 72 h. Avg R per trade 2019–22 | 2023–24 | 2025–26:
D1→M15 −0.62 | −0.29 | +0.10 (3R; n89/32/35), with an overlapping H4 zone −0.90 | −0.01 | +0.47 (n34/11/21); D1→M30 −0.09 | +0.17 | −0.23; H4→M15 −0.15 | −0.31 | +0.18 (n382/133/157; trail −0.19 | −0.19 | +0.39); H4→M30 −0.20 | −0.17 | +0.29; H1→M15 −0.22 | +0.08 | −0.01 (n999/397/420); H1→M30 −0.16 | +0.01 | +0.07. **Negative in 2019–22 on every chain, mixed in 2023–24, positive only in 2025–26** (the same 2025–26-only shape as the engulfing SOP tested on 4 Nov). Not an edge; nothing added. 411 Notes and Diera SNR rulebooks pending (readers running).
- **Diera "Malaysian SNR"** (35 pp of MT4 screenshots + 6 pp of handwritten Malay notes): levels = the origin of a leg that broke the prior opposite swing ("punca penurunan/kenaikan") on Mn/W1/D1, re-used indefinitely; after a "2nd movement" away, price returns and is bought/sold with the W1 trend; entry = pending order at the level (or an H1/M30 reversal close, then a lower-TF pattern); stop beyond the level; target the next HTF level; layered lots; no numbers for stop, R or sessions. Coded (`lab/diera_snr.mjs`, gold 1m 2019–26): origin box of each W1/D1/H4 BO event (N 3 and 6), first retest after the leg ran ≥ 1 box beyond the broken level, (a) limit at the near edge, (b) H1 reversal close in the box, (c) limit at the midpoint; stop past the far edge; 2R / 3R / leg target / trail; 30-day hold. **W1 and D1 fire 2–12 times in 8 years** (no judgement possible). H4 N3 limit: 2R −0.02 | +0.05 | +0.17R (n42/25/11); with W1 agreeing 3R −0.53 | +0.15 | +0.71 (n16/17/7); H1-confirmed −0.74 | +0.43 | +0.33; midpoint entries negative. Flat-to-negative in 2019–22, small and inconsistent after → not an edge as coded; no trade-count to build on.
- **411 Notes "SNR + TL / BPE / ISL-HSL / KISS"** (62 pp): breakout 2 times (a structure flip), then an engulfing candle, zone = the eaten candle's range (ISL), needs a historical level (HSL) and a trendline third touch (TL types 1-7 with angle ranges), entry on the pullback into the zone, stop beyond the zone, TP at the HTF extreme or 30–40 pips, half off + breakeven, 2–3 setups a day; no stop distance, R or session rules. Coded the mechanical core (`lab/bpe411.mjs`: flip event on the entry TF → first engulfing in the new direction within 12 bars → limit at the eaten candle's near edge or midpoint, stop past the far edge, 2R / 3R / HTF-leg target / trail, 72 h; H4 direction recorded): **negative on H1, M30 and M15 in every period and every variant** (−0.2 to −0.4R a trade, n 150–600 per cell); H4 N3 edge with the H4 trend +0.39 | +0.18 | −0.35 (n19/13/6) — too few and flips. The trendline third-touch and HSL parts are discretionary (no lookback or geometry given) and were not coded.
**Verdict on the three documents: no new edge.** Arrow FX and 411 Notes are engulfing-at-structure models that lose over 2019–24 on gold; Diera's HTF levels fire too rarely to trade or to judge.

## 2026-11-05 — Study of every executed trade (owner: "study all the trades executed")

Data: council-data trades.json (478 records since 1 Nov; older records trimmed), research.json (148), snapshots and the Actions logs of the 5 Nov runs.
- **Live system trades so far: 2** (gold replica, 4 Nov): sell 3,924 against D1 in Asia → −1R ("retracement never came"); buy 3,949.8 with D1 → +2R. Net +1R. No Mosha BO chain has completed since it went live (0 records, no errors), no crypto trend entry (every coin 15–39% under its 55-day high), no NQ open-run record.
- **Gold gate is doing its job forward:** 20-day range 1.35% vs the top-fifth level 2.42% → gate off since 5 Nov; the 110 replica signals recorded as research (untraded) since 1 Nov made −11R together (−0.10R a signal), i.e. the signals the gate kept us out of lost, as the replay said they would.
- **Bug found and fixed (PR #239):** the 14:56 UTC round logged `Cannot access 'nyFmt' before initialization`: the news veto (PR #229) read the New York formatter inside the market loop before its declaration, so every replica signal evaluation threw and that market's round aborted. Declaration moved to the top of the file. Gold had no gated signal due today, so nothing was lost, but it would have dropped the next one.
- **NQ 5 Nov:** the bot ran through the open (runs 14:06–15:34 UTC); NQ fell from 28,205 at 09:30 ET to 27,703 by 09:47 and 26,914 later without any 1-minute close back above the open, so the open-run rule produced no signal — correct, not a miss. CNBC feed lag measured at ~13 min (Yahoo throttled, 429).
- **Legacy strategies (retired, still tracked as shadow):** 25 open shadow trades; closed since 1 Nov: Scalp −26.1R over 185 (−0.14R), Retrace-scalp (`rscalp`) +18.9R over 113 (+0.17R), Intraday +4.1R over 31, others small. rscalp is the one legacy setup with a positive shadow record; it was never tested on long history → queued as a loop item (gold 1m 2019–26) before any reconsideration.
- Housekeeping noticed: each run commits the same snapshot two or three times (identical `at`), harmless; the saved NQ 1-minute candle files on council-data are a one-off research snapshot (last 3 Nov), not a bot feature.

## 2026-11-05 — Malaysian SnR direction SOP (L3 session 2) as a bias gate on the gold replica

Coded the SOP as a state machine (ms/msnr_dir.py): working TF H4 with A/V pivot levels (half-width n4 in 2/3/5); BO buy = close above the last A-level, BO sell = close below the last V-level; Daily key levels = pivot highs/lows (+-0.1 ATR), engulfing zones, DOM zones (two same-colour candles, the second closing beyond the first's extreme), alive 90 days; a breakout switches direction only if it is external (the broken level formed before the first tap of a Daily level on that side) and that level was tapped before the breakout candle; otherwise direction stays. Gold 2019-26: 280-470 switches, up 55% of the time.
Applied to the live gold replica (top-fifth gate, pass, H4 against, live exits and risk rules), 2023-26 (ms/msnr_eval*.py):
- As a gate instead of, or on top of, the D1 trend it is worse: MSNR-agrees instead of D1 +9.8R / +31.5R / -8.0R (n4 2/3/5) vs live +185.9R; MSNR-agrees + D1-with +44.9 / +59.1 / +13.7R; MSNR-agrees with D1 against -23 / -21 / -6R.
- The reverse cut is the interesting one, D1 with + MSNR against (a confirmed H4 pullback phase inside the daily trend): n4=5 +172.2R / maxDD -10.3 / ratio 16.7 / boot95 -17.8 (2023-24 +72.7, 2025-26 +99.5) vs live +185.9 / -17.6 / 10.6 / -24.6 (+73.9, +112.0); n4=3 +127.0 / -12.8; n4=2 +126.6 / -11.3. The complement (D1 with, MSNR agrees) is the drag: +12.7R over 72 trades (n4=5), +58R over 89 (n4=3). Daily pivot size 2 vs 3: identical.
- 2019-22 (replica about 0 there): n4=5 against -2.4R / DD -26.9 vs live -4.6 / -34.7 (same sign of improvement); n4=3 reverses (-23.9 vs +2.8). So the n4=5 version improves the ratio in every period, n4=3 does not; the pivot size was picked in sample.
Verdict: a real candidate, not yet a rule: profit -7% for drawdown -41% (risk-normalised +34%), consistent across daily-level settings and in sign for one pivot size, but one of three pivot sizes and tested on the same 212 trades. Recorded on live replica records as a forward-test field (feat.msnr: against / with / none, H4 pivots n=5) via PR. Options for the owner: keep as is; half size when MSNR agrees (2023-26 about +178R at a lower drawdown); or a hard filter (+172R / -10.3).

## 2026-11-05 — Scalps: the legacy "Retrace scalp" (M15 → M1) on 8 years of gold 1m

The only retired desk setup with a positive shadow record since 1 Nov (+18.9R over 113). Ported from `council/engine.mjs` buildRetrace into `lab/rscalp.mjs` (M15 BO → first M1 BO against = VR → every M1 BO in the retrace direction = signal; limit at the broken M1 level, stop past the M1 origin with the 0.15 ATR buffer and 0.6 ATR floor; targets the 50% line then the M15 Origin edge; off once the Origin is reached or broken; pending 3 h, out after 24 h; costs 0.30). Gold 2019–22 | 2023–24 | 2025–26, R per trade:
- all signals (n1151 / 619 / 645): target 1 −0.13 | −0.14 | −0.10; target 2 −0.14 | −0.09 | −0.06.
- **rr ≥ 3 (the live Coach rule), n138 / 93 / 120: −0.38 | +0.10 | −0.37** (target 2: −0.39 | +0.23 | −0.38). rr ≥ 2: −0.28 | +0.05 | −0.26. First M1 BO only: −0.30 | −0.06 | −0.18. D1 with: −0.55 | −0.19 | −0.33; D1 against −0.09 | +0.43 | −0.38.
**Negative in every period but 2023–24, and −0.37R a trade in 2025–26: the +0.17R shadow run since 1 Nov is noise. The scalp stays retired.** Scalp-type setups tested so far on long history and found empty: this one, the desk Scalp (M15→M1 CF), the NQ open sweeps, the Chart Fanatics NQ scalper, noise momentum, the M1 CHoCH replica variant. The one scalp that holds is the gold replica itself (M5 CHoCH, gated), which is already live.

## 2026-11-05 — Owner's "XAUUSD OmniBook" cBot (13 edges): his backtest decoded, every gold edge replayed on our 8 years

His cTrader replay (Apr 2022 – Jul 2026, $10k → $17.1k, 778 trades) by edge (joined from his log and events file): E2 20:00 fade +$2,850 (195 trades), I1 Monday hold +$1,879, C1 month turn +$994, E5 10-day breakout +$922, FX satellites +$1,818 in total, while the three sweep/engulf edges E1/E4/E3 net −$437. All his profit is long gold or calendar longs.
Replayed on HistData spot gold 1m (UTC, 0.42 cost, `ms/omni.py`, `ms/omni_grid.py`), R on each edge's own stop, 2019–22 | 2023–24 | 2025–26:
- E1 H1 sweep −0.16 | −0.13 | +0.08 (n94/52/37); E4 M15 sweep −0.06 | +0.07 | +0.10; E3 bear engulf +0.07 | −0.05 | +0.12 → nothing, as in his own log.
- E2 20:00 fade long (day down ≥ 1 ATR at the 20:00 bar, SL 0.7 ATR, TP 1R, 4 h): +0.07 | +0.20 | +0.13 (n178/96/139), DD −7.6 | −3.5 | −10.8; the mirrored short loses −0.15 | −0.20 | −0.18. Positive at every threshold and target at hour 20, but hour 19 is negative in 2019–22 and hour 21 flat, Fridays lose in every period: a small, hour-specific edge, Sharpe-poor (2025–26 +12.9R at a −16R drawdown). Not added; tracker-grade.
- I1 Monday hold long: −0.58 | +0.59 | +0.49 — a 2023+ long-bias artefact. No.
- C1 month-turn long: +0.09 | +0.31 | +0.08 (n47/24/22), mirror negative; ~12 trades a year, ~+2R a year. Not worth a slot.
- **E5 daily breakout long with a chandelier trail is robust:** N10 trail 2 ATR +0.29 | +0.43 | +1.50 (n38/21/15); **N20 trail 2 ATR +0.31 | +1.07 | +2.42 (n29/12/10, DD −4.4 | −1.4 | −0.9)**; N20 trail 3 +0.38 | +1.56 | +1.19; N55 trail 2 +0.76 | +0.78 | +2.96; the crypto-style midpoint exit is weaker on gold (+0.10 | +0.36 | +0.65). Shorts of the mirrored rule lose in every period (N20 −0.22 | −0.42 | +0.02). N20 trail 2 by year: 2019 +6.1, 2020 +3.3, 2021 +0.5, 2022 −1.1, 2023 +4.0, 2024 +8.8, 2025 +19.4, 2026 +4.7; 51 trades, 51% wins, best +13.0R, worst −1.02R. A long-only gold trend system: it rides the secular bull and will go flat, not negative, in a bear (the trail caps losses at about −1R each, ~6 trades a year).
- FX satellites on HistData daily (GBP/USD, USD/JPY, USD/CAD, EUR/USD; month-turn long/short, 3-down buy): every cell between −0.13 and +0.09R a trade, none consistent. Not added. Oil spread: no data.
**Adopted: gold trend (user rule `gold-trend`):** daily close above the prior 20 daily highs → long at market on the bot's next run, stop 2 × ATR(D1,14) below, stop ratchets to (daily close − 2 ATR) on every closed day, no target, no time limit; sizing guide 0.5%. Independent of the replica (days-to-weeks hold).

## 2026-11-05 — MSNR direction SOP on the NQ open run: no edge, nothing changed

Question: does the Malaysian SnR direction (H4 external breakouts gated by tapped Daily levels, the rule that helped the gold replica as a "pullback phase" tag) say anything about the NQ New York open run? Harness: `nq/nq_msnr.py` (scratchpad), the 5 Nov nyflip rule replayed on the trader's NQ futures 1m file + HistData cash (2023–Oct 2026, 0.5 pt cost), H4/D1 built from the same 1m stream (daily bars from 18:00 ET), direction read at the entry bar.

| n4 | half | all | MSNR agrees | MSNR against |
|---|---|---|---|---|
| 2 | 2023–24 | 154 tr, +51.1R, DD −8.2 | 75 tr, +33.6R | 79 tr, +17.5R |
| 2 | 2025–26 | 142 tr, +48.6R, DD −7.8 | 78 tr, +20.4R | 64 tr, +28.2R |
| 3 | 2023–24 | | +33.5R | +17.6R |
| 3 | 2025–26 | | +24.0R | +24.6R |
| 5 | 2023–24 | | +22.5R | +28.6R |
| 5 | 2025–26 | | +28.7R | +19.9R |

The run is profitable on both sides of the H4 direction in both halves and the better side flips between halves for every pivot width. Buys-with-direction look best in 2025–26 (n4=3: +0.71R/trade) but not in 2023–24 (+0.44, same as the rest), and the sell side flips too. Neither a gate nor a sizing tilt holds in both halves. The NQ open run stays as it is: direction-agnostic, midnight-open filter only. Not adopted; nothing recorded forward (the gold `feat.msnr` tag stays).

## 2026-11-05 — MSNR direction as the Mosha weekly filter: not a replacement, not a robust add-on

Harness `ms/mosha_msnr.py` on the Mosha chain records (`lab/mv3_XAU.json`, spot gold, limit at the broken T3 level, 3R, 24 h). MSNR direction (H4 external BO gated by tapped Daily levels, n4 = 2/3/5) read at the chain's CF time. Live chain H4-H1-M15, R per half (2019–22 | 2023–24 | 2025–26, n / sum / DD):

| filter | 2019–22 | 2023–24 | 2025–26 |
|---|---|---|---|
| weekly agrees (live) | 87 / +32.2 / −7.3 | 36 / +6.3 / −10.5 | 65 / +21.0 / −17.4 |
| MSNR agrees instead of weekly (n4=2) | 73 / −20.4 / −29.1 | 30 / +9.5 / −7.5 | 52 / +9.8 / −7.8 |
| weekly & MSNR agree (n4=2) | 24 / +2.4 / −3.8 | 20 / +11.7 / −2.8 | 26 / +17.4 / −4.1 |
| weekly & MSNR agree (n4=3) | 19 / +3.2 | 18 / +11.6 | 28 / +6.5 |
| weekly & MSNR agree (n4=5) | 39 / +3.7 | 15 / +5.8 | 32 / +2.2 |
| weekly agrees, MSNR against (n4=2) | 63 / +29.8 | 16 / −5.4 | 39 / +3.6 |

- **As a replacement** for the weekly: negative 2019–22 (−20R, DD −29), roughly flat 2025–26 → rejected outright. "Weekly against, MSNR agrees" is negative in all three windows, so MSNR never rescues a counter-weekly chain.
- **As an add-on** (both must agree): n4=2 cuts the drawdown in both halves (−2.8 / −4.1 vs −10.5 / −17.4) and beats the live line in 2023–24, but gives up 3.6R in 2025–26 and almost all of 2019–22 (+2.4 vs +32.2); n4=3 and n4=5 lose most of the 2025–26 profit. The double filter fails the "more profit AND less drawdown in both halves" rule and is fragile to the pivot width → not adopted.
- H4-H1-M30 and D1-H4-H1 chains: same picture, MSNR-agree rows negative or tiny.

Decision: the Mosha BO paper system keeps the weekly as its direction filter. No forward tag added (the sample is 2 live Mosha fills a month; it would take years to read).

## 2026-11-05 — MSNR scalp from the Direction SOP (external BO on M15/M5 after a tapped higher-TF level): negative, rejected

The SOP defines direction only, so the scalp was built the only honest way: trade the switch itself. Working TF W (M5 / M15 / H1), one rung above A (M15 / H1 / H4) carrying the key levels (A/V pivots with a 5% band, engulfing zones, DOM zones; levels live 2 / 5 / 20 days). A switch = W close through the last W pivot that formed **before** the latest tap of an A-level on the trade's side (the SOP's external breakout). Entry at the next 1m open after the switch candle, stop past the pullback extreme (the leg origin) − 0.30 cost, targets 1R / 2R / 3R / 2R-then-trail, max hold 4 / 8 / 24 h. Spot gold 2019–26, harness `ms/msnr_scalp.py` + `ms/msnr_scalp2.py` (scratchpad). R sum per window (2019–22 | 2023–24 | 2025–26):

| variant | 2019–22 | 2023–24 | 2025–26 |
|---|---|---|---|
| M5/M15, 2R (nw=3, n≈9.7k/4.5k/4.5k) | −1418 | −481 | −172 |
| M15/H1, 2R (nw=3, n≈3.2k/1.5k/1.4k) | −255 | −149 | +12 |
| M15/H1, 2R buys only | −126 | −33 | +39 |
| M15/H1, 2R, H4 MSNR direction agrees | −107 | −68 | +24 |
| M15/H1, limit retest at the broken level, 3R | −185 | −134 | +2 |
| H1/H4, 2R trail, H4 direction agrees (n=349/142/141) | +14 | +16 | +1 |
| H1/H4, limit retest 2R, H4 agrees | −11 | +12 | −4 |

Every M5 and M15 variant loses in both 2019–22 and 2023–24 at −0.07 to −0.16R per trade: the switch candle is a late, wide-stop market entry and the stop past the pullback extreme is hit on the retest more often than not. The only non-negative line (H1/H4 with the H4 direction agreeing and a trail) is +0.04R per trade on 630 trades, essentially zero in 2025–26 → noise, not a system. The ladder filter and the limit retest do not change the sign. **No scalp from the SOP is adopted.** The SOP's value for us stays what the earlier step found: the direction state as a tag on the gold replica (`feat.msnr`, "pullback phase" reading), forward-tested.

## 2026-11-05 — MSNR scalp, owner's follow-up: the storyline ladder and every timeframe pair

Same harness (`ms/msnr_scalp3.py`), spot gold 2019–26, market entry on the switch candle, stop past the pullback extreme, 2R fixed and 2R-then-trail (2Rt). R sum (2019–22 | 2023–24 | 2025–26).

**(B) every pair, working TF / level TF** (30 pairs tested): all 12 M5 pairs and all 10 M15 pairs are negative in 2019–22 and 2023–24 (−0.07 to −0.18R per trade); M30 pairs negative 2019–24 and only M30/W1 positive in 2025–26 (+34R on 285); H1 pairs about zero (H1/H4 2Rt −7 | +7 | −4; H1/W1 −8 | +5 | +9); the slow pairs are the only ones with two positive halves: **H4/D1 2R −16.1 | +6.4 | +14.7 (n 255/108/108, DD −6)**, H4/W1 −8 | +6 | +2.

**(A) storyline ladder** (D1 vs W1 → H4 vs D1 → H1 vs H4 → M15 vs H1 → M5 vs M15, trade the lowest switch only when the rungs above agree):
- M5 with the full ladder agreeing: −142 | −99 | +4; with H4+H1+M15: −199 | −122 | +25 (2Rt +52 in 2025–26 only).
- M15 with D1+H4+H1: −37 | −42 | +33 (2Rt −39 | −46 | +40); with H4+H1: −51 | −43 | +23.
- **H1 with H4 agreeing: 2R +10.1 | +14.2 | +2.2, 2Rt +23.0 | +16.8 | +0.8 (n 307/134/125, DD −13/−7/−8)**; with D1+H4: +12 | +8 | −4.

Reading: the alignment helps monotonically in 2025–26 (the more rungs agree, the better the lower-TF switch does) but that is the bull year; in 2023–24 every M5/M15 line is negative whatever agrees above it, so the storyline does not rescue the scalp. The only lines with the same sign in all three windows are the H1 switch with H4 agreement (+0.07 / +0.13 / +0.01R per trade) and H4/D1 after 2023 — too thin and too few to be a system (+1R a month at best), and nothing beats the gold replica's +0.5R per trade. **Not adopted; no tracker** (the forward sample would take years to read).

## 2026-11-06 — Trendline-break scalp on gold M15 / M5 / M1 (owner request): negative everywhere, rejected

Harness `ms/tl_break.py` + `ms/tl_break2.py`. Line through the last two confirmed pivot highs (falling → buy on a close above) or pivot lows (rising → sell on a close below), pivot half-width 3 and 5, second anchor confirmed before the break, one trade per line. Entry next 1m open after the break candle, stop past the extreme since the second anchor (+0.30 cost), 2R / 3R / 2R-then-trail, hold 8 / 4 / 2 h. Variants: H4 MSNR direction agreeing, buys only, sells only, and a limit retest at the line (valid 4 h). Spot gold 2019–26, R sum (2019–22 | 2023–24 | 2025–26):

| | 2019–22 | 2023–24 | 2025–26 |
|---|---|---|---|
| M15 n=5, 2R (n 4100/1930/1895) | −427 | −259 | −97 |
| M15 n=5, 2R trail, H4 agrees | −205 | −122 | +7 |
| M15 n=3, buys only | −437 | −21 | +16 |
| M5 n=5, 2R (n 12.2k/5.7k/5.5k) | −2150 | −826 | −122 |
| M5 n=5, 2R trail | −2114 | −778 | −61 |
| M1 n=5, 2R (n 54k/26k/27k) | −14095 | −5842 | −3007 |
| M1 n=5, 2R trail, H4 agrees | −6616 | −2529 | −934 |
| M15 retest at the line, 2R | −467 | −277 | −191 |
| M5 retest at the line, 2R | −2292 | −924 | −340 |

Per trade: M15 −0.10 to −0.15R, M5 −0.15 to −0.19R, M1 −0.25 to −0.30R, i.e. the loss grows as the timeframe shrinks, which is the cost (0.30 on a stop that shrinks with the timeframe) plus the fact that a two-anchor line breaks constantly. No filter (direction, side, pivot width, retest, trail) gets any window above zero except a few +7 to +16R lines in 2025–26 on thousands of trades. **Nothing adopted.** Together with the MSNR scalp (previous entries) this closes the "find scalps" thread for now: on gold, every sub-H1 mechanical entry tested this week loses after cost; the council's edges stay on D1/H4 structure (replica, Mosha, gold trend) and the NQ open run.

## 2026-11-06 — Trendline break: best SOP timeframe (owner request)

Same trendline-break rule run on M15, M30, H1, H4 and D1 (pivot width 3 and 5), alone and gated by the Direction SOP of the rung above (M15←H1, M30←H4, H1←H4, H4←D1) or of the working TF itself; 2R, 3R, 2R-trail. `ms/tl_break3.py`, `ms/tl_break4.py`. R sum (2019–22 | 2023–24 | 2025–26, n):

| TF | gate | 2019–22 | 2023–24 | 2025–26 |
|---|---|---|---|---|
| M15 n5 | H1 SOP agrees, 2R | −232 (1622) | −120 (788) | −0 (753) |
| M30 n5 | H4 SOP agrees, 3R | −39 (885) | +18 (432) | −1 (389) |
| **H1 n3** | **H4 SOP agrees, 2R trail** | +0.3 (638) | +11.1 (312) | +30.6 (287) |
| H1 n3 | H4 SOP agrees, 2R | −7.0 | +17.8 | +27.3 |
| H1 n5 | own-TF SOP agrees, 2R trail | +19.7 (434) | +6.3 (205) | +7.2 (192) |
| **H4 n3** | **own-TF SOP agrees, 2R trail** | −6.6 (192) | +19.7 (105) | +38.2 (88) |
| H4 n3 | alone, 2R trail | −6.1 (448) | +13.2 (220) | +41.6 (193) |
| H4 n5 | D1 SOP agrees, 2R | +15.9 (106) | −12.3 (49) | +2.8 (54) |
| D1 n3 | own-TF SOP agrees, 2R trail | −1.8 (45) | +8.1 (18) | +3.5 (11) |

The edge improves monotonically with the timeframe: M15/M30 lose, H1 is flat-to-small, H4 is the best. **Best SOP timeframe: H4 breaks gated by the H4 direction (D1 levels), 2R then trail**, +0.19R/trade in 2023–24 and +0.43R in 2025–26 with small drawdowns (−9 / −7). Second: H1 breaks gated by the H4 SOP direction (+0.04 / +0.11R per trade).

Year by year (H4, own-SOP, 2Rt): 2019 −8, 2020 −4, 2021 +15, 2022 −9, 2023 −1, 2024 +21, 2025 +28, 2026 +11 (45 trades). H1/H4 2Rt: 2019 0, 2020 −7, 2021 −11, 2022 +18, 2023 −15, 2024 +26, 2025 +28, 2026 +2. The profit sits in 2024–25 on both; 2019–23 is flat and 2023 alone is negative on both, and the H4 sells contribute nothing (+0 / −2 in 2024–25, buys +21 / +29). So this is the gold bull expressed through a breakout, not a timeframe edge that holds on its own; it fails the 2023–24-half-per-year check and the 2019–22 sign check. **Not adopted** (the gold trend system already captures the 2024–26 breakout regime with a cleaner rule, +37R on 22 trades). If the owner wants it watched, the H4 own-SOP line could be a shadow tracker, but the forward read would again take years.

## 2026-11-06 — Rule change (owner): judge on 2023 onwards only. Gold H4 trendline adopted (PR #242)

The owner dropped the 2019–22 sign check: from now on a rule needs more profit AND less drawdown in both 2023–24 and 2025–26. Re-read under that lens, the H4 trendline break (previous entry) passes as a new system, buys only, gated by the H4 Malaysian SnR direction (the trader's own `msnrDirection`, pivot width 2, Daily levels):

| H4 trendline, buys, 2R then 1R trail, 96 h | 2023–24 | 2025–26 |
|---|---|---|
| pivot width 3 (adopted) | 54 tr, +23.8R, +0.44/tr, DD −4.1 | 49 tr, +32.9R, +0.67/tr, DD −6.6 |
| pivot width 2 | 71, +17.4, DD −6.6 | 62, +40.3, DD −5.3 |
| pivot width 4 | 38, +10.5, DD −5.5 | 42, +20.0, DD −8.6 |
| hold 48 h / 240 h (width 3) | +20.1 / +37.7 | +25.6 / +40.8 |
| entry 4 min after the H4 close | +19.8 | +30.5 |
| no direction gate | 113, +24.0, DD −12.6 | 94, +43.9, DD −8.3 |
| sells with the gate | −4.1 | +5.3 |
| direction pivot width 5 instead of 2 | +8.6 | +17.9 |

By year (adopted line): 2023 +3.3 (24), 2024 +20.5 (30), 2025 +29.4 (25), 2026 +3.5 (24). Overlap with the gold trend system: 32 of 54 and 35 of 49 trades fire while that system is flat (+22.1R / +13.5R), so it adds a second, faster breakout leg rather than doubling the same trades. The gate's main job is drawdown (−4.1 vs −12.6 in 2023–24). Fragility to note: direction pivot width 5 halves the result, and 2026 is small — the forward CUSUM (k 0.3, catastrophe −10R) watches it.

**Merged PR #242:** system `gtl` (user rule `gold-h4-trendline`, `config.goldTL = { n: 3, span: 120, n4: 2, pad: 0.3, hold: 96 }`), site system list, both bridges map it to the gold risk, README. Also fixed in the same PR: the legacy-retirement block kept only replica / mosha-bo / trend, so a gold trend (`gtrend`) position would have been closed as "retired" on the run after it opened — found by the offline dry run of the new system. Dry run on saved candles (27 Oct 08:00 UTC break, line 4048.43, close 4078.14): opens at 4077.01 with stop 4013.91, survives the following runs, stops out later; `mt5/signals.csv` carries the row. Sizing guide 0.25%.

## 2026-11-06 — Four school skills (engulfing EG/EF, Mosha storyline, PITCHOU, Zlankator Malaysian SnR): daily engulf adopted (PR #245), the rest rejected

Owner supplied four consolidated rulebooks. Everything codable in them that was not already tested (Mosha BO chain is live; the MSNR direction, barrier/Janda and the scalps were tested earlier) went through the 2023+ harness on spot gold (0.30 cost): `ms/eg_zone*.py`, `ms/storyline.py` (scratchpad).

**EG/EF zones** (engulfing skill §1/§6: base candle red, a later candle within 3 same-colour candles body-closes above its HIGH; zone = base range; limit at the zone edge on the first return, cancelled if a body close beyond the far side comes first; stop beyond the zone − cost):

| | 2023–24 | 2025–26 |
|---|---|---|
| H4 zones, 2R (n 1074/953) | −71.3R | +31.9R |
| H4 buys only | −20.3 | +51.0 |
| H4 inside a fresh D1 zone (location) | −89.5 | +32.7 |
| H1 zones, 2R (n 3672/3560) | −231.6 | −66.1 |
| EF reversal (flipped H4 box, other way), 2R | +12.1 | +3.4 |
| EF reversal buys | +27.3 (352) | +46.0 (303) |
| D1 zones, 2R (n 193/173) | −35.6 | +7.9 |
| D1 sells | −43.8 | −21.4 |
| **D1 buys, 2R then 1R trail, 10 days** (n 96/86) | **+25.9, DD −11.2** | **+46.5, DD −13.3** |
| D1 buys, trail, close above the 20-day average (n 77/69) | **+25.5, DD −9.8** | **+47.0, DD −6.3** |
| same, per year | 2023 +6.2 (25), 2024 +19.3 (52) | 2025 +34.1 (44), 2026 +12.9 (25) |
| robustness (buys + trail + gate) | K=1/5 candles +17.4/+20.6 \| +22.0/+57.6; zone life 10/100 d +20.6/+7.6 \| +42.8/+47.1; hold 5 d +18.0 \| +31.3; trail after +3R +23.2 \| +35.6; 2R behind +28.8 \| +45.6 | |
| overlap with gold trend | while it is long 25 tr +13.9 \| 18 tr +15.8; while flat 52 tr +11.6 \| 51 tr +31.3 | |

**Storyline** (Zlankator/PITCHOU: Daily key levels = close of the first of two consecutive candles, A/V/Gap, fresh until a wick touch, ≤4 uses; Daily reject Daily; H4 external breakout within two days; limit at the H4 Apex, SL 30 pips, BE after 80, TP 120/220 or next fresh Daily level): all 602/496 | buys 311/231 | sells 291/265: TP120 −115 \| +13; TP220 −100 \| −62 (buys +48 \| +53, sells −148 \| −115); next-Daily TP −16 \| −94; SL50 −127 \| +78; without the H4 breakout −190 \| −154 (the breakout requirement does help, as the skill says). The mechanical Apex entry with a 30-pip stop is negative; only buys with a far target survive, i.e. the bull. **Rejected.**

**Mosha storyline**: BO→VR→CF is the live Mosha BO system; QM preference, the 4 cases, Janda and the barrier formula were tested on 3–5 Nov (nothing robust). **PITCHOU/Zlankator confirmations** (M1/M5 trendline break, M15 rejection, ECMTF two-TF-lower scalps): sub-H1 entries lose on gold after cost in every form tested this week (MSNR scalp, trendline break M1–M30) — not re-run.

**Adopted (PR #245, system 7, `geg`, user rule `gold-daily-engulf`)**: D1 EG buy zone, limit at the zone high while the daily close is above the 20-day average, valid 20 days, cancelled by a daily close under the zone, stop 0.3 under the zone, trail 1R after +2R (cap 10R), out 10 days after the fill, max 3 open, 0.25% sizing guide. Offline dry run: 16 Oct zone → limit at the zone high → filled → stopped −1R on the drop; 31 Oct zone blocked (below the average); CSV row written; site clean. Council check prompt updated (CUSUM k 0.3, catastrophe −14R).

## 2026-11-06 — Tweak round over all seven systems (owner: "find the best tweaks with all the info"); replica size tilt adopted (PR #246)

Harnesses: `ms/msnr_eval3.py`, `ms/gtrend_n.py`, `ms/export_new.py`, `ms/portfolio.py` (scratchpad). 2023–24 | 2025–26.

**1. Gold replica, size by the H4 Malaysian SnR direction (adopted, PR #246).** Live exits and risk rules (top-fifth gate, daily stop, max 3 open, equity half-size), `feat.msnr` with pivot width 5:

| sizing | 2023–24 | 2025–26 |
|---|---|---|
| live (all size 1) | 64 tr, +73.9R, DD −10.5 | 148 tr, +112.0R, DD −17.6 |
| **1.5 when MSNR against, 0.5 when it agrees** | **+109.6R, DD −9.7** | **+155.5R, DD −16.5** |
| same with pivot width 2 | +77.5R, DD −6.9 | +141.2R, DD −17.5 |
| skip the agreeing trades | +72.7R, DD −6.5 | +99.5R, DD −10.3 |
| half size when against (opposite tilt) | +37.5R | +62.3R |

Mechanism: the replica buys the daily trend against the H4 trend; while the H4 SOP direction still points against the trade the pullback is in progress and the counter-trend entry works; once the H4 direction has flipped with the trade, the move is already under way. More profit and less drawdown in both halves, same sign in 2019–22 (5 Nov entry). The bridges did not read the `size` column (the cTrader one did not parse it at all): fixed in the same PR, so the equity half-size and this tilt now reach MT5/cTrader.

**2. Gold trend, N and an add at +1R** (D1 breakout, 2 ATR trail): N20 live +9.9R (DD −2.0) | +24.1R (DD −1.0); with one add at +1R (daily close) +13.2R (DD −2.5) | +41.1R (DD −1.0); N10 +6.3 | +22.9 (add +13.8 | +40.9); N55 +7.0 | +21.0 (add +11.2 | +35.3); 3 ATR trails lower everywhere. The add raises profit by a third / 70% but the 2023–24 drawdown goes from −2.0R to −2.5R → fails the strict "less drawdown" test by half an R; **offered to the owner, not applied**.

**3. Gold H4 trendline + 20-day-average gate:** +9.8R (32) | +18.8R (26) vs base +23.8 (54) | +32.9 (49) → the gate only removes trades. Keep as is.

**4. Daily engulf:** variants were exhausted in the adoption step (trail, hold, life, K, gate); nothing further.

**5. Portfolio (all seven systems at the sizing guide: NQ 0.25%, replica 0.5% with the add at 1%, crypto 0.5% + 0.5% add, gold trend 0.5%, H4 trendline 0.25%, daily engulf 0.25%; replay records 2023–Oct 2026, replica before the tilt):** +219.6% over 86 months = +2.55% a month; worst drawdown −7.9%; worst day −2.03% (17 Nov 2025); worst months −4.8 / −3.0 / −2.8%; 52 of 86 months up. By half: 2023–24 +98.3% (DD −4.6%, worst day −1.5%); 2025–26 +122.2% (DD −7.9%, worst day −2.0%). Contribution: replica 93 points, crypto 52, NQ 25, gold trend 19, daily engulf 18, H4 trendline 13. For the owner's $50k challenge (3% daily, 10% max drawdown) the full guide leaves too little room: at 0.75× (replica 0.375%, crypto 0.375%, gold trend 0.375%, NQ/trendline/engulf 0.2%) the replay gives ≈ +1.9% a month, worst drawdown ≈ −5.9%, worst day ≈ −1.5%; that is the recommended bridge setting for the challenge account.

## 2026-11-06 — NQ open run: the edge decays with entry delay; the council's late feed cannot trade it

The live bot reads NQ from CNBC about 13 minutes late (Yahoo throttled, HTTP 429) and polls every 4 minutes. Replay of the 5 Nov rule (`nq/nq_late.py`, trader's NQ 1m file + HistData cash, 0.5 pt cost) with the entry taken at the open of the bar `delay` minutes after the signal bar, same stop, 2R then 1R trail, out 11:00 ET:

| entry delay | 2023–24 | 2025–26 |
|---|---|---|
| 0 min (backtest) | 154 tr, +51.2R, +0.33/tr, DD −8.1 | 142 tr, +48.6R, +0.34/tr, DD −7.8 |
| 5 min | +31.3R, +0.21 | +29.8R, +0.22 |
| 10 min | +20.6R, +0.15 | +23.8R, +0.19 |
| 13 min (the feed lag) | +7.3R, +0.05 | +34.4R, +0.29 |
| 13 min, 0.5R slip band (the bridge's rule) | 70 tr, −1.6R | 56 tr, +32.3R |
| 15 min | +12.1R, +0.09 | +24.8R, +0.20 |
| 20 min | +4.3R, +0.03 | +5.1R, +0.04 |

Half the edge is gone by 5 minutes and almost all of it by 13–20. The slip band does not rescue a late entry (it only removes trades). Consequences: (1) the council's paper record of the open run will understate the system, as the 5 Nov note already assumed (+0.1R live); (2) the open run must be executed natively on broker ticks — `mt5/NQOpenRun.mq5` does that (ET clock, 0.08% run, reclaim, 2R then 1R trail, 11:00 exit); the bridges keep `MirrorNQ = false` by default and should stay so; (3) a cTrader port of NQOpenRun stays on the list once the MT5 one is validated on demo. No council rule change.

**Forward record to date (paper, since 5 Nov):** gold replica 2 trades +1.0R (Nov 4, before the gate went off); NQ open run: no signal on 5 Nov (the rule went live that evening), none yet on 6 Nov; Mosha BO, crypto trend, gold trend, H4 trendline: no trades; daily engulf: one limit waiting at 3,979.4 (zone 3,908–3,980 from the 3 Nov candle). Too thin for a monthly summary; the first one is due at the end of November.

## 2026-11-06 — Gold focus with the four skills: Mosha momentum arrival re-judged on 2023+ and adopted (PR #247)

Owner: focus the new content on gold. The Mosha "sideways arrival" rule (5 Nov: gold-only positive, silver reversed → recorded as `feat.pull`, not used) re-read under the 2023-onward gold-only rule, chains H4-H1-M15 with the weekly agreeing, 3R (`lab/mv3_XAU.json`):

| | 2023–24 | 2025–26 |
|---|---|---|
| all (live) | 36 tr, +6.3R, DD −10.5 | 65 tr, +21.0R, DD −17.4 |
| **slow arrival ≥ 12 H1 bars** | **19 tr, +9.6R, DD −3.5** | **41 tr, +23.0R, DD −11.3** |
| fast arrival < 12 | 17 tr, −3.3R | 24 tr, −2.0R |
| slow ≥ 16 / 22 / 30 / 40 | +11.7 / +10.3 / +10.3 / +10.3 | +15.2 / +16.8 / +19.0 / +17.1 |
| strong leg (≥ 2 pivots crossed) / weak | +7.4 / −1.1 (n1) | +28.9 / −8.0 |
| QM-type (structure-flipping) CF / plain | +3.8 / +2.5 | +2.4 / +18.6 |

Slow arrivals beat the live line on profit and drawdown in both halves at 12 and 30 bars (16–22 give up a few R in 2025–26 with better drawdown); fast arrivals lose everywhere → **adopted at 12 bars** (`mosha-slow`, PR #247): a fast chain is a shadow trade (`blockedBy: ['momentum']`), so the filter's cost keeps showing forward. The "strong leg" rule (≥ 2 pivots crossed in the breakout leg) points the same way but has one weak-leg trade in 2023–24, so it cannot be judged; the QM-type CF preference is not supported (plain CFs did better in 2025–26).

Gold items from the skills still to test (loop list): Zlankator CC/DC confirmation candle at a fresh H4 A/V level (H1 rejection closing in the level's direction → limit at the level, SL 30 pips, TP 100 / next level); the "4 and 2 rule" key levels as entry levels for the daily engulf (level + zone overlap); CE (50% of the Daily wick, 7-pip stop) at the H4 Apex; Ephron's EG-then-EF overlap on D1 zones; PITCHOU M15 rejection candle at a fresh H1 level in the daily storyline direction (SL 13, 1:3); the engulf "stairs" re-entries.

## 2026-11-06 — Zlankator H4 key levels (plain / CC / DC entries) on gold 2023+: negative, rejected

`ms/zl_levels.py`. Levels per the skill (close of the first of two consecutive H4 candles; A = bull-then-bear → resistance, V = bear-then-bull → support; fresh until a wick touch, body through re-freshens, ≤ 2 uses, life 20 days). Entries: plain limit on the first touch; CC = an H1 candle wicking the level, body on the level's side, closing in its direction → limit for the next touch; DC = the same rejection closing against the level → limit for the next touch. SL 3.0 (30 pips), TP 10.0 (and 6.0), BE after 8.0, 5-day validity, 10-day hold, with and without the 20-day-average direction gate. 3,013 levels.

| entry | 2023–24 | 2025–26 |
|---|---|---|
| plain, SL3 TP10 (n 1448/1327) | −150R | −4R |
| plain, SMA20 gate, buys | −33R | +32R |
| plain, SL5 TP10 | −84R | −14R |
| CC, SL3 TP10 (n 528/506) | −35R | −28R |
| CC, SL5 | −17R | −15R |
| DC, SL3 TP10 (n 765/696) | −116R | −90R |
| DC, SL5 | −76R | −78R |

Every variant, side and gate is negative in 2023–24 and at best flat in 2025–26; the fixed 30-pip stop on a line level is too tight for gold's range (median H4 range 2023–26 is far above 3.0) and widening it to 50 pips only shrinks the loss. The confirmation candles (CC/DC) do not improve on the plain touch. The Zlankator level model is a discretionary swing method; its mechanical core has no edge here. **Rejected.** Next gold items on the list: the 4-and-2 levels as a location filter for the daily engulf zone; CE at the H4 Apex; EG-then-EF overlap on D1; PITCHOU M15 rejection at a fresh H1 level; engulf stairs.

## 2026-11-06 — Location filters on the daily engulf (Zlankator key levels, Ephron EG-then-EF overlap): not adopted

`ms/eg_loc.py`, on the adopted daily engulf buys (SMA20 gate, limit at the zone high, trail 1R after +2R, 10 days):

| filter | 2023–24 | 2025–26 |
|---|---|---|
| adopted | 77 tr, +25.5R, DD −9.8 | 69 tr, +47.0R, DD −6.3 |
| zone holds a fresh D1 support level (4-use rule) | 72, +14.1, DD −9.8 | 60, +38.9, DD −7.7 |
| zone holds any fresh D1 level | 73, +22.4, DD −9.8 | 63, +38.5, DD −8.7 |
| zone holds a fresh H4 support level (2-use rule) | 65, +24.2, DD −7.3 | 65, +48.6, DD −6.0 |
| no fresh D1 support in the zone (the removed trades) | 5, +11.4 | 9, +8.1 |
| EG-then-EF overlap (a failed D1 sell zone under it) | 41, +18.9, DD −7.8 | 33, +16.6, DD −7.0 |
| without the overlap | 36, +6.6 | 36, +30.4 |

The D1-level filters remove the best trades (the 14 zones without a fresh support level made +19.5R). The H4-level filter is the only one that improves the drawdown in both halves and the profit in 2025–26, but it gives up 1.3R in 2023–24 → fails the strict rule; not applied. The Ephron overlap is better in 2023–24 and worse in 2025–26 → no rule. Daily engulf stays as adopted.

## 2026-11-06 — Zlankator CE (50% of the Daily wick) on gold 2023+: negative in 2023–24, rejected

`ms/ce_wick.py`. A Daily candle whose rejection wick is ≥ 1.5× its body while the 20-day trend agrees; limit at 50% of the wick on the next touch within 5 days; stop 0.7 (his 7 pips) / 1.5 / 3.0 beyond the entry; 3R, 5R or trail 1R after +2R; 10-day hold. n 131 | 123:

| stop, exit | 2023–24 | 2025–26 |
|---|---|---|
| 0.7, 3R / 5R / trail | −39 / −55 / −24 | −24 / −26 / +80 |
| 1.5, 3R / 5R / trail | −45 / −55 / −23 | −16 / −10 / +40 |
| 3.0, 3R / 5R / trail | −32 / −42 / −23 | +5 / +27 / +22 |

Every line is negative in 2023–24 (buys −0.3 to −0.6R a trade); the 7-pip stop version only pays with a trail in 2025–26, where a few runners of 20R+ carry it. A 0.7 stop on gold is cost-dominated (0.30 spread = 43% of the risk). **Rejected.** Remaining gold items from the skills: PITCHOU M15 rejection at a fresh H1 level in the storyline direction; engulf stairs re-entries; overlap sizing between the replica, the engulf and the trendline.

## 2026-11-06 — PITCHOU M15 rejection candle at a fresh H1 level (storyline direction): negative, rejected

`ms/pitchou_m15.py`. H1 key levels (close of the first of two consecutive candles, 11,101 levels), fresh until the first touch; direction = 20-day average (also the MSNR H4 direction, and none); confirmation = the first M15 candle that wicks into the level and closes back on the trade side; entry at that close; SL 13 pips / 20 pips / past the M15 wick; TP 1:3 (and 1:2); 24-h hold.

| | 2023–24 | 2025–26 |
|---|---|---|
| SL 1.3, 1:3 (n 1194/1265) | −147R | −47R |
| SL 2.0, 1:2 | −117R | −10R |
| SL past the wick, 1:3 | −271R | −101R |
| buys, SL 2.0, 1:2 | +4R | −3R |
| no direction gate, SL wick | −610R | −150R |

Negative in both halves for every stop, target and gate; the direction gate halves the loss but never flips it. Another sub-H1 confirmation entry that cannot pay gold's spread. **Rejected.** This closes the sub-H1 entries from the four skills (MSNR switch scalp, trendline M1–M30, ECMTF-style two-TF-lower, M15 rejection): none works mechanically on gold 2023+.

## 2026-11-06 — Daily engulf: concurrent positions and "stairs" re-entries — unchanged

`ms/eg_stairs.py` (adopted rule, overlapping zones taken in time order): no cap +25.5R (DD −9.8) | +47.0R (DD −7.3); cap 1 +18.8 (DD −4.7) | +23.9 (DD −4.3); cap 2 +29.0 (DD −9.3) | +42.8 (DD −7.3); cap 3 (live) = no cap; stairs (a new zone only onto an open position already ≥ +1R) +19.4 (DD −4.7) | +23.5 (DD −4.3). Cap 2 gains in 2023–24 and loses in 2025–26; cap 1 and stairs halve the drawdown but give up a third to half of the profit. The live cap of 3 stands.

## 2026-11-06 — Combined gold exposure (replica, gold trend, H4 trendline, daily engulf) at the sizing guide, 2023–Oct 2026

Replay records at 0.5% (replica, gold trend) and 0.25% (trendline, engulf): gold systems alone +143.7% over the period, worst drawdown −10.6%, worst day −2.53% (2 Apr 2026); maximum simultaneous gold open risk 2.5% of the account (23 Aug 2024); three or more gold positions open on 252 of 1,010 trading days. Daily P&L correlations between the four systems are all within ±0.06 — they are independent legs, not the same trade four times, so the diversification is real and the drawdown of the sum (−10.6%) is well under the sum of the drawdowns. For the challenge account the earlier 0.75× guide still holds (worst day ≈ −1.9%, drawdown ≈ −8%); the paper council keeps the full guide.

## 2026-11-06 — MSNR direction variants from the deep research (reset, strict, body tap, level life): the replica tilt is insensitive to them

Web research on the Malaysian SnR schools (search-snippet level; the session cannot open the pages) surfaced three codable variants of the direction rule not in the L3XUS SOP: (a) an H4 close beyond the tapped Daily level cancels the tap (MQL5 storyline products); (b) a newer pivot of the same side confirmed after the tap resets the setup (RWBTradeLab "double breakout"); (c) only a body tap counts (one generic guide). Judged through the replica size tilt (`ms/msnr_variants.py`, 1.5× when the H4 direction is against the trade, 0.5× when it agrees, pivot width 5):

| direction rule | 2023–24 | 2025–26 | share "against" |
|---|---|---|---|
| no tilt (old live) | +73.9R, DD −10.5 | +112.0R, DD −17.6 | |
| base (adopted, PR #246) | +109.6R, DD −9.7 | +155.5R, DD −16.5 | 65% |
| reset on a close beyond the tapped level | +109.6 | +150.8 | 64% |
| strict (newer pivot resets) | identical to base | | |
| body tap only | identical to base | | |
| Daily level life 30 d / 180 d | +104.8 / +109.6 | +155.5 / +155.5 | |

The direction state at the replica's entry times is the same under every variant except the reset (slightly worse) and the 30-day life (slightly worse in 2023–24). The tilt is therefore not an artefact of a definitional detail; the adopted rule stays. Also from the research: gold's Feb–Jun 2026 drawdown (5,597 → 3,942) as a separate test window: replica +59.6R (81), gold trend −0.9R (1), H4 trendline −3.6R (14), daily engulf −6.8R (11) — the long-only legs lose modestly in a bear phase, the replica carries the book; drawdowns within each system's stated limits.

## 2026-11-06 — Deep research (three agents + report) and its first two ideas tested: session bands and a two-target exit — no change

Report: `scratchpad/reports/Malaysian SnR direction improvements.md` (sent to the owner). Its reading: no independent, cost-inclusive evidence exists for Malaysian SnR direction rules, engulf zones or gold breakouts; the SOP's value is as a pullback detector (our replica tilt), engulf zones carry no edge beyond direction and location, breakout survivors are long-only and regime-bound; the only peer-reviewed material is intraday periodicity (opens, London PM fix, overnight vs day session) ending around 2015. Caveat: every external figure came from search snippets (the session cannot open the pages).

**Session bands** (entry hour, UTC; R per trade 2023–24 | 2025–26): replica Asia +1.96 | +0.77, London AM +1.16 | +1.08, NY AM +0.05 | +0.61, PM-fix window +0.93 | +1.12, NY PM −0.08 | +0.32 (n 7 | 28); daily engulf fills Asia +0.11 | +0.48, London AM +0.86 | −0.03, NY AM +0.23 | +1.13, NY PM +0.60 | +0.99; H4 trendline breaks Asia +0.04 | +1.38, London AM +1.13 | +1.37, NY AM +0.49 | +0.40, PM-fix +0.23 | +0.04. No band is negative in both halves for any leg; dropping the replica's NY-PM entries would gain 0.6R in 2023–24 and lose 9R in 2025–26. **No session rule.**

**Two-target exit on the daily engulf** (half off at +1 / +1.5 / +2 / +3R, rest trails): +17.2 | +27.8, +16.1 | +34.1, +18.9 | +39.7, +21.1 | +44.7 vs the adopted +25.5 | +47.0 — every partial loses profit in both halves, with the drawdown only marginally better. **Rejected** (the Edgeful NQ improvement does not transfer).

Remaining report ideas on the plan: a time gate 15–30 min after 08:30 ET releases on the engulf and trendline legs; vol-targeted sizing vs the replica's binary top-fifth gate.

## 2026-11-06 — 08:30 ET release gate on the engulf and trendline legs: immaterial, no rule

`ms/news_gate.py`. Release-sized days = the 94 of 940 weekdays whose 08:30–08:35 ET one-minute range is in the top decile (≥ 10.5 points). Daily engulf (adopted rule): skipping any fill between 08:25 and 09:00 ET, or only on release days, changes nothing (+25.5 | +47.0R either way: the limit fills again at the same price after the window); delaying the fill to a 09:00 market entry loses (+9.7 | +26.4). H4 trendline: no break can be entered in the hour after 08:30 (the H4 closes do not fall there). The replica already has its 08:25–08:45 veto. **No news rule for the other legs.**

## 2026-11-06 — Replica: volatility-targeted sizing vs the binary top-fifth gate — the gate stays

`ms/vol_size.py`, every passing replica signal 2023–26 (D1 with, H4 against), live exits and risk rules, the MSNR tilt on top; size = (v / p80)^k clipped, where v is gold's 20-day range measure and p80 its own-year 80th percentile:

| sizing | 2023–24 | 2025–26 |
|---|---|---|
| live: top-fifth gate, size 1 (+ tilt) | +109.6R, DD −9.7 | +155.5R, DD −16.5 |
| no gate, size 1 | +57.3R, DD −52.4 | +48.6R, DD −49.8 |
| vol-sized (v/p80), clip [0, 2] | +60.2R, DD −45.5 | +166.3R, DD −37.3 |
| vol-sized (v/p80)², clip [0, 2] | +68.8R, DD −39.6 | +229.7R, DD −31.1 |
| gate, then v/p80 sizing inside [0.5, 2] | +102.6R, DD −11.6 | +210.3R, DD −21.0 |

Continuous sizing without the gate keeps every calm-market loser at a reduced size and quadruples the drawdown; sizing inside the gate adds profit only in 2025–26 and raises both drawdowns. The report's "vol-targeted sizing instead of a binary gate" does not hold for this system: the calm-gold signals have no edge at any size. **Unchanged.** That closes the deep-research list except the owner's pending gold-trend add decision.

## 2026-11-06 — Replica exits and add timing re-checked under the size tilt: unchanged (add at +1.5R is a near miss)

`ms/exits_tilt.py`, live risk rules + the MSNR tilt, 2023–24 | 2025–26:

| exit / add | 2023–24 | 2025–26 |
|---|---|---|
| live: BE at +2R, add at +2R, run 1R after +4R | +109.6R, DD −9.7 | +155.5R, DD −16.5 |
| fixed 4R, no add | +61.2, DD −6.5 | +84.6, DD −13.4 |
| fixed 3R / 5R | +43.6 / +66.4 | +66.4 / +64.7 |
| no breakeven | +86.5, DD −12.7 | +166.9, DD −20.2 |
| run after +3R instead of +4R | +70.9 | +124.4 |
| trail 2R behind after +4R | +115.2, DD −9.5 | +117.1, DD −17.9 |
| add at +1.5R (BE still +2R) | **+120.2, DD −10.3** | **+170.3, DD −14.4** |
| add at +1.5R, BE at +1.5R | +106.3, DD −12.7 | +151.0, DD −26.1 |
| add at +1R | +120.1, DD −14.4 | +160.4, DD −25.5 |
| add at +1.5R, run after +5R | +102.8 | +115.0 |
| add half a unit at +2R | +86.9 | +129.2 |

The live exit stack holds. Moving the add from +2R to +1.5R gains 10% / 10% profit and cuts the 2025–26 drawdown, but the 2023–24 drawdown worsens by 0.6R (−10.3 vs −9.7) → fails the strict rule by a hair; everything else (earlier BE, add at +1R, later run, half adds) is worse. Listed for the owner with the gold-trend add as "more profit, marginally more early drawdown" candidates; not applied.

## 2026-11-06 — Owner: apply the near-miss improvements (PR #250) and look for a small daily scalp edge

**Applied (PR #250):** replica add at +1.5R (user rule `gold-add-1.5`; +109.6 → +120.2R | +155.5 → +170.3R with the tilt, DD −9.7 → −10.3 | −16.5 → −14.4) and the gold trend add at +1R on a daily close with the same ratcheting stop (`gold-trend-add`; +9.9 → +13.2R | +24.1 → +41.1R, DD −2.0 → −2.5 | −1.0). The owner accepted the half-R of extra early drawdown for both.

**Scalp / daily-edge sweep** (`ms/scalp_sweep.py`, `ms/nyorb.py`, `ms/overnight.py`; spot gold 2023+, 0.30 cost; R = the trade's own risk, or 0.5% of price for session holds):

| idea | 2023–24 | 2025–26 |
|---|---|---|
| Asia range (00–07 UTC) breakout in London, 1R / 2R / trail | +0.03 / +0.01 / +0.01 per trade | +0.06 / +0.10 / +0.09 |
| Asia range fade to the midpoint | −0.21 | −0.13 |
| London 08:00 15-min opening-range breakout, 1R / 2R | −0.21 / −0.22 | −0.05 / −0.11 |
| NY 09:30 ET opening-range breakout, 15/30/45/60 min, 1.5–3R or trail (ET clock, full coverage) | −0.07 to −0.01 | −0.03 to +0.04 |
| NY 30-min ORB 2R with the 20-day direction | +0.028 (221) | +0.100 (242) |
| day-session long 08:00→22:00 / London 08→16 / NY 13:30→21:00 | +0.08 / −0.02 / −0.07 per day | +0.07 / −0.03 / −0.06 |
| PM-fix short 14:30→16:00 UTC | −0.01 | +0.06 |
| **overnight long 23:00→08:00 UTC, stop 0.5%, target 1%** | **+0.045 per night (462), DD −14.5, 54% wins** | **+0.129 (470), DD −17.9, 48%** |
| same, no stop / stop 1% / out 07:00 | +0.059 / +0.057 / +0.052 | +0.121 / +0.109 / +0.108 |
| overnight by year (stop 0.5%, target 1%) | 2023 +10.6, 2024 +10.1 | 2025 +33.3, 2026 +27.4 (Feb–Jun 2026 −1.9) |
| overnight by entry weekday (stop 1%) | Mon +4.5, Tue +39.7, Wed +8.4, Thu +18.0, Sun +7.3 | |

Every intraday breakout/fade scalp is flat to negative after the spread (the first NY-ORB run looked good only because a data-coverage artefact halved the sample; with the ET clock and full coverage it is zero). The one consistently positive daily line is the **overnight long** (buy at the 23:00 UTC reopen, out at the London open), positive every year including 2026 and near flat in the Feb–Jun 2026 bear window, in line with the peer-reviewed overnight-vs-day gold effect. Caveats before it can be traded: (1) the expectancy is +0.045R a night in 2023–24, i.e. about +0.02% of price, and CFD financing on a gold long is of the same order (≈ 0.02R a night at 4% rates), so the early-half edge is roughly zero after swaps and only the 2025–26 half survives; (2) Tuesday carries half the profit; (3) at 0.25% risk the drawdown is −3.6% of the account for about +0.3%/month in 2023–24. **Not added live.** Candidate for a paper tracker if the owner wants it watched; a futures-style venue without swap would be the only honest way to trade it.

## 2026-11-06 — Zlankator ECMTF scalping (owner request) on gold 2023+: negative on every ladder, rejected

`ms/ecmtf.py`, rules from the skill's section D: fresh A/V level (close of the first of two consecutive candles, no gaps, fresh until the first wick touch) on the level TF; after the first touch, an EXTERNAL breakout two TFs lower (close through the last entry-TF A/V formed before the touch, within 30 bars); limit at the fresh engulf (last opposite-colour entry-TF candle before the breakout), valid 12 bars; stop 25 pips fixed (15 on M1) or the engulf's far side; TP 1R, 2R, or the nearest fresh A/V one TF above the entry (his "trade control" first target); London + NY entries only (07–17 UTC); 0.30 cost; 8 h max hold.

| ladder | best variant | 2023–24 | 2025–26 | all other variants |
|---|---|---|---|---|
| H4 → M30 (TP H1) | engulf stop, 2R | 247 tr, −6.0R (−0.02/tr) | 157 tr, −16.3R | −0.04 to −0.41/tr |
| H1 → M15 (TP M30) | engulf stop, 2R | 955, −18.8R (−0.02) | 870, −17.7R (−0.02) | −0.01 to −0.23 |
| M30 → M5 (TP M15) | fixed 25 pips, 1R | 1545, −210R (−0.14) | 1637, −203R (−0.12) | −0.12 to −0.25 |
| M15 → M1 (TP M5) | fixed 15 pips, 1R | 2688, −502R (−0.19) | 2742, −228R (−0.08) | −0.08 to −0.33 |

Win rates 47–56% at 1R (his "~60% WR" claim is in the ballpark at 1R) but the average win is smaller than the loss plus cost, so every combination loses; the "nearest fresh higher-TF level" target is the worst exit (it is usually too far, so the trade times out or stops first). Buys and sells both lose; no ladder is positive in either half. Consistent with every other sub-H1 mechanical entry tested this week (MSNR switch, trendline M1–M30, PITCHOU M15 rejection, CE, NY/London/Asia ORBs). **Rejected; no tracker.**

## 2026-11-06 — Plain M1 reversal scalps (owner: "not even just M1 reversal?"): negative; the pre-spread edge is ~0

`ms/m1rev.py` (0.30 spread) and `ms/m1rev0.py` (no spread), spot gold 2023+, entry at the next 1m open:

| idea | 2023–24 | 2025–26 | before spread |
|---|---|---|---|
| sweep of the last 30/60/240-min high/low, 1m close back inside, stop past the sweep, 1R/2R | −0.59 to −0.72 R/tr (7–22k tr) | −0.33 to −0.43 | N60 1R −0.003 / −0.064 |
| same, stop ≥ 1.5 (spread ≤ 20% of R), London/NY or with the daily trend | −0.13 to −0.19 | −0.08 to −0.16 | N240 2R + trend +0.013 / +0.038 |
| 3-SD band (20-bar) close back inside, fade to the middle | −0.57 | −0.33 | |
| same, 1R, stop ≥ 1.5 | −0.14 (451) | −0.14 (1772) | −0.010 / −0.037 |
| RSI(2) < 5 / > 95 with the daily trend, 1R or 15 min | −0.48 (16k) | −0.13 (16k) | +0.008 / +0.032 |
| RSI(2) 2/98, stop ≥ 1.5 / London-NY only | −0.17 / −0.35 | −0.12 / −0.10 | |

Without the spread every M1 reversal is within ±0.04R per trade of zero (win rates 35–52%), i.e. M1 reversals on gold are a coin flip; with a 0.30 spread on M1-sized stops (median 0.6–1.5 points) the cost is 20–50% of R and every variant loses heavily. Even the best pre-spread line (RSI2 extremes with the trend, +0.03R) would need a spread under 0.05 to break even. **No M1 scalp.** The council's small, frequent edge stays the replica (M5 entry after a 3–6 h leg, top-fifth volatility, +1R a signal); nothing below it pays gold's spread.

## 2026-11-06 — Raw-spread scalp search (owner): momentum pullback adopted as system 8 (PR #252); header float includes shadows (PR #251)

Costs for a raw account: 0.15 all-in per round trip (bounds 0.10 / 0.20 / 0.30). `ms/m1rev_c.py`, `ms/m5scalp.py`, `ms/m5mom.py`, `ms/m5mom2.py`.

- **M1 reversals at 0.15:** sweep-reclaim with trend −0.06 | −0.02, RSI(2) with trend −0.24 | −0.05, RSI(2) 2/98 −0.11 | −0.05 R/trade. Still negative: their pre-cost edge is ±0.04R.
- **M5 EMA20 pullback in the H1 50-EMA trend** (stop under 6-bar low, 1.5R / 2R / trail, London+NY): −0.07 to −0.03 | −0.01 to +0.00.
- **Previous-day high/low sweep and reclaim on M5:** −0.17 | −0.25 (2R), −0.40 | −0.38 (to yesterday's mid).
- **H1 momentum candle + M5 pullback (adopted):** H1 range ≥ 1.5× the previous 14-bar average, close in the top/bottom 20%, with the 20-day average, close 07–17 UTC; first M5 candle within 6 h trading into the 38–62% pullback and closing in the trade direction → market; stop 0.1 past the H1 candle; trail 1R after +2R; 8 h.

| | 2023–24 | 2025–26 |
|---|---|---|
| cost 0.10 / 0.15 / 0.20 / 0.30, trail | +0.114 / +0.105 / +0.096 / +0.077 R/tr | +0.175 / +0.171 / +0.167 / +0.158 |
| at 0.15: trades, DD, wins | 234, −9.1R, 44% | 186, −9.5R, 45% |
| range multiple 1.25 / 2.0 | +0.068 / −0.006 (125 tr) | +0.152 / +0.054 |
| close in top 75% / 90% | +0.089 / +0.066 | +0.135 / +0.235 |
| zone 23–50 / 50–79 | +0.145 / +0.131 | +0.097 / +0.275 |
| no 20-day direction | +0.034 (502) | +0.118 |
| wait 3 h / exits 1.5R, 3R fixed | +0.103 / +0.084, +0.107 | +0.180 / +0.088, +0.148 |
| buys / sells | +0.197 / −0.031 | +0.182 / +0.154 |
| by year | 2023 +6.2 (93), 2024 +18.3 (141) | 2025 +38.1 (111), 2026 −6.3 (75); Feb–Jun 2026 +2.8 |

Median stop 7.8 points (10%–90%: 4.1–22.8), median wait from the H1 close to entry 50 min, signals 06–16 UTC (13 UTC weakest, −4.7R on 82). Positive in both halves across every cost and parameter except the strict 2.0× range multiple (too few trades); the 20-day direction is what makes it work. 2026 to date is −6.3R, a risk to watch (CUSUM k 0.1, catastrophe −15R). Both sides kept as tested (sells negative in 2023–24, positive after). This is the first short-holding entry in the whole search with a real pre-cost edge (≈ +0.12R before costs vs ±0.04 for every M1 scalp).

**Site (PR #251):** with "Shadow too" on, open shadow trades count in the header and active-card floating result, labelled "+N shadow".

## 2026-11-06 — Fee-free scalp search (owner: "find the best scalping edge, don't worry about fees")

`ms/scalp_grid.py`, `ms/scalp_tune.py`, cost 0. Generalised the one ingredient that worked (momentum candle with the 20-day trend → pullback entry → stop past the candle → trail after 2R) down the ladder, with and without the top-fifth volatility gate:

| momentum TF → entry TF | 2023–24 | 2025–26 |
|---|---|---|
| M5 → M1 | +0.051 (1281) | −0.047 (1273) |
| M15 → M1 / M5 | −0.002 / −0.004 | +0.082 / +0.117 |
| M30 → M1 / M5 | +0.009 / −0.005 | +0.063 / +0.064 |
| **H1 → M5 (live system 8)** | **+0.125 (233), DD −8.7** | **+0.190 (185), DD −9.2** |
| H1 → M1 | +0.111 | +0.120 |
| any TF + top-fifth vol gate | −0.08 to +0.10 on 35–320 trades, sign flips | |

Below H1 the edge flips between halves even with zero fees: a 5–30-minute momentum candle is noise, an H1 one is information. Tuning the H1 version (fee-free): MSNR H4 direction agreeing +0.213 (DD −5.7) | +0.183 (DD −9.0) — better early, less profit late; H4 20-SMA agreeing +0.151 | +0.209 (DD −10.0 | −7.5); trail from 1.5R +0.152 | +0.147; trail from 3R +0.142 | +0.165; hold 4 h +0.119 | +0.149; hold 12 h +0.093 | +0.211; looser candle (1.25×, zone 23–50%) +57.8 | +36.0R on 387/356 trades (DD −13.0 | −11.6); no session filter +0.038 | +0.139. None beats the live rule on profit AND drawdown in both halves. Together with every M1 reversal (±0.04R fee-free), the session ORBs and the four schools' scalps, the conclusion is firm: **on gold the best short-hold edge is the live H1 momentum pullback (+0.12 to +0.19R a trade before costs); nothing faster has a stable edge even with zero fees.** No change.

## 6 Nov — calendar back-fill, Jun–Oct 2026 (owner: "the same for the previous 5 months")
- `research/shadow-replay.json`: 8,134 backtest trades of the shadow setups (scalp, rscalp, intraday, rintra, swing, rswing, position; all council markets) from the 150-day backtest (6 Jun – 31 Oct), target or stop, after cost. By month: Jun −34.9R, Jul −223.0R, Aug −276.4R, Sep −378.1R, Oct −297.6R (−1,210R total, about −0.15R a trade). Today's +94R live shadow day is far from typical; these setups are shadow because the rules block them.
- `replay-2w.json`: gtl / geg / gmp replays now from 1 Jun (gtl 9 trades +3.9R, geg 8 +5.3R after dropping duplicate same-zone fills, gmp 38 −6.6R, gmp flagged shadow/test). The replica has no replay trades after 22 Apr (volatility gate); NQ, crypto trend and gold trend replays were already there.

## 6 Nov — can the shadow setups be fixed? (150-day backtest, 8,211 trades, halves split at the median date)
- All of it: −0.12 | −0.18R a trade. Gross before cost −0.06R, cost 0.09R a trade: no edge to protect even before cost.
- Every setup is negative with every exit (none, BE at 1R/1.5R, 2R target, partial, trails 4/8/12): best case rintra ≈ 0 with the 4-bar trail; position −0.75R → −0.10R with a trail, still negative.
- Every single feature level (d1, struct, session, cf, choch, m15c, h4, h1, tf, rr band) is negative in both halves.
- Two-feature scan by setup × market × exit (min 50 a half, > +0.1R in both): 16 hits vs 0–3 with shuffled results. Nearly all are gold scalp against the daily trend, which in this window is gold scalp SELLS (277 of 283); the buys are the "with" side (−0.45 | −0.65R). Monthly: +32.6, +22.5, −21.2, −0.1, +27.4R (Jun–Oct); 30-day council backtest +0.33R a trade but −1.1R over 14 since 2 Nov. Reads as gold's Jun–Oct down-drift, not a rule; the 2023+ check that every live rule needs cannot be run for the engine setups (150 days of data only). Not promoted.
- Conclusion: none of the shadow setups has a fix that holds; their rules keep them out of live correctly. Options for the owner: trim the shadow book (stop recording position, intraday, and the FX scalps, the worst slices), and forward-track gold scalp sells only as a watch item.

## 6 Nov — study of today's shadow day (+94.4R reported)
- Same engine as the 150-day backtest: council/engine.mjs and backtest.mjs unchanged since 2 Nov; none of today's system changes (gtl, geg, gmp, tilt, mosha-slow, adds) closed a trade today. All 92 were engine setups blocked by 'focus'.
- Double count: m30m1 (M30 → M1) fires on the same M1 entry as the gold scalp (29 of its 31 trades identical in side, entry and time). Today's gold scalp +23.75R was counted twice. The site now counts it once: today +70.6R, not +94.4R.
- Concentration: 10 trades made +88.6R; the other 82 made +5.7R. Sells +104R, buys −9.6R; against the daily trend +94R, with it +0.3R.
- Live shadow since 1 Nov (m30m1 copies removed): +60.5R over 456, of which today +70.6R; the five days before −10.1R over 375. Against D1 +0.34R a trade vs with D1 −0.06R; gold against D1 +0.53R (67). Same direction as the backtest (against beats with), but the backtest says the against side is still negative outside gold scalps, and the gold scalp sell edge there is a Jun–Oct down-drift.
- Verdict: today is one outlier day of the same setups, not a new edge. Forward-track "gold scalp against D1" (scalp/rscalp/rintra) as a watch list; promotion needs ~100 forward trades holding > +0.15R.

## 6 Nov — the council engine's shadow setups on gold 2023–Oct 2026 (council/backtest.mjs run offline on HistData spot gold, current engine and config)
- 10,402 filled gold trades. All seven shadow setups together: −0.125R a trade (2023–24, n3,988) | −0.064R (2025–26, n4,101), after cost.
- The watch slice from today (scalp / rscalp / rintra against the daily trend) fails: −0.145 | −0.131R (n1,695 | 1,654); sells −0.19 | −0.12. Gold scalp against D1 by year: −0.09, −0.17, −0.23, −0.15. Today's +70R day and the Jun–Oct sell drift do not survive four years. Watch item dropped.
- Scalp −0.13 | −0.06, rscalp −0.21 | −0.17, intraday −0.03 | −0.02, swing −0.29 | 0.00, rswing −0.04 | −0.23.
- Only two near-misses: position (with D1, mostly buys) +0.10 | +0.23R but n68 | 47, years −0.36, +0.60, +0.59, −0.47 and DD −19.7R for +7R — a gold-uptrend buy, already covered by gold trend / gtl / geg. rintra +0.01 | +0.19R (2024 −0.05); with the 2R target +0.01 | +0.23. Neither passes; not promoted.
- Verdict: the shadow book has no fixable setup on gold; the council's blocks are right. Fixed today: m30m1 double count (site #258, trader #259).

## 2026-11-06 — Owner's skill collection: strategy improvements checked against the council
Source: the owner's combined skills file (gold-msnr-playbook, zlankator, pitchou, mosha S.CODE, 411, engulfing EG/EF,
engulfing king, MMXM, msnr-direction-sop) and its 14-year gold summary.
- Their strongest claim, **Mosha BO→VR→CF + Weekly agreeing + Daily not ranging (20-day ER ≥ 0.2)**, PF 1.35–1.42 on
  2012–26, tested on our gold H4→H1→M15 chains 2023-24 | 2025-26 (3R): weekly agrees (live rule) +7.0R dd 5.5 |
  +15.8R dd 9.1; adding ER ≥ 0.2: +9.7R dd 3.2 | +4.0R dd 5.1. Fails the both-halves rule (2025-26 ranging phases were
  profitable). **No change.** ER ≥ 0.35 also fails (+0.4R in 2025-26).
- Weekly agreement itself is confirmed (already live since 6 Nov, `mosha-bo-weekly`).
- Their "wait for the Daily close" rule: our systems already act only on closed candles; nothing to change.
- Engulf zone mechanics (EG first touch, H1 EG/EF confirmation, failed-zone continuation): their own 14-year tests show no
  edge; matches our daily-engulf finding that the edge needs the 20-day-average context. No change.
- Decision Level after the Daily close (PF ~1.2, ~12/yr, 2012-18 weak) and low-risk Apex (≤ 1.0): too thin to add.

## 2026-11-07 — Deep-research report's gold ideas + the playbook's daily stop, tested: no change
Report: `reports/ICT and gold system improvements.md` (owner's skills: gold-msnr-playbook §5, Mosha, Zlankator, 411, engulfing). Windows 2023-24 | 2025-26, plus 2019-22 where the leg has data.
- **Slow-trend gate** (3/6/12-month gold returns, `ms/tsmom.py`, `ms/gt_exit.py`), judged at the signal day:
  - Gold trend live: +23.8R dd −4.6 (2019-22) | +17.0 dd −2.5 | +41.1 dd −1.0.
    With "≥ 2 of 3 positive": +23.2 dd −3.0 | +17.6 dd −1.9 | +39.2 dd −1.5. Fails in 2025-26.
    A first run that took the momentum at the exit date looked free; that was lookahead.
  - H4 trendline, 12-month positive: +5.0 vs −3.4R in 2019-22, but −1.2R in 2023-24. Daily engulf, every gate: less profit in 2025-26. Not adopted.
- **Wider gold trend exits** (close − 3/4 ATR, chandelier from the high, 10/20-day low): the live 2-ATR close trail is best in 2025-26 (+41.1R dd −1.0). Close − 3 ATR wins 2019-22 and 2023-24 but loses 11R in 2025-26. Unchanged.
- **Daily loss stop / cool-off** (playbook §5 "3 losses → stop", `ms/daycap.py`, `ms/eg_daycap.py`):
  - The entry-time version showed the daily engulf at +39.8 dd −4.7 | +49.5 dd −5.3 with a −1R day cap. That was lookahead: 33 of 146 fills share a day and the first loss had not closed yet.
  - With real exit times: −1R cap +26.0 | +45.4; −2R cap +26.5 dd −8.8 | +47.0 (vs +25.5 dd −9.8 | +47.0); one fill a day +30.3 dd −5.7 | +31.9.
  - Replica: −1R cap +67.6 | +101.4; −2R +64.5 | +113.9; cool-offs 4–24 h all lose profit.
  - Scalp and trendline: no day ever hits the caps.
  - Not adopted: the −2R engulf cap is +1R in one half only.
- Conclusion: the live gold stack stays as it is. The open-risk cap and the session-by-side scalp test need trade-level side and exit data the records do not carry; they are next.

## 2026-11-07 — Owner: "our main edge looks horrible" — what the numbers say
- **Live since 1 Nov:** 37 closed live trades for −15.4R. 35 of them are the old engine setups (scalp / rscalp / rintra / intraday on crypto and FX), live until `retireLegacy` (5–6 Nov). Main systems live so far: replica 2 trades, +1.0R.
- **Calendar:** it carried the shadow setups' back-filled replay (−1,210R Jun–Oct). September read −379R; the main systems made −1.4R. Site now defaults to main systems (PR #299).
- **Replica dormant since 22 Apr:** the volatility gate is shut (max v/p80 since May = 0.95). Looser gates, 2023-24 | 2025-26 | since May 2026 (`ms/rep_gate.py`):

  | gate | 2023-24 | 2025-26 | since May 2026 |
  |---|---|---|---|
  | live (top fifth) | +109.6R dd −9.7 | +155.5R dd −16.5 | 0 trades |
  | v ≥ 0.9×p80 | +80.2R dd −29.2 | +165.9R dd −18.6 | +4.7R (5) |
  | v ≥ 0.8×p80 | −24.4R | +155.6R | +15.1R (23) |
  | v ≥ 0.7×p80 | +58.9R | +105.3R | −19.4R (95) |

  Calm gold has no replica edge. The gate stays.
- **Momentum-pullback scalp** (TEST since 6 Nov, shadow): 2023 +6.2, 2024 +18.3, 2025 +38.1, 2026 −6.3R (75 trades, red in 6 of the last 7 months). Stays in test; promotion needs it to recover.
- **2026 by leg:** replica +59.6R (Feb–Apr), daily engulf +12.9R, H4 trendline +3.5R, gold trend +4.7R. Jun–Oct is flat for every leg (gold trend +1.3, H4 trendline +4.0, daily engulf +4.1); the book waits for volatility.

## 2026-11-07 — Owner goal: "use all the skills to make the council the most profitable" — remaining skill rules tested
Owner's skill file (ALL_SKILLS_COMBINED: gold-msnr-playbook, Engulfing King, engulfing EG/EF, 411, Zlankator, Mosha S.CODE, MMXM). Windows 2023-24 | 2025-26.
- **Engulfing King 50% midline entry** on the daily engulf (`ms/eg_mid.py`):
  - live (zone top): +25.5 dd −9.8 | +47.0 dd −7.3;
  - at 25% of the zone: +10.1 | +12.7;
  - at 50%: −1.5 | +0.5;
  - split ½ top + ½ at 50%: +12.0 | +23.8;
  - top + full add at 50%: +24.0 dd −17.0 | +47.5 dd −16.0.
  
  Rejected: the run usually starts from the zone surface.
- **411 / Zlankator zone reuse** (second touch after the first trade closed, zone not closed through; `ms/eg_reuse.py`): 2× +30.2 | +36.3 (second touches alone +5.2 | −11.7), 3× +28.0 | +35.3, 2× within 30 days +32.7 | +43.1. Rejected (worse in 2025-26).
- **Mosha "70–80% off at the first barrier"** on the BO→VR→CF records (H4→H1→M15, `ms/mosha_exit.py`; sim vs sim, not vs the stored R3):
  - fixed 3R +9.1 | +16.7;
  - 75% at 1.5R then 3R: +5.0 | +14.7;
  - 75% at 2R then trail: +4.5 | +9.9;
  - fixed 2R: +3.9 | +11.7;
  - BE at 1.5R + 3R: +8.7 | +20.7 (near miss);
  - trails: worse.
  
  3R stays.
- **MMXM NY-midnight discount** for the long legs (`ms/mmxm_gold.py`): daily engulf fills below the 00:00 open +26.6 dd −11.9 | +40.8; H4 trendline below +2.2 | +11.4 (the profit is above the open). Rejected.
- **Sizing across the gold legs** (`ms/alloc.py`, % of account, worst drawdown in each half): the guide (replica, trendline and engulf at 0.25%, gold trend at 0.5%) gives +37.2% dd −2.3% | +60.1% dd −6.2%. No grid allocation (0.25–1% per leg) beats it in both halves. The bridges had gold trend at the shared gold risk (+34.0% | +54.0%, same drawdown); they now carry a separate 0.5% gold-trend risk (PR #300).
- Together with the earlier rounds (Mosha + Daily ER, Zlankator levels / CE / ECMTF, PITCHOU M15, MSNR scalps, engulf locations, two-target exits, session bands, news gates, vol sizing, slow-trend gate, day caps), every codable rule in the skill file has now been tested. The live stack is the best variant found.
