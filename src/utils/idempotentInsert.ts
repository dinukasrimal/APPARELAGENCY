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
