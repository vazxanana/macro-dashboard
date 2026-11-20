# Gold's T1 breakout on oil and gas at the demo broker's measured spread (20 Nov 2026)

Paper research only. Method and bar fixed in `PREREGISTRATION.md` before any energy spread of the broker was read. Nothing live changed.

**Verdict: FAIL: T1 on wtico, bco, natgas at the demo's measured hourly spread, pooled −0.003R a trade net (n 5221, month t −0.17; 2016-20 −0.001R, 2021→ −0.004R; 40 of 40 placebos); fails: bothWindows, t2, cost2x**

| Series | n | Net R/trade | Gross R/trade | Net 2x | 2016-20 | 2021→ | Month t | Placebos | All checks |
|---|---|---|---|---|---|---|---|---|---|
| pool | 5221 | −0.003 | +0.059 | −0.065 | −0.001 | −0.004 | −0.17 | 40 of 40 | no |
| wtico (XTIUSD) | 2098 | +0.031 | +0.061 | +0.000 | +0.035 | +0.027 | +1.33 | 40 of 40 | no |
| bco (XBRUSD) | 1452 | +0.047 | +0.078 | +0.015 | +0.039 | +0.052 | +1.71 | 40 of 40 | no |
| natgas (XNGUSD) | 1671 | −0.088 | +0.039 | −0.215 | −0.114 | −0.076 | −3.24 | 33 of 40 | no |

Spread profiles (median quoted spread as a share of the mid, by UTC hour 00-20): wtico (XTIUSD) 3.2 3.1 3.1 3.1 3.0 3.1 3.1 3.0 3.0 3.1 3.0 2.2 2.5 2.1 2.3 2.1 2.1 2.1 2.1 2.3 3.1 bp; bco (XBRUSD) 3.8 3.0 2.9 2.9 2.9 2.8 2.9 2.8 2.9 2.8 2.8 2.8 2.9 2.9 2.9 2.8 2.8 2.8 2.8 2.9 2.8 bp; natgas (XNGUSD) 24.6 23.6 24.3 24.3 25.2 24.1 24.0 23.8 23.6 23.6 24.1 23.6 23.6 23.6 23.7 23.6 23.8 23.8 23.8 23.5 23.9 bp. Commission: 0 (none listed in the council's symbols file).
Harness gate (the original 0.1 % cost reproduces energy-vol-breakout): {"wtico":{"n":2098,"netR":-0.021,"t":-0.91,"want":{"n":2098,"netR":-0.021,"t":-0.91}},"bco":{"n":1452,"netR":-0.007,"t":-0.27,"want":{"n":1452,"netR":-0.007,"t":-0.27}},"natgas":{"n":1671,"netR":-0.012,"t":-0.44,"want":{"n":1671,"netR":-0.012,"t":-0.44}}}.

