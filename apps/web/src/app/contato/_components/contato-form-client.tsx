"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhoneInput } from "@/components/ui/phone-input";
import { FormItem, FormGroup } from "@/components/ui/form-components";
import { LandingNavbar, LandingFooter, useLandingPage } from "@/components/landing";
import { useFormValidation } from "@/hooks/useFormValidation";
import { contactSchema } from "@/lib/validations/contact";
import type { ContactFormData } from "@/lib/validations/contact";
import { ContactFormService } from "@/services/contact-form-service";
import { toast } from "@/lib/toast";
import { ApiError } from "@/lib/api-client";
import { Loader } from "@/components/ui/loader";

const EMPTY_FORM: ContactFormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  segment: "",
  message: "",
  website: "",
};

export function ContatoFormClient() {
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validateForm, clearFieldError } = useFormValidation({ schema: contactSchema });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof ContactFormData);
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
      toast.success("Mensagem enviada! Retornaremos por email em breve.");
      setFormData(EMPTY_FORM);
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

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignOut={handleSignOut}
      />

      <main>
        <section className="py-24 px-4">
          <div className="mx-auto max-w-2xl">
            <div className="mb-10 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-black dark:text-white mb-3">
                Fale com a gente
              </h1>
              <p className="text-black/60 dark:text-white/60">
                Preencha o formulário abaixo e nossa equipe retornará por email em breve.
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-900">
              <form onSubmit={handleSubmit} noValidate>
                {/* Honeypot — oculto de leitores de tela e bots */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden absolute"
                  value={formData.website}
                  onChange={handleChange}
                />

                <div className="space-y-5">
                  <FormGroup cols={2}>
                    <FormItem
                      label="Nome"
                      htmlFor="name"
                      required
                      error={errors.name}
                    >
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Seu nome"
                        autoComplete="name"
                      />
                    </FormItem>

                    <FormItem
                      label="Empresa"
                      htmlFor="company"
                      required
                      error={errors.company}
                    >
                      <Input
                        id="company"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        placeholder="Nome da empresa"
                        autoComplete="organization"
                      />
                    </FormItem>
                  </FormGroup>

                  <FormGroup cols={2}>
                    <FormItem
                      label="Email"
                      htmlFor="email"
                      required
                      error={errors.email}
                    >
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="seu@email.com"
                        autoComplete="email"
                      />
                    </FormItem>

                    <FormItem
                      label="Telefone"
                      htmlFor="phone"
                      error={errors.phone}
                    >
                      <PhoneInput
                        id="phone"
                        name="phone"
                        value={formData.phone ?? ""}
                        onChange={handleChange}
                      />
                    </FormItem>
                  </FormGroup>

                  <FormItem
                    label="Segmento de atuação"
                    htmlFor="segment"
                    required
                    error={errors.segment}
                  >
                    <Input
                      id="segment"
                      name="segment"
                      value={formData.segment}
                      onChange={handleChange}
                      placeholder="Ex: automação residencial, cortinas, arquitetura..."
                    />
                  </FormItem>

                  <FormItem
                    label="Mensagem"
                    htmlFor="message"
                    required
                    error={errors.message}
                  >
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Conte um pouco sobre sua empresa e o que está buscando..."
                      className="min-h-[140px]"
                    />
                  </FormItem>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-12 rounded-xl text-sm font-semibold"
                    >
                      {isLoading ? (
                        <>
                          <Loader size="sm" variant="button" />
                          Enviando...
                        </>
                      ) : (
                        "Enviar mensagem"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
