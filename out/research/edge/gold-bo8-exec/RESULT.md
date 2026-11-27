# The gold 8-swing break (long) at the broker's bid / ask ticks (result)

**Verdict: PASS. At the broker's own bid and ask the gold 8-swing break (long) made +0.714R a trade after commission and financing (n 280, month t 4.0169). On mid candles the same orders made +0.739R; 2 of 282 had no quote to enter on.**

Run 2026-11-27 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rule is one of the auto-researcher's results (version auto-2), found on these same years.

## What was run

Every order of the rule (an H1 close above the last unbroken 8-a-side H1 swing high, bought at the next open; stop 0.75 x ATR(14), target 6R, out after 24 H1 candles), 2023-12-01 to 2026-11-20.
Entry at the broker's ask; stop and target when the bid reaches them; else the bid at the deadline. After costs = minus commission and the demo's overnight financing on a gold buy.

| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After costs (month t) | Mid R (engine cost) | Tick − mid (month t) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 282 | 2 | 0 | 280 | 29.3 % | +0.769 (4.2842) | +0.714 (4.0169) | +0.739 | +0.030 (2.7076) |

## Exits

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| stop | 197 | −1.047 | −1.083 | −1.062 |
| target | 59 | +6.000 | +5.913 | +5.952 |
| time | 24 | +2.815 | +2.687 | +2.709 |

## Inside the rollover or not

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 183 | −0.386 | −0.410 | −0.404 |
| open inside 21:00-22:59 | 97 | +2.947 | +2.835 | +2.895 |

## By year

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 7 | +2.985 | +2.841 | +2.911 |
| 2024 | 100 | +0.422 | +0.360 | +0.381 |
| 2025 | 100 | +1.128 | +1.073 | +1.086 |
| 2026 | 73 | +0.540 | +0.505 | +0.545 |

## By side

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| buy | 280 | +0.769 | +0.714 | +0.739 |

Entry spread paid, in R: median 0.0104, 90th percentile 0.0314. Exit-unresolved reasons: {}.

## What it means

- **The broker's own prices do not remove this result.** Filled at the demo broker's ask and closed at its bid, after commission and
  overnight financing, the 280 resolved orders made +0.714R a trade (month t 4.02), against +0.739R on mid candles. Entry spread is
  about 0.01R (median), financing about 0.03R a trade: the stop (median $6.34) is large against the cost. Only 2 of 282 orders had no
  quote to enter on, and no exit was unresolved.
- **It does not rest on a handful of trades only.** The ten best trades carry 60R of the 200R total; without them the mean is
  +0.52R, without the best twenty +0.31R. 29 % of trades win; 59 of 280 reach the 6R target. Every year is positive (2024 +0.36R,
  2025 +1.07R, 2026 to date +0.50R).
- **What the pass cannot answer.** The rule was picked as one of the best of about 4 million looks of the researcher (version auto-2)
  on these same years, so its size is expected to shrink forward. It buys gold only, in years gold rose sharply: part of it is the
  drift that every long gold rule here has shown. The split "open inside the 21:00-22:59 UTC rollover or not" (+2.84R against
  −0.41R) is not a finding: a trade that is still open at the rollover is one that has not been stopped, so the split sorts winners
  from losers after the fact.
- **Not an edge.** A candidate for a forward paper record from 27 Nov 2026, nothing more; no variant of the rule, stop or target on
  these years. Nothing live changed.
