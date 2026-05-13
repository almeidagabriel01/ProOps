import axios, { AxiosError } from "axios";
import { describeAsaasError } from "./asaas-error";

function makeAxiosError(
  status: number,
  data: unknown,
  message = "Request failed",
): AxiosError {
  const err = new axios.AxiosError(
    message,
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      headers: {},
      config: { headers: {} } as never,
      data,
    },
  );
  return err;
}

describe("describeAsaasError", () => {
  it("extracts httpStatus and asaasErrors from Asaas AxiosError", () => {
    const err = makeAxiosError(400, {
      errors: [{ code: "invalid.cpfCnpj", description: "CPF/CNPJ inválido" }],
    });
    const result = describeAsaasError(err);
    expect(result.httpStatus).toBe(400);
    expect(result.asaasErrors).toEqual([{ code: "invalid.cpfCnpj", description: "CPF/CNPJ inválido" }]);
    expect(result.message).toBe("CPF/CNPJ inválido");
  });

  it("falls back to data.message when no errors array", () => {
    const err = makeAxiosError(422, { message: "Conta não encontrada" });
    const result = describeAsaasError(err);
    expect(result.httpStatus).toBe(422);
    expect(result.asaasErrors).toBeUndefined();
    expect(result.message).toBe("Conta não encontrada");
  });

  it("falls back to axios message when response body has no useful message", () => {
    const err = makeAxiosError(500, {});
    const result = describeAsaasError(err);
    expect(result.httpStatus).toBe(500);
    expect(result.message).toBeTruthy();
  });

  it("handles AxiosError without response body", () => {
    const err = new axios.AxiosError("Network Error", "ERR_NETWORK");
    const result = describeAsaasError(err);
    expect(result.httpStatus).toBeUndefined();
    expect(result.asaasErrors).toBeUndefined();
    expect(result.message).toBe("Network Error");
  });

  it("handles plain Error", () => {
    const err = new Error("Something went wrong");
    const result = describeAsaasError(err);
    expect(result.httpStatus).toBeUndefined();
    expect(result.asaasErrors).toBeUndefined();
    expect(result.message).toBe("Something went wrong");
  });

  it("handles string value", () => {
    const result = describeAsaasError("raw string error");
    expect(result.message).toBe("raw string error");
  });

  it("handles unknown/null value", () => {
    const result = describeAsaasError(null);
    expect(result.message).toBe("null");
  });

  it("does not include empty asaasErrors array", () => {
    const err = makeAxiosError(400, { errors: [] });
    const result = describeAsaasError(err);
    expect(result.asaasErrors).toBeUndefined();
  });

  it("filters out malformed error entries", () => {
    const err = makeAxiosError(400, { errors: [null, {}, { code: "x" }] });
    const result = describeAsaasError(err);
    // Only { code: "x" } passes the filter (has code defined)
    expect(result.asaasErrors).toEqual([{ code: "x" }]);
  });
});
