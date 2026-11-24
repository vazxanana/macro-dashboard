# vb-adaptive-k: k set by yesterday's range against its 20-day median (result, 24 Nov 2026)

**Verdict: FAIL, 0 of 3. Adaptive k minus fixed k 0.5, pooled gold + USD/JPY: +0.037R a day in 2005-14 (month t 2.99) and +0.015R a day in 2015 → 20 Nov 2026 (month t 1.52, Holm p 0.132); gold +0.005R a day (t 0.38, under its placebo's 95th percentile), USD/JPY +0.025R a day (t 1.86, Holm p 0.098). The rule stays k 0.5.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first). Nothing live changed, nothing is
proposed. Not an edge, and no setting is adopted.

## What was run

T1 unchanged (`index-vol-breakout/original.mjs`: buy / sell stop at the UTC open ± k × the previous folded day's range, stop
at the open, out at 21:00 UTC), on OANDA mid M5 from the shared cache. One mapping, fixed before the run: ratio = previous day's
range / median of the last 20 folded days' ranges; under 0.7 → k 0.3, over 1.3 → k 0.7, else 0.5. Paired against fixed k 0.5
on the same days (a day without 20 earlier ranges is out of both). Costs after: gold = `gold-vol-breakout-hourcost` C1 (measured
hourly spread + commission + 0.05 × M slippage) and long financing; USD/JPY = `fx-vol-breakout` (0.000045 × price + 0.5 pip).

**Gate:** fixed k 0.5 from this cache reproduces both published figures exactly: USD/JPY 2005-15 n 2089, +0.079R; gold 2007 →
12 Nov 2026 under C1 n 3713, +0.139R.

## Tests (paired daily difference, adaptive − fixed, summed by month)

| Test | 2005-14 mean d / month t | 2015 → mean d / month t | One-sided p / Holm | Placebo p95 (median) | Adaptive net R a trade 05-14 / 15 → (n) | Pass |
|---|---|---|---|---|---|---|
| A1 gold | +0.043 / +2.34 | +0.005 / +0.38 | 0.353 / 0.353 | +0.015 (+0.002) | +0.272 (1483) / +0.113 (2064) | no (t, placebo) |
| A2 USD/JPY | +0.032 / +2.24 | +0.025 / +1.86 | 0.033 / 0.098 | +0.018 (+0.001) | +0.141 (1773) / +0.095 (2111) | no (t) |
| A3 pooled | +0.037 / +2.99 | +0.015 / +1.52 | 0.066 / 0.132 | +0.010 (+0.000) | +0.201 (3256) / +0.104 (4175) | no (t) |

The placebo shuffles the days' k labels within each market (40 seeds, same shares of 0.3 / 0.5 / 0.7). The adaptive k is ahead
in both windows on every test and beats its placebo except on gold after 2014, but the confirmation is short of month t 2 after
Holm everywhere. Discovery looked good (t 2.2-3.0); the lead roughly halved after 2014 (gold almost entirely).

## Each arm (net R a trade after costs, month t; net at 2x costs)

| Market | Window | Fixed k 0.5 n / gross / net (2x) / t | Adaptive n / gross / net (2x) / t |
|---|---|---|---|
| gold | 2006-14 | 1583 / +0.210 / +0.195 (+0.180) / +5.54 | 1483 / +0.290 / +0.272 (+0.253) / +5.79 |
| gold | 2015 → | 2235 / +0.113 / +0.097 (+0.081) / +3.77 | 2064 / +0.134 / +0.113 (+0.093) / +3.50 |
| USD/JPY | 2005-14 | 1881 / +0.118 / +0.089 (+0.060) / +3.21 | 1773 / +0.179 / +0.141 (+0.104) / +3.92 |
| USD/JPY | 2015 → | 2275 / +0.087 / +0.055 (+0.023) / +2.22 | 2111 / +0.138 / +0.095 (+0.053) / +2.94 |

Day shares: narrow (k 0.3) about 18 %, normal 57 %, wide (k 0.7) 24-25 %, in every market and window.

## The three buckets at fixed k 0.5 (descriptive, not tested)

| Market | Window | Narrow n / net / t | Normal n / net / t | Wide n / net / t |
|---|---|---|---|---|
| gold | 2006-14 | 371 / +0.508 / +4.41 | 981 / +0.128 / +3.41 | 231 / −0.024 / −0.56 |
| gold | 2015 → | 520 / +0.214 / +2.65 | 1362 / +0.067 / +2.21 | 353 / +0.040 / +1.08 |
| USD/JPY | 2005-14 | 429 / +0.340 / +4.08 | 1167 / +0.024 / +0.74 | 285 / −0.019 / −0.51 |
| USD/JPY | 2015 → | 527 / +0.152 / +1.84 | 1367 / +0.022 / +0.73 | 381 / +0.039 / +0.91 |

At the fixed k, the R a trade after a narrow day is two to four times that of a normal day in both markets and both windows,
and wide days are near zero. Read with care: after a narrow day the stop (k × a small range) is small against the day's move,
so the R a trade is larger by construction of the unit; this table was not a test, and the per-day R it carries is in sample
for the rule. It says where the rule's R comes from, not a filter to adopt ("trade only after a narrow day" would need its own
pre-registration on data none of these studies has read, and little is left).

## Caveats

- The mapping, the 20-day median and the 0.7 / 1.3 cuts were fixed once and not varied; other cuts were not looked at.
- Both markets' 2015 → windows overlap the years the rule was found and swept on (in sample for T1, not for this mapping).
- Gold costs charge today's measured relative spread on every year; USD/JPY costs are the pre-set allowance, not ticks.
- Data: OANDA mid M5 through 20 Nov 2026 (last complete day in the cache).
