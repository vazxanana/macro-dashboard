# Where the council loses edge, and what to change (9 Nov 2026)

Paper research for the owner. Nothing here changes a live rule, `config.json` or `council/trader.mjs`; each proposal waits for
your yes or no. Evidence: `research/edge/council-edge/` (pre-registration, RESULT.md, result.json, breakdown.md).

## In plain words

1. **The losses you see in the live book are the old engine, not the main systems.** The live paper book lost about 21R in
   1–9 Nov. 34 of its 36 closed trades are the scalp / retrace engine that was retired on 4 Nov, and they lost −0.64R a trade
   after costs, clearly negative. The main gold systems (replica, gold trend, trendline, engulf, Mosha) have only 2 closed live
   trades between them and the NQ open run 5 paper trades, so their forward record cannot be judged yet. The "What to expect" card says when it can be.
2. **On 2020 to now, the live gold rules make money after costs, but only some of them are steady.** Replayed with the council's
   own code on OANDA gold from 2020: Gold trend +1.23R and Gold trend fast +1.06R a position (both halves positive, costs hardly
   matter); daily engulf +0.31R and H4 trendline +0.20R (positive, weaker in the first half); the replica +0.36R a position but
   it lost money in 2022 and 2023 (−29R), and with doubled costs it is no longer clearly positive. Worst drawdown of the replica
   over the period: −45R at normal costs.
3. **I tested three changes, written down before running them. None of them helps, so none is proposed for the gold systems.**
   - *Time exit at the open instead of the close* (your open question): it makes no difference. Over 719 positions and 196
     time exits the change is −0.001R a position. Keep the rule as it is.
   - *Skip trades whose costs are more than 0.10R*: on gold this throws away winners. The 132 positions it would skip made
     +0.42R each. Keep taking them.
   - *Switch off a session when its own recent record is clearly losing* (checked every quarter, using only the past): it found
     almost nothing to switch off (20 positions in six years, and those were flat). The gold systems have no losing session that
     a fair rule can find. The Coach's session flips on the engine are reacting to noise.
4. **Costs are what sink the engine's small-stop trades.** On the engine setups (shadow book and the council's 150-day engine
   replay), trades whose costs are more than 0.10R of their stop lose −0.33R a trade; the rest lose much less (−0.09R in the
   replay) or make money (+0.33R in this week's paper trades). A cost limit would cut the engine's paper losses by about two
   thirds. It would still not make the engine profitable, so it is a way to lose less on paper, not a new edge.

## Decisions for you

| # | Proposal | Evidence | What changes if you say yes |
|---|---|---|---|
| 1 | **Close the open question: keep the time exit at the candle's close.** | H1: −0.001R a position (t −0.46) over 719 positions, 2020–26, both cost levels. | Nothing in the code. The question is answered. |
| 2 | **Do not add a cost gate to the gold systems.** | H2: the gated positions made +0.42R each (x1), +0.23R (x2). | Nothing. |
| 3 | **Add a cost limit as a paper-only comparison on the engine shadow book:** record whether each engine trade's round-trip cost is at or under 0.10R and keep a "cost ≤ 0.10R" column next to the shadow totals. Judge it after 200 forward trades: adopt it only if the expensive trades still lose with t ≤ −2 and the cheap ones do better in both halves. | Forward 1–9 Nov: ≤ 0.10R +0.33R (n 227) vs > 0.10R −0.33R (n 330, t −2.6). Replay Jun–Nov: −0.09R vs −0.33R (t −17). | A shadow statistic only (like the stale-signal guard). No live trade, alert or mirror order changes. If any engine setup is ever made live again, it should come with this limit. |
| 4 | **Stop the Coach's session flips on paper engine setups** until a session has at least 15 trades and a clearly losing record (t ≤ −1) over a fixed window, the same rule tested in H3. | 37 Coach changes on 17 rules in a week, 4 rules back and forth 3+ times; H3 shows a fair session rule finds almost nothing to switch off; research/edge/coach-learning found the Coach's choices no better than random drops. | Fewer, slower Coach session changes on the shadow book. Main systems and owner rules are already outside the Coach's reach. |
| 5 | **Size the replica for its real drawdown.** | 2020–26: −45R worst drawdown at normal costs, −62R at doubled costs, two losing years in a row (2022–23). | A sizing decision only. No rule change. |

## What was not tested

Mosha BO, the gold momentum pullback (8 h time exit), the NQ open run and crypto trend have no 2020-to-now replay in the repo
with their live management, so they are not covered here. The ICT desk is a separate edge and was not touched.

## Follow-up to proposal 3: every shadow stream at realistic costs (9 Nov 2026)

You asked to compare all the shadow systems with realistic costs and keep only those whose cost is at most 0.10R a trade.
Evidence: `research/edge/shadow-cost/` (pre-registration, RESULT.md, result.json; Edge lab row "shadow-cost"). Paper only; nothing
below has been changed, each line waits for your yes or no.

**What "realistic" means here:** the real spread for the market and hour (wider in Asia and around the 17:00 New York rollover), the
demo broker's commission, and slippage on every market order and stop. The demo mirror's same-time fills were checked: 8 of them, on
average 0.04R worse than the council's price, which fits the model, so the model stands.

### In plain words

1. **Most shadow streams are too expensive to trade.** The engine's scalp (0.35R a trade), retrace scalp (0.40R), intraday (0.14R),
   retrace intraday (0.17R) and M30→M1 (0.16R), and LIT (0.25R) all pay more than 0.10R. This is not only crypto: the forex and gold
   scalps alone cost 0.13–0.18R. After costs the scalp lost −0.10R a trade this week and −0.40R in its own 150-day replay.
2. **The cheap streams have not traded yet.** The five ICT shadows (no Friday, H1 opposite, structure trail, silver, dip-buy) cost
   only 0.015–0.06R a trade and were all positive in the desk's replay (+0.26R to +0.45R after costs), but that replay is the period
   the desk was designed on, and none of them has a closed forward trade yet. They need about 30 forward trades each before they can
   be judged. The engine's swing, retrace swing and position are cheap too (0.03–0.05R) but lose money in their own replay
   (−0.20R to −0.70R a trade) and have 1–2 forward trades.
3. **Strictly by your rule (cost ≤ 0.10R and making money out of sample), only the engine retrace swing survives, and only on two
   trades.** That is not evidence of anything.
4. **Two things look promising, but neither is ready for real money.**
   - *The NQ open run, trend-on only:* +0.18R a trade after costs since 2020 (514 trades), and costs are now only 0.04R. But all of
     that profit came from 2023 on, which is the period the NQ rule was built on; 2020–22 was flat. Keep it on paper.
   - *The scalp's cheap trades only (cost ≤ 0.10R, about a quarter of them):* +0.78R a trade in this week's paper trades (84 trades)
     and +0.17R in the 150-day replay. But one week is one market, and nine years of forex and gold history found no version of the
     scalp that makes money. Track it as a paper column (proposal 3 as written) and judge it after 200 forward trades.

### Decisions for you

| # | Proposal | Evidence | What changes if you say yes |
|---|---|---|---|
| 3a | **Keep proposal 3 as a paper column**: stamp each engine shadow trade with its realistic cost and show "cost ≤ 0.10R" vs "> 0.10R" next to the shadow totals; judge after 200 forward trades (the cheap side must stay positive in both halves). | Gated scalp: +0.78R forward (n 84, t 2.8), +0.17R replay (n 1,137, t 3.2); expensive side loses. | A statistic on the shadow page only. No trade, alert or mirror order changes. |
| 3b | **Stop recording the engine scalp, retrace scalp, intraday, retrace intraday and M30→M1 as shadow streams** (or keep them only for the 3a column). | Cost 0.14–0.40R a trade, above your 0.10R limit; net negative in their own replay. | Fewer paper trades on the shadow book and the demo shadow account; nothing live. |
| 3c | **Retire the engine swing, retrace swing and position shadows.** | Cheap (0.03–0.05R) but losing in their replay: −0.22R, −0.20R, −0.70R a trade. | Fewer paper trades; nothing live. |
| 3d | **Keep LIT on paper only as you decided, knowing it fails your cost limit** (0.25R a trade; no LIT trade in 19 years was cheaper than 0.10R). | LIT study + this re-costing. | Nothing, or retire it if you prefer to apply the 0.10R rule strictly. |
| 3e | **Keep the five ICT shadows and the NQ trend-on shadow running unchanged**; look again when each has 30 forward trades. | Cost 0.015–0.06R; replay positive; no forward record yet. NQ trend-on +0.18R since 2020, but flat before 2023. | Nothing. |
