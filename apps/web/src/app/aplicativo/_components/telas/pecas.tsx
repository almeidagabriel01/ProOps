import React from "react";

import { cn } from "@/lib/utils";

/**
 * As peças comuns às réplicas das telas do aplicativo.
 *
 * A landing reconstrói algumas telas do produto em HTML para poder animá-las. A
 * intenção já estava registrada no `globals.css`, no comentário acima do bloco
 * `.app-theme`, junto com `--app-hero-top` e `--app-hero-bottom`, que existiam
 * sem nenhum consumidor. Isto é o consumidor.
 *
 * Por que réplica e não captura: uma captura não responde ao scroll, e o herói
 * já tentou o meio-termo. `app-hero-phone.tsx` registra que ele carregou um
 * cartão animado POR CIMA da captura, e que foi removido porque o cartão caía
 * em cima de um cartão que já existia na imagem e lia como algo renderizado
 * sobre algo. A tela inteira reconstruída não tem esse problema.
 *
 * ── Tudo aqui é dimensionado em `cqw`, e isso é obrigatório ──────────────────
 *
 * `TelaApp` é um container de consulta (`@container`), então
 * `1cqw` é 1% da LARGURA DO APARELHO. O mesmo componente sai correto no herói
 * (22rem) e na prateleira (11rem) sem nenhuma conta no call site.
 *
 * `em` NÃO serve para isto, porque ele compõe: um filho com `text-[0.8em]`
 * passaria a ter todo o próprio espaçamento medido contra 0,8em, e a tela sairia
 * com proporções diferentes a cada nível de aninhamento. `cqw` é sempre relativo
 * ao container, então não há composição possível.
 *
 * ── Acessibilidade ──────────────────────────────────────────────────────────
 *
 * A moldura (`DeviceFrame`) não leva `role` nem `aria-label` de propósito: o
 * `role="img"` torna a subárvore opaca e apagaria todo o texto de dentro. Aqui
 * a divisão é outra: a CHROME do aparelho (barra de status, cabeçalho, tab bar)
 * é `aria-hidden`, porque é cenário e se repete em toda réplica, e o CONTEÚDO
 * continua legível, porque é ele que demonstra o produto.
 */

/* ────────────────────────────────────────────────────────────────────────────
   A casca
──────────────────────────────────────────────────────────────────────────── */

export function TelaApp({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      // `@container` e não uma regra avulsa em globals.css: um deploy chegou
      // com os `cqw` e sem a regra `.tela-app`, e sem container todo `cqw`
      // cai para a viewport e a tela estoura a moldura. O utilitário sai da
      // mesma varredura que gera os `cqw`, então os dois chegam juntos.
      // `tela-app` fica como gancho do E2E.
      className={cn(
        "tela-app @container absolute inset-0 flex flex-col overflow-hidden bg-[var(--app-bg)] [font-family:var(--font-hanken)] text-[var(--app-text)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A barra de status do sistema. Cenário, logo `aria-hidden`. */
export function BarraDeStatus({ hora = "16:20" }: { hora?: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-between px-[7cqw] pb-[1.5cqw] pt-[3.4cqw] text-[3.4cqw] font-semibold"
    >
      <span>{hora}</span>
      <span className="flex items-center gap-[2cqw]">
        <svg viewBox="0 0 24 24" className="h-[3.6cqw] w-[3.6cqw] fill-current">
          <path d="M12 20l3.5-4.2a4.6 4.6 0 00-7 0L12 20zm0-8.6c2 0 3.9.8 5.3 2.1l1.9-2.3A11 11 0 0012 8.2c-2.8 0-5.4 1.1-7.2 3l1.9 2.3A7.7 7.7 0 0112 11.4zm0-6.2c3.6 0 6.9 1.4 9.3 3.7L23 6.4A15.2 15.2 0 0012 2 15.2 15.2 0 001 6.4l1.7 2.5A13.3 13.3 0 0112 5.2z" />
        </svg>
        <span className="relative flex h-[3.2cqw] w-[6.6cqw] items-center rounded-[1cqw] border border-current px-[0.5cqw]">
          <span className="h-[1.6cqw] w-full rounded-[0.4cqw] bg-current" />
        </span>
      </span>
    </div>
  );
}

/** A marca e o avatar, a chrome do topo de toda aba. */
export function CabecalhoApp({ acao }: { acao?: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-between border-b border-[var(--app-card-border)] px-[5cqw] pb-[3cqw] pt-[2cqw]"
    >
      <MarcaApp />
      <span className="flex items-center gap-[2.4cqw]">
        {acao}
        <span className="flex h-[8cqw] w-[8cqw] items-center justify-center rounded-full bg-[var(--app-element)]">
          <svg
            viewBox="0 0 24 24"
            className="h-[4.6cqw] w-[4.6cqw] stroke-[var(--app-text-muted)]"
            fill="none"
            strokeWidth={1.8}
          >
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5.5 19.5a6.9 6.9 0 0113 0" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    </div>
  );
}

/**
 * A marca da ProOps, no tamanho do aplicativo.
 *
 * O traçado é o de `public/logo/logo2-cropped.svg`, copiado inline para herdar
 * a cor do tema do aplicativo e escalar em `cqw` junto com o resto da tela. Um
 * desenho aproximado aqui lia como outra marca; ao trocar a logo, troque os dois.
 */
function MarcaApp() {
  return (
    <svg
      viewBox="540 250 410 430"
      className="h-[6.6cqw] w-[6.6cqw] fill-[var(--app-text)]"
      aria-hidden="true"
    >
      <g transform="translate(0 900) scale(0.1 -0.1)">
        <path d="M7500 6103 c-485 -52 -935 -337 -1197 -758 -126 -202 -194 -401 -228 -660 -19 -150 -19 -197 1 -360 45 -379 180 -666 444 -947 45 -49 88 -88 96 -88 12 0 14 98 14 658 0 524 3 673 14 738 75 424 425 776 845 849 198 35 428 9 594 -67 l47 -21 0 -220 0 -220 -32 27 c-53 42 -149 94 -219 117 -52 18 -89 22 -199 23 -123 1 -142 -1 -216 -27 -153 -52 -274 -146 -359 -277 -61 -95 -92 -182 -104 -293 -12 -109 -15 -1505 -3 -1524 16 -26 205 -94 363 -131 97 -23 303 -34 438 -23 122 10 152 15 271 43 132 31 338 122 470 206 93 59 245 188 325 275 156 171 259 348 334 572 61 184 76 287 76 510 -1 254 -29 399 -120 620 -56 136 -108 228 -194 342 -62 84 -214 243 -232 243 -4 0 -10 -307 -12 -682 -3 -655 -4 -687 -25 -770 -24 -100 -73 -227 -106 -278 -81 -124 -109 -160 -188 -236 -48 -46 -116 -102 -150 -125 -298 -192 -680 -224 -985 -82 l-53 24 0 210 c0 147 3 209 11 209 6 0 32 -15 58 -34 55 -40 127 -77 201 -102 44 -15 83 -19 200 -18 139 0 148 2 225 32 265 105 435 340 446 617 1 33 1 380 1 772 l-2 712 -47 21 c-124 56 -303 104 -445 119 -92 10 -281 12 -358 4z m317 -1327 c65 -36 94 -66 132 -140 77 -146 13 -335 -139 -414 -62 -32 -69 -34 -150 -29 -102 5 -151 28 -216 100 -52 58 -78 131 -78 214 1 116 91 248 197 287 28 11 68 15 122 13 66 -3 90 -8 132 -31z" />
      </g>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   O painel de destaque
──────────────────────────────────────────────────────────────────────────── */

/**
 * O `HeroPanel` do aplicativo.
 *
 * Três camadas, e as três estão no `design.md` do app: gradiente vertical de
 * `--app-hero-top` para `--app-hero-bottom`, um brilho verde difuso saindo pelo
 * canto superior direito, e um fio especular de 1px no topo. Chapado, ele lia
 * como "retângulo escuro com um número dentro", que foi o diagnóstico registrado
 * lá; a correção é LUZ, não mais contraste.
 */
export function PainelDestaque({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[4.5cqw] bg-[linear-gradient(180deg,var(--app-hero-top),var(--app-hero-bottom))] p-[4.8cqw]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[12cqw] -top-[18cqw] h-[38cqw] w-[38cqw] rounded-full bg-[var(--app-tint)] opacity-[0.16] blur-[10cqw]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/** Um valor em dinheiro, na tipografia do produto: mono e tabular. */
export function Dinheiro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "[font-family:var(--font-jetbrains-mono)] [font-variant-numeric:tabular-nums]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A projeção do mês.
 *
 * Detalhe copiado do produto: a área preenchida por baixo existe porque uma
 * linha de 2px na largura de um card lê como régua, não como gráfico.
 */
export function Sparkline({
  pontos,
  className,
}: {
  /** Série já normalizada em 0..1, do começo ao fim do mês. */
  pontos: number[];
  className?: string;
}) {
  const largura = 100;
  const altura = 32;
  const passo = largura / (pontos.length - 1);
  const coords = pontos.map(
    (valor, i) => [i * passo, altura - valor * altura] as const,
  );
  const linha = coords.map(([x, y]) => `${x},${y.toFixed(2)}`).join(" ");
  const area = `M0,${altura} L${coords
    .map(([x, y]) => `${x},${y.toFixed(2)}`)
    .join(" L")} L${largura},${altura} Z`;
  const ultimo = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      preserveAspectRatio="none"
      className={cn("h-[13cqw] w-full overflow-visible", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkline-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--app-tint)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--app-tint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkline-area)" />
      <polyline
        points={linha}
        fill="none"
        stroke="var(--app-tint)"
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={ultimo[0]}
        cy={ultimo[1]}
        r={2.2}
        fill="var(--app-text)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Listas e faixas
──────────────────────────────────────────────────────────────────────────── */

/**
 * Um atalho com contagem.
 *
 * No produto, tile com zero não aparece, e sem nenhum pendente a faixa inteira
 * some: atalho sem número é botão morto ocupando o espaço mais caro do app. A
 * réplica só mostra os que teriam contagem.
 */
export function Atalho({
  rotulo,
  contagem,
  tom = "aviso",
}: {
  rotulo: string;
  contagem: number;
  tom?: "aviso" | "perigo";
}) {
  return (
    <div className="flex-1 rounded-[3.4cqw] border border-[var(--app-card-border)] bg-[var(--app-surface)] px-[3.4cqw] py-[3cqw]">
      <p className="text-[3.1cqw] leading-tight text-[var(--app-text-muted)]">
        {rotulo}
      </p>
      <Dinheiro
        className={cn(
          "mt-[1.4cqw] block text-[5.2cqw] font-semibold leading-none",
          tom === "perigo"
            ? "text-[var(--app-danger)]"
            : "text-[var(--app-warning)]",
        )}
      >
        {contagem}
      </Dinheiro>
    </div>
  );
}

export function RotuloSecao({
  children,
  direita,
}: {
  children: React.ReactNode;
  direita?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-[3cqw]">
      <p className="text-[3cqw] font-semibold uppercase tracking-[0.16em] text-[var(--app-text-muted)]">
        {children}
      </p>
      {direita ? (
        <p className="shrink-0 text-[3cqw] text-[var(--app-text-muted)]">
          {direita}
        </p>
      ) : null}
    </div>
  );
}

/** Uma pendência: o que vence, quando venceu e quanto. */
export function LinhaPendencia({
  titulo,
  venceu,
  valor,
  acao,
  className,
  style,
}: {
  titulo: string;
  venceu: string;
  valor: string;
  acao?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article
      className={cn(
        "flex items-center justify-between gap-[3cqw] rounded-[3.4cqw] border border-[var(--app-card-border)] bg-[var(--app-surface)] px-[4cqw] py-[3.4cqw]",
        className,
      )}
      style={style}
    >
      <div className="min-w-0">
        <p className="truncate text-[3.9cqw] font-medium leading-tight">
          {titulo}
        </p>
        <p className="mt-[1.6cqw] inline-block rounded-full bg-[var(--app-danger)]/15 px-[2cqw] py-[0.6cqw] text-[2.9cqw] text-[var(--app-danger)]">
          {venceu}
        </p>
        <Dinheiro className="mt-[1.6cqw] block text-[4.2cqw] font-semibold text-[var(--app-danger)]">
          {valor}
        </Dinheiro>
      </div>
      {acao ? (
        <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--app-separator)] px-[3.4cqw] py-[2cqw] text-[3.2cqw]">
          {acao}
        </span>
      ) : null}
    </article>
  );
}

/** Um lançamento já registrado, como a lista do Financeiro o mostra. */
export function LinhaLancamento({
  titulo,
  meta,
  valor,
  className,
  style,
}: {
  titulo: string;
  meta: string;
  valor: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article
      className={cn(
        "flex items-center justify-between gap-[3cqw] rounded-[3.4cqw] border border-[var(--app-card-border)] bg-[var(--app-surface)] px-[4cqw] py-[3.2cqw]",
        className,
      )}
      style={style}
    >
      <div className="min-w-0">
        <p className="truncate text-[3.9cqw] font-medium leading-tight">
          {titulo}
        </p>
        <p className="mt-[1.2cqw] truncate text-[3.1cqw] text-[var(--app-text-muted)]">
          {meta}
        </p>
      </div>
      <Dinheiro className="shrink-0 text-[4cqw] font-semibold">{valor}</Dinheiro>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   A tab bar
──────────────────────────────────────────────────────────────────────────── */

export type Aba = "hoje" | "notas" | "financeiro" | "agente" | "perfil";

const ABAS: ReadonlyArray<{ id: Aba; rotulo: string; icone: React.ReactNode }> =
  [
    {
      id: "hoje",
      rotulo: "Hoje",
      icone: (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ),
    },
    {
      id: "notas",
      rotulo: "Notas",
      icone: (
        <>
          <rect x="4" y="3.5" width="16" height="17" rx="2.4" />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </>
      ),
    },
    {
      id: "financeiro",
      rotulo: "Financeiro",
      icone: (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 3.5v8.5h8.5" />
        </>
      ),
    },
    {
      id: "agente",
      rotulo: "Agente",
      icone: (
        <>
          <rect x="2.5" y="5" width="13" height="10" rx="2.2" />
          <path d="M8.5 19h10a2 2 0 002-2v-6" />
        </>
      ),
    },
    {
      id: "perfil",
      rotulo: "Perfil",
      icone: (
        <>
          <circle cx="12" cy="8.5" r="3.4" />
          <path d="M5.5 19.5a6.8 6.8 0 0113 0" />
        </>
      ),
    },
  ];

/**
 * A tab bar do aplicativo, em cápsula flutuante.
 *
 * Cenário, logo `aria-hidden`: ela não navega nada aqui, e os cinco rótulos
 * lidos em voz alta antes do conteúdo de cada tela seriam ruído repetido em
 * todas as réplicas da página.
 */
export function TabBar({ ativa }: { ativa: Aba }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[4cqw] bottom-[3cqw] flex items-center justify-between rounded-full border border-white/10 bg-[#1e1e20]/85 px-[2.6cqw] py-[2.4cqw] backdrop-blur-[2cqw]"
    >
      {ABAS.map((aba) => {
        const acesa = aba.id === ativa;
        return (
          <span
            key={aba.id}
            className={cn(
              "flex flex-col items-center gap-[1.2cqw] rounded-full px-[2cqw] py-[1.2cqw]",
              acesa && "bg-white/[0.07]",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth={1.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "h-[5cqw] w-[5cqw]",
                acesa
                  ? "stroke-[var(--app-tint)]"
                  : "stroke-[var(--app-text-muted)]",
              )}
            >
              {aba.icone}
            </svg>
            <span
              className={cn(
                "text-[2.6cqw] leading-none",
                acesa
                  ? "text-[var(--app-tint)]"
                  : "text-[var(--app-text-muted)]",
              )}
            >
              {aba.rotulo}
            </span>
          </span>
        );
      })}
    </div>
  );
}
