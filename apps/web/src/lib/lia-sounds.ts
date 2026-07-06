/**
 * Efeitos sonoros sintetizados da Lia (Web Audio API, zero assets).
 *
 * Contratos:
 * - playLiaSound() NUNCA lança — falha de áudio não pode quebrar o chat.
 * - AudioContext é criado lazy no primeiro play (nunca no import; SSR-safe).
 * - Debounce de 250ms por som (StrictMode double-effects, rajadas de SSE).
 * - Autoplay policy: contexto suspenso tenta resume(); se continuar suspenso,
 *   o som é pulado silenciosamente.
 */

export type LiaSoundName =
  | "messageSent"
  | "typingStart"
  | "responseDone"
  | "notification"
  | "error"
  | "confirmNeeded";

interface ToneSpec {
  frequency: number;
  /** Offset em segundos a partir do início do som */
  at: number;
  durationMs: number;
  type?: OscillatorType;
}

const MIN_INTERVAL_MS = 250;
const DEFAULT_GAIN = 0.15;
// Ondas square soam perceptualmente mais altas — gain reduzido
const SQUARE_GAIN = 0.06;

const SOUND_SPECS: Record<LiaSoundName, ToneSpec[]> = {
  messageSent: [
    { frequency: 440, at: 0, durationMs: 50 },
    { frequency: 660, at: 0.05, durationMs: 60 },
  ],
  typingStart: [{ frequency: 220, at: 0, durationMs: 60 }],
  responseDone: [
    { frequency: 659.25, at: 0, durationMs: 90 },
    { frequency: 783.99, at: 0.1, durationMs: 120 },
  ],
  notification: [
    { frequency: 880, at: 0, durationMs: 100 },
    { frequency: 1174.66, at: 0.12, durationMs: 130 },
  ],
  error: [
    { frequency: 160, at: 0, durationMs: 90, type: "square" },
    { frequency: 130, at: 0.11, durationMs: 110, type: "square" },
  ],
  confirmNeeded: [
    { frequency: 523.25, at: 0, durationMs: 90 },
    { frequency: 523.25, at: 0.13, durationMs: 90 },
  ],
};

let enabled = true;
let sharedContext: AudioContext | null = null;
const lastPlayedAt = new Map<LiaSoundName, number>();

export function setLiaSoundsEnabled(value: boolean): void {
  enabled = value;
}

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext) {
    try {
      sharedContext = new Ctor() as any;
    } catch {
      // Fallback for mock constructors that work as regular functions
      sharedContext = Ctor() as any;
    }
  }
  return sharedContext;
}

function scheduleTone(context: AudioContext, spec: ToneSpec): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + spec.at;
  const duration = spec.durationMs / 1000;
  const peak = spec.type === "square" ? SQUARE_GAIN : DEFAULT_GAIN;

  oscillator.type = spec.type ?? "sine";
  oscillator.frequency.setValueAtTime(spec.frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playLiaSound(name: LiaSoundName): void {
  try {
    if (!enabled) return;

    const now = Date.now();
    if (lastPlayedAt.has(name)) {
      const last = lastPlayedAt.get(name)!;
      if (now - last < MIN_INTERVAL_MS) return;
    }

    const context = getContext();
    if (!context) return;

    if (context.state === "suspended") {
      void context.resume().catch(() => undefined);
      // resume() é assíncrono — se ainda está suspenso, pula este som;
      // o próximo toca normalmente com o contexto já retomado.
      if ((context.state as AudioContextState) === "suspended") return;
    }

    lastPlayedAt.set(name, now);
    for (const tone of SOUND_SPECS[name]) {
      scheduleTone(context, tone);
    }
  } catch {
    // Som nunca quebra o chat.
  }
}

/** Somente para testes: reseta o estado do módulo. */
export function __resetLiaSoundsForTests(): void {
  enabled = true;
  sharedContext = null;
  lastPlayedAt.clear();
}
