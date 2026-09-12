# ADR-0002: Dual IPC alias with retirement rule

- Status: accepted (2026-09-09)
- Context: SPEC §6.2 names the handler `get_ar_aging_summary`; the shipped
  backend, frontend, mock router, and E2E harness all used `analytics_get_ar_aging`.
- Decision: expose both names on the same single-pass implementation. The
  closed-list contract test (`ipc_contract_tests.rs`) pins all 28 names across
  all four surfaces. Removal rule: delete the legacy name from the expected
  list first (red), then from the four surfaces. Earliest removal: one release
  after every shipped client uses the canonical name.
- Consequences: surface is wider until retirement, but drift is impossible
  without a failing test.
