import { DeviceFrame } from "@/components/marketing/_shared/device-frame";

import { TelaHoje } from "./telas/tela-hoje";

/**
 * A tela inicial do aplicativo no herói, viva.
 *
 * Era um `<Image>` com `/mockup-ios/hoje.jpg`. Antes disso, foi essa mesma
 * captura com um cartão animado por cima, removido porque o cartão caía em cima
 * de um cartão que já existia na imagem e lia como algo renderizado sobre algo.
 * A réplica resolve os dois: a tela inteira é DOM, então ela anima por dentro e
 * não há captura por baixo para atrapalhar.
 *
 * Continua sendo Server Component, e continua sendo a coisa mais barata que esta
 * página poderia pôr acima da dobra: nenhum JavaScript, e agora nem a imagem.
 * A entrada é `.hero-enter` e `.traco-desenha`, que tocam sozinhas no primeiro
 * paint e já declaram o estado final sob `prefers-reduced-motion`.
 *
 * Trocar a imagem por DOM também tira o antigo elemento de LCP do caminho
 * crítico. O `lighthouserc.json` registra a captura como o LCP desta página
 * (~3,1s); o número novo precisa ser MEDIDO, não presumido.
 */
export function AppHeroPhone() {
  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <DeviceFrame platform="ios">
        <TelaHoje animada />
      </DeviceFrame>
    </div>
  );
}
