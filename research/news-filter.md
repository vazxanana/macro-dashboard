# News filter: do trades around high-impact news do worse? (7 Nov 2026)

**Short answer.**
- **ICT desk: no.** No news window is negative. The live A-setup rule almost never fires within 2 hours of a tier-1 US release: only 6 of 253 replay A-setups did. Result: null. No variant was added.
- **Meridian engine setups: yes, around the 08:30 ET US releases.** On the 90-day replay, trades entered within ±120 min of CPI / NFP / FOMC / PCE made **−0.36R a trade against −0.15R for the rest**:
  - n = 301, t = −5.0
  - −0.35R and −0.36R in the two halves
  - Welch t of the gap −2.8

  This passes the brief's bar (n ≥ 30, t ≤ −2, negative in both halves), so a **paper-only research tag** was added: `feat.newsT1` / `feat.newsMin` on live Trader records, and `newsT1` / `newsMin` backtest columns.
- **No live rule changed. The owner decides.** The evidence is weaker than the trade count suggests:
  - Those 301 trades come from only 11 release events. The gap judged per event has t = −1.8.
  - CPI and NFP drive it. FOMC windows were *positive*.
- **Meridian main systems** (gold replica / trend, NQ open run, pairs; replay since Aug 2025) earn less around news but do not lose. Within ±120 min they made +0.03R vs +0.44R for the rest, n = 94. Not clearly negative.

## Calendar

`council/events.mjs` holds the calendar as hardcoded official dates. `research/data/events.json` is generated from it with `node council/events.mjs > research/data/events.json`, and a test checks the two match. It covers 181 events from 1 Aug 2025 to Dec 2026. Dates after 7 Nov 2026 carry `scheduled: true`.

| type | n | local time | source (official page) |
|---|---|---|---|
| CPI | 16 | 08:30 ET | BLS CPI schedule + BLS "2025 lapse revised release dates". Sep-25 CPI moved to 24 Oct; Oct-25 CPI never produced; Nov-25 CPI on 18 Dec; Jan-26 CPI moved 11 → 13 Feb |
| NFP | 16 | 08:30 ET | BLS Employment Situation schedule + the same BLS page. Sep-25 report on Thu 20 Nov; Oct-25 cancelled; Nov-25 on Tue 16 Dec; Jan-26 moved 6 → 11 Feb; 2 Jul 2026 is a Thursday |
| FOMC | 11 | 14:00 ET, day 2 | federalreserve.gov FOMC calendar |
| PCE | 16 | 08:30 ET (two at 10:00) | BEA release schedule + BEA notices of 7 and 15 Jan 2026. Sep-25 data 5 Dec 10:00; Oct+Nov-25 data 22 Jan 10:00; Dec-25 data 20 Feb; Jan-26 data 13 Mar; Feb-26 data 9 Apr |
| ECB | 10 | 14:15 Frankfurt | ECB Governing Council schedule + monetary policy statements |
| BoJ | 10 | ~12:00 Tokyo (`approx`) | BoJ MPM schedule + minutes / statements. No fixed minute |
| ISM mfg / services | 17 + 17 | 10:00 ET | ISM rule (1st / 3rd business day), Jan-26 from ISM's calendar. Rule-derived |
| Jobless claims | 68 | Thu 08:30 ET | DOL weekly; Wednesday on holiday weeks; none 1 Oct – 12 Nov 2025 (shutdown). Rule-derived |

- **How the dates were checked.** The official pages themselves could not be fetched from the research sandbox: its network allowlist blocks federalreserve.gov, bls.gov, bea.gov, ecb.europa.eu, boj.or.jp and faireconomy. So every date was checked against web-search extracts of those pages, cross-checked with a second calendar where one existed. Example: the extract from the BLS revised-dates page gave "Employment Situation September 2025 … Thursday, November 20, 2025 8:30 AM ET".
- **One independent cross-check.** NFP on 6 Nov 2026 at 13:30 UTC matches the faireconomy feed that the live Trader stored in `trades.json` that week.
- **Conflict found and resolved.** The BLS November page also showed 10 Nov for the October jobs report. The empsit schedule and the faireconomy feed both say 6 Nov, so 6 Nov is used.
- **Time conversion.** UTC times are computed per date with each zone's daylight-saving rules. Example: ECB 30 Oct 2025 = 13:15 UTC, ECB 23 Jul 2026 = 12:15 UTC.

`nearEvent(ts, windowMin, { tier, type, country })` returns the nearest event with the signed `minutes` from it, or null.
- `ts` can be in seconds, milliseconds or a Date.
- When two events share a minute, the bigger one wins: tier 1, then central banks, then tier 2. Example: PCE over claims on 30 Apr 2026.

Also exported:
- `eventDay(ts)`: the New York trading day, 18:00 → 18:00 ET.
- `eventsBetween(a, b)`
- `newsFeat(ts)`
- `EVENTS`, `SOURCES`

These are for `council/macro.mjs`.

## Method

`research/edge/news-filter/analyze.mjs <council-data checkout>` writes `result.json` and `tables.md` (full tables).

**Data, all from council-data at 7 Nov 2026 ~20:15 UTC:**

| data | rows | what |
|---|---|---|
| ICT `ict/replay.json` | 826 closed graded signals (253 A-setups) | 1 Aug 2025 – 6 Nov 2026, NQ / ES / YM / RTY / GC, R per unit (`Rraw`) |
| Meridian `research/replay-90d.json` | 7,853 | the backtest engine over 90 days (9 Aug – 7 Nov 2026), 10 markets, limit entries (no `@mkt` twins), R net of cost |
| Meridian `backtest.json` | 2,499 | the same engine over the last 30 days (a subset of the 90-day period, re-run with current Kraken fees) |
| Meridian `research/replay-2w.json` | 499 | the main systems' replay since 1 Aug 2025 |
| Meridian `trades.json` | 36 live + 515 shadow | 1 – 7 Nov 2026 |

**Groups.** Each trade's entry is tagged against four event sets:
- ALL
- T1 = CPI / NFP / FOMC / PCE
- CB = ECB / BoJ
- T2 = ISM / claims

Groups are cumulative windows (±30, ±60, ±120 min) and *same New York trading day*, each compared with the rest of the same data set.

**Statistics.**
- Reported: n, R/trade, win %, one-sample t, both chronological halves (cut at the data set's median entry date), and Welch t of in vs rest.
- Event-clustered t: each release counts once, as the mean R of its trades minus the rest. Trades around one release share one price move, so the trade-level t overstates the evidence.

## Results (all markets; per-market rows in tables.md)

ALL events:

| system / data | window | n | R/trade | win % | t | half 1 / half 2 | rest R/trade | t (in − rest) |
|---|---|---|---|---|---|---|---|---|
| ICT all signals | ±30 | 39 | +0.24 | 36% | 0.69 | +0.12 / +0.30 | +0.17 | 0.21 |
| ICT all signals | ±60 | 65 | +0.16 | 39% | 0.68 | −0.16 / +0.34 | +0.17 | −0.06 |
| ICT all signals | ±120 | 104 | +0.10 | 39% | 0.61 | +0.08 / +0.11 | +0.18 | −0.47 |
| ICT all signals | event day | 352 | +0.26 | 38% | 2.60 | +0.15 / +0.35 | +0.10 | 1.27 |
| ICT A-setups | ±30 | 10 | +0.85 | 40% | 0.75 | −0.17 / +2.40 | +0.31 | 0.48 |
| ICT A-setups | ±60 | 15 | +0.86 | 53% | 1.12 | −0.04 / +1.64 | +0.30 | 0.72 |
| ICT A-setups | ±120 | 30 | +0.31 | 40% | 0.74 | −0.04 / +0.77 | +0.34 | −0.05 |
| ICT A-setups | event day | 108 | +0.47 | 39% | 2.23 | +0.36 / +0.56 | +0.23 | 0.93 |
| Meridian replay 90d | ±30 | 226 | −0.19 | 35% | −2.13 | −0.19 / −0.18 | −0.15 | −0.34 |
| Meridian replay 90d | ±60 | 379 | −0.15 | 36% | −2.13 | −0.12 / −0.19 | −0.16 | 0.04 |
| Meridian replay 90d | ±120 | 688 | −0.10 | 36% | −1.87 | −0.08 / −0.12 | −0.16 | 0.96 |
| Meridian replay 90d | event day | 3342 | −0.13 | 32% | −3.93 | −0.17 / −0.10 | −0.18 | 1.22 |
| Meridian backtest 30d | ±30 | 66 | −0.50 | 33% | −2.94 | −0.59 / −0.45 | −0.94 | 2.48 |
| Meridian backtest 30d | ±120 | 228 | −0.58 | 33% | −4.62 | −0.79 / −0.43 | −0.97 | 2.87 |
| Meridian main systems | ±30 | 27 | −0.12 | 26% | −0.42 | −0.48 / +0.27 | +0.39 | −1.67 |
| Meridian main systems | ±120 | 94 | +0.03 | 37% | 0.19 | −0.15 / +0.21 | +0.44 | −2.12 |
| Meridian main systems | event day | 225 | +0.15 | 37% | 1.24 | +0.06 / +0.22 | +0.54 | −1.96 |

Tier-1 US releases only (CPI / NFP / FOMC / PCE):

| system / data | window | n | R/trade | win % | t | half 1 / half 2 | rest | t (in − rest) | events | t by event |
|---|---|---|---|---|---|---|---|---|---|---|
| ICT all signals | ±60 | 27 | −0.10 | 37% | −0.46 | +0.06 / −0.21 | +0.18 | −1.24 | 20 | −1.00 |
| ICT all signals | ±120 | 41 | +0.01 | 44% | 0.04 | +0.20 / −0.18 | +0.18 | −0.94 | 25 | −0.07 |
| ICT all signals | event day | 130 | +0.08 | 35% | 0.59 | +0.24 / −0.09 | +0.19 | −0.76 | 46 | −0.23 |
| ICT A-setups | ±120 | 6 | −0.04 | 33% | −0.09 | −0.14 / +0.45 | +0.34 | −0.72 | 5 | −0.33 |
| ICT A-setups | event day | 32 | −0.06 | 25% | −0.25 | −0.37 / +0.18 | +0.39 | −1.63 | 21 | −1.05 |
| Meridian replay 90d | ±30 | 116 | −0.24 | 33% | −2.11 | −0.32 / −0.18 | −0.15 | −0.76 | 11 | −0.41 |
| Meridian replay 90d | ±60 | 182 | −0.30 | 31% | −3.31 | −0.25 / −0.34 | −0.15 | −1.59 | 11 | −1.18 |
| **Meridian replay 90d** | **±120** | **301** | **−0.36** | **29%** | **−5.03** | **−0.35 / −0.36** | **−0.15** | **−2.82** | **11** | **−1.77** |
| Meridian replay 90d | event day | 1259 | −0.16 | 31% | −3.43 | −0.29 / −0.08 | −0.15 | −0.16 | 11 | −0.29 |
| Meridian backtest 30d | ±120 | 118 | −0.84 | 27% | −5.31 | −1.13 / −0.66 | −0.94 | 0.60 | 4 | 0.74 |
| Meridian main systems | ±120 | 38 | −0.01 | 40% | −0.07 | +0.09 / −0.11 | +0.39 | −1.61 | 29 | −2.10 |
| Meridian live shadow | ±120 | 34 | +0.06 | 35% | 0.23 | – / +0.06 | +0.18 | −0.40 | 1 | – |

Live Meridian trades (36, 1–7 Nov) had no tier-1 entry at all.

Meridian 90-day replay, tier-1 ±120 min, by market (R/trade in vs rest):

| market | in | rest |
|---|---|---|
| EUR/USD | −0.77 (n 21) | −0.13 |
| AUD/USD | −0.62 (35) | −0.36 |
| BTC | −0.63 (29) | −0.22 |
| GBP/USD | −0.51 (33) | −0.22 |
| USD/CAD | −0.43 (39) | −0.11 |
| USD/CHF | −0.42 (16) | −0.13 |
| SOL | −0.27 (19) | −0.09 |
| ETH | −0.19 (19) | −0.02 |
| XAU | −0.18 (53) | −0.11 |
| XRP | +0.20 (37) | −0.12 |

The same window by event type (90-day replay):

| event | n | R/trade |
|---|---|---|
| NFP | 71 | −0.71 |
| CPI | 110 | −0.44 |
| PCE | 58 | −0.30 |
| FOMC | 49 | **+0.21** |

8 of the 11 events were negative: all three CPIs, all three NFPs, and two of the three PCEs.

Before costs the same comparison holds:
- 90-day replay: −0.29R vs −0.06R.
- 30-day backtest: −0.18R vs −0.03R.

The 30-day *net* figures turn the other way only because Kraken fees on tight crypto stops cost about 2R a trade there, which swamps everything else.

ICT by market: no market has a clearly negative window. The largest negative cells are below; neither reaches n ≥ 30.
- NQ all signals, ALL ±120: −0.40R, n 22, Welch −2.41.
- ES all signals, T1 ±120: −0.44R, n 13.

GC signals around tier-1 releases were positive (+0.74R, n 8).

## Decision

**ICT: null result.** No window meets n ≥ 30, t ≤ −2 and negative in both halves. A-setups barely meet news at all. No shadow variant is added. The existing A-rule exclusion `nfpMorning` (first Friday before 10:00 ET) stays as it is.

One mismatch for the owner to look at, with no change made: in this calendar, 6 of the 15 jobs reports up to 6 Nov 2026 were not on a first Friday.
- Moved reports: 20 Nov 2025, 16 Dec 2025, 9 Jan 2026, 11 Feb 2026, 8 May 2026, 2 Jul 2026.
- First Fridays with no NFP: 3 Oct, 7 Nov and 5 Dec 2025; 2 Jan, 6 Feb, 1 May and 3 Jul 2026.
- Effect on the replay: 4 signals were excluded on non-NFP mornings and 4 real NFP mornings were missed. At most one A-setup decision changed: YM, 5 Dec 2025, grade 8, against the bias, −1R. The 4 missed ones were with the bias, so they were not A-setups anyway.

`nearEvent(ts, 90, { type: 'NFP' })` would be the exact form if the owner wants it.

**Meridian: research tag, not a rule.** The tier-1 ±120 min window passes the brief's bar, and is also worse than the rest in both halves. So every Meridian record is now tagged with the nearest CPI / NFP / FOMC / PCE within ±120 min and the minutes to it:
- Live Trader: `feat.newsT1` and `feat.newsMin`.
- `council/backtest.mjs`: the `newsT1` and `newsMin` tradeCols, appended after `adxBand` so older indexes hold.

No filter, focus, news guard or Coach step reads the tag. It lets the next backtests and the forward shadow book confirm or kill the effect. Reasons it is not a rule:
- Only 11 independent events. The event-clustered t is −1.8.
- FOMC goes the other way.
- The engine setups lose money everywhere (−0.15R a trade outside news). A skip would make them lose less, not make them profitable.
- The live shadow book was positive around news in its first week (+0.06R, n 34, one event).

A natural paper sleeve to watch is "Meridian engine setups, skip 06:30 – 10:30 ET on CPI / NFP / PCE days". It would be worth proposing only once 20+ more releases show the same gap.

The Trader already has two news protections, both unchanged:
- The Coach-switched `newsGuard`, which uses this week's faireconomy feed.
- The gold replica's 08:25 – 08:45 ET veto.

## Reproduce

```
git show origin/council-data:ict/replay.json > d/ict/replay.json   # also backtest.json, trades.json, research/replay-90d.json, research/replay-2w.json
node research/edge/news-filter/analyze.mjs d
node --test tests/events.test.mjs
```
