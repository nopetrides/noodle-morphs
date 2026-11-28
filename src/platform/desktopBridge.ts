export interface DesktopSteamDiagnostics {
  available: boolean;
  appId: number;
  overlayHookEnabled: boolean;
  personaName: string | null;
  steamId64: string | null;
  isSteamDeck: boolean;
  subscribedWorkshopCount: number;
  error: string | null;
}

export interface DesktopDiagnostics {
  runtime: 'electron';
  electronVersion: string;
  chromeVersion: string;
  platform: string;
  gpuFeatures: Record<string, string>;
  steam: DesktopSteamDiagnostics;
}

export interface NoodleMorphsDesktopBridge {
  getDiagnostics: () => Promise<DesktopDiagnostics>;
  openSteamOverlay: () => Promise<{ ok: boolean; error?: string }>;
  setTargetFps: (fps: number) => void;
  setOverlayKeepAlive: (active: boolean) => void;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    noodleMorphsDesktop?: NoodleMorphsDesktopBridge;
  }
}

export function getDesktopBridge(): NoodleMorphsDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.noodleMorphsDesktop ?? null;
}

let terrariumFrameCounter = 0;

/** Incremented by TerrariumCanvas once per actual canvas redraw (zero rAF overhead). */
export function recordTerrariumFrame(): void {
  terrariumFrameCounter++;
}

export function consumeTerrariumFrameCount(): number {
  const count = terrariumFrameCounter;
  terrariumFrameCounter = 0;
  return count;
}
