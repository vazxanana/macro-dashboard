# MSNR direction as a gate in front of the engulfing entry: result (11 Nov 2026)

**Verdict: FAIL, 0 of 3 tests: the engulfing entry taken with the direction call loses after costs in both windows (main test −0.110R a trade in 2020-26, n 795, t −2.51; −0.159R in 2007-19, n 1,269, t −4.63), the same entries without the gate lose about as much, and before costs every stream sits at zero. Mechanised this way, the method is not an edge on gold and the gate does not make it one.**

Paper research only. No live rule, size, filter, council member or page was changed. The entry, the stop, the three streams,
the three tests and the verdict were fixed in `PREREGISTRATION.md` (commit ccc1b2db) before a trade was simulated.

## What was tested

The owner's two skills, in my words (both are the owner's private material and are not in this repository):

1. **Direction call** (the gate): on H4, a close beyond the last swing level that existed before price first reached a
   Daily key level (swing, engulfing, failed-engulfing or dominant zone) sets the call to buy or sell; it stays until the
   opposite sequence completes. The detector is the one of the direction study, copied.
2. **Entry**: a 15-minute candle whose body engulfs the body of the candle before it, then, within 45 minutes, a 5-minute
   candle that does the same in the same direction; a market order at the open of the next 5-minute candle; the stop $0.30
   beyond the extreme of the 5-minute engulfing pair (no trade when that is under $1.00 from the entry); the target at 1.5
   times the stop distance; out after 12 hours; the stop never moves; one trade at a time.
3. **The same candidates, three ways**: **ALL** (the call ignored), **WITH** (the side equals the call), **AGAINST** (the side
   is opposite to the call). A gate is worth something only if WITH beats both.

Tests: **T1** (main) the trigger between 12:00 and 15:55 UTC, target 1.5R; **T2** the same with a 2R target; **T3** as T1 at any
hour. Data: OANDA spot gold M5, 1 June 2006 to 9 Nov 2026 (1,458,888 candles); M15, H4 and Daily candles built from them.
Cost: $0.30 a round trip. **2020-26** (1 Jan 2020 to 31 Oct 2026) is the confirmation window, **2007-19** the replication
window; nothing was fitted on either.

Funnel: 59,510 fifteen-minute setups, 28,817 five-minute triggers inside an armed 45 minutes, 75 dropped for a gap before the
entry candle, 10,596 for a stop under $1.00 away, **18,146 candidates** (4,826 of them in the 12:00-15:55 window). The call
was buy on 52% of candidates in 2007-19 and 66% in 2020-26, sell on the rest.

## Result

Win rate = share of trades with a net R above zero. t is the plain t of the per-trade net R.

| Test | Window | Stream | Trades | Win rate | R a trade, before costs | R a trade, net | t | Profit factor | Total R | Max drawdown R | Net at twice the cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | 2007-19 | ALL | 2,415 | 40.0% | −0.001 | −0.172 | −6.93 | 0.75 | −414.4 | 422.6 | −0.342 |
| T1 | 2007-19 | WITH | 1,269 | 40.6% | +0.014 | −0.159 | −4.63 | 0.77 | −201.5 | 206.3 | −0.331 |
| T1 | 2007-19 | AGAINST | 1,228 | 39.6% | −0.013 | −0.183 | −5.30 | 0.74 | −224.9 | 230.8 | −0.353 |
| T1 | 2020-26 | ALL | 1,541 | 38.2% | −0.037 | −0.147 | −4.66 | 0.78 | −226.4 | 242.4 | −0.257 |
| T1 | 2020-26 | WITH | 795 | 39.9% | +0.002 | −0.110 | −2.51 | 0.83 | −87.4 | 89.1 | −0.221 |
| T1 | 2020-26 | AGAINST | 814 | 36.6% | −0.072 | −0.182 | −4.17 | 0.74 | −147.8 | 166.9 | −0.291 |
| T2 | 2007-19 | ALL | 2,364 | 34.2% | +0.010 | −0.161 | −5.60 | 0.79 | −380.5 | 390.1 | −0.332 |
| T2 | 2007-19 | WITH | 1,246 | 34.0% | +0.006 | −0.167 | −4.22 | 0.78 | −207.9 | 217.3 | −0.339 |
| T2 | 2007-19 | AGAINST | 1,213 | 34.2% | +0.010 | −0.160 | −4.00 | 0.79 | −194.5 | 198.3 | −0.330 |
| T2 | 2020-26 | ALL | 1,503 | 32.5% | −0.029 | −0.140 | −3.86 | 0.81 | −210.3 | 224.6 | −0.251 |
| T2 | 2020-26 | WITH | 784 | 34.7% | +0.028 | −0.083 | −1.65 | 0.88 | −65.2 | 76.2 | −0.195 |
| T2 | 2020-26 | AGAINST | 799 | 30.5% | −0.083 | −0.193 | −3.90 | 0.75 | −154.3 | 171.2 | −0.303 |
| T3 | 2007-19 | ALL | 8,014 | 39.0% | −0.028 | −0.223 | −16.46 | 0.69 | −1790.3 | 1793.1 | −0.419 |
| T3 | 2007-19 | WITH | 4,261 | 39.2% | −0.022 | −0.219 | −11.78 | 0.70 | −934.2 | 938.3 | −0.417 |
| T3 | 2007-19 | AGAINST | 4,129 | 38.8% | −0.032 | −0.227 | −12.02 | 0.69 | −939.2 | 943.1 | −0.423 |
| T3 | 2020-26 | ALL | 6,751 | 39.4% | −0.016 | −0.161 | −10.66 | 0.77 | −1087.2 | 1092.3 | −0.306 |
| T3 | 2020-26 | WITH | 3,538 | 39.4% | −0.017 | −0.163 | −7.89 | 0.77 | −577.9 | 582.2 | −0.310 |
| T3 | 2020-26 | AGAINST | 3,577 | 39.0% | −0.028 | −0.173 | −8.30 | 0.75 | −618.3 | 632.5 | −0.318 |

The pre-registered bar, per test (WITH stream): 100+ trades in each window; net R above zero with t >= 2 in 2020-26; net R
above zero in 2007-19; the gate adds (WITH above ALL in both windows and above AGAINST in 2020-26); positive at twice the
cost; Holm-adjusted p under 0.05 over the three tests.

| Test | 100+ trades | 2020-26 net > 0, t >= 2 | 2007-19 net > 0 | Gate adds | Positive at twice the cost | Holm p | Passes |
|---|---|---|---|---|---|---|---|
| T1 | yes | no (−0.110R, t −2.51) | no (−0.159R) | yes | no | 1.00 | no |
| T2 | yes | no (−0.083R, t −1.65) | no (−0.167R) | no (below ALL in 2007-19) | no | 1.00 | no |
| T3 | yes | no (−0.163R, t −7.89) | no (−0.219R) | no (below ALL in 2020-26) | no | 1.00 | no |

**0 of 3 pass. No test is positive in either window, so the verdict is FAIL, not inconclusive.**

## Does the gate add anything?

The pre-registration asks for this answer in words, whatever the verdict.

| Test | Window | WITH minus ALL | WITH minus AGAINST | Welch t, WITH against AGAINST |
|---|---|---|---|---|
| T1 | 2007-19 | +0.013R | +0.024R | +0.50 |
| T1 | 2020-26 | +0.037R | +0.072R | +1.16 |
| T2 | 2007-19 | −0.006R | −0.007R | −0.12 |
| T2 | 2020-26 | +0.057R | +0.110R | +1.55 |
| T3 | 2007-19 | +0.004R | +0.008R | +0.31 |
| T3 | 2020-26 | −0.002R | +0.010R | +0.32 |

**No measurable amount.** Trading with the call was a few hundredths of an R better than trading against it in most cells,
never with a t of 2 (largest +1.55, on 784 against 799 trades), once the other way, and close to nothing over the 3,500 to
4,300 trades a stream of the all-hours test. Where the difference is largest (the session tests, 2020-26) it comes from the
buy side in a market that rose: with the call, buys −0.056R and sells −0.212R; against it, buys −0.198R and sells −0.173R.
Even the better side loses.

## Where the money goes

- **Before costs the entry is worth nothing**: −0.083R to +0.028R a trade in every stream of every test, on 784 to 8,014
  trades. A 1.5R target hit 40% of the time is exactly break-even (0.4 x 1.5 − 0.6 x 1 = 0); a 2R target hit 34% of the time
  is the same. The engulfing sequence does not move the odds from a coin flip.
- **The cost is the whole loss.** The median stop distance was $1.75 in 2007-19 and $2.92 in 2020-26, so $0.30 a round trip
  is 0.11R to 0.17R a trade. A scalp with a stop of a few dollars cannot carry it.
- **Exits** (T1, WITH, 2020-26): 473 stops, 311 targets, 11 time exits.
- **Seeded bootstrap** of T1's WITH trades (5,000 resamples): a positive total in 0.0% (2007-19) and 0.6% (2020-26) of
  resamples; median max drawdown 211R and 100R.

## Described, not tested

**By year, T1** (net R a trade; trades):

| Year | WITH: trades | WITH: R a trade | WITH: total R | ALL: trades | ALL: R a trade |
|---|---|---|---|---|---|
| 2007 | 94 | −0.26 | −24.4 | 167 | −0.18 |
| 2008 | 140 | −0.06 | −8.5 | 279 | −0.12 |
| 2009 | 106 | −0.31 | −32.6 | 205 | −0.27 |
| 2010 | 94 | +0.03 | +3.1 | 173 | −0.07 |
| 2011 | 112 | +0.09 | +10.0 | 200 | −0.12 |
| 2012 | 100 | −0.20 | −20.1 | 183 | −0.17 |
| 2013 | 103 | −0.23 | −23.3 | 197 | −0.12 |
| 2014 | 93 | +0.11 | +10.0 | 186 | −0.17 |
| 2015 | 95 | −0.12 | −11.2 | 172 | −0.13 |
| 2016 | 103 | −0.23 | −23.7 | 182 | −0.33 |
| 2017 | 72 | −0.42 | −30.6 | 153 | −0.19 |
| 2018 | 73 | −0.36 | −26.0 | 154 | −0.17 |
| 2019 | 84 | −0.29 | −24.1 | 164 | −0.20 |
| 2020 | 119 | −0.23 | −27.1 | 207 | −0.25 |
| 2021 | 87 | +0.30 | +26.0 | 199 | −0.03 |
| 2022 | 129 | −0.14 | −18.2 | 239 | −0.15 |
| 2023 | 120 | −0.08 | −9.9 | 218 | −0.13 |
| 2024 | 115 | −0.24 | −27.8 | 226 | −0.32 |
| 2025 | 115 | −0.21 | −24.1 | 225 | −0.17 |
| 2026 | 110 | −0.06 | −6.4 | 227 | +0.03 |

4 of 20 years positive with the gate (2010, 2011, 2014, 2021), 1 of 20 without it.

**By hour of the trigger (UTC), all-hours test, ALL stream** (the research skill asks for this table; net R a trade, t):

| Hour | 2007-19: trades | R a trade | t | 2020-26: trades | R a trade | t |
|---|---|---|---|---|---|---|
| 00 | 334 | −0.34 | −5.26 | 293 | −0.12 | −1.69 |
| 01 | 312 | −0.15 | −2.10 | 356 | −0.18 | −2.80 |
| 02 | 184 | −0.33 | −3.70 | 280 | −0.27 | −3.71 |
| 03 | 160 | −0.32 | −3.28 | 247 | −0.19 | −2.41 |
| 04 | 148 | −0.28 | −2.80 | 214 | −0.15 | −1.79 |
| 05 | 224 | −0.32 | −4.04 | 290 | −0.10 | −1.31 |
| 06 | 329 | −0.12 | −1.67 | 318 | −0.14 | −1.99 |
| 07 | 426 | −0.14 | −2.25 | 373 | −0.16 | −2.50 |
| 08 | 382 | −0.24 | −3.78 | 317 | −0.01 | −0.14 |
| 09 | 374 | −0.21 | −3.36 | 321 | −0.08 | −1.11 |
| 10 | 390 | −0.28 | −4.50 | 288 | −0.21 | −2.99 |
| 11 | 375 | −0.26 | −4.06 | 339 | −0.22 | −3.31 |
| 12 | 605 | −0.20 | −4.05 | 384 | −0.23 | −3.71 |
| 13 | 630 | −0.18 | −3.76 | 401 | −0.25 | −4.29 |
| 14 | 612 | −0.12 | −2.37 | 360 | +0.02 | +0.28 |
| 15 | 533 | −0.17 | −3.29 | 362 | −0.10 | −1.51 |
| 16 | 487 | −0.28 | −5.09 | 312 | −0.15 | −2.12 |
| 17 | 445 | −0.26 | −4.53 | 320 | −0.07 | −1.04 |
| 18 | 360 | −0.24 | −3.73 | 276 | −0.22 | −2.89 |
| 19 | 293 | −0.38 | −5.61 | 277 | −0.23 | −3.22 |
| 20 | 184 | −0.30 | −3.36 | 178 | −0.45 | −3.97 |
| 21 | 53 | −0.37 | −2.02 | 50 | −0.19 | −0.93 |
| 22 | 35 | −0.27 | −1.33 | 34 | −0.37 | −1.81 |
| 23 | 139 | −0.06 | −0.56 | 161 | −0.16 | −1.59 |

47 of 48 hour-window cells are negative; the one positive cell (14:00, 2020-26, +0.02R, t +0.28) is negative in 2007-19. The
12:00 to 15:55 window is not better than the rest: hours 12 and 13 are among the worst of 2020-26. No session filter rescues
this entry.

**The research skill's own direction filter** (H4 closing-price pivots, three candles a side) in place of the call, T1's
candidates: with the filter −0.190R (n 808, t −4.46) in 2007-19 and −0.199R (n 531, t −3.83) in 2020-26; against it −0.203R
(n 788) and −0.106R (n 548). It does not help either, and in 2020-26 trading against it lost less.

**By side** (T1, ALL, net R a trade): 2007-19 buys −0.212 (n 1,177), sells −0.133 (n 1,238); 2020-26 buys −0.105 (n 770), sells
−0.189 (n 771). The sell side is not better on these rules.

## What the owner should and should not conclude

- **Should**: this mechanical version (a body engulf on M15, then on M5, market entry on the next candle, stop past the pair,
  fixed 1.5R or 2R) is a coin flip before costs on 20 years of gold and loses the spread after them. The direction call in
  front of it does not change that, and neither does the 12:00 to 16:00 window nor the 4-hour closing-price structure filter.
  It should not become a council system, a paper stream or an automated bot.
- **Should**: with the direction study of this morning (0 of 6) that makes nine pre-registered tests of the MSNR procedure
  on gold, none positive. Like the Mosha studies of 10 Nov, the part that might make money is not in what a fixed rule holds.
- **Should not**: read this as a test of the owner's own chart trading, or of the strongest stacks the research skill names.
  Those use an engulfing-failure signal and two abbreviated signals for which the skill gives no rule, a dominant-zone start on
  H4, an M1 entry and an exit by signal. None of that was tested, because I would have had to invent the rules. If the owner
  writes those signals down as rules (what exactly prints, where the stop goes), that is a new pre-registered test.
- **Should not**: take the very high win rates and risk-adjusted figures quoted in the research skill as established. They
  could not be reproduced from the one signal the skill defines; this repository has no record of the data, costs or fill
  rules behind them.
- **Should not**: read the +0.07R to +0.11R gap between WITH and AGAINST in 2020-26 as a lead. It is under t 2, it is the
  buy side of a rising market, it is absent in 2007-19 and absent at all hours.

## What I decided that the skills leave open

Which stack (the one built on the only defined signal); the 45 minutes between the two signals; the stop (pair extreme plus
$0.30, no cap) and the $1.00 minimum; the 12-hour exit; the session as trigger hours 12 to 15 UTC; the engulfing and
failed-engulfing key levels of the gate and its numbers (as in the direction study); both sides traded, the side decided by
the gate. Fixed dollar amounts across a price that went from about $600 to about $4,000 make the cost relatively heavier in
the early years (0.17R against 0.11R): the before-costs column shows the conclusion does not depend on that.

## Implementation notes

- Unit tests (`tests/msnr-entry.test.mjs`) on hand-made candles: the engulf, the setup and trigger, the stop first when one
  candle holds both, the gap, the time exit, one at a time, the three streams, no look-ahead (candidates, calls and closed
  trades are unchanged when every later candle is altered), and that every simulated trade has its stop on the losing side.
  They were written before the run on real candles and first executed after it (the file also checks this report against
  `result.json`); all passed as written. One hand-made series (the one-at-a-time case) had been re-aligned to the 15-minute
  grid before the run.
- No bug was found in `run.mjs`; nothing was changed or re-run after the first result.
- The direction call here is built from H4 candles made of the M5 file; the direction study read OANDA's own H4 candles. The
  alignment is the same (UTC), so the calls agree except where a candle differs by a tick.
- `result.json` carries every stream (`tests`), the hourly table, the by-year figures, and the per-trade net R of T1's WITH
  stream (`trades`, 2,064 trades) for the Edge lab's line.

Re-run: `node run.mjs fetch <dir>` (about 430 paced requests to the candle proxy), then `CANDLES=<dir> node run.mjs run`.
