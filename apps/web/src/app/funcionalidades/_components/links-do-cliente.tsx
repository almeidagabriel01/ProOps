"use client";

import React, { useId, useRef, useState } from "react";
import { CalendarClock, Calculator, FileSignature, HardHat, LayoutDashboard, QrCode } from "lucide-react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { HidratarPerto } from "@/components/marketing/_shared/hidratar-perto";
import { PauseOffscreen } from "@/components/marketing/_shared/pause-offscreen";
import type { EtapaDemo } from "@/components/marketing/mocks/dados";
import {
  TelaAgendamento,
  TelaContador,
  TelaEntregaObra,
  TelaPortal,
  TelaPropostaLink,
  TelaRecibo,
} from "@/components/marketing/mocks/telas/telas-do-cliente";
import { cn } from "@/lib/utils";

interface LinksDoClienteProps {
  etapas: readonly EtapaDemo[];
  tipoDeVisita: string;
}

type Link = {
  id: string;
  rotulo: string;
  frase: string;
  icone: React.ComponentType<{ className?: string }>;
  tela: React.ReactNode;
};

/**
 * Os seis links que a empresa manda, num celular só. As abas avançam sozinhas
 * enquanto a seção está na tela, e o relógio delas é a própria animação de CSS
 * da barra de progresso (`onAnimationEnd` troca a aba): pausar a barra, pelo
 * hover, pela `.anim-paused` fora da tela ou pelo movimento reduzido, pausa o
 * carrossel junto, sem um `setInterval` para manter em sincronia. Um clique ou
 * uma seta do teclado assumem o controle e o avanço automático para.
 */
function Carrossel({ etapas, tipoDeVisita }: LinksDoClienteProps) {
  const links: Link[] = [
    { id: "proposta", rotulo: "Proposta", frase: "Ver, pedir mudanças e aceitar", icone: FileSignature, tela: <TelaPropostaLink /> },
    { id: "recibo", rotulo: "Parcela", frase: "Recibo, Pix e boleto", icone: QrCode, tela: <TelaRecibo /> },
    { id: "obra", rotulo: "Obra", frase: "Etapas, fotos e aceite da entrega", icone: HardHat, tela: <TelaEntregaObra etapas={etapas} /> },
    { id: "agenda", rotulo: "Agendamento", frase: "O cliente escolhe o horário", icone: CalendarClock, tela: <TelaAgendamento tipoDeVisita={tipoDeVisita} /> },
    { id: "portal", rotulo: "Portal", frase: "Tudo do cliente num link fixo", icone: LayoutDashboard, tela: <TelaPortal /> },
    { id: "contador", rotulo: "Contador", frase: "DRE e notas, sem login", icone: Calculator, tela: <TelaContador /> },
  ];
  const [ativo, setAtivo] = useState(0);
  const [automatico, setAutomatico] = useState(true);
  const base = useId();
  const abas = useRef<(HTMLButtonElement | null)[]>([]);

  const escolher = (i: number, foco = false) => {
    setAutomatico(false);
    setAtivo(i);
    if (foco) abas.current[i]?.focus();
  };

  const teclado = (event: React.KeyboardEvent) => {
    const passo = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!passo) return;
    event.preventDefault();
    escolher((ativo + passo + links.length) % links.length, true);
  };

  return (
    <PauseOffscreen className="links-cliente grid items-center gap-10 rounded-3xl border border-black/10 bg-black/[0.02] p-6 dark:border-white/10 dark:bg-white/[0.03] sm:p-10 md:grid-cols-[1fr_0.85fr] lg:gap-14">
      <div>
        <p className="[font-family:var(--font-pdf-montserrat)] text-xl font-bold tracking-[-0.01em] text-black dark:text-white md:text-2xl">
          O que o seu cliente abre no celular
        </p>
        <div role="tablist" aria-label="Links do cliente" onKeyDown={teclado} className="mt-6 grid gap-1.5">
          {links.map((link, i) => {
            const Icone = link.icone;
            const selecionado = i === ativo;
            return (
              <button
                key={link.id}
                ref={(el) => {
                  abas.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${base}-aba-${link.id}`}
                aria-selected={selecionado}
                aria-controls={`${base}-tela`}
                tabIndex={selecionado ? 0 : -1}
                onClick={() => escolher(i)}
                className={cn(
                  "group/aba relative flex items-center gap-3.5 overflow-hidden rounded-xl px-3.5 py-3 text-left transition-colors duration-200",
                  selecionado ? "bg-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.3)] dark:bg-neutral-900" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                    selecionado ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/[0.05] text-black/60 dark:bg-white/[0.07] dark:text-white/60",
                  )}
                >
                  <Icone className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-[15px] font-semibold", selecionado ? "text-black dark:text-white" : "text-black/70 dark:text-white/70")}>
                    {link.rotulo}
                  </span>
                  <span className="block truncate text-[13px] text-black/50 dark:text-white/50">{link.frase}</span>
                </span>
                {selecionado ? (
                  <span
                    aria-hidden="true"
                    key={`${ativo}-${automatico}`}
                    onAnimationEnd={() => automatico && setAtivo((ativo + 1) % links.length)}
                    className={cn(
                      "links-progresso absolute bottom-0 left-0 h-[2px] w-full origin-left bg-black dark:bg-white",
                      !automatico && "links-progresso-parado",
                    )}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <DeviceFrame className="w-[min(72vw,270px)]">
          <div id={`${base}-tela`} role="tabpanel" aria-labelledby={`${base}-aba-${links[ativo].id}`} className="absolute inset-0">
            {links.map((link, i) => (
              <div key={link.id} data-ativo={i === ativo ? "" : undefined} className="links-tela absolute inset-0">
                {link.tela}
              </div>
            ))}
          </div>
        </DeviceFrame>
      </div>
    </PauseOffscreen>
  );
}

export function LinksDoCliente(props: LinksDoClienteProps) {
  return (
    <HidratarPerto>
      <Carrossel {...props} />
    </HidratarPerto>
  );
}
