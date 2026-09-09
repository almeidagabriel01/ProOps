import Image from "next/image";
import Link from "next/link";

import { LandingButton } from "@/components/landing/_shared/landing-button";
import { SITE_URLS } from "@/lib/site/surfaces";

/**
 * Chrome for the company page.
 *
 * Not the ERP's `LandingNavbar`: that one is built out of anchors into the ERP
 * home (`#showcase`, `#modulos`, `#pricing`) and drives them through the
 * landing's own Lenis instance, so reusing it here would ship four links that
 * scroll to nothing.
 *
 * Static and server-rendered. It carries no scroll listener, which keeps it
 * off the hero's critical path; the page adds movement below the fold, where
 * it costs nothing.
 *
 * **No "Entrar" here, deliberately.** This page is the company: who ProOps is
 * and what it builds. It has no account, no session and nothing behind a login,
 * so a sign-in button would be a third destination competing with the two that
 * matter, and it would hand a visitor who has never heard of the ERP a login
 * form for a product they have not been shown yet. Whoever already has an
 * account arrives at the ERP directly. The sign-in lives on the ERP's own
 * navbar, which is the surface that owns the session.
 */
export function InstitucionalNavbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav
        aria-label="Principal"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10 md:py-8"
      >
        <Link
          href="/"
          aria-label="ProOps, página inicial"
          className="flex shrink-0 items-center gap-2.5"
        >
          {/*
            The symbol as the white SVG (already used this way in auth-layout and
            host-card), with the wordmark set live in Bricolage rather than
            baked into a bitmap. ProOpsLogo is not used here: its PNG is a
            1600x1600 square whose artwork is a horizontal lockup floating in
            transparency, so object-contain shrinks the mark to the height of
            whatever box it is given.
          */}
          <Image
            src="/logo/logo2-cropped.svg"
            alt=""
            aria-hidden="true"
            width={26}
            height={26}
            className="shrink-0"
          />
          <span className="[font-family:var(--font-bricolage)] text-[19px] font-bold tracking-tight text-white">
            ProOps
          </span>
        </Link>

        {/* Two links, and the gap widened with the third gone: at gap-1 a pair
            of bare text links sits 4px apart, which reads as one word and is a
            poor touch target. */}
        <div className="flex items-center gap-5 md:gap-7">
          <LandingButton
            href={SITE_URLS.erp}
            external
            variant="link"
            size="sm"
            tone="muted"
          >
            ERP
          </LandingButton>
          <LandingButton
            href={SITE_URLS.app}
            external
            variant="link"
            size="sm"
            tone="muted"
          >
            Aplicativo
          </LandingButton>
        </div>
      </nav>
    </header>
  );
}
