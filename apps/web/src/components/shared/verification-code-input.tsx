"use client";

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/** Each slot accepts a single digit. */
const DIGITS_ONLY = "^\\d+$";

interface VerificationCodeInputProps {
  /** Current value (0–6 digits). */
  value: string;
  /** Called with the digit-only string as the user types/pastes. */
  onChange: (value: string) => void;
  /** Fired once all 6 digits are entered — used for auto-submit. */
  onComplete?: (value: string) => void;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Segmented 6-digit verification code input (one box per digit) used for every
 * TOTP / WhatsApp OTP entry across the app. Digits only; paste is filtered.
 */
export function VerificationCodeInput({
  value,
  onChange,
  onComplete,
  id,
  disabled,
  autoFocus,
}: VerificationCodeInputProps) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      autoFocus={autoFocus}
      pattern={DIGITS_ONLY}
      inputMode="numeric"
      containerClassName="w-full"
    >
      <InputOTPGroup className="w-full justify-between">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <InputOTPSlot key={index} index={index} className="h-12 flex-1" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
