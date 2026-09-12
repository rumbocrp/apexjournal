/**
 * Standalone Test Suite for Sistema de Luces Engine
 */

const assert = require('assert');

// Pure engine logic mirroring trafficLightEngine.ts
function calculateAgeDays(issueDateIso, referenceDateIso) {
  const [refYear, refMonth, refDay] = referenceDateIso.substring(0, 10).split('-').map(Number);
  const [txYear, txMonth, txDay] = issueDateIso.substring(0, 10).split('-').map(Number);

  const refUtc = Date.UTC(refYear, refMonth - 1, refDay);
  const txUtc = Date.UTC(txYear, txMonth - 1, txDay);

  const diffMs = refUtc - txUtc;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function evaluateTrafficLights(invoices, options = {}) {
  const refDateStr = options.referenceDate || '2026-09-02';
  const eligibleInvoices = invoices.filter(
    (inv) => !inv.status || inv.status === 'INVOICED' || inv.status === 'PENDING'
  );

  let current_0_30 = 0;
  let pending_31_60 = 0;
  let overdue_61_90 = 0;
  let critical_90_plus = 0;

  for (const inv of eligibleInvoices) {
    const rawAmt = Number(inv.amount) || 0;
    if (rawAmt <= 0) continue;

    const rate = Number(inv.exchange_rate) || 1.0;
    const baseAmount = rawAmt * rate;
    const ageDays = calculateAgeDays(inv.date, refDateStr);

    if (ageDays <= 30) {
      current_0_30 += baseAmount;
    } else if (ageDays <= 60) {
      pending_31_60 += baseAmount;
    } else if (ageDays <= 90) {
      overdue_61_90 += baseAmount;
    } else {
      critical_90_plus += baseAmount;
    }
  }

  current_0_30 = roundCurrency(current_0_30);
  pending_31_60 = roundCurrency(pending_31_60);
  overdue_61_90 = roundCurrency(overdue_61_90);
  critical_90_plus = roundCurrency(critical_90_plus);

  const totalReceivable = roundCurrency(
    current_0_30 + pending_31_60 + overdue_61_90 + critical_90_plus
  );

  let state = 'GREEN';
  if (critical_90_plus > 0) {
    state = 'RED';
  } else if (overdue_61_90 > 0) {
    state = 'YELLOW';
  }

  return {
    state,
    totalReceivable,
    current_0_30,
    pending_31_60,
    overdue_61_90,
    critical_90_plus,
  };
}

console.log('====================================================');
console.log('   SISTEMA DE LUCES: STANDALONE ENGINE TEST SUITE    ');
console.log('====================================================');

// Test 1: Empty set returns GREEN with 0.00
{
  const res = evaluateTrafficLights([]);
  assert.strictEqual(res.state, 'GREEN');
  assert.strictEqual(res.totalReceivable, 0.00);
  console.log('  ✓ Test 1: Empty set resolves GREEN with 0 total');
}

// Test 2: Invoices within 0-30 days resolve GREEN
{
  const invoices = [
    { id: '1', amount: 1500, date: '2026-08-25', status: 'INVOICED' }, // 8 days
    { id: '2', amount: 2500, date: '2026-08-10', status: 'INVOICED' }, // 23 days
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.state, 'GREEN');
  assert.strictEqual(res.totalReceivable, 4000.00);
  assert.strictEqual(res.current_0_30, 4000.00);
  console.log('  ✓ Test 2: Current invoices (0-30d) resolve GREEN');
}

// Test 3: Invoices within 31-60 days stay GREEN
{
  const invoices = [
    { id: '1', amount: 3000, date: '2026-07-20', status: 'INVOICED' }, // 44 days
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.state, 'GREEN');
  assert.strictEqual(res.pending_31_60, 3000.00);
  console.log('  ✓ Test 3: Grace period invoices (31-60d) resolve GREEN');
}

// Test 4: Invoices within 61-90 days trigger YELLOW
{
  const invoices = [
    { id: '1', amount: 1000, date: '2026-08-20', status: 'INVOICED' }, // 13 days
    { id: '2', amount: 4500, date: '2026-06-25', status: 'INVOICED' }, // 69 days
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.state, 'YELLOW');
  assert.strictEqual(res.overdue_61_90, 4500.00);
  assert.strictEqual(res.totalReceivable, 5500.00);
  console.log('  ✓ Test 4: Overdue invoices (61-90d) trigger YELLOW');
}

// Test 5: Invoices over 90 days trigger RED priority
{
  const invoices = [
    { id: '1', amount: 2000, date: '2026-08-20', status: 'INVOICED' }, // 13 days
    { id: '2', amount: 3000, date: '2026-06-25', status: 'INVOICED' }, // 69 days (Yellow)
    { id: '3', amount: 5000, date: '2026-04-01', status: 'INVOICED' }, // 154 days (Red)
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.state, 'RED');
  assert.strictEqual(res.critical_90_plus, 5000.00);
  assert.strictEqual(res.totalReceivable, 10000.00);
  console.log('  ✓ Test 5: Invoices >90 days override priority and trigger RED');
}

// Test 6: Cleared / Paid invoices are strictly excluded
{
  const invoices = [
    { id: '1', amount: 10000, date: '2025-01-01', status: 'CLEARED' },
    { id: '2', amount: 20000, date: '2025-01-01', status: 'PAID' },
    { id: '3', amount: 1500, date: '2026-08-25', status: 'INVOICED' },
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.state, 'GREEN');
  assert.strictEqual(res.totalReceivable, 1500.00);
  console.log('  ✓ Test 6: CLEARED and PAID invoices are excluded from AR');
}

// Test 7: Multi-currency exchange rate normalization
{
  const invoices = [
    { id: '1', amount: 1000, exchange_rate: 1.10, date: '2026-08-25', status: 'INVOICED' }, // EUR -> $1100
    { id: '2', amount: 2000, exchange_rate: 0.85, date: '2026-08-25', status: 'INVOICED' }, // GBP -> $1700
  ];
  const res = evaluateTrafficLights(invoices, { referenceDate: '2026-09-02' });
  assert.strictEqual(res.totalReceivable, 2800.00);
  console.log('  ✓ Test 7: Multi-currency normalized base amounts compute accurately');
}

console.log('====================================================');
console.log('  ALL 7/7 STANDALONE SISTEMA DE LUCES TESTS PASSED! ');
console.log('====================================================');
