import {
  createWildTypeGenotype,
  evaluatePhenotype,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  resolveSkinSpecForPhenotype,
} from './genetics';
import { globalSkinCache } from './skinCache';
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
}

function dosageLabelFor(mode: InheritanceMode, dosage: '1x' | '2x'): string {
  if (mode === 'recessive') return dosage === '1x' ? 'Het 1×' : 'Vis 2×';
  if (mode === 'codominant') return dosage === '1x' ? '1×' : 'Super 2×';
  return dosage === '1x' ? 'Vis 1×' : '2×';
}

/**
 * Builds the canonical 61-snake reference sheet entries:
 * 1 Base (Classic Normal) + 30 Loci × (1× single/het + 2× visual/super).
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

/**
 * Builds a deterministic, graceful S-curved preview spine inside a bounding box
 * so all 61 snakes share identical curvature for apples-to-apples visual comparison.
 */
function createReferencePreviewSpine(
  centerX: number,
  centerY: number,
  boxW: number,
  boxH: number
): SnakeSpine {
  const segCount = 24;
  const segLen = Math.min(boxW * 0.036, 7.6);
  const baseRadius = Math.min(boxH * 0.145, 11.4);
  const spine = createSpine(centerX, centerY, 0, segCount, segLen, baseRadius);

  // Lay out a clean horizontal S-curve centered at (centerX, centerY)
  const spanX = Math.min(boxW * 0.72, segCount * segLen * 0.88);
  const ampY = Math.min(boxH * 0.24, 18);

  for (let i = 0; i < spine.points.length; i++) {
    const t = i / (spine.points.length - 1);
    // Head on right-upper, graceful S-wave flowing left to tail
    const x = centerX + spanX * (0.5 - t);
    const y = centerY - Math.sin(t * Math.PI * 2.15 - 0.35) * ampY;
    spine.points[i].x = x;
    spine.points[i].y = y;
  }

  // Recompute clean tangent angles pointing toward the head (index 0)
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

function drawSnakeCell(
  ctx: CanvasRenderingContext2D,
  entry: MorphSheetEntry,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  debugStage: SkinDebugStage,
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

  // Snake viewport area
  const snakeTop = y + 28;
  const snakeH = includeUnwrappedStrip ? h - 68 : h - 48;
  const snakeW = w - 16;
  const snakeX = x + 8;

  drawRoundedRect(ctx, snakeX, snakeTop, snakeW, snakeH, 7);
  ctx.fillStyle = '#14110E';
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, snakeX, snakeTop, snakeW, snakeH, 7);
  ctx.clip();

  const spine = createReferencePreviewSpine(
    snakeX + snakeW * 0.5,
    snakeTop + snakeH * 0.52,
    snakeW,
    snakeH
  );
  renderProceduralSnake(ctx, spine, entry.phenotype, {
    showShadow: true,
    showNameTag: false,
    debugStage,
    seedOverride: seed,
  });
  ctx.restore();

  // Optional miniature unwrapped (u, v) strip right below the curved snake
  const spec = resolveSkinSpecForPhenotype(entry.phenotype);
  if (includeUnwrappedStrip) {
    const stripY = snakeTop + snakeH + 5;
    const stripH = 16;
    const stripW = snakeW;
    const cached = globalSkinCache.getOrSynthesize(
      spec,
      entry.phenotype.palette,
      seed,
      192,
      48,
      debugStage
    );
    if (cached.canvas) {
      ctx.save();
      drawRoundedRect(ctx, snakeX, stripY, stripW, stripH, 3);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cached.canvas, snakeX, stripY, stripW, stripH);
      ctx.restore();
      drawRoundedRect(ctx, snakeX, stripY, stripW, stripH, 3);
      ctx.strokeStyle = 'rgba(216, 188, 135, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Footer metadata line (locus name + key field readout)
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
 * Renders the complete 61-snake sprite sheet (1 Base + 30 Loci × [1×, 2×]) onto an HTMLCanvasElement.
 * Pairs every gene's 1× and 2× side-by-side across 3 pairs (6 columns) × 10 rows beneath the Base header row.
 */
export function renderMorphSpriteSheet(
  canvas: HTMLCanvasElement,
  options: SpriteSheetOptions = {}
): { layout: SpriteSheetLayout; entries: MorphSheetEntry[] } {
  const seed = options.seed ?? 0.42;
  const debugStage = options.debugStage ?? 'final';
  const includeUnwrappedStrip = options.includeUnwrappedStrip ?? true;

  const entries = buildMorphSheetEntries(seed);
  const cols = 6; // 3 gene pairs per row ([1x, 2x] × 3)
  const pairCount = Math.ceil((entries.length - 1) / 2); // 30 pairs
  const rows = Math.ceil(pairCount / 3); // 10 rows

  const pad = 24;
  const cellW = 264;
  const cellH = includeUnwrappedStrip ? 168 : 148;
  const innerGap = 6;
  const pairGap = 14;
  const rowGap = 10;
  const headerH = cellH;

  const width = pad * 2 + cols * cellW + 3 * innerGap + 2 * pairGap;
  const height = pad * 2 + headerH + 16 + rows * cellH + (rows - 1) * rowGap;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      layout: { width, height, cols, rows, cellW, cellH },
      entries,
    };
  }

  // Deep archival warm charcoal backdrop
  ctx.fillStyle = '#120F0C';
  ctx.fillRect(0, 0, width, height);

  // Subtle top accent border
  ctx.fillStyle = '#D9A754';
  ctx.fillRect(0, 0, width, 3);

  // Top Header Row: Left = Base Classic Normal (#00), Right = Sheet Title & Legend
  const baseEntry = entries[0];
  drawSnakeCell(ctx, baseEntry, pad, pad, cellW, headerH, seed, debugStage, includeUnwrappedStrip);

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
  ctx.fillText('Morpharium — 61-Snake Morph Reference Sheet', bannerX + 24, pad + 24);

  ctx.font = '500 13px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#C9BBA7';
  ctx.fillText(
    '1 Base Wild-Type + 30 Loci paired side-by-side at 1× (Het / Single) and 2× (Visual / Super) · Includes unwrapped (u, v) skin strips',
    bannerX + 24,
    pad + 58
  );

  ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillStyle = '#E4BE74';
  ctx.fillText(
    `TOTAL: ${entries.length} SNAKES   ·   SEED: ${seed.toFixed(3)}   ·   STAGE: ${debugStage.toUpperCase()}   ·   LAYOUT: BASE + 30 PAIRS (6 × 10)`,
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

  // Helper for column X accounting for paired spacing ([0,1] | [2,3] | [4,5])
  const colX = (col: number): number => {
    const pairIdx = Math.floor(col / 2);
    const inPair = col % 2;
    return pad + pairIdx * (cellW * 2 + innerGap + pairGap) + inPair * (cellW + innerGap);
  };

  // Render 30 paired genes (entries 1..60)
  const gridTop = pad + headerH + 16;
  for (let p = 0; p < pairCount; p++) {
    const row = Math.floor(p / 3);
    const pairCol = p % 3;
    const y = gridTop + row * (cellH + rowGap);

    const entry1 = entries[1 + p * 2];
    const entry2 = entries[2 + p * 2];

    // Subtle pair grouping halo behind [1x, 2x]
    const px = colX(pairCol * 2) - 3;
    const pw = cellW * 2 + innerGap + 6;
    drawRoundedRect(ctx, px, y - 3, pw, cellH + 6, 12);
    ctx.fillStyle = entry1?.isCustom ? 'rgba(92, 60, 145, 0.12)' : 'rgba(216, 188, 135, 0.04)';
    ctx.fill();

    if (entry1) {
      drawSnakeCell(
        ctx,
        entry1,
        colX(pairCol * 2),
        y,
        cellW,
        cellH,
        seed,
        debugStage,
        includeUnwrappedStrip
      );
    }
    if (entry2) {
      drawSnakeCell(
        ctx,
        entry2,
        colX(pairCol * 2 + 1),
        y,
        cellW,
        cellH,
        seed,
        debugStage,
        includeUnwrappedStrip
      );
    }
  }

  return {
    layout: { width, height, cols, rows, cellW, cellH },
    entries,
  };
}
