import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DeviceTier = "forte" | "medio" | "leve";

export type DeviceProfile = {
  ready: boolean;
  isMobile: boolean;
  isTouch: boolean;
  os: "android" | "ios" | "windows" | "mac" | "linux" | "outro";
  cores: number;
  /** GB de memória informados pelo navegador (aproximado; Chrome limita a 8). */
  memoryGB: number | null;
  tier: DeviceTier;
  /** Quantos arquivos processar ao mesmo tempo nas ferramentas. */
  concurrency: number;
  /** Tamanho máximo sugerido por vídeo processado no aparelho, em MB. */
  maxVideoMB: number;
  installed: boolean;
};

const DEFAULT_PROFILE: DeviceProfile = {
  ready: false,
  isMobile: false,
  isTouch: false,
  os: "outro",
  cores: 4,
  memoryGB: null,
  tier: "medio",
  concurrency: 2,
  maxVideoMB: 500,
  installed: false,
};

function detectOS(ua: string): DeviceProfile["os"] {
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1))
    return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  if (/linux/i.test(ua)) return "linux";
  return "outro";
}

export function readDeviceProfile(): DeviceProfile {
  const ua = navigator.userAgent;
  const os = detectOS(ua);
  const isTouch = navigator.maxTouchPoints > 0;
  const isMobile = os === "android" || os === "ios" || window.innerWidth < 768;
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null;

  let tier: DeviceTier = "medio";
  if (!isMobile && cores >= 8 && (memoryGB === null || memoryGB >= 8)) tier = "forte";
  else if (isMobile || cores <= 4 || (memoryGB !== null && memoryGB <= 4)) tier = "leve";

  const concurrency =
    tier === "forte" ? Math.min(4, Math.floor(cores / 2)) : tier === "medio" ? 2 : 1;
  const maxVideoMB = tier === "forte" ? 1500 : tier === "medio" ? 600 : 200;

  const installed =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return {
    ready: true,
    isMobile,
    isTouch,
    os,
    cores,
    memoryGB,
    tier,
    concurrency,
    maxVideoMB,
    installed,
  };
}

const DeviceContext = createContext<DeviceProfile>(DEFAULT_PROFILE);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DeviceProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const update = () => setProfile(readDeviceProfile());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return <DeviceContext.Provider value={profile}>{children}</DeviceContext.Provider>;
}

export function useDevice() {
  return useContext(DeviceContext);
}

export const TIER_LABEL: Record<DeviceTier, string> = {
  forte: "Aparelho forte",
  medio: "Aparelho médio",
  leve: "Modo leve",
};
