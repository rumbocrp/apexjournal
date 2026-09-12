# ADR-0001: Decimal Bankers in app instead of GENERATED column

- Status: accepted (2026-09-09)
- Context: SPEC §3.1 asks for `base_amount GENERATED ALWAYS AS (amount * exchange_rate)`.
  SQLite would compute it in binary float with half-away `ROUND`, breaking the
  SPEC §2.2 Bankers requirement (`rust_decimal`, MidpointNearestEven).
- Decision: `base_amount` is computed once at write time with Decimal Bankers
  (`calc_base_amount`) and stored. DB integrity comes from app validation plus
  `CHECK`-equivalent triggers (`amount > 0`, `exchange_rate > 0`).
- Consequences: writes must go through `TransactionRepo` (or match its math).
  Revisit only if SQLite gains decimal-native generated columns.
