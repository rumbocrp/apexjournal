/**
 * ApexJournal Mathematical & Financial Oracle
 * Authoritative mathematical reference for all financial calculations,
 * equity curves, PnL, Win Rates, AR Aging, and Shannon Entropy.
 */

function calculateShannonEntropy(buffer) {
  if (!buffer || buffer.length === 0) return 0;
  const byteCounts = new Array(256).fill(0);
  for (let i = 0; i < buffer.length; i++) {
    byteCounts[buffer[i]]++;
  }
  let entropy = 0.0;
  const total = buffer.length;
  for (let i = 0; i < 256; i++) {
    if (byteCounts[i] > 0) {
      const p = byteCounts[i] / total;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function calculateCasePnL({ transactions = [], caseId = null }) {
  const caseTx = caseId 
    ? transactions.filter(t => t.case_id === caseId)
    : transactions;

  let realized_income = 0.0;
  let realized_expense = 0.0;

  for (const tx of caseTx) {
    const isRealized = tx.status === "CLEARED" || tx.status === "PAID";
    if (isRealized) {
      const amount = Number(tx.base_amount ?? (tx.amount * (tx.exchange_rate ?? 1.0)));
      if (tx.type === "INCOME") {
        realized_income += amount;
      } else if (tx.type === "EXPENSE") {
        realized_expense += amount;
      }
    }
  }

  // Round to 2 decimals
  realized_income = Math.round(realized_income * 100) / 100;
  realized_expense = Math.round(realized_expense * 100) / 100;
  const net_margin = Math.round((realized_income - realized_expense) * 100) / 100;
  const profit_margin_pct = realized_income > 0 
    ? Math.round(((net_margin / realized_income) * 100) * 100) / 100
    : 0.0;

  return {
    realized_income,
    realized_expense,
    net_margin,
    profit_margin_pct
  };
}

function calculateWinRate({ cases = [] }) {
  const closedCases = cases.filter(c => c.stage === "COMPLETED" || c.stage === "LOST");
  if (closedCases.length === 0) {
    return 0.0;
  }
  const wonCases = closedCases.filter(c => c.stage === "COMPLETED");
  const winRate = (wonCases.length / closedCases.length) * 100.0;
  return Math.round(winRate * 100) / 100;
}

function calculateEquityCurve({ transactions = [], timeframe = "ALL", referenceDate = new Date() }) {
  const clearedTx = transactions.filter(t => t.status === "CLEARED" || t.status === "PAID");
  
  // Sort by date ascending
  clearedTx.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Aggregate by date (YYYY-MM-DD)
  const dailyMap = new Map();
  for (const tx of clearedTx) {
    const dateStr = tx.date.split("T")[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { volume_income: 0.0, volume_expense: 0.0 });
    }
    const day = dailyMap.get(dateStr);
    const amount = Number(tx.base_amount ?? (tx.amount * (tx.exchange_rate ?? 1.0)));
    if (tx.type === "INCOME") {
      day.volume_income += amount;
    } else if (tx.type === "EXPENSE") {
      day.volume_expense += amount;
    }
  }

  // Calculate timeframe cutoff
  let cutoffDate = null;
  const refTime = new Date(referenceDate).getTime();
  if (timeframe === "1W") {
    cutoffDate = new Date(refTime - 7 * 86400000);
  } else if (timeframe === "1M") {
    cutoffDate = new Date(refTime - 30 * 86400000);
  } else if (timeframe === "3M") {
    cutoffDate = new Date(refTime - 90 * 86400000);
  } else if (timeframe === "1Y") {
    cutoffDate = new Date(refTime - 365 * 86400000);
  }

  const sortedDates = Array.from(dailyMap.keys()).sort();
  const fullSeries = [];
  let runningCumulative = 0.0;

  for (const d of sortedDates) {
    const dayData = dailyMap.get(d);
    const dayIncome = Math.round(dayData.volume_income * 100) / 100;
    const dayExpense = Math.round(dayData.volume_expense * 100) / 100;
    const daily_delta = Math.round((dayIncome - dayExpense) * 100) / 100;
    runningCumulative = Math.round((runningCumulative + daily_delta) * 100) / 100;

    const pointDate = new Date(d);
    if (!cutoffDate || pointDate >= cutoffDate) {
      fullSeries.push({
        date: d,
        daily_delta,
        cumulative_equity: runningCumulative,
        volume_income: dayIncome,
        volume_expense: dayExpense
      });
    }
  }

  return fullSeries;
}

function calculateARAging({ transactions = [], referenceDate = new Date() }) {
  // Outstanding receivables: INCOME transactions with status INVOICED or PENDING
  const outstanding = transactions.filter(t => 
    t.type === "INCOME" && (t.status === "INVOICED" || t.status === "PENDING")
  );

  let current_0_30 = 0.0;
  let pending_31_60 = 0.0;
  let overdue_61_90 = 0.0;
  let critical_90_plus = 0.0;

  const refTime = new Date(referenceDate).getTime();

  for (const tx of outstanding) {
    const txTime = new Date(tx.date).getTime();
    const ageDays = Math.max(0, Math.floor((refTime - txTime) / (1000 * 60 * 60 * 24)));
    const amount = Number(tx.base_amount ?? (tx.amount * (tx.exchange_rate ?? 1.0)));

    if (ageDays <= 30) {
      current_0_30 += amount;
    } else if (ageDays <= 60) {
      pending_31_60 += amount;
    } else if (ageDays <= 90) {
      overdue_61_90 += amount;
    } else {
      critical_90_plus += amount;
    }
  }

  current_0_30 = Math.round(current_0_30 * 100) / 100;
  pending_31_60 = Math.round(pending_31_60 * 100) / 100;
  overdue_61_90 = Math.round(overdue_61_90 * 100) / 100;
  critical_90_plus = Math.round(critical_90_plus * 100) / 100;

  const total_receivable = Math.round((current_0_30 + pending_31_60 + overdue_61_90 + critical_90_plus) * 100) / 100;

  let traffic_light = "GREEN";
  if (critical_90_plus > 0) {
    traffic_light = "RED";
  } else if (overdue_61_90 > 0) {
    traffic_light = "YELLOW";
  }

  return {
    current_0_30,
    pending_31_60,
    overdue_61_90,
    critical_90_plus,
    total_receivable,
    traffic_light
  };
}

function calculateDashboardMetrics({ transactions = [], cases = [], baseCurrency = "USD" }) {
  const pnl = calculateCasePnL({ transactions });
  const winRate = calculateWinRate({ cases });

  // Invoiced volume: Quoted amount of Active + Completed cases OR Invoiced transactions
  let invoiced_volume = 0.0;
  for (const c of cases) {
    if (c.stage === "ACTIVE" || c.stage === "COMPLETED" || c.stage === "QUOTATION") {
      invoiced_volume += Number(c.quoted_amount || 0);
    }
  }
  for (const t of transactions) {
    if (t.type === "INCOME" && t.status === "INVOICED") {
      invoiced_volume += Number(t.base_amount ?? (t.amount * (t.exchange_rate ?? 1.0)));
    }
  }
  invoiced_volume = Math.round(invoiced_volume * 100) / 100;

  // Average ticket size: Mean quoted amount of COMPLETED cases
  const completedCases = cases.filter(c => c.stage === "COMPLETED");
  let avg_ticket_size = 0.0;
  if (completedCases.length > 0) {
    const totalTicket = completedCases.reduce((sum, c) => sum + Number(c.quoted_amount || 0), 0);
    avg_ticket_size = Math.round((totalTicket / completedCases.length) * 100) / 100;
  }

  return {
    cumulative_net_margin: pnl.net_margin,
    proposal_win_rate: winRate,
    realized_volume: pnl.realized_income,
    invoiced_volume,
    avg_ticket_size,
    base_currency: baseCurrency
  };
}

module.exports = {
  calculateShannonEntropy,
  calculateCasePnL,
  calculateWinRate,
  calculateEquityCurve,
  calculateARAging,
  calculateDashboardMetrics
};
