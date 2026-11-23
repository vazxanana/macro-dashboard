# Overnight edge studies, 23 Nov 2026

For the owner. Research only: nothing live changed, no rule, size, stop or config was touched, nothing is proposed for live.

## The short answer

Twelve studies were written down before any test (pre-registrations committed alone, commit 27f35e08a), run once on OANDA
5-minute candles from 2010, and each audited by a second reader who tried to break it. **None passes.** Nine fail, three are too
rare to judge. The goal of "five profitable edges" is not met tonight, and none of these should be traded or called an edge.

What still stands from earlier work: the gold volatility breakout (T1) and the USD/JPY volatility breakout. Both passed their
studies and both run as forward paper records. Nothing tonight changes them.

## Every study

Out of sample = 2024 to Nov 2026. R a trade is after costs. t is the t of calendar-month sums.

| Study | What it tested | Verdict | OOS trades | OOS R a trade | t |
|---|---|---|---|---|---|
| box-touch-trend | Limit at a swing-box edge on the H1 side, target the far edge | FAIL | 4,950 | −0.199 | −7.00 |
| daily-zone-retest | Daily box before a breakout candle, entered on an H1 box break when price returns | FAIL | 302 | −0.030 | −0.36 |
| storyline-qm-sop | BO, VR, CF with QM breaks, limit in the CF zone | INCONCLUSIVE | 1 | −1.016 | — |
| h4-pullback-end | First H1 ChoCh back with the H4 trend, from the right half of the range | FAIL | 120 | +0.125 | 0.77 |
| vb-structure-filter | The two breakouts only on the H4 structure side | FAIL | 557 | +0.124 | 1.93 |
| direction-chain-gate | Daily / H4 / H1 chain as a gate on an H1 box break | FAIL | 782 | −0.049 | −1.27 |
| barrier-qm-janda | Gold barrier, QM, second break, limit at its engulf | FAIL | 311 | −0.101 | −1.08 |
| eg-chain-50 | H1 engulf zone, M15 engulf, M5 confirmation, limit at the middle | FAIL | 1,031 | −0.219 | −2.06 |
| session-sweep | Asia range sweep, M5 QM back inside | INCONCLUSIVE | 27 | −0.007 | −0.03 |
| storyline-daily-gold | Daily rejection plus H4 external break, limit at the H1 pullback QM | FAIL | 16 | −0.333 | −0.95 |
| trendline-qm | H1 trendline break, retest, M15 QM | INCONCLUSIVE | 6 | −0.205 | −0.42 |
| regime-switch-book | Each method kept only in the H4 regime it did best in | FAIL | 2,997 | −0.066 | −1.59 |

Two near misses, and why they are not edges:
- h4-pullback-end made +0.125R out of sample, but −0.036R in sample, and its t is 0.77.
- vb-structure-filter's kept trades made +0.124R, but that is less than the unfiltered breakout (+0.143R). The H4 filter only
  takes trades away.

## What it teaches

- **Direction.** Trading with the timeframe chain, or with the H4 structure side, did not pick better trades in any study tonight.
  That is the same answer as `ltf-structure` and `desk-rigor` gave earlier. A mechanical chain rule does not hold the direction
  read the owner sees on the chart.
- **Entries.** Before costs, the box-edge, engulf and QM entries are close to zero. So costs decide them, and they lose. The
  tighter the stop, the more the cost weighs: box-touch-trend's stop is 0.2 of the box.
- **Market cycle.** Keeping each method only in its own H4 regime (trend, range or pullback) did not turn the book positive.
- **The strict storyline readings** (QM-only VR and CF, the Daily storyline, the trendline QM) almost never trade: 6 to 16
  out-of-sample trades in nearly three years. They cannot be judged on rules alone.

## Next step (owner's choice)

1. Keep the two breakout forward records running. They are the only candidates with evidence.
2. The rest of the owner's method cannot be measured from rules. It can be measured from the owner's own decisions, stamped
   before the outcome (see `research/proposals/2026-11-20-discretion.md`). About 100 such decisions a side would be needed to see
   a +0.5R difference.
3. Do not test more variants of tonight's rules on 2010 to 2026. Those years have now been read under many definitions.

## Phase 2: the untouched holdout (23 Nov 2026)

The years 2010 to 2026 on gold, EUR/USD, GBP/USD, USD/JPY and AUD/USD were read by the first twelve studies. So the five best
ideas from a scan of those trades were tested only on data nobody had used tonight:

- **Set A:** the same five markets, 2005 to 2009.
- **Set B:** NZD/USD, USD/CAD, USD/CHF, EUR/JPY and silver, 2010 to now. Their costs are assumed, not measured on the demo account.

Each rule and its pass bar was written down and committed before any holdout candle was read (de6a84363). Each ran once. A
separate reader then tried to break each result; nothing changed a verdict. Holm was taken over the five studies.

**Result: 0 of 5 pass.**

| Study | Rule in one line | Verdict | Holdout trades | R a trade after costs | month t |
|---|---|---|---|---|---|
| holdout-vb-early | Gold / USD/JPY breakout rule, fills before 06:00 UTC only | FAIL | 4,521 | +0.063 | 2.22 |
| holdout-pullback-deep | H4 pullback end, only after the pullback passed 50 % | FAIL | 607 | −0.110 | −1.65 |
| holdout-phase-pick | The phase reader picks among three entries | FAIL | 6,233 | −0.042 | −2.82 |
| holdout-h1-veto | Breakout rule, skip days with a fresh H1 break against the fill | FAIL | 19,454 | −0.011 | −1.14 |
| holdout-weekly-fade | With the Weekly, against the Daily, at a Daily level | FAIL | 3,342 | −0.007 | −0.36 |

- **The nearest miss is the early breakout.** Early fills beat late fills on both sets (early minus late +0.097R a trade, Welch
  t 3.83). But it misses the Holm line (p 0.068) and loses at twice the costs. NZD/USD, the market no breakout study had ever
  read, made −0.043R (n 1,070). Most of the gain is Set A (+242R of the +284R total), years that earlier breakout studies had
  already read with every fill hour pooled. Keep it as a hypothesis for the two breakout forward records: split them by fill hour.
- **The phase reader as a chooser made the book worse** (−0.042R against −0.024R without the choice).
- **The phase reader is now on the Charts page** as a "Market phase" panel: side, stage, place in the range and the storyline
  step for D1, H4, H1 and M15. It is a reading of structure, not a tested rule, and it trades nothing.

What this changes: nothing live. The holdout is now read too for these five ideas, so do not re-test their variants on it.
