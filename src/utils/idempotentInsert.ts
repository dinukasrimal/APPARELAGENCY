// Idempotency helpers for create-once operations (invoices, sales orders).
//
// A network retry can create a duplicate row when the server committed the
// insert but the response was lost. We defend against this with a
// client_request_id that stays constant across retries of the SAME logical
// submission, backed by a UNIQUE index in the database. On a retry the insert
// fails with a 23505 unique violation on client_request_id — which we treat as
// "the row already exists" rather than an error.

/** Generate a fresh idempotency key. Call once per logical submission. */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old runtimes
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** True when the error is a unique-violation on our client_request_id index. */
export function isIdempotencyConflict(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return !!e && e.code === '23505' && String(e.message ?? '').includes('client_request_id');
}

// ── Keys that survive a remount ─────────────────────────────────────────────
// A key held in component state (useRef(newRequestId())) only protects retries
// within one mount. On a slow connection the real pattern is: submit, nothing
// seems to happen, back out of the form, open it again, submit again. That
// second mount minted a FRESH key, so the unique index saw two unrelated
// inserts and let both through — which is how duplicates still got created.
//
// Persisting the key against a stable scope (the sales order being invoiced,
// the customer plus amount being billed) means every retry of the SAME logical
// submission reuses one key, so only the first insert wins. The key is dropped
// as soon as the submission completes, so the next genuine sale starts fresh.

const STORAGE_PREFIX = 'idem:';
// Bound how long an abandoned key lingers, so a submission the user gave up on
// weeks ago can never silently swallow an identical sale much later.
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

/** Stable idempotency key for a logical submission, reused across retries. */
export function getPersistentRequestId(scope: string): string {
  const storageKey = `${STORAGE_PREFIX}${scope}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const saved = JSON.parse(raw) as { id?: string; ts?: number };
      if (saved?.id && typeof saved.ts === 'number' && Date.now() - saved.ts < KEY_TTL_MS) {
        return saved.id;
      }
    }
  } catch {
    // Private mode, disabled storage, or a corrupt value — fall through and
    // still return a usable key for this attempt.
  }

  const id = newRequestId();
  try {
    localStorage.setItem(storageKey, JSON.stringify({ id, ts: Date.now() }));
  } catch {
    // Not persistable; this attempt is still protected within its own mount.
  }
  return id;
}

/** Drop the key once the submission has been saved. */
export function clearPersistentRequestId(scope: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${scope}`);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
