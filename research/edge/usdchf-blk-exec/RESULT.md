# The USD/CHF block-break fade at the broker's bid / ask ticks (result)

**Verdict: FAIL. At the broker's own bid and ask the USD/CHF block-break fade made −0.011R a trade after commission (n 185, month t -0.2611). On mid candles the same orders made +0.081R; 0 of 185 had no quote to enter on.**

Run 2026-11-25 as pre-registered (`PREREGISTRATION.md`, committed and pushed alone first). Paper research only: nothing live
changed, no rule is proposed. The rule is the auto-researcher's one lead, found on these same years.

## What was run

Every order of the lead (the 19:00 UTC H1 close beyond the previous 3 candles' range, faded at the 20:00 open; stop 1 x ATR(14), target 0.5R, out at 00:00 UTC), 2023-12-01 to 2026-11-20.
Entry at the broker's ask (buy) or bid (sell); stop and target when the closing side reaches them; else the quote at the deadline.

| Orders | No entry quote | Exit unresolved | Resolved | Won | Tick R (month t) | After commission (month t) | Mid R (engine cost) | Tick − mid (month t) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 185 | 0 | 0 | 185 | 62.2 % | +0.022 (0.5248) | −0.011 (-0.2611) | +0.081 | −0.059 (-2.0952) |

## Exits

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| stop | 31 | −1.064 | −1.096 | −0.746 |
| target | 88 | +0.500 | +0.466 | +0.420 |
| time | 66 | −0.105 | −0.138 | +0.017 |

## Inside the rollover or not

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| never open inside 21:00-22:59 | 47 | +0.211 | +0.179 | +0.145 |
| open inside 21:00-22:59 | 138 | −0.042 | −0.076 | +0.059 |

## By year

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| 2023 | 4 | −0.313 | −0.341 | −0.057 |
| 2024 | 64 | −0.131 | −0.167 | −0.002 |
| 2025 | 64 | +0.014 | −0.017 | +0.098 |
| 2026 | 53 | +0.242 | +0.209 | +0.170 |

## By side

| | n | Tick R | After commission | Mid R |
|---|---:|---:|---:|---:|
| buy | 87 | −0.050 | −0.082 | +0.046 |
| sell | 98 | +0.086 | +0.052 | +0.111 |

Entry spread paid, in R: median 0, 90th percentile 0.0228. Exit-unresolved reasons: {}.

## What it means

The researcher's one lead does not survive the broker's quotes. On the 185 orders of 2023-12 to 2026-11 the fade made +0.081R a
trade on mid candles with the engine's 0.7 pip cost, and −0.011R after commission when filled at the demo broker's own bid and ask
(month t −0.26): zero, not an edge. Every order had a quote to enter on and every exit was resolved, so the number is not a
coverage artefact. The spread cost about 0.06R a trade (tick minus mid −0.059R, month t −2.10), which is the whole of the lead.

The audit's suspicion was right: 138 of the 185 trades were open inside the 21:00-22:59 UTC rollover and made −0.076R after
commission against +0.179R for the 47 that were not. That split was found after the result on 47 trades and is not a rule; it is
the same shape the late-evening Break fade showed, and a hypothesis at best.

The lead does not go to a forward record. One out of 262 holdout looks, with one chance candidate expected by luck, filled at the
broker's price makes nothing. Do not test variants of this rule on these years.
