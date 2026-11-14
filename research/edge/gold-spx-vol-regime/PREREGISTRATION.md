# Pre-registration: spot gold when US equity volatility turns, on the index's own candles (14 Nov 2026)

Written and pushed alone, before any gold return after an event was computed. A stand-alone study: it is not a gate, exit,
entry or size change of the live gold book, it reads none of the book's positions and none of the book's 2006-17 records
(docs/owner-decisions.md item 44). Paper only; nothing live changes.

## Hypothesis

Gold is said to react to a change of the equity VOLATILITY REGIME, not only to one bad equity day: when S&P 500 realised
volatility jumps out of its usual range (and above what gold itself is doing), haven buying and a later easier Fed are said to
lift gold over the next days; when equity volatility falls back under its usual level, that support is said to fade. Tested:
**a gold trade entered at the close of such a turn in S&P 500 realised volatility earns more than the same trade (same side,
same hold) entered on every gold day of the same year.**

Nearest tested topics, and why this is not one of them:
- `gold-haven-shock`: a single S&P 500 / Nasdaq shock DAY (a large return). Here the signal is realised volatility over 5 days
  measured against its own past (a regime turn), and in T1 against gold's own volatility; a turn usually has no shock day.
- `gold-equity-bear`, `gold-equity-new-depth`, `gold-equity-record`: equity price LEVELS (drawdown, new depth, new high).
- `gold-equity-corr-momentum`: gold-equity correlation. `gold-index-dispersion`: cross-index return spread on one day.
- `gold-bond-vol-spike`: 10-year bond volatility (RV5 / RV60), not equity volatility.
- `gold-silver-vol-ratio`, `gold-volvol-switch`, `gold-lowvol-hold`, `gold-rv-term`: gold's or silver's OWN volatility.
- `vix-term` (never run, data refused), `vol-managed`, `index-low-vol`, `vol-spike-rebound`: equity volatility used to trade
  equities, never gold.
No study reads S&P 500 realised volatility (its level against its own 1-year median, or its jump against gold's volatility) as
the signal for gold.

## Data and market set (fixed now)

- Traded: gold only, council-data `research/daily/xau.json` (OANDA mid spot XAU/USD, UTC daily candles, from March 2006).
- Signal: council-data `research/daily/spx500.json` (OANDA mid SPX500_USD, UTC daily candles, from March 2003).
- Both read with `git show origin/council-data:…` (no network, no cache in git); weekends folded into Monday with
  `council/fills.mjs` `foldWeekend`; days joined by UTC date. Both markets' UTC candles close at the same moment.

## The events (fixed now; counted before this file, no gold return looked at)

Log returns of folded daily closes; RVn on day d = sample sd of the last n returns up to and including d. Everything uses
closes up to day d only. Cooldown: an event within 5 signal days after the previous kept event of the same kind is skipped.

- **E1, equity volatility jumps relative to gold's.** q(d) = (SPX RV5 / SPX RV60) / (XAU RV5 / XAU RV60), on days where both
  markets have a candle. Event: q(d) >= **1.5** and q(d-1) < 1.5 (d-1 = the previous day with both candles).
- **E2, equity volatility turns high.** SPX RV5(d) > the median of SPX RV5 over the 252 signal days ending at d, and
  RV5(d-1) <= the median ending at d-1.
- **E3, equity volatility turns calm.** SPX RV5(d) < that median and RV5(d-1) >= the median ending at d-1.

Event months by entry: in sample 2007-01 to 2016-12, out of sample 2017-01 to 2026-10. Counted before writing this file (the
first idea, RV20 against its median, gave only 36-47 events a window and was dropped for that reason alone; the threshold 1.5 and
RV5 were chosen from the counts to reach at least 100 a window): **E1 153 in sample / 143 out of sample; E2 131 / 138; E3
135 / 137.** (Counts on signal days; an event without a gold candle that day is dropped and reported.)

## The trades

Entry at gold's daily close of the event day d; stop 2 x ATR(20) of gold's candles up to and including d, checked on each later
candle's high / low (a gapped stop fills at the open, `fills.mjs` `stopFill`); otherwise out at the close of the hold's last
gold day. R = side x move / risk. Costs: **$0.60 a round trip** and, on buys, **nights x FIN.xau.long x entry** (FIN.xau.long =
0.000148 of price a rollover, the cTrader demo's XAUUSD swap of 11 Nov 2026, `council/fills.mjs`; `nights` there: Mon-Fri
22:00 UTC, Wednesday three). Shorts pay or earn no financing (as every earlier gold study here).

| Test | Event | Side | Hold | Role |
|---|---|---|---|---|
| T1 | E1 equity vol jumps relative to gold's | buy | 5 gold days | primary |
| T2 | E2 equity vol turns high | buy | 10 gold days | secondary |
| T3 | E3 equity vol turns calm | sell | 10 gold days | secondary |

**Baseline** (per test): the same trade, same side, same hold, same stop rule, entered at the close of every gold day of the
same calendar year that has a full hold window. Per event: **excess = event net R - mean net R of that year's baseline**.

## Statistics and pass bar (fixed now)

- t on calendar-month sums of the excess (events grouped by entry month), one-sided p for excess > 0; Holm over the three
  out-of-sample p values.
- **Placebo**: 40 seeds (mulberry32, seed 20261114 + s): each out-of-sample event replaced by a random gold day of the same
  calendar month (not the event day), same trade against the same baseline; a seed's statistic = mean excess.
- **Control (drift and volatility kept, signal information removed)**: 40 seeds (seed 20261214 + s): within each calendar
  year gold's daily candles, each expressed relative to the previous close (open, high, low, close ratios), are shuffled and
  the price path rebuilt from the year's first previous close; dates stay in place. The real event dates are traded on that
  path and the baseline is rebuilt on it; a seed's statistic = out-of-sample mean excess.
- **PASS** (T1 decides the verdict; T2, T3 reported with the same checks): out-of-sample mean excess > 0 with month t >= 2,
  Holm p < 0.05, in-sample mean excess > 0, out-of-sample net R a trade > 0 AND excess > 0 at 2x costs ($1.20, financing x2),
  at least 38 of 40 placebo seeds beaten and at least 38 of 40 control seeds beaten. Anything else is FAIL. Gross and net R,
  the net-R month t, win rate and stops are reported.
- A pass would be a lead only (hundreds of tests in this repository), never an edge without a forward record; nothing would go
  live without the owner.

Files: `run.mjs`, `RESULT.md`, `result.json`, `tests/gold-spx-vol-regime.test.mjs`. Branch `gold-spx-vol-regime`, no pull
request.
