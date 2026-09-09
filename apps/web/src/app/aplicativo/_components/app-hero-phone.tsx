import Image from "next/image";

import { APP_NAME } from "@/lib/site/app-brand";

import { DeviceFrame } from "./device-frame";

/**
 * The app's home screen in the hero, untouched.
 *
 * This carried an animated capture card overlaid on the screenshot for a
 * while. The animation was the point, but the card landed on top of a card
 * that was already in the capture, and no amount of scrim made that read as
 * anything other than something rendering over something else. The screen is
 * strong enough on its own, and a Server Component with one image is also the
 * cheapest thing this page could put above the fold.
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
