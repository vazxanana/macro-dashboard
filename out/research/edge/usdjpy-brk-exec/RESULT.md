# The USD/JPY morning breakout (long) at the broker's bid / ask ticks (result)

**Verdict: PASS. At the broker's own bid and ask the USD/JPY morning breakout (long) made +0.250R a trade after commission (n 131, month t 3.3057). On mid candles the same orders made +0.252R; 0 of 131 had no quote to enter on.**

Run 2026-11-26 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rule is the auto-researcher's USD/JPY near-lead, found on these same years.

## What was run

Every order of the near-lead (an H1 close above the previous 10 highs and above the 200-hour average, bought at the next open when it is 07-12 UTC on a Tuesday, Wednesday or Thursday; stop 3 x ATR(14), target 3R, out after 8 H1 candles), 2023-12-01 to 2026-11-20.
Entry at the broker's ask (buy) or bid (sell); stop and target when the closing side reaches them; else the quote at the deadline.

| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R (engine cost) | Tick − mid (month t) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 131 | 0 | 0 | 131 | 61.8 % | +0.264 (3.4613) | +0.250 (3.3057) | +0.252 | +0.012 (6.0414) |

## Exits

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| stop | 23 | −1.019 | −1.033 | −1.016 |
| target | 1 | +3.000 | +2.965 | +2.959 |
| time | 107 | +0.514 | +0.500 | +0.499 |

## Inside the rollover or not

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 131 | +0.264 | +0.250 | +0.252 |

## By year

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 1 | −0.298 | −0.303 | −0.305 |
| 2024 | 46 | +0.333 | +0.319 | +0.324 |
| 2025 | 38 | +0.249 | +0.238 | +0.239 |
| 2026 | 46 | +0.220 | +0.202 | +0.201 |

## By side

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| buy | 131 | +0.264 | +0.250 | +0.252 |

Entry spread paid, in R: median 0, 90th percentile 0.0034. Exit-unresolved reasons: {}.

## What it means

The pre-registered verdict is PASS: every one of the 131 orders had a broker quote to enter on and every exit was resolved; at the broker's own bid and ask the rule made +0.250R a trade after commission (month t 3.31), the same as on mid candles (+0.252R). The cost is not what this result rests on: the stop is about 54 pips, the entry spread a small fraction of that, and no trade is open inside the 21:00-22:59 UTC rollover.
What the pass does not answer, as written before the run: the rule came out of about 554 million tries and missed the researcher's own bar for a lead (Holm p 0.067); these three years are inside the years it was found on; the Tuesday-to-Thursday filter may be luck (Monday and Friday together made 0.000R on the search data, every weekday +0.129R); USD/JPY rose over most of the window and the rule only buys; and it overlaps the USD/JPY breakout of the day, which already has a forward record. 107 of the 131 trades ended at the time limit (+0.50R on average) and 23 at the stop: the result is "USD/JPY kept rising for eight hours after a morning breakout", which a falling market would not give.
So: a candidate for a forward paper or demo record, to be judged on trades from now on. Not an edge, and no variant of the rule, hours or weekdays is to be tried on these years.
