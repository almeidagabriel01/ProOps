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
      containerClassName="mx-auto w-fit"
    >
      {/* 6 x 44px + 5 x 8px = 304px, que não cabem num card a 360px. Até 400px
          as casas encolhem para 40px e o espaço para 6px (270px no total). */}
      <InputOTPGroup className="max-[400px]:gap-1.5">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-11 w-11 max-[400px]:h-10 max-[400px]:w-10"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}
