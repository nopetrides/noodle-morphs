import {
  DEFAULT_RENDER_SETTINGS,
  getEffectiveTargetFps,
  normalizeRenderSettings,
  type RenderSettings,
} from './renderSettings';

export interface FrameRateSnapshot {
  /** Effective unified target FPS across TerrariumCanvas, animated MiniSnakeCanvas, UI animations, and Electron overlay */
  targetFps: number;
  /** Milliseconds between updates (`Infinity` when paused/hidden) */
  frameIntervalMs: number;
  isWindowFocused: boolean;
  isTabHidden: boolean;
  /** True when 144Hz CSS transitions should be suppressed (hidden or unfocused under Pause/Eco) */
  disableTransitions: boolean;
  settings: RenderSettings;
}

type FrameRateListener = (snapshot: FrameRateSnapshot) => void;
type FrameTickListener = (now: number, dtMs: number, snapshot: FrameRateSnapshot) => void;

let currentSettings: RenderSettings = { ...DEFAULT_RENDER_SETTINGS };
let isWindowFocused =
  typeof document !== 'undefined' && typeof document.hasFocus === 'function'
    ? document.hasFocus()
    : true;
let isTabHidden = typeof document !== 'undefined' ? Boolean(document.hidden) : false;

const stateListeners = new Set<FrameRateListener>();
const tickListeners = new Set<FrameTickListener>();
let domListenersAttached = false;

let masterTimerId = 0;
let masterRafId = 0;
let lastTickTime = 0;

function buildSnapshot(): FrameRateSnapshot {
  const targetFps = getEffectiveTargetFps(currentSettings, isWindowFocused, isTabHidden);
  return {
    targetFps,
    frameIntervalMs: targetFps > 0 ? 1000 / targetFps : Infinity,
    isWindowFocused,
    isTabHidden,
    disableTransitions:
      isTabHidden || (!isWindowFocused && currentSettings.backgroundMode !== 'normal'),
    settings: currentSettings,
  };
}

let cachedSnapshot: FrameRateSnapshot = buildSnapshot();

function stopMasterLoop(): void {
  if (typeof window === 'undefined') return;
  if (masterTimerId) {
    window.clearTimeout(masterTimerId);
    masterTimerId = 0;
  }
  if (masterRafId) {
    window.cancelAnimationFrame(masterRafId);
    masterRafId = 0;
  }
}

function scheduleNextMasterTick(): void {
  if (typeof window === 'undefined') return;
  if (tickListeners.size === 0 || cachedSnapshot.targetFps <= 0) {
    stopMasterLoop();
    return;
  }
  stopMasterLoop();
  const fps = cachedSnapshot.targetFps;
  if (fps >= 58) {
    masterRafId = window.requestAnimationFrame(runMasterTick);
    return;
  }
  const delayMs = Math.max(8, Math.floor(1000 / fps) - 4);
  masterTimerId = window.setTimeout(() => {
    masterTimerId = 0;
    if (tickListeners.size > 0 && cachedSnapshot.targetFps > 0) {
      masterRafId = window.requestAnimationFrame(runMasterTick);
    }
  }, delayMs);
}

function runMasterTick(now: number): void {
  masterRafId = 0;
  const snap = cachedSnapshot;
  if (tickListeners.size === 0 || snap.targetFps <= 0) {
    stopMasterLoop();
    return;
  }

  const elapsedMs = lastTickTime > 0 ? now - lastTickTime : snap.frameIntervalMs;
  // On high-refresh monitors (120/144/240 Hz), skip extra rAF ticks so Ultra (60 FPS) stays cleanly at 60 FPS
  if (snap.targetFps >= 58 && elapsedMs < snap.frameIntervalMs - 1.5) {
    masterRafId = window.requestAnimationFrame(runMasterTick);
    return;
  }

  lastTickTime = now;
  const dtMs = Math.min(250, Math.max(0, elapsedMs));

  // Execute Canvas + MiniSnakeCanvas + UI animations inside the EXACT SAME rAF callback
  // so Chromium composites all layers into 1 single GPU frame (never 2x FPS).
  for (const fn of tickListeners) {
    try {
      fn(now, dtMs, snap);
    } catch {
      // Isolate subscriber errors so other layers still paint
    }
  }

  scheduleNextMasterTick();
}

function ensureMasterLoopState(): void {
  if (typeof window === 'undefined') return;
  if (tickListeners.size === 0 || cachedSnapshot.targetFps <= 0) {
    stopMasterLoop();
    return;
  }
  if (!masterTimerId && !masterRafId) {
    lastTickTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    masterRafId = window.requestAnimationFrame(runMasterTick);
  }
}

function notifyIfChanged(): void {
  const next = buildSnapshot();
  if (
    next.targetFps === cachedSnapshot.targetFps &&
    next.isWindowFocused === cachedSnapshot.isWindowFocused &&
    next.isTabHidden === cachedSnapshot.isTabHidden &&
    next.disableTransitions === cachedSnapshot.disableTransitions &&
    next.settings.quality === cachedSnapshot.settings.quality &&
    next.settings.backgroundMode === cachedSnapshot.settings.backgroundMode
  ) {
    return;
  }
  cachedSnapshot = next;
  for (const fn of stateListeners) {
    try {
      fn(cachedSnapshot);
    } catch {
      // Ignore subscriber errors
    }
  }
  // Re-sync master tick cadence immediately on quality / focus / visibility change
  stopMasterLoop();
  ensureMasterLoopState();
}

function ensureDomListeners(): void {
  if (domListenersAttached || typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  domListenersAttached = true;

  window.addEventListener('focus', () => {
    isWindowFocused = true;
    notifyIfChanged();
  });
  window.addEventListener('blur', () => {
    isWindowFocused = false;
    notifyIfChanged();
  });
  document.addEventListener('visibilitychange', () => {
    isTabHidden = Boolean(document.hidden);
    notifyIfChanged();
  });
}

/** Updates active render quality / background mode and broadcasts the resulting effective FPS to all subscribers. */
export function setFrameClockSettings(next: RenderSettings): void {
  ensureDomListeners();
  currentSettings = normalizeRenderSettings(next);
  notifyIfChanged();
}

/** Returns the current unified frame rate snapshot (quality + focus + visibility). */
export function getFrameRateSnapshot(): FrameRateSnapshot {
  ensureDomListeners();
  return cachedSnapshot;
}

/** Convenience accessor returning the current effective target FPS (`0` when paused/hidden). */
export function getCurrentTargetFps(): number {
  return getFrameRateSnapshot().targetFps;
}

/**
 * Subscribes to unified frame-rate / focus / visibility changes.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeFrameRate(listener: FrameRateListener): () => void {
  ensureDomListeners();
  stateListeners.add(listener);
  return () => {
    stateListeners.delete(listener);
  };
}

/**
 * Subscribes to the single synchronized master `requestAnimationFrame` tick.
 * All Canvas2D and UI animation subscribers execute inside the same animation frame
 * so Chromium composites everything into 1 GPU frame at `targetFps`.
 */
export function subscribeFrameTick(listener: FrameTickListener): () => void {
  ensureDomListeners();
  tickListeners.add(listener);
  ensureMasterLoopState();
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0) {
      stopMasterLoop();
    }
  };
}

/** Test helper for simulating focus/visibility state transitions in headless Node tests. */
export function __setFrameClockEnvironmentForTest(focused: boolean, hidden: boolean): void {
  isWindowFocused = focused;
  isTabHidden = hidden;
  notifyIfChanged();
}
