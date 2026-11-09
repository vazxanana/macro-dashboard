# Independent formal-FOMC exclusion variant

**All requested comparisons pass.**

The independent calculation was saved before opening the root variant (fingerprint `c0396367517e3275bb5d60629ec26e4d94b602da54deb0aa3cb3754de8aeed81`). It reused the independently regenerated baseline memberships and recomputed changes from official real-yield XML. No root engine was imported.

All 133 original intervals agree: 36 event windows and 97 selected-control windows. There is one event with a formal statement and nine controls with statements. No observed statement lies exactly on a proxy boundary; five independent synthetic checks exercise both boundaries, strict interior, before and after.

The June 12, 2024 event is excluded. The variant retains all 36 slots, scores 35 events and has an equal-event mean contrast of **2.242857143 bp**. All 35 contrasts, surviving controls and exclusions agree with the root variant to the documented display tolerance. 1345 comparison checks pass with 0 failures.

Removed original controls: 2022-01-26, 2022-05-04, 2022-07-27, 2023-05-03, 2023-07-26, 2023-09-20, 2024-05-01, 2024-09-18, 2024-12-18.

Every interval uses its fixed previous Monday–Friday date at 15:30 New York to its ending date at 15:30, with each endpoint converted separately. Either exact boundary is ambiguous and excluded. Only original controls were filtered; none were replaced, replenished or rematched. Within-event control means precede equal event weights.

The root masks yield-derived components for the excluded event, while independent diagnostics retain available components with a null contrast. This is a reporting convention, not a discrepancy in the scored estimator.

The accepted calendar gate covers currently published formal FOMC policy-decision statements. It does not cover all Fed news, minutes, speeches, liquidity announcements or all macroeconomic releases. Broader macro exclusions remain incomplete. No new CI, endpoint rule, method choice, causal interpretation or historical-byte authentication claim was introduced.

The original protocol, amendment, source captures, primary result and separate root variant remain unchanged.
