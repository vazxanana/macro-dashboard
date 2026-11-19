# Pre-registration: spot gold into and after the two Eids (14 Nov 2026)

Written and pushed alone (with its fixed date table `dates.mjs`), before any candle of this study is read. Research only, paper
only: no rule, size, filter, stop, config, council member or mirror setting changes.

**Not a gold-book test (owner item 44).** A NEW standalone calendar study of one claim about Middle-East / South-Asian physical
demand. It is not a gate, exit, entry or size for Gold trend, Gold trend fast, Gold daily engulf, the Mosha cycle or any other
gold system, the live book's positions are not read, and nothing here will be proposed as one.

## The claim
Gold-demand commentary names the end of Ramadan (Eid al-Fitr) and Eid al-Adha as gifting / jewellery peaks in the Gulf, Turkey,
Pakistan, India's Muslim population and South-East Asia. Read on spot gold (XAU/USD): (a) gold drifts up MORE THAN USUAL in the two
weeks into each Eid; (b) it gives some back in the week after, when that demand is spent. The Hijri calendar moves about 11 days a
year against the Gregorian one, so over 2007-2026 each Eid walks through about eight calendar months: the test cannot be a
month-of-year effect in disguise.

## Dedupe (done before writing this)
`ls research/edge`, the remote branches (`git branch -r | grep -iE 'eid|ramadan|islam|hijri|festiv|calendar'`) and
`research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): no study of Eid or Ramadan. The nearest are
`gold-india-festivals` (Dhanteras / Akshaya Tritiya; FAIL, best OOS t +0.88), `gold-china-holidays` (FAIL), `gold-month-of-year`
(FAIL) and `seasonality` (FAIL). This study reuses the gold-india-festivals design (windows, trade, stop, cost, placebo) so the
studies read side by side, and adds the drift-free excess as the primary measure.

## Dates: `dates.mjs` (fixed now, never looked up at run time)
Eid al-Fitr = 1 Shawwal, Eid al-Adha = 10 Dhu al-Hijjah, Umm al-Qura calendar (Saudi civil calendar), 2007-2026, 20 of each, as
the ICU `islamic-umalqura` calendar of Node gave them today. Observed dates elsewhere can be a day off; that moves a window by at
most one trading day. All 40 dates kept.

## Data
- council-data `research/daily/xau.json` (OANDA mid, complete UTC days, `cols [t,o,h,l,c,v]`), copied with `git show`, kept out of
  git; Saturday / Sunday candles folded into the next weekday (`council/fills.mjs` `foldWeekend`, read only). Trading days = the
  folded weekday candles.
- OANDA mid H1 XAU/USD (`[t,o,h,l,c]`, from March 2006; a cache outside git) only to check stops inside a holding.
- Market set fixed now: XAU/USD only.

## Windows (Eid date D)
- P = the last trading day with UTC date strictly before D; F = the last trading day with UTC date on or before D.
- **T1 (Eid al-Fitr run-up)**: long from the close 10 trading days before P to the close of P.
- **T2 (Eid al-Adha run-up)**: the same for Eid al-Adha.
- **T3 (post-Eid give-back)**: SHORT from the close of F to the close of the 5th trading day after F; both Eids pooled (two events a
  year, always in different calendar months: the two Eids are about 70 days apart).
- An event the candles do not cover is left out and named.

## The trade and costs
- **Every trade has a stop**: 2 x ATR(20) of the folded daily candles (candles up to and including the entry day only), below a
  long's entry / above a short's, checked on each H1 candle from the entry close to the exit close (a candle opening through the
  stop fills at its open; one touching it fills at the stop).
- R = (exit - entry) / r0 for a long, (entry - exit) / r0 for a short; net R = that minus $0.60 / r0 minus financing in R.
- Cost $0.60 an ounce round trip (spread and slippage, as gold-india-festivals); 2x cost = $1.20.
- Financing on buys only: `council/fills.mjs` `financing()` with `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD swap of 11 Nov 2026; Wednesday three); today's rate charged in every year. Shorts: nothing charged or credited.

## The primary measure: excess over the same trade on every eligible day
For each event, **excess R = the event's net R minus the mean net R of every ordinary holding of the same length and side whose
both ends fall in the same calendar year and which touches no window of that test** (traded by the same rule, same stop, same
cost). This removes gold's drift of that year: a long window in a rising year must beat the average long of that year.

## Statistics
- In sample 2007-2016 (10 events per Eid), out of sample 2017-2026 (10 per Eid; T3 pooled 20 a window).
- t = one-sample t of the mean excess R over events. Each event sits in its own calendar month, so this equals the t on
  calendar-month sums.
- Holm over the three out-of-sample excess tests (two-sided p, t distribution).
- **Placebo** (per test): 40 seeds (seeded PRNG); each seed draws, for every out-of-sample event, one random ordinary holding of the
  same year (same length, same side, outside the windows of that test), and takes the mean of its excess R by the same formula. The
  real out-of-sample mean excess is compared with the 40.
- Also reported: the raw net R (gross, cost, financing) per window, and everything at 2x cost.

## Pass bar (each test on its own; the study PASSES if any test passes)
All must hold: (1) out-of-sample mean excess t >= 2 and Holm-adjusted p < 0.05; (2) in-sample mean excess of the same sign;
(3) out-of-sample mean net R still positive at 2x cost, and the mean excess at 2x cost (event and baseline both at 2x) still
positive; (4) the out-of-sample mean excess above at least 38 of the 40 placebo seeds.

**Power, said plainly**: 10 events a window per Eid. A t of 2 on 10 events needs a mean excess of about 0.67 standard deviations;
a modest real effect would fail. A FAIL means "not shown", not "shown absent". Whatever the verdict, nothing live changes; a pass
would be a hypothesis for the owner, never a gate on a gold-book system.
