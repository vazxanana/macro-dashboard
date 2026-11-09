# Week of 2026-11-09

**Clean:** ETH, SOL, GBP/USD and USD/CHF are down on D1, H4 and H1; USD/CAD is up on all three.
**Messy:** Gold (D1 now down, H4 and H1 up), BTC and AUD/USD (D1 up, H4 and H1 down), EUR/USD (D1 down, H4 up) and XRP (H1 against D1 and H4). In those, trade with D1 only from its Origin, never against it.

_Snapshot 2026-11-09 05:40 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-09 14:37 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **overlap** — the rule skips it, so no live Scalp until it ends.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead, overlap session) | WAIT RETRACE buy | 26 trades, 27% won, −0.26R a trade |
| BTC/USD | up (Kraken) | no (not live, overlap session) | IN ORIGIN sell | 32 trades, 31% won, +0.11R a trade |
| ETH/USD | down (Kraken) | no (not live, overlap session) | WAIT RETRACE sell | 18 trades, 28% won, −0.30R a trade |
| SOL/USD | down (Kraken) | no (not live, overlap session) | WAIT RETRACE sell | 25 trades, 24% won, −0.01R a trade |
| XRP/USD | up (Kraken) | no (not live, overlap session) | IN ORIGIN buy | 34 trades, 44% won, +0.41R a trade |
| EUR/USD | down (OANDA) | no (not live, overlap session) | IN ORIGIN buy | 22 trades, 14% won, −0.72R a trade |
| GBP/USD | down (OANDA) | no (not live, overlap session) | IN ORIGIN buy | 30 trades, 20% won, −0.57R a trade |
| AUD/USD | up (OANDA) | no (not live, rule skips AUD/USD, overlap session) | READY buy (blocked: wrong side) | 32 trades, 38% won, +0.00R a trade |
| USD/CAD | up (OANDA) | no (not live, overlap session) | IN ORIGIN sell | 26 trades, 50% won, +0.34R a trade |
| USD/CHF | down (OANDA) | no (not live, overlap session) | READY buy | 28 trades, 25% won, −0.44R a trade |

Replay total on the markets it trades live: 215 trades, −0.11R a trade (−24.48R), after spread. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-09 14:37 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| Minimum stop **(up every time)** | 5 | 0.6 → 0.7 → 0.8 → 0.9 → 1 → 1.1 (11-03 to 11-07) |
| m30m1 · D1 rule **(back and forth)** | 4 | 11-06 dropped the D1 rule → 11-06 only with D1 → 11-07 dropped the D1 rule → 11-07 only with D1 |
| rintra · pause **(back and forth)** | 3 | 11-02 Paused rintra for 3 days → 11-02 Resumed rintra → 11-03 Paused rintra for 3 days |
| rscalp · asia session **(back and forth)** | 3 | 11-04 trading the asia session again → 11-04 skip the asia session → 11-06 trading the asia session again |
| scalp · overlap session **(back and forth)** | 3 | 11-06 skip the overlap session → 11-07 trading the overlap session again → 11-07 skip the overlap session |
| rintra · D1 rule | 2 | 11-03 only with D1 → 11-07 dropped the D1 rule |
| rscalp · overlap session | 2 | 11-03 skip the overlap session → 11-06 trading the overlap session again |
| intraday · asia session | 1 | 11-04 skip the asia session |
| intraday · D1 rule | 1 | 11-07 "only against D1" dropped |
| News guard on | 1 | 11-04 News guard on |
| rintra · late session | 1 | 11-03 skip the late session |
| rscalp · D1 rule | 1 | 11-02 "only with D1" dropped |
| rscalp · newyork session | 1 | 11-06 skip the newyork session |
| scalp · pause | 1 | 11-02 Resumed scalp early |
| scalp, rscalp · asia session | 1 | 11-02 skip the asia session |

30 changes on 15 rules; 4 rules went back and forth 3+ times; 1 setting only ever moved one way. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-09 14:37 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 1 signal (1 open, 0 closed); 3 other signals tracked, not A-setups.
- open: ES buy from 7423.25, stop 7363.25 (H1 iFVG reversal, A+)

**Dip-buy candidate (NQ/ES, paper only):** 2 signals in 7 days, 1 closed −1.00R · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 9967.42 · 3 open · 1 resting (checked 2026-11-09 14:36 UTC).
- open: SOLUSD sell position (sol-position-1793893928) · fill 89.121 vs council 89.77 (+0.08R slippage)
- open: SOLUSD sell position (sol-position-1793899009) · fill 89.121 vs council 89.77 (+0.08R slippage)
- open: BTCUSD sell scalp (btc-scalp-1793919871) · fill 75841.41 vs council 75500 (−0.36R slippage)

**Execution vs paper:** 11 demo fills; slippage against the council entry −0.01R on average (median +0.04R, worst +0.86R; positive = worse than paper), median 88908s from council fill to demo order.

Last mirror events:
- 11-08 21:56 ETHUSD position 47357956 closed at the broker
- 11-08 21:52 ETHUSD position 47357959 closed at the broker
- 11-08 21:45 SOLUSD position 47357958 closed at the broker
- 11-08 16:54 ETHUSD position 47357961 closed at the broker
- 11-08 11:41 not mirrored yet ict:es-s-1793995200: US500 market closed (paused until 11:49 UTC) (will retry)
<!-- desk-status:end -->

<!-- coach-ledger:start -->
## Coach change ledger

Built by the Trader at 2026-11-09 14:37 UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (20 where they disagree, shrunk edge ≥ +0.05R a signal; else back to the old rule after 60 days). Owner rules and live setups are not Coach changes.

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

Built by the Macro strategist at 2026-11-09 14:02 UTC for 2026-11-10 (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress)**.

Gold Macro Score -0.16 → AUCTION (no macro edge) (real yield 4w z +0.64, DXY 4w z -0.20, 2Y 13w z -0.63, curve 13w z -0.44; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.13 → -0.16; week to 2026-11-13, not closed; gold below its 10-week average). Direction only, never a sell; paper reading.

| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |
|---|---|---|---|---|---|---|
| Gold | 54% | base rate, no macro tilt | ±1.01% (20-day avg) | real yields down; real-yield 1-week momentum up; risk sentiment up | 53% / 54% (880 d) | 0.249 vs 0.25 |
| EUR/USD | 49% | base rate, no macro tilt | ±0.24% (20-day avg) | real yields down; real-yield 1-week momentum up; fed expectations up | 49% / 52% (879 d) | 0.251 vs 0.25 |
| USD/JPY | 55% | macro tilt down 2 pts | ±0.27% (20-day avg) | real yields up; us 10y yield trend down; real-yield 1-week momentum down | 57% / 57% (879 d) | 0.2462 vs 0.25 |
| NQ (Nasdaq 100) | 55% | base rate, no macro tilt | ±1.44% (20-day avg) | real yields down; real-yield 1-week momentum up; credit stress down | 56% / 56% (879 d) | 0.2476 vs 0.25 |
| ES (S&P 500) | — | — | — | real yields down; credit stress down; vix term structure up | — | — |

Next high-impact events:
- 2026-11-10 13:30 UTC USD Core CPI m/m (cons. 0.2%, prev. 0.3%): hot if ≥ 0.3%, cool if ≤ 0.1%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.
- 2026-11-10 13:30 UTC USD CPI m/m (cons. 0.3%, prev. 0.6%): hot if ≥ 0.4%, cool if ≤ 0.2%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.
- 2026-11-12 07:00 UTC GBP GDP m/m (cons. 0.0%, prev. 0.1%): hot if ≥ 0.1%, cool if ≤ -0.1%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold mixed, EUR/USD mixed, USD/JPY mixed, NQ mixed.
- 2026-11-13 13:30 UTC USD Core PPI m/m (cons. 0.3%, prev. 0.7%): hot if ≥ 0.4%, cool if ≤ 0.2%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.
- 2026-11-13 13:30 UTC USD PPI m/m (cons. 0.4%, prev. 1.3%): hot if ≥ 0.5%, cool if ≤ 0.3%, in line in between (one reporting step; ±1 SD once 8 surprises are logged); hot → gold down, EUR/USD down, USD/JPY up, NQ down.

Lessons from the Macro veteran: no challenger has beaten its incumbent on the replay yet; v_ry4w hit 0.512 t 0.59 vs ry hit 0.516 t 0.88; v_d2_4w hit 0.522 t 1.02 vs dgs2 hit 0.537 t 2.12; v_dxy4w hit 0.499 t -0.04 vs dxymom hit 0.489 t -0.58.

Macro strategist, Mon 9 Nov 14:02 UTC, for Tue 10 Nov (UTC day, open to close). Regime: Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress). Tue 10 Nov is an event day (CPI, 13:30 UTC): expect bigger moves. Gold: 54% up (base rate 54%; base rate, no macro tilt). Drivers lean up: real-yield 1-week momentum, risk sentiment; against: real yields. Expected move ±1.01% (20-day average). EUR/USD: 49% up (base rate 49%; base rate, no macro tilt, the replay finds no edge in its drivers). Drivers lean up: real-yield 1-week momentum, fed expectations; against: real yields. Expected move ±0.24% (20-day average). USD/JPY: 55% up (base rate 56%; macro tilt down 2 pts). Drivers lean down: us 10y yield trend, real-yield 1-week momentum; against: real yields. Expected move ±0.27% (20-day average). NQ (Nasdaq 100): 55% up (base rate 56%; base rate, no macro tilt). Drivers lean down: real yields, credit stress; against: real-yield 1-week momentum. Expected move ±1.44% (20-day average). ES (S&P 500): no forecast (no price data). DXY: 51% up (mirror of EUR/USD). Gold Macro Score -0.16 → AUCTION (no macro edge) (real yield 4w z +0.64, DXY 4w z -0.20, 2Y 13w z -0.63, curve 13w z -0.44; 6-week path -0.98 → -0.58 → -0.13 → +0.13 → +0.13 → -0.16; week to 2026-11-13, not closed; gold below its 10-week average). Direction only, never a sell; paper reading. Coming up: USD Core CPI m/m Tue 10 Nov 13:30 UTC (consensus 0.2%, previous 0.3%): if hot, gold down, USD up, NQ down; gold usually moves ±1.01%; USD CPI m/m Tue 10 Nov 13:30 UTC (consensus 0.3%, previous 0.6%): if hot, gold down, USD up, NQ down; gold usually moves ±1.01%; GBP GDP m/m Thu 12 Nov 07:00 UTC (consensus 0.0%, previous 0.1%): if hot, gold mixed, USD mixed, NQ mixed; gold usually moves ±1.01%; USD Core PPI m/m Fri 13 Nov 13:30 UTC (consensus 0.3%, previous 0.7%): if hot, gold down, USD up, NQ down; gold usually moves ±1.01%. Honesty check: on the 880-day walk-forward replay the gold calls hit 53% against a 54% base rate (Brier 0.249 vs 0.25 for a coin flip, Pesaran-Timmermann 0.18): no proven edge (about the base rate). Treat the direction odds as context, not trade signals. Move size: all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days. CPI / NFP / FOMC days moved gold 0.972% on average against 0.861% on other days, but no model turned that into a better forecast.
<!-- macro:end -->

<!-- postmortems:start -->
## Loss post-mortems

Built by the Analyst (last post-mortem 2026-11-07 20:40 UTC) from the live paper losses of the last 7 days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.

**14 losses:** no clear tag 12, news 2, hunt 1.

| Closed (UTC) | Trade | Finding | Tags | MFE; after the stop | Timing | HTF against |
|---|---|---|---|---|---|---|
| 11-04 08:15 | ETH/USD Intraday sell | Was +2.44R, then stopped | — | +2.44R; no target in 12 h | stop 15 min after London open; news: USD ISM Manufacturing PMI, USD Congressional Elections | none |
| 11-04 05:34 | XAU/USD Scalp sell | Against the D1 trend | — | +0.39R; no target in 4 h | news: USD Congressional Elections | D1 |
| 11-04 02:59 | BTC/USD Retrace buy | Was +1.31R, then stopped | — | +1.31R; target 11.7 h later, 0.82R past the stop first | news: USD Congressional Elections | H4, H1 |
| 11-04 01:15 | XAU/USD Replica sell | Wrong direction; the stop did its job | — (owner: htf) | +0.09R; no target in 24 h | — | D1 |
| 11-03 23:35 | XAU/USD Scalp sell | Against the D1 trend | — | +0.23R; no target in 4 h | stop 25 min before Tokyo open | D1 |
| 11-03 15:52 | GBP/USD Retrace sell | News during the trade | news | +0.17R; no target in 4 h | news: USD Congressional Elections | none |
| 11-03 15:35 | USD/CHF Intraday sell | Stop swept, then the target | hunt, news | +1.91R; target 10.1 h later, 0R past the stop first | entry 5 min before New York open; news: USD ISM Manufacturing PMI, USD Congressional Elections | D1 |
| 11-03 12:24 | XAU/USD Scalp sell | Was +4.75R, then stopped | — | +4.75R; no target in 4 h | — | D1 |
| 11-03 12:20 | XAU/USD Scalp sell | Against the D1 trend | — | +0.85R; no target in 4 h | — | D1 |
| 11-03 11:11 | XAU/USD Scalp sell | Against the D1 trend | — | +0.27R; no target in 4 h | — | D1 |
| 11-03 09:31 | BTC/USD Scalp sell | Against the D1 trend | — | +0.04R; no target in 4 h | — | D1 |
| 11-03 03:01 | BTC/USD Retrace buy | Ordinary loss | — | +0.13R; no target in 12 h | — | H4, H1 |
| 11-03 00:08 | BTC/USD Retrace buy | Was +1.20R, then stopped | — | +1.20R; no target in 4 h | stop 8 min after Tokyo open | H4, H1 |
| 11-02 15:58 | BTC/USD Retrace buy | Ordinary loss | — | +0.94R; no target in 12 h | entry 10 min after Tokyo open; news: USD ISM Manufacturing PMI | H4, H1 |

**Owner check:** the owner reviewed 1 of these; on the four shared tags the Analyst matched the owner on 1 of 1.
<!-- postmortems:end -->

<!-- what-changed:start -->
## What changed

Daily, for 2026-11-09 (UTC). Each setup's last 20 closed paper trades (live and shadow) against its whole record, in R after costs. The change is tested last 20 vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.

**Last 24 h:** 25 trades closed (0 live), +3.00R (live +0.00R).

| Setup | Trades (live) | All-time R a trade | Last 20 | 20 as of 24 h ago | Change | Confidence |
|---|---|---|---|---|---|---|
| Scalp (scalp) | 288 (16) | −0.07 (t -0.5) | +0.82 | +0.28 | **improving** | low (t 1.3, 20 vs 268) |
| Retrace (rscalp) | 166 (6) | −0.16 (t -1.1) | −0.33 | −0.51 | steady (within noise) | none (t -0.6) |
| Intraday (intraday) | 55 (5) | +0.24 (t 1.1) | +0.63 | +0.19 | **improving** | low (t 1.3, 20 vs 35) |
| Retrace (rintra) | 34 (5) | +0.13 (t 0.3) | +0.22 | +0.28 | steady (within noise) | none (t 0.3) |
| Position (position) | 3 (1) | −0.67 (t -1.9) | −0.67 (only 3) | — | too few to compare | small sample (n 3) |
| Replica (replica) | 2 (2) | +0.47 (t 0.3) | +0.47 (only 2) | — | too few to compare | small sample (n 2) |
| Swing (swing) | 2 (1) | −0.31 (t -0.4) | −0.31 (only 2) | — | too few to compare | small sample (n 2) |
| Retrace (rswing) | 2 (0) | +0.24 (t 1.4) | +0.24 (only 2) | — | too few to compare | small sample (n 2) |
| M30 (m30m1) | 2 (0) | +0.27 (t 0.2) | +0.27 (only 2) | — | too few to compare | small sample (n 2) |

**Why:**
- **Intraday** (intraday) is improving: +0.63R a trade over the last 20 vs +0.02R before; won 55% of the last 20 (was 31%); biggest mover: XRP/USD, 8 of the last 20 (was 11% of trades) at +1.07R a trade (was −1.04R a trade). Confidence low (t 1.3). Whole record: no proven edge (n 55, t 1.1).
- **Scalp** (scalp) is improving: +0.82R a trade over the last 20 vs −0.13R before; won 50% of the last 20 (was 26%); biggest mover: against-D1 trades, 14 of the last 20 (was 45% of trades) at +1.30R a trade (was +0.04R a trade). Confidence low (t 1.3). Whole record: no proven edge (n 288, t -0.5).

**Edge check:** no setup has a positive record with n ≥ 30 and t ≥ 2, so none is claimed as an edge.
<!-- what-changed:end -->

<!-- fidelity:start -->
## Replay fidelity

Checked 2026-11-09 11:51 UTC; live signals 2026-11-01 to 2026-11-09.

- **Same price feed** (the fair test): the replay found 79% of 263 live signals; on 147 closed pairs the result had the same sign 99% of the time (live +0.14R vs replay +0.07R a trade before costs).
- **All markets:** 45% of comparable live signals found (316 matched of 697); outcome sign agrees 93% on 229 closed pairs.
- **Why live signals were missed:** feed differs 251, data feed 40, data feed 37 (of 417).
- **Feeds (replay / live):** xau OANDA / live Kraken+OANDA · btc Kraken / live Kraken · eth Kraken / live Kraken · audusd OANDA / live Kraken+OANDA · usdchf OANDA / live Kraken+OANDA · gbpusd OANDA / live Kraken+OANDA · xrp Kraken / live Kraken · sol Kraken / live Kraken · eurusd OANDA / live Kraken+OANDA · usdcad OANDA / live Kraken+OANDA.
- **Live loop gaps (48 h):** 11-07 10:59 for 5.5 h, 11-08 03:00 for 3.7 h, 11-08 07:17 for 6 h: no live signals were possible then.
<!-- fidelity:end -->

<!-- gold-systems:start -->
## Live gold systems now

Built by the Trader at 2026-11-09 14:37 UTC from its own snapshot and the live record. Status only: what each live Meridian system is waiting for right now; the Scalp block below describes a shadow system.

| System | Book | Now | On |
|---|---|---|---|
| Gold replica | live | gate closed: 1.60% average daily range under the 2.47% gate, so no new replica trade | nothing on |
| Mosha BO | live | H4 BO buy at 4082.82 (11-05 04:00 UTC); waiting for the H1 BO the other way (the retracement). Weekly structure is against it: the trade would be recorded as a shadow. | nothing on |
| Gold trend | live | waiting for a daily close above the 20-day high 4199.08 (last close 4055.69) | nothing on |
| Gold trend fast | shadow | waiting for a daily close above the 5-day high 4146.92 (last close 4055.69) | paper only |
| Gold H4 trendline | live | no falling H4 trendline through two pivot highs right now | nothing on |
| Gold daily engulf | live | daily close 4055.69 above the 20-day average 4040.42; resting buy at 3971.36 | 1 pending |
| Gold momentum pullback | live | D1 up; no pullback zone watched · paper test | nothing on |
| NQ New York open run | live (paper, research.json) | today: sell 27361.50, loss −1.05R | — |
<!-- gold-systems:end -->

<!-- veteran:start -->
## Macro veteran

Built by the Macro veteran at 2026-11-09 14:02 UTC from the strategist's data (paper only; full view in macro/veteran.json). Shock fingerprint: **Risk-off / de-risking, funding still calm** (medium confidence). Consensus: **AUCTION**.

| Topic | Macro strategist | Macro veteran | Stance |
|---|---|---|---|
| Direction for gold | Gold Macro Score −0.16 → AUCTION (no macro edge); next-day P(up) 54% | 7 of 8 channels observed; tally 0 → neutral | agree |
| Real yields | 10Y TIPS 2.60%, falling (vote down); score z (4-week fall) +0.64 | 10Y TIPS 2.60%, −3 bp on the week, −32 bp over 4 weeks | disagree |
| US dollar | +0.04 pts in 5 sessions (vote flat); score z (4-week fall) −0.20 | DXY 102.36, +0.27% on the week, +0.13% over 4 weeks · broad USD −0.10% over 4 weeks | agree |
| Inflation and the next release | 2.23%, −11 bp a week (vote down); playbook: Core CPI m/m 2026-11-10 13:30 UTC | 10Y breakeven 2.23%, −11 bp on the week. A red-folder event lands within 72 hours (Core CPI m/m): the view is conditional and the plan is to read real yields and the dollar after the print, not before. | agree |
| Positioning | 104k net, −7k in 4 weeks, 34th pct, week of 2026-11-03 (vote down) | COT managed money 104k net, −7k over 4 weeks, 34th percentile (positions as of 2026-11-03) | qualify |
| Regime | Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress) | Risk-off / de-risking, funding still calm (medium confidence) · clues: VIX/VIX3M 1.103, HY +22 bp on the week, SOFR−EFFR 1 bp, DXY +0.27% | agree |

No macro edge from either member: auction. Direction comes from the technical systems; the macro layer sets event risk and size only. Event within 72 hours (Core CPI m/m): the bias is conditional until the print.

Fails if: 10Y TIPS real yield above 2.75% (+15 bp from 2.60%) ends the real-rate support; DXY above 103.9 (+1.5%) says the dollar channel has turned; a weekly close below the 10-week average 4160 removes the trend tiebreaker.

Channels: Real-rate opportunity cost + · Inflation expectations − · US dollar 0 · Central-bank path + · Risk, safe haven and liquidity 0 · Investment flows and positioning 0 · Official reserves and physical demand n/a · Price confirmation −.

Forecast ledger: 1 issued, 0 resolved. 0 resolved: too few to judge calibration (20 weekly forecasts is the minimum the playbook asks for)

Scoreboard (who was right on gold's direction per topic, 20 trading days on): 0 resolved weeks, 1 pending.

Releases (expectation captured before, first print kept): Core PPI m/m 2026-11-13 exp 0.3%, print pending · PPI m/m 2026-11-13 exp 0.4%, print pending · GDP m/m 2026-11-12 exp 0.0%, print pending · Core CPI m/m 2026-11-10 exp 0.2%, print pending · CPI m/m 2026-11-10 exp 0.3%, print pending.

Teaching: The strategist has adopted none of the veteran's challengers yet. v_ry4w hit 51%, t 0.59 vs ry hit 52%, t 0.88; v_d2_4w hit 52%, t 1.02 vs dgs2 hit 54%, t 2.12; v_dxy4w hit 50%, t -0.04 vs dxymom hit 49%, t -0.58. A challenger is adopted when it is proven on the replay (t ≥ 3, n ≥ 30) and beats its incumbent; it is handed back when it stops being proven.

**This week: no macro edge for gold, neutral (57% chance it is higher by 4 Dec, base 57%). USD Core CPI m/m (Tue 10 Nov, 13:30 UTC) is the event that matters most. Watch $4,100 above and $4,045 below.**

Calibration: Not enough scored calls yet: 0 of 30, over 0 of 4 weeks. Probabilities are used as computed until then.

Event playbook: USD Core CPI m/m 2026-11-10 13:30 UTC: consensus 0.2% (previous 0.3%); P(gold up on the day) 58% vs base 54%; past CPI days n 85, gold up 59%, median /move/ 0.629%. Act after the release, not before (¼ starter). Descriptive, not a tested edge. · GBP GDP m/m 2026-11-12 07:00 UTC: consensus 0.0% (previous 0.1%). Act after the release, not before (¼ starter). Descriptive, not a tested edge.

### The veteran's briefing

1. **USD Core CPI m/m on Tue, 10 Nov is the week's pivot**: Core CPI m/m at 2026-11-10 13:30 UTC: consensus 0.2%, previous 0.3% (2026-11-09 01:05 UTC (captured before the release); economic calendar (Forex Factory feed via the strategist); veteran-expectations.json); typical gold day move 1.01% (naive: mean absolute move of the last 20 days) (2026-11-09; macro/forecast.json playbook); also this week: CPI m/m, GDP m/m, Core PPI m/m, PPI m/m (2026-11-09; calendar). What would change the view: the print against the captured 0.2% and the release-day 10Y TIPS move against the 6.11 bp typical CPI day (2022-24 study).
2. **Stress gauges are lit (VIX 28, curve inverted), funding still calm**: VIX 28.2, VIX/VIX3M 1.10 (inverted) (2026-11-05; Cboe via FRED VIXCLS / VXVCLS); HY OAS 3.48%, +22 bp on the week (2026-11-05; FRED BAMLH0A0HYM2 (ICE BofA)); SOFR − EFFR 1 bp (2026-11-06; NY Fed SOFR / EFFR via FRED). What would change the view: VIX/VIX3M back below 1 ends the stress read; SOFR − EFFR above 15 bp would make it a funding squeeze (gold sold for cash).
3. **Real yields fell 27 bp in 4 weeks (10Y TIPS 2.60%)**: 10Y TIPS 2.60%, −27 bp over 4 weeks (z −1.4 vs every week since 2007-01-19) (2026-11-05; FRED DFII10 (US Treasury real par curve)). What would change the view: 10Y TIPS back above 2.75% (+15 bp).
4. **Policy path: the 2Y fell 29 bp in 4 weeks (4.46%)**: 2Y Treasury 4.46%, −29 bp over 4 weeks (2026-11-05; FRED DGS2 (US Treasury par curve)). What would change the view: the 2Y back up 15 bp.
5. **The 20 closest past set-ups: gold higher 20 sessions on in 60% (all weeks 55%)**: 20-session median +1.16% (middle half −3.6% to +4.2%); 5-session median +0.37%, up 60% (2026-11-06; council daily candles + FRED weekly history, analogs since 2007-01-19). What would change the view: a week that moves the fingerprint (real yields, the dollar or gold's place in its range) changes the analog set.
6. **Speculators' gold length is middle of its range (22nd percentile of 3 years)**: managed money net 104k, −1.9k on the week, −7.4k over 4 weeks (−0.26 sd) (2026-11-03 (positions; published about 2026-11-06); CFTC Disaggregated COT). What would change the view: the next COT (Friday) moving net length into the top or bottom 20% of its 3-year range.

- H1 · 52%: If gold stays below $4,100 (round number), it closes at or below $4,045 (20-day average) by 2026-11-13 before any close above $4,100. Of 20 analogs, 11 (55%) made this move first within 5 sessions vs 45% of all 1021 weeks since 2007-01-19; the analogs favour this side. Invalidated by a daily close above $4,100 before the target; and watch: the print against the captured 0.2% and the release-day 10Y TIPS move against the 6.11 bp typical CPI day (2022-24 study).
- H2 · 63%: Gold's daily closes stay between $3,891 (last week's low) and $4,147 (last week's high) every day through 2026-11-13. 12 of 20 analogs stayed inside the same distances for 5 sessions vs 68% of all weeks: a contained week is the more likely path. Invalidated by any daily close outside $3,891-$4,147.
- H3 · 56%: DXY closes 2026-12-04 below 102.36 (the latest close). 12 of 20 analogs saw the DXY lower 20 sessions on vs 49% of all weeks. Gold usually moves the other way, except in stress (both bid). Invalidated by DXY above 103.89 (+1.5%) on a close.

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
