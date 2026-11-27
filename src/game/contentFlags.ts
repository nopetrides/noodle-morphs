/**
 * Bitmask flags governing which gene packs and game systems are active in a save.
 * Designed for future content expansions (e.g. Seasonal, Cosmetics, Hats, Challenge modes).
 */
export enum ContentFlag {
  None = 0,
  /** Core real-world Ball Python genetics */
  RealMorphs = 1 << 0,
  /** Fun / Custom Morpharium original genes & elemental fusions */
  CustomMorphs = 1 << 1,
  /** The Jean Pool missing-gene breeder shop & intro tutorial */
  JeanPool = 1 << 2,
  /** The Hiss Depot vivarium upgrades (incubator, display slots, gene bias) */
  HissDepot = 1 << 3,
  // Reserved expansion slots for future updates:
  // Seasonal = 1 << 4,
  // Cosmetics = 1 << 5,
  // Hats = 1 << 6,
}

export type GameModeId = 'real_only' | 'real_plus_fun';

export type SaveSlotId = 1 | 2 | 3;

export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [1, 2, 3];

export interface GameConfig {
  mode: GameModeId;
  /** Bitmask of ContentFlag values */
  contentFlags: number;
  /** Optional list of enabled Steam Workshop / local Gene Pack IDs for this save */
  enabledModPacks?: string[];
}

export const DEFAULT_CONTENT_FLAGS: number =
  ContentFlag.RealMorphs |
  ContentFlag.CustomMorphs |
  ContentFlag.JeanPool |
  ContentFlag.HissDepot;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mode: 'real_plus_fun',
  contentFlags: DEFAULT_CONTENT_FLAGS,
};

export function hasContentFlag(flags: number, flag: ContentFlag): boolean {
  return (flags & flag) === flag;
}

export function setContentFlag(flags: number, flag: ContentFlag, enabled: boolean): number {
  return enabled ? flags | flag : flags & ~flag;
}

export function createGameConfigForMode(
  mode: GameModeId,
  options?: {
    jeanPool?: boolean;
    hissDepot?: boolean;
    enabledModPacks?: string[];
  }
): GameConfig {
  let flags = ContentFlag.RealMorphs;
  if (mode === 'real_plus_fun') {
    flags = setContentFlag(flags, ContentFlag.CustomMorphs, true);
  }
  if (options?.jeanPool ?? true) {
    flags = setContentFlag(flags, ContentFlag.JeanPool, true);
  }
  if (options?.hissDepot ?? true) {
    flags = setContentFlag(flags, ContentFlag.HissDepot, true);
  }
  const packs = normalizePackIdList(options?.enabledModPacks);
  return packs.length > 0 ? { mode, contentFlags: flags, enabledModPacks: packs } : { mode, contentFlags: flags };
}

function normalizePackIdList(raw?: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0 && !seen.has(trimmed)) {
        seen.add(trimmed);
        out.push(trimmed);
      }
    }
  }
  out.sort();
  return out;
}

export function normalizeGameConfig(raw?: Partial<GameConfig> | null): GameConfig {
  if (!raw || typeof raw.contentFlags !== 'number') {
    return { ...DEFAULT_GAME_CONFIG };
  }
  // Always ensure RealMorphs base core is present
  let flags = raw.contentFlags | ContentFlag.RealMorphs;
  const mode: GameModeId =
    raw.mode === 'real_only' || raw.mode === 'real_plus_fun'
      ? raw.mode
      : hasContentFlag(flags, ContentFlag.CustomMorphs)
        ? 'real_plus_fun'
        : 'real_only';
  if (mode === 'real_only') {
    flags = setContentFlag(flags, ContentFlag.CustomMorphs, false);
  }
  const enabledModPacks = normalizePackIdList(raw.enabledModPacks);
  return enabledModPacks.length > 0
    ? { mode, contentFlags: flags, enabledModPacks }
    : { mode, contentFlags: flags };
}

export function getGameModeLabel(mode: GameModeId): string {
  return mode === 'real_only' ? 'Real Morphs Only' : 'Real + Fun';
}
