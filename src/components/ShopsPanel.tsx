import { useMemo } from 'react';
import { Clock, RotateCcw, ShoppingBag, Sliders, Sparkles } from 'lucide-react';
import {
  buildJeanPoolOffers,
  canAfford,
  formatCurrency,
  getActiveClutchConfig,
  getBiasCapUpgradePrice,
  getCategoryMaxBiasWeight,
  getDisplaySlotUpgradePrice,
  getIncubatorUpgradePrice,
  getMaxDisplaySlots,
  getMissingLoci,
  type JeanPoolOffer,
  MAX_BIAS_CAP_UPGRADES,
  MAX_DISPLAY_UPGRADES,
  MAX_INCUBATOR_UPGRADES,
} from '../game/economy';
import { getEnabledLoci, LOCUS_DEFINITIONS } from '../game/genetics';
import type { EconomyState, InheritanceMode, SnakeEntity } from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';

import JEAN_POOL_MASCOT from '../assets/images/jean_pool_mascot_1795554052499.jpg';
import HISS_DEPOT_MASCOT from '../assets/images/hiss_depot_mascot_1795554050643.jpg';

function formatCooldown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

interface JeanPoolPanelProps {
  snakes: SnakeEntity[];
  economy: EconomyState;
  contentFlags: number;
  onBuyOffer: (offer: JeanPoolOffer) => void;
}

export function JeanPoolPanel({ snakes, economy, contentFlags, onBuyOffer }: JeanPoolPanelProps) {
  const enabledLoci = useMemo(() => getEnabledLoci(contentFlags), [contentFlags]);
  const missingLoci = useMemo(
    () => getMissingLoci(snakes, contentFlags),
    [snakes, contentFlags]
  );
  const offers = useMemo(
    () => buildJeanPoolOffers(snakes, economy.jeanPool, contentFlags),
    [snakes, economy.jeanPool, contentFlags]
  );
  const onCooldown = economy.jeanPool.cooldownRemainingSec > 0;
  const ownedGeneCount = enabledLoci.length - missingLoci.length;

  return (
    <div data-testid="jean-pool-panel" className="space-y-5">
      {/* Mascot & Store Header */}
      <div className="rounded-xl bg-[#20262E] border border-[#6C8FB8]/35 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#7CA0CA]/60 shadow-lg shadow-black/40 shrink-0 bg-[#251F19]">
          <img
            src={JEAN_POOL_MASCOT}
            alt="The Jean Pool mascot: a cheerful ball python peeking out of denim jeans"
            className="w-full h-full object-cover scale-115"
          />
        </div>
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F4F7FB]">
              The Jean Pool
            </h3>
            <span className="font-mono-code text-xs text-[#A9C4E4] tabular-nums">
              {ownedGeneCount}/{enabledLoci.length} genes in collection
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#B8C7D9]">
            Fresh single-gene breeders carrying traits your vivarium doesn&apos;t own yet. Pick one snake per shipment—the shop restocks after a cooldown.
          </p>
        </div>
      </div>

      {missingLoci.length === 0 ? (
        <div
          data-testid="jean-pool-empty"
          className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-8 text-center space-y-2"
        >
          <Sparkles className="w-7 h-7 text-[#E9C16E] mx-auto" aria-hidden="true" />
          <h4 className="font-display text-lg font-semibold text-[#F7F1E5]">
            Nothing New to Buy
          </h4>
          <p className="text-xs sm:text-sm text-[#B8AA96] max-w-md mx-auto">
            Your vivarium already carries at least one copy of every available gene in the pool! Combine your breeders to unlock multi-gene designer morphs.
          </p>
        </div>
      ) : onCooldown ? (
        <div
          data-testid="jean-pool-cooldown"
          className="rounded-xl bg-[#251F19] border border-[#6C8FB8]/30 p-8 text-center space-y-2"
        >
          <Clock className="w-7 h-7 text-[#8BB3DE] mx-auto" aria-hidden="true" />
          <h4 className="font-display text-lg font-semibold text-[#F7F1E5]">
            Shipment Restocking
          </h4>
          <p className="font-mono-code text-xl font-semibold text-[#E9C16E] tabular-nums">
            {formatCooldown(economy.jeanPool.cooldownRemainingSec)}
          </p>
          <p className="text-xs text-[#B3A490]">
            New single-gene breeders arrive after 5× the base hatch cycle ({missingLoci.length}{' '}
            {missingLoci.length === 1 ? 'gene' : 'genes'} left to collect).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const def = LOCUS_DEFINITIONS[offer.locusId];
            const affordable = canAfford(economy.money, offer.price);

            return (
              <article
                key={offer.offerId}
                className="rounded-xl bg-[#251F19] border border-[#6C8FB8]/30 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-display text-base font-semibold text-[#F7F1E5]">
                        {offer.snake.name}
                      </h4>
                      <p className="text-xs font-semibold text-[#9BC1EC]">
                        {offer.snake.phenotype.morphName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {def.isCustom && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                          Custom
                        </span>
                      )}
                      <span className="font-mono-code text-xs px-2 py-0.5 rounded bg-[#1A2029] text-[#B7D2F0] capitalize">
                        {def.mode}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <MiniSnakeCanvas
                      phenotype={offer.snake.phenotype}
                      width={236}
                      height={90}
                      animate={false}
                    />
                  </div>

                  <p className="text-xs text-[#C2B4A1] leading-relaxed">{def.description}</p>
                  <div className="text-[11px] text-[#9E8F7B]">
                    New gene: <span className="text-[#E9C16E] font-medium">{def.name}</span> · Max Vigour{' '}
                    {offer.snake.phenotype.lineageVigor}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!affordable}
                  onClick={() => onBuyOffer(offer)}
                  data-testid={`buy-jeanpool-${offer.locusId}`}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                    affordable
                      ? 'bg-[#5B87B8] hover:bg-[#6E9BCE] text-white cursor-pointer'
                      : 'bg-[#2B2520] text-[#84786A] cursor-not-allowed'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {affordable
                      ? `Adopt for ${formatCurrency(offer.price)}`
                      : `Need ${formatCurrency(offer.price)}`}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface HissDepotPanelProps {
  economy: EconomyState;
  onBuyIncubator: () => void;
  onSetIncubatorActive: (level: number) => void;
  onBuyDisplaySlot: () => void;
  onBuyBiasCap: (mode: InheritanceMode) => void;
  onAdjustBiasWeight: (mode: InheritanceMode, value: number) => void;
  onResetBiasWeights: () => void;
}

const BIAS_CATEGORIES: Array<{
  mode: InheritanceMode;
  label: string;
  color: string;
  description: string;
}> = [
  {
    mode: 'dominant',
    label: 'Dominant',
    color: '#E5A752',
    description: 'Spider, Pinstripe, Calico',
  },
  {
    mode: 'codominant',
    label: 'Codominant',
    color: '#6CA6C8',
    description: 'Pastel, Banana, Mojave, Fire, Enchi, GHI…',
  },
  {
    mode: 'recessive',
    label: 'Recessive',
    color: '#D97B93',
    description: 'Albino, Piebald, Clown, Lavender, Desert Ghost…',
  },
];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function HissDepotPanel({
  economy,
  onBuyIncubator,
  onSetIncubatorActive,
  onBuyDisplaySlot,
  onBuyBiasCap,
  onAdjustBiasWeight,
  onResetBiasWeights,
}: HissDepotPanelProps) {
  const { hissDepot, money } = economy;
  const incPrice = getIncubatorUpgradePrice(hissDepot.incubatorMaxLevel);
  const incMaxed = hissDepot.incubatorMaxLevel >= MAX_INCUBATOR_UPGRADES;
  const activeConfig = getActiveClutchConfig(hissDepot);

  const slotPrice = getDisplaySlotUpgradePrice(hissDepot.displaySlotsBought);
  const slotMaxed = hissDepot.displaySlotsBought >= MAX_DISPLAY_UPGRADES;
  const currentMaxDisplay = getMaxDisplaySlots(hissDepot);

  // Build SVG Pie Chart slices from self-balancing biasWeights
  const wDom = hissDepot.biasWeights.dominant;
  const wCod = hissDepot.biasWeights.codominant;
  const degDom = (wDom / 100) * 360;
  const degCod = (wCod / 100) * 360;

  return (
    <div data-testid="hiss-depot-panel" className="space-y-5">
      {/* Mascot & Store Header */}
      <div className="rounded-xl bg-[#2D1F16] border border-[#DF8342]/40 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-[#EA944E]/70 shadow-lg shadow-black/40 shrink-0 bg-[#251F19]">
          <img
            src={HISS_DEPOT_MASCOT}
            alt="The Hiss Depot mascot: a helpful ball python in a yellow hard hat and orange hardware apron"
            className="w-full h-full object-cover scale-115"
          />
        </div>
        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-2">
            <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#FFF4E8]">
              The Hiss Depot
            </h3>
            <span className="font-mono-code text-xs text-[#F5B47C] tabular-nums">
              Balance: {formatCurrency(money)}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#D9BEA7]">
            Balanced vivarium hardware &amp; incubator tuning. Every upgrade scales its own price independently—no runaway speed exploits, just flexible tools.
          </p>
        </div>
      </div>

      {/* Row 1: Incubator Range + Permanent Display Slots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Incubator Settable Range Upgrade */}
        <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-display text-base font-semibold text-[#F7F1E5]">
                  Incubator Capacity Dial
                </h4>
                <p className="text-xs text-[#B3A490]">
                  Each tier unlocks +1 egg per clutch paired with +1 minute base hatch time. Freely switch anywhere in your unlocked range!
                </p>
              </div>
              <span className="font-mono-code text-xs px-2 py-0.5 rounded bg-[#1A1511] text-[#E9C16E] shrink-0">
                Tier {hissDepot.incubatorMaxLevel}/{MAX_INCUBATOR_UPGRADES}
              </span>
            </div>

            {/* Settable Range Selector */}
            <div className="rounded-lg bg-[#1B1612] border border-[#D8BC87]/18 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BFB19E]">Active Incubator Setting</span>
                <span className="font-mono-code font-semibold text-[#E9C16E] tabular-nums">
                  {activeConfig.clutchSize} eggs / {activeConfig.baseBreedSec / 60} min
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: hissDepot.incubatorMaxLevel + 1 }, (_, lvl) => {
                  const active = hissDepot.incubatorActiveLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onSetIncubatorActive(lvl)}
                      className={`px-2.5 py-1 rounded-md font-mono-code text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#D9A754] text-[#1C1610]'
                          : 'bg-[#2B241D] hover:bg-[#382F26] text-[#C8BAA5]'
                      }`}
                    >
                      {2 + lvl}e / {2 + lvl}m
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={incMaxed || !canAfford(money, incPrice)}
            onClick={onBuyIncubator}
            data-testid="buy-incubator-upgrade"
            className={`w-full py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              incMaxed
                ? 'bg-[#2A241E] text-[#8E8172] cursor-not-allowed'
                : canAfford(money, incPrice)
                  ? 'bg-[#DF8342] hover:bg-[#EC9353] text-[#1A120C] cursor-pointer'
                  : 'bg-[#2B2520] text-[#84786A] cursor-not-allowed'
            }`}
          >
            {incMaxed
              ? 'Max Range Unlocked (6 eggs / 6 min)'
              : `Unlock ${3 + hissDepot.incubatorMaxLevel}e / ${3 + hissDepot.incubatorMaxLevel}m Range · ${formatCurrency(incPrice)}`}
          </button>
        </div>

        {/* Permanent Terrarium Display Slots */}
        <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-4 flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-display text-base font-semibold text-[#F7F1E5]">
                  Terrarium Glass Expansion
                </h4>
                <p className="text-xs text-[#B3A490]">
                  Permanently adds +1 display slot so more ball pythons can lounge and slither together in your main vivarium.
                </p>
              </div>
              <span className="font-mono-code text-xs px-2 py-0.5 rounded bg-[#1A1511] text-[#E9C16E] shrink-0">
                {currentMaxDisplay} slots
              </span>
            </div>

            <div className="rounded-lg bg-[#1B1612] border border-[#D8BC87]/18 p-3 text-xs text-[#C7B9A5]">
              Permanent expansion · Bought {hissDepot.displaySlotsBought}/{MAX_DISPLAY_UPGRADES} times
            </div>
          </div>

          <button
            type="button"
            disabled={slotMaxed || !canAfford(money, slotPrice)}
            onClick={onBuyDisplaySlot}
            data-testid="buy-display-slot-upgrade"
            className={`w-full py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
              slotMaxed
                ? 'bg-[#2A241E] text-[#8E8172] cursor-not-allowed'
                : canAfford(money, slotPrice)
                  ? 'bg-[#DF8342] hover:bg-[#EC9353] text-[#1A120C] cursor-pointer'
                  : 'bg-[#2B2520] text-[#84786A] cursor-not-allowed'
            }`}
          >
            {slotMaxed
              ? 'Vivarium Display Maxed (12 slots)'
              : `Add +1 Display Slot · ${formatCurrency(slotPrice)}`}
          </button>
        </div>
      </div>

      {/* Row 2: Self-Balancing Gene Inheritance Pie Chart & Bias Upgrades */}
      <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-display text-base sm:text-lg font-semibold text-[#F7F1E5] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#DF8342]" aria-hidden="true" />
              <span>Self-Balancing Gene Inheritance Dial</span>
            </h4>
            <p className="text-xs text-[#B3A490] mt-0.5">
              Unlock +10% headroom per category. Raising one category automatically reduces the others so total balance stays at 100%.
            </p>
          </div>
          <button
            type="button"
            onClick={onResetBiasWeights}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2E261F] hover:bg-[#3A3027] text-xs text-[#DFD3C2] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Default Balance</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-5 items-center">
          {/* Live SVG Pie Chart */}
          <div className="flex flex-col items-center gap-2">
            <svg
              viewBox="0 0 140 140"
              className="w-36 h-36 drop-shadow-md"
              role="img"
              aria-label={`Gene balance pie chart: Dominant ${Math.round(wDom)}%, Codominant ${Math.round(wCod)}%, Recessive ${Math.round(hissDepot.biasWeights.recessive)}%`}
            >
              <path d={pieSlicePath(70, 70, 62, 0, degDom)} fill="#E5A752" stroke="#1E1914" strokeWidth="2" />
              <path
                d={pieSlicePath(70, 70, 62, degDom, degDom + degCod)}
                fill="#6CA6C8"
                stroke="#1E1914"
                strokeWidth="2"
              />
              <path
                d={pieSlicePath(70, 70, 62, degDom + degCod, 360)}
                fill="#D97B93"
                stroke="#1E1914"
                strokeWidth="2"
              />
              <circle cx="70" cy="70" r="24" fill="#1E1914" />
              <text
                x="70"
                y="73"
                textAnchor="middle"
                fill="#F5EFE4"
                fontSize="11"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
              >
                100%
              </text>
            </svg>
          </div>

          {/* Per-Category Sliders & Independent Cap Upgrades */}
          <div className="space-y-3">
            {BIAS_CATEGORIES.map(({ mode, label, color, description }) => {
              const capsBought = hissDepot.biasCapsBought[mode];
              const maxAllowed = getCategoryMaxBiasWeight(capsBought);
              const currentWeight = hissDepot.biasWeights[mode];
              const upgradePrice = getBiasCapUpgradePrice(capsBought);
              const maxed = capsBought >= MAX_BIAS_CAP_UPGRADES;

              return (
                <div
                  key={mode}
                  className="rounded-lg bg-[#1B1612] border border-[#D8BC87]/15 p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-[#F5EFE4]">
                        {label}
                      </span>
                      <span className="hidden sm:inline text-[11px] text-[#8F806E] truncate">
                        {description}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono-code text-xs text-[#E9C16E] tabular-nums">
                        {Math.round(currentWeight)}%{' '}
                        <span className="text-[#8F806E]">/ {Math.round(maxAllowed)}% cap</span>
                      </span>
                      <button
                        type="button"
                        disabled={maxed || !canAfford(money, upgradePrice)}
                        onClick={() => onBuyBiasCap(mode)}
                        data-testid={`buy-bias-${mode}`}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          maxed
                            ? 'bg-[#2A241E] text-[#8E8172] cursor-not-allowed'
                            : canAfford(money, upgradePrice)
                              ? 'bg-[#DF8342] hover:bg-[#EC9353] text-[#1A120C] cursor-pointer'
                              : 'bg-[#2B2520] text-[#84786A] cursor-not-allowed'
                        }`}
                      >
                        {maxed ? 'Maxed' : `+10% Cap · ${formatCurrency(upgradePrice)}`}
                      </button>
                    </div>
                  </div>

                  <input
                    type="range"
                    aria-label={`${label} inheritance balance`}
                    min={5}
                    max={Math.round(maxAllowed)}
                    step={1}
                    value={Math.round(currentWeight)}
                    disabled={capsBought === 0 && Math.round(currentWeight) <= 33}
                    onChange={(e) => onAdjustBiasWeight(mode, Number(e.target.value))}
                    className="w-full accent-[#DF8342] cursor-pointer disabled:opacity-45"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
