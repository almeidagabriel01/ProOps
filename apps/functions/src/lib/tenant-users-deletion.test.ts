import {
  deleteAllTenantUsers,
  type TenantUserSnap,
  type TenantUsersDeletionDeps,
} from "./tenant-users-deletion";

function snap(id: string): TenantUserSnap {
  return { id, data: () => ({}) };
}

describe("deleteAllTenantUsers — loops until empty (no single-pass orphans)", () => {
  it("deletes ALL users across multiple batches, not just the first", async () => {
    const remaining = new Set(["a", "b", "c", "d", "e"]); // 5 users
    const deleted: string[] = [];
    const BATCH = 2; // smaller than the user count -> forces >1 iteration

    const deps: TenantUsersDeletionDeps = {
      fetchNextBatch: async () =>
        Array.from(remaining).slice(0, BATCH).map(snap),
      deleteUser: async (user) => {
        remaining.delete(user.id); // mirrors the real per-user doc delete
        deleted.push(user.id);
      },
    };

    const total = await deleteAllTenantUsers(deps);

    expect(total).toBe(5);
    expect(deleted.sort()).toEqual(["a", "b", "c", "d", "e"]);
    expect(remaining.size).toBe(0); // no orphans left behind
  });

  it("returns 0 and never deletes when there are no users", async () => {
    const deleteUser = jest.fn(async () => undefined);
    const total = await deleteAllTenantUsers({
      fetchNextBatch: async () => [],
      deleteUser,
    });

    expect(total).toBe(0);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes exactly one batch then stops", async () => {
    let served = false;
    const deleteUser = jest.fn(async () => undefined);
    const deps: TenantUsersDeletionDeps = {
      fetchNextBatch: async () => {
        if (served) return [];
        served = true;
        return [snap("only")];
      },
      deleteUser,
    };

    const total = await deleteAllTenantUsers(deps);

    expect(total).toBe(1);
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it("propagates a deleteUser failure (aborts) instead of looping forever", async () => {
    // fetchNextBatch ALWAYS returns the same non-empty batch — a loop that
    // swallowed the error and retried would spin forever on a destructive op.
    // The throw must propagate (abort) instead.
    const deps: TenantUsersDeletionDeps = {
      fetchNextBatch: async () => [snap("stuck")],
      deleteUser: async () => {
        throw new Error("delete failed");
      },
    };

    await expect(deleteAllTenantUsers(deps)).rejects.toThrow("delete failed");
  });
});
