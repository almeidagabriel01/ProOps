/**
 * Calls `fn`, then keeps retrying until `isDone(result)` is true or the retry
 * budget is exhausted. Always resolves with the last result (even if `isDone`
 * never became true), so callers can decide how to handle the not-done case.
 *
 * Used to absorb read-after-write races (e.g. a Firestore doc that is being
 * written concurrently and may not be visible on the first read).
 */
export async function retryUntil<T>(
  fn: () => Promise<T>,
  isDone: (result: T) => boolean,
  opts: { attempts: number; delayMs: number },
): Promise<T> {
  let result = await fn();
  for (let i = 0; i < opts.attempts && !isDone(result); i++) {
    await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
    result = await fn();
  }
  return result;
}
