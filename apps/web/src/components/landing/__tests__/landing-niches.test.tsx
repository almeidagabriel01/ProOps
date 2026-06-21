// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { LandingNiches } from "../landing-niches";

// jsdom lacks matchMedia (used by useReducedMotion) and IntersectionObserver
// (used by the lazy ScrollTrigger setup + usePauseOffscreen). Stub both so the
// component mounts; matchMedia reports no match → reduced-motion is false → BOTH
// the mobile (md:hidden) and desktop (hidden md:block) trees render at once,
// which is exactly the condition that produced duplicate SVG gradient ids.
beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});

describe("LandingNiches — editorial numerals", () => {
  it("renders unique gradient ids across the mobile and desktop trees", () => {
    // Regression: the gradient id was derived from the niche number (01/02), so
    // the same numeral mounted in both trees produced duplicate ids. The desktop
    // <svg> then resolved url(#…) to the first match — which lives in the
    // display:none mobile subtree — leaving its stroke with no paint server, so
    // the big number was invisible on desktop. Ids must be unique per instance.
    const { container } = render(<LandingNiches />);
    const ids = Array.from(
      container.querySelectorAll("linearGradient"),
    ).map((g) => g.id);

    // Both niches render in both trees: 2 niches × 2 trees = 4 numerals.
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
