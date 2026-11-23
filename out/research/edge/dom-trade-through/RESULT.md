# Does the H1 dominant-zone limit survive a stricter fill? (result)

**Verdict: FAIL. With a fill half the round trip through the limit, +0.011R a trade before costs (n 144,877, month t 2.94; 2015-19 +0.004R, t 0.75), against +0.055R (n 151,045) on touch.**

Run 23 Nov 2026 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Pooled xau, eurusd, gbpusd,
usdjpy, audusd, fills 2010-2019, OANDA mid 5-minute candles. The signals, the entry and the stop are exactly `dom-placebo`'s
DOM stream. The touch fill (F0) was checked against combo-grid-3 `multi()` on every order (154,550 orders, 0 differences). It
reproduces `dom-placebo` / `dom-zone-holdout` exactly: n 151,045, +0.0548R, month t 14.23. Research only: nothing live changed.

## Tests (trailing exit, before costs; both halves must have mean > 0 and month t >= 2; Holm over two)

| Test | 2010-14 | 2015-19 | Holm p | Pass |
|---|---|---|---:|---|
| T1 F1 trade-through 0.1 x ATR(14) of M5 | +0.011R (n 72,443, t 2.32) | +0.002R (n 72,755, t 0.37) | 0.453 | no |
| T2 F2 trade-through half the round trip | +0.018R (n 72,513, t 3.64) | +0.004R (n 72,364, t 0.75) | 0.453 | no |

Neither test passes. Both are positive in 2010-14 and are about zero in 2015-19.

## Pooled, 2010-2019 (before costs, month t; after costs in brackets)

| Fill rule | n | Trailing exit | 2R exit |
|---|---:|---|---|
| F0 touch (the grids) | 151,045 | +0.055 (t 14.23) [-0.052] | +0.049 (t 10.30) [-0.058] |
| F1 through 0.1 x ATR(14) M5 | 145,198 | +0.007 (t 1.74) [-0.101] | +0.001 (t 0.16) [-0.107] |
| F2 through half the round trip | 144,877 | +0.011 (t 2.94) [-0.095] | +0.006 (t 1.14) [-0.101] |
| F3 a close beyond the limit (bound) | 126,553 | -0.175 (t -42.22) [-0.283] | -0.182 (t -39.22) [-0.289] |
| MKT at the touching candle's close | 148,518 | +0.050 (t 11.44) [-0.060] | +0.037 (t 7.83) [-0.073] |

## What the stricter fills drop

| Rule | F0 fills dropped | Their R under F0 (trail) | The rest under F0 |
|---|---|---|---|
| F1 | 5,847 of 151,045 (3.9 %) | +1.035R a trade (t 41.79) | +0.015R (n 145,198) |
| F2 | 6,168 (4.1 %) | +0.933R a trade (t 31.63) | +0.017R (n 144,877) |
| F3 | 24,827 (16.4 %) | +0.976R a trade (t 76.05) | -0.126R (n 126,218) |

The suspicion holds. The touch-only fills are the ones where price reached the limit by a hair and turned at once, and they
won about +1R each. That is 4 % of the trades and about 0.04R of the 0.055R mean. A buy limit on a broker fills only when the
ASK reaches it, which on mid candles means about half a spread below. F2 is that minimum, and under it the tilt is +0.011R,
about zero after 2015. F3 is a bound the other way: requiring a close beyond keeps the losers and drops the winners, so it is
not a fair fill. The true fill lies between F2 and F0, nearer F2 for a retail limit order.

## By market (trailing exit, before costs; after costs in brackets)

| Market | F0 | F1 | F2 | MKT | Dropped by F1 / F2 |
|---|---|---|---|---|---|
| Gold | +0.030 (t 3.06) [-0.153] | -0.017 (t -1.78) | -0.045 (t -4.85) | +0.039 (t 4.16) [-0.147] | 3.7 % / 7.2 % |
| EUR/USD | +0.061 (t 7.48) [-0.018] | +0.010 (t 1.11) | +0.029 (t 3.43) [-0.050] | +0.047 (t 5.67) [-0.035] | 3.7 % / 2.6 % |
| GBP/USD | +0.057 (t 6.36) [-0.026] | +0.007 (t 0.79) | +0.023 (t 2.49) [-0.061] | +0.046 (t 5.49) [-0.041] | 3.9 % / 3.2 % |
| USD/JPY | +0.066 (t 8.31) [-0.048] | +0.022 (t 2.68) | +0.020 (t 2.39) [-0.095] | +0.065 (t 7.51) [-0.053] | 4.1 % / 4.6 % |
| AUD/USD | +0.058 (t 6.08) [-0.024] | +0.010 (t 0.98) | +0.023 (t 2.39) [-0.059] | +0.054 (t 5.21) [-0.030] | 4.0 % / 3.1 % |

## Reading

- The dominant zone's "+0.05R before costs" (the three grids, `dom-zone-holdout`, `dom-placebo`) is mainly a fill artefact of
  counting a touched mid-price limit as filled. That likely explains why `dom-placebo`'s random same-colour body did even
  better: any limit near the price gets the same free winners. With a realistic fill (F2) nothing is left in 2015-19, and
  every rule loses after costs.
- MKT, a market entry at the close of the touching candle, keeps +0.050R before costs (t 11.44, both halves positive). It
  was REPORTED, not tested; it was chosen with this data in view and still loses after costs (-0.060R). It is a hypothesis for
  its own pre-registration on other data at most, not a finding.
- Any limit-entry result on mid candles in this repository that counts a touch as a fill (combo-grid-2/3/4 'lim' entries,
  the zone readings) carries the same bias. A stricter fill rule (at least half the round trip through the limit) should be
  pre-registered for any future limit study.

Never call any of these an edge; nothing here is a trading rule. To repeat: `EDGE_DATA=<cache> node --max-old-space-size=6000
run.mjs market <m> <dir>` for the five markets, then `node run.mjs report <dir>`. Test: `tests/dom-trade-through.test.mjs`.
