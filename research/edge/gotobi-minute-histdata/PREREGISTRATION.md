# Gotobi fade: is the 00:55 minute spike a feed artefact? The entry-minute grid on HistData M1 (pre-registration)

Written and pushed alone, 14 Nov 2026, before `run.mjs` exists and before any HistData M1 trade at any shifted minute was
computed. A **sensitivity report** on an existing pre-registered rule, not a new study: no time is chosen from this grid, no
edge is judged, and nothing live changes whatever the result.

## Why

`gotobi-timing` (#908) re-ran the frozen gotobi fade (T2 of `research/edge/gotobi`, #878: on gotobi days sell USD/JPY at
00:55 UTC, the 09:55 Tokyo fix, buy back at 06:00 UTC) on OANDA mid M1 with the entry moved minute by minute. Net R a trade:
00:53 +0.065, 00:54 +0.072, **00:55 +0.148**, 00:56 +0.048, 00:57 +0.026, 00:58 +0.006, 01:00 +0.010. The effect sits almost
entirely on the 00:55 minute. That shape is what a real fix flow would leave (the fix is set at 09:55 Tokyo), but it is also
what a feed artefact on one minute of one feed would leave (a stamped or thin 00:55 print on OANDA). `gotobi-feed` (#894)
showed the M5 rule holds on HistData USD/JPY (+0.127R, month t 2.34, per-trade correlation 0.997 with OANDA), but only at the
00:55 M5 open. This report repeats #908's entry grid on that independent feed, minute by minute.

## The rule, frozen

`frozen.mjs` in this folder is `research/edge/gotobi-feed/frozen.mjs` of branch `gotobi-feed`, copied byte for byte (sha256
`645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, the same file as `gotobi-timing/frozen.mjs`), pinned in
`tests/gotobi-minute-histdata.test.mjs`. It is imported, never edited. From it: the day list (`gotobiSet`, Tokyo business
days), the stop distance (`stopDist`, 1.5 x the 20-Tokyo-business-day median absolute move of the BASE window 00:55 -> 06:00
UTC on M5, `windowMove`), the cost (`costPx`: 0.3 pip spread, 0.5 pip slippage a side, USD 22.5 per million a side, divided by
D), the 15-minute exit grace (`EXIT_GRACE`), `summary` and the month t (`monthT`, calendar-month sums of net R).

## Data: HistData only, the loader of #894

HistData USD/JPY M1 (bid) from council-data `research/candles/USDJPY/USDJPY_M1_<year>.csv.gz`, read with
`git show origin/council-data:<path> | gunzip` (no network). The loader is `gotobi-feed`'s, copied (never imported across
branches): each label converted to UTC by `council/histdata.mjs` `histStampUtc` and nothing else, a repeated converted time
dropped, only candles starting 00:00-06:59 UTC kept. The M1 rows `[t, o, h, l, c]` drive the trades; the same rows aggregated
to UTC M5 candles (`floor(t / 300) x 300`, as #894's `toM5`) give the stop distance D only. Caches stay outside git.

Window: 2018-01-01 to the frozen rule's last whole day on the HistData file (the day before the last candle's date; #894:
2026-10-29).

## What is held fixed, exactly as #908

- The days: gotobi days in the window that are Tokyo business days and have a frozen D (#908's `frozenD` loop).
- D of each day: from the BASE window on the HistData M5 candles of this same feed (as #908 took D from its own feed's M5),
  the same number for a day in every row of the grid.
- The side (sell), the costs (the frozen `costPx` at the actual fill, divided by D), the exit at 06:00 UTC.

## What moves: the entry minute

Entry grid: 00:53, 00:54, **00:55 (base)**, 00:56, 00:57, 00:58, 01:00 UTC; exit 06:00 UTC. Each trade is #908's `tradeM1`,
copied unchanged: entry at the open of the HistData M1 candle starting at the entry minute (no candle at that minute = no
trade), stop D above that fill, the M1 candles from the entry to 06:00 scanned in order (an open at or through the stop exits
at that open, a high through it exits at the stop), exit at the open of the 06:00 M1 candle, else the close of the last M1
candle starting up to 15 minutes before it. Each row: n, net R a trade, gross R, cost R, total net R, month t, win share,
stopped share (the frozen `summary`).

## Gate (decided now)

The HistData M1 00:55 row must reproduce #894's HistData M5 result (n 623, net +0.1265R a trade, 2018-01-01 to 2026-10-29):

1. The frozen code on this loader's M5 candles gives #894's figures exactly (n 623, net R a trade within 0.00005 of +0.1265):
   the loader and the window are #894's.
2. M1 00:55 row: n within 6 trades of 623 (1 %; a difference can only come from an M1 candle missing at 00:55 or 06:00 where
   the M5 candle exists through another minute, or the reverse).
3. M1 00:55 row: net R a trade within 0.010R of +0.1265 (the M1 path can turn a few M5 stop fills into gap fills or the
   reverse).
4. On every day where both exist, the M1 open at 00:55 equals the M5 open at 00:55 (an M5 candle's open is its first
   minute's open when the 00:55 minute is on file): at least 99 % of those days, every mismatch listed.

If the gate fails, the grid is reported as not interpretable and no reading word is given.

## The pre-registered reading

- **"FEED-CONFIRMED"** when both hold on HistData: (a) the 00:55 entry is the clear maximum of the seven rows: its net R a
  trade is positive and at least 0.020R above every other row's; and (b) one minute late keeps less than half of it: net R a
  trade at 00:56 < 0.5 x net R a trade at 00:55.
- **"FEED-DIFFERENT"** otherwise, naming the condition that failed.

No verdict about an edge: this only says whether the OANDA minute profile is seen on another feed. No Holm, no placebo; the
month t of each row is shown as a measure of its noise, not as a test.

## Reported beside it, not judged

- The per-day correlation with OANDA at each entry minute: on the days both feeds trade at that minute, the Pearson
  correlation of per-trade net R, HistData against OANDA. The OANDA side is #908's own M1 file
  (`usdjpy-1m-gotobi.json.gz`, OANDA mid, 00:40-06:15 UTC on each gotobi day) if it is on disk in this session's scratchpad,
  with OANDA's D from #878's OANDA M5 file (as #908), run through the same `tradeM1`; otherwise the report says it was not
  available and gives no correlation. Also the share of common days with the same sign of net R, and the correlation of the
  raw move entry -> exit in pips.
- The OANDA M1 grid on the same window (2018-01-01 to the HistData last day), so the two profiles are compared on the same
  calendar.
- HistData minus OANDA at each minute on the common days: median and 95th percentile of the absolute difference of the entry
  price in pips (HistData is bid, OANDA mid: a constant offset of about half a spread is expected and cancels in the move).
- Days with no candle at an entry minute on each feed.

## Outputs

`frozen.mjs` (byte copy), `run.mjs`, `result.json`, `RESULT.md` (a Verdict line with one reading word, or "not interpretable"
if the gate fails), `tests/gotobi-minute-histdata.test.mjs` (node:test, offline: the frozen hash, the loader's clock, the M1
trade on hand-made candles, the reading rule, RESULT.md against result.json). Paper research only: no rule, council member,
config or live code changes.
