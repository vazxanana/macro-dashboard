# Gold held to an ATR barrier against gold held for a fixed time: result (14 Nov 2026)

**Verdict: FAIL. The pre-registered bar reads 2 of 3, but gold paths shuffled day by day give the same +0.11 a day: an artifact of the statistic; per day held the barrier earns less.**

Pre-registration: `PREREGISTRATION.md` (pushed alone first). Code: `run.mjs`; figures: `result.json`. Paper research only: a
stand-alone question about how a gold trade is held, on gold's own daily path. It uses no trade or position of the live gold book,
is not a gate, exit, entry or size of it and proposes nothing; nothing live changed.

Data: OANDA XAU/USD mid daily candles, council-data `research/daily/xau.json`, 20 Mar 2006 to 13 Nov 2026, weekends folded into
Monday. Every weekday is an entry at the next open. Units: ATR(14) of the signal day ("ATR units"). Costs: $0.60 a round trip and,
on buys, `nights` x `FIN.xau.long` x entry (today's rate for every year). In sample = entries 2007-2016, out of sample = 2017 to
October 2026.

## The pre-registered tests

d = per entry, net ATR units per day held of the barrier hold minus the same of the 10-day time hold (2 ATR stop). t on
calendar-month sums of d (IS 120 months, OOS 118 months), one-sided, Holm over the three tests.

| Test | Arm | n IS / OOS | d IS net (gross) | t IS net (gross) | d OOS net (gross) | t OOS net (gross) | d OOS 2x costs | Holm p OOS | placebo above | Bar |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 buy | ±2 ATR, 20 days | 2602 / 2552 | +0.0952 (+0.0967) | +11.02 (+11.01) | +0.1055 (+0.1068) | +10.65 (+10.65) | +0.1042 | 0.000 | 40 of 40 | met |
| T2 buy | −1 / +3 ATR, 20 days | 2602 / 2552 | −0.0796 (−0.0740) | −7.70 (−7.23) | −0.0708 (−0.0665) | −5.70 (−5.39) | −0.0751 | 1.000 | 0 of 40 | not met |
| T3 sell | ±2 ATR, 20 days | 2602 / 2552 | +0.1067 (+0.1083) | +12.57 (+12.56) | +0.0882 (+0.0891) | +9.22 (+9.23) | +0.0874 | 0.000 | 40 of 40 | met |

Read mechanically, T1 passes every pre-registered line. It is not an edge, for the reason below.

## Why the pass is an artifact (post hoc, added after the first run)

The pre-registration argued that under a random walk with drift both holds earn the same per day held. That is true of the
exposure-weighted rate (total net over total days held), not of the **mean of per-trade daily rates** the tests used. The time
hold has a stop and no target: a trade stopped on day 1 or 2 counts as −1 ATR a day or worse, while its winners are spread over
10 days; the symmetric barrier hold has winners as fast as its losers. So d is positive on any path, whatever gold does. Two
checks, neither in the pre-registration:

1. **Shuffled paths.** 40 seeded re-orderings of each window's days (each day kept as open / high / low / close relative to the
   previous close: same drift, volatility and day shapes, no order between days). T1 OOS: shuffled d from +0.1033 to +0.1316
   (mean +0.1198); the real +0.1055 is above only **2 of 40**. IS: shuffled +0.1031 to +0.1239, the real +0.0952 above **0 of 40**.
   T3 OOS: real +0.0882 against shuffled +0.1068 to +0.1278 (above 0). T2 OOS: real −0.0708 against shuffled −0.0589 to −0.0297
   (above 0). Every value of the table is what the statistic gives on paths with no memory; gold's real order makes it, if
   anything, slightly lower.
2. **Per day held, the honest unit.** Net ATR units per day held, barrier against time:

| Test | IS barrier | IS time | IS difference (shuffled range) | OOS barrier | OOS time | OOS difference (shuffled range) |
|---|---|---|---|---|---|---|
| T1 buy ±2 | +0.0005 | +0.0035 | −0.0030 (−0.0118 to +0.0126; real above 12 of 40) | +0.0167 | +0.0248 | −0.0081 (−0.0207 to +0.0092; above 13 of 40) |
| T2 buy −1/+3 | +0.0062 | +0.0035 | +0.0027 (−0.0131 to +0.0122; above 32 of 40) | +0.0189 | +0.0248 | −0.0059 (−0.0157 to +0.0078; above 11 of 40) |
| T3 sell ±2 | −0.0211 | −0.0227 | +0.0016 (−0.0102 to +0.0141; above 21 of 40) | −0.0387 | −0.0392 | +0.0006 (−0.0172 to +0.0079; above 25 of 40) |

Per trade (net ATR units, days held), OOS: T1 barrier +0.161 over 9.61 days, time +0.217 over 8.75 days; IS +0.005 over 9.20 and
+0.030 over 8.53. Gross OOS +0.340 and +0.390.

So: the barrier hold does not earn more per day in the market than the time hold, on buys or sells, in either window; every
difference sits inside the range of paths with no order between days. The ±2 ATR target cuts gold's long winners a little (OOS
−0.008 a day, within noise); the −1 / +3 asymmetric barrier is no better. Gold's daily path shows no reversal after a two-ATR move
that a barrier exit could bank, and no trend persistence strong enough to tell apart from a shuffle.

## What this does not say

- Nothing about entries: every weekday is entered; the long arms' positive totals are gold's 2007-26 rise (drift), not a rule.
- The pre-registered statistic was flawed; the bar as written would have read PASS. It is reported here as written, with the
  reason it is set aside, so that the flaw is visible. A future hold study should state its null on the exposure-weighted rate
  and include the day-shuffle control in its pre-registration.
- Today's financing rate is charged for every year; exits by a touch are charged that day's rollover (conservative, both arms).

Nothing live changed. Not a proposal.
