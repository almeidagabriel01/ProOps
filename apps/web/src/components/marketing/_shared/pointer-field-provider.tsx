"use client";

import React, { createContext, useContext } from "react";

import { usePointerField } from "./use-pointer-field";

interface CampoPonteiro {
  /** True when a tap is required before the gyroscope can be read (iOS). */
  precisaDePermissao: boolean;
  pedirPermissao: () => Promise<void>;
}

const Ctx = createContext<CampoPonteiro>({
  precisaDePermissao: false,
  pedirPermissao: async () => {},
});

/**
 * One pointer field for a whole surface.
 *
 * `--px` and `--py` are written on this provider's element, so every descendant
 * inherits them and any section can react by reading two custom properties. That
 * inheritance is the point: a hook per section would mean one `pointermove`
 * listener and one rAF write per section on a page with ten of them, all
 * computing the same two numbers.
 *
 * The iOS permission state is shared through context rather than through props,
 * because the only place that offers the prompt is the hero, and the only place
 * that owns the sensor is here.
 */
export function PointerFieldProvider({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, precisaDePermissao, pedirPermissao } = usePointerField();

  return (
    <div ref={ref} className={className}>
      <Ctx.Provider value={{ precisaDePermissao, pedirPermissao }}>
        {children}
      </Ctx.Provider>
    </div>
  );
}

/** The permission affordance, for the one component that offers it. */
export function useCampoPonteiro(): CampoPonteiro {
  return useContext(Ctx);
}
