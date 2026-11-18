# Week of 2026-11-09

**Clean:** ETH, SOL, GBP/USD and USD/CHF are down on D1, H4 and H1; USD/CAD is up on all three.
**Messy:** Gold (D1 now down, H4 and H1 up), BTC and AUD/USD (D1 up, H4 and H1 down), EUR/USD (D1 down, H4 up) and XRP (H1 against D1 and H4). In those, trade with D1 only from its Origin, never against it.

_Snapshot 2026-11-09 05:40 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-18 19:27 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **newyork**.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead) | READY sell (blocked: wrong side) | 24 trades, 38% won, +0.05R a trade |
| BTC/USD | up (Kraken) | no (not live) | IN ORIGIN sell | 24 trades, 42% won, +0.80R a trade |
| ETH/USD | down (Kraken) | no (not live) | IN ORIGIN sell | 17 trades, 29% won, −0.28R a trade |
| SOL/USD | down (Kraken) | no (not live) | READY buy | 18 trades, 33% won, −0.09R a trade |
| XRP/USD | down (Kraken) | no (not live) | IN ORIGIN sell | 43 trades, 49% won, +0.44R a trade |
| EUR/USD | down (OANDA) | no (not live) | IN ORIGIN buy | 27 trades, 44% won, +0.44R a trade |
| GBP/USD | down (OANDA) | no (not live) | READY sell (blocked: wrong side) | 23 trades, 30% won, −0.09R a trade |
| AUD/USD | down (OANDA) | no (not live, rule skips AUD/USD) | READY sell (blocked: wrong side) | 34 trades, 38% won, +0.03R a trade |
| USD/CAD | up (OANDA) | no (not live) | READY buy (blocked: wrong side) | 15 trades, 40% won, +0.20R a trade |
| USD/CHF | up (OANDA) | no (not live) | IN ORIGIN buy | 15 trades, 53% won, +0.40R a trade |

Replay total on the markets it trades live: 182 trades, +0.28R a trade (+50.12R), after spread and overnight financing on gold buys. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-18 19:27 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| intraday · only a continuation BO as the confirming | 1 | 11-12 only a continuation BO as the confirming break |
| scalp · hold to the second target | 1 | 11-17 hold to the second target |

2 changes on 2 rules. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-18 19:27 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 7 signals (1 open, 6 closed, −4.50R, 0% won); 10 other signals tracked, not A-setups.
- open: RTY buy from 2721.5, stop 2694.2 (H1 iFVG reversal, A+)

**Dip-buy candidate (NQ/ES, paper only):** 5 signals in 7 days, 4 closed −4.00R · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 10122.52 · 0 open (checked 2026-11-18 19:27 UTC).

**Execution vs paper:** 14 demo fills; slippage against the council entry −0.01R on average (median +0.00R, worst +0.86R; positive = worse than paper), median 67638s from council fill to demo order.

Last mirror events:
- 11-14 16:13 SOLUSD position 47357955 closed at the broker
- 11-14 16:13 SOLUSD position 47357954 closed at the broker
- 11-12 13:47 XAUUSD position 48142419 closed at the broker
- 11-12 13:38 moved XAUUSD 48142419 protection: stop 3898.375 -> 3893.955, target 4735.365 -> 4730.945 (council geg)
- 11-12 13:35 moved XAUUSD 48142419 protection: stop 3895.545 -> 3898.375, target 4732.535 -> 4735.365 (council geg)
<!-- desk-status:end -->

<!-- coach-ledger:start -->
## Coach change ledger

Built by the Trader at 2026-11-18 19:27 UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (20 where they disagree, shrunk edge ≥ +0.05R a signal; else back to the old rule after 60 days). Owner rules and live setups are not Coach changes.

| Date | Change | Evidence | Before → after (the sample it used) | Trial | 30 days later |
|---|---|---|---|---|---|
| 2026-11-17 | scalp: hold to the second target (backtest) | 456 trades over the last 30 days: the second target +0.36R per trade versus the first (t = 2.7), +0.38R and +0 | 510 at +0.20R in the 30 days before | — | due 2026-12-17 |
| 2026-11-12 | intraday: only a continuation BO as the confirming break (backtest) | 226 trades over the last 30 days: a continuation BO as the confirming break +0.28R each, a CHoCH as the confir | 85 at +0.34R in the 30 days before | — | due 2026-12-12 |
| 2026-11-07 | intraday: "only against D1" dropped (backtest) | -0.46R each over 135, the excluded side -0.37R over 99: the filter no longer helps. | 48 at +0.25R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | m30m1: only with D1 (from history) | against: -0.62R over 8 trades, too costly to keep taking while with is tested. | 28 at +0.71R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | scalp: skip the overlap session (from history) | -0.61R over 10 trades there; +0.32R elsewhere. | 274 at +0.09R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | m30m1: dropped the D1 rule (from history) | The trades it blocked made +1.36R over 19. | 28 at +0.71R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | rintra: dropped the D1 rule (from history) | The trades it blocked made +1.33R over 10. | 32 at +0.28R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | scalp: trading the overlap session again (from history) | Blocked trades made +0.27R over 12. | 268 at +0.06R in the 30 days before | — | due 2026-12-07 |
| 2026-11-07 | Minimum stop 1 → 1.1 ATR (from history) | Win rate 17% over 36 trades: stops get hit by normal candle noise. | 531 at +0.10R in the 30 days before | — | due 2026-12-07 |
| 2026-11-06 | scalp: skip the overlap session (from history) | -1.00R over 9 trades there; +0.04R elsewhere. | 234 at −0.08R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | rscalp: skip the newyork session (from history) | -0.51R over 31 trades there; +0.02R elsewhere. | 140 at +0.11R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | m30m1: only with D1 (from history) | against: -0.62R over 8 trades, too costly to keep taking while with is tested. | 19 at −0.15R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | m30m1: dropped the D1 rule (from history) | The trades it blocked made +0.45R over 9. | 16 at −0.18R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | rscalp: trading the asia session again (from history) | Blocked trades made +0.26R over 11. | 128 at +0.08R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | rscalp: trading the overlap session again (from history) | Blocked trades made +0.77R over 14. | 128 at +0.08R in the 30 days before | — | due 2026-12-06 |
| 2026-11-06 | Minimum stop 0.9 → 1 ATR (from history) | Win rate 17% over 36 trades: stops get hit by normal candle noise. | 425 at −0.07R in the 30 days before | — | due 2026-12-06 |
| 2026-11-05 | Minimum stop 0.8 → 0.9 ATR (from history) | Win rate 17% over 36 trades: stops get hit by normal candle noise. | 329 at −0.04R in the 30 days before | — | due 2026-12-05 |
| 2026-11-04 | intraday: skip the asia session (from history) | -0.38R over 6 trades there; +1.74R elsewhere. | 24 at +0.60R in the 30 days before | — | due 2026-12-04 |
| 2026-11-04 | rscalp: skip the asia session (from history) | -0.57R over 9 trades there; +0.14R elsewhere. | 62 at +0.28R in the 30 days before | — | due 2026-12-04 |
| 2026-11-04 | News guard on (from history) | Reviews: 4 losses came from high-impact news; no short-term trades from 15 min before to 45 min after news. | 183 at −0.02R in the 30 days before | — | due 2026-12-04 |

No 30-day results yet.
<!-- coach-ledger:end -->

<!-- macro:start -->
## Macro strategist

Built by the Macro strategist at 2026-11-18 18:56 UTC for 2026-11-19 (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **transitional dollar · liquidity flat · VIX curve inverted (stress)**.

Gold Macro Score -1.00 → AUCTION (no macro edge) (real yield 4w z -1.19, DXY 4w z -0.86, 2Y 13w z -1.27, curve 13w z -0.69; 6-week path -0.58 → -0.13 → +0.13 → +0.05 → -0.96 → -1.00; week to 2026-11-20, not closed; gold below its 10-week average). Direction only, never a sell; paper reading.

| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |
|---|---|---|---|---|---|---|
| Gold | 52% | macro tilt down 2 pts | ±1.26% (20-day avg) | real yields down; real-yield 1-week momentum down; risk sentiment up | 53% / 54% (880 d) | 0.2489 vs 0.25 |
| EUR/USD | 48% | base rate, no macro tilt | ±0.31% (20-day avg) | real yields down; real-yield 1-week momentum down; fed expectations down | 50% / 52% (879 d) | 0.2506 vs 0.25 |
| USD/JPY | 58% | macro tilt up 1 pt | ±0.29% (20-day avg) | real yields up; us 10y yield trend up; real-yield 1-week momentum up | 56% / 56% (879 d) | 0.2469 vs 0.25 |
| NQ (Nasdaq 100) | 53% | macro tilt down 3 pts | ±1.69% (20-day avg) | real yields down; real-yield 1-week momentum down; credit stress down | 56% / 56% (879 d) | 0.2475 vs 0.25 |
| ES (S&P 500) | 50% | macro tilt down 4 pts | ±1.02% (20-day avg) | real yields down; credit stress down; vix term structure up | 54% / 54% (877 d) | 0.2483 vs 0.25 |

Next high-impact events:
- 2026-11-18 19:00 UTC USD FOMC Meeting Minutes: no consensus published: judge it against the previous print; hawkish → gold down, EUR/USD down, USD/JPY up, NQ down.
- 2026-11-19 00:30 UTC AUD Employment Change (cons. 25.5K, prev. -39.3K): hot if ≥ 25.5K, cool if ≤ 25.5K, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold mixed, EUR/USD mixed, USD/JPY mixed, NQ mixed.
- 2026-11-19 00:30 UTC AUD Unemployment Rate (cons. 4.7%, prev. 4.7%): hot if ≥ 4.8%, cool if ≤ 4.6%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold mixed, EUR/USD mixed, USD/JPY mixed, NQ mixed.

Lessons from the Macro veteran: no challenger has beaten its incumbent on the replay yet; v_ry4w hit 0.515 t 0.75 vs ry hit 0.519 t 1.02; v_d2_4w hit 0.523 t 1.06 vs dgs2 hit 0.539 t 2.19; v_dxy4w hit 0.498 t -0.12 vs dxymom hit 0.492 t -0.44.

Macro strategist, Wed 18 Nov 18:56 UTC, for Thu 19 Nov (UTC day, open to close). Regime: transitional dollar · liquidity flat · VIX curve inverted (stress). Gold: 52% up (base rate 53%; macro tilt down 2 pts). Drivers lean down: real yields, real-yield 1-week momentum; against: risk sentiment. Expected move ±1.26% (20-day average). EUR/USD: 48% up (base rate 48%; base rate, no macro tilt, the replay finds no edge in its drivers). Drivers lean down: real yields, real-yield 1-week momentum. Expected move ±0.31% (20-day average). USD/JPY: 58% up (base rate 56%; macro tilt up 1 pt). Drivers lean up: real yields, us 10y yield trend; against: credit stress. Expected move ±0.29% (20-day average). NQ (Nasdaq 100): 53% up (base rate 56%; macro tilt down 3 pts). Drivers lean down: real yields, real-yield 1-week momentum; against: vix term structure. Expected move ±1.69% (20-day average). ES (S&P 500): 50% up (base rate 54%; macro tilt down 4 pts). Drivers lean down: real yields, credit stress; against: vix term structure. Expected move ±1.02% (20-day average). DXY: 52% up (mirror of EUR/USD). Gold Macro Score -1.00 → AUCTION (no macro edge) (real yield 4w z -1.19, DXY 4w z -0.86, 2Y 13w z -1.27, curve 13w z -0.69; 6-week path -0.58 → -0.13 → +0.13 → +0.05 → -0.96 → -1.00; week to 2026-11-20, not closed; gold below its 10-week average). Direction only, never a sell; paper reading. Coming up: USD FOMC Meeting Minutes Wed 18 Nov 19:00 UTC: if hawkish, gold down, USD up, NQ down; gold usually moves ±1.26%; AUD Employment Change Thu 19 Nov 00:30 UTC (consensus 25.5K, previous -39.3K): if hot, gold mixed, USD mixed, NQ mixed; gold usually moves ±1.26%; AUD Unemployment Rate Thu 19 Nov 00:30 UTC (consensus 4.7%, previous 4.7%): if hot, gold mixed, USD mixed, NQ mixed; gold usually moves ±1.26%. Honesty check: on the 880-day walk-forward replay the gold calls hit 53% against a 54% base rate (Brier 0.2489 vs 0.25 for a coin flip, Pesaran-Timmermann 0.26): no proven edge (about the base rate). Treat the direction odds as context, not trade signals. Move size: all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days. CPI / NFP / FOMC days moved gold 0.981% on average against 0.866% on other days, but no model turned that into a better forecast.
<!-- macro:end -->

<!-- postmortems:start -->
## Loss post-mortems

Built by the Analyst (last post-mortem 2026-11-17 13:47 UTC) from the live paper losses of the last 7 days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.

**1 loss:** no clear tag 1. Small sample: read these as single cases, not a pattern.

| Closed (UTC) | Trade | Finding | Tags | MFE; after the stop | Timing | HTF against |
|---|---|---|---|---|---|---|
| 11-12 13:46 | XAU/USD Gold daily engulf buy | Ordinary loss | — | +0.39R; no target in 120 h | entry 9 min after Tokyo open; news: USD Initial Jobless Claims | none |
<!-- postmortems:end -->

<!-- what-changed:start -->
## What changed

Daily, for 2026-11-18 (UTC). Each setup's last 20 closed paper trades (live and shadow) against its whole record, in R after costs. The change is tested last 20 vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.

**Last 24 h:** 7 trades closed (0 live), −7.24R (live +0.00R).

| Setup | Trades (live) | All-time R a trade | Last 20 | 20 as of 24 h ago | Change | Confidence |
|---|---|---|---|---|---|---|
| Scalp (scalp) | 510 (15) | −0.01 (t -0.1) | −0.42 | −0.42 | **decaying** | low (t -1.3, 20 vs 490) |
| Retrace (rscalp) | 282 (6) | −0.35 (t -3.7) | −0.10 | −0.10 | steady (within noise) | none (t 0.8) |
| Intraday (intraday) | 101 (5) | +0.50 (t 2.9) | +1.33 | +1.33 | **improving** | fair (t 3.0, 20 vs 81) |
| Retrace (rintra) | 50 (5) | −0.10 (t -0.3) | −0.59 | −0.59 | **decaying** | low (t -1.4, 20 vs 30) |
| M30 (m30m1) | 25 (0) | −0.18 (t -0.4) | −0.10 | −0.10 | too few to compare | small sample (n 25) |
| Position (position) | 18 (1) | +1.44 (t 3.7) | +1.44 (only 18) | — | too few to compare | small sample (n 18) |
| Swing (swing) | 11 (1) | +0.51 (t 1.1) | +0.51 (only 11) | — | too few to compare | small sample (n 11) |
| Retrace (rswing) | 7 (0) | −0.06 (t -0.2) | −0.06 (only 7) | — | too few to compare | small sample (n 7) |
| Replica (replica) | 2 (2) | +0.47 (t 0.3) | +0.47 (only 2) | — | too few to compare | small sample (n 2) |
| Gold daily engulf (geg) | 2 (2) | −1.03 (t -34.3) | −1.03 (only 2) | — | too few to compare | small sample (n 2) |
| Gold momentum pullback (gmp) | 2 (0) | +0.58 (t 0.6) | +0.58 (only 2) | — | too few to compare | small sample (n 2) |
| Gold H4 trendline (gtl) | 1 (1) | −1.02 (t 0.0) | −1.02 (only 1) | — | too few to compare | small sample (n 1) |
| Mosha cycle (pullback) (mcycle) | 1 (0) | −1.02 (t 0.0) | −1.02 (only 1) | — | too few to compare | small sample (n 1) |

**Why:**
- **Intraday** (intraday) is improving: +1.33R a trade over the last 20 vs +0.29R before; won 80% of the last 20 (was 41%); biggest mover: with-D1 trades, 14 of the last 20 (was 47% of trades) at +1.27R a trade (was +0.23R a trade). Confidence fair (t 3.0). Whole record: positive and unlikely to be luck (n 101, t 2.9), on paper.
- **Retrace** (rintra) is decaying: −0.59R a trade over the last 20 vs +0.23R before; won 30% of the last 20 (was 43%); biggest mover: asia session, 3 of the last 20 (was 40% of trades) at −2.73R a trade (was +1.01R a trade). Confidence low (t -1.4). Whole record: no proven edge (n 50, t -0.3).
- **Scalp** (scalp) is decaying: −0.42R a trade over the last 20 vs +0.00R before; won 25% of the last 20 (was 33%); biggest mover: overlap session, 11 of the last 20 (was 21% of trades) at −0.84R a trade (was +0.12R a trade). Confidence low (t -1.3). Whole record: no proven edge (n 510, t -0.1).

**Edge check:** intraday +0.50R a trade (n 101, t 2.9): positive with t ≥ 2 on paper (after modelled costs); live fills can still differ.
<!-- what-changed:end -->

<!-- fidelity:start -->
## Replay fidelity

Checked 2026-11-18 11:59 UTC; live signals 2026-11-01 to 2026-11-18.

- **Same price feed** (the fair test): the replay found 65% of 750 live signals; on 416 closed pairs the result had the same sign 97% of the time (live +0.16R vs replay +0.10R a trade before costs).
- **All markets:** 52% of comparable live signals found (594 matched of 1143); outcome sign agrees 95% on 497 closed pairs.
- **Why live signals were missed:** data feed 217, feed differs 214, replay gap 74 (of 623).
- **Feeds (replay / live):** xau Kraken / live Kraken+OANDA · btc Kraken / live Kraken · eth Kraken / live Kraken · audusd Kraken / live Kraken+OANDA · usdchf Kraken / live Kraken+OANDA · gbpusd Kraken / live Kraken+OANDA · xrp Kraken / live Kraken · sol Kraken / live Kraken · eurusd Kraken / live Kraken+OANDA · usdcad Kraken / live Kraken+OANDA.
- **Live loop gaps (48 h):** 11-16 19:09 for 6.1 h, 11-17 06:23 for 7.2 h, 11-17 19:25 for 5 h, 11-18 01:05 for 4.2 h: no live signals were possible then.
<!-- fidelity:end -->

<!-- gold-systems:start -->
## Live gold systems now

Built by the Trader at 2026-11-18 19:27 UTC from its own snapshot and the live record. Status only: what each Meridian system is waiting for right now; the Book column says which trade live on paper and which are paper shadows; the Scalp block below describes a shadow system.

| System | Book | Now | On |
|---|---|---|---|
| Gold replica | shadow (paper, owner 11 Nov) | gate closed: 1.96% average daily range under the 2.47% gate, so no new replica trade | nothing on |
| Mosha BO | shadow (paper, owner 11 Nov) | H4 BO sell at 3852.58 (11-17 20:00 UTC); waiting for the H1 BO the other way (the retracement). Weekly structure agrees. | nothing on |
| Mosha cycle | shadow (paper, owner 11 Nov) | H4 moving down from 3852.58; waiting for the H1 ChoCh that starts the pullback. | nothing on |
| Gold trend | live | waiting for a daily close above the 20-day high 4148.71 (last close 3848.80) | nothing on |
| Gold trend fast | shadow | waiting for a daily close above the 5-day high 4067.10 (last close 3848.80) | paper only |
| Gold H4 trendline | shadow (paper, owner 11 Nov) | falling H4 line at 3851.96; waiting for an H4 close above it | nothing on |
| Gold daily engulf | live | daily close 3848.80 below the 20-day average 3994.70 | nothing on |
| Gold momentum pullback | shadow (paper, owner 11 Nov) | D1 down; no pullback zone watched · paper test | nothing on |
| NQ New York open run | shadow (paper, owner 11 Nov; research.json) | last session 2026-11-09: sell loss −1.05R; next at the 09:30 New York open | — |
<!-- gold-systems:end -->

<!-- veteran:start -->
## Macro veteran

Built by the Macro veteran at 2026-11-18 18:56 UTC from the strategist's data (paper only; full view in macro/veteran.json). Shock fingerprint: **Risk-off / de-risking, funding still calm** (medium confidence). Consensus: **AUCTION**.

| Topic | Macro strategist | Macro veteran | Stance |
|---|---|---|---|
| Direction for gold | Gold Macro Score −1.00 → AUCTION (no macro edge); next-day P(up) 52% | 7 of 8 channels observed; tally −3 → against gold | qualify |
| Real yields | 10Y TIPS 2.92%, rising (vote down); score z (4-week fall) −1.19 | 10Y TIPS 2.92%, +29 bp on the week, +18 bp over 4 weeks | agree |
| US dollar | +0.85 pts in 5 sessions (vote down); score z (4-week fall) −0.86 | DXY 103.64, +0.69% on the week, +1.91% over 4 weeks · broad USD +0.89% over 4 weeks | agree |
| Inflation and the next release | 2.21%, −1 bp a week (vote flat); playbook: FOMC Meeting Minutes 2026-11-18 19:00 UTC | 10Y breakeven 2.21%, −1 bp on the week. A red-folder event lands within 72 hours (FOMC Meeting Minutes): the view is conditional and the plan is to read real yields and the dollar after the print, not before. | agree |
| Positioning | 112k net, +5k in 4 weeks, 53th pct, week of 2026-11-10 (vote up) | COT managed money 112k net, +5k over 4 weeks, 53th percentile (positions as of 2026-11-10) | qualify |
| Regime | transitional dollar · liquidity flat · VIX curve inverted (stress) | Risk-off / de-risking, funding still calm (medium confidence) · clues: VIX/VIX3M 1.019, HY +13 bp on the week, SOFR−EFFR 4 bp, DXY +0.69% | agree |

Channels lean against gold and the score shows no edge: auction, and never a macro sell (shorts had no edge in any sub-period). A short needs a separate short-term reason at quarter size. Event within 72 hours (FOMC Meeting Minutes): the bias is conditional until the print.

Fails if: 10Y TIPS real yield above 3.07% (+15 bp from 2.92%) ends the real-rate support; DXY above 105.2 (+1.5%) says the dollar channel has turned; a weekly close below the 10-week average 4093 removes the trend tiebreaker.

Channels: Real-rate opportunity cost − · Inflation expectations 0 · US dollar − · Central-bank path 0 · Risk, safe haven and liquidity 0 · Investment flows and positioning 0 · Official reserves and physical demand n/a · Price confirmation −.

Forecast ledger: 2 issued, 0 resolved. 0 resolved: too few to judge calibration (20 weekly forecasts is the minimum the playbook asks for)

Scoreboard (who was right on gold's direction per topic, 20 trading days on): 0 resolved weeks, 2 pending.

Releases (expectation captured before, first print kept): Employment Change 2026-11-19 exp 25.2K, print pending · Unemployment Rate 2026-11-19 exp 4.7%, print pending · FOMC Meeting Minutes 2026-11-18 exp n/a, print pending · BOE Gov Bailey Speaks 2026-11-18 exp n/a, print pending · BOE Gov Bailey Speaks 2026-11-18 exp n/a, print pending · CPI y/y 2026-11-18 exp 3.6%, print pending · Core Retail Sales m/m 2026-11-17 exp 0.4%, print pending · Retail Sales m/m 2026-11-17 exp 0.2%, print pending.

Teaching: The strategist has adopted none of the veteran's challengers yet. v_ry4w hit 52%, t 0.75 vs ry hit 52%, t 1.02; v_d2_4w hit 52%, t 1.06 vs dgs2 hit 54%, t 2.19; v_dxy4w hit 50%, t -0.12 vs dxymom hit 49%, t -0.44. A challenger is adopted when it is proven on the replay (t ≥ 3, n ≥ 30) and beats its incumbent; it is handed back when it stops being proven.

**This week: no macro edge for gold, neutral (55% chance it is higher by 11 Dec, base 57%). USD FOMC Meeting Minutes (Wed 18 Nov, 19:00 UTC) is the event that matters most. Gold has traded below $3,833 (13-week low) since the 17 Nov close and is near $3,738. Watch $3,800 above (broken since the close) (levels as of the 17 Nov close).**

Calibration: Not enough scored calls yet: 13 of 30, over 1 of 4 weeks. Probabilities are used as computed until then.

Event playbook: USD FOMC Meeting Minutes 2026-11-18 19:00 UTC: consensus n/a (previous n/a); P(gold up on the day) 51% vs base 54%; past FOMC days n 34, gold up 50%, median /move/ 0.729%. Act after the release, not before (¼ starter). Descriptive, not a tested edge. · AUD Employment Change 2026-11-19 00:30 UTC: consensus 25.2K (previous -39.3K). Act after the release, not before (¼ starter). Descriptive, not a tested edge.

Since last week: Bias unchanged: neutral (55%); Gold $3,881 → $3,849 (−0.8%); New: USD FOMC Meeting Minutes on Wed, 18 Nov is the week's pivot; New: Stress gauges are lit (VIX 25, curve inverted), funding still calm; Dropped: Real yields flat 8 bp in 4 weeks (10Y TIPS 2.86%); Dropped: Policy path: the 2Y rose 9 bp in 4 weeks (4.86%); 200-day average $4,334 → $4,322 (−0.3%); 50-day average (= the 10-week average) $4,130 → $4,093 (−0.9%); 20-day average $4,013 → $3,980 (−0.8%); Last week's low $3,891 → $3,853 (−1.0%); 13-week low $3,853 → $3,833 (−0.5%).

### The veteran's briefing

1. **USD FOMC Meeting Minutes on Wed, 18 Nov is the week's pivot**: FOMC Meeting Minutes at 2026-11-18 19:00 UTC: consensus n/a, previous n/a (2026-11-15 05:57 UTC (captured before the release); economic calendar (Forex Factory feed via the strategist); veteran-expectations.json); typical gold day move 1.26% (naive: mean absolute move of the last 20 days) (2026-11-18; macro/forecast.json playbook); also this week: Employment Change, Unemployment Rate (2026-11-18; calendar). What would change the view: the print against the captured expectation and the reaction of real yields and the dollar in the first hours.
2. **Stress gauges are lit (VIX 25, curve inverted), funding still calm**: VIX 25.5, VIX/VIX3M 1.02 (inverted) (2026-11-17; Cboe via FRED VIXCLS / VXVCLS); HY OAS 3.43%, +13 bp on the week (2026-11-17; FRED BAMLH0A0HYM2 (ICE BofA)); SOFR − EFFR 4 bp (2026-11-17; NY Fed SOFR / EFFR via FRED). What would change the view: VIX/VIX3M back below 1 ends the stress read; SOFR − EFFR above 15 bp would make it a funding squeeze (gold sold for cash).
3. **The 20 closest past set-ups: gold higher 20 sessions on in 70% (all weeks 55%)**: 20-session median +2.40% (middle half −0.6% to +6.0%); 5-session median +0.87%, up 85% (2026-11-17; council daily candles + FRED weekly history, analogs since 2007-01-19). What would change the view: a week that moves the fingerprint (real yields, the dollar or gold's place in its range) changes the analog set.
4. **Gold below its 10-week average (−6.0%); Gold Macro Score −1.00 (AUCTION)**: gold 3848.80 vs 10-week average 4093; −30.2% from the 52-week closing high (2026-11-17; council daily gold candles (OANDA)); Gold Macro Score −1.00 → AUCTION (no macro edge) (2026-11-20; council/macroscore.mjs (tested 2007-26, 4-week horizon)). What would change the view: a weekly close above the 10-week average 4093, or the score crossing +0.25.
5. **Dollar firmer over 4 weeks (DXY 103.64, +1.79%)**: DXY 103.64, +1.79% over 4 weeks (z +1.0) (2026-11-17; ICE DXY formula on the council's OANDA daily FX closes). What would change the view: DXY through 102.09 (−1.5%) would turn the dollar channel.
6. **Speculators' gold length is middle of its range (33rd percentile of 3 years)**: managed money net 112k, +8.7k on the week, +5.3k over 4 weeks (+1.17 sd) (2026-11-10 (positions; published about 2026-11-13); CFTC Disaggregated COT). What would change the view: the next COT (Friday) moving net length into the top or bottom 20% of its 3-year range.

- H1 · 18%: If gold holds above $3,853 (last week's low), it closes at or above $4,000 (20-day average) by 2026-11-20 before any close below $3,853. Of 20 analogs, 12 (60%) made this move first within 5 sessions vs 51% of all 1022 weeks since 2007-01-19; the analogs favour this side, council tilt −1 pts applied. Invalidated by a daily close above $3,870 before the target; and watch: the print against the captured expectation and the reaction of real yields and the dollar in the first hours.
- H2 · 51%: Gold's daily closes stay between $3,853 (last week's low) and $4,149 (last week's high) every day through 2026-11-20. 5 of 20 analogs stayed inside the same distances for 5 sessions vs 32% of all weeks: a break of the range is the more likely path. Invalidated by any daily close outside $3,800-$3,900.
- H3 · 66%: DXY closes 2026-12-11 below 103.45 (the latest close). 12 of 20 analogs saw the DXY lower 20 sessions on vs 49% of all weeks. Gold usually moves the other way, except in stress (both bid). Invalidated by DXY above 105.20 (+1.5%) on a close.

_Near-inside information here means reading public data early and carefully: CFTC positioning, funding and stress gauges, central-bank wording and the release calendar, expectations captured before each release, real yields and the dollar. Nothing on this page is, or uses, non-public information._
<!-- veteran:end -->

## Top 3 to watch

1. **GBP/USD sell** — D1, H4 and H1 all down. Position D1 → H1 is READY: sell the pullback up to **1.33960**, stop 1.35046, first target 1.31808 (1.98R). Price 1.33796 is just under it: it has to come back up to 1.33960 first.
2. **USD/CAD buy** — up on all three timeframes. Position D1 → H1 is READY: buy the pullback down to **1.40146**, stop 1.39282, target 1.42998 (3.3R). Price 1.4103 is above: wait for the dip.
3. **SOL sell** — down on all three. Position D1 → H1 is READY: sell the pullback up to **88.10**, stop 91.64, target 81.01 (2.0R). Price 86.82: it needs a bounce of about 1.3 first.

Position and Swing are research (shadow) setups since the owner's 3 and 7 Nov changes; their zones still mark where the trend is likely to resume.

## Market by market

- **Gold (XAU/USD) 4,121.7** — D1 down, H4 and H1 up: messy. Intraday H1 → M5 READY buy at 4,081.2 (stop 4,053.9, target 4,146.9) is against D1. Live gold systems: replica gate closed (1.60% range under 2.47%), Gold trend needs a daily close above 4,199.08, Gold daily engulf has a resting buy at 3,971.36, Mosha BO waits for the H1 retracement with the weekly against it.
- **BTC 74,302.6** — D1 up, H4 and H1 down. Intraday H1 → M5 READY sell at 75,574.8 (stop 75,888.6, target 73,444.3, 6.8R) is a pullback against D1; Position D1 → H1 IN ORIGIN buy at 70,265.5 is the with-trend zone.
- **ETH 2,127.1** — down on all three. Intraday H1 → M5 READY sell at 2,220.0 (stop 2,235.2, target 2,071); D1 Origin sell zone around 2,308.6.
- **SOL 86.82** — down on all three. Position D1 → H1 READY sell at 88.10 (see Top 3).
- **XRP 1.0993** — D1 and H4 up, H1 down. Intraday and Scalp READY sells at 1.1461 / 1.1400 are against D1; D1 Origin buy zone at 1.0839.
- **EUR/USD 1.11598** — D1 down, H4 up, H1 down: messy. Position D1 → H1 READY sell at 1.12132 (stop 1.12454, target 1.11129, 3.1R).
- **GBP/USD 1.33796** — down on all three. Position D1 → H1 READY sell at 1.33960 (see Top 3).
- **AUD/USD 0.68924** — D1 up, H4 and H1 down. Nothing READY; D1 Origin buy zone at 0.70105, H4 Origin sell at 0.69895.
- **USD/CAD 1.4103** — up on all three. Position D1 → H1 READY buy at 1.40146 (see Top 3).
- **USD/CHF 0.82** — down on all three. Swing H4 → H1 READY sell at 0.81492 (stop 0.82183, target 0.81010, 2.0R); D1 Origin sell zone at 0.82483.

## Last week (2–8 Nov, closed trades)

- **Live paper book:** 33 trades, 6 won (18%), **−12.4R**. Most of the loss came from engine setups that were still live early in the week: BTC Retrace −5.0R (5), gold Scalp −5.0R (5), XRP and SOL Scalp −2.0R each. The main gold system that traded, the replica, made +1.0R over 2.
- **Shadow book:** 514 trades, 179 won (35%), +84.3R, led by XRP Scalp +36.2R, BTC Scalp +26.7R and gold Retrace +22.9R; SOL Scalp −12.9R and USD/CAD Scalp −10.1R were the worst.
- **Coach:** raised the minimum stop five times, 0.6 → 1.1 ATR (win rate 17% on tight stops); flipped Scalp, rscalp, rintra and m30m1 session / D1 rules back and forth (see the churn table above); dropped intraday's "only against D1" on 7 Nov.
- **Owner:** new gold systems through the week (trend, H4 trendline, daily engulf, momentum pullback, trend fast); on 7 Nov Scalp, Swing, crypto trend and gold trend fast went to shadow; on 8 Nov LIT started as a gold shadow stream.

## News to respect

- **No US jobs report this week:** NFP came out on Fri 6 Nov; the next is Fri 4 Dec (08:30 New York).
- **Wed 11 Nov, Veterans Day:** US bond market holiday; thin dollar liquidity possible.
- US CPI and other releases: check the page's **News** tab for the exact days and times; the news guard is on.
