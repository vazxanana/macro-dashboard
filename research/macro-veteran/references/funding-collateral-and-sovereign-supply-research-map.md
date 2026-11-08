# Funding, collateral and sovereign-supply research map

**Prepared:** 7 November 2026  
**Scope:** Public and licensed evidence for funding conditions, repo/collateral, Treasury supply, and cross-border dollar liquidity.  
**Use:** Research context for macro, rates, FX, gold and risk assets. This is not an execution signal.

## Why this layer matters

Markets can move because the price of money or the availability of balance sheet changes, even when the macroeconomic outlook has not changed. A Treasury yield move, for example, can reflect expected policy rates, inflation compensation, term premium, auction supply, repo financing, dealer capacity, or a forced unwind. The same observed yield move can therefore have different implications for gold, the dollar and equities.

The hard part is that no single public series captures “liquidity.” Public data cover different layers: transaction-based overnight funding rates, reserve quantities, central-bank facilities, sovereign issuance plans, and slower cross-border credit aggregates. Private bilateral transactions, trader-level exposures, and many derivatives books remain incomplete or delayed. The analyst's job is to triangulate rather than promote one proxy into a complete story.

## 1. Overnight funding and collateral: the most useful public plumbing data

| Source | What it measures | Timing/access | Main limits | How to use it |
|---|---|---|---|---|
| [New York Fed SOFR, BGCR and TGCR](https://www.newyorkfed.org/markets/reference-rates) | Transaction-based overnight Treasury repo rates, volumes and percentile information. SOFR includes broad GC repo plus cleared bilateral DVP repo; BGCR and TGCR cover narrower segments. | Published each business day; downloadable through the New York Fed Markets Data APIs. Rates may be revised the same day if a material late input or error is found. | SOFR excludes a portion of “specials” repo, where a particular security is scarce. It is an overnight secured funding benchmark, not a measure of every repo transaction or of unsecured bank credit. | Compare the rate with administered rates and policy targets; examine volume and distribution, not only the median. For security-specific scarcity, inspect repo specials and cash-futures basis sources separately. |
| [OFR Short-Term Funding Monitor repo data](https://www.financialresearch.gov/short-term-funding-monitor/datasets/repo/) and [documentation](https://www.financialresearch.gov/short-term-funding-monitor/documentation/) | Daily repo rates and volumes across centrally cleared and tri-party market segments, with collateral and counterparty-sector breakdowns where disclosure thresholds permit. | Public series; generally one business day lag for centrally cleared repo and two business days for tri-party repo. | Preliminary aggregates; segments are not a complete market census. The OFR suppresses some observations when participant counts or volumes are too small to protect firm confidentiality. The public series do not identify counterparties. | Check which segment is driving a volume or rate change. A market-wide average can hide stress concentrated in one clearing or collateral channel. |
| [New York Fed standing repo operation results](https://www.newyorkfed.org/markets/desk-operations/repo) and [SRF FAQ](https://www.newyorkfed.org/markets/repo-agreement-ops-faq) | Amounts submitted/accepted and rates in official repo and reverse repo operations, including standing repo facility operations. | Results are posted after operations; operation history and API endpoints are available. | Low or zero take-up does not prove there is no funding friction: counterparties may face access, stigma, timing, collateral, or balance-sheet constraints. Facility design and operation limits can change. | A sharp increase in take-up, especially alongside private repo dispersion or settlement pressure, is a stronger stress clue than an isolated rate print. Interpret use as demand for a backstop, not automatically as a crisis. |
| [OFR cleared repo collection](https://www.financialresearch.gov/data/collections/cleared-repo-data/) | Public OFR monitoring includes cleared repo aggregates; the regulatory collection is broader and granular for supervisory use. | Daily collection has existed since 2019; public data in the Short-Term Funding Monitor began in 2020. | Regulatory collection is not the same as unrestricted public transaction-level access. Do not assume every collected field is downloadable. | Use public aggregate releases and avoid implying access to confidential counterparty-level exposures. |
| [New York Fed Tri-Party/GCF Repo Statistics](https://www.newyorkfed.org/research/tri-party-repo) | Snapshot of repo market size/composition, collateral mix, haircut distributions, and top-dealer concentration | Monthly publication around the 11th business day; describes a representative day around the 7th business day | One-day-per-month snapshot, not daily stress data; limited to tri-party and GCF activity, with reporting-definition changes to track | Use as a slow-moving collateral and concentration overlay to daily repo rates/volumes; preserve pre/post-November-2025 methodology separately. |
| [OFR non-centrally cleared bilateral repo collection](https://www.financialresearch.gov/data/collections/non-centrally-cleared-bilateral-repo-data/) | Transaction-level regulatory collection for a repo segment that had been a public data gap | Daily reporting by covered firms began in phases in 2024–25; official-sector collection | Not a public trading feed or open transaction tape. Do not imply access to dealer identities or records from public OFR dashboards. | Treat as an explicit visibility boundary: public analysts still need segment-level proxies and should mark bilateral repo exposures as unobserved. |
| [SEC Form N-MFP data sets](https://www.sec.gov/data-research/sec-markets-data/dera-form-n-mfp-data-sets) | Monthly money-market-fund portfolio holdings, liquidity, maturity and valuation fields for the preceding month; filing-level positions can show T-bill, repo, CP/CD and other funding channels | Filed by the fifth business day; individual filings are public upon filing. SEC's flat-file bundle refreshes monthly; submissions after 5:30 p.m. ET on the fifth business day roll into the next bundle. | “As filed” extraction may be revised; fund reporting and security classification must be checked. File dates are not the same as portfolio observation dates. [SEC rule eliminating the old 60-day delay](https://www.sec.gov/newsroom/press-releases/2014-143) | Map portfolio composition by fund, instrument and observation month; use fund identifiers and amendments. |
| Federal Reserve [Commercial Paper Rates and Outstanding](https://www.federalreserve.gov/releases/cp/), [rates](https://www.federalreserve.gov/releases/cp/rates.htm), [issuance volume](https://www.federalreserve.gov/releases/cp/volumestats.htm), [outstanding](https://www.federalreserve.gov/releases/cp/outstanding.htm), and [methodology](https://www.federalreserve.gov/releases/cp/about.htm) | DTCC-sourced daily CP rates and issuance volumes by selected rating/issuer class, plus outstanding balances and maturity distributions by issuer/maturity category. Rates are fitted offer-side primary-market estimates; volume tables cover issuance sales to investors. | Rates and volume typically post T+1 with no guaranteed daily release time. Outstanding is Wednesday and month-end, also typically T+1; maturity distributions are weekly. FRED has long public histories; the Fed scheduled removal of DDP's custom package builder for the week of 9 Nov 2026, while release-page XML and FRED remain download routes. | Rates are not actual issuer-specific costs or a trade tape; thin cells may be n.a. Secondary trades, repo and financing issues are excluded from issuance volumes; total market volume does not equal the sum of rated buckets. Outstanding levels are revised as issuer information changes; keep SA/NSA, vintage and the 10 Apr 2006 category break. [Fed DDP CP release](https://www.federalreserve.gov/datadownload/choose.aspx?rel=CP), [FRED release](https://fred.stlouisfed.org/release?rid=86) | Match rate, issuance, outstanding and maturity buckets while retaining SA/NSA, category definitions and vintage. |

The New York Fed defines SOFR as a broad measure of the cost of borrowing cash overnight against Treasury securities, calculated from transaction data spanning tri-party, GCF and cleared bilateral DVP repo. Its [methodology and revision notes](https://www.newyorkfed.org/markets/reference-rates/additional-information-about-reference-rates) matter for event work: publication is around 8 a.m. ET, and eligible same-day revisions can follow around 2:30 p.m. ET. Do not use the later revised print as if it had been available to the morning market.

### A practical repo stress panel

Collect and chart, at minimum:

- SOFR, BGCR and TGCR levels, volumes and rate percentiles;
- SOFR minus the effective federal funds rate, and each rate relative to the administered-rate corridor;
- OFR cleared and tri-party segment rates/volumes and collateral composition;
- New York Fed repo/SRF take-up, operation limit and eligibility rules;
- Treasury bill settlement, tax dates, month-end/quarter-end/year-end, and major coupon settlement dates.

Use a rolling baseline by weekday and calendar season. Repo often has predictable month-end, quarter-end, tax-date and Treasury settlement effects. A one-day jump should be labeled a possible technical dislocation until it persists, spreads across funding segments, or receives corroboration from facility usage and market depth.

### Money-fund holdings and daily liquidity disclosures

Form N-MFP provides the security-level portfolio composition needed to identify whether money funds are allocating toward Treasury bills, repo, bank CDs, commercial paper or other short-term instruments. Pair it with the funds' required website disclosures of daily/weekly liquid assets, market-based NAV, net shareholder flows and liquidity fees or support. The monthly holdings are a delayed month-end snapshot; daily web disclosures are more timely but decentralized across fund websites and require consistent series/date capture. Neither alone measures the full cash demand or funding risk of the financial system. [SEC N-MFP package and filing cadence](https://www.sec.gov/data-research/sec-markets-data/dera-form-n-mfp-data-sets), [SEC money-fund reporting requirements](https://www.sec.gov/files/rules/final/2023/33-11211.pdf)

### Commercial-paper issuance and rollover

Use the Federal Reserve's [Commercial Paper release](https://www.federalreserve.gov/releases/cp/) to observe the short-dated unsecured funding channel: daily fitted rates by AA nonfinancial, A2/P2 nonfinancial, AA financial and AA asset-backed categories; daily issuance volume; Wednesday/month-end outstanding; and a weekly maturity profile. The data come from DTCC, which handles almost all domestic CP clearing/custody, and most observations are posted T+1. At the 8 November 2026 check, the daily tables ran through 5 November; outstanding was through 4 November. The Fed's fitted rates use selected dealer/direct-issuer sales to investors on the offer side, weighted by face value. They are broad category/tenor indexes, not a specific issuer's realized borrowing cost. CP is a narrow, short-maturity instrument (up to 270 days, about 30 days on average), not a proxy for all unsecured corporate debt. Read issuance volume and maturity schedules alongside the outstanding stock; rising rates with shrinking issuance or a concentrated maturity wall can mean something different from rising activity at stable spreads. Compare against same-tenor bills, bank funding, repo and public money-fund holdings, while keeping secure/unsecured pricing separate. Archive vintages: issuer-information revisions can restate outstanding levels, and the Fed revised Aug 2025–Aug 2026 in Aug 2026. Preserve SA/NSA series and the 10 Apr 2006 category break. The DDP custom “Build Your Package” feature was scheduled for removal the week of 9 Nov 2026; check FRED and the release XML routes for ongoing access. ([Fed rate methodology](https://www.federalreserve.gov/releases/cp/about.htm), [Fed issuance volumes](https://www.federalreserve.gov/releases/cp/volumestats.htm), [Fed outstanding data](https://www.federalreserve.gov/releases/cp/outstanding.htm), [maturity distribution](https://www.federalreserve.gov/releases/cp/maturity.htm), [FRED release](https://fred.stlouisfed.org/release?rid=86), [DDP access update](https://www.federalreserve.gov/datadownload/choose.aspx?rel=CP))

## 2. Reserve quantities and central-bank balance-sheet drains

### US series to combine

- [Federal Reserve H.4.1](https://www.federalreserve.gov/releases/h41/): weekly Fed balance sheet, reserve balances, Treasury and agency holdings, reverse repos, and factors affecting reserve balances. The Fed usually releases it Thursday around 4:30 p.m. ET; holidays can shift publication. The release includes weekly-average and Wednesday-level information, so use the matching line and reference date.
- [Treasury Daily Treasury Statement](https://fiscaldata.treasury.gov/datasets/daily-treasury-statement/): daily operating cash balance and cash flows. The Treasury General Account (TGA) is a liability at the Fed and can move for reasons unrelated to private credit demand.
- [New York Fed reverse repo operations](https://www.newyorkfed.org/markets/desk-operations/reverse-repo): daily take-up and operation data for the ON RRP facility. Participant mix and facility terms matter; a declining balance is not mechanically equal to a one-for-one increase in bank reserves.
- [New York Fed SOMA holdings](https://www.newyorkfed.org/markets/soma-holdings): Federal Reserve securities holdings and scheduled maturities/reinvestments, useful for assessing balance-sheet runoff and reinvestment mechanics.

The common analyst shortcut “reserves = Fed assets minus TGA minus ON RRP” is only an approximation. The Fed liability structure includes currency, the TGA, reverse repos, reserve balances, and other liabilities; autonomous factors and timing matter. Use published reserve balances as the observed outcome and explain changes with the full H.4.1 table, not a reconstructed single equation presented as exact.

### International central-bank evidence

- **ECB money-market statistical reporting (MMSR):** MMSR collects transaction-level reporting that includes FX swaps, but the regular public [MMSR dataset](https://data.ecb.europa.eu/data/datasets/MMSR/data-information) does not currently publish that FX-swap segment as a daily statistical series. The ECB's periodic [Euro money market studies](https://www.ecb.europa.eu/press/euromoneymarket/html/ecb.euromoneymarket202504.en.html) provide lower-frequency aggregate analysis of FX swaps using reported daily trades; distinguish the study snapshot from a live public series. Public MMSR coverage of unsecured, secured and OIS statistics also changed as 24 additional banks entered from the first maintenance period of 2025; flag the break or use a consistent panel where available. These published data are aggregates, not a counterparty transaction tape.
- **ECB Securities Holdings Statistics by Sector (SHSS):** The [methodology](https://data.ecb.europa.eu/methodology/securities-holdings-statistics) and [dataset](https://data.ecb.europa.eu/data/datasets/SHSS/data-information) provide quarterly, security-by-security holdings for selected euro-area holder sectors/countries and instrument/issuer classifications. Use it to study investor-base and cross-border holding structure, not daily flows; certain detailed non-domestic general-government holdings are restricted or suppressed in public tables.
- **Bank of England weekly report and Bankstats:** The [weekly consolidated balance sheet](https://www.bankofengland.co.uk/weekly-report/balance-sheet-and-weekly-report) helps track reserve balances, operations and other central-bank balance-sheet items. [Bankstats tables](https://www.bankofengland.co.uk/statistics/tables) add UK gilt repo/stock-lending, money-market and banks' external-business series. These are useful GBP-plumbing complements, but weekly balance-sheet moves require decomposition and do not identify private counterparties or flows by themselves.
- [ECB €STR](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/euro_short-term_rate/html/index.en.html) is a transaction-based unsecured overnight rate; the [ECB money-market statistical reporting overview](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/money_market/html/index.en.html) describes the reporting framework. Some granular data are not released at transaction level.
- **Dealer financing terms:** The Fed's quarterly [Senior Credit Officer Opinion Survey on Dealer Financing Terms (SCOOS)](https://www.federalreserve.gov/data/scoos.htm) and [downloadable series](https://www.federalreserve.gov/datadownload/Choose.aspx?rel=SCOOS) report dealer views on securities-financing and OTC-derivatives credit terms, haircuts, leverage, term funding and collateral disputes across counterparty types. It is a qualitative survey of changes over the prior quarter, not transaction-level evidence; preserve the question and reporting panel when comparing vintages.
- [Bank of Japan current-account balance changes and market operations](https://www.boj.or.jp/en/statistics/boj/fm/juq/index.htm) are updated each business day. They distinguish market operations from other factors changing BOJ current-account balances; read together with BOJ monetary-base and operation data.
- [Federal Reserve central-bank liquidity swap operations](https://www.newyorkfed.org/markets/desk-operations/central-bank-liquidity-swap-operations) reports public weekly results when operations occur. Swap line drawings are a narrow observable proxy for official emergency USD demand; they are not a comprehensive gauge of private offshore dollar funding.

For cross-central-bank comparisons, do not compare reserve balances in nominal currency amounts. Compare rate spreads to each central bank's own administered-rate framework, facility use, money-market segmentation and the direction of balance-sheet factors.

## 3. Treasury supply, auctions and market absorption

### Primary sources worth monitoring

- [Treasury Quarterly Refunding](https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding): borrowing estimates, issuance decisions, buyback plans, investor materials, and the primary dealer / Treasury Borrowing Advisory Committee process.
- [Treasury auction announcements and results](https://treasurydirect.gov/auctions/announcements-data-results/): auction size, maturity, coupon, results, and bid/award breakdowns. The auction query tool includes historical records.
- [Treasury Investor Class Auction Allotments](https://home.treasury.gov/data/investor-class-auction-allotments/): allotments by designated investor class for marketable coupon auctions. Treasury's [category FAQ](https://www.treasurydirect.gov/help-center/faqs/auction-faqs/) explains that an indirect bidder is a customer bidding through a primary dealer or direct submitter; the category still does not identify the beneficial owner in public results.
- [Treasury marketable securities auction data](https://home.treasury.gov/policy-issues/financing-the-government/treasury-marketable-and-non-marketable-securities): downloadable historical auction data and tentative schedules.
- [Federal Reserve SOMA holdings](https://www.newyorkfed.org/markets/soma-holdings): securities held by the Fed, separated from private-sector holdings when evaluating net supply.

### Auction analysis that is more informative than one headline

For each auction, preserve the timestamped when-issued (WI) yield immediately before the result, the stop-out yield, auction size, bid-to-cover, and dealer/direct/indirect bid and award amounts. Calculate the auction “tail” as stop-out yield minus the WI yield, with sign and conventions clearly stated. Also compare the yield with the same tenor's recent auction distribution, issuance size, settlement calendar, and volatility on the day.

Do not read “indirect bidder share” as “foreign demand.” Indirect awards can include a range of customers bidding through intermediaries; direct and dealer categories are also operational classifications, not clean investor identities or investment motives. Bid-to-cover can rise because bids are more aggressive, but it can also change with auction size, dealer balance-sheet strategy, or bid composition. Investor-class allotments provide another view but are still not a full beneficial-owner map.

The Treasury explicitly solicits private-sector and TBAC views before quarterly refunding decisions and publishes resulting decisions. This makes the [refunding document set](https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents/) unusually useful for the supply outlook, though it is a financing plan, not a forecast of market demand.

### Build a net-supply calendar

Create a daily/weekly calendar of gross coupon and bill issuance, maturities, Fed redemptions/reinvestments, Treasury cash balance changes, buybacks, and settlement dates. Separate:

1. **Gross issuance**: new securities sold.
2. **Net marketable borrowing**: issuance less maturities and cash-financing effects under Treasury's stated definition.
3. **Private-sector net supply**: adjust for Fed/SOMA holdings and reinvestment mechanics, being explicit about the accounting convention.
4. **Duration supply**: estimate DV01 or duration-equivalent supply only with a documented method; equal dollar issuance across bills and long bonds is not equal duration risk.

An auction tail is an outcome, not a causal diagnosis. Check rate volatility, WI liquidity, dealer positions, futures basis, repo financing and concurrent data releases before attributing it to weak end demand.

## 4. Dollar funding outside the US

### Public structural measures

- [BIS Global Liquidity Indicators](https://data.bis.org/topics/GLI) measure credit to non-bank borrowers through bank lending and international debt securities, with particular focus on foreign-currency credit in US dollars, euros and yen to non-residents. Tables and dashboards are available in the [BIS data portal](https://data.bis.org/topics/GLI/tables-and-dashboards).
- [BIS Locational Banking Statistics](https://data.bis.org/topics/LBS) provide cross-border bank claims and liabilities by location and counterparty, with exchange-rate and reporting-break adjusted changes where available.
- [BIS Consolidated Banking Statistics](https://data.bis.org/topics/CBS) organize exposures on a worldwide consolidated basis and help analyze nationality-based risk exposures.
- [US Treasury TIC](https://home.treasury.gov/data/treasury-international-capital-tic-system) reports cross-border transactions in securities and banking claims. Treasury warns through its documentation and methodology that custody location and beneficial ownership can diverge; transactions and holdings changes must not be conflated.
- The Fed's weekly H.4.1 [custody holdings for foreign and international accounts](https://fred.stlouisfed.org/series/WMTSECL1) provide a faster complementary stock series for marketable Treasury securities in official custody. The legacy FRED series was discontinued and replaced; use the current series ID and verify current H.4.1 definitions. Treat it as a custody-balance proxy alongside monthly TIC, not as a clean foreign-purchase flow: custody can change for reasons beyond new buying and does not identify beneficial owners.
- [Federal Reserve central-bank swap line operations](https://www.newyorkfed.org/markets/desk-operations/central-bank-liquidity-swap-operations) and the New York Fed's [repo and reverse repo agreements](https://www.newyorkfed.org/markets/domestic-market-operations/monetary-policy-implementation/repo-reverse-repo-agreements) information on the FIMA Repo Facility reveal official USD backstop activity when published.

BIS GLI and banking statistics are quarterly/lagged structural indicators. They can show which currencies and borrower sectors are accumulating foreign-currency credit, but they cannot prove a same-day liquidity squeeze or show the marginal cost of funding today.

### Keep the four FX-funding measurements separate

For a cross-border funding question, pair data by what they measure rather than stacking them as interchangeable “dollar liquidity” gauges:

- **Price:** timestamped cross-currency basis quotes by pair, tenor, collateral and bid/ask. State the vendor's quote sign convention.
- **Activity snapshots:** ECB MMSR collects FX-swap trades, but its regular public [MMSR statistics](https://data.ecb.europa.eu/data/datasets/MMSR/data-information) do not currently publish FX swaps as a daily public series. The ECB's periodic [Euro money market study](https://www.ecb.europa.eu/press/euromoneymarket/html/ecb.euromoneymarket202504.en.html) reports aggregate FX-swap activity from daily reported trades; it is a retrospective snapshot, not a live tape. For other published MMSR segments, record the 2025 reporting-population coverage break.
- **Bank/non-bank credit stocks:** BIS [LBS](https://data.bis.org/topics/LBS) and [GLI](https://data.bis.org/topics/GLI) provide quarterly, lagged positions and adjusted changes; GLI captures bank loans plus international debt securities to non-banks, not derivative roll needs.
- **Derivatives footprint:** BIS [OTC derivatives data](https://data.bis.org/topics/OTC_DER), including [D5.1](https://data.bis.org/topics/OTC_DER/tables-and-dashboards/BIS%2CDER_D5_1%2C1.0), provide semiannual outstanding notional and gross market value by instrument/currency/maturity/counterparty sector. The [Triennial Survey](https://data.bis.org/topics/DER/tables-and-dashboards) gives a periodic turnover snapshot. These are market-structure context, not funding transactions or open net risk.

Notional is not cash borrowed, net exposure, or funding need; gross market value is replacement value, not amount of funding. BIS aggregates do not identify dealer-to-customer country links, and USD-valued stocks move with exchange rates. Triennial turnover is not outstanding exposure. For a current stress claim, seek agreement across price, daily activity, bank credit, official facilities, and market spreads, with each source's reporting lag explicit.

### Hard-to-get daily funding information

Cross-currency basis swaps, FX swaps and bank-level wholesale funding spreads can move before quarterly BIS aggregates. A cross-currency basis is market-priced and depends on pair, tenor, collateral, counterparty, quote convention and instrument. Public free coverage is uneven; reliable history and executable intraday quotes generally require a licensed provider or exchange/venue product. If you use a vendor series, preserve bid/ask, timestamp, tenor, currency pair, collateral assumptions and the sign convention. “More negative basis” is not a portable statement until the quote convention is specified.

Do not claim to have measured global dollar scarcity from DXY, a single FX basis quote, SOFR, or BIS quarterly debt alone. A more convincing funding-stress diagnosis needs several layers to agree: basis widening, higher secured/unsecured spreads or unusual repo dispersion, official facility demand, cross-border flow or bank data, and stressed market pricing such as FX volatility or credit spreads.

## 5. Dealer balance sheet, basis trades and the hidden leverage problem

Some important exposures remain only partially observable in public data. Treasury cash-futures basis trades, relative-value hedge-fund leverage, bilateral repo exposure, and dealer-client intermediation can be large while the public disclosures are aggregate, lagged or classified imperfectly.

Useful public context includes:

- CFTC [Traders in Financial Futures](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm) positions for Treasury futures, separated into dealer/intermediary, asset manager/institutional, leveraged funds and other reportables. The CFTC's [explanatory notes](https://www.cftc.gov/MarketReports/CommitmentsofTraders/ExplanatoryNotes/index.htm) explain classifications and report construction. These positions are weekly snapshots, not a trader-level basis-trade ledger; futures positions may hedge cash or swap exposure.
- OFR repo-market series and the [OFR Short-Term Funding Monitor](https://www.financialresearch.gov/short-term-funding-monitor/) for aggregate repo funding and cleared-market structure.
- The OFR Hedge Fund Monitor's [FICC Sponsored Repo Service volume dataset](https://www.financialresearch.gov/hedge-fund-monitor/datasets/ficc/) adds daily aggregated repo and reverse-repo volumes from the sponsored member's perspective. OFR says most sponsored repo borrowing volume is hedge funds, while most sponsored reverse-repo lending volume is money funds; use it to track cleared-channel participation and calendar-end patterns alongside broader repo data. It is not a leverage measure, does not identify counterparties or margin terms, and covers only FICC-sponsored cleared activity; the bilateral repo segment remains partly opaque. [OFR chart and definitions](https://www.financialresearch.gov/hedge-fund-monitor/categories/leverage/chart-100/), [OFR study of hedge-fund cleared repo participation](https://www.financialresearch.gov/briefs/files/OFRBrief-26-01-hedge-fund-participation-cleared-repo.pdf).
- Treasury auction investor-class allotments and TIC data as additional, imperfect evidence on demand and ownership.
- Federal Reserve [Financial Stability Reports](https://www.federalreserve.gov/publications/financial-stability-report.htm), OFR research, and FSOC annual reports for broader leverage and nonbank-intermediation context. These are analytical reports, not real-time position feeds.
- The Federal Reserve’s 11 September 2026 [Financial Accounts release (Z.1; second quarter 2026)](https://www.federalreserve.gov/releases/z1/20260911/z1.pdf) added domestic private-credit and hedge-fund sector detail back to 2012:Q4. The published tables are quarterly and revised; new hedge-fund estimates use updated methodology and are not directly comparable with the discontinued prior supplementary series. Additional from-whom-to-whom private-credit loan detail is available through Fed data-download channels but is not presented in the standard tables; see the Fed's [methodology note](https://www.federalreserve.gov/econres/notes/feds-notes/introducing-private-credit-into-the-financial-accounts-of-the-united-states-20261016.html). This improves structural lender/borrower research but cannot reveal a daily margin call or live fund book.

The public should not infer a specific fund's leverage from CFTC leveraged-fund net shorts. A futures short can be a leg of a cash-futures basis trade, a hedge, or another relative-value position; gross exposure, cash holdings, financing haircuts and counterparties are not all visible in COT. Verify a leverage hypothesis with independent evidence and phrase the result as a proxy-based inference.

### Public repo monitor: preserve source-specific timing and math

The OFR [public repo release](https://www.financialresearch.gov/short-term-funding-monitor/datasets/repo/) and its no-token [API](https://www.financialresearch.gov/short-term-funding-monitor/api/) expose daily volume-weighted averages for selected centrally cleared and tri-party segments. The feed has preliminary and final vintages: preliminary values typically appear around 3 p.m. ET, central-cleared observations generally lag one business day and tri-party observations two days, and quarterly review can finalize past observations. Archive both versions. Do not compare the OFR volume-weighted means directly with New York Fed SOFR/BGCR/TGCR medians as if they used the same statistic.

The New York Fed's reference rates are generally published around 8 a.m. ET for the prior business day and may be revised around 2:30 p.m. if the change exceeds one basis point. The [monthly Tri-Party/GCF repo release](https://www.newyorkfed.org/research/tri-party-repo) adds collateral, haircut/margin distribution, and dealer-concentration detail from a representative day, usually around the seventh business day and released around the eleventh. It is a structural cross-section, not a daily stress feed.

### The counterparty-level repo gap is now regulator-only

OFR's [non-centrally cleared bilateral repo collection](https://www.financialresearch.gov/data/collections/non-centrally-cleared-bilateral-repo-data/) now covers transaction-level rate, tenor, collateral, and counterparty information, including foreign-currency activity. Category 1 reporting began in December 2024 and Category 2 in July 2025. This is an official-sector collection, not a public tape or downloadable counterparty series. OFR describes the expanded market coverage in its [2025 sizing update](https://www.financialresearch.gov/the-ofr-blog/2025/12/04/sizing-us-repo-market/). For public analysis, use the published segment aggregates and explicitly mark counterparty-level bilateral exposures as unobserved.

### Dealer absorption and auction demand have different clocks

The New York Fed [Primary Dealer Statistics](https://www.newyorkfed.org/markets/counterparties/primary-dealers-statistics) report the prior week's positions, transactions, financing, and fails on Thursdays, about 4:15 p.m. ET; use the relevant series definitions across structural breaks and retain revisions/suppression. Treasury [auction results](https://www.treasurydirect.gov/auctions/announcements-data-results/announcement-results-press-releases/auction-results/) provide immediate yield, bid-to-cover, and dealer allotment context. Treasury's [investor-class allotments](https://home.treasury.gov/data/investor-class-auction-allotments) arrive later (coupon data twice monthly, bills monthly) and use broad investor categories. Join on CUSIP/issue date, but do not treat auction statistics or delayed allotments as a complete investor demand or stress measure.

For cross-currency USD funding, a daily basis history that is adequate for monitoring is usually licensed rather than an official public series. Preserve timestamped spot and forward points, bid/ask, matched USD and foreign-currency curves, day-count and holiday conventions, and tenor when calculating implied funding. Central-bank swap-line usage measures a public backstop, not the private basis price. BIS quarterly [Global Liquidity Indicators table E2.1](https://data.bis.org/topics/GLI/tables-and-dashboards/BIS%2CGLI_E2_1%2C1.0) and [Locational Banking Statistics](https://data.bis.org/topics/LBS) provide slower currency and cross-border balance-sheet context; they reveal accumulated exposures, not daily funding pressure.

### Stress workflow additions

1. Freeze OFR preliminary and final values separately and NY Fed morning and revised rates with publication timestamps.
2. Compare rates, volumes, percentiles, collateral, and tenor within each source's own methodology; use weekday and quarter-end baselines.
3. Combine daily repo observations with monthly collateral/haircut concentration and weekly dealer positions/fails, preserving each release lag.
4. For auctions, save immediate results first, then append delayed investor-class allotments and later dealer inventory; do not backdate delayed information.
5. Keep private FX-basis observations at their actual quote timestamps and use BIS credit aggregates only as the structural backdrop.

## 6. A source-to-signal workflow

### Daily checklist

1. Record prior-day SOFR/BGCR/TGCR, volume, percentiles, and any same-day revision; compare with policy-administered rates.
2. Check OFR repo segments and Fed operation results; note repo specials or collateral-specific scarcity only if the source directly measures them.
3. Update the Treasury cash-balance and issuance/settlement calendar. Mark coupon settlements, tax dates, month/quarter/year end, and holidays.
4. Capture benchmark yields, TIPS, OIS/futures-implied policy path, and WI-to-auction outcomes with synchronized timestamps.
5. State whether the evidence is about **price of funding**, **quantity of reserves**, **collateral availability**, **sovereign duration supply**, or **cross-border credit stock**. These are different mechanisms.

### Weekly / monthly / quarterly

- Weekly: H.4.1; current Fed operation/facility use; CFTC Treasury futures positioning; weekly rate dispersion and settlement checks.
- Monthly: Treasury cash statements, Treasury investor allotments, TIC releases when available, and central-bank statistics. Watch publication-date and revision metadata.
- Quarterly: BIS GLI/LBS/CBS, Treasury refunding documents, Fed/OFR stability publications, and cross-country funding composition.

### Evidence ladder for a “funding stress” claim

| Level | Evidence | Appropriate language |
|---|---|---|
| 1. Single proxy moves | One repo spread, one FX basis quote, or one auction tail | “A funding-related indicator moved; this is not enough to establish broad stress.” |
| 2. Same-market confirmation | Rate dispersion/volume, multiple repo segments, or repeated auctions corroborate | “Pressure appears in more than one measure within the same market.” |
| 3. Cross-market confirmation | Funding, FX, rates/credit and facility use align with the same narrative | “Several independent markets show a consistent funding squeeze; remaining alternatives are…” |
| 4. Structural confirmation | Lagged BIS/official data later show balance-sheet or cross-border credit contraction | “Subsequent structural data corroborate the episode,” with the release lag stated. |

Avoid declaring a “liquidity crisis” from one indicator or treating balance-sheet liquidity as equivalent to market liquidity. The latter also depends on depth, bid/ask spreads, market-maker capacity, settlement functioning and willingness to warehouse risk.

## 7. Minimum data record for every chart

For each observation preserve:

```text
series name and exact publisher definition
instrument / currency / tenor / collateral class
value, unit, rate convention, quote sign convention
observation date and period
publication timestamp and timezone
retrieval timestamp and raw file/API response identifier
preliminary/final status and revision history
coverage exclusions and suppression rules
license / storage / redistribution status
calculation version and input series IDs
```

## Primary references

- [New York Fed Treasury repo reference rates and methodology](https://www.newyorkfed.org/markets/reference-rates)
- [OFR Short-Term Funding Monitor](https://www.financialresearch.gov/short-term-funding-monitor/)
- [OFR Hedge Fund Monitor: FICC sponsored repo volumes](https://www.financialresearch.gov/hedge-fund-monitor/datasets/ficc/)
- [Federal Reserve H.4.1 and release calendar](https://www.federalreserve.gov/releases/h41/)
- [Treasury Fiscal Data](https://fiscaldata.treasury.gov/)
- [Treasury Quarterly Refunding](https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding)
- [BIS Global Liquidity Indicators](https://data.bis.org/topics/GLI)
- [BIS International Banking Statistics](https://data.bis.org/topics/LBS)
- [Federal Reserve international market operations](https://www.newyorkfed.org/markets/international-market-operations)
- [ECB money-market statistics](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/money_market/html/index.en.html)
- [Bank of Japan market operations](https://www.boj.or.jp/en/statistics/boj/fm/juq/index.htm)

This guide adds a measurement framework, not a predictive model. Any proposed trading relationship still needs point-in-time data, a predeclared mechanism, independent validation, costs and out-of-sample testing.
