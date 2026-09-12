const fs = require('fs');
const path = require('path');
const { runAll, colors } = require('./harness/framework');

async function main() {
  console.log(colors.magenta + colors.bold + '\n=======================================================' + colors.reset);
  console.log(colors.magenta + colors.bold + '   APEXJOURNAL 4-TIER E2E TEST EXECUTION ENGINE' + colors.reset);
  console.log(colors.magenta + colors.bold + '=======================================================' + colors.reset + '\n');

  const args = process.argv.slice(2);
  let tierFilter = null;
  let fileFilter = null;

  for (const arg of args) {
    if (arg.startsWith('--tier=')) {
      tierFilter = 'tier' + arg.split('=')[1];
    } else if (arg.endsWith('.js')) {
      fileFilter = arg;
    }
  }

  const tiers = [
    { id: 'tier1', name: 'Tier 1: Feature Coverage (>=5 per feature)', dir: path.join(__dirname, 'tier1_feature_tests') },
    { id: 'tier2', name: 'Tier 2: Boundary & Corner Cases (>=5 per feature)', dir: path.join(__dirname, 'tier2_boundary_tests') },
    { id: 'tier3', name: 'Tier 3: Cross-Feature Pairwise Interactions', dir: path.join(__dirname, 'tier3_pairwise_tests') },
    { id: 'tier4', name: 'Tier 4: Real-World Workload Scenarios (>=5 scenarios)', dir: path.join(__dirname, 'tier4_workload_tests') },
    { id: 'tier5', name: 'Tier 5: Adversarial Stress & Hardening', dir: path.join(__dirname, 'tier5_adversarial_tests') }
  ];

  for (const tier of tiers) {
    if (tierFilter && !tier.id.includes(tierFilter)) continue;
    if (!fs.existsSync(tier.dir)) continue;

    const files = fs.readdirSync(tier.dir).filter(f => f.endsWith('.js')).sort();
    for (const file of files) {
      if (fileFilter && !file.includes(fileFilter)) continue;
      const fullPath = path.join(tier.dir, file);
      require(fullPath);
    }
  }

  const results = await runAll();

  console.log('\n' + colors.bold + '--- TEST SUITE EXECUTION RESULTS ---' + colors.reset);
  for (const t of results.tests) {
    if (t.status === 'passed') {
      console.log('  ' + colors.green + '✔' + colors.reset + ' ' + t.name + ' ' + colors.dim + '(' + t.durationMs + 'ms)' + colors.reset);
    } else {
      console.log('  ' + colors.red + '✖' + colors.reset + ' ' + t.name + ' ' + colors.dim + '(' + t.durationMs + 'ms)' + colors.reset);
      if (t.error) {
        console.log('    ' + colors.red + (t.error.stack || t.error.message) + colors.reset);
      }
    }
  }

  console.log('\n' + colors.bold + '-------------------------------------------------------' + colors.reset);
  console.log('Total Tests Executed: ' + colors.bold + results.total + colors.reset);
  console.log('Passed: ' + colors.green + colors.bold + results.passed + colors.reset);
  console.log('Failed: ' + (results.failed > 0 ? (colors.red + colors.bold + results.failed) : (colors.green + '0')) + colors.reset);
  console.log('Duration: ' + colors.cyan + results.totalDuration + 'ms' + colors.reset);
  console.log(colors.bold + '-------------------------------------------------------' + colors.reset + '\n');

  if (results.failed > 0) {
    console.log(colors.red + colors.bold + '❌ TEST RUN FAILED (' + results.failed + ' failures)' + colors.reset + '\n');
    process.exit(1);
  } else {
    console.log(colors.green + colors.bold + '✅ ALL 4 TIERS PASSED WITH 100% GREEN STATUS' + colors.reset + '\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner exception:', err);
  process.exit(1);
});
