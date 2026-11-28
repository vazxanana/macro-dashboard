# The EUR/JPY engulf-retest sell at the broker's bid / ask ticks (result)

**Verdict: PASS. At the broker's own bid and ask the EUR/JPY engulf-retest sell (lead 1) made +0.409R a trade after commission and swap (n 106, month t 4.6905). On mid candles the same orders made +0.364R; 0 of 106 had no quote to enter on.**

Run 2026-11-28 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rule is one of the auto-researcher's leads (version auto-3), found on these same years.

## What was run

Every order of lead 1 (the first return to a standing H1 engulf zone up to 48 candles old that closes back out, sold at the next open at 10-15 UTC when the ATR is in the top 70 %; stop 0.75 x ATR(14), target 1.5R, out after 24 H1 candles), 2023-12-01 to 2026-11-20.
Entry at the broker's bid; stop and target when the ask reaches them; else the ask at the deadline. After costs = minus the demo's commission and its overnight swap on a EUR/JPY short.

| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After costs (month t) | Mid R (engine cost) | Tick − mid (month t) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 106 | 0 | 0 | 106 | 58.5 % | +0.453 (5.1427) | +0.409 (4.6905) | +0.364 | +0.089 (1.9006) |

## Exits

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| stop | 44 | −1.022 | −1.062 | −0.991 |
| target | 62 | +1.500 | +1.454 | +1.325 |

## Lead 2 beside it (no verdict)

The 12-candle-zone sell (07-18 UTC, out after 96 candles): 176 orders, 0 without an entry quote, 0 exit unresolved; after costs +0.347R a trade (n 176, month t 5.0822), on ticks before costs +0.395R, mid +0.325R.

## Inside the rollover or not

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 97 | +0.462 | +0.421 | +0.365 |
| open inside 21:00-22:59 | 9 | +0.364 | +0.278 | +0.347 |

## By year

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 3 | +0.663 | +0.625 | +0.613 |
| 2024 | 34 | +0.390 | +0.352 | +0.426 |
| 2025 | 41 | +0.458 | +0.415 | +0.231 |
| 2026 | 28 | +0.501 | +0.447 | +0.457 |

## By side

| | n | Tick R | After costs | Mid R |
|---|---:|---:|---:|---:|
| sell | 106 | +0.453 | +0.409 | +0.364 |

Entry spread paid, in R: median 0.0043, 90th percentile 0.0294. Exit-unresolved reasons: {}.

## What it means

**A candidate for a forward paper record, not an edge.** The pre-registered test passed: at the broker's own bid and ask, after
its commission and the swap on a short, lead 1 made +0.409R a trade (n 106, month t 4.69), every order quoted and resolved.
The broker's prices did not hurt it: the median entry spread was 0.004R (a raw-spread account quotes EUR/JPY near bid = ask) and
the swap 0.005R a trade, against a 19-pip stop. Tick R ran 0.09R above the mid figure; most of that is the engine's 0.01 yen cost,
which the mid figure carries and the tick figure replaces with the real, smaller costs.

What the pass does not answer, said plainly:

- The rule was picked as one of the best of about 1.1 million check looks on these same years (2021 to now). The tick years
  (Dec 2023 to Nov 2026) are inside them. A pass here shows the result is not a mid-candle artefact; it is not new evidence that the
  rule works.
- It is one market, one side (sells), and one combination of zone age, hours and volatility found together. EUR/JPY fell from its
  highs in parts of these years; a sell-only rule can ride that.
- Lead 2, the same idea with other settings, passes the same way (+0.347R, n 176, month t 5.08). They overlap: read them as one
  candidate, not two.
- 106 trades over three years is about three a month: a forward record needs a year or more before it can say anything.

Proposed next (the owner's choice): a forward paper record from the first complete day after this study, on the same rule, with
the bands of these trades; no demo or live order without the owner.
