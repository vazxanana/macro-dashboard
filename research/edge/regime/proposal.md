# Proposal: track a D1 ADX band on the Swing shadow setup (paper only, not implemented)

**Rule.** Tag Swing signals (H4→H1, against D1) with the D1 ADX(14) of the last closed daily candle. Follow the subset with ADX between 19.4 and 29.2 as a separate paper sleeve, "swing-adx". Leave the live Scalp and every other rule unchanged.

## Evidence

The data is HistData M1 from 2018 to Oct 2026, on gold and 5 FX pairs, with the engine unchanged and spread costs included. The table is in R per trade, net.

| | IS 2018-23 | OOS 2024-26 |
|---|---|---|
| Swing, owner rule (baseline) | n 529, −0.086 | n 202, +0.049 (t 0.43) |
| Swing + D1 ADX 19.4–29.2 | n 211, +0.113 (t 1.05) | n 67, **+0.290** (t 1.46), +19.4R, max drawdown −9.3R |

- **By OOS year:** 2024 +0.08, 2025 +0.20, 2026 +0.64.
- **Without 2026:** +0.118 over 45 trades.
- **At 1.5× cost:** +0.277.
- **Neighbouring bands agree OOS:**

  | ADX band | OOS R/trade | n |
  |---|---|---|
  | 18–28 | +0.42 | 78 |
  | 15–30 | +0.32 | 115 |
  | 20–25 | +0.52 | 37 |

## Risk

- **Weak statistics.** OOS t is 1.46 on 67 trades, and 722 variants were tried in this study, so chance could produce this.
- **The selection was imperfect.** The best in-sample pick for Swing, a realised-volatility gate, failed out of sample. This band was the 2nd-best pick.
- **The profit is concentrated.** Most OOS profit is USD/CHF and USD/CAD; EUR/USD and GBP/USD are negative.
- **IS was mixed.** Only 4 of 6 IS years are positive.
- **The replay is not the live setup.** It is signal-level, with no portfolio caps, and its D1 labels come from HistData rather than OANDA.

Adopt as a live rule only if the paper sleeve adds 50 or more forward trades at +0.1R a trade or better.
