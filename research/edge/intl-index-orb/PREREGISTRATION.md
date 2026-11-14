# The 5-minute opening range breakout at the European and Asian cash opens: pre-registration

Written and committed **before** any candle of these markets was downloaded or any trade computed (14 Nov 2026). The rule,
markets, calendars, costs, windows, placebo, tests and pass bar are fixed here; nothing in them changes after the results
are seen. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. No live rule, size, filter, stop, config or council member changes. ICT is not involved. A pass is at
most a hypothesis for a forward paper shadow that the owner decides on; never a live rule.

## Why

`orb-nas100` (branch `orb-nas100`) tested the 5-minute opening range breakout at the 09:30 New York cash open and FAILED
net, while gross it was positive in 2021 → now: NAS100 +0.135R a trade gross, +0.075R net (t 1.27); SPX500 +0.138R gross,
−0.053R net. `fx-london-orb` and `fx-tokyo-orb` failed on currencies. The same rule has not been tested at the cash opens
of non-US indices. This study re-uses `orb-nas100`'s rule **unchanged**; only the clock (each index's own local cash open
and close), the holiday calendar and the cost change.

Not the same rule as `open-run-breadth` / `open-run-breadth-2` (those test the council's NQ open run, a fade of a short
run through the open; no figure of them is used except their cost table).

## Markets (fixed now)

| Key (OANDA) | Index | Open (local) | Cash close (local) | Time zone | Exchange calendar |
|---|---|---|---|---|---|
| de40 (DE30_EUR) | DAX | 09:00 | 17:30 | Frankfurt (CET/CEST) | Xetra |
| eu50 (EU50_EUR) | Euro Stoxx 50 | 09:00 | 17:30 | Frankfurt (CET/CEST) | Xetra/Eurex (same closures) |
| fr40 (FR40_EUR) | CAC 40 | 09:00 | 17:30 | Paris (CET/CEST) | Euronext |
| uk100 (UK100_GBP) | FTSE 100 | 08:00 | 16:30 | London (GMT/BST) | LSE |
| jp225 (JP225_USD) | Nikkei 225 | 09:00 | 15:00, 15:30 from 5 Nov 2024 (TSE extension) | Tokyo (JST, no DST) | JPX |
| au200 (AU200_AUD) | ASX 200 | 10:00 | 16:00 | Sydney (AEST/AEDT) | ASX |

Groups: **European book** = de40, eu50, fr40, uk100 (pooled, **primary**). **Asian pair** = jp225, au200 (pooled).

## Clocks (each tested in `tests/intl-index-orb.test.mjs`)

- Central Europe and London (EU rule): summer time from the last Sunday of March 01:00 UTC to the last Sunday of October
  01:00 UTC; CET = UTC+1 / CEST = UTC+2; GMT = UTC+0 / BST = UTC+1.
- Tokyo: UTC+9 all year.
- Sydney (rules since 2008): AEDT = UTC+11 from the first Sunday of October 02:00 AEST (16:00 UTC the Saturday) to the
  first Sunday of April 03:00 AEDT (16:00 UTC the Saturday); else AEST = UTC+10.
- Trading days are weekdays, so a session never straddles a switch; the offset of each local date is the offset at its
  local noon.

## Calendars

Full-day closures: `research/edge/local-preholiday/holidays.mjs` (branch `local-preholiday`), copied unchanged into this
folder as `holidays.mjs` (functions `xetra`, `euronext`, `lse`, `jpx`, `asx`; their rules are written in that file). Eurex
(Euro Stoxx 50) uses the Xetra closures. **Early closes, skipped as `orb-nas100` skipped NYSE early closes**: Euronext 24
and 31 December (14:05), LSE 24 and 31 December (12:30), ASX 24 and 31 December (14:10), each when a weekday and not a
full closure. Xetra / Eurex: none (24 and 31 December are full closures). JPX: none modelled. Not modelled: unscheduled
closures (a missing first or entry candle then skips the day as "missing").

## The rule (as `orb-nas100`, at most one trade per day per market)

1. **First candle** F = the M5 candle starting at the local open. **Entry candle** E = the next one (open + 5 min). Either
   missing → no trade ("missing").
2. F closed up → **buy**; down → **sell**; open = close → no trade (doji).
3. **Entry** = open of E. **Stop** = F's low for a buy, F's high for a sell. Risk r = |entry − stop|; r ≤ 0 → no trade.
4. **Target** = entry ± 10 r.
5. Every candle from E (included) to the last candle starting before the local cash close is checked in order: a candle
   that opens at or past the stop exits at its open; otherwise a candle reaching the stop exits at the stop; a candle
   reaching the target exits at the target; **a candle that holds both exits at the stop**. Missing candles are not
   checked. (Tokyo's lunch break is not removed: the CFD trades through it and those candles are checked like the rest.)
6. Not out by then: exit at the close of the last candle on file before the cash close.
7. **R** = signed move / r; **net R** = R − cost / r. No financing (closed the same day, before the 17:00 New York rollover).

Every trade has a stop (absolute rule 1). Fixed 1R a trade.

## Costs (round trip, index points; the repo's figures, from `open-run-breadth` (#543) and `open-run-breadth-2`)

| Market | Cost (pts) | ×2 | Source |
|---|---|---|---|
| de40 | 2.0 | 4.0 | open-run-breadth: OANDA DE30 ~1.2 spread + slippage (FDXS tick) |
| eu50 | 3.5 | 7.0 | open-run-breadth-2: 1.5 spread + 1 FESX tick each way |
| fr40 | 2.2 | 4.4 | open-run-breadth-2: 1.2 spread + 0.5 FCE tick each way |
| uk100 | 2.0 | 4.0 | open-run-breadth-2: 1.0 spread + 0.5 ICE Z tick each way |
| jp225 | 18.0 | 36.0 | open-run-breadth-2: 8 spread + 5 OSE mini tick each way |
| au200 | 4.0 | 8.0 | open-run-breadth-2: 2.0 spread + 1 SPI tick each way |

These are published typical figures with slippage, not measured bid/ask (the proxy serves mid candles). A spread-only
figure is reported too (de40 1.2, eu50 1.5, fr40 1.2, uk100 1.0, jp225 8.0, au200 2.0), descriptive only.

## Data

OANDA mid M5 candles through the keyless proxy (`/md/bars`), 1 Dec 2015 to 14 Nov 2026, complete candles only, paged
in 4,999-candle windows exactly as `orb-nas100/fetch.mjs`: `node --use-env-proxy research/edge/intl-index-orb/fetch.mjs <dir>`.
Files stay out of git. Days run from 2016-01-01 to the last day on file.

## Windows (the same as `orb-nas100`, so the results compare)

- **A, 2016-01-01 to 2020-12-31**: in sample (reported; must have the same sign as B for a pass).
- **B, 2021-01-01 to the last candle on file**: **out of sample, decides**.
- B′, 2023-03-01 → end: descriptive, as in `orb-nas100`.

## Tests and statistics

Eight tests on window B: **T1 the pooled European book (primary)**, T2-T5 de40, eu50, fr40, uk100, T6-T7 jp225, au200,
T8 the pooled Asian pair. A pooled book is the union of its markets' trades (each 1R).

- t on **calendar-month sums** of net R (months with at least one trade); one-sided p from the normal approximation.
- **Holm** over the eight one-sided p, family 0.05.
- **Placebo**: 40 seeds (1 … 40, the `orb-nas100` generator); on every day with a real trade the side is drawn at random
  (½ / ½), stop at the other end of F for the drawn side, the same entry, target, exit and costs; per test, net R a trade
  per seed (pools: the union across markets for that seed); 95th percentile by linear interpolation.

## Pass bar (per test; the verdict is T1's)

A test passes when ALL hold: window B net R a trade > 0; monthly t ≥ 2; Holm-adjusted p ≤ 0.05; net R above the
placebo's 95th percentile; window A net R > 0 (same sign in sample); window B net R > 0 at **2× costs**.
**Verdict PASS** when T1 passes; otherwise **FAIL**. The other tests are reported with their own pass / fail; a single
market or the Asian pair passing while T1 fails is reported as a finding to be re-tested on its own, never as a pass.

## Not done, on purpose

No other range length, target, trailing stop, filter, size rule or market; no US market (done in `orb-nas100`). Any of
these needs its own pre-registration.
