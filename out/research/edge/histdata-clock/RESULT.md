# HistData M1 clock audit (10 Nov 2026)

**Verdict: data audit, no trading rule tested. The HistData files are stamped on rule R4 (hybrid): New York time in 2018, Europe's summer-time dates from 2019. Every loader now converts with it (`council/histdata.mjs`).**

- Labels from 2019 on: **UTC−5, and UTC−4 while Europe is on summer time** (last Sunday of March to last Sunday of October).
- Labels in 2018: **New York wall-clock time** (UTC−4 from the 2nd Sunday of March to the 1st Sunday of November).
- The two halves agree from 4 Nov 2018 to 10 Mar 2019, so no stamp depends on the switch date.

This is a data audit. It tests no trading rule and finds no edge. Pre-registration: `PREREGISTRATION.md` (committed before
`run.mjs` existed; Amendment 1 was added before the first run). Nothing below was tuned after seeing a study result: the
rule was fixed here, on these counts, before any study was re-run.

## The evidence

329 release times, 461 weeks, 11 symbols, 2018 to October 2026. "Agree" means the check shows the offset the rule gives.

| Rule | Symbol-years certified (of 99) | A release minutes: agree / clear | B OANDA weeks: agree / decisive | B in the US / Europe mismatch weeks | C weekly reopen: agree / weekends | D1 change weekends: agree / read |
|---|---|---|---|---|---|---|
| R1 fixed (label + 5 h all year, what HistData documents) | 0 | 1,032 / 2,195 | 1,952 / 4,755 | 297 / 327 | 2,886 / 5,060 | 170 / 385 |
| R2 new-york (the gold-systems, robustness, timing, costs, NQ open-run loaders) | 9 | 1,980 / 2,195 | 4,458 / 4,755 | 30 / 327 | 4,509 / 5,060 | 54 / 385 |
| R3 europe (the event-reaction loader) | 64 | 2,166 / 2,195 | 4,725 / 4,755 | 297 / 327 | 4,768 / 5,060 | 306 / 385 |
| **R4 hybrid** | **73** | **2,191 / 2,195** | **4,755 / 4,755** | **327 / 327** | 4,798 / 5,060 | 350 / 385 |

- **B is the strongest check and it is unanimous.** Every week of every year was read against OANDA H1 (hourly returns,
  trial offsets 3 to 6 hours). Of 5,071 symbol-weeks, 4,820 could be read and 4,755 were decisive (best correlation ≥ 0.80
  and ≥ 0.25 above the runner-up). All 4,755 show the offset R4 gives, including all 327 decisive weeks inside the
  mismatch windows. No week shows a different offset.
- **A agrees in 2,191 of 2,195 clear release minutes.** The four misses are listed below; none is in a mismatch window.
- R2 (New York time) is right in 2018 only: its 9 certified symbol-years are all 2018, where R2 and R4 are the same rule.
  From 2019 it is wrong in the mismatch weeks (30 of 327 agree: the 30 are 2018).
- R1 (the documented "EST, no daylight saving") is wrong in every summer week: 0 symbol-years.
- R3 (Europe's dates for every year) is wrong in the 2018 mismatch weeks only.
- **No symbol-year certifies a rule that conflicts with R4**, so the converter takes no symbol argument.

By symbol (R4):

| Symbol | Years certified | A agree / clear (mismatch windows) | B agree / decisive (mismatch windows) | Weeks: all / readable / decisive | C agree / weekends | D1 agree / read |
|---|---|---|---|---|---|---|
| XAUUSD | 8 / 9 | 205 / 205 (19 / 19) | 437 / 437 (30 / 30) | 461 / 438 / 437 | 444 / 460 | 32 / 35 |
| XAGUSD | 7 / 9 | 208 / 208 (21 / 21) | 438 / 438 (30 / 30) | 461 / 438 / 438 | 450 / 460 | 32 / 35 |
| NSXUSD | 5 / 9 | 124 / 126 (20 / 20) | 436 / 436 (30 / 30) | 461 / 438 / 436 | 441 / 460 | 32 / 35 |
| SPXUSD | 7 / 9 | 132 / 132 (21 / 21) | 437 / 437 (30 / 30) | 461 / 438 / 437 | 440 / 460 | 31 / 35 |
| UDXUSD (B against OANDA EUR/USD, sign flipped: a proxy) | 5 / 9 | 224 / 225 (20 / 20) | 382 / 382 (26 / 26) | 461 / 438 / 382 | 407 / 460 | 29 / 35 |
| EURUSD | 7 / 9 | 224 / 225 (23 / 23) | 438 / 438 (30 / 30) | 461 / 439 / 438 | 446 / 460 | 32 / 35 |
| GBPUSD | 8 / 9 | 214 / 214 (22 / 22) | 438 / 438 (30 / 30) | 461 / 438 / 438 | 437 / 460 | 34 / 35 |
| USDJPY | 7 / 9 | 211 / 211 (24 / 24) | 437 / 437 (30 / 30) | 461 / 438 / 437 | 437 / 460 | 32 / 35 |
| AUDUSD | 8 / 9 | 219 / 219 (21 / 21) | 437 / 437 (30 / 30) | 461 / 438 / 437 | 443 / 460 | 33 / 35 |
| USDCAD | 6 / 9 | 210 / 210 (21 / 21) | 437 / 437 (30 / 30) | 461 / 438 / 437 | 442 / 460 | 33 / 35 |
| USDCHF | 5 / 9 | 220 / 220 (24 / 24) | 438 / 438 (31 / 31) | 461 / 439 / 438 | 411 / 460 | 30 / 35 |

## What is UNCERTIFIED, and why

26 of the 99 symbol-years fail the pre-registered criteria. They stay UNCERTIFIED: the criteria were not loosened after the
run. In none of them does any check point to a different rule; every decisive OANDA week in them agrees with R4.

| Why | Symbol-years |
|---|---|
| **2023, all 11 symbols: the files have a hole.** From 20 Feb to 30 Jul 2023 the files hold too few bars to read a week (23 weeks unreadable). Only 29 or 30 weeks are decisive (the bar was 30, with 3 in the mismatch windows; 2023 has 1 or 2). On many 2023 Sundays the first hour after the reopen is missing, so the reopen check fails too. | XAUUSD, XAGUSD, NSXUSD, SPXUSD, UDXUSD (thin only), EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF 2023 |
| **One release misread by the index clause.** The pre-registered clause "ratio(5) ≥ 4 shows offset 5 whatever ratio(4) is" was written for winter (where the other minute is the cash open). In summer it misreads a release when the hour before it was also busy: CPI 11 Oct 2018 (ratio 4.3 an hour early, 9.2 at the release) and CPI 12 Aug 2020 (4.5 and 4.2). One miss in 15 and one in 8 is under the 95 % bar. Every OANDA week of both years agrees (52 / 52 and 53 / 53). | NSXUSD 2018, NSXUSD 2020 |
| **Session checks disturbed by late reopens, holes or a holiday** (A and B both pass in full). 2024: the European spring change fell on Easter Sunday, so that weekend's label gap is a day long, and a late first bar on one other change weekend leaves 2 of 4. 2019: the first bar after the US spring change came on time by the label, where an hour's shift was expected, in three pairs and the dollar index (3 of 4 change weekends agree, but that Sunday is also a mismatch-window reopen, which must agree). USDCHF and USDCAD reopen late on many Sundays (thin first hour). | XAGUSD 2024, NSXUSD 2024, SPXUSD 2024, EURUSD 2024, USDJPY 2019, USDCAD 2019, USDCHF 2019, UDXUSD 2019, UDXUSD 2020, USDCAD 2022, USDCHF 2021, USDCHF 2022 |
| **The dollar index in 2018 cannot be checked.** Its 2018 hourly returns do not follow EUR/USD at any offset (correlation near 0 in 50 weeks; 2 decisive weeks), and its reopen matches the reference in 3 of 52 weekends. The 2018 file is a different or badly sampled series. 19 of 20 clear releases agree with R4, but that is one check alone. | UDXUSD 2018 |

The four release minutes that disagree with R4 (of 2,195): NSXUSD CPI 2018-10-11 and 2020-08-12 (above); UDXUSD 2 Mar 2018
(a second-Friday row, no payrolls that day: a spike an hour later); EURUSD 12 Nov 2021 (same: a non-payroll Friday, ratio
4.2 an hour later). 182 index readings were "4, open-confounded" (99 NSXUSD, 83 SPXUSD) and are left out of every count,
as pre-registered.

## What the raw files show at the clock changes (D)

- **D1, label gap across the weekend.** Gold, 2019 to 2022: one hour short on the US spring Sunday, one hour long on the
  European spring Sunday, short again on the European autumn Sunday, long on the US autumn Sunday, exactly as R4 predicts.
  In 2018 all four gaps are normal: the file clock moved with New York. 350 of 385 change weekends agree with R4; the misses
  are holes and holidays (2023; Easter 2024), not a different pattern.
- **D2, repeated and missing hours.** Every symbol's file repeats one hour of rows (60 labels) on the last Sunday of October
  in each year from 2019, never in 2018. The repeated rows are identical copies (an export artefact of a European clock);
  loaders drop rows whose converted time repeats, so nothing is double counted. No label is out of order in any file. The
  one-hour holes next to the change dates are the daily break (gold 17:00, indices 16:15 New York), which sits at label
  15:59 / 15:14 in the mismatch weeks and at 16:59 / 16:14 otherwise: the same finding seen from inside the day. The 2026
  monthly files overlap by up to 1,204 rows; those are dropped the same way.
- Weekly reopen under R4: 18:00 New York for metals and indices, 17:00 for the pairs, in 4,798 of 5,060 weekends.

## How the result is used

- `council/histdata.mjs` implements R4. `tests/histdata-clock.test.mjs` proves it equals `rules.mjs` R4 for every label
  hour 2018 to 2026, checks it against 10 real release windows, and fails if any loader of the files converts by itself.
- `result.json` keeps, per symbol, one character per week (`B.read`): the offset that week showed against OANDA, `?` for a
  week that was read but not decisive, `-` for a week the files are too thin to read. The Academy flags a setup whose week
  is not a verified week for its symbol (`academy/gen/run.mjs`).
- Studies re-run on the corrected clock use every year, as their own rules require. Where a headline rests on an
  uncertified symbol-year, the table below says so.

## Every study that reads the HistData files: before → after

Added after the audit, as its consequence, not as its evidence. Every loader was switched to `council/histdata.mjs`; no
rule, parameter, filter or cost was changed. "Control" means: the OLD loader was run again on today's code and data
first. Where the control reproduces the published file, the change is the clock and nothing else. Numbers are n, net R a
trade, t. "Old reading": NY = New York time for every year (an hour early in about four weeks a year from 2019);
+5 h = "EST, no daylight saving" (an hour late all of Europe's summer).

| Study | Old reading | Re-run | Control = published | Headline before → after | Verdict before → after |
|---|---|---|---|---|---|
| gold-systems | NY | yes | (same code path as the Academy generator, which reproduced it) | replica live 391, +0.479, 2.71 → 394, +0.462, 2.66; gtl 314, +0.141, 2.03 → 315, +0.159, 2.24; geg 174, +0.294, 2.12 → 175, +0.304, 2.21; mosha 64 and gtrend 41 unchanged | FAIL → FAIL |
| robustness (HistData blocks) | NY | yes | yes, byte for byte | NQ open run out-of-sample 220, +0.390, 3.55 → 219, +0.381, 3.44; gold H4 trendline OOS 105, +0.431, 3.08 → 105, +0.314, 2.53; its Mosha port, all years 147, +0.009 → 157, −0.064; gmp 1,003, +0.041, 1.01 → 1,004, +0.043, 1.06 | no verdict field changed |
| nq-open-oos (HistData cross-check) | NY | yes | OANDA part identical | 721, +0.126, 2.26 → 724, +0.115, 2.06; days both feeds signal 648 → 675 | regime-dependent (rests on OANDA) → unchanged |
| open-run-breadth (HistData ES cross-check) | NY | yes | yes | late part 200, −0.110, −1.17 → 195, −0.078, −0.81; days both feeds signal 443 → 463 | unchanged |
| event-reaction | Europe's dates for every year | yes | n/a (one event moves) | CPI rows 85 → 86; test 34 of 72 (p 0.72) → 34 of 73 (p 0.76) | FAIL → FAIL |
| event-risk | +5 h | yes | inputs yes; result differs by today's council data (215 of 1,806 numbers, no verdict field) | HistData ICT sample 519 → 529 | FAIL on all five → FAIL on all five (46 fields, 0 changed) |
| ict-universe | +5 h | yes | every verdict field yes (250 of 3,614 numbers differ slightly) | live gold rule OOS 165, +0.102, 0.91 → 167, +0.202, 1.68 | written verdict "no new market passes" stands; basic gate: EUR/USD A-setups INCONCLUSIVE → PASS (OOS 141, +0.091, 0.77), GC rows INCONCLUSIVE → PASS; 5 of 40 fields changed |
| ict-index-longonly | +5 h | yes | yes | dip-buying candidate OOS 114, +0.479, 3.21 → 117, +0.434, 2.99 | PASS → PASS (1 of 24 fields changed) |
| **ict-variants** | +5 h | yes | yes | live index book OOS 344, +0.184, 2.18 → 353, +0.190, 2.32 | **FAIL → PASS for one of nine, not strong** (V3 htffvg, index: IS 80, +0.273, 1.44; OOS 84, +0.355, 1.92) |
| ict-filters | +5 h | yes | yes | A-setups OOS 411, +0.125, 1.72 → 424, +0.170, 2.27; drop Friday OOS 354, +0.156, 1.96 → 364, +0.205, 2.50 | PASS (weak) → PASS (weak); the FVG filter is no longer picked in-sample, "Tuesday to Thursday only" is |
| ict-concepts | +5 h | yes | every pass field yes | live A-rule 2018-26: 1,129, +0.101, 2.21 → 1,150, +0.122, 2.74 | FAIL → FAIL |
| ict-exits (`detail.json`, `table.txt`) | +5 h | yes | yes | live exit OOS 440, +0.145, 2.05 → 449, +0.179, 2.45 | FAIL → FAIL (`result.json` summary left on the old clock) |
| ict-exits-replay (history table) | +5 h | yes | yes | every A-setup its own trade 1,411, +0.111, 2.81 → 1,435, +0.131, 3.31; structure trail against live −0.008 (t −0.47) → −0.002 (t −0.13) | "not confirmed on history" → the same |
| ict-trend-side (HistData cross-check) | +5 h | yes | yes | filtered 246, +0.171, 1.74 → 244, +0.203, 2.00 | FAILS → FAILS |
| portfolio (HistData ICT stream) | +5 h | yes | differs by today's council data (66 of 1,111 numbers) | 17 verdict fields, 0 changed | no rule change passes → the same |
| decay-monitor, expectations (baselines) | via robustness | rebuilt | yes | Mosha BO baseline 147, +0.009 → 157, −0.064; three others move slightly; six identical | monitoring baselines, no verdict |
| Academy, seven edges | NY | regenerated | n/a | `docs/academy/DATA-CLOCK.md` | policy: no measurable difference → the same; no scorer promoted |
| ict-sessions | +5 h (through ict-universe trades) | **not re-run: computed on the old clock** | inputs cannot be reproduced | its 32 verdict fields do not differ between old-clock and corrected HistData trades | nothing passes (old clock) |
| ict-smile | +5 h | **not re-run: computed on the old clock** | needs FRED, not reachable | | FAIL (old clock) |
| scalp-filters, scalp-exits, setups-promote, regime, confluence | +5 h | **not re-run: computed on the old clock** | long engine replays; machine time | | each FAIL (regime: mixed), old clock |
| timing, costs | NY | **not re-run: computed on the old clock** | long engine replays; machine time | | each FAIL, old clock |
| replica-oos | reads no HistData | not needed | | one quoted cross-check block is from the old gold-systems run | unchanged |
| shadow-audit, `research/robustness.mjs` | read no candles | not needed | | | |

What the table says, plainly:

- **One pre-registered verdict changed.** ict-variants: one of nine variant × book verdicts now passes its bar, with t under
  2 in both halves. The plan itself said one pass in nine by luck is plausible. It is a hypothesis for the owner
  (`docs/owner-decisions.md` item 20), not an edge, and nothing live follows from it.
- **No other study's verdict changed.** Some candidate rows moved between INCONCLUSIVE, PASS and FAIL at low t; each is
  listed in that study's own note.
- **The ICT A-rule on HistData reads a little better on the corrected clock** in every study that measures it (for
  example 1,411 trades at +0.111R, t 2.81 → 1,435 at +0.131R, t 3.31). That is the same rule on the same cash data with
  the sessions in the right hour. ICT stays a separate, paper-only edge.
- **Studies on the New York reading moved little** (four weeks a year). The largest move is the robustness audit's own
  Mosha BO port, which now makes nothing over 8 years (157 trades, −0.064R).
- Two cross-checks against OANDA got closer on the corrected clock (NQ and ES open runs), which is independent support
  for the rule.
- UNCERTIFIED symbol-years a headline rests on: gold 2023 (every gold study), NAS100 2018 / 2020 / 2023 / 2024 and S&P 500
  2023 / 2024 (the index studies), the dollar index 2018-20 and 2023 (event-reaction; its 2018 file is not a usable
  series: owner item 24). In each, every week that could be read agrees with the converter.

## Limits

- UDXUSD has no second feed. EUR/USD with the sign flipped is a proxy; it is decisive in 382 weeks, not 438.
- The OANDA check works on whole hours. A shift of minutes would not be seen by B; the release minutes (A, within
  2 minutes) cover that for the days they fall on.
- Check C and D1 rest on the venue keeping New York hours; they are one family, not two independent ones.
- The audit certifies the clock, not the prices. Holes (2023), flat bars and spikes are the data-quality report's subject.

## Reproduce

```sh
git archive origin/council-data research/candles | tar -x -C /tmp/cd          # outside the repo
node --use-env-proxy research/edge/histdata-clock/fetch.mjs /tmp/clock-oanda  # 180 calls, cached
node research/edge/histdata-clock/run.mjs /tmp/cd/research/candles /tmp/clock-oanda
```

## Every symbol and year (R4 counts; `agree / read; in mismatch windows`)

| Symbol | Year | Status | Certified rule | A releases (agree / clear; mismatch) | B OANDA weeks (agree / decisive; mismatch) | C reopens (agree / weekends; mismatch) | D1 change weekends |
|---|---|---|---|---|---|---|---|
| XAUUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 26/26; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| XAUUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 4/4 | 52/52; 4/4 | 51/52; 4/4 | 4/4 |
| XAUUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 16/16; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| XAUUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| XAUUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 3/3 | 51/51; 3/3 | 52/52; 3/3 | 4/4 |
| XAUUSD | 2023 | UNCERTIFIED | none | 15/15; 2/2 | 29/29; 1/1 | 37/52; 3/3 | 2/4 |
| XAUUSD | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 2/2 | 52/52; 4/4 | 53/53; 4/4 | 3/4 |
| XAUUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 23/23; 2/2 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| XAUUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 16/16; 1/1 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| XAGUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 26/26; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| XAGUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 4/4 | 52/52; 4/4 | 51/52; 4/4 | 4/4 |
| XAGUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 12/12; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| XAGUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 30/30; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| XAGUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 3/3 | 52/52; 3/3 | 51/52; 3/3 | 3/4 |
| XAGUSD | 2023 | UNCERTIFIED | none | 16/16; 2/2 | 29/29; 1/1 | 45/52; 2/3 | 4/4 |
| XAGUSD | 2024 | UNCERTIFIED | none | 26/26; 2/2 | 52/52; 4/4 | 53/53; 4/4 | 2/4 |
| XAGUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 24/24; 3/3 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| XAGUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 18/18; 2/2 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| NSXUSD | 2018 | UNCERTIFIED | none | 14/15; 1/1 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| NSXUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 14/14; 4/4 | 52/52; 4/4 | 50/52; 4/4 | 4/4 |
| NSXUSD | 2020 | UNCERTIFIED | none | 7/8; 0/0 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| NSXUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 17/17; 3/3 | 52/52; 3/3 | 51/52; 3/3 | 4/4 |
| NSXUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 18/18; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| NSXUSD | 2023 | UNCERTIFIED | none | 11/11; 2/2 | 29/29; 1/1 | 42/52; 1/3 | 3/4 |
| NSXUSD | 2024 | UNCERTIFIED | none | 18/18; 3/3 | 52/52; 4/4 | 48/53; 3/4 | 2/4 |
| NSXUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 17/17; 3/3 | 51/51; 4/4 | 52/52; 4/4 | 4/4 |
| NSXUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 8/8; 1/1 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| SPXUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 15/15; 1/1 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| SPXUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 16/16; 4/4 | 52/52; 4/4 | 50/52; 4/4 | 4/4 |
| SPXUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 9/9; 0/0 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| SPXUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 17/17; 3/3 | 52/52; 3/3 | 51/52; 3/3 | 4/4 |
| SPXUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 18/18; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| SPXUSD | 2023 | UNCERTIFIED | none | 12/12; 2/2 | 29/29; 1/1 | 39/52; 3/3 | 2/4 |
| SPXUSD | 2024 | UNCERTIFIED | none | 17/17; 3/3 | 52/52; 4/4 | 51/53; 4/4 | 2/4 |
| SPXUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 17/17; 3/3 | 52/52; 4/4 | 52/52; 4/4 | 4/4 |
| SPXUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 11/11; 2/2 | 43/43; 4/4 | 42/43; 4/4 | 3/3 |
| UDXUSD | 2018 | UNCERTIFIED | none | 19/20; 3/3 | 2/2; 0/0 | 3/52; 0/3 | 4/4 |
| UDXUSD | 2019 | UNCERTIFIED | none | 29/29; 2/2 | 49/49; 3/3 | 49/52; 3/4 | 3/4 |
| UDXUSD | 2020 | UNCERTIFIED | none | 18/18; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 1/4 |
| UDXUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| UDXUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 51/51; 3/3 | 52/52; 3/3 | 3/4 |
| UDXUSD | 2023 | UNCERTIFIED (thin) | none | 18/18; 2/2 | 29/29; 1/1 | 52/52; 3/3 | 4/4 |
| UDXUSD | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 3/4 |
| UDXUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 3/3 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| UDXUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 25/25; 2/2 | 41/41; 4/4 | 43/43; 4/4 | 3/3 |
| EURUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 27/27; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| EURUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 2/2 | 52/52; 4/4 | 51/52; 4/4 | 4/4 |
| EURUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 16/16; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| EURUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 31/32; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| EURUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 25/25; 3/3 | 51/51; 3/3 | 52/52; 3/3 | 4/4 |
| EURUSD | 2023 | UNCERTIFIED | none | 19/19; 3/3 | 30/30; 1/1 | 40/52; 2/3 | 2/4 |
| EURUSD | 2024 | UNCERTIFIED | none | 30/30; 3/3 | 52/52; 4/4 | 52/53; 3/4 | 3/4 |
| EURUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| EURUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 22/22; 3/3 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| GBPUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 30/30; 3/3 | 52/52; 3/3 | 51/52; 3/3 | 4/4 |
| GBPUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 22/22; 3/3 | 52/52; 4/4 | 51/52; 4/4 | 4/4 |
| GBPUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 12/12; 0/0 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| GBPUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| GBPUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 3/3 | 52/52; 3/3 | 50/52; 3/3 | 4/4 |
| GBPUSD | 2023 | UNCERTIFIED | none | 18/18; 2/2 | 29/29; 1/1 | 34/52; 1/3 | 3/4 |
| GBPUSD | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 4/4 |
| GBPUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| GBPUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 22/22; 2/2 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| USDJPY | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 27/27; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| USDJPY | 2019 | UNCERTIFIED | none | 27/27; 4/4 | 52/52; 4/4 | 50/52; 3/4 | 3/4 |
| USDJPY | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 15/15; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| USDJPY | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| USDJPY | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 51/51; 3/3 | 48/52; 3/3 | 4/4 |
| USDJPY | 2023 | UNCERTIFIED | none | 16/16; 2/2 | 29/29; 1/1 | 37/52; 3/3 | 2/4 |
| USDJPY | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 25/25; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 4/4 |
| USDJPY | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 25/25; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| USDJPY | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 22/22; 3/3 | 43/43; 4/4 | 41/43; 4/4 | 3/3 |
| AUDUSD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 30/30; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| AUDUSD | 2019 | CERTIFIED | R3 = R4 (same rule from 2019) | 30/30; 3/3 | 52/52; 4/4 | 51/52; 4/4 | 4/4 |
| AUDUSD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 12/12; 0/0 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| AUDUSD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 25/25; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| AUDUSD | 2022 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 51/51; 3/3 | 51/52; 3/3 | 4/4 |
| AUDUSD | 2023 | UNCERTIFIED | none | 19/19; 2/2 | 29/29; 1/1 | 37/52; 3/3 | 2/4 |
| AUDUSD | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 4/4 |
| AUDUSD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| AUDUSD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 21/21; 3/3 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| USDCAD | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 29/29; 2/2 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| USDCAD | 2019 | UNCERTIFIED | none | 30/30; 3/3 | 52/52; 4/4 | 50/52; 3/4 | 3/4 |
| USDCAD | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 12/12; 0/0 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| USDCAD | 2021 | CERTIFIED | R3 = R4 (same rule from 2019) | 28/28; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| USDCAD | 2022 | UNCERTIFIED | none | 24/24; 3/3 | 51/51; 3/3 | 49/52; 2/3 | 4/4 |
| USDCAD | 2023 | UNCERTIFIED | none | 14/14; 2/2 | 29/29; 1/1 | 40/52; 3/3 | 3/4 |
| USDCAD | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 4/4 |
| USDCAD | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 27/27; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| USDCAD | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 20/20; 2/2 | 43/43; 4/4 | 43/43; 4/4 | 3/3 |
| USDCHF | 2018 | CERTIFIED | R2 = R4 (same rule in 2018) | 26/26; 3/3 | 52/52; 3/3 | 52/52; 3/3 | 4/4 |
| USDCHF | 2019 | UNCERTIFIED | none | 27/27; 4/4 | 52/52; 4/4 | 50/52; 3/4 | 3/4 |
| USDCHF | 2020 | CERTIFIED | R3 = R4 (same rule from 2019) | 13/13; 0/0 | 53/53; 4/4 | 51/52; 4/4 | 4/4 |
| USDCHF | 2021 | UNCERTIFIED | none | 29/29; 3/3 | 52/52; 3/3 | 43/52; 1/3 | 3/4 |
| USDCHF | 2022 | UNCERTIFIED | none | 26/26; 3/3 | 51/51; 3/3 | 33/52; 1/3 | 3/4 |
| USDCHF | 2023 | UNCERTIFIED | none | 20/20; 2/2 | 30/30; 2/2 | 35/52; 2/3 | 2/4 |
| USDCHF | 2024 | CERTIFIED | R3 = R4 (same rule from 2019) | 26/26; 3/3 | 52/52; 4/4 | 53/53; 4/4 | 4/4 |
| USDCHF | 2025 | CERTIFIED | R3 = R4 (same rule from 2019) | 29/29; 3/3 | 53/53; 4/4 | 52/52; 4/4 | 4/4 |
| USDCHF | 2026 | CERTIFIED | R3 = R4 (same rule from 2019) | 24/24; 3/3 | 43/43; 4/4 | 42/43; 4/4 | 3/3 |
