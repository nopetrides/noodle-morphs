import { Flame, HeartPulse, Pause, Sparkles, Volume2, VolumeX } from 'lucide-react';
import {
  canSnakeBreed,
  formatCurrency,
  getRecoverySecondsNeeded,
} from '../game/economy';
import { DEV_TOOLS_ENABLED } from '../game/env';
import type { SnakeEntity } from '../game/types';

interface TopIncubatorHudProps {
  sire: SnakeEntity;
  dam: SnakeEntity;
  remainingSec: number;
  durationSec: number;
  clutchSize: number;
  clutchReady: boolean;
  discoveredCount: number;
  money: number;
  showCurrency: boolean;
  muted: boolean;
  onHatchReady: () => void;
  onWarmIncubator: () => void;
  onOpenBreeding: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

function formatTimer(sec: number): string {
  const clamped = Math.max(0, Math.ceil(sec));
  const mins = Math.floor(clamped / 60);
  const rem = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function TopIncubatorHud({
  sire,
  dam,
  remainingSec,
  durationSec,
  clutchSize,
  clutchReady,
  discoveredCount,
  money,
  showCurrency,
  muted,
  onHatchReady,
  onWarmIncubator,
  onOpenBreeding,
  onToggleMute,
  onPause,
}: TopIncubatorHudProps) {
  const isReady = clutchReady || remainingSec <= 0;

  const sireNeedsRecovery = !isReady && !canSnakeBreed(sire);
  const damNeedsRecovery = !isReady && !canSnakeBreed(dam);
  const isRecovering = sireNeedsRecovery || damNeedsRecovery;

  const recoveringNames = [
    ...(sireNeedsRecovery ? [sire.name] : []),
    ...(damNeedsRecovery ? [dam.name] : []),
  ].join(' & ');
  const recoverySec = Math.max(
    sireNeedsRecovery ? getRecoverySecondsNeeded(sire) : 0,
    damNeedsRecovery ? getRecoverySecondsNeeded(dam) : 0
  );

  const progress = Math.max(0, Math.min(1, 1 - remainingSec / Math.max(1, durationSec)));

  return (
    <div className="fixed top-0 left-0 right-0 z-20 pointer-events-none p-2 sm:p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 sm:gap-3 w-full">
        {/* Top Row on Mobile (Brand + Money on left, Mute + Pause ALWAYS visible on right); splits left/right on md+ */}
        <div className="flex items-center justify-between gap-2 md:contents">
          {/* Left brand + morph count + currency balance */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-[#1F1A15]/92 border border-[#D8BC87]/25 shadow-md shadow-black/35 md:order-1 min-w-0">
            <span className="font-display text-sm sm:text-base font-semibold text-[#F5EFE4] whitespace-nowrap">
              Noodle Morphs
            </span>
            <span className="hidden sm:inline text-[#8F806E]" aria-hidden="true">
              ·
            </span>
            <span className="hidden sm:inline text-xs text-[#CFC3B0] tabular-nums whitespace-nowrap">
              {discoveredCount} morphs
            </span>
            {showCurrency && (
              <>
                <span className="text-[#8F806E]" aria-hidden="true">
                  ·
                </span>
                <span
                  data-testid="currency-balance"
                  className="font-mono-code text-xs sm:text-sm font-semibold text-[#E9C16E] tabular-nums whitespace-nowrap"
                >
                  {formatCurrency(money)}
                </span>
              </>
            )}
          </div>

          {/* Top-Right Compact Utility Controls — guaranteed visible on narrow mobile */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0 md:order-3">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              title={muted ? 'Unmute [M]' : 'Mute [M]'}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#1F1A15]/92 hover:bg-[#2E2720] border border-[#D8BC87]/25 flex items-center justify-center text-[#E6DAC8] transition-colors cursor-pointer shadow-md shadow-black/30"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              data-testid="pause-btn"
              aria-label="Pause terrarium"
              title="Pause [P / Esc]"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#1F1A15]/92 hover:bg-[#2E2720] border border-[#D8BC87]/25 flex items-center justify-center text-[#E6DAC8] transition-colors cursor-pointer shadow-md shadow-black/30"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Clutch Incubator Timer / Recovery Banner / Hatch Button */}
        <div
          data-testid="incubator-bar"
          className="pointer-events-auto mx-auto md:order-2 flex items-center justify-between sm:justify-center gap-2.5 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-[#1F1A15]/95 border border-[#D8BC87]/35 shadow-lg shadow-black/40 w-full max-w-[420px] md:w-auto md:max-w-none"
        >
          {isRecovering ? (
            <div
              data-testid="vigor-recovery-banner"
              className="flex items-center justify-between gap-2.5 sm:gap-3 w-full"
            >
              <div className="flex items-center gap-2 min-w-0">
                <HeartPulse className="w-4 h-4 text-[#E6A382] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#F5D3C2] truncate">
                    {recoveringNames} {sireNeedsRecovery && damNeedsRecovery ? 'are' : 'is'} recovering
                  </div>
                  <div className="font-mono-code text-[11px] text-[#C8B8A4] tabular-nums">
                    Ready in {formatTimer(recoverySec)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenBreeding}
                className="px-3 py-1.5 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Change Pair
              </button>
            </div>
          ) : (
            <>
              {/* Breeding Pair Summary */}
              <button
                type="button"
                onClick={onOpenBreeding}
                title="Change breeding pair"
                className="text-left group focus-visible:outline-2 focus-visible:outline-[#E8BE70] rounded px-1 -mx-1 cursor-pointer min-w-0 flex-1 md:flex-initial"
              >
                <div className="text-[10px] sm:text-[11px] font-medium text-[#B7A792] whitespace-nowrap">
                  Clutch ({clutchSize} eggs)
                </div>
                <div className="text-xs sm:text-sm font-semibold text-[#F5EFE4] group-hover:text-[#E9C37B] transition-colors truncate max-w-[135px] sm:max-w-[210px]">
                  {sire.name} × {dam.name}
                </div>
              </button>

              <div className="h-7 w-px bg-[#D8BC87]/20 shrink-0" aria-hidden="true" />

              {isReady ? (
                <button
                  type="button"
                  onClick={onHatchReady}
                  data-testid="hatch-clutch-btn"
                  className="btn-gold-attention flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[#1C1610] font-semibold text-xs sm:text-sm transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
                >
                  <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Hatch Clutch</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  <div className="min-w-[88px] sm:min-w-[132px]">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[10px] sm:text-[11px] text-[#B7A792] whitespace-nowrap">
                        Next Hatch
                      </span>
                      <span
                        data-testid="clutch-timer"
                        className="font-mono-code text-xs sm:text-sm font-semibold text-[#F5EFE4] tabular-nums"
                      >
                        {formatTimer(remainingSec)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#362E26] overflow-hidden">
                      <div
                        className="h-full bg-[#D9A754] transition-transform duration-300 origin-left"
                        style={{ transform: `scaleX(${progress})` }}
                      />
                    </div>
                  </div>

                  {DEV_TOOLS_ENABLED && (
                    <button
                      type="button"
                      onClick={onWarmIncubator}
                      aria-label="Warm incubator eggs by 5 seconds"
                      title="[Dev] Gently warm eggs (-5s)"
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#2E261F] hover:bg-[#3B3128] border border-[#D8BC87]/25 text-xs font-medium text-[#EAD9B7] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70]"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#E5A752]" aria-hidden="true" />
                      <span className="hidden sm:inline">Warm</span>
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
