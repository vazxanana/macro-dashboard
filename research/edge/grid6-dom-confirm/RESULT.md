# Grid 6: the dominant zone with a confirmation and a market entry (result)

**Verdict: PASS. 17 of 5,760 cells pass before costs, all the no-confirmation control (best: H1 > M5, n 22,995 in 2015-19, +0.071R a trade, month t 6.87); every one loses after costs (-0.03R to -0.18R) and no confirmation cell passes.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Pooled xau, eurusd, gbpusd,
usdjpy, audusd, OANDA mid 5-minute candles, fills 2010-2019 (discovery 2010-14, confirmation 2015-19), 1,565,667 trades in
all cells' source set (385,548 zone visits). Every entry is a MARKET order at the next 5-minute open after the decision candle
closes: there is no resting limit, so the touch-fill artefact of `dom-trade-through` cannot arise. Research only: nothing
live changed.

## What "PASS" means here, and what it does not

The verdict is the pre-registered rule (at least one cell passes and the side-flipped placebo passes fewer). Read it with
these facts beside it:

- **Every one of the 17 passing cells is the control `none`** (a market entry at the close of the first candle that trades
  into the zone). Of the four confirmations (engulf, structure break, box close-out, rejection candle) none passes; 245 of
  their cells passed discovery and none held through confirmation and Holm.
- **Every passing cell loses after costs**: -0.027R to -0.181R a trade on 2015-19. The tilt before costs (+0.03R to +0.14R)
  is smaller than the round trip in R on every cell, most of all with the `swing` stop (the touch candle's extreme), whose
  small risk makes the cost large in R.
- The passes do not depend on the Daily MSNR call: `with` and `against` both pass on H1 > M5 (+0.065R and +0.077R in
  2015-19). That points to a short-term reaction after a candle reaches the zone, not to the zone's direction story.
- The side-flipped placebo passes **6** cells (all `bo`, mostly the `other` session): fading a lower-timeframe break
  inside a zone passes the same bar. The grid's machinery creates passes; 17 against 6 is not a wide margin for 5,760 cells.
- By chance: 5,072 cells had n >= 100 in discovery, about 127 expected to pass discovery at one-sided p 0.025; 633 did
  (placebo 376). Of the 633, about 16 would pass confirmation by chance before Holm; 145 did, 17 after Holm.

## Passing cells (before costs; month-sum t; after costs for 2015-19)

| Chain | Visit | Daily call | Session | Stop | Exit | 2010-14 | 2015-19 | After costs 2015-19 | Holm p |
|---|---|---|---|---|---|---|---|---|---:|
| H1 > M5 | 1 | any | any | swing | trail | +0.123R (n 24,487, t 7.84) | +0.071R (n 22,995, t 6.87) | -0.177R | 1.4e-6 |
| H1 > M5 | 2 | any | any | swing | trail | +0.109R (n 18,763, t 9.31) | +0.069R (n 17,675, t 7.26) | -0.177R | 3.1e-7 |
| H1 > M5 | 1 | against | any | swing | trail | +0.138R (n 11,872, t 6.79) | +0.077R (n 11,192, t 6.35) | -0.174R | 1.1e-5 |
| H1 > M5 | 1 | any | any | zone | 1R | +0.037R (n 38,353, t 7.06) | +0.032R (n 38,658, t 6.02) | -0.063R | 3.8e-5 |
| H1 > M5 | 1 | any | any | zone | trail | +0.047R (n 38,353, t 6.96) | +0.039R (n 38,658, t 5.37) | -0.056R | 0.00044 |
| H1 > 15m | 2 | any | any | swing | trail | +0.083R (n 18,252, t 6.13) | +0.051R (n 17,589, t 6.08) | -0.155R | 3.0e-5 |
| H4 > H1 | 2 | any | other | swing | 2R | +0.097R (n 1,518, t 2.61) | +0.142R (n 1,565, t 4.45) | -0.027R | 0.0121 |

The other ten (H1 > M5 London / other / with-call / second-visit variants, H1 > 15m London and first visit) are in
`result.json` (`real.passes`), all `none`, all negative after costs.

## The confirmations, whole decade (first visit, Daily call any, session any, trailing exit, before costs)

| Chain | none (zone stop) | eg | bo | box | rej |
|---|---|---|---|---|---|
| D1 > H4 | +0.018R (n 3,431, t 0.78) | -0.006R (t -0.27) | -0.044R (t -1.18) | -0.010R (t -0.23) | +0.030R (t 0.70) |
| H4 > H1 | +0.031R (n 18,932, t 3.31) | +0.004R (t 0.27) | +0.018R (t 1.14) | +0.028R (t 1.37) | +0.011R (t 0.59) |
| H1 > 15m | +0.031R (n 74,101, t 5.84) | +0.003R (t 0.41) | 0.000R (t 0.00) | -0.019R (t -1.61) | +0.002R (t 0.20) |
| H1 > M5 | +0.043R (n 77,011, t 8.68) | +0.007R (t 1.16) | +0.006R (t 0.61) | -0.004R (t -0.31) | +0.036R (t 4.27) |

Waiting for a confirmation does not help: every confirmation is at or below the plain touch entry, and the 2015-19 half of
the engulf, break and box cells is negative on the lower chains. (Full table, both stops and the 2R exit: `result.json`
`view`.)

## Conclusion

Taking the touch fill away does not leave a tradable dominant-zone entry. A market entry right after price reaches an H1
zone keeps a small tilt before costs in both halves (+0.03R to +0.07R a trade in 2015-19), but it is far smaller than the
cost and it shows up whether the Daily call agrees or not, as a short-term reaction rather than a zone effect. None of the
four confirmations adds anything. Not an edge: n and t are above, and every passing cell is negative after costs. Nothing
live changes; the demo record of the H1 dominant zone (`council/dom-demo.mjs`) stays a forward record, not evidence.

To repeat: fetch the cache (`research/edge/_lib/fetch-cache.mjs`, 5m 2009-2019 and 1d 2008-2019 for the five markets), then
`node --max-old-space-size=5000 run.mjs market <m> <dir>` for each market (about 7 minutes each) and `node run.mjs report <dir>`.
