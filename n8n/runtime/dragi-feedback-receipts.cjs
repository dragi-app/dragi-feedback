'use strict';
// Scoped extension for the pinned n8n 2.31.5 runtime. No external service.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { Container } = require('@n8n/di');
const { ExecutionRepository } = require('@n8n/db');
const { BinaryDataService, InstanceSettings } = require('n8n-core');
const { stringify } = require('flatted');
const { ExecutionPersistence } = require('./executions/execution-persistence');
const { WorkflowRunner } = require('./workflow-runner');
const { ActiveExecutions } = require('./active-executions');

const TARGET = '0pwbPcx7RxRXCw0O';
const PREFIX = 'dragi-feedback-v1:';
const VERSION = 'feedback-receipts-v1.1.0';
const state = globalThis[Symbol.for('dragi.feedback.receipts.v1')] ??= {
  locks: new Map(), pending: new Set(), timer: null, scanning: false,
  accepted: 0, duplicates: 0, recovered: 0, lastError: null, queue: new Set(), initialized: false,
};
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function fail(code, message) {
  const error = new Error(message); error.responseCode = code; error.httpStatusCode = code;
  return error;
}
function root() {
  return path.join(Container.get(InstanceSettings).n8nFolder, 'dragi-feedback-receipts-v1');
}
async function syncFile(file) {
  const handle = await fs.open(file, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
async function atomic(file, value) {
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(value); await handle.sync(); }
  finally { await handle.close(); }
  await fs.rename(temp, file);
  await syncFile(path.dirname(file));
}
async function readReceipt(dir) {
  try { return JSON.parse(await fs.readFile(path.join(dir, 'receipt.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}
function itemOf(data) {
  return data.executionData?.executionData?.nodeExecutionStack?.[0]?.data?.main?.[0]?.[0];
}
async function identify(data) {
  const item = itemOf(data);
  const body = item?.json?.body;
  let payload;
  try { payload = typeof body?.payload === 'string' ? JSON.parse(body.payload) : body; }
  catch { throw fail(400, 'Invalid feedback payload'); }
  const fid = payload?.feedback_id;
  if (typeof fid !== 'string' || !/^[a-zA-Z0-9._:-]{8,80}$/.test(fid)) {
    throw fail(400, 'Invalid feedback_id');
  }
  const binaries = [];
  for (const [field, metadata] of Object.entries(item.binary ?? {})) {
    if (field !== 'audio') throw fail(400, 'Unexpected feedback attachment');
    const buffer = await Container.get(BinaryDataService).getAsBuffer(metadata);
    if (buffer.length > 5 * 1024 * 1024) throw fail(413, 'Audio exceeds 5 MiB');
    binaries.push({ field, metadata, buffer, sha256: sha(buffer) });
  }
  const fingerprint = sha(canonical({ payload,
    binaries: binaries.map(b => ({field: b.field, sha256: b.sha256, mimeType: b.metadata.mimeType})) }));
  return { fid, fingerprint, binaries, key: PREFIX + sha(fid), dir: path.join(root(), sha(fid)) };
}
async function locked(key, fn) {
  const previous = state.locks.get(key) ?? Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  state.locks.set(key, current);
  await previous;
  try { return await fn(); }
  finally { release(); if (state.locks.get(key) === current) state.locks.delete(key); }
}
async function archive(identity, id, data) {
  await fs.mkdir(identity.dir, { recursive: true, mode: 0o700 });
  await syncFile(path.dirname(root()));
  await syncFile(root());
  const attachments = [];
  for (const binary of identity.binaries) {
    const name = binary.sha256 + '.audio';
    await atomic(path.join(identity.dir, name), binary.buffer);
    // Synchronize the native copy referenced by the execution as well.
    if (binary.metadata.id) {
      const original = Container.get(BinaryDataService).getPath(binary.metadata.id);
      await syncFile(original); await syncFile(path.dirname(original));
    }
    attachments.push({ field: binary.field, name, sha256: binary.sha256,
      bytes: binary.buffer.length, mimeType: binary.metadata.mimeType });
  }
  const receipt = { schema: 2, version: VERSION, feedback_id: identity.fid, receipt_id: sha(identity.fid), dispatch_state: 'admitted',
    fingerprint: identity.fingerprint, execution_id: id ? String(id) : null, workflow_id: TARGET,
    accepted_at: new Date().toISOString(), attachments,
    // Independent recovery evidence survives ordinary n8n execution pruning.
    run: stringify({ executionMode: data.executionMode, executionData: data.executionData,
      workflowData: data.workflowData, userId: data.userId,
      projectId: data.projectId, projectName: data.projectName }),
  };
  await atomic(path.join(identity.dir, 'receipt.json'), JSON.stringify(receipt));
  return receipt;
}
async function disposeDuplicate(identity, original) {
  const originalIds = new Set(Object.values(itemOf(original)?.binary ?? {}).map(b => b.id).filter(Boolean));
  const extra = identity.binaries.map(b => b.metadata.id).filter(id => id && !originalIds.has(id));
  // n8n's deleteManyByBinaryDataId removes an entire execution directory, including
  // other temporary uploads. Remove only the exact files belonging to this retry.
  for (const id of extra) {
    if (!id.startsWith('filesystem-v2:')) continue;
    const file = Container.get(BinaryDataService).getPath(id);
    for (const name of [file, file + '.metadata']) {
      try { await fs.unlink(name); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
async function accept(data) {
  if (data.workflowData.id !== TARGET || data.executionMode !== 'webhook') throw new Error('Scope mismatch');
  const identity = await identify(data);
  return await locked(identity.key, async () => {
    let receipt = await readReceipt(identity.dir);
    if (receipt) {
      if (receipt.fingerprint !== identity.fingerprint) throw fail(409, 'feedback_id already has different content');
      await disposeDuplicate(identity, require('flatted').parse(receipt.run));
      state.duplicates++;
      if (receipt.dispatch_state === 'admitted') state.queue.add(receipt.receipt_id);
      return { id: receipt.receipt_id, execution_id: receipt.execution_id, duplicate: true };
    }
    data.executionData.dragiFeedbackReceipt = { feedback_id: identity.fid, fingerprint: identity.fingerprint };
    receipt = await archive(identity, null, data);
    state.queue.add(receipt.receipt_id);
    state.accepted++;
    return { id: receipt.receipt_id, execution_id: null, duplicate: false };
  });
}
function recordError(error) {
  // Avoid logging request text, attachment contents or credentials.
  state.lastError = { at: new Date().toISOString(), name: error.name, code: error.code ?? null };
  console.error('[dragi-feedback-receipts]', JSON.stringify(state.lastError));
}
function dispatch(receiptId) {
  if (state.pending.has(receiptId) || state.pending.size >= 64) return;
  state.pending.add(receiptId);
  setImmediate(async () => {
    try {
      const dir = path.join(root(), receiptId);
      const receipt = await readReceipt(dir);
      if (!receipt || receipt.dispatch_state !== 'admitted') { state.queue.delete(receiptId); return; }
      const data = require('flatted').parse(receipt.run);
      const item = itemOf(data);
      const service = Container.get(BinaryDataService);
      // The independent attachment archive also permits restoration if native temporary
      // binary storage was cleaned between receipt publication and queue dispatch.
      for (const attachment of receipt.attachments) {
        const metadata = item.binary[attachment.field];
        try {
          const current = await service.getAsBuffer(metadata);
          if (sha(current) !== attachment.sha256) throw new Error('NATIVE_ATTACHMENT_CORRUPTED');
        }
        catch (error) {
          const bytes = await fs.readFile(path.join(dir, attachment.name));
          if (sha(bytes) !== attachment.sha256) throw new Error('ARCHIVE_ATTACHMENT_CORRUPTED');
          const restored = { ...metadata }; delete restored.id;
          item.binary[attachment.field] = await service.store({ type: 'execution', workflowId: TARGET, executionId: 'temp' }, bytes, restored);
        }
      }
      const repository = Container.get(ExecutionRepository);
      const persistence = Container.get(ExecutionPersistence);
      const key = PREFIX + receiptId;
      let existing = await repository.findOneBy({ deduplicationKey: key });
      let id = existing?.id;
      if (!existing && receipt.execution_id) {
        // A known execution may have been pruned after external writes. Preserve
        // its receipt for manual reconciliation; never create a second execution.
        receipt.dispatch_state = 'needs_review';
        receipt.review_reason = 'Previously assigned execution is unavailable';
        await atomic(path.join(dir, 'receipt.json'), JSON.stringify(receipt));
        state.queue.delete(receiptId);
        return;
      }
      if (!existing) {
        try {
          id = await persistence.create({ data: data.executionData, mode: data.executionMode,
            finished: false, workflowData: data.workflowData, status: 'new', workflowId: TARGET,
            tracingContext: data.tracingContext ?? null, deduplicationKey: key });
        } catch (error) {
          existing = await repository.findOneBy({ deduplicationKey: key });
          if (!existing) throw error;
          id = existing.id;
        }
      }
      receipt.execution_id = String(id);
      await atomic(path.join(dir, 'receipt.json'), JSON.stringify(receipt));
      if (existing && existing.status !== 'new') {
        // Never replay an execution that may already have written to Drive/Sheets.
        receipt.dispatch_state = 'dispatched';
        receipt.observed_execution_status = existing.status;
        await atomic(path.join(dir, 'receipt.json'), JSON.stringify(receipt));
        state.queue.delete(receiptId);
        return;
      }
      data.dragiFeedbackResumeNew = true;
      await Container.get(WorkflowRunner).run(data, true, false, String(id));
      receipt.dispatch_state = 'dispatched';
      receipt.dispatched_at = new Date().toISOString();
      await atomic(path.join(dir, 'receipt.json'), JSON.stringify(receipt));
      state.queue.delete(receiptId);
      state.recovered++;
    } catch (error) { recordError(error); }
    finally { state.pending.delete(receiptId); }
  });
}
async function recover() {
  if (state.scanning) return;
  state.scanning = true;
  try {
    if (!state.initialized) {
      let dirs;
      try { dirs = await fs.readdir(root(), { withFileTypes: true }); }
      catch (error) { if (error.code !== 'ENOENT') throw error; dirs = []; }
      for (const dir of dirs) {
        if (!dir.isDirectory() || !/^[a-f0-9]{64}$/.test(dir.name)) continue;
        const receipt = await readReceipt(path.join(root(), dir.name));
        if (receipt?.dispatch_state === 'admitted') state.queue.add(dir.name);
      }
      state.initialized = true;
    }
    for (const id of state.queue) {
      if (state.pending.size >= 64) break;
      dispatch(id);
    }
  } catch (error) { recordError(error); }
  finally { state.scanning = false; }
}
function start() {
  if (state.timer) return;
  state.timer = setInterval(() => void recover(), 1000);
  state.timer.unref();
  setTimeout(() => void recover(), 2000).unref();
}
function status() {
  return { version: VERSION, target: TARGET, accepted: state.accepted, duplicates: state.duplicates,
    dispatched: state.recovered, pending: state.pending.size, queued: state.queue.size, recoveryEnabled: Boolean(state.timer),
    lastError: state.lastError };
}
module.exports = { TARGET, VERSION, accept, dispatch, recover, start, status };
