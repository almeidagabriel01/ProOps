"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { StepCard } from "@/components/ui/step-wizard";

type FormStepCardProps = React.ComponentProps<typeof StepCard>;

export function FormStepCard({
  className,
  children,
  ...props
}: FormStepCardProps) {
  return (
    <StepCard
      className={cn("min-h-[32rem] flex flex-col justify-between", className)}
      {...props}
    >
      {children}
    </StepCard>
  );
}
