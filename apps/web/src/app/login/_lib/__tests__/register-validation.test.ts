import { describe, it, expect } from "vitest";
import {
  validateNameValue,
  validateCompanyNameValue,
  validateEmailValue,
  validatePasswordValue,
} from "../register-validation";

describe("register-validation", () => {
  describe("validateNameValue", () => {
    it("rejects empty name", () => {
      expect(validateNameValue("")).toBe(
        "Nome deve ter pelo menos 2 caracteres",
      );
    });

    it("rejects a single character", () => {
      expect(validateNameValue("a")).toBe(
        "Nome deve ter pelo menos 2 caracteres",
      );
    });

    it("rejects whitespace-only that trims below 2 chars", () => {
      expect(validateNameValue("  a  ")).toBe(
        "Nome deve ter pelo menos 2 caracteres",
      );
    });

    it("accepts a valid name", () => {
      expect(validateNameValue("ab")).toBeNull();
      expect(validateNameValue("Mauricio")).toBeNull();
    });
  });

  describe("validateCompanyNameValue", () => {
    it("rejects empty company name", () => {
      expect(validateCompanyNameValue("")).toBe(
        "Nome da empresa é obrigatório",
      );
    });

    it("rejects a single character", () => {
      expect(validateCompanyNameValue("x")).toBe(
        "Nome da empresa é obrigatório",
      );
    });

    it("accepts a valid company name", () => {
      expect(validateCompanyNameValue("Acme")).toBeNull();
    });
  });

  describe("validateEmailValue", () => {
    it("rejects empty email", () => {
      expect(validateEmailValue("")).toBe("Email é obrigatório");
    });

    it("rejects an email without domain", () => {
      expect(validateEmailValue("user@")).toBe("Email inválido");
    });

    it("rejects an email without @", () => {
      expect(validateEmailValue("userexample.com")).toBe("Email inválido");
    });

    it("accepts a valid email", () => {
      expect(validateEmailValue("user@example.com")).toBeNull();
    });
  });

  describe("validatePasswordValue", () => {
    it("rejects empty password", () => {
      expect(validatePasswordValue("")).toBe(
        "Senha deve ter pelo menos 6 caracteres",
      );
    });

    it("rejects a password shorter than 6 chars", () => {
      expect(validatePasswordValue("12345")).toBe(
        "Senha deve ter pelo menos 6 caracteres",
      );
    });

    it("accepts a password with 6 or more chars", () => {
      expect(validatePasswordValue("123456")).toBeNull();
    });
  });
});
