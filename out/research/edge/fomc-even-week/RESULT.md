# The FOMC cycle: US index returns in weeks 2, 4 and 6 against weeks 1, 3 and 5: result

**Verdict: FAIL, US500 even minus odd weeks −0.028 % a day net 2017-26, t −0.73, 77 cycles; above 14 of 40 placebos.**

Pre-registered in `PREREGISTRATION.md` (committed and pushed alone before `run.mjs` existed). Meetings: 151 scheduled FOMC statements 2008 → Dec 2026 (Federal Reserve FOMC meeting calendars (scheduled meetings), 2008-2021 as in research/edge/pre-fomc-drift/events.mjs; 2022 on from council/events.mjs); unscheduled 2008-01-22, 2008-10-08, 2010-05-09, 2020-03-03, 2020-03-15 never start a cycle and the windows touching their days −1..+3 are dropped. Rule: long from the close before each week of the FOMC cycle to the close of its last day (week w = days 5w-1..5w+3 after the statement day), stop entry - 2 x ATR(20); weeks 2, 4, 6 against weeks 1, 3, 5; week 0 not used. Costs: round trip US500 1.0, NAS100 2.0, US30 3.0 index points plus 6 % a year financing per rollover (Friday three; an assumed rate). Data: OANDA mid UTC daily candles from council-data `research/daily` (to 2026-11-06), weekends folded into Monday. Units: % of price a day. D = per FOMC cycle, mean net % a day of its even-week longs minus that of its odd-week longs; t across cycles.

## The decisive figures (US500)

- **OOS 2017 → now**: 77 cycles, D net −0.0281 % a day, t −0.73 (one-sided p 0.7673, Holm over three markets 1; bar 0.02275); gross −0.0278, t −0.71.
- **IS 2008-2016**: 72 cycles, D net +0.1031 % a day, t +1.74; gross +0.1030, t +1.73.
- **Full 2008 → now**: 149 cycles, D net +0.0353, t +1.00.
- **2 x costs, OOS**: D −0.0285, even-week long alone −0.0166 % a day.
- **Placebo** (40 seeds, every meeting moved by its own ±5..±20 trading days): OOS D net mean +0.0035, max +0.1513; the real calendar is above 14 of 40 (38 needed).

Checks: oos not met · isSign met · x2 not met · placebo not met.

## Every market and window

| market | window | cycles | D net % a day | t | D gross | t gross | even windows | even net % a day | even month-sum t | odd windows | odd net % a day | odd month-sum t | Holm p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| US500 (SPX500) | 2008-2016 | 72 | +0.1031 | +1.74 | +0.1030 | +1.73 | 166 | +0.0330 | +0.83 | 200 | −0.0648 | −2.06 | · |
| US500 (SPX500) | 2017 → now | 77 | −0.0281 | −0.73 | −0.0278 | −0.71 | 184 | +0.0090 | +0.34 | 222 | +0.0403 | +1.49 | 1 |
| US500 (SPX500) | 2008 → now | 149 | +0.0353 | +1.00 | +0.0354 | +1.00 | 350 | +0.0204 | +0.88 | 422 | −0.0095 | −0.46 | · |
| NAS100 | 2008-2016 | 72 | +0.1207 | +1.87 | +0.1203 | +1.85 | 166 | +0.0579 | +1.35 | 200 | −0.0487 | −1.38 | · |
| NAS100 | 2017 → now | 77 | −0.0395 | −0.74 | −0.0387 | −0.72 | 184 | +0.0202 | +0.59 | 222 | +0.0628 | +1.67 | 1 |
| NAS100 | 2008 → now | 149 | +0.0379 | +0.90 | +0.0381 | +0.90 | 350 | +0.0381 | +1.40 | 422 | +0.0099 | +0.38 | · |
| US30 | 2008-2016 | 72 | +0.0640 | +1.18 | +0.0636 | +1.17 | 166 | +0.0261 | +0.70 | 200 | −0.0359 | −1.28 | · |
| US30 | 2017 → now | 77 | −0.0520 | −1.39 | −0.0522 | −1.38 | 184 | −0.0093 | −0.33 | 222 | +0.0485 | +2.02 | 1 |
| US30 | 2008 → now | 149 | +0.0040 | +0.12 | +0.0038 | +0.11 | 350 | +0.0075 | +0.33 | 422 | +0.0085 | +0.46 | · |

NAS100 does not confirm and US30 does not confirm (OOS, after Holm). Gross even-week longs, OOS: US500 +0.0346 % a day against odd +0.0656.

## Sensitivity (reported, not judged)

- US500 (SPX500): S1, the brief's counting (week w = days 5w..5w+4): OOS D −0.0649 (t −1.59), IS +0.0863 (t +1.49). S2, unscheduled not excluded: OOS −0.0334 (t −0.86), IS +0.1182 (t +2.02).
- NAS100: S1, the brief's counting (week w = days 5w..5w+4): OOS D −0.1306 (t −2.15), IS +0.1174 (t +1.79). S2, unscheduled not excluded: OOS −0.0453 (t −0.85), IS +0.1330 (t +2.06).
- US30: S1, the brief's counting (week w = days 5w..5w+4): OOS D −0.0433 (t −1.11), IS +0.0388 (t +0.75). S2, unscheduled not excluded: OOS −0.0567 (t −1.50), IS +0.0781 (t +1.46).

## By year, US500 (mean D net % a day, cycles)

2008 +0.006 (8) · 2009 +0.232 (8) · 2010 +0.430 (8) · 2011 +0.259 (8) · 2012 +0.013 (8) · 2013 −0.084 (8) · 2014 −0.225 (8) · 2015 +0.125 (8) · 2016 +0.170 (8) · 2017 −0.018 (8) · 2018 −0.120 (8) · 2019 −0.116 (8) · 2020 −0.365 (7) · 2021 −0.007 (8) · 2022 −0.013 (8) · 2023 +0.174 (8) · 2024 +0.089 (8) · 2025 −0.014 (8) · 2026 +0.099 (6)

## Windows dropped (US500)

No candle on the statement day: 2026-12-09. Cut by the next meeting: 121. Past the data: 0. Holes: 0. Unscheduled: 7.

## What this means

The pre-registered bar is not met on US500, so the FOMC-cycle even weeks are not an edge on the council's index feeds after costs. No proposal is written and nothing live changed. Week 0 (the meeting days) was left out on purpose: `pre-fomc-drift` tested it. Any other version (another counting, week 0 included, other indices, a filter) would need its own pre-registration on data not used here.

To repeat: `node research/edge/fomc-even-week/run.mjs fetch <dir>` (git show from `origin/council-data`, no network), then `node research/edge/fomc-even-week/run.mjs <dir>`. Tests: `tests/fomc-even-week.test.mjs`.
