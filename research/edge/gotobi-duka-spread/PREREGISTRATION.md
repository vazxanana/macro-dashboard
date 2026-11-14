# Gotobi on bid and ask: the fade after the 09:55 Tokyo fix filled on the side that trades (pre-registration)

Written and pushed on 14 Nov 2026 before any candle of this study was downloaded and before any spread, return or trade was
computed. Paper research only; nothing live changes.

## Why

The gotobi T2 fade (sell USD/JPY at 00:55 UTC on gotobi days, buy back at 06:00 UTC; stop 1.5 x the 20-day median of the
window's move; branch `gotobi`, PR #878), replicated on GBP/AUD/CAD/CHF-JPY (`gotobi-replicate`, #889), is the one hypothesis
still standing after the multiple-testing ledger (`multiple-testing-update`). It is not a net edge yet: `gotobi-cost` found
the break-even at 3.73 pips a round trip (spread + 2 x slippage, commission on top) on USD/JPY 2016-now, month t >= 2 lost
above 1.95 pips, and 3.20 / 1.81 pips on the crosses pooled; but every figure so far is on OANDA mid candles and the spread at
00:55 and 06:00 UTC on yen pairs has never been measured. Dukascopy publishes free historical BID and ASK candles; this study
reads both sides at the rule's two minutes.

## The frozen rule

`frozen.mjs` in this folder is a byte-for-byte copy of `research/edge/gotobi-cost/frozen.mjs` (branch `gotobi-cost`), itself
`research/edge/gotobi/run.mjs` at commit `5f341e069` of branch `gotobi`, sha256
`645f273102d05ad3a654f361e5cece3753eff5b6d34c242e79f687c23cbe5e32` (pinned in `tests/gotobi-duka-spread.test.mjs`). It is
never edited. The gotobi calendar (`gotobiSet`, `isTokyoBusinessDay`), the window times (`legTimes('fade', day)`: 00:55 and
06:00 UTC), the window move (`windowMove`), the stop distance (`stopDist`: 1.5 x the median absolute move of the 20 Tokyo
business days before, at least 15 present) and the month t (`monthT`, calendar-month sums) are the frozen functions.

## Step 1: coverage probe (no returns, no spreads computed)

Data: Dukascopy minute candles, one file per UTC day and side, `https://datafeed.dukascopy.com/datafeed/<SYM>/<YYYY>/<MM, 0-based>/<DD>/{BID,ASK}_candles_min_1.bi5`,
decoded with the repository's `council/duka.mjs` `decodeBi5` (point 1e3 for yen pairs; zero-volume minutes dropped), fetched
with `node --use-env-proxy` from this build sandbox, cached outside git (`/tmp`). Symbols: USDJPY, GBPJPY, AUDJPY, CADJPY,
CHFJPY (the pairs of #878 T2 and #889 R1).

The probe asks for one BID and one ASK file per symbol on three days (a 2010, a 2016 and a 2026 gotobi day), then for every
gotobi day 2010-01-01 to the last whole weekday on file: does the file exist and does it hold the 00:55 and 06:00 UTC minutes
on both sides. Outcome:

- **Not reachable** (the host refuses the connection, or every probe file fails): the study stops. RESULT.md says
  `NOT MEASURABLE (inconclusive: …)` with the exact failure, and no figure of Measurement A or Test B is given. No other
  source is substituted (OANDA through the proxy is mid only; HistData M1 is one side only), and no number is made up.
- **Reachable but thin**: a stream is measured only if both sides cover at least 90 % of its gotobi days at both minutes;
  otherwise that stream is `NOT MEASURABLE (inconclusive: coverage n of m)`.

## Step 2: Measurement A (descriptive, no verdict)

Per pair and calendar year, 2010 to now: the quoted spread = ASK open − BID open of the minute candle starting at 00:55 UTC and
of the one starting at 06:00 UTC, in pips (0.01), on gotobi days and, separately, on every other Tokyo business weekday:
n, median, 75th and 95th percentile. Also the one-minute change of the mid (mean of BID and ASK opens) from the 00:55 minute to
the 00:56 minute, in pips, as a proxy for slippage at the signal: median and 95th percentile of its absolute value, and the
mean signed change against a sell (a fall counts as adverse). Same for 06:00 → 06:01 against a buy-back.

## Step 3: Test B (the primary test)

Candles: Dukascopy M1 BID and ASK grouped into M5 candles aligned to UTC (open of the first minute, high / low over the five,
close of the last; a bucket with no minute is absent, as an absent OANDA candle is). Mid M5 = the mean of the BID and ASK
candle, field by field.

- **Signal on mid, as frozen**: the trade day, D (`stopDist` over `windowMove` on the mid M5 index) and the presence of an
  entry candle at 00:55 and an exit price at 06:00 (`entryPx`, `exitPx` with the frozen 15-minute grace) are computed on the
  mid candles with the frozen functions, so the signal matches the frozen definition.
- **Fills on the side that trades**: the fade sells at the BID open of the 00:55 M5 candle; stop = that fill + D; the
  position is managed on ASK M5 candles from the entry candle until 06:00 with the frozen order of checks (ASK open at or
  above the stop: out at that open; else ASK high at or above the stop: out at the stop); otherwise it buys back at the ASK
  price `exitPx` gives at 06:00 on the ASK candles. A buy (not used by T2) would mirror this (ASK in, BID out). Gross R =
  (fill − exit) / D, so the quoted spread at both minutes is inside it.
- **Commission**: USD 22.5 per million a side, as `gotobi-cost` (2 x 22.5e-6 x entry, in yen, divided by D).
- **Slippage stress**: the same trades with an extra 0.3 pip a side (0.6 pip / D a trade) on top.

Streams (each one trade per gotobi day, as the frozen rule):

| Stream | Pair(s) | Window | Role |
|---|---|---|---|
| S1 | USD/JPY | 2016-01-01 to the last whole day on file | decisive |
| S2 | USD/JPY | 2010-01-01 to 2015-12-31 | replication |
| S3 | GBP/JPY, AUD/JPY, CAD/JPY, CHF/JPY pooled | 2010-01-01 to the last whole day on file | crosses (month sums across the four) |

One-sided p of each stream = 1 − Φ(month t) (frozen `normCdf`); Holm over the three streams at alpha 0.05.

**PASS** only if all hold on S1: net R a trade > 0; month t >= 2; Holm-adjusted p of S1 <= 0.05; S2 net R a trade > 0; S1 net
R a trade still > 0 with the extra 0.3 pip a side. Otherwise **FAIL**. S3 is reported with the same conditions (net > 0,
month t >= 2, Holm, > 0 with the extra slippage) as its own line, not part of the verdict. Never called an edge without n and t.

## Step 4: feed check

On gotobi days both feeds hold (OANDA trades from `gotobi-cost/trades.json`, [day, entry, D, gross R], and this study's mid
trades): the share of days with a trade in both, of days with a trade in one only, the correlation of gross R per trade, the
median ratio of D, and the mean of each. Descriptive; a correlation under 0.8 is named as a warning in the report.

## Step 5: placebo

40 seeded runs (the frozen `draw`, seeds 1-40) on random non-gotobi Tokyo business days of S1's window, as many as S1 has
trades, same minutes, same signal, same bid / ask fills and commission. Reported: median and 95th percentile (38th of 40) of
net R a trade, and how many S1 beats. Reported beside the verdict, not part of it (the bar above is the brief's).

## What the report says

The coverage, Measurement A's table, the verdict, Test B per stream at the two cost levels, the feed check and the placebo.
Verdict words: `PASS`, `FAIL` or `NOT MEASURABLE (inconclusive: …)`. Nothing here changes a live rule, config, `api/` or the
council.
