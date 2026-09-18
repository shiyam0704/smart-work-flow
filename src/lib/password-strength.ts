export interface PasswordRule {
  id: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: "At least 6 characters", test: (p) => p.length >= 6 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "digit", label: "One number", test: (p) => /\d/.test(p) },
  {
    id: "special",
    label: "One special character",
    test: (p) => /[^A-Za-z0-9]/.test(p),
  },
];

const COMMON_FRAGMENTS = [
  "password",
  "passw0rd",
  "123456",
  "12345678",
  "qwerty",
  "abc123",
  "111111",
  "letmein",
  "welcome",
  "iloveyou",
  "admin123",
  "adminadmin",
  "employee",
  "company",
  "monkey",
  "dragon",
  "football",
  "sunshine",
  "princess",
  "test123",
];

/** Rejects passwords that are guessable enough for the auth service to refuse them. */
export function isCommonPassword(pw: string): boolean {
  const p = pw.toLowerCase();
  return COMMON_FRAGMENTS.some((f) => p.includes(f));
}

export function validateStrongPassword(pw: string): {
  valid: boolean;
  failed: PasswordRule[];
  firstError?: string;
} {
  const failed = PASSWORD_RULES.filter((r) => !r.test(pw));
  const common = failed.length === 0 && isCommonPassword(pw);
  return {
    valid: failed.length === 0 && !common,
    failed,
    firstError:
      failed[0]?.label ??
      (common
        ? "This password is too easy to guess — avoid common words like \"password\" or \"123456\""
        : undefined),
  };
}
