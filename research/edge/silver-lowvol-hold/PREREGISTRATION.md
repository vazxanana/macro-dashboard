# Silver bought in its quiet stretches, held wide: pre-registration (14 Nov 2026)

Written and pushed **alone, before** any return, R or t of the rules below was computed on silver. Only the number of
qualifying days per window was counted (below), from silver's own volatility, no return read. Anything added later is
labelled post hoc in `RESULT.md`.

Paper research only. A replication on silver of the gold near miss `gold-lowvol-hold` (branch `gold-lowvol-hold`): there,
buying gold on its quiet days and holding 20 days beat every-day buys out of sample by +0.152R a trade (n 906, Newey-West month
t 1.14) but lost to them in sample (-0.084R): FAIL, 0 of 3. This study asks whether the same rule, **unchanged**, holds on a
market it was not looked at on. It reads no trade record or position of the live gold book, is not a gate, exit, entry or
size of it, and proposes none (docs/owner-decisions.md item 44). Nothing live changes whatever the outcome. ICT is not
involved.

## Dedupe (read before writing)

- `gold-lowvol-hold` (branch): the rule copied here; gold only. FAIL (above).
- `index-low-vol` (branch): cross-sectional low-volatility anomaly across 17 national stock indices (long the three least
  volatile against the three most). FAIL. Another question (which market, not when to buy one market).
- `silver-vol-breakout` (branch): gold's open +/- 0.5 x previous range breakout on silver. FAIL. A breakout trigger, short holds.
- `gold-silver-vol-ratio` (branch): a ratio of the two metals' volatilities. Not silver's own percentile as a buy state.
- `gold-drd-silver`, `silver-rates-shrug`, `silver-ny-range-share`, `silver-carry-crash`, `silver-nikkei-drop`,
  `silver-euro-divergence`: other rules replicated on silver.
- `research/proposals/2026-11-14-untested-backlog.md` (branch `untested-backlog`): does not list it.
No study has bought silver on its own low-volatility percentile and compared it with the same buy on every day of the year.

## Data (named before any result)

- Market set: **spot silver only**, `git show origin/council-data:research/daily/xag.json` (OANDA mid XAG/USD daily candles,
  complete UTC days, 20 Mar 2006 to the file's last day, 13 Nov 2026), weekend candles folded into the next weekday with
  `council/fills.mjs` `foldWeekend`. No network, no cache written.
- Windows by the **entry month**: in sample 2007-01 (first qualifying day 4 Apr 2007, when a full year of volatility exists)
  to 2016-12; out of sample 2017-01 to 2026-10. A trade whose exit is not on file yet is dropped (counted).

## The rule (gold-lowvol-hold's, unchanged; `run.mjs` copies its code)

- `rv20(D)` = sample standard deviation of the 20 daily log close-to-close returns ending at D's close.
- `pct(D)` = share of the 252 previous trading days' `rv20` values strictly below `rv20(D)` (candles up to D only).
- **Quiet day**: `pct(D) < 1/3`. **Loud day** (contrast): `pct(D) >= 2/3`.
- Entry: buy at D's close. Stop: `3 x ATR(20)` below the entry, ATR of the 20 candles ending at D (every trade has a stop
  from the moment it is entered; a gap through it fills at the open, `stopFill`). Exit at the close of the H-th trading day
  after D, or at the stop. 1R = the stop distance.
- **Every qualifying day is a trade** (positions overlap, as the baseline's do).
- **Baseline**: the same buy (same stop rule, same H, same costs) entered at the close of **every** trading day of the same
  calendar year (the same-side every-day baseline). A rule trade's **excess** = its net R minus the mean net R of its year's
  baseline.

## Costs (only the market and its cost change)

- **$0.06 a round trip** on silver, as `silver-rates-shrug` set it: silver's $0.03 spread round trip (`gold-drd-silver`, the
  ICT lab's silver cost) plus $0.015 of slippage at each end, the same structure as gold's $0.60. 2x costs = $0.12.
- **Financing: none charged.** `council/fills.mjs` `FIN` holds a gold long rate only (`FIN.xau.long`, 0.000148 of price a
  rollover, the demo broker's XAUUSD swap of 11 Nov 2026); no silver rate is measured anywhere in the repository, so the
  judged figures carry no financing. This flatters every hold (20 and 60 days) against the gold study. **Reported only, not
  judged**: the same tables with gold's rate per unit of price charged on silver (`nights x 0.000148 x entry / risk`), and
  2x costs with twice that, as a sensitivity.

## Tests (three, Holm over all three) — as gold-lowvol-hold

| Test | Days | Hold H |
|---|---|---|
| T1 (primary) | quiet days | 20 trading days |
| T2 | quiet days | 60 trading days (the wide exit) |
| T3 | loud days (contrast) | 20 trading days |

Statistic: the **excess**, summed by calendar month of entry; t = mean / standard error of the month sums, Newey-West
(lag 1 for H 20, lag 3 for H 60); one-sided p (excess > 0) from Student's t with months - 1 degrees of freedom; Holm over the
three tests. Plain month t, gross figures and the rule's own net t are reported beside it.

## Pass bar (all must hold, judged on T1; T2 and T3 reported with the same checks)

1. Out of sample, excess > 0 with Newey-West month t >= 2 **and** Holm p < 0.05.
2. Out of sample, the rule's own net R a trade > 0.
3. In sample, excess > 0 (same sign).
4. Out of sample, net R a trade > 0 **and** excess > 0 at 2x costs.
5. Placebo: 40 seeded draws (seed 20261194 + k, as gold). Each draw replaces every out-of-sample rule trade by the trade of a
   random trading day of the same calendar year; its statistic = mean excess. The rule's mean excess must beat at least 38.

Control (reported): T3, the loud-day contrast, and the one-position-at-a-time version of T1. A pass is a lead for the owner,
never a live rule; it would also need the financing sensitivity to hold. A fail is reported as a fail; no threshold, hold,
percentile, stop or cost is changed after the run.

## Counted before this was written (qualifying days, no returns read)

| Window | Trading days | Quiet days (T1, T2) | Loud days (T3) |
|---|---|---|---|
| 2007-04 to 2016-12 | 2,536 | 949 | 829 |
| 2017-01 to 2026-10 | 2,552 | 921 | 895 |

Every test has well over 100 entries in each window, so all three are judged. Holds overlap: the effective sample is about the
number of months (about 117 a window); the Newey-West month t is what is judged.
