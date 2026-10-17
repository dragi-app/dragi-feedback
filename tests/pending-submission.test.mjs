import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/pendingSubmission.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { submissionForDraft } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));

test('network retry keeps ID, timestamp, payload and audio identity', () => {
  let ids = 0;
  const newId = () => 'feedback-' + ++ids;
  const audio = new Blob(['audio']);
  const draft = { description: 'Тест', audio: { size_bytes: audio.size } };
  const first = submissionForDraft(null, draft, audio, newId);
  const retry = submissionForDraft(first, { ...draft }, audio, newId);
  assert.equal(retry, first);
  assert.equal(retry.payload, first.payload);
  assert.equal(ids, 1);
  const changedText = submissionForDraft(first, { ...draft, description: 'Інший текст' }, audio, newId);
  assert.notEqual(changedText.id, first.id);
  const changedAudio = submissionForDraft(first, draft, new Blob(['other']), newId);
  assert.notEqual(changedAudio.id, first.id);
  const nextFeedback = submissionForDraft(null, draft, audio, newId);
  assert.notEqual(nextFeedback.id, first.id);
});
