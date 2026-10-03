import { describe, expect, it } from "vitest";

import { isAppleMobile, resolveInstallOption } from "../install-prompt";

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const FIREFOX_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("isAppleMobile", () => {
  it("reconhece iPhone", () => {
    expect(isAppleMobile(IPHONE, 5)).toBe(true);
  });

  it("reconhece iPad que se apresenta como Mac pelo toque", () => {
    expect(isAppleMobile(IPAD_AS_MAC, 5)).toBe(true);
  });

  it("um Mac de verdade não é celular", () => {
    expect(isAppleMobile(IPAD_AS_MAC, 0)).toBe(false);
  });
});

describe("resolveInstallOption", () => {
  it("com o evento do navegador, oferece o diálogo nativo", () => {
    expect(
      resolveInstallOption({
        hasNativePrompt: true,
        isStandalone: false,
        userAgent: ANDROID_CHROME,
        maxTouchPoints: 5,
      }),
    ).toBe("native");
  });

  it("no iPhone, oferece o passo a passo", () => {
    expect(
      resolveInstallOption({
        hasNativePrompt: false,
        isStandalone: false,
        userAgent: IPHONE,
        maxTouchPoints: 5,
      }),
    ).toBe("ios");
  });

  it("já instalada, não oferece nada", () => {
    expect(
      resolveInstallOption({
        hasNativePrompt: true,
        isStandalone: true,
        userAgent: ANDROID_CHROME,
        maxTouchPoints: 5,
      }),
    ).toBeNull();
    expect(
      resolveInstallOption({
        hasNativePrompt: false,
        isStandalone: true,
        userAgent: IPHONE,
        maxTouchPoints: 5,
      }),
    ).toBeNull();
  });

  it("navegador que não instala (Firefox no computador) não mostra o item", () => {
    expect(
      resolveInstallOption({
        hasNativePrompt: false,
        isStandalone: false,
        userAgent: FIREFOX_DESKTOP,
        maxTouchPoints: 0,
      }),
    ).toBeNull();
  });
});
