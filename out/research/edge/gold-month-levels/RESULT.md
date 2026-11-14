# Result: gold's previous calendar month high and low (14 Nov 2026)

**Verdict: FAIL, 0 of 3 tests: no rule at last month's high / low reaches t 2 after Holm (best Holm p 0.06), and random levels near them do as well.**

PREREGISTRATION.md was committed and pushed before any number was computed. A stand-alone rule on gold: not a gate, exit,
entry or size of the live gold book (owner decision 44 untouched). Not an edge; nothing live changed and no proposal is written.

Data: council-data `research/daily/xau.json` (OANDA mid, UTC days, weekends folded with `foldWeekend`), 2006-03-20 to
2026-11-06, 247 months with a previous month on file. Net of $0.60 a round trip and financing on buys (`FIN.xau.long`).
In sample 2008-16, out of sample 2017 to 6 Nov 2026. t on calendar-month sums; Holm over the three tests.

| Test | IS n | IS R gross | IS R net | IS month t | OOS n | OOS R gross | OOS R net | OOS PF | OOS month t | Holm p | 2x costs OOS | Placebo beaten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 raid-reversal | 81 | +0.093 | -0.020 | -0.11 | 80 | +0.259 | +0.145 | 1.21 | 0.55 | 0.3173 | +0.031 | 27 of 40 |
| T2 break-continuation | 77 | +0.272 | +0.210 | 1.41 | 83 | +0.230 | +0.148 | 1.33 | 1.00 | 0.3173 | +0.066 | 22 of 40 |
| T3 break-continuation, longs only | 42 | +0.467 | +0.370 | 1.59 | 52 | +0.553 | +0.435 | 2.14 | 2.06 | 0.0591 | +0.317 | 29 of 40 |

Checks that failed: T1 (t, in-sample net, OOS halves, placebo); T2 (t, OOS halves, placebo); T3 (t after Holm, placebo).

- **T1, raid and close back inside, does not reverse.** In sample it loses (-0.020R a trade net, 81 trades); out of sample
  +0.145R (n 80, t 0.55), all of it in 2017-21 (+0.290R) and -0.040R since 2022. Only 7 of 161 trades reached the other
  side of last month's range; most were stopped (99) above a median stop of $15-19. Its sells lost in sample (-0.540R, n 43).
- **T2, a close beyond the level, follows gold's trend, not the level.** Buys +0.370R in sample and +0.435R out of sample,
  sells +0.018R and -0.334R. Out of sample 2017-21 lost (-0.163R a trade, n 42); 2022 on made +0.467R (n 41).
- **T3, the long breakout, is the nearest miss and it is gold's bull market.** OOS +0.435R a trade (n 52, month t 2.06,
  Holm p 0.059), +0.370R in sample (n 42, t 1.59), and still +0.317R at 2x costs. But 2024-26 made +26.4R of its +22.6R
  out of sample; 2017-23 summed -3.7R and the first OOS half was +0.050R (n 24). Random levels at the same distance from
  the month's open (+/-30 %) gave a median of +0.382R on the same rule: it beat only 29 of 40 seeds. Buying any close
  above a level near last month's high in a rising gold market did about as well.
- **First touch from inside** (descriptive, not tested): of the first touches of PMH / PML in a month, 54 % (in sample,
  n 101) and 59 % (out of sample, n 103) closed beyond the level. After a close beyond, the next 10 days moved +0.41 % /
  +0.31 % further beyond on average; after a close back inside, -0.65 % / -0.29 % (back towards the range). Small, and
  in the direction of the day's own close: no sign the level itself does more than that.
- Year by year, net R: T1 positive in 8 of 19 years, T2 in 11, T3 in 11 (T3: +8.4R 2024, +14.0R 2025, +3.9R 2026).

Not tested: an intraday entry at the level, other markets, the previous quarter's or year's levels. Any follow-up needs its
own pre-registration on other data; do not re-run these rules on gold's 2008-26 days with another stop, hold or filter.

To repeat: `git show origin/council-data:research/daily/xau.json > <file>` (keep it out of git), then
`node research/edge/gold-month-levels/run.mjs <file>`. Tests: `tests/gold-month-levels.test.mjs`.
