"use client";

import * as React from "react";

export interface FormatResendLabelOptions {
  /** Label while the cooldown is active. `{s}` is replaced with the seconds left. */
  waitingLabel?: string;
  /** Label once the cooldown has elapsed and a resend is allowed. */
  readyLabel?: string;
}

const DEFAULT_WAITING_LABEL = "Reenviar em {s}s";
const DEFAULT_READY_LABEL = "Reenviar código";

/**
 * Pure formatter for the resend button label. Kept side-effect free so it can be
 * unit tested without any timers or React. When `secondsLeft > 0` it renders the
 * countdown ("Reenviar em 45s"); otherwise the ready-to-resend label.
 */
export function formatResendLabel(
  secondsLeft: number,
  opts?: FormatResendLabelOptions,
): string {
  const waitingLabel = opts?.waitingLabel ?? DEFAULT_WAITING_LABEL;
  const readyLabel = opts?.readyLabel ?? DEFAULT_READY_LABEL;
  if (secondsLeft > 0) {
    return waitingLabel.replace("{s}", String(secondsLeft));
  }
  return readyLabel;
}

/** Clamps a raw seconds value to a non-negative integer (pure, testable). */
export function clampCountdownSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds);
}

export interface UseResendCountdownReturn {
  /** Seconds remaining in the current cooldown (0 when resend is allowed). */
  secondsLeft: number;
  /** Whether a resend can be triggered now (`secondsLeft === 0`). */
  canResend: boolean;
  /** (Re)starts the countdown from `seconds`. Passing 0/invalid clears it. */
  start: (seconds: number) => void;
}

/**
 * Drives a 1s-resolution countdown used by "resend code" buttons. The cooldown
 * duration is owned by the backend (it returns `retryAfterSeconds`), so callers
 * always feed that value into `start()` — including after a page reload, so the
 * displayed countdown reflects the true remaining time. The interval is cleaned
 * up on unmount and whenever it reaches zero.
 */
export function useResendCountdown(): UseResendCountdownReturn {
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = React.useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = React.useCallback(
    (seconds: number) => {
      clearTimer();
      const initial = clampCountdownSeconds(seconds);
      setSecondsLeft(initial);
      if (initial <= 0) return;
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            clearTimer();
            return 0;
          }
          return next;
        });
      }, 1000);
    },
    [clearTimer],
  );

  React.useEffect(() => clearTimer, [clearTimer]);

  return {
    secondsLeft,
    canResend: secondsLeft <= 0,
    start,
  };
}
