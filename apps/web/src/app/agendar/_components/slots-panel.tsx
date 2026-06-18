"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Loader } from "@/components/ui/loader";
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
    if (isSubmitting) return;
    e.preventDefault();
    if (selectedStart === null) return;
    if (!validateForm(form)) return;
    onConfirm(selectedStart, form);
  }

  return (
    <div className="lg:min-h-[440px]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold [font-family:var(--font-pdf-montserrat)]">
          {dateHeading}
        </h3>
      </div>

      <AnimatePresence mode="wait">
        {selectedStart === null ? (
          <motion.div
            key="slots"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex max-h-[460px] flex-col gap-2 overflow-y-auto pr-1"
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.025 * i, ease: EASE }}
                  whileHover={free ? { scale: 1.02 } : undefined}
                  className={[
                    "w-full rounded-xl border py-3 text-center text-sm font-semibold transition",
                    free
                      ? "border-black/12 hover:border-black hover:bg-black hover:text-white dark:border-white/15 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                      : "cursor-not-allowed border-black/5 text-black/25 line-through dark:border-white/5 dark:text-white/25",
                  ].join(" ")}
                >
                  {minutesToLabel(s)}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex flex-col gap-4"
          >
            <button
              type="button"
              onClick={() => setSelectedStart(null)}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
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

            <Field name="name" label="Nome" value={form.name} onChange={handleChange} error={errors.name} />
            <Field name="email" label="Email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
            <Field name="phone" label="Telefone" type="tel" value={form.phone ?? ""} onChange={handleChange} error={errors.phone} />
            <Field name="company" label="Empresa (opcional)" value={form.company ?? ""} onChange={handleChange} error={errors.company} />
            <Field name="message" label="Algo que devemos saber? (opcional)" value={form.message ?? ""} onChange={handleChange} error={errors.message} multiline />

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
                "Confirmar reunião"
              )}
            </LandingButton>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  multiline?: boolean;
}

function Field({ name, label, value, onChange, error, type = "text", multiline }: FieldProps) {
  const base =
    "w-full border-b bg-transparent pb-2 pt-1 text-sm outline-none transition placeholder:text-black/30 focus:border-black dark:placeholder:text-white/30 dark:focus:border-white";
  const border = error ? "border-red-500" : "border-black/15 dark:border-white/15";
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
        {label}
      </span>
      {multiline ? (
        <textarea name={name} value={value} onChange={onChange} rows={2} className={`${base} ${border} resize-none`} />
      ) : (
        <input name={name} type={type} value={value} onChange={onChange} className={`${base} ${border}`} />
      )}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}
