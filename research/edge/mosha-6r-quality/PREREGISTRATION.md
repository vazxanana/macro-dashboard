# Mosha 6R barrier: can the better trades be told apart at the entry? (pre-registered 24 Nov 2026)

Written and committed alone, before any trade of this study was computed. Paper research only: nothing live reads it and no
rule of the desk or of the demo job changes.

## Why

The owner asked how to choose the better 6R barrier trades and avoid the bad ones. `research/edge/mosha-barrier-6r` found the
6R reading at zero before costs on gold 2010-2019 (+0.012R a trade, month t 0.86) and −0.161R after costs. A filter found by
looking at winners proves nothing, so the selection is CHOSEN on one stretch of years and JUDGED on a later one.

## Data and entries

OANDA mid gold candles from the edgekit cache (1-minute, 5-minute, daily; the other timeframes built from 5-minute candles as
`mosha-barrier-6r` does). The entries are the desk's own 6R reading through that study's exported `candles`, `entries(B, F, Y,
6)` and `placebo` (imported, not edited): the desk's code, its fills, stops, the 6R target and its own `outcome`. Gold only.

- **Discovery**: entries 2018-01-01 to 2021-12-31. (2018-19 were read by the earlier study in total and by timeframe,
  direction and year only.)
- **Confirmation**: entries 2022-01-01 to 2026-10-31. No barrier study has read these years for the 6R reading except the
  desk's own 2026 paper record.
- A trade still open at the end of its candles is left out and counted. Net R = R − 0.30 / r0 (the toolkit's gold cost).

## What is known at the entry (the features)

Each from the record or from candles CLOSED at or before the entry time; nothing later.

1. `tf`: the barrier's timeframe (`h`: 1d, 4h, 1h, 30m, 15m).
2. `kind`: sweep / eg / cf / vr / bo (from the id: `sw-`, `eg-`, `cf-`, `vr-`, else a BO or iBO origin).
3. `entry`: tap / janda / zone / repeat-SOP / level (`readings()` and the id's `j-`).
4. `dir`: with / against / none (`withDir`).
5. `visit`: first / later (`readings().visit`).
6. `cost`: 0.30 / r0 in four bands: up to 0.05, 0.05-0.10, 0.10-0.20, over 0.20.
7. `stopAtr`: r0 over ATR(14) of the closed H1 candles, in terciles whose cut points come from the discovery trades.
8. `session`: Asia 22-07, London 07-12, New York 12-21 UTC (as ChronosTrade's `bySession`).
9. `trend`: the trade's side against the last closed daily close vs its 50-day average: with / against.
10. `er`: the 20-day efficiency ratio of closed daily closes: under 0.2, 0.2-0.4, over 0.4.

## The selection rule (fitted on discovery only)

For every feature level with 300 or more discovery trades: its mean net R on discovery, shrunk toward the discovery mean of
all trades (weight n / (n + 500)). A level under 300 trades takes the overall mean. A trade's **score** = the mean of its ten
levels' shrunk values. Q80 and Q20 = the 80th and 20th percentile of the discovery scores. **Keep** = score at or above Q80;
**avoid** = score at or below Q20. The level values and both cut points are frozen before the confirmation trades are scored.

## Tests on confirmation (R after costs; t on calendar-month sums; Holm over the three)

- **T1 keep**: the kept trades make mean net R > 0 with month t >= 2, n >= 300.
- **T2 keep beats the rest**: per-trade Welch t of kept against not kept >= 2, AND the month-sum t of (kept mean − rest mean)
  by month is positive.
- **T3 avoid**: the avoided trades are worse than the rest, Welch t <= −2.

**Placebo**: (a) the kept trades with the side flipped (`placebo`) must not also pass T1; (b) 40 seeded shuffles of the
discovery net R across discovery trades, the rule refitted each time: the real T2 Welch t must exceed at least 38 of the 40.

**Verdict**: PASS = T1 and T2 pass with Holm p < 0.05 and both placebo checks hold. USEFUL-TO-AVOID (reported as a FAIL of the
edge question) = T1 fails but T3 passes with Holm p < 0.05: the rule names trades to skip without making the rest profitable.
FAIL otherwise. INCONCLUSIVE if fewer than 300 kept trades on confirmation.

## Reported beside, not judged

- Every feature level: n, net and before-cost R, month t, in BOTH windows, and whether its sign agrees. Levels negative with
  month t <= −2 in both windows are listed as "worst in both", levels positive in both as "best in both". These are
  descriptions; with about 30 levels some agree by chance.
- The kept and avoided groups before costs, win rate, by year, worst drawdown.
- A cut test on one year (entries before a moment unchanged when later candles are removed), as the earlier study ran.

One run. No other score, band, percentile or feature is tried on these years after it.
