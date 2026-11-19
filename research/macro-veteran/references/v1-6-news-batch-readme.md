# GPTMacro V1.6 — red-folder news research increment

This ZIP is an **increment after V1.5**, for the assistant's private MeridianX research and cTrader **demo** integration. It contains no credentials or live-order instructions. Keep the V1.5 quality/vintage controls in force. Source pages, release clocks and original prints must remain separate from later revisions and receipt times.

## What was added

- [News-trading strategy register V2](news-trading-strategy-register-v2-2026-11-19.md): ten distinct event hypotheses, priority and data gates; no validated trading edge.
- [Red-folder data and strategy V1](red-folder-news-data-and-strategy-v1-2026-11-19.md): forecast-versus-execution split and point-in-time event contract.
- [PPI/CPI schedule-order audit](ppi-cpi-release-order-2022-2024.json): PPI scheduled before same-reference-month CPI in 5/36 cases, after it in 31/36.
- [36-month CPI/PPI→PCE source panel](cpi-ppi-to-pce-release-panel-2022-2024.csv), with PPI and BEA source-extraction evidence. Both CPI and PPI were scheduled before PCE in 36/36 matched cases; original web publication times remain unauthenticated.
- [Expanding model check](cpi-ppi-to-pce-expanding-model-check-2022-2024.md): 12 months initial training, 24 rolling evaluations. Core CPI+one broad PPI measure made only a tiny, unstable improvement over core CPI alone. It is **not** a trading signal.

## Assistant implementation instructions

1. Use the CSV/JSON ledgers as an evidence and research seed, not as a live strategy. Preserve the source URL, dated print, scheduled/embargo clock and unknown actual publication clock for each observation.
2. Do not convert the exploratory model result into orders. The next model needs BEA's **historical component-to-source map** and an untouched prospective ledger.
3. For demo news trading, capture timestamped consensus, first-release receipt, cTrader executable bid/ask ticks, spreads, latency, missed/rejected orders, and conflicting simultaneous releases before scoring any rule.
4. Keep `CTRADER_ENV=demo`. Do not enable live order routing or expose credentials in logs, ZIPs, source files or client-side code.
5. Prioritize CPI, Employment Situation and FOMC post-release studies, then Treasury auctions, retail and other paths in the strategy register. A macro forecast score and an executable trading return must be scored separately.

## Reproduction and limitations

The `work/` scripts reproduce the release-order audit, joined panel, and retrospective score from the supplied small source ledgers. The five-month pilot files are retained as an audit trail; the 36-month files supersede them for model scope. Archived agency pages can be corrected later; the original network posting timestamp and bytes are not authenticated. No consensus, gold tick history, intraday yield quotes, slippage-adjusted return or actual orders are in this increment.
