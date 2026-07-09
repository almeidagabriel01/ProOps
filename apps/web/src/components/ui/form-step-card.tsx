"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StepCard } from "@/components/ui/step-wizard";

type FormStepCardProps = React.ComponentProps<typeof StepCard> & {
  /**
   * When defined, wraps all children EXCEPT the last one (assumed to be the
   * step navigation) in a disabled <fieldset>. Used for read-only/demo mode:
   * the user can still navigate between steps but cannot edit any field.
   * Omit the prop entirely to keep the legacy behaviour (no wrapping).
   */
  contentDisabled?: boolean;
};

export function FormStepCard({
  className,
  children,
  contentDisabled,
  ...props
}: FormStepCardProps) {
  let body: React.ReactNode = children;
  if (contentDisabled !== undefined) {
    const items = React.Children.toArray(children);
    const nav = items.length > 0 ? items[items.length - 1] : null;
    const content = items.slice(0, -1);
    body = (
      <>
        <fieldset
          disabled={contentDisabled}
          className="contents readonly-fieldset"
        >
          {content}
        </fieldset>
        {nav}
      </>
    );
  }
  return (
    <StepCard
      className={cn("min-h-[32rem] flex flex-col justify-between", className)}
      {...props}
    >
      {body}
    </StepCard>
  );
}
