# Early against late fills of the volatility breakout, at the broker's own fills (vb-early-exec, 24 Nov 2026)

**Verdict: PASS: T1 at the demo broker's own fills, 24 Nov 2023 → Nov 2026, early (fill candle before 06:00 UTC) minus late: pooled early +0.3328R (n 387) vs late +0.0805R (n 756), difference +0.2523R, Welch t 2.4162, Holm p 0.0481; month t 2.4668**

Paper research only; nothing live changed. Method, split and bar fixed in `PREREGISTRATION.md`, pushed alone before the split was computed.

Gate (each exec study's published figures reproduced from its own code and probe files): gold n 572 / +0.1838R / month t 3.5384 (equal), USD/JPY n 564 / +0.1478R / month t 3.1083 (equal).

R a trade after the broker's commission; a trade the broker never filled counts 0 in its group (as the exec studies counted it). Month t of early / late alone = t of their month sums; "month t" of the difference = t of (early month mean minus late month mean) over months with both.

| Market | Early n | Early R | Early month t | Late n | Late R | Late month t | Early − late | Welch t | Holm p | Month t |
|---|---|---|---|---|---|---|---|---|---|---|
| pooled | 387 | +0.3328 | 3.988 | 756 | +0.0805 | 1.9513 | +0.2523 | 2.4162 | 0.0481 | 2.4668 (37 mo) |
| gold | 180 | +0.4436 | 3.3253 | 395 | +0.0655 | 1.2199 | +0.3782 | 2.4015 | 0.0481 | 2.1264 (37 mo) |
| USD/JPY | 207 | +0.2364 | 1.9743 | 361 | +0.097 | 1.7169 | +0.1394 | 0.9992 | 0.3185 | 0.9148 (37 mo) |

Reported only, the split on the broker's own entry tick time (filled trades): gold early +0.4461R (n 179) vs late +0.0658R (n 393), t 2.4021; USD/JPY early +0.2364R (n 207) vs late +0.098R (n 357), t 0.9895; 0 trades change side between the two clocks.

| Market | Year | Early n | Early R | Late n | Late R |
|---|---|---|---|---|---|
| gold | 2023 | 3 | +1.0575 | 15 | +0.3387 |
| gold | 2024 | 42 | +0.2603 | 156 | +0.0189 |
| gold | 2025 | 68 | +0.6166 | 122 | -0.0301 |
| gold | 2026 | 67 | +0.3556 | 102 | +0.2108 |
| USD/JPY | 2023 | 7 | +1.4727 | 10 | -0.1712 |
| USD/JPY | 2024 | 65 | +0.2013 | 126 | +0.2005 |
| USD/JPY | 2025 | 75 | +0.1502 | 128 | +0.0326 |
| USD/JPY | 2026 | 60 | +0.2378 | 97 | +0.0749 |

**What carries it.** The pooled bar is cleared just (Holm p 0.0481); gold's difference is +0.3782R (t 2.4015) and USD/JPY's has the same sign but is small against its noise (+0.1394R, t 0.9992, month t 0.9148). Late fills are still positive on both markets.

**Read with care.** These years are in sample for T1 (both exec studies read them, and the hour split was first seen on OANDA mid candles that include them). This measures the split at real execution; a PASS is a hypothesis for the forward records, never an edge or a rule change. Nothing live changed.

To repeat: `node research/edge/vb-early-exec/run.mjs fetch <dir>`, then `node research/edge/vb-early-exec/run.mjs run <dir>`.
