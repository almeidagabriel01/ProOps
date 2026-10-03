import { beforeEach, describe, expect, it, vi } from "vitest";

const getDoc = vi.fn();
const uploadBytes = vi.fn();
const uploadString = vi.fn();

vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/firebase-storage", () => ({ storage: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: (ref: string) => getDoc(ref),
}));
vi.mock("firebase/storage", () => ({
  ref: (_s: unknown, path: string) => path,
  uploadBytes: (...args: unknown[]) => uploadBytes(...args),
  uploadString: (...args: unknown[]) => uploadString(...args),
  getDownloadURL: async (path: string) => `https://files/${path}`,
  deleteObject: vi.fn(),
}));

import {
  UPLOAD_ERROR_MESSAGES,
  describeUploadError,
} from "@/lib/storage-upload-error";
import {
  uploadBase64Image,
  uploadImage,
  uploadProposalAttachment,
} from "@/services/storage-service";

const REAL_MESSAGE =
  "Firebase Storage: User does not have permission to access 'tenants/tenant_ZayPIONB7ncF4vvXgz1821Idp6y2/products/r5z36fVkvZ41jmxLRAI2/1790802646019-acf5gr.jpg'. (storage/unauthorized)";

function storageError(code: string, message = REAL_MESSAGE) {
  return Object.assign(new Error(message), { code, name: "FirebaseError" });
}

const jpg = () => new File([new Uint8Array([1, 2, 3])], "foto.jpg", { type: "image/jpeg" });
const pdf = () => new File([new Uint8Array([1, 2, 3])], "a.pdf", { type: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  getDoc.mockResolvedValue({ get: () => undefined });
});

describe("describeUploadError", () => {
  it("caso real: permissao negada vira frase em portugues, sem o caminho do arquivo", () => {
    const result = describeUploadError(storageError("storage/unauthorized")) as Error;
    expect(result.message).toBe(UPLOAD_ERROR_MESSAGES["storage/unauthorized"]);
    expect(result.message).not.toContain("tenants/");
    expect(result.cause).toBeInstanceOf(Error);
  });

  it.each(Object.keys(UPLOAD_ERROR_MESSAGES))("traduz %s", (code) => {
    expect((describeUploadError(storageError(code)) as Error).message).toBe(
      UPLOAD_ERROR_MESSAGES[code],
    );
  });

  it("codigo do Storage sem traducao propria cai na frase generica", () => {
    const result = describeUploadError(storageError("storage/unknown")) as Error;
    expect(result.message).not.toContain("tenants/");
    expect(result.message).toMatch(/Não foi possível enviar o arquivo/);
  });

  it("erro que nao e do Storage passa como veio", () => {
    const original = new Error("Arquivo muito grande.");
    expect(describeUploadError(original)).toBe(original);
    const firestore = Object.assign(new Error("x"), { code: "permission-denied" });
    expect(describeUploadError(firestore)).toBe(firestore);
  });
});

describe("os tres uploads entregam a frase traduzida", () => {
  it("imagem de produto", async () => {
    uploadBytes.mockRejectedValue(storageError("storage/unauthorized"));
    await expect(uploadImage(jpg(), "t1", "products", "p1")).rejects.toThrow(
      UPLOAD_ERROR_MESSAGES["storage/unauthorized"],
    );
  });

  it("imagem em base64", async () => {
    uploadString.mockRejectedValue(storageError("storage/unauthorized"));
    await expect(
      uploadBase64Image("data:image/png;base64,AAAA", "t1", "proposals", "pr1"),
    ).rejects.toThrow(UPLOAD_ERROR_MESSAGES["storage/unauthorized"]);
  });

  it("anexo de proposta", async () => {
    uploadBytes.mockRejectedValue(storageError("storage/quota-exceeded"));
    await expect(uploadProposalAttachment(pdf(), "t1", "pr1")).rejects.toThrow(
      UPLOAD_ERROR_MESSAGES["storage/quota-exceeded"],
    );
  });
});
