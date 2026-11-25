# The USD/CHF fade (short, 20-22 UTC) at the broker's bid / ask ticks (result)

**Verdict: TOO FEW. At the broker's own bid and ask the USD/CHF fade (short, 20-22 UTC) made −0.034R a trade after commission (n 94, month t -0.2464). On mid candles the same orders made +0.225R; 33 of 127 had no quote to enter on.**

Run 2026-11-25 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rule is the auto-researcher's second lead, found on these same years.

## What was run

Every order of the lead (an H1 close above the previous 5 highs, sold at the next open when it is 20, 21 or 22 UTC; stop 0.75 x ATR(14), target 1R, out after 12 H1 candles), 2023-12-01 to 2026-11-20.
Entry at the broker's ask (buy) or bid (sell); stop and target when the closing side reaches them; else the quote at the deadline.

| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R (engine cost) | Tick − mid (month t) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 127 | 33 | 0 | 94 | 53.2 % | +0.011 (0.0803) | −0.034 (-0.2464) | +0.225 | −0.214 (-2.3104) |

## Exits

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| stop | 43 | −1.138 | −1.184 | −0.526 |
| target | 50 | +1.000 | +0.957 | +0.878 |
| time | 1 | −0.036 | −0.080 | −0.108 |

## Inside the rollover or not

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 14 | +0.278 | +0.234 | +0.345 |
| open inside 21:00-22:59 | 80 | −0.036 | −0.081 | +0.204 |

## By year

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 3 | +0.333 | +0.296 | −0.399 |
| 2024 | 29 | −0.421 | −0.469 | +0.018 |
| 2025 | 33 | +0.143 | +0.102 | +0.286 |
| 2026 | 29 | +0.260 | +0.213 | +0.427 |

## By side

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| sell | 94 | +0.011 | −0.034 | +0.225 |

Entry spread paid, in R: median 0, 90th percentile 0.2717. Exit-unresolved reasons: {}.

## What it means

The pre-registered verdict is TOO FEW: 33 of the 127 orders had no broker quote to enter on (the 21:00-22:59 UTC rollover is when this broker does not quote USD/CHF), which left 94 resolved, under the 100 fixed before any tick was read. Nothing was re-defined after the result.
In substance it is the same answer as the first USD/CHF lead: on mid candles the 94 orders made +0.225R, at the broker's own bid and ask they made +0.011R before commission and −0.034R after (month t −0.25). The tick minus mid difference is −0.214R a trade (month t −2.31): the broker's quotes take away the whole of the mid-candle result. The 14 orders that were never open inside the rollover made +0.234R after commission, too few (n 14) and picked after looking: not a rule.
So the auto-researcher's two leads are both mid-candle results that the broker's quotes remove. No forward record and no variant on these years. A lead of the auto-researcher must be re-priced at the broker's quotes before anything else, and a lead that trades through the rollover is unlikely to survive it.
