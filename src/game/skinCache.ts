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

/**
 * Bounded memory-budget LRU cache for synthesized (u, v) snake skin textures.
 * Ensures thousands of saved snakes require zero resident textures until rendered.
 */
export class BoundedSkinCache {
  private readonly entries = new Map<string, CachedSkinEntry>();
  private totalBytes = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  readonly maxBytes: number;

  constructor(maxBytes = 4 * 1024 * 1024) {
    this.maxBytes = Math.max(64 * 1024, maxBytes);
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
        this.totalBytes -= oldest.bytes;
        this.evictions++;
      }
    }
  }

  clear(): void {
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

/** Shared runtime LRU cache (~4 MiB budget: holds ~64 high-res 256×64 skins or ~160 mini 160×40 skins) */
export const globalSkinCache = new BoundedSkinCache(4 * 1024 * 1024);
