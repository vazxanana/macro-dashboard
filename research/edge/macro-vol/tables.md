# Macro strategist: move-size models vs the naive 20-day mean

Walk-forward, no look-ahead: each forecast uses only the daily candles before its day (OANDA via meridianx.dev). Event days are CPI / NFP / FOMC days from council/events.mjs. VIX: council-data macro/cache.json, 300 days from 2025-09-09 (FRED was not reachable).
Models tried: 4 (evt = same-type event median × vol ratio; ewma = EWMA vol × event-day ratio; har = HAR-lite with event dummies; vix = VIX-implied move). The VIX model is only for ES and NQ. Reference rows: naive (the baseline) and cur (the model before this change).
MAE is in % of price (lower is better). QLIKE = ln h + r²/h with h = (π/2)·forecast² (lower is better). DM is the Diebold-Mariano t of the loss gap vs naive (positive = better than naive; |t| ≥ 2 is significant).

| Market | Picked on the first half | Used | Why |
|---|---|---|---|
| Gold | — | naive | none of the 3 models beat naive on the first half (to 2025-02-14) |
| EUR/USD | — | naive | none of the 3 models beat naive on the first half (to 2025-02-18) |
| USD/JPY | — | naive | none of the 3 models beat naive on the first half (to 2025-02-18) |
| NQ (Nasdaq 100) | ewma | naive | ewma won the first half but did not beat naive on the second half (from 2025-02-17) |
| ES (S&P 500) | ewma | naive | ewma won the first half but did not beat naive on the second half (from 2025-02-17) |

## Full walk-forward window

### Gold (2023-05-26 to 2026-11-06; 898 days, 107 event days; average move 0.972% on event days vs 0.859% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.579 / 0.587 | 2.118 / 1.335 | 0.99 / -3.28 | 0.692 / 0.669 | 2.96 / 1.78 | -0.68 / -1.17 | no |
| evt | 0.592 / 0.587 | 1.458 / 1.335 | -1.25 / -2.3 | 0.709 / 0.669 | 2.813 / 1.78 | -1.26 / -2.35 | no |
| ewma | 0.583 / 0.587 | 1.284 / 1.335 | 0.72 / 1.08 | 0.743 / 0.669 | 1.66 / 1.78 | -2.81 / 0.56 | no |
| har | 0.58 / 0.587 | 1.321 / 1.335 | 0.93 / 0.31 | 0.752 / 0.669 | 1.73 / 1.78 | -2.91 / 0.28 | no |

### EUR/USD (2023-05-31 to 2026-11-06; 898 days, 108 event days; average move 0.44% on event days vs 0.288% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.2 / 0.204 | -0.493 / -0.706 | 1.62 / -3.24 | 0.315 / 0.298 | 0.509 / 0.883 | -1.07 / 1.18 | no |
| evt | 0.206 / 0.204 | -0.76 / -0.706 | -1.16 / 1.35 | 0.315 / 0.298 | 0.436 / 0.883 | -1.17 / 1.36 | no |
| ewma | 0.202 / 0.204 | -0.848 / -0.706 | 0.9 / 3.73 | 0.308 / 0.298 | 0.01 / 0.883 | -0.63 / 3 | no |
| har | 0.204 / 0.204 | -0.851 / -0.706 | -0.03 / 3.35 | 0.316 / 0.298 | -0.003 / 0.883 | -0.97 / 2.74 | no |

### USD/JPY (2023-05-31 to 2026-11-06; 898 days, 108 event days; average move 0.561% on event days vs 0.395% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.28 / 0.287 | 0.987 / 0.092 | 1.51 / -3.75 | 0.409 / 0.348 | 0.74 / 1.136 | -2.68 / 1.07 | no |
| evt | 0.288 / 0.287 | 0.011 / 0.092 | -0.84 / 1.56 | 0.36 / 0.348 | 0.468 / 1.136 | -0.84 / 1.57 | no |
| ewma | 0.29 / 0.287 | -0.087 / 0.092 | -0.98 / 2.5 | 0.396 / 0.348 | 0.432 / 1.136 | -1.93 / 1.48 | no |
| har | 0.296 / 0.287 | -0.139 / 0.092 | -2.16 / 2.6 | 0.396 / 0.348 | 0.402 / 1.136 | -1.7 / 1.37 | no |

### NQ (Nasdaq 100) (2023-05-29 to 2026-11-06; 898 days, 108 event days; average move 1.176% on event days vs 0.865% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.616 / 0.633 | 1.679 / 1.438 | 1.79 / -3.58 | 0.809 / 0.778 | 1.83 / 2.219 | -0.69 / 1.64 | no |
| evt | 0.635 / 0.633 | 1.405 / 1.438 | -0.34 / 1.47 | 0.79 / 0.778 | 1.942 / 2.219 | -0.34 / 1.49 | no |
| ewma | 0.627 / 0.633 | 1.452 / 1.438 | 0.94 / -0.31 | 0.806 / 0.778 | 1.879 / 2.219 | -0.77 / 1.65 | no |
| har | 0.625 / 0.633 | 1.386 / 1.438 | 1.02 / 1.15 | 0.807 / 0.778 | 1.903 / 2.219 | -0.65 / 1.42 | no |
| vix (n 182) | 0.678 / 0.668 | 1.792 / 1.789 | -0.53 / -0.05 | 0.817 / 0.778 | 3.033 / 2.829 | -0.7 / -1.16 | no |

### ES (S&P 500) (2023-05-29 to 2026-11-06; 898 days, 108 event days; average move 0.852% on event days vs 0.595% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.429 / 0.448 | 1.077 / 0.764 | 2.81 / -3.19 | 0.569 / 0.559 | 1.127 / 1.806 | -0.33 / 1.69 | no |
| evt | 0.45 / 0.448 | 0.734 / 0.764 | -0.57 / 0.7 | 0.574 / 0.559 | 1.559 / 1.806 | -0.57 / 0.7 | no |
| ewma | 0.442 / 0.448 | 0.771 / 0.764 | 1.14 / -0.1 | 0.606 / 0.559 | 1.241 / 1.806 | -1.67 / 1.5 | no |
| har | 0.44 / 0.448 | 0.643 / 0.764 | 1.25 / 1.81 | 0.601 / 0.559 | 1.252 / 1.806 | -1.17 / 1.32 | no |
| vix (n 182) | 0.409 / 0.438 | 0.706 / 0.884 | 3.13 / 2.21 | 0.495 / 0.543 | 1.401 / 1.734 | 1.96 / 2.67 | yes |

## Selection half

### Gold (2023-05-26 to 2025-02-13; 449 days, 55 event days; average move 0.8% on event days vs 0.613% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.423 / 0.432 | 0.891 / 0.699 | 1.05 / -2.5 | 0.58 / 0.542 | 1.209 / 1.159 | -0.87 / -0.27 | no |
| evt | 0.434 / 0.432 | 0.696 / 0.699 | -0.63 / 0.2 | 0.561 / 0.542 | 1.137 / 1.159 | -0.63 / 0.2 | no |
| ewma | 0.433 / 0.432 | 0.747 / 0.699 | -0.21 / -1.31 | 0.595 / 0.542 | 1.207 / 1.159 | -1.41 / -0.33 | no |
| har | 0.438 / 0.432 | 0.738 / 0.699 | -0.78 / -0.86 | 0.637 / 0.542 | 1.22 / 1.159 | -2.18 / -0.35 | no |

### EUR/USD (2023-05-31 to 2025-02-17; 449 days, 55 event days; average move 0.455% on event days vs 0.281% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.197 / 0.2 | -0.637 / -0.717 | 0.61 / -0.96 | 0.329 / 0.308 | 0.105 / 0.97 | -0.73 / 2.07 | no |
| evt | 0.202 / 0.2 | -0.824 / -0.717 | -0.62 / 2.11 | 0.323 / 0.308 | 0.096 / 0.97 | -0.62 / 2.19 | no |
| ewma | 0.2 / 0.2 | -0.856 / -0.717 | 0.13 / 2.88 | 0.315 / 0.308 | 0.116 / 0.97 | -0.32 / 2.37 | no |
| har | 0.202 / 0.2 | -0.863 / -0.717 | -0.53 / 2.48 | 0.328 / 0.308 | 0.033 / 0.97 | -0.69 / 2.1 | no |

### USD/JPY (2023-05-31 to 2025-02-17; 449 days, 55 event days; average move 0.666% on event days vs 0.407% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.303 / 0.306 | 0.71 / 0.191 | 0.52 / -2.19 | 0.505 / 0.409 | 1.379 / 2.094 | -2.27 / 1.01 | no |
| evt | 0.307 / 0.306 | 0.038 / 0.191 | -0.08 / 1.53 | 0.411 / 0.409 | 0.849 / 2.094 | -0.08 / 1.56 | no |
| ewma | 0.305 / 0.306 | -0.039 / 0.191 | 0.22 / 1.89 | 0.43 / 0.409 | 0.789 / 2.094 | -0.53 / 1.47 | no |
| har | 0.316 / 0.306 | -0.043 / 0.191 | -1.38 / 1.61 | 0.433 / 0.409 | 0.742 / 2.094 | -0.52 / 1.36 | no |

### NQ (Nasdaq 100) (2023-05-29 to 2025-02-14; 449 days, 55 event days; average move 1.119% on event days vs 0.766% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.549 / 0.564 | 1.337 / 1.178 | 1.26 / -2.07 | 0.726 / 0.735 | 1.688 / 2.107 | 0.14 / 1.26 | no |
| evt | 0.56 / 0.564 | 1.126 / 1.178 | 0.5 / 1.37 | 0.706 / 0.735 | 1.684 / 2.107 | 0.5 / 1.4 | yes |
| ewma | 0.553 / 0.564 | 1.109 / 1.178 | 1.44 / 1.7 | 0.704 / 0.735 | 1.657 / 2.107 | 0.62 / 1.49 | yes |
| har | 0.556 / 0.564 | 1.122 / 1.178 | 0.79 / 1.24 | 0.75 / 0.735 | 1.731 / 2.107 | -0.19 / 1.08 | no |
| vix | no forecasts in this window | | | | | | |

### ES (S&P 500) (2023-05-29 to 2025-02-14; 449 days, 55 event days; average move 0.823% on event days vs 0.525% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.369 / 0.389 | 0.696 / 0.493 | 2.43 / -1.54 | 0.515 / 0.535 | 1.128 / 1.989 | 0.43 / 1.19 | no |
| evt | 0.385 / 0.389 | 0.388 / 0.493 | 0.65 / 1.29 | 0.506 / 0.535 | 1.138 / 1.989 | 0.65 / 1.31 | yes |
| ewma | 0.382 / 0.389 | 0.375 / 0.493 | 1.21 / 1.34 | 0.514 / 0.535 | 1.082 / 1.989 | 0.6 / 1.32 | yes |
| har | 0.386 / 0.389 | 0.379 / 0.493 | 0.33 / 1.18 | 0.553 / 0.535 | 1.156 / 1.989 | -0.32 / 1.08 | no |
| vix | no forecasts in this window | | | | | | |

## Confirmation half

### Gold (2025-02-14 to 2026-11-06; 449 days, 52 event days; average move 1.153% on event days vs 1.104% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.735 / 0.742 | 3.344 / 1.971 | 0.52 / -2.93 | 0.81 / 0.804 | 4.811 / 2.437 | -0.12 / -1.16 | no |
| evt | 0.749 / 0.742 | 2.219 / 1.971 | -1.08 / -2.35 | 0.866 / 0.804 | 4.586 / 2.437 | -1.09 / -2.47 | no |
| ewma | 0.733 / 0.742 | 1.821 / 1.971 | 0.97 / 1.73 | 0.899 / 0.804 | 2.139 / 2.437 | -2.63 / 0.73 | no |
| har | 0.723 / 0.742 | 1.905 / 1.971 | 1.58 / 0.92 | 0.874 / 0.804 | 2.268 / 2.437 | -1.94 / 0.52 | no |

### EUR/USD (2025-02-18 to 2026-11-06; 449 days, 53 event days; average move 0.424% on event days vs 0.296% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.202 / 0.209 | -0.35 / -0.695 | 1.75 / -3.42 | 0.301 / 0.287 | 0.928 / 0.793 | -0.98 / -0.29 | no |
| evt | 0.211 / 0.209 | -0.696 / -0.695 | -1.3 / 0.01 | 0.306 / 0.287 | 0.789 / 0.793 | -1.32 / 0.01 | no |
| ewma | 0.205 / 0.209 | -0.841 / -0.695 | 1.11 / 2.46 | 0.3 / 0.287 | -0.1 / 0.793 | -0.56 / 1.93 | no |
| har | 0.207 / 0.209 | -0.838 / -0.695 | 0.53 / 2.26 | 0.303 / 0.287 | -0.04 / 0.793 | -0.7 / 1.78 | no |

### USD/JPY (2025-02-18 to 2026-11-06; 449 days, 53 event days; average move 0.453% on event days vs 0.382% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.257 / 0.267 | 1.264 / -0.007 | 1.98 / -3.08 | 0.31 / 0.284 | 0.078 / 0.141 | -1.73 / 0.41 | no |
| evt | 0.269 / 0.267 | -0.015 / -0.007 | -2.34 / 0.31 | 0.307 / 0.284 | 0.072 / 0.141 | -2.46 / 0.31 | no |
| ewma | 0.275 / 0.267 | -0.135 / -0.007 | -1.84 / 1.69 | 0.36 / 0.284 | 0.061 / 0.141 | -2.59 / 0.3 | no |
| har | 0.276 / 0.267 | -0.235 / -0.007 | -1.78 / 2.25 | 0.357 / 0.284 | 0.048 / 0.141 | -2.36 / 0.28 | no |

### NQ (Nasdaq 100) (2025-02-17 to 2026-11-06; 449 days, 53 event days; average move 1.234% on event days vs 0.963% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.684 / 0.703 | 2.022 / 1.699 | 1.29 / -2.92 | 0.895 / 0.822 | 1.978 / 2.335 | -1.24 / 1.05 | no |
| evt | 0.709 / 0.703 | 1.684 / 1.699 | -1.52 / 0.59 | 0.877 / 0.822 | 2.21 / 2.335 | -1.55 / 0.59 | no |
| ewma | 0.701 / 0.703 | 1.794 / 1.699 | 0.2 / -1.25 | 0.913 / 0.822 | 2.109 / 2.335 | -1.75 / 0.81 | no |
| har | 0.694 / 0.703 | 1.651 / 1.699 | 0.68 / 0.61 | 0.867 / 0.822 | 2.08 / 2.335 | -0.9 / 0.92 | no |
| vix (n 182) | 0.678 / 0.668 | 1.792 / 1.789 | -0.53 / -0.05 | 0.817 / 0.778 | 3.033 / 2.829 | -0.7 / -1.16 | no |

### ES (S&P 500) (2025-02-17 to 2026-11-06; 449 days, 53 event days; average move 0.882% on event days vs 0.664% on other days)

| Model | MAE all (model / naive) | QLIKE all | DM MAE / QLIKE | MAE event days | QLIKE event days | DM MAE / QLIKE (event) | Beats naive |
|---|---|---|---|---|---|---|---|
| cur | 0.489 / 0.508 | 1.458 / 1.036 | 1.71 / -2.91 | 0.625 / 0.584 | 1.127 / 1.615 | -1.11 / 1.53 | no |
| evt | 0.515 / 0.508 | 1.081 / 1.036 | -2.12 / -1.9 | 0.645 / 0.584 | 1.996 / 1.615 | -2.2 / -1.96 | no |
| ewma | 0.502 / 0.508 | 1.166 / 1.036 | 0.65 / -1.4 | 0.702 / 0.584 | 1.405 / 1.615 | -2.72 / 0.76 | no |
| har | 0.495 / 0.508 | 0.906 / 1.036 | 1.29 / 1.39 | 0.651 / 0.584 | 1.352 / 1.615 | -1.53 / 0.93 | no |
| vix (n 182) | 0.409 / 0.438 | 0.706 / 0.884 | 3.13 / 2.21 | 0.495 / 0.543 | 1.401 / 1.734 | 1.96 / 2.67 | yes |

