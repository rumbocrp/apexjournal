// Shared-oracle check: harness oracle must reproduce every fixture case in
// src-tauri/tests/fixtures/ar_aging_oracle.v1.json byte-for-byte.
// Run: node tests/check_oracle_fixtures.js (exit non-zero on mismatch).
const path = require('path');
const oracle = require('./harness/oracle');
const fixtures = require('../src-tauri/tests/fixtures/ar_aging_oracle.v1.json');

let failures = 0;
for (const c of fixtures.cases) {
  const got = oracle.calculateARAging({
    transactions: c.transactions,
    referenceDate: new Date(fixtures.reference_date),
  });
  const exp = c.expected;
  const keys = ['current_0_30', 'pending_31_60', 'overdue_61_90', 'critical_90_plus', 'total_receivable', 'traffic_light'];
  const diffs = keys.filter((k) => got[k] !== exp[k]);
  if (diffs.length === 0) {
    console.log(`ok - ${c.name}`);
  } else {
    failures += 1;
    console.log(`FAIL - ${c.name}: ${diffs.map((k) => `${k}: got ${got[k]}, want ${exp[k]}`).join('; ')}`);
  }
}
if (failures > 0) {
  console.log(`${failures} fixture case(s) mismatched`);
  process.exit(1);
}
console.log(`all ${fixtures.cases.length} fixture cases match`);
