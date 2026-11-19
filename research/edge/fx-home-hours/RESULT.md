# A currency weakens in its own home hours: result

Pre-registered in `PREREGISTRATION.md` (pushed alone first, commit 02d5d7e86) and run once on 14 Nov 2026 with
`node research/edge/fx-home-hours/run.mjs run <candleDir>` (candles from `fetch.mjs`, OANDA mid M5 1 Nov 2009 to 30 Oct 2026,
about 1.27 million candles a pair, kept out of git). Paper research only; nothing live changed.

**Verdict: FAIL.** No pair is positive after costs with a month-sum t of 2 in 2016-26 and positive in 2010-15. Before costs
the two European sells lean the way the paper says (EUR/USD +0.062R a trade, month t 1.68 in 2016-26; GBP/USD +0.055R,
t 1.47; both about t 2 before costs in 2010-15), but the move is half a pip on a 9-12 pip stop and the round-trip cost is
0.10-0.13R, so every pair loses after costs in 2016-26. The Tokyo and Sydney legs have no gross effect at all.

## The four tests and the pooled one (net R a trade after costs; t on calendar-month sums)

| Test | Window (UTC) | n 2016-26 | Gross R 2016-26 | Net R 2016-26 | Total net R | Month t | Holm p | Placebo p5 / p50 / p95 | Rule above n of 40 | Net at 2x cost | n 2010-15 | Net R 2010-15 (t) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 EUR/USD sell | 07:00 → 12:00 | 2703 | +0.062 | −0.063 | −169.27 | −1.69 | 1 | −0.14 / −0.1 / −0.051 | 34 | −0.187 | 1494 | +0.02 (0.37) |
| T2 USD/JPY buy | 00:00 → 06:00 | 2701 | +0.001 | −0.079 | −212.24 | −3.46 | 1 | −0.082 / −0.042 / −0.013 | 4 | −0.159 | 1494 | −0.137 (−4.01) |
| T3 GBP/USD sell | 07:00 → 12:00 | 2703 | +0.055 | −0.043 | −116.97 | −1.17 | 1 | −0.116 / −0.072 / −0.033 | 35 | −0.141 | 1494 | −0.006 (−0.11) |
| T4 AUD/USD sell | 22:00 → 05:00 | 2675 | −0.03 | −0.118 | −315.09 | −4.29 | 1 | −0.136 / −0.085 / −0.03 | 6 | −0.205 | 1487 | +0.035 (0.83) |
| T5 pooled, equal weight | | 4 pairs | +0.022 | −0.076 | | −4.31 | (not in Holm) | −0.096 / −0.075 / −0.055 | 19 | −0.173 | | −0.022 (−0.97) |

Conditions met (of six): T1 2 (n, replication > 0), T2 1 (n), T3 1 (n), T4 2 (n, replication > 0); T5 none.

The placebo (the same pair, side and length at a random other whole UTC hour, one draw a day, 40 seeds, same costs) loses
too, so the costs alone put every clock trade of this shape near −0.05R to −0.10R. The European sells rank above most
placebo hours (34 and 35 of 40, under the bar of 38): the morning sell of EUR and GBP is a little better than a random hour,
not enough to pay for itself. USD/JPY's Tokyo buy and AUD/USD's Sydney sell rank below almost every other hour.

## Costs and the size of the move (2016-26)

| Pair | Mean move in favour | Median stop (1x H1 ATR) | Cost a trade | Stopped / time exit |
|---|---|---|---|---|
| EUR/USD | +0.54 pip | 9.25 pip | 0.125R | 1824 / 874 (5 gaps) |
| USD/JPY | −0.33 pip | 16.04 pip | 0.08R | 1384 / 1316 (1 gap) |
| GBP/USD | +0.37 pip | 12.37 pip | 0.098R | 1878 / 821 (4 gaps) |
| AUD/USD | −0.42 pip | 11.82 pip | 0.087R (financing 0.006R) | 1406 / 1250 (19 gaps) |

## Reported, not tested

- **AUD/USD by US daylight time** (2016-26): summer (no rollover held) n 1811, gross +0.001R, net −0.082R, t −2.51; winter
  (entry on the 22:00 UTC rollover candle) n 864, gross −0.097R, net −0.193R, t −3.91. The winter entry sits in the 17:00 New
  York rollover candle, where OANDA's mid is noisy; the 0.3 pip raw spread is too small for that minute, so winter is if
  anything flattered.
- **By year** (net R a trade): EUR/USD positive in 7 of 17 years (best 2015 +0.157), negative in every year 2018-20;
  USD/JPY positive in 3 of 17 (largest +0.089, 2022); GBP/USD positive in 6 of 17; AUD/USD positive 2010-13, negative every
  year since 2014. The full table is in `result.json` (`tests.<T>.years`).
- **Gross, the replication window**: EUR/USD +0.111R (month t 2.04), GBP/USD +0.092R (1.86), AUD/USD +0.133R (3.11), USD/JPY
  −0.052R. So in 2010-15 three of the four currencies did weaken in their home hours before costs, as the paper (whose sample
  ends earlier) reports; in 2016-26 only the European two did, by half as much, and the Sydney leg turned. A gross effect that
  shrinks after publication and never covers 0.1R of cost is not a trade.

## What was decided outside the brief (all in the pre-registration before the run)

- One fixed UTC clock all year (the paper's GMT sessions), no daylight-saving shift of the windows.
- Holidays: only the dates of `council/datacheck.mjs` `usHolidays` (New Year, MLK, Presidents', Good Friday, Memorial,
  Juneteenth, Independence Day, Labor Day, Thanksgiving and the day after, Christmas Eve, Christmas). UK and Japanese bank
  holidays are not skipped (no function in the repository gives them).
- ATR = the plain mean of 14 H1 true ranges from H1 candles built from M5; 15 hours needed.
- A day is "no data" when its entry candle is missing or no candle opens in the window's last 30 minutes (3, 5, 3 and 38 days).
- Financing only across the 17:00 New York rollover (entry at that instant counts as held), Wednesday three, from the copied
  policy rates (`rates.json`, from `fx-carry`'s hand-written approximate table), credits never booked. So only the AUD winter
  trades pay it: the brief's "charge one night" holds in winter and not in summer, where the 21:00 UTC rollover comes before the
  22:00 entry.
- Candle files: EUR/USD and USD/JPY were taken whole from another study's copy of the same proxy (`ecbboj`), GBP/USD and AUD/USD
  from 2015-11 on from `fx-london-orb`'s copy, the rest fetched now (`fetch.mjs` seeds).

## What happens next

Nothing: no proposal, no paper shadow. Do not re-run this with other hours, wider stops or one pair picked from the table
above; a 0.5-pip effect cannot pay a raw-spread round trip. Tests: `tests/fx-home-hours.test.mjs`.
