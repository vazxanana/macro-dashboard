# Does gold rise after Hong Kong equities sharply under-run US equities? Pre-registration

Written and committed **before** any return below was computed (14 Nov 2026). Only event COUNTS were read before writing
(`node run.mjs count <dir>`, which reads no price change after a signal); the data, the markets, the signal, the trade, the
costs, the statistics and the pass bar are fixed here. Anything added later is labelled post hoc in `RESULT.md`.

Paper research only. **A stand-alone rule on gold (XAU/USD)**: not a gate, filter, size step, entry or exit for the live gold
book (Gold trend, Gold daily engulf, Mosha cycle), never compared with or applied to it, and it does not use the book's
2006-17 window or its positions (owner decision 44). No live rule, size, filter, stop, config, cost constant or council member
changes, whatever the outcome.

## Question and economic reason

Chinese households and institutions are the largest buyers of physical gold, and gold is the usual home for Chinese savings
when local risk assets fall (equity and property stress, capital-control worries). A week in which Hong Kong's main index
falls far behind the US index is a China-specific stress signal (a global sell-off moves both, so the gap removes it). The
hypothesis: **after Hong Kong equities have under-run US equities by an unusually large amount over 5 days, gold rises more
over the next days than it does after an ordinary day of the same window** (Chinese wealth flowing into gold, with a lag).

## Dedupe (read before writing this)

- `gold-haven-shock` (branch, FAIL): gold after a US index SHOCK DAY (S&P 500 / Nasdaq below -2 sd). Global equity shock, one
  day, US only; here the RELATIVE 5-day gap of Hong Kong against the US, which is near zero in a global sell-off.
- `gold-equity-bear`, `gold-equity-corr-momentum`, `gold-liquidation-day`, `gold-spx-rs`, `gold-index-dispersion`: US equities
  or a broad index cross-section, never Hong Kong against the US.
- `gold-china-holidays` (branch): Chinese calendar holidays; `gold-yuan-hedge` (branch): the yuan (USD/CNH). Neither reads
  Chinese equities. `us-asia-lead`, `gold-us-asia`, `index-pair`, `index-xs-momentum`: trade indices or sessions, not gold on
  an HK-US gap.
- No study in `research/edge/`, on a remote branch, in the scratch topics list or in
  `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`) reads `hk33` for a gold trade. This is new.

## Data and markets (named before any result)

- council-data `research/daily/xau.json` (traded), `hk33.json` (Hong Kong 33 CFD, HKD) and `spx500.json` (US S&P 500 CFD),
  OANDA mid daily candles, UTC days, read with `git show origin/council-data:…` (no network), commit recorded in result.json.
  Saturday / Sunday candles folded into the next weekday with `council/fills.mjs` `foldWeekend`. No other market is read.
- Candle caches are kept outside git (`node run.mjs fetch <dir>`), deleted after the run.

## The rule

- **Gap** of day D (a day both indices have a candle; joint days only): `ln(HK close_D / HK close 5 joint days before) -
  ln(US close_D / US close 5 joint days before)`. Both closes are known at the UTC close of D.
- **Stress day**: D is a gold candle day and its gap is at or below the q-quantile (sorted value at index floor(q x 249)) of
  the 250 gaps of the joint days BEFORE D (D itself not included).
- **Trade**: buy gold at the open of the first gold candle after D. Stop = entry - 2 x ATR(20), the ATR of the 20 gold
  candles before the entry candle. Every trade has this stop. Exit at the close of the H-th candle (the entry candle is the
  first), or at the stop (a candle opening through the stop exits at its open, else a low at or under the stop exits at the
  stop). No target, no break-even, no trail. One trade at a time: a signal while a trade is open is skipped.
- **Costs**: $0.60 a round trip in price, plus financing on the buy: `nights(entry, exit)` x `FIN.xau.long` (council/fills.mjs,
  the demo broker's measured XAUUSD swap of 11 Nov 2026, used for every year) x entry price. R = (exit - entry - costs) /
  (entry - stop). Twice the costs is also reported.
- **Baseline**: the same buy (same stop, hold, costs) after EVERY eligible weekday of the same window and year span, stress
  days included, each its own trade (overlap allowed). Excess of a signal trade = its net R - the baseline's mean net R in
  that window (the same-side trade taken on every day, so gold's drift is removed).

## Tests (three, Holm over the three)

| Test | q (quantile) | H (candles held) | events counted before writing (non-overlapping, IS / OOS) |
|---|---|---|---|
| T1 (primary) | 0.15 | 5 | 164 / 140 |
| T2 | 0.10 | 3 | 167 / 134 |
| T3 | 0.20 | 10 | 146 / 134 |

(First counts read with q 0.10 / H 10 gave 98 / 82 events, under the 100 needed, so the holds were set as above before any
return was read.)

## Windows

Signal days: in sample 2007-01-01 to 2016-12-31; out of sample 2017-01-01 to 2026-10-31.

## Statistics and pass bar

- t on calendar-month sums of the excess (months by exit stamp, empty months 0). One-sided p, normal approximation, Holm over
  the three out-of-sample tests.
- **Placebo**: 40 seeded draws (mulberry32, seeds 1-40) of as many random eligible weekdays as there are stress days out of
  sample, run through the same one-at-a-time simulation; the real month t is ranked against them.
- A test **passes** only if all hold: out-of-sample excess month t >= 2 and Holm p <= 0.05; in-sample excess > 0;
  out-of-sample net R a trade > 0; out-of-sample excess still > 0 at twice the costs; above at least 38 of the 40 placebos.
- **Verdict**: PASS if T1 passes; "lead only" if only T2 or T3 passes; FAIL otherwise. A pass is a lead to replicate, never a
  live rule without the owner.
