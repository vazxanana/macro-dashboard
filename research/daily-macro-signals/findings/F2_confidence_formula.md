# F2 — The confidence number is mechanically distorted and never calibrated

**Status:** CONFIRMED — verified directly from source code.
**Evidence type:** primary (`computeDailyBias()` in `gold-trading.html`)
**Confidence:** high for the mechanics; the calibration argument is standard forecasting practice.

---

## The formula as implemented

```js
st.wTot = checks.reduce((a, c) => a + c.w, 0);                       // ALL drivers
st.net  = checks.reduce((a, c) => a + (c.dir === 'long' ?  c.w
                                     : c.dir === 'short' ? -c.w : 0), 0);  // voting drivers only
st.dir  = st.net >= 3 ? 'long' : st.net <= -3 ? 'short' : 'wait';
st.conf = Math.round(50 + Math.abs(st.net) / st.wTot * 50);
```

Verified against live test output: `net +5 of ±20` → `50 + 5/20*50 = 62.5` → **63%**. ✓

## Defect 1 — permanent drag from a driver that can never vote

`Yen carry-unwind risk` is passed `dir: null` unconditionally, by design (it is a volatility
warning, correctly not forced into a direction). But it is passed `w: 1`, so it **adds 1 to
`wTot` and 0 to `net`, on every single day, forever**. It silently subtracts roughly 2.5
percentage points from every confidence reading while contributing nothing to the numerator.

A driver that is structurally incapable of voting should not sit in the denominator of a
vote-share statistic.

## Defect 2 — "no data" is treated identically to "data says neutral"

Any driver whose feed fails returns `dir: null` and still contributes its weight to `wTot`.
So a FRED outage doesn't just remove a signal — it actively *reduces stated confidence* in the
signals that did arrive. Those are different epistemic situations:

- *No data* → we know less; the remaining evidence is unchanged in quality.
- *Data present, reads neutral* → genuine evidence of no directional pressure.

Collapsing them into the same arithmetic makes confidence partly a function of feed uptime.

## Defect 3 — the direction threshold is absolute, not proportional

`st.dir` flips long/short at `net = ±3` regardless of `wTot`. Consequences:

| Scenario | net | wTot | net/wTot | Verdict |
|---|---|---|---|---|
| All feeds healthy | 3 | 22 | 14% | LONG |
| Half the feeds down | 3 | 10 | 30% | LONG |

The same absolute score means very different things about the strength of evidence. The
threshold should scale with available weight (e.g. `net/wTot ≥ 0.15`), otherwise degraded-feed
days produce directional calls on proportionally much thinner evidence.

## Defect 4 — confidence has a floor of 50% and is never validated

`conf` maps `|net|/wTot ∈ [0,1]` onto `[50%, 100%]`. It cannot go below 50, so the scale has
no way to express "the drivers actively contradict each other" — that state renders as 50%,
which reads to a user as *coin flip* when it actually means *no net signal*.

More importantly: **nothing in the system ever checks whether 63% confidence corresponds to a
63% realized hit rate.** The Bias Scorecard tracks an overall hit rate and per-driver hit
rates, but never buckets outcomes *by stated confidence*. A confidence number that is never
compared against realized frequency is a presentation artifact, not a probability.

## Compounding interaction with F1

Defects 1–4 are arithmetic. The deeper problem is that they sit on top of the collinearity
documented in **F1**: because ~45–50% of directional weight traces to the real-rate complex,
`|net|` swings hard when one underlying series moves. The confidence number therefore *rises*
precisely when a single variable dominates — the opposite of what a confidence measure should
do.

## Suggested corrections (ranked by effort:impact)

1. **Exclude structurally-null drivers from `wTot`.** One-line change; removes a permanent bias.
2. **Separate `wAvailable` (feeds that returned data) from `wTot`.** Compute vote share against
   available weight; report data coverage separately.
3. **Make the direction threshold proportional** (`net/wAvailable`), not absolute.
4. **Add a calibration panel to the Scorecard**: bucket historical days by stated confidence
   (50–60, 60–70, 70–80, 80%+) and plot realized hit rate per bucket. This is the only way to
   know whether the number means anything. Until it exists, present confidence as a relative
   *score*, not a percentage — a percentage implies a frequency claim the system has never tested.
