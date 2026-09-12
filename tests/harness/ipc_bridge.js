const fs = require('fs');
const crypto = require('crypto');
const oracle = require('./oracle');

class MemorySecret {
  constructor(buffer) {
    this.buffer = Buffer.from(buffer);
    this.isZeroized = false;
  }

  zeroize() {
    if (!this.isZeroized && this.buffer) {
      this.buffer.fill(0);
      this.isZeroized = true;
    }
  }

  getBytes() {
    if (this.isZeroized) {
      throw new Error("Secret has been zeroized from memory");
    }
    return this.buffer;
  }
}

class ApexJournalTestInstance {
  constructor(options = {}) {
    this.dbPath = options.dbPath || null;
    this.baseCurrency = options.baseCurrency || "USD";
    this.autoLockMinutes = options.autoLockMinutes || 15;
    this.reset();
  }

  reset() {
    this.isInitialized = false;
    this.isUnlocked = false;
    this.masterPasswordHash = null;
    this.salt = null;
    this.derivedKey = null;
    this.biometricAvailable = true;
    this.biometricEnrolled = false;
    this.lastActivityTimestamp = Date.now();

    this.categories = [
      { id: "cat-1", name: "Client Consulting Fee", type: "INCOME" },
      { id: "cat-2", name: "Retainer", type: "INCOME" },
      { id: "cat-3", name: "Subcontractor / Engineering", type: "EXPENSE" },
      { id: "cat-4", name: "Software & SaaS Subscriptions", type: "EXPENSE" },
      { id: "cat-5", name: "Travel & Hospitality", type: "EXPENSE" },
      { id: "cat-6", name: "Legal & Accounting", type: "EXPENSE" }
    ];
    this.transactions = [];
    this.cases = [];
    this.milestones = [];
    this.journalEntries = [];
  }

  _touchActivity() {
    this.lastActivityTimestamp = Date.now();
  }

  _requireUnlocked() {
    if (!this.isInitialized) {
      throw new Error("Vault not initialized. Please complete vault setup first.");
    }
    if (!this.isUnlocked) {
      throw new Error("Vault is locked. Decryption key not present in memory.");
    }
    this._touchActivity();
  }

  async vault_setup({ masterPassword }) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error("Master password must be at least 8 characters long.");
    }
    if (this.isInitialized) {
      throw new Error("Vault is already initialized.");
    }

    this.salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(masterPassword, this.salt, 10000, 32, 'sha256');
    this.derivedKey = new MemorySecret(key);
    this.masterPasswordHash = crypto.createHash('sha256').update(key).digest('hex');

    this.isInitialized = true;
    this.isUnlocked = true;
    this.biometricEnrolled = true;
    this._touchActivity();

    return this.vault_get_status();
  }

  async vault_unlock({ masterPassword }) {
    if (!this.isInitialized) {
      throw new Error("Vault not initialized.");
    }
    if (!masterPassword) {
      throw new Error("Password cannot be empty.");
    }

    const testKey = crypto.pbkdf2Sync(masterPassword, this.salt, 10000, 32, 'sha256');
    const testHash = crypto.createHash('sha256').update(testKey).digest('hex');

    if (testHash !== this.masterPasswordHash) {
      throw new Error("Invalid master password. Authentication failed.");
    }

    if (this.derivedKey) {
      this.derivedKey.zeroize();
    }
    this.derivedKey = new MemorySecret(testKey);
    this.isUnlocked = true;
    this._touchActivity();

    return this.vault_get_status();
  }

  async vault_unlock_biometric() {
    if (!this.isInitialized) {
      throw new Error("Vault not initialized.");
    }
    if (!this.biometricAvailable || !this.biometricEnrolled) {
      throw new Error("Biometric unlock unavailable or not enrolled.");
    }

    this.isUnlocked = true;
    this._touchActivity();
    return this.vault_get_status();
  }

  async vault_lock() {
    if (this.derivedKey) {
      this.derivedKey.zeroize();
      this.derivedKey = null;
    }
    this.isUnlocked = false;
  }

  async vault_get_status() {
    return {
      initialized: this.isInitialized,
      unlocked: this.isUnlocked,
      biometricAvailable: this.biometricAvailable,
      autoLockMinutes: this.autoLockMinutes
    };
  }

  async vault_touch() {
    if (this.isUnlocked) this._touchActivity();
  }

  async transaction_create({ input }) {
    this._requireUnlocked();
    if (!input.date) throw new Error("Transaction date is required.");
    if (!input.type || !["INCOME", "EXPENSE"].includes(input.type)) {
      throw new Error("Valid transaction type (INCOME or EXPENSE) is required.");
    }
    if (input.amount == null || typeof input.amount !== "number" || isNaN(input.amount)) {
      throw new Error("Valid transaction amount is required.");
    }

    const currency = input.currency || this.baseCurrency;
    const exchange_rate = input.exchange_rate != null ? Number(input.exchange_rate) : 1.0;
    if (exchange_rate <= 0) {
      throw new Error("Exchange rate must be strictly positive.");
    }

    const base_amount = Math.round(input.amount * exchange_rate * 100) / 100;
    const id = input.id || "tx-" + crypto.randomUUID();

    let category_name = input.category_name;
    if (input.category_id && !category_name) {
      const cat = this.categories.find(c => c.id === input.category_id);
      if (cat) category_name = cat.name;
    }

    let case_title = input.case_title;
    if (input.case_id && !case_title) {
      const cs = this.cases.find(c => c.id === input.case_id);
      if (cs) case_title = cs.title;
    }

    const tx = {
      id,
      date: input.date,
      type: input.type,
      category_id: input.category_id || "cat-1",
      category_name: category_name || "General",
      amount: input.amount,
      currency,
      exchange_rate,
      base_amount,
      status: input.status || "CLEARED",
      case_id: input.case_id || null,
      case_title: case_title || null,
      notes: input.notes || null
    };

    this.transactions.push(tx);
    return { ...tx };
  }

  async transaction_update({ id, input }) {
    this._requireUnlocked();
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) {
      throw new Error("Transaction with ID " + id + " not found.");
    }

    const tx = this.transactions[idx];
    if (input.amount != null) {
      if (typeof input.amount !== "number" || isNaN(input.amount)) {
        throw new Error("Invalid transaction amount.");
      }
      tx.amount = input.amount;
    }
    if (input.exchange_rate != null) {
      if (input.exchange_rate <= 0) throw new Error("Exchange rate must be positive.");
      tx.exchange_rate = input.exchange_rate;
    }
    if (input.currency != null) tx.currency = input.currency;
    tx.base_amount = Math.round(tx.amount * tx.exchange_rate * 100) / 100;

    if (input.date != null) tx.date = input.date;
    if (input.type != null) tx.type = input.type;
    if (input.category_id != null) tx.category_id = input.category_id;
    if (input.category_name != null) tx.category_name = input.category_name;
    if (input.status != null) tx.status = input.status;
    if (input.case_id !== undefined) tx.case_id = input.case_id;
    if (input.case_title !== undefined) tx.case_title = input.case_title;
    if (input.notes !== undefined) tx.notes = input.notes;

    return { ...tx };
  }

  async transaction_delete({ id }) {
    this._requireUnlocked();
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx === -1) {
      throw new Error("Transaction with ID " + id + " not found.");
    }
    this.transactions.splice(idx, 1);
  }

  async transaction_list({ filter = {} } = {}) {
    this._requireUnlocked();
    let list = [...this.transactions];

    if (filter.type) {
      list = list.filter(t => t.type === filter.type);
    }
    if (filter.status) {
      list = list.filter(t => t.status === filter.status);
    }
    if (filter.case_id) {
      list = list.filter(t => t.case_id === filter.case_id);
    }
    if (filter.category_id) {
      list = list.filter(t => t.category_id === filter.category_id);
    }
    if (filter.currency) {
      list = list.filter(t => t.currency === filter.currency);
    }
    if (filter.startDate) {
      list = list.filter(t => t.date >= filter.startDate);
    }
    if (filter.endDate) {
      list = list.filter(t => t.date <= filter.endDate);
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(t => 
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.case_title && t.case_title.toLowerCase().includes(q)) ||
        (t.category_name && t.category_name.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async category_list() {
    this._requireUnlocked();
    return [...this.categories];
  }

  async case_create({ input }) {
    this._requireUnlocked();
    if (!input.title || !input.title.trim()) {
      throw new Error("Case title is required.");
    }
    if (!input.client_name || !input.client_name.trim()) {
      throw new Error("Client name is required.");
    }

    const id = input.id || "case-" + crypto.randomUUID();
    const now = new Date().toISOString();
    const c = {
      id,
      title: input.title,
      client_name: input.client_name,
      stage: input.stage || "LEAD",
      quoted_amount: Number(input.quoted_amount || 0),
      currency: input.currency || this.baseCurrency,
      created_at: input.created_at || now,
      updated_at: input.updated_at || now
    };

    this.cases.push(c);
    return { ...c };
  }

  async case_update({ id, input }) {
    this._requireUnlocked();
    const cs = this.cases.find(c => c.id === id);
    if (!cs) {
      throw new Error("Case with ID " + id + " not found.");
    }

    if (input.title != null) cs.title = input.title;
    if (input.client_name != null) cs.client_name = input.client_name;
    if (input.stage != null) cs.stage = input.stage;
    if (input.quoted_amount != null) cs.quoted_amount = Number(input.quoted_amount);
    if (input.currency != null) cs.currency = input.currency;
    cs.updated_at = new Date().toISOString();

    return { ...cs };
  }

  async case_list() {
    this._requireUnlocked();
    return [...this.cases];
  }

  async case_get_detail({ id }) {
    this._requireUnlocked();
    const cs = this.cases.find(c => c.id === id);
    if (!cs) {
      throw new Error("Case with ID " + id + " not found.");
    }

    const pnl = oracle.calculateCasePnL({
      transactions: this.transactions,
      caseId: id
    });

    const milestones = this.milestones.filter(m => m.case_id === id);
    const diary_entries = this.journalEntries.filter(j => j.case_id === id);

    return {
      ...cs,
      realized_income: pnl.realized_income,
      realized_expense: pnl.realized_expense,
      net_margin: pnl.net_margin,
      profit_margin_pct: pnl.profit_margin_pct,
      milestones,
      diary_entries
    };
  }

  async milestone_create({ input }) {
    this._requireUnlocked();
    const id = input.id || "ms-" + crypto.randomUUID();
    const m = {
      id,
      case_id: input.case_id,
      title: input.title,
      description: input.description || "",
      due_date: input.due_date || "",
      completed: !!input.completed,
      amount: Number(input.amount || 0)
    };
    this.milestones.push(m);
    return { ...m };
  }

  async milestone_toggle({ id, completed }) {
    this._requireUnlocked();
    const m = this.milestones.find(x => x.id === id);
    if (!m) {
      throw new Error("Milestone with ID " + id + " not found.");
    }
    m.completed = completed;
    return { ...m };
  }

  async journal_create({ input }) {
    this._requireUnlocked();
    if (!input.content || !input.content.trim()) {
      throw new Error("Journal entry content cannot be empty.");
    }

    const id = input.id || "jrn-" + crypto.randomUUID();
    const now = new Date().toISOString();
    const entry = {
      id,
      date: input.date || now.split("T")[0],
      title: input.title || "",
      content: input.content,
      case_id: input.case_id || null,
      tags: Array.isArray(input.tags) ? input.tags : [],
      created_at: now,
      updated_at: now
    };

    this.journalEntries.push(entry);
    return { ...entry };
  }

  async journal_update({ id, input }) {
    this._requireUnlocked();
    const entry = this.journalEntries.find(j => j.id === id);
    if (!entry) {
      throw new Error("Journal entry with ID " + id + " not found.");
    }

    if (input.title != null) entry.title = input.title;
    if (input.content != null) entry.content = input.content;
    if (input.date != null) entry.date = input.date;
    if (input.case_id !== undefined) entry.case_id = input.case_id;
    if (input.tags != null) entry.tags = input.tags;
    entry.updated_at = new Date().toISOString();

    return { ...entry };
  }

  async journal_list({ filter = {} } = {}) {
    this._requireUnlocked();
    let list = [...this.journalEntries];

    if (filter.case_id) {
      list = list.filter(j => j.case_id === filter.case_id);
    }
    if (filter.tag) {
      list = list.filter(j => j.tags && j.tags.includes(filter.tag));
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(j => 
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.content && j.content.toLowerCase().includes(q))
      );
    }

    return list;
  }

  async analytics_get_dashboard() {
    this._requireUnlocked();
    return oracle.calculateDashboardMetrics({
      transactions: this.transactions,
      cases: this.cases,
      baseCurrency: this.baseCurrency
    });
  }

  async analytics_get_equity_curve({ timeframe = "ALL" } = {}) {
    this._requireUnlocked();
    return oracle.calculateEquityCurve({
      transactions: this.transactions,
      timeframe,
      referenceDate: new Date()
    });
  }

  async analytics_get_ar_aging() {
    this._requireUnlocked();
    return oracle.calculateARAging({
      transactions: this.transactions,
      referenceDate: new Date()
    });
  }

  // SPEC §6.2 canonical alias. Same engine, dual name for E2E compat.
  async get_ar_aging_summary() {
    return this.analytics_get_ar_aging();
  }

  async vault_export_backup({ destinationPath }) {
    this._requireUnlocked();
    if (!destinationPath) {
      throw new Error("Destination backup path is required.");
    }

    const payload = JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      baseCurrency: this.baseCurrency,
      categories: this.categories,
      transactions: this.transactions,
      cases: this.cases,
      milestones: this.milestones,
      journalEntries: this.journalEntries
    });

    const iv = crypto.randomBytes(12);
    const cipherKey = this.derivedKey.getBytes();
    const cipher = crypto.createCipheriv("aes-256-gcm", cipherKey, iv);
    
    let encrypted = cipher.update(payload, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    const magic = Buffer.from("APEX");
    const fullBackup = Buffer.concat([magic, this.salt, iv, tag, encrypted]);

    fs.writeFileSync(destinationPath, fullBackup);
    return {
      success: true,
      backupPath: destinationPath,
      sizeBytes: fullBackup.length
    };
  }

  async vault_restore_backup({ sourcePath, masterPassword }) {
    if (!fs.existsSync(sourcePath)) {
      throw new Error("Backup file not found at path " + sourcePath);
    }

    const fileData = fs.readFileSync(sourcePath);
    if (fileData.length < 64) {
      throw new Error("Corrupted backup file: payload is too small.");
    }

    const magic = fileData.subarray(0, 4);
    if (magic.toString("utf8") !== "APEX") {
      throw new Error("Invalid backup container format (magic bytes mismatch).");
    }

    const salt = fileData.subarray(4, 36);
    const iv = fileData.subarray(36, 48);
    const tag = fileData.subarray(48, 64);
    const ciphertext = fileData.subarray(64);

    const testKey = crypto.pbkdf2Sync(masterPassword, salt, 10000, 32, 'sha256');

    let decryptedText;
    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", testKey, iv);
      decipher.setAuthTag(tag);
      let dec = decipher.update(ciphertext);
      dec = Buffer.concat([dec, decipher.final()]);
      decryptedText = dec.toString("utf8");
    } catch (err) {
      throw new Error("Failed to restore backup: Invalid password or corrupted authentication tag.");
    }

    const parsed = JSON.parse(decryptedText);

    this.salt = salt;
    this.derivedKey = new MemorySecret(testKey);
    this.masterPasswordHash = crypto.createHash('sha256').update(testKey).digest('hex');
    this.isInitialized = true;
    this.isUnlocked = true;

    this.baseCurrency = parsed.baseCurrency || "USD";
    this.categories = parsed.categories || [];
    this.transactions = parsed.transactions || [];
    this.cases = parsed.cases || [];
    this.milestones = parsed.milestones || [];
    this.journalEntries = parsed.journalEntries || [];
    this._touchActivity();
  }

  async export_csv({ exportType }) {
    this._requireUnlocked();
    let csv = "";

    if (exportType === "transactions") {
      const headers = ["ID", "Date", "Type", "Category", "Amount", "Currency", "ExchangeRate", "BaseAmount", "Status", "Case", "Notes"];
      const rows = this.transactions.map(t => [
        t.id,
        t.date,
        t.type,
        `"${(t.category_name || "").replace(/"/g, '""')}"`,
        t.amount.toFixed(2),
        t.currency,
        t.exchange_rate.toFixed(4),
        t.base_amount.toFixed(2),
        t.status,
        `"${(t.case_title || "").replace(/"/g, '""')}"`,
        `"${(t.notes || "").replace(/"/g, '""')}"`
      ].join(","));
      csv = [headers.join(","), ...rows].join("\n");
    } else if (exportType === "cases") {
      const headers = ["ID", "Title", "Client", "Stage", "QuotedAmount", "Currency", "CreatedAt", "UpdatedAt"];
      const rows = this.cases.map(c => [
        c.id,
        `"${c.title.replace(/"/g, '""')}"`,
        `"${c.client_name.replace(/"/g, '""')}"`,
        c.stage,
        c.quoted_amount.toFixed(2),
        c.currency,
        c.created_at,
        c.updated_at
      ].join(","));
      csv = [headers.join(","), ...rows].join("\n");
    } else if (exportType === "journal") {
      const headers = ["ID", "Date", "Title", "Content", "CaseID", "Tags", "CreatedAt"];
      const rows = this.journalEntries.map(j => [
        j.id,
        j.date,
        `"${(j.title || "").replace(/"/g, '""')}"`,
        `"${j.content.replace(/"/g, '""')}"`,
        j.case_id || "",
        `"${(j.tags || []).join(";")}"`,
        j.created_at
      ].join(","));
      csv = [headers.join(","), ...rows].join("\n");
    } else {
      throw new Error("Unknown exportType: " + exportType);
    }

    return csv;
  }

  async export_excel({ destinationPath }) {
    this._requireUnlocked();
    const content = Buffer.from("PK\x03\x04[MOCK_EXCEL_STRUCTURE]");
    fs.writeFileSync(destinationPath, content);
  }
}

module.exports = {
  ApexJournalTestInstance,
  MemorySecret
};
