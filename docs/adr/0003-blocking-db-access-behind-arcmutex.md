# ADR-0003: Blocking DB access behind Arc<std Mutex>

- Status: accepted (2026-09-09)
- Context: `with_connection` held the async session mutex across synchronous
  rusqlite calls, so a 778ms aggregation stalled touch/status/watchdog on the
  executor. Measured before the fix with a 500ms slow-query test.
- Decision: session metadata stays under the tokio mutex; the connection lives
  in `Arc<std::sync::Mutex<_>>` and query work runs on `spawn_blocking`.
  Interface unchanged (`with_connection(f)`). Concurrent commands still
  serialize on the single connection (correct for SQLite); the executor stays
  responsive. `lock()` no longer waits for in-flight work, which drains via
  its own `Arc` clone.
- Consequences: poisoned-mutex maps to `SyncError` (untested path; `f`
  closures return `Result`, never panic). Revisit if a connection pool or a
  dedicated DB thread is ever needed.
