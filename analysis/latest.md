# Week of 2026-11-02

**Clean:** ETH, SOL and GBP/USD are down on D1, H4 and H1. USD/CAD is up on all three.
**Messy:** Gold, BTC, EUR/USD and USD/CHF have D1 up but H4 and H1 down. XRP and AUD/USD are split too. In those markets, trade with D1 only from its Origin, and don't trade against D1 at all.

_Snapshot 2026-11-02 05:37 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-08 02:39 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **asia** — the rule skips it, so no live Scalp until it ends.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead, asia session) | IN ORIGIN sell | 26 trades, 27% won, −0.26R a trade |
| BTC/USD | up (Kraken) | no (not live, asia session) | READY sell | 26 trades, 12% won, −3.60R a trade |
| ETH/USD | down (Kraken) | no (not live, asia session) | READY buy | 23 trades, 26% won, −2.07R a trade |
| SOL/USD | down (Kraken) | no (not live, asia session) | IN ORIGIN sell | 24 trades, 17% won, −1.54R a trade |
| XRP/USD | up (Kraken) | no (not live, asia session) | WAIT RETRACE sell | 29 trades, 24% won, −3.08R a trade |
| EUR/USD | down (OANDA) | no (not live, asia session) | IN ORIGIN sell | 22 trades, 14% won, −0.72R a trade |
| GBP/USD | down (OANDA) | no (not live, asia session) | READY sell (blocked: wrong side) | 33 trades, 21% won, −0.54R a trade |
| AUD/USD | up (OANDA) | no (not live, rule skips AUD/USD, asia session) | IN ORIGIN buy | 32 trades, 38% won, +0.00R a trade |
| USD/CAD | up (OANDA) | no (not live, asia session) | IN ORIGIN buy | 26 trades, 50% won, +0.34R a trade |
| USD/CHF | down (OANDA) | no (not live, asia session) | IN ORIGIN buy | 30 trades, 27% won, −0.42R a trade |

Replay total on the markets it trades live: 213 trades, −1.43R a trade (−305.03R), after spread. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-08 02:39 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| Minimum stop **(up every time)** | 5 | 0.6 → 0.7 → 0.8 → 0.9 → 1 → 1.1 (11-03 to 11-07) |
| m30m1 · D1 rule **(back and forth)** | 4 | 11-06 dropped the D1 rule → 11-06 only with D1 → 11-07 dropped the D1 rule → 11-07 only with D1 |
| rintra · pause **(back and forth)** | 3 | 11-02 Paused rintra for 3 days → 11-02 Resumed rintra → 11-03 Paused rintra for 3 days |
| rscalp · asia session **(back and forth)** | 3 | 11-04 trading the asia session again → 11-04 skip the asia session → 11-06 trading the asia session again |
| scalp · overlap session **(back and forth)** | 3 | 11-06 skip the overlap session → 11-07 trading the overlap session again → 11-07 skip the overlap session |
| Break-even | 2 | 11-02 Break-even at +1R turned on → 11-02 Break-even turned off |
| intraday · D1 rule | 2 | 11-02 only against D1 → 11-07 "only against D1" dropped |
| rintra · D1 rule | 2 | 11-03 only with D1 → 11-07 dropped the D1 rule |
| rscalp · D1 rule | 2 | 11-02 only with D1 → 11-02 "only with D1" dropped |
| rscalp · overlap session | 2 | 11-03 skip the overlap session → 11-06 trading the overlap session again |
| scalp · D1 rule | 2 | 11-02 only with D1 → 11-02 only against D1 |
| scalp · pause | 2 | 11-02 Paused scalp for 3 days → 11-02 Resumed scalp early |
| intraday · asia session | 1 | 11-04 skip the asia session |
| News guard on | 1 | 11-04 News guard on |
| rintra · late session | 1 | 11-03 skip the late session |
| rscalp · newyork session | 1 | 11-06 skip the newyork session |
| scalp, rscalp · asia session | 1 | 11-02 skip the asia session |

37 changes on 17 rules; 4 rules went back and forth 3+ times; 1 setting only ever moved one way. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-08 02:39 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 0 signals (0 open, 0 closed); 1 other signal tracked, not A-setups.

**Dip-buy candidate (NQ/ES, paper only):** 0 signals in 7 days · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 988.99 · 0 open (checked 2026-11-08 02:35 UTC).
<!-- desk-status:end -->

<!-- coach-ledger:start -->
## Coach change ledger

Built by the Trader at 2026-11-08 02:39 UTC. Every rule the Coach changed by itself, the evidence it used and what happened 30 days later. Filter changes run as champion/challenger trials: the old rule keeps running as a shadow and the change stays only if it beats it on the same forward signals (20 where they disagree, shrunk edge ≥ +0.05R a signal; else back to the old rule after 60 days). Owner rules and live setups are not Coach changes.

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

Built by the Macro strategist at 2026-11-08 02:35 UTC for 2026-11-09 (paper only, changes no rule or trade; full view in macro/forecast.json). Regime: **Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress)**.

| Market | P(up) | Lean | Exp. move | Main drivers | Replay hit / base | Brier vs coin |
|---|---|---|---|---|---|---|
| Gold | 54% | base rate, no macro tilt | ±1.01% (20-day avg) | real yields down; real-yield 1-week momentum up; risk sentiment up | 53% / 54% (880 d) | 0.2491 vs 0.25 |
| EUR/USD | 49% | base rate, no macro tilt | ±0.24% (20-day avg) | real yields down; real-yield 1-week momentum up; fed expectations up | 49% / 52% (879 d) | 0.251 vs 0.25 |
| USD/JPY | 55% | macro tilt down 1 pt | ±0.27% (20-day avg) | real yields up; us 10y yield trend down; real-yield 1-week momentum down | 57% / 57% (879 d) | 0.2462 vs 0.25 |
| NQ (Nasdaq 100) | 55% | macro tilt down 1 pt | ±1.44% (20-day avg) | real yields down; real-yield 1-week momentum up; credit stress down | 56% / 56% (879 d) | 0.2476 vs 0.25 |
| ES (S&P 500) | 52% | macro tilt down 2 pts | ±0.81% (20-day avg) | real yields down; credit stress down; vix term structure up | 54% / 54% (877 d) | 0.2483 vs 0.25 |

Macro strategist, Sun 8 Nov 02:35 UTC, for Mon 9 Nov (UTC day, open to close). Regime: Dollar Smile left side (stress) · dollar liquidity draining · VIX curve inverted (stress). Gold: 54% up (base rate 54%; base rate, no macro tilt). Drivers lean up: real-yield 1-week momentum, risk sentiment; against: real yields. Expected move ±1.01% (20-day average). EUR/USD: 49% up (base rate 49%; base rate, no macro tilt, the replay finds no edge in its drivers). Drivers lean down: real yields, usd 5-day momentum; against: real-yield 1-week momentum. Expected move ±0.24% (20-day average). USD/JPY: 55% up (base rate 56%; macro tilt down 1 pt). Drivers lean down: us 10y yield trend, real-yield 1-week momentum; against: real yields. Expected move ±0.27% (20-day average). NQ (Nasdaq 100): 55% up (base rate 56%; macro tilt down 1 pt). Drivers lean down: real yields, credit stress; against: real-yield 1-week momentum. Expected move ±1.44% (20-day average). ES (S&P 500): 52% up (base rate 54%; macro tilt down 2 pts). Drivers lean down: real yields, credit stress; against: vix term structure. Expected move ±0.81% (20-day average). DXY: 51% up (mirror of EUR/USD). No high-impact events in the next 5 days on the calendar we could read (next week's calendar is not published yet; it usually appears over the weekend). Honesty check: on the 880-day walk-forward replay the gold calls hit 53% against a 54% base rate (Brier 0.2491 vs 0.25 for a coin flip, Pesaran-Timmermann 0.16): no proven edge (about the base rate). Treat the direction odds as context, not trade signals. Move size: all five markets keep the naive 20-day average: none of the 4 models tried beat it out of sample on both MAE and QLIKE, on all days and on CPI / NFP / FOMC days. CPI / NFP / FOMC days moved gold 0.972% on average against 0.859% on other days, but no model turned that into a better forecast.
<!-- macro:end -->

<!-- postmortems:start -->
## Loss post-mortems

Built by the Analyst (last post-mortem 2026-11-07 20:40 UTC) from the live paper losses of the last 7 days, once the Trader has watched what price did after the stop. Tags (hunt / noise / late / news) are set only when the evidence is clear; where the owner reviewed a loss, the owner's tags count instead.

**25 losses:** no clear tag 21, news 2, hunt 2, late 1.

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
| 11-02 11:17 | SOL/USD Scalp buy | Against the D1 trend | — | +0.92R; no target in 4 h | — | D1, H4, H1 |

10 older post-mortems of this period are in reviews/analyst.json.

**Owner check:** the owner reviewed 1 of these; on the four shared tags the Analyst matched the owner on 1 of 1.
<!-- postmortems:end -->

<!-- what-changed:start -->
## What changed

Daily, for 2026-11-08 (UTC). Each setup's last 20 closed paper trades (live and shadow) against its whole record, in R after costs. The change is tested last 20 vs the trades before them (Welch t): |t| under 1 is noise, 1 to 2 a weak sign, 2 or more (with 20+ earlier trades) a fair one. Nothing here is an edge unless its n and t say so.

**Last 24 h:** 22 trades closed (0 live), +19.20R (live +0.00R).

| Setup | Trades (live) | All-time R a trade | Last 20 | 20 as of 24 h ago | Change | Confidence |
|---|---|---|---|---|---|---|
| Scalp (scalp) | 277 (16) | −0.09 (t -0.7) | +0.28 | +0.91 | steady (within noise) | none (t 0.9) |
| Retrace (rscalp) | 160 (6) | −0.14 (t -1.0) | −0.51 | −0.54 | **decaying** | low (t -1.4, 20 vs 140) |
| Intraday (intraday) | 49 (5) | +0.22 (t 0.9) | +0.19 | −0.57 | steady (within noise) | none (t -0.1) |
| Retrace (rintra) | 32 (5) | +0.20 (t 0.5) | +0.28 | +0.28 | steady (within noise) | none (t 0.3) |
| Position (position) | 3 (1) | −0.67 (t -1.9) | −0.67 (only 3) | — | too few to compare | small sample (n 3) |
| Replica (replica) | 2 (2) | +0.47 (t 0.3) | +0.47 (only 2) | — | too few to compare | small sample (n 2) |
| Swing (swing) | 2 (1) | −0.31 (t -0.4) | −0.31 (only 2) | — | too few to compare | small sample (n 2) |
| Retrace (rswing) | 2 (0) | +0.24 (t 1.4) | +0.24 (only 2) | — | too few to compare | small sample (n 2) |
| M30 (m30m1) | 2 (0) | +0.27 (t 0.2) | +0.27 (only 2) | — | too few to compare | small sample (n 2) |

**Why:**
- **Retrace** (rscalp) is decaying: −0.51R a trade over the last 20 vs −0.09R before; won 30% of the last 20 (was 39%); biggest mover: overlap session, 8 of the last 20 (was 17% of trades) at −0.98R a trade (was +0.12R a trade). Confidence low (t -1.4). Whole record: no proven edge (n 160, t -1.0).

**Edge check:** no setup has a positive record with n ≥ 30 and t ≥ 2, so none is claimed as an edge.
<!-- what-changed:end -->

<!-- fidelity:start -->
## Replay fidelity

Checked 2026-11-07 21:41 UTC; live signals 2026-11-01 to 2026-11-07.

- **Same price feed** (the fair test): the replay found 76% of 103 live signals; on 57 closed pairs the result had the same sign 98% of the time (live +0.16R vs replay −0.08R a trade before costs).
- **All markets:** 38% of comparable live signals found (235 matched of 616); outcome sign agrees 89% on 174 closed pairs.
- **Why live signals were missed:** feed differs 251, data feed 40, replay gap 35 (of 416).
- **Feeds (replay / live):** xau OANDA / live Kraken · btc Binance / live Kraken · eth Binance / live Kraken · audusd OANDA / live Kraken · usdchf OANDA / live Kraken · gbpusd OANDA / live Kraken · xrp Kraken / live Kraken · sol Kraken / live Kraken · eurusd OANDA / live Kraken · usdcad OANDA / live Kraken.
- **Live loop gaps (48 h):** 11-06 20:57 for 5.5 h, 11-07 03:54 for 3 h, 11-07 10:59 for 5.5 h: no live signals were possible then.
<!-- fidelity:end -->

## Top 3 to watch

1. **ETH: sell.** Zone: H1 Origin 2,279.80 – 2,376.99. Intraday is READY: sell the pullback to 2,288.24, stop past 2,314.85, target 2,170 (4.44R). A live trade is already open. Swing sits in the H4 Origin; for a second entry, wait for H1 to break down (the CF) first.
2. **USD/CAD: buy.** Zone: H4 Origin 1.39218 – 1.40200 (price 1.39894 is inside it). First, M5 has to break up inside the H1 Origin (Intraday is IN ORIGIN). Ignore the READY Scalp sell: it runs against all three trends.
3. **GBP/USD: sell.** Zone: H1 Origin 1.33026 – 1.35764. Position and Swing are READY: sell at 1.33026, stop past 1.35784. The Swing target is 1.27511 (2R). Both setups sit in internal structure (under the 50% line), so wait for that pullback level; don't chase. One open live Scalp buy runs against D1.

_Runner-up:_ **SOL sell** from the H4/H1 Origin 98.51 – 103.07 (50% line 97.61). Price 94.83 is still 5.96 away, so nothing until it gets there.

## Market by market

- **Gold** 3,916.7. Bias: D1 up, H4 and H1 down. Best with-D1 setup: Retrace H1→M5 is READY, buy 3,907.5, stop past 3,897.5, target 3,955.6 (live trade open). Key levels: H4 VR 3,880.0 below; H1 sell Origin 4,012.8 – 4,031.2 above. The Scalp sell is against D1 and filtered.
- **BTC** 78,268.7. Bias: D1 up, H4 and H1 down. Position is IN ORIGIN on D1; wait for H1 to break up. Key levels: H1 VR 76,330.1; sell Origin 79,265.0 – 81,882.0. The Scalp sell is against D1 and filtered.
- **ETH** 2,290.26. Bias: down on all three. Intraday sell is READY at 2,288.24 with stop 2,314.85 (live). Key level: target 2,170.
- **SOL** 94.83. Bias: down on all three. Swing and Intraday sells are WAIT RETRACE. Key levels: Origin 98.51 – 103.07, 50% line 97.61. The live Scalp buys run against D1.
- **XRP** 1.2525. Bias: D1 and H4 up, H1 down. Position buy is WAIT RETRACE. Key level: D1 Origin 0.9847 – 1.1832 (0.1686 away). The Retrace H4→H1 sell is READY at 1.2548, stop 1.3440, target 1.0480, but it is counter-trend by design.
- **EUR/USD** 1.1177. Bias: D1 up, H4 and H1 down. Position buy is IN ORIGIN on D1; wait for H1 to break up. Key level: H1 sell Origin 1.11045 – 1.12262. The Scalp sells against D1 already lost 1R live and 2R shadow.
- **GBP/USD** 1.34008. Bias: down on all three. Position and Swing sells are READY at 1.33026, stop 1.35784. Key level: Swing target 1.27511.
- **AUD/USD** 0.70211. Bias: D1 down, H4 up, H1 down. Intraday and Scalp sells are READY at 0.70181, stop 0.70374, target 0.69795; both are live. Key levels: H4 buy Origin 0.70145 – 0.70417, right under price, so expect a fight there.
- **USD/CAD** 1.39894. Bias: up on all three. Intraday buy is IN ORIGIN; wait for M5 to break up. Key level: H4 Origin 1.39218 – 1.40200.
- **USD/CHF** 0.82346. Bias: D1 up, H4 and H1 down. Position buy is IN ORIGIN on D1. Key levels: H4 VR 0.81971; H4 sell Origin, entry 0.82721. The live Intraday sell (0.82466, stop 0.82650) runs against D1.

## Last week

The council has only run since Sun 2026-11-01 20:09 UTC, about 9 hours.

- **Live:** 7 closed, 0 wins (0%), −7.0R. 11 more are still open.
- **Shadow** (blocked, not scored): 18 closed, 5 wins, −4.65R, plus 6 missed.
- **Main leak:** trading against D1. Reviews tag 8 losses "against" (−8R). The 3 live against-D1 losses were on SOL, XRP and EUR/USD. Next is "gave back" (4×): trades that reached +1R and still hit the stop.
- **Coach change** (02:26 UTC Mon): **Scalp now trades only with D1.** The reason given was "against: −1.00R over 7 trades". Shadow results support it: every closed against-D1 Scalp lost.
- **Current settings:** minRR 1.2, buffer 0.15, break-even off, newsGuard off.

## News to respect

- **Mon 2 Nov:** US ISM Manufacturing PMI, 10:00 New York (15:00 UTC).
- **Tue 3 Nov:** US midterm elections. Expect gaps and spikes in USD pairs, gold and crypto as results come in overnight into Wednesday.
- **Fri 6 Nov:** US Non-Farm Payrolls, 08:30 New York (13:30 UTC; US clocks went back on 1 Nov). Canada's jobs report usually comes out at the same time, which matters for USD/CAD, the top pick.
- newsGuard is **off**, so M15 and H1 trades will fire through these releases. Check the page's **News** tab for central-bank dates and anything else this week.
