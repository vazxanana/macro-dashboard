# Low-risk CF against high-risk CF in the Mosha sequence (result)

**Verdict: FAIL. The low-risk CF with the EG entry made −0.071R a trade before costs (n 606, month t −0.97), and the limit at its CF line made −0.064R (n 682, month t −0.96).**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, pushed alone first). The desk's own code (`assets/mosha-sop.js`
`sopTrades`, the page's functions lifted by `council/mosha-desk.mjs` `loadFns`, nothing edited) ran on OANDA mid 5-minute
candles for xau, eurusd, gbpusd, usdjpy and audusd, with trades from 2010 to 2019. Two chains: H4>H1 and H1>M15. Low risk means
the CF is on the VR's timeframe (`cf: 'same'`); high risk means the CF is one timeframe lower (`CFTF`: M15 and M5). R is judged
before costs, and the after-cost R (combo-grid-2 `COSTS`) is reported beside it. Every figure is in `result.json`.

## The three tests

| Test | n | R a trade before costs | Month t | 2010-14 | 2015-19 | Placebo (same side and distances, earlier) | After costs | Holm p |
|---|---|---|---|---|---|---|---|---|
| T1 low-risk CF, EG entry | 606 | −0.071 | −0.97 | −0.029 (t −0.26) | −0.113 (t −1.15) | −0.143R; real minus placebo +0.072, Welch t 0.63 | −0.140 (t −1.89) | 1 |
| T2 low-risk minus high-risk, EG entry | 606 / 2184 | +0.039 | Welch t 0.38 | +0.083 | −0.004 | n/a | n/a | 1 |
| T3 low-risk CF, limit at the CF line | 682 | −0.064 | −0.96 | −0.102 (t −1.00) | −0.026 (t −0.30) | −0.146R; real minus placebo +0.082, Welch t 1.05 | −0.102 (t −1.52) | 1 |

None of the three tests passes. Both low-risk entries lose a little before costs, in both halves. The low-risk CF is not reliably
better than the high-risk one: it is ahead by +0.04R a trade, Welch t 0.38, and level in 2015-19. The placebo (the same trade
entered 5 to 100 CF-timeframe candles earlier) loses more than the real trades, but the gap is inside noise in both T1 and T3.

**Gate**: on the high-risk runs, the study's limit simulator reproduced 2,331 of the code's 2,331 limits at the CF line
(100 %; it adds 13 the code drops when its walker ends). So the low-risk limit in T3 follows the code's rule.

## Reported, not tests

- **High-risk CF on its own**: EG entry −0.111R (n 2184, month t −1.79; after costs −0.221R, t −3.53). Limit at the CF
  line −0.077R (n 2,327, t −2.11; after costs −0.127R, t −3.45).
- **By chain**: H4>H1 is about zero to slightly positive and H1>M15 loses, for every stream. Low-risk EG +0.086R (n 147,
  t 0.38) on H4>H1 against −0.122R (n 459) on H1>M15. Low-risk limit +0.178R (n 150, t 1.05) against −0.132R (n 532,
  t −2.24). High-risk EG +0.168R (n 608, t 1.12) against −0.218R (n 1,576). These splits were chosen after the result and
  none reaches t 2. They are not evidence.
- **By market (low-risk EG)**: audusd +0.207R (n 179), gbpusd about 0, xau −0.133R, eurusd −0.202R, usdjpy −0.362R (t −3.43).
- **The side flipped** on the T1 trades gives +0.093R (n 603, t 0.93): the low-risk EG entry carries no measurable direction.
- No trade was left open at the end of its slice; 8 trades touched a data-quality exclusion and were dropped.

## What it means

On 2010-2019, the desk's reading of the BO > VR > CF sequence does not make money before costs, whether the CF is the low-risk
one or the high-risk one, and whether the entry is the EG or the limit at the CF line. Preferring the low-risk CF cuts the
number of trades by about three quarters. In R a trade it is no better within noise. Nothing live changed. Do not test
variants of these rules on these years.

To repeat (cache outside git, `research/edge/_lib/fetch-cache.mjs`):
`EDGE_DATA=<cache> node research/edge/mosha-cf-risk/run.mjs market <market> <out>` for the five markets (about 15 minutes in
parallel), then `node research/edge/mosha-cf-risk/run.mjs report <out>`. Test: `tests/mosha-cf-risk.test.mjs`.
