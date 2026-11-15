# Luxus failed high: pre-registration (study 143)

Written and committed on 14 Nov 2026, before `run.mjs` existed and before any number of this study was computed. Paper
research for the owner only: no live rule, size, filter, mirror setting, Mosha desk page, lesson or book line is changed by
this study, whatever it finds. Nothing is written to the Mosha desk or to the teacher.

## Why

The owner chose on 14 Nov 2026 to "Test Luxus's own rules". Luxus teaches the Mosha method on the Mosha desk. His lesson
"10 nov Sell Gold", in his words:

> "Price were going bullish H4 and H1, and after that I noticed that price failed to make a new high and then broke the
> previous low. I entered after bo sell."

His confirmed book lines used here, in his words:

- **BO sell**: a close below a low. **BO buy**: a close above a high.
- **Zone of the break**: from the broken level back to the base of the candle that broke it. The return to it is the entry.

## Dedupe: the closest prior study and exactly what differs

Read before writing this file: the RESULT.md of `mosha-level`, `mosha-retrace`, `mosha-cycle`, `mosha-sweep`,
`mosha-select`, `mosha-oos`, `msnr-direction`, `msnr-entry` (all on main), the `mosha-*` branches (they hold live-system
changes, not studies), no `luxus-*` branch exists, and the untested backlog (`research/proposals/2026-11-14-untested-backlog.md`,
branch `untested-backlog`; it lists no failed-high / lower-high rule).

**Closest prior study: `research/edge/mosha-level`** (FAIL, −0.35R a trade net, n 365, t −3.10, 2020 to Oct 2026; its
example IS the owner's 10 Nov sell, the trade this lesson is about). Its rule: price TAPS a live H4 swing high, then an M5 close
below the last M5 swing low before the tap (external BO), then the NEXT M5 swing low broken, limit there, target the H4 engulf
barrier at least 2R away. What this study holds and mosha-level did not:

1. **H4 and H1 both bullish** (the last BO on each timeframe was a BO buy). mosha-level had no trend condition on either
   timeframe, and took sells and buys at every H4 level regardless of structure.
2. **A failed new high on M5** (a lower M5 swing high under the swing high before it, and no M5 high above that earlier
   high since). mosha-level required a tap of an H4 level, not a lower high.
3. **Entry on the FIRST M5 break** (the close below the previous low) at its own zone of the break; mosha-level's primary
   waited for a second break (its variant F used the first break, still after an H4 tap, no trend condition).
4. **No H4 level tap is required**, and the barrier is the next H4 swing at least 1R away, not an engulf zone at 2R.

Other near studies: `mosha-retrace` (H4 BO, then the FIRST H1 BO the other way, i.e. H1 turns bearish; here H1 must still be
bullish, the trigger is on M5); `mosha-sweep` / `mosha-select` (a swept H1 swing, an M5 VR and CF; here no sweep and no VR);
`mosha-cycle` (the buy at the barrier after a retracement). None holds condition 1 and 2 together. Not a duplicate.

## Data

- Spot gold XAU/USD, OANDA mid M5 from June 2006, fetched through the council's keyless proxy exactly as
  `research/edge/mosha-sweep/run.mjs fetch` does; the cache lives in the scratchpad, never in git.
- H1 and H4 candles are built from the M5 candles in UTC buckets (H4 at 00, 04, 08, 12, 16, 20 UTC). Fills, stops and
  targets are judged on M5 candles (no M1 in this feed): a candle that holds both the stop and the target counts the stop.
- **Windows (orders placed)**: in sample 2020-01-01 to 2023-12-31; out of sample 2024-01-01 to 2026-10-31; replication
  2007-01-01 to 2019-12-31 (reported, not part of the pass bar). 2006 is warm-up only.
- Market set: gold only, fixed here.

## The rule. Test 1 and Test 2 are SELLS; Test 3 is the mirror (BUYS).

Constants: `W4 = 3` (H4 swing size), `W1 = 1` (H1 swing: three candles), `W5 = 1` (M5 swing: three candles),
`PAD = $0.30`, `MIN_R0 = $1.00`, `VALID = 24 h`, `HOLD = 72 h`, `LEVEL_AGE = 30 days`, `MIN_RR_BARRIER = 1`.

1. **Swings.** A swing high of size w is a candle whose high is not below the highs of the w candles before it and is above
   the highs of the w candles after it (swing lows mirrored). It exists from the close of the w-th candle after it.
2. **Trend state on H4 and on H1 (his BO definitions, closed candles only).** On each timeframe: a candle that closes above
   the most recent existing swing high (not yet broken) is a **BO buy** on that timeframe; a close below the most recent
   existing swing low (not yet broken) is a **BO sell**. Each swing is broken once. The state is the side of the LAST BO whose
   candle has closed. "H4 bullish" = the last H4 BO is a BO buy; same for H1.
3. **Failed new high (M5).** At an M5 candle's close, let A be the most recent existing M5 swing high and P the existing M5
   swing high immediately before it. Failed new high = `A.high < P.high` AND no M5 high since P (from the candle after P up
   to and including the current candle) is above `P.high`.
4. **The previous low.** L = the most recent existing M5 swing low whose candle is after P.
5. **BO sell (the signal).** The first M5 candle that closes below L while 3 holds, with H4 and H1 both bullish at that
   close. Each L gives at most one signal.
6. **Zone of the break.** From the broken level L (bottom) up to the base of the break candle. **Assumption (labelled): the
   base of a bearish break candle is its high.**
7. **Order.** Sell limit at L (the return to the zone of the break is the entry), placed at the break candle's close,
   valid 24 h. **Stop (labelled assumption): past the zone of the break = the break candle's high + $0.30.** `r0 = stop −
   entry`; no order when `r0 < $1.00` (as mosha-level; a stop under $1 with a $0.60 cost is not a trade). Every trade has a
   stop on the losing side.
8. **Target.**
   - **Test 1 (primary): the barrier.** Labelled assumption: the next H4 swing low below the entry (size 3, existing, not
     closed through by an H4 candle, at most 30 days old), the nearest one at least 1R below the entry. No such level: no
     order.
   - **Test 2: fixed 2R** on the same signals (the barrier is not required).
9. **Fill and exit.** Filled when an M5 high reaches the limit. If the target trades before the fill, the order is missed.
   After the fill: stop first (a gap through the stop exits at the open), then target, then out at the close of the M5
   candle that reaches 72 h after the fill.
10. **One order or position at a time**, per test.
11. **Test 3: the mirror.** H4 and H1 bearish (last BO on each is a BO sell), a failed new low on M5 (a higher swing low
    above the swing low before it, no low below that earlier low since), the first M5 close above the most recent swing
    high after it (BO buy), buy limit at that broken high, stop the break candle's low − $0.30, target the next H4 swing
    high at least 1R above (barrier).

Everything the rule needs that Luxus's words do not fix (swing sizes, the base of the candle, the stop, the barrier, the
$1 minimum, 24 h / 72 h) is listed above as a choice of mine, made here, before any result.

## Costs

- $0.60 a round trip per unit (brief), charged as `0.60 / r0` R.
- Overnight financing on buys only (Test 3): `nights(fill, close) × FIN.xau.long × entry / r0`, with `nights` and `FIN`
  imported from `council/fills.mjs` (0.000148 of price a rollover, the demo broker's XAUUSD swap of 11 Nov 2026; today's rate
  used for every year). Sells pay and receive nothing.
- Reported gross, net, and net at 2× costs (spread and financing both doubled).

## Statistics and the pass bar

- t on **calendar-month sums** of net R (month of the close), months with no trade count as 0 between the first and last
  month of the window.
- One-sided p (mean > 0) from t (normal approximation); **Holm over the 3 tests** on the out-of-sample net p.
- **PASS** only if Test 1 (primary): out-of-sample net month-sum t ≥ 2 and Holm-adjusted p < 0.05, in-sample net mean > 0
  (same sign), out-of-sample mean > 0 at 2× costs. Otherwise FAIL (or INCONCLUSIVE when out-of-sample n < 30).
- Test 2 and Test 3 are reported with the same figures and their own Holm p; they cannot rescue the primary.
- **Placebo (40 seeds, seeded):** for each test and each seed, the same number of entries in each window at random M5
  closes (uniform over the window's M5 candles), same side, each with the stop distance and target distance (in R) of one
  real trade of that test, market entry at that close, same 72 h hold, same costs. Reported: the share of seeds whose
  out-of-sample net mean is at or above the real one.
- **Control (keeps drift and volatility):** for each test, one market trade on every weekday at the 13:00 UTC M5 close on
  which the test's trend condition holds (H4 and H1 bullish for sells, bearish for buys), same side, stop distance = the
  test's median `r0 / ATR14(M5)` times the ATR14(M5) at that close, target at the test's median R multiple, same hold and
  costs. Reported beside the test, in sample and out of sample.
- Replication 2007-2019: reported for each test (n, mean, month-sum t), not part of the pass bar.

## Deliverables

`research/edge/luxus-failed-high/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}` and
`tests/luxus-failed-high.test.mjs`, on branch `luxus-failed-high`. No pull request.
