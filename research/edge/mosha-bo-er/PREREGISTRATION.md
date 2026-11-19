# Mosha BO: the Daily regime filter, a market entry on the confirmation, and where the confirmation forms (pre-registration, 13 Nov 2026)

Written and committed alone, before any trade of this study was simulated or split. Paper research only: no live rule, size,
filter, stop, config or council member changes, whatever the result. A pass produces a proposal for the owner, nothing else.

## Why

The live Mosha BO (`council/trader.mjs`, `k: 'mosha-bo'`, a paper shadow since 11 Nov 2026) is a chain: an H4 break of
structure in a direction, then an H1 break the other way after it (the pullback), then an M15 break back with the H4 (the
confirmation), entered by a limit at the M15 level that broke, stop $0.30 past the M15 break's origin, the weekly structure
agreeing. The owner's course material, described here in the study's own words, makes two claims this repository has never
tested: (1) the sequence pays only when the weekly agrees AND the Daily is not ranging, read as a 20-day efficiency ratio of
daily closes of at least 0.2; (2) entering at market when the confirmation candle closes beats waiting for a deep pullback limit
(the deep limit fills being the worst trades). A third reading, whether the confirmation formed back inside the range of the
pullback's reversal ("case 2"), is described only.

## Data and harness (fixed)

- OANDA mid gold candles M5, M15, H1, H4 from 1 Jun 2019 and D1 from 1 Jan 2016 to the last closed candle at fetch time,
  read through the site's candle proxy (`/md/bars`), cached outside git.
- The trades are made by the replay of `research/edge/mosha-oos/run.mjs` (the live block line for line on the live windows of
  720 candles, one run 4 minutes after every M5 close, the live management loop on M5 candles), loaded from that file's own text
  (the file is not edited) and run as it is for the live arm. **Parity gate**: the study's replay of the live arm must equal, leg
  for leg, the replay that `mosha-oos/run.mjs replay` itself writes on the same candles; otherwise nothing is reported.
- Window: positions whose first unit filled 2020-01-01 up to the end of the candles. First half = fills 2020-01-01 to
  2023-12-31, second half = 2024-01-01 to the end.
- A position = the first unit plus its add (as live). Net R = gross R, less $0.30 a unit round trip (cost / r0 of the unit),
  less overnight financing on BUY units: `nights(fill, close) x FIN.xau.long x entry / r0` from `council/fills.mjs` (imported),
  per unit, times its size. Sells pay and are credited nothing. Every unit has its stop.
- Only the system's own trades count (records the live rules would take: not blocked by the weekly filter, the cap, the price
  check or the slow-arrival rule).
- The trades are NOT taken from `research/edge/cycle-gate` (its Mosha BO stream is the HistData robustness rebuild, which holds
  only time, side and R, so no entry can be changed on it). Its statistics helpers (`welch`, `maxDD`, `splitStats`, `placebo`)
  are imported unchanged.

## Arm A: the Daily regime split (primary test 1)

- Daily candles: 17:00 New York trading days built from the H1 candles (`research/edge/gold-drd-long` `days`, imported; Sunday
  evening hours fold into Monday, Saturday dropped). Why 17:00 New York and not UTC: it is gold's own trading-day close (the
  daily candle the owner's charts and the course read), it has no Sunday stub (the UTC Sunday candle of about 2 hours broke the
  Gold daily engulf, `research/edge/gold-weekend`), and it is the boundary of the earlier Daily-ER study (`gold-drd-er`).
- ER20 at the signal = `gold-drd-er` `er` (imported): |close(i) - close(i-20)| / sum of |close(k) - close(k-1)| over the 20
  closes up to and including day i, where day i is the LAST day that had CLOSED at the order's time (its successor's first H1
  candle started at or before that time). No forming day is read.
- Kept = ER20 >= 0.2, blocked = ER20 < 0.2, on the live arm's positions.
- Pass, all of: (a) kept R a position above all positions' R a position in BOTH halves; (b) kept vs blocked Welch t >= 2 on
  positions; (c) Welch t >= 2 on calendar-month sums, kept stream against the unfiltered stream (every calendar month of the
  window, 0 for a month with no position); (d) Holm-adjusted one-sided p of (b) <= 0.05 over the two tests A and B; (e) the
  kept stream's worst closed drawdown no deeper than the unfiltered stream's; (f) at least 30 kept and 10 blocked; (g) placebo:
  40 seeded random splits blocking the same number of positions (`cycle-gate` `placebo`, seed 7); the real (b) t must be above
  the placebo's 95th percentile t.

## Arm B: market on the confirmation close vs the live limit (primary test 2)

- Live arm: as live (limit at the M15 broken level, valid 24 h, cancelled when price reaches the target first or fill and target
  in one candle; the replay's own rules).
- Market arm: the same replay, the same chains, the same blockers, the same cap of 2 (counted on the arm's own trades), but the
  order is filled at the CLOSE of the last M5 candle closed at the run: at the first run that sees the confirmation this is the
  close of the M15 confirmation candle itself. Managed from the next M5 candle.
- **The stop is the live stop price** (the same level, $0.30 past the M15 break's origin): never moved further. The opening
  risk r0 = |market entry - that stop|, larger than the limit's whenever price closed beyond the broken level. Every R-based
  rule is measured in that r0, exactly as live measures it in its own: target cap 10R, break-even and the add at +1.5R, the
  trail of 1R from +3R, out after 72 hours. A market entry on the wrong side of the stop is not taken (counted).
- Pass, all of: (a) market R a position above the limit arm's in BOTH halves; (b) Welch t >= 2 on positions (market vs limit);
  (c) Welch t >= 2 on calendar-month sums (market vs limit, every month of the window); (d) Holm p <= 0.05 (with A);
  (e) market worst closed drawdown no deeper than the limit arm's. No placebo (two different entries, not a split).

## Arm C: where the confirmation forms (descriptive only, no test, no verdict)

- The pullback's reversal range (the VR): from the H4 move's extreme (highest high for a buy, lowest low for a sell, on the H1
  window, from the H4 break to the H1 break against it) to the level the H1 break against took. "Case 2" = the M15 confirmation's
  broken level lies inside that range (back inside the box); the rest = beyond it (the pullback went deeper than the box). Both
  arms' positions are split and shown with n, R a position per half and t. Never a filter, never counted in Holm.

## Verdicts

PASS for an arm only when every one of its rules holds. Otherwise FAIL, with the rules it missed. Never called an edge without n
and t; a pass is a proposal (`research/proposals/2026-11-13-mosha-bo-er.md`) for the owner, not a live change. 2020 -> now is
partly in sample for Mosha BO (its weekly filter and exits were chosen on 2019-26): that is said beside any result.
