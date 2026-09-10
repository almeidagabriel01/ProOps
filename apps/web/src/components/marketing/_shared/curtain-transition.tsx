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
import { DrawSVGPlugin } from "gsap/dist/DrawSVGPlugin";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { Marca } from "@/components/institucional/marca";
import { jumpToTop } from "@/lib/landing/smooth-scroll";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(DrawSVGPlugin, ScrollTrigger);
}

/** Slats the curtain is cut into. More reads as a sweep, fewer as a wipe. */
const LAMINAS = 6;

interface CurtainContextValue {
  navegar: (href: string) => void;
}

const CurtainContext = createContext<CurtainContextValue | null>(null);

/**
 * Animated navigation between the company site's pages, on the mark.
 *
 * The slats close, the ProOps symbol DRAWS itself in the middle of the black,
 * holds for the length of the route change, and unwinds as the slats open. The
 * point is repetition: a visitor who moves through four pages sees the mark
 * drawn four times, at the one moment when there is nothing else on screen to
 * look at. A generic wipe would cost the same and say nothing.
 *
 * `DrawSVGPlugin` animates the stroke of the real path from
 * `public/logo/logo2-cropped.svg`, so the thing being drawn is the asset and not
 * an approximation of it. It ships free with GSAP since 3.13.
 *
 * Why not View Transitions: `globals.css` disables
 * `::view-transition-old/new(root)` for the whole app, deliberately, because the
 * default cross-fade fought the theme switch. Re-enabling it here would change
 * every route in the product to buy one effect on four pages.
 *
 * The sequence is the only part that needs care. The App Router unmounts the
 * outgoing page synchronously, which is why an `AnimatePresence` exit cannot
 * work: by the time the exit would play there is nothing left to play it on.
 * Instead the curtain lives OUTSIDE the page, in the group layout, and
 * navigation is three beats:
 *
 *   1. slats close over the page that is still on screen, mark draws
 *   2. `router.push`, then the scroll jumps to the top while covered
 *   3. mark unwinds, slats open on the new page
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
  const palco = useRef<HTMLDivElement>(null);
  const marca = useRef<SVGPathElement>(null);
  const destino = useRef<string | null>(null);
  const primeiroRender = useRef(true);

  const abre = useCallback(() => {
    const el = palco.current;
    if (!el) return;
    const laminas = el.querySelectorAll<HTMLElement>("[data-lamina]");
    const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(el, { autoAlpha: 0 });
        // The incoming page's pinned sections measured their height while the
        // curtain was up. Without this, every ScrollTrigger on the new page is
        // off by the amount the layout settled.
        ScrollTrigger.refresh();
      },
    });

    if (marca.current) {
      // Unwinds from the end, so the stroke retreats the way it arrived instead
      // of erasing from the start, which reads as a rewind.
      tl.to(marca.current, {
        drawSVG: "100% 100%",
        duration: 0.4,
        ease: "power2.in",
      });
    }
    if (simbolo) {
      tl.to(simbolo, { scale: 1.12, opacity: 0, duration: 0.35 }, "<0.05");
    }
    tl.to(
      laminas,
      {
        scaleY: 0,
        transformOrigin: "top",
        duration: 0.65,
        ease: "expo.inOut",
        stagger: 0.05,
      },
      "<0.1",
    );
  }, []);

  const navegar = useCallback(
    (href: string) => {
      if (href === pathname) return;
      const el = palco.current;
      if (reduce || !el) {
        router.push(href);
        return;
      }
      if (destino.current) return; // já está saindo

      destino.current = href;
      const laminas = el.querySelectorAll<HTMLElement>("[data-lamina]");
      const simbolo = el.querySelector<HTMLElement>("[data-simbolo]");
      gsap.set(el, { autoAlpha: 1 });

      const tl = gsap.timeline({
        onComplete: () => {
          router.push(href);
          jumpToTop();
        },
      });

      tl.fromTo(
        laminas,
        { scaleY: 0, transformOrigin: "bottom" },
        { scaleY: 1, duration: 0.5, ease: "expo.inOut", stagger: 0.04 },
      );
      if (simbolo) {
        tl.fromTo(
          simbolo,
          { scale: 0.86, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.4, ease: "power2.out" },
          "<0.18",
        );
      }
      if (marca.current) {
        tl.fromTo(
          marca.current,
          { drawSVG: "0% 0%" },
          { drawSVG: "0% 100%", duration: 0.55, ease: "power1.inOut" },
          "<",
        );
      }
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
          ref={palco}
          aria-hidden="true"
          className="pointer-events-none invisible fixed inset-0 z-[90]"
        >
          {/*
            No `scale-y-0` here, and that is not a style choice.

            Tailwind v4 compiles `scale-y-0` to the standalone CSS `scale`
            property, not to `transform`. The two COMPOSE, so a slat carrying
            `scale: 1 0` stays flat no matter what GSAP writes into `transform`,
            and the curtain closes over the page without ever covering a pixel:
            navigation looks instant, nothing errors, and the effect is simply
            absent. Ownership of the transform belongs to GSAP alone.

            Nothing flashes at rest, because the stage above is `invisible`
            until a navigation starts, and the `fromTo` sets `scaleY: 0`
            synchronously in the same task as `autoAlpha: 1`, so there is no
            paint in between.
          */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: LAMINAS }).map((_, index) => (
              <div
                key={index}
                data-lamina
                className="h-full flex-1 origin-bottom bg-neutral-950"
              />
            ))}
          </div>

          {/* Above the slats, and centred on the viewport rather than on a slat:
              the symbol is the subject, the slats are the ground it appears on. */}
          <div
            data-simbolo
            className="absolute inset-0 flex items-center justify-center"
          >
            <Marca contorno pathRef={marca} className="h-20 w-20 text-white" />
          </div>
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
