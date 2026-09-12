# ApexJournal — Ubiquitous Language

Canonical domain terms. Use these exact words in issues, tests, and reviews.

- **Vault**: AES-256 SQLCipher database + `vault.meta`, opened only with the derived master key. States: initialized, unlocked, locked.
- **Base amount**: `RoundBankers(amount × FXRate, 2)` in base currency. Computed once at write time via Decimal. Never recomputed from floats.
- **Outstanding invoice**: `INCOME` transaction with status `INVOICED` or `PENDING`. Nothing else ages.
- **Bucket**: one of `0-30`, `31-60`, `61-90`, `90+` days by calendar-day difference against the reference day. Future dates clamp to `0-30`.
- **Traffic light / bezel**: `RED` if `90+ > 0`, else `YELLOW` if `61-90 > 0`, else `GREEN`. Priority order is part of the meaning.
- **Blotter**: the high-density transaction table. **Pipeline**: the 5-stage case kanban. **Diary**: case-linked Markdown entries.
- **Canonical IPC name**: `get_ar_aging_summary`. `analytics_get_ar_aging` is the legacy alias, kept until the retirement rule in the contract test fires.
- **Pre-aggregation**: `ar_daily_outstanding`, one row per transaction day, trigger-maintained. Buckets are always derived at read time, so it never goes stale.
