import { synthesizeSkinBuffer } from './skinField';
import type { SkinDebugStage, SkinPhenotypeSpec, SnakePalette } from './types';

export interface CachedSkinEntry {
  key: string;
  width: number;
  height: number;
  bytes: number;
  pixels: Uint8ClampedArray;
  canvas: HTMLCanvasElement | null;
}

export interface SkinCacheStats {
  entryCount: number;
  totalBytes: number;
  maxBytes: number;
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Deterministic cache key covering generator version, phenotype parameters, field contributions,
 * palette, seed, resolution, and debug view stage.
 */
export function buildSkinCacheKey(
  spec: SkinPhenotypeSpec,
  palette: SnakePalette,
  seed: number,
  width: number,
  height: number,
  debugStage: SkinDebugStage = 'final'
): string {
  const p = spec.params;
  const paramStr = [
    p.coverage,
    p.frequency,
    p.aspectRatio,
    p.warpStrength,
    p.dorsalBias,
    p.symmetry,
    p.widthContrast,
    p.baseTaper,
    p.crownNotch,
    p.localWidthVariation,
    p.regionalCoherence,
    p.eyeCount,
    p.eyeStrength,
    p.edgeSoftness,
    p.blush,
    p.flankFlame,
    p.calicoRise,
    p.piebaldAmount,
    p.speckleAmount,
    p.accentBandStrength,
    p.scaleRelief,
  ]
    .map((n) => n.toFixed(3))
    .join(',');

  const contribStr = spec.contributions
    .map(
      (c) =>
        `${c.field}:${c.operation}:${c.strength.toFixed(2)}:${(c.frequency ?? 1).toFixed(2)}:${(c.phase ?? 0).toFixed(2)}`
    )
    .join(';');

  const palStr = [
    palette.base,
    palette.patternPrimary,
    palette.patternSecondary,
    palette.accentColor ?? '',
    palette.headBlush,
    palette.isLeucistic ? 'L' : '',
    palette.isInverted ? 'I' : '',
    palette.mottleColorA ?? '',
    palette.mottleColorB ?? '',
    palette.mottleStrength ? palette.mottleStrength.toFixed(2) : '',
    palette.bodyOpacity !== undefined && palette.bodyOpacity < 0.99 ? palette.bodyOpacity.toFixed(2) : '',
  ].join('|');

  return `v${spec.generatorVersion}|${width}x${height}|${debugStage}|${seed.toFixed(4)}|${paramStr}|${contribStr}|${palStr}|${spec.customMapId ?? ''}`;
}

function createCanvasFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(pixels);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function releaseCanvasBackingStore(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  // Explicitly zeroing canvas dimensions forces Chromium/WebKit to release GPU VRAM immediately
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Bounded memory-budget LRU cache for synthesized (u, v) snake skin textures.
 * Explicitly disposes GPU backing stores on eviction/clear and supports instant CPU->GPU
 * rehydration after browser Canvas2D context loss.
 */
export class BoundedSkinCache {
  private readonly entries = new Map<string, CachedSkinEntry>();
  private totalBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  maxBytes: number;

  constructor(maxBytes = 10 * 1024 * 1024) {
    this.maxBytes = Math.max(64 * 1024, maxBytes);
  }

  /** Dynamically adjusts the VRAM/RAM budget (e.g. when user changes Render Quality) and evicts excess entries. */
  setMaxBytes(nextMaxBytes: number): void {
    this.maxBytes = Math.max(64 * 1024, nextMaxBytes);
    this.evictIfNeeded();
  }

  /**
   * Re-uploads all cached CPU pixel buffers into fresh offscreen canvases after a browser
   * GPU reset / Canvas2D context loss so snakes never get stuck rendering flat solid base colors.
   */
  rehydrateAllCanvases(): number {
    if (typeof document === 'undefined') return 0;
    let rebuilt = 0;
    for (const entry of this.entries.values()) {
      releaseCanvasBackingStore(entry.canvas);
      entry.canvas = createCanvasFromPixels(entry.pixels, entry.width, entry.height);
      if (entry.canvas) rebuilt++;
    }
    return rebuilt;
  }

  /** Ensures a cached entry's GPU canvas backing store is alive, rehydrating from CPU pixels if lost. */
  ensureEntryCanvas(entry: CachedSkinEntry): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    if (entry.canvas && entry.canvas.width === entry.width && entry.canvas.height === entry.height) {
      const ctx = entry.canvas.getContext('2d');
      const lost =
        ctx && typeof (ctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }).isContextLost === 'function'
          ? (ctx as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost()
          : false;
      if (ctx && !lost) return entry.canvas;
    }
    releaseCanvasBackingStore(entry.canvas);
    entry.canvas = createCanvasFromPixels(entry.pixels, entry.width, entry.height);
    return entry.canvas;
  }

  /** Pure lookup without synthesizing; refreshes LRU recency on hit. */
  getCached(
    spec: SkinPhenotypeSpec,
    palette: SnakePalette,
    seed: number,
    width: number,
    height: number,
    debugStage: SkinDebugStage = 'final'
  ): CachedSkinEntry | null {
    const key = buildSkinCacheKey(spec, palette, seed, width, height, debugStage);
    const existing = this.entries.get(key);
    if (!existing) return null;
    this.entries.delete(key);
    this.entries.set(key, existing);
    this.hits++;
    return existing;
  }

  /** Stores externally synthesized pixels (e.g. from the off-main-thread skin Web Worker) into the LRU cache. */
  putSynthesized(
    spec: SkinPhenotypeSpec,
    palette: SnakePalette,
    seed: number,
    width: number,
    height: number,
    pixels: Uint8ClampedArray,
    debugStage: SkinDebugStage = 'final'
  ): CachedSkinEntry {
    const key = buildSkinCacheKey(spec, palette, seed, width, height, debugStage);
    const existing = this.entries.get(key);
    if (existing) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return existing;
    }
    const canvas = createCanvasFromPixels(pixels, width, height);
    const bytes = width * height * 4;
    const entry: CachedSkinEntry = { key, width, height, bytes, pixels, canvas };
    this.entries.set(key, entry);
    this.totalBytes += bytes;
    this.evictIfNeeded();
    return entry;
  }

  getOrSynthesize(
    spec: SkinPhenotypeSpec,
    palette: SnakePalette,
    seed: number,
    width: number,
    height: number,
    debugStage: SkinDebugStage = 'final'
  ): CachedSkinEntry {
    const key = buildSkinCacheKey(spec, palette, seed, width, height, debugStage);
    const existing = this.entries.get(key);
    if (existing) {
      // Refresh LRU recency
      this.entries.delete(key);
      this.entries.set(key, existing);
      this.hits++;
      return existing;
    }

    this.misses++;
    const pixels = synthesizeSkinBuffer(spec, palette, seed, width, height, debugStage);
    const canvas = createCanvasFromPixels(pixels, width, height);
    const bytes = width * height * 4;
    const entry: CachedSkinEntry = { key, width, height, bytes, pixels, canvas };

    this.entries.set(key, entry);
    this.totalBytes += bytes;
    this.evictIfNeeded();
    return entry;
  }

  private evictIfNeeded(): void {
    while (this.totalBytes > this.maxBytes && this.entries.size > 1) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      const oldest = this.entries.get(oldestKey);
      this.entries.delete(oldestKey);
      if (oldest) {
        releaseCanvasBackingStore(oldest.canvas);
        oldest.canvas = null;
        this.totalBytes -= oldest.bytes;
        this.evictions++;
      }
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      releaseCanvasBackingStore(entry.canvas);
      entry.canvas = null;
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  getStats(): SkinCacheStats {
    return {
      entryCount: this.entries.size,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    };
  }
}

/** Shared runtime LRU cache (dynamically tuned by Render Quality; default 10 MiB) */
export const globalSkinCache = new BoundedSkinCache(10 * 1024 * 1024);
