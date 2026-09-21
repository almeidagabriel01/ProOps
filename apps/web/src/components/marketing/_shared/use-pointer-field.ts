"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import { useMediaQuery } from "./use-media-query";

/**
 * iOS 13+ hid DeviceOrientation behind a permission that can only be requested
 * from a user gesture. The class exists on the window either way, so feature
 * detection is on the METHOD, not on the event.
 */
type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function pedePermissao(): OrientationCtor["requestPermission"] | undefined {
  if (typeof window === "undefined") return undefined;
  const ctor = window.DeviceOrientationEvent as OrientationCtor | undefined;
  return typeof ctor?.requestPermission === "function"
    ? ctor.requestPermission.bind(ctor)
    : undefined;
}

const limita = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Whether the gyroscope is behind a permission prompt.
 *
 * A device capability, not state: it cannot change during a session, hence the
 * no-op subscribe. It still goes through `useSyncExternalStore` rather than a
 * plain read, because `window` does not exist on the server and the server
 * snapshot has to be `false` for hydration to match.
 */
const semInscricao = () => () => {};
function usePrecisaDePrompt(): boolean {
  return useSyncExternalStore(
    semInscricao,
    () => pedePermissao() !== undefined,
    () => false,
  );
}

/** A cursor worth reacting to. Below `md` a hover is a tap, which is not one. */
const PONTEIRO_FINO = "(pointer: fine) and (min-width: 768px)";

export interface PointerFieldState {
  /** Attach to the element whose subtree reads `--px` / `--py`. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** True when a tap is required before the gyroscope can be read (iOS). */
  precisaDePermissao: boolean;
  /** Call from a click handler. Resolves once the answer is known. */
  pedirPermissao: () => Promise<void>;
}

/**
 * Writes the visitor's attention into two CSS custom properties.
 *
 * `--px` and `--py` land on the scope element, in the range -1 to 1, and
 * everything below styles itself off them. Keeping the reactive part in CSS is
 * what makes this cheap: one `setProperty` per frame on ONE element, instead of
 * React re-rendering a subtree sixty times a second.
 *
 * Three inputs, in order of what the device actually offers:
 *
 * - **Pointer** on anything with a fine pointer. Coalesced into a single rAF,
 *   because `pointermove` fires faster than the screen refreshes and writing a
 *   custom property per event is layout thrash for frames nobody sees.
 * - **Gyroscope** on a phone, when `DeviceOrientationEvent` is readable. On iOS
 *   that needs a tap first, which is what `precisaDePermissao` surfaces so the
 *   page can offer it instead of silently doing nothing.
 * - **Scroll velocity** as the floor. It needs no sensor and no permission, so
 *   a phone that denies the gyroscope still gets a field that responds to the
 *   one thing the reader is definitely doing.
 *
 * Under `prefers-reduced-motion` nothing is attached and both values stay 0,
 * which is the resting state the CSS is authored against.
 */
export function usePointerField(): PointerFieldState {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const temPonteiroFino = useMediaQuery(PONTEIRO_FINO);
  const precisaDePrompt = usePrecisaDePrompt();
  // `null` = not asked yet. Derived state, not a snapshot of the device, which
  // is why this is the only piece of React state the hook keeps.
  const [resposta, setResposta] = useState<"granted" | "denied" | null>(null);

  const pedirPermissao = useCallback(async () => {
    const pedir = pedePermissao();
    if (!pedir) return;
    try {
      setResposta(await pedir());
    } catch {
      // A denied prompt rejects outright on some builds. Either way the answer
      // is no, and the scroll-velocity floor below keeps the field alive.
      setResposta("denied");
    }
  }, []);

  const permissaoConcedida = resposta === "granted";
  // Everything here is derived, so there is no setState inside the effect and no
  // cascading render when the device turns out to have a gyroscope.
  const precisaDePermissao =
    !reduce && !temPonteiroFino && precisaDePrompt && resposta === null;

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    let px = 0;
    let py = 0;
    let frame = 0;

    const escreve = () => {
      frame = 0;
      el.style.setProperty("--px", px.toFixed(4));
      el.style.setProperty("--py", py.toFixed(4));
    };
    const agenda = () => {
      if (!frame) frame = requestAnimationFrame(escreve);
    };

    const limpezas: Array<() => void> = [];

    if (temPonteiroFino) {
      const onMove = (event: PointerEvent) => {
        px = limita((event.clientX / window.innerWidth) * 2 - 1);
        py = limita((event.clientY / window.innerHeight) * 2 - 1);
        agenda();
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      limpezas.push(() => window.removeEventListener("pointermove", onMove));
    } else {
      if (!precisaDePrompt || permissaoConcedida) {
        const onTilt = (event: DeviceOrientationEvent) => {
          // gamma is the left/right tilt (-90..90), beta the front/back
          // (-180..180). A phone is held at roughly 45 degrees, so beta is
          // re-centred there instead of at flat-on-a-table.
          if (event.gamma === null && event.beta === null) return;
          px = limita((event.gamma ?? 0) / 35);
          py = limita(((event.beta ?? 45) - 45) / 35);
          agenda();
        };
        window.addEventListener("deviceorientation", onTilt, { passive: true });
        limpezas.push(() =>
          window.removeEventListener("deviceorientation", onTilt),
        );
      }

      // The floor, always on when there is no pointer: scroll velocity, decayed
      // back to rest. Works on every device and needs nothing granted.
      let ultimoY = window.scrollY;
      let decaimento = 0;
      const onScroll = () => {
        const y = window.scrollY;
        py = limita(py + (y - ultimoY) / 220);
        ultimoY = y;
        agenda();
        if (!decaimento) {
          decaimento = window.setInterval(() => {
            py *= 0.88;
            if (Math.abs(py) < 0.002) {
              py = 0;
              window.clearInterval(decaimento);
              decaimento = 0;
            }
            agenda();
          }, 50);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      limpezas.push(() => {
        window.removeEventListener("scroll", onScroll);
        if (decaimento) window.clearInterval(decaimento);
      });
    }

    return () => {
      limpezas.forEach((fn) => fn());
      if (frame) cancelAnimationFrame(frame);
      // The properties are written outside gsap's bookkeeping, so nothing else
      // will clear them: a stale tilt would survive a breakpoint change.
      el.style.removeProperty("--px");
      el.style.removeProperty("--py");
    };
  }, [reduce, temPonteiroFino, precisaDePrompt, permissaoConcedida]);

  return { ref, precisaDePermissao, pedirPermissao };
}
