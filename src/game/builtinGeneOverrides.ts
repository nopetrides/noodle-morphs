import { BUILTIN_GENE_OVERRIDES } from './builtinGeneOverridesData';
import type { ModGrayscaleTexture } from './modPacks';
import type {
  FieldOperation,
  InheritanceMode,
  LocusId,
  MorphTag,
  SkinFieldParams,
  SkinFieldPrimitiveId,
} from './types';

export const BUILTIN_GENE_OVERRIDES_SCHEMA_VERSION = 1;
export const BUILTIN_GENE_OVERRIDES_REL_PATH = 'src/game/builtinGeneOverridesData.ts';

export interface BuiltinGenePaletteOverride {
  base: string;
  patternPrimary: string;
  patternSecondary?: string;
  accentColor?: string;
  belly?: string;
  outline?: string;
  eyeIris?: string;
  headBlush?: string;
  /** Optional translucency in [0.28, 1.0] */
  bodyOpacity?: number;
  /** Blend weight in [0.2, 1.0] when mixed with other visual genes */
  pigmentWeight?: number;
}

export interface BuiltinGeneFieldOverride {
  field: SkinFieldPrimitiveId;
  operation: FieldOperation;
  strength: number;
  frequency?: number;
  aspectRatio?: number;
  phase?: number;
  params?: Record<string, number>;
  /** Optional continuous SkinFieldParams overrides applied when this gene is visual */
  paramOverrides?: Partial<SkinFieldParams>;
}

export interface BuiltinGeneOverride {
  name?: string;
  superName?: string;
  mode?: InheritanceMode;
  shortCode?: string;
  description?: string;
  visualEffect?: string;
  rarityWeight?: number;
  tags?: MorphTag[];
  palette1x?: BuiltinGenePaletteOverride;
  palette2x?: BuiltinGenePaletteOverride;
  field1x?: BuiltinGeneFieldOverride;
  field2x?: BuiltinGeneFieldOverride;
  customTexture?: ModGrayscaleTexture;
}

export interface BuiltinGeneOverridesFile {
  schemaVersion: 1;
  genes: Partial<Record<LocusId, BuiltinGeneOverride>>;
}

export type BuiltinGeneOverridesValidationResult =
  | { ok: true; data: BuiltinGeneOverridesFile }
  | { ok: false; errors: string[] };

const VALID_MODES = new Set<InheritanceMode>(['dominant', 'codominant', 'recessive']);
const VALID_TAGS = new Set<MorphTag>([
  'Color',
  'Pattern',
  'Light',
  'Dark',
  'High-White',
  'Complex',
  'Wobble',
  'Custom',
]);
const VALID_PRIMITIVES = new Set<SkinFieldPrimitiveId>([
  'voronoi_network',
  'longitudinal_waves',
  'transverse_waves',
  'angled_waves',
  'radial_rings',
  'radial_teardrops',
  'cellular_pavers',
  'magma_fissures',
  'water_caustics',
  'shattered_mosaic',
  'stripe_tracks',
  'mineral_veins',
  'crystal_facets',
  'banded_agate',
  'stepped_bismuth',
  'wind_wisps',
  'speckled_granite',
  'custom_map',
]);
const VALID_OPS = new Set<FieldOperation>([
  'blend',
  'union',
  'smoothUnion',
  'intersection',
  'subtract',
  'modulate',
  'warp',
]);
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const LOCUS_KEY_RE = /^[a-z][a-z0-9_]{1,32}$/;

function clampNum(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function makeBuiltinTextureId(locusId: LocusId): string {
  return `builtintex:${locusId}`;
}

function validatePaletteOverride(
  raw: unknown,
  path: string,
  errors: string[]
): BuiltinGenePaletteOverride | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.base !== 'string' || !HEX_COLOR_RE.test(obj.base)) {
    errors.push(`${path}.base must be a 6-digit hex color.`);
  }
  if (typeof obj.patternPrimary !== 'string' || !HEX_COLOR_RE.test(obj.patternPrimary)) {
    errors.push(`${path}.patternPrimary must be a 6-digit hex color.`);
  }
  const optHex = ['patternSecondary', 'accentColor', 'belly', 'outline', 'eyeIris', 'headBlush'] as const;
  for (const key of optHex) {
    if (obj[key] !== undefined && (typeof obj[key] !== 'string' || !HEX_COLOR_RE.test(obj[key]))) {
      errors.push(`${path}.${key} must be a 6-digit hex color.`);
    }
  }
  const bodyOpacity =
    typeof obj.bodyOpacity === 'number' && Number.isFinite(obj.bodyOpacity)
      ? Number(clampNum(obj.bodyOpacity, 0.28, 1).toFixed(3))
      : undefined;
  const pigmentWeight =
    typeof obj.pigmentWeight === 'number' && Number.isFinite(obj.pigmentWeight)
      ? Number(clampNum(obj.pigmentWeight, 0.2, 1).toFixed(3))
      : undefined;

  return {
    base: typeof obj.base === 'string' ? obj.base.toUpperCase() : '#B5894F',
    patternPrimary:
      typeof obj.patternPrimary === 'string' ? obj.patternPrimary.toUpperCase() : '#2E2219',
    ...(typeof obj.patternSecondary === 'string'
      ? { patternSecondary: obj.patternSecondary.toUpperCase() }
      : {}),
    ...(typeof obj.accentColor === 'string'
      ? { accentColor: obj.accentColor.toUpperCase() }
      : {}),
    ...(typeof obj.belly === 'string' ? { belly: obj.belly.toUpperCase() } : {}),
    ...(typeof obj.outline === 'string' ? { outline: obj.outline.toUpperCase() } : {}),
    ...(typeof obj.eyeIris === 'string' ? { eyeIris: obj.eyeIris.toUpperCase() } : {}),
    ...(typeof obj.headBlush === 'string' ? { headBlush: obj.headBlush.toUpperCase() } : {}),
    ...(bodyOpacity !== undefined ? { bodyOpacity } : {}),
    ...(pigmentWeight !== undefined ? { pigmentWeight } : {}),
  };
}

function validateFieldOverride(
  raw: unknown,
  path: string,
  hasTexture: boolean,
  errors: string[]
): BuiltinGeneFieldOverride | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.field !== 'string' || !VALID_PRIMITIVES.has(obj.field as SkinFieldPrimitiveId)) {
    errors.push(`${path}.field "${String(obj.field)}" is not supported.`);
  }
  if (typeof obj.operation !== 'string' || !VALID_OPS.has(obj.operation as FieldOperation)) {
    errors.push(`${path}.operation "${String(obj.operation)}" is not supported.`);
  }
  if (typeof obj.strength !== 'number' || !Number.isFinite(obj.strength)) {
    errors.push(`${path}.strength must be a finite number.`);
  }
  if (obj.field === 'custom_map' && !hasTexture) {
    errors.push(`${path}.field is "custom_map" but customTexture is missing.`);
  }

  const sanitizedParams: Record<string, number> = {};
  if (obj.params && typeof obj.params === 'object') {
    for (const [k, v] of Object.entries(obj.params as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        sanitizedParams[k] = Number(clampNum(v, -10, 10).toFixed(4));
      }
    }
  }

  const sanitizedOverrides: Partial<SkinFieldParams> = {};
  if (obj.paramOverrides && typeof obj.paramOverrides === 'object') {
    for (const [k, v] of Object.entries(obj.paramOverrides as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (sanitizedOverrides as Record<string, number>)[k] = Number(clampNum(v, -1, 3).toFixed(4));
      }
    }
  }

  return {
    field: (obj.field as SkinFieldPrimitiveId) ?? 'voronoi_network',
    operation: (obj.operation as FieldOperation) ?? 'blend',
    strength: Number(clampNum(typeof obj.strength === 'number' ? obj.strength : 0.8, 0, 1.35).toFixed(3)),
    ...(typeof obj.frequency === 'number' && Number.isFinite(obj.frequency)
      ? { frequency: Number(clampNum(obj.frequency, 0.3, 3.5).toFixed(3)) }
      : {}),
    ...(typeof obj.aspectRatio === 'number' && Number.isFinite(obj.aspectRatio)
      ? { aspectRatio: Number(clampNum(obj.aspectRatio, 0.3, 3.0).toFixed(3)) }
      : {}),
    ...(typeof obj.phase === 'number' && Number.isFinite(obj.phase)
      ? { phase: Number(clampNum(obj.phase, -20, 20).toFixed(3)) }
      : {}),
    ...(Object.keys(sanitizedParams).length > 0 ? { params: sanitizedParams } : {}),
    ...(Object.keys(sanitizedOverrides).length > 0 ? { paramOverrides: sanitizedOverrides } : {}),
  };
}

function validateTexture(
  raw: unknown,
  path: string,
  errors: string[]
): ModGrayscaleTexture | undefined {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object.`);
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  const width = typeof obj.width === 'number' ? Math.round(obj.width) : 0;
  const height = typeof obj.height === 'number' ? Math.round(obj.height) : 0;
  if (width < 4 || width > 256 || height < 4 || height > 64) {
    errors.push(`${path} dimensions (${width}×${height}) must be within 4×4 .. 256×64.`);
    return undefined;
  }
  if (!Array.isArray(obj.data) || obj.data.length !== width * height) {
    errors.push(`${path}.data must contain exactly ${width * height} numbers.`);
    return undefined;
  }
  const data = obj.data.map((n) =>
    typeof n === 'number' && Number.isFinite(n) ? Number(clampNum(n, 0, 1).toFixed(3)) : 0.5
  );
  return { width, height, data };
}

/**
 * Strictly validates a built-in gene override payload before applying it in-memory or saving
 * it back into `src/game/builtinGeneOverridesData.ts`.
 */
export function validateBuiltinGeneOverridesFile(
  raw: unknown,
  allowedLocusIds?: ReadonlySet<string>
): BuiltinGeneOverridesValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Overrides payload must be an object.'] };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== BUILTIN_GENE_OVERRIDES_SCHEMA_VERSION) {
    errors.push(
      `Unsupported schemaVersion "${String(obj.schemaVersion)}"; expected ${BUILTIN_GENE_OVERRIDES_SCHEMA_VERSION}.`
    );
  }
  if (!obj.genes || typeof obj.genes !== 'object' || Array.isArray(obj.genes)) {
    errors.push('genes must be a dictionary keyed by built-in locus ID.');
    return { ok: false, errors };
  }

  const genes: Partial<Record<LocusId, BuiltinGeneOverride>> = {};
  const entries = Object.entries(obj.genes as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [locusId, value] of entries) {
    if (!LOCUS_KEY_RE.test(locusId)) {
      errors.push(`Invalid locus ID "${locusId}".`);
      continue;
    }
    if (allowedLocusIds && !allowedLocusIds.has(locusId)) {
      errors.push(`Unknown built-in locus ID "${locusId}".`);
      continue;
    }
    if (!value || typeof value !== 'object') {
      errors.push(`genes.${locusId} must be an object.`);
      continue;
    }
    const g = value as Record<string, unknown>;
    const customTexture = validateTexture(g.customTexture, `genes.${locusId}.customTexture`, errors);
    const palette1x = validatePaletteOverride(g.palette1x, `genes.${locusId}.palette1x`, errors);
    const palette2x = validatePaletteOverride(g.palette2x, `genes.${locusId}.palette2x`, errors);
    const field1x = validateFieldOverride(
      g.field1x,
      `genes.${locusId}.field1x`,
      Boolean(customTexture),
      errors
    );
    const field2x = validateFieldOverride(
      g.field2x,
      `genes.${locusId}.field2x`,
      Boolean(customTexture),
      errors
    );

    const next: BuiltinGeneOverride = {};
    if (typeof g.name === 'string' && g.name.trim().length > 0) {
      next.name = g.name.trim().slice(0, 36);
    }
    if (typeof g.superName === 'string' && g.superName.trim().length > 0) {
      next.superName = g.superName.trim().slice(0, 40);
    }
    if (g.mode !== undefined) {
      if (typeof g.mode === 'string' && VALID_MODES.has(g.mode as InheritanceMode)) {
        next.mode = g.mode as InheritanceMode;
      } else {
        errors.push(`genes.${locusId}.mode must be dominant, codominant, or recessive.`);
      }
    }
    if (typeof g.shortCode === 'string' && g.shortCode.trim().length > 0) {
      next.shortCode = g.shortCode.trim().slice(0, 5);
    }
    if (typeof g.description === 'string' && g.description.trim().length > 0) {
      next.description = g.description.trim().slice(0, 260);
    }
    if (typeof g.visualEffect === 'string' && g.visualEffect.trim().length > 0) {
      next.visualEffect = g.visualEffect.trim().slice(0, 180);
    }
    if (typeof g.rarityWeight === 'number' && Number.isFinite(g.rarityWeight)) {
      next.rarityWeight = Number(clampNum(g.rarityWeight, 0.5, 6).toFixed(2));
    }
    if (Array.isArray(g.tags)) {
      const validTags = Array.from(
        new Set(g.tags.filter((t): t is MorphTag => typeof t === 'string' && VALID_TAGS.has(t as MorphTag)))
      );
      if (validTags.length > 0) {
        next.tags = validTags;
      }
    }
    if (palette1x) next.palette1x = palette1x;
    if (palette2x) next.palette2x = palette2x;
    if (field1x) next.field1x = field1x;
    if (field2x) next.field2x = field2x;
    if (customTexture) next.customTexture = customTexture;

    if (Object.keys(next).length > 0) {
      genes[locusId as LocusId] = next;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      genes,
    },
  };
}

/**
 * Generates clean, deterministic, git-friendly TypeScript source for
 * `src/game/builtinGeneOverridesData.ts`.
 */
export function serializeBuiltinGeneOverridesFile(file: BuiltinGeneOverridesFile): string {
  const sortedGenes: Record<string, BuiltinGeneOverride> = {};
  for (const key of Object.keys(file.genes).sort()) {
    const val = file.genes[key as LocusId];
    if (val && Object.keys(val).length > 0) {
      sortedGenes[key] = val;
    }
  }
  const normalized: BuiltinGeneOverridesFile = {
    schemaVersion: 1,
    genes: sortedGenes as Partial<Record<LocusId, BuiltinGeneOverride>>,
  };
  return [
    '// AUTO-MANAGED BY MORPHARIUM DEV GENE EDITOR',
    '// Run "npm run dev:gene-editor" (or the VS Code "Dev Gene Editor" launch config) to edit Core & Fun genes.',
    '// Edits saved here are compiled directly into the game and can be rolled back cleanly with git.',
    "import type { BuiltinGeneOverridesFile } from './builtinGeneOverrides';",
    '',
    `export const BUILTIN_GENE_OVERRIDES: BuiltinGeneOverridesFile = ${JSON.stringify(normalized, null, 2)};`,
    '',
  ].join('\n');
}

// --- Runtime Active Override Store (initialized from checked-in project file) ---

let activeOverrides: BuiltinGeneOverridesFile = {
  schemaVersion: 1,
  genes: { ...(BUILTIN_GENE_OVERRIDES.genes ?? {}) },
};

const overrideListeners = new Set<() => void>();

export function getBuiltinGeneOverridesSnapshot(): BuiltinGeneOverridesFile {
  return {
    schemaVersion: 1,
    genes: { ...activeOverrides.genes },
  };
}

export function getBuiltinGeneOverride(locusId: LocusId): BuiltinGeneOverride | undefined {
  return activeOverrides.genes[locusId];
}

export function hasBuiltinPaletteOverride(locusId: LocusId): boolean {
  return Boolean(activeOverrides.genes[locusId]?.palette1x);
}

export function hasBuiltinFieldOverride(locusId: LocusId): boolean {
  return Boolean(activeOverrides.genes[locusId]?.field1x);
}

export function setRuntimeBuiltinGeneOverrides(next: BuiltinGeneOverridesFile): void {
  activeOverrides = {
    schemaVersion: 1,
    genes: { ...next.genes },
  };
  for (const listener of overrideListeners) {
    try {
      listener();
    } catch {
      // Ignore listener errors
    }
  }
}

export function onBuiltinGeneOverridesChanged(listener: () => void): () => void {
  overrideListeners.add(listener);
  return () => {
    overrideListeners.delete(listener);
  };
}
