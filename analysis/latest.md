# Week of 2026-11-09

**Clean:** ETH, SOL, GBP/USD and USD/CHF are down on D1, H4 and H1; USD/CAD is up on all three.
**Messy:** Gold (D1 now down, H4 and H1 up), BTC and AUD/USD (D1 up, H4 and H1 down), EUR/USD (D1 down, H4 up) and XRP (H1 against D1 and H4). In those, trade with D1 only from its Origin, never against it.

_Snapshot 2026-11-09 05:40 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-11 17:41 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **newyork**.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead) | IN ORIGIN sell | 30 trades, 33% won, −0.06R a trade |
| BTC/USD | up (Kraken) | no (not live) | IN ORIGIN sell | 25 trades, 32% won, +0.39R a trade |
| ETH/USD | down (Kraken) | no (not live) | IN ORIGIN sell | 16 trades, 25% won, −0.40R a trade |
| SOL/USD | down (Kraken) | no (not live) | IN ORIGIN buy | 21 trades, 24% won, +0.00R a trade |
| XRP/USD | up (Kraken) | no (not live) | IN ORIGIN sell | 44 trades, 50% won, +0.51R a trade |
| EUR/USD | down (OANDA) | no (not live) | WAIT RETRACE sell | 33 trades, 27% won, −0.32R a trade |
| GBP/USD | down (OANDA) | no (not live) | READY sell (blocked: wrong side) | 42 trades, 26% won, −0.38R a trade |
| AUD/USD | up (OANDA) | no (not live, rule skips AUD/USD) | READY buy (blocked: wrong side) | 33 trades, 33% won, −0.13R a trade |
| USD/CAD | up (OANDA) | no (not live) | READY buy (blocked: wrong side) | 27 trades, 44% won, +0.18R a trade |
| USD/CHF | up (OANDA) | no (not live) | IN ORIGIN buy | 31 trades, 19% won, −0.44R a trade |

Replay total on the markets it trades live: 239 trades, −0.04R a trade (−9.22R), after spread. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-11 17:41 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| m30m1 · D1 rule **(back and forth)** | 4 | 11-06 dropped the D1 rule → 11-06 only with D1 → 11-07 dropped the D1 rule → 11-07 only with D1 |
| Minimum stop **(up every time)** | 3 | 0.8 → 0.9 → 1 → 1.1 (11-05 to 11-07) |
| scalp · overlap session **(back and forth)** | 3 | 11-06 skip the overlap session → 11-07 trading the overlap session again → 11-07 skip the overlap session |
| intraday · D1 rule | 1 | 11-07 "only against D1" dropped |
| rintra · D1 rule | 1 | 11-07 dropped the D1 rule |
| rscalp · asia session | 1 | 11-06 trading the asia session again |
| rscalp · newyork session | 1 | 11-06 skip the newyork session |
| rscalp · overlap session | 1 | 11-06 trading the overlap session again |

15 changes on 8 rules; 2 rules went back and forth 3+ times; 1 setting only ever moved one way. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-11 17:41 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 3 signals (1 open, 2 closed, +1.17R, 50% won); 5 other signals tracked, not A-setups.
- open: YM buy from 52440, stop 52139 (H1 iFVG reversal)

**Dip-buy candidate (NQ/ES, paper only):** 3 signals in 7 days, 2 closed +0.45R · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 9880.24 · 2 open · 1 resting (checked 2026-11-11 17:41 UTC).
- open: SOLUSD sell position (sol-position-1793893928) · fill 89.121 vs council 89.77 (+0.08R slippage)
- open: SOLUSD sell position (sol-position-1793899009) · fill 89.121 vs council 89.77 (+0.08R slippage)

**Execution vs paper:** 13 demo fills; slippage against the council entry −0.01R on average (median +0.01R, worst +0.86R; positive = worse than paper), median 46368s from council fill to demo order.

Last mirror events:
- 11-10 16:12 placed buy limit XAUUSD 0.01 lot at 3971.36 (council geg, valid to 2026-11-26T09:15Z)
- 11-10 16:12 cancelled XAUUSD limit order 33884791 for xau-geg-1793664000: the council re-quoted the order (entry 3983.29 -> 3971.36)
- 11-10 16:08 placed buy limit XAUUSD 0.01 lot at 3983.29 (council geg, valid to 2026-11-26T09:15Z)
- 11-10 16:08 cancelled XAUUSD limit order 33872885 for xau-geg-1793664000: the council re-quoted the order (entry 3971.36 -> 3983.29)
- 11-10 15:39 BTCUSD position 47357957 closed at the broker
<!-- desk-status:end -->

<!-- coach-ledger:start -->
## Coach change ledger

Built by the Trader at 2026-11-11 17:41 UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (20 where they disagree, shrunk edge ≥ +0.05R a signal; else back to the old rule after 60 days). Owner rules and live setups are not Coach changes.

| Date | Change | Evidence | Before → after (the sample it used) | Trial | 30 days later |
|---|---|---|---|---|---|
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
| 2026-11-04 | Minimum stop 0.7 → 0.8 ATR (from history) | Win rate 10% over 29 trades: stops get hit by normal candle noise. | 183 at −0.02R in the 30 days before | — | due 2026-12-04 |

No 30-day results yet.
<!-- coach-ledger:end -->

<!-- macro:start -->
## Macro strategist

Built by the Macro strategist at 2026-11-11 17:20 UTC for 2026-11-12 (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **Dollar Smile right side (US outperformance) · dollar liquidity draining · normal volatility**.

Gold Macro Score -0.33 → AUCTION (no macro edge) (real yield 4w z +0.37, DXY 4w z -0.20, 2Y 13w z -0.85, curve 13w z -0.63; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.05 → -0.33; week to 2026-11-13, not closed; gold below its 10-week average). Direction only, never a sell; paper reading.

| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |
|---|---|---|---|---|---|---|
| Gold | 50% | macro tilt down 3 pts | ±1.19% (20-day avg) | real yields down; real-yield 1-week momentum down; inflation expectations down | 52% / 54% (880 d) | 0.249 vs 0.25 |
| EUR/USD | 49% | base rate, no macro tilt | ±0.26% (20-day avg) | real yields down; real-yield 1-week momentum down; fed expectations up | 50% / 52% (879 d) | 0.251 vs 0.25 |
| USD/JPY | 58% | macro tilt up 2 pts | ±0.29% (20-day avg) | real yields up; real-yield 1-week momentum up; fed expectations down | 57% / 57% (879 d) | 0.2464 vs 0.25 |
| NQ (Nasdaq 100) | 54% | macro tilt down 2 pts | ±1.59% (20-day avg) | real yields down; real-yield 1-week momentum down; credit stress up | 56% / 56% (879 d) | 0.2476 vs 0.25 |
| ES (S&P 500) | 54% | base rate, no macro tilt | ±0.94% (20-day avg) | real yields down; credit stress up; own price trend up | 54% / 54% (877 d) | 0.2483 vs 0.25 |

Next high-impact events:
- 2026-11-12 07:00 UTC GBP GDP m/m (cons. 0.0%, prev. 0.1%): hot if ≥ 0.1%, cool if ≤ -0.1%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold mixed, EUR/USD mixed, USD/JPY mixed, NQ mixed.
- 2026-11-13 13:30 UTC USD Core PPI m/m (cons. 0.3%, prev. 0.7%): hot if ≥ 0.4%, cool if ≤ 0.2%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.
- 2026-11-13 13:30 UTC USD PPI m/m (cons. 0.4%, prev. 1.3%): hot if ≥ 0.5%, cool if ≤ 0.3%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.

Lessons from the Macro veteran: no challenger has beaten its incumbent on the replay yet; v_ry4w hit 0.513 t 0.67 vs ry hit 0.517 t 0.95; v_d2_4w hit 0.524 t 1.1 vs dgs2 hit 0.539 t 2.19; v_dxy4w hit 0.498 t -0.08 vs dxymom hit 0.489 t -0.62.

Macro strategist, Wed 11 Nov 17:20 UTC, for Thu 12 Nov (UTC day, open to close). Regime: Dollar Smile right side (US outperformance) · dollar liquidity draining · normal volatility. Gold: 50% up (base rate 54%; macro tilt down 3 pts). Drivers lean down: real yields, real-yield 1-week momentum; against: fed expectations. Expected move ±1.19% (20-day average). EUR/USD: 49% up (base rate 49%; base rate, no macro tilt, the replay finds no edge in its drivers). Drivers lean down: real yields, real-yield 1-week momentum; against: fed expectations. Expected move ±0.26% (20-day average). USD/JPY: 58% up (base rate 56%; macro tilt up 2 pts). Drivers lean up: real yields, real-yield 1-week momentum; against: fed expectations. Expected move ±0.29% (20-day average). NQ (Nasdaq 100): 54% up (base rate 56%; macro tilt down 2 pts). Drivers lean down: real yields, real-yield 1-week momentum; against: credit stress. Expected move ±1.59% (20-day average). ES (S&P 500): 54% up (base rate 54%; base rate, no macro tilt). Drivers lean up: credit stress, own price trend; against: real yields. Expected move ±0.94% (20-day average). DXY: 51% up (mirror of EUR/USD). Gold Macro Score -0.33 → AUCTION (no macro edge) (real yield 4w z +0.37, DXY 4w z -0.20, 2Y 13w z -0.85, curve 13w z -0.63; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.05 → -0.33; week to 2026-11-13, not closed; gold below its 10-week average). Direction only, never a sell; paper reading. Coming up: GBP GDP m/m Thu 12 Nov 07:00 UTC (consensus 0.0%, previous 0.1%): if hot, gold mixed, USD mixed, NQ mixed; gold usually moves ±1.19%; USD Core PPI m/m Fri 13 Nov 13:30 UTC (consensus 0.3%, previous 0.7%): if hot, gold down, USD up, NQ down; gold usually moves ±1.19%; USD PPI m/m Fri 13 Nov 13:30 UTC (consensus 0.4%, previous 1.3%): if hot, gold down, USD up, NQ down; gold usually moves ±1.19%. Honesty check: on the 880-day walk-forward replay the gold calls hit 52% against a 54% base rate (Brier 0.249 vs 0.25 for a coin flip, Pesaran-Timmermann -0.06): no proven edge (about the base rate). Treat the direction odds as context, not trade signals. Move size: all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days. CPI / NFP / FOMC days moved gold 0.985% on average against 0.863% on other days, but no model turned that into a better forecast.
<!-- macro:end -->

<!-- postmortems:start -->
## Loss post-mortems

Built by the Analyst (last post-mortem 2026-11-07 20:40 UTC) from the live paper losses of the last 7 days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.

No live loss with a finished post-mortem in the last 7 days.
<!-- postmortems:end -->

<!-- what-changed:start -->
## What changed

Daily, for 2026-11-11 (UTC). Each setup's last 20 closed paper trades (live and shadow) against its whole record, in R after costs. The change is tested last 20 vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.

**Last 24 h:** 114 trades closed (2 live), +4.97R (live −2.08R).

| Setup | Trades (live) | All-time R a trade | Last 20 | 20 as of 24 h ago | Change | Confidence |
|---|---|---|---|---|---|---|
| Scalp (scalp) | 392 (16) | +0.00 (t 0.0) | +0.64 | +0.37 | **improving** | low (t 1.7, 20 vs 372) |
| Retrace (rscalp) | 226 (6) | −0.29 (t -2.5) | −0.94 | −0.44 | **decaying** | fair (t -3.4, 20 vs 206) |
| Intraday (intraday) | 72 (5) | +0.28 (t 1.4) | +0.52 | +0.12 | steady (within noise) | none (t 0.7) |
| Retrace (rintra) | 42 (5) | +0.15 (t 0.5) | +0.54 | +0.51 | **improving** | low (t 1.1, 20 vs 22) |
| M30 (m30m1) | 8 (0) | −0.71 (t -1.8) | −0.71 (only 8) | — | too few to compare | small sample (n 8) |
| Swing (swing) | 4 (1) | +0.08 (t 0.1) | +0.08 (only 4) | — | too few to compare | small sample (n 4) |
| Retrace (rswing) | 4 (0) | +0.38 (t 1.6) | +0.38 (only 4) | — | too few to compare | small sample (n 4) |
| Position (position) | 3 (1) | −0.67 (t -1.9) | −0.67 (only 3) | — | too few to compare | small sample (n 3) |
| Replica (replica) | 2 (2) | +0.47 (t 0.3) | +0.47 (only 2) | — | too few to compare | small sample (n 2) |
| Gold H4 trendline (gtl) | 1 (1) | −1.02 (t 0.0) | −1.02 (only 1) | — | too few to compare | small sample (n 1) |
| Gold daily engulf (geg) | 1 (1) | −1.06 (t 0.0) | −1.06 (only 1) | — | too few to compare | small sample (n 1) |

**Why:**
- **Retrace** (rscalp) is decaying: −0.94R a trade over the last 20 vs −0.23R before; won 15% of the last 20 (was 37%); biggest mover: against-D1 trades, 10 of the last 20 (was 54% of trades) at −1.44R a trade (was −0.06R a trade). Confidence fair (t -3.4). Whole record: reliably losing (n 226, t -2.5).
- **Scalp** (scalp) is improving: +0.64R a trade over the last 20 vs −0.03R before; won 60% of the last 20 (was 30%); biggest mover: with-D1 trades, 15 of the last 20 (was 48% of trades) at +1.05R a trade (was −0.31R a trade). Confidence low (t 1.7). Whole record: no proven edge (n 392, t 0.0).
- **Retrace** (rintra) is improving: +0.54R a trade over the last 20 vs −0.20R before; won 50% of the last 20 (was 36%); biggest mover: against-D1 trades, 10 of the last 20 (was 41% of trades) at +1.65R a trade (was −0.40R a trade). Confidence low (t 1.1). Whole record: no proven edge (n 42, t 0.5).

**Edge check:** no setup has a positive record with n ≥ 30 and t ≥ 2, so none is claimed as an edge.
<!-- what-changed:end -->

<!-- fidelity:start -->
## Replay fidelity

Checked 2026-11-11 11:14 UTC; live signals 2026-11-01 to 2026-11-11.

- **Same price feed** (the fair test): the replay found 79% of 478 live signals; on 291 closed pairs the result had the same sign 99% of the time (live +0.12R vs replay +0.02R a trade before costs).
- **All markets:** 53% of comparable live signals found (483 matched of 912); outcome sign agrees 95% on 377 closed pairs.
- **Why live signals were missed:** feed differs 255, data feed 75, replay gap 47 (of 476).
- **Feeds (replay / live):** xau OANDA / live Kraken+OANDA · btc Kraken / live Kraken · eth Kraken / live Kraken · audusd OANDA / live Kraken+OANDA · usdchf OANDA / live Kraken+OANDA · gbpusd OANDA / live Kraken+OANDA · xrp Kraken / live Kraken · sol Kraken / live Kraken · eurusd OANDA / live Kraken+OANDA · usdcad OANDA / live Kraken+OANDA.
- **Live loop gaps (48 h):** none.
<!-- fidelity:end -->

<!-- gold-systems:start -->
## Live gold systems now

Built by the Trader at 2026-11-11 17:41 UTC from its own snapshot and the live record. Status only: what each live Meridian system is waiting for right now; the Scalp block below describes a shadow system.

| System | Book | Now | On |
|---|---|---|---|
| Gold replica | live | gate closed: 1.79% average daily range under the 2.47% gate, so no new replica trade | nothing on |
| Mosha BO | live | H4 BO buy at 4082.82 (11-05 04:00 UTC); waiting for the H1 BO the other way (the retracement). Weekly structure is against it: the trade would be recorded as a shadow. | nothing on |
| Gold trend | live | waiting for a daily close above the 20-day high 4190.42 (last close 4039.03) | nothing on |
| Gold trend fast | shadow | waiting for a daily close above the 5-day high 4148.71 (last close 4039.03) | paper only |
| Gold H4 trendline | live | no falling H4 trendline through two pivot highs right now | nothing on |
| Gold daily engulf | live | daily close 4039.03 above the 20-day average 4031.81; resting buy at 3971.36 | 1 pending |
| Gold momentum pullback | live | D1 up; no pullback zone watched · paper test | nothing on |
| NQ New York open run | live (paper, research.json) | last session 2026-11-09: sell loss −1.05R; next at the 09:30 New York open | — |
<!-- gold-systems:end -->

<!-- veteran:start -->
## Macro veteran

Built by the Macro veteran at 2026-11-11 17:20 UTC from the strategist's data (paper only; full view in macro/veteran.json). Shock fingerprint: **Positive growth / demand news** (low confidence). Consensus: **AUCTION**.

| Topic | Macro strategist | Macro veteran | Stance |
|---|---|---|---|
| Direction for gold | Gold Macro Score −0.33 → AUCTION (no macro edge); next-day P(up) 50% | 7 of 8 channels observed; tally 0 → neutral | agree |
| Real yields | 10Y TIPS 2.66%, rising (vote down); score z (4-week fall) +0.37 | 10Y TIPS 2.66%, +4 bp on the week, −25 bp over 4 weeks | disagree |
| US dollar | +1.42 pts in 5 sessions (vote down); score z (4-week fall) −0.20 | DXY 102.36, +0.27% on the week, +0.13% over 4 weeks · broad USD +0.36% over 4 weeks | qualify |
| Inflation and the next release | 2.20%, −10 bp a week (vote down); playbook: GDP m/m 2026-11-12 07:00 UTC | 10Y breakeven 2.20%, −10 bp on the week. A red-folder event lands within 72 hours (GDP m/m): the view is conditional and the plan is to read real yields and the dollar after the print, not before. | agree |
| Positioning | 104k net, −7k in 4 weeks, 34th pct, week of 2026-11-03 (vote down) | COT managed money 104k net, −7k over 4 weeks, 34th percentile (positions as of 2026-11-03) | qualify |
| Regime | Dollar Smile right side (US outperformance) · dollar liquidity draining · normal volatility | Positive growth / demand news (low confidence) · clues: 10Y real +4 bp, HY −9 bp, VIX −1.4 on the week | qualify |

No macro edge from either member: auction. Direction comes from the technical systems; the macro layer sets event risk and size only. Event within 72 hours (GDP m/m): the bias is conditional until the print.

Fails if: 10Y TIPS real yield above 2.81% (+15 bp from 2.66%) ends the real-rate support; DXY above 103.9 (+1.5%) says the dollar channel has turned; a weekly close below the 10-week average 4160 removes the trend tiebreaker.

Channels: Real-rate opportunity cost + · Inflation expectations − · US dollar 0 · Central-bank path + · Risk, safe haven and liquidity 0 · Investment flows and positioning 0 · Official reserves and physical demand n/a · Price confirmation −.

Forecast ledger: 1 issued, 0 resolved. 0 resolved: too few to judge calibration (20 weekly forecasts is the minimum the playbook asks for)

Scoreboard (who was right on gold's direction per topic, 20 trading days on): 0 resolved weeks, 1 pending.

Releases (expectation captured before, first print kept): Core PPI m/m 2026-11-13 exp 0.3%, print pending · PPI m/m 2026-11-13 exp 0.4%, print pending · GDP m/m 2026-11-12 exp 0.0%, print pending · Core CPI m/m 2026-11-10 exp 0.2%, print pending · CPI m/m 2026-11-10 exp 0.3%, print pending.

Teaching: The strategist has adopted none of the veteran's challengers yet. v_ry4w hit 51%, t 0.67 vs ry hit 52%, t 0.95; v_d2_4w hit 52%, t 1.1 vs dgs2 hit 54%, t 2.19; v_dxy4w hit 50%, t -0.08 vs dxymom hit 49%, t -0.62. A challenger is adopted when it is proven on the replay (t ≥ 3, n ≥ 30) and beats its incumbent; it is handed back when it stops being proven.

**This week: no macro edge for gold, neutral (57% chance it is higher by 4 Dec, base 57%). GBP GDP m/m (Thu 12 Nov, 07:00 UTC) is the event that matters most. Watch $4,100 above and $4,045 below.**

Calibration: Not enough scored calls yet: 0 of 30, over 0 of 4 weeks. Probabilities are used as computed until then.

Event playbook: GBP GDP m/m 2026-11-12 07:00 UTC: consensus 0.0% (previous 0.1%). Act after the release, not before (¼ starter). Descriptive, not a tested edge. · USD Core PPI m/m 2026-11-13 13:30 UTC: consensus 0.3% (previous 0.7%). Act after the release, not before (¼ starter). Descriptive, not a tested edge.

### The veteran's briefing

1. **GBP GDP m/m on Thu, 12 Nov is the week's pivot**: GDP m/m at 2026-11-12 07:00 UTC: consensus 0.0%, previous 0.1% (2026-11-09 01:05 UTC (captured before the release); economic calendar (Forex Factory feed via the strategist); veteran-expectations.json); typical gold day move 1.19% (naive: mean absolute move of the last 20 days) (2026-11-11; macro/forecast.json playbook); also this week: Core PPI m/m, PPI m/m (2026-11-11; calendar). What would change the view: the print against the captured 0.0% and the reaction of real yields and the dollar in the first hours.
2. **Real yields fell 25 bp in 4 weeks (10Y TIPS 2.66%)**: 10Y TIPS 2.66%, −25 bp over 4 weeks (2026-11-09; FRED DFII10 (US Treasury real par curve)). What would change the view: 10Y TIPS back above 2.81% (+15 bp).
3. **Policy path: the 2Y fell 24 bp in 4 weeks (4.56%)**: 2Y Treasury 4.56%, −24 bp over 4 weeks (2026-11-09; FRED DGS2 (US Treasury par curve)). What would change the view: the 2Y back up 15 bp.
4. **Speculators' gold length is middle of its range (22nd percentile of 3 years)**: managed money net 104k, −1.9k on the week, −7.4k over 4 weeks (−0.26 sd) (2026-11-03 (positions; published about 2026-11-06); CFTC Disaggregated COT). What would change the view: the next COT (Friday) moving net length into the top or bottom 20% of its 3-year range.
5. **Gold below its 10-week average (−2.1%); Gold Macro Score −0.33 (AUCTION)**: gold 4070.59 vs 10-week average 4160 (2026-11-06; council daily gold candles (OANDA)); Gold Macro Score −0.33 → AUCTION (no macro edge) (2026-11-13; council/macroscore.mjs (tested 2007-26, 4-week horizon)). What would change the view: a weekly close above the 10-week average 4160, or the score crossing +0.25.
6. **Stress gauges calm (VIX 19)**: VIX 19.5, VIX/VIX3M 0.94 (normal) (2026-11-10; Cboe via FRED VIXCLS / VXVCLS); HY OAS 3.34%, −9 bp on the week (2026-11-09; FRED BAMLH0A0HYM2 (ICE BofA)); SOFR − EFFR 0 bp (2026-11-09; NY Fed SOFR / EFFR via FRED). What would change the view: VIX above 25 or an inverted VIX curve.

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
