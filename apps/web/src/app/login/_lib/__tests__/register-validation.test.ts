import { describe, it, expect } from "vitest";
import {
  validateNameValue,
  validateCompanyNameValue,
  validateEmailValue,
  validatePasswordValue,
  validatePhoneValue,
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

  describe("validatePhoneValue", () => {
    it("accepts empty phone (optional field)", () => {
      expect(validatePhoneValue("")).toBeNull();
      expect(validatePhoneValue("   ")).toBeNull();
    });

    it("rejects a too-short phone", () => {
      expect(validatePhoneValue("11")).toBe("Telefone inválido");
      expect(validatePhoneValue("(11) 9999")).toBe("Telefone inválido");
    });

    it("accepts a valid mobile (11 digits) in masked or raw form", () => {
      expect(validatePhoneValue("(11) 99999-9999")).toBeNull();
      expect(validatePhoneValue("11999999999")).toBeNull();
    });

    it("accepts a valid landline (10 digits)", () => {
      expect(validatePhoneValue("(11) 3333-3333")).toBeNull();
    });

    it("accepts numbers prefixed with the 55 country code", () => {
      expect(validatePhoneValue("5511999999999")).toBeNull();
      expect(validatePhoneValue("+55 (11) 99999-9999")).toBeNull();
    });

    it("rejects a number that is too long", () => {
      expect(validatePhoneValue("119999999990000")).toBe("Telefone inválido");
    });
  });
});
