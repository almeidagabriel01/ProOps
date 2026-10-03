"use client";

import { useSyncExternalStore } from "react";

/**
 * Instalar a ProOps na tela inicial.
 *
 * Chrome, Edge e o Android avisam que o site é instalável disparando
 * `beforeinstallprompt`, uma vez, e só esse evento abre o diálogo nativo. Ele
 * pode chegar antes de qualquer tela montar, então o ouvinte é registrado no
 * carregamento deste módulo (importado pelo `providers.tsx`) e o evento fica
 * guardado aqui até a pessoa tocar em "Instalar a ProOps".
 *
 * O `preventDefault` tira a faixa automática do Chrome no Android: a decisão
 * do produto é oferecer a instalação no menu do perfil, sem aviso por cima da
 * tela.
 *
 * iPhone e iPad não têm o evento nem um jeito de abrir a instalação por
 * código. Ali o item mostra o passo a passo do menu Compartilhar.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
let capturing = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function startInstallPromptCapture(): void {
  if (capturing || typeof window === "undefined") return;
  capturing = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    justInstalled = true;
    emit();
  });
}

startInstallPromptCapture();

export type InstallOption = "native" | "ios" | null;

interface InstallEnvironment {
  hasNativePrompt: boolean;
  /** A página já está aberta como app instalado. */
  isStandalone: boolean;
  userAgent: string;
  maxTouchPoints: number;
}

/** iPadOS se apresenta como Mac; o toque é o que o denuncia. */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Qual instalação oferecer: o diálogo nativo, o passo a passo do iOS ou
 * nenhuma (já instalado, ou navegador que não instala, como o Firefox no
 * computador).
 */
export function resolveInstallOption(env: InstallEnvironment): InstallOption {
  if (env.isStandalone) return null;
  if (env.hasNativePrompt) return "native";
  if (isAppleMobile(env.userAgent, env.maxTouchPoints)) return "ios";
  return null;
}

function readEnvironment(): InstallEnvironment {
  const standaloneQuery =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    hasNativePrompt: deferredPrompt !== null,
    isStandalone: standaloneQuery || iosStandalone || justInstalled,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InstallOption {
  return resolveInstallOption(readEnvironment());
}

function getServerSnapshot(): InstallOption {
  return null;
}

/** Abre o diálogo nativo. O evento só vale uma vez, aceito ou recusado. */
async function promptInstall(): Promise<void> {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  await event.prompt();
  await event.userChoice.catch(() => undefined);
  emit();
}

export function useInstallPrompt(): {
  option: InstallOption;
  promptInstall: () => Promise<void>;
} {
  const option = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { option, promptInstall };
}
