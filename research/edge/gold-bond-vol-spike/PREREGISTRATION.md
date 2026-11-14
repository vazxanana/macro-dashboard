# Pre-registration: spot gold after a rise in US 10-year Treasury volatility (14 Nov 2026)

Written and pushed alone, before any gold return after an event was computed. A stand-alone calendar / volatility-structure
study: it is not a gate, exit, entry or size change of the live gold book, it reads none of the book's positions and none of
the book's 2006-17 records (docs/owner-decisions.md item 44). Paper only; nothing live changes.

## Hypothesis

When US 10-year Treasury price volatility jumps (a stand-in for the MOVE index, which is not reachable from the sandbox), the
market is repricing the path of rates. Gold, the asset without a coupon whose price leans most on real rates, is said to rally
in the days after such a repricing (rate uncertainty, haven demand, a later Fed response). Tested: **a gold buy at the close of
the day a 10-year rates-volatility jump starts earns more than the same gold buy on an ordinary day of the same year.**

Nearest tested topics, and why this is not one of them: `gold-haven-shock` (an S&P 500 / Nasdaq shock DAY, an equity return,
not bond volatility); `gold-bond-lead` (a bond up WEEK that gold lagged: the direction of bond prices, not their volatility);
`gold-rate-spread` (the US-Bund level gap); `gold-curve-slope`; `vix-term` (not run, data refused); `vol-spike-rebound` (index
own-volatility on indices). No study reads bond volatility as the signal for gold.

## Data and market set (fixed now)

- Gold: council-data `research/daily/xau.json` (OANDA mid spot XAU/USD, UTC daily candles), the only traded market.
- Signal: council-data `research/daily/usb10y.json` (OANDA mid USB10Y_USD, the US 10-year Treasury CFD price), from March 2003.
- Both read with `git show origin/council-data:…` (no network, no cache in git); weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`; days joined by UTC date.

## The event (fixed now; counted before this file, no gold figure looked at)

On the bond's folded daily closes: RV5 = sample sd of the last 5 daily log returns up to and including day d, RV60 = the same
over the last 60. The ratio RV5 / RV60 >= **1.25** on day d and < 1.25 on day d-1 is an **onset**; an onset within 5 bond
trading days after the previous kept event is skipped (cooldown 5). Everything uses closes up to day d only. Event months by
entry: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10. Counted before writing this file (threshold chosen from
the counts alone, to have at least 100 events per window): **117 in sample, 112 out of sample** (at 1.5 there were only
51 / 42).

## The trades

Entry at gold's daily close of the event day d (the bond's daily candle closes before or with gold's on the same UTC date); stop
2 x ATR(20) of gold's candles up to and including d, checked on each later candle's high / low (a gapped stop fills at the open,
`fills.mjs` `stopFill`); otherwise out at the close of the hold's last day. R = move / risk. Costs: **$0.60 a round trip** and,
on buys, **nights x FIN.xau.long x entry** (FIN.xau.long = 0.000148 of price a rollover, the cTrader demo's XAUUSD swap of
11 Nov 2026, `council/fills.mjs`; `nights` there: Mon-Fri 22:00 UTC, Wednesday three). Shorts pay or earn no financing.

**Baseline** (per test): the same trade, same side, same hold, same stop rule, entered at the close of every gold day of the
same calendar year (that has a full hold window). Statistic per event: **excess = event net R - mean net R of that year's
baseline**.

| Test | Side | Hold | Role |
|---|---|---|---|
| T1 | long | 5 gold trading days | primary |
| T2 | long | 10 gold trading days | secondary |
| T3 | long | 1 gold trading day | secondary |

## Statistics and pass bar (fixed now)

- t on calendar-month sums of the excess (events grouped by entry month), one-sided p for excess > 0; Holm over the three
  out-of-sample p values.
- Placebo: 40 seeds (mulberry32, seed 20261114 + s): each out-of-sample event replaced by a random gold day of the same
  calendar month (not the event day), same trade; a seed's statistic = mean excess. Beaten = the real mean excess is above it.
- **PASS** (T1 decides the verdict; T2, T3 reported with the same checks): out-of-sample mean excess > 0 with month t >= 2,
  Holm p < 0.05, in-sample mean excess > 0, out-of-sample net R a trade > 0 AND excess > 0 at 2x costs ($1.20, financing x2),
  and at least 38 of 40 placebo seeds beaten. Anything else is FAIL. Gross and net R, raw net-R t, win rate, stops and the
  bond-falling / bond-rising split (descriptive) are reported.
- A pass would be a lead only (hundreds of tests in this repository), never an edge without a forward record; nothing would go
  live without the owner.

Files: `run.mjs`, `RESULT.md`, `result.json`, `tests/gold-bond-vol-spike.test.mjs`. Branch `gold-bond-vol-spike`, no pull
request.
