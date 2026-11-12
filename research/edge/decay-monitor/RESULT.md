# Edge-decay monitor: how it works and how it does on the record (8 Nov 2026)

> **Clock correction, 10 Nov 2026.** Four baselines in `council/decay-base.json` were rebuilt on the corrected candle clock: Mosha BO, gold H4 trendline, daily engulf, momentum pullback. The other six are identical. The tables below are the first build. Details: the last section of this page.

Paper only. The monitor gives each system a status and, in the daily digest, an alert. **It never changes a rule, a filter,
a size or a trade. The owner decides.**

**Why build it.** Recent studies found edges that hold only in one regime and can fade without notice:

- Crypto trend made nothing from June 2025 (#508). The owner moved it to shadow.
- The NQ New York open run made nothing from 2004 to 2022 and +0.32R a trade from 2023 to 2026 (#511).
- The gold replica fails out of sample (#512). The owner keeps it as an unproven bet and allows a 30–40R drawdown.

So the Coach now gives every live system an early warning.

Code:

- `council/decay.mjs` holds the monitor. The baselines are in `council/decay-base.json`.
- The Trader writes the result to `coach.json` `decay` every 6 hours.
- The page shows it in the Research pane, in the "Edge decay · early warning" card.
- The daily digest (`council/digest.mjs`) adds one line only when a live system is **decaying**.
- `run.mjs` (this folder) builds the baselines and runs every test below. Usage: `node research/edge/decay-monitor/run.mjs <council-data dir>`.

## What it measures

Each system is judged on its record after costs. One point is one position: a gold add is counted with its first trade.

**The record.** It has two parts:

1. The council's own replay, up to the first forward trade.
2. The forward paper record after that.

There are two exceptions:

- **ICT A-setups:** the 2018–26 rebuild on GC/NQ/ES/YM (#526; the per-position record is `research/edge/sizing/inputs.json`),
  1,787 positions at +0.09R. The monitor then reads the desk replay (`ict/replay.json`, `aset`, after the micro-futures round
  trip) and the forward record against it. Until 8 Nov the baseline was the 15-month replay itself (+0.20R): circular, and
  hotter than the rule's long record, so a return to +0.09R would have read as decay (sizing study, #538).
- **Mosha BO:** it has no council replay. The last two years of its 2018–26 rebuild stand in front of the forward record.

| Measure | Definition |
|---|---|
| Rolling expectancy | The last W trades. W is one year of trades, between 10 and 30. It is shown on the page but is not a trigger (see "Calibration"). |
| CUSUM vs the backtest | S = max(0, S + (ref − x)/sd − k), with k = max(ref/2sd, 0.1). It rises while the system runs below about half its backtest edge. This is Page's one-sided CUSUM, scaled by the baseline's SD. |
| CUSUM vs zero | Z = max(0, Z + (0 − x)/sd − k). It rises only while the system is losing money. |
| Control limit h | Draw one year of trades, with replacement, from the system's own baseline. Find the highest S reached in that year. Do this 4,000 times. h is the 95th percentile. A system that still behaves like its backtest crosses h in about one year in 20. |
| Drawdown limit | The largest of three numbers: the worst drawdown seen in its history, the 95th percentile of the max drawdown over reshuffled baseline orders, and the owner's allowance (gold replica: 40R). |

**Status:**

| Status | Rule |
|---|---|
| Decaying | S ≥ h, or the drawdown is beyond its limit |
| Watch | S ≥ ¾ h, or the drawdown is past ¾ of its limit |
| Healthy | Neither. A record with fewer than 10 trades gets no verdict; it is marked "too few". |

### Baselines (`council/decay-base.json`)

Each baseline comes from the longest record of the live rule there is. The gold replica and the NQ open run are regime bets, so
their baseline is the regime they were built on, the council's 2023–26 replay. The question for those two is whether that
regime still holds.

| System | Baseline record | n | R/trade | SD | trades/yr | h | DD limit (worst seen / MC 95% / allowance) |
|---|---|---|---|---|---|---|---|
| Gold replica | council replay 2023-12 to 2026-04 | 212 | +0.88 | 3.34 | 90 | 11.55 | **40.2R** (40.2 / 24.0 / 40) |
| Mosha BO | 2018-26 rebuild (robustness) | 147 | +0.01 | 2.04 | 18 | 5.60 | 39.2R (39.2 / 37.5 / –) |
| Gold trend N20 | 2018-26 rebuild | 40 | +1.64 | 4.00 | 5 | 2.86 | 6.9R (3.7 / 6.9 / –) |
| Gold trend fast N5 | 2018-26 rebuild | 74 | +1.06 | 3.37 | 9 | 2.92 | 9.2R (6.6 / 9.2 / –) |
| Gold H4 trendline | 2018-26 rebuild | 302 | +0.14 | 1.24 | 34 | 8.75 | 19.4R (19.2 / 19.4 / –) |
| Gold daily engulf | 2018-26 rebuild | 217 | +0.20 | 1.70 | 25 | 7.01 | 22.3R (14.8 / 22.3 / –) |
| Gold momentum pullback | 2018-26 rebuild | 1003 | +0.04 | 1.28 | 115 | 14.28 | 50.6R (40.0 / 50.6 / –) |
| NQ New York open run | council replay 2022-12 to 2026-10 (nyflip) | 299 | +0.33 | 1.56 | 78 | 12.73 | 20R (20 / 17.3 / –) |
| ICT A-setups | 2018-26 rebuild, GC/NQ/ES/YM (#526) | 1787 | +0.09 | 1.52 | 202 | 16.52 | 53.1R (31.3 / 53.1 / –) |
| Crypto trend (shadow) | 2017-26 rebuild (positions) | 125 | +2.80 | 8.49 | 14 | 2.73 | 13.7R (13.7 / 11.5 / –) |

Sources for the worst drawdowns:

- `gold-systems/RESULT.md`: the replica's 8-year −40.2R, plus the trend, trendline and engulf figures.
- `replica-oos/RESULT.md`: the owner's 30–40R allowance.
- `crypto-trend-decay/RESULT.md`: −10.0R.
- `robustness/out/nq.json`: −20R over 2018–26.

## Backtest of the monitor

The monitor code in these tests is the unchanged `council/decay.mjs`. `tests/decay.test.mjs` pins the first two results.

### 1. Crypto trend v3: flagged in mid/late 2025 ✔

**Setup.**

- **Walk-forward:** the baseline is built only from positions entered from 2017 to 2023. The monitor then runs from January 2024.
- **Baseline:** 83 positions, +3.71R each, SD 9.75, h 2.67. The drawdown limit is 10.0R.
- **Data:** `crypto-trend-decay/result.json`, positions net of Kraken fees, in exit order.

| Quarter end | Status | CUSUM (h 2.67) | Drawdown | Last 13 positions |
|---|---|---|---|---|
| 2024 Q1 | healthy | 0.47 | 0.9R | −0.43R |
| 2024 Q2 | healthy | 0.90 | 0.6R | +0.39R |
| 2024 Q3 | healthy | 1.45 | 2.3R | +0.08R |
| 2024 Q4 | healthy | 1.86 | 2.5R | +0.04R |
| 2025 Q1 | healthy | 0.00 | 0.0R | +3.72R |
| 2025 Q2 | healthy | 1.03 | 2.6R | +3.53R |
| **2025 Q3** | **decaying** | 2.79 | 5.0R | +1.05R |
| 2025 Q4 | decaying | 3.06 | 3.9R | −0.25R |
| 2026 Q1 | decaying | 3.32 | 4.6R | −0.28R |
| 2026 Q2 | decaying | 4.06 | 6.2R | −0.21R |
| 2026 Q3 | decaying | 4.34 | 7.0R | −0.21R |
| 2026 Q4 | decaying | 5.34 | 5.7R | −0.06R |

**What happened, in order:**

1. In January 2025 the status touched watch for 3 positions.
2. XRP's November 2024 run paid +23.7R and +18.6R in February 2025, and the CUSUM went back to zero.
3. From June 2025 eight small losses came in a row.
4. **Watch from 3 Aug 2025. Decaying from 26 Sep 2025**, at position 29 of the new period.
5. It stays decaying to the end of the data.

The rolling expectancy alone would have missed this: it read +1.05R a position on 26 Sep 2025, still carried by the XRP run.

**With the live baseline** (2017–26, h 2.73) over the whole record, there are two decaying episodes:

- **22 Apr 2023 to 14 Apr 2024**, after the 2022 bear market. It ended when the late-2023 breakouts paid.
- **11 Oct 2025 onward.**

Watch touched three more times: Sep 2020, Nov 2021 and Mar 2023. Each lasted one to five positions.

### 2. NQ New York open run: not flagged in 2023–26 ✔

**Setup.**

- **Baseline:** the shipped one, the council replay at +0.33R and h 12.73.
- **Data:** the OANDA 1-minute replay of the live rule, net of 1 point (`nq-open-oos/result.json`), 309 trades from 2023 to 2026.

**Result:** healthy at every one of the 309 trades. It never reached watch.

- The highest CUSUM was 8.04, which is 63% of the limit.
- The worst drawdown was 9.7R, which is 48% of the 20R limit.

| Quarter end | CUSUM | Drawdown | Last 30 |
|---|---|---|---|
| 2023 Q1 | 4.55 | 4.0R | +0.08R |
| 2023 Q3 | 3.74 | 2.4R | +0.10R |
| 2024 Q1 | 4.82 | 4.0R | +0.04R |
| 2024 Q4 | 3.20 | 3.1R | +0.26R |
| 2025 Q4 | 3.07 | 1.5R | +0.17R |
| 2026 Q3 | 3.91 | 1.6R | +0.09R |
| 2026 Q4 | 2.28 | 3.1R | +0.14R |

**Out of sample.** The baseline is built from OANDA 2023–24 only (+0.32R, h 13.08) and the monitor runs on 2025–26 (143 trades).
It never reached watch.

**Power: how fast it catches the end of the regime.** The same live baseline is run on the eras when the rule did not work:

| Era | Trades | R/trade | First "decaying" | Share of trades decaying |
|---|---|---|---|---|
| 2014–22 | 754 | −0.05 | **8 Oct 2014, trade 59** (about 9 months) | 90% |
| 2004–13 | 806 | +0.01 | 19 Nov 2004, trade 64 | 81% |

If the 2023–26 regime ends the way 2014 began, the monitor would say so in about 60 trades, under a year.

### 3. Gold replica out of sample (2017–22)

**Setup.**

- **Baseline:** the live one, with the 40.2R drawdown limit.
- **Data:** the `replica-oos` positions, at 0.30 a unit. This window has 115 positions at −0.05R.

**Result:**

- **Out of sample (2017–22):** watch from May 2022, **decaying from 5 Oct 2022**, at position 82, when the CUSUM passed its limit.
- **In sample (2023–26), same harness, +0.58R:** never decaying. Watch for one position in May 2025 and four in April 2026.

### 4. Simulation: false alarms and detection delay

Each system gets 1,000 runs per test:

- **False alarms:** one year of trades drawn from its own baseline.
- **Delay:** the same draws with the edge removed (each trade minus the baseline mean), for up to three years.

| System | Trades a year | False "decaying" within a year | Any flag (watch or worse) within a year | Zero edge caught within 3 years | Median delay |
|---|---|---|---|---|---|
| Gold replica | 90 | 4.7% | 17.8% | 100% | 54 trades (0.6 yr) |
| Mosha BO | 18 | 6.0% | 17.8% | 43%¹ | 32 trades (1.7 yr) |
| Gold trend N20 | 10² | 2.5% | 7.7% | 99% | 10 trades (2.2 yr) |
| Gold trend fast N5 | 10² | 3.6% | 12.3% | 98% | 10 trades (1.2 yr) |
| Gold H4 trendline | 34 | 5.7% | 17.8% | 68% | 51 trades (1.5 yr) |
| Gold daily engulf | 25 | 5.0% | 16.3% | 74% | 37 trades (1.5 yr) |
| Gold momentum pullback | 115 | 6.8% | 20.7% | 39%¹ | 181 trades (1.6 yr) |
| NQ New York open run | 78 | 4.4% | 16.3% | 98% | 69 trades (0.9 yr) |
| ICT A-setups | 202 | 5.0% | 18.7% | 62%³ | 275 trades (1.4 yr) |
| Crypto trend | 14 | 4.9% | 22.7% | 100% | 10 trades (0.7 yr) |

¹ Mosha BO (+0.01R) and the momentum pullback (+0.04R) have almost no backtest edge. Removing it changes little, so this
column does not apply to them. For these two, the monitor only catches a system that is losing.
² The limit is set on at least 10 trades. For the slow trend legs, a "year" is about two years of signals.
³ With the +0.09R baseline, a fall to zero edge is a small step (0.06 SD a trade), so it takes longer to catch than the
+0.20R replay baseline suggested (97% within 3 years). The monitor is quicker on a losing ICT desk: CUSUM vs zero.

## Calibration choices

- **The control limit is set per system** from its own baseline record, at 95% a year. The textbook fixed h of 4.5 does not
  fit these systems, because their trade counts and tails differ too much:
  - On the systems that trade often it fires in most normal years: 77% for the replica, 83% for NQ, 92% for the momentum pullback.
  - On crypto trend, with about 14 positions a year and an SD of 8.5R, it can almost never fire within a year: 0 of 4,000 simulated years reached it.
- **Watch starts at ¾ of the limits.** At ½, a busy system was on watch in 50–80% of normal years.
- **The rolling 30-trade expectancy is shown but is not a trigger.** "The last 30 trades are flat or losing" fires in 73–98% of normal years for ICT (186 trades a year) and the momentum pullback (115). It would make watch meaningless.
- **Winsorising wins before the CUSUM was tried.** Capping at the 70th, 80th or 90th percentile changed the crypto flag date by at most two months. The plain version was kept.

## Status on 7 Nov 2026 (council-data at the time of writing)

| System | Status | Record | Last W | CUSUM / h | Drawdown / limit |
|---|---|---|---|---|---|
| Gold replica | healthy | 212 replay + 2 forward | +0.33R (30) | 8.13 / 11.55 (70%) | 16.6R / 40.2R |
| **Mosha BO** | **decaying** | 48 rebuild trades (no replay, no forward trade yet) | −0.94R (18) | 8.54 / 5.60 | 20.7R / 39.2R |
| Gold trend N20 | healthy | 22 replay | +2.42R (10) | 0.30 / 2.86 | 0 / 6.9R |
| Gold trend fast N5 | healthy | 39 replay | +1.15R (10) | 1.20 / 2.92 | 0.9R / 9.2R |
| Gold H4 trendline | healthy | 24 replay | +0.15R (24) | 1.25 / 8.75 | 1.5R / 19.4R |
| Gold daily engulf | healthy | 18 replay | +0.23R (18) | 2.44 / 7.01 | 4.0R / 22.3R |
| Gold momentum pullback | healthy | 74 replay | −0.21R (30) | 3.66 / 14.28 | 6.8R / 50.6R |
| NQ New York open run | healthy | 299 replay | +0.20R (30) | 1.51 / 12.73 | 2.0R / 20R |
| ICT A-setups | healthy | 234 desk replay | +0.67R (30) | 0.97 / 16.52 | 1.5R / 53.1R |
| Crypto trend (shadow) | decaying | 65 replay positions | +0.15R (14) | 4.54 / 2.73 | 4.8R / 13.7R |

**Mosha BO (update 8 Nov).** Since the out-of-sample study (`mosha-oos`, #560) showed three rebuilds of the live rule disagree on
2018–22 and share a minority of trades, a system with no council replay is shown with its rebuild record but not judged on it:
status "no verdict" until the forward record has 10 trades (then judged against the baseline as any other system). The
7 Nov `decaying` flag below was a reading of the baseline choice, not of the rule.

**Mosha BO.** The flag comes from the robustness rebuild of the rule (2018–26: +0.01R a trade, out of sample −0.24R), not from
live trades. The `gold-systems` study rebuilt the live config ("weekly + slow, BE/add/run") separately and found +0.64R a
trade out of sample, on only 18 positions. The two rebuilds disagree, and the monitor uses the one with a trade list. The
monitor says decaying, and it changes nothing. Whether to look deeper is the owner's call.

**Crypto trend** is decaying, as the June 2025 study found. It is already in shadow, so the digest does not alert on it.

## Clock correction (10 Nov 2026)

The HistData M1 files were read on the wrong clock in part of every year. The pre-registered audit `research/edge/histdata-clock/` settled the rule (New York time in 2018; UTC−5, and UTC−4 on Europe's summer-time dates, from 2019) and every loader now converts with `council/histdata.mjs`. Four of the ten baselines come from the robustness audit's HistData rebuilds, which moved when that audit was re-run on the corrected clock.

**`run.mjs` was run again on 10 Nov 2026. Nothing in the monitor or its settings changed.** A control run on the old robustness files reproduced the published `council/decay-base.json` exactly, system by system, so the changes below are the clock and nothing else. `council/decay-base.json` and `result.json` hold the new numbers.

| System | Source | Before: n, R a trade, SD, worst drawdown, MC95 drawdown, drawdown limit | After |
|---|---|---|---|
| Mosha BO | robustness rebuild | 147, +0.009, 2.040, 39.2R, 37.5R, 39.2R | 157, −0.064, 1.969, 46.0R, 43.4R, 46.0R |
| Gold H4 trendline | robustness rebuild | 302, +0.142, 1.241, 19.2R, 19.4R, 19.4R | 304, +0.106, 1.169, 20.2R, 21.0R, 21.0R |
| Gold daily engulf | robustness rebuild | 217, +0.197, 1.698, 14.8R, 22.3R, 22.3R | 217, +0.198, 1.698, 14.7R, 22.3R, 22.3R |
| Gold momentum pullback | robustness rebuild | 1,003, +0.041, 1.282, 40.0R, 50.6R, 50.6R | 1,004, +0.043, 1.286, 40.1R, 49.7R, 49.7R |
| Gold replica, gold trend N20 / N5, NQ open run, ICT A-setups, crypto trend | council replays, daily candles, OANDA | unchanged | identical |

These are monitoring baselines, not trading rules: the decay monitor compares each live system's forward record with them. **The one to look at is Mosha BO.** Its baseline expectancy is now slightly negative (−0.064R a trade on 157 trades, against +0.009R on 147) and its worst drawdown is 46R, not 39R. A monitor that watches for "worse than the baseline" is watching against a baseline that was never good; that was already true at +0.009R.

## Overnight financing in the baselines (11 Nov 2026)

The owner approved counting overnight financing in the paper costs on 11 Nov 2026 (`council/fills.mjs` `FIN`, `nights`,
`financing`: a gold buy pays 0.0148 % of its entry price for each rollover held, Monday to Friday 22:00 UTC, three on
Wednesday). The forward trades the monitor reads carry it from that day, so the baselines they are measured against now carry
it too. Nothing in the monitor or its settings changed. A control run before any change reproduced the 10 Nov
`council/decay-base.json` exactly, so the differences below are the financing and nothing else.

- **The research rebuilds** (Gold trend, Gold trend fast, H4 trendline, daily engulf, momentum pullback, Mosha BO): every
  buy pays nights x rate x its entry price / its initial risk, on the first unit only. The rebuild records hold only the
  result, so `positions.mjs` reads each position's entry time, exit time, entry price and risk by running the rebuild's own
  functions again (`research/edge/robustness/systems.mjs`, not edited: its bytes are part of the Academy's version of the
  momentum pullback edge) and refuses to write unless every position equals the committed record (2018-26 gold candles from
  `origin/council-data`; all 1,796 positions matched). A sell pays nothing and is credited nothing.
- **The council replay rows** (Gold replica; and every gold replay row the monitor reads in front of a forward record): their
  R is after the spread only, so `council/decay.mjs` `replayNet` charges a gold buy the Trader's own financing when the row
  is read (`fills.mjs` `rowFinancing`: entry, first stop, fill and close of the row). The baseline build uses the same
  function, so the record under watch and its baseline are costed alike. No stored row is changed, and a forward trade keeps
  the cost stamped at its close.

| System | n | Before: R a trade | Financing a position (nights held) | After: R a trade | Control limit h | Drawdown limit |
|---|---|---|---|---|---|---|
| Gold trend | 40 | +1.640 | 0.136R (22.8) | **+1.504** | 2.86 → 2.92 | 6.88R → 7.47R |
| Gold trend fast (shadow) | 74 | +1.064 | 0.124R (22.5) | **+0.940** | 2.92 → 3.04 | 9.23R → 10.63R |
| Gold daily engulf | 217 | +0.198 | 0.059R (4.7) | **+0.139** | 6.98 → 6.99 | 22.28R → 25.49R |
| Gold H4 trendline (shadow) | 304 | +0.106 | 0.038R (2.7) | **+0.068** | 9.08 → 9.07 | 20.96R → 23.86R |
| Gold momentum pullback (shadow) | 1,004 | +0.043 | 0.011R (0.2; 171 buys held over a rollover) | **+0.032** | 14.57 → 14.48 | 49.67R → 52.66R |
| Mosha BO (shadow) | 157 | −0.064 | 0.029R (1.2; 77 buys) | **−0.093** | 5.99 → 5.97 | 45.99R → 49.45R |
| Gold replica (shadow) | 212 | +0.877 | 0.012R (0.5; 61 buys) | **+0.865** | 11.55 → 11.63 | 40.2R (the owner's allowance) |
| NQ open run, ICT A-setups, crypto trend | | unchanged | none (NQ is out before the rollover; no rate measured for the others) | identical | | |

**No status changed.** On council-data of 11 Nov 2026 22:00 UTC every system reads as before (nine healthy or too few to
judge, crypto trend decaying), with the old and with the new baselines, and with the replay rows charged or not. The largest
move in a CUSUM is the replica's (8.13 → 8.21 of a limit 11.63); Gold trend 0.30 → 0.30 of 2.92, the daily engulf
3.08 → 3.00 of 6.99.

Limits. Today's rate for every past year (no history of the broker's rate exists here). First unit only: the add unit of a
trend position is not charged, so the trend baselines are still a little high (Part A of `research/edge/trend-breadth` puts
the true cost about a third higher). The quoted worst historical drawdowns (3.7R, 6.6R, 14.1R, 10.2R from
`research/edge/gold-systems`) are before financing; where the charged record's own drawdown is deeper it is used (Gold trend
3.78R). The backtests of the monitor in sections 1 to 3 are unchanged except the replica's out-of-sample timeline, which is
read against the baseline 0.012R lower (first "decaying" still at trade 82, 5 Oct 2022). The simulation table moved by a few
points (`result.json`). To repeat: extract `research/candles/xau-histdata` from `origin/council-data` into a folder, run
`research/edge/robustness/systems.mjs mosha` once with `ROB_DATA` set to it (the event cache, about two minutes), then
`ROB_DATA=<folder> node research/edge/decay-monitor/positions.mjs` and `node research/edge/decay-monitor/run.mjs <council-data>`.
Tests: `tests/financing-rest.test.mjs`.
