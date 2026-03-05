interface EmailVerifiable {
  emailVerified: boolean;
}

export const isEmailVerificationBypassed = (): boolean =>
  process.env.NEXT_PUBLIC_SKIP_EMAIL_VERIFICATION === "true";

export const shouldBlockUnverifiedEmail = (
  user: EmailVerifiable | null | undefined,
): boolean => {
  if (!user) return false;
  return !user.emailVerified && !isEmailVerificationBypassed();
};
