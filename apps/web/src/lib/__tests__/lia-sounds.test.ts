// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  playLiaSound,
  setLiaSoundsEnabled,
  __resetLiaSoundsForTests,
} from "@/lib/lia-sounds";

function makeAudioContextMock(state: "running" | "suspended" = "running") {
  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  }));
  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  const instance = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => undefined),
    createOscillator,
    createGain,
  };
  const Ctor = vi.fn(() => instance);
  return { Ctor, instance };
}

describe("lia-sounds", () => {
  beforeEach(() => {
    __resetLiaSoundsForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("plays a sound: creates oscillator nodes", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("messageSent");

    expect(instance.createOscillator).toHaveBeenCalled();
  });

  it("does not play when disabled", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    setLiaSoundsEnabled(false);
    playLiaSound("messageSent");

    expect(instance.createOscillator).not.toHaveBeenCalled();
  });

  it("debounces: same sound twice within 250ms plays once", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("typingStart");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    playLiaSound("typingStart");

    expect(instance.createOscillator.mock.calls.length).toBe(callsAfterFirst);
  });

  it("plays same sound again after the debounce window", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("typingStart");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    vi.advanceTimersByTime(300);
    playLiaSound("typingStart");

    expect(instance.createOscillator.mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it("different sounds are debounced independently", () => {
    const { Ctor, instance } = makeAudioContextMock();
    vi.stubGlobal("AudioContext", Ctor);

    playLiaSound("messageSent");
    const callsAfterFirst = instance.createOscillator.mock.calls.length;
    playLiaSound("error");

    expect(instance.createOscillator.mock.calls.length).toBeGreaterThan(
      callsAfterFirst,
    );
  });

  it("no-op without AudioContext available (never throws)", () => {
    vi.stubGlobal("AudioContext", undefined);
    // jsdom não define webkitAudioContext — getContext retorna null
    expect(() => playLiaSound("responseDone")).not.toThrow();
  });

  it("suspended context that stays suspended: skips without error and without scheduling", () => {
    const { Ctor, instance } = makeAudioContextMock("suspended");
    vi.stubGlobal("AudioContext", Ctor);

    expect(() => playLiaSound("notification")).not.toThrow();
    expect(instance.resume).toHaveBeenCalled();
    expect(instance.createOscillator).not.toHaveBeenCalled();
  });

  it("constructor that throws is swallowed", () => {
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => {
        throw new Error("boom");
      }),
    );
    expect(() => playLiaSound("confirmNeeded")).not.toThrow();
  });
});
