# Pre-registration: spot gold around the Shanghai Gold Exchange's long Chinese holidays (14 Nov 2026)

Written and pushed alone, before any candle of this study is read. Research only, paper only: no rule, size, filter, stop,
config, council member or mirror setting changes.

**Not a gold-book test (owner item 44).** This is a NEW standalone calendar study of one industry claim about Chinese physical
demand. It is not a gate, exit, entry or size for Gold trend, Gold trend fast, Gold daily engulf, the Mosha cycle or any other
gold system, and nothing here will be proposed as one. Item 44 ("no further gate, exit, entry or size is tested on this book's
2006-17 window") stands.

## The claim
World Gold Council demand commentary describes Chinese jewellery and investment buying in the weeks before the Lunar New Year,
and a lull in Asian-hours flow while the Shanghai Gold Exchange (SGE) is shut for the long holidays. Three claims, read on spot
gold (XAU/USD):
- (a) gold rises in the 10 trading days before the Lunar New Year closure;
- (b) gold drifts (rises less, or falls) while Shanghai is shut;
- (c) gold rises in the 5 trading days after the SGE reopens, as Chinese buyers return.

## Dedupe (done before writing this)
`git log --remotes -G "lunar new year|chinese new year|golden week|spring festival" -- research/edge research/proposals` finds
no study of gold around the Chinese holidays. `local-preholiday` dropped Hong Kong's lunar holidays (hk33 index, not gold);
`intl-index-orb` and `overnight-unused-markets` use them only as calendar gaps on indices. `gold-month-of-year`,
`gold-us-asia`, `gold-session-drift`, `seasonality`, `post-holiday-metals`, `pre-holiday` contain no Chinese-holiday test (their
only matches are veteran-library reference texts). The backlog (`research/proposals/2026-11-14-untested-backlog.md`) lists
"Chinese New Year gold" as left out for thin n: this study runs it at the owner's request and says the n is thin.

## Dates: `dates.mjs`
SGE day sessions close on the State Council General Office's official public-holiday days; the SGE publishes the same calendar
each December ("部分节假日休市安排"). The make-up Saturdays and Sundays are never trading days. For each year 2008-2026:
- Lunar New Year: `first` = the first weekday the SGE is shut, `reopen` = the first weekday it trades again.
- Golden Week (National Day, merged with Mid-Autumn in some years): the same two dates.
Sourced from the official holiday schedule of each year as recalled; three years were checked against reports of the SGE's own
notices on 14 Nov 2026 (2020: the reopening put back to 3 February with the interbank gold market; 2024: the SGE traded on the
eve, 9 February, unlike the stock exchanges, and was shut 10-17 February; 2026: shut 15-23 February, open 24 February). A year
whose dates are not certain is dropped and named; none is expected to be. `tests/gold-china-holidays.test.mjs` checks known
examples date by date.

## Data
council-data `research/daily/xau.json` (OANDA mid, complete UTC days, `cols [t,o,h,l,c,v]`), copied with `git show`, kept out
of git; Saturday / Sunday candles folded into the next weekday (`council/fills.mjs` `foldWeekend`, read only). Trading days =
the folded weekday candles. Only XAU/USD is judged (fixed now). No intraday data: (b) is tested on daily closes only.

## Windows (event k of a holiday with first shut weekday F and reopening weekday R, in Beijing dates)
- L = the last trading day (UTC date) before F. The UTC close of L is 08:00 Beijing on F: Shanghai is already shut.
- **Pre (claim a)**: long from the close of the trading day 10 days before L to the close of L (10 trading days).
- **Shut (claim b)**: long from the close of L to the close of the last trading day before R (the UTC close of that day is
  08:00 Beijing on R, before the SGE opens). Claim (b) says this is weak: it is reported as long, read for its sign.
- **Post (claim c)**: long from the close of the last trading day before R to the close of the 5th trading day from R.

## The trade and costs
- Long at the window's entry close; exit at its last close. **Every trade has a stop**: 3 x ATR(20) of the folded daily candles
  (ATR from candles up to the entry day only) below the entry, checked on each later day's low; a day opening below it fills at
  the open. R = (exit - entry - cost) / r0, minus financing in R.
- Cost: $0.30 round trip (`council/fills.mjs` `spreadOf` for spot gold, the repo's gold studies) plus half a spread of
  slippage on each of the two market orders (`SLIP_SPREADS` 0.5 x $0.30 x 2 = $0.30): **$0.60 an ounce round trip**. 2x cost =
  $1.20.
- Financing: `council/fills.mjs` `financing()` with `FIN.xau.long` (0.000148 of price a rollover, the demo broker's XAUUSD
  swap of 11 Nov 2026; Wednesday counts three), nights from the entry close to the exit close; today's rate charged in every
  year, as in the repo's other gold studies.

## Tests (each a one-sample t over events of the mean net R; one event = one year, so the month-sum t is the event t)
- **T1 (primary)**: Lunar New Year, pre window, long.
- T2: Lunar New Year, shut window, long (claim b predicts <= 0; a positive t would contradict it).
- T3: Lunar New Year, post window, long.
- T4 (secondary): Golden Week, the three windows pooled (about three trades a year), long.
- In sample 2008-2016 (9 Lunar New Year events, 9 Golden Weeks), out of sample 2017-2026 (10 and 10). **About 9-10 events a
  window: thin.** A t of 2 on 10 events needs a mean of about 0.7 standard deviations; only a large effect can pass.
- Holm over the four out-of-sample tests (p from the t distribution, two-sided).
- Comparison (reported): Welch t of the T1 pre-window net R against every other 10-trading-day window (step 1 day) of the same
  years that overlaps no Lunar New Year or Golden Week window.
- **Placebo**: 40 seeds (seeded PRNG); each seed draws, for every out-of-sample year, one random 10-trading-day window of that
  year that overlaps no holiday window, and takes the mean net R. The real T1 out-of-sample mean is compared with the 40.

## Pass bar (primary T1 only; the others are reported and named)
PASS only if all hold: (1) T1 out-of-sample net t >= 2 and its Holm-adjusted p < 0.05; (2) in-sample net mean of the same sign
(positive); (3) out-of-sample net mean still positive at 2x cost; (4) the out-of-sample mean above at least 36 of the 40
placebo seeds. Otherwise FAIL. Claims (b) and (c) are read from T2 / T3 with the same Holm, never as a rule.

Whatever the verdict, nothing live changes; a pass would be a hypothesis for the owner, never a gate on a gold-book system.
