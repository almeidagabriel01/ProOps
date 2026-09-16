import Image from "next/image";

import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "@/components/marketing/_shared/device-frame";

/**
 * A tela inicial do aplicativo no herói, como captura.
 *
 * Já foi a réplica em DOM (`telas/tela-hoje.tsx`, com `animada`). Ela anima por
 * dentro, mas no herói a comparação é direta com o produto, e ali qualquer
 * diferença de fonte, espaçamento ou ícone lê como "não é o aplicativo de
 * verdade". A captura é fiel por definição. As réplicas continuam nas cenas
 * mais abaixo, onde o que importa é a tela mudar com o scroll.
 *
 * Também não leva cartão animado por cima: isso foi tentado e caía em cima de um
 * cartão que já existe na imagem. Server Component com uma imagem é, de quebra,
 * a coisa mais barata que esta página poderia pôr acima da dobra.
 */
export function AppHeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <DeviceFrame platform="ios">
        <Image
          src="/mockup-ios/hoje.jpg"
          alt={`Tela inicial da ${APP_NAME}, com a sobra projetada do mês e as pendências do dia`}
          fill
          sizes="(min-width: 1024px) 22rem, (min-width: 640px) 60vw, 80vw"
          priority
          className="object-cover"
        />
      </DeviceFrame>
    </div>
  );
}
