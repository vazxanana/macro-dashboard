# Proposal: drop Friday ICT A-setups (paper only, not implemented)

## Rule

An iFVG signal whose inversion candle closes on a Friday (New York time) is not an A-setup. It is still recorded as an ordinary signal.

## Evidence

The test used the desk's own model code on HistData NQ, ES and GC proxies from 2018 to Oct 2026. The rule was chosen in-sample (2018–23) and then checked out-of-sample (2024–26). Results are net of 2 ticks per round trip:

| | in-sample (2018–23) | out-of-sample (2024–26) |
|---|---|---|
| A-setups, baseline | n 910, +0.091R/trade, max DD 33.1R | n 411, +0.125R/trade, max DD 16.0R |
| A-setups without Friday | n 772, +0.142R/trade, max DD 24.0R | n 354, +0.156R/trade, max DD 11.3R |
| the Friday A-setups alone | n 157, −0.141R/trade | n 63, −0.091R/trade |

- With the rule, 8 of 9 years are positive, including every out-of-sample year.
- Friday is negative in all three markets in-sample.
- The rule still passes at 2× costs (OOS +0.143 vs +0.112).
- Dropping Friday also helps the all-signal population: +0.057 → +0.066 OOS.

## Risk

- The out-of-sample gain is small: +0.03R/trade, with a kept-vs-dropped t of only 1.4. The rule is one of 64 variants tried, so part of the gain may be luck.
- 2025 Fridays were positive (+5.2R).
- The mechanism is plausible but unproven. A Friday signal's 36-candle window runs over the weekend: the time exit and the weekend gap both land on a position that is still open.
- If adopted, forward-test it on the paper tracker for at least 3 months before anything else depends on it.
