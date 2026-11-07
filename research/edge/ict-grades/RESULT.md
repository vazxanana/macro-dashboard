# ICT grades: do the untraded B and C setups carry an edge, and does the grade order hold?

**Verdict: H1 FAILS, H2 DOES NOT HOLD, H3 HURTS (all pre-registered bars).** The B-setups the desk logs but does not trade
lose money on both windows: **−0.087R a trade net in 2008-17 (n 3,935, t −3.93)** and **−0.016R in 2018-26 (n 3,526, t −0.67)**,
negative at x2 costs in both, and positive in 0 of 4 markets (2008-17) and 1 of 4 (2018-26). The grade order A > B > C does not
hold: C-setups beat B-setups in both windows (2008-17: A −0.013 > C −0.061 > B −0.087; 2018-26: A +0.093 > C −0.011 > B −0.016),
and the candle grade total itself is not monotone with return. Adding B-setups at half size to the desk **hurts in both
windows**: 2018-26 goes from +165.3R / 31.3R max drawdown (R/DD 5.3) to +135.3R / 48.8R (R/DD 2.8), and 2008-17 from −28.9R to
−182.5R with the drawdown up from 82.8R to 189.5R. What separates the desk's winners from its losers is the A-setup filter
(side vs daily bias, stop band), not the grade: the highest-graded signals that fail that filter are the worst of all
(−0.139R, t −4.11 in 2008-17; −0.072R, t −1.94 in 2018-26). The null result is the expected one. **No live rule, size, filter
or desk code changed.**

## How it was run

- **Pre-registration first.** `preregistration.md` was committed and pushed (b9140b65) before any B- or C-setup trade was
  computed. The test ran once. Nothing was changed after it.
- **Data.** #526's OANDA 5m cache (XAU_USD, NAS100_USD, SPX500_USD, US30_USD for GC, NQ, ES, YM; 2007-06 to 2026-10), reused
  read-only from the scratchpad. No download, no cost. RTY has no free pre-2018 source (#526).
- **Code.** `run.mjs` extends `research/edge/ict-oos-2008/run.mjs`: the desk's own `signals()`, `isASetup()`, `isAPlus()`,
  `sizeOf()`, `nfpMorning()`, `letter()`, `MIN_GRADE`, `MARKETS`, `inHalt()`, `cmeShut()`, `agg()`, `dailyNY()` from
  `ict/tracker.mjs` and `simulate()` from `ict/replay.mjs`, unchanged. Every recorded signal (grade total >= 3) is simulated
  once, independently; the streams below then choose which simulated trades count, with the tracker's own busy rules.
- **Reproduction of #526 (required before anything else was read).** Stream A gives **2008-17: n 2,235, −0.013R, t −0.45,
  max DD 82.8R** and **2018-26: n 1,786, +0.093R, t 2.58, max DD 31.3R**, identical to #526 (`result.json .reproduction.ok`).
- **Classes** (the desk's `letter()`: A-tier total >= 8, B-tier 5-7, C-tier 3-4; F is never recorded):
  - A-setups = `isASetup` (the traded set), sized by `sizeOf`.
  - B-setups = not an A-setup, grade 5-7. C-setups = grade 3-4 (none is an A-setup).
  - Untraded A-letter = grade >= 8 and not an A-setup (descriptive only).
- **Streams.** A: A-setups, one open A per market (as live). B, C: alone, one open per market, size 1. A+B½: A as live, B at half
  size blocked by any open trade on the market (the tracker's rule for non-A records); a strict one-open variant and a B-at-full-size
  variant are reported. Letter-tier streams (A/B/C letter, strict one-open) for the second H2 reading.
- **Costs** as #526: GC 0.50; NQ, ES 0.0002 x price + 0.25; YM 0.0002 x price + 1; cost in R = cost / r0; net R = size x (R − k x cost), k = 1 and 2.
- Signals simulated: 10,500 (2008-17) and 9,127 (2018-26). Gaps rejected by the gap guard: 0. One YM trade still open at the end of the data.

## H1: do B-setups have a net edge? FAILS

Pass bar: net > 0 and t >= 2 in both windows, positive at x2 costs in both, >= 3 of 4 markets positive in both.

| window | n | WR | net exp | total R | max DD | t | x2 exp (t) | gross exp | monthly t | halves (exp, t) | markets > 0 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2008-17 | 3,935 | 35% | **−0.087** | −340.7 | 365.9 | **−3.93** | −0.165 (−7.48) | −0.008 | −3.65 | 2008-12 −0.115 (−3.78); 2013-17 −0.057 (−1.80) | **0 of 4** |
| 2018-26 | 3,526 | 37% | **−0.016** | −58.0 | 124.0 | **−0.67** | −0.079 (−3.19) | +0.046 | −0.56 | 2018-21 −0.020 (−0.54); 2022-26 −0.014 (−0.41) | **1 of 4** |

Per market, net exp (n): 2008-17 GC −0.017 (817), NQ −0.094 (1,050), ES −0.120 (1,039), YM −0.101 (1,029); 2018-26 GC −0.001 (738),
NQ +0.001 (921), ES −0.047 (939), YM −0.015 (928). Even before costs the B-setups make −0.008R in 2008-17 and +0.046R in 2018-26
(far below the A-setups' +0.138R gross).

Why they are not A-setups (2008-17 | 2018-26, n / net exp): with the daily bias 1,813 / −0.091 | 1,595 / −0.006; grade 5-6 against
the bias 1,073 / −0.101 | 979 / +0.001; stop outside the 0.3-0.75x ATR band 445 / −0.099 | 380 / −0.038; NFP morning 13 / −0.835 |
16 / −0.354; gold sells 591 / −0.021 | 556 / −0.053. No reason-slice is positive with a t near 2 in either window.

## H2: does A > B > C hold? DOES NOT HOLD

| window | A-setups (desk) | B-setups | C-setups | order | untraded A-letter (grade >= 8, not A) |
|---|---|---|---|---|---|
| 2008-17 | −0.013 (n 2,235, t −0.45) | −0.087 (3,935, t −3.93) | −0.061 (1,037, t −1.37) | A > C > B | **−0.139** (1,818, t **−4.11**) |
| 2018-26 | **+0.093** (1,786, t 2.58) | −0.016 (3,526, t −0.67) | −0.011 (869, t −0.21) | A > C > B | **−0.072** (1,676, t −1.94) |

- A-setups are the best class in both windows, but B does not beat C in either, so the order fails as pre-registered.
- By letter tier alone (all recorded signals, strict one-open streams): 2008-17 A-letter −0.085, B-letter −0.092, C-letter −0.053;
  2018-26 A-letter −0.053, B-letter +0.023, C-letter +0.007. Not monotone in either window either.
- By grade total (all signals, 2018-26, net exp / t): 3 +0.055 / 0.5 · 4 −0.042 / −0.6 · 5 −0.005 / −0.1 · 6 +0.003 / 0.1 · 7 +0.057 / 1.3 ·
  8 **−0.103 / −2.6** · 9 −0.139 / −1.6 · 10 +0.149 / 0.8. In 2008-17 every total from 3 to 9 is negative (6, 7 and 8 at t −2.2 to −3.6).
  The candle-closure grade carries no monotone information on its own.
- The reading: the desk's edge in 2018-26 sits in the A-setup *filter* (against the daily bias, stop 0.3-0.75x ATR), not in the
  grade. A high-graded candle on the wrong side of the bias is the worst thing the model produces.

## H3: B-setups at half size added to the desk? HURTS

| window | stream | n | net R | max DD | R / DD | monthly t | x2 exp |
|---|---|---|---|---|---|---|---|
| 2008-17 | A (desk) | 2,235 | −28.9 | 82.8 | −0.35 | −0.38 | −0.073 |
| 2008-17 | A + B½ (desk rule) | 5,616 | **−182.5** | **189.5** | −0.96 | −2.21 | −0.080 |
| 2008-17 | A + B½ (strict one-open) | 5,194 | −157.8 | 188.0 | −0.84 | −2.02 | −0.077 |
| 2018-26 | A (desk) | 1,786 | **+165.3** | **31.3** | **5.28** | 2.42 | +0.047 |
| 2018-26 | A + B½ (desk rule) | 4,890 | +135.3 | 48.8 | 2.77 | 1.62 | −0.009 |
| 2018-26 | A + B½ (strict one-open) | 4,554 | +75.7 | 64.2 | 1.18 | 0.98 | −0.019 |
| 2018-26 | A + B full size | 4,890 | +105.2 | 86.0 | 1.22 | 1.02 | −0.034 |

- Total R and R / max DD are both lower in both windows: HURTS by the pre-registered definition. The strict one-open variant is
  worse still in 2018-26 because open B trades block A-setups (1,786 → fewer A entries).
- At x2 costs the combined stream is negative even in 2018-26 (−0.009R a trade), where the desk alone stays positive (+0.047R).
- Year by year (2018-26, net R: A | B | A+B½): 2018 +11 | −1 | +18; 2019 −4 | −38 | −26; 2020 +36 | −18 | +22; 2021 +2 | +25 | +10;
  2022 +35 | +45 | +50; 2023 +13 | −55 | −17; 2024 +14 | −13 | +14; 2025 +38 | −7 | +41; 2026 +21 | +3 | +24. B-setups add
  volatility (2022 +45, 2023 −55) and no return.

## Descriptive slices (not pre-registered, not proposals)

- B-setups by side, 2018-26: buys +0.032 (n 1,661, t 0.9), sells −0.059 (1,865, t −1.7); 2008-17: buys −0.039, sells −0.128 (t −4.2).
  The sell-side losses mirror #526's index-sells finding.
- B-setups by session, 2018-26: Asia +0.085 (618), London −0.023, NY AM −0.057, NY PM −0.019, Close −0.050. 2008-17: all five negative.
  The Asia cell is one positive slice out of ten and is not evidence.
- B-setups with a stop inside the 0.3-0.75x ATR band (but with the bias or graded 5-6): 2018-26 +0.051 (n 1,638) vs out of band −0.075;
  2008-17 in band −0.073 vs out of band −0.100. The stop band matters in both windows; the grade does not.
- C-setups: 2018-26 NQ +0.141 (210), YM +0.042, GC −0.159, ES −0.081; 2008-17 all but ES negative. Noise.

## Honest reading

- The desk is right to log and not trade the B and C grades. Nothing in them is an edge at x1 costs on either window, and
  2008-17 rejects them at t −3.9.
- The grade number is not the desk's edge. It is a candle-quality score that, taken alone, is flat to negative; the A-setup rule's
  side-vs-bias and stop-band conditions do the separating. "Trade more of the ladder" (B at half size) only dilutes the 2018-26
  result and deepens the drawdown.
- This also warns against the opposite idea: sizing *up* by grade. Grade 8-9 signals are negative in 2018-26 (t −2.6 at 8), and the
  untraded grade >= 8 signals are the worst class in both windows.
- Like #526, this says nothing new about whether the 2018-26 A-setup edge will persist; it only shows the untraded grades do not add to it.
- **Proposals: none.** No shadow stream is worth opening for B-setups. The desk's `MIN_GRADE` logging stays useful as a record, not as a trade list.

## Multiple testing

- Three pre-registered hypotheses; all three fail or hurt. The by-side, by-session, by-reason, in-band and C-market slices are
  descriptive; with about 40 cells, one or two |t| near 2 are expected by chance and none reaches it on both windows.

## Files

- `preregistration.md`: the definitions, streams and bars, committed before the run.
- `run.mjs`: the desk's code over the #526 cache; simulates every graded signal once, builds the streams, writes `result.json`
  and prints the tables above. Reuses `<cache>/grades-trades.json` when present.
- `result.json`: every stream per window with costs x1 and x2, gross, halves, markets, years, sides, sessions, by grade, the
  B-setup reason split, the reproduction check and the three verdicts.

Re-run: `node research/edge/ict-grades/run.mjs <cacheDir> research/edge/ict-grades/result.json` with #526's 5m cache
(`node research/edge/ict-oos-2008/fetch.mjs <cacheDir>` builds it).
