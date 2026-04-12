/**
 * Shared password validation rules.
 * Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 symbol.
 */

const SYMBOL_REGEX = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/;

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Au moins 8 caractères");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Au moins une lettre majuscule");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Au moins une lettre minuscule");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Au moins un chiffre");
  }
  if (!SYMBOL_REGEX.test(password)) {
    errors.push("Au moins un symbole (!@#$%...)");
  }

  return { valid: errors.length === 0, errors };
}

export function getPasswordStrength(password: string): { label: string; color: string; percent: number } {
  if (!password) return { label: "", color: "", percent: 0 };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (SYMBOL_REGEX.test(password)) score++;

  if (score <= 2) return { label: "Faible", color: "bg-destructive", percent: 25 };
  if (score <= 4) return { label: "Moyen", color: "bg-yellow-500", percent: 55 };
  if (score <= 5) return { label: "Fort", color: "bg-primary", percent: 80 };
  return { label: "Très fort", color: "bg-green-500", percent: 100 };
}
