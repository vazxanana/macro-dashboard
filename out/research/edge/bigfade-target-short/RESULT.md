# Big-candle fade with a target nearer than 50 % of the candle (result, 24 Nov 2026)

**Verdict: FAIL. No target nearer than 50 % is better: on 2005-14 the desk's 50 % is the best of the eight after costs (−0.061R a trade), and on 2015-26 every nearer target loses more (50 %: −0.246R; 40 %: −0.283R; 30 %: −0.378R; 20 %: −0.549R; 10 %: −0.640R with 21 % winners). More winners, smaller wins, the same cost.**

Paper research only, run once as pre-registered (`PREREGISTRATION.md`, pushed alone first); gate reproduced. Nothing live changed; the desk keeps its 50 % target.

| Target (share of the candle) | 2005-14 winners | 2005-14 before costs | 2005-14 after costs | 2015-26 winners | 2015-26 before costs | 2015-26 after costs (month t) | Already passed at the fill |
|---|---|---|---|---|---|---|---|
| 50 % (the desk) **(chosen)** | 32.7 % | +0.307R | −0.061R | 30.2 % | +0.193R | −0.246R (-20.3) | 0.0 % |
| 45 % | 35.3 % | +0.287R | −0.082R | 32.8 % | +0.179R | −0.260R (-21.25) | 0.0 % |
| 40 % | 38.4 % | +0.256R | −0.112R | 35.8 % | +0.156R | −0.283R (-24.1) | 0.0 % |
| 35 % | 41.7 % | +0.212R | −0.157R | 39.0 % | +0.118R | −0.321R (-28.86) | 0.0 % |
| 30 % | 45.1 % | +0.147R | −0.222R | 42.3 % | +0.061R | −0.378R (-34.84) | 0.0 % |
| 25 % | 48.6 % | +0.060R | −0.309R | 45.7 % | −0.018R | −0.457R (-44.39) | 0.0 % |
| 20 % | 44.3 % | −0.039R | −0.408R | 42.5 % | −0.110R | −0.549R (-57.24) | 8.0 % |
| 10 % | 21.3 % | −0.154R | −0.523R | 20.5 % | −0.201R | −0.640R (-76.26) | 48.1 % |

Trades: 47354 in 2005-14, 54443 in 2015-26, the same for every target. Costs: the shared table (assumed on five of the ten markets).
