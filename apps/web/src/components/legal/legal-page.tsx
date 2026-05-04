"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ProOpsLogo } from "@/components/branding/proops-logo";
import { LandingFooter } from "@/components/landing";

interface LegalSection {
  title: string;
  content: ReactNode;
}

interface LegalPageProps {
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
}

export function LegalPage({
  title,
  description,
  updatedAt,
  sections,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-white text-black dark:bg-neutral-950 dark:text-neutral-100">
      <header className="border-b border-black/10 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-neutral-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="inline-flex items-center">
            <ProOpsLogo
              variant="full"
              width={180}
              height={60}
              invertOnDark
              interactive={false}
              className="h-10 w-auto"
            />
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao site
            </Link>
            <Link
              href="/login"
              className="text-black/70 transition-colors hover:text-black dark:text-white/70 dark:hover:text-white"
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[28px] border border-black/10 bg-gradient-to-br from-emerald-500/10 via-white to-sky-500/10 p-8 shadow-sm dark:border-white/10 dark:from-emerald-500/10 dark:via-neutral-950 dark:to-sky-500/10">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-black/55 dark:text-white/55">
                Documento Legal
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-black/70 dark:text-white/70">
                {description}
              </p>
              <p className="mt-6 text-sm text-black/55 dark:text-white/55">
                Última atualização: {updatedAt}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[28px] border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-950">
            <div className="border-b border-black/10 px-8 py-5 dark:border-white/10">
              <p className="text-sm text-black/60 dark:text-white/60">
                Este documento se aplica ao uso do ProOps em{" "}
                <a
                  href="https://proops.com.br"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  proops.com.br
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                .
              </p>
            </div>

            <div className="space-y-10 px-8 py-8">
              {sections.map((section) => (
                <section key={section.title} className="space-y-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {section.title}
                  </h2>
                  <div className="space-y-3 text-[15px] leading-7 text-black/75 dark:text-white/75">
                    {section.content}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
