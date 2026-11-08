# Source gap audit template

Use this template before adding a dataset or commercial source to the research registry. The goal is to establish that it fills a real information gap, identify what it actually measures, and make the route reproducible.

## Intake

- **Audit ID:**
- **Analyst / reviewer:**
- **Checked at (UTC):**
- **Research question or decision supported:**
- **Candidate source / dataset:**
- **Geography, asset class, issuer or population:**
- **Why it looks like a gap:**

## Overlap check

- **Existing index routes searched:**
- **Closest existing sources:**
- **Same facts / same upstream data:**
- **Distinct information this source adds:**
- **Remaining blind spot after addition:**

Do not call a source distinct merely because it has another website, API, chart, or file format. Compare underlying respondents, filings, transactions, estimation inputs, sample, and definitions.

## Primary-source evidence

| Claim to verify | Authoritative page/table/document | Exact field/table or passage | Checked date | Result / unresolved point |
|---|---|---|---|---|
| Dataset purpose and perimeter |  |  |  |  |
| Observation versus estimate/model |  |  |  |  |
| Release, filing and publication schedule |  |  |  |  |
| Latest observation period and current vintage |  |  |  |  |
| Revisions, corrections and methodology breaks |  |  |  |  |
| Access method, required account/key and format |  |  |  |  |
| Terms, license, retention and redistribution |  |  |  |  |

Search results and secondary descriptions are leads, not proof. Open the primary source and check the actual documentation or data product. If a field, date or permission cannot be verified, say so and keep it out of firm claims.

## Measurement and timing

- **Unit of observation:**
- **Reference period / timestamp:**
- **First-public time and typical lag:**
- **Publication timezone:**
- **Frequency:**
- **History available:**
- **Vintage available (first release, full history, current only, etc.):**
- **Known revision or correction behavior:**
- **Population, sample, threshold or reporting perimeter:**
- **Valuation, seasonality, geographic and currency conventions:**
- **Suppressed, imputed, mirrored or estimated values:**

Keep observation date, reference period, release/publication date, filing date, retrieval time and revision vintage distinct. A scheduled release date is not proof that a value was published then.

## Access and reproducibility

- **Canonical landing page:**
- **Direct data/table/API/download route:**
- **Alternative/fallback access route:**
- **Authentication/API-key requirements:**
- **Format/schema and stable identifiers:**
- **Terms / automation rights:**
- **Minimum retrieval instructions:**
- **Raw file or record to archive:**
- **Required metadata/hash/vintage fields:**

Record the publisher and dataset/table name, not just a distributor homepage. Check whether redistribution, automated access, long-term storage, display, or commercial use requires permission.

## Interpretation controls

- **What a value can establish:**
- **What it cannot establish:**
- **Most likely false inference:**
- **Known coverage or selection bias:**
- **Alternative source for triangulation:**
- **Shared upstream inputs / dependence group:**
- **What would contradict the interpretation:**

Distinguish stocks from transactions, commitments from shipments, capacity from production, fitted prices from actual trades, and reported facts from derived estimates. Do not imply named ownership, motives, net exposure or market-wide coverage from anonymized or aggregate observations.

## Integration decision

- **Decision:** `Add` / `Defer` / `Reject`
- **Reason:**
- **Proposed registry section and row:**
- **Proposed research-index question:**
- **Proposed source-map workflow:**
- **Required independent audit:**
- **Remaining unknowns / next check date:**

### Registry row draft

| Source | What to collect | Cadence / access | Main limitation or interpretation check |
|---|---|---|---|
|  |  |  |  |

### Final audit checklist

- [ ] Primary page and data route open; direct links support the claims.
- [ ] Candidate is distinct from existing coverage or its overlap is explained.
- [ ] Observation period and information-availability time are separated.
- [ ] Cadence, revisions, method breaks and current vintage are checked.
- [ ] Measurement perimeter, units, valuation and missing-data rules are described.
- [ ] Access and reuse terms are documented for the intended use.
- [ ] Limitations prevent the main likely misinterpretation.
- [ ] Registry row, source-map use and index route are internally consistent.
- [ ] A second reviewer checked material dates, scope and links.
- [ ] Reference/position dates were checked against comparison dates in the actual table.
- [ ] Dollar values, decimal points and negative signs survived the saved-file edit unchanged.
- [ ] Frequency, annualization and accumulation rules match each table: a quarterly SAAR flow, annual matrix and cumulative weekly total are different measurements.
- [ ] Examples pass their schema with format checks, and source IDs, input record IDs and revision links are checked separately.
- [ ] A reconstructed calculation does not inherit an input report's publication or historical system-availability time.
