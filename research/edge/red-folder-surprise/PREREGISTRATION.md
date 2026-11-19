# Red folder surprise: does gold's first hour follow the consensus miss? (pre-registration, 19 Nov 2026)

Written and committed before any result is computed. Owner's request: "a section of the most important red folders … what we
expect, what came out, how the market reacted, so we can prepare", and the owner's own research note
`research/macro-veteran/references/red-folder-news-data-and-strategy-v1-2026-11-19.md`, test B ("the signal uses the surprise
versus a timestamped consensus, not the raw level"). Until 19 Nov 2026 no consensus history was on file; it now is
(`council/consensus-history.json`, the community copy of the Forex Factory calendar, 2018 to 4 Apr 2025).

## Data (fixed)
- Events: the US CPI and payrolls (Employment Situation) releases in `council/event-base.json` (HistData M1 gold, clock of
  `council/histdata.mjs`; CPI from 2018, payrolls from 2022) whose time equals a row of `council/consensus-history.json`.
  FOMC is left out: the decision matched the calendar consensus at 55 of 57 meetings, so there is no miss to test.
- Consensus: the calendar's "Forecast" for Core CPI m/m and Non-Farm Employment Change. Actual: the veteran batch's first print
  (2022-24) where present, else the calendar's actual. Surprise = actual − consensus; a surprise of exactly 0 is no signal.
- Gold: `g5` (% from the release minute to T+5), `g5to60` (% from T+5 to T+60).
- In sample: 2018-2021 (CPI only). Out of sample: 2022 to 4 Apr 2025 (CPI and payrolls).

## Hypothesis
A hotter print (actual above consensus) is read as hawkish: gold DOWN; a cooler one gold UP. d = −sign(surprise).

- **T1, the reaction (descriptive):** share of events where sign(g5) = d, binomial test against 50 %.
- **T2, the trade (primary):** a position in direction d entered at T+5, out at T+60: R = d × g5to60 − 0.03 (the cost in % of
  price: a $0.60 round trip at $2,000 gold, more than the demo broker's measured gold spread plus commission). Mean over events,
  t-test against zero.
- **Pass (T2):** mean > 0 in sample AND out of sample, and out-of-sample t ≥ 2. Per type (CPI, payrolls) reported, not tested.
- Reported, not tested: the same with the surprise size above / below its median; T+0 to T+60 (not tradable: a fill at the
  release minute is not possible).

## Limits said in advance
- About 100 events; a pass at t ≥ 2 would still be a small sample, not a proven edge.
- A calendar consensus collected by a third party, not a verified survey with a capture time.
- HistData mid prices, no spread widening at the release, no slippage beyond the fixed cost: a demo record is the real test.
- Nothing live changes whatever the result (absolute rule 3); a pass becomes a proposal, a fail is written up as such.
