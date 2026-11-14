# Pre-registration: gold H1 Vortex crossover, against gold's own drift (14 Nov 2026)

Written and pushed alone, before any trade of this study is computed. Only the count of crossovers per year was looked at
(about 600-700 a year on H1, to check the test has power); no return, side or outcome was read.

## Question
When the Vortex indicator on spot gold's H1 candles turns (VI+ crosses above VI−, or below), does the next day move in the
turn's direction by more than gold's own drift for that side and month, enough to pay a fixed stop and the round-trip cost?

## Scope (owner decision 44)
A **new stand-alone intraday trend-turn rule** on spot gold. It is not a gate, exit, entry or size of the live gold book
(Gold trend + Gold daily engulf), it reads none of that book's positions and adds nothing to its 2006-17 window. Paper research
only: nothing live changes whatever the verdict; a PASS would be a proposal to the owner at most, never a live change.

## Why it is not a duplicate
No study, branch or entry of `topics.txt` / the 14 Nov untested-backlog list names the Vortex indicator. The nearest:
`gold-adx-trend` (ADX level / DI as a trend filter), `gold-psar`, `gold-h4-supertrend`, `gold-macd`, `gold-ichimoku`,
`gold-aroon` (other trend-turn indicators, other formulas), `gold-h1-bb-fade` (H1 mean reversion). Vortex measures the
distance from each candle's high to the previous low against its low to the previous high; none of the above uses it.

## Data (named before any result)
- Spot gold only: OANDA mid H1 XAU_USD `[[t, o, h, l, c], ...]` (UTC hour start), 2006-03-19 to 2026-11-13 (125,704 candles),
  the desk's research cache built through the site's candle proxy, kept out of git (`run.mjs` takes its path).
- No other market, no other data.

## Indicators (from candles closed at or before the signal candle, on the file's consecutive candles)
- Vortex(N): VM+(k) = |high(k) − low(k−1)|, VM−(k) = |low(k) − high(k−1)|, TR(k) = max(high−low, |high − close(k−1)|,
  |low − close(k−1)|). VI+ = ΣVM+ / ΣTR, VI− = ΣVM− / ΣTR over the last N candles (simple sums).
- ATR(14), Wilder (first = mean of 14 TRs, then (13 x ATR + TR) / 14).
- The first 200 candles of the file are warm-up only.

## Signal and trade
- Sign s(i) = sign(VI+(i) − VI−(i)) (a zero keeps the last non-zero sign). A **cross** at candle i: s(i) differs from the
  last non-zero sign before it. s(i) = +1 → BUY, −1 → SELL.
- The next candle must start within 3 hours of candle i's start (else no trade).
- Entry E = the next candle's open. Stop = E ∓ 1.5 x ATR(14) at candle i (BUY below, SELL above); 1R = 1.5 x ATR.
  Every trade has this stop. No target.
- Exit: the stop, else the close of the 24th H1 candle counted from the entry candle (the entry candle is the first). On each
  candle: an open at or past the stop fills at that open; else a touch of the stop fills at the stop.
- A candle that starts more than 6 hours after the previous one (a closure) ends an open trade at its open (stop if past it).
- One position at a time per test: a cross met while a trade is open (before its exit candle has ended) is skipped, also an
  opposite one. The trade is not reversed.

## The three tests (Holm over these three)
- **T1 (primary)**: Vortex(14), both sides.
- **T2**: Vortex(42), both sides (a slower turn).
- **T3**: Vortex(14), BUY crosses only.

## Costs
- $0.60 a round trip on every trade (in R: 0.60 / r0).
- Buys also pay overnight financing: `nights(entry, exit)` x `FIN.xau.long` (0.000148 of price a rollover, the demo broker's
  XAUUSD long swap of 11 Nov 2026, `council/fills.mjs`) x E / r0. Sells are credited nothing.
- 2x costs = $1.20 and twice the financing.

## Drift baseline (separates the signal from gold's drift)
- Every eligible H1 candle h of the window (ATR known, next candle within 3 h) gives one BUY and one SELL baseline trade by the
  same entry, stop, hold and costs, with no one-at-a-time rule.
- For each side and calendar month, the baseline mean net R a trade = the mean over that month's baseline trades of that side.
- A rule trade's **excess** = its net R − the baseline mean net R of its side in the month of its entry.
- The excess is reported per window with its t on calendar-month sums.

## Windows and statistics
- In sample (IS) = entries 2007-01-01 to 2016-12-31; out of sample (OOS) = entries 2017-01-01 to 2026-10-31.
- R per trade; t = mean / se of the calendar-month sums of net R (and of excess R) over months with at least one trade.
- One-sided p of the OOS net t (normal), Holm over the three tests.
- Placebo, per test, 40 seeds (mulberry32, seeds 1-40): each OOS signal is moved to an eligible OOS candle drawn at random,
  keeping its side; the stream is run one at a time. The rule beats a seed when its OOS mean net R is above the seed's.

## Pass bar (all needed, per test)
1. OOS net t ≥ 2 and Holm p ≤ 0.05.
2. IS mean net R > 0 (the same sign).
3. OOS mean net R at 2x costs > 0.
4. OOS mean excess R > 0 with its month t ≥ 2.
5. Placebo: beats at least 38 of 40 seeds.
6. OOS n ≥ 200.
PASS = T1 passes; T2 / T3 passing alone are reported as PARTLY. Anything else FAIL. Reported, not judged: by side, OOS halves
(2017-21 / 2022-26), by year, exits, gross R.

## Not done
No parameter search: N = 14 / 42, 1.5 ATR and 24 hours are fixed here. No M5 ordering is needed (no target). Nothing under
`council/`, `ict/` or any live file is touched.
