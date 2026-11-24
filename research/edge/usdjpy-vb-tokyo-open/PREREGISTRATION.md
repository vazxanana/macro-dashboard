# Pre-registration: usdjpy-vb-tokyo-open (24 Nov 2026)

Paper research only. Written and pushed alone, before any figure of the two variants below was computed.

## Question

USD/JPY T1 (gold's volatility breakout: open ± 0.5 × the previous day's range, stop back at the open, first fill wins) builds
its day on 00:00 UTC and exits at 21:00 UTC. Does the same rule do better or worse when the day is anchored on another open, with
that day's own open, previous-day range, trigger and an exit at the end of that day?

## What is already known (read before writing this)

- `usdjpy-vol-breakout-early` (PASS, 2005-15 +0.079R, n 2,089) and `fx-vol-breakout` (2016 on +0.063R, n 2,079): the UTC rule.
- `usdjpy-vb-exit` (BROAD) already read a 17:00 New York day **held 21 hours** (+0.049R pooled against +0.071R for the rule) but
  made no paired comparison with the UTC rule and did not hold to the end of the New York day. Variant A below differs: a 24-hour
  hold to the 17:00 New York close, and a paired test. Variant B (the Tokyo day) has not been read by any study.
- `usdjpy-vb-k` (BROAD across k), `fx-tokyo-orb` (a different rule: the 00:00-01:00 UTC range, FAIL), `gold-h4-day-open` (gold,
  a different rule, FAIL).
- Every year of OANDA USD/JPY M5 2005 → now has already been read by the UTC rule. Nothing here is new data; this is a
  comparison of settings, and nothing found is adopted (it would need untouched history, of which none is left).

## The rule (imported, unchanged)

`research/edge/index-vol-breakout/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f):
`buildDays`, `daySkip`, `vbTrade`, `summary`, `monthT`, `normP`, `holm`, imported and not changed. Cost:
`research/edge/fx-vol-breakout/run.mjs` `charge('usdjpy', …)` (commission 0.000045 of the entry + 0.5 pip a round trip, the
demo's measured commission plus an ASSUMED half pip; 2x reported), applied to `vbTrade(bars, { k: 0.5, sides: 'both',
prevRange, cost: 0 })`. No financing is charged in any variant (as in the parent studies); see Caveats.

## Data

OANDA mid USD/JPY M5 from the shared candle cache (`research/edge/_lib/edgekit.mjs` `load('usdjpy', '5m')`, out of git),
2005-01-01 → the last complete UTC day on file. Windows by the day's own date label:
**discovery** 2005-01-04 → 2014-12-31, **confirmation** 2015-01-01 → the last complete day.

## Gate (before any variant figure is read)

The UTC rule on this cache, windowed as its parent studies (2005-01-04 → 2015-12-31 and 2016-01-01 → 2026-11-19), must give
n 2,089 / +0.079R and n 2,079 / +0.063R. Tolerance: n within 1 % and net R a trade within 0.005R (the cache is a different
download of the same OANDA series); the exact figures are reported. Outside the tolerance the study stops and reports.

## The three days (k 0.5 in all)

- **UTC (the rule, the reference)**: `buildDays` / `daySkip` as published: 00:00 UTC open (first candle within 60 minutes),
  previous weekend-folded UTC day's range, candles 00:00-20:55 UTC, exit at the 21:00 UTC close.
- **A. New York day**: 17:00 New York to 17:00 New York (`gold-vol-breakout-k` `nyKey` / `anchorOf`, imported; Saturday /
  Sunday fold into Monday; dated by the New York date it closes on). Open = the first M5 candle within 60 minutes of the anchor
  (inclusive, as `usdjpy-vb-exit`); previous-day range = high − low of the previous New York day's candles; candles from the
  anchor to the one starting at anchor + 24 h − 5 min; **exit at the close of the last candle of the day** (the 17:00 New York
  close). At least 200 candles.
- **B. Tokyo day**: 00:00 Tokyo = 15:00 UTC (Japan has no daylight saving) to 15:00 UTC the next day, dated by the Tokyo date.
  Open = the first M5 candle within 60 minutes of 15:00 UTC; previous-day range = high − low of the previous Tokyo date's
  candles; candles 15:00 UTC → 14:55 UTC next day; **exit at the 15:00 UTC close**. At least 200 candles. No weekend fold:
  the Tokyo Monday (Sunday 15:00 UTC → Monday 15:00 UTC) has no candle near its anchor (the market reopens about Sunday 21:00-22:00
  UTC) and the Tokyo Saturday has about 6 hours of candles, so both are skipped by the open / 200-candle rules; the Tokyo Tuesday's
  previous-day range is the Tokyo Monday's partial day. So the Tokyo day trades about four days a week (Tokyo Tue-Fri).

## Tests (two; Holm over both)

For each variant V in {A, B}, the paired monthly comparison with the UTC rule: per calendar month m holding trades of both,
d_m = mean net R a trade of V in m − mean net R a trade of UTC in m (per trade, because the Tokyo day trades fewer days a week;
the difference of month SUMS is reported too). Paired t = mean(d) / (sd(d) / √months), in each window.

- **BETTER**: d > 0 in BOTH windows, and in confirmation one-sided p (normal, of the paired t) after Holm over the two tests
  < 0.05 (equivalently paired t ≳ 2), and V's own net R a trade > 0 in both windows with n ≥ 200 a window.
- **WORSE**: d < 0 in both windows and the confirmation paired t, Holm-adjusted the other way, < 0.05.
- Otherwise **NO DIFFERENCE SHOWN**.

Whatever the result, the rule stays the UTC day; nothing is adopted.

## Reported for every day and window

n, win rate, gross R, net R, net R at 2x cost, month-sum t of net R (`monthT`), max drawdown, the number of trades still open
at 17:00 New York (Tokyo day: held over the rollover).

## Control (reported, does not decide)

The same rule on a day anchored at each other whole UTC hour h ∈ {1 … 23} \ {15} (fixed UTC anchors, 24-hour day, open within 60
minutes, previous day = previous 24-hour block, 200 candles, exit at the end of the day; no weekend fold, so blocks holding the
weekend are skipped), pooled 2005 → now: where the UTC rule, A and B sit among these 22 anchors by pooled net R a trade. It shows
whether 00:00 UTC (or another open) is special or one of many similar cuts.

## Caveats fixed now

- No financing: a Tokyo-day position open at 17:00 New York is held over the rollover, which pays or earns swap and passes the
  daily break hour, where mid candles hide the wider spread. Their count is reported; a Tokyo-day advantage that rests on those
  trades is to be read with that in mind.
- One series, already read by the UTC rule: a comparison, not new evidence.

## Outputs

`run.mjs` (writes `result.json`, `RESULT.md`), `tests/usdjpy-vb-tokyo-open.test.mjs` (offline: the day builders on hand-made
candles, no look-ahead, the report against `result.json`).
