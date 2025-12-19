"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

// ============================================
// STEP WIZARD CONTEXT
// ============================================

interface StepWizardContextType {
  currentStep: number;
  totalSteps: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const StepWizardContext = React.createContext<StepWizardContextType | null>(
  null
);

export function useStepWizard() {
  const context = React.useContext(StepWizardContext);
  if (!context) {
    throw new Error("useStepWizard must be used within a StepWizard");
  }
  return context;
}

// ============================================
// STEP WIZARD - Main container
// ============================================

interface Step {
  id: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
}

interface StepWizardProps {
  steps: Step[];
  children: React.ReactNode;
  onComplete?: () => void;
  className?: string;
  indicatorContainerClassName?: string;
  allowClickAhead?: boolean; // When true, allows clicking on any step (useful for edit mode)
}

export function StepWizard({
  steps,
  children,
  onComplete,
  className,
  indicatorContainerClassName,
  allowClickAhead = false,
}: StepWizardProps) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [maxVisitedStep, setMaxVisitedStep] = React.useState(0);
  const totalSteps = steps.length;

  const goToStep = (step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      const nextStepIndex = currentStep + 1;
      setCurrentStep(nextStepIndex);
      setMaxVisitedStep((prev) => Math.max(prev, nextStepIndex));
    } else {
      onComplete?.();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const contextValue: StepWizardContextType = {
    currentStep,
    totalSteps,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
  };

  return (
    <StepWizardContext.Provider value={contextValue}>
      <div className={cn("space-y-8", className)}>
        {/* Step Indicator */}
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          maxVisitedStep={maxVisitedStep}
          onStepClick={goToStep}
          allowClickAhead={allowClickAhead}
          containerClassName={indicatorContainerClassName}
        />

        {/* Step Content */}
        <div className="relative">
          {React.Children.map(children, (child, index) => (
            <StepContent index={index} currentStep={currentStep}>
              {child}
            </StepContent>
          ))}
        </div>
      </div>
    </StepWizardContext.Provider>
  );
}

// ============================================
// STEP INDICATOR - Visual progress
// ============================================

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  maxVisitedStep: number;
  onStepClick: (step: number) => void;
  allowClickAhead?: boolean;
  containerClassName?: string;
}

function StepIndicator({
  steps,
  currentStep,
  maxVisitedStep,
  onStepClick,
  allowClickAhead = false,
  containerClassName,
}: StepIndicatorProps) {
  return (
    <div className={cn("relative mx-auto", containerClassName)}>
      {/* Progress bar background */}
      <div className="absolute top-6 left-0 right-0 h-0.5 bg-primary/20" />

      {/* Progress bar fill */}
      <div
        className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
        style={{
          width: `${(currentStep / (steps.length - 1)) * 100}%`,
        }}
      />

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;
          const Icon = step.icon;

          // Allow clicking if: going back to visited step, or allowClickAhead is true for any step
          const canClick = allowClickAhead || index <= maxVisitedStep;

          return (
            <button
              key={step.id}
              onClick={() => canClick && onStepClick(index)}
              disabled={!canClick}
              className={cn(
                "flex flex-col items-center group transition-all duration-300",
                canClick ? "cursor-pointer" : "cursor-not-allowed"
              )}
            >
              {/* Step circle */}
              <div
                className={cn(
                  "relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ease-out",
                  "border-2 shadow-sm",
                  isCompleted &&
                  "bg-gradient-to-br from-primary to-primary/80 border-primary text-primary-foreground shadow-lg shadow-primary/20",
                  isCurrent &&
                  "bg-gradient-to-br from-primary to-primary/80 border-primary text-primary-foreground shadow-xl shadow-primary/30 scale-110",
                  isPending &&
                  !allowClickAhead &&
                  "bg-primary/5 border-primary/30 text-primary/50",
                  isPending &&
                  allowClickAhead &&
                  "bg-primary/5 border-primary/30 text-primary/50 hover:border-primary/50 hover:shadow-md hover:bg-primary/10"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : Icon ? (
                  <Icon className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}

                {/* Pulse animation for current step */}
                {isCurrent && (
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
                )}
              </div>

              {/* Step title */}
              <div className="mt-3 text-center max-w-[100px]">
                <p
                  className={cn(
                    "text-sm font-semibold transition-colors duration-300",
                    isCurrent && "text-primary",
                    isCompleted && "text-foreground",
                    isPending && "text-primary/50",
                    isPending && allowClickAhead && "group-hover:text-primary"
                  )}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="text-xs text-primary/40 mt-0.5 hidden sm:block">
                    {step.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// STEP CONTENT - Individual step wrapper
// ============================================

interface StepContentProps {
  index: number;
  currentStep: number;
  children: React.ReactNode;
}

function StepContent({ index, currentStep, children }: StepContentProps) {
  const isActive = index === currentStep;
  const direction = index > currentStep ? 1 : -1;

  return (
    <div
      className={cn(
        "transition-all duration-500 ease-out",
        isActive
          ? "opacity-100 translate-x-0 pointer-events-auto"
          : "opacity-0 absolute inset-0 pointer-events-none",
        !isActive && direction > 0 && "translate-x-8",
        !isActive && direction < 0 && "-translate-x-8"
      )}
      aria-hidden={!isActive}
    >
      {children}
    </div>
  );
}

// ============================================
// STEP NAVIGATION - Prev/Next buttons
// ============================================

interface StepNavigationProps {
  onSubmit?: () => void;
  onBeforeNext?: () => boolean | Promise<boolean>;
  isSubmitting?: boolean;
  submitLabel?: string;
  nextLabel?: string;
  prevLabel?: string;
  showPrev?: boolean;
}

export function StepNavigation({
  onSubmit,
  onBeforeNext,
  isSubmitting = false,
  submitLabel = "Finalizar",
  nextLabel = "Próximo",
  prevLabel = "Anterior",
  showPrev = true,
}: StepNavigationProps) {
  const { nextStep, prevStep, isFirstStep, isLastStep } = useStepWizard();
  const [isValidating, setIsValidating] = React.useState(false);

  const handleNext = async () => {
    if (onBeforeNext) {
      setIsValidating(true);
      try {
        const canProceed = await onBeforeNext();
        if (!canProceed) {
          setIsValidating(false);
          return;
        }
      } catch {
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }
    nextStep();
  };

  return (
    <div className="flex items-center justify-between pt-8 border-border/30">
      {/* Previous Button */}
      {showPrev && !isFirstStep ? (
        <button
          type="button"
          onClick={prevStep}
          className="h-12 px-6 rounded-xl bg-card border border-border/50 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-muted transition-all duration-200 flex items-center gap-2 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          {prevLabel}
        </button>
      ) : (
        <div />
      )}

      {/* Next/Submit Button */}
      {isLastStep ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className={cn(
            "h-12 px-8 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer",
            "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
            "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
            "hover:scale-[1.02] active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            "flex items-center gap-2"
          )}
        >
          {isSubmitting ? (
            <>
              <Spinner className="w-4 h-4 text-white" />
              Salvando...
            </>
          ) : (
            <>
              {submitLabel}
              <Check className="w-4 h-4" />
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleNext}
          disabled={isValidating}
          className={cn(
            "h-12 px-8 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer",
            "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground",
            "shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
            "hover:scale-[1.02] active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
            "flex items-center gap-2"
          )}
        >
          {isValidating ? (
            <>
              <Spinner className="w-4 h-4 text-white" />
              Validando...
            </>
          ) : (
            <>
              {nextLabel}
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================
// STEP CARD - Container for step content
// ============================================

interface StepCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function StepCard({ className, children, ...props }: StepCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card p-6 sm:p-8",
        "shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
