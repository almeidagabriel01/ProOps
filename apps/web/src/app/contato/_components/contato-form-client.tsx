"use client";

import React, { useState } from "react";
import { m as motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { LandingNavbar, LandingFooter, useLandingPage } from "@/components/landing";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { useFormValidation } from "@/hooks/useFormValidation";
import { contactSchema } from "@/lib/validations/contact";
import type { ContactFormData } from "@/lib/validations/contact";
import { ContactFormService } from "@/services/contact-form-service";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { Loader } from "@/components/ui/loader";
import { FloatingField } from "./floating-field";
import { ContactSuccess } from "./contact-success";

const EMPTY_FORM: ContactFormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  segment: "",
  message: "",
  website: "",
};

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Frase grande cujas linhas escorregam de baixo pra cima no carregamento
 * (text reveal — não depende de scroll).
 */
function RisingLines({
  lines,
  className,
  reduce,
  baseDelay = 0,
}: {
  lines: string[];
  className?: string;
  reduce: boolean;
  baseDelay?: number;
}) {
  return (
    <h1 className={className}>
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "110%" }}
            animate={reduce ? undefined : { y: "0%" }}
            transition={{
              duration: 0.9,
              ease: EASE_OUT,
              delay: reduce ? 0 : baseDelay + i * 0.12,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function ContatoFormClient() {
  const reduce = useReducedMotion();
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { errors, validateForm, clearFieldError } = useFormValidation({
    schema: contactSchema,
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof ContactFormData);
  }

  function handleReset() {
    setFormData(EMPTY_FORM);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateForm(formData)) return;

    setIsLoading(true);
    try {
      await ContactFormService.submit({
        name: formData.name,
        company: formData.company,
        email: formData.email,
        phone: formData.phone,
        segment: formData.segment,
        message: formData.message,
        website: formData.website ?? "",
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Erro ao enviar. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  // fade+sobe no load, com atraso configurável
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.75, ease: EASE_OUT, delay },
        };

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignOut={handleSignOut}
      />

      <main>
        <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl items-center px-6 py-16">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            {/* manifesto — text reveal no load */}
            <div>
              <motion.p
                {...rise(0)}
                className="mb-7 inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-black/55 dark:text-white/60"
              >
                <span className="h-px w-6 bg-black/30 dark:bg-white/45" />
                Fale com a gente
              </motion.p>

              <RisingLines
                reduce={reduce}
                baseDelay={0.1}
                lines={["Vamos", "conversar."]}
                className="[font-family:var(--font-pdf-montserrat)] text-5xl font-bold leading-[0.95] tracking-tight md:text-7xl"
              />

              <motion.p
                {...rise(0.5)}
                className="mt-7 max-w-md text-lg leading-relaxed text-black/65 dark:text-white/65"
              >
                Tirou uma dúvida que o FAQ não respondeu? Conte o que você precisa
                — sem robô, sem fila. Retornamos por email.
              </motion.p>
            </div>

            {/* formulário — campos entram em cascata no load */}
            <form onSubmit={handleSubmit} noValidate>
              {/* honeypot — oculto de leitores de tela e bots */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute hidden"
                value={formData.website}
                onChange={handleChange}
              />

              <div className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
                <FloatingField
                  label="Nome"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  autoComplete="name"
                  required
                  index={0}
                />
                <FloatingField
                  label="Empresa"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  error={errors.company}
                  autoComplete="organization"
                  required
                  index={1}
                />
                <FloatingField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  autoComplete="email"
                  required
                  index={2}
                />
                <FloatingField
                  label="Telefone"
                  name="phone"
                  type="tel"
                  value={formData.phone ?? ""}
                  onChange={handleChange}
                  error={errors.phone}
                  autoComplete="tel"
                  index={3}
                />
              </div>

              <div className="mt-8 grid gap-y-8">
                <FloatingField
                  label="Segmento de atuação"
                  name="segment"
                  value={formData.segment}
                  onChange={handleChange}
                  error={errors.segment}
                  required
                  index={4}
                />

                <FloatingField
                  label="Sua mensagem"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  error={errors.message}
                  multiline
                  required
                  index={5}
                />
              </div>

              <motion.div {...rise(1.05)} className="mt-10">
                <LandingButton
                  type="submit"
                  variant="solid"
                  size="lg"
                  fullWidth
                  disabled={isLoading}
                  trailingIcon={
                    isLoading ? undefined : <ArrowRight className="h-5 w-5" />
                  }
                >
                  {isLoading ? (
                    <span className="inline-flex items-center justify-center gap-2 leading-none">
                      <Loader size="sm" variant="button" />
                      Enviando...
                    </span>
                  ) : (
                    "Enviar mensagem"
                  )}
                </LandingButton>
              </motion.div>
            </form>
          </div>
        </section>
      </main>

      <LandingFooter />

      <ContactSuccess open={success} onReset={handleReset} />
    </div>
  );
}
