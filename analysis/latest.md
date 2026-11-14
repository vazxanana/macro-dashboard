# Week of 2026-11-09

**Clean:** ETH, SOL, GBP/USD and USD/CHF are down on D1, H4 and H1; USD/CAD is up on all three.
**Messy:** Gold (D1 now down, H4 and H1 up), BTC and AUD/USD (D1 up, H4 and H1 down), EUR/USD (D1 down, H4 up) and XRP (H1 against D1 and H4). In those, trade with D1 only from its Origin, never against it.

_Snapshot 2026-11-09 05:40 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-14 18:55 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **newyork**.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead) | WAIT RETRACE sell | 26 trades, 35% won, +0.04R a trade |
| BTC/USD | up (Kraken) | no (not live) | IN ORIGIN sell | 26 trades, 35% won, +0.41R a trade |
| ETH/USD | down (Kraken) | no (not live) | READY sell (blocked: wrong side) | 14 trades, 29% won, −0.28R a trade |
| SOL/USD | down (Kraken) | no (not live) | IN ORIGIN sell | 20 trades, 15% won, −0.64R a trade |
| XRP/USD | down (Kraken) | no (not live) | READY sell (blocked: wrong side) | 45 trades, 47% won, +0.46R a trade |
| EUR/USD | down (OANDA) | no (not live) | READY sell (blocked: wrong side) | 27 trades, 19% won, −0.58R a trade |
| GBP/USD | down (OANDA) | no (not live) | IN ORIGIN sell | 38 trades, 26% won, −0.39R a trade |
| AUD/USD | down (OANDA) | no (not live, rule skips AUD/USD) | IN ORIGIN sell | 24 trades, 38% won, −0.01R a trade |
| USD/CAD | up (OANDA) | no (not live) | READY buy (blocked: wrong side) | 23 trades, 57% won, +0.52R a trade |
| USD/CHF | up (OANDA) | no (not live) | IN ORIGIN buy | 36 trades, 44% won, +0.40R a trade |

Replay total on the markets it trades live: 229 trades, +0.05R a trade (+10.76R), after spread and overnight financing on gold buys. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-14 18:55 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| intraday · D1 rule | 1 | 11-07 "only against D1" dropped |
| intraday · only a continuation BO as the confirming | 1 | 11-12 only a continuation BO as the confirming break |

2 changes on 2 rules. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-14 18:55 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 5 signals (0 open, 5 closed, +0.52R, 20% won); 11 other signals tracked, not A-setups.

**Dip-buy candidate (NQ/ES, paper only):** 5 signals in 7 days, 4 closed +2.31R · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 10122.52 · 0 open (checked 2026-11-14 18:54 UTC).

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

Built by the Trader at 2026-11-14 18:55 UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (20 where they disagree, shrunk edge ≥ +0.05R a signal; else back to the old rule after 60 days). Owner rules and live setups are not Coach changes.

| Date | Change | Evidence | Before → after (the sample it used) | Trial | 30 days later |
|---|---|---|---|---|---|
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
| 2026-11-04 | rscalp: trading the asia session again (from history) | Blocked trades made +0.29R over 5. | 55 at +0.31R in the 30 days before | — | due 2026-12-04 |

No 30-day results yet.
<!-- coach-ledger:end -->

<!-- macro:start -->
## Macro strategist

Built by the Macro strategist at 2026-11-14 18:47 UTC for 2026-11-16 (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **Dollar Smile right side (US outperformance) · liquidity flat · normal volatility**.

Gold Macro Score -0.92 → AUCTION (no macro edge) (real yield 4w z -0.55, DXY 4w z -0.76, 2Y 13w z -1.49, curve 13w z -0.89; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.05 → -0.92; week to 2026-11-13; gold below its 10-week average). Direction only, never a sell; paper reading.

| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |
|---|---|---|---|---|---|---|
| Gold | 50% | macro tilt down 4 pts | ±1.28% (20-day avg) | real yields down; real-yield 1-week momentum down; fed expectations down | 53% / 54% (880 d) | 0.249 vs 0.25 |
| EUR/USD | 49% | base rate, no macro tilt | ±0.3% (20-day avg) | real yields down; real-yield 1-week momentum down; fed expectations down | 51% / 52% (879 d) | 0.2509 vs 0.25 |
| USD/JPY | 59% | macro tilt up 3 pts | ±0.31% (20-day avg) | real yields up; us 10y yield trend up; real-yield 1-week momentum up | 57% / 57% (879 d) | 0.2463 vs 0.25 |
| NQ (Nasdaq 100) | 53% | macro tilt down 3 pts | ±1.55% (20-day avg) | real yields down; real-yield 1-week momentum down; credit stress up | 56% / 56% (879 d) | 0.2473 vs 0.25 |
| ES (S&P 500) | 51% | macro tilt down 3 pts | ±0.91% (20-day avg) | real yields down; credit stress up; own price trend down | 54% / 54% (877 d) | 0.2482 vs 0.25 |

Lessons from the Macro veteran: no challenger has beaten its incumbent on the replay yet; v_ry4w hit 0.513 t 0.67 vs ry hit 0.517 t 0.95; v_d2_4w hit 0.523 t 1.06 vs dgs2 hit 0.537 t 2.12; v_dxy4w hit 0.497 t -0.16 vs dxymom hit 0.491 t -0.51.

Macro strategist, Sat 14 Nov 18:47 UTC, for Mon 16 Nov (UTC day, open to close). Regime: Dollar Smile right side (US outperformance) · liquidity flat · normal volatility. Gold: 50% up (base rate 53%; macro tilt down 4 pts). Drivers lean down: real yields, real-yield 1-week momentum. Expected move ±1.28% (20-day average). EUR/USD: 49% up (base rate 49%; base rate, no macro tilt, the replay finds no edge in its drivers). Drivers lean down: real yields, real-yield 1-week momentum; against: credit stress. Expected move ±0.3% (20-day average). USD/JPY: 59% up (base rate 56%; macro tilt up 3 pts). Drivers lean up: real yields, us 10y yield trend. Expected move ±0.31% (20-day average). NQ (Nasdaq 100): 53% up (base rate 56%; macro tilt down 3 pts). Drivers lean down: real yields, real-yield 1-week momentum; against: credit stress. Expected move ±1.55% (20-day average). ES (S&P 500): 51% up (base rate 54%; macro tilt down 3 pts). Drivers lean down: real yields, own price trend; against: credit stress. Expected move ±0.91% (20-day average). DXY: 51% up (mirror of EUR/USD). Gold Macro Score -0.92 → AUCTION (no macro edge) (real yield 4w z -0.55, DXY 4w z -0.76, 2Y 13w z -1.49, curve 13w z -0.89; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.05 → -0.92; week to 2026-11-13; gold below its 10-week average). Direction only, never a sell; paper reading. No high-impact events in the next 5 days on the calendar we could read (next week's calendar is not published yet; it usually appears over the weekend). Honesty check: on the 880-day walk-forward replay the gold calls hit 53% against a 54% base rate (Brier 0.249 vs 0.25 for a coin flip, Pesaran-Timmermann 0.63): no proven edge (about the base rate). Treat the direction odds as context, not trade signals. Move size: all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days. CPI / NFP / FOMC days moved gold 0.985% on average against 0.865% on other days, but no model turned that into a better forecast.
<!-- macro:end -->

<!-- postmortems:start -->
## Loss post-mortems

Built by the Analyst (last post-mortem 2026-11-12 13:34 UTC) from the live paper losses of the last 7 days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.

**1 loss:** news 1. Small sample: read these as single cases, not a pattern.

| Closed (UTC) | Trade | Finding | Tags | MFE; after the stop | Timing | HTF against |
|---|---|---|---|---|---|---|
| 11-10 13:30 | XAU/USD Gold H4 trendline buy | News during the trade | news | +0.13R; no target in 48 h | stop 30 min after New York open; news: USD CPI | none |
<!-- postmortems:end -->

<!-- what-changed:start -->
## What changed

Daily, for 2026-11-14 (UTC). Each setup's last 20 closed paper trades (live and shadow) against its whole record, in R after costs. The change is tested last 20 vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.

**Last 24 h:** 17 trades closed (0 live), +18.56R (live +0.00R).

| Setup | Trades (live) | All-time R a trade | Last 20 | 20 as of 24 h ago | Change | Confidence |
|---|---|---|---|---|---|---|
| Scalp (scalp) | 510 (15) | −0.01 (t -0.1) | −0.42 | −0.48 | **decaying** | low (t -1.3, 20 vs 490) |
| Retrace (rscalp) | 282 (6) | −0.35 (t -3.7) | −0.10 | −0.34 | steady (within noise) | none (t 0.8) |
| Intraday (intraday) | 96 (5) | +0.42 (t 2.4) | +0.70 | +0.58 | steady (within noise) | none (t 0.9) |
| Retrace (rintra) | 50 (5) | −0.10 (t -0.3) | −0.59 | −0.59 | **decaying** | low (t -1.4, 20 vs 30) |
| M30 (m30m1) | 16 (0) | +0.31 (t 0.5) | +0.31 (only 16) | — | too few to compare | small sample (n 16) |
| Swing (swing) | 7 (1) | +0.54 (t 0.9) | +0.54 (only 7) | — | too few to compare | small sample (n 7) |
| Position (position) | 7 (1) | −0.05 (t -0.1) | −0.05 (only 7) | — | too few to compare | small sample (n 7) |
| Retrace (rswing) | 5 (0) | +0.09 (t 0.3) | +0.09 (only 5) | — | too few to compare | small sample (n 5) |
| Replica (replica) | 2 (2) | +0.47 (t 0.3) | +0.47 (only 2) | — | too few to compare | small sample (n 2) |
| Gold daily engulf (geg) | 2 (2) | −1.03 (t -34.3) | −1.03 (only 2) | — | too few to compare | small sample (n 2) |
| Gold momentum pullback (gmp) | 2 (0) | +0.58 (t 0.6) | +0.58 (only 2) | — | too few to compare | small sample (n 2) |
| Gold H4 trendline (gtl) | 1 (1) | −1.02 (t 0.0) | −1.02 (only 1) | — | too few to compare | small sample (n 1) |

**Why:**
- **Retrace** (rintra) is decaying: −0.59R a trade over the last 20 vs +0.23R before; won 30% of the last 20 (was 43%); biggest mover: asia session, 3 of the last 20 (was 40% of trades) at −2.73R a trade (was +1.01R a trade). Confidence low (t -1.4). Whole record: no proven edge (n 50, t -0.3).
- **Scalp** (scalp) is decaying: −0.42R a trade over the last 20 vs +0.00R before; won 25% of the last 20 (was 33%); biggest mover: overlap session, 11 of the last 20 (was 21% of trades) at −0.84R a trade (was +0.12R a trade). Confidence low (t -1.3). Whole record: no proven edge (n 510, t -0.1).

**Edge check:** intraday +0.42R a trade (n 96, t 2.4): positive with t ≥ 2 on paper (after modelled costs); live fills can still differ.
<!-- what-changed:end -->

<!-- fidelity:start -->
## Replay fidelity

Checked 2026-11-14 10:43 UTC; live signals 2026-11-01 to 2026-11-14.

- **Same price feed** (the fair test): the replay found 72% of 696 live signals; on 417 closed pairs the result had the same sign 99% of the time (live +0.10R vs replay +0.08R a trade before costs).
- **All markets:** 53% of comparable live signals found (603 matched of 1130); outcome sign agrees 97% on 498 closed pairs.
- **Why live signals were missed:** feed differs 259, data feed 148, replay gap 55 (of 582).
- **Feeds (replay / live):** xau OANDA / live Kraken+OANDA · btc Kraken / live Kraken · eth Kraken / live Kraken · audusd OANDA / live Kraken+OANDA · usdchf OANDA / live Kraken+OANDA · gbpusd OANDA / live Kraken+OANDA · xrp Kraken / live Kraken · sol Kraken / live Kraken · eurusd OANDA / live Kraken+OANDA · usdcad OANDA / live Kraken+OANDA.
- **Live loop gaps (48 h):** 11-12 23:37 for 3.1 h, 11-13 02:42 for 8 h, 11-13 12:00 for 11 h: no live signals were possible then.
<!-- fidelity:end -->

<!-- gold-systems:start -->
## Live gold systems now

Built by the Trader at 2026-11-14 18:55 UTC from its own snapshot and the live record. Status only: what each Meridian system is waiting for right now; the Book column says which trade live on paper and which are paper shadows; the Scalp block below describes a shadow system.

| System | Book | Now | On |
|---|---|---|---|
| Gold replica | shadow (paper, owner 11 Nov) | gate closed: 1.96% average daily range under the 2.47% gate, so no new replica trade | nothing on |
| Mosha BO | shadow (paper, owner 11 Nov) | H4 BO sell at 3870.32 (11-12 16:00 UTC); waiting for the H1 BO the other way (the retracement). Weekly structure agrees. | nothing on |
| Mosha cycle | shadow (paper, owner 11 Nov) | H4 moving down from 3870.32; waiting for the H1 ChoCh that starts the pullback. | nothing on |
| Gold trend | live | waiting for a daily close above the 20-day high 4155.57 (last close 3880.76) | nothing on |
| Gold trend fast | shadow | waiting for a daily close above the 5-day high 4148.71 (last close 3880.76) | paper only |
| Gold H4 trendline | shadow (paper, owner 11 Nov) | falling H4 line at 3914.08; waiting for an H4 close above it | nothing on |
| Gold daily engulf | live | daily close 3884.68 below the 20-day average 4021.44 | nothing on |
| Gold momentum pullback | shadow (paper, owner 11 Nov) | D1 down; no pullback zone watched · paper test | nothing on |
| NQ New York open run | shadow (paper, owner 11 Nov; research.json) | last session 2026-11-09: sell loss −1.05R; next at the 09:30 New York open | — |
<!-- gold-systems:end -->

<!-- veteran:start -->
## Macro veteran

Built by the Macro veteran at 2026-11-14 18:47 UTC from the strategist's data (paper only; full view in macro/veteran.json). Shock fingerprint: **Positive growth / demand news** (low confidence). Consensus: **AUCTION**.

| Topic | Macro strategist | Macro veteran | Stance |
|---|---|---|---|
| Direction for gold | Gold Macro Score −0.92 → AUCTION (no macro edge); next-day P(up) 50% | 7 of 8 channels observed; tally −2 → against gold | qualify |
| Real yields | 10Y TIPS 2.86%, rising (vote down); score z (4-week fall) −0.55 | 10Y TIPS 2.86%, +22 bp on the week, +2 bp over 4 weeks | qualify |
| US dollar | +1.09 pts in 5 sessions (vote down); score z (4-week fall) −0.76 | DXY 103.45, +1.14% on the week, +1.70% over 4 weeks · broad USD +0.36% over 4 weeks | agree |
| Inflation and the next release | 2.24%, +0 bp a week (vote flat) | 10Y breakeven 2.24%, 0 bp on the week. No red-folder event within 72 hours. | agree |
| Positioning | 104k net, −7k in 4 weeks, 34th pct, week of 2026-11-03 (vote down) | COT managed money 104k net, −7k over 4 weeks, 34th percentile (positions as of 2026-11-03) | qualify |
| Regime | Dollar Smile right side (US outperformance) · liquidity flat · normal volatility | Positive growth / demand news (low confidence) · clues: 10Y real +22 bp, HY −12 bp, VIX −9.5 on the week | agree |

Channels lean against gold and the score shows no edge: auction, and never a macro sell (shorts had no edge in any sub-period). A short needs a separate short-term reason at quarter size.

Fails if: 10Y TIPS real yield above 3.01% (+15 bp from 2.86%) ends the real-rate support; DXY above 105.0 (+1.5%) says the dollar channel has turned; a weekly close below the 10-week average 4123 removes the trend tiebreaker.

Channels: Real-rate opportunity cost 0 · Inflation expectations 0 · US dollar − · Central-bank path 0 · Risk, safe haven and liquidity 0 · Investment flows and positioning 0 · Official reserves and physical demand n/a · Price confirmation −.

Forecast ledger: 2 issued, 0 resolved. 0 resolved: too few to judge calibration (20 weekly forecasts is the minimum the playbook asks for)

Scoreboard (who was right on gold's direction per topic, 20 trading days on): 0 resolved weeks, 2 pending.

Releases (expectation captured before, first print kept): Core PPI m/m 2026-11-13 exp 0.3%, print pending · PPI m/m 2026-11-13 exp 0.4%, print pending · GDP m/m 2026-11-12 exp 0.0%, print pending · Core CPI m/m 2026-11-10 exp 0.2%, print pending, 10Y TIPS 12 bp · CPI m/m 2026-11-10 exp 0.3%, print pending, 10Y TIPS 12 bp.

Teaching: The strategist has adopted none of the veteran's challengers yet. v_ry4w hit 51%, t 0.67 vs ry hit 52%, t 0.95; v_d2_4w hit 52%, t 1.06 vs dgs2 hit 54%, t 2.12; v_dxy4w hit 50%, t -0.16 vs dxymom hit 49%, t -0.51. A challenger is adopted when it is proven on the replay (t ≥ 3, n ≥ 30) and beats its incumbent; it is handed back when it stops being proven.

**This week: the macro leans against gold (53% chance it is higher by 11 Dec, base 57%). No major release is scheduled this week. Watch $4,000 above and $3,853 below (levels as of the 13 Nov close).**

Calibration: Not enough scored calls yet: 1 of 30, over 1 of 4 weeks. Probabilities are used as computed until then.

Since last week: Bias neutral → against (57% → 53% chance gold is higher in 20 sessions); Gold $3,881 → $3,885 (+0.1%); 50-day average (= the 10-week average) $4,130 → $4,123 (−0.2%); 20-day average $4,013 → $4,000 (−0.3%); Last week's low $3,891 → $3,853 (−1.0%).

### The veteran's briefing

1. **The 20 closest past set-ups: gold higher 20 sessions on in 70% (all weeks 55%)**: 20-session median +1.86% (middle half −0.4% to +6.0%); 5-session median +1.32%, up 85% (2026-11-13; council daily candles + FRED weekly history, analogs since 2007-01-19). What would change the view: a week that moves the fingerprint (real yields, the dollar or gold's place in its range) changes the analog set.
2. **Gold below its 10-week average (−5.8%); Gold Macro Score −0.92 (AUCTION)**: gold 3884.68 vs 10-week average 4123; −29.5% from the 52-week closing high (2026-11-13; council daily gold candles (OANDA)); Gold Macro Score −0.92 → AUCTION (no macro edge) (2026-11-13; council/macroscore.mjs (tested 2007-26, 4-week horizon)). What would change the view: a weekly close above the 10-week average 4123, or the score crossing +0.25.
3. **Dollar firmer over 4 weeks (DXY 103.45, +1.62%)**: DXY 103.45, +1.62% over 4 weeks (z +0.8) (2026-11-13; ICE DXY formula on the council's OANDA daily FX closes). What would change the view: DXY through 101.90 (−1.5%) would turn the dollar channel.
4. **Speculators' gold length is middle of its range (22nd percentile of 3 years)**: managed money net 104k, −1.9k on the week, −7.4k over 4 weeks (−0.26 sd) (2026-11-03 (positions; published about 2026-11-06); CFTC Disaggregated COT). What would change the view: the next COT (Friday) moving net length into the top or bottom 20% of its 3-year range.
5. **Real yields flat 8 bp in 4 weeks (10Y TIPS 2.86%)**: 10Y TIPS 2.86%, +8 bp over 4 weeks (z +0.6 vs every week since 2007-01-19) (2026-11-12; FRED DFII10 (US Treasury real par curve)). What would change the view: 10Y TIPS back above 3.01% (+15 bp).
6. **Policy path: the 2Y rose 9 bp in 4 weeks (4.86%)**: 2Y Treasury 4.86%, +9 bp over 4 weeks (2026-11-12; FRED DGS2 (US Treasury par curve)). What would change the view: the 2Y down 15 bp.

- H1 · 18%: If gold holds above $3,853 (last week's low), it closes at or above $4,000 (20-day average) by 2026-11-20 before any close below $3,853. Of 20 analogs, 5 (25%) made this move first within 5 sessions vs 11% of all 1022 weeks since 2007-01-19; the analogs favour this side, council tilt −2 pts applied. Invalidated by a daily close below $3,853 before the target; and watch: a week that moves the fingerprint (real yields, the dollar or gold's place in its range) changes the analog set.
- H2 · 51%: Gold's daily closes stay between $3,853 (last week's low) and $4,149 (last week's high) every day through 2026-11-20. 10 of 20 analogs stayed inside the same distances for 5 sessions vs 53% of all weeks: a contained week is the more likely path. Invalidated by any daily close outside $3,853-$4,149.
- H3 · 66%: DXY closes 2026-12-11 below 103.45 (the latest close). 15 of 20 analogs saw the DXY lower 20 sessions on vs 49% of all weeks. Gold usually moves the other way, except in stress (both bid). Invalidated by DXY above 105.00 (+1.5%) on a close.

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
