# ISL engulf zones against plain engulf zones, H4 and H1, 2020 to now

**Verdict: FAIL. 0 of 4 tests pass: the ISL-qualified engulf zone loses after costs in both windows (best confirmation, H4 with a 2R target: n 4,209, -0.0067R a trade, month t -0.27).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed alone first). Research only: nothing live changed. Never call
any figure below an edge; descriptive numbers are labelled.

## The four tests (18 markets pooled, R a trade after costs, month t = calendar-month sums)

| Test | Discovery 2020-2023 | Confirmation 2024-now | At 2x cost | Holm |
|---|---|---|---|---|
| H4, 2R | n 5,774, -0.0551R, t -3.21 | n 4,209, -0.0067R, t -0.27 | -0.0504R | 1 |
| H4, trail | n 5,774, -0.0507R, t -3.48 | n 4,209, -0.0365R, t -2.09 | -0.0802R | 1 |
| H1, 2R | n 21,789, -0.0552R, t -4.80 | n 15,617, -0.0350R, t -1.96 | -0.1159R | 1 |
| H1, trail | n 21,789, -0.0452R, t -5.43 | n 15,617, -0.0341R, t -2.08 | -0.1150R | 1 |

Every test is negative in discovery, so none reaches confirmation; all four fail the bar.

## Beside each test: the same trade on every plain engulf zone (reported, not part of the bar)

| | Plain, discovery | Plain, confirmation | Qualified minus plain, discovery | Qualified minus plain, confirmation |
|---|---|---|---|---|
| H4, 2R | n 26,870, -0.0405R, t -4.19 | n 19,109, -0.0259R, t -1.70 | -0.0146R, Welch t -0.72 | +0.0192R, Welch t 0.79 |
| H4, trail | n 26,870, -0.0171R, t -1.95 | n 19,109, -0.0309R, t -2.90 | -0.0337R, Welch t -1.85 | -0.0057R, Welch t -0.27 |
| H1, 2R | n 101,122, -0.0703R, t -13.08 | n 72,747, -0.0601R, t -9.87 | +0.0151R, Welch t 1.42 | +0.0251R, Welch t 1.96 |
| H1, trail | n 101,122, -0.0682R, t -13.13 | n 72,747, -0.0577R, t -11.74 | +0.0229R, Welch t 2.38 | +0.0235R, Welch t 2.02 |

The two samples overlap (a qualified zone is also a plain zone, entered later and sometimes on a stepped candle), so the Welch t
is descriptive. On H1 the qualification loses about 0.02R a trade less than every engulf zone in both windows; on H4 there is
no consistent difference. Losing less is not a profit: the qualified H1 zones are still about -0.035R a trade after costs and
about -0.115R at twice the cost.

## Descriptive (not tested)

Pooled, confirmation 2024-now, R a trade after costs (n, mean, month t):

| Set | H4 2R | H4 trail | H1 2R | H1 trail |
|---|---|---|---|---|
| Plain | 19,109, -0.0259, -1.70 | 19,109, -0.0309, -2.90 | 72,747, -0.0601, -9.87 | 72,747, -0.0577, -11.74 |
| ISL A + two breaks (tested) | 4,209, -0.0067, -0.27 | 4,209, -0.0365, -2.09 | 15,617, -0.0350, -1.96 | 15,617, -0.0341, -2.08 |
| ISL B + two breaks | 8,180, -0.0390, -2.12 | 8,180, -0.0449, -3.20 | 29,931, -0.0382, -2.58 | 29,931, -0.0425, -3.46 |
| Two breaks, no sweep | 10,122, -0.0391, -2.24 | 10,122, -0.0438, -3.16 | 38,801, -0.0345, -2.64 | 38,801, -0.0374, -3.31 |
| Sweep A failed | 11,493, -0.0418, -2.68 | 11,493, -0.0364, -2.94 | 44,289, -0.0674, -7.72 | 44,289, -0.0671, -8.98 |

- On H1 the improvement over plain comes from waiting for the two breaks (two breaks alone: -0.0345R / -0.0374R), not from the
  sweep: variant A and variant B with the same two breaks are within noise of "two breaks, no sweep".
- Qualified (A) against the zones whose sweep failed (traded as plain zones), confirmation: H4 2R +0.0351R (Welch t 1.37), H4
  trail -0.0001R (t -0.01), H1 2R +0.0324R (t 2.40), H1 trail +0.0330R (t 2.69). The failed-sweep set is defined at the
  completing close (no look-ahead); the pre-registration's "zones not qualified" was first coded as "never qualified later",
  which the cut test showed knows the future, and was replaced before the report.
- **Gold alone** (ISL A + two breaks): H4 2R discovery n 308, -0.1354R (t -1.39), confirmation n 213, +0.0632R (t 0.58); H4 trail
  -0.1928R (t -2.42) / +0.0748R (t 0.66); H1 2R n 1,159, +0.0359R (t 0.75) / n 837, +0.0308R (t 0.74), -0.0158R at twice the
  cost; H1 trail +0.0223R (t 0.64) / +0.0331R (t 0.75). Plain gold zones: H1 2R -0.0702R (t -3.12) / -0.0047R (t -0.19). Too
  few and too weak to call anything; gold's H1 figures are in sample on these years.

## Checks and data

- Cut test (orders known before a cut unchanged when later candles are removed, 16 cuts between March and July 2023): gold 6,272
  H4 and 22,474 H1 orders, EUR/USD 5,954 and 22,550, 0 mismatches. The plain zones equal `combo-grid` `egZones(L, 3)` zone for zone.
- Trades whose fill fell in a data-quality exclusion were dropped (usdjpy 101, usdchf 96, xag 203; none on the eight 2019-on
  markets, which have no exclusion list). Orders risking under two round-trip costs were skipped: 4,074 on silver (its assumed
  $0.03 round trip against small H1 zones), 141 on EUR/GBP, under 25 elsewhere.
- Candles to 22-23 Nov 2026 (OANDA mid 5m, about 545,000-577,000 a market; DE40 475,000).

## What it means

Neither reading of the notes' "the base swept the candle before it" picks better engulf zones. Waiting until the move away
has wick-broken two close turns before taking the first touch loses a little less on H1 than taking every zone, but every
version loses after costs in both windows. Do not test more ISL variants on 2020-2026. The notes' historical-reaction weight and
the second-movement refinement inside a higher zone were not coded.

To repeat: `node research/edge/isl-engulf-2020/run.mjs market <m> <dir>` for the 18 markets (a few seconds each), then
`… report <dir>`; `… cut xau`.
