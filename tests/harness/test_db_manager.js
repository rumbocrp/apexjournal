const fs = require('fs');
const path = require('path');
const os = require('os');

class TestDbManager {
  constructor() {
    this.tempDirs = [];
  }

  createTempDirectory(prefix = 'apex_test_') {
    const tmpDir = path.join(os.tmpdir(), prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    this.tempDirs.push(tmpDir);
    return tmpDir;
  }

  cleanup() {
    for (const dir of this.tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (err) {
        // ignore cleanup error
      }
    }
    this.tempDirs = [];
  }
}

module.exports = {
  TestDbManager
};
