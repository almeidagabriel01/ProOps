/**
 * O cliente do KMS (gRPC) só pode ser carregado quando algo é cifrado ou
 * decifrado: o módulo é importado por Agenda, Drive e fiscal, e antes toda
 * instância da API pagava essa carga no cold start.
 */
const mockModuleLoaded = jest.fn();
const constructed = jest.fn();
const encrypt = jest.fn(async () => [{ ciphertext: Buffer.from("cipher") }]);
const decrypt = jest.fn(async () => [{ plaintext: Buffer.from("segredo") }]);

jest.mock("@google-cloud/kms", () => {
  mockModuleLoaded();
  return {
  KeyManagementServiceClient: class {
    constructor() {
      constructed();
    }
    encrypt = encrypt;
    decrypt = decrypt;
  },
  };
});
jest.mock("../logger", () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

beforeEach(() => {
  process.env.GCLOUD_PROJECT = "proj";
  process.env.CALENDAR_TOKEN_KMS_KEYRING = "ring";
  process.env.CALENDAR_TOKEN_KMS_KEY_ID = "key";
  delete process.env.CALENDAR_TOKEN_KMS_KEY;
});

it("importar o módulo não carrega o pacote do KMS", async () => {
  const mod = await import("../token-encryption");
  expect(mod.isEncryptedToken("kms:v1:abc")).toBe(true);
  expect(mockModuleLoaded).not.toHaveBeenCalled();
  expect(constructed).not.toHaveBeenCalled();
});

it("cifrar instancia o cliente uma vez e monta o nome da chave", async () => {
  const { encryptToken, decryptToken } = await import("../token-encryption");
  const envelope = await encryptToken("segredo");
  await encryptToken("outro");
  expect(constructed).toHaveBeenCalledTimes(1);
  expect(encrypt).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "projects/proj/locations/southamerica-east1/keyRings/ring/cryptoKeys/key",
    }),
  );
  await expect(decryptToken(envelope)).resolves.toBe("segredo");
});
