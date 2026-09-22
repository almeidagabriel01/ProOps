import React from "react";
import Image from "next/image";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";
import { MolduraNavegador } from "@/components/marketing/_shared/moldura-navegador";
import { APP_NAME } from "@/lib/site/app-brand";
import { hostnameDe } from "@/lib/site/surfaces";

/**
 * A cena do herói de /produtos: "dois produtos, uma ideia só", mostrado em vez
 * de dito.
 *
 * Uma placa só aparece primeiro, e dela saem os dois aparelhos: a janela do ERP
 * e o telefone do aplicativo, cada um com uma captura real do que está no ar.
 * Depois, um fio de luz liga os dois, e uma gota percorre o fio de tempos em
 * tempos. É a tese da página, em ordem: a base vem antes, os produtos saem
 * dela, e a mesma informação corre entre os dois.
 *
 * Componente de servidor, sem JavaScript. A entrada é CSS (`.aparelhos-*` no
 * globals.css) e anima as propriedades INDIVIDUAIS `translate`, `rotate` e
 * `scale`, que compõem com o `transform` da inclinação por ponteiro
 * (`.inclina-ponteiro`, num elemento de dentro) em vez de brigar com ele. Sob
 * movimento reduzido, tudo repousa no quadro final: os dois aparelhos
 * separados, o fio desenhado e a gota parada.
 *
 * As capturas não têm `priority`: o LCP desta página é o título, e duas imagens
 * brigando por banda na primeira dobra atrasariam justamente ele.
 */
export function HeroiAparelhos() {
  return (
    <div
      aria-hidden="true"
      className="aparelhos relative mx-auto aspect-[6/5] w-full max-w-[36rem] [perspective:1600px]"
    >
      {/* A placa de onde os dois saem. */}
      <div className="aparelhos-placa absolute inset-[18%_20%_22%_14%] rounded-[1.75rem] border border-white/15 bg-[radial-gradient(120%_120%_at_30%_20%,rgb(var(--linha)/0.16),transparent_60%)]" />

      <svg
        viewBox="0 0 600 500"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        fill="none"
      >
        <path
          className="aparelhos-fio traco-desenha"
          pathLength={1}
          d="M330 258C330 350 380 382 446 382"
          stroke="rgb(var(--linha) / 0.5)"
          strokeWidth="1.2"
          style={{ "--traco-delay": "1.35s", "--traco-dur": "0.9s" } as React.CSSProperties}
        />
        <path
          className="aparelhos-gota"
          pathLength={1}
          d="M330 258C330 350 380 382 446 382"
          stroke="rgb(var(--tungstenio))"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>

      <figure className="aparelhos-janela absolute left-0 top-[4%] w-[68%]">
        <div className="inclina-ponteiro" style={{ "--inclina": "4deg" } as React.CSSProperties}>
          <MolduraNavegador tom="escuro" endereco={hostnameDe("erp")}>
            <div className="relative aspect-[1920/944]">
              <Image
                src="/hero/Kanban.png"
                alt=""
                fill
                sizes="(min-width: 1024px) 26rem, 70vw"
                className="object-cover object-left-top"
              />
            </div>
          </MolduraNavegador>
        </div>
        <figcaption className="mt-3 text-sm text-white/50">ERP, na tela do escritório</figcaption>
      </figure>

      <figure className="aparelhos-telefone absolute bottom-0 right-[1%] w-[24%]">
        <div className="inclina-ponteiro" style={{ "--inclina": "7deg" } as React.CSSProperties}>
          <DeviceFrame platform="ios">
            <Image
              src="/mockup-ios/financeiro.jpg"
              alt=""
              fill
              sizes="(min-width: 1024px) 10rem, 27vw"
              className="object-cover"
            />
          </DeviceFrame>
        </div>
        <figcaption className="mt-3 text-sm text-white/50">{APP_NAME}, no bolso</figcaption>
      </figure>
    </div>
  );
}
