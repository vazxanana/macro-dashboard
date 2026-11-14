# Luxus failed high: result (study 143, 14 Nov 2026)

**Verdict: FAIL, 0 of 3: the failed-high sell lost −0.40R a trade net out of sample (n 897, month-sum t −2.15) and −0.69R in sample; before costs −0.09R, no better than random entries (placebo 45 %).**

Paper research for the owner only. No live rule, size, filter or mirror setting changed, and nothing was written to the
Mosha desk, its lessons, its book or its teacher. The rule, every assumption and the pass bar were fixed in
`PREREGISTRATION.md` (commit b5be78e12, pushed alone) before `run.mjs` existed.

## What was tested

Luxus's lesson "10 nov Sell Gold", his words: "Price were going bullish H4 and H1, and after that I noticed that price
failed to make a new high and then broke the previous low. I entered after bo sell." With his confirmed book lines (BO sell =
a close below a low; BO buy = a close above a high; the zone of the break runs from the broken level back to the base of the
candle that broke it, and the return to it is the entry), written as one mechanical rule:

1. H4 and H1 bullish: the last BO on each timeframe (a close through the most recent unbroken swing; H4 swings 3 a side, H1
   three-candle swings; closed candles only) was a BO buy.
2. On M5: a lower swing high under the swing high before it, and no M5 high above that earlier high since (the failed new high).
3. The first M5 close below the most recent swing low after that earlier high: the BO sell.
4. Sell limit at the broken low, valid 24 h. Stop: the break candle's high + $0.30 (assumption). No order under $1 of risk.
5. Test 1 (primary): target the nearest live H4 swing low at least 1R below (the barrier, assumption). Test 2: fixed 2R.
   Test 3: the mirror (H4 and H1 bearish, failed new low, BO buy, target the next H4 swing high).
6. Out after 72 h; one order or position at a time; $0.60 a round trip; financing on buys by `council/fills.mjs`.

**The rule finds Luxus's trade.** On OANDA M5 it placed a sell limit at 4123.34 on 10 Nov 2026 02:05 UTC, stop 4128.37,
target 4029.83 (the H4 swing low), filled, target reached, +18.5R net. The trade as the owner reported it: sell 4120.42, stop
4128.92. So the test asks what this pattern does when it is taken every time.

## Closest prior study, and what differs

`research/edge/mosha-level` (FAIL, −0.35R net, n 365, t −3.10) was built on the same 10 Nov trade. It required a tap of an H4
swing high and a second M5 break, with no trend condition. This study holds the two conditions from Luxus's words that it did
not: H4 and H1 both bullish, and a failed new high on M5; it enters on the first break and needs no H4 level tap.
`mosha-retrace` required H1 to turn bearish; here H1 must still be bullish. Not a duplicate.

## Results (OANDA spot gold M5; t on calendar-month sums)

| Test | Window | n | Win | Gross R | t gross | Net R | t net | Net at 2× | t 2× |
|---|---|---|---|---|---|---|---|---|---|
| T1 sell, barrier (primary) | 2020-23 (in sample) | 809 | 6.7 % | −0.266 | −2.17 | −0.688 | −5.01 | −1.109 | −7.06 |
| | 2024 to Oct 2026 (out of sample) | 897 | 5.2 % | −0.088 | −0.53 | −0.396 | −2.15 | −0.705 | −3.44 |
| | 2007-19 (replication) | 1,701 | 8.5 % | −0.138 | −1.66 | −0.586 | −6.30 | −1.034 | −9.64 |
| T2 sell, fixed 2R | in sample | 869 | 30.8 % | −0.083 | −1.89 | −0.495 | −9.91 | −0.907 | −12.50 |
| | out of sample | 1,021 | 31.9 % | −0.051 | −1.33 | −0.338 | −7.08 | −0.624 | −9.48 |
| | replication | 1,810 | 30.8 % | −0.080 | −2.62 | −0.517 | −12.16 | −0.954 | −15.53 |
| T3 mirror buy, barrier | in sample | 719 | 8.3 % | +0.054 | +0.32 | −0.391 | −2.11 | −0.836 | −4.03 |
| | out of sample | 658 | 7.8 % | +0.284 | +1.55 | −0.041 | −0.22 | −0.365 | −1.88 |
| | replication | 1,606 | 9.2 % | −0.104 | −1.46 | −0.580 | −7.36 | −1.056 | −11.43 |

Holm over the three out-of-sample net tests (one-sided, mean > 0): p = 1.00 for all three. The pass bar (Test 1 out-of-sample
net t ≥ 2 after Holm, in sample the same sign, positive at 2× costs) fails on every line.

**Placebo** (40 seeds; the same number of market entries at random M5 closes, same side, each with one real trade's stop and R
target, same hold and costs). Share of seeds whose out-of-sample net mean is at or above the real one: T1 45 % (placebo
median −0.424R against −0.396R), T2 17.5 % (−0.368R against −0.338R), T3 62.5 % (+0.018R against −0.041R). The pattern does
no better than a random entry with the same stops and targets.

**Control** (one market trade every weekday at the 13:00 UTC M5 close while the same H4 and H1 condition holds, stop scaled to
M5 ATR at the test's median stop / ATR, target at the test's median R): T1 −0.155R in sample (n 295), −0.619R out of sample
(n 249); T2 −0.458R / −0.381R; T3 −0.371R / −0.930R. The trend condition alone carries no drift these tight stops can collect.

## Why it loses

- **The stop is tiny.** The zone of the break of one M5 candle gives a median stop of $1.37 (2020-23) and $2.04 (2024-26); the
  $0.60 round trip alone is 0.3-0.45R. Before costs the primary is −0.09R out of sample, t −0.53: nothing for the cost to
  come out of.
- **The barrier is far.** With such stops the nearest H4 swing low at least 1R away sits a median 18-30R below, so 95 % of
  the sells are stopped (850 of 897 out of sample) and one in twenty reaches the target.
- **A fixed 2R does not rescue it**: about 31 % reach 2R, below the 33 % a 2R target needs before costs.
- **The mirror buy** is the only stream positive before costs out of sample (+0.28R, t 1.55), negative in the replication
  years and in sample after costs, and below its own placebo median.

## Funnel (T1, every year of the file)

106,029 M5 breaks of a previous swing low → 53,010 after a failed new high → 16,122 with H4 and H1 bullish → 10,671 dropped
with a stop under $1, 45 with the stop on the wrong side → 5,406 signals → 5 with no barrier, 1,754 while another order or
position was open.

## What this does and does not say

- It says: Luxus's sell, taken every time it prints by these fixed rules, loses on gold in every window (2007-19, 2020-23,
  2024-26), and its entries are no better than random ones with the same stops and targets.
- It does not say Luxus's own trading loses. He picks which of the 5,000-odd prints to take (about one a trading day over
  twenty years); that choice is not in these rules. The open step stays his own logged trades (owner decision 27).
- Assumptions that could be corrected by him (each a new pre-registration, not an edit of this one): the swing sizes, the
  base of the break candle (its high), the stop $0.30 past it, the barrier as the next H4 swing, the $1 minimum stop.
- Fills are judged on M5 (stop first when a candle holds both); OANDA mid, no spread beyond the $0.60 round trip.

## Reproduce

```sh
node --use-env-proxy research/edge/mosha-sweep/run.mjs fetch <dir>        # OANDA M5 gold from 2006, kept out of git
CANDLES=<dir> node research/edge/luxus-failed-high/run.mjs run            # writes result.json
```
