import {
  createWildTypeGenotype,
  evaluatePhenotype,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  resolveSkinSpecForPhenotype,
} from './genetics';
import { requestSkinAsync, scheduleCanvasPaint } from './renderScheduler';
import { type CachedSkinEntry, globalSkinCache } from './skinCache';
import { renderProceduralSnake } from './snakeRenderer';
import { createSpine } from './spine';
import type {
  Genotype,
  InheritanceMode,
  LocusId,
  SkinDebugStage,
  SnakePhenotype,
  SnakeSpine,
} from './types';

export type SheetDosage = 'base' | '1x' | '2x';

export interface MorphSheetEntry {
  index: number;
  locusId: LocusId | 'base';
  locusName: string;
  mode: InheritanceMode | 'base';
  dosage: SheetDosage;
  dosageLabel: string;
  isCustom: boolean;
  genotype: Genotype;
  phenotype: SnakePhenotype;
}

export interface SpriteSheetOptions {
  seed?: number;
  debugStage?: SkinDebugStage;
  includeUnwrappedStrip?: boolean;
}

export interface SpriteSheetLayout {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  pad: number;
  innerGap: number;
  pairGap: number;
  rowGap: number;
  headerH: number;
  pairCount: number;
}

export interface ProgressiveSpriteSheetCallbacks {
  onProgress?: (completed: number, total: number) => void;
  onComplete?: (total: number) => void;
}

export interface ProgressiveSpriteSheetHandle {
  layout: SpriteSheetLayout;
  entries: MorphSheetEntry[];
  cancel: () => void;
}

const SHEET_TEX_W = 192;
const SHEET_TEX_H = 48;

function dosageLabelFor(mode: InheritanceMode, dosage: '1x' | '2x'): string {
  if (mode === 'recessive') return dosage === '1x' ? 'Het 1×' : 'Vis 2×';
  if (mode === 'codominant') return dosage === '1x' ? '1×' : 'Super 2×';
  return dosage === '1x' ? 'Vis 1×' : '2×';
}

/**
 * Builds the canonical reference sheet entries:
 * 1 Base (Classic Normal) + N Loci × (1× single/het + 2× visual/super).
 */
export function buildMorphSheetEntries(seed = 0.42): MorphSheetEntry[] {
  const entries: MorphSheetEntry[] = [];
  const baseGenotype = createWildTypeGenotype();

  entries.push({
    index: 0,
    locusId: 'base',
    locusName: 'Wild-Type',
    mode: 'base',
    dosage: 'base',
    dosageLabel: 'Base',
    isCustom: false,
    genotype: baseGenotype,
    phenotype: evaluatePhenotype(baseGenotype, seed),
  });

  let idx = 1;
  for (const locusId of LOCI_ORDER) {
    const def = LOCUS_DEFINITIONS[locusId];

    const g1: Genotype = { ...createWildTypeGenotype(), [locusId]: [1, 0] };
    entries.push({
      index: idx++,
      locusId,
      locusName: def.name,
      mode: def.mode,
      dosage: '1x',
      dosageLabel: dosageLabelFor(def.mode, '1x'),
      isCustom: Boolean(def.isCustom),
      genotype: g1,
      phenotype: evaluatePhenotype(g1, seed),
    });

    const g2: Genotype = { ...createWildTypeGenotype(), [locusId]: [1, 1] };
    entries.push({
      index: idx++,
      locusId,
      locusName: def.name,
      mode: def.mode,
      dosage: '2x',
      dosageLabel: dosageLabelFor(def.mode, '2x'),
      isCustom: Boolean(def.isCustom),
      genotype: g2,
      phenotype: evaluatePhenotype(g2, seed),
    });
  }

  return entries;
}

export function computeSpriteSheetLayout(
  entryCount: number,
  includeUnwrappedStrip = true
): SpriteSheetLayout {
  const cols = 6; // 3 gene pairs per row ([1x, 2x] × 3)
  const pairCount = Math.ceil(Math.max(0, entryCount - 1) / 2);
  const rows = Math.max(1, Math.ceil(pairCount / 3));

  const pad = 24;
  const cellW = 264;
  const cellH = includeUnwrappedStrip ? 168 : 148;
  const innerGap = 6;
  const pairGap = 14;
  const rowGap = 10;
  const headerH = cellH;

  const width = pad * 2 + cols * cellW + 3 * innerGap + 2 * pairGap;
  const height = pad * 2 + headerH + 16 + rows * cellH + (rows - 1) * rowGap;

  return {
    width,
    height,
    cols,
    rows,
    cellW,
    cellH,
    pad,
    innerGap,
    pairGap,
    rowGap,
    headerH,
    pairCount,
  };
}

function getColX(col: number, layout: SpriteSheetLayout): number {
  const pairIdx = Math.floor(col / 2);
  const inPair = col % 2;
  return (
    layout.pad +
    pairIdx * (layout.cellW * 2 + layout.innerGap + layout.pairGap) +
    inPair * (layout.cellW + layout.innerGap)
  );
}

function getEntryCellPosition(
  entryIndex: number,
  layout: SpriteSheetLayout
): { x: number; y: number } {
  if (entryIndex === 0) {
    return { x: layout.pad, y: layout.pad };
  }
  const pairIndex = Math.floor((entryIndex - 1) / 2);
  const inPair = (entryIndex - 1) % 2;
  const row = Math.floor(pairIndex / 3);
  const pairCol = pairIndex % 3;
  const gridTop = layout.pad + layout.headerH + 16;
  return {
    x: getColX(pairCol * 2 + inPair, layout),
    y: gridTop + row * (layout.cellH + layout.rowGap),
  };
}

/**
 * Builds a deterministic, graceful S-curved preview spine centered inside a local
 * (0, 0, boxW, boxH) bounding box so all snakes share identical curvature and geometry.
 */
function createReferencePreviewSpine(boxW: number, boxH: number): SnakeSpine {
  const centerX = boxW * 0.5;
  const centerY = boxH * 0.52;
  const segCount = 24;
  const segLen = Math.min(boxW * 0.036, 7.6);
  const baseRadius = Math.min(boxH * 0.145, 11.4);
  const spine = createSpine(centerX, centerY, 0, segCount, segLen, baseRadius);

  const spanX = Math.min(boxW * 0.72, segCount * segLen * 0.88);
  const ampY = Math.min(boxH * 0.24, 18);

  for (let i = 0; i < spine.points.length; i++) {
    const t = i / (spine.points.length - 1);
    const x = centerX + spanX * (0.5 - t);
    const y = centerY - Math.sin(t * Math.PI * 2.15 - 0.35) * ampY;
    spine.points[i].x = x;
    spine.points[i].y = y;
  }

  for (let i = 0; i < spine.points.length; i++) {
    const p = spine.points[i];
    if (i === 0) {
      const next = spine.points[1];
      p.angle = Math.atan2(p.y - next.y, p.x - next.x);
    } else if (i === spine.points.length - 1) {
      const prev = spine.points[i - 1];
      p.angle = Math.atan2(prev.y - p.y, prev.x - p.x);
    } else {
      const prev = spine.points[i - 1];
      const next = spine.points[i + 1];
      p.angle = Math.atan2(prev.y - next.y, prev.x - next.x);
    }
  }

  return spine;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 2 && ctx.measureText(out + '…').width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + '…';
}

function getViewportBounds(
  x: number,
  y: number,
  w: number,
  h: number,
  includeUnwrappedStrip: boolean
) {
  const snakeTop = y + 28;
  const snakeH = includeUnwrappedStrip ? h - 68 : h - 48;
  const snakeW = w - 16;
  const snakeX = x + 8;
  return { snakeX, snakeTop, snakeW, snakeH };
}

/**
 * Draws the instant placeholder shell for a sprite sheet cell (border, title, dosage badge,
 * tinted placeholder silhouette, empty UV strip slot, and footer metadata).
 */
function drawSnakeCellShell(
  ctx: CanvasRenderingContext2D,
  entry: MorphSheetEntry,
  x: number,
  y: number,
  w: number,
  h: number,
  includeUnwrappedStrip: boolean
): void {
  const isHetHidden = entry.mode === 'recessive' && entry.dosage === '1x';
  const isSuperOrVis2 = entry.dosage === '2x';

  // Cell card background
  drawRoundedRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = entry.dosage === 'base' ? '#241E17' : '#1E1914';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle =
    entry.dosage === 'base'
      ? 'rgba(217, 167, 84, 0.55)'
      : entry.isCustom
        ? 'rgba(155, 110, 219, 0.35)'
        : isSuperOrVis2
          ? 'rgba(217, 167, 84, 0.32)'
          : 'rgba(216, 188, 135, 0.16)';
  ctx.stroke();

  // Header row: index + morph/locus title + dosage pill
  const padX = 10;
  const badgeText = entry.dosageLabel;
  ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
  const badgeW = Math.ceil(ctx.measureText(badgeText).width) + 12;
  const badgeH = 16;
  const badgeX = x + w - padX - badgeW;
  const badgeY = y + 8;

  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
  if (entry.dosage === 'base') {
    ctx.fillStyle = '#D9A754';
    ctx.fill();
    ctx.fillStyle = '#1B150F';
  } else if (isHetHidden) {
    ctx.fillStyle = '#2F2A24';
    ctx.fill();
    ctx.fillStyle = '#B8AB98';
  } else if (entry.isCustom) {
    ctx.fillStyle = isSuperOrVis2 ? '#8B5ED0' : '#3C2C52';
    ctx.fill();
    ctx.fillStyle = isSuperOrVis2 ? '#FFFFFF' : '#DFC7FF';
  } else {
    ctx.fillStyle = isSuperOrVis2 ? '#D9A754' : '#3A2E1F';
    ctx.fill();
    ctx.fillStyle = isSuperOrVis2 ? '#1B150F' : '#F0CFA0';
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + 0.5);

  // Title (left)
  const titleMaxW = badgeX - (x + padX) - 6;
  ctx.font = '600 12px Georgia, serif';
  ctx.fillStyle = '#F6EFE3';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const titleText =
    entry.dosage === 'base'
      ? '00 · Classic Normal'
      : `${String(entry.index).padStart(2, '0')} · ${entry.phenotype.morphName}`;
  ctx.fillText(truncateText(ctx, titleText, titleMaxW), x + padX, y + 16);

  // Snake viewport area + lightweight tinted placeholder silhouette
  const { snakeX, snakeTop, snakeW, snakeH } = getViewportBounds(x, y, w, h, includeUnwrappedStrip);
  drawRoundedRect(ctx, snakeX, snakeTop, snakeW, snakeH, 7);
  ctx.fillStyle = '#14110E';
  ctx.fill();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = entry.phenotype.palette.base || '#8C7456';
  const midY = snakeTop + snakeH * 0.52;
  ctx.beginPath();
  ctx.moveTo(snakeX + snakeW * 0.16, midY + 8);
  ctx.bezierCurveTo(
    snakeX + snakeW * 0.36,
    midY - 18,
    snakeX + snakeW * 0.64,
    midY + 18,
    snakeX + snakeW * 0.84,
    midY - 6
  );
  ctx.stroke();
  ctx.restore();

  // Empty UV strip placeholder slot
  if (includeUnwrappedStrip) {
    const stripY = snakeTop + snakeH + 5;
    const stripH = 16;
    drawRoundedRect(ctx, snakeX, stripY, snakeW, stripH, 3);
    ctx.fillStyle = '#171310';
    ctx.fill();
    ctx.strokeStyle = 'rgba(216, 188, 135, 0.14)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Footer metadata line (locus name + key field readout)
  const spec = resolveSkinSpecForPhenotype(entry.phenotype);
  ctx.font = '500 9.5px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#9E907C';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fieldTag = spec.contributions[0]
    ? `${spec.contributions[0].field.replace('_', ' ')}`
    : spec.params.calicoRise > 0
      ? `calico=${spec.params.calicoRise.toFixed(2)}`
      : spec.params.piebaldAmount > 0
        ? `pie=${spec.params.piebaldAmount.toFixed(2)}`
        : `cov=${spec.params.coverage.toFixed(2)}`;
  const leftMeta = entry.dosage === 'base' ? 'Wild-Type Base' : `${entry.locusName} (${entry.mode})`;
  ctx.fillText(truncateText(ctx, leftMeta, w * 0.58), x + padX, y + h - 10);

  ctx.textAlign = 'right';
  ctx.fillStyle = entry.isCustom ? '#C7A6F5' : '#CBB389';
  ctx.fillText(truncateText(ctx, fieldTag, w * 0.38), x + w - padX, y + h - 10);
}

/**
 * Fills the snake viewport + optional UV strip of an already-shelled cell using a single
 * shared pre-synthesized skin buffer (eliminating duplicate 256×64 + 192×48 synthesis).
 */
function drawSnakeCellContent(
  ctx: CanvasRenderingContext2D,
  entry: MorphSheetEntry,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  debugStage: SkinDebugStage,
  includeUnwrappedStrip: boolean,
  sharedSpine: SnakeSpine,
  cachedSkin: CachedSkinEntry
): void {
  const { snakeX, snakeTop, snakeW, snakeH } = getViewportBounds(x, y, w, h, includeUnwrappedStrip);

  // Overwrite placeholder silhouette inside the viewport
  drawRoundedRect(ctx, snakeX, snakeTop, snakeW, snakeH, 7);
  ctx.fillStyle = '#14110E';
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, snakeX, snakeTop, snakeW, snakeH, 7);
  ctx.clip();
  ctx.translate(snakeX, snakeTop);

  renderProceduralSnake(ctx, sharedSpine, entry.phenotype, {
    showShadow: true,
    showNameTag: false,
    debugStage,
    seedOverride: seed,
    cachedSkinOverride: cachedSkin,
  });
  ctx.restore();

  if (includeUnwrappedStrip && cachedSkin.canvas) {
    const stripY = snakeTop + snakeH + 5;
    const stripH = 16;
    const stripW = snakeW;
    ctx.save();
    drawRoundedRect(ctx, snakeX, stripY, stripW, stripH, 3);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cachedSkin.canvas, snakeX, stripY, stripW, stripH);
    ctx.restore();
    drawRoundedRect(ctx, snakeX, stripY, stripW, stripH, 3);
    ctx.strokeStyle = 'rgba(216, 188, 135, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawSheetChromeAndPlaceholders(
  ctx: CanvasRenderingContext2D,
  entries: MorphSheetEntry[],
  layout: SpriteSheetLayout,
  seed: number,
  debugStage: SkinDebugStage,
  includeUnwrappedStrip: boolean
): void {
  const { width, height, pad, cellW, cellH, headerH, innerGap, pairGap, rowGap, cols, rows, pairCount } = layout;

  // Deep archival warm charcoal backdrop
  ctx.fillStyle = '#120F0C';
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent border
  ctx.fillStyle = '#D9A754';
  ctx.fillRect(0, 0, width, 3);

  // Top Header Row: Left = Base Classic Normal (#00) placeholder, Right = Sheet Title & Legend
  if (entries[0]) {
    drawSnakeCellShell(ctx, entries[0], pad, pad, cellW, headerH, includeUnwrappedStrip);
  }

  const bannerX = pad + cellW + pairGap;
  const bannerW = width - pad - bannerX;
  drawRoundedRect(ctx, bannerX, pad, bannerW, headerH, 12);
  ctx.fillStyle = '#1B1612';
  ctx.fill();
  ctx.strokeStyle = 'rgba(216, 188, 135, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 24px Georgia, serif';
  ctx.fillStyle = '#F7F1E5';
  ctx.fillText(
    `Noodle Morphs — ${entries.length}-Snake Morph Reference Sheet`,
    bannerX + 24,
    pad + 24
  );

  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#C9BBA7';
  ctx.fillText(
    `1 Base Wild-Type + ${pairCount} Loci paired side-by-side at 1× (Het / Single) and 2× (Visual / Super) · Includes unwrapped (u, v) skin strips`,
    bannerX + 24,
    pad + 58
  );

  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#E4BE74';
  ctx.fillText(
    `TOTAL: ${entries.length} SNAKES   ·   SEED: ${seed.toFixed(3)}   ·   STAGE: ${debugStage.toUpperCase()}   ·   LAYOUT: BASE + ${pairCount} PAIRS (${cols} × ${rows})`,
    bannerX + 24,
    pad + 92
  );

  // Compact Legend pills
  const legendItems = [
    { label: 'Base Wild-Type', bg: '#D9A754', fg: '#1B150F' },
    { label: '1× Single / Vis', bg: '#3A2E1F', fg: '#F0CFA0' },
    { label: 'Het 1× (Hidden Recessive)', bg: '#2F2A24', fg: '#B8AB98' },
    { label: '2× Super / Visual', bg: '#D9A754', fg: '#1B150F' },
    { label: 'Custom Field Gene', bg: '#3C2C52', fg: '#DFC7FF' },
  ];
  let lx = bannerX + 24;
  const ly = pad + 124;
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  for (const item of legendItems) {
    const iw = Math.ceil(ctx.measureText(item.label).width) + 18;
    drawRoundedRect(ctx, lx, ly, iw, 24, 5);
    ctx.fillStyle = item.bg;
    ctx.fill();
    ctx.fillStyle = item.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, lx + iw / 2, ly + 12.5);
    lx += iw + 10;
  }

  // Draw pair halos + all placeholder card shells immediately (frame 0)
  const gridTop = pad + headerH + 16;
  for (let p = 0; p < pairCount; p++) {
    const row = Math.floor(p / 3);
    const pairCol = p % 3;
    const y = gridTop + row * (cellH + rowGap);

    const entry1 = entries[1 + p * 2];
    const entry2 = entries[2 + p * 2];

    const px = getColX(pairCol * 2, layout) - 3;
    const pw = cellW * 2 + innerGap + 6;
    drawRoundedRect(ctx, px, y - 3, pw, cellH + 6, 12);
    ctx.fillStyle = entry1?.isCustom ? 'rgba(92, 60, 145, 0.12)' : 'rgba(216, 188, 135, 0.04)';
    ctx.fill();

    if (entry1) {
      drawSnakeCellShell(ctx, entry1, getColX(pairCol * 2, layout), y, cellW, cellH, includeUnwrappedStrip);
    }
    if (entry2) {
      drawSnakeCellShell(ctx, entry2, getColX(pairCol * 2 + 1, layout), y, cellW, cellH, includeUnwrappedStrip);
    }
  }
}

/**
 * Progressive, non-blocking sprite sheet renderer:
 * 1) Immediately draws the full backdrop, banner, legend, and ALL placeholder cards on frame 0.
 * 2) Offloads skin synthesis for each snake to Web Workers in small concurrent batches.
 * 3) Paints completed cells progressively under a frame budget without locking the browser UI.
 */
export function renderMorphSpriteSheetProgressive(
  canvas: HTMLCanvasElement,
  options: SpriteSheetOptions = {},
  callbacks: ProgressiveSpriteSheetCallbacks = {}
): ProgressiveSpriteSheetHandle {
  const seed = options.seed ?? 0.42;
  const debugStage = options.debugStage ?? 'final';
  const includeUnwrappedStrip = options.includeUnwrappedStrip ?? true;

  const entries = buildMorphSheetEntries(seed);
  const layout = computeSpriteSheetLayout(entries.length, includeUnwrappedStrip);

  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    callbacks.onComplete?.(entries.length);
    return { layout, entries, cancel: () => {} };
  }

  // Frame 0: paint entire grid of placeholders immediately
  drawSheetChromeAndPlaceholders(ctx, entries, layout, seed, debugStage, includeUnwrappedStrip);
  callbacks.onProgress?.(0, entries.length);

  const { snakeW, snakeH } = getViewportBounds(0, 0, layout.cellW, layout.cellH, includeUnwrappedStrip);
  const sharedSpine = createReferencePreviewSpine(snakeW, snakeH);

  let cancelled = false;
  let nextIndex = 0;
  let completed = 0;
  const pendingPaintCancels = new Set<() => void>();

  const CONCURRENCY = 6;

  const pumpNext = () => {
    if (cancelled || nextIndex >= entries.length) return;
    const idx = nextIndex++;
    const entry = entries[idx];
    const spec = resolveSkinSpecForPhenotype(entry.phenotype);

    requestSkinAsync(spec, entry.phenotype.palette, seed, SHEET_TEX_W, SHEET_TEX_H, debugStage, 'normal')
      .then((cachedSkin) => {
        if (cancelled) return;
        const cancelPaint = scheduleCanvasPaint(() => {
          pendingPaintCancels.delete(cancelPaint);
          if (cancelled) return;
          const pos = getEntryCellPosition(idx, layout);
          drawSnakeCellContent(
            ctx,
            entry,
            pos.x,
            pos.y,
            layout.cellW,
            layout.cellH,
            seed,
            debugStage,
            includeUnwrappedStrip,
            sharedSpine,
            cachedSkin
          );
          completed++;
          callbacks.onProgress?.(completed, entries.length);
          if (completed >= entries.length) {
            callbacks.onComplete?.(entries.length);
          }
        });
        pendingPaintCancels.add(cancelPaint);
        pumpNext();
      })
      .catch(() => {
        if (cancelled) return;
        completed++;
        callbacks.onProgress?.(completed, entries.length);
        if (completed >= entries.length) {
          callbacks.onComplete?.(entries.length);
        }
        pumpNext();
      });
  };

  for (let w = 0; w < Math.min(CONCURRENCY, entries.length); w++) {
    pumpNext();
  }

  return {
    layout,
    entries,
    cancel: () => {
      cancelled = true;
      for (const cancelFn of pendingPaintCancels) cancelFn();
      pendingPaintCancels.clear();
    },
  };
}

/**
 * Synchronous sprite sheet renderer (kept for headless/scripted export and compatibility).
 * Reuses a single 192×48 skin buffer per snake for both curved body and UV strip.
 */
export function renderMorphSpriteSheet(
  canvas: HTMLCanvasElement,
  options: SpriteSheetOptions = {}
): { layout: SpriteSheetLayout; entries: MorphSheetEntry[] } {
  const seed = options.seed ?? 0.42;
  const debugStage = options.debugStage ?? 'final';
  const includeUnwrappedStrip = options.includeUnwrappedStrip ?? true;

  const entries = buildMorphSheetEntries(seed);
  const layout = computeSpriteSheetLayout(entries.length, includeUnwrappedStrip);

  canvas.width = layout.width;
  canvas.height = layout.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { layout, entries };
  }

  drawSheetChromeAndPlaceholders(ctx, entries, layout, seed, debugStage, includeUnwrappedStrip);

  const { snakeW, snakeH } = getViewportBounds(0, 0, layout.cellW, layout.cellH, includeUnwrappedStrip);
  const sharedSpine = createReferencePreviewSpine(snakeW, snakeH);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const pos = getEntryCellPosition(i, layout);
    const spec = resolveSkinSpecForPhenotype(entry.phenotype);
    const cachedSkin = globalSkinCache.getOrSynthesize(
      spec,
      entry.phenotype.palette,
      seed,
      SHEET_TEX_W,
      SHEET_TEX_H,
      debugStage
    );
    drawSnakeCellContent(
      ctx,
      entry,
      pos.x,
      pos.y,
      layout.cellW,
      layout.cellH,
      seed,
      debugStage,
      includeUnwrappedStrip,
      sharedSpine,
      cachedSkin
    );
  }

  return { layout, entries };
}
