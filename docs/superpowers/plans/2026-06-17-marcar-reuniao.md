# Marcar uma reunião (/agendar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o CTA "Ver planos" da hero por "Marcar uma reunião" levando a `/agendar`, uma página de booking estilo ImprovMX com calendário animado, slots com bloqueio de conflito, e envio de email (interno + confirmação).

**Architecture:** Lógica pura de slots/overlap isolada em `lib/booking` (front e back), testada por unit. Frontend chama duas rotas públicas via proxy `/api/backend/*`: `GET availability` (advisory, cinza os slots ocupados) e `POST` que cria o booking dentro de uma Firestore transaction race-safe (409 em conflito) e dispara dois emails via `sendEmail` (Resend). Design reaproveita o sistema da página `/contato`.

**Tech Stack:** Next.js 16 App Router, React 19, `motion/react`, Tailwind v4, Zod, Firebase Cloud Functions (Express), Firestore Admin SDK, Resend. Vitest (web), Jest (functions).

## Global Constraints

- Fuso único: `America/Sao_Paulo` (host único). Tudo em minutos locais BRT + string `date` `YYYY-MM-DD`. Sem conversão UTC.
- Janela: Seg–Sex, 09:00–17:00. `WORK_START_MIN = 540`, `WORK_END_MIN = 1020`.
- Durações válidas: `15 | 30 | 60` (minutos). Default UI: `30`.
- Incremento de slots = duração escolhida. Start válido: múltiplo da duração a partir de 540, com `start + duration <= 1020`.
- Booking ocupa `[startMinutes, endMinutes)`. Overlap: `aStart < bEnd && bStart < aEnd`.
- Email interno SEMPRE para `gestao@proops.com.br`. Confirmação para o email do visitante.
- Honeypot: campo `website` deve ser vazio (paridade com `contact.controller.ts`). Se preenchido → responder 200 sem efeito.
- Commits: autor único `Mauricio Krziminski <mauricio@proops.com.br>` (use `--author`). Sem `Co-Authored-By`. Nunca `git push`. Branch `develop`.
- Coleção `demo_bookings` NÃO tem `tenantId` (exceção justificada: calendário público global). Regras Firestore: deny-all no cliente.

---

### Task 1: Trocar CTA da hero ("Ver planos" → "Marcar uma reunião")

**Files:**
- Modify: `apps/web/src/components/landing/landing-hero-assemble.tsx:64-66`

**Interfaces:**
- Produces: link `/agendar` na hero (consumido manualmente / por E2E futuro).

- [ ] **Step 1: Editar o `secondaryCta`**

Em `apps/web/src/components/landing/landing-hero-assemble.tsx`, no objeto `HERO_COPY`, trocar:

```tsx
  primaryCta: { label: "Começar grátis", href: "/register" },
  secondaryCta: { label: "Marcar uma reunião", href: "/agendar" },
```

- [ ] **Step 2: Verificar build de tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS (sem erros).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/landing-hero-assemble.tsx
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(landing): CTA da hero leva para /agendar (marcar reunião)"
```

---

### Task 2: Lógica pura de slots/overlap (frontend) + testes

**Files:**
- Create: `apps/web/src/lib/booking/slots.ts`
- Test: `apps/web/src/lib/booking/__tests__/slots.test.ts`

**Interfaces:**
- Produces (consumido pelas Tasks 5–8):
  - `WORK_START_MIN: 540`, `WORK_END_MIN: 1020`, `SAO_PAULO_TZ: string`
  - `type DurationMinutes = 15 | 30 | 60`
  - `interface BookedInterval { date: string; startMinutes: number; endMinutes: number }`
  - `minutesToLabel(min: number): string` → `"09:00"`
  - `generateSlotStarts(duration: DurationMinutes): number[]`
  - `intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean`
  - `isSlotAvailable(startMinutes: number, duration: DurationMinutes, dayBookings: BookedInterval[]): boolean`
  - `formatDateStr(year: number, month: number, day: number): string` → `"YYYY-MM-DD"` (month 1-12)
  - `isWeekend(year: number, month: number, day: number): boolean`
  - `nowSaoPaulo(): { dateStr: string; minutes: number }`
  - `isSlotInPast(dateStr: string, startMinutes: number, now: { dateStr: string; minutes: number }): boolean`
  - `isPastDate(dateStr: string, todayStr: string): boolean`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `apps/web/src/lib/booking/__tests__/slots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  generateSlotStarts,
  intervalsOverlap,
  isSlotAvailable,
  minutesToLabel,
  formatDateStr,
  isWeekend,
  isPastDate,
  isSlotInPast,
} from "../slots";

describe("minutesToLabel", () => {
  it("formata HH:MM com zero à esquerda", () => {
    expect(minutesToLabel(540)).toBe("09:00");
    expect(minutesToLabel(570)).toBe("09:30");
    expect(minutesToLabel(1020)).toBe("17:00");
  });
});

describe("generateSlotStarts", () => {
  it("1h → 09:00..16:00 (último termina 17:00)", () => {
    const s = generateSlotStarts(60);
    expect(s[0]).toBe(540);
    expect(s[s.length - 1]).toBe(960); // 16:00
    expect(s).toHaveLength(8);
  });
  it("30m → 09:00..16:30", () => {
    const s = generateSlotStarts(30);
    expect(s[s.length - 1]).toBe(990); // 16:30
    expect(s).toHaveLength(16);
  });
  it("15m → 09:00..16:45", () => {
    const s = generateSlotStarts(15);
    expect(s[s.length - 1]).toBe(1005); // 16:45
    expect(s).toHaveLength(32);
  });
});

describe("intervalsOverlap", () => {
  it("intervalos adjacentes NÃO sobrepõem", () => {
    expect(intervalsOverlap(540, 600, 600, 660)).toBe(false);
  });
  it("intervalos que se cruzam sobrepõem", () => {
    expect(intervalsOverlap(540, 600, 570, 630)).toBe(true);
  });
  it("contido sobrepõe", () => {
    expect(intervalsOverlap(540, 660, 570, 600)).toBe(true);
  });
});

describe("isSlotAvailable — bloqueio de double-booking", () => {
  const booking = { date: "2026-06-19", startMinutes: 600, endMinutes: 660 }; // 10:00-11:00

  it("o slot exatamente reservado fica indisponível", () => {
    expect(isSlotAvailable(600, 60, [booking])).toBe(false);
  });
  it("slot de 30m que cai dentro da reunião de 1h fica indisponível", () => {
    expect(isSlotAvailable(630, 30, [booking])).toBe(false); // 10:30-11:00
  });
  it("slot de 30m terminando exatamente no início da reunião fica livre", () => {
    expect(isSlotAvailable(570, 30, [booking])).toBe(true); // 09:30-10:00
  });
  it("slot começando exatamente no fim da reunião fica livre", () => {
    expect(isSlotAvailable(660, 60, [booking])).toBe(true); // 11:00-12:00
  });
  it("sem bookings, livre", () => {
    expect(isSlotAvailable(540, 60, [])).toBe(true);
  });
});

describe("helpers de data", () => {
  it("formatDateStr aplica zero à esquerda", () => {
    expect(formatDateStr(2026, 6, 9)).toBe("2026-06-09");
  });
  it("isWeekend detecta sábado/domingo", () => {
    expect(isWeekend(2026, 6, 20)).toBe(true); // sáb
    expect(isWeekend(2026, 6, 21)).toBe(true); // dom
    expect(isWeekend(2026, 6, 19)).toBe(false); // sex
  });
  it("isPastDate compara strings YYYY-MM-DD", () => {
    expect(isPastDate("2026-06-18", "2026-06-19")).toBe(true);
    expect(isPastDate("2026-06-19", "2026-06-19")).toBe(false);
    expect(isPastDate("2026-06-20", "2026-06-19")).toBe(false);
  });
  it("isSlotInPast só no mesmo dia e horário já passado", () => {
    const now = { dateStr: "2026-06-19", minutes: 600 };
    expect(isSlotInPast("2026-06-19", 540, now)).toBe(true);
    expect(isSlotInPast("2026-06-19", 660, now)).toBe(false);
    expect(isSlotInPast("2026-06-20", 540, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/web && npx vitest run src/lib/booking/__tests__/slots.test.ts`
Expected: FAIL (módulo `../slots` não existe).

- [ ] **Step 3: Implementar `slots.ts`**

Create `apps/web/src/lib/booking/slots.ts`:

```ts
export const WORK_START_MIN = 9 * 60; // 540
export const WORK_END_MIN = 17 * 60; // 1020
export const SAO_PAULO_TZ = "America/Sao_Paulo";

export type DurationMinutes = 15 | 30 | 60;

export interface BookedInterval {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlotStarts(duration: DurationMinutes): number[] {
  const starts: number[] = [];
  for (let t = WORK_START_MIN; t + duration <= WORK_END_MIN; t += duration) {
    starts.push(t);
  }
  return starts;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isSlotAvailable(
  startMinutes: number,
  duration: DurationMinutes,
  dayBookings: BookedInterval[],
): boolean {
  const end = startMinutes + duration;
  return !dayBookings.some((b) =>
    intervalsOverlap(startMinutes, end, b.startMinutes, b.endMinutes),
  );
}

export function formatDateStr(
  year: number,
  month: number,
  day: number,
): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

export function nowSaoPaulo(): { dateStr: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  // Intl pode devolver "24" para meia-noite em hour12:false — normaliza p/ 0.
  const hour = Number(get("hour")) % 24;
  const minutes = hour * 60 + Number(get("minute"));
  return { dateStr, minutes };
}

export function isPastDate(dateStr: string, todayStr: string): boolean {
  return dateStr < todayStr;
}

export function isSlotInPast(
  dateStr: string,
  startMinutes: number,
  now: { dateStr: string; minutes: number },
): boolean {
  if (dateStr !== now.dateStr) return false;
  return startMinutes <= now.minutes;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/web && npx vitest run src/lib/booking/__tests__/slots.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/booking/slots.ts apps/web/src/lib/booking/__tests__/slots.test.ts
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): lógica pura de slots e bloqueio de conflito + testes"
```

---

### Task 3: Schema Zod do form + service do frontend

**Files:**
- Create: `apps/web/src/lib/validations/demo-booking.ts`
- Create: `apps/web/src/services/demo-booking-service.ts`

**Interfaces:**
- Consumes: `callPublicApi` de `@/lib/api-client` (assinatura: `callPublicApi<T>(endpoint, method, body?)`).
- Produces (consumido pela Task 5):
  - `demoBookingFormSchema` (Zod) e `type DemoBookingFormData`
  - `interface DemoBookingPayload { name; email; phone?; company?; message?; date: string; startMinutes: number; durationMinutes: 15|30|60; website: string }`
  - `interface AvailabilityBooking { date: string; startMinutes: number; endMinutes: number }`
  - `DemoBookingService.getAvailability(month: string): Promise<{ bookings: AvailabilityBooking[] }>`
  - `DemoBookingService.book(payload: DemoBookingPayload): Promise<{ success: boolean }>`

- [ ] **Step 1: Criar o schema de validação do form**

Create `apps/web/src/lib/validations/demo-booking.ts`:

```ts
import { z } from "zod";

// Apenas os campos digitados pelo visitante (data/horário/duração são estado da UI,
// validados à parte). Espelha o estilo de contactSchema.
export const demoBookingFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").max(200),
  phone: z.string().optional().or(z.literal("")),
  company: z.string().max(100).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
  website: z.string().optional().default(""), // honeypot
});

export type DemoBookingFormData = z.infer<typeof demoBookingFormSchema>;
```

- [ ] **Step 2: Criar o service**

Create `apps/web/src/services/demo-booking-service.ts`:

```ts
"use client";
import { callPublicApi } from "@/lib/api-client";

export interface DemoBookingPayload {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  durationMinutes: 15 | 30 | 60;
  website: string; // honeypot
}

export interface AvailabilityBooking {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export const DemoBookingService = {
  getAvailability: (month: string) =>
    callPublicApi<{ bookings: AvailabilityBooking[] }>(
      `/v1/public/demo-booking/availability?month=${encodeURIComponent(month)}`,
      "GET",
    ),
  book: (data: DemoBookingPayload) =>
    callPublicApi<{ success: boolean }>("/v1/public/demo-booking", "POST", data),
};
```

- [ ] **Step 3: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/validations/demo-booking.ts apps/web/src/services/demo-booking-service.ts
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): schema do form e service de agendamento (frontend)"
```

---

### Task 4: Backend — lógica pura de validação de slot + testes (Jest)

**Files:**
- Create: `apps/functions/src/lib/booking-slots.ts`
- Test: `apps/functions/src/lib/__tests__/booking-slots.test.ts`

**Interfaces:**
- Produces (consumido pela Task 6):
  - `WORK_START_MIN: 540`, `WORK_END_MIN: 1020`, `VALID_DURATIONS: readonly [15, 30, 60]`
  - `interface BookedInterval { startMinutes: number; endMinutes: number }`
  - `intervalsOverlap(aStart, aEnd, bStart, bEnd): boolean`
  - `isValidDuration(d: number): d is 15 | 30 | 60`
  - `isValidSlotStart(startMinutes: number, duration: number): boolean` (grid + dentro do expediente)
  - `hasConflict(startMinutes: number, duration: number, existing: BookedInterval[]): boolean`

- [ ] **Step 1: Escrever os testes (falhando)**

Create `apps/functions/src/lib/__tests__/booking-slots.test.ts`:

```ts
import {
  intervalsOverlap,
  isValidDuration,
  isValidSlotStart,
  hasConflict,
} from "../booking-slots";

describe("isValidDuration", () => {
  it("aceita 15/30/60 e rejeita o resto", () => {
    expect(isValidDuration(15)).toBe(true);
    expect(isValidDuration(30)).toBe(true);
    expect(isValidDuration(60)).toBe(true);
    expect(isValidDuration(45)).toBe(false);
    expect(isValidDuration(0)).toBe(false);
  });
});

describe("isValidSlotStart", () => {
  it("aceita início alinhado à grade e dentro do expediente", () => {
    expect(isValidSlotStart(540, 60)).toBe(true); // 09:00
    expect(isValidSlotStart(960, 60)).toBe(true); // 16:00 (termina 17:00)
    expect(isValidSlotStart(570, 30)).toBe(true); // 09:30
  });
  it("rejeita início fora da grade", () => {
    expect(isValidSlotStart(545, 60)).toBe(false);
    expect(isValidSlotStart(570, 60)).toBe(false); // 09:30 não é múltiplo de 60 a partir de 540
  });
  it("rejeita slot que ultrapassa 17:00", () => {
    expect(isValidSlotStart(1020, 60)).toBe(false); // 17:00 início → termina 18:00
    expect(isValidSlotStart(990, 60)).toBe(false); // 16:30 + 60 = 17:30
  });
  it("rejeita antes das 09:00", () => {
    expect(isValidSlotStart(480, 60)).toBe(false); // 08:00
  });
});

describe("hasConflict", () => {
  const existing = [{ startMinutes: 600, endMinutes: 660 }]; // 10:00-11:00
  it("detecta sobreposição", () => {
    expect(hasConflict(600, 60, existing)).toBe(true);
    expect(hasConflict(630, 30, existing)).toBe(true);
  });
  it("sem sobreposição quando adjacente", () => {
    expect(hasConflict(540, 60, existing)).toBe(false); // 09:00-10:00
    expect(hasConflict(660, 60, existing)).toBe(false); // 11:00-12:00
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/functions && npx jest src/lib/__tests__/booking-slots.test.ts`
Expected: FAIL (módulo `../booking-slots` não existe).

- [ ] **Step 3: Implementar `booking-slots.ts`**

Create `apps/functions/src/lib/booking-slots.ts`:

```ts
export const WORK_START_MIN = 9 * 60; // 540
export const WORK_END_MIN = 17 * 60; // 1020
export const VALID_DURATIONS = [15, 30, 60] as const;

export interface BookedInterval {
  startMinutes: number;
  endMinutes: number;
}

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isValidDuration(d: number): d is 15 | 30 | 60 {
  return (VALID_DURATIONS as readonly number[]).includes(d);
}

export function isValidSlotStart(
  startMinutes: number,
  duration: number,
): boolean {
  if (!isValidDuration(duration)) return false;
  if (startMinutes < WORK_START_MIN) return false;
  if (startMinutes + duration > WORK_END_MIN) return false;
  return (startMinutes - WORK_START_MIN) % duration === 0;
}

export function hasConflict(
  startMinutes: number,
  duration: number,
  existing: BookedInterval[],
): boolean {
  const end = startMinutes + duration;
  return existing.some((b) =>
    intervalsOverlap(startMinutes, end, b.startMinutes, b.endMinutes),
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd apps/functions && npx jest src/lib/__tests__/booking-slots.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/lib/booking-slots.ts apps/functions/src/lib/__tests__/booking-slots.test.ts
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): validação pura de slot/conflito no backend + testes"
```

---

### Task 5: Templates de email (interno + confirmação)

**Files:**
- Create: `apps/functions/src/services/email/templates/demo-booking.ts`

**Interfaces:**
- Produces (consumido pela Task 6):
  - `interface DemoBookingEmailData { name; email; phone?; company?; message?; dateLabel: string; timeLabel: string; durationLabel: string }`
  - `renderDemoBookingInternalEmail(data): { subject: string; html: string }`
  - `renderDemoBookingConfirmationEmail(data): { subject: string; html: string }`

- [ ] **Step 1: Criar os templates**

Create `apps/functions/src/services/email/templates/demo-booking.ts` (segue o estilo de `contact-form.ts`: tabela inline, header preto `#18181b`):

```ts
export interface DemoBookingEmailData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message?: string;
  dateLabel: string; // ex.: "sexta-feira, 19 de junho de 2026"
  timeLabel: string; // ex.: "10:00–11:00"
  durationLabel: string; // ex.: "1 hora"
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function row(label: string, value: string, first = false): string {
  const border = first
    ? ""
    : "border-top:1px solid #e4e4e7;padding-top:16px;";
  return `<tr><td style="padding:0 0 16px;${border}">
    <p style="margin:0 0 4px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">${label}</p>
    <p style="margin:0;font-size:15px;color:#18181b;font-weight:600;">${value}</p>
  </td></tr>`;
}

function shell(title: string, heading: string, rowsHtml: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <tr><td style="background:#18181b;padding:24px 40px;"><h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:-0.3px;">ProOps</h1></td></tr>
      <tr><td style="padding:40px;">
        <h2 style="margin:0 0 24px;font-size:22px;color:#18181b;font-weight:700;">${heading}</h2>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;border-radius:8px;padding:24px;margin-bottom:24px;"><tr><td>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml}</table>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#f9f9f9;padding:24px 40px;border-top:1px solid #e4e4e7;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">${footer}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function renderDemoBookingInternalEmail(
  data: DemoBookingEmailData,
): { subject: string; html: string } {
  const subject = `[ProOps] Nova reunião agendada: ${data.name} — ${data.dateLabel} ${data.timeLabel}`;
  const rows =
    row("Nome", escapeHtml(data.name), true) +
    row("Email", escapeHtml(data.email)) +
    row("Telefone", data.phone ? escapeHtml(data.phone) : "Não informado") +
    row("Empresa", data.company ? escapeHtml(data.company) : "Não informada") +
    row("Dia", escapeHtml(data.dateLabel)) +
    row("Horário", escapeHtml(data.timeLabel)) +
    row("Duração", escapeHtml(data.durationLabel)) +
    row("Mensagem", data.message ? escapeHtml(data.message) : "—");
  const html = shell(
    "Nova reunião agendada — ProOps",
    "Nova reunião agendada",
    rows,
    "Agendamento recebido pela página /agendar da ProOps.<br/>ProOps · gestao@proops.com.br",
  );
  return { subject, html };
}

export function renderDemoBookingConfirmationEmail(
  data: DemoBookingEmailData,
): { subject: string; html: string } {
  const subject = `Sua reunião com a ProOps — ${data.dateLabel}, ${data.timeLabel}`;
  const rows =
    row("Dia", escapeHtml(data.dateLabel), true) +
    row("Horário", escapeHtml(data.timeLabel)) +
    row("Duração", escapeHtml(data.durationLabel));
  const html = shell(
    "Reunião confirmada — ProOps",
    `Tudo certo, ${escapeHtml(data.name.split(" ")[0])}!`,
    rows,
    "Sua reunião com a ProOps está confirmada. Se precisar remarcar, responda este email.<br/>ProOps · gestao@proops.com.br",
  );
  return { subject, html };
}
```

- [ ] **Step 2: Verificar tipos/build**

Run: `cd apps/functions && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/functions/src/services/email/templates/demo-booking.ts
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): templates de email interno e de confirmação"
```

---

### Task 6: Controller + rota de booking (availability + submit) + testes (Jest)

**Files:**
- Create: `apps/functions/src/api/controllers/demo-booking.controller.ts`
- Create: `apps/functions/src/api/routes/demo-booking.routes.ts`
- Modify: `apps/functions/src/api/index.ts` (importar + registrar sob `/v1/public`)
- Test: `apps/functions/src/api/controllers/__tests__/demo-booking.controller.test.ts`

**Interfaces:**
- Consumes: `isValidSlotStart`, `hasConflict`, `BookedInterval` (Task 4); `renderDemoBookingInternalEmail`, `renderDemoBookingConfirmationEmail` (Task 5); `sendEmail` de `../../services/email/send-email`; `db` de `../../init`; `logger`.
- Produces:
  - `getDemoBookingAvailability(req, res)` — `GET`, query `month=YYYY-MM` → `{ bookings: { date, startMinutes, endMinutes }[] }`
  - `submitDemoBooking(req, res)` — `POST` → 200 `{ success: true }` | 400 inválido | 409 conflito | 500
  - `export const demoBookingRoutes` (Router)

- [ ] **Step 1: Escrever os testes (falhando)**

Create `apps/functions/src/api/controllers/__tests__/demo-booking.controller.test.ts`. Usa store em memória + mock de `runTransaction`/`collection.where` (mesmo padrão de `recovery-codes.controller.test.ts`) e mock de `sendEmail`:

```ts
const bookings: Array<Record<string, unknown>> = [];

const mockAdd = jest.fn(async (doc: Record<string, unknown>) => {
  bookings.push(doc);
  return { id: `b${bookings.length}` };
});

// where("date","==",X).get() e where("date",">=",..).where("date","<=",..).get()
function makeQuery(filterDate?: string) {
  return {
    where: (field: string, op: string, value: string) => {
      if (op === "==") return makeQuery(value);
      return makeQuery(filterDate);
    },
    limit: () => makeQuery(filterDate),
    get: jest.fn(async () => {
      const docs = bookings
        .filter((b) => (filterDate ? b.date === filterDate : true))
        .map((b) => ({ data: () => b }));
      return { docs, forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
    }),
  };
}

const mockRunTransaction = jest.fn(async (fn: (tx: unknown) => unknown) => {
  const tx = {
    get: async (q: { get: () => Promise<unknown> }) => q.get(),
    set: (_ref: unknown, value: Record<string, unknown>) => {
      bookings.push(value);
    },
  };
  return fn(tx);
});

jest.mock("../../../init", () => ({
  db: {
    collection: jest.fn(() => ({
      where: (f: string, o: string, v: string) => makeQuery(o === "==" ? v : undefined),
      doc: () => ({ id: "newid" }),
      add: mockAdd,
    })),
    runTransaction: mockRunTransaction,
  },
}));

const mockSendEmail = jest.fn(async () => ({ ok: true }));
jest.mock("../../../services/email/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { submitDemoBooking } from "../demo-booking.controller";

function mockRes() {
  const res: { statusCode?: number; body?: unknown; status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(function (this: typeof res, c: number) {
      this.statusCode = c;
      return this;
    }) as unknown as jest.Mock,
    json: jest.fn(function (this: typeof res, b: unknown) {
      this.body = b;
      return this;
    }) as unknown as jest.Mock,
  };
  return res;
}

const validBody = {
  name: "Ana Souza",
  email: "ana@example.com",
  phone: "",
  company: "ACME",
  message: "",
  date: "2026-06-19",
  startMinutes: 600,
  durationMinutes: 60,
  website: "",
};

describe("submitDemoBooking", () => {
  beforeEach(() => {
    bookings.length = 0;
    mockSendEmail.mockClear();
  });

  it("cria booking livre e envia dois emails (200)", async () => {
    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(bookings).toHaveLength(1);
  });

  it("rejeita slot ocupado com 409 e não envia email", async () => {
    bookings.push({ date: "2026-06-19", startMinutes: 600, endMinutes: 660 });
    const res = mockRes();
    await submitDemoBooking({ body: { ...validBody } } as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("honeypot preenchido → 200 sem criar nem enviar", async () => {
    const res = mockRes();
    await submitDemoBooking(
      { body: { ...validBody, website: "bot" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(bookings).toHaveLength(0);
  });

  it("slot fora da grade → 400", async () => {
    const res = mockRes();
    await submitDemoBooking(
      { body: { ...validBody, startMinutes: 545 } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/demo-booking.controller.test.ts`
Expected: FAIL (`../demo-booking.controller` não existe).

- [ ] **Step 3: Implementar o controller**

Create `apps/functions/src/api/controllers/demo-booking.controller.ts`:

```ts
import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { sendEmail } from "../../services/email/send-email";
import {
  renderDemoBookingInternalEmail,
  renderDemoBookingConfirmationEmail,
} from "../../services/email/templates/demo-booking";
import {
  isValidSlotStart,
  hasConflict,
  type BookedInterval,
} from "../../lib/booking-slots";

const COLLECTION = "demo_bookings";

const BookingSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(200).toLowerCase().trim(),
  phone: z.string().max(40).optional().transform((v) => v?.trim() || undefined),
  company: z.string().max(100).optional().transform((v) => v?.trim() || undefined),
  message: z.string().max(2000).optional().transform((v) => v?.trim() || undefined),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  startMinutes: z.number().int().min(0).max(1440),
  durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  website: z.string().optional().default(""), // honeypot
});

const MonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const WEEKDAYS = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${WEEKDAYS[dow]}, ${d} de ${MONTHS[m - 1]} de ${y}`;
}

function durationLabel(min: number): string {
  if (min === 60) return "1 hora";
  return `${min} minutos`;
}

// Fim de semana é bloqueado (janela Seg–Sex).
function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

export async function getDemoBookingAvailability(
  req: Request,
  res: Response,
): Promise<void> {
  const month = MonthSchema.safeParse(req.query.month);
  if (!month.success) {
    res.status(400).json({ message: "Parâmetro 'month' inválido (YYYY-MM)." });
    return;
  }
  try {
    const start = `${month.data}-01`;
    const end = `${month.data}-31`;
    const snap = await db
      .collection(COLLECTION)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .limit(500)
      .get();

    const out: { date: string; startMinutes: number; endMinutes: number }[] = [];
    snap.forEach((doc) => {
      const b = doc.data() as Record<string, unknown>;
      out.push({
        date: String(b.date),
        startMinutes: Number(b.startMinutes),
        endMinutes: Number(b.endMinutes),
      });
    });
    res.status(200).json({ bookings: out });
  } catch (err) {
    logger.error("demo-booking availability failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao carregar disponibilidade." });
  }
}

export async function submitDemoBooking(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = BookingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Dados inválidos." });
    return;
  }
  const data = parsed.data;

  // Honeypot: bot preencheu → finge sucesso, não persiste.
  if (data.website !== "") {
    res.status(200).json({ success: true });
    return;
  }

  // Regras de slot (grade + expediente + dia útil).
  if (!isValidSlotStart(data.startMinutes, data.durationMinutes)) {
    res.status(400).json({ message: "Horário inválido." });
    return;
  }
  if (isWeekendDate(data.date)) {
    res.status(400).json({ message: "Reuniões apenas em dias úteis." });
    return;
  }

  const endMinutes = data.startMinutes + data.durationMinutes;

  try {
    await db.runTransaction(async (tx) => {
      const dayQuery = db
        .collection(COLLECTION)
        .where("date", "==", data.date)
        .limit(100);
      const snap = await tx.get(dayQuery);

      const existing: BookedInterval[] = [];
      snap.forEach((doc: { data: () => Record<string, unknown> }) => {
        const b = doc.data();
        existing.push({
          startMinutes: Number(b.startMinutes),
          endMinutes: Number(b.endMinutes),
        });
      });

      if (hasConflict(data.startMinutes, data.durationMinutes, existing)) {
        const conflict = new Error("SLOT_TAKEN");
        conflict.name = "SLOT_TAKEN";
        throw conflict;
      }

      const ref = db.collection(COLLECTION).doc();
      tx.set(ref, {
        date: data.date,
        startMinutes: data.startMinutes,
        durationMinutes: data.durationMinutes,
        endMinutes,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        company: data.company ?? null,
        message: data.message ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && err.name === "SLOT_TAKEN") {
      res.status(409).json({
        message: "Este horário acabou de ser reservado. Escolha outro.",
      });
      return;
    }
    logger.error("demo-booking transaction failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ message: "Erro ao agendar. Tente novamente." });
    return;
  }

  // Emails (best-effort; o agendamento já está persistido).
  const emailData = {
    name: data.name,
    email: data.email,
    phone: data.phone,
    company: data.company,
    message: data.message,
    dateLabel: dateLabel(data.date),
    timeLabel: `${minutesToLabel(data.startMinutes)}–${minutesToLabel(endMinutes)}`,
    durationLabel: durationLabel(data.durationMinutes),
  };
  try {
    const internal = renderDemoBookingInternalEmail(emailData);
    await sendEmail({
      to: "gestao@proops.com.br",
      subject: internal.subject,
      html: internal.html,
      replyTo: data.email,
      type: "demo_booking_internal",
    });
    const confirm = renderDemoBookingConfirmationEmail(emailData);
    await sendEmail({
      to: data.email,
      subject: confirm.subject,
      html: confirm.html,
      type: "demo_booking_confirmation",
    });
  } catch (err) {
    logger.error("demo-booking sendEmail failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Não falha a request — booking já foi criado.
  }

  logger.info("demo booking created", { date: data.date, startMinutes: data.startMinutes });
  res.status(200).json({ success: true });
}
```

- [ ] **Step 4: Criar a rota**

Create `apps/functions/src/api/routes/demo-booking.routes.ts`:

```ts
import { Router } from "express";
import {
  submitDemoBooking,
  getDemoBookingAvailability,
} from "../controllers/demo-booking.controller";

const router = Router();
router.get("/demo-booking/availability", getDemoBookingAvailability);
router.post("/demo-booking", submitDemoBooking);
export const demoBookingRoutes = router;
```

- [ ] **Step 5: Registrar a rota em `api/index.ts`**

Em `apps/functions/src/api/index.ts`, ao lado do import existente `import { contactRoutes } from "./routes/contact.routes";` (linha ~29), adicionar:

```ts
import { demoBookingRoutes } from "./routes/demo-booking.routes";
```

E logo após a linha `app.use("/v1/public", contactFormLimiter, contactRoutes);` (linha ~448), adicionar (reusa o mesmo limiter público de contato):

```ts
app.use("/v1/public", contactFormLimiter, demoBookingRoutes);
```

- [ ] **Step 6: Rodar testes e build**

Run: `cd apps/functions && npx jest src/api/controllers/__tests__/demo-booking.controller.test.ts`
Expected: PASS (4 testes).

Run: `cd apps/functions && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/functions/src/api/controllers/demo-booking.controller.ts apps/functions/src/api/routes/demo-booking.routes.ts apps/functions/src/api/index.ts apps/functions/src/api/controllers/__tests__/demo-booking.controller.test.ts
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): rotas públicas de disponibilidade e agendamento com transação race-safe"
```

---

### Task 7: Regras Firestore para `demo_bookings` (deny-all no cliente)

**Files:**
- Modify: `firebase/firestore.rules` (localizar o arquivo de rules do projeto; pode estar em `firebase/firestore.rules` ou `firestore.rules` na raiz — usar `git ls-files | grep firestore.rules`)

**Interfaces:**
- Produces: bloqueio explícito de leitura/escrita de `demo_bookings` pelo cliente. Backend usa Admin SDK (ignora rules).

- [ ] **Step 1: Localizar o arquivo de rules**

Run: `git ls-files | grep firestore.rules`
Expected: caminho do arquivo (ex.: `firebase/firestore.rules`).

- [ ] **Step 2: Adicionar a regra**

Dentro do bloco `match /databases/{database}/documents { ... }`, adicionar (antes de qualquer catch-all, ou junto às demais coleções):

```
    // Calendário público de reuniões (/agendar). Sem tenantId — coleção global.
    // Apenas o backend (Admin SDK) lê/escreve. Cliente nunca acessa.
    match /demo_bookings/{bookingId} {
      allow read, write: if false;
    }
```

- [ ] **Step 3: Rodar testes de rules (se houver emulador disponível)**

Run: `npm run test:rules`
Expected: PASS (a nova regra não quebra as existentes; DENY-by-default já cobre, a regra explícita documenta).

> Se o emulador não estiver disponível no ambiente de execução, registrar isso e seguir — a regra `if false` é segura por construção.

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.rules
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(booking): regra Firestore deny-all para demo_bookings"
```

---

### Task 8: Página `/agendar` — card do host + calendário animado

**Files:**
- Create: `apps/web/src/app/agendar/page.tsx`
- Create: `apps/web/src/app/agendar/_components/agendar-client.tsx`
- Create: `apps/web/src/app/agendar/_components/host-card.tsx`
- Create: `apps/web/src/app/agendar/_components/booking-calendar.tsx`

**Interfaces:**
- Consumes: `slots.ts` (Task 2); `LandingNavbar`, `LandingFooter`, `useLandingPage` de `@/components/landing`; `useReducedMotion` de `@/components/landing/_shared/use-reduced-motion`; `DemoBookingService`, `AvailabilityBooking` (Task 3).
- Produces (consumido pela Task 9): estado e callbacks orquestrados em `agendar-client.tsx`. Componentes `HostCard` e `BookingCalendar` com as props abaixo.

**Decisões de UI (criativo/agressivo, fugindo do padrão):**
- Layout 3 painéis (`lg:grid-cols-[300px_1fr_minmax(0,360px)]`), empilha no mobile.
- Paleta/tipografia da `/contato`: branco/preto + dark, `var(--font-pdf-montserrat)` títulos, `var(--font-pdf-inter)` corpo, `EASE_OUT = [0.16, 1, 0.3, 1]`.
- Calendário: dias entram em **stagger** (cascata) ao montar/trocar mês; dia seguinte só anima após o anterior. Hover com leve `scale`/realce. Dia selecionado ganha preenchimento sólido com transição de `layoutId` (indicador que "desliza" entre dias).
- Host card: duração como **segmented control** animado (pílula que desliza via `layoutId`).

- [ ] **Step 1: Criar a page (Server Component + metadata)**

Create `apps/web/src/app/agendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { AgendarClient } from "./_components/agendar-client";

export const metadata: Metadata = {
  title: "Marcar uma reunião - ProOps",
  description:
    "Agende uma conversa de 15, 30 ou 60 minutos com o time ProOps. Escolha o melhor dia e horário.",
  alternates: { canonical: "/agendar" },
  openGraph: {
    title: "Marcar uma reunião - ProOps",
    description: "Escolha um dia e horário e fale com o time ProOps.",
    url: "/agendar",
  },
};

export default function AgendarPage() {
  return <AgendarClient />;
}
```

- [ ] **Step 2: Criar o `HostCard`**

Create `apps/web/src/app/agendar/_components/host-card.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import { Clock, Globe, Video } from "lucide-react";
import type { DurationMinutes } from "@/lib/booking/slots";

interface HostCardProps {
  duration: DurationMinutes;
  onDurationChange: (d: DurationMinutes) => void;
}

const DURATIONS: { value: DurationMinutes; label: string }[] = [
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
];

export function HostCard({ duration, onDurationChange }: HostCardProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
          <span className="text-lg font-bold [font-family:var(--font-pdf-montserrat)]">P</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
            Time ProOps
          </p>
          <p className="text-sm font-semibold">Conversa de demonstração</p>
        </div>
      </div>

      <h1 className="text-3xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-pdf-montserrat)] md:text-4xl">
        Vamos marcar
        <br />
        uma reunião.
      </h1>

      <p className="max-w-xs text-sm leading-relaxed text-black/60 dark:text-white/60">
        Escolha o dia e o horário. A gente mostra a ProOps funcionando no seu
        contexto — sem compromisso.
      </p>

      <div className="flex flex-col gap-3 text-sm text-black/70 dark:text-white/70">
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 opacity-60" />
          <div className="relative inline-flex rounded-full border border-black/12 p-1 dark:border-white/15">
            {DURATIONS.map((d) => {
              const active = d.value === duration;
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onDurationChange(d.value)}
                  className="relative px-3.5 py-1 text-xs font-semibold"
                >
                  {active && (
                    <motion.span
                      layoutId="duration-pill"
                      className="absolute inset-0 rounded-full bg-black dark:bg-white"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={
                      active
                        ? "relative z-10 text-white dark:text-black"
                        : "relative z-10 text-black/60 dark:text-white/60"
                    }
                  >
                    {d.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Video className="h-4 w-4 opacity-60" />
          <span>Vídeochamada (link enviado por email)</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Globe className="h-4 w-4 opacity-60" />
          <span>America/Sao_Paulo</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar o `BookingCalendar`**

Create `apps/web/src/app/agendar/_components/booking-calendar.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatDateStr,
  isWeekend,
  isPastDate,
  type DurationMinutes,
} from "@/lib/booking/slots";

const WEEKDAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTH_LABELS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

interface BookingCalendarProps {
  viewYear: number;
  viewMonth: number; // 1-12
  todayStr: string;
  selectedDate: string | null;
  fullyBookedDates: Set<string>;
  reduce: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDate: (dateStr: string) => void;
  // mantido na assinatura para futura sinalização visual por duração
  duration: DurationMinutes;
}

export function BookingCalendar({
  viewYear,
  viewMonth,
  todayStr,
  selectedDate,
  fullyBookedDates,
  reduce,
  onPrevMonth,
  onNextMonth,
  onSelectDate,
}: BookingCalendarProps) {
  const firstDow = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Não permite navegar para meses inteiramente no passado.
  const monthStartStr = formatDateStr(viewYear, viewMonth, 1);
  const monthEndStr = formatDateStr(viewYear, viewMonth, daysInMonth);
  const prevDisabled = isPastDate(monthEndStr, todayStr);

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold [font-family:var(--font-pdf-montserrat)]">
          {MONTH_LABELS[viewMonth - 1]}{" "}
          <span className="text-black/40 dark:text-white/40">{viewYear}</span>
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrevMonth}
            disabled={prevDisabled}
            aria-label="Mês anterior"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5 disabled:opacity-30 dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Próximo mês"
            className="flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-black/5 dark:hover:bg-white/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] font-semibold tracking-wider text-black/40 dark:text-white/40"
          >
            {w}
          </div>
        ))}
      </div>

      <motion.div
        key={`${viewYear}-${viewMonth}`}
        className="grid grid-cols-7 gap-1"
      >
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const dateStr = formatDateStr(viewYear, viewMonth, day);
          const past = isPastDate(dateStr, todayStr);
          const weekend = isWeekend(viewYear, viewMonth, day);
          const fullyBooked = fullyBookedDates.has(dateStr);
          const disabled = past || weekend || fullyBooked;
          const selected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;

          return (
            <motion.button
              key={dateStr}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce ? undefined : { duration: 0.35, delay: 0.01 * i, ease: [0.16, 1, 0.3, 1] }
              }
              whileHover={disabled || reduce ? undefined : { scale: 1.08 }}
              whileTap={disabled || reduce ? undefined : { scale: 0.95 }}
              className={[
                "relative flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition-colors",
                disabled
                  ? "cursor-not-allowed text-black/20 line-through decoration-1 dark:text-white/20"
                  : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10",
              ].join(" ")}
            >
              {selected && (
                <motion.span
                  layoutId="selected-day"
                  className="absolute inset-0 rounded-xl bg-black dark:bg-white"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span
                className={
                  selected
                    ? "relative z-10 text-white dark:text-black"
                    : "relative z-10"
                }
              >
                {day}
              </span>
              {isToday && !selected && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-black/50 dark:bg-white/50" />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4: Criar o shell `agendar-client.tsx` (sem painel de slots ainda)**

Create `apps/web/src/app/agendar/_components/agendar-client.tsx`. Esta versão monta layout + calendário + host card e busca disponibilidade. O painel de slots e o form entram na Task 9 (este arquivo é estendido lá).

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { LandingNavbar, LandingFooter, useLandingPage } from "@/components/landing";
import { useReducedMotion } from "@/components/landing/_shared/use-reduced-motion";
import {
  DemoBookingService,
  type AvailabilityBooking,
} from "@/services/demo-booking-service";
import {
  generateSlotStarts,
  isSlotAvailable,
  nowSaoPaulo,
  type BookedInterval,
  type DurationMinutes,
} from "@/lib/booking/slots";
import { HostCard } from "./host-card";
import { BookingCalendar } from "./booking-calendar";

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function AgendarClient() {
  const reduce = useReducedMotion();
  const { currentUser, isAuthLoading, handleSignOut } = useLandingPage();

  const initial = useMemo(() => nowSaoPaulo(), []);
  const [todayStr] = useState(initial.dateStr);
  const [now] = useState(initial);

  const [year, setYear] = useState(() => Number(initial.dateStr.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(initial.dateStr.slice(5, 7)));
  const [duration, setDuration] = useState<DurationMinutes>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookings, setBookings] = useState<AvailabilityBooking[]>([]);

  // Carrega disponibilidade do mês visível.
  useEffect(() => {
    let active = true;
    DemoBookingService.getAvailability(monthKey(year, month))
      .then((r) => {
        if (active) setBookings(r.bookings);
      })
      .catch(() => {
        if (active) setBookings([]);
      });
    return () => {
      active = false;
    };
  }, [year, month]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookedInterval[]>();
    for (const b of bookings) {
      const arr = map.get(b.date) ?? [];
      arr.push(b);
      map.set(b.date, arr);
    }
    return map;
  }, [bookings]);

  // Um dia está "lotado" se NENHUM slot da duração atual está livre.
  const fullyBookedDates = useMemo(() => {
    const full = new Set<string>();
    const starts = generateSlotStarts(duration);
    for (const [date, dayBookings] of bookingsByDate) {
      const anyFree = starts.some((s) => isSlotAvailable(s, duration, dayBookings));
      if (!anyFree) full.add(date);
    }
    return full;
  }, [bookingsByDate, duration]);

  function goPrevMonth() {
    setSelectedDate(null);
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  }
  function goNextMonth() {
    setSelectedDate(null);
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-black selection:bg-black selection:text-white dark:bg-neutral-950 dark:text-neutral-100 dark:selection:bg-white dark:selection:text-black">
      <LandingNavbar
        currentUser={currentUser}
        isAuthLoading={isAuthLoading}
        onSignOut={handleSignOut}
      />
      <main>
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-[300px_1fr_minmax(0,360px)] lg:gap-12">
            <HostCard duration={duration} onDurationChange={(d) => { setDuration(d); setSelectedDate(null); }} />

            <div className="lg:border-x lg:border-black/8 lg:px-12 dark:lg:border-white/10">
              <BookingCalendar
                viewYear={year}
                viewMonth={month}
                todayStr={todayStr}
                selectedDate={selectedDate}
                fullyBookedDates={fullyBookedDates}
                reduce={reduce}
                duration={duration}
                onPrevMonth={goPrevMonth}
                onNextMonth={goNextMonth}
                onSelectDate={setSelectedDate}
              />
            </div>

            {/* Painel de slots + form entra na Task 9 */}
            <div aria-hidden className="hidden lg:block" />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}

export { nowSaoPaulo };
```

> Nota: o `export { nowSaoPaulo }` no fim é temporário só para evitar "unused" caso o lint reclame durante esta task; a Task 9 usa `now`/`selectedDate` de verdade e ele pode ser removido lá.

- [ ] **Step 5: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Verificar lint**

Run: `cd apps/web && npm run lint`
Expected: PASS (sem erros).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/agendar/page.tsx apps/web/src/app/agendar/_components/host-card.tsx apps/web/src/app/agendar/_components/booking-calendar.tsx apps/web/src/app/agendar/_components/agendar-client.tsx
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(agendar): página /agendar com card do host e calendário animado"
```

---

### Task 9: Painel de horários deslizante + mini-form + sucesso + tratamento de 409

**Files:**
- Create: `apps/web/src/app/agendar/_components/slots-panel.tsx`
- Create: `apps/web/src/app/agendar/_components/booking-success.tsx`
- Modify: `apps/web/src/app/agendar/_components/agendar-client.tsx`

**Interfaces:**
- Consumes: `slots.ts`; `DemoBookingService` (Task 3); `useFormValidation` de `@/hooks/useFormValidation`; `demoBookingFormSchema`, `DemoBookingFormData` (Task 3); `LandingButton`; `Loader`; `toast` de `@/lib/toast`; `ApiError` de `@/lib/api-client`.
- Produces: fluxo completo selecionar dia → escolher slot → preencher → confirmar → sucesso.

**Decisões de UI:**
- Painel direito entra com `AnimatePresence` (slide + fade da direita) só quando há `selectedDate`.
- Lista de slots em **stagger**; slot indisponível riscado e desabilitado.
- Ao escolher slot, a lista dá lugar (cross-fade/slide) ao mini-form (nome, email, telefone, empresa, mensagem) com botão "Confirmar reunião".
- Sucesso: overlay full-screen com animação (check desenhado + texto subindo), botão "Agendar outra".
- 409 no submit: `toast.error`, recarrega disponibilidade do dia e volta para a lista de slots.

- [ ] **Step 1: Criar o `BookingSuccess`**

Create `apps/web/src/app/agendar/_components/booking-success.tsx`:

```tsx
"use client";

import { AnimatePresence, motion } from "motion/react";
import { LandingButton } from "@/components/landing/_shared/landing-button";

interface BookingSuccessProps {
  open: boolean;
  dateLabel: string;
  timeLabel: string;
  onReset: () => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function BookingSuccess({ open, dateLabel, timeLabel, onReset }: BookingSuccessProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-white px-6 dark:bg-neutral-950"
        >
          <div className="flex max-w-md flex-col items-center text-center">
            <motion.svg
              width="72"
              height="72"
              viewBox="0 0 72 72"
              className="mb-8"
              initial="hidden"
              animate="visible"
            >
              <motion.circle
                cx="36"
                cy="36"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                variants={{
                  hidden: { pathLength: 0, opacity: 0 },
                  visible: { pathLength: 1, opacity: 1, transition: { duration: 0.6, ease: EASE } },
                }}
              />
              <motion.path
                d="M22 37l10 10 18-20"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                variants={{
                  hidden: { pathLength: 0 },
                  visible: { pathLength: 1, transition: { duration: 0.5, delay: 0.4, ease: EASE } },
                }}
              />
            </motion.svg>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              className="text-3xl font-bold [font-family:var(--font-pdf-montserrat)]"
            >
              Reunião confirmada!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62, ease: EASE }}
              className="mt-3 text-black/65 dark:text-white/65"
            >
              {dateLabel} · {timeLabel}. Enviamos a confirmação por email.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.74, ease: EASE }}
              className="mt-8"
            >
              <LandingButton variant="solid" size="md" onClick={onReset}>
                Agendar outra
              </LandingButton>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

> Antes de usar `onClick` no `LandingButton`, confirmar que ele aceita `onClick` (ver `apps/web/src/components/landing/_shared/landing-button.tsx`). Se o componente só aceitar `href`, trocar por um `<button>` estilizado equivalente nesta tela.

- [ ] **Step 2: Criar o `SlotsPanel`**

Create `apps/web/src/app/agendar/_components/slots-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { LandingButton } from "@/components/landing/_shared/landing-button";
import { Loader } from "@/components/ui/loader";
import { useFormValidation } from "@/hooks/useFormValidation";
import {
  demoBookingFormSchema,
  type DemoBookingFormData,
} from "@/lib/validations/demo-booking";
import {
  generateSlotStarts,
  isSlotAvailable,
  isSlotInPast,
  minutesToLabel,
  type BookedInterval,
  type DurationMinutes,
} from "@/lib/booking/slots";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface SlotsPanelProps {
  dateStr: string;
  dateHeading: string; // ex.: "sex. 19"
  duration: DurationMinutes;
  dayBookings: BookedInterval[];
  now: { dateStr: string; minutes: number };
  isSubmitting: boolean;
  onConfirm: (startMinutes: number, form: DemoBookingFormData) => void;
}

export function SlotsPanel({
  dateStr,
  dateHeading,
  duration,
  dayBookings,
  now,
  isSubmitting,
  onConfirm,
}: SlotsPanelProps) {
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [form, setForm] = useState<DemoBookingFormData>({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
    website: "",
  });
  const { errors, validateForm, clearFieldError } = useFormValidation({
    schema: demoBookingFormSchema,
  });

  const starts = generateSlotStarts(duration);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    clearFieldError(name as keyof DemoBookingFormData);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStart === null) return;
    if (!validateForm(form)) return;
    onConfirm(selectedStart, form);
  }

  return (
    <div className="lg:min-h-[440px]">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold [font-family:var(--font-pdf-montserrat)]">
          {dateHeading}
        </h3>
      </div>

      <AnimatePresence mode="wait">
        {selectedStart === null ? (
          <motion.div
            key="slots"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex max-h-[460px] flex-col gap-2 overflow-y-auto pr-1"
          >
            {starts.map((s, i) => {
              const free =
                isSlotAvailable(s, duration, dayBookings) &&
                !isSlotInPast(dateStr, s, now);
              return (
                <motion.button
                  key={s}
                  type="button"
                  disabled={!free}
                  onClick={() => setSelectedStart(s)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.025 * i, ease: EASE }}
                  whileHover={free ? { scale: 1.02 } : undefined}
                  className={[
                    "w-full rounded-xl border py-3 text-center text-sm font-semibold transition",
                    free
                      ? "border-black/12 hover:border-black hover:bg-black hover:text-white dark:border-white/15 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                      : "cursor-not-allowed border-black/5 text-black/25 line-through dark:border-white/5 dark:text-white/25",
                  ].join(" ")}
                >
                  {minutesToLabel(s)}
                </motion.button>
              );
            })}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={handleSubmit}
            noValidate
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="flex flex-col gap-4"
          >
            <button
              type="button"
              onClick={() => setSelectedStart(null)}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {minutesToLabel(selectedStart)}–{minutesToLabel(selectedStart + duration)}
            </button>

            {/* honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute hidden"
              value={form.website}
              onChange={handleChange}
            />

            <Field name="name" label="Nome" value={form.name} onChange={handleChange} error={errors.name} />
            <Field name="email" label="Email" type="email" value={form.email} onChange={handleChange} error={errors.email} />
            <Field name="phone" label="Telefone" type="tel" value={form.phone ?? ""} onChange={handleChange} error={errors.phone} />
            <Field name="company" label="Empresa (opcional)" value={form.company ?? ""} onChange={handleChange} error={errors.company} />
            <Field name="message" label="Algo que devemos saber? (opcional)" value={form.message ?? ""} onChange={handleChange} error={errors.message} multiline />

            <LandingButton
              type="submit"
              variant="solid"
              size="md"
              fullWidth
              disabled={isSubmitting}
              trailingIcon={isSubmitting ? undefined : <ArrowRight className="h-4 w-4" />}
            >
              {isSubmitting ? (
                <span className="inline-flex items-center justify-center gap-2 leading-none">
                  <Loader size="sm" variant="button" />
                  Confirmando...
                </span>
              ) : (
                "Confirmar reunião"
              )}
            </LandingButton>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

interface FieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  error?: string;
  type?: string;
  multiline?: boolean;
}

function Field({ name, label, value, onChange, error, type = "text", multiline }: FieldProps) {
  const base =
    "w-full border-b bg-transparent pb-2 pt-1 text-sm outline-none transition placeholder:text-black/30 focus:border-black dark:placeholder:text-white/30 dark:focus:border-white";
  const border = error ? "border-red-500" : "border-black/15 dark:border-white/15";
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-black/45 dark:text-white/45">
        {label}
      </span>
      {multiline ? (
        <textarea name={name} value={value} onChange={onChange} rows={2} className={`${base} ${border} resize-none`} />
      ) : (
        <input name={name} type={type} value={value} onChange={onChange} className={`${base} ${border}`} />
      )}
      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
    </label>
  );
}
```

> Antes de implementar, abrir `apps/web/src/hooks/useFormValidation.ts` e `apps/web/src/components/ui/loader.tsx` para confirmar as assinaturas exatas (`errors`, `validateForm`, `clearFieldError`; props do `Loader`). Ajustar se divergirem — o uso aqui espelha `contato-form-client.tsx`, que é a referência canônica.

- [ ] **Step 3: Integrar tudo no `agendar-client.tsx`**

Modificar `apps/web/src/app/agendar/_components/agendar-client.tsx`:

1. Remover a linha temporária `export { nowSaoPaulo };` do fim.
2. Adicionar imports:

```tsx
import { AnimatePresence, motion } from "motion/react";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { minutesToLabel } from "@/lib/booking/slots";
import type { DemoBookingFormData } from "@/lib/validations/demo-booking";
import { SlotsPanel } from "./slots-panel";
import { BookingSuccess } from "./booking-success";
```

3. Adicionar estado (após os `useState` existentes):

```tsx
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ dateLabel: string; timeLabel: string } | null>(null);
```

4. Adicionar helpers de label e o handler de submit dentro do componente:

```tsx
  function refetchMonth() {
    DemoBookingService.getAvailability(monthKey(year, month))
      .then((r) => setBookings(r.bookings))
      .catch(() => {});
  }

  function shortDateHeading(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][
      new Date(y, m - 1, d).getDay()
    ];
    return `${dow}. ${d}`;
  }

  function longDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const months = [
      "jan", "fev", "mar", "abr", "mai", "jun",
      "jul", "ago", "set", "out", "nov", "dez",
    ];
    return `${d} de ${months[m - 1]} de ${y}`;
  }

  async function handleConfirm(startMinutes: number, form: DemoBookingFormData) {
    if (!selectedDate) return;
    setIsSubmitting(true);
    try {
      await DemoBookingService.book({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        company: form.company || undefined,
        message: form.message || undefined,
        date: selectedDate,
        startMinutes,
        durationMinutes: duration,
        website: form.website ?? "",
      });
      setSuccess({
        dateLabel: longDateLabel(selectedDate),
        timeLabel: `${minutesToLabel(startMinutes)}–${minutesToLabel(startMinutes + duration)}`,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Este horário acabou de ser reservado. Escolha outro.");
        refetchMonth();
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Erro ao agendar. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setSuccess(null);
    setSelectedDate(null);
    refetchMonth();
  }
```

5. Trocar o placeholder `<div aria-hidden className="hidden lg:block" />` pelo painel:

```tsx
            <div className="lg:pl-2">
              <AnimatePresence mode="wait">
                {selectedDate ? (
                  <motion.div
                    key={selectedDate}
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 32 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SlotsPanel
                      dateStr={selectedDate}
                      dateHeading={shortDateHeading(selectedDate)}
                      duration={duration}
                      dayBookings={bookingsByDate.get(selectedDate) ?? []}
                      now={now}
                      isSubmitting={isSubmitting}
                      onConfirm={handleConfirm}
                    />
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hidden text-sm text-black/40 dark:text-white/40 lg:block lg:pt-2"
                  >
                    Escolha um dia para ver os horários.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
```

6. Antes de `</div>` final (após `<LandingFooter />`), adicionar:

```tsx
      <BookingSuccess
        open={success !== null}
        dateLabel={success?.dateLabel ?? ""}
        timeLabel={success?.timeLabel ?? ""}
        onReset={handleReset}
      />
```

- [ ] **Step 4: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Verificar lint**

Run: `cd apps/web && npm run lint`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte de unit do web (garante que slots continuam verdes)**

Run: `cd apps/web && npx vitest run src/lib/booking`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/agendar/_components/slots-panel.tsx apps/web/src/app/agendar/_components/booking-success.tsx apps/web/src/app/agendar/_components/agendar-client.tsx
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "feat(agendar): painel de horários, mini-form, sucesso e tratamento de conflito (409)"
```

---

### Task 10: Verificação manual no emulador + dev server

**Files:** (nenhum — validação)

- [ ] **Step 1: Subir backend + emuladores**

Run (terminal 1): `npm run dev:backend`
Run (terminal 2, na raiz): `cd apps/web && npm run dev`
Garantir `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` no `.env.local` para apontar o frontend ao emulador.

- [ ] **Step 2: Checklist funcional**

- [ ] Hero mostra "Marcar uma reunião" e leva a `/agendar`.
- [ ] Calendário: dias passados e fins de semana riscados/desabilitados; dias úteis futuros clicáveis; animação em cascata ao trocar de mês.
- [ ] Trocar duração (15/30/60) muda o passo dos horários e o cálculo de "dia lotado".
- [ ] Selecionar dia → painel desliza com horários; selecionar horário → mini-form.
- [ ] Enviar com dados válidos → overlay de sucesso; checar `email_audit` no emulador (dois registros: `demo_booking_internal` + `demo_booking_confirmation`).
- [ ] Reabrir o mesmo dia/horário → slot aparece indisponível (riscado).
- [ ] Forçar conflito (criar 2 abas, reservar o mesmo slot) → segunda recebe toast de 409 e a disponibilidade recarrega.

- [ ] **Step 3: Rodar todas as checagens estáticas finais**

Run: `cd apps/web && npx tsc --noEmit && npm run lint`
Run: `cd apps/functions && npx tsc --noEmit && npm run lint`
Run: `cd apps/functions && npm run build`
Expected: tudo PASS.

- [ ] **Step 4 (se algo for ajustado): Commit**

```bash
git add -A
git commit --author="Mauricio Krziminski <mauricio@proops.com.br>" -m "fix(agendar): ajustes da verificação manual"
```

---

## Self-Review (preenchido)

**Cobertura do spec:**
- CTA hero → Task 1 ✓
- Layout 3 painéis estilo ImprovMX → Tasks 8–9 ✓
- Seletor 15/30/60 → HostCard (Task 8) + geração de slots (Task 2) ✓
- Geração de slots + bloqueio até o fim da reunião → Tasks 2 e 4 (front e back) ✓
- Coleção `demo_bookings` + availability + transação race-safe (409) → Task 6 ✓
- Email interno + confirmação → Tasks 5–6 ✓
- Regras Firestore deny-all → Task 7 ✓
- Animações agressivas/criativas (stagger, layoutId, slide, success desenhado) → Tasks 8–9 ✓
- Testes (Vitest overlap/slots + Jest transação/409/honeypot) → Tasks 2, 4, 6 ✓
- Fuso BRT fixo → constraint global + `nowSaoPaulo` (Task 2) ✓

**Consistência de tipos:** `DurationMinutes` (15|30|60), `BookedInterval` e `generateSlotStarts/isSlotAvailable` usados de forma idêntica entre front (Task 2) e consumidores (Tasks 8–9). Backend usa nomes próprios (`isValidSlotStart`, `hasConflict`) — sem colisão. Payload do service (Task 3) bate com o `BookingSchema` do controller (Task 6).

**Riscos / pontos a confirmar na execução (sinalizados nos passos):**
- Assinatura de `useFormValidation`, props de `Loader` e `LandingButton` (onClick) — confirmar contra `contato-form-client.tsx` antes de codar a Task 9.
- Caminho exato de `firestore.rules` — resolver via `git ls-files` (Task 7).
- Emulador de rules pode não estar disponível no ambiente — fallback documentado (Task 7).
```
