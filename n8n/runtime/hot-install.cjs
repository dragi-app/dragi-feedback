'use strict';
// Version-checked, reversible hot installation. Only the exact feedback workflow
// is routed through the new methods. No process restart or workflow publication.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const DIST = __dirname;
const HELPERS = path.join(DIST, 'webhooks/webhook-helpers.js');
const ACTIVE = path.join(DIST, 'active-executions.js');
const marker = Symbol.for('dragi.feedback.hot-install.v1');
function compile(filename, source) {
  const mod = new Module(filename + '#feedback-candidate', module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(source, filename);
  return mod.exports;
}
function install() {
  if (globalThis[marker]) return globalThis[marker].status();
  const helpers = require(HELPERS);
  const { ActiveExecutions } = require(ACTIVE);
  const originalWebhook = helpers.executeWebhook;
  const originalAdd = ActiveExecutions.prototype.add;
  const pristineWebhook = compile(HELPERS, fs.readFileSync(path.join(DIST, 'dragi-feedback-pristine-webhook.js'), 'utf8')).executeWebhook;
  const expectedAdd = JSON.parse(fs.readFileSync(path.join(DIST, 'dragi-feedback-expected-active.json'), 'utf8'));
  if (originalWebhook.toString() !== pristineWebhook.toString() || originalAdd.toString() !== expectedAdd) {
    throw new Error('SOURCE_DRIFT: refusing to patch an unexpected loaded n8n runtime');
  }
  const candidateWebhook = compile(HELPERS, fs.readFileSync(HELPERS, 'utf8')).executeWebhook;
  const activeSource = fs.readFileSync(ACTIVE, 'utf8');
  const start = activeSource.indexOf('    async add(');
  const end = activeSource.indexOf('\n    attachWorkflowExecution(', start);
  if (start < 0 || end < start) throw new Error('Unexpected ActiveExecutions source');
  const imports = activeSource.slice(0, activeSource.indexOf('let ActiveExecutions = class'));
  const method = activeSource.slice(start, end).trim().replace('async add(', 'async function (');
  const candidateAdd = compile(ACTIVE, imports + '\nmodule.exports = ' + method + ';');
  const receipts = require('./dragi-feedback-receipts.cjs');
  ActiveExecutions.prototype.add = async function (data, id) {
    if (data.workflowData?.id === receipts.TARGET && data.dragiFeedbackResumeNew === true) {
      return await candidateAdd.call(this, data, id);
    }
    return await originalAdd.call(this, data, id);
  };
  helpers.executeWebhook = async function (...args) {
    if (args[2]?.id === receipts.TARGET && args[4] === 'webhook' && args[7] === undefined) {
      return await candidateWebhook(...args);
    }
    return await originalWebhook(...args);
  };
  receipts.start();
  const installedAt = new Date().toISOString();
  const result = {
    status: () => ({ installed: true, installedAt, ...receipts.status() }),
    rollback: () => {
      helpers.executeWebhook = originalWebhook;
      ActiveExecutions.prototype.add = originalAdd;
      const state = globalThis[Symbol.for('dragi.feedback.receipts.v1')];
      if (state?.timer) { clearInterval(state.timer); state.timer = null; }
      delete globalThis[marker];
      return { installed: false, rolledBackAt: new Date().toISOString() };
    },
  };
  globalThis[marker] = result;
  return result.status();
}
module.exports = { install, status: () => globalThis[marker]?.status() ?? { installed: false },
  rollback: () => globalThis[marker]?.rollback() ?? { installed: false } };
