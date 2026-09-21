import Image from "next/image";

import { APP_NAME } from "@/lib/site/app-brand";
import { SITE_URLS } from "@/lib/site/surfaces";

export function AplicativoFooter() {
  return (
    <footer className="border-t border-white/10 bg-[var(--app-bg)] px-6 py-12 text-[var(--app-text)] md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={SITE_URLS.institucional}
          className="flex items-center gap-2.5 text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
        >
          <Image
            src="/logo/logo2-cropped.svg"
            alt=""
            aria-hidden="true"
            width={20}
            height={20}
          />
          {APP_NAME}, uma ProOps
        </a>

        <nav
          aria-label="Institucional"
          className="flex flex-wrap gap-x-6 gap-y-2"
        >
          <a
            href={SITE_URLS.erp}
            className="text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
          >
            ProOps ERP
          </a>
          <a
            href={`${SITE_URLS.institucional}/privacy`}
            className="text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
          >
            Privacidade
          </a>
          <a
            href={`${SITE_URLS.institucional}/terms`}
            className="text-sm text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
          >
            Termos de uso
          </a>
        </nav>
      </div>
    </footer>
  );
}
