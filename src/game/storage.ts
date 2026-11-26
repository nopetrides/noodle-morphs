import {
  ContentFlag,
  DEFAULT_GAME_CONFIG,
  hasContentFlag,
  normalizeGameConfig,
  SAVE_SLOT_IDS,
  type GameConfig,
  type SaveSlotId,
} from './contentFlags';
import {
  BASE_MAX_DISPLAY_SNAKES,
  clampUint,
  createDefaultEconomyState,
  createDefaultHissDepotState,
  getMaxVigor,
  recoverSnakesVigor,
} from './economy';
import {
  countAlleles,
  createWildTypeGenotype,
  evaluatePhenotype,
  formatOddsLabel,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
} from './genetics';
import type {
  AllelePair,
  EconomyState,
  Genotype,
  LocusId,
  MorphDiscovery,
  SnakeEntity,
  TerrariumSettings,
} from './types';

const STORAGE_KEY_V2 = 'morpharium_save_v2';
const LEGACY_STORAGE_KEY_V1 = 'morpharium_save_v1';
const ACTIVE_SLOT_KEY = 'morpharium_active_slot';

function getSlotStorageKey(slotId: SaveSlotId): string {
  return `morpharium_save_slot_${slotId}`;
}

/**
 * Compact per-snake leaf entry stored inside a MorphTrieNode.
 * - No genotype (inherited from its trie path)
 * - No derived phenotype/palette/patternRule (deterministically rebuilt from genotype + polygenicSeed)
 * - No `onDisplay` boolean (managed separately by the terrarium manager in `disp`)
 * - Retains custom name, lineage IDs, pet count, current vigor (if < max), and modified max vigor overrides
 */
export interface CompactSnakeLeaf {
  i: string; // id
  n: string; // custom name
  p: number; // polygenicSeed (rounded to 4 decimals)
  t: number; // hatchedAt epoch ms
  g?: number; // generation (omitted when 1)
  s?: string; // sireId
  d?: string; // damId
  sn?: [string, string]; // fallback [sireName, sireMorphName] only if sire isn't in collection
  dn?: [string, string]; // fallback [damName, damMorphName] only if dam isn't in collection
  o?: number; // hatchOdds (omitted when 1)
  m?: 1; // wasMutation (omitted when false)
  c?: number; // petCount (omitted when 0)
  v?: number; // modified max lineageVigor override (only when differing from default phenotype)
  cv?: number; // current breeding vigour (only when < max vigor)
}

export interface MorphTrieNode {
  c?: Record<string, MorphTrieNode>;
  s?: CompactSnakeLeaf[];
}

export interface CompactDiscoveryEntry {
  g: string;
  p: number;
  t: number;
  n: number;
  i: string;
  l: string;
}

export interface CompactSavePayloadV2 {
  v: 2;
  tree: MorphTrieNode;
  disp: string[];
  disc: Record<string, CompactDiscoveryEntry>;
  sireId: string;
  damId: string;
  dur: number;
  rem: number;
  hatched: number;
  ready?: 1; // 1 when clutch already finished & deducted vigor (awaiting reveal)
  cfg: { lamp: boolean; mute: boolean };
  eco?: EconomyState;
  game?: GameConfig;
  at: number;
}

export interface LoadedGameState {
  snakes: SnakeEntity[];
  displayedIds: string[];
  discoveries: Record<string, MorphDiscovery>;
  sireId: string;
  damId: string;
  clutchDurationSec: number;
  clutchRemainingSec: number;
  clutchReady: boolean;
  clutchesHatched: number;
  settings: TerrariumSettings;
  economy: EconomyState;
  gameConfig: GameConfig;
  savedAt: number;
}

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  isEmpty: boolean;
  savedAt: number;
  snakeCount: number;
  discoveredCount: number;
  clutchesHatched: number;
  money: number;
  gameConfig: GameConfig;
  previewSnakes: SnakeEntity[];
}

interface LegacySavedGameStateV1 {
  version: 1;
  snakes: SnakeEntity[];
  discoveries: Record<string, MorphDiscovery>;
  sireId: string;
  damId: string;
  clutchDurationSec?: number;
  clutchRemainingSec?: number;
  clutchesHatched?: number;
  settings?: Partial<TerrariumSettings>;
  savedAt?: number;
}

const LOCUS_TO_INDEX = new Map<LocusId, number>(LOCI_ORDER.map((id, idx) => [id, idx]));

export function genotypeToTrieTokens(genotype: Genotype): string[] {
  const tokens: string[] = [];
  for (let idx = 0; idx < LOCI_ORDER.length; idx++) {
    const loc = LOCI_ORDER[idx];
    const count = countAlleles(genotype[loc]);
    if (count > 0) {
      tokens.push(`${idx}:${count}`);
    }
  }
  return tokens;
}

export function tokensToGenotype(tokens: string[]): Genotype {
  const genotype = createWildTypeGenotype();
  for (const token of tokens) {
    if (!token) continue;
    const [idxStr, countStr] = token.split(':');
    const idx = Number(idxStr);
    const count = Number(countStr);
    const loc = LOCI_ORDER[idx];
    if (!loc) continue;
    const pair: AllelePair = count >= 2 ? [1, 1] : count === 1 ? [1, 0] : [0, 0];
    genotype[loc] = pair;
  }
  return genotype;
}

export function insertIntoMorphTree(
  root: MorphTrieNode,
  genotype: Genotype,
  leaf: CompactSnakeLeaf
): void {
  const tokens = genotypeToTrieTokens(genotype);
  let node = root;
  for (const token of tokens) {
    if (!node.c) node.c = {};
    if (!node.c[token]) node.c[token] = {};
    node = node.c[token];
  }
  if (!node.s) node.s = [];
  node.s.push(leaf);
}

export function findInMorphTree(root: MorphTrieNode, genotype: Genotype): CompactSnakeLeaf[] {
  const tokens = genotypeToTrieTokens(genotype);
  let node: MorphTrieNode | undefined = root;
  for (const token of tokens) {
    node = node?.c?.[token];
    if (!node) return [];
  }
  return node?.s ?? [];
}

function encodeGenotypeCode(genotype: Genotype): string {
  return genotypeToTrieTokens(genotype).join(',');
}

export function encodeSaveStateV2(
  state: Omit<LoadedGameState, 'savedAt' | 'displayedIds' | 'economy' | 'clutchReady' | 'gameConfig'> & {
    displayedIds?: string[];
    economy?: EconomyState;
    clutchReady?: boolean;
    gameConfig?: GameConfig;
  },
  now = Date.now()
): CompactSavePayloadV2 {
  const snakeById = new Map<string, SnakeEntity>(state.snakes.map((s) => [s.id, s]));
  const tree: MorphTrieNode = {};

  for (const snake of state.snakes) {
    const defaultPheno = evaluatePhenotype(snake.genotype, snake.polygenicSeed);
    const maxVigor = getMaxVigor(snake);
    const leaf: CompactSnakeLeaf = {
      i: snake.id,
      n: snake.name,
      p: Math.round(snake.polygenicSeed * 10000) / 10000,
      t: snake.hatchedAt,
    };

    if (snake.generation !== 1) leaf.g = snake.generation;
    if (snake.sire) {
      leaf.s = snake.sire.id;
      if (!snakeById.has(snake.sire.id)) {
        leaf.sn = [snake.sire.name, snake.sire.morphName];
      }
    }
    if (snake.dam) {
      leaf.d = snake.dam.id;
      if (!snakeById.has(snake.dam.id)) {
        leaf.dn = [snake.dam.name, snake.dam.morphName];
      }
    }
    if (snake.hatchOdds !== 1) leaf.o = Math.round(snake.hatchOdds * 10000) / 10000;
    if (snake.wasMutation) leaf.m = 1;
    if (snake.petCount > 0) leaf.c = snake.petCount;

    if (snake.phenotype.lineageVigor !== defaultPheno.lineageVigor) {
      leaf.v = snake.phenotype.lineageVigor;
    }
    if (snake.currentVigor < maxVigor - 0.05) {
      leaf.cv = Math.round(Math.max(0, snake.currentVigor) * 10) / 10;
    }

    insertIntoMorphTree(tree, snake.genotype, leaf);
  }

  const disp =
    state.displayedIds ?? state.snakes.filter((s) => s.onDisplay).map((s) => s.id);

  const disc: Record<string, CompactDiscoveryEntry> = {};
  for (const [morphKey, entry] of Object.entries(state.discoveries)) {
    const sampleSnake =
      snakeById.get(entry.sampleSnakeId) ??
      state.snakes.find((s) => s.phenotype.morphKey === morphKey);
    const genotypeCode = sampleSnake
      ? encodeGenotypeCode(sampleSnake.genotype)
      : inferGenotypeCodeFromMorphKey(morphKey);
    const sampleSeed = sampleSnake
      ? Math.round(sampleSnake.polygenicSeed * 10000) / 10000
      : Math.round((entry.samplePatternRule.variationSeed ?? 0.5) * 10000) / 10000;

    disc[morphKey] = {
      g: genotypeCode,
      p: sampleSeed,
      t: entry.firstDiscoveredAt,
      n: entry.countHatched,
      i: entry.sampleSnakeId,
      l: entry.parentLineageSummary,
    };
  }

  const economy = state.economy ?? createDefaultEconomyState();
  const gameConfig = normalizeGameConfig(state.gameConfig);

  return {
    v: 2,
    tree,
    disp,
    disc,
    sireId: state.sireId,
    damId: state.damId,
    dur: state.clutchDurationSec,
    rem: Math.round(state.clutchRemainingSec * 10) / 10,
    hatched: state.clutchesHatched,
    ...(state.clutchReady ? { ready: 1 as const } : {}),
    cfg: {
      lamp: state.settings.heatLampOn,
      mute: state.settings.muted,
    },
    eco: {
      ...economy,
      money: clampUint(economy.money),
      totalSnakesSold: clampUint(economy.totalSnakesSold),
      jeanPool: {
        ...economy.jeanPool,
        purchasesCount: clampUint(economy.jeanPool.purchasesCount),
        cooldownRemainingSec: Math.round(Math.max(0, economy.jeanPool.cooldownRemainingSec) * 10) / 10,
      },
    },
    game: gameConfig,
    at: now,
  };
}

function inferGenotypeCodeFromMorphKey(morphKey: string): string {
  if (!morphKey || morphKey === 'normal') return '';
  const tokens: string[] = [];
  const parts = morphKey.split('+');
  const push = (loc: LocusId, count: 1 | 2) => {
    const idx = LOCUS_TO_INDEX.get(loc);
    if (idx !== undefined) tokens.push(`${idx}:${count}`);
  };
  for (const part of parts) {
    if (part === 'super-pastel') push('pastel', 2);
    else if (part === 'pastel') push('pastel', 1);
    else if (part === 'super-enchi') push('enchi', 2);
    else if (part === 'enchi') push('enchi', 1);
    else if (part === 'super-banana') push('banana', 2);
    else if (part === 'banana') push('banana', 1);
    else if (part === 'super-ghi') push('ghi', 2);
    else if (part === 'ghi') push('ghi', 1);
    else if (part === 'super-cypress') push('cypress', 2);
    else if (part === 'cypress') push('cypress', 1);
    else if (part === 'spider') push('spider', 1);
    else if (part === 'pinstripe') push('pinstripe', 1);
    else if (part === 'calico') push('calico', 1);
    else if (part === 'mojave') push('mojave', 1);
    else if (part === 'lesser') push('lesser', 1);
    else if (part === 'blue-eyed-leucistic') push('mojave', 2);
    else if (part === 'black-eyed-leucistic') push('fire', 2);
    else if (part === 'fire') push('fire', 1);
    else if (part === 'ivory') push('yellowbelly', 2);
    else if (part === 'yellow-belly') push('yellowbelly', 1);
    else if (part === '8-ball') push('blackpastel', 2);
    else if (part === 'black-pastel') push('blackpastel', 1);
    else if (part === 'snow') {
      push('albino', 2);
      push('axanthic', 2);
    } else if (part === 'albino') push('albino', 2);
    else if (part === 'axanthic') push('axanthic', 2);
    else if (part === 'piebald') push('piebald', 2);
    else if (part === 'clown') push('clown', 2);
    else if (part === 'lavender-albino') push('lavenderalbino', 2);
    else if (part === 'desert-ghost') push('desertghost', 2);
    else if (part === 'hypo') push('hypo', 2);
    else if (part === 'ultramel') push('ultramel', 2);
    else if (part === 'saddler') push('saddler', 1);
    else if (part === 'super-bullring') push('bullring', 2);
    else if (part === 'bullring') push('bullring', 1);
    else if (part === 'super-chevron') push('chevron', 2);
    else if (part === 'chevron') push('chevron', 1);
    else if (part === 'raindrop') push('raindrop', 2);
    else if (part === 'obsidian-cobblestone') {
      push('obsidian', 1);
    } else if (part === 'cobblestone') {
      push('cobblestone', 1);
    } else if (part === 'super-lava') push('magma', 2);
    else if (part === 'lava') push('magma', 1);
    else if (part === 'super-water') push('tidal', 2);
    else if (part === 'water') push('tidal', 1);
    else if (part === 'crossbar') push('crossbar', 1);
    else if (part === 'trackline') push('trackline', 1);
    else if (part === 'super-milk-band') push('milksnake', 2);
    else if (part === 'milk-band') push('milksnake', 1);
    else if (part === 'inverted') push('invert', 2);
    else if (part === 'killer-bee') {
      push('pastel', 2);
      push('spider', 1);
    } else if (part === 'bumblebee') {
      push('pastel', 1);
      push('spider', 1);
    } else if (part === 'monsoon') push('monsoon', 2);
    else if (part === 'sunset') push('sunset', 2);
    else if (part === 'genetic-stripe') push('geneticstripe', 2);
    else if (part === 'tri-stripe') push('tristripe', 2);
    else if (part === 'super-leopard') push('leopard', 2);
    else if (part === 'leopard') push('leopard', 1);
    else if (part === 'monarch') push('monarch', 2);
    else if (part === 'super-cinnamon') push('cinnamon', 2);
    else if (part === 'cinnamon') push('cinnamon', 1);
    else if (part === 'super-blade') push('blade', 2);
    else if (part === 'blade') push('blade', 1);
    else {
      // Generic fallback across all Element & Mineral synthesis loci (names & superNames)
      for (const loc of LOCI_ORDER) {
        const def = LOCUS_DEFINITIONS[loc];
        const normName = def.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const normSuper = (def.superName ?? `Super ${def.name}`).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        if (part === normSuper && def.mode === 'codominant') {
          push(loc, 2);
          break;
        }
        if (part === normName) {
          push(loc, def.mode === 'recessive' ? 2 : 1);
          break;
        }
      }
    }
  }
  return tokens.join(',');
}

function hydrateEconomy(raw: EconomyState | undefined, elapsedSec: number): EconomyState {
  const def = createDefaultEconomyState();
  if (!raw) return def;
  const defDepot = createDefaultHissDepotState();
  const rawDepot = raw.hissDepot;
  const maxInc = clampUint(rawDepot?.incubatorMaxLevel ?? 0);
  const activeInc = Math.min(maxInc, clampUint(rawDepot?.incubatorActiveLevel ?? 0));

  const totalSold = clampUint(raw.totalSnakesSold);
  const sellUnlocked =
    typeof raw.sellUnlocked === 'boolean' ? raw.sellUnlocked : totalSold >= 1;
  const jeanPoolIntroSeen =
    typeof raw.jeanPoolIntroSeen === 'boolean' ? raw.jeanPoolIntroSeen : totalSold >= 1;
  const hissDepotIntroSeen =
    typeof raw.hissDepotIntroSeen === 'boolean' ? raw.hissDepotIntroSeen : totalSold >= 3;

  return {
    money: clampUint(raw.money),
    totalSnakesSold: totalSold,
    soldMorphKeys: Array.isArray(raw.soldMorphKeys) ? raw.soldMorphKeys : [],
    sellUnlocked,
    jeanPoolIntroSeen,
    hissDepotIntroSeen,
    jeanPool: {
      purchasesCount: clampUint(raw.jeanPool?.purchasesCount ?? 0),
      cooldownRemainingSec: Math.max(0, (raw.jeanPool?.cooldownRemainingSec ?? 0) - elapsedSec),
      stockSeed: raw.jeanPool?.stockSeed ?? def.jeanPool.stockSeed,
    },
    hissDepot: {
      incubatorMaxLevel: maxInc,
      incubatorActiveLevel: activeInc,
      displaySlotsBought: clampUint(rawDepot?.displaySlotsBought ?? 0),
      biasCapsBought: {
        dominant: clampUint(rawDepot?.biasCapsBought?.dominant ?? 0),
        codominant: clampUint(rawDepot?.biasCapsBought?.codominant ?? 0),
        recessive: clampUint(rawDepot?.biasCapsBought?.recessive ?? 0),
      },
      biasWeights: rawDepot?.biasWeights
        ? {
            dominant: Number(rawDepot.biasWeights.dominant ?? defDepot.biasWeights.dominant),
            codominant: Number(rawDepot.biasWeights.codominant ?? defDepot.biasWeights.codominant),
            recessive: Number(rawDepot.biasWeights.recessive ?? defDepot.biasWeights.recessive),
          }
        : defDepot.biasWeights,
    },
  };
}

export function decodeSaveStateV2(
  payload: CompactSavePayloadV2,
  now = Date.now()
): LoadedGameState | null {
  if (
    payload.v !== 2 ||
    !payload.tree ||
    !Array.isArray(payload.disp) ||
    !payload.disc ||
    typeof payload.sireId !== 'string' ||
    typeof payload.damId !== 'string'
  ) {
    return null;
  }

  const displayedSet = new Set(payload.disp);
  const rawEntries: Array<{ leaf: CompactSnakeLeaf; genotype: Genotype }> = [];

  const walk = (node: MorphTrieNode, pathTokens: string[]) => {
    if (Array.isArray(node.s) && node.s.length > 0) {
      const genotype = tokensToGenotype(pathTokens);
      for (const leaf of node.s) {
        rawEntries.push({ leaf, genotype });
      }
    }
    if (node.c) {
      for (const [token, child] of Object.entries(node.c)) {
        walk(child, [...pathTokens, token]);
      }
    }
  };
  walk(payload.tree, []);

  if (rawEntries.length < 2) return null;

  let snakes: SnakeEntity[] = rawEntries.map(({ leaf, genotype }) => {
    const basePhenotype = evaluatePhenotype(genotype, leaf.p);
    const phenotype =
      typeof leaf.v === 'number'
        ? { ...basePhenotype, lineageVigor: Math.max(20, leaf.v) }
        : basePhenotype;

    const maxVigor = Math.max(20, Math.round(phenotype.lineageVigor));
    const currentVigor =
      typeof leaf.cv === 'number' ? Math.max(0, Math.min(maxVigor, leaf.cv)) : maxVigor;

    const generation = leaf.g ?? 1;
    const hatchOdds = leaf.o ?? 1;
    const wasMutation = leaf.m === 1;
    const hatchOddsLabel =
      generation === 1 && !leaf.s && !leaf.d
        ? 'Founder'
        : formatOddsLabel(hatchOdds, wasMutation);

    return {
      id: leaf.i,
      name: leaf.n,
      genotype,
      polygenicSeed: leaf.p,
      phenotype,
      currentVigor,
      onDisplay: displayedSet.has(leaf.i),
      hatchedAt: leaf.t,
      generation,
      sire: null,
      dam: null,
      hatchOdds,
      hatchOddsLabel,
      wasMutation,
      petCount: leaf.c ?? 0,
    };
  });

  snakes.sort((a, b) => b.hatchedAt - a.hatchedAt);

  const snakeById = new Map<string, SnakeEntity>(snakes.map((s) => [s.id, s]));
  const leafById = new Map<string, CompactSnakeLeaf>(rawEntries.map((r) => [r.leaf.i, r.leaf]));
  for (const snake of snakes) {
    const leaf = leafById.get(snake.id);
    if (!leaf) continue;
    if (leaf.s) {
      const sRef = snakeById.get(leaf.s);
      if (sRef) {
        snake.sire = { id: sRef.id, name: sRef.name, morphName: sRef.phenotype.morphName };
      } else if (leaf.sn) {
        snake.sire = { id: leaf.s, name: leaf.sn[0], morphName: leaf.sn[1] };
      }
    }
    if (leaf.d) {
      const dRef = snakeById.get(leaf.d);
      if (dRef) {
        snake.dam = { id: dRef.id, name: dRef.name, morphName: dRef.phenotype.morphName };
      } else if (leaf.dn) {
        snake.dam = { id: leaf.d, name: leaf.dn[0], morphName: leaf.dn[1] };
      }
    }
  }

  const validDisplayedIds = payload.disp.filter((id) => snakeById.has(id));
  if (validDisplayedIds.length === 0 && snakes.length > 0) {
    snakes[0].onDisplay = true;
    validDisplayedIds.push(snakes[0].id);
  }

  const discoveries: Record<string, MorphDiscovery> = {};
  for (const [morphKey, entry] of Object.entries(payload.disc)) {
    const sampleSnake = snakeById.get(entry.i);
    const pheno = sampleSnake
      ? sampleSnake.phenotype
      : evaluatePhenotype(
          tokensToGenotype(entry.g ? entry.g.split(',') : []),
          entry.p ?? 0.5
        );

    discoveries[morphKey] = {
      morphKey,
      morphName: pheno.morphName,
      rarity: pheno.rarity,
      firstDiscoveredAt: entry.t,
      countHatched: entry.n,
      sampleSnakeId: entry.i,
      samplePatternFormula: pheno.patternRule.formula,
      samplePalette: pheno.palette,
      samplePatternRule: pheno.patternRule,
      sampleIsUpsideDown: pheno.isUpsideDown,
      parentLineageSummary: entry.l,
      tags: pheno.tags,
    };
  }

  const elapsedSec =
    typeof payload.at === 'number' ? Math.max(0, (now - payload.at) / 1000) : 0;
  const remaining = Math.max(0, (payload.rem ?? 120) - elapsedSec);
  const clutchReady = payload.ready === 1 || remaining <= 0;

  // Recover vigour offline for resting snakes (and for parents during post-breed idle time!)
  const activelyBreedingIds = clutchReady
    ? new Set<string>()
    : new Set<string>([payload.sireId, payload.damId]);
  snakes = recoverSnakesVigor(snakes, activelyBreedingIds, elapsedSec);

  const gameConfig = normalizeGameConfig(payload.game);
  const hissDepotEnabled = hasContentFlag(gameConfig.contentFlags, ContentFlag.HissDepot);
  const hydratedEconomy = hydrateEconomy(payload.eco, elapsedSec);
  const economy: EconomyState = hissDepotEnabled
    ? hydratedEconomy
    : {
        ...hydratedEconomy,
        hissDepot: createDefaultHissDepotState(),
      };

  // If Hiss Depot is disabled, enforce baseline display slot cap cleanly
  const maxDisp = hissDepotEnabled
    ? BASE_MAX_DISPLAY_SNAKES + economy.hissDepot.displaySlotsBought
    : BASE_MAX_DISPLAY_SNAKES;
  if (validDisplayedIds.length > maxDisp) {
    const allowed = new Set(validDisplayedIds.slice(0, maxDisp));
    validDisplayedIds.length = 0;
    for (const id of allowed) validDisplayedIds.push(id);
    snakes = snakes.map((s) => ({ ...s, onDisplay: allowed.has(s.id) }));
  }

  return {
    snakes,
    displayedIds: validDisplayedIds,
    discoveries,
    sireId: payload.sireId,
    damId: payload.damId,
    clutchDurationSec: payload.dur ?? 120,
    clutchRemainingSec: remaining,
    clutchReady,
    clutchesHatched: payload.hatched ?? 0,
    settings: {
      heatLampOn: payload.cfg?.lamp ?? true,
      muted: payload.cfg?.mute ?? false,
    },
    economy,
    gameConfig,
    savedAt: typeof payload.at === 'number' ? payload.at : now,
  };
}

function decodeLegacyV1(raw: string, now = Date.now()): LoadedGameState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LegacySavedGameStateV1>;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.snakes) ||
      parsed.snakes.length < 2 ||
      !parsed.discoveries ||
      typeof parsed.sireId !== 'string' ||
      typeof parsed.damId !== 'string'
    ) {
      return null;
    }

    const elapsedSec =
      typeof parsed.savedAt === 'number' ? Math.max(0, (now - parsed.savedAt) / 1000) : 0;
    const remaining = Math.max(0, (parsed.clutchRemainingSec ?? 120) - elapsedSec);
    const snakes: SnakeEntity[] = parsed.snakes.map((s) => {
      const fullGeno = { ...createWildTypeGenotype(), ...s.genotype };
      const pheno = evaluatePhenotype(fullGeno, s.polygenicSeed);
      return {
        ...s,
        genotype: fullGeno,
        phenotype: pheno,
        currentVigor: s.currentVigor ?? pheno.lineageVigor,
      };
    });
    const displayedIds = snakes.filter((s) => s.onDisplay).map((s) => s.id);

    return {
      snakes,
      displayedIds,
      discoveries: parsed.discoveries,
      sireId: parsed.sireId,
      damId: parsed.damId,
      clutchDurationSec: parsed.clutchDurationSec ?? 120,
      clutchRemainingSec: remaining,
      clutchReady: remaining <= 0,
      clutchesHatched: parsed.clutchesHatched ?? 0,
      settings: {
        heatLampOn: parsed.settings?.heatLampOn ?? true,
        muted: parsed.settings?.muted ?? false,
      },
      economy: createDefaultEconomyState(),
      gameConfig: { ...DEFAULT_GAME_CONFIG },
      savedAt: now,
    };
  } catch {
    return null;
  }
}

export type SaveableGameState = Omit<
  LoadedGameState,
  'savedAt' | 'displayedIds' | 'economy' | 'clutchReady' | 'gameConfig'
> & {
  displayedIds?: string[];
  economy?: EconomyState;
  clutchReady?: boolean;
  gameConfig?: GameConfig;
};

/** Transparently migrates any pre-slot legacy save into Slot 1 if Slot 1 is empty. */
export function migrateLegacySaveIfNeeded(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const slot1Key = getSlotStorageKey(1);
    if (window.localStorage.getItem(slot1Key)) return;

    const rawV2 = window.localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2) as CompactSavePayloadV2;
      const decoded = decodeSaveStateV2(parsedV2);
      if (decoded) {
        window.localStorage.setItem(slot1Key, rawV2);
        window.localStorage.setItem(ACTIVE_SLOT_KEY, '1');
        window.localStorage.removeItem(STORAGE_KEY_V2);
        return;
      }
    }

    const rawV1 = window.localStorage.getItem(LEGACY_STORAGE_KEY_V1);
    if (rawV1) {
      const migrated = decodeLegacyV1(rawV1);
      if (migrated) {
        saveToSlot(1, migrated);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

export function getLastActiveSlotId(): SaveSlotId | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = Number(window.localStorage.getItem(ACTIVE_SLOT_KEY));
    if (raw === 1 || raw === 2 || raw === 3) return raw;
    return null;
  } catch {
    return null;
  }
}

export function setLastActiveSlotId(slotId: SaveSlotId | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (slotId === null) {
      window.localStorage.removeItem(ACTIVE_SLOT_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
    }
  } catch {
    // Ignore
  }
}

export function loadSaveSlot(slotId: SaveSlotId, now = Date.now()): LoadedGameState | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    migrateLegacySaveIfNeeded();
    const raw = window.localStorage.getItem(getSlotStorageKey(slotId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompactSavePayloadV2;
    return decodeSaveStateV2(parsed, now);
  } catch {
    return null;
  }
}

export function saveToSlot(slotId: SaveSlotId, state: SaveableGameState, now = Date.now()): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const compact = encodeSaveStateV2(state, now);
    window.localStorage.setItem(getSlotStorageKey(slotId), JSON.stringify(compact));
    window.localStorage.setItem(ACTIVE_SLOT_KEY, String(slotId));
  } catch {
    // Ignore quota or storage restriction errors silently
  }
}

export function deleteSaveSlot(slotId: SaveSlotId): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(getSlotStorageKey(slotId));
    if (getLastActiveSlotId() === slotId) {
      const nextMostRecent = getMostRecentSaveSlot();
      setLastActiveSlotId(nextMostRecent);
    }
  } catch {
    // Ignore
  }
}

export function listSaveSlots(): SaveSlotSummary[] {
  migrateLegacySaveIfNeeded();
  return SAVE_SLOT_IDS.map((slotId) => {
    const loaded = loadSaveSlot(slotId);
    if (!loaded) {
      return {
        slotId,
        isEmpty: true,
        savedAt: 0,
        snakeCount: 0,
        discoveredCount: 0,
        clutchesHatched: 0,
        money: 0,
        gameConfig: { ...DEFAULT_GAME_CONFIG },
        previewSnakes: [],
      };
    }
    return {
      slotId,
      isEmpty: false,
      savedAt: loaded.savedAt,
      snakeCount: loaded.snakes.length,
      discoveredCount: Object.keys(loaded.discoveries).length,
      clutchesHatched: loaded.clutchesHatched,
      money: loaded.economy.money,
      gameConfig: loaded.gameConfig,
      previewSnakes: loaded.snakes.slice(0, 2),
    };
  });
}

export function hasAnySaveSlots(): boolean {
  return listSaveSlots().some((slot) => !slot.isEmpty);
}

export function getMostRecentSaveSlot(): SaveSlotId | null {
  const occupied = listSaveSlots().filter((s) => !s.isEmpty);
  if (occupied.length === 0) return null;

  // Prefer the most recently saved timestamp
  occupied.sort((a, b) => b.savedAt - a.savedAt);
  return occupied[0].slotId;
}

export function loadSavedState(): LoadedGameState | null {
  migrateLegacySaveIfNeeded();
  const preferred = getLastActiveSlotId() ?? getMostRecentSaveSlot();
  if (preferred) {
    return loadSaveSlot(preferred);
  }
  return null;
}

export function saveGameState(state: SaveableGameState): void {
  const target = getLastActiveSlotId() ?? 1;
  saveToSlot(target, state);
}

export function clearSavedState(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    for (const slotId of SAVE_SLOT_IDS) {
      window.localStorage.removeItem(getSlotStorageKey(slotId));
    }
    window.localStorage.removeItem(ACTIVE_SLOT_KEY);
    window.localStorage.removeItem(STORAGE_KEY_V2);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_V1);
  } catch {
    // Ignore
  }
}
