import React from "react";

import { cn } from "@/lib/utils";

import { EMPRESA_DEMO } from "../dados";

/**
 * O topo de toda página pública que a empresa manda ao cliente: a marca da
 * empresa (não a da ProOps, que nesses links fica em segundo plano) e o nome
 * da página. O quadrado com a inicial está no lugar do logo que cada empresa
 * sobe nas configurações.
 */
export function TopoDoLink({ pagina, className }: { pagina: string; className?: string }) {
  return (
    <div
      data-mk="topo"
      className={cn("mk-gap-2 mk-px-4 mk-py-3 flex shrink-0 items-center border-b mk-linha", className)}
    >
      <span className="mk-size-6 mk-rounded-1.5 mk-t-2 mk-fundo-acento grid shrink-0 place-items-center font-bold">
        {EMPRESA_DEMO[0]}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="mk-t-2 block truncate font-bold">{EMPRESA_DEMO}</span>
        <span className="mk-t-1 mk-suave block truncate">{pagina}</span>
      </span>
    </div>
  );
}

/** A barra de status de um celular, cenário e nada mais. */
export function BarraDoCelular() {
  return (
    <div className="mk-px-5 mk-t-1 flex shrink-0 items-center justify-between pb-[calc(var(--u)*0.5)] pt-[calc(var(--u)*3)] font-semibold">
      <span>09:41</span>
      <span className="mk-gap-1 flex items-center">
        <span className="mk-w-3 mk-h-1.5 mk-rounded-0.5 block border border-current" />
      </span>
    </div>
  );
}

/** O ERP por dentro: a barra lateral e o cabeçalho, em tamanho de réplica. */
export function CascaDoErp({
  ativo,
  titulo,
  children,
  acoes,
}: {
  ativo: string;
  titulo: string;
  children: React.ReactNode;
  acoes?: React.ReactNode;
}) {
  const itens = ["Painel", "CRM", "Contatos", "Propostas", "Produtos", "Obras", "Agenda", "Financeiro", "Notas"];
  return (
    <div className="flex h-full min-h-0 flex-1">
      <nav className="mk-w-16 mk-gap-0.5 mk-p-1.5 flex shrink-0 flex-col border-r mk-linha mk-sup">
        <span className="mk-t-2 mk-px-1.5 mk-py-1 mb-[calc(var(--u)*1)] font-bold">ProOps</span>
        {itens.map((item) => (
          <span
            key={item}
            className={cn(
              "mk-t-1 mk-px-1.5 mk-py-1 mk-rounded-1 truncate",
              item === ativo ? "bg-[var(--mk-bg)] font-semibold shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "mk-suave",
            )}
          >
            {item}
          </span>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mk-px-3 mk-py-2 flex shrink-0 items-center justify-between border-b mk-linha">
          <span className="mk-t-3 font-bold">{titulo}</span>
          {acoes}
        </div>
        <div className="mk-p-3 min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
