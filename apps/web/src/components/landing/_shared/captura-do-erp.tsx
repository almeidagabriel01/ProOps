import React from "react";
import Image from "next/image";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import type { Captura } from "@/lib/landing/capturas";
import { cn } from "@/lib/utils";

interface CapturaDoErpProps {
  captura: Captura;
  /** Largura em que a imagem aparece, no formato do `sizes` do `<img>`. */
  sizes: string;
  /** O print que é o maior elemento da primeira dobra: carrega na frente. */
  prioridade?: boolean;
  className?: string;
}

/**
 * Um print de verdade do ERP (`lib/landing/capturas.ts`) na moldura em que ele
 * foi tirado: a tela de desktop numa janela de navegador, a de celular num
 * aparelho. É a imagem, com o `alt` dela, que carrega o conteúdo; as molduras
 * são decoração e não têm papel nenhum para o leitor de tela.
 */
export function CapturaDoErp({ captura, sizes, prioridade, className }: CapturaDoErpProps) {
  const carregamento = prioridade ? ({ loading: "eager", fetchPriority: "high" } as const) : {};

  if (captura.formato === "celular") {
    return (
      <DeviceFrame className={cn("mx-auto w-[min(100%,300px)]", className)}>
        {/* A faixa de cima é a barra de status: sem ela o entalhe do aparelho
            cobriria o cabeçalho da página no print. */}
        <div className="absolute inset-0 flex flex-col bg-white">
          <div aria-hidden="true" className="h-[5%] shrink-0" />
          <div className="relative min-h-0 flex-1">
            <Image
              src={captura.src}
              alt={captura.alt}
              fill
              sizes="300px"
              className="object-cover object-top"
              {...carregamento}
            />
          </div>
        </div>
      </DeviceFrame>
    );
  }

  return (
    <MolduraNavegador
      tom="tema"
      className={cn(
        "shadow-[0_24px_60px_-32px_rgba(0,0,0,0.28)] dark:shadow-[0_40px_110px_-40px_rgba(0,0,0,0.85)]",
        className,
      )}
    >
      <Image
        src={captura.src}
        alt={captura.alt}
        width={captura.largura}
        height={captura.altura}
        sizes={sizes}
        className="block h-auto w-full"
        {...carregamento}
      />
    </MolduraNavegador>
  );
}
