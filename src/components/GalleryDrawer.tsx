import { useMemo, useState } from 'react';
import { ArrowUpDown, Check, DollarSign, Eye, EyeOff, Pencil, Sparkles, X } from 'lucide-react';
import {
  analyzeSaleWarnings,
  canSnakeBreed,
  evaluateSnakeSaleValue,
  formatCurrency,
  getMaxVigor,
  getMorphCountMap,
  getRecoverySecondsNeeded,
  hasTriplicateMorph,
  isHissDepotUnlocked,
  isJeanPoolUnlocked,
  type JeanPoolOffer,
} from '../game/economy';
import {
  computeBreedingPreview,
  formatMutationOddsText,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
} from '../game/genetics';
import {
  buildUndiscoveredChildrenMap,
  type CollectionSortMode,
  type MorphdexSortMode,
  type ParentSortMode,
  sortCollectionSnakes,
  sortMorphDiscoveries,
  sortParentCandidates,
} from '../game/sorting';
import type {
  ActiveDrawerTab,
  EconomyState,
  InheritanceMode,
  MorphDiscovery,
  MorphTag,
  SnakeEntity,
} from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';
import { MorphSimulatorPanel } from './MorphSimulatorPanel';
import { HissDepotPanel, JeanPoolPanel } from './ShopsPanel';

interface GalleryDrawerProps {
  activeTab: ActiveDrawerTab;
  snakes: SnakeEntity[];
  discoveries: Record<string, MorphDiscovery>;
  sireId: string;
  damId: string;
  maxDisplay: number;
  clutchesHatched: number;
  economy: EconomyState;
  onChangeTab: (tab: ActiveDrawerTab) => void;
  onClose: () => void;
  onToggleDisplay: (snakeId: string) => void;
  onRenameSnake: (snakeId: string, newName: string) => void;
  onAssignParent: (role: 'sire' | 'dam', snakeId: string) => void;
  onRequestSellSnake: (snake: SnakeEntity) => void;
  onBuyJeanPoolOffer: (offer: JeanPoolOffer) => void;
  onBuyIncubatorUpgrade: () => void;
  onSetIncubatorActive: (level: number) => void;
  onBuyDisplaySlot: () => void;
  onBuyBiasCap: (mode: InheritanceMode) => void;
  onAdjustBiasWeight: (mode: InheritanceMode, value: number) => void;
  onResetBiasWeights: () => void;
  onDebugAddSnake: (snake: SnakeEntity) => void;
}

const MORPH_TAGS: MorphTag[] = [
  'Color',
  'Pattern',
  'Light',
  'Dark',
  'High-White',
  'Complex',
  'Wobble',
  'Custom',
];

export function GalleryDrawer({
  activeTab,
  snakes,
  discoveries,
  sireId,
  damId,
  maxDisplay,
  clutchesHatched,
  economy,
  onChangeTab,
  onClose,
  onToggleDisplay,
  onRenameSnake,
  onAssignParent,
  onRequestSellSnake,
  onBuyJeanPoolOffer,
  onBuyIncubatorUpgrade,
  onSetIncubatorActive,
  onBuyDisplaySlot,
  onBuyBiasCap,
  onAdjustBiasWeight,
  onResetBiasWeights,
  onDebugAddSnake,
}: GalleryDrawerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [collectionSort, setCollectionSort] = useState<CollectionSortMode>('newest');
  const [morphdexSort, setMorphdexSort] = useState<MorphdexSortMode>('newest');
  const [morphdexTagFilter, setMorphdexTagFilter] = useState<MorphTag | 'all'>('all');
  const [refModeFilter, setRefModeFilter] = useState<InheritanceMode | 'all' | 'custom'>('all');
  const [parentSort, setParentSort] = useState<ParentSortMode>('undiscovered');
  const [showAllBreedingOdds, setShowAllBreedingOdds] = useState(false);

  const displayedCount = snakes.filter((s) => s.onDisplay).length;
  const discoveredKeys = useMemo(() => new Set(Object.keys(discoveries)), [discoveries]);
  const soldMorphKeys = useMemo(() => new Set(economy.soldMorphKeys), [economy.soldMorphKeys]);
  const jeanPoolUnlocked = isJeanPoolUnlocked(economy);
  const hissDepotUnlocked = isHissDepotUnlocked(economy);
  const sellUnlocked = economy.sellUnlocked || hasTriplicateMorph(snakes);
  const showSellTutorial = sellUnlocked && economy.totalSnakesSold === 0;
  const morphCounts = useMemo(() => getMorphCountMap(snakes), [snakes]);
  const firstExtraCollectionSnakeId = useMemo(() => {
    if (!showSellTutorial) return null;
    const found = snakes.find((s) => (morphCounts.get(s.phenotype.morphKey) ?? 0) >= 3);
    return found?.id ?? null;
  }, [showSellTutorial, snakes, morphCounts]);

  const sire = snakes.find((s) => s.id === sireId) ?? snakes[0];
  const dam = snakes.find((s) => s.id === damId) ?? snakes[1] ?? snakes[0];

  const sortedCollection = useMemo(
    () =>
      sortCollectionSnakes(snakes, collectionSort, {
        sire,
        dam,
        discoveredKeys,
      }),
    [snakes, collectionSort, sire, dam, discoveredKeys]
  );

  const collectionPartnerScoreMap = useMemo(() => {
    if (collectionSort === 'undiscovered-sire') {
      return buildUndiscoveredChildrenMap(snakes, sire, discoveredKeys);
    }
    if (collectionSort === 'undiscovered-dam') {
      return buildUndiscoveredChildrenMap(snakes, dam, discoveredKeys);
    }
    return null;
  }, [snakes, collectionSort, sire, dam, discoveredKeys]);

  const discoveredList = useMemo(() => {
    const all = sortMorphDiscoveries(Object.values(discoveries), morphdexSort);
    if (morphdexTagFilter === 'all') return all;
    return all.filter((d) => d.tags?.includes(morphdexTagFilter));
  }, [discoveries, morphdexSort, morphdexTagFilter]);

  const sireCandidates = useMemo(
    () => sortParentCandidates(snakes, parentSort, dam, discoveredKeys),
    [snakes, parentSort, dam, discoveredKeys]
  );
  const damCandidates = useMemo(
    () => sortParentCandidates(snakes, parentSort, sire, discoveredKeys),
    [snakes, parentSort, sire, discoveredKeys]
  );
  const sireUndiscoveredMap = useMemo(
    () => buildUndiscoveredChildrenMap(snakes, dam, discoveredKeys),
    [snakes, dam, discoveredKeys]
  );
  const damUndiscoveredMap = useMemo(
    () => buildUndiscoveredChildrenMap(snakes, sire, discoveredKeys),
    [snakes, sire, discoveredKeys]
  );

  const breedingPreview = useMemo(
    () => computeBreedingPreview(sire, dam, discoveredKeys, economy.hissDepot.biasWeights),
    [sire, dam, discoveredKeys, economy.hissDepot.biasWeights]
  );

  const undiscoveredBreedingCount = useMemo(
    () => breedingPreview.filter((e) => !e.isDiscovered).length,
    [breedingPreview]
  );

  const visibleBreedingPreview = useMemo(
    () => (showAllBreedingOdds ? breedingPreview : breedingPreview.slice(0, 6)),
    [breedingPreview, showAllBreedingOdds]
  );
  const hiddenBreedingOddsCount = Math.max(0, breedingPreview.length - visibleBreedingPreview.length);
  const mutationOddsText = formatMutationOddsText();

  const startEditing = (snake: SnakeEntity) => {
    setEditingId(snake.id);
    setDraftName(snake.name);
  };

  const commitRename = (snakeId: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onRenameSnake(snakeId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Morpharium Field Guide"
      data-testid="gallery-drawer"
      className="fixed inset-0 z-30 flex items-center justify-center p-2.5 sm:p-6 bg-[#110D0A]/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-[#1E1914] border border-[#D8BC87]/35 shadow-2xl shadow-black/70 overflow-hidden">
        {/* Top Drawer Navigation Bar */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 sm:py-4 border-b border-[#D8BC87]/20 bg-[#181410]">
          <div className="dock-scroll flex items-center gap-1 p-1 rounded-lg bg-[#27201A] overflow-x-auto min-w-0">
            <button
              type="button"
              onClick={() => onChangeTab('collection')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'collection'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'text-[#C8BAA5] hover:text-[#F5EFE4]'
              }`}
            >
              Collection ({snakes.length})
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('breeding')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'breeding'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'text-[#C8BAA5] hover:text-[#F5EFE4]'
              }`}
            >
              Breeding Pair
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('morphdex')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'morphdex'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'text-[#C8BAA5] hover:text-[#F5EFE4]'
              }`}
            >
              Morphdex ({Object.keys(discoveries).length})
            </button>
            <button
              type="button"
              data-testid="drawer-tab-simulator"
              onClick={() => onChangeTab('simulator')}
              className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'text-[#C8BAA5] hover:text-[#F5EFE4]'
              }`}
            >
              Simulator
            </button>
            {jeanPoolUnlocked && (
              <button
                type="button"
                onClick={() => onChangeTab('jeanpool')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'jeanpool'
                    ? 'bg-[#D9A754] text-[#1C1610]'
                    : 'text-[#B7D2F0] hover:text-[#F5EFE4]'
                }`}
              >
                The Jean Pool
              </button>
            )}
            {hissDepotUnlocked && (
              <button
                type="button"
                onClick={() => onChangeTab('hissdepot')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'hissdepot'
                    ? 'bg-[#D9A754] text-[#1C1610]'
                    : 'text-[#F5B47C] hover:text-[#F5EFE4]'
                }`}
              >
                The Hiss Depot
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {(sellUnlocked || economy.money > 0 || economy.totalSnakesSold > 0) && (
              <span className="hidden lg:inline font-mono-code text-xs text-[#E9C16E] tabular-nums">
                {formatCurrency(economy.money)}
              </span>
            )}
            <span className="hidden xl:inline text-xs text-[#AE9F8C] tabular-nums">
              Display {displayedCount}/{maxDisplay} · {clutchesHatched} clutches
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close field guide"
              className="p-2 rounded-lg text-[#BFB19E] hover:text-[#F5EFE4] hover:bg-[#2C241D] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'collection' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#B3A490]">
                  Manage display snakes, custom names, vigour, selling, and breeding parents.
                </p>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#A89A87]" aria-hidden="true" />
                  <label htmlFor="collection-sort" className="text-xs text-[#BFB19E]">
                    Sort by
                  </label>
                  <select
                    id="collection-sort"
                    value={collectionSort}
                    onChange={(e) => setCollectionSort(e.target.value as CollectionSortMode)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#27201A] border border-[#D8BC87]/25 text-xs text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                  >
                    <option value="newest">Newest First</option>
                    <option value="name">Name (A–Z)</option>
                    <option value="morph">Morph (A–Z)</option>
                    <option value="rarity">Rarity (Rarest First)</option>
                    <option value="display">On Display First</option>
                    <option value="undiscovered-sire">
                      Undiscovered Children w/ {sire.name}
                    </option>
                    <option value="undiscovered-dam">
                      Undiscovered Children w/ {dam.name}
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedCollection.map((snake) => {
                  const isSire = snake.id === sireId;
                  const isDam = snake.id === damId;
                  const canHide = displayedCount > 1;
                  const canShow = displayedCount < maxDisplay;
                  const partnerUndiscovered = collectionPartnerScoreMap?.get(snake.id);
                  const partnerLabel =
                    collectionSort === 'undiscovered-sire' ? sire.name : dam.name;
                  const maxVigor = getMaxVigor(snake);
                  const vigorPct = Math.max(0, Math.min(100, (snake.currentVigor / maxVigor) * 100));
                  const recovering = !canSnakeBreed(snake);

                  const valuation = evaluateSnakeSaleValue(snake, soldMorphKeys);
                  const warnings = analyzeSaleWarnings(snake, snakes, sireId, damId, false);

                  return (
                    <article
                      key={snake.id}
                      className="rounded-xl bg-[#251F19] border border-[#D8BC87]/20 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="min-w-0 flex-1">
                            {editingId === snake.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  commitRename(snake.id);
                                }}
                                className="flex items-center gap-1.5"
                              >
                                <label htmlFor={`rename-${snake.id}`} className="sr-only">
                                  Custom name for {snake.name}
                                </label>
                                <input
                                  id={`rename-${snake.id}`}
                                  type="text"
                                  maxLength={24}
                                  value={draftName}
                                  onChange={(e) => setDraftName(e.target.value)}
                                  autoFocus
                                  className="w-full px-2 py-1 rounded bg-[#1A1511] border border-[#D9A754] text-sm text-[#F5EFE4] focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  aria-label={`Save name for ${snake.name}`}
                                  className="p-1.5 rounded bg-[#D9A754] text-[#1C1610] cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </form>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-display text-base font-semibold text-[#F7F1E5] truncate">
                                  {snake.name}
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => startEditing(snake)}
                                  aria-label={`Rename ${snake.name}`}
                                  className="p-1 rounded text-[#A99A86] hover:text-[#F5EFE4] cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <p className="text-xs text-[#E4BE74] font-medium">
                              {snake.phenotype.morphName}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onToggleDisplay(snake.id)}
                            disabled={snake.onDisplay ? !canHide : !canShow}
                            aria-label={
                              snake.onDisplay
                                ? `Remove ${snake.name} from terrarium display`
                                : `Display ${snake.name} in terrarium`
                            }
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0 ${
                              snake.onDisplay
                                ? 'bg-[#364A35] text-[#DFF0DA] border border-[#6C9668]/45'
                                : 'bg-[#2E2720] hover:bg-[#3A3128] text-[#C8BAA5]'
                            }`}
                          >
                            {snake.onDisplay ? (
                              <>
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>On Display</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Resting</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="mb-3 flex justify-center">
                          <MiniSnakeCanvas
                            phenotype={snake.phenotype}
                            width={250}
                            height={92}
                            animate={false}
                          />
                        </div>

                        {/* Vigour meter */}
                        <div className="mb-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className={recovering ? 'text-[#E6A382]' : 'text-[#B3A490]'}>
                              {recovering
                                ? `Recovering (${getRecoverySecondsNeeded(snake)}s)`
                                : 'Breeding Vigour'}
                            </span>
                            <span className="font-mono-code text-[#DFD3C2] tabular-nums">
                              {Math.round(snake.currentVigor)}/{maxVigor}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[#362E26] overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                recovering ? 'bg-[#D97762]' : 'bg-[#73B891]'
                              }`}
                              style={{ width: `${vigorPct}%` }}
                            />
                          </div>
                        </div>

                        <div className="text-xs text-[#C2B4A1] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-code text-[11px] text-[#DFC086] flex items-center gap-1.5 flex-wrap">
                              <span>{snake.phenotype.patternRule.formula}</span>
                              {snake.phenotype.isCustomMorph && (
                                <span className="font-sans text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                                  Custom
                                </span>
                              )}
                            </span>
                            <span className="font-mono-code text-[11px] text-[#A89A87] shrink-0">
                              {snake.phenotype.patternRule.glyph}
                            </span>
                          </div>

                          {snake.phenotype.hetGenes.length > 0 && (
                            <div className="text-[11px] text-[#B8A994]">
                              Het carriers: {snake.phenotype.hetGenes.join(', ')}
                            </div>
                          )}

                          <div className="text-[11px] text-[#A89A87]">
                            {snake.sire && snake.dam
                              ? `Parents: ${snake.sire.name} (${snake.sire.morphName}) × ${snake.dam.name} (${snake.dam.morphName})`
                              : `Founder Ball Python · Gen ${snake.generation}`}
                          </div>

                          {snake.phenotype.isUpsideDown && (
                            <div className="text-[11px] text-[#E6A382]">
                              Upside-down Spider posture · Max Vigour {maxVigor}
                            </div>
                          )}

                          {collectionPartnerScoreMap &&
                            partnerUndiscovered !== undefined &&
                            !(
                              (collectionSort === 'undiscovered-sire' && isSire) ||
                              (collectionSort === 'undiscovered-dam' && isDam)
                            ) && (
                              <div
                                className={`text-[11px] font-medium tabular-nums ${
                                  partnerUndiscovered > 0 ? 'text-[#E9C16E]' : 'text-[#9E8F7B]'
                                }`}
                              >
                                {partnerUndiscovered} undiscovered{' '}
                                {partnerUndiscovered === 1 ? 'child' : 'children'} with{' '}
                                {partnerLabel}
                              </div>
                            )}
                        </div>
                      </div>

                      <div className="space-y-2 pt-2.5 border-t border-[#D8BC87]/15">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onAssignParent('sire', snake.id)}
                            disabled={isSire || isDam}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                              isSire
                                ? 'bg-[#3C3124] text-[#E4BE74]'
                                : 'bg-[#2E2720] hover:bg-[#3A3128] text-[#E6DAC8] disabled:opacity-40 cursor-pointer'
                            }`}
                          >
                            {isSire ? 'Parent A ✓' : 'Set Parent A'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onAssignParent('dam', snake.id)}
                            disabled={isDam || isSire}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                              isDam
                                ? 'bg-[#3C3124] text-[#E4BE74]'
                                : 'bg-[#2E2720] hover:bg-[#3A3128] text-[#E6DAC8] disabled:opacity-40 cursor-pointer'
                            }`}
                          >
                            {isDam ? 'Parent B ✓' : 'Set Parent B'}
                          </button>
                        </div>

                        {/* Sell button: hidden until first extra morph is born; highlighted with tutorial before first sale */}
                        {sellUnlocked && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              {valuation.isFirstSale ? (
                                <span className="text-[11px] font-medium text-[#E9C16E]">
                                  First-sale bonus included
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#8F806E]">
                                  Value {formatCurrency(valuation.total)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onRequestSellSnake(snake)}
                                data-testid={`sell-snake-${snake.id}`}
                                className={
                                  firstExtraCollectionSnakeId === snake.id
                                    ? 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] ring-2 ring-[#F7DC9A] ring-offset-2 ring-offset-[#262019] shadow-md shadow-[#D9A754]/30 cursor-pointer transition-all whitespace-nowrap'
                                    : warnings.hasWarning
                                      ? 'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#4B2320] hover:bg-[#612B27] text-[#F7B6B0] border border-[#D96B61]/45 cursor-pointer transition-colors whitespace-nowrap'
                                      : 'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2E4637] hover:bg-[#3A5A46] text-[#D2F2DD] border border-[#65A37D]/40 cursor-pointer transition-colors whitespace-nowrap'
                                }
                              >
                                <DollarSign className="w-3 h-3" aria-hidden="true" />
                                <span>Sell {formatCurrency(valuation.total)}</span>
                              </button>
                            </div>
                            {firstExtraCollectionSnakeId === snake.id && (
                              <div
                                data-testid="collection-sell-tutorial"
                                className="rounded-lg bg-[#342919] border border-[#E9C16E]/55 px-2.5 py-1.5 text-[11px] font-medium text-[#F7E0AE] flex items-center gap-1.5"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-[#E9C16E] shrink-0" aria-hidden="true" />
                                <span>Sell extras of morphs to help fund your vivarium.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'breeding' && (
            <div className="space-y-5">
              {/* Parent Select Sort Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#B3A490]">
                  Choose any two snakes to preview Mendelian odds and undiscovered morph potential.
                </p>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-3.5 h-3.5 text-[#A89A87]" aria-hidden="true" />
                  <label htmlFor="breeding-parent-sort" className="text-xs text-[#BFB19E]">
                    Sort parents
                  </label>
                  <select
                    id="breeding-parent-sort"
                    value={parentSort}
                    onChange={(e) => setParentSort(e.target.value as ParentSortMode)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#27201A] border border-[#D8BC87]/25 text-xs text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                  >
                    <option value="undiscovered">Undiscovered Offspring</option>
                    <option value="newest">Newest First</option>
                    <option value="name">Name (A–Z)</option>
                    <option value="morph">Morph (A–Z)</option>
                    <option value="rarity">Rarity (Rarest First)</option>
                  </select>
                </div>
              </div>

              {/* Parent Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    label: 'Parent A (Sire)',
                    role: 'sire' as const,
                    snake: sire,
                    otherId: dam.id,
                    candidates: sireCandidates,
                    scoreMap: sireUndiscoveredMap,
                  },
                  {
                    label: 'Parent B (Dam)',
                    role: 'dam' as const,
                    snake: dam,
                    otherId: sire.id,
                    candidates: damCandidates,
                    scoreMap: damUndiscoveredMap,
                  },
                ].map(({ label, role, snake, otherId, candidates, scoreMap }) => (
                  <div
                    key={role}
                    className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={`breed-${role}`} className="text-xs font-semibold text-[#C8B9A4]">
                        {label}
                      </label>
                      <span className="text-xs text-[#E4BE74] font-medium">
                        {snake.phenotype.morphName} · Vigour {Math.round(snake.currentVigor)}/{getMaxVigor(snake)}
                      </span>
                    </div>

                    <select
                      id={`breed-${role}`}
                      value={snake.id}
                      onChange={(e) => onAssignParent(role, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#1A1511] border border-[#D8BC87]/30 text-sm text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                    >
                      {candidates.map((opt) => {
                        const newCount = opt.id === otherId ? 0 : (scoreMap.get(opt.id) ?? 0);
                        return (
                          <option key={opt.id} value={opt.id} disabled={opt.id === otherId}>
                            {opt.name} — {opt.phenotype.morphName}
                            {opt.phenotype.hetGenes.length > 0
                              ? ` (Het ${opt.phenotype.hetGenes.join(', ')})`
                              : ''}
                            {!canSnakeBreed(opt) ? ' [Recovering]' : ''}
                            {newCount > 0 ? ` · +${newCount} new` : ''}
                          </option>
                        );
                      })}
                    </select>

                    <div className="flex justify-center">
                      <MiniSnakeCanvas phenotype={snake.phenotype} width={300} height={100} animate />
                    </div>

                    <div className="text-xs text-[#BFB19E] flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-code text-[11px] text-[#E0C287]">
                        {snake.phenotype.patternRule.formula}
                      </span>
                      <span>
                        {snake.phenotype.hetGenes.length > 0
                          ? `Carries Het ${snake.phenotype.hetGenes.join(', ')}`
                          : 'No hidden recessive hets'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Punnett Square Odds Table */}
              <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-5">
                <div
                  data-testid="breeding-undiscovered-count"
                  className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[#D8BC87]/15"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        undiscoveredBreedingCount > 0 ? 'text-[#E9C16E]' : 'text-[#A89A87]'
                      }`}
                    >
                      {undiscoveredBreedingCount}{' '}
                      {undiscoveredBreedingCount === 1
                        ? 'undiscovered combination'
                        : 'undiscovered combinations'}
                    </span>
                    <span className="text-xs text-[#B3A490] tabular-nums">
                      ({breedingPreview.length} Mendelian outcomes)
                    </span>
                  </div>
                  <span
                    data-testid="breeding-mutation-odds"
                    className="font-mono-code text-xs text-[#E2B86B] tabular-nums"
                  >
                    Mutation odds: {mutationOddsText} / egg
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="font-display text-base font-semibold text-[#F7F1E5]">
                    Expected Odds
                  </h3>
                  <span className="text-xs text-[#9E8F7B]">
                    Undiscovered morphs remain hidden as ??? until hatched
                  </span>
                </div>

                <div className="divide-y divide-[#D8BC87]/12">
                  {visibleBreedingPreview.map((entry) => (
                    <div
                      key={entry.morphKey}
                      className="py-2.5 flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="min-w-0">
                        <span
                          className={
                            entry.isDiscovered
                              ? 'font-medium text-[#F5EFE4]'
                              : 'font-mono-code font-semibold tracking-wider text-[#E9C16E]'
                          }
                        >
                          {entry.isDiscovered ? entry.morphName : '???'}
                        </span>
                        {!entry.isDiscovered && (
                          <span className="ml-2 text-xs font-medium text-[#C8A662]">
                            Undiscovered
                          </span>
                        )}
                        {entry.isDiscovered && entry.includesUpsideDown && (
                          <span className="ml-2 text-xs text-[#E5A280]">
                            · Upside-down Spider trait
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block w-28 h-1.5 rounded-full bg-[#362E26] overflow-hidden">
                          <div
                            className="h-full bg-[#D9A754]"
                            style={{ width: `${Math.max(4, Math.round(entry.probability * 100))}%` }}
                          />
                        </div>
                        <span className="font-mono-code text-xs text-[#E2C894] tabular-nums w-28 text-right">
                          {entry.oddsLabel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {breedingPreview.length > 6 && (
                  <div className="pt-3 mt-1 border-t border-[#D8BC87]/12 flex justify-center">
                    <button
                      type="button"
                      data-testid="breeding-expand-odds-btn"
                      onClick={() => setShowAllBreedingOdds((prev) => !prev)}
                      className="px-3 py-1 rounded-md text-xs font-medium text-[#E9C16E] hover:text-[#F8DDA0] hover:bg-[#2E261F] transition-colors cursor-pointer"
                    >
                      {showAllBreedingOdds
                        ? 'Show fewer outcomes'
                        : `+${hiddenBreedingOddsCount} more`}
                    </button>
                  </div>
                )}
              </div>

              {/* Genetics Field Reference with Mode & Custom Filter */}
              <div className="rounded-xl bg-[#221D17] border border-[#D8BC87]/18 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-[#D9C7AE]">
                    Ball Python Genetics Reference ({LOCI_ORDER.length} Traits · Real-World + Custom Originals)
                  </h4>
                  <div className="flex flex-wrap items-center gap-1">
                    {(['all', 'dominant', 'codominant', 'recessive', 'custom'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRefModeFilter(m)}
                        className={`px-2 py-0.5 rounded text-[11px] capitalize cursor-pointer ${
                          refModeFilter === m
                            ? m === 'custom'
                              ? 'bg-[#9B6EDB] text-white font-semibold'
                              : 'bg-[#D9A754] text-[#1C1610] font-semibold'
                            : 'bg-[#2C251E] text-[#B8AA96] hover:text-[#F5EFE4]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-2 text-xs">
                  {LOCI_ORDER.filter((id) => {
                    const def = LOCUS_DEFINITIONS[id];
                    if (refModeFilter === 'all') return true;
                    if (refModeFilter === 'custom') return Boolean(def.isCustom);
                    return def.mode === refModeFilter;
                  }).map((id) => {
                    const def = LOCUS_DEFINITIONS[id];
                    return (
                      <div key={id} className="text-[#B8AA96]">
                        <span className="font-semibold text-[#EFE5D6]">{def.name}</span>{' '}
                        {def.isCustom && (
                          <span className="inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/35 mr-1">
                            Custom
                          </span>
                        )}
                        <span className="text-[#9E8F7B]">({def.mode})</span> — {def.visualEffect}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'morphdex' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl font-semibold text-[#F7F1E5]">
                    Discovered Morph Combinations
                  </h3>
                  <p className="text-xs text-[#B3A490] mt-0.5">
                    Every unique visual combination hatched or adopted is archived below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono-code text-xs text-[#DFC086] tabular-nums">
                    {discoveredList.length} shown
                  </span>
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#A89A87]" aria-hidden="true" />
                    <label htmlFor="morphdex-sort" className="text-xs text-[#BFB19E]">
                      Sort by
                    </label>
                    <select
                      id="morphdex-sort"
                      value={morphdexSort}
                      onChange={(e) => setMorphdexSort(e.target.value as MorphdexSortMode)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#27201A] border border-[#D8BC87]/25 text-xs text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                    >
                      <option value="newest">Newest Discovered</option>
                      <option value="morph">Morph Name (A–Z)</option>
                      <option value="rarity">Rarity (Rarest First)</option>
                      <option value="count">Most Hatched</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Trait Tag Filter Bar */}
              <div className="dock-scroll flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setMorphdexTagFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer shrink-0 ${
                    morphdexTagFilter === 'all'
                      ? 'bg-[#D9A754] text-[#1C1610]'
                      : 'bg-[#27201A] text-[#C2B4A1] hover:text-[#F5EFE4]'
                  }`}
                >
                  All Tags
                </button>
                {MORPH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setMorphdexTagFilter(tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer shrink-0 ${
                      morphdexTagFilter === tag
                        ? 'bg-[#D9A754] text-[#1C1610]'
                        : 'bg-[#27201A] text-[#C2B4A1] hover:text-[#F5EFE4]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discoveredList.map((disc) => (
                  <article
                    key={disc.morphKey}
                    className="rounded-xl bg-[#251F19] border border-[#D8BC87]/22 p-4 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-display text-base font-semibold text-[#F7F1E5]">
                            {disc.morphName}
                          </h4>
                          {(disc.tags?.includes('Custom') || disc.samplePatternRule.isCustomPattern) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                              Custom
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#B3A490] capitalize">
                          {disc.rarity} · Hatched {disc.countHatched}×
                        </div>
                      </div>
                      <div className="flex items-center gap-1 pt-0.5" aria-hidden="true">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/40"
                          style={{ backgroundColor: disc.samplePalette.base }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/40"
                          style={{ backgroundColor: disc.samplePalette.patternPrimary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/40"
                          style={{ backgroundColor: disc.samplePalette.eyeIris }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-[#C7B9A5] space-y-1">
                      <div className="font-mono-code text-[11px] text-[#DFC086]">
                        {disc.samplePatternFormula}{' '}
                        <span className="text-[#A89A87]">{disc.samplePatternRule.glyph}</span>
                      </div>
                      <div className="text-[11px] text-[#A89A87]">
                        Origin: {disc.parentLineageSummary}
                      </div>
                      {disc.tags && disc.tags.length > 0 && (
                        <div className="text-[10px] text-[#9E8F7B]">
                          Tags: {disc.tags.join(' · ')}
                        </div>
                      )}
                      {disc.sampleIsUpsideDown && (
                        <div className="text-[11px] text-[#E6A382]">
                          Spider complex · Upside-down lifestyle
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'simulator' && (
            <MorphSimulatorPanel
              snakes={snakes}
              discoveries={discoveries}
              soldMorphKeys={soldMorphKeys}
              onDebugAddSnake={onDebugAddSnake}
            />
          )}

          {activeTab === 'jeanpool' && (
            <JeanPoolPanel
              snakes={snakes}
              economy={economy}
              onBuyOffer={onBuyJeanPoolOffer}
            />
          )}

          {activeTab === 'hissdepot' && hissDepotUnlocked && (
            <HissDepotPanel
              economy={economy}
              onBuyIncubator={onBuyIncubatorUpgrade}
              onSetIncubatorActive={onSetIncubatorActive}
              onBuyDisplaySlot={onBuyDisplaySlot}
              onBuyBiasCap={onBuyBiasCap}
              onAdjustBiasWeight={onAdjustBiasWeight}
              onResetBiasWeights={onResetBiasWeights}
            />
          )}
        </div>
      </div>
    </div>
  );
}
