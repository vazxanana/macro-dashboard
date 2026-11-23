# A lower-timeframe ChoCh as the entry at an H4 / H1 key zone: result (23 Nov 2026)

**Verdict: INCONCLUSIVE. T1 (M5 ChoCh, 2R, 18 markets) −0.014R a trade before costs out of sample (n 117772, month t −3.42); T2 (M1) −0.007R (n 46335); M5 vs M15 −0.003R, M1 vs M5 +0.007R**

Read it plainly: **no ChoCh entry makes money, even before costs, on any entry timeframe, and the lower timeframe is not
better.** T1, T2 and T3 FAIL. The study is INCONCLUSIVE only by its own pre-registered rule ("FAIL if every test fails"): T4,
M1 minus M5 on gold / EUR/USD / GBP/USD, is slightly positive in both windows (+0.012R, t 1.15; +0.007R, t 0.57) because M5
loses a little more than M1 there, not because M1 makes money (M1 itself −0.007R). After costs the M1 entry is the worst of the
three (−0.143R a trade out of sample) and M1 minus M5 is −0.063R (t −5.20).

Pre-registered in PREREGISTRATION.md (committed before any trade was computed); judged on R **before costs** by the dated
amendment the owner asked for, committed before the full run (one earlier smoke run on gold alone is disclosed there). Run by
`run.mjs` on the edgekit OANDA mid cache: 5-minute candles for 18 markets and 1-minute candles for xau, eurusd, gbpusd, 2019 to
23 Nov 2026 11:00 UTC. M1 entries are simulated on 1-minute candles, M15 and M5 entries on 5-minute candles. Fills 2020-01-01
on; discovery 2020-2023, confirmation 2024 on. t on calendar-month sums (empty months 0); Holm over the four tests.

## The four tests (before costs; after costs beside, not judged)

| Test | Window | n | Mean R before costs | Month t | Mean R after costs | Verdict |
|---|---|---|---|---|---|---|
| T1 M5 ChoCh, entry A, 2R, 18 markets | 2020-23 | 163982 | −0.017R | −3.48 | −0.100R | **FAIL** |
| | 2024 on | n 117772 | −0.014R | t −3.42 | −0.097R | Holm p 1 |
| T2 M1 ChoCh, entry A, 2R, 3 markets | 2020-23 | 63381 | −0.008R | −1.33 | −0.155R | **FAIL** |
| | 2024 on | n 46335 | −0.007R | −1.03 | −0.143R | Holm p 1 |
| T3 M5 minus M15 (18 markets), Welch t | 2020-23 | 163982 / 62526 | −0.010R | −1.47 | −0.039R (t −6.00) | **FAIL** |
| | 2024 on | 117772 / 44661 | −0.003R | −0.44 | −0.034R (t −4.41) | Holm p 1 |
| T4 M1 minus M5 (3 markets), Welch t | 2020-23 | 63381 / 27521 | +0.012R | 1.15 | −0.062R (t −6.12) | **INCONCLUSIVE** |
| | 2024 on | 46335 / 19821 | +0.007R | 0.57 | −0.063R (t −5.20) | Holm p 1 (raw p 0.284) |

The M15 control (entry A, 2R): −0.007R before costs in 2020-23 (n 62526, t −1.11) and −0.011R in 2024 on (n 44661, t −1.95).
Each entry timeframe wins about a third of its 2R trades: the win rate of a coin at a 2R target.

## Why the lower timeframe looks the way it does
The stop sits past the extreme made since the touch, so a lower-timeframe ChoCh gives a closer stop (gold median about $8 on
M15, $4.80 on M5, $2.10 on M1 in the smoke run). Before costs that changes nothing: every timeframe is at zero or a little
below. After costs a close stop pays a larger share of its risk (cost about 0.05R a trade on M15, 0.08R on M5, 0.14R on M1, out of sample), so
the owner's "M5 / M1 is better" is the reverse of what the costs do; before costs it is not better either.

## Reported only (no verdict)
- **Entry B** (a limit at the broken level): 5m 2R −0.009R before costs out of sample (n 100254, t −2.03); 1m −0.016R (t −2.17).
- **3R**: 5m −0.016R (t −2.59), 1m −0.014R (t −1.41), 15m −0.009R. **Far target** (opposite H4 / D1 zone >= 3R away): 5m
  −0.062R (n 19013, t −2.06), 1m +0.007R (n 18363, t 0.29), 15m −0.090R.
- **Zone timeframe** (entry A, 2R, out of sample): H4 zones 5m −0.007R, 1m +0.010R (t 0.70), 15m −0.012R; H1 zones 5m
  −0.018R (t −3.09), 1m −0.013R, 15m −0.009R.
- **Zone kind** (5m, out of sample): eg −0.012R, ef −0.014R, bar −0.009R, dom −0.019R. First visit −0.019R, second −0.002R.
- **Markets** (5m, out of sample): between −0.070R (eurgbp) and +0.054R (de40, t 3.11); de40 was +0.010R in 2020-23 (t 0.56),
  usdjpy +0.046R in 2020-23 (t 3.80) and −0.020R after. Picked after looking, one of 18: no market split is a finding.
- **Years** (T1 before costs): every year 2020-2026 is negative, −0.007R to −0.032R.

## Limits
- Concurrent trades are allowed and one ChoCh can serve only one zone touch, but a market still gives about 20,000 trades a
  year: they overlap in time, so per-trade counts overstate the information; the month-sum t is the statistic judged.
- The 1-minute cache starts in 2019 and was fetched for this study; it has not been through the data-quality audit (the 5m
  exclusions are applied to M1 fills too).
- OANDA mid candles; the zone and structure code are the grids' (`combo-grid` `buildZones` / `frames`, `edgekit.structure(bars, 2)`).
- No other wait, swing size, stop, target or market set was tried. The question "is a lower-timeframe ChoCh a better entry at
  these zones" is answered no on 2020-2026; do not re-test variants on these years.

Nothing live changed. Test: `tests/ltf-choch-entry.test.mjs`.
