"use client";

import React, { useRef } from "react";
import gsap from "gsap";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { useScrollScene } from "@/components/marketing/_shared/use-scroll-scene";
import { CLIENTE_DEMO, CODIGO_DEMO, TOTAL_DEMO, type EtapaDemo } from "@/components/marketing/mocks/dados";
import { JanelaDoErp } from "@/components/marketing/mocks/janela-do-erp";
import {
  TelaContador,
  TelaEntregaObra,
  TelaPropostaLink,
  TelaRecibo,
} from "@/components/marketing/mocks/telas/telas-do-cliente";
import {
  TelaDocumento,
  TelaLeads,
  TelaNotaFiscal,
  TelaObraInterna,
} from "@/components/marketing/mocks/telas/telas-do-erp";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

type TelaDoErp = "leads" | "documento" | "obra" | "nota";
type TelaDoCliente = "proposta" | "obra" | "recibo" | "contador";

interface Passo {
  titulo: string;
  frase: string;
  status: string;
  erp: TelaDoErp;
  /** `null`: o celular ainda não entrou na história. */
  cliente: TelaDoCliente | null;
  /** Qual dos dois aparelhos está falando neste passo. */
  foco: "erp" | "cliente";
}

/**
 * A mesma venda, do lead ao contador. Sete passos, uma proposta só: o código e
 * o valor na ficha do canto não mudam, e é esse o argumento (uma base, não
 * sete sistemas).
 */
const PASSOS: readonly Passo[] = [
  {
    titulo: "O contato vira lead",
    frase: "Chegou pelo Instagram, por indicação ou pelo arquiteto: entra no funil com valor estimado e o próximo passo marcado.",
    status: "Lead qualificado",
    erp: "leads",
    cliente: null,
    foco: "erp",
  },
  {
    titulo: "A proposta sai numerada",
    frase: "Itens por local, entrada e parcelas, e o PDF com a sua marca. O código da proposta também dá nome ao arquivo.",
    status: "Proposta enviada",
    erp: "documento",
    cliente: null,
    foco: "erp",
  },
  {
    titulo: "O cliente aceita pelo link",
    frase: "No celular, com nome e CPF. Se quiser mudar algo, ele pede ali mesmo, com o motivo escrito, e você é avisado.",
    status: "Aceita pelo link",
    erp: "documento",
    cliente: "proposta",
    foco: "cliente",
  },
  {
    titulo: "A venda vira obra",
    frase: "As etapas do seu segmento já montadas, com checklist, fotos e a visita marcada na agenda do técnico.",
    status: "Em obra",
    erp: "obra",
    cliente: "obra",
    foco: "erp",
  },
  {
    titulo: "A parcela é paga no Pix",
    frase: "O link da parcela traz o QR code e o boleto. Pagou, a baixa entra sozinha no financeiro.",
    status: "Parcela 2 paga",
    erp: "obra",
    cliente: "recibo",
    foco: "cliente",
  },
  {
    titulo: "A nota sai da proposta",
    frase: "NF-e ou NFS-e com os itens que o cliente aprovou, sem digitar de novo. PDF e XML ficam guardados.",
    status: "NF-e autorizada",
    erp: "nota",
    cliente: "recibo",
    foco: "erp",
  },
  {
    titulo: "O contador já tem tudo",
    frase: "DRE, lançamentos e notas num link só dele, sem login e sem ocupar um usuário da equipe.",
    status: "No DRE do contador",
    erp: "nota",
    cliente: "contador",
    foco: "cliente",
  },
];

const TELAS_DO_ERP: TelaDoErp[] = ["leads", "documento", "obra", "nota"];
const TELAS_DO_CLIENTE: TelaDoCliente[] = ["proposta", "obra", "recibo", "contador"];

function TelaErp({ tela, etapas }: { tela: TelaDoErp; etapas: readonly EtapaDemo[] }) {
  switch (tela) {
    case "leads":
      return <TelaLeads />;
    case "documento":
      return <TelaDocumento />;
    case "obra":
      return <TelaObraInterna etapas={etapas} />;
    case "nota":
      return <TelaNotaFiscal />;
  }
}

function TelaCliente({ tela, etapas }: { tela: TelaDoCliente; etapas: readonly EtapaDemo[] }) {
  switch (tela) {
    case "proposta":
      return <TelaPropostaLink />;
    case "obra":
      return <TelaEntregaObra etapas={etapas} />;
    case "recibo":
      return <TelaRecibo />;
    case "contador":
      return <TelaContador />;
  }
}

/** A ficha da venda: o objeto que atravessa a história inteira. */
function FichaDaVenda({ estatico, passo }: { estatico?: boolean; passo?: number }) {
  return (
    <div
      data-ficha=""
      className="w-[15.5rem] rounded-2xl border border-black/10 bg-white/95 p-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)] dark:border-white/12 dark:bg-neutral-900/95"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45 dark:text-white/45">
        <span className="tabular-nums">{CODIGO_DEMO}</span>
        <span>{CLIENTE_DEMO}</span>
      </div>
      <div className="mt-1 [font-family:var(--font-pdf-montserrat)] text-2xl font-bold tabular-nums tracking-[-0.02em] text-black dark:text-white">
        {formatCurrency(TOTAL_DEMO)}
      </div>
      <div className="relative mt-2 h-5 text-sm font-semibold text-black dark:text-white">
        {estatico ? (
          <span>{PASSOS[passo ?? 0].status}</span>
        ) : (
          PASSOS.map((p, i) => (
            <span key={p.status} data-status={i} className={cn("absolute inset-0", i > 0 && "invisible opacity-0")}>
              {p.status}
            </span>
          ))
        )}
      </div>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {PASSOS.map((p, i) => (
          <span key={p.status} className="h-1 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/12">
            <span
              data-segmento={i}
              className={cn(
                "block h-full w-full origin-left rounded-full bg-black dark:bg-white",
                estatico ? (i <= (passo ?? 0) ? "" : "scale-x-0") : i > 0 && "scale-x-0",
              )}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * O palco animado (desktop, movimento permitido). Dois aparelhos: o ERP, que a
 * empresa usa, e o celular, que é o que o cliente e o contador veem. A rolagem
 * troca a tela de cada um, passa o foco de um para o outro e anda a ficha.
 */
function PalcoAnimado({ etapas }: { etapas: readonly EtapaDemo[] }) {
  const escopo = useRef<HTMLDivElement>(null);

  useScrollScene(escopo, () => {
    const raiz = escopo.current;
    if (!raiz) return;
    const q = gsap.utils.selector(raiz);
    const passosDoTrilho = q<HTMLElement>("[data-passo]");
    let atual = -1;

    const tl = gsap.timeline({
      defaults: { ease: "power2.inOut", duration: 0.5 },
      scrollTrigger: {
        trigger: raiz,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
      // O trilho segue o TEMPO da timeline, e não o progresso da rolagem: com o
      // scrub, o palco chega ao passo meio segundo depois do dedo, e um trilho
      // lido da rolagem ficava à frente (ou, num salto, preso no passo antigo).
      // Cada passo entra em `i - 0,5`, então o passo corrente é o arredondado.
      onUpdate: () => {
        const indice = Math.min(PASSOS.length - 1, Math.max(0, Math.round(tl.time())));
        if (indice === atual) return;
        atual = indice;
        passosDoTrilho.forEach((el, i) => {
          el.toggleAttribute("data-atual", i === indice);
          el.toggleAttribute("data-feito", i < indice);
        });
      },
    });

    // Estado inicial explícito: a timeline é reversível do começo ao fim.
    tl.set(q("[data-celular]"), { autoAlpha: 0, y: 60, rotate: 4 }, 0);

    PASSOS.forEach((passo, i) => {
      if (i === 0) return;
      const anterior = PASSOS[i - 1];
      const t = i - 0.5;

      if (passo.erp !== anterior.erp) {
        tl.to(q(`[data-tela-erp="${anterior.erp}"]`), { autoAlpha: 0, y: -16, filter: "blur(4px)" }, t);
        tl.fromTo(
          q(`[data-tela-erp="${passo.erp}"]`),
          { autoAlpha: 0, y: 22, filter: "blur(4px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", immediateRender: false },
          t + 0.08,
        );
      }

      if (passo.cliente && passo.cliente !== anterior.cliente) {
        if (!anterior.cliente) {
          tl.to(q("[data-celular]"), { autoAlpha: 1, y: 0, rotate: 0, duration: 0.6, ease: "expo.out" }, t);
        } else {
          tl.to(q(`[data-tela-cliente="${anterior.cliente}"]`), { autoAlpha: 0, scale: 0.96 }, t);
        }
        tl.fromTo(
          q(`[data-tela-cliente="${passo.cliente}"]`),
          { autoAlpha: 0, scale: 1.04 },
          { autoAlpha: 1, scale: 1, immediateRender: false },
          t + 0.1,
        );
      }

      // Foco: o aparelho que fala fica inteiro, o outro recua.
      tl.to(
        q("[data-aparelho-erp]"),
        { opacity: passo.foco === "erp" ? 1 : 0.42, scale: passo.foco === "erp" ? 1 : 0.975 },
        t,
      );
      tl.to(q("[data-celular]"), { scale: passo.foco === "cliente" ? 1.04 : 0.97 }, t);

      tl.to(q(`[data-status="${i - 1}"]`), { autoAlpha: 0, y: -8, duration: 0.3 }, t);
      tl.fromTo(
        q(`[data-status="${i}"]`),
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.3, immediateRender: false },
        t + 0.15,
      );
      tl.fromTo(q(`[data-segmento="${i}"]`), { scaleX: 0 }, { scaleX: 1, immediateRender: false }, t);
    });

    // Os detalhes que tornam cada passo verdadeiro, dentro da própria tela.
    // Estes aplicam o estado inicial na montagem (o padrão do fromTo): as telas
    // deles ainda estão escondidas, e sem isso a assinatura apareceria pronta
    // por um instante antes de se desenhar.
    const assinatura = q('[data-tela-cliente="proposta"] [data-mk="assinatura"]');
    tl.fromTo(assinatura, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.45, ease: "none" }, 1.75);
    tl.fromTo(
      q('[data-tela-cliente="proposta"] [data-mk="aceitar"]'),
      { scale: 1 },
      { scale: 0.94, yoyo: true, repeat: 1, duration: 0.12 },
      2.25,
    );
    tl.fromTo(
      q('[data-tela-erp="obra"] [data-mk="etapa"] > span:first-child'),
      { scaleX: 0 },
      { scaleX: 1, stagger: 0.08, duration: 0.3 },
      2.7,
    );
    tl.to(q('[data-tela-cliente="recibo"] [data-mk="status-aberto"]'), { autoAlpha: 0, duration: 0.2 }, 4.1);
    tl.fromTo(
      q('[data-tela-cliente="recibo"] [data-mk="status-pago"]'),
      { autoAlpha: 0, scale: 0.8 },
      { autoAlpha: 1, scale: 1, duration: 0.3, ease: "expo.out" },
      4.15,
    );
    tl.fromTo(
      q('[data-tela-erp="nota"] [data-mk="carimbo"]'),
      { autoAlpha: 0, scale: 1.8, rotate: -18 },
      { autoAlpha: 1, scale: 1, rotate: -6, duration: 0.35, ease: "expo.out" },
      5.1,
    );
    tl.to({}, { duration: 0.5 }, PASSOS.length - 0.5);
  });

  return (
    <div ref={escopo} className="relative" style={{ height: `${PASSOS.length * 80}vh` }}>
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-[0.78fr_1.22fr] items-center gap-14 px-6">
          <ol className="relative">
            <span aria-hidden="true" className="absolute bottom-3 left-[6px] top-3 w-[2px] rounded-full bg-black/12 dark:bg-white/15" />
            {PASSOS.map((passo, i) => (
              <li key={passo.titulo} data-passo={i} {...(i === 0 ? { "data-atual": "" } : {})} className="jornada-passo relative py-2.5 pl-8">
                <span aria-hidden="true" className="jornada-ponto absolute left-0 top-[17px] h-[14px] w-[14px] rounded-full border-2 border-black/25 bg-white dark:border-white/30 dark:bg-neutral-950" />
                <p className="jornada-titulo text-[17px] font-semibold text-black/35 dark:text-white/35">{passo.titulo}</p>
                <div className="jornada-frase">
                  <p className="max-w-sm text-[15px] leading-relaxed text-black/60 dark:text-white/60">{passo.frase}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="relative aspect-[16/11.5]">
            <div data-aparelho-erp="" className="absolute left-0 top-0 w-[84%] origin-top-left">
              <JanelaDoErp>
                {TELAS_DO_ERP.map((tela, i) => (
                  <div key={tela} data-tela-erp={tela} className={cn("absolute inset-0", i > 0 && "invisible opacity-0")}>
                    <TelaErp tela={tela} etapas={etapas} />
                  </div>
                ))}
              </JanelaDoErp>
            </div>

            <div data-celular="" className="absolute bottom-[-4%] right-0 w-[30%] origin-bottom-right">
              <DeviceFrame>
                {TELAS_DO_CLIENTE.map((tela, i) => (
                  <div key={tela} data-tela-cliente={tela} className={cn("absolute inset-0", i > 0 && "invisible opacity-0")}>
                    <TelaCliente tela={tela} etapas={etapas} />
                  </div>
                ))}
              </DeviceFrame>
            </div>

            <div className="absolute bottom-[-8%] left-[-6%]">
              <FichaDaVenda />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A versão parada: celular, ou quem pediu menos movimento. Cada passo com a
 * própria tela, um embaixo do outro, e nenhum JavaScript de cena.
 */
function JornadaEstatica({ etapas }: { etapas: readonly EtapaDemo[] }) {
  return (
    <ol className="mx-auto flex max-w-xl flex-col gap-16 px-4 sm:px-6">
      {PASSOS.map((passo, i) => {
        const celular = passo.foco === "cliente" && passo.cliente;
        return (
          <li key={passo.titulo} className="vt-revela">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40">
              {i + 1} de {PASSOS.length}
            </p>
            <h3 className="mt-1 [font-family:var(--font-pdf-montserrat)] text-2xl font-bold tracking-[-0.02em] text-black dark:text-white">
              {passo.titulo}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-black/60 dark:text-white/60">{passo.frase}</p>
            <div className="mt-6">
              {celular ? (
                <DeviceFrame className="mx-auto w-[62%] max-w-[260px]">
                  <div className="absolute inset-0">
                    <TelaCliente tela={passo.cliente!} etapas={etapas} />
                  </div>
                </DeviceFrame>
              ) : (
                <JanelaDoErp proporcao="16 / 11">
                  <TelaErp tela={passo.erp} etapas={etapas} />
                </JanelaDoErp>
              )}
            </div>
          </li>
        );
      })}
      <li className="flex justify-center">
        <FichaDaVenda estatico passo={PASSOS.length - 1} />
      </li>
    </ol>
  );
}

interface JornadaDaVendaProps {
  /** Etapas da obra de exemplo, do modelo real de um nicho. */
  etapas: readonly EtapaDemo[];
}

/**
 * As duas versões vão no HTML e o CSS escolhe (`md:motion-safe`), a regra da
 * casa: decidir por `useReducedMotion` na renderização quebraria a hidratação
 * (ver `tests/e2e/landing/landing-hidratacao.spec.ts`). Só o palco animado
 * espera a proximidade da tela para hidratar.
 */
export function JornadaDaVenda({ etapas }: JornadaDaVendaProps) {
  return (
    <>
      <div data-jornada-versao="animada" className="hidden md:motion-safe:block">
        <HidratarPerto>
          <PalcoAnimado etapas={etapas} />
        </HidratarPerto>
      </div>
      <div data-jornada-versao="estatica" className="md:motion-safe:hidden">
        <JornadaEstatica etapas={etapas} />
      </div>
    </>
  );
}
