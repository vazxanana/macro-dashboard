# Proposal (paper only, not implemented): gold M30→M1, London session only

**Rule change, in one sentence.** For the gold `m30m1` setup, replace the D1 filter (`d1: 'with'`) with `noSession: ['asia', 'overlap', 'newyork', 'late']`, so it trades only 07:00–12:00 UTC, and keep it in **shadow**.

**Evidence.** HistData spot gold, 2018-07 to 2026-10. Same engine and replay as `backtest.mjs`. Net of a 0.30 spread. Scalp duplicates are removed. The rule was chosen in-sample on 2018–2023.

| | n | net R per trade | total | t | max drawdown |
|---|---|---|---|---|---|
| IS (2018–2023) | 289 | +0.032 | +9.3R | 0.26 | |
| OOS (2024–2026) | 128 | +0.222 | +28.5R | 1.05 | −10.4R |

- OOS by year: 2024 −6.0R, 2025 +14.5R, 2026 +20.0R.
- Today's "with D1" makes +0.216 OOS but −0.144 IS. No D1 filter at all makes +0.123 OOS and −0.081 IS.

**Risk. The evidence is too weak to go live.**
- The in-sample edge is zero (t 0.26).
- The out-of-sample t is about 1 after 392 variants tried.
- The gain comes from the 2025–26 gold uptrend.
- 2021 (−12.8R) and 2024 (−6.0R) were losing years.
- Recommendation: run it as a shadow filter next to the current one, and promote it only if it stays positive over a further 100+ live-shadow trades.
