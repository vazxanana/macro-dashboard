# MSNR direction as a gate in front of the engulfing entry: pre-registration

Written and committed on 11 Nov 2026, before any trade of this study was simulated. Paper research only: no live rule,
size, filter, council member, page or mirror setting is changed by this study, whatever it finds.

## Why

The owner asked: "what about the strategies? use the skills". Two of the owner's skills are used here. Both are kept
privately and are not in this repository; everything below is my own wording of them.

- The **direction** skill: a way to call the market buy, sell or undecided (a structure-switching breakout on the working
  timeframe, accepted only when it is an external one and price had first reached a key level one timeframe above).
- The **research** skill: the owner's backtest pipeline for gold. Its entry signal is a body-engulfing candle, taken through
  a ladder of timeframes (a 15-minute signal, then a 5-minute one), with a session filter, a fixed reward-to-risk target
  and the entry at the open of the candle after the signal. Its own direction filter is a 4-hour structure read from
  closing prices.

Earlier today the direction call was tested **alone** as a buy / sell label on gold's next daily closes
(`research/edge/msnr-direction`, on branch `claude/msnr-study`): FAIL, 0 of 6 tests. That study said what it did not test:
the call as a **gate in front of the skills' own entry method, as trades, net of costs**. This is that test. The direction
skill itself says to treat the call as a gate on top of the engulfing entry stack.

What I already know, said plainly.
- From the direction study: in 2020-26, on the 4-hour / Daily ladder, gold rose *more* after a sell call than after a buy
  call (t -0.7 to -1.5), and slightly the other way in 2007-19. So I expect the gate to add nothing; the test is run
  because the owner's question is about the whole method, not the label.
- Five Mosha studies of 10 Nov (break-of-swing entries on gold M5, 2006-26) all lost after costs.
- Gold rose strongly in 2020-26, so a buy-side stream that makes money proves nothing about a gate. Every result below is
  read **against the same entries taken without the gate and against the gate**.
- The research skill quotes very strong results for its stacks (win rates, Sharpe figures). They are the skill's claims, not
  results of this repository, and nothing here is tuned to reproduce them.
- I have not computed an engulfing entry, or any trade of this rule, on any data before writing this file. From the candle
  file I read only the number of candles and the first and last times.

## Data and windows

- OANDA spot gold (XAU/USD) mid candles, **M5**, UTC, through the keyless candle proxy (`/md/bars?sym=xau&tf=5m`), from
  1 June 2006, fetched in windows of at most 4,999 candles, kept out of git. The file used is the one the `mosha-sweep`
  study fetched on 10 Nov (1,458,888 candles, 1 June 2006 to 9 Nov 2026); `node run.mjs fetch <dir>` fetches it again.
- **One source, every timeframe.** M15, H4 and Daily candles are built from the M5 file: M15 and H4 in UTC buckets
  (`floor(time / 900)`, `floor(time / 14400)`, the proxy's own alignment); a **day** is the UTC date of the candle's open,
  with Sunday's candles counted into Monday (as in the direction study).
- **Window A: 1 Jan 2007 to 31 Dec 2019. Window B: 1 Jan 2020 to 31 Oct 2026.** June to December 2006 is warm-up. A trade
  belongs to the window of its entry time. Nothing is fitted on either window: every number is fixed in this file. **B is the
  confirmation window** (absolute rule 4; the verdict's t is read there). **A is the replication window** (the sign must
  agree). A's M5 candles were read on 10 Nov by the Mosha sweep studies, on different rules.

## The direction call (the gate)

The detector of the direction study, copied into this study's `run.mjs` (nothing is imported from that branch), on its
ladder **L1: working H4, key levels on the Daily**, the ladder of the direction skill's own examples. Constants as there:
swings of 2 candles a side, a key level lives 60 Daily candles, the external level must break within 10 Daily candles of
the tap. Key levels on the Daily: swing zone (wick to body), engulfing zone, failed engulfing zone, dominant zone; a first
tap of a live zone while the H4 structure points the other way freezes the last existing unbroken H4 swing level; the first
H4 close beyond it sets the call (+1 buy, -1 sell), which stays until the opposite sequence completes; before the first
switch the call is 0 (undecided). Full wording: the direction study's pre-registration.

The call used for a signal is the call at the close of the **last H4 candle that had fully closed when the signal's M5
candle closed** (its bucket ended at or before that close). The H4 candles here are built from M5; the direction study
read OANDA's own H4 candles, so a switch can differ by a candle.

## The entry (written for a buy; a sell is the mirror image)

Constants: `BODY = 0.4`, `ARM = 2700` s (45 minutes), `PAD = 0.30` $, `MIN_R0 = 1.00` $, `HOLD = 43200` s (12 hours),
`COST = 0.30` $ a round trip.

1. **Body engulf (any timeframe).** Two candles next to each other in time (no missing candle between them): the first
   closes below its open; the second closes above its open, opens at or below the first's close, closes at or above the
   first's open, and its body is more than 0.4 times the first's body. The signal exists at the close of the second candle.
2. **Setup: an M15 body engulf up.** Known at the end of its 15-minute bucket, time `T`.
3. **Trigger: an M5 body engulf up** whose second candle opens at or after `T` and before `T + 45 minutes` of any M15 setup
   of the same side (nine M5 candles: the trigger must come straight after the setup). Every such M5 candle is one
   **candidate**; a candidate is not consumed by its setup, the one-at-a-time rule below does that.
4. **Session.** In the main test the trigger candle opens between **12:00 and 15:55 UTC** (the research skill's window).
5. **Entry.** A market buy at the **open of the next M5 candle**, which must open exactly 5 minutes after the trigger
   candle (no entry across a gap, a weekend or a halt).
6. **Stop** (every trade has one, on the losing side): the lower of the two lows of the trigger's engulfing pair, minus
   $0.30. `r0 = entry - stop`. No trade when `r0 < $1.00` (the cost would be over 0.3R) or the entry is not above the stop.
7. **Target:** `entry + 1.5 x r0` in the main test.
8. **Management, on M5 candles from the entry candle on.** A candle that opens at or beyond the stop exits at its open; a
   candle that touches the stop exits at the stop, **before** any target in the same candle; a candle that reaches the target
   exits at the target; the first candle opening 12 hours or more after the entry exits at its open. The stop never moves.
   A trade still open at the end of the file is dropped, not marked.
9. **R and cost.** `R = (exit - entry) / r0`; `net R = R - 0.30 / r0`. $0.30 a round trip is the spread-and-slippage figure
   of the repository's other gold studies (Mosha, the gold playbook view uses $0.35). Also reported at twice the cost.
10. **One at a time, per stream.** Candidates in time order; one whose entry is at or before the close time of the
    stream's previous trade is skipped.

## The streams (what makes the gate a test)

The **same candidates** form three streams, each with its own one-at-a-time book:

- **ALL**: every candidate, both sides, the call ignored (the entry method without the gate).
- **WITH**: candidates whose side equals the call (the gate as the direction skill means it).
- **AGAINST**: candidates whose side is opposite to the call.

Candidates while the call is 0 are in ALL only.

## Tests (fixed: three)

Each test is the **WITH** stream's mean net R, tested > 0 (one-sided, plain t of the per-trade net R; trades of one stream
do not overlap), computed on A and on B.

- **T1 (main): session 12:00-15:55 UTC, target 1.5R.** The research skill's simple stack with the direction gate.
- **T2 (variant "2R"):** as T1 with the target at 2R (the skill's other reward-to-risk).
- **T3 (variant "all hours"):** as T1 without rule 4 (does the result need the session window?).

Holm correction over the three one-sided p-values of window B (normal approximation).

A test **passes** when all of these hold:

1. WITH has at least 100 trades in each window;
2. WITH mean net R > 0 with **t >= 2.0 in window B**;
3. WITH mean net R > 0 in window A;
4. the gate adds: WITH mean net R is above ALL's mean net R **in both windows**, and above AGAINST's in window B;
5. WITH mean net R > 0 in window B at twice the cost;
6. Holm-adjusted p < 0.05.

## Verdict (fixed here)

- **PASS**: T1 passes.
- **FAIL**: no test meets conditions 2 and 3 together.
- **INCONCLUSIVE**: anything else (a test meets 2 and 3 but not the rest, or only a variant passes; a variant passing alone
  is a hypothesis for a new pre-registration on other data, never a result).

Whatever the verdict, **the gate question is answered separately and reported in words**: does WITH beat ALL and AGAINST in
both windows (difference of means, Welch t, n of each)? A WITH stream that makes money while ALL makes the same is the
entry method (or gold's rise), not the gate.

## Reported, not tested (never a verdict, never promoted)

For every test and stream: n, win rate, mean R gross and net, t, profit factor, total, max drawdown in R, by year, by side,
exits, median stop distance. For T3's ALL stream the net R by UTC hour of the trigger (the research skill asks for the
hourly table). For T1's candidates, the research skill's own direction filter as a gate instead of the call: H4 closing
prices, pivots of 3 candles a side, up when the last two pivot highs and the last two pivot lows both rise, down when both
fall (WITH / AGAINST by that filter). A seeded bootstrap (5,000 resamples of T1's WITH net R per window): the share of
resamples with a positive total and the 50th / 95th percentile of max drawdown.

## What I had to decide (the skills leave it open)

- **Which stack.** The research skill names several; its strongest claims use signals it does not define (it names an
  engulfing-failure signal and two abbreviations without rules). I use the one signal it does define, the body engulf, on
  its 15-minute then 5-minute ladder. The stacks built on the undefined signals are **not** tested here.
- **How the 5-minute signal follows the 15-minute one**: within 45 minutes, same side. The skill gives no number.
- **The stop.** The skill gives none (only that a stop must be capped). Mine: beyond the trigger pair's extreme by $0.30,
  the repository's usual pad. No cap is applied; the median stop distance is reported.
- **Minimum stop distance $1.00** and the **12-hour time exit**: mine.
- **The session as trigger hours 12 to 15 UTC** (the skill writes the window as "12 to 16").
- **The engulfing and failed-engulfing key levels of the gate**: as in the direction study, mine.
- **Both sides.** The skill says its edge on gold is on the sell side. The gate decides the side here; the by-side split is
  reported, not tested.
- Fixed dollar amounts ($0.30, $1.00) across a price that went from about $600 to about $4,000 mean fewer and relatively
  wider-stopped trades in the early years. Said, not corrected.

## What happens next

Nothing changes live on any outcome. On PASS the proposal to the owner is a forward paper stream (as the LIT shadow), never
a live rule before a forward record exists. On FAIL or INCONCLUSIVE the result is published as it is. A bug found after the
run is fixed, said in RESULT.md, and everything is re-run.
