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
    e.preventDefault();
    if (isSubmitting) return;
    if (selectedStart === null) return;
    if (!validateForm(form)) return;
    onConfirm(selectedStart, form);
  }

  const fields: { name: keyof DemoBookingFormData; label: string; type?: string; multiline?: boolean }[] = [
    { name: "name", label: "Nome" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Telefone", type: "tel" },
    { name: "company", label: "Empresa (opcional)" },
    { name: "message", label: "Algo que devemos saber? (opcional)", multiline: true },
  ];

  return (
    <div className="lg:min-h-[400px]">
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
            className="grid max-h-[400px] grid-cols-2 content-start gap-2.5 overflow-y-auto pr-1.5 [mask-image:linear-gradient(to_bottom,transparent,black_4%,black_95%,transparent)] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar]:w-1.5"
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
                  whileTap={free ? { scale: 0.96 } : undefined}
                  className={[
                    "group relative h-[42px] shrink-0 overflow-hidden rounded-xl border text-center text-[13px] font-bold tracking-tight transition-colors",
                    free
                      ? "border-black/12 dark:border-white/15"
                      : "cursor-not-allowed border-black/5 text-black/25 line-through dark:border-white/5 dark:text-white/25",
                  ].join(" ")}
                >
                  {free && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-full bg-black transition-transform duration-300 ease-out group-hover:translate-x-0 dark:bg-white"
                    />
                  )}
                  <span
                    className={[
                      "relative z-10 flex h-full items-center justify-center",
                      free
                        ? "transition-colors duration-200 group-hover:text-white dark:group-hover:text-black"
                        : "",
                    ].join(" ")}
                  >
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
            className="flex flex-col gap-5"
          >
            <button
              type="button"
              onClick={() => setSelectedStart(null)}
              className="group inline-flex w-fit items-center gap-2 rounded-full border border-black/12 px-3 py-1.5 text-xs font-bold tracking-tight text-black/70 transition hover:border-black hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:border-white dark:hover:text-white"
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
              <motion.div
                key={f.name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06, duration: 0.45, ease: EASE }}
              >
                <Field
                  name={f.name}
                  label={f.label}
                  type={f.type}
                  multiline={f.multiline}
                  value={(form[f.name] as string) ?? ""}
                  onChange={handleChange}
                  error={errors[f.name]}
                />
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + fields.length * 0.06, duration: 0.45, ease: EASE }}
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
                  "Confirmar reunião"
                )}
              </LandingButton>
            </motion.div>
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
    "w-full border-b bg-transparent pb-2 pt-1 text-sm outline-none transition-colors placeholder:text-black/30 focus:border-black dark:placeholder:text-white/30 dark:focus:border-white";
  const border = error ? "border-red-500" : "border-black/15 dark:border-white/15";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
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
