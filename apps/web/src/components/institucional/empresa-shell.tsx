"use client";

import React from "react";

import { CurtainProvider } from "@/components/marketing/_shared/curtain-transition";
import { PointerFieldProvider } from "@/components/marketing/_shared/pointer-field-provider";
import { SmoothScroll } from "@/components/marketing/_shared/smooth-scroll";

import { EmpresaFooter } from "./empresa-footer";
import { EmpresaNavbar } from "./empresa-navbar";

/**
 * Everything every page of the company site has in common.
 *
 * Mounted by the two layouts of this surface: the root experience at
 * `/institucional`, which the proxy rewrites the apex root onto, and the route
 * group holding the apex-level pages. Both get the same chrome, the same
 * inertial scroll and the same curtain, so moving between the root and a
 * sub-page reads as one site rather than two.
 *
 * `SmoothScroll` is mounted here rather than per page. It lives in a layout, so
 * it survives navigation within the group and Lenis is created once instead of
 * being destroyed and rebuilt on every route change, which would reset the
 * scroll damping mid-curtain. The ScrollTrigger refresh the new page needs is
 * the curtain's job, in its open handler.
 *
 * `PointerFieldProvider` is here and not per section: it writes `--px`/`--py` on
 * this element, every descendant inherits them, and a section reacts by reading
 * two custom properties. One listener and one write per frame for the whole
 * site, instead of one per animated section all computing the same two numbers.
 *
 * The page is NOT wrapped in a `<main>` here: the root experience opens on a
 * full-bleed hero with its own landmark structure, and a wrapper with padding
 * would break the pinned scenes that have to measure the viewport. Each page
 * declares its own landmarks.
 */
export function EmpresaShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PointerFieldProvider className={className}>
      <SmoothScroll />
      <CurtainProvider>
        <EmpresaNavbar />
        {children}
        <EmpresaFooter />
      </CurtainProvider>
    </PointerFieldProvider>
  );
}
