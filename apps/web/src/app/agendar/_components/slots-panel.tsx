"use client";

import { useState } from "react";
import { AnimatePresence, m as motion } from "motion/react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Loader } from "@/components/ui/loader";
import { FloatingField } from "@/app/contato/_components/floating-field";
import { useFormValidation } from "@/hooks/useFormValidation";
import {
  demoBookingFormSchema,
  type DemoBookingFormData,
} from "@/lib/validations/demo-booking";
import {
  generateSlotStarts,
  isSlotAvailable,
  isSlotInPast,
  minutesToLabel,
  type BookedInterval,
  type DurationMinutes,
} from "@/lib/booking/slots";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface SlotsPanelProps {
  dateStr: string;
  dateHeading: string; // ex.: "sex. 19"
  duration: DurationMinutes;
  dayBookings: BookedInterval[];
  now: { dateStr: string; minutes: number };
  isSubmitting: boolean;
  onConfirm: (startMinutes: number, form: DemoBookingFormData) => void;
}

export function SlotsPanel({
  dateStr,
  dateHeading,
  duration,
  dayBookings,
  now,
  isSubmitting,
  onConfirm,
}: SlotsPanelProps) {
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [form, setForm] = useState<DemoBookingFormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    website: "",
  });
  const { errors, validateForm, clearFieldError } = useFormValidation({
    schema: demoBookingFormSchema,
  });

  const starts = generateSlotStarts(duration);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    clearFieldError(name as keyof DemoBookingFormData);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedStart === null) return;
    if (!validateForm(form)) return;
    onConfirm(selectedStart, form);
  }

  const fields: {
    name: keyof DemoBookingFormData;
    label: string;
    type?: "text" | "email" | "tel";
    multiline?: boolean;
    required?: boolean;
    autoComplete?: string;
  }[] = [
    { name: "name", label: "Nome", required: true, autoComplete: "name" },
    { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
    { name: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
    { name: "company", label: "Empresa", autoComplete: "organization" },
    { name: "message", label: "Algo que devemos saber?", multiline: true },
  ];

  return (
    <div className="lg:min-h-[340px]">
      <div className="mb-5 flex items-baseline gap-2">
        <h3 className="text-base font-bold tracking-tight [font-family:var(--font-pdf-montserrat)]">
          {dateHeading}
        </h3>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/35 dark:text-white/35">
          {selectedStart === null ? "horários" : "seus dados"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {selectedStart === null ? (
          <motion.div
            key="slots"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="grid max-h-[344px] grid-cols-2 content-start gap-2.5 overflow-y-auto px-0.5 py-1 pr-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar]:w-1.5"
          >
            {starts.map((s, i) => {
              const free =
                isSlotAvailable(s, duration, dayBookings) &&
                !isSlotInPast(dateStr, s, now);
              return (
                <motion.button
                  key={s}
                  type="button"
                  disabled={!free}
                  onClick={() => setSelectedStart(s)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: Math.min(0.02 * i, 0.4),
                    type: "spring",
                    stiffness: 340,
                    damping: 26,
                  }}
                  whileHover={free ? { y: -2 } : undefined}
                  whileTap={free ? { scale: 0.96 } : undefined}
                  className={[
                    "group relative h-12 shrink-0 overflow-hidden rounded-xl border text-center text-[13px] font-bold tabular-nums tracking-tight transition-shadow",
                    free
                      ? "cursor-pointer border-black/10 bg-gradient-to-b from-white to-black/[0.025] text-black/85 shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_22px_-10px_rgba(0,0,0,0.45)] dark:border-white/12 dark:from-neutral-900 dark:to-white/[0.03] dark:text-white/85"
                      : "cursor-not-allowed border-dashed border-black/8 text-black/25 line-through dark:border-white/8 dark:text-white/25",
                  ].join(" ")}
                >
                  {free && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-[102%] bg-black transition-transform duration-300 ease-out group-hover:translate-x-0 dark:bg-white"
                    />
                  )}
                  <span
                    className={[
                      "relative z-10 flex h-full items-center justify-center gap-2",
                      free
                        ? "transition-colors duration-200 group-hover:text-white dark:group-hover:text-black"
                        : "",
                    ].join(" ")}
                  >
                    {free && (
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-30 transition-opacity duration-200 group-hover:opacity-100" />
                    )}
                    {minutesToLabel(s)}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex flex-col gap-6"
          >
            <button
              type="button"
              onClick={() => setSelectedStart(null)}
              className="group inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-black/12 px-3 py-1.5 text-xs font-bold tracking-tight text-black/70 transition hover:border-black hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:border-white dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              {minutesToLabel(selectedStart)}–{minutesToLabel(selectedStart + duration)}
            </button>

            {/* honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute hidden"
              value={form.website}
              onChange={handleChange}
            />

            {fields.map((f, i) => (
              <FloatingField
                key={f.name}
                name={f.name}
                label={f.label}
                type={f.type}
                multiline={f.multiline}
                required={f.required}
                autoComplete={f.autoComplete}
                index={i}
                value={(form[f.name] as string) ?? ""}
                onChange={handleChange}
                error={errors[f.name]}
              />
            ))}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + fields.length * 0.08, duration: 0.45, ease: EASE }}
            >
              <LandingButton
                type="submit"
                variant="solid"
                size="md"
                fullWidth
                disabled={isSubmitting}
                trailingIcon={isSubmitting ? undefined : <ArrowRight className="h-4 w-4" />}
              >
                {isSubmitting ? (
                  <span className="inline-flex items-center justify-center gap-2 leading-none">
                    <Loader size="sm" variant="button" />
                    Confirmando...
                  </span>
                ) : (
                  "Confirmar demonstração"
                )}
              </LandingButton>
            </motion.div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
