# Gotobi fade: execution-timing sensitivity (pre-registration)

Written and pushed alone, before any M1 candle was fetched or any shifted trade was computed. A **sensitivity report** on an
existing pre-registered rule, not a new study: nothing in it is a rule, a filter or a parameter search, and **no time is chosen
from this grid**. The base (00:55 / 06:00 UTC) is the rule; the other minutes only say how fast the result decays when a live
copy fills late or early.

## Why

The gotobi fade (T2 of `research/edge/gotobi`, #878: on gotobi days sell USD/JPY at 00:55 UTC, the 09:55 Tokyo fix, buy back at
06:00 UTC) passed in #878, replicated frozen in `gotobi-replicate` (#889) and on an independent feed in `gotobi-feed` (#894). A
live paper copy would not fill at the 00:55 M5 open: the council loop runs about once a minute and a broker adds latency. Before
any paper shadow is proposed, the owner needs to know how sensitive the result is to execution timing.

## The rule, frozen

`frozen.mjs` in this folder is `research/edge/gotobi-replicate/frozen.mjs` of branch `gotobi-replicate`, copied byte for byte
(sha256 `645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32`, pinned in `tests/gotobi-timing.test.mjs`). It is
imported, never edited. Frozen and NOT varied here:

- the day list: `gotobiSet` (5, 10, 15, 20, 25 and the last Tokyo business day, rolled back to the previous Tokyo business day);
- the stop distance D of each day: `stopDist` = 1.5 x the median absolute move of the BASE window (00:55 -> 06:00 UTC, M5, as
  `windowMove`) over the 20 Tokyo business days before it, computed from the same OANDA M5 file as #878. D is the same number
  for a day in every row of the grid;
- the cost: `costPx` (0.3 pip spread, 0.5 pip slippage a side, USD 22.5 per million a side), divided by D;
- the side (sell) and the window: decisive 2016-01-01 to 2026-11-11 (#878's last whole day).

## What moves

Trades are re-run on OANDA mid **M1** candles (through the site's keyless `/md/bars` proxy, `tf=1m`, one request per gotobi
day for 00:40-06:15 UTC; cached outside git). For each row the entry is the open of the M1 candle starting at the entry minute
(no candle at that minute = no trade, as in the frozen rule), the stop sits D above that fill, the M1 candles from the entry
to the exit minute are scanned in order for the stop exactly as `trade()` scans M5 (an open at or through the stop exits at
that open, `gap`; a high through it exits at the stop), and the exit is the open of the M1 candle at the exit minute, else the
close of the last M1 candle that started up to 15 minutes before it (the frozen 15-minute grace, in M1 candles).

- **Entry grid** (exit fixed at 06:00): 00:53, 00:54, **00:55 (base)**, 00:56, 00:57, 00:58, 01:00 UTC.
- **Exit grid** (entry fixed at 00:55): 05:55, **06:00 (base)**, 06:02, 06:05 UTC.

Each row reports n, net R a trade, total net R, gross R, cost R, the month t (calendar-month sums of net R, the frozen
`monthT`), win share and stopped share, through the frozen `summary`. Also reported: the frozen M5 base itself.

## Gate (decided now)

The M1 base row (00:55 / 06:00) must reproduce #878's T2 decisive figures (n 771, net +0.1481R a trade, M5):

1. n within 8 trades of 771 (1 %; a difference can only come from an M1 candle missing at 00:55 where the M5 candle exists, or
   the reverse);
2. net R a trade within 0.010R of +0.1481 (the M1 path can turn a few M5 stop fills into gap fills or the reverse);
3. on every day where both exist, the M1 open at 00:55 equals the M5 open at 00:55 (OANDA's M5 open is its first M1 open);
   the gate requires this on at least 99 % of those days, and every mismatch is listed.

If the gate fails, the grid is reported as not interpretable and nothing in it is read.

## How it is read

- The base is the pre-registered rule. No other minute is "better" or "chosen", whatever its figures; a row that looks better
  is noise around the same trade unless it has its own pre-registration on other data.
- The one question answered: how many minutes of lateness (entry after 00:55, exit after 06:00) does the result tolerate
  before net R a trade falls to half of the base, and before it falls to zero? Earlier entries (00:53, 00:54) and the 05:55
  exit are shown only to see whether the effect sits on the fix minute itself.
- No Holm, no placebo, no pass / fail: this is not a test of an edge. The month t is shown as a measure of each row's noise.

## Outputs

`run.mjs` (`fetch <dir>` writes the M1 cache; `<m1Dir> <m5File>` runs the grid), `result.json`, `RESULT.md`,
`tests/gotobi-timing.test.mjs` (frozen hash, gate, RESULT.md against result.json). Paper research only: no rule, council member,
config or live code changes.
