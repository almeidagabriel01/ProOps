"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { jumpToTop } from "@/lib/landing/smooth-scroll";
import { cn } from "@/lib/utils";

/** Slats the curtain is cut into. More reads as a sweep, fewer as a wipe. */
const LAMINAS = 6;
const FECHA = 0.5;
const ABRE = 0.7;

interface CurtainContextValue {
  navegar: (href: string) => void;
}

const CurtainContext = createContext<CurtainContextValue | null>(null);

/**
 * Animated navigation between the company site's pages.
 *
 * Why not View Transitions: `globals.css` disables
 * `::view-transition-old/new(root)` for the whole app, deliberately, because the
 * default cross-fade fought the theme switch. Re-enabling it here would change
 * every route in the product to buy one effect on five pages.
 *
 * So the curtain is explicit, and the sequence is the only part that needs care.
 * The App Router unmounts the outgoing page synchronously, which is why an
 * `AnimatePresence` exit animation cannot work here: by the time the exit would
 * play there is nothing left to play it on. Instead the curtain is OUTSIDE the
 * page, in the group layout, and navigation is a three-beat:
 *
 *   1. the slats close over the page that is still on screen
 *   2. `router.push`, then the scroll jumps to the top while covered
 *   3. the slats open on the new page
 *
 * Beat 3 is driven by `usePathname` changing, not by the push resolving. The
 * push is not a promise, and a timer would either uncover a page that has not
 * rendered or hold the curtain on one that has.
 *
 * Under `prefers-reduced-motion` the curtain never renders and links are plain
 * `<Link>`s, which is also what a visitor with no JavaScript gets.
 */
export function CurtainProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const laminas = useRef<HTMLDivElement>(null);
  const destino = useRef<string | null>(null);
  const primeiroRender = useRef(true);

  const abre = useCallback(() => {
    const el = laminas.current;
    if (!el) return;
    const partes = Array.from(el.children) as HTMLElement[];
    gsap.to(partes, {
      scaleY: 0,
      transformOrigin: "top",
      duration: ABRE,
      ease: "expo.inOut",
      stagger: 0.05,
      onComplete: () => {
        gsap.set(el, { autoAlpha: 0 });
        // The incoming page's pinned sections measured their height while the
        // curtain was up. Without this, every ScrollTrigger on the new page is
        // off by the amount the layout settled.
        ScrollTrigger.refresh();
      },
    });
  }, []);

  const navegar = useCallback(
    (href: string) => {
      if (href === pathname) return;
      const el = laminas.current;
      if (reduce || !el) {
        router.push(href);
        return;
      }
      if (destino.current) return; // já está saindo

      destino.current = href;
      const partes = Array.from(el.children) as HTMLElement[];
      gsap.set(el, { autoAlpha: 1 });
      gsap.fromTo(
        partes,
        { scaleY: 0, transformOrigin: "bottom" },
        {
          scaleY: 1,
          duration: FECHA,
          ease: "expo.inOut",
          stagger: 0.04,
          onComplete: () => {
            router.push(href);
            jumpToTop();
          },
        },
      );
    },
    [pathname, reduce, router],
  );

  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    if (!destino.current) return;
    destino.current = null;
    abre();
  }, [pathname, abre]);

  return (
    <CurtainContext.Provider value={{ navegar }}>
      {children}
      {!reduce && (
        <div
          ref={laminas}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[90] flex invisible"
        >
          {Array.from({ length: LAMINAS }).map((_, index) => (
            <div
              key={index}
              className="h-full flex-1 origin-bottom scale-y-0 bg-neutral-950"
            />
          ))}
        </div>
      )}
    </CurtainContext.Provider>
  );
}

interface CurtainLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}

/**
 * A link inside the company site that closes the curtain on its way out.
 *
 * Still a real `<a>`: the href is there for middle-click, for "open in new
 * tab", for a crawler and for a reader with JavaScript off. Only the plain
 * left-click is intercepted, and modified clicks are let through untouched,
 * because swallowing ctrl-click is the classic way a fancy navigation breaks
 * something the browser already did well.
 */
export function CurtainLink({
  href,
  children,
  className,
  "aria-label": ariaLabel,
}: CurtainLinkProps) {
  const ctx = useContext(CurtainContext);

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(className)}
      onClick={(event) => {
        if (!ctx) return;
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        ctx.navegar(href);
      }}
    >
      {children}
    </Link>
  );
}
