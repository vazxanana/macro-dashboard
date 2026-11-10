# Event risk manager: does skipping or flattening trades around CPI, NFP and FOMC help?

## Clock re-run (9 Nov 2026)

The HistData M1 files were read with a fixed +5 h ("EST without DST"). They are UTC−5, UTC−4 while Europe is on summer time, and New York time in 2018 (`council/histdata.mjs`; release spikes and Sunday opens), so every European summer was an hour late. `build.mjs` and `analyse.mjs` were re-run on the corrected clock (flat.json, ict-hist.json,
result.json and tables.md are the re-run; the prose below is the original run). **The verdict stands: FAIL on all five tests.**
- H1-ICT (skip A-setups near a release): n 5, −0.32R → n 5, +0.23R: FAIL. H2-ICT (flatten across a release): n 62, d +0.44R,
  t 2.03 → n 58, d +0.38R, t 1.98: FAIL (the bar needs more). H2-MSYS n 9 → 9, H1-MSYS n 1 → 1, H1-MSET (no HistData) unchanged.

**Verdict: FAIL on all five pre-registered tests. Null result. No shadow variant is added and no rule changes.**

- **Skipping entries near a release (H1)** cannot help the ICT desk or the Meridian main systems: their entries almost never
  fall in the [−30, +60] minute window (5 of 770 ICT A-setups, 1 of 856 main-system trades since 2022). The Meridian setup
  universe does enter there (117 trades) and those trades lose, but so does the rest of that universe; the gap is not
  significant (Welch t −1.75) and it rests on 8 releases.
- **Flattening 5 minutes before a release (H2)** points the other way. ICT A-setups open into a release did better held
  than flattened: +0.79R against +0.38R a trade (n 62, paired t +1.91, held better in both halves). Flattening would have
  cost 25.1R. On the Meridian gold replica (n 9) it would have cost 5.1R.

So the Macro strategist should **not** be given a "close before CPI / NFP / FOMC" or "no entries around the release" rule
for these systems. What the data supports is the opposite caution: do not cut ICT trades that are open into a release.

## How it was run

- **Pre-registration first.** `preregistration.md` was committed and pushed (48f3d354) before any trade was tagged with a
  release, before any flatten price was read and before any result was computed. It fixes the event set, the window, the
  flatten time, the costs, the samples, five tests and the bar.
- **Events.** CPI, NFP and FOMC from `council/events.mjs` (`HISTORY` Jan 2022 to Jul 2025, `EVENTS` from Aug 2025),
  unchanged: 154 releases from 1 Jan 2022 to 7 Nov 2026. Samples start on 1 Jan 2022, where the calendar starts.
- **ICT A-setups (770).**
  - 519 on HistData M1, signal closes from Jan 2022 to Jul 2025: GC under the gold A-rule, NQ = NAS100 cash and ES = SPX
    cash under the index A-rule. They come from the desk's own `signals()` / `isASetup()` / `sizeOf()` / `simulate()`,
    as in #516 (`build.mjs`). Every id, R, size, exit time and cost matches `research/edge/ict-smile/trades.json`.
  - 251 from council-data `ict/replay.json`, Aug 2025 to Nov 2026, futures (NQ, ES, YM, RTY, GC).
  - Costs: ict-universe's for the cash part, `futCost()` for the futures (spread, commission, entry slip and stop slip on
    every trade).
- **Meridian main systems (856).** council-data `research/replay-2w.json`, Dec 2022 to Nov 2026: `nq-open`, `replica`,
  `gtrend`, `gtrend5`, crypto `trend`, `gtl`, `geg`. Shadow `gmp` left out. R as stored, costs included.
- **Meridian setups (7,853).** council-data `research/replay-90d.json`, 9 Aug to 7 Nov 2026. The `@mkt` twins are left out.
  Net R = `R_none` − cost. The dump has no exit times, so only H1 is tested.
- **Flatten price.** The close of the candle ending at T − 5 min:
  - the 5m series the simulation used, for the ICT HistData part;
  - HistData cash or spot M1 scaled by the futures-to-cash ratio at entry, for the futures replay and the Meridian systems.
  - YM and RTY have no M1 file, so their 11 trades are left out of H2, plus 1 cash trade with no candle.
  - Flattening pays the same round-trip cost as holding, so net d equals gross d.

## The five pre-registered tests

H1: entries within [−30, +60] min of a release ("in") against all other trades of the sample ("kept"), net R.

| Test | n in | in R a trade (t) | kept n | kept R a trade | Welch t | halves (in) | releases | Bar |
|---|---|---|---|---|---|---|---|---|
| **H1-ICT** | 5 | −0.320 (−0.77) | 765 | +0.181 | −1.19 | −0.483 / −0.212 | 4 | **fail** (n, t, releases) |
| **H1-MSYS** | 1 | −1.010 | 855 | +0.593 | – | – / −1.010 | 1 | **fail** (n, t, releases) |
| **H1-MSET** | 117 | −0.346 (−3.18) | 7,736 | −0.153 | −1.75 | −0.313 / −0.378 | 8 | **fail** (Welch t, releases) |

H2: trades open at T − 5 min, held vs closed at T − 5 min. d = held − flattened, per trade, net R.

| Test | n | held R a trade | flattened R a trade | d (paired t) | Welch t | halves (d) | releases | R gained by flattening | Bar |
|---|---|---|---|---|---|---|---|---|---|
| **H2-ICT** | 62 | +0.788 | +0.383 | **+0.405 (+1.91)** | +1.33 | +0.531 / +0.280 | 49 | **−25.1** | **fail** (wrong sign) |
| **H2-MSYS** | 9 | +1.014 | +0.451 | +0.564 (+0.50) | +0.52 | +1.822 / −0.443 | 7 | −5.1 | **fail** (n, t, halves) |

A pass needed, for H1:

- n ≥ 30 dropped trades;
- t ≤ −2 on both the dropped group's own mean and the Welch difference;
- negative in both halves;
- a negative total, so that skipping adds R;
- at least 10 releases.

For H2 it needed n ≥ 30, a paired t ≤ −2, both halves negative, a gain from flattening and at least 10 releases.

## By market and by half

**H1-ICT** (in-window trades):

| Market | n in | in R a trade | kept n | kept R a trade |
|---|---|---|---|---|
| ES | 1 | +0.563 | 228 | +0.178 |
| GC | 2 | −0.312 | 264 | +0.161 |
| NQ | 1 | −1.528 | 188 | +0.178 |
| YM | 1 | −0.012 | 59 | +0.191 |
| RTY | 0 | – | 26 | +0.414 |

Split by sample, the HistData part has 3 in-window trades (−0.677) and the replay part has 2 (+0.215). With 5 trades in
4.8 years, the window removes about 0.6% of ICT A-setups. The desk enters on H1 closes, and an A-setup rarely closes in the
two hourly slots around a release.

**H1-MSYS.** The single in-window trade is an `nq-open` trade (`opens` session) entered 9 minutes after the 16 Dec 2025
NFP release. It made −1.01R. Most NQ open-run entries come at 09:30-10:59 New York, outside the window. The gold and
crypto systems never entered in it.

**H1-MSET by market** (in-window trades, Meridian setups 90d). No market has 30 trades, so all of these are post hoc:

| Market | n in | in R a trade (t) | kept R a trade | Welch t | halves | releases |
|---|---|---|---|---|---|---|
| BTC | 16 | −0.902 (−7.52) | −0.216 | −5.15 | −1.020 / −0.785 | 7 |
| GBP/USD | 18 | −0.794 (−4.14) | −0.222 | −2.85 | −0.523 / −1.066 | 8 |
| EUR/USD | 10 | −0.785 (−3.43) | −0.146 | −2.62 | −1.143 / −0.427 | 4 |
| AUD/USD | 8 | −0.615 (−1.84) | −0.369 | −0.73 | −0.757 / −0.472 | 5 |
| SOL | 9 | −0.478 (−1.55) | −0.085 | −1.25 | +0.200 / −1.020 | 6 |
| USD/CAD | 9 | −0.355 (−0.90) | −0.119 | −0.60 | +0.203 / −0.802 | 5 |
| XAU | 19 | −0.302 (−1.06) | −0.106 | −0.68 | −0.718 / +0.072 | 8 |
| USD/CHF | 5 | −0.021 (−0.03) | −0.136 | +0.17 | −1.069 / +0.678 | 5 |
| ETH | 5 | +0.561 (+0.87) | −0.035 | +0.91 | +0.247 / +0.771 | 3 |
| XRP | 18 | +0.643 (+1.83) | −0.120 | +2.11 | +0.204 / +1.083 | 8 |

The `backtest.json` 30-day dump, reported only, points the other way. Its 50 in-window trades lose less than the rest:
−0.643R against −0.900R (Welch +1.58, 3 releases). Live trades: none in the window. Live shadow: 13 trades, +0.396R.

**H2-ICT by market and by part** (d = held − flattened):

| Cell | n | held | flattened | d (paired t) | halves (d) |
|---|---|---|---|---|---|
| ES | 19 | +0.962 | +0.203 | +0.759 (+1.79) | +1.186 / +0.375 |
| GC | 27 | +0.817 | +0.494 | +0.323 (+1.08) | +0.675 / −0.003 |
| NQ | 16 | +0.533 | +0.409 | +0.124 (+0.30) | −0.263 / +0.512 |
| HistData 2022 to Jul 2025 (never tagged before) | 49 | +0.632 | +0.293 | +0.338 (+1.49) | +0.647 / +0.042 |
| Futures replay Aug 2025 to Nov 2026 | 13 | +1.378 | +0.720 | +0.658 (+1.19) | +0.681 / +0.639 |
| CPI | 15 | +0.395 | +0.298 | +0.097 (+0.21) | |
| NFP | 29 | +0.371 | +0.183 | +0.188 (+0.62) | |
| FOMC | 18 | +1.788 | +0.775 | +1.013 (+2.70) | +1.443 / +0.583 |

Holding was better in every market and in both samples. The FOMC cell (t +2.70) is post hoc and is not a rule. It fits the
idea that an ICT trade already open into a release tends to be paid by the release move, not hurt by it.

**H2-MSYS.** Only the gold replica had trades open at T − 5 min (9 trades over 7 releases). The NQ open run was never open
5 minutes before an FOMC statement. Held +1.014R against flattened +0.451R.

## Caveats

- **Part of the sample was seen before.** #488 (`research/edge/news-filter`) had already looked at the 2025-26 ICT replay
  and the Meridian dumps with symmetric windows. The HistData ICT part (2022 to Jul 2025) and the main systems before Aug
  2025 had not been tagged. They give the same answer.
- **Futures replay flatten prices are estimates.** They are cash or spot M1 moves scaled by the ratio at entry, not futures
  prints.
- **Some HistData exits are hourly.** A few HistData trades (`res: 1h`) were managed on H1 candles by `simulate()`. Their
  flatten price is still the 5m close at T − 5 min.
- **Five tests at t ≤ −2.** The chance that at least one passes by luck is about 11%. None passed, so this does not matter
  here.
- **H1 was evaluated on the recorded trades.** A skipped trade could have freed the market for a later A-setup. With 5
  ICT trades and 1 main-system trade in the window, this cannot change the result.

## What this means for the Macro strategist

- As an **event risk manager for these systems, it has nothing to enforce.** The ICT desk and the Meridian main systems
  almost never enter near a release. Flattening before a release would have cost R on both.
- The useful job left is **information**: show the calendar and the event-day volatility, and tag trades (as `newsFeat`
  already does). It should not issue a skip or flatten instruction.
- **One lead, not adopted.** Meridian FX and BTC setups entered near US releases look worse than their own rest: EUR/USD,
  GBP/USD and BTC, Welch −2.6 to −5.2. Each cell has under 30 trades and 4 to 8 releases, and the cells were chosen after
  looking. If wanted, it needs its own pre-registration on forward trades (for example, Meridian FX setups in [−30, +60]
  from 8 Nov 2026 on) before anything is built.

Files: `preregistration.md`, `build.mjs` (trades and flatten prices), `ict-hist.json`, `flat.json`, `analyse.mjs`,
`result.json`, `tables.md` (every cell). To rerun:

```
node research/edge/event-risk/build.mjs <council-data checkout>
node research/edge/event-risk/analyse.mjs <council-data checkout>
```
