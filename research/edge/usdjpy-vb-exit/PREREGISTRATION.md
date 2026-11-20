# Pre-registration: usdjpy-vb-exit (20 Nov 2026)

Paper research only. A **robustness** reading of one stand-alone intraday rule on USD/JPY: gold's T1 volatility breakout
(UTC open ± 0.5 × the previous day's range, stop back at the open, out at 21:00 UTC), which passed on USD/JPY in
`research/edge/fx-vol-breakout` (2016 → now), `research/edge/usdjpy-vol-breakout-early` (2005-2015) and
`research/edge/usdjpy-vol-breakout-exec` (the demo broker's own ticks). `usdjpy-vb-k` read k; this study reads the two other
settings of the rule, mirroring `research/edge/gold-vol-breakout-k` sections 2 and 3: the exit time and the day anchor.

Written and pushed alone, before any figure of the rule at a setting other than the published one was computed.

## Question

Does the USD/JPY result depend on the 21:00 UTC exit and on the day starting at 00:00 UTC?

## What this study is NOT

- **It does not choose a new exit or anchor.** The tested rule stays k 0.5, exit 21:00 UTC, day from 00:00 UTC. A setting
  that looks better here is NOT adopted; it would need its own pre-registration on data none of these studies has read (OANDA
  USD/JPY M5 from 2005 is now read in full).
- k is fixed at 0.5. No gate, filter or size of any council system; no council member, rule or config reads this study.

## The rule (imported, unchanged)

`research/edge/index-vol-breakout/original.mjs` (sha256 afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f, the
verbatim copy of `gold-vol-breakout`'s `run.mjs`): `buildDays`, `daySkip`, `vbTrade`, `summary` are imported and not changed.
Cost: `research/edge/fx-vol-breakout/run.mjs` `charge` (commission 0.000045 of the entry + 0.5 pip a round trip; 2x reported),
imported unchanged, applied to `vbTrade(..., { k: 0.5, sides: 'both', cost: 0 })` exactly as in `usdjpy-vol-breakout-early`.
No financing is charged in any variant (as in `fx-vol-breakout`): no position of any variant is held over the 17:00 New York
rollover.

## Data

OANDA mid USD/JPY M5, rows `[t, o, h, l, c]`, from the keyless candle proxy (the two studies' caches, kept out of git):
`usdjpy-5m-early.json.gz` (2004-12-01 → 2016-01-07) for 2005-01-04 → 2015-12-31, and `usdjpy-5m.json.gz` (2015-12-01 → ) for
2016-01-01 → 2026-11-19. Windows: **early** 2005-01-04 → 2015-12-31, **late** 2016-01-01 → 2026-11-19, **pooled** = both.

## Harness gate (before any other figure is read)

At exit 21:00 and the 00:00 UTC day the code must reproduce the published figures exactly: early n 2,089, net +0.079R a trade;
late n 2,079, net +0.063R. And the exit code path (the day's candles filtered to those ending by the exit) at 21:00 must give,
trade for trade, the same trades as the rule's own candles. If either fails, the study stops and reports the difference.

## 1. Exit-time sweep (k 0.5, 00:00 UTC day)

Exit at the close of the candle ending **12:00, 15:00, 18:00 and 21:00 UTC** (the rule). As in `gold-vol-breakout-k`, the
day's candles from 00:00 UTC up to the one ending at the exit are handed to `vbTrade`, so the order window and the hold both end
at the exit. Eligible days are the original's (`daySkip` on the 00:00-20:55 candles) for every exit.

## 2. Day anchor (k 0.5)

The trading day runs from 17:00 New York to 17:00 New York, built with `gold-vol-breakout-k`'s exported `buildNyDays` /
`nySkip` / `nyTrades` (imported unchanged; New York offset from `council/histdata.mjs`, read only): Saturday / Sunday fold into
Monday, open = the first M5 candle at or after the anchor (within 1 hour, read inclusively as there; the strict reading is
reported too), prevRange = high − low of the previous trading day, orders and hold for **21 hours from the anchor**, the same
200-candle minimum. Dated by the New York trading date, windowed by that date. Its trades are charged with the same `charge`.

## 3. Reading (fixed now)

The four alternative settings are the exits 12:00, 15:00, 18:00 and the 17:00 New York anchor (inclusive open). The result is
called **BROAD** only if BOTH hold:

1. net R a trade > 0 at every one of the four, in the early AND the late window; and
2. pooled month t (calendar-month sums of net R) ≥ 2 at 3 or more of the four.

Otherwise **NARROW**. Reported for every setting and window: n, win rate, net and gross R a trade, net R at 2x costs, month t,
gross month t. A one-sided p from each alternative's pooled month t, Holm over the four, is shown for reference only and does not
change the reading. Nothing found here is adopted.

## Outputs

`run.mjs` (writes `result.json` and `RESULT.md`, a function of `result.json`), `tests/usdjpy-vb-exit.test.mjs` (offline: the
exit plumbing on hand-made candles, the reading rule, the gate and the report against `result.json`), one line in `CLAUDE.md`.
