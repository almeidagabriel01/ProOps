# Efeitos Sonoros da Lia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feedback sonoro sintetizado (Web Audio) para as ações do chat da Lia, com preferência on/off persistida em `users/{uid}.preferences.liaSoundsEnabled` via `PUT /v1/profile`.

**Architecture:** Módulo TS puro `lia-sounds.ts` (singleton, AudioContext lazy, debounce 250ms) tocado em pontos explícitos do `useAiChat`. Preferência lida do `useAuth()` com toggle otimista via hook `useLiaSoundPreference` → `UserService.updateProfile` → endpoint `PUT /v1/profile` estendido com validação allowlist server-side. Botão mute no header do `LiaPanel`.

**Tech Stack:** Next.js 16 / React 19 (apps/web), Web Audio API, Firebase Cloud Functions Express (apps/functions), Vitest (web), Jest (functions).

**Spec:** `docs/superpowers/specs/2026-07-06-lia-sound-effects-design.md`

## Global Constraints

- Nunca rodar `git push`; nunca mergear em `main`.
- Commits: uma linha, conventional commits, sem `Co-Authored-By`.
- Sons **nunca** podem lançar erro na UI — todo caminho de áudio é try/catch com no-op.
- Gain máximo 0.15 (0.06 para ondas square).
- Padrão da preferência: **ligado** (`undefined` ⇒ `true`).
- Zero mudança em security rules, CSP, índices Firestore.
- Sem som em: abort/reset/nova sessão, greeting bubble, cancelamento de ação, hidratação de histórico.
- Testes web: `npm run test:web` na raiz (Vitest). Testes functions: `cd apps/functions && npx jest <path>` (Jest).
- Imports web usam alias `@/` para `src/`.

---

### Task 1: Types compartilhados + mapeamento no auth-provider + payload do service

**Files:**
- Modify: `apps/web/src/types/index.ts` (interface `User`, ~linha 85)
- Modify: `apps/web/src/providers/auth-provider.tsx` (~linha 613, objeto retornado por `fetchUserData`)
- Modify: `apps/web/src/services/user-service.ts:92-104` (`updateProfile`)

**Interfaces:**
- Consumes: nada.
- Produces: `UserPreferences { liaSoundsEnabled?: boolean }`, `User.preferences?: UserPreferences`, `UserService.updateProfile({ preferences?: { liaSoundsEnabled: boolean } })`. Tasks 4 e 6 dependem desses nomes exatos.

- [ ] **Step 1: Adicionar type `UserPreferences` e campo em `User`**

Em `apps/web/src/types/index.ts`, logo antes da interface `User` (procurar `phoneNumber?: string; // WhatsApp number`, o campo fica na mesma interface). Adicionar o type acima da interface e o campo dentro dela:

```typescript
export interface UserPreferences {
  /** Efeitos sonoros da Lia. undefined ⇒ ligado. */
  liaSoundsEnabled?: boolean;
}
```

Dentro da interface `User` (junto dos campos opcionais, ex. após `onboarding?: UserOnboardingState;` se estiver na interface, senão após `planUpdatedAt?: string;`):

```typescript
  preferences?: UserPreferences;
```

- [ ] **Step 2: Mapear `preferences` no auth-provider**

Em `apps/web/src/providers/auth-provider.tsx`, no objeto retornado por `fetchUserData` (linha ~613, logo após `onboarding: normalizeOnboardingState(userData.onboarding),`):

```typescript
          preferences: userData.preferences || undefined,
```

- [ ] **Step 3: Estender payload de `UserService.updateProfile`**

Em `apps/web/src/services/user-service.ts`, alterar a assinatura de `updateProfile`:

```typescript
  updateProfile: async (data: {
    name?: string;
    phoneNumber?: string | null;
    onboarding?: UserOnboardingState;
    preferences?: { liaSoundsEnabled: boolean };
  }): Promise<void> => {
```

Corpo permanece idêntico (já envia `data` inteiro para `v1/profile`).

- [ ] **Step 4: Verificar compilação**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/types/index.ts apps/web/src/providers/auth-provider.tsx apps/web/src/services/user-service.ts
git commit -m "feat(web): tipo preferences do usuario e payload no updateProfile"
```

---

### Task 2: Backend — validação de `preferences` no `updateProfile`

**Files:**
- Modify: `apps/functions/src/api/controllers/users.controller.ts:95-206` (`updateProfile`)
- Test: `apps/functions/src/api/controllers/__tests__/users.controller.preferences.test.ts` (criar)

**Interfaces:**
- Consumes: endpoint existente `PUT /v1/profile` (registrado em `core.routes.ts:64`), `db`/`auth` de `../../init`.
- Produces: `PUT /v1/profile` aceita body `{ preferences: { liaSoundsEnabled: boolean } }`; persiste com dot-path `"preferences.liaSoundsEnabled"`; rejeita 400 qualquer outra forma. Task 4 depende desse contrato.

- [ ] **Step 1: Escrever teste que falha**

Criar `apps/functions/src/api/controllers/__tests__/users.controller.preferences.test.ts`:

```typescript
/**
 * Unit tests for updateProfile `preferences` validation.
 * Mocks init (db/auth) and side-effect deps. Asserts: valid boolean persists
 * via dot-path merge; non-boolean, unknown keys and non-object payloads are
 * rejected with 400 without touching Firestore; updates without preferences
 * keep working.
 */

const mockUpdate = jest.fn();
const mockGet = jest.fn();

jest.mock("../../../init", () => ({
  auth: { updateUser: jest.fn() },
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({ get: mockGet, update: mockUpdate })),
    })),
    runTransaction: jest.fn(),
  },
}));

jest.mock("../admin.controller", () => ({
  upsertPhoneNumberIndexTx: jest.fn(),
  normalizePhoneNumber: (v: string) => v,
}));

jest.mock("../../../lib/contact-validation", () => ({
  validateBrazilMobilePhone: jest.fn(() => ({ valid: true })),
}));

jest.mock("../../../lib/whatsapp-eligibility", () => ({
  maybeAutoEnableWhatsApp: jest.fn(async () => undefined),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { updateProfile } from "../users.controller";

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res as { status: jest.Mock; json: jest.Mock };
}

function makeReq(body: Record<string, unknown>) {
  return {
    user: { uid: "user-1" },
    body,
  } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({
    exists: true,
    data: () => ({ name: "Gabriel", tenantId: "t1" }),
  });
});

describe("updateProfile preferences", () => {
  it("persists liaSoundsEnabled=false via dot-path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: false } }), res as never);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "preferences.liaSoundsEnabled": false }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it("persists liaSoundsEnabled=true via dot-path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: true } }), res as never);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ "preferences.liaSoundsEnabled": true }),
    );
  });

  it("rejects non-boolean value with 400 and does not write", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { liaSoundsEnabled: "yes" } }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects unknown preference keys with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: { theme: "dark" } }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-object preferences (array) with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: [true] }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects non-object preferences (string) with 400", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ preferences: "on" }), res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("update without preferences keeps working and writes no preference path", async () => {
    const res = makeRes();
    await updateProfile(makeReq({ name: "Novo Nome" }), res as never);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
    const written = mockUpdate.mock.calls[0][0];
    expect(written).toEqual(expect.objectContaining({ name: "Novo Nome" }));
    expect(Object.keys(written)).not.toContain("preferences.liaSoundsEnabled");
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/users.controller.preferences.test.ts`
Expected: FAIL — os 4 testes de rejeição falham (400 nunca é retornado; update é chamado) e os de persistência falham (dot-path ausente).

- [ ] **Step 3: Implementar validação no controller**

Em `apps/functions/src/api/controllers/users.controller.ts`, dentro de `updateProfile`:

Trocar a linha 98:

```typescript
    const { name, phoneNumber, onboarding, preferences } = req.body;
```

Logo após o bloco `if (!userSnap.exists) {...}` (após linha 105) e antes de `const userData = userSnap.data();`, inserir a validação (retorna 400 antes de qualquer escrita):

```typescript
    const ALLOWED_PREFERENCE_KEYS = ["liaSoundsEnabled"];
    if (preferences !== undefined) {
      if (
        typeof preferences !== "object" ||
        preferences === null ||
        Array.isArray(preferences)
      ) {
        return res.status(400).json({ message: "Preferências inválidas." });
      }
      const prefKeys = Object.keys(preferences);
      if (prefKeys.some((key) => !ALLOWED_PREFERENCE_KEYS.includes(key))) {
        return res.status(400).json({ message: "Preferência desconhecida." });
      }
      if (
        "liaSoundsEnabled" in preferences &&
        typeof preferences.liaSoundsEnabled !== "boolean"
      ) {
        return res
          .status(400)
          .json({ message: "liaSoundsEnabled deve ser booleano." });
      }
    }
```

Depois, logo após `if (name !== undefined) updateData.name = name;` (linha 113), inserir:

```typescript
    if (
      preferences !== undefined &&
      typeof preferences.liaSoundsEnabled === "boolean"
    ) {
      updateData["preferences.liaSoundsEnabled"] = preferences.liaSoundsEnabled;
    }
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/users.controller.preferences.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Build + lint functions**

Run: `cd apps/functions && npm run build && npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/functions/src/api/controllers/users.controller.ts apps/functions/src/api/controllers/__tests__/users.controller.preferences.test.ts
git commit -m "feat(api): campo preferences validado no PUT /v1/profile"
```

---

### Task 3: Módulo de som `lia-sounds.ts`

**Files:**
- Create: `apps/web/src/lib/lia-sounds.ts`
- Test: `apps/web/src/lib/__tests__/lia-sounds.test.ts` (criar)

**Interfaces:**
- Consumes: Web Audio API do browser (nada do projeto).
- Produces: `type LiaSoundName = "messageSent" | "typingStart" | "responseDone" | "notification" | "error" | "confirmNeeded"`; `playLiaSound(name: LiaSoundName): void`; `setLiaSoundsEnabled(value: boolean): void`; `__resetLiaSoundsForTests(): void`. Tasks 4 e 5 importam esses nomes exatos de `@/lib/lia-sounds`.

- [ ] **Step 1: Escrever teste que falha**

Criar `apps/web/src/lib/__tests__/lia-sounds.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  playLiaSound,
  setLiaSoundsEnabled,
  __resetLiaSoundsForTests,
} from "@/lib/lia-sounds";

function makeAudioContextMock(state: "running" | "suspended" = "running") {
  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }));
  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  const instance = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    createOscillator,
    createGain,
  };
  const Ctor = vi.fn(() => instance);
  return { Ctor, instance };
}

describe("lia-sounds", () => {
  beforeEach(() => {
    __resetLiaSoundsForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays a sound: creates oscillator nodes", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("messageSent");

    expect(instance.createOscillator).toHaveBeenCalled();
  });

  it("does not play when disabled", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    setLiaSoundsEnabled(false);
    playLiaSound("messageSent");

    expect(instance.createOscillator).not.toHaveBeenCalled();
  });

  it("debounces: same sound twice within 250ms plays once", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("typingStart");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    playLiaSound("typingStart");

    expect(instance.createOscillator.mock.calls.length).toBe(callsAfterFirst);
  });

  it("plays same sound again after the debounce window", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("typingStart");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    vi.advanceTimersByTime(300);
    playLiaSound("typingStart");

    expect(instance.createOscillator.mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it("different sounds are debounced independently", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("messageSent");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    playLiaSound("error");

    expect(instance.createOscillator.mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it("no-op without AudioContext available (never throws)", () => {
    vi.stubGlobal("AudioContext", undefined);
    // jsdom não define webkitAudioContext — getContext retorna null
    expect(() => playLiaSound("responseDone")).not.toThrow();
  });

  it("suspended context that stays suspended: skips without error and without scheduling", () => {
    const { Ctor, instance } = makeAudioContextMock("suspended");
    vi.stubGlobal("AudioContext", Ctor);

    expect(() => playLiaSound("notification")).not.toThrow();
    expect(instance.resume).toHaveBeenCalled();
    expect(instance.createOscillator).not.toHaveBeenCalled();
  });

  it("constructor that throws is swallowed", () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => {
        throw new Error("boom");
      }),
    );
    expect(() => playLiaSound("confirmNeeded")).not.toThrow();
  });
});
```

Nota: `vi.useFakeTimers()` também mocka `Date.now()`, que o debounce usa.

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npm run test:web -- src/lib/__tests__/lia-sounds.test.ts`
Expected: FAIL — módulo `@/lib/lia-sounds` não existe.

- [ ] **Step 3: Implementar o módulo**

Criar `apps/web/src/lib/lia-sounds.ts`:

```typescript
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
  if (!sharedContext) sharedContext = new Ctor();
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
    const last = lastPlayedAt.get(name) ?? 0;
    if (now - last < MIN_INTERVAL_MS) return;

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
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npm run test:web -- src/lib/__tests__/lia-sounds.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/lia-sounds.ts apps/web/src/lib/__tests__/lia-sounds.test.ts
git commit -m "feat(web): modulo de sons sintetizados da lia (web audio)"
```

---

### Task 4: Hook `useLiaSoundPreference`

**Files:**
- Create: `apps/web/src/hooks/useLiaSoundPreference.ts`
- Test: `apps/web/src/hooks/__tests__/useLiaSoundPreference.test.tsx` (criar)
- Modify: `apps/web/src/hooks/CLAUDE.md` (lista de hooks — adicionar `useLiaSoundPreference.ts`, contagem 32 → 33)

**Interfaces:**
- Consumes: `useAuth()` de `@/providers/auth-provider` (campo `user.preferences?.liaSoundsEnabled` da Task 1); `UserService.updateProfile({ preferences })` (Task 1); `setLiaSoundsEnabled` de `@/lib/lia-sounds` (Task 3).
- Produces: `useLiaSoundPreference(): { soundsEnabled: boolean; isSaving: boolean; toggleSounds: () => Promise<void> }`. Task 6 consome esses nomes exatos.

- [ ] **Step 1: Escrever teste que falha**

Criar `apps/web/src/hooks/__tests__/useLiaSoundPreference.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockUseAuth = vi.fn();
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockUpdateProfile = vi.fn();
vi.mock("@/services/user-service", () => ({
  UserService: {
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  },
}));

const mockSetLiaSoundsEnabled = vi.fn();
vi.mock("@/lib/lia-sounds", () => ({
  setLiaSoundsEnabled: (...args: unknown[]) => mockSetLiaSoundsEnabled(...args),
}));

import { useLiaSoundPreference } from "@/hooks/useLiaSoundPreference";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateProfile.mockResolvedValue(undefined);
});

describe("useLiaSoundPreference", () => {
  it("defaults to enabled when user has no preferences", () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const { result } = renderHook(() => useLiaSoundPreference());
    expect(result.current.soundsEnabled).toBe(true);
  });

  it("reads disabled preference from user doc", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", preferences: { liaSoundsEnabled: false } },
    });
    const { result } = renderHook(() => useLiaSoundPreference());
    expect(result.current.soundsEnabled).toBe(false);
  });

  it("syncs the sound module gate", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1", preferences: { liaSoundsEnabled: false } },
    });
    renderHook(() => useLiaSoundPreference());
    expect(mockSetLiaSoundsEnabled).toHaveBeenCalledWith(false);
  });

  it("toggle is optimistic and persists via UserService", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    const { result } = renderHook(() => useLiaSoundPreference());

    await act(async () => {
      await result.current.toggleSounds();
    });

    expect(result.current.soundsEnabled).toBe(false);
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      preferences: { liaSoundsEnabled: false },
    });
  });

  it("reverts the optimistic value when the service fails", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u1" } });
    mockUpdateProfile.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useLiaSoundPreference());

    await act(async () => {
      await result.current.toggleSounds();
    });

    await waitFor(() => {
      expect(result.current.soundsEnabled).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npm run test:web -- src/hooks/__tests__/useLiaSoundPreference.test.tsx`
Expected: FAIL — módulo `@/hooks/useLiaSoundPreference` não existe.

- [ ] **Step 3: Implementar o hook**

Criar `apps/web/src/hooks/useLiaSoundPreference.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { UserService } from "@/services/user-service";
import { setLiaSoundsEnabled } from "@/lib/lia-sounds";

export interface UseLiaSoundPreferenceReturn {
  /** Estado efetivo (otimista) da preferência de sons */
  soundsEnabled: boolean;
  /** Persistência em andamento */
  isSaving: boolean;
  /** Alterna e persiste a preferência; reverte a UI se a API falhar */
  toggleSounds: () => Promise<void>;
}

/**
 * Preferência de efeitos sonoros da Lia.
 * Fonte: users/{uid}.preferences.liaSoundsEnabled (default: ligado).
 * Toggle otimista via PUT /v1/profile; revert em erro.
 * Sincroniza o gate síncrono do módulo lia-sounds a cada mudança.
 */
export function useLiaSoundPreference(): UseLiaSoundPreferenceReturn {
  const { user } = useAuth();
  const serverValue = user?.preferences?.liaSoundsEnabled ?? true;

  const [override, setOverride] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const soundsEnabled = override ?? serverValue;

  useEffect(() => {
    setLiaSoundsEnabled(soundsEnabled);
  }, [soundsEnabled]);

  const toggleSounds = useCallback(async () => {
    const next = !soundsEnabled;
    setOverride(next);
    setIsSaving(true);
    try {
      await UserService.updateProfile({
        preferences: { liaSoundsEnabled: next },
      });
    } catch (error) {
      console.error("Error saving Lia sound preference:", error);
      setOverride(!next);
    } finally {
      setIsSaving(false);
    }
  }, [soundsEnabled]);

  return { soundsEnabled, isSaving, toggleSounds };
}
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npm run test:web -- src/hooks/__tests__/useLiaSoundPreference.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Atualizar `apps/web/src/hooks/CLAUDE.md`**

Na lista de hooks, adicionar em ordem alfabética:

```
├── useLiaSoundPreference.ts # Preferência de sons da Lia (on/off, persistida no perfil)
```

E atualizar o cabeçalho `## Hooks existentes (32 + subpasta proposal/)` para `(33 + subpasta proposal/)`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useLiaSoundPreference.ts apps/web/src/hooks/__tests__/useLiaSoundPreference.test.tsx apps/web/src/hooks/CLAUDE.md
git commit -m "feat(web): hook useLiaSoundPreference com toggle otimista"
```

---

### Task 5: Gatilhos de som no `useAiChat`

**Files:**
- Modify: `apps/web/src/hooks/useAiChat.ts`
- Test: `apps/web/src/hooks/__tests__/useAiChat.sounds.test.tsx` (criar)

**Interfaces:**
- Consumes: `playLiaSound` de `@/lib/lia-sounds` (Task 3); estrutura existente de `doSend`/`sendMessage`/callbacks SSE em `useAiChat.ts`.
- Produces: nenhuma API nova — só efeitos colaterais sonoros. Comportamento observável: sons nos eventos da tabela do spec, com supressão de `responseDone` quando houve erro ou pedido de confirmação no mesmo envio.

- [ ] **Step 1: Escrever teste que falha**

Criar `apps/web/src/hooks/__tests__/useAiChat.sounds.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AiChatChunk } from "@/types/ai";

vi.mock("next/navigation", () => ({
  usePathname: () => "/proposals",
}));

const mockPlayLiaSound = vi.fn();
vi.mock("@/lib/lia-sounds", () => ({
  playLiaSound: (...args: unknown[]) => mockPlayLiaSound(...args),
}));

// Captura os callbacks passados pelo hook para simular o stream SSE
type StreamHandlers = {
  onChunk: (chunk: AiChatChunk) => void;
  onDone: () => void;
  onError: (error: Error) => void;
};
let handlers: StreamHandlers;
const mockSendChatMessage = vi.fn(
  async (_req: unknown, h: StreamHandlers) => {
    handlers = h;
    return new AbortController();
  },
);
vi.mock("@/services/ai-service", () => ({
  sendChatMessage: (...args: unknown[]) =>
    mockSendChatMessage(args[0], args[1] as StreamHandlers),
  AiApiError: class AiApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

import { useAiChat } from "@/hooks/useAiChat";

function soundsPlayed(): string[] {
  return mockPlayLiaSound.mock.calls.map((call) => call[0] as string);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAiChat sound triggers", () => {
  it("plays messageSent when the user sends a message", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    expect(soundsPlayed()).toContain("messageSent");
  });

  it("plays typingStart once on the first text chunk only", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({ type: "text", content: "Oi" } as AiChatChunk);
      handlers.onChunk({ type: "text", content: "!" } as AiChatChunk);
    });
    const typing = soundsPlayed().filter((s) => s === "typingStart");
    expect(typing).toHaveLength(1);
  });

  it("plays responseDone on done with the panel open", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({ type: "text", content: "Oi" } as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("responseDone");
    expect(soundsPlayed()).not.toContain("notification");
  });

  it("plays notification instead of responseDone when the panel is closed", async () => {
    const { result } = renderHook(() => useAiChat());
    // painel nunca aberto — isOpen === false
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("notification");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays error on error chunk and suppresses responseDone on the same send", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onChunk({
        type: "error",
        error: "Falhou",
      } as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("error");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays error when the stream errors out", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("olá");
    });
    act(() => {
      handlers.onError(new Error("network"));
    });
    expect(soundsPlayed()).toContain("error");
  });

  it("plays confirmNeeded and suppresses responseDone when confirmation is requested", async () => {
    const { result } = renderHook(() => useAiChat());
    act(() => {
      result.current.openPanel();
    });
    await act(async () => {
      await result.current.sendMessage("apague o cliente X");
    });
    act(() => {
      handlers.onChunk({
        type: "tool_result",
        toolResult: {
          name: "delete_client",
          requiresConfirmation: true,
          confirmationToken: "tok",
          confirmationData: {
            action: "Excluir cliente",
            affectedRecords: ["X"],
            severity: "high",
          },
        },
      } as unknown as AiChatChunk);
      handlers.onDone();
    });
    expect(soundsPlayed()).toContain("confirmNeeded");
    expect(soundsPlayed()).not.toContain("responseDone");
  });

  it("plays no sound when canceling a pending confirmation", async () => {
    const { result } = renderHook(() => useAiChat());
    await act(async () => {
      await result.current.sendMessage("apague o cliente X");
    });
    act(() => {
      handlers.onChunk({
        type: "tool_result",
        toolResult: {
          name: "delete_client",
          requiresConfirmation: true,
          confirmationData: {
            action: "Excluir cliente",
            affectedRecords: ["X"],
            severity: "high",
          },
        },
      } as unknown as AiChatChunk);
      handlers.onDone();
    });
    mockPlayLiaSound.mockClear();
    act(() => {
      result.current.cancelAction();
    });
    expect(mockPlayLiaSound).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar teste — deve falhar**

Run: `npm run test:web -- src/hooks/__tests__/useAiChat.sounds.test.tsx`
Expected: FAIL — `playLiaSound` nunca é chamado (todas as asserções de som falham).

- [ ] **Step 3: Implementar os gatilhos em `useAiChat.ts`**

3a. Adicionar import no topo (junto dos imports locais):

```typescript
import { playLiaSound } from "@/lib/lia-sounds";
```

3b. Em `doSend`, logo após `setIsStreaming(true);` (linha ~146), adicionar flags locais do envio:

```typescript
      // Sound gating per send: typingStart toca 1x; responseDone é suprimido
      // se o mesmo envio terminou em erro ou pediu confirmação.
      let typingSoundPlayed = false;
      let sendHadError = false;
      let confirmationRequested = false;
```

3c. No case `"thinking"` e no case `"text"` (dentro do `if (chunk.content)`), antes do `setMessages`, adicionar:

```typescript
                  if (!typingSoundPlayed) {
                    typingSoundPlayed = true;
                    playLiaSound("typingStart");
                  }
```

3d. No case `"tool_result"`, dentro do `if (chunk.toolResult.requiresConfirmation && chunk.toolResult.confirmationData)`, junto do `setPendingConfirmation`:

```typescript
                      confirmationRequested = true;
                      playLiaSound("confirmNeeded");
```

3e. No case `"error"`, antes do `setMessages`:

```typescript
                  sendHadError = true;
                  playLiaSound("error");
```

3f. Em `onDone`, junto do bloco `if (!isOpen) { setHasUnread(true); }` — substituir por:

```typescript
              // Notify if panel is closed
              if (!isOpen) {
                setHasUnread(true);
              }
              if (!sendHadError && !confirmationRequested) {
                playLiaSound(isOpen ? "responseDone" : "notification");
              }
```

3g. Em `onError`, antes do `setMessages`:

```typescript
              playLiaSound("error");
```

3h. No `catch` externo do `doSend`, antes do `setMessages`:

```typescript
        playLiaSound("error");
```

3i. Em `sendMessage`, logo após `setMessages((prev) => [...prev, userMessage]);`:

```typescript
      playLiaSound("messageSent");
```

- [ ] **Step 4: Rodar teste — deve passar**

Run: `npm run test:web -- src/hooks/__tests__/useAiChat.sounds.test.tsx`
Expected: PASS (8 testes).

- [ ] **Step 5: Rodar suíte web completa (regressões)**

Run: `npm run test:web`
Expected: todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useAiChat.ts apps/web/src/hooks/__tests__/useAiChat.sounds.test.tsx
git commit -m "feat(web): gatilhos de som nos eventos do chat da lia"
```

---

### Task 6: Toggle de som no painel da Lia (UI)

**Files:**
- Modify: `apps/web/src/components/lia/lia-panel.tsx`
- Modify: `apps/web/src/components/lia/lia-container.tsx`

**Interfaces:**
- Consumes: `useLiaSoundPreference()` (Task 4); `LiaPanel` props existentes.
- Produces: `LiaPanelProps` ganha `soundsEnabled: boolean` e `onToggleSounds: () => void` (obrigatórios — único caller é o container).

- [ ] **Step 1: Adicionar botão no `LiaPanel`**

Em `apps/web/src/components/lia/lia-panel.tsx`:

Import de ícones (linha 3) — trocar por:

```typescript
import { ArrowLeft, History, Plus, Volume2, VolumeX, X } from "lucide-react";
```

Em `LiaPanelProps`, adicionar após `view: "chat" | "history";`:

```typescript
  /** Preferência de sons da Lia */
  soundsEnabled: boolean;
  onToggleSounds: () => void;
```

Adicionar os dois nomes na destruturação dos props do componente.

No header, na view de chat, antes do botão de histórico (`aria-label="Ver histórico de conversas"`), inserir:

```tsx
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 shrink-0"
              aria-label={soundsEnabled ? "Desativar sons da Lia" : "Ativar sons da Lia"}
              aria-pressed={soundsEnabled}
              onClick={onToggleSounds}
            >
              {soundsEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
```

- [ ] **Step 2: Ligar o hook no `LiaContainer`**

Em `apps/web/src/components/lia/lia-container.tsx`:

Import (junto dos hooks):

```typescript
import { useLiaSoundPreference } from "@/hooks/useLiaSoundPreference";
```

Dentro de `LiaContainer`, após `const usage = useLiaUsage();`:

```typescript
  const soundPreference = useLiaSoundPreference();
```

No JSX de `<LiaPanel`, adicionar props:

```tsx
        soundsEnabled={soundPreference.soundsEnabled}
        onToggleSounds={() => {
          void soundPreference.toggleSounds();
        }}
```

- [ ] **Step 3: Verificar compilação e lint**

Run: `cd apps/web && npx tsc --noEmit && cd ../.. && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/lia/lia-panel.tsx apps/web/src/components/lia/lia-container.tsx
git commit -m "feat(web): toggle de sons no painel da lia"
```

---

### Task 7: Verificação final

**Files:** nenhum novo — só verificação.

- [ ] **Step 1: Suíte web completa**

Run: `npm run test:web`
Expected: PASS total, sem regressões.

- [ ] **Step 2: Testes functions relevantes + build**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/users.controller.preferences.test.ts && npm run build && npm run lint`
Expected: PASS, build limpo, lint limpo.

- [ ] **Step 3: Type-check web + lint web**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificação manual (dev)**

Com `npm run dev` (web) + backend dev: abrir a Lia, enviar mensagem — ouvir `messageSent`, depois `typingStart` no primeiro token e `responseDone` no fim. Clicar no botão de volume — ícone alterna e nenhum som toca depois de desligar. Recarregar a página — preferência mantida (veio do Firestore).
