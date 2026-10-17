/** Detecta celular/tablet e prepara o processador de vídeo para usar vários núcleos. */
export function ehCelular(): boolean {
  if (typeof navigator === "undefined") return false;
  const uad = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uad?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

/** Núcleos que o codificador pode usar (deixa 1 livre para a tela não travar). */
export function nucleos(): number {
  const n = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(8, n - 1));
}

export const multinucleo = () => typeof self !== "undefined" && self.crossOriginIsolated === true && nucleos() > 1;

const CHAVE_RAPIDO = "nk.modoRapido";
/** Modo rápido: exporta em 720p (bem mais leve). Ligado por padrão no celular. */
export function modoRapido(): boolean {
  try {
    const v = localStorage.getItem(CHAVE_RAPIDO);
    if (v !== null) return v === "1";
  } catch {
    /* sem armazenamento */
  }
  return ehCelular();
}
export function definirModoRapido(v: boolean) {
  try {
    localStorage.setItem(CHAVE_RAPIDO, v ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
}

/**
 * Liga o isolamento de origem (service worker) para o ffmpeg usar vários núcleos.
 * Recarrega a página uma vez; se mesmo assim não der (Safari, prévia dentro de iframe), segue em 1 núcleo.
 */
export async function prepararMultinucleo(): Promise<void> {
  if (typeof window === "undefined" || window.crossOriginIsolated || !("serviceWorker" in navigator)) return;
  if (window.top !== window.self) return; // dentro de iframe não dá para isolar
  try {
    await navigator.serviceWorker.register("/coi-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!sessionStorage.getItem("nk.coi") && location.pathname.startsWith("/app/")) {
      sessionStorage.setItem("nk.coi", "1");
      location.reload();
    }
  } catch {
    /* sem service worker: segue em 1 núcleo */
  }
}
