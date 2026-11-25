import { useMemo, useState } from 'react';
import { ArrowUpDown, CheckCircle2, DollarSign, Eye, Sparkles } from 'lucide-react';
import {
  analyzeSaleWarnings,
  canSnakeBreed,
  evaluateSnakeSaleValue,
  formatCurrency,
  getMorphCountMap,
  getRecoverySecondsNeeded,
  hasTriplicateMorph,
} from '../game/economy';
import { computeBreedingPreview, formatMutationOddsText } from '../game/genetics';
import {
  buildUndiscoveredChildrenMap,
  type ParentSortMode,
  sortParentCandidates,
} from '../game/sorting';
import type {
  ClutchEgg,
  GeneBiasDistribution,
  MorphRarity,
  SnakeEntity,
} from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';

interface HatchRevealModalProps {
  eggs: ClutchEgg[];
  sire: SnakeEntity;
  dam: SnakeEntity;
  allSnakes: SnakeEntity[];
  discoveredKeys: Set<string>;
  soldMorphKeys: Set<string>;
  biasWeights: GeneBiasDistribution;
  displayedCount: number;
  maxDisplay: number;
  sellUnlocked: boolean;
  showSellTutorial: boolean;
  onRevealEgg: (eggId: string) => void;
  onRevealAll: () => void;
  onRenameEggSnake: (eggId: string, name: string) => void;
  onToggleEggDisplay: (eggId: string) => void;
  onRequestSellEgg: (egg: ClutchEgg) => void;
  onCompleteClutch: (nextSireId: string, nextDamId: string) => void;
}

const RARITY_STYLES: Record<MorphRarity, { label: string; textClass: string; borderClass: string }> = {
  common: {
    label: 'Common Dominant',
    textClass: 'text-[#CBBBA4]',
    borderClass: 'border-[#D8BC87]/25',
  },
  uncommon: {
    label: 'Uncommon Combo',
    textClass: 'text-[#89C9A5]',
    borderClass: 'border-[#73B891]/45',
  },
  rare: {
    label: 'Rare Morph',
    textClass: 'text-[#E9C16E]',
    borderClass: 'border-[#E2B459]/60',
  },
  legendary: {
    label: 'Ultra-Rare Lineage',
    textClass: 'text-[#F49E7A]',
    borderClass: 'border-[#E88B65]/75',
  },
};

export function HatchRevealModal({
  eggs,
  sire,
  dam,
  allSnakes,
  discoveredKeys,
  soldMorphKeys,
  biasWeights,
  displayedCount,
  maxDisplay,
  sellUnlocked,
  showSellTutorial,
  onRevealEgg,
  onRevealAll,
  onRenameEggSnake,
  onToggleEggDisplay,
  onRequestSellEgg,
  onCompleteClutch,
}: HatchRevealModalProps) {
  const allRevealed = eggs.every((e) => e.revealed);
  const [nextSireId, setNextSireId] = useState(sire.id);
  const [nextDamId, setNextDamId] = useState(dam.id);
  const [parentSort, setParentSort] = useState<ParentSortMode>('undiscovered');
  const [showAllOdds, setShowAllOdds] = useState(false);

  // Include newly hatched (unsold) snakes as selectable parents for the next breeding cycle!
  const selectableParents = useMemo(() => {
    const hatchedSnakes = allRevealed ? eggs.filter((e) => !e.sold).map((e) => e.snake) : [];
    const byId = new Map<string, SnakeEntity>();
    for (const s of allSnakes) byId.set(s.id, s);
    for (const s of hatchedSnakes) byId.set(s.id, s);
    return Array.from(byId.values());
  }, [allSnakes, eggs, allRevealed]);

  const selectedNextSire = selectableParents.find((s) => s.id === nextSireId) ?? sire;
  const selectedNextDam = selectableParents.find((s) => s.id === nextDamId) ?? dam;

  const effectiveDiscoveredKeys = useMemo(() => {
    const merged = new Set(discoveredKeys);
    for (const egg of eggs) {
      if (egg.revealed) {
        merged.add(egg.snake.phenotype.morphKey);
      }
    }
    return merged;
  }, [discoveredKeys, eggs]);

  const sireCandidates = useMemo(
    () => sortParentCandidates(selectableParents, parentSort, selectedNextDam, effectiveDiscoveredKeys),
    [selectableParents, parentSort, selectedNextDam, effectiveDiscoveredKeys]
  );
  const damCandidates = useMemo(
    () => sortParentCandidates(selectableParents, parentSort, selectedNextSire, effectiveDiscoveredKeys),
    [selectableParents, parentSort, selectedNextSire, effectiveDiscoveredKeys]
  );
  const sireUndiscoveredMap = useMemo(
    () => buildUndiscoveredChildrenMap(selectableParents, selectedNextDam, effectiveDiscoveredKeys),
    [selectableParents, selectedNextDam, effectiveDiscoveredKeys]
  );
  const damUndiscoveredMap = useMemo(
    () => buildUndiscoveredChildrenMap(selectableParents, selectedNextSire, effectiveDiscoveredKeys),
    [selectableParents, selectedNextSire, effectiveDiscoveredKeys]
  );

  const fullNextPairPreview = useMemo(() => {
    if (!allRevealed) return [];
    return computeBreedingPreview(
      selectedNextSire,
      selectedNextDam,
      effectiveDiscoveredKeys,
      biasWeights
    );
  }, [allRevealed, selectedNextSire, selectedNextDam, effectiveDiscoveredKeys, biasWeights]);

  const undiscoveredCount = useMemo(
    () => fullNextPairPreview.filter((e) => !e.isDiscovered).length,
    [fullNextPairPreview]
  );

  const nextPairPreview = useMemo(
    () => (showAllOdds ? fullNextPairPreview : fullNextPairPreview.slice(0, 4)),
    [fullNextPairPreview, showAllOdds]
  );
  const mutationOddsText = formatMutationOddsText();

  const revealedUnsoldSnakes = useMemo(
    () => eggs.filter((e) => e.revealed && !e.sold).map((e) => e.snake),
    [eggs]
  );
  const combinedSnakes = useMemo(
    () => [...allSnakes, ...revealedUnsoldSnakes],
    [allSnakes, revealedUnsoldSnakes]
  );
  const morphCounts = useMemo(() => getMorphCountMap(combinedSnakes), [combinedSnakes]);
  const canShowSell = sellUnlocked || hasTriplicateMorph(combinedSnakes);
  const firstExtraEggId = useMemo(() => {
    if (!showSellTutorial || !canShowSell) return null;
    const found = eggs.find(
      (e) => e.revealed && !e.sold && (morphCounts.get(e.snake.phenotype.morphKey) ?? 0) >= 3
    );
    return found?.id ?? null;
  }, [showSellTutorial, canShowSell, eggs, morphCounts]);

  const extraDisplaySelected = eggs.filter((e) => !e.sold && e.snake.onDisplay).length;

  const gridColsClass =
    eggs.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clutch-reveal-title"
      data-testid="hatch-reveal-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-6 bg-[#110D0A]/85 overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#1E1914] border border-[#D8BC87]/35 shadow-2xl shadow-black/70 p-4 sm:p-6 my-auto max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#D8BC87]/20">
          <div>
            <h2
              id="clutch-reveal-title"
              className="font-display text-xl sm:text-2xl font-semibold text-[#F7F1E5]"
            >
              Clutch Hatchling Reveal ({eggs.length} Eggs)
            </h2>
            <p className="text-xs sm:text-sm text-[#BFB19E] mt-0.5">
              Offspring of <span className="text-[#F0DFC1] font-medium">{sire.name}</span> ({sire.phenotype.morphName}) ×{' '}
              <span className="text-[#F0DFC1] font-medium">{dam.name}</span> ({dam.phenotype.morphName})
            </p>
          </div>

          {!allRevealed && (
            <button
              type="button"
              onClick={onRevealAll}
              className="px-4 py-2 rounded-lg bg-[#2E261F] hover:bg-[#3C3127] border border-[#D8BC87]/30 text-xs sm:text-sm font-medium text-[#F0DFC1] transition-colors cursor-pointer whitespace-nowrap"
            >
              Reveal All Eggs
            </button>
          )}
        </div>

        {/* Clutch Cards */}
        <div className={`grid ${gridColsClass} gap-4 mt-4`}>
          {eggs.map((egg, index) => {
            if (!egg.revealed) {
              return (
                <button
                  key={egg.id}
                  type="button"
                  onClick={() => onRevealEgg(egg.id)}
                  data-testid={`unhatched-egg-${index}`}
                  className="group relative flex flex-col items-center justify-center min-h-[300px] rounded-xl bg-[#27201A] hover:bg-[#2F2720] border border-[#D8BC87]/25 hover:border-[#E2B86B]/60 p-6 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E8BE70]"
                >
                  <svg
                    viewBox="0 0 110 135"
                    className="w-24 h-28 mb-4 animate-egg-wiggle"
                    aria-hidden="true"
                  >
                    <ellipse cx="55" cy="122" rx="34" ry="8" fill="rgba(0,0,0,0.35)" />
                    <path
                      d="M55 12 C28 12, 16 52, 18 82 C20 108, 36 120, 55 120 C74 120, 90 108, 92 82 C94 52, 82 12, 55 12 Z"
                      fill="#F3EBDD"
                      stroke="#C4B49A"
                      strokeWidth="2.5"
                    />
                    <ellipse cx="42" cy="46" rx="9" ry="18" transform="rotate(-14 42 46)" fill="#FFFDF8" opacity="0.65" />
                    <path
                      d="M44 58 L54 64 L64 56"
                      fill="none"
                      stroke="#8D7A62"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-65 group-hover:opacity-100 transition-opacity"
                    />
                  </svg>

                  <span className="font-display text-lg font-semibold text-[#F5EFE4] group-hover:text-[#EBC272] transition-colors">
                    Hatch Egg {index + 1}
                  </span>
                  <span className="text-xs text-[#A89A87] mt-1">
                    Tap to reveal hatchling morph
                  </span>
                </button>
              );
            }

            const { snake } = egg;
            const { phenotype } = snake;
            const rarityStyle = RARITY_STYLES[phenotype.rarity];
            const canAddToDisplay = displayedCount + extraDisplaySelected < maxDisplay;
            const valuation = evaluateSnakeSaleValue(snake, soldMorphKeys);
            const otherUnsoldHatchlings = eggs
              .filter((e) => !e.sold && e.id !== egg.id)
              .map((e) => e.snake);
            const warnings = analyzeSaleWarnings(
              snake,
              [...allSnakes, ...otherUnsoldHatchlings],
              sire.id,
              dam.id,
              true
            );

            return (
              <div
                key={egg.id}
                data-testid={`revealed-card-${index}`}
                className={`relative overflow-hidden rounded-xl bg-[#251F19] border ${
                  egg.sold
                    ? 'border-[#65A37D]/45 opacity-80'
                    : egg.isNewMorph
                      ? 'border-[#E6B85C] shadow-lg shadow-[#D9A754]/15'
                      : rarityStyle.borderClass
                } p-4 flex flex-col justify-between animate-card-reveal`}
              >
                {egg.isNewMorph && !egg.sold && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                  >
                    <div className="animate-shimmer absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#F7D788]/18 to-transparent" />
                  </div>
                )}

                <div className="relative z-10">
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    {egg.isNewMorph ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#F5CF7B]">
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        New Morph
                      </span>
                    ) : (
                      <span className={`font-medium ${rarityStyle.textClass}`}>
                        {rarityStyle.label}
                      </span>
                    )}
                    <span className="font-mono-code text-[11px] text-[#D8CAB6] tabular-nums">
                      {egg.oddsLabel}
                    </span>
                  </div>

                  <div className="mb-2.5 flex justify-center">
                    <MiniSnakeCanvas phenotype={phenotype} width={238} height={90} animate={!egg.sold} />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-display text-lg font-semibold text-[#F8F2E7] leading-snug">
                      {phenotype.morphName}
                    </h3>
                    {phenotype.isCustomMorph && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#BFB29F] mt-1 space-y-1">
                    <div>
                      <span className="font-mono-code text-[#E1C489]">
                        {phenotype.patternRule.formula}
                      </span>
                      <span className="text-[#8E7F6D]"> · </span>
                      <span className="font-mono-code tracking-wider text-[#D3C4AD]">
                        {phenotype.patternRule.glyph}
                      </span>
                    </div>

                    {phenotype.hetGenes.length > 0 && (
                      <div>Carries Het {phenotype.hetGenes.join(', ')}</div>
                    )}

                    {egg.wasMutation && egg.mutationLocusName && (
                      <div className="text-[#E8BE70]">
                        Spontaneous {egg.mutationLocusName} mutation spark
                      </div>
                    )}

                    {phenotype.isUpsideDown ? (
                      <div className="text-[#E9A684]">
                        Upside-down Spider posture · Vigor {phenotype.lineageVigor}%
                      </div>
                    ) : (
                      <div className="text-[#ABA08F]">
                        {phenotype.behaviorLabel} · Vigor {phenotype.lineageVigor}%
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Custom Name + Display Toggle + Sell Button */}
                <div className="relative z-10 mt-3.5 pt-3 border-t border-[#D8BC87]/15 space-y-2">
                  {egg.sold ? (
                    <div className="py-4 text-center space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8FD4A8]">
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>Sold to Collector</span>
                      </div>
                      <p className="text-[11px] text-[#A89A87]">
                        Morph discovery archived in your Morphdex.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor={`hatch-name-${egg.id}`}
                          className="block text-[11px] text-[#A89884] mb-1"
                        >
                          Custom Name
                        </label>
                        <input
                          id={`hatch-name-${egg.id}`}
                          type="text"
                          maxLength={24}
                          value={snake.name}
                          onChange={(e) => onRenameEggSnake(egg.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#1A1511] border border-[#D8BC87]/25 focus:border-[#D9A754] text-sm text-[#F5EFE4] focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleEggDisplay(egg.id)}
                          disabled={!snake.onDisplay && !canAddToDisplay}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            snake.onDisplay
                              ? 'bg-[#3A4D38] text-[#E4F2DF] border border-[#6C9668]/50'
                              : 'bg-[#2E2720] hover:bg-[#3A3128] text-[#DFD3C2]'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            {snake.onDisplay
                              ? 'In Terrarium'
                              : canAddToDisplay
                                ? 'Display'
                                : `Full (${maxDisplay})`}
                          </span>
                        </button>

                        {canShowSell && (
                          <button
                            type="button"
                            onClick={() => onRequestSellEgg(egg)}
                            data-testid={`sell-egg-${index}`}
                            title={
                              valuation.isFirstSale
                                ? `Includes +${formatCurrency(valuation.firstSaleBonus)} First Sale Bonus!`
                                : `Sell hatchling for ${formatCurrency(valuation.total)}`
                            }
                            className={
                              firstExtraEggId === egg.id
                                ? 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] ring-2 ring-[#F7DC9A] ring-offset-2 ring-offset-[#231D17] shadow-md shadow-[#D9A754]/30 cursor-pointer transition-all whitespace-nowrap shrink-0'
                                : warnings.hasWarning
                                  ? 'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#4B2320] hover:bg-[#612B27] text-[#F7B6B0] border border-[#D96B61]/45 cursor-pointer transition-colors whitespace-nowrap shrink-0'
                                  : 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2E4637] hover:bg-[#3A5A46] text-[#D2F2DD] border border-[#65A37D]/40 cursor-pointer transition-colors whitespace-nowrap shrink-0'
                            }
                          >
                            <DollarSign className="w-3 h-3" aria-hidden="true" />
                            <span>
                              Sell {formatCurrency(valuation.total)}
                              {valuation.isFirstSale ? ' ★' : ''}
                            </span>
                          </button>
                        )}
                      </div>

                      {firstExtraEggId === egg.id && (
                        <div
                          data-testid="sell-tutorial-callout"
                          className="rounded-lg bg-[#342919] border border-[#E9C16E]/55 px-2.5 py-1.5 text-[11px] font-medium text-[#F7E0AE] flex items-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#E9C16E] shrink-0" aria-hidden="true" />
                          <span>Sell extras of morphs to help fund your vivarium.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 2: Select Next Breeding Pair once all eggs are revealed */}
        {allRevealed && (
          <div className="mt-4 pt-4 border-t border-[#D8BC87]/20 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-[#F5EFE4]">
                  Select Next Breeding Pair
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUpDown className="w-3 h-3 text-[#A89A87]" aria-hidden="true" />
                  <label htmlFor="hatch-parent-sort" className="text-[11px] text-[#B3A490]">
                    Sort parents
                  </label>
                  <select
                    id="hatch-parent-sort"
                    value={parentSort}
                    onChange={(e) => setParentSort(e.target.value as ParentSortMode)}
                    className="px-2 py-1 rounded-md bg-[#29221B] border border-[#D8BC87]/25 text-xs text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                  >
                    <option value="undiscovered">Undiscovered Offspring</option>
                    <option value="newest">Newest First</option>
                    <option value="name">Name (A–Z)</option>
                    <option value="morph">Morph (A–Z)</option>
                    <option value="rarity">Rarity (Rarest First)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="next-sire-select" className="block text-[11px] text-[#B3A490] mb-1">
                    Parent A (Sire)
                  </label>
                  <select
                    id="next-sire-select"
                    value={selectedNextSire.id}
                    onChange={(e) => setNextSireId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#29221B] border border-[#D8BC87]/30 text-sm text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                  >
                    {sireCandidates.map((s) => {
                      const newCount =
                        s.id === selectedNextDam.id ? 0 : (sireUndiscoveredMap.get(s.id) ?? 0);
                      const rec = !canSnakeBreed(s) ? ` [Rec ${getRecoverySecondsNeeded(s)}s]` : '';
                      return (
                        <option key={s.id} value={s.id} disabled={s.id === selectedNextDam.id}>
                          {s.name} — {s.phenotype.morphName}
                          {rec}
                          {newCount > 0 ? ` · +${newCount} new` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor="next-dam-select" className="block text-[11px] text-[#B3A490] mb-1">
                    Parent B (Dam)
                  </label>
                  <select
                    id="next-dam-select"
                    value={selectedNextDam.id}
                    onChange={(e) => setNextDamId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#29221B] border border-[#D8BC87]/30 text-sm text-[#F5EFE4] focus:outline-none focus:border-[#D9A754]"
                  >
                    {damCandidates.map((s) => {
                      const newCount =
                        s.id === selectedNextSire.id ? 0 : (damUndiscoveredMap.get(s.id) ?? 0);
                      const rec = !canSnakeBreed(s) ? ` [Rec ${getRecoverySecondsNeeded(s)}s]` : '';
                      return (
                        <option key={s.id} value={s.id} disabled={s.id === selectedNextSire.id}>
                          {s.name} — {s.phenotype.morphName}
                          {rec}
                          {newCount > 0 ? ` · +${newCount} new` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {fullNextPairPreview.length > 0 && (
                <div className="space-y-1">
                  <div
                    data-testid="hatch-undiscovered-count"
                    className="text-xs font-medium flex flex-wrap items-center gap-x-2.5 gap-y-0.5"
                  >
                    <span className={undiscoveredCount > 0 ? 'text-[#E9C16E]' : 'text-[#9E8F7B]'}>
                      {undiscoveredCount}{' '}
                      {undiscoveredCount === 1
                        ? 'undiscovered combination'
                        : 'undiscovered combinations'}
                    </span>
                    <span className="text-[11px] text-[#8F806E] tabular-nums">
                      ({fullNextPairPreview.length} Mendelian outcomes)
                    </span>
                    <span
                      data-testid="hatch-mutation-odds"
                      className="font-mono-code text-[11px] text-[#E2B86B] tabular-nums"
                    >
                      · Mutation odds: {mutationOddsText} / egg
                    </span>
                  </div>
                  <div className="text-xs text-[#B9AA95] flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[#9E8F7B]">Expected odds:</span>
                    {nextPairPreview.map((entry) => (
                      <span key={entry.morphKey} className="tabular-nums">
                        <span
                          className={
                            entry.isDiscovered
                              ? 'text-[#EAE0CE]'
                              : 'font-mono-code tracking-wider text-[#E9C16E]'
                          }
                        >
                          {entry.isDiscovered ? entry.morphName : '???'}
                        </span>{' '}
                        <span className="font-mono-code text-[11px] text-[#CFAF74]">
                          {Math.round(entry.probability * 100)}%
                        </span>
                      </span>
                    ))}
                    {fullNextPairPreview.length > 4 && (
                      <button
                        type="button"
                        data-testid="hatch-expand-odds-btn"
                        onClick={() => setShowAllOdds((prev) => !prev)}
                        className="text-[11px] font-medium text-[#E9C16E] hover:text-[#F8DDA0] underline decoration-[#E9C16E]/50 underline-offset-2 cursor-pointer"
                      >
                        {showAllOdds
                          ? 'Show less'
                          : `+${fullNextPairPreview.length - nextPairPreview.length} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="complete-clutch-btn"
              onClick={() => onCompleteClutch(selectedNextSire.id, selectedNextDam.id)}
              className="px-6 py-3 rounded-xl bg-[#D9A754] hover:bg-[#E7B96A] active:scale-[0.98] text-[#1C1610] font-semibold text-sm transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
            >
              Finish Clutch &amp; Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
