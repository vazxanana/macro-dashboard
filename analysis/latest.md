# Week of 2026-11-02

**Clean:** ETH, SOL and GBP/USD are down on D1, H4 and H1. USD/CAD is up on all three.
**Messy:** Gold, BTC, EUR/USD and USD/CHF have D1 up but H4 and H1 down. XRP and AUD/USD are split too. In those markets, trade with D1 only from its Origin, and don't trade against D1 at all.

_Snapshot 2026-11-02 05:37 UTC. Paper trading only._

<!-- live-rule:start -->
## Live Scalp rule check

Built by the Trader at 2026-11-07 20:15 UTC from snapshot, config and the 30-day replay. Rule now: Scalp (M15 → M1) against D1 only, not in asia/overlap, skips audusd. **Scalp is not live right now** (not in focusSetups), so nothing below trades live.

Session now: **newyork**.

| Market | D1 (source) | Live Scalp would | Scalp now | Replay, live rule |
|---|---|---|---|---|
| XAU/USD | down (OANDA) | no (not live, trades the replica instead) | IN ORIGIN sell | 41 trades, 34% won, −0.13R a trade |
| BTC/USD | up (Kraken) | no (not live) | READY sell | 24 trades, 13% won, −3.70R a trade |
| ETH/USD | down (Kraken) | no (not live) | READY buy | 23 trades, 26% won, −1.65R a trade |
| SOL/USD | down (Kraken) | no (not live) | IN ORIGIN sell | 18 trades, 22% won, −0.88R a trade |
| XRP/USD | up (Kraken) | no (not live) | READY sell | 28 trades, 18% won, −1.83R a trade |
| EUR/USD | down (OANDA) | no (not live) | IN ORIGIN sell | 21 trades, 14% won, −0.70R a trade |
| GBP/USD | down (OANDA) | no (not live) | READY sell (blocked: wrong side) | 19 trades, 42% won, +0.43R a trade |
| AUD/USD | up (OANDA) | no (not live, rule skips AUD/USD) | IN ORIGIN buy | 38 trades, 26% won, −0.27R a trade |
| USD/CAD | up (OANDA) | no (not live) | IN ORIGIN buy | 30 trades, 27% won, −0.26R a trade |
| USD/CHF | down (OANDA) | no (not live) | IN ORIGIN buy | 30 trades, 57% won, +0.73R a trade |

Replay total on the markets it trades live: 193 trades, −0.97R a trade (−186.47R), after spread. Each signal still has to clear reward:risk ≥ 1.2, the 2-trades-per-market cap and the 3-hour re-entry rule.
<!-- live-rule:end -->

<!-- coach-churn:start -->
## Coach rule changes

Built by the Trader at 2026-11-07 20:15 UTC from the rule history. Rules the Coach changed by itself in the last 7 days (owner rules are not counted).

| Rule | Changes | Steps (oldest first) |
|---|---|---|
| Minimum stop **(up every time)** | 5 | 0.6 → 0.7 → 0.8 → 0.9 → 1 → 1.1 (11-03 to 11-07) |
| m30m1 · D1 rule **(back and forth)** | 4 | 11-06 dropped the D1 rule → 11-06 only with D1 → 11-07 dropped the D1 rule → 11-07 only with D1 |
| rintra · pause **(back and forth)** | 3 | 11-02 Paused rintra for 3 days → 11-02 Resumed rintra → 11-03 Paused rintra for 3 days |
| rscalp · asia session **(back and forth)** | 3 | 11-04 trading the asia session again → 11-04 skip the asia session → 11-06 trading the asia session again |
| scalp · overlap session **(back and forth)** | 3 | 11-06 skip the overlap session → 11-07 trading the overlap session again → 11-07 skip the overlap session |
| Break-even | 2 | 11-02 Break-even at +1R turned on → 11-02 Break-even turned off |
| rintra · D1 rule | 2 | 11-03 only with D1 → 11-07 dropped the D1 rule |
| rscalp · D1 rule | 2 | 11-02 only with D1 → 11-02 "only with D1" dropped |
| rscalp · overlap session | 2 | 11-03 skip the overlap session → 11-06 trading the overlap session again |
| scalp · D1 rule | 2 | 11-02 only with D1 → 11-02 only against D1 |
| scalp · pause | 2 | 11-02 Paused scalp for 3 days → 11-02 Resumed scalp early |
| intraday · asia session | 1 | 11-04 skip the asia session |
| intraday · D1 rule | 1 | 11-02 only against D1 |
| News guard on | 1 | 11-04 News guard on |
| rintra · late session | 1 | 11-03 skip the late session |
| rscalp · newyork session | 1 | 11-06 skip the newyork session |
| scalp, rscalp · asia session | 1 | 11-02 skip the asia session |

36 changes on 17 rules; 4 rules went back and forth 3+ times; 1 setting only ever moved one way. A rule that keeps moving is reacting to noise: the 150-day study found the Coach's choices do no better than dropping the same number of trades at random (research/edge/coach-learning).
<!-- coach-churn:end -->

<!-- desk-status:start -->
## Desk & mirror status

Built by the Trader at 2026-11-07 20:15 UTC. ICT desk: the last 7 days; mirror: the cTrader DEMO account (0.01 lot, demo only).

**ICT A-setups:** 0 signals (0 open, 0 closed); 1 other signal tracked, not A-setups.

**Dip-buy candidate (NQ/ES, paper only):** 0 signals in 7 days · recording since 2026-11-07.

**cTrader mirror:** ok · demo Fusion Markets · balance 997.73 · 0 open (checked 2026-11-07 20:14 UTC).
<!-- desk-status:end -->

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
