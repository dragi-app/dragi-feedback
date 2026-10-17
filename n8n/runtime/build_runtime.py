#!/usr/bin/env python3
"""Build the scoped extension against pristine, pinned n8n 2.31.5 JavaScript.

Only creates an output directory. Never modifies the supplied n8n installation.
"""
import argparse,hashlib,json,pathlib,shutil
parser=argparse.ArgumentParser()
parser.add_argument('--n8n-dist',type=pathlib.Path,required=True)
parser.add_argument('--output',type=pathlib.Path,required=True)
args=parser.parse_args()
here=args.output
here.mkdir(parents=True,exist_ok=False)
expected={
 'active_executions':('active-executions.js','a9a2dad46d095dfb3b2c21bc5fd82d7d9792b611e9c2a0dd30c62693f6af9369'),
 'webhook_helpers':('webhooks/webhook-helpers.js','dd7cc7a0441e8f3d3c1fe63570c805ead9e242dddfc92a5f881e12a47a4bca7a')}
snapshot={'files':{}}
for key,(name,sha) in expected.items():
 data=(args.n8n_dist/name).read_bytes()
 if hashlib.sha256(data).hexdigest()!=sha:raise SystemExit('Unsupported or modified n8n source: '+name)
 snapshot['files'][key]={'source':data.decode()}
def replace(s,a,b):
 assert s.count(a)==1,(a[:60],s.count(a))
 return s.replace(a,b,1)
s=snapshot['files']['active_executions']['source']
s=replace(s,"{ requireStatus: 'waiting' }", "{ requireStatus: executionData.dragiFeedbackResumeNew === true && executionData.workflowData.id === '0pwbPcx7RxRXCw0O' ? 'new' : 'waiting' }")
(here/'active-executions.js').write_text(s)
s=snapshot['files']['webhook_helpers']['source']
needle='        executionId = await di_1.Container.get(workflow_runner_1.WorkflowRunner).run(runData, true, !didSendResponse && !shouldDeferOnReceivedResponse, executionId, responsePromise);'
insertion='''        // The target alone uses commit-before-ack admission, independent of execution capacity.
        if (workflowData.id === '0pwbPcx7RxRXCw0O' && executionMode === 'webhook'
            && workflowStartNode.type === 'n8n-nodes-base.webhook'
            && shouldDeferOnReceivedResponse && executionId === undefined) {
            const receipts = require('../dragi-feedback-receipts.cjs');
            let admitted;
            try { admitted = await receipts.accept(runData); }
            catch (error) {
                responseCallback(null, (0, webhook_response_1.createStaticResponse)(
                    { ok: false, accepted: false, error: error.responseCode ? error.message : 'Feedback storage unavailable' },
                    error.responseCode || 503, responseHeaders));
                return;
            }
            responseCallback(null, (0, webhook_response_1.createStaticResponse)(
                JSON.stringify({ ok: true, accepted: true, receipt_id: admitted.id, execution_id: admitted.execution_id, duplicate: admitted.duplicate }),
                200, responseHeaders));
            receipts.dispatch(admitted.id, admitted.duplicate ? undefined : runData);
            return;
        }
'''
s=replace(s,needle,insertion+needle)
s += "\nsetImmediate(() => require('../dragi-feedback-receipts.cjs').start());\n"
(here/'webhook-helpers.js').write_text(s)

active=snapshot['files']['active_executions']['source']
a=active.index('    async add(');b=active.index('\n    attachWorkflowExecution(',a)
(here/'expected-active-method.json').write_text(json.dumps(active[a:b].strip()))
(here/'pristine-webhook-helpers.js').write_text(snapshot['files']['webhook_helpers']['source'])
for name in ['dragi-feedback-receipts.cjs','hot-install.cjs','inspect-client.cjs']:
 shutil.copyfile(pathlib.Path(__file__).parent/name,here/name)
payload={'active-executions.js':'active-executions.js','webhook-helpers.js':'webhooks/webhook-helpers.js',
 'dragi-feedback-receipts.cjs':'dragi-feedback-receipts.cjs','hot-install.cjs':'dragi-feedback-hot-install.cjs',
 'inspect-client.cjs':'dragi-feedback-inspect-client.cjs','expected-active-method.json':'dragi-feedback-expected-active.json',
 'pristine-webhook-helpers.js':'dragi-feedback-pristine-webhook.js'}
(here/'Dockerfile').write_text('FROM n8n-custom:2.31.5\n'+'\n'.join('COPY --chown=node:node '+source+' /usr/local/lib/node_modules/n8n/dist/'+dest for source,dest in payload.items())+'\n')
manifest={'n8n_version':'2.31.5','target_workflow':'0pwbPcx7RxRXCw0O',
 'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in here.iterdir() if p.is_file()}}
(here/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
