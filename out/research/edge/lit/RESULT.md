8 Nov: the owner keeps LIT as a paper shadow stream (council/lit.mjs, k 'lit') to build a forward record; this study's verdict stands.

# LIT (Liquidity Inducement Theory) on gold and NAS100, 2008-2026 (8 Nov 2026)

**Verdict: INCONCLUSIVE — under the skill's own defaults the rule produces too few trades to judge (XAUUSD 27 and NAS100 35 fills in 19 years, one order in five fills), and everything that can be measured is negative: the thicker uncapped set loses 0.70R a trade on gold 2018-26 (n 39, t −2.7) and 0.25R on NAS100 (n 42), no set beats random entry with the same stops and targets, and none survives doubled costs. Not a candidate for a paper shadow stream.**

Pre-registered in [preregistration.md](preregistration.md) (#596, merged before this ran). The skill text under test is
[SKILL-v2.md](SKILL-v2.md). Harness `run.mjs`; this report's tables come from `report.mjs` over `result.json`. Paper research only;
nothing live changes.

## What was tested

The skill's §7 "cleanest subset", with §8's "(our default)" values and nothing tuned: an **M15 manipulation (FBOS)** of an external level
(completed session high/low, previous-day, previous-week, the accumulation's own extreme, equal highs/lows) — sweep by >= 1 tick, close
back inside within 3 bars, no two closes beyond, a vector within ±2 bars, level in the premium/discount half of the weekly range, >= 8 M15
bars of accumulation (range <= 3 ATR) before it — then an **M5 RBOS** (the last confirmed swing before MX broken by wick or close, fast or
with a vector, not a grind, not flipped back), a **limit at the IDM order block** (the last opposite candle before the displacement; entry
at its open or its 50%), **stop beyond MX** plus spread and buffer (gold $0.30 + max(0.1 ATR, $0.30); NQ 1 pt; skip above 0.08% of
price), **target the accumulation's far extreme** (skip at R:R <= 3), expiry after 24 M5 bars / on a break of MX / target first,
break-even after two post-entry swing breaks, closed at the day's end, <= 1 London + 1 NY trade a day, stop after a win or −1.5R, no
09:30 candle. Sessions LONDON [02:00, 05:00) and NY_AM [08:00, 12:00) New York, both directions, XAUUSD and NAS100, OANDA 5m 2007-2026
(no refetch). Costs: gold $0.30 spread + $0.15 slippage on market exits (council/fills.mjs); NQ 0.02% + 0.25 pt; x2 reported. Control:
1,000 draws of random entries in the same year, session and direction with the same stop (% of price), target (R:R), management and
costs. Deviation stated in advance: the cache has no volume, so vectors are body-only (body >= 1.5x the mean body of the preceding 10 bars).

Bar (per market, primary variant RBOS wick + entry at the OB open, net x1): both windows 2008-17 and 2018-26 with expectancy > 0 and
t >= 2, both halves positive, margin over random with a 95% CI excluding 0, positive at x2 costs; a window with < 30 trades = too few.

## Key table — primary variant (wick, OB open), net x1

| market | window | n | win | avg R gross | exp net x1 | t | total R | exp x2 | max DD | streak | trades/yr | margin vs random [95% CI] | bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| XAUUSD | 2008-17 | 7 | 43% | 1.52 | +0.99 | 0.66 | +6.9 | +0.46 | −3.9 | 4 | 1.4 | +1.56 [−1.72, +5.08] | too few |
| XAUUSD | 2018-26 | 20 | 20% | −0.04 | −0.40 | −0.82 | −8.1 | −0.76 | −9.4 | 7 | 2.5 | −0.08 [−1.60, +1.27] | too few |
| XAUUSD, uncapped (S1) | 2008-17 | 19 | 32% | 0.79 | +0.42 | 0.61 | +8.0 | +0.06 | −7.9 | 8 | 2.4 | +0.77 [−0.77, +2.40] | too few |
| XAUUSD, uncapped (S1) | 2018-26 | 39 | 13% | −0.43 | **−0.70** | **−2.66** | −27.1 | −0.96 | −27.1 | 11 | 4.3 | −0.44 [−1.26, +0.36] | **FAIL** |
| NAS100 | 2008-17 | 10 | 10% | −0.40 | −1.03 | −1.77 | −10.3 | −1.65 | −10.3 | 6 | 1.7 | −0.39 [−2.21, +1.33] | too few |
| NAS100 | 2018-26 | 24 | 17% | 0.29 | −0.11 | −0.18 | −2.6 | −0.51 | −13.9 | 10 | 3.4 | +0.27 [−1.26, +1.82] | too few |
| NAS100, uncapped (S1) | 2008-17 | 26 | 12% | −0.13 | −0.56 | −1.05 | −14.4 | −0.98 | −21.2 | 14 | 3.3 | −0.15 [−1.36, +1.21] | too few |
| NAS100, uncapped (S1) | 2018-26 | 42 | 17% | 0.05 | −0.25 | −0.65 | −10.6 | −0.56 | −23.6 | 18 | 4.7 | +0.04 [−1.05, +1.07] | **FAIL** |

Halves (net x1, n / exp): XAUUSD primary 2008-12 3 / +3.63, 2013-17 4 / −0.99, 2018-21 6 / −0.77, 2022-26 14 / −0.25; uncapped 14 / +0.95,
5 / −1.05, 15 / −0.83, 24 / −0.61. NAS100 primary 4 / −1.56, 6 / −0.67, 8 / +0.10, 16 / −0.21; uncapped 14 / −1.05, 12 / +0.02, 16 / −0.01,
26 / −0.40. Every positive cell has n <= 14 and rests on one or two target hits (the gold 2008-17 total is one +9.1R trade in Nov 2010).

### All sets (A = 2008-17, B = 2018-26, net x1)

| market | set | variant | cap | A n | A exp | A t | A margin [CI] | B n | B exp | B t | B margin [CI] | B x2 | bar |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| xau | std | wick-open (primary) | 0.08% | 7 | 0.99 | 0.66 | 1.56 [-1.72, 5.08] | 20 | -0.40 | -0.82 | -0.08 [-1.60, 1.27] | -0.76 | INCONCLUSIVE |
| xau | std | wick-open | none (S1) | 19 | 0.42 | 0.61 | 0.77 [-0.77, 2.40] | 39 | -0.69 | -2.66 | -0.44 [-1.26, 0.36] | -0.96 | FAIL |
| xau | std | close-open | 0.08% | 5 | 1.77 | 0.86 | 2.30 [-2.01, 6.82] | 17 | -0.05 | -0.08 | 0.28 [-1.38, 1.89] | -0.43 | INCONCLUSIVE |
| xau | std | close-open | none (S1) | 18 | 0.66 | 0.91 | 0.94 [-0.68, 2.76] | 37 | -0.54 | -1.75 | -0.27 [-1.17, 0.61] | -0.81 | FAIL |
| xau | std | wick-mid | 0.08% | 11 | 0.56 | 0.51 | 1.06 [-1.17, 3.42] | 27 | -0.37 | -0.92 | -0.06 [-1.25, 1.09] | -0.72 | INCONCLUSIVE |
| xau | std | wick-mid | none (S1) | 30 | 0.03 | 0.05 | 0.38 [-0.75, 1.58] | 51 | -0.40 | -1.47 | -0.13 [-0.90, 0.59] | -0.67 | FAIL |
| xau | std | close-mid | 0.08% | 8 | 1.20 | 0.82 | 1.66 [-1.21, 4.68] | 25 | -0.33 | -0.79 | 0.01 [-1.17, 1.23] | -0.68 | INCONCLUSIVE |
| xau | std | close-mid | none (S1) | 33 | 0.14 | 0.31 | 0.46 [-0.58, 1.58] | 49 | -0.41 | -1.47 | -0.15 [-0.91, 0.65] | -0.68 | FAIL |
| xau | div (S2) | all four | either | 0 | — | — | — | 0-1 | −1.3 | — | — | — | INCONCLUSIVE (too few) |
| nas100 | std | wick-open (primary) | 0.08% | 10 | -1.03 | -1.77 | -0.39 [-2.21, 1.33] | 24 | -0.11 | -0.18 | 0.27 [-1.26, 1.82] | -0.51 | INCONCLUSIVE |
| nas100 | std | wick-open | none (S1) | 26 | -0.56 | -1.05 | -0.15 [-1.36, 1.21] | 42 | -0.25 | -0.65 | 0.04 [-1.05, 1.07] | -0.56 | FAIL |
| nas100 | std | close-open | 0.08% | 10 | -1.63 | -27.81 | -1.02 [-2.50, 0.02] | 23 | 0.31 | 0.43 | 0.74 [-0.98, 2.60] | -0.10 | INCONCLUSIVE |
| nas100 | std | close-open | none (S1) | 23 | -0.73 | -1.32 | -0.33 [-1.60, 1.10] | 40 | 0.01 | 0.02 | 0.34 [-0.80, 1.53] | -0.30 | FAIL |
| nas100 | std | wick-mid | 0.08% | 16 | -1.02 | -2.59 | -0.42 [-1.78, 0.80] | 38 | -0.54 | -1.23 | -0.05 [-1.26, 1.11] | -1.04 | FAIL |
| nas100 | std | wick-mid | none (S1) | 35 | -0.36 | -0.79 | 0.06 [-0.95, 1.25] | 55 | -0.20 | -0.55 | 0.18 [-0.81, 1.20] | -0.60 | FAIL |
| nas100 | std | close-mid | 0.08% | 16 | -1.35 | -5.49 | -0.77 [-1.95, 0.28] | 35 | -0.22 | -0.42 | 0.29 [-0.98, 1.61] | -0.72 | FAIL |
| nas100 | std | close-mid | none (S1) | 33 | -0.46 | -0.97 | -0.05 [-1.17, 1.15] | 50 | 0.08 | 0.19 | 0.48 [-0.59, 1.57] | -0.32 | FAIL |

Of the 14 set-windows with n >= 30, 10 expectancies are negative and the 4 positive ones are +0.01 to +0.14R with t <= 0.3; none is
positive at x2 costs. No margin over random excludes 0 on the positive side (the one CI that excludes 0 is negative: gold uncapped NY_AM 2018-26, −0.84 [−1.79, −0.07]).

## Reading

1. **The rule barely trades.** The funnel for gold (both directions, 2007-26): 92,259 level sweeps → 25,546 in London / NY AM → 20,994
   with an accumulation → 13,468 in the premium/discount half → **7,418 FBOS** (rejection + vector). Of those, **3,883 (52%) are voided
   because price goes back above MX** before any RBOS (the "manipulation" was not terminal), 1,041 flip back after the break, 525 are slow,
   425 grind, 848 fail R:R > 3, 177 exceed the 0.08% stop cap → **124 orders in 19 years**. Then **71 of 124 orders are cancelled because
   the target is reached before price returns to the order block** and 16 expire: **29 fills**. NAS100 is the same shape (6,136 FBOS → 239
   orders → 36 fills; 176 cancelled target-first). The limit-at-the-POI model mostly watches the move it predicted leave without it, which
   is what kev says of NQ in NY ("often doesn't return").
2. **What fills, loses.** The taken trades are stopped 16 of 27 times on gold and 19 of 35 on NAS100 and have a median hold of **2-3 M5
   bars**: the pre-registered stop (MX + spread + buffer; median risk 0.05-0.07% of price) sits inside normal 5-minute noise. Win rates of
   13-20% with a median planned R:R of 4.5-4.8 need about 20% winners to break even gross; after costs the sets lose. The few winners are
   real (gold +9.4R Nov 2010, +6.6R Dec 2022; NQ +10.4R Dec 2025) but they are 3-5 trades a decade.
3. **No window, half, session or direction is reliably positive.** Gold's 2008-17 primary (+0.99R, n 7) is one trade. 2018-26 is negative
   on both markets in every variant on the capped set and significantly negative on the gold uncapped set (t −2.66, 11 losses in a row;
   NY AM −1.08R a trade, n 24, worse than random with a CI that excludes 0). NAS100 2008-17 lost in every variant. Longs and shorts,
   London and NY AM swap signs between windows with no pattern that survives n.
4. **S1 (uncapped)** adds trades and makes the picture clearer, not better: the cap was not what held the rule back.
5. **S2 (XAG/XAU divergence)**: 1,747 silver FBOS with a comparable gold level, gold "held" in 119 of them, 66 passed the correlation and
   accumulation tests, 2-6 orders in 19 years, 0-1 fills. Untestable; the one fill lost.
6. **Multiplicity**: 4 pre-named variants x 2 cap modes x 2 markets + the thin S2 set. The primary was judged first; no variant passes or
   comes close; nothing was tuned after the run.

## What it means for the owner

The LIT skill's own warning holds: its gold rules were untested inference, and the cleanest mechanical reading of the Arctic model, taken
at the skill's defaults with no tuning, is **not an edge on OANDA gold or NAS100 5-minute data** in either the untouched 2008-17 history or
the recent 2018-26 years. It is not a candidate for a paper shadow stream. The failure is structural, not a parameter: the setups that
qualify are mostly re-swept (the manipulation does not end where the rule says), and when the RBOS comes the price does not retrace to
the order block before reaching the target. A discretionary trader reading context the rule cannot (news, HTF SMTs, "ugly" structure)
may do differently; the data cannot say. A different test (market entry on the RBOS close instead of a limit at the OB, wider stops at the
accumulation extreme, the FVG exclusion) would be a new pre-registration, and this result gives no reason to expect it to pass. Like every
edge study on this desk since #508, the prior stands: what works here is regime-bound and thin; LIT at its defaults is thin and not working.

## Files

- `preregistration.md` — the rule, windows, costs, control and bar, fixed before the run (#596).
- `SKILL-v2.md` — the owner's LIT skill v2 (sha256 `68482ea5…40f2d`).
- `run.mjs` — the harness (`node research/edge/lit/run.mjs <oanda5m cache> research/edge/lit/result.json`, ~50 s; trades of every set
  to `<cache>/lit-trades.json`, not in git). `report.mjs` renders the per-set tables.
- `result.json` — funnel, build counts, every set's windows / halves / sessions / directions / years / levels / exits, control margins
  with CIs, the per-set bar, and the 27 + 35 primary trades.
