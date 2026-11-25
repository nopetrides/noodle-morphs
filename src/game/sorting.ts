import { computeBreedingPreview } from './genetics';
import type { MorphDiscovery, MorphRarity, SnakeEntity } from './types';

export type CollectionSortMode =
  | 'newest'
  | 'name'
  | 'morph'
  | 'rarity'
  | 'display'
  | 'undiscovered-sire'
  | 'undiscovered-dam';

export type MorphdexSortMode = 'newest' | 'morph' | 'rarity' | 'count';

export type ParentSortMode = 'newest' | 'undiscovered' | 'name' | 'morph' | 'rarity';

const RARITY_RANK: Record<MorphRarity, number> = {
  legendary: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
};

/**
 * Counts how many undiscovered Mendelian morph outcomes a candidate × partner pair can produce.
 * Returns 0 if candidate and partner are the same snake.
 */
export function countUndiscoveredChildren(
  candidate: SnakeEntity,
  partner: SnakeEntity | null | undefined,
  discoveredKeys: Set<string>
): number {
  if (!partner || candidate.id === partner.id) return 0;
  const preview = computeBreedingPreview(candidate, partner, discoveredKeys);
  let count = 0;
  for (const entry of preview) {
    if (!entry.isDiscovered) count += 1;
  }
  return count;
}

/**
 * Builds a lookup map of snakeId -> undiscovered offspring count when paired with `partner`.
 */
export function buildUndiscoveredChildrenMap(
  snakes: SnakeEntity[],
  partner: SnakeEntity | null | undefined,
  discoveredKeys: Set<string>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const snake of snakes) {
    map.set(snake.id, countUndiscoveredChildren(snake, partner, discoveredKeys));
  }
  return map;
}

export function sortCollectionSnakes(
  snakes: SnakeEntity[],
  mode: CollectionSortMode,
  options?: {
    sire?: SnakeEntity | null;
    dam?: SnakeEntity | null;
    discoveredKeys?: Set<string>;
  }
): SnakeEntity[] {
  const copy = [...snakes];
  const discoveredKeys = options?.discoveredKeys ?? new Set<string>();

  if (mode === 'undiscovered-sire' || mode === 'undiscovered-dam') {
    const partner = mode === 'undiscovered-sire' ? options?.sire : options?.dam;
    const scoreMap = buildUndiscoveredChildrenMap(copy, partner, discoveredKeys);
    return copy.sort((a, b) => {
      const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      const rarityDiff = RARITY_RANK[b.phenotype.rarity] - RARITY_RANK[a.phenotype.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      return a.name.localeCompare(b.name);
    });
  }

  return copy.sort((a, b) => {
    switch (mode) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'morph': {
        const m = a.phenotype.morphName.localeCompare(b.phenotype.morphName);
        return m !== 0 ? m : a.name.localeCompare(b.name);
      }
      case 'rarity': {
        const r = RARITY_RANK[b.phenotype.rarity] - RARITY_RANK[a.phenotype.rarity];
        if (r !== 0) return r;
        const m = a.phenotype.morphName.localeCompare(b.phenotype.morphName);
        return m !== 0 ? m : a.name.localeCompare(b.name);
      }
      case 'display': {
        if (a.onDisplay !== b.onDisplay) return a.onDisplay ? -1 : 1;
        return b.hatchedAt - a.hatchedAt;
      }
      case 'newest':
      default:
        return b.hatchedAt - a.hatchedAt;
    }
  });
}

export function sortMorphDiscoveries(
  discoveries: MorphDiscovery[],
  mode: MorphdexSortMode
): MorphDiscovery[] {
  const copy = [...discoveries];
  return copy.sort((a, b) => {
    switch (mode) {
      case 'morph':
        return a.morphName.localeCompare(b.morphName);
      case 'rarity': {
        const r = RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity];
        return r !== 0 ? r : a.morphName.localeCompare(b.morphName);
      }
      case 'count': {
        const c = b.countHatched - a.countHatched;
        return c !== 0 ? c : a.morphName.localeCompare(b.morphName);
      }
      case 'newest':
      default:
        return b.firstDiscoveredAt - a.firstDiscoveredAt;
    }
  });
}

export function sortParentCandidates(
  candidates: SnakeEntity[],
  mode: ParentSortMode,
  partner: SnakeEntity | null | undefined,
  discoveredKeys: Set<string>
): SnakeEntity[] {
  const copy = [...candidates];

  if (mode === 'undiscovered') {
    const scoreMap = buildUndiscoveredChildrenMap(copy, partner, discoveredKeys);
    return copy.sort((a, b) => {
      // Keep the disabled currently-selected partner at the bottom
      if (partner) {
        if (a.id === partner.id) return 1;
        if (b.id === partner.id) return -1;
      }
      const diff = (scoreMap.get(b.id) ?? 0) - (scoreMap.get(a.id) ?? 0);
      if (diff !== 0) return diff;
      const r = RARITY_RANK[b.phenotype.rarity] - RARITY_RANK[a.phenotype.rarity];
      if (r !== 0) return r;
      return a.name.localeCompare(b.name);
    });
  }

  return copy.sort((a, b) => {
    switch (mode) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'morph': {
        const m = a.phenotype.morphName.localeCompare(b.phenotype.morphName);
        return m !== 0 ? m : a.name.localeCompare(b.name);
      }
      case 'rarity': {
        const r = RARITY_RANK[b.phenotype.rarity] - RARITY_RANK[a.phenotype.rarity];
        return r !== 0 ? r : a.name.localeCompare(b.name);
      }
      case 'newest':
      default:
        return b.hatchedAt - a.hatchedAt;
    }
  });
}
