/**
 * ApexJournal Standalone E2E Test Framework
 * Provides BDD-style describe/test/it/expect and runner functionality.
 */

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m"
};

class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
  }
}

class TestContext {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.currentTest = null;
  }

  describe(name, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      name,
      parent: parentSuite,
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: [],
      tests: [],
      subSuites: []
    };

    if (parentSuite) {
      parentSuite.subSuites.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.currentSuite = suite;
    fn();
    this.currentSuite = parentSuite;
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.describe("Default Suite", () => {
        this.test(name, fn);
      });
      return;
    }
    this.currentSuite.tests.push({
      name,
      fn,
      suite: this.currentSuite,
      durationMs: 0,
      status: "pending",
      error: null
    });
  }

  beforeAll(fn) {
    if (this.currentSuite) this.currentSuite.beforeAll.push(fn);
  }

  afterAll(fn) {
    if (this.currentSuite) this.currentSuite.afterAll.push(fn);
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEach.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEach.push(fn);
  }
}

const globalContext = new TestContext();

function describe(name, fn) {
  globalContext.describe(name, fn);
}

function test(name, fn) {
  globalContext.test(name, fn);
}

const it = test;

function beforeAll(fn) {
  globalContext.beforeAll(fn);
}

function afterAll(fn) {
  globalContext.afterAll(fn);
}

function beforeEach(fn) {
  globalContext.beforeEach(fn);
}

function afterEach(fn) {
  globalContext.afterEach(fn);
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function formatValue(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return "[" + v.map(formatValue).join(", ") + "]";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return Object.prototype.toString.call(v);
    }
  }
  return String(v);
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new AssertionError(
          `Expected ${formatValue(actual)} to be ${formatValue(expected)}`,
          actual,
          expected
        );
      }
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) {
        throw new AssertionError(
          `Expected deeply equal:\nActual: ${formatValue(actual)}\nExpected: ${formatValue(expected)}`,
          actual,
          expected
        );
      }
    },
    toBeCloseTo(expected, precision = 2) {
      const diff = Math.abs(actual - expected);
      const threshold = Math.pow(10, -precision) / 2;
      if (diff > threshold) {
        throw new AssertionError(
          `Expected ${actual} to be close to ${expected} (precision: ${precision}, diff: ${diff}, threshold: ${threshold})`,
          actual,
          expected
        );
      }
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) {
        throw new AssertionError(
          `Expected ${actual} > ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeGreaterThanOrEqual(expected) {
      if (!(actual >= expected)) {
        throw new AssertionError(
          `Expected ${actual} >= ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) {
        throw new AssertionError(
          `Expected ${actual} < ${expected}`,
          actual,
          expected
        );
      }
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) {
        throw new AssertionError(
          `Expected ${actual} <= ${expected}`,
          actual,
          expected
        );
      }
    },
    toContain(item) {
      if (typeof actual === "string") {
        if (!actual.includes(item)) {
          throw new AssertionError(
            `Expected string ${formatValue(actual)} to contain ${formatValue(item)}`,
            actual,
            item
          );
        }
      } else if (Array.isArray(actual)) {
        const found = actual.some(x => deepEqual(x, item) || x === item);
        if (!found) {
          throw new AssertionError(
            `Expected array to contain ${formatValue(item)}`,
            actual,
            item
          );
        }
      } else {
        throw new AssertionError(
          `toContain requires string or array, got ${typeof actual}`,
          actual,
          item
        );
      }
    },
    toMatch(pattern) {
      const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      if (!regex.test(String(actual))) {
        throw new AssertionError(
          `Expected ${formatValue(actual)} to match pattern ${pattern}`,
          actual,
          pattern
        );
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(
          `Expected null, got ${formatValue(actual)}`,
          actual,
          null
        );
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new AssertionError(
          `Expected undefined, got ${formatValue(actual)}`,
          actual,
          undefined
        );
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new AssertionError(
          `Expected defined value, got undefined`,
          actual,
          "defined"
        );
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(
          `Expected truthy value, got ${formatValue(actual)}`,
          actual,
          true
        );
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new AssertionError(
          `Expected falsy value, got ${formatValue(actual)}`,
          actual,
          false
        );
      }
    },
    toBeNaN() {
      if (!Number.isNaN(actual)) {
        throw new AssertionError(
          `Expected NaN, got ${formatValue(actual)}`,
          actual,
          NaN
        );
      }
    },
    toThrow(expectedMessage) {
      if (typeof actual !== "function") {
        throw new AssertionError("toThrow expects a function", actual, "function");
      }
      let threw = false;
      let thrownError = null;
      try {
        actual();
      } catch (err) {
        threw = true;
        thrownError = err;
      }
      if (!threw) {
        throw new AssertionError("Expected function to throw an error, but it did not throw.");
      }
      if (expectedMessage) {
        const msg = thrownError ? thrownError.message || String(thrownError) : "";
        if (expectedMessage instanceof RegExp) {
          if (!expectedMessage.test(msg)) {
            throw new AssertionError(
              `Expected error message to match ${expectedMessage}, got: ${msg}`,
              msg,
              expectedMessage
            );
          }
        } else if (!msg.includes(expectedMessage)) {
          throw new AssertionError(
            `Expected error message to contain "${expectedMessage}", got: "${msg}"`,
            msg,
            expectedMessage
          );
        }
      }
    },
    resolves: {
      async toEqual(expected) {
        const res = await actual;
        expect(res).toEqual(expected);
      },
      async toBe(expected) {
        const res = await actual;
        expect(res).toBe(expected);
      }
    },
    rejects: {
      async toThrow(expectedMessage) {
        let threw = false;
        let thrownError = null;
        try {
          await actual;
        } catch (err) {
          threw = true;
          thrownError = err;
        }
        if (!threw) {
          throw new AssertionError("Expected promise to reject, but it resolved.");
        }
        if (expectedMessage) {
          const msg = thrownError ? thrownError.message || String(thrownError) : "";
          if (expectedMessage instanceof RegExp) {
            if (!expectedMessage.test(msg)) {
              throw new AssertionError(
                `Expected rejected message to match ${expectedMessage}, got: ${msg}`,
                msg,
                expectedMessage
              );
            }
          } else if (!msg.includes(expectedMessage)) {
            throw new AssertionError(
              `Expected rejected message to contain "${expectedMessage}", got: "${msg}"`,
              msg,
              expectedMessage
            );
          }
        }
      }
    }
  };
}

async function runSuite(suite, results = { passed: 0, failed: 0, tests: [] }) {
  for (const hook of suite.beforeAll) {
    await hook();
  }

  for (const t of suite.tests) {
    for (const hook of suite.beforeEach) {
      await hook();
    }

    const start = Date.now();
    try {
      await t.fn();
      t.durationMs = Date.now() - start;
      t.status = "passed";
      results.passed++;
    } catch (err) {
      t.durationMs = Date.now() - start;
      t.status = "failed";
      t.error = err;
      results.failed++;
    }

    for (const hook of suite.afterEach) {
      await hook();
    }

    results.tests.push(t);
  }

  for (const sub of suite.subSuites) {
    await runSuite(sub, results);
  }

  for (const hook of suite.afterAll) {
    await hook();
  }

  return results;
}

async function runAll() {
  const allResults = { passed: 0, failed: 0, tests: [] };
  const startTime = Date.now();

  for (const suite of globalContext.suites) {
    await runSuite(suite, allResults);
  }

  const totalDuration = Date.now() - startTime;
  return {
    ...allResults,
    totalDuration,
    total: allResults.passed + allResults.failed
  };
}

module.exports = {
  describe,
  test,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  runAll,
  colors,
  globalContext
};
