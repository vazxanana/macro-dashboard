# Pre-registration: gold's T1 breakout on the five other forex majors, 2005-2015 (20 Nov 2026)

Written and pushed alone, before any candle of these five markets before 2016 is fetched or any trade of this window is
computed. The test runs once; nothing below is changed after a result is seen. Paper research only: nothing live changes, no
council member, page, mirror or config reads it. Not part of the ICT edge (nothing under `ict/` is read or touched).

## Why
`fx-vol-breakout` (20 Nov 2026) ran T1 (UTC open ± 0.5 × the previous day's range, stop at the open, out at 21:00 UTC) on six
forex majors 2016-26: the pool FAILED (−0.022R a trade net, n 12,664, month t −1.59) and USD/JPY alone passed.
`usdjpy-vol-breakout-early` then passed on USD/JPY 2005-15 (+0.079R, n 2,089, month t 2.95). Nobody has read 2005-15 for the
other five majors (checked 20 Nov 2026: no study under `research/edge/` runs T1 on them before 2016). **The question:** is
USD/JPY special, or did the rule also work on the other majors in the earlier decade (and stop working since)?

## Data (named before any result)
- Markets, fixed now: **EUR/USD, GBP/USD, AUD/USD, USD/CAD, USD/CHF** (OANDA keys `eurusd gbpusd audusd usdcad usdchf`): the
  `fx-vol-breakout` majors without USD/JPY.
- OANDA mid M5 through the keyless candle proxy (`MD_BASE=https://aureumdesk.co.uk/md/`), 2004-12-01 00:00 UTC to
  2016-01-08 00:00 UTC, cache kept out of git (`<key>-5m-early.json.gz`, rows `[t, o, h, l, c]`; candles marked `live` dropped).
- The window judged: **2005-01-04 to 2015-12-31** (UTC weekdays), halves **2005-2010** and **2011-2015**. A market whose M5
  candles start later is judged from its first complete month with candles (the rule of `usdjpy-vol-breakout-early`
  `windowOf`; reported per market). The pool with fewer than 5,000 trades, or a market with fewer than 1,000, is "too few to
  judge" (no verdict either way for that series).
- Days and skips: the original's `buildDays` / `daySkip`, unchanged (weekend stubs folded into the next weekday; no previous
  range, a flat previous day, no candle in 00:00-00:55, fewer than 200 candles before 21:00 are skipped).

## Rule and cost (both unchanged from fx-vol-breakout / usdjpy-vol-breakout-early)
- `vbTrade` of the pinned `research/edge/index-vol-breakout/original.mjs` (sha256
  afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f; checked at run time), k 0.5, both sides, through the
  window-free loop of `usdjpy-vol-breakout-early/run.mjs` (`trades`, `placeboTrades`), imported, never copied or edited.
- Cost `fx-vol-breakout` `charge` / `costPx`: 0.000045 × entry (the demo's commission, round trip) + 0.5 pip (0.00005) a
  round trip; **2x** reported. No financing (every trade is out at 21:00 UTC, before the 22:00 rollover). Said now: this is
  today's demo cost charged on 2005-15, when retail spreads were wider; the 2x line is the check, and gross R is reported
  beside net for every series.

## Statistics
- Per market and pooled (all five markets' trades together), for the window and each half: n, win %, gross and net R a
  trade, net at 2x cost, worst drawdown, t on calendar-month sums of net R (the original's `summary`).
- **Placebo**, 40 seeds (1-40) per market, the original's construction (one market entry a tradable day at an M5 candle drawn
  uniformly from 01:00-18:00 UTC, a fair-coin side, stop 0.5 × prevRange away, out at 21:00 or the stop, same cost); the
  pool's placebo mean per seed is the mean over all five markets' placebo trades of that seed.
- Per market: one-sided p of the window's month t (`normP`), **Holm over the five** (`holm`).

## Tests and pass bar
- **The one test: the pool.** PASS only when ALL hold on 2005-2015:
  1. net R a trade > 0 in 2005-2010 AND in 2011-2015;
  2. month-sum t of net R ≥ 2;
  3. net R a trade > 0 at 2x cost;
  4. the pool's mean net R beats at least 38 of its 40 placebo seed means.
- **Per market**, the same four checks with check 2 also needing Holm-adjusted p < 0.05 over the five: reported, descriptive.
  A market passing without the pool is a hypothesis only (and for any of these five it would already be contradicted by its
  own 2016-26 result in `fx-vol-breakout`, where none of them had positive net R); never an edge, never a proposal.

## Reading, fixed now
- **Pool FAIL**: the rule did not work on the other majors in 2005-15 either. USD/JPY's result stands alone among the six
  majors in both decades (read with `yen-crosses-vol-breakout`: one market of eleven); its forward record
  (`usdjpy-vol-breakout-forward`) remains the judge.
- **Pool PASS**: the rule worked on the other majors in 2005-15 and failed on them in 2016-26: evidence of a decayed effect,
  not of a current one. No forward record or proposal follows for these five from this study.

Whatever the verdict, nothing live changes and no proposal is written here.
