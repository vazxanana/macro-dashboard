# The 20-22 UTC Break fade at the broker's bid / ask ticks (result)

**Verdict: INCONCLUSIVE. At the broker's own bid and ask the 20-21 UTC Break fade made −0.452R a trade after commission (n 354, month t -3.9827). On mid candles the same orders made +0.075R; 119 of 523 had no quote to enter on.**

Run 2026-11-25 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. These hours were chosen after looking at these same years: a measurement of execution.

## What was run

Every `m15 none atr 2R all` fade (the first M15 structure break, entered against it at market, stop 1 x ATR(14) of M15, target 2R,
out after a day) whose break candle starts at 20, 21 or 22 UTC, XAUUSD and USDJPY, 2023-12-01 to 2026-11-20. Entry at the
broker's ask (buy) or bid (sell) at the fill moment; stop when the closing side reaches it (booked at that tick), target when the
closing side reaches it, else the quote at the deadline. R after commission is the verdict's line.

## Primary block: breaks at 20:00-21:59 UTC

| | Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R | Mid after flat cost | Tick − mid (month t) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Both markets | 523 | 119 | 50 | 354 | 28.0 % | −0.368 (-3.3629) | −0.452 (-3.9827) | +0.075 | −0.042 | −0.443 (-4.6148) |
| XAUUSD | 205 | 53 | 1 | 151 | 31.8 % | −0.190 (-1.5669) | −0.234 (-1.9061) | −0.158 | −0.259 | −0.032 (-0.7263) |
| USDJPY | 318 | 66 | 49 | 203 | 25.1 % | −0.501 (-3.281) | −0.613 (-3.8946) | +0.248 | +0.119 | −0.749 (-4.3009) |

## By hour (both markets)

| Break hour (UTC) | Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R | Mid after flat cost | Tick − mid (month t) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 | 333 | 69 | 28 | 236 | 33.1 % | −0.158 (-1.5602) | −0.230 (-2.2518) | +0.097 | −0.011 | −0.255 (-3.1569) |
| 21 | 190 | 50 | 22 | 118 | 17.8 % | −0.789 (-4.0729) | −0.894 (-4.3783) | +0.031 | −0.104 | −0.820 (-3.6046) |
| 22 | 372 | 9 | 50 | 313 | 29.7 % | −0.159 (-1.8669) | −0.242 (-2.9117) | −0.003 | −0.116 | −0.156 (-4.4673) |

## By hour and market

| Hour | Market | Resolved | Won | After commission (month t) | Mid R | Entry spread in R: median / 90th |
|---|---|---:|---:|---:|---:|---:|
| 20 | XAUUSD | 124 | 31.4 % | −0.256 (-1.7386) | −0.181 | 0.0217 / 0.0686 |
| 20 | USDJPY | 112 | 34.8 % | −0.202 (-1.2906) | +0.405 | 0.0063 / 0.094 |
| 21 | XAUUSD | 27 | 33.3 % | −0.133 (-0.5185) | −0.051 | 0.0285 / 0.0604 |
| 21 | USDJPY | 91 | 13.2 % | −1.120 (-4.2941) | +0.056 | 0.5268 / 1.8647 |
| 22 | XAUUSD | 142 | 30.3 % | −0.167 (-1.216) | −0.049 | 0.0213 / 0.0623 |
| 22 | USDJPY | 171 | 29.2 % | −0.304 (-2.3615) | +0.035 | 0.0359 / 0.8856 |

## Exits (primary block)

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| stop | 247 | −1.270 | −1.356 | −0.744 |
| target | 90 | +2.000 | +1.922 | +2.244 |
| time | 17 | +0.190 | +0.122 | +0.497 |

## Inside the rollover or not (primary block)

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 48 | −0.947 | −1.019 | −0.688 |
| open inside 21:00-22:59 | 306 | −0.278 | −0.362 | +0.195 |

## By year (primary block)

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 10 | −0.600 | −0.667 | −0.284 |
| 2024 | 98 | −0.083 | −0.160 | +0.357 |
| 2025 | 134 | −0.355 | −0.426 | −0.034 |
| 2026 | 112 | −0.614 | −0.717 | −0.010 |

## By side (primary block)

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| buy | 162 | −0.504 | −0.590 | +0.012 |
| sell | 192 | −0.254 | −0.335 | +0.128 |

Entry spread paid, in R (primary block): median 0.0276, 90th percentile 0.8913. Exit-unresolved reasons: {"no deadline quote":1,"window not read":49}.

## What it means

At the broker's own bid and ask the late-evening Break fade loses: −0.452R a trade after commission on 354 resolved orders (month t −3.98). The mid-candle +0.075R does not survive execution: the entry spread alone is wide at 21:00 UTC, the rollover hour, where USD/JPY paid a median 0.53R and lost −1.12R a trade. Gold is about −0.23R at every hour.
The verdict stays INCONCLUSIVE on the pre-registered coverage rule: 119 of 523 orders had no quote to enter on and 50 had an unresolved exit (49 "window not read", almost all USD/JPY), so the resolved set is not the whole sample. Even so, no hour or market is positive after commission.
Do not trade the 20-22 UTC window. These hours were picked after looking at the same years, so this is a measurement of execution, not a rule. Nothing live changed and no rule is proposed.
