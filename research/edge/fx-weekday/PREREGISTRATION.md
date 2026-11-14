# Pre-registration: day-of-week effects in the US dollar basket (14 Nov 2026)

Written and pushed before any number of this study is computed. Research only, paper only: no rule, size, filter, stop,
config, council member or mirror setting changes. Not an ICT study.

## Why
Calendar effects were tested on US indices the same week (branches `turnaround-tuesday`, `turnaround-replicate`, read with
`git show` only, nothing imported across branches). No study here has tested the day of the week in currencies. Question: is
the US dollar's return on any one weekday reliably different from its return on the other four, and could it be traded after
costs and financing?

## The basket
- Long US dollar against EUR, GBP, AUD, NZD, JPY and CHF, the six legs equal-weighted: short EUR/USD, GBP/USD, AUD/USD,
  NZD/USD; long USD/JPY, USD/CHF.
- OANDA mid daily candles (complete UTC days) of `eurusd gbpusd audusd nzdusd usdjpy usdchf` from council-data
  `research/daily/<key>.json`, read with `git show origin/council-data:…` (`node run.mjs fetch <dir>`, kept out of git).
- Saturday / Sunday candles are folded into the next Monday with `foldWeekend` (`council/fills.mjs`, imported, not edited).
  A day's close is the close of that folded UTC candle.
- A basket day exists when all six pairs have a candle on that UTC date and the candle before it, and an ATR(20) (below).

## One day's position, per leg
- **Hold**: enter at the previous candle's close, exit at this day's close, on the long-USD side of the leg. The day is
  labelled by its own weekday (Monday … Friday; Monday's hold covers the weekend).
- **Stop**: 2 x ATR(20) from the entry, ATR = simple mean of the true range of the 20 folded candles ending at the entry
  candle. On the day's candle: an open at or past the stop fills at the open, otherwise a high / low at or past it fills at the
  stop. Every position has a stop (it will rarely bind on one day).
- **Gross %** = (exit - entry) / entry x side (side +1 long the pair, -1 short it). **1R** = 2 x ATR. **Gross R** = gross
  price move / 1R.
- **Costs**, one raw-spread round trip a day per leg, as a share of the entry price: a 0.3 pip spread (0.01 for JPY pairs,
  0.0001 otherwise; the fx-carry study's assumption: the demo account's measured median quote spread between rollovers is 0
  on EUR/USD, GBP/USD, AUD/USD and USD/CHF, so a positive assumed spread is the conservative side) plus the demo account's
  forex commission, round trip 0.0045 % of notional (`ctrader/symbols.json` `commissionRT` 0.000045).
- **Financing**, one rollover a day, three on the day that holds the Wednesday rollover (broker `rollover3Days` 3), so the
  Wednesday-labelled day pays three:
  - EUR, GBP, AUD, CHF legs: the demo broker's swaps from council-data `ctrader/symbols.json` (frozen into `swaps.json` beside
    this file at fetch time), type 0 = pips a lot a night: the long-USD side of EUR/USD, GBP/USD, AUD/USD is their
    `swap.short`, of USD/CHF `swap.long`; as a share of price = pips x pip size / entry. Today's swap is used for every year
    (as `FIN` is for gold): said in the result.
  - NZD and JPY legs (not in `symbols.json`): the rate gap from the fx-carry study's `rates.json` (copied beside this file
    from `origin/fx-carry`, its stated approximations kept), rate of the currency held minus rate of the one sold, less a
    1 % a year markup, / 365 a night. The rate table starts 31 Dec 2004.
  - The short-USD side (used only for a negative effect, below) takes the other swap / the opposite gap less the markup.
- **Basket**: a day's basket % = mean of the six legs' %; a day's basket R = mean of the six legs' R. Net = gross - costs +
  financing.

## Windows
- **Decisive: 4 Jan 2016 to the last complete day on file.**
- **Replication: every basket day before 2016 from 3 Jan 2005** (the rate table starts 31 Dec 2004; the candles go back to
  2002 but the NZD / JPY financing does not).

## Tests T1-T5 (Monday … Friday), one per weekday
For weekday W in a window:
- **Welch t** of the GROSS long-USD basket daily % on W days against the gross basket daily % on the other four weekdays
  (two-sided; p from the normal approximation). Gross, because the costs are the same every day and only the Wednesday
  financing differs by construction; the tradeable test below is net.
- **Holm** over the five decisive p values.
- **Side** of the effect s_W = sign(decisive mean on W - decisive mean on the rest): long USD when +, short USD when -.
- Reported, not judged: a t on calendar months (for each month with both, mean gross W return minus mean gross return of the
  other weekdays; one-sample t of those monthly differences), the gross and net means, win rate, stops hit.

## Pass bar (a weekday passes when all three hold)
- **P1, same sign**: the net basket % mean on W days traded on side s_W is above zero in the decisive window AND in the
  replication window.
- **P2**: decisive Holm-adjusted p < 0.05.
- **P3, tradeable**: the decisive net basket R per trade (mean of the six legs' net R, side s_W) is > 0.
- **Verdict PASS** when at least one weekday passes; else **FAIL**. A FAIL is a result.

## Checks reported, not judged
- **2x cost**: P1 and P3 with the spread and commission doubled and the rate markup doubled (broker swaps as quoted).
- **Placebo**: 40 seeds (1 to 40, a fixed generator): the weekday labels of the decisive basket days are shuffled at random
  (the same number of days per label), the five Welch tests and Holm are run again. Reported: how many seeds give a Holm p
  under 0.05 on any label, and the share of seeds whose largest |t| is at least the real largest |t|.

## After
`run.mjs`, `result.json`, `RESULT.md` (verdict line first), `tests/fx-weekday.test.mjs` (offline). A proposal (a paper shadow,
never a live change) only if the verdict is PASS.
