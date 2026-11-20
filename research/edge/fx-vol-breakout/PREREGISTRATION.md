# Pre-registration: the gold volatility breakout's T1 rule, unchanged, on six forex majors (20 Nov 2026)

Written and pushed alone, before any forex candle of this study is fetched or any forex trade of this rule is computed. The
test runs once; nothing below is changed after a result is seen. Paper research only: nothing live changes, no council member,
page, mirror or config reads it. Not part of the ICT edge (nothing under `ict/` is read or touched).

## What this is, and what it is not
- **A breadth check of `gold-vol-breakout` T1, not a new rule.** T1 (UTC open ± 0.5 × the previous day's range, stop back at
  the open, out at 21:00 UTC) passed on gold at the broker's own ticks (`gold-vol-breakout-exec`), failed on silver
  (`silver-vol-breakout`, `-hourcost`), failed on NAS100 / SPX500 (`index-vol-breakout`, `-hourcost`) and on NAS100 2010-15
  (`nas-vol-breakout-early`), and failed on platinum / palladium (`pgm-vol-breakout`).
- **The question:** does the same rule work on the six forex majors the demo broker quotes, at the demo's own cost? Forex has
  never been tested with this rule (checked 20 Nov 2026: no `research/edge/*breakout*` pre-registration names a currency pair
  except `nr7-breakout`, another trigger).
- Stand-alone. Never a gate, exit, entry or size of any live book (owner decision 44).

## Data (named before any result)
- Markets, fixed now: **EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF** (OANDA keys `eurusd gbpusd usdjpy audusd usdcad
  usdchf`; the six majors on the demo's `ctrader/symbols.json`). OANDA mid M5 through the site's keyless candle proxy
  (`MD_BASE=https://aureumdesk.co.uk/md/`), 2015-12-01 00:00 UTC to the fetch time, cache files kept out of git
  (`<key>-5m.json.gz`, rows `[t, o, h, l, c]`; candles marked `live` dropped).
- Forex trades continuously Sunday ~21:00 UTC to Friday ~21:00 UTC, so 00:00 UTC is inside the session every weekday and the
  rule's day 00:00-20:55 UTC has candles; D1 = the UTC calendar day from its M5 candles, weekend stubs folded into the next
  weekday by `council/fills.mjs` `foldWeekend` (the original's `buildDays`, unchanged). Day skips are the original's
  (no previous range, a flat previous day, no candle in 00:00-00:55, fewer than 200 candles before 21:00).
- Trading days: UTC Monday-Friday 2016-01-01 to the last complete day.

## Rule (T1, unchanged)
- `original.mjs` of `research/edge/index-vol-breakout/` (sha256
  afa36e031e39daabb4f88ed9231daa55246fcccb659b0a9668fda52ad022276f), imported, never copied or edited: `buildDays`, `daySkip`,
  `vbTrade` (k 0.5, both sides), `placeboTrade`, `monthT`, `normP`, `holm`, `rng`, `summary`.
- Buy stop O + 0.5 × prevRange, sell stop O − 0.5 × prevRange from 00:00 UTC; first reached fills, one trade a day; stop = O
  from the fill; out at the close of the last M5 candle starting before 21:00 UTC unless stopped. No target.

## Costs (the demo broker's, measured, fixed now)
- **Commission**: `ctrader/symbols.json` `commissionRT` = 0.000045 of the entry price a round trip on every forex major (the
  file of 20 Nov 2026).
- **Spread and slippage**: the demo quotes these majors bid = ask on 93-100 % of reads outside the rollover (`spreadTypical`
  median 0; CLAUDE.md "Forex spreads"). Entry is a stop order and an exit is at market or at the stop, so a pre-set allowance
  is charged: **0.5 pip a round trip** (0.00005 of price units on the non-JPY pairs, 0.005 on USD/JPY), the CLAUDE.md
  assumption "half a spread of the default 1 pip" per market order, twice.
- Per trade in R: (commission × entry + 0.5 pip) / 1R. **2x costs** = both doubled.
- **Financing**: none. The 21:00 UTC exit is before the 22:00 UTC rollover (`nights` = 0 for every trade, counted and reported).

## Windows
- 2016-01-01 to 2020-12-31 (IS) and 2021-01-01 to the end (OOS). Both are out of sample for these markets.

## Statistics
- Per market and pooled (all six markets' trades together), per window and 2016 → now: n, win %, gross and net R a trade, net
  at 2x costs, worst drawdown, t on calendar-month sums of net R (`monthT`).
- **Seven tests**: the pool (P) and each of the six markets; one-sided p of each 2016 → now month t of net R, Holm over all
  seven.
- **Placebo**, 40 seeds (1-40) per market, the original's construction: on every tradable day one market entry at an M5 candle
  drawn uniformly from 01:00-18:00 UTC, a fair-coin side, stop 0.5 × prevRange away, out at 21:00 or the stop, same costs; the
  pool's placebo mean per seed is the mean over all six markets' placebo trades of that seed.

## Pass bar
A series (the pool or one market) PASSES only when ALL hold:
1. net R a trade > 0 in 2016-20 AND in 2021 → now;
2. 2016 → now month t of net R ≥ 2 AND Holm-adjusted p < 0.05 (over the seven);
3. 2016 → now net R a trade > 0 at 2x costs;
4. the 2016 → now mean net R beats at least 38 of its 40 placebo seed means;
5. n ≥ 30 in each window.

**"The rule works on forex" only when the pool passes.** A single market passing without the pool: a hypothesis for its own
pre-registration on other data, not an edge. Neither: the effect is not seen on forex (read with the other failures: gold-only).
Gross R is reported beside net for every series.

Whatever the verdict, nothing live changes and no proposal is written here.
