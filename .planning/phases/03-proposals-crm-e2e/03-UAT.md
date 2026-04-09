---
status: complete
phase: 03-proposals-crm-e2e
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-04-07T00:00:00.000Z
updated: 2026-04-07T03:00:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Full Proposals Suite Runs Clean
expected: Run `npx playwright test e2e/proposals/ --reporter=list`. All 8 tests pass (no failures, no skipped). Suite completes without hanging.
result: pass

### 2. PROP-01: Create Proposal
expected: PROP-01 test passes. The test creates a uniquely-titled proposal through the 5-step wizard UI, the proposal appears in the list, and cleanup deletes it successfully.
result: pass

### 3. PROP-02: Edit Proposal
expected: PROP-02 test passes. The test edits the title of an existing proposal via the wizard, the updated title appears in the list, and cleanup deletes it.
result: pass

### 4. PROP-03: Delete Proposal
expected: PROP-03 test passes. The test creates a proposal, deletes it via the UI (button + AlertDialog confirm), and verifies it's no longer visible in the list.
result: pass

### 5. PROP-04: PDF Auth Enforcement
expected: PROP-04 test passes. An authenticated request to the PDF generation endpoint returns a non-401/non-403 response. An unauthenticated request is rejected (401 or 403).
result: pass

### 6. PROP-05: Share Link Public Access
expected: PROP-05 test passes. The share link for a proposal is accessible without authentication and renders the proposal content (client name, title, or status visible on page).
result: pass

### 7. PROP-06: Status Transitions (all 3)
expected: All 3 PROP-06 sub-tests pass. draft→sent shows "Enviada" in the UI, sent→approved shows "Aprovada", sent→rejected shows "Rejeitada".
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
