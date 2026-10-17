'use strict';
// Run inside the chosen container. The inspector is loopback-only and is closed
// after one predefined operation. No arbitrary input expression is accepted.
const fs = require('node:fs');
const http = require('node:http');
const action = process.argv[2] ?? 'status';
if (!['install', 'status', 'rollback', 'probe'].includes(action)) throw new Error('Unknown operation');
function get() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:9229/json/list', r => {
      let data = ''; r.on('data', c => data += c); r.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject); req.setTimeout(1000, () => req.destroy());
  });
}
async function main() {
  const candidates = fs.readdirSync('/proc').filter(x => /^\d+$/.test(x)).filter(id => {
    try { return fs.readFileSync('/proc/' + id + '/cmdline', 'utf8').split('\0').includes('/usr/local/bin/n8n'); }
    catch { return false; }
  });
  if (candidates.length !== 1) throw new Error('Expected exactly one n8n process');
  let targets;
  try { targets = await get(); }
  catch {
    process.kill(Number(candidates[0]), 'SIGUSR1');
    for (let i = 0; i < 40; i++) {
      try { targets = await get(); break; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
  }
  if (!targets?.[0]?.webSocketDebuggerUrl) throw new Error('Inspector unavailable');
  const socket = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const requireExpression = "process.getBuiltinModule('module').createRequire('/usr/local/lib/node_modules/n8n/package.json')";
  const operation = action === 'probe'
    ? `await (async () => { const r = ${requireExpression}; const p = '/usr/local/lib/node_modules/n8n/dist/dragi-feedback-production-probe.cjs'; delete r.cache[r.resolve(p)]; return await r(p).run(); })()`
    : `${requireExpression}('/usr/local/lib/node_modules/n8n/dist/dragi-feedback-hot-install.cjs').${action}()`;
  const expression = `(async () => { try { return JSON.stringify(${operation}); }
    catch(error) { return JSON.stringify({error:error.message}); }
    finally { setTimeout(() => process.getBuiltinModule('inspector').close(), 150).unref(); } })()`;
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Inspector operation timeout')), 45000);
    socket.onmessage = message => {
      const data = JSON.parse(message.data);
      if (data.id === 1) { clearTimeout(timer); resolve(data); }
    };
    socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  socket.close();
  if (result.error || result.result?.exceptionDetails) throw new Error('Inspector evaluation failed');
  const value = JSON.parse(result.result.result.value);
  console.log(JSON.stringify(value));
  if (value.error) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
