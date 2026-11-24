# Pre-registration: gold-vb-exit (24 Nov 2026)

Paper research only. A **robustness** reading of gold's T1 volatility breakout (UTC open ± 0.5 × the previous weekend-folded
day's range, stop back at the open, out at 21:00 UTC; the Gold breakout desk on Equinox) at the demo broker's **measured hourly
cost**: the twin of `research/edge/usdjpy-vb-exit` for gold. That study found USD/JPY T1 net positive at every exit it read
(12:00 / 15:00 / 18:00 UTC and the 17:00 New York day), 15:00 the best-looking. This study asks the same of gold.

Written and pushed alone, before any figure of gold T1 at an exit other than 21:00 UTC was computed **under this cost**.

## Question

Is gold T1 net positive after `gold-vol-breakout-hourcost`'s cost C1 (frozen) when it exits at 12:00, 15:00, 18:00 UTC or at the
end of a 17:00 New York trading day, in BOTH 2007-2015 and 2016-2026, against the rule's 21:00 UTC exit?

## What was already seen (said before the run)

- `gold-vol-breakout-k` (20 Nov 2026) read exits 16:00, 18:00, 24:00 UTC and the 17:00 New York day at the older flat $0.60 cost:
  18:00 +0.063R (pooled, t 2.93), the 17:00 New York day +0.019R (t 0.91, gross +0.102R). So **18:00 and the New York day have
  been seen**, at another cost. 12:00 and 15:00 have not been read on gold at any cost.
- `holdout-vb-early` and `vb-early-exec` read the early-fill split (fill candle before 06:00 UTC) on gold at the 21:00 exit
  (in-sample gold fills 00-03 UTC +0.34R; broker fills 2023-26 early +0.44R, late +0.07R). So **early × 21:00 has been seen**.
- Every window below has been read at the rule's settings. Nothing here is new evidence for the rule; it reports how much the
  rule's result depends on its exit time.

## What this study is NOT

- **It does not choose a new exit, anchor or session filter.** The tested rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC,
  every fill time. A setting that looks better here is NOT adopted and is not proposed; it would need its own pre-registration on
  untouched data (OANDA gold M5 from 2006 is read in full).
- k is fixed at 0.5. No gate, filter or size of any council system; no council member, desk, rule or config reads this study.
  Nothing live changes.

## The rule and the cost (imported, unchanged)

- Rule: `research/edge/gold-vol-breakout-hourcost/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f,
  the verbatim copy of `gold-vol-breakout`'s `run.mjs`): `buildDays`, `daySkip`, `vbTrade`, `placeboTrade`, `monthT`, `normP`,
  `holm`, `rng`. Day building and the slippage base from `gold-vol-breakout-hourcost/costs.mjs` (sha256
  c753937339a0e5531c011bb4ed6473a1e4f9682e28c203cac20152f7891c922a): `daysOf`, `medRange`, `tradesIn`, `stats`. The candles of an
  exit other than 21:00 come from `gold-vol-breakout-k/run.mjs` `load` / `barsFor` (the full UTC day's candles that START before
  the exit, as that study did), and the 17:00 New York days from its `buildNyDays` / `nySkip`. None of these files is edited.
- Cost **C1, frozen** = `gold-vol-breakout-hourcost`'s route H + 0.05 × M, from its committed `result.json` (sha256
  fd5990419496374fd1d7c1791f778bd250d1b350064e7386d18de8a82b38325b): per trade, half the median quoted spread share of the fill
  hour + half that of the exit hour + commission 0.000024 of the entry, plus 0.05 × M (M = median high − low of the 12 M5 candles
  ending with the fill candle, `medRange`), in R; plus the trade's own financing `finR` (a buy held over the 22:00 UTC rollover;
  no UTC exit here holds over it, a 17:00 New York day can). The **exit hour** is the UTC hour of the last candle of the window:
  20 for 21:00 (hourcost's own `EXIT_HOUR`), 17 for 18:00, 14 for 15:00, 11 for 12:00, and for a 17:00 New York day the UTC hour
  of (anchor + 21 h − 5 min). A stop exit is charged the same exit hour (as hourcost did). **2x cost** = twice the C1 cost and
  twice the financing.

## Data

OANDA mid XAU/USD M5, rows `[t, o, h, l, c]`, the research toolkit's cache (`research/edge/_lib/edgekit.mjs` `DATA_DIR`, folder
`xau`, files `5m-2006.json.gz` … `5m-2026.json.gz`, kept out of git), cut to 2006-11-01 ≤ t < 2026-11-14 (hourcost's file span;
the loader drops the last, forming day, so the data end is **2026-11-12**: no day of the gold forward record, which starts
13 Nov 2026, is read). Windows: **early** 2007-01-01 → 2015-12-31, **late** 2016-01-01 → 2026-11-12, **pooled** = both.

## Harness gate (before any other figure is read)

1. At the rule's 21:00 exit and 00:00 UTC day, C1 must reproduce `gold-vol-breakout-hourcost`'s published C1 grid
   (`grid.H["0.05"]`) **exactly** in every one of its windows (2007-11, 2012-15, 2016-20, 2021-26, pooled 2007-26): n, net R,
   gross R, total, month t, gross month t (checked once on 24 Nov 2026 while choosing the data: it does, 3,713 trades,
   +0.139R, t 6.47).
2. The exit-filter path (`barsFor` with the full day's candles, forced with exit 21:00 − 1 s) must give, trade for trade, the
   same trades as the rule's own candles.

If either fails, the study stops and reports the difference.

## 1. Exit-time sweep (k 0.5, 00:00 UTC day)

Exits at the close of the candle ending **12:00, 15:00, 18:00 and 21:00 UTC** (the rule). The day's candles from 00:00 UTC up to
the exit are handed to `vbTrade`, so both the order window and the hold end at the exit. Eligible days are the original's
(`daySkip` on the 00:00-20:55 candles) for every exit.

## 2. Day anchor (k 0.5)

The trading day from 17:00 New York to 17:00 New York, `gold-vol-breakout-k`'s `buildNyDays` / `nySkip` (open within 1 hour of the
anchor read inclusively, the main figure; strict reading reported), orders and hold for 21 hours from the anchor, dated and
windowed by the New York trading date. Charged C1 as above.

## 3. Pre-registered combinations (exactly these four, no others)

**Early fills only × each UTC exit**: the T1 trades at exit 12:00, 15:00, 18:00 and 21:00 whose fill candle starts before
06:00 UTC (`fillMin < 360`; the split of `holdout-vb-early` / `vb-early-exec`; equal to cancelling both orders at 06:00 UTC).
All four are tested, whichever exit looks best in section 1: no combination is picked after looking. Each is reported beside
the late fills (06:00 on) at the same exit and the Welch t of early minus late (reported only).

## 4. Reading (fixed now)

Alternatives = exits 12:00, 15:00, 18:00 and the 17:00 New York day (inclusive open).

- **BROAD** if (a) net R a trade > 0 at all four alternatives in the early AND the late window, and (b) pooled month t
  (calendar-month sums of net R) ≥ 2 at 3 or more of the four.
- **FAIL** if pooled net R ≤ 0 at 2 or more of the four alternatives, or no alternative reaches pooled month t ≥ 2.
- **NARROW** otherwise.

**Holm** over all 8 tests (the four alternatives and the four combinations), each a one-sided p from its pooled month t
(`normP`). A combination **holds** if its pooled net R > 0, its net R > 0 in both windows, and its Holm p < 0.05. The
combinations are reported as "n of 4 hold" beside the label; they do not change it, and a combination that holds is a
hypothesis, not a rule.

Reported for every setting and window: n, win rate, net and gross R a trade, net R at 2x cost, month t, gross month t, total R,
worst drawdown, stops / time exits.

**Placebo** (reported only, as in the earlier gold studies): for each UTC exit X, 40 seeds (`rng(1..40)`, draw order as the
original: the start, then the side), on the same eligible pooled days a market entry at the open of a random 5-minute candle
from 01:00 UTC to X − 3 h, side by coin, stop 0.5 × prevRange away, out at X or the stop, charged C1 (fill hour = the start
candle's hour, M at that candle); count of seeds whose pooled mean net R the rule at X beats.

## Outputs

`run.mjs` (writes `result.json` and `RESULT.md`, a function of `result.json`), `tests/gold-vb-exit.test.mjs` (offline: the cost
on hand-made trades, the exit hour, the early split, the reading rule, the gate and the report against `result.json`).
