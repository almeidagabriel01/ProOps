import React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared rather than route-local: the phone was drawn for `/aplicativo` and the
 * company site's products page needs the same one. Two copies of a device frame
 * drift, and the drift is visible, because the two would sit two scrolls apart
 * on the same site.
 */
interface DeviceFrameProps {
  children: React.ReactNode;
  platform?: "ios" | "android";
  className?: string;
}

/**
 * A phone, drawn in CSS.
 *
 * Not a mockup PNG. A bitmap frame is fixed at one resolution, weighs more than
 * the screen it wraps, and dates the page the moment the hardware changes.
 * Everything here is borders, gradients and one pseudo-element, so it stays
 * sharp at any size and on any display.
 *
 * The radii are percentages, `14% / 6.5%`, rather than a fixed rem. At the
 * 9:19.5 screen ratio those two percentages resolve to nearly the same physical
 * radius, so one frame is correct whether it is rendered at 21rem in the hero
 * or at 11rem in the gallery. A fixed radius would look right at one size and
 * wrong at the other.
 *
 * The platform difference is not decoration: an iPhone has the pill of the
 * dynamic island and its power button opposite the volume keys, an Android has
 * a punch-hole camera and both keys on the same side. Showing an Android
 * capture inside an iPhone is the kind of detail that people who use phones
 * notice immediately.
 *
 * The frame carries NO role and NO label. It started with `role="img"` plus an
 * aria-label, which reads fine over a screenshot and is wrong over the hero,
 * whose screen is real text: the role makes the whole subtree opaque, so every
 * figure and label inside it disappears from assistive tech. Semantics belong
 * to whatever is put inside, an `alt` on the image or the text itself.
 */
export function DeviceFrame({
  children,
  platform = "ios",
  className,
}: DeviceFrameProps) {
  const isIos = platform === "ios";

  return (
    <div className={cn("relative", className)}>
      {/* Side keys, behind the rail so they read as part of the body. */}
      {isIos ? (
        <>
          <span
            aria-hidden="true"
            className="absolute left-[-2px] top-[18%] h-[4%] w-[3px] rounded-l-sm bg-gradient-to-r from-[#5a5a5e] to-[#2e2e32]"
          />
          <span
            aria-hidden="true"
            className="absolute left-[-2px] top-[25%] h-[7%] w-[3px] rounded-l-sm bg-gradient-to-r from-[#5a5a5e] to-[#2e2e32]"
          />
          <span
            aria-hidden="true"
            className="absolute left-[-2px] top-[34%] h-[7%] w-[3px] rounded-l-sm bg-gradient-to-r from-[#5a5a5e] to-[#2e2e32]"
          />
          <span
            aria-hidden="true"
            className="absolute right-[-2px] top-[27%] h-[11%] w-[3px] rounded-r-sm bg-gradient-to-l from-[#5a5a5e] to-[#2e2e32]"
          />
        </>
      ) : (
        <>
          <span
            aria-hidden="true"
            className="absolute right-[-2px] top-[20%] h-[6%] w-[3px] rounded-r-sm bg-gradient-to-l from-[#5a5a5e] to-[#2e2e32]"
          />
          <span
            aria-hidden="true"
            className="absolute right-[-2px] top-[28%] h-[11%] w-[3px] rounded-r-sm bg-gradient-to-l from-[#5a5a5e] to-[#2e2e32]"
          />
        </>
      )}

      {/* Metal rail: a light top edge fading into a dark body is what reads as
          a machined side, rather than as a grey outline. */}
      <div
        style={{ borderRadius: "14% / 6.5%" }}
        className="relative bg-[linear-gradient(160deg,#6c6c72_0%,#3a3a3f_18%,#232327_52%,#3d3d42_86%,#5c5c62_100%)] p-[3px] shadow-[0_60px_120px_-40px_rgba(0,0,0,0.95),0_18px_40px_-18px_rgba(0,0,0,0.8)]"
      >
        {/* Bezel */}
        <div
          style={{ borderRadius: "13% / 6.1%" }}
          className="bg-[#08080a] p-[7px]"
        >
          {/* Screen */}
          <div
            style={{ borderRadius: "11% / 5.2%" }}
            // `--app-bg` only exists under `.app-theme`, which is the mobile
            // app's own palette and only wraps /aplicativo. The fallback keeps
            // the screen from being transparent anywhere else; every caller
            // fills it with an image anyway, so it is only ever a frame.
            className="relative aspect-[9/19.5] overflow-hidden bg-[var(--app-bg,#131315)]"
          >
            {children}

            {/* Camera cutout, drawn over the screen like the real thing. */}
            {isIos ? (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-[1.4%] h-[3.6%] w-[30%] -translate-x-1/2 rounded-full bg-black"
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-[1.6%] aspect-square w-[4.5%] -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10"
              />
            )}

            {/* Glass. Kept faint on purpose: the screen is what is being sold,
                and a strong reflection is the fastest way to make a device
                mockup look like a stock image. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(122deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_16%,transparent_34%,transparent_100%)]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
