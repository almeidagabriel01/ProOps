import Image from "next/image";
import Link from "next/link";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

export function AplicativoNavbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10 md:py-8"
      >
        <Link
          href={SITE_URLS.institucional}
          aria-label={`${APP_NAME}, uma ProOps`}
          className="flex shrink-0 items-center gap-2.5"
        >
          <Image
            src="/logo/logo2-cropped.svg"
            alt=""
            aria-hidden="true"
            width={24}
            height={24}
            className="shrink-0"
          />
          <span className="[font-family:var(--font-hanken)] text-[17px] font-bold tracking-tight text-[var(--app-text)]">
            {APP_NAME}
          </span>
        </Link>

        <LandingButton href="#lista-de-espera" variant="inverted" size="sm">
          Quero ser avisado
        </LandingButton>
      </nav>
    </header>
  );
}
