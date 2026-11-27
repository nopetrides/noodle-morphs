import { syncGrayscaleMapToWorkers, unsyncGrayscaleMapFromWorkers } from './renderScheduler';
import { globalSkinCache } from './skinCache';
import {
  clamp,
  registerGrayscaleMapField,
  unregisterGrayscaleMapField,
} from './skinField';
import type {
  AllelePair,
  FieldContribution,
  FieldOperation,
  Genotype,
  InheritanceMode,
  LocusId,
  ModAlleleMap,
  MorphTag,
  SkinFieldParams,
  SkinFieldPrimitiveId,
} from './types';

export const MOD_PACK_SCHEMA_VERSION = 1;
export const MOD_PACKS_STORAGE_KEY = 'morpharium_mod_packs_v1';

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
const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,39}$/;

export interface ModPaletteSpec {
  base: string;
  patternPrimary: string;
  patternSecondary?: string;
  accentColor?: string;
  belly?: string;
  outline?: string;
  eyeIris?: string;
  /** Optional translucency in [0.45, 1.0] */
  bodyOpacity?: number;
  /** Blend weight against other active color genes in [0.2, 1.0] */
  pigmentWeight?: number;
}

export interface ModFieldSpec {
  field: SkinFieldPrimitiveId;
  operation: FieldOperation;
  strength: number;
  frequency?: number;
  aspectRatio?: number;
  phase?: number;
  params?: Record<string, number>;
  /** Local texture key (from `pack.textures`) when `field === 'custom_map'` */
  textureKey?: string;
  /** Optional parameter tweaks applied to the skin field */
  paramOverrides?: Partial<SkinFieldParams>;
}

export interface ModLocusSpec {
  id: string;
  name: string;
  superName?: string;
  mode: InheritanceMode;
  shortCode: string;
  description: string;
  visualEffect: string;
  rarityWeight: number;
  tags: MorphTag[];
  /** True when this gene can only be bred via a pack synthesis recipe (excluded from Jean Pool & mutations) */
  isSynthesisOnly?: boolean;
  palette1x: ModPaletteSpec;
  palette2x?: ModPaletteSpec;
  field1x: ModFieldSpec;
  field2x?: ModFieldSpec;
}

export interface ModSynthesisIngredient {
  /** Local locus id (e.g. "starlight"), core locus ("core:magma"), or namespaced ("mod:pack:id") */
  locus: string;
  minParentCopies?: 1 | 2;
}

export interface ModSynthesisRecipe {
  id: string;
  name: string;
  tier: number;
  ingredientA: ModSynthesisIngredient;
  ingredientB: ModSynthesisIngredient;
  /** Local locus id in this pack (or namespaced mod locus) */
  result: string;
}

export interface ModGrayscaleTexture {
  width: number;
  height: number;
  /** Row-major grayscale values in [0, 1] (length === width * height) */
  data: number[];
}

export type ModPackSource = 'local' | 'imported' | 'workshop';

export interface ModGenePack {
  schemaVersion: 1;
  packId: string;
  name: string;
  author: string;
  version: string;
  description: string;
  /** Origin of this pack: created locally in Gene Studio, imported from JSON, or subscribed from Workshop */
  source?: ModPackSource;
  /** Optional Steam Workshop PublishedFileId when distributed via Steam UGC */
  workshopId?: string;
  loci: ModLocusSpec[];
  synthesisRecipes?: ModSynthesisRecipe[];
  textures?: Record<string, ModGrayscaleTexture>;
}

export interface RegisteredModLocus {
  fullId: string;
  packId: string;
  packName: string;
  spec: ModLocusSpec;
}

export interface RegisteredModRecipe {
  fullId: string;
  packId: string;
  name: string;
  tier: number;
  ingredientA: { target: string; isCore: boolean; minParentCopies: 1 | 2 };
  ingredientB: { target: string; isCore: boolean; minParentCopies: 1 | 2 };
  resultFullId: string;
}

export type ModPackValidationResult =
  | { ok: true; pack: ModGenePack }
  | { ok: false; errors: string[] };

export function makeModLocusId(packId: string, localLocusId: string): string {
  return `mod:${packId}:${localLocusId}`;
}

export function makeModTextureId(packId: string, textureKey: string): string {
  return `modtex:${packId}:${textureKey}`;
}

export function parseModLocusId(
  fullId: string
): { packId: string; localLocusId: string } | null {
  if (!fullId.startsWith('mod:')) return null;
  const parts = fullId.split(':');
  if (parts.length !== 3 || !parts[1] || !parts[2]) return null;
  return { packId: parts[1], localLocusId: parts[2] };
}

function validatePalette(
  raw: unknown,
  path: string,
  errors: string[]
): ModPaletteSpec | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.base !== 'string' || !HEX_COLOR_RE.test(obj.base)) {
    errors.push(`${path}.base must be a 6-digit hex color (e.g. #191D38).`);
  }
  if (typeof obj.patternPrimary !== 'string' || !HEX_COLOR_RE.test(obj.patternPrimary)) {
    errors.push(`${path}.patternPrimary must be a 6-digit hex color.`);
  }
  const optHexFields = ['patternSecondary', 'accentColor', 'belly', 'outline', 'eyeIris'] as const;
  for (const k of optHexFields) {
    if (obj[k] !== undefined && (typeof obj[k] !== 'string' || !HEX_COLOR_RE.test(obj[k]))) {
      errors.push(`${path}.${k} must be a 6-digit hex color when provided.`);
    }
  }
  const bodyOpacity =
    typeof obj.bodyOpacity === 'number' && Number.isFinite(obj.bodyOpacity)
      ? clamp(obj.bodyOpacity, 0.45, 1)
      : undefined;
  const pigmentWeight =
    typeof obj.pigmentWeight === 'number' && Number.isFinite(obj.pigmentWeight)
      ? clamp(obj.pigmentWeight, 0.2, 1)
      : undefined;

  return {
    base: typeof obj.base === 'string' ? obj.base : '#8C7456',
    patternPrimary: typeof obj.patternPrimary === 'string' ? obj.patternPrimary : '#2A211A',
    ...(typeof obj.patternSecondary === 'string' ? { patternSecondary: obj.patternSecondary } : {}),
    ...(typeof obj.accentColor === 'string' ? { accentColor: obj.accentColor } : {}),
    ...(typeof obj.belly === 'string' ? { belly: obj.belly } : {}),
    ...(typeof obj.outline === 'string' ? { outline: obj.outline } : {}),
    ...(typeof obj.eyeIris === 'string' ? { eyeIris: obj.eyeIris } : {}),
    ...(bodyOpacity !== undefined ? { bodyOpacity } : {}),
    ...(pigmentWeight !== undefined ? { pigmentWeight } : {}),
  };
}

function validateField(
  raw: unknown,
  path: string,
  textureKeys: Set<string>,
  errors: string[]
): ModFieldSpec | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`${path} must be an object.`);
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.field !== 'string' || !VALID_PRIMITIVES.has(obj.field as SkinFieldPrimitiveId)) {
    errors.push(`${path}.field "${String(obj.field)}" is not a supported skin field primitive.`);
  }
  if (typeof obj.operation !== 'string' || !VALID_OPS.has(obj.operation as FieldOperation)) {
    errors.push(`${path}.operation "${String(obj.operation)}" is not a supported field operator.`);
  }
  if (typeof obj.strength !== 'number' || !Number.isFinite(obj.strength)) {
    errors.push(`${path}.strength must be a finite number.`);
  }
  if (obj.field === 'custom_map') {
    if (typeof obj.textureKey !== 'string' || !textureKeys.has(obj.textureKey)) {
      errors.push(`${path}.textureKey must reference a key declared in pack.textures for custom_map.`);
    }
  }

  const sanitizedParams: Record<string, number> = {};
  if (obj.params && typeof obj.params === 'object') {
    for (const [k, v] of Object.entries(obj.params as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        sanitizedParams[k] = clamp(v, -10, 10);
      }
    }
  }

  const sanitizedOverrides: Partial<SkinFieldParams> = {};
  if (obj.paramOverrides && typeof obj.paramOverrides === 'object') {
    for (const [k, v] of Object.entries(obj.paramOverrides as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        (sanitizedOverrides as Record<string, number>)[k] = clamp(v, -1, 3);
      }
    }
  }

  return {
    field: (obj.field as SkinFieldPrimitiveId) ?? 'voronoi_network',
    operation: (obj.operation as FieldOperation) ?? 'blend',
    strength: clamp(typeof obj.strength === 'number' ? obj.strength : 0.7, 0, 1.35),
    ...(typeof obj.frequency === 'number' && Number.isFinite(obj.frequency)
      ? { frequency: clamp(obj.frequency, 0.3, 3.5) }
      : {}),
    ...(typeof obj.aspectRatio === 'number' && Number.isFinite(obj.aspectRatio)
      ? { aspectRatio: clamp(obj.aspectRatio, 0.3, 3.0) }
      : {}),
    ...(typeof obj.phase === 'number' && Number.isFinite(obj.phase)
      ? { phase: clamp(obj.phase, -20, 20) }
      : {}),
    ...(Object.keys(sanitizedParams).length > 0 ? { params: sanitizedParams } : {}),
    ...(typeof obj.textureKey === 'string' ? { textureKey: obj.textureKey } : {}),
    ...(Object.keys(sanitizedOverrides).length > 0 ? { paramOverrides: sanitizedOverrides } : {}),
  };
}

/**
 * Strictly validates an untrusted JSON Gene Pack (from disk, clipboard, or Steam Workshop)
 * before allowing it into the runtime registry. Never executes user code.
 */
export function validateModGenePack(raw: unknown): ModPackValidationResult {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['Gene pack must be a JSON object.'] };
  }
  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== MOD_PACK_SCHEMA_VERSION) {
    errors.push(`Unsupported schemaVersion "${String(obj.schemaVersion)}"; expected ${MOD_PACK_SCHEMA_VERSION}.`);
  }
  if (typeof obj.packId !== 'string' || !SLUG_RE.test(obj.packId)) {
    errors.push('packId must be 2–40 lowercase letters, digits, hyphens, or underscores.');
  }
  if (typeof obj.name !== 'string' || obj.name.trim().length < 2 || obj.name.trim().length > 48) {
    errors.push('name must be 2–48 characters.');
  }
  if (typeof obj.author !== 'string' || obj.author.trim().length < 1 || obj.author.trim().length > 40) {
    errors.push('author must be 1–40 characters.');
  }
  if (typeof obj.version !== 'string' || obj.version.trim().length < 1 || obj.version.trim().length > 20) {
    errors.push('version must be 1–20 characters.');
  }

  // Validate optional inline grayscale UV textures
  const textures: Record<string, ModGrayscaleTexture> = {};
  const textureKeys = new Set<string>();
  if (obj.textures !== undefined) {
    if (!obj.textures || typeof obj.textures !== 'object') {
      errors.push('textures must be an object mapping textureKey -> { width, height, data }.');
    } else {
      const entries = Object.entries(obj.textures as Record<string, unknown>);
      if (entries.length > 16) {
        errors.push('A pack may define at most 16 custom grayscale textures.');
      }
      for (const [key, val] of entries) {
        if (!SLUG_RE.test(key)) {
          errors.push(`textures.${key} has an invalid key slug.`);
          continue;
        }
        if (!val || typeof val !== 'object') {
          errors.push(`textures.${key} must be an object.`);
          continue;
        }
        const t = val as Record<string, unknown>;
        const w = typeof t.width === 'number' ? Math.round(t.width) : 0;
        const h = typeof t.height === 'number' ? Math.round(t.height) : 0;
        if (w < 4 || w > 256 || h < 4 || h > 64) {
          errors.push(`textures.${key} dimensions (${w}×${h}) must be within 4×4 .. 256×64.`);
          continue;
        }
        if (!Array.isArray(t.data) || t.data.length !== w * h) {
          errors.push(`textures.${key}.data must have exactly ${w * h} numbers.`);
          continue;
        }
        const data = t.data.map((n) => (typeof n === 'number' && Number.isFinite(n) ? clamp(n, 0, 1) : 0.5));
        textures[key] = { width: w, height: h, data };
        textureKeys.add(key);
      }
    }
  }

  // Validate loci
  const loci: ModLocusSpec[] = [];
  const localLocusIds = new Set<string>();
  if (!Array.isArray(obj.loci) || obj.loci.length === 0) {
    errors.push('loci must be a non-empty array of gene definitions.');
  } else if (obj.loci.length > 32) {
    errors.push('A single gene pack may define at most 32 loci.');
  } else {
    for (let i = 0; i < obj.loci.length; i++) {
      const item = obj.loci[i];
      const prefix = `loci[${i}]`;
      if (!item || typeof item !== 'object') {
        errors.push(`${prefix} must be an object.`);
        continue;
      }
      const l = item as Record<string, unknown>;
      if (typeof l.id !== 'string' || !SLUG_RE.test(l.id)) {
        errors.push(`${prefix}.id must be a valid lowercase slug (2–40 chars).`);
      } else if (localLocusIds.has(l.id)) {
        errors.push(`${prefix}.id "${l.id}" is duplicated in this pack.`);
      } else {
        localLocusIds.add(l.id);
      }
      if (typeof l.name !== 'string' || l.name.trim().length < 2 || l.name.trim().length > 28) {
        errors.push(`${prefix}.name must be 2–28 characters.`);
      }
      if (typeof l.mode !== 'string' || !VALID_MODES.has(l.mode as InheritanceMode)) {
        errors.push(`${prefix}.mode must be "dominant", "codominant", or "recessive".`);
      }

      const palette1x = validatePalette(l.palette1x, `${prefix}.palette1x`, errors);
      const palette2x =
        l.palette2x !== undefined
          ? validatePalette(l.palette2x, `${prefix}.palette2x`, errors) ?? undefined
          : undefined;
      const field1x = validateField(l.field1x, `${prefix}.field1x`, textureKeys, errors);
      const field2x =
        l.field2x !== undefined
          ? validateField(l.field2x, `${prefix}.field2x`, textureKeys, errors) ?? undefined
          : undefined;

      const rawTags = Array.isArray(l.tags) ? l.tags : ['Custom'];
      const tags = Array.from(
        new Set<MorphTag>([
          ...(rawTags.filter((t): t is MorphTag => typeof t === 'string' && VALID_TAGS.has(t as MorphTag))),
          'Custom',
        ])
      );

      if (palette1x && field1x && typeof l.id === 'string' && typeof l.name === 'string') {
        loci.push({
          id: l.id,
          name: l.name.trim(),
          ...(typeof l.superName === 'string' && l.superName.trim().length > 0
            ? { superName: l.superName.trim().slice(0, 32) }
            : {}),
          mode: (l.mode as InheritanceMode) ?? 'codominant',
          shortCode:
            typeof l.shortCode === 'string' && l.shortCode.trim().length > 0
              ? l.shortCode.trim().slice(0, 4).toUpperCase()
              : l.name.trim().slice(0, 3).toUpperCase(),
          description:
            typeof l.description === 'string' && l.description.trim().length > 0
              ? l.description.trim().slice(0, 180)
              : 'Community gene pack morph.',
          visualEffect:
            typeof l.visualEffect === 'string' && l.visualEffect.trim().length > 0
              ? l.visualEffect.trim().slice(0, 140)
              : 'Custom pattern and pigment expression.',
          rarityWeight:
            typeof l.rarityWeight === 'number' && Number.isFinite(l.rarityWeight)
              ? clamp(l.rarityWeight, 1, 5)
              : 2.2,
          tags,
          ...(l.isSynthesisOnly === true ? { isSynthesisOnly: true } : {}),
          palette1x,
          ...(palette2x ? { palette2x } : {}),
          field1x,
          ...(field2x ? { field2x } : {}),
        });
      }
    }
  }

  // Validate optional synthesis recipes + DAG cycle check
  const synthesisRecipes: ModSynthesisRecipe[] = [];
  if (obj.synthesisRecipes !== undefined) {
    if (!Array.isArray(obj.synthesisRecipes)) {
      errors.push('synthesisRecipes must be an array.');
    } else if (obj.synthesisRecipes.length > 32) {
      errors.push('A pack may define at most 32 synthesis recipes.');
    } else {
      const validateIngredient = (
        ing: unknown,
        label: string
      ): ModSynthesisIngredient | null => {
        if (!ing || typeof ing !== 'object') {
          errors.push(`${label} must be an object { locus, minParentCopies? }.`);
          return null;
        }
        const ingObj = ing as Record<string, unknown>;
        if (typeof ingObj.locus !== 'string' || ingObj.locus.trim().length === 0) {
          errors.push(`${label}.locus must be a non-empty string.`);
          return null;
        }
        const locus = ingObj.locus.trim();
        const isCore = locus.startsWith('core:');
        const isModRef = locus.startsWith('mod:');
        if (!isCore && !isModRef && !localLocusIds.has(locus)) {
          errors.push(`${label}.locus "${locus}" is not declared in this pack (use "core:<id>" for core genes).`);
        }
        const minCopies: 1 | 2 = ingObj.minParentCopies === 2 ? 2 : 1;
        return { locus, minParentCopies: minCopies };
      };

      const recipeIds = new Set<string>();
      for (let i = 0; i < obj.synthesisRecipes.length; i++) {
        const r = obj.synthesisRecipes[i];
        const prefix = `synthesisRecipes[${i}]`;
        if (!r || typeof r !== 'object') {
          errors.push(`${prefix} must be an object.`);
          continue;
        }
        const ro = r as Record<string, unknown>;
        if (typeof ro.id !== 'string' || !SLUG_RE.test(ro.id)) {
          errors.push(`${prefix}.id must be a valid slug.`);
        } else if (recipeIds.has(ro.id)) {
          errors.push(`${prefix}.id "${ro.id}" is duplicated.`);
        } else {
          recipeIds.add(ro.id);
        }
        const ingA = validateIngredient(ro.ingredientA, `${prefix}.ingredientA`);
        const ingB = validateIngredient(ro.ingredientB, `${prefix}.ingredientB`);
        if (typeof ro.result !== 'string' || !localLocusIds.has(ro.result)) {
          errors.push(`${prefix}.result "${String(ro.result)}" must match a locus id declared in this pack.`);
        }
        if (ingA && ingB && typeof ro.result === 'string' && typeof ro.id === 'string') {
          if (ingA.locus === ro.result || ingB.locus === ro.result) {
            errors.push(`${prefix} cannot consume its own result "${ro.result}".`);
          }
          synthesisRecipes.push({
            id: ro.id,
            name:
              typeof ro.name === 'string' && ro.name.trim().length > 0
                ? ro.name.trim().slice(0, 48)
                : ro.result,
            tier:
              typeof ro.tier === 'number' && Number.isFinite(ro.tier)
                ? Math.round(clamp(ro.tier, 1, 6))
                : 1,
            ingredientA: ingA,
            ingredientB: ingB,
            result: ro.result,
          });
        }
      }

      // Cycle detection across pack-local synthesis graph
      const deps = new Map<string, string[]>();
      for (const rec of synthesisRecipes) {
        const list = deps.get(rec.result) ?? [];
        if (localLocusIds.has(rec.ingredientA.locus)) list.push(rec.ingredientA.locus);
        if (localLocusIds.has(rec.ingredientB.locus)) list.push(rec.ingredientB.locus);
        deps.set(rec.result, list);
      }
      const visitState = new Map<string, 1 | 2>(); // 1 = visiting, 2 = done
      const hasCycle = (node: string): boolean => {
        const st = visitState.get(node);
        if (st === 1) return true;
        if (st === 2) return false;
        visitState.set(node, 1);
        for (const nxt of deps.get(node) ?? []) {
          if (hasCycle(nxt)) return true;
        }
        visitState.set(node, 2);
        return false;
      };
      for (const locId of localLocusIds) {
        if (hasCycle(locId)) {
          errors.push(`synthesisRecipes contain a circular dependency involving "${locId}".`);
          break;
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const rawSource = obj.source;
  const workshopId =
    typeof obj.workshopId === 'string' && obj.workshopId.trim().length > 0
      ? obj.workshopId.trim().slice(0, 32)
      : undefined;
  const source: ModPackSource =
    rawSource === 'local' || rawSource === 'imported' || rawSource === 'workshop'
      ? rawSource
      : workshopId
        ? 'workshop'
        : 'imported';

  const pack: ModGenePack = {
    schemaVersion: 1,
    packId: (obj.packId as string).trim(),
    name: (obj.name as string).trim(),
    author: (obj.author as string).trim(),
    version: (obj.version as string).trim(),
    description:
      typeof obj.description === 'string'
        ? obj.description.trim().slice(0, 240)
        : 'Custom community gene pack.',
    source,
    ...(workshopId ? { workshopId } : {}),
    loci,
    ...(synthesisRecipes.length > 0 ? { synthesisRecipes } : {}),
    ...(Object.keys(textures).length > 0 ? { textures } : {}),
  };

  return { ok: true, pack };
}

// --- Built-in Sample Steam Workshop Pack (demonstrates codominant, 2× Super, custom_map texture, & synthesis) ---

function buildSampleNebulaTexture(): ModGrayscaleTexture {
  const width = 64;
  const height = 16;
  const data: number[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    const v = (y / (height - 1)) * 2 - 1;
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      // Swirling cosmic cloud filaments + star knots along the spine
      const swirl = Math.sin(u * Math.PI * 10 + Math.sin(v * Math.PI * 2.2) * 1.4);
      const ridge = Math.cos(u * Math.PI * 6 - v * Math.PI * 2.8);
      const core = Math.exp(-v * v * 1.8) * 0.35;
      const val = clamp(0.46 + swirl * 0.24 + ridge * 0.2 + core, 0, 1);
      data[y * width + x] = Number(val.toFixed(3));
    }
  }
  return { width, height, data };
}

export const SAMPLE_CELESTIAL_PACK: ModGenePack = {
  schemaVersion: 1,
  packId: 'celestial_morphs',
  name: 'Celestial Morphs',
  author: 'Noodle Morphs Workshop Sample',
  version: '1.0.0',
  description:
    'Adds Starlight, Aurora, and the synthesized Nebula morph (using a bundled grayscale UV texture map).',
  workshopId: 'sample_341928371',
  textures: {
    nebula_clouds: buildSampleNebulaTexture(),
  },
  loci: [
    {
      id: 'starlight',
      name: 'Starlight',
      superName: 'Supernova',
      mode: 'codominant',
      shortCode: 'STR',
      description: 'Deep twilight indigo scales dusted with luminous golden starlight.',
      visualEffect: 'Midnight indigo coat speckled with bright starlight flecks; Supernova erupts in radiant solar facets.',
      rarityWeight: 2.3,
      tags: ['Color', 'Pattern', 'Dark', 'Custom'],
      palette1x: {
        base: '#1B2142',
        patternPrimary: '#F4DF8E',
        patternSecondary: '#5D70C6',
        belly: '#D9DEF2',
        eyeIris: '#F6E28F',
        bodyOpacity: 0.96,
        pigmentWeight: 0.78,
      },
      palette2x: {
        base: '#10142E',
        patternPrimary: '#FFF2B8',
        patternSecondary: '#FF9E57',
        accentColor: '#72B4FF',
        belly: '#EEF2FF',
        eyeIris: '#FFF4C2',
        bodyOpacity: 0.93,
        pigmentWeight: 0.9,
      },
      field1x: {
        field: 'speckled_granite',
        operation: 'blend',
        strength: 0.84,
        frequency: 1.45,
        paramOverrides: { coverage: 0.38, speckleAmount: 0.65 },
      },
      field2x: {
        field: 'crystal_facets',
        operation: 'smoothUnion',
        strength: 0.95,
        frequency: 1.35,
        paramOverrides: { coverage: 0.56, blush: 0.62, speckleAmount: 0.85 },
      },
    },
    {
      id: 'aurora',
      name: 'Aurora',
      superName: 'Solar Flare',
      mode: 'codominant',
      shortCode: 'AUR',
      description: 'Polar teal ribbons shimmering with electric cyan and violet bands.',
      visualEffect: 'Sweeping polar ribbons in emerald and cyan; Solar Flare intensifies into radiant banded curtains.',
      rarityWeight: 2.5,
      tags: ['Color', 'Pattern', 'Custom'],
      palette1x: {
        base: '#164B4A',
        patternPrimary: '#63E8CA',
        patternSecondary: '#9D79E6',
        belly: '#D7F5EE',
        eyeIris: '#7EF5DB',
        bodyOpacity: 0.92,
        pigmentWeight: 0.78,
      },
      palette2x: {
        base: '#12294A',
        patternPrimary: '#78FFDF',
        patternSecondary: '#E072FF',
        accentColor: '#FFE07D',
        belly: '#E8FFF9',
        eyeIris: '#B5FFE9',
        bodyOpacity: 0.86,
        pigmentWeight: 0.9,
      },
      field1x: {
        field: 'angled_waves',
        operation: 'blend',
        strength: 0.86,
        frequency: 1.15,
        paramOverrides: { coverage: 0.44, warpStrength: 0.32 },
      },
      field2x: {
        field: 'banded_agate',
        operation: 'blend',
        strength: 0.96,
        frequency: 1.3,
        paramOverrides: { coverage: 0.52, warpStrength: 0.48, blush: 0.5 },
      },
    },
    {
      id: 'nebula',
      name: 'Nebula',
      mode: 'recessive',
      shortCode: 'NEB',
      description: 'Synthesized from Starlight × Aurora. Swirling cosmic clouds rendered from a bundled UV texture.',
      visualEffect: 'Translucent violet cosmos swirled with rose-gold and aqua nebula filaments.',
      rarityWeight: 3.8,
      tags: ['Color', 'Pattern', 'Complex', 'Custom'],
      isSynthesisOnly: true,
      palette1x: {
        base: '#2C1747',
        patternPrimary: '#FF8FD8',
        patternSecondary: '#5BE7E2',
        accentColor: '#FFE49E',
        belly: '#EDE2FA',
        eyeIris: '#FFACE8',
        bodyOpacity: 0.84,
        pigmentWeight: 0.88,
      },
      field1x: {
        field: 'custom_map',
        textureKey: 'nebula_clouds',
        operation: 'blend',
        strength: 0.94,
        paramOverrides: { coverage: 0.48, warpStrength: 0.25, blush: 0.65, speckleAmount: 0.45 },
      },
    },
  ],
  synthesisRecipes: [
    {
      id: 'starlight_aurora_nebula',
      name: 'Nebula',
      tier: 1,
      ingredientA: { locus: 'starlight', minParentCopies: 1 },
      ingredientB: { locus: 'aurora', minParentCopies: 1 },
      result: 'nebula',
    },
  ],
};

// --- Runtime Mod Pack Registry ---

const installedPacks = new Map<string, ModGenePack>();
const registeredLoci = new Map<string, RegisteredModLocus>();
const registeredRecipes = new Map<string, RegisteredModRecipe>();
const changeListeners = new Set<() => void>();
let hydratedFromStorage = false;

function notifyListeners(): void {
  for (const fn of changeListeners) {
    try {
      fn();
    } catch {
      // Ignore listener errors
    }
  }
}

function registerPackInternals(pack: ModGenePack): void {
  // Unregister any old version of this pack first
  unregisterPackInternals(pack.packId);
  installedPacks.set(pack.packId, pack);

  // Register custom grayscale UV textures on main thread & Web Worker pool
  if (pack.textures) {
    for (const [key, tex] of Object.entries(pack.textures)) {
      const mapId = makeModTextureId(pack.packId, key);
      const buf = new Float32Array(tex.data);
      registerGrayscaleMapField(mapId, tex.width, tex.height, buf);
      syncGrayscaleMapToWorkers(mapId, tex.width, tex.height, buf);
    }
  }

  for (const spec of pack.loci) {
    const fullId = makeModLocusId(pack.packId, spec.id);
    registeredLoci.set(fullId, {
      fullId,
      packId: pack.packId,
      packName: pack.name,
      spec,
    });
  }

  if (pack.synthesisRecipes) {
    const resolveTarget = (raw: string): { target: string; isCore: boolean } => {
      if (raw.startsWith('core:')) {
        return { target: raw.slice('core:'.length), isCore: true };
      }
      if (raw.startsWith('mod:')) {
        return { target: raw, isCore: false };
      }
      return { target: makeModLocusId(pack.packId, raw), isCore: false };
    };

    for (const rec of pack.synthesisRecipes) {
      const fullId = `modrec:${pack.packId}:${rec.id}`;
      const a = resolveTarget(rec.ingredientA.locus);
      const b = resolveTarget(rec.ingredientB.locus);
      const res = resolveTarget(rec.result);
      registeredRecipes.set(fullId, {
        fullId,
        packId: pack.packId,
        name: rec.name,
        tier: rec.tier,
        ingredientA: {
          target: a.target,
          isCore: a.isCore,
          minParentCopies: rec.ingredientA.minParentCopies ?? 1,
        },
        ingredientB: {
          target: b.target,
          isCore: b.isCore,
          minParentCopies: rec.ingredientB.minParentCopies ?? 1,
        },
        resultFullId: res.target,
      });
    }
  }
}

function unregisterPackInternals(packId: string): void {
  const existing = installedPacks.get(packId);
  if (!existing) return;
  if (existing.textures) {
    for (const key of Object.keys(existing.textures)) {
      const mapId = makeModTextureId(packId, key);
      unregisterGrayscaleMapField(mapId);
      unsyncGrayscaleMapFromWorkers(mapId);
    }
  }
  for (const spec of existing.loci) {
    registeredLoci.delete(makeModLocusId(packId, spec.id));
  }
  if (existing.synthesisRecipes) {
    for (const rec of existing.synthesisRecipes) {
      registeredRecipes.delete(`modrec:${packId}:${rec.id}`);
    }
  }
  installedPacks.delete(packId);
}

function persistInstalledPacksToStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const list = Array.from(installedPacks.values());
    window.localStorage.setItem(MOD_PACKS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export function hydrateModPacksFromStorage(): void {
  if (hydratedFromStorage) return;
  hydratedFromStorage = true;
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem(MOD_PACKS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const item of parsed) {
      const result = validateModGenePack(item);
      if (result.ok) {
        registerPackInternals(result.pack);
      }
    }
  } catch {
    // Ignore corrupt local mod storage gracefully
  }
}

export function installModPack(
  rawPack: unknown,
  persist = true,
  sourceOverride?: ModPackSource
): ModPackValidationResult {
  hydrateModPacksFromStorage();
  const validated = validateModGenePack(rawPack);
  if (!validated.ok) return validated;
  const finalPack: ModGenePack = sourceOverride
    ? { ...validated.pack, source: sourceOverride }
    : validated.pack;
  registerPackInternals(finalPack);
  globalSkinCache.clear();
  if (persist) persistInstalledPacksToStorage();
  notifyListeners();
  return { ok: true, pack: finalPack };
}

export function uninstallModPack(packId: string, persist = true): boolean {
  hydrateModPacksFromStorage();
  if (!installedPacks.has(packId)) return false;
  unregisterPackInternals(packId);
  globalSkinCache.clear();
  if (persist) persistInstalledPacksToStorage();
  notifyListeners();
  return true;
}

export function clearInstalledModPacks(persist = false): void {
  for (const packId of Array.from(installedPacks.keys())) {
    unregisterPackInternals(packId);
  }
  globalSkinCache.clear();
  if (persist) persistInstalledPacksToStorage();
  notifyListeners();
}

export function onModPacksChanged(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function getInstalledModPacks(): ModGenePack[] {
  hydrateModPacksFromStorage();
  return Array.from(installedPacks.values());
}

export function getInstalledModPack(packId: string): ModGenePack | undefined {
  hydrateModPacksFromStorage();
  return installedPacks.get(packId);
}

export function getModLocus(fullId: string): RegisteredModLocus | undefined {
  hydrateModPacksFromStorage();
  return registeredLoci.get(fullId);
}

export function getEnabledModLoci(enabledModPacks?: string[]): RegisteredModLocus[] {
  hydrateModPacksFromStorage();
  if (!enabledModPacks || enabledModPacks.length === 0) return [];
  const allowed = new Set(enabledModPacks);
  const out: RegisteredModLocus[] = [];
  for (const loc of registeredLoci.values()) {
    if (allowed.has(loc.packId)) out.push(loc);
  }
  return out;
}

export function getEnabledModRecipes(enabledModPacks?: string[]): RegisteredModRecipe[] {
  hydrateModPacksFromStorage();
  if (!enabledModPacks || enabledModPacks.length === 0) return [];
  const allowed = new Set(enabledModPacks);
  const out: RegisteredModRecipe[] = [];
  for (const rec of registeredRecipes.values()) {
    if (allowed.has(rec.packId)) out.push(rec);
  }
  return out;
}

export function isModSynthesisOnlyLocus(fullId: string): boolean {
  const loc = getModLocus(fullId);
  return Boolean(loc?.spec.isSynthesisOnly);
}

export function buildModFieldContribution(
  packId: string,
  fieldSpec: ModFieldSpec
): { contribution: FieldContribution; customMapId?: string } {
  const customMapId =
    fieldSpec.field === 'custom_map' && fieldSpec.textureKey
      ? makeModTextureId(packId, fieldSpec.textureKey)
      : undefined;
  return {
    contribution: {
      field: fieldSpec.field,
      operation: fieldSpec.operation,
      strength: fieldSpec.strength,
      ...(fieldSpec.frequency !== undefined ? { frequency: fieldSpec.frequency } : {}),
      ...(fieldSpec.aspectRatio !== undefined ? { aspectRatio: fieldSpec.aspectRatio } : {}),
      ...(fieldSpec.phase !== undefined ? { phase: fieldSpec.phase } : {}),
      ...(fieldSpec.params ? { params: { ...fieldSpec.params } } : {}),
    },
    ...(customMapId ? { customMapId } : {}),
  };
}

/**
 * Inspects a save's enabled pack list and snakes' raw modAlleles to detect any referenced
 * Workshop / local packs that are not currently installed.
 */
export function findMissingModPacks(
  enabledModPacks: string[] | undefined,
  snakesModAlleles: Array<ModAlleleMap | undefined>
): string[] {
  hydrateModPacksFromStorage();
  const missing = new Set<string>();
  for (const packId of enabledModPacks ?? []) {
    if (!installedPacks.has(packId)) missing.add(packId);
  }
  for (const alleles of snakesModAlleles) {
    if (!alleles) continue;
    for (const fullId of Object.keys(alleles)) {
      const parsed = parseModLocusId(fullId);
      if (parsed && !installedPacks.has(parsed.packId)) {
        missing.add(parsed.packId);
      }
    }
  }
  return Array.from(missing).sort();
}

function countPairLocal(pair: AllelePair | undefined): 0 | 1 | 2 {
  if (!pair) return 0;
  const s = pair[0] + pair[1];
  return s >= 2 ? 2 : s === 1 ? 1 : 0;
}

function decPair(pair: AllelePair | undefined): AllelePair {
  const c = countPairLocal(pair);
  return c >= 2 ? [1, 0] : [0, 0];
}

function incPair(pair: AllelePair | undefined): AllelePair {
  const c = countPairLocal(pair);
  return c >= 1 ? [1, 1] : [1, 0];
}

export function cleanModAlleles(alleles?: ModAlleleMap): ModAlleleMap | undefined {
  if (!alleles) return undefined;
  const out: ModAlleleMap = {};
  let hasAny = false;
  for (const [k, pair] of Object.entries(alleles)) {
    const c = countPairLocal(pair);
    if (c > 0) {
      out[k] = c === 2 ? [1, 1] : [1, 0];
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}

/**
 * Automatic (100%) consuming synthesis for enabled Workshop / local Gene Pack recipes.
 * Supports mod + mod recipes AND cross-domain mod + core recipes (e.g. `starlight + core:opal`).
 */
export function applyModSynthesis(
  childCore: Genotype,
  childMod: ModAlleleMap | undefined,
  sireCore: Genotype,
  sireMod: ModAlleleMap | undefined,
  damCore: Genotype,
  damMod: ModAlleleMap | undefined,
  enabledModPacks?: string[]
): {
  genotype: Genotype;
  modAlleles: ModAlleleMap | undefined;
  recipe: RegisteredModRecipe | null;
} {
  const recipes = getEnabledModRecipes(enabledModPacks);
  if (recipes.length === 0) {
    return { genotype: childCore, modAlleles: cleanModAlleles(childMod), recipe: null };
  }

  const getCount = (
    ing: { target: string; isCore: boolean },
    core: Genotype,
    mod: ModAlleleMap | undefined
  ): number => {
    if (ing.isCore) {
      return countPairLocal(core[ing.target as LocusId]);
    }
    return countPairLocal(mod?.[ing.target]);
  };

  for (const recipe of recipes) {
    const childA = getCount(recipe.ingredientA, childCore, childMod);
    const childB = getCount(recipe.ingredientB, childCore, childMod);
    if (childA < 1 || childB < 1) continue;

    const maxParentA = Math.max(
      getCount(recipe.ingredientA, sireCore, sireMod),
      getCount(recipe.ingredientA, damCore, damMod)
    );
    const maxParentB = Math.max(
      getCount(recipe.ingredientB, sireCore, sireMod),
      getCount(recipe.ingredientB, damCore, damMod)
    );
    if (
      maxParentA < recipe.ingredientA.minParentCopies ||
      maxParentB < recipe.ingredientB.minParentCopies
    ) {
      continue;
    }

    const nextCore: Genotype = { ...childCore };
    const nextMod: ModAlleleMap = { ...(childMod ?? {}) };

    if (recipe.ingredientA.isCore) {
      const k = recipe.ingredientA.target as LocusId;
      nextCore[k] = decPair(nextCore[k]);
    } else {
      nextMod[recipe.ingredientA.target] = decPair(nextMod[recipe.ingredientA.target]);
    }

    if (recipe.ingredientB.isCore) {
      const k = recipe.ingredientB.target as LocusId;
      nextCore[k] = decPair(nextCore[k]);
    } else {
      nextMod[recipe.ingredientB.target] = decPair(nextMod[recipe.ingredientB.target]);
    }

    nextMod[recipe.resultFullId] = incPair(nextMod[recipe.resultFullId]);

    return {
      genotype: nextCore,
      modAlleles: cleanModAlleles(nextMod),
      recipe,
    };
  }

  return { genotype: childCore, modAlleles: cleanModAlleles(childMod), recipe: null };
}

export function exportModPackJson(pack: ModGenePack): string {
  // Strip machine-local provenance (`source`) on export so recipients import it cleanly as an imported/workshop pack
  const { source: _omittedSource, ...portable } = pack;
  void _omittedSource;
  return JSON.stringify(portable, null, 2);
}
