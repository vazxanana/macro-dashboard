# Gold activity spike: does an abnormal-activity H1 candle continue or reverse? Pre-registration (14 Nov 2026)

Written and pushed alone, before any trade or return of this rule was computed. A new stand-alone intraday rule on spot gold:
not a gate, exit, entry or size of the live gold book (Gold trend + Gold daily engulf), and no candle before 2016
(docs/owner-decisions.md item 44). Paper research only; nothing live changes and no proposal follows from it.

## Question

When an H1 candle of spot gold carries far more activity than that hour of the day usually does, does price over the next four
hours follow the candle (informed flow) or turn against it (climax, exhaustion)? And does the place the candle closes in its own
range (top or bottom quarter) decide which?

## Not a duplicate (read before writing)

- `volume-reversal` (branch): DAILY big-move days on index / metal / energy / forex CFDs split by daily quote-count volume, faded
  with a 1.5 x ATR stop. FAIL. Daily, a move filter first, no hour-of-day baseline.
- `volume-premium` (branch): DAILY high-volume days as longs, 1-day horizon, index / metal / energy / forex. FAIL (t 1.99).
- `activity-xs` (branch): weekly cross-section of index CFDs by abnormal activity. FAIL.
- `gold-shock-revert` (branch): daily close-to-close moves over 2 x ATR on gold, no volume. FAIL.
- `gold-vwap` (branch): tick volume used only to weight the session VWAP; signals are price-band closes. FAIL.
- `gold-session-drift`, `metals-intraday-momentum`, `intraday-momentum` (branches): clock windows, no volume. FAIL.
- `event-reaction`, `news-filter` (main): release windows (CPI / NFP / FOMC) by calendar, no volume condition.
- `research/proposals/2026-11-14-untested-backlog.md` items 5 and 6 are daily index-CFD volume questions, not this one.
No study has used an intraday (H1) activity spike against its own hour-of-day norm on gold.

## Data

- OANDA mid XAU/USD M5 candles WITH OANDA tick volume (a count of price updates, a proxy for activity, not traded volume),
  through the site's keyless candle proxy: `node --use-env-proxy research/edge/gold-volume-spike/fetch.mjs <dir>` writes
  `xau-5m-vol.json.gz` (rows `[t, o, h, l, c, v]`; the same file `gold-vwap` built). Kept out of git.
- Only candles starting on or after 2016-01-01 00:00 UTC are read (the file holds December 2015 too; it is dropped). End:
  the last complete candle of the file (13 Nov 2026).
- H1 candle = the M5 candles starting inside one UTC clock hour [H, H + 3600): open of the first, close of the last, highest
  high, lowest low, summed volume. An hour with fewer than 10 of its 12 M5 candles is not an H1 candle for this study (it is
  neither a signal nor part of a baseline).
- Market set fixed now: spot gold (XAU/USD) only.

## Rule

- **Hour key**: the New York clock hour of the H1 candle's start (UTC hour minus `council/histdata.mjs` `nyOffsetH`, 4 or 5).
- **Baseline**: the median volume of the 20 most recent earlier H1 candles with the same hour key (earlier calendar days; one per
  day). No baseline (fewer than 20 earlier) = not eligible.
- **Spike**: an eligible H1 candle whose volume is more than 3 x its baseline.
- **Direction**: up when close > open, down when close < open; close = open is no direction. **Close location** CL =
  (close − low) / (high − low); high = low has no CL. Top quarter = CL >= 0.75, bottom quarter = CL <= 0.25.
- **Entry**: at market, at the open of the first M5 candle starting at or after the spike candle's end, provided it starts no
  more than 15 minutes after that end (else no trade: a halt, weekend or hole).
- **Stop**: beyond the spike candle's far extreme for the trade's side, $0.30 past it: a buy's stop = spike low − 0.30, a sell's
  = spike high + 0.30. No trade when the entry is already beyond the stop or the stop is under $1.00 from the entry.
- **Exit**: the stop (on M5 highs / lows; an M5 open beyond the stop fills at that open), else at market at the close of the
  last M5 candle starting before entry + 4 hours.
- **One position at a time per test**: a spike whose entry is before the open trade's exit is skipped.

The three tests (each its own stream on the same spike candles):

- **T1 continuation**: every spike with a direction; buy an up candle, sell a down candle.
- **T2 reversal (climax)**: spikes closing in an outer quarter; SELL when CL >= 0.75, BUY when CL <= 0.25 (the side against
  where the candle closed, whatever its open). Stop past the extreme the candle closed near (a sell: high + 0.30).
- **T3 continuation with a strong close**: the same spikes as T2, the other side: BUY when CL >= 0.75, SELL when CL <= 0.25.
  Stop past the opposite extreme (a buy: low − 0.30).

## Costs

- $0.30 spread a round trip plus $0.15 slippage (half a spread) on each market order (entry and exit are both market): $0.60 a
  trade. At 2x costs: $1.20.
- Financing on buys only: `council/fills.mjs` `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo
  broker's 11 Nov 2026 rate, used for every year) x entry price; sells are charged and credited nothing.
- R = side x (exit − entry) / |entry − stop|; net R = R − (costs + financing) / |entry − stop|.

## Statistics and the bar

- In sample 2016-01-01 to 2020-12-31, out of sample 2021-01-01 to the end, by entry date.
- Per test: mean net R a trade; t of the calendar-month sums of net R (OOS); one-sided normal p; Holm over the three tests.
- **Placebo** (40 seeds, mulberry32 seeds 1-40, out of sample): for each trade the rule took, a random OOS H1 candle that is
  NOT a spike, with the same hour key and (T1) a direction, (T2 / T3) a close in the same quarter; the test's side and stop rule
  applied, each placebo trade simulated alone with the same costs (a candle whose trade would be skipped is redrawn, up to 50
  times). Mean net R a trade per seed.
- **A test passes** only with all of: OOS month-sum t >= 2 and Holm p <= 0.05; IS mean net R > 0 (the same sign); OOS mean net
  R at 2x costs > 0; OOS mean above the placebo's 95th percentile; OOS n >= 100.
- **Verdict**: PASS if at least one test passes, naming it; otherwise FAIL. T1 is listed first. A pass would be a hypothesis
  for a forward paper record, never an edge on its own.

## Releases, reported both ways (not a test)

A spike candle is tagged when a CPI, NFP or FOMC release time falls inside it, from `council/event-base.json` rows,
`council/events.mjs` `HISTORY` and `EVENTS` (those three types). Coverage: CPI from 2018 (with gaps), NFP and FOMC from 2022;
2016-17 has no tags, so tagging is incomplete in sample. Each test's OOS figures are shown for all spikes (the test) and for
untagged and tagged spikes apart, the untagged stream re-run with the one-position rule on its own.

## Reported, not tested

Gross R, exits by kind, net R by year, spikes by New York hour, the share of spike candles in the outer quarters.

## Files

`fetch.mjs` (rebuilds the candle file), `run.mjs` (pure pieces exported; writes `result.json` and `RESULT.md`), and
`tests/gold-volume-spike.test.mjs` (offline: the H1 build, the baseline uses only earlier days, the three sides and stops, the
simulator and costs, the report against `result.json`).
