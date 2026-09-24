import { beforeEach, describe, expect, it, vi } from "vitest";

const getDoc = vi.fn();
const uploadBytes = vi.fn();

vi.mock("@/lib/firebase", () => ({ db: {}, storage: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: (ref: string) => getDoc(ref),
}));
vi.mock("firebase/storage", () => ({
  ref: (_s: unknown, path: string) => path,
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  getDownloadURL: async (path: string) => `https://files/${path}`,
  deleteObject: vi.fn(),
  uploadString: vi.fn(),
}));

import {
  STORAGE_QUOTA_MESSAGE,
  getStorageUsage,
  uploadImage,
} from "@/services/storage-service";

function usage(data: Record<string, unknown> | null) {
  getDoc.mockResolvedValue({ get: (field: string) => data?.[field] });
}

const png = () => new File([new Uint8Array([1, 2, 3])], "foto.png", { type: "image/png" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("teto de armazenamento no upload", () => {
  it("com o teto estourado, explica o motivo e nem tenta subir", async () => {
    usage({ storageBytes: 300 * 1024 * 1024, overQuota: true });
    await expect(uploadImage(png(), "t1", "products", "p1")).rejects.toThrow(
      STORAGE_QUOTA_MESSAGE,
    );
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it("abaixo do teto sobe normalmente", async () => {
    usage({ storageBytes: 1024, overQuota: false });
    await expect(uploadImage(png(), "t1", "products", "p1")).resolves.toMatchObject({
      path: expect.stringContaining("tenants/t1/products/p1/"),
    });
  });

  it("falha ao ler o uso nao impede o upload (a regra do Storage decide)", async () => {
    getDoc.mockRejectedValue(new Error("offline"));
    await expect(uploadImage(png(), "t1", "products")).resolves.toBeDefined();
  });

  it("converte bytes em MB para a tela de uso", async () => {
    usage({ storageBytes: 5 * 1024 * 1024 });
    await expect(getStorageUsage("t1")).resolves.toEqual({ storageMB: 5, overQuota: false });
  });
});
