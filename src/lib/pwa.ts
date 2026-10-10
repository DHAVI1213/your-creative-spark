import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

let initialized = false;

/** Registra o service worker e escuta o convite de instalação. Só roda no navegador. */
export function initPWA() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  // Não registra dentro do preview da Lovable (iframe) nem em desenvolvimento,
  // para o cache não esconder as mudanças enquanto você edita.
  const inIframe = window.self !== window.top;
  if ("serviceWorker" in navigator && import.meta.env.PROD && !inIframe) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    canInstall: deferredPrompt !== null,
    install: async () => {
      if (!deferredPrompt) return false;
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      notify();
      return outcome === "accepted";
    },
  };
}
