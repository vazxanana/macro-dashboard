# Result: the Daily-regime filter on the weekly-bull daily rejection long (12 Nov 2026)

**Verdict: FAIL** on the pre-registered bar (PREREGISTRATION.md, pushed before any number was computed). On March 2006 to
October 2022 the signals taken on a trending Daily (20-day efficiency ratio >= 0.2) made more than the ones on a choppy Daily,
but not measurably more: +0.139R a trade, Welch t 1.29 (the bar was t >= 2). The other two checks passed: the filtered rule is
profitable in both halves, and its worst drawdown is much smaller.

| Long, 0.70, 3R, net of $0.35 | n | R a trade | PF | Worst drawdown |
|---|---|---|---|---|
| 2006 - Oct 2022, every signal (gold-drd-long) | 910 | +0.141 | 1.22 | -77.4R |
| the same, ER20 >= 0.2 (the filter) | 496 | +0.204 | 1.33 | -30.9R |
| the same, ER20 < 0.2 (what the filter skips) | 414 | +0.065 | 1.10 | -68.6R |
| ER20 >= 0.2, 2006 - 2019 | 401 | +0.202 | 1.33 | -30.9R |
| ER20 >= 0.2, 2020 - Oct 2022 | 95 | +0.214 | 1.35 | -18.5R |
| Nov 2022 - now, ER20 >= 0.2 (the skill's window, not judged) | 177 | +0.619 | 2.23 | -9.3R |

- **Checks**: (1) filtered minus skipped +0.139R, t 1.29: **not met**; (2) PF > 1 in both halves (1.33, 1.35): met; (3) worst
  drawdown -30.9R against -77.4R: met. All three were required.
- **The difference is not stable**: in 2006-19 the filter's side is ahead by +0.18R (t 1.55), in 2020-Oct 2022 it is BEHIND by
  -0.10R (t -0.38: the choppy-Daily signals did better there, PF 1.56), and in the skill's window the two are even (+0.06R, t 0.29).
- **It does help the bad years**: the losing stretch of 2012-19 goes from -47.4R to +13.3R summed, and 2012, 2018 and 2019 turn positive. It also
  gives up good years (2007: +44R to +5R; 2022 turns negative).
- **Most of what it skips is cost, not loss**: on every bullish-week day (the baseline) the filter's side is +0.05R ahead (t 0.72),
  so ER barely separates days on its own.
- Reported, not tested: ER20 >= 0.3 (326 trades, +0.303R, PF 1.51, worst drawdown -19.4R on 2006-Oct 2022; 2020-22 +0.321R)
  and the signed ER (>= 0.2 and the close above its value 20 days earlier: +0.223R, PF 1.36, -22.5R). Both look better, but
  they were chosen after gold-drd-long's yearly pattern and are not tested here: any use needs its own pre-registration on other
  data.
- Caveat (as before): each signal is its own trade, so trades overlap and the t values treat them as independent.

What it means for the playbook: the Daily-regime filter is a reasonable risk tool on this rule (it roughly halves the drawdown on
2006-22 for a smaller loss of trades than of drawdown), but it is not shown to pick better trades, and the 2020-22 years went the
other way. Not an edge, not a council rule; nothing live changed and no proposal is written. The `#gold` view's ER tile stays
guidance, as its card says.

To repeat: the candles from `node --use-env-proxy research/edge/gold-drd-long/run.mjs fetch <dir>`, then
`node research/edge/gold-drd-er/run.mjs full <dir>`. Tests: `tests/gold-drd-er.test.mjs`.
