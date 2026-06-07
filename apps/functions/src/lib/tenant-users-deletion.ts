/**
 * Deletes ALL users of a tenant during tenant teardown.
 *
 * The previous code read every matching user with an unbounded `.get()` (runaway
 * read) and deleted them in a single pass. This bounds each read with a limit
 * AND loops until no batch remains, so a tenant with more users than one batch
 * is never left with orphaned users — consistent with how the tenant's other
 * collections are already deleted (batched loop), and avoiding the single-pass
 * orphan risk a bare `.limit()` would introduce.
 */

export const MAX_TENANT_USERS_BATCH = 200;

export interface TenantUserSnap {
  id: string;
  data(): Record<string, unknown>;
}

export interface TenantUsersDeletionDeps {
  /** Next batch of unique tenant users (deduped + bounded). Empty array = done. */
  fetchNextBatch(): Promise<TenantUserSnap[]>;
  /** Fully delete one user (subcollections, auth, phone index, user doc). */
  deleteUser(user: TenantUserSnap): Promise<void>;
}

export async function deleteAllTenantUsers(
  deps: TenantUsersDeletionDeps,
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const batch = await deps.fetchNextBatch();
    if (batch.length === 0) {
      break;
    }
    for (const user of batch) {
      await deps.deleteUser(user);
      deleted += 1;
    }
  }
  return deleted;
}
