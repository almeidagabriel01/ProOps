import React from "react";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import { srcSetDaCaptura, type Captura } from "@/lib/landing/capturas";
import { cn } from "@/lib/utils";

interface ImagemDaCapturaProps {
  captura: Captura;
  /** Largura em que a imagem aparece, no formato do `sizes` do `<img>`. */
  sizes: string;
  /** O print que é o maior elemento da primeira dobra: carrega na frente. */
  prioridade?: boolean;
  /** Dentro de um card cujo link já diz o que é: a imagem não repete o texto. */
  decorativa?: boolean;
  className?: string;
}

/**
 * O `<img>` de um print, com as larguras pré-geradas em `srcset`. É `<img>` e
 * não `next/image` de propósito: o otimizador do Next 16.3.4 prende uma imagem
 * para sempre quando dois pedidos iguais chegam juntos e o primeiro desiste (ver
 * `LARGURAS_DAS_CAPTURAS`). Os arquivos já saem do tamanho certo, em WebP.
 */
export function ImagemDaCaptura({ captura, sizes, prioridade, decorativa, className }: ImagemDaCapturaProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- as larguras são pré-geradas; ver o comentário acima.
    <img
      src={captura.src}
      srcSet={srcSetDaCaptura(captura)}
      sizes={sizes}
      width={captura.largura}
      height={captura.altura}
      alt={decorativa ? "" : captura.alt}
      loading={prioridade ? "eager" : "lazy"}
      fetchPriority={prioridade ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

interface CapturaDoErpProps {
  captura: Captura;
  sizes: string;
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
  if (captura.formato === "celular") {
    return (
      <DeviceFrame className={cn("mx-auto w-[min(100%,300px)]", className)}>
        {/* A faixa de cima é a barra de status: sem ela o entalhe do aparelho
            cobriria o cabeçalho da página no print. */}
        <div className="absolute inset-0 flex flex-col bg-white">
          <div aria-hidden="true" className="h-[5%] shrink-0" />
          <div className="relative min-h-0 flex-1">
            <ImagemDaCaptura
              captura={captura}
              sizes="300px"
              prioridade={prioridade}
              className="absolute inset-0 h-full w-full object-cover object-top"
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
      <ImagemDaCaptura captura={captura} sizes={sizes} prioridade={prioridade} className="block h-auto w-full" />
    </MolduraNavegador>
  );
}
