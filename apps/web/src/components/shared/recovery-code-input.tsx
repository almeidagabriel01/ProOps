"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/** Recovery codes use the lowercase alphabet `abcdefghjkmnpqrstuvwxyz23456789`. */
const ALPHANUMERIC = "^[a-zA-Z0-9]+$";

interface RecoveryCodeInputProps {
  /** Current value (0–8 chars, no dash). */
  value: string;
  /** Called with the lowercased alphanumeric string (no dash). */
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Segmented recovery-code input — two groups of four (the `xxxx-xxxx` format)
 * with a separator. Emits the 8-char value WITHOUT the dash; the backend
 * normalizes (lowercases, strips the dash) so this matches the stored hash.
 */
export function RecoveryCodeInput({
  value,
  onChange,
  id,
  disabled,
  autoFocus,
}: RecoveryCodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={8}
      value={value}
      onChange={(next) => onChange(next.toLowerCase())}
      disabled={disabled}
      autoFocus={autoFocus}
      pattern={ALPHANUMERIC}
      containerClassName="w-fit gap-1.5"
    >
      <InputOTPGroup className="gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <InputOTPSlot key={index} index={index} className="size-10" />
        ))}
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup className="gap-1.5">
        {[4, 5, 6, 7].map((index) => (
          <InputOTPSlot key={index} index={index} className="size-10" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
