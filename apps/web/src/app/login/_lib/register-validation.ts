/**
 * Pure field validators for the registration form.
 *
 * Each returns an error message (string) when the value is invalid, or `null`
 * when it is valid. Shared between the per-step validators and the on-blur
 * handlers so a single source of truth governs both.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNameValue(name: string): string | null {
  if (!name || name.trim().length < 2) {
    return "Nome deve ter pelo menos 2 caracteres";
  }
  return null;
}

export function validateCompanyNameValue(companyName: string): string | null {
  if (!companyName || companyName.trim().length < 2) {
    return "Nome da empresa é obrigatório";
  }
  return null;
}

export function validateEmailValue(email: string): string | null {
  if (!email || !email.trim()) {
    return "Email é obrigatório";
  }
  if (!EMAIL_REGEX.test(email)) {
    return "Email inválido";
  }
  return null;
}

export function validatePasswordValue(password: string): string | null {
  if (!password || password.length < 6) {
    return "Senha deve ter pelo menos 6 caracteres";
  }
  return null;
}
