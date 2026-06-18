# Marcar uma reunião — Booking de demo (Calendly-like)

**Data:** 2026-06-17
**Branch:** develop
**Status:** Aprovado para planejamento

## Objetivo

Substituir o CTA secundário "Ver planos" da hero da home por "Marcar uma reunião",
levando a uma nova página `/agendar` com um agendador de reunião estilo ImprovMX
(book a demo) — calendário animado, seleção de horário com bloqueio de conflitos,
e envio dos dados por email. Design alinhado à página de contato (`/contato`).

Referência visual: https://improvmx.com/ (book a demo) — layout de 3 painéis.

## Decisões (confirmadas com o usuário)

| Tema | Decisão |
|---|---|
| Janela agendável | Seg–Sex, 09:00–17:00 (BRT) |
| Duração | Seletor `15m / 30m / 1h` (default 30m) |
| Email | Interno (`gestao@proops.com.br`) **+** confirmação ao visitante |
| Rota | `/agendar` |
| Fuso | `America/Sao_Paulo` fixo (host único) |
| Anti-spam | Honeypot (paridade com form de contato) |

## Layout (3 painéis, estilo ImprovMX)

- **Esquerda — card do host:** foto/nome do host, título ("Reunião ProOps"),
  descrição curta, seletor de duração (`15m`/`30m`/`1h`), label de timezone
  (`America/Sao_Paulo`). Nome/foto do host a definir na implementação (placeholder
  inicial: ProOps).
- **Meio — calendário custom animado:** grid do mês, navegação ‹ ›, dias passados
  e fins de semana desabilitados, dias úteis futuros selecionáveis. Reveal em
  stagger ao montar/trocar de mês. Indicador no dia "hoje".
- **Direita — painel de horários:** desliza ao escolher dia. Lista de slots; slots
  indisponíveis aparecem desabilitados (riscados/cinza). Ao escolher slot, o painel
  transiciona para um mini-form (nome, email, telefone, empresa, mensagem) +
  botão confirmar.
- **Sucesso:** overlay animado reaproveitando o padrão de `contact-success.tsx`.

Sistema de design: `LandingNavbar` + `LandingFooter`, fontes
`var(--font-pdf-montserrat)` / `var(--font-pdf-inter)`, paleta branco/preto com
dark mode, `EASE_OUT = [0.16, 1, 0.3, 1]`, `motion/react` (e `gsap` já presente
no projeto quando necessário). Animações agressivas e criativas, fugindo de
componentes genéricos.

## Geração de slots e regra de bloqueio (núcleo de correção)

- **Incremento = duração escolhida `D`.** Starts a partir de 09:00, passo `D`,
  enquanto `start + D ≤ 17:00` (fim do expediente).
  - `1h` → 09:00, 10:00, …, 16:00 (último termina 17:00)
  - `30m` → 09:00, 09:30, …, 16:30
  - `15m` → 09:00, 09:15, …, 16:45
- **Booking ocupa o intervalo `[start, start + dur)`.**
- Um candidato `T` com duração `D` é **indisponível** se `[T, T+D)` sobrepõe
  qualquer booking existente `[bStart, bEnd)`. Overlap: `T < bEnd && bStart < T+D`.
  Bloqueia até o fim da reunião já agendada.
- Tudo em **minutos locais BRT** + string `date` (`YYYY-MM-DD`). Sem conversão UTC
  (host único, fuso único).

## Backend

Reaproveita a infra de email existente (`sendEmail`, padrão público
`/v1/public/contact-form`, honeypot).

### Coleção Firestore `demo_bookings`
```
{
  date: string,            // "YYYY-MM-DD" (BRT)
  startMinutes: number,    // minutos desde meia-noite BRT
  durationMinutes: number, // 15 | 30 | 60
  endMinutes: number,      // startMinutes + durationMinutes
  name: string,
  email: string,
  phone?: string,
  company?: string,
  message?: string,
  createdAt: Timestamp,
}
```
Sem `tenantId` — **exceção justificada**: calendário público global, host único,
não multi-tenant. Documentar a exceção na regra.

### Endpoints (rotas públicas, sem auth)
- `GET /v1/public/demo-booking/availability?month=YYYY-MM`
  → retorna bookings do mês (`date`, `startMinutes`, `endMinutes`). **Advisory**:
  frontend usa para desabilitar slots ocupados. Filtra por intervalo de datas do
  mês, com `.limit()`.
- `POST /v1/public/demo-booking`
  → valida payload (zod), honeypot. Executa **Firestore transaction**: re-checa
  overlap no `date`, cria o booking se livre; se ocupado, responde **409**
  ("Este horário acabou de ser reservado. Escolha outro."). Garante race-safety.
  Em sucesso, dispara dois emails e responde 200.

### Emails (dois templates novos)
- **Interno** → `gestao@proops.com.br`: nome, empresa, email, telefone, dia,
  horário, duração, mensagem.
- **Confirmação** → email do visitante: confirmação do dia/horário/duração da
  reunião.

### Regras Firestore
`demo_bookings`: **deny-all** no cliente (leitura e escrita). Só o Admin SDK do
backend acessa. DENY-by-default já bloqueia; adicionar regra explícita documentando
a coleção.

## Frontend

- **Service** `src/services/demo-booking-service.ts`:
  - `getAvailability(month)` → `GET /v1/public/demo-booking/availability`
  - `book(payload)` → `POST /v1/public/demo-booking`
  via `callPublicApi` (mesmo helper do contato).
- **Rota** `src/app/agendar/page.tsx` (metadata) + `_components/`:
  - `agendar-client.tsx` (orquestra estado: mês, dia, duração, slot, form, sucesso)
  - card do host, calendário, painel de slots, mini-form, success overlay
    (componentes locais em `_components/`).
- **Lógica pura** de slots/overlap em `src/lib/booking/` (testável isolado):
  - geração de slots por dia+duração
  - cálculo de indisponibilidade dado conjunto de bookings
- **Validação** zod do form de agendamento em `src/lib/validations/`.
- **Hero**: em `landing-hero-assemble.tsx`, `secondaryCta`
  `{ label: "Ver planos", href: "#pricing" }` → `{ label: "Marcar uma reunião",
  href: "/agendar" }`.

Trata **409** no submit: mostra erro, recarrega disponibilidade do dia, pede novo
slot.

## Testes (Bug Fix Policy / correção)

- **Unit (Vitest)** em `apps/web/src/lib/booking/__tests__/`:
  - geração de slots para `15/30/60` e bordas (último start válido, corte em 17:00)
  - overlap/indisponibilidade: cenário exato de double-booking + variantes de
    duração; bordas (booking adjacente não bloqueia, sobreposto bloqueia)
- **Backend (Jest)** em `apps/functions/src/`:
  - transaction rejeita slot ocupado → 409
  - aceita slot livre → 200 + dois emails (mockados)
  - honeypot preenchido → 200 sem efeito

## Fora de escopo (YAGNI)

- Múltiplos hosts / seleção de host.
- Integração com Google Calendar / convites .ics.
- Cancelamento / reagendamento pelo visitante.
- Captcha (honeypot é suficiente, paridade com contato). Reavaliar se houver spam.
- Locais de reunião (o ImprovMX tem; aqui é call única — não modelar).
```
