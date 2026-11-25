import {
  countAlleles,
  evaluatePhenotype,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  makeGenotype,
  pickCozySnakeName,
} from './genetics';
import type {
  EconomyState,
  GeneBiasDistribution,
  HissDepotState,
  InheritanceMode,
  LocusId,
  MorphRarity,
  SnakeEntity,
} from './types';

// Local currency symbol placeholder — replace with Intl.NumberFormat / locale lookup when localization is added
export const CURRENCY_SYMBOL = '$';

export const BASE_GLOBAL_VIGOR = 100;
/** Baseline 100 vigour => 5 clutches in a row before hitting 0 */
export const BREED_VIGOR_COST = 20;
/** Vigour recovered per second when not actively breeding (~15/min -> 80s for one clutch) */
export const VIGOR_RECOVERY_PER_SEC = 0.25;

export const BASE_CLUTCH_SIZE = 2;
export const BASE_BREED_TIME_SEC = 120; // 2 minutes base
export const BASE_MAX_DISPLAY_SNAKES = 6;
export const MAX_DISPLAY_UPGRADES = 6; // up to 12 displayed
export const MAX_INCUBATOR_UPGRADES = 4; // up to 6 eggs / 6 min
export const MAX_BIAS_CAP_UPGRADES = 4; // up to +40% per category
export const JEAN_POOL_COOLDOWN_SEC = BASE_BREED_TIME_SEC * 5; // 5x base hatch cooldown (10 min)

// --- Unsigned Integer Safe Currency Math (no decimals, never < 0, never overflows/rolls over) ---

export function clampUint(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value) || value <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${clampUint(amount).toLocaleString('en-US')}`;
}

export function canAfford(balance: number, cost: number): boolean {
  const safeBalance = clampUint(balance);
  const safeCost = clampUint(cost);
  if (!Number.isFinite(cost) || cost < 0) return false;
  return safeBalance >= safeCost;
}

export function safeAddCurrency(balance: number, amount: number): number {
  const safeBalance = clampUint(balance);
  const safeAmount = clampUint(amount);
  if (safeBalance >= Number.MAX_SAFE_INTEGER - safeAmount) {
    return Number.MAX_SAFE_INTEGER;
  }
  return safeBalance + safeAmount;
}

export function safeSpendCurrency(
  balance: number,
  cost: number
): { ok: boolean; nextBalance: number } {
  const safeBalance = clampUint(balance);
  if (!Number.isFinite(cost) || cost < 0) {
    return { ok: false, nextBalance: safeBalance };
  }
  const safeCost = clampUint(cost);
  if (safeCost > safeBalance) {
    return { ok: false, nextBalance: safeBalance };
  }
  return { ok: true, nextBalance: safeBalance - safeCost };
}

// --- Default Economy State ---

export function createDefaultHissDepotState(): HissDepotState {
  return {
    incubatorMaxLevel: 0,
    incubatorActiveLevel: 0,
    displaySlotsBought: 0,
    biasCapsBought: {
      dominant: 0,
      codominant: 0,
      recessive: 0,
    },
    biasWeights: {
      dominant: 33.34,
      codominant: 33.33,
      recessive: 33.33,
    },
  };
}

export function createDefaultEconomyState(seed = 101): EconomyState {
  return {
    money: 0,
    totalSnakesSold: 0,
    soldMorphKeys: [],
    sellUnlocked: false,
    jeanPoolIntroSeen: false,
    jeanPool: {
      purchasesCount: 0,
      cooldownRemainingSec: 0,
      stockSeed: seed,
    },
    hissDepot: createDefaultHissDepotState(),
  };
}

// --- Progressive Disclosure Unlock Helpers ---

/** Counts how many snakes share each visual morphKey */
export function getMorphCountMap(snakes: SnakeEntity[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of snakes) {
    counts.set(s.phenotype.morphKey, (counts.get(s.phenotype.morphKey) ?? 0) + 1);
  }
  return counts;
}

/** True whenever at least one morph has an extra beyond a pair (3+ owned/revealed copies) */
export function hasTriplicateMorph(snakes: SnakeEntity[]): boolean {
  const counts = getMorphCountMap(snakes);
  for (const count of counts.values()) {
    if (count >= 3) return true;
  }
  return false;
}

/** The Jean Pool opens immediately after the player completes their first sale */
export function isJeanPoolUnlocked(economy: EconomyState): boolean {
  return economy.totalSnakesSold >= 1 || economy.jeanPool.purchasesCount >= 1;
}

/** The Hiss Depot opens after adopting your first Jean Pool snake (or after 3 sales / existing upgrades) */
export function isHissDepotUnlocked(economy: EconomyState): boolean {
  return (
    economy.jeanPool.purchasesCount >= 1 ||
    economy.totalSnakesSold >= 3 ||
    economy.hissDepot.incubatorMaxLevel > 0 ||
    economy.hissDepot.displaySlotsBought > 0 ||
    economy.hissDepot.biasCapsBought.dominant > 0 ||
    economy.hissDepot.biasCapsBought.codominant > 0 ||
    economy.hissDepot.biasCapsBought.recessive > 0
  );
}

// --- Vigour & Breed Time Calculation ---

export function getMaxVigor(snake: SnakeEntity): number {
  return Math.max(BREED_VIGOR_COST, Math.round(snake.phenotype.lineageVigor));
}

export function canSnakeBreed(snake: SnakeEntity): boolean {
  return snake.currentVigor >= BREED_VIGOR_COST;
}

export function getRecoverySecondsNeeded(snake: SnakeEntity): number {
  const deficit = Math.max(0, BREED_VIGOR_COST - snake.currentVigor);
  if (deficit <= 0) return 0;
  return Math.ceil(deficit / VIGOR_RECOVERY_PER_SEC);
}

/**
 * Computes breed time multiplier X from the lower current vigour of the two breeders
 * compared against BASE_GLOBAL_VIGOR (100), clamped to [0.5, 2.0].
 * Higher vigour => X < 1 (faster); Equal => X = 1; Lower => X > 1 (slower).
 */
export function computeBreedTimeMultiplier(sire: SnakeEntity, dam: SnakeEntity): number {
  const lowerVigor = Math.min(
    Math.max(1, sire.currentVigor),
    Math.max(1, dam.currentVigor)
  );
  const rawX = BASE_GLOBAL_VIGOR / lowerVigor;
  return Math.max(0.5, Math.min(2.0, rawX));
}

export function getActiveClutchConfig(hissDepot: HissDepotState): {
  clutchSize: number;
  baseBreedSec: number;
} {
  const activeLevel = Math.max(
    0,
    Math.min(hissDepot.incubatorMaxLevel, Math.floor(hissDepot.incubatorActiveLevel))
  );
  return {
    clutchSize: BASE_CLUTCH_SIZE + activeLevel,
    baseBreedSec: BASE_BREED_TIME_SEC + activeLevel * 60,
  };
}

export function computePairBreedDurationSec(
  sire: SnakeEntity,
  dam: SnakeEntity,
  hissDepot: HissDepotState
): number {
  const { baseBreedSec } = getActiveClutchConfig(hissDepot);
  const mult = computeBreedTimeMultiplier(sire, dam);
  return Math.max(15, Math.round(baseBreedSec * mult));
}

export function getMaxDisplaySlots(hissDepot: HissDepotState): number {
  return BASE_MAX_DISPLAY_SNAKES + Math.max(0, Math.floor(hissDepot.displaySlotsBought));
}

/** Recovers vigour for snakes not currently actively breeding */
export function recoverSnakesVigor(
  snakes: SnakeEntity[],
  activelyBreedingIds: Set<string>,
  dtSec: number
): SnakeEntity[] {
  if (dtSec <= 0) return snakes;
  let changed = false;
  const gain = VIGOR_RECOVERY_PER_SEC * dtSec;
  const next = snakes.map((snake) => {
    if (activelyBreedingIds.has(snake.id)) return snake;
    const maxV = getMaxVigor(snake);
    if (snake.currentVigor >= maxV) return snake;
    changed = true;
    return {
      ...snake,
      currentVigor: Math.min(maxV, snake.currentVigor + gain),
    };
  });
  return changed ? next : snakes;
}

// --- Valuation, First-Sale Bonus & Last-Two Safety Warnings ---

export interface SaleValuation {
  total: number;
  baseValue: number;
  firstSaleBonus: number;
  isFirstSale: boolean;
}

const RARITY_BASE_VALUE: Record<MorphRarity, number> = {
  common: 18,
  uncommon: 38,
  rare: 82,
  legendary: 165,
};

export function evaluateSnakeSaleValue(
  snake: SnakeEntity,
  soldMorphKeys: Set<string>
): SaleValuation {
  const { phenotype, genotype } = snake;
  const rarityBase = RARITY_BASE_VALUE[phenotype.rarity];
  const geneCountBonus = phenotype.visualGenes.length * 14;
  const multiGeneBonus = phenotype.visualGenes.length >= 3 ? 25 : 0;

  let recessiveVisuals = 0;
  let superVisuals = 0;
  for (const loc of LOCI_ORDER) {
    const c = countAlleles(genotype[loc]);
    const def = LOCUS_DEFINITIONS[loc];
    if (def.mode === 'recessive' && c === 2) recessiveVisuals += 1;
    if (def.mode === 'codominant' && c === 2) superVisuals += 1;
  }

  const comboBonus = recessiveVisuals * 30 + superVisuals * 22;
  const vigorFactor = 0.85 + 0.3 * (phenotype.lineageVigor / BASE_GLOBAL_VIGOR);
  const baseValue = Math.max(
    10,
    clampUint(Math.round((rarityBase + geneCountBonus + multiGeneBonus + comboBonus) * vigorFactor))
  );

  const isFirstSale = !soldMorphKeys.has(phenotype.morphKey);
  const firstSaleBonus = isFirstSale ? Math.max(12, clampUint(Math.round(baseValue * 0.5))) : 0;

  return {
    total: safeAddCurrency(baseValue, firstSaleBonus),
    baseValue,
    firstSaleBonus,
    isFirstSale,
  };
}

export interface SaleWarningAnalysis {
  canSell: boolean;
  hasWarning: boolean;
  reasons: string[];
}

export function analyzeSaleWarnings(
  target: SnakeEntity,
  allSnakes: SnakeEntity[],
  sireId: string,
  damId: string,
  isUnsavedHatchling = false
): SaleWarningAnalysis {
  const reasons: string[] = [];

  if (!isUnsavedHatchling && allSnakes.length <= 2) {
    return {
      canSell: false,
      hasWarning: true,
      reasons: ['You must keep at least 2 snakes to continue breeding.'],
    };
  }

  const combined = isUnsavedHatchling ? [...allSnakes, target] : allSnakes;

  if (!isUnsavedHatchling && allSnakes.length - 1 <= 2) {
    reasons.push('Selling this snake leaves you with your last 2 snakes total.');
  }

  if (!isUnsavedHatchling && (target.id === sireId || target.id === damId)) {
    reasons.push('Currently assigned to your active breeding pair.');
  }

  // Check if selling drops any carried gene (visual or het!) to 1 or 0 remaining carriers
  const endangeredGenes: string[] = [];
  for (const loc of LOCI_ORDER) {
    if (countAlleles(target.genotype[loc]) > 0) {
      let carriers = 0;
      for (const s of combined) {
        if (countAlleles(s.genotype[loc]) > 0) carriers += 1;
      }
      if (carriers <= 2) {
        endangeredGenes.push(`${LOCUS_DEFINITIONS[loc].name} (${carriers} owned)`);
      }
    }
  }
  if (endangeredGenes.length > 0) {
    reasons.push(`One of your last 2 carriers of: ${endangeredGenes.join(', ')}.`);
  }

  // Check if selling one of your last 2 of this visual morph
  const morphMatches = combined.filter(
    (s) => s.phenotype.morphKey === target.phenotype.morphKey
  ).length;
  if (morphMatches <= 2) {
    reasons.push(
      morphMatches === 1
        ? `Your only ${target.phenotype.morphName} snake.`
        : `One of your last 2 ${target.phenotype.morphName} snakes.`
    );
  }

  return {
    canSell: true,
    hasWarning: reasons.length > 0,
    reasons,
  };
}

// --- The Jean Pool (Missing-Gene-Only Breeder Store) ---

export interface JeanPoolOffer {
  offerId: string;
  locusId: LocusId;
  price: number;
  snake: SnakeEntity;
}

export function getMissingLoci(snakes: SnakeEntity[]): LocusId[] {
  return LOCI_ORDER.filter((loc) =>
    snakes.every((s) => countAlleles(s.genotype[loc]) === 0)
  );
}

export function getJeanPoolOfferPrice(locusId: LocusId, purchasesCount: number): number {
  const def = LOCUS_DEFINITIONS[locusId];
  const modeMult = def.mode === 'recessive' ? 1.3 : def.mode === 'codominant' ? 1.1 : 1.0;
  const base = 85 * modeMult;
  return clampUint(Math.round(base * Math.pow(1.45, clampUint(purchasesCount))));
}

function seededRng(seed: number): () => number {
  let state = (Math.floor(seed) || 1) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/**
 * Generates up to 3 purchasable snakes for The Jean Pool, strictly containing
 * ONE missing gene each that the player does not currently possess.
 */
export function buildJeanPoolOffers(
  snakes: SnakeEntity[],
  jeanPool: { purchasesCount: number; stockSeed: number }
): JeanPoolOffer[] {
  const missing = getMissingLoci(snakes);
  if (missing.length === 0) return [];

  const rng = seededRng(jeanPool.stockSeed + jeanPool.purchasesCount * 97);
  const shuffled = [...missing];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const chosenLoci = shuffled.slice(0, 3);
  const existingNames = new Set(snakes.map((s) => s.name));
  const now = Date.now();

  return chosenLoci.map((loc, idx) => {
    const def = LOCUS_DEFINITIONS[loc];
    // Single missing gene: visual [1,1] for recessive, [1,0] for dominant/codominant
    const pair: [0 | 1, 0 | 1] = def.mode === 'recessive' ? [1, 1] : [1, 0];
    const genotype = makeGenotype({ [loc]: pair });
    const polySeed = Number((0.12 + rng() * 0.76).toFixed(4));
    const phenotype = evaluatePhenotype(genotype, polySeed);
    const name = pickCozySnakeName(existingNames, rng);
    existingNames.add(name);
    const price = getJeanPoolOfferPrice(loc, jeanPool.purchasesCount);

    const snake: SnakeEntity = {
      id: `jeanpool_${jeanPool.stockSeed}_${loc}_${idx}`,
      name,
      genotype,
      polygenicSeed: polySeed,
      phenotype,
      currentVigor: phenotype.lineageVigor,
      onDisplay: false,
      hatchedAt: now + idx,
      generation: 1,
      sire: null,
      dam: null,
      hatchOdds: 1,
      hatchOddsLabel: 'Jean Pool',
      wasMutation: false,
      petCount: 0,
    };

    return {
      offerId: `offer_${jeanPool.stockSeed}_${loc}`,
      locusId: loc,
      price,
      snake,
    };
  });
}

// --- The Hiss Depot (Exponential Per-Upgrade Pricing + Self-Balancing Gene Bias) ---

export function getIncubatorUpgradePrice(currentMaxLevel: number): number {
  return clampUint(Math.round(95 * Math.pow(1.9, clampUint(currentMaxLevel))));
}

export function getDisplaySlotUpgradePrice(slotsBought: number): number {
  return clampUint(Math.round(130 * Math.pow(1.95, clampUint(slotsBought))));
}

export function getBiasCapUpgradePrice(categoryPurchases: number): number {
  return clampUint(Math.round(100 * Math.pow(1.85, clampUint(categoryPurchases))));
}

/** Maximum percentage a category can be raised to (baseline 33.33% + 10% per upgrade) */
export function getCategoryMaxBiasWeight(capsBought: number): number {
  return Math.min(80, Number((100 / 3 + clampUint(capsBought) * 10).toFixed(2)));
}

/**
 * Self-balancing gene bias adjustment:
 * Raising or lowering `targetMode` stays within [5, maxAllowed] and automatically
 * scales the other two categories proportionally so the three always sum to 100.
 */
export function adjustGeneBiasWeights(
  current: GeneBiasDistribution,
  capsBought: { dominant: number; codominant: number; recessive: number },
  targetMode: InheritanceMode,
  desiredValue: number
): GeneBiasDistribution {
  const maxAllowed = getCategoryMaxBiasWeight(capsBought[targetMode]);
  const clampedTarget = Math.max(5, Math.min(maxAllowed, desiredValue));

  const others: InheritanceMode[] = (['dominant', 'codominant', 'recessive'] as InheritanceMode[]).filter(
    (m) => m !== targetMode
  );
  const remaining = Math.max(10, 100 - clampedTarget);
  const otherSum = current[others[0]] + current[others[1]];

  let o0: number;
  let o1: number;
  if (otherSum <= 0.001) {
    o0 = remaining / 2;
    o1 = remaining / 2;
  } else {
    o0 = (current[others[0]] / otherSum) * remaining;
    o1 = remaining - o0;
  }

  // Respect minimum floor 5% for each other category and each category's own cap
  const clampPair = (a: number, b: number, maxA: number, maxB: number): [number, number] => {
    let va = Math.max(5, Math.min(maxA, a));
    let vb = remaining - va;
    if (vb < 5) {
      vb = 5;
      va = remaining - vb;
    } else if (vb > maxB) {
      vb = maxB;
      va = remaining - vb;
    }
    return [va, vb];
  };

  [o0, o1] = clampPair(
    o0,
    o1,
    getCategoryMaxBiasWeight(capsBought[others[0]]),
    getCategoryMaxBiasWeight(capsBought[others[1]])
  );

  const finalTarget = Math.max(5, 100 - o0 - o1);

  return {
    dominant: Number(
      (targetMode === 'dominant' ? finalTarget : others[0] === 'dominant' ? o0 : o1).toFixed(2)
    ),
    codominant: Number(
      (targetMode === 'codominant' ? finalTarget : others[0] === 'codominant' ? o0 : o1).toFixed(2)
    ),
    recessive: Number(
      (targetMode === 'recessive' ? finalTarget : others[0] === 'recessive' ? o0 : o1).toFixed(2)
    ),
  };
}
