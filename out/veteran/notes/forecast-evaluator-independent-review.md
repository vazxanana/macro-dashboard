# Independent forecast evaluator review

Reviewed on 2026-11-08. Scope: `outputs/scripts/forecast-evaluator.mjs`, its 34 existing tests, ledger schema, evaluation plan and synthetic fixtures. This is a bounded code review, not certification of historical source truth, source receipt times, append-only storage or a forecasting track record. Frozen V1 was not edited.

## Fixed finding: a completed resolution could loosen an already known publication cutoff

`evaluateLedger` sets `source` from the latest visible resolution and uses only that source's `published_at_utc` to tighten the registered eligibility cutoff. A pending resolution can already record an early actual publication. A later completion can assert a later publication time and cause previously excluded forecast updates to be selected and scored. The chain validator accepts both entries.

Reproduction: run `node work/adversarial-pending-publication.mjs` from the workspace root. It clones the supplied synthetic fixtures, registers only `demo-binary-1`, sets the first resolution to pending with a known publication of 00:00:15, then appends a completed resolution whose publication is 00:01:00. The update was issued at 00:00:20 and the planned cutoff is 00:00:45.

Observed output:

```json
{"asOf":"2030-01-01T00:01:03Z","status":"unresolved","selected":"demo-binary-1-issued","cutoff":"2030-01-01T00:00:15.000Z"}
{"asOf":"2030-01-01T00:02:00Z","status":"scored","selected":"demo-binary-1-update","cutoff":"2030-01-01T00:00:45.000Z"}
```

For the current contract, use the minimum known publication timestamp across all visible resolution attempts, together with the registered cutoff. Alternatively, reject inconsistent publication changes and add an explicit audited correction mechanism. A completion should not silently erase earlier evidence of publication. Add a regression test proving that appending a completion cannot resurrect a snapshot already excluded by a known publication time.

### Fix independently rechecked

The parent agent changed selection to take the minimum publication time across all visible resolution records, including pending attempts, and added `cutoff_publication_record_ids`. I inspected that change and reran my original reproduction. Both as-of views now select `demo-binary-1-issued` with an effective cutoff of `2030-01-01T00:00:15.000Z`. The completion becomes scored without resurrecting the update. I then reran the full suite: 35 tests passed, zero failed, including the new later-or-null completion-publication regression. The reported defect is fixed in the current working file.

## Checks completed

- Ran `node --test outputs/scripts/forecast-evaluator.test.mjs`: 34 passed, zero failed before changes.
- Reran after the bounded fix: 35 passed, zero failed.
- Inspected binary, point, pinball and interval loss implementations, infinity and overflow encoding, paired baseline aggregation, fixed quantile grids, chain predecessor checks, evidence availability checks, source chronology and as-of selection.
- Existing tests exercise the previously identified interval endpoint ambiguity, Brier skill overflow and pending-resolution completion cases. Those tests pass.
- No additional independently reproduced material mathematical defect was found in the reviewed scope.

## Limitations

The standalone runtime deliberately does not perform complete JSON Schema validation. The supplied publication, observation, evidence availability, units and precommitment assertions require separate verification. Revision labels such as first release and final cannot be authenticated from a string vintage identifier. This review did not independently verify live macroeconomic sources or inspect the frozen V1 archive.
