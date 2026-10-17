export type PendingSubmission = {
  signature: string;
  audio: Blob | null;
  id: string;
  payload: string;
};

/** Keep the exact request identity after an ambiguous network failure. */
export function submissionForDraft(
  previous: PendingSubmission | null,
  draft: Record<string, unknown>,
  audio: Blob | null,
  createId: () => string,
): PendingSubmission {
  const signature = JSON.stringify(draft);
  if (previous?.signature === signature && previous.audio === audio) return previous;
  const id = createId();
  return {
    signature,
    audio,
    id,
    payload: JSON.stringify({ ...draft, feedback_id: id, client_created_at: new Date().toISOString() }),
  };
}
