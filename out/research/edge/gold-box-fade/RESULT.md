# Gold: fading the break of a tight five-day box (14 Nov 2026)

**Verdict: FAIL, 0 of 3: fading the box break made −0.234R a trade net in 2007-16 (n 99, month t −1.51), −0.076R in 2017-26; 3 of 40 placebos.**

Pre-registered in `PREREGISTRATION.md` (pushed alone before any trade was computed). The fade was chosen after
`gold-box-breakout` (#1097) saw the breaks fail out of sample, so 2017-26 is descriptive here and 2007-16 decides (option b).
A stand-alone rule on spot gold, not a gate, exit, entry or size of the live gold book; none of its positions was read
(docs/owner-decisions.md item 44). Paper research only: nothing live changed and no proposal is written. This page is written
by `run.mjs` from `result.json`.

## Rule (as pre-registered)

- OANDA mid XAU/USD H1 (125704 candles, 2006-03-19 to 2026-11-13), UTC days, weekend hours folded into Monday (5369 days).
- Signal at a day's close: the five-day range (box) under 0.6 x the mean five-day range of the 60 windows before it.
- The first H1 touch of the box high or low within 5 days is the break (an hour touching both: no trade); enter the OPPOSITE way
  at the next H1 open; stop 0.5 x the box height beyond the broken edge (every trade has one; no trade if the entry is past it).
- T1 target the box's other side, out at the 20th day; T2 target the box midpoint, 20 days; T3 T1's target, out at the 5th day.
- Costs: $0.60 a round trip in R of each trade's risk; financing on buys `nights` x `FIN.xau.long` (0.000148 a rollover); 2x doubles both.
- Confirmation (decisive): entries 2007-2016; descriptive: 2017 to 2026-10-31 (seen by #1097). t on calendar-month sums of net R;
  Holm over 3 on the confirmation p; placebo = 40 seeded draws of random entry days, same sell share, stop and target distances.

## Results

| Test | Window | n | Gross R | Net R | Net at 2× | Win % | Total net R | Worst DD R | t net (months) | t gross | Median stop $ | Median cost R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 target the box's other side, 20 days (primary) | conf 2007-16 | 99 | −0.156 | −0.234 | −0.313 | 27.27 | −23.19 | −29.85 | −1.51 | −1.00 | 12.3 | +0.059 |
| T1 target the box's other side, 20 days (primary) | desc 2017-26 | 104 | +0.006 | −0.076 | −0.159 | 33.65 | −7.95 | −17.39 | −0.51 | +0.04 | 16.79 | +0.064 |
| T2 target the box midpoint, 20 days | conf 2007-16 | 116 | −0.283 | −0.354 | −0.425 | 34.48 | −41.08 | −43.11 | −3.63 | −2.96 | 11.98 | +0.056 |
| T2 target the box midpoint, 20 days | desc 2017-26 | 122 | −0.076 | −0.139 | −0.202 | 45.9 | −16.98 | −25.00 | −1.33 | −0.72 | 16.61 | +0.051 |
| T3 target the other side, time exit day 5 | conf 2007-16 | 101 | −0.162 | −0.239 | −0.315 | 30.69 | −24.09 | −32.12 | −1.67 | −1.13 | 12.34 | +0.059 |
| T3 target the other side, time exit day 5 | desc 2017-26 | 113 | −0.023 | −0.096 | −0.169 | 37.17 | −10.83 | −19.01 | −0.72 | −0.17 | 16.9 | +0.060 |

| Test | Conf p | Holm p | Buys conf (n, net R) | Sells conf (n, net R) | Exits conf (target / stop / gap / time) | Boxes with no trade, conf (no break / both / past stop / past target) |
|---|---|---|---|---|---|---|
| T1 | 0.131 | 0.19 | 45, −0.169 | 54, −0.289 | 27 / 72 / 0 / 0 | 0 / 0 / 1 / 0 |
| T2 | 0 | 0.001 | 51, −0.348 | 65, −0.359 | 41 / 75 / 0 / 0 | 0 / 0 / 1 / 0 |
| T3 | 0.095 | 0.19 | 45, −0.241 | 56, −0.236 | 21 / 70 / 0 / 10 | 0 / 0 / 1 / 0 |

Placebo (T1, 2007-16, 40 seeds, 100 random entry days): median −0.075R a trade, 95th percentile +0.285R; T1 (−0.234R) beats 3 of 40.

## Checks of the pass bar (T1)

- Confirmation net month t ≥ 2: no (−1.51).
- Holm p ≤ 0.05: no (0.19).
- Confirmation net R a trade > 0 at 2× costs: no (−0.313).
- Descriptive 2017-26 net R a trade > 0: no (−0.076).
- Above at least 38 of 40 placebos: no (3).

## Net R a trade by entry year (T1)

| Year | n | Net R |
|---|---|---|
| 2007 | 5 | −0.017 |
| 2008 | 7 | −0.046 |
| 2009 | 10 | −0.762 |
| 2010 | 11 | −0.786 |
| 2011 | 10 | −0.735 |
| 2012 | 14 | +0.807 |
| 2013 | 15 | −0.315 |
| 2014 | 9 | −0.433 |
| 2015 | 9 | +0.283 |
| 2016 | 9 | −0.489 |
| 2017 | 6 | +0.297 |
| 2018 | 8 | +0.752 |
| 2019 | 11 | −0.047 |
| 2020 | 11 | −0.213 |
| 2021 | 17 | −0.342 |
| 2022 | 7 | +0.776 |
| 2023 | 9 | −0.265 |
| 2024 | 14 | −0.161 |
| 2025 | 12 | −0.361 |
| 2026 | 9 | −0.394 |

## Reading

- **The fade does not pay either.** T1 lost in the decisive window (2007-16: −0.234R a trade net, n 99, month t −1.51; gross
  −0.156R) and only broke even before costs in 2017-26, the window where #1097 saw the breaks fail (gross +0.006R, net −0.076R,
  n 104). 72 of 99 decisive trades were stopped 0.5 box-heights beyond the broken edge; 27 reached the other side.
- Why the failed breaks of #1097 do not make a winning fade: a break that ends back through the box usually runs past the
  broken edge first, far enough to take a stop placed half a box beyond it. The fade's stop is tight (median $12.3 in
  2007-16, $16.8 in 2017-26) so costs are about 0.06R a trade, but the loss is there before costs.
- T2 (target the midpoint) lost most: −0.354R net in 2007-16, n 116, month t −3.63, Holm p 0.001. That is a significant loss of
  the fade, not a signal to follow the break: following was #1097's rule, and it lost too. T3 (out at day 5) −0.239R, t −1.67.
- T1 beats 3 of 40 random-entry placebos with the same sell share and stop / target distances (placebo median −0.075R): the
  box and its break pick worse entries than chance for a fade. Sells lost in both windows; buys made +0.332R in 2017-26 (n 49)
  after −0.169R in 2007-16 (n 45): a split seen after the result, not a rule to test on this data.
- Not an edge, no proposal, nothing live changed. No gate, exit, entry or size of the gold book was tested (item 44).

## To repeat

```sh
node --use-env-proxy research/edge/gold-box-fade/run.mjs fetch <dir>   # candles, kept out of git
node research/edge/gold-box-fade/run.mjs full <dir>
```
