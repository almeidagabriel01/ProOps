"use client";

import * as React from "react";

interface ScrollContainerContextValue {
  container: HTMLElement | null;
  register: React.RefCallback<HTMLElement>;
}

const noop: React.RefCallback<HTMLElement> = () => {};

const ScrollContainerContext = React.createContext<ScrollContainerContextValue>({
  container: null,
  register: noop,
});

ScrollContainerContext.displayName = "ScrollContainerContext";

export function ScrollContainerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  const register = React.useCallback<React.RefCallback<HTMLElement>>(
    (node) => setContainer(node),
    [],
  );

  const value = React.useMemo(
    () => ({ container, register }),
    [container, register],
  );

  return (
    <ScrollContainerContext.Provider value={value}>
      {children}
    </ScrollContainerContext.Provider>
  );
}

export function useScrollContainer(): HTMLElement | null {
  return React.useContext(ScrollContainerContext).container;
}

export function useRegisterScrollContainer(): React.RefCallback<HTMLElement> {
  return React.useContext(ScrollContainerContext).register;
}
