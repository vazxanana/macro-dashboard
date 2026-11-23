# Box-edge touch with the H1 trend: result (23 Nov 2026)

**Verdict: FAIL.** T1 (M15 boxes, five markets): −0.199R a trade after costs out of sample (n 4950, month t −7.00), −0.217R in sample (n 6729), −0.214R on untouched 2010-2019 (n 16858, month t −12.21). T2 (M5) FAIL, T3 (gold) FAIL.

Pre-registered in PREREGISTRATION.md (committed before any trade was computed); run by `run.mjs` on the toolkit's OANDA mid 5m
cache. R after the toolkit's round-trip costs unless said; t on calendar-month sums (by exit month); windows by entry time.

| Test | Window | n | R a trade after costs | month t | at 2x costs | before costs | Holm p (OOS) | verdict |
|---|---|---|---|---|---|---|---|---|
| T1 M15 boxes, five markets pooled | 2010-2019 | 16858 | −0.214 | −12.21 | −0.348 | −0.079 |  |  |
| T1 M15 boxes, five markets pooled | 2020-2023 (IS) | 6729 | −0.217 | −7.87 | −0.353 | −0.080 |  |  |
| T1 M15 boxes, five markets pooled | 2024 - 13 Nov 2026 (OOS) | 4950 | −0.199 | −7.00 | −0.330 | −0.068 | 0.00 | FAIL |
| T2 M5 boxes, five markets pooled | 2010-2019 | 31144 | −0.241 | −16.51 | −0.399 | −0.083 |  |  |
| T2 M5 boxes, five markets pooled | 2020-2023 (IS) | 11894 | −0.194 | −9.38 | −0.357 | −0.032 |  |  |
| T2 M5 boxes, five markets pooled | 2024 - 13 Nov 2026 (OOS) | 8831 | −0.159 | −5.81 | −0.311 | −0.006 | 0.00 | FAIL |
| T3 M15 boxes, gold alone | 2010-2019 | 1412 | −0.345 | −6.09 | −0.515 | −0.175 |  |  |
| T3 M15 boxes, gold alone | 2020-2023 (IS) | 917 | −0.189 | −2.73 | −0.348 | −0.029 |  |  |
| T3 M15 boxes, gold alone | 2024 - 13 Nov 2026 (OOS) | 1126 | −0.179 | −2.75 | −0.279 | −0.080 | 0.01 | FAIL |

## Per market, M15 (T1), R a trade after costs (n)

| Market | 2010-2019 | 2020-2023 | 2024-2026 | before costs 2024-2026 |
|---|---|---|---|---|
| audusd | −0.232 (4449) | −0.157 (1612) | −0.270 (909) | −0.112 |
| gbpusd | −0.194 (3880) | −0.203 (1532) | −0.050 (888) | +0.098 |
| eurusd | −0.191 (3965) | −0.251 (1466) | −0.284 (928) | −0.145 |
| usdjpy | −0.183 (3152) | −0.293 (1202) | −0.208 (1099) | −0.088 |
| xau | −0.345 (1412) | −0.189 (917) | −0.179 (1126) | −0.080 |

## In plain words

- Before costs the rule is −0.068R a trade out of sample and −0.079R on 2010-2019 (M15); the costs take the rest.
- On M5 the boxes are smaller, so costs weigh more: −0.006R before costs and −0.159R after, out of sample (n 8831).
- Gold alone (the market the rule was shaped on): −0.179R a trade after costs out of sample (n 1126), −0.345R on 2010-2019 (n 1412).
- Exits (T1, all windows): stop 23779 (−1.01R before costs), target 4123 (+5.03R before costs), time 635 (+1.58R before costs).
- Buys −0.228R and sells −0.170R a trade after costs out of sample (T1).

## What it does NOT show

- It does not test the owner's own reading of a box on a chart: it tests one mechanical reading (3-candle swings, the toolkit's chaining).
- It does not test other stop distances, targets, swing sizes, timeframes or filters; none was tried after the result (pre-registered).
- Costs are today's demo figures charged on every year; slippage on the stop is not modelled beyond a gap at the open.
- A FAIL here is about this rule on these five markets; it does not judge the owner's discretionary trades.
- trades.json holds the T1 trades (T3 = its gold rows); the T2 (M5) trades are left out to keep it under 3 MB, their numbers are in result.json.

Nothing live changed. Files: result.json (every number), trades.json (every trade), tests/box-touch-trend.test.mjs.

## Financing not charged (23 Nov 2026, review)

Gold buys held over the 22:00 UTC rollover pay overnight financing (`council/fills.mjs` `FIN.xau.long`); this study's R after
costs does not charge it, so every gold buy's figure is a little flattered. Measured afterwards from `trades.json` with
`financing()`: 1,737 gold buys of T1, 178 held over a 22:00 UTC rollover: on average 0.017R a gold buy (28.9R in all). No verdict changes (the study fails or is inconclusive either way); do not pool these rows with studies that
charge financing without taking it off first.
