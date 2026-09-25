/**
 * Com mais de 250 assinaturas manuais expirando no mesmo dia (2 escritas cada:
 * user + espelho no tenant), o batch único passava de 500 escritas e falhava
 * inteiro. createChunkedBatch divide em lotes de até 400.
 */
const commits: number[] = [];
jest.mock("./init", () => ({
  db: {
    batch: () => {
      let writes = 0;
      return {
        update: () => void (writes += 1),
        set: () => void (writes += 1),
        commit: async () => void commits.push(writes),
      };
    },
  },
}));
jest.mock("firebase-functions/v2/scheduler", () => ({ onSchedule: () => () => undefined }));
jest.mock("./lib/observability/error-logger", () => ({ captureError: jest.fn() }));

import { createChunkedBatch } from "./checkManualSubscriptions";

beforeEach(() => {
  commits.length = 0;
});

it("divide 600 escritas em lotes de no máximo 400", async () => {
  const batch = createChunkedBatch();
  const ref = {} as FirebaseFirestore.DocumentReference;
  for (let i = 0; i < 300; i++) {
    batch.update(ref, { subscriptionStatus: "past_due" });
    batch.set(ref, { subscriptionStatus: "past_due" }, { merge: true });
  }
  await batch.commit();
  expect(commits).toEqual([400, 200]);
});

it("poucas escritas continuam num lote só", async () => {
  const batch = createChunkedBatch();
  const ref = {} as FirebaseFirestore.DocumentReference;
  batch.update(ref, { a: 1 });
  batch.update(ref, { a: 2 });
  await batch.commit();
  expect(commits).toEqual([2]);
});
