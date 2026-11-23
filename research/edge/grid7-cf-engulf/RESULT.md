# Grid 7: the Mosha CF that is also an engulf, or breaks an opposite engulf zone (result)

**Verdict: FAIL. 0 of 48 cells passed (placebo 0); the best confirmation cell, against the BO on H4>H1 with an engulf CF and a 2R target, made +0.084R a trade before costs in 2015-26 (n 1163, month t 1.81) after +0.048R in 2005-14 (n 1080, t 1.09).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). OANDA mid 5-minute candles of
xau xag eurusd gbpusd usdjpy audusd nzdusd usdcad usdchf eurjpy (gold and silver from 2006), discovery 2005-2014,
confirmation 2015 to Oct 2026. The storyline is grid 5's (`research/edge/grid5-mosha-cycle` `storylines`, the page's own
structure engine); the engulf and engulf-zone readings are `council/eg-methods.mjs` `engulfAt` / `zones` (3-candle span).
Market entries at the next 5-minute open; judged before costs on calendar-month sums. Research only: nothing live changed,
nothing was placed. Costs of xag, nzdusd, usdcad, usdchf and eurjpy are assumed, not measured.

## What was run

39,136 CF signals on the three ladders and 76,933 simulated trades (each signal with the BO and against it; xau 6,465,
xag 5,758, eurusd 8,056, gbpusd 7,754, usdjpy 7,577, audusd 9,418, nzdusd 9,374, usdcad 7,932, usdchf 6,873, eurjpy 7,726).
137 dropped on the data-quality list, 5 not finished by the end of the data, 1,167 not built because the next 5-minute open
was already past the stop (almost all against the BO, where the stop is tight). Of the CFs, 27,875 were also an engulf of
the BO's side (EG), 30,043 closed through an opposite engulf zone (EF), 21,767 both: the CF candle is a break candle, so it
is an engulf most of the time and the plain-CF control is the smaller group. 46 of 48 cells reached n >= 300 in both
windows (the two that did not are the "inside the VR" ext cells on H4>H1). The one cell that cleared the discovery line,
against the BO on H1>M15 with an EG CF and 2R (+0.066R, n 3,326, t 2.55), was flat after it (+0.008R, n 3,948, t 0.32).

Cut test: 30 random cuts in 2011-2012 on xau, eurusd and eurjpy; 6,447 signals known by a cut compared with the ones
computed on candles cut there (ladder, side, CF close, CF candle, pullback extreme, VR extreme, place, EG, EF, both stops):
0 mismatches.

## The bar, line by line (before costs)

| | Real cells (48) | Placebo (other side, levels mirrored) |
|---|---:|---:|
| n >= 300 in both windows | 46 | 46 |
| mean R > 0 and month t >= 2 in 2005-14 | 1 | 7 |
| mean R > 0 and month t >= 2 in 2015-26 | 0 | 9 |
| both windows | 0 | 5 |
| Holm p <= 0.05 in 2015-26, with a positive mean | 0 | 2 |
| beats its plain-CF control (Welch t >= 2) in both windows | 0 | 0 |
| **pass** | **0** | **0** |

The primary question, the engulf CF against the plain CF at the same ladder, place and exit, has no answer in favour of
the engulf: no cell's Welch t reaches 2 in both windows, and only one reaches it in either (with the BO, H1>M15, EG, CF
clear, 2R: confirmation Welch t 2.67, because the plain CFs lost more, −0.211R, while the engulf CFs also lost, −0.044R;
discovery 0.43). Most differences are under 1 in size, with both signs.

## With the BO (the method)

Before costs the CF traded with the BO loses on every ladder, engulf or not. The plain storyline (every CF, 2R):

| Ladder | 2005-14 | 2015-26 |
|---|---|---|
| H4>H1 | −0.014R (n 1,411, t −0.37) | −0.009R (n 1,497, t −0.28) |
| H1>M15 | −0.022R (n 4,619, t −1.11) | −0.057R (n 5,365, t −2.89) |
| M30>M5 | −0.074R (n 11,759, t −6.02) | −0.048R (n 14,351, t −3.91) |

The 36 "with" cells sit between −0.13R and +0.04R a trade in discovery and −0.13R and +0.02R in confirmation; none has a
month t of 2 with a positive mean in either window. Examples: H4>H1 EG CF clear 2R +0.043R (n 419, t 0.67) then +0.004R
(n 480, t 0.07); M30>M5 EF inside 2R −0.085R (n 5,497, t −5.05) then −0.057R (n 6,422, t −3.17). After costs every
"with" cell loses in confirmation (−0.003R to −0.200R a trade).

**Secondary control (no storyline)**: an engulf (or EF) of the same side on the same timeframe, same market and month, not
a CF, traded the same way with the same risk in ATR, did BETTER than the storyline in most cells: 13 of 48 cells have a
confirmation Welch t of −2 or below against it (strongest M30>M5 EG inside 2R: storyline −0.042R, no storyline +0.032R,
t −3.10; discovery −5.46). The storyline around the engulf adds nothing; it subtracts a little.

## Against the BO

Best cell of the grid: H4>H1 EG 2R, +0.048R (n 1,080, t 1.09) then +0.084R (n 1,163, t 1.81), no better than its plain
CFs (Welch t −1.58 / 0.40), and −0.286R a trade after costs (the stop past the CF candle is tight, so costs are a large
share of 1R). On H1>M15 and M30>M5 the 1R cells lose heavily before costs (M30>M5 EG 1R −0.221R, n 7,793, t −17.38, then
−0.254R, n 9,779, t −18.99), and so do their placebos (−0.37R to −0.39R). That symmetric loss is a measurement effect, not a
finding about direction: a post-hoc look at eurusd, xau and usdjpy shows the median stop of an against trade on M30>M5 is
0.32 of a median 5-minute candle range (H1>M15 0.61, H4>H1 1.19; with the BO 4.5 to 13), and on M30>M5 31.5 % of these
trades first meet their 1R stop and 1R target inside the same 5-minute candle, which the pre-registered rule books as a
stop (H1>M15 17.4 %, H4>H1 6.6 %, with the BO 0.1 %). The against cells below H4>H1 cannot be judged fairly on 5-minute
candles; with the plain-CF control taken by the same rule, the primary test still compares like with like, and it finds no
difference there either (Welch t between −2.36 and 1.04).

## The side-flipped check

Fading the "with" trades (the other side at the same fill, stop and target mirrored) is positive before costs in 35 of the
36 "with" cells in confirmation, and passes the window lines in 5: M30>M5 EG inside 1R and 2R, EF inside 1R and 2R
(e.g. EF inside 2R +0.064R, n 5,497, t 3.77, then +0.062R, n 6,422, t 3.50, Holm p under 0.05) and H1>M15 EF clear 2R.
None beats its plain-CF control (the faded plain CFs do as well), so none passes; after costs they lose (−0.016R to
−0.055R a trade, except H1>M15 EF clear 2R at +0.042R). This is the same short-term pull-back after a lower-timeframe break
that `grid7-wide-fade` and `fade-new-markets` found; the engulf on the CF candle adds nothing to it.

## What it says

- On ten markets and 22 years, a Mosha CF candle that is also an engulf of the BO's side, or that closes through an
  opposite engulf zone, makes no better trades than a CF that is neither, at any ladder, place or exit tested, with the BO
  or against it.
- The CF with the BO loses before costs on H1>M15 and M30>M5 and is flat on H4>H1; an engulf of the same side without the
  storyline does no worse, often better.
- The one consistent positive figure is again the fade of a lower-timeframe break (the placebo), which is already the
  subject of other studies and is not new evidence here.

Not an edge; nothing is proposed. Do not test variants of this split on these years.

## Files

`run.mjs` (`market`, `report`, `cut`), `result.json` (every cell before and after costs, both controls, the placebo, the cut
test, per-market counts), `PREREGISTRATION.md`. Test: `tests/grid7-cf-engulf.test.mjs`. To repeat: fill the cache with
`research/edge/_lib/fetch-cache.mjs` (`EDGE_DATA`), then `node research/edge/grid7-cf-engulf/run.mjs market <m> <dir>` for
the ten markets, `… cut xau 10 <dir>` (and eurusd, eurjpy), `… report <dir>`.
