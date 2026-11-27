export type RenderQualityPreset = 'low' | 'balanced' | 'high' | 'ultra';
export type BackgroundRenderMode = 'pause' | 'eco' | 'normal';

export const RENDER_QUALITY_ORDER: readonly RenderQualityPreset[] = [
  'low',
  'balanced',
  'high',
  'ultra',
];

export interface RenderSettings {
  quality: RenderQualityPreset;
  /** Render cadence when the browser window is unfocused (hidden tabs always pause rendering) */
  backgroundMode: BackgroundRenderMode;
}

export interface RenderQualityProfile {
  preset: RenderQualityPreset;
  label: string;
  description: string;
  maxDpr: number;
  foregroundFps: number;
  /** Multiplier applied to procedural skin texture dimensions (0.5 = 128×32, 0.75 = 192×48, 1.0 = 256×64) */
  skinScale: number;
  showShadows: boolean;
  maxAmbientMotes: number;
  cacheBudgetBytes: number;
}

export const RENDER_QUALITY_PROFILES: Record<RenderQualityPreset, RenderQualityProfile> = {
  low: {
    preset: 'low',
    label: 'Low',
    description: '1× DPR · 20 FPS · Compact skins · Minimal VRAM',
    maxDpr: 1.0,
    foregroundFps: 20,
    skinScale: 0.5,
    showShadows: false,
    maxAmbientMotes: 4,
    cacheBudgetBytes: 4 * 1024 * 1024,
  },
  balanced: {
    preset: 'balanced',
    label: 'Balanced',
    description: '1.25× DPR · 30 FPS · Smooth & low GPU load',
    maxDpr: 1.25,
    foregroundFps: 30,
    skinScale: 0.75,
    showShadows: true,
    maxAmbientMotes: 8,
    cacheBudgetBytes: 6 * 1024 * 1024,
  },
  high: {
    preset: 'high',
    label: 'High',
    description: '1.5× DPR · 45 FPS · Crisp 256×64 skins',
    maxDpr: 1.5,
    foregroundFps: 45,
    skinScale: 1.0,
    showShadows: true,
    maxAmbientMotes: 10,
    cacheBudgetBytes: 10 * 1024 * 1024,
  },
  ultra: {
    preset: 'ultra',
    label: 'Ultra',
    description: '2× DPR · 60 FPS · Maximum sharpness',
    maxDpr: 2.0,
    foregroundFps: 60,
    skinScale: 1.0,
    showShadows: true,
    maxAmbientMotes: 14,
    cacheBudgetBytes: 14 * 1024 * 1024,
  },
};

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  quality: 'high',
  backgroundMode: 'eco',
};

export const RENDER_SETTINGS_STORAGE_KEY = 'morpharium_render_settings_v1';

export function normalizeRenderSettings(raw?: Partial<RenderSettings> | null): RenderSettings {
  const quality: RenderQualityPreset =
    raw?.quality === 'low' ||
    raw?.quality === 'balanced' ||
    raw?.quality === 'high' ||
    raw?.quality === 'ultra'
      ? raw.quality
      : DEFAULT_RENDER_SETTINGS.quality;
  const backgroundMode: BackgroundRenderMode =
    raw?.backgroundMode === 'pause' ||
    raw?.backgroundMode === 'eco' ||
    raw?.backgroundMode === 'normal'
      ? raw.backgroundMode
      : DEFAULT_RENDER_SETTINGS.backgroundMode;
  return { quality, backgroundMode };
}

export function loadRenderSettings(): RenderSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_RENDER_SETTINGS };
    }
    const raw = window.localStorage.getItem(RENDER_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_RENDER_SETTINGS };
    return normalizeRenderSettings(JSON.parse(raw) as Partial<RenderSettings>);
  } catch {
    return { ...DEFAULT_RENDER_SETTINGS };
  }
}

export function saveRenderSettings(settings: RenderSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      RENDER_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeRenderSettings(settings))
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getRenderQualityProfile(quality: RenderQualityPreset): RenderQualityProfile {
  return RENDER_QUALITY_PROFILES[quality] ?? RENDER_QUALITY_PROFILES.high;
}

/**
 * Computes effective target FPS given current foreground/background visibility state:
 * - Hidden browser tabs (`isTabHidden`) ALWAYS pause canvas rendering (0 FPS) to protect GPU/VRAM.
 * - Unfocused visible windows obey `settings.backgroundMode` (`pause` = 0, `eco` = 5, `normal` = foreground).
 */
export function getEffectiveTargetFps(
  settings: RenderSettings,
  isWindowFocused: boolean,
  isTabHidden: boolean
): number {
  if (isTabHidden) return 0;
  const profile = getRenderQualityProfile(settings.quality);
  if (isWindowFocused) return profile.foregroundFps;
  if (settings.backgroundMode === 'pause') return 0;
  if (settings.backgroundMode === 'eco') return Math.min(5, profile.foregroundFps);
  return profile.foregroundFps;
}

/** Scales base skin texture resolution cleanly by quality preset while keeping even dimensions. */
export function getScaledSkinDimensions(
  baseWidth: number,
  baseHeight: number,
  skinScale: number
): { width: number; height: number } {
  const s = Math.max(0.5, Math.min(1, skinScale));
  const width = Math.max(96, Math.round((baseWidth * s) / 16) * 16);
  const height = Math.max(24, Math.round((baseHeight * s) / 8) * 8);
  return { width, height };
}
