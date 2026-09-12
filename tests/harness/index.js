const framework = require('./framework');
const oracle = require('./oracle');
const ipcBridge = require('./ipc_bridge');
const dbManager = require('./test_db_manager');

module.exports = {
  ...framework,
  oracle,
  ...ipcBridge,
  ...dbManager
};
