# Luxus's VR cycle on gold (study 145): result (14 Nov 2026)

**Verdict: FAIL, 0 of 3: Luxus's VR sell lost −0.194R a trade net out of sample (n 526, month t −3.11) and −0.342R in sample; his buy at the 50% made +0.054R OOS (t 0.43) but −0.191R IS.**

Paper research for the owner only. No live rule, size, filter, stop, config, mirror setting or council file changed, and nothing
was written to the Mosha desk, its lessons, its book or its teacher. The rule, costs, windows, placebo, control and pass bar were
fixed in `PREREGISTRATION.md` (commit 79015bcb, pushed alone before `run.mjs` existed). A backtest is not a forward record, and
this one is not an edge.

## What was tested

Luxus's lessons "10 nov, sell Gold" and "11 Nov buy", in his words and his confirmed book lines (Level, CF, BO, zone of the
break), made mechanical. The labelled assumptions (his VR is the desk's unconfirmed drawing; the stop past the VR extreme; swing
sizes; the impulsion measured on H1; the four times) are listed in the pre-registration.

- **Test 1, the sell ("new cycle M5 bo sell")**: H4 and H1 bullish (last BO a BO buy on each), price reaches a prior H4 / H1 /
  M30 high, the M5 VR forms, its CF (a close below the VR) with H4 and H1 still bullish; sell limit on the return to the broken
  VR low (zone of the break), stop $0.30 past the VR high, target the 50% of the H1 impulsion.
- **Test 2, the buy ("M5 vr bo buy formed, this is retracement for H4 and H1 bullish trend")**: after that CF, price reaches the
  50% within 72 h, an M5 VR forms at the low and its CF up with H4 and H1 still bullish; buy limit on the return to the broken
  VR high, stop $0.30 under the VR low, target the impulsion's high.
- **Test 3**: both as one stream.

Spot gold, OANDA mid M5 1 June 2006 to 13 Nov 2026 (1,459,980 candles; M30 / H1 / H4 built from it), fills on M5 with the
stop first. $0.60 a round trip plus overnight financing on buys (`council/fills.mjs` `nights` x `FIN.xau.long` 0.000148 x
entry / r0). In sample 2020-23 (48 months), out of sample 2024-01 to 2026-10 (34 months), replication 2007-19 (156 months).
t on calendar-month sums (empty months count as 0); Holm over the three tests' out-of-sample p.

## Result (R a trade; t on month sums)

| Test | Window | n | Gross | Net | Net at 2x | Month t (net) | Holm p (OOS) |
|---|---|---|---|---|---|---|---|
| **1 sell** | In sample 2020-23 | 591 | −0.132 | **−0.342** | −0.552 | −5.98 | |
| | Out of sample 2024-26 | 526 | −0.075 | **−0.194** | −0.313 | −3.11 | 1.00 |
| | Replication 2007-19 | 1,821 | −0.064 | −0.347 | −0.629 | −9.91 | |
| **2 buy** | In sample 2020-23 | 276 | +0.005 | **−0.191** | −0.387 | −1.58 | |
| | Out of sample 2024-26 | 227 | +0.165 | **+0.054** | −0.057 | +0.43 | 1.00 |
| | Replication 2007-19 | 940 | −0.066 | −0.324 | −0.581 | −7.16 | |
| **3 both** | In sample 2020-23 | 867 | −0.088 | −0.294 | −0.499 | −6.56 | |
| | Out of sample 2024-26 | 753 | −0.003 | −0.119 | −0.236 | −2.01 | 1.00 |
| | Replication 2007-19 | 2,761 | −0.065 | −0.339 | −0.613 | −12.08 | |

Pass bar (Test 1): out-of-sample net month t >= 2 and Holm p < 0.05, the same sign in sample, positive at 2x costs. **None of the
four lines is met.** The sell loses before costs in all three windows; the buy is about zero before costs on 2020-23, positive
before costs on 2024-26 (the years gold rose most) and loses on 2007-19 and after costs in sample.

- **Exits, 2020-26.** Sell: 702 stops, 412 targets, 3 on time; median stop $4.21, median target 1.56R; 975 sells were "missed"
  over 2006-26 (the 50% traded before the return to the zone). Buy: 294 stops, 205 targets, 4 on time; median stop $5.16, 1.52R.
- **Years.** The sell is negative in 20 of 21 calendar years (2013 +0.06R); the buy is positive in 3 of 21 (2015, 2024,
  2026; 2025 −0.03R).

## Placebo and control (40 seeds each; mean net R a trade, and how many seeds did at least as well as the rule)

| Test | Window | Rule | Placebo mean | Seeds >= rule | Control mean | Seeds >= rule |
|---|---|---|---|---|---|---|
| 1 sell | IS | −0.342 | −0.215 | 40 of 40 | −0.324 | 24 of 40 |
| | OOS | −0.194 | −0.184 | 23 of 40 | −0.255 | 4 of 40 |
| 2 buy | IS | −0.191 | −0.172 | 22 of 40 | −0.089 | 36 of 40 |
| | OOS | +0.054 | −0.051 | 7 of 40 | +0.068 | 23 of 40 |
| 3 both | IS | −0.294 | −0.211 | 38 of 40 | −0.246 | 35 of 40 |
| | OOS | −0.119 | −0.143 | 16 of 40 | −0.178 | 5 of 40 |

Placebo = the same count of market entries at random M5 candles of the same window, same side, the trade's own stop and target
distances and 72 h hold, same costs. Control = a random candle within ±5 days of each fill, distances scaled by the H1 ATR(14)
there (keeps the drift and the volatility). The sell does no better than a random sell in sample; its 2024-26 figure sits inside
the placebo spread. The buy's +0.054R out of sample is what a buy placed at random within five days of it made (+0.068R): gold's
rise, not the VR at the 50%.

## Dedupe statement

Closest prior study: `mosha-sweep` (a swept H1 swing, the M5 VR and CF, entry at the CF or at the zone of the next break, target
the next H4 zone or swing 2R or more away; −0.11R / −0.21R a trade, n 6,260 / 6,478, t −4.62 / −7.36). Also `mosha-select`
(split by the last H4 BO; every cell negative) and `mcycle-base` (the live Mosha cycle: pullback leg −0.756R, n 43). What this
study added, from Luxus's words: H4 AND H1 both bullish, the Level on H4 / H1 / M30, the zone of the break of the VR itself, the
target at the 50% of the H1 impulsion, and the buy at that 50%. Measured overlap: 779 of the 1,117 Test-1 sells of 2020-26
(70 %) share their CF candle with a `mosha-sweep` sell candidate; the entries, stops and targets differ. The different target and
trend condition did not change the answer: the sell loses like `mosha-sweep`'s sells, and the buy is no better than a random buy.

## Luxus's own trades (10 and 11 Nov 2026)

What the detector placed on 9-12 Nov (reported, not tuned for): sell 9 Nov 07:15 at 4102.84 (target, +0.27R gross), sell 9 Nov
16:30 at 4115.77 (stopped, −1R), sell 10 Nov 00:35 at 4125.60 (missed: its 50% target 4124.65 traded first); buy 9 Nov 11:20 at
4101.99 (target, +1.81R), buy 10 Nov 01:05 at 4128.51 (stopped, −1R). His 10 Nov sell (4120.42, stop 4128.92, target 4072.84)
is not among them. The nearest sell the rule found that night (00:35) had its H1-impulsion 50% at 4124.65, a dollar under its
entry, where he aimed $48 lower: the mechanical 50% is not the range he measured.

## What this says

A sixth mechanical reading of the Mosha cycle, this time from the teacher's own words, and the same answer: as fixed rules it is
not an edge on gold. The sell against an H4 + H1 uptrend loses before costs in every window; the buy at the 50% is gold's drift.
What separates his trades from these thousands of look-alikes (which Level, which VR, which range he measures the 50% on) is still
not in a rule. The open measurement remains his own logged trades taken before the outcome (owner decision 27). No proposal.

## Reproduce

```sh
node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>      # OANDA gold M5 from June 2006, ~18 MB, kept out of git
CANDLES=<dir> node research/edge/luxus-vr-cycle/run.mjs run             # writes result.json (about 5 s)
```
Tests: `tests/luxus-vr-cycle.test.mjs`.
