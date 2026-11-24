---
name: wyz
description: Carry-over lessons from the MSNR switch studies (msnr-switch-fade, msnr-switch-complements, Nov 2026) for judging, fixing or designing any trading edge on this desk - cost-to-risk screening, stops sized on the working chart's ATR, why the MSNR direction call is not a usable gate, the 20-23 UTC quote-effect warning, and the pick-on-old-years / judge-on-untouched-markets test template. Use before testing or adapting a rule, when a desk reading looks good before costs, when someone wants to "tweak until it passes", or when choosing a stop, filter or exit for a new edge.
---

# wyz: what carries over from the MSNR switch studies

Source studies (read their RESULT.md for every figure): `research/edge/msnr-switch-fade` (INCONCLUSIVE, 0 of 42) and
`research/edge/msnr-switch-complements` (FAIL, 0 of 96 eligible). Neither found an edge. What they did find applies to every
other edge. Figures below are before / after the desk's round-trip costs (`combo-grid-2` `COSTS`; ASSUMED for many markets).

## 1. Screen cost-to-risk before testing anything

- Compute **cost R = round trip / stop distance** from the rule's own stops BEFORE judging its entries.
- Switch triggers with M5/M15 swing stops paid **about 0.4-0.5R a trade** in costs. The best cell made +0.291R before costs and
  -0.197R after. No before-cost tilt seen on this desk (+0.03 to +0.07R a trade, typical of the fade grids) survives that.
- Rule of thumb: **cost R above about 0.1 = the rule cannot pay the spread** however good the entry. Fix the stop or the target
  first, or drop the rule.
- Desk audit (24 Nov 2026, `research/proposals/2026-11-24-desk-cost-audit.md`): most desk readings pay only 0.02-0.10R a trade;
  the heavy tails are the M1 / M5-stop readings (M1 EF entry: 90th percentile 0.25R). Costs are NOT what sinks the desks: their
  entries sit near zero before costs, and after costs no reading with 100+ trades reaches t 1.3. A wider stop will not rescue
  an entry that makes zero. Desk totals are before costs; never quote them as tradable.

## 2. Size the stop on the WORKING chart's ATR

- A stop of 1 x ATR(14) of the working chart (H4 or H1), from the fill, cut cost R from about 0.4 to **about 0.035**.
- It was the only complement that turned losing cells into slightly positive ones after costs (best: H4 switch candle, 1-ATR
  stop, 2R: +0.037R a trade after costs on 2005-14, n 2,501, month t 1.38; +0.030R on eight untouched markets, t 1.68).
  Near zero and never t 2: a direction, not an edge.
- Open question worth one pre-registered test: the fade (`grid7-wide-fade`, positive before costs everywhere) with a
  working-chart ATR stop instead of a trigger-chart one. Needs data the fade work never read (the `fade-new-markets` markets
  and the HistData feed are used) or broker ticks.

## 3. Do not use the MSNR direction call as a gate

- Four studies find no usable direction or timing in `council/eg-methods.mjs` `direction()`: `msnr-direction-wide`,
  `grid7-msnr-filter`, `msnr-switch-fade`, `msnr-switch-complements`. Trades with the call do no better than against it; the
  moment of a switch adds nothing a plain fade or an old call does not.
- Daily structure agreeing with the call did not help either.
- Desks that require agreement with the call (Engulfing plan, the gold plan) lose trades for no measured gain. Changing a desk
  rule is the owner's decision: report the evidence, do not change it.

## 4. Distrust anything that lives at 20-23 UTC

- Restricting entries to 07-20 UTC made every switch cell worse: the fade's tilt sits near the daily roll, where mid quotes
  jump. A result concentrated in those hours must be checked on broker ticks (`fade-tick-exec`, `council/tick-probe.mjs`)
  before it is believed.

## 5. When asked to "tweak it until it passes"

- Do not search variants on years already read: one will clear by luck (`grid5-msnr-box`'s lucky cell failed on fresh data).
- The honest route, used in `msnr-switch-complements` (copy its `run.mjs` as a template):
  1. Pre-register a small fixed grid of complements, each named after the study it comes from; commit and push it ALONE.
  2. Select **after costs** on the old window only (n >= 300, after-cost mean > 0, month-sum t >= 2), at most three cells.
  3. Judge the selected cells once, after costs, on markets the line of studies never read (Holm over the selected), with the
     later years of the selection markets as a sign-only check.
  4. No eligible cell = FAIL; the holdout is reported but not judged. Nothing is re-selected after the holdout is read.
- Report every cell, the cut test (signals on candles cut at a date equal the full run's), stops on the losing side, and say
  which costs are assumed.

## 7. Pre-flight checklist: run it on any edge before testing or tuning

Stop at the first step a rule fails; each step names where the lesson came from.

1. **Cost R** from the rule's own stops (`research/proposals/2026-11-24-desk-cost-audit.mjs` for desk readings; `cost / risk` for
   a study). Median over 0.1R, or a heavy tail (90th percentile over 0.2R): widen the stop to the working chart's ATR or lengthen
   the target BEFORE judging the entry (switch studies).
2. **Before-cost R on 300+ trades.** Within about ±0.05R a trade: no stop, filter or exit will rescue it; drop it, do not tune
   (desk audit: 30 readings, none reaches t 1.3 after costs).
3. **Beat a control.** Compare with the same trigger without the special condition: an old call, a random time, every break, the
   other side. A rule that does not beat its control IS the control, whatever its own t (`msnr-switch-fade`'s best cell,
   `dom-placebo`, `usdjpy-vb-side-control-v2`).
4. **Hours.** If most of the R sits at 20-23 UTC, check it on broker ticks before believing it (switch complements, `fade-hour-check`).
5. **Direction gate.** If the rule requires the MSNR call (or the Daily side), run it without; expect no loss (four studies).
6. **Same entries, every exit in one pass**: `grid7-wide-fade` `exits(M5, s, fi, stop, targets, cap)` books 1R / 2R / 3R / a
   level at once, so stop and exit choices are compared on identical trades. Pick an exit on old years only; a target that looks
   best on one stretch often is not on the next (the Mosha barrier's best target flipped between 2026 and earlier records).
7. **Holdout once.** Select after costs on old years; judge once on markets or years the line of studies never read (section 5).
8. **Forward paper record** before anything else; a live rule needs the owner.

## 8. Adapting it, edge by edge

- **Gold and USD/JPY volatility breakouts** (the two that hold after costs): costs already measured (`*-hourcost`, `*-exec`,
  about 0.01-0.02R). Do not add filters: the H4 structure side (`vb-structure-filter`) and the macro score (`vb-macro-size`)
  failed. The only idea left from this line is the H4 switch as a size tilt, low prior. Keep the forward records running.
- **Engulfing desk**: the three-candle plan and short method lose after costs (-0.15R, n about 1,400 each); the next-candle
  versions sit at zero; the Daily engulf rule is the only positive reading (+0.127R, n 187, t 1.29), and it is the live Gold daily
  engulf family, already tested. The plan's Daily-side requirement is an MSNR-type gate (step 5).
- **Mosha desk**: the same barrier entries swing from -0.093R (1R target) to +0.012R / +0.069R (6R, tap / Janda) after costs:
  the target matters more than the entry there. Any target choice must be picked on old years and judged on a holdout (step 6),
  never on the desk's own months.
- **MSNR desk**: the gold plan loses (-0.257R, n 327); the 12-16 UTC scalp method looks positive (+0.074R) but already failed
  on 2010-19 (`msnr-main-6r`). Do not build on the direction call (section 3).
- **LIT desk**: small samples and the highest costs (the rule: median 0.148R); its smallest stop (0.014% of price) is the first
  thing to widen if it is ever tested.
- **The fade family**: the open test is a working-chart ATR stop (section 2), after costs, on unread data; check 20-23 UTC on
  broker ticks first (step 4).
- **ICT desk**: Fred's separate edge (absolute rule 4). The checklist's cost-R and control steps apply as ideas, but nothing
  here touches its files, reports or rules; offer them to its owner, never mix it into a council study.

## 6. Reusable pieces

- `research/edge/msnr-switch-fade/run.mjs`: `keyLevels` / `keyTarget` (nearest unbroken opposite turn of the closes one
  timeframe up, as an exit). It was worse than 2R after costs here: far targets are hit rarely.
- `research/edge/msnr-switch-complements/run.mjs`: signals with both stop types, hour and Daily-side flags, after-cost month
  sums by market, the selection-then-holdout `judge`. Ten markets run in about 15 seconds.
- Cache: `EDGE_DATA` + `research/edge/_lib/fetch-cache.mjs` (set `MD_BASE=https://aureumdesk.co.uk/md/` if the default host
  refuses; a 502 run can be resumed, finished years are skipped).

## What to do next, in order

1. Done 24 Nov 2026: the desk cost audit (above). Re-run `research/proposals/2026-11-24-desk-cost-audit.mjs` on fresh desk files.
2. The fade with a working-chart ATR stop, one pre-registered rule, after costs, on unread data.
3. Only then: the H4 switch candle as a size tilt on the gold / USD/JPY breakouts (low prior: about +0.03R after costs).

Never call any of this an edge without n and t; the only rules that hold after costs remain the gold and USD/JPY volatility
breakouts, whose forward records are running.
