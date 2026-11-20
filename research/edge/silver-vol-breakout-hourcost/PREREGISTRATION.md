# Pre-registration: silver-vol-breakout-hourcost (20 Nov 2026)

Paper research only. **Cost accounting of a rule that already FAILED; no rule is tested and the failed verdict of
`silver-vol-breakout` stands whatever this finds.** That study ran gold's T1 breakout (UTC open ± 0.5 × the previous day's
range, stop at the open, out at 21:00 UTC) unchanged on silver: before costs +0.086R a trade 2016 → 12 Nov 2026 (n 2,015, gross
month t 3.37), after its assumed $0.03 a round trip −0.084R (t −3.04). The gold study of the same day
(`gold-vol-breakout-hourcost`) found the demo's real gold cost far below the studies' figure. This asks the same question of
silver, and nothing else: **at the demo broker's measured XAGUSD spreads, is silver T1 positive net, and with month t ≥ 2?**

Written and pushed alone, **before any silver quote of the broker is read**: the tick probe has not been run for XAGUSD.

Choosing to re-cost a failed rule after seeing that a cost assumption mattered is a choice made after a result. So: a positive
answer here is a lead for a fresh test, never a pass, never a reason to trade silver.

## Rule and trades

`research/edge/silver-vol-breakout/run.mjs` (sha256 98c665ed7743fdafc078a9fa1c3c44e32efbc4b287f31dd4772971dc09dfcfe0),
imported, unchanged: `buildDays`, `eligible`, `vbTrade`, `monthT`, `normP`, `inW`, `WINDOWS`. OANDA mid M5 XAG/USD from the
candle proxy, kept out of git, the same span as the study (data end 12 Nov 2026).

**Gate**: with the study's own $0.03, IS / OOS / ALL must reproduce its result.json exactly (n, net R, gross R, month t); else stop.

## Measurement and cost

council-data `research/probe/ticks-XAGUSD.json` (the first tick-probe run for XAGUSD, `hours` part): `hourProfile[h].frac` /
`.frac90`; commission = XAGUSD `commissionRT` in council-data `ctrader/symbols.json` if listed, else the gold figure 0.000024 (said).
Not measurable (stop, report only that): no file, fewer than 20 weekdays, or an hour 00-20 with fewer than 10 windows.

Route H: cost = (0.5 × frac[h_fill] + 0.5 × frac[20] + commission) × entry; H90 with frac90; stop slippage s × M (M = median range
of the 12 M5 candles ending with the fill candle), s ∈ {0, 0.05, 0.10}. Conditions, judged on 2021 → data end and on 2016 → data
end: **C1 = H + 0.05 × M**, **C2 = H90 + 0.10 × M**; "holds" = net R > 0 with month t ≥ 2; Holm over the four.

## Deliverables

`research/edge/silver-vol-breakout-hourcost/{PREREGISTRATION.md, run.mjs, RESULT.md, result.json}`, a test.
