// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  afterAll,
} from "vitest";
// Static import: evaluated with NEXT_PUBLIC_TURNSTILE_SITE_KEY unset, so this
// instance represents the "Turnstile not configured" path.
import { getCaptchaToken } from "../captcha";

describe("getCaptchaToken", () => {
  it("resolves to an empty string when Turnstile is not configured", async () => {
    // No NEXT_PUBLIC_TURNSTILE_SITE_KEY in the test env → captcha is skipped and
    // the backend skips verification too, so the signup form keeps working.
    await expect(getCaptchaToken()).resolves.toBe("");
  });
});

interface RenderOpts {
  callback?: (token: string) => void;
  "before-interactive-callback"?: () => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
}

let lastRenderOpts: RenderOpts | null = null;
let lastRenderEl: HTMLElement | null = null;

const turnstileMock = {
  render: vi.fn((el: HTMLElement, opts: RenderOpts) => {
    lastRenderEl = el;
    lastRenderOpts = opts;
    return "widget-1";
  }),
  // Simulate Cloudflare invoking the success callback when execute() runs.
  execute: vi.fn(() => lastRenderOpts?.callback?.("tok_123")),
  reset: vi.fn(),
  remove: vi.fn(),
};

// Loads a FRESH captcha module with the site key configured, so it exercises
// the real widget path instead of the "not configured" short-circuit above.
async function loadConfiguredModule() {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  vi.resetModules();
  lastRenderOpts = null;
  lastRenderEl = null;
  turnstileMock.render.mockClear();
  turnstileMock.execute.mockClear();
  turnstileMock.remove.mockClear();
  turnstileMock.reset.mockClear();
  (window as unknown as { turnstile: typeof turnstileMock }).turnstile =
    turnstileMock;
  return import("../captcha");
}

describe("captcha — inline mount + auto-hide", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    // Don't leak the key to other test files.
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  it("renders the widget into the form-provided container", async () => {
    const { mountCaptcha, getCaptchaToken: getToken } =
      await loadConfiguredModule();
    const container = document.createElement("div");
    document.body.appendChild(container);

    mountCaptcha(container);
    await getToken();

    expect(turnstileMock.render).toHaveBeenCalledTimes(1);
    expect(lastRenderEl).toBe(container);
  });

  it("shows the widget on token request, then auto-hides it afterwards", async () => {
    vi.useFakeTimers();
    const { mountCaptcha, getCaptchaToken: getToken } =
      await loadConfiguredModule();
    const container = document.createElement("div");
    container.style.display = "none";
    document.body.appendChild(container);

    mountCaptcha(container);
    const token = await getToken();

    // Verified successfully and made visible while resolving.
    expect(token).toBe("tok_123");
    expect(container.style.display).not.toBe("none");

    // A few seconds later it dismisses itself without a page refresh.
    vi.advanceTimersByTime(3000);
    expect(container.style.display).toBe("none");
  });

  it("re-renders into a fresh container when remounted elsewhere", async () => {
    const { mountCaptcha, getCaptchaToken: getToken } =
      await loadConfiguredModule();
    const first = document.createElement("div");
    document.body.appendChild(first);
    mountCaptcha(first);
    await getToken();

    // Unmount, then mount into a brand-new node (e.g. toggling login/register).
    mountCaptcha(null);
    first.remove();
    const second = document.createElement("div");
    document.body.appendChild(second);
    mountCaptcha(second);
    await getToken();

    expect(turnstileMock.remove).toHaveBeenCalledWith("widget-1");
    expect(lastRenderEl).toBe(second);
  });

  it("resolves empty (no backend 403) when a background check would need interaction", async () => {
    const { mountCaptcha, getCaptchaToken: getToken } =
      await loadConfiguredModule();
    const container = document.createElement("div");
    document.body.appendChild(container);
    mountCaptcha(container);

    // Simulate Cloudflare requiring an interactive challenge instead of an
    // auto-pass.
    turnstileMock.execute.mockImplementationOnce(() =>
      lastRenderOpts?.["before-interactive-callback"]?.(),
    );

    // Background (non-interactive) call gives up instead of forcing a challenge.
    await expect(getToken()).resolves.toBe("");
    expect(turnstileMock.reset).toHaveBeenCalled();
  });

  it("returns the token on an interactive challenge the user completes", async () => {
    const { mountCaptcha, getCaptchaToken: getToken } =
      await loadConfiguredModule();
    const container = document.createElement("div");
    document.body.appendChild(container);
    mountCaptcha(container);

    // An interactive challenge shows and the user solves it.
    turnstileMock.execute.mockImplementationOnce(() => {
      lastRenderOpts?.["before-interactive-callback"]?.();
      lastRenderOpts?.callback?.("tok_123");
    });

    await expect(getToken({ interactive: true })).resolves.toBe("tok_123");
  });
});
