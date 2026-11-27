import { useState } from 'react';
import { FolderOpen, LogOut, Package, Play, PlusCircle, Wrench } from 'lucide-react';
import { getGameModeLabel } from '../game/contentFlags';
import type { SaveSlotSummary } from '../game/storage';

interface TitleOverlayProps {
  hasSaves: boolean;
  continueSlot: SaveSlotSummary | null;
  installedPackCount: number;
  onContinue: () => void;
  onNewGame: () => void;
  onLoadGame: () => void;
  onOpenModPacks: () => void;
  onOpenDevGeneEditor?: () => void;
}

export function TitleOverlay({
  hasSaves,
  continueSlot,
  installedPackCount,
  onContinue,
  onNewGame,
  onLoadGame,
  onOpenModPacks,
  onOpenDevGeneEditor,
}: TitleOverlayProps) {
  const [exitNotice, setExitNotice] = useState(false);

  const handleExit = () => {
    window.close();
    // Browsers restrict window.close() on user-opened tabs; show a gentle fallback note if still open
    window.setTimeout(() => {
      setExitNotice(true);
    }, 150);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-between p-8 md:p-14"
      style={{
        background:
          'linear-gradient(105deg, rgba(20, 16, 12, 0.90) 0%, rgba(20, 16, 12, 0.72) 44%, rgba(20, 16, 12, 0.18) 100%)',
      }}
    >
      {/* Top quiet brand alignment spacer */}
      <div className="h-2" />

      {/* Focal left-third botanical field-guide title lockup & classic game menu */}
      <div className="max-w-lg">
        {/* Custom inline SVG Coiled Botanical Serpent Emblem */}
        <svg
          viewBox="0 0 388 84"
          className="w-80 sm:w-[22rem] h-auto mb-5"
          role="img"
          aria-label="Noodle Morphs emblem"
        >
          {/* Coiled botanical snake crest */}
          <g transform="translate(42, 42)">
            <circle cx="0" cy="0" r="34" fill="#231D17" stroke="#D9B46A" strokeWidth="1.5" />
            <circle
              cx="0"
              cy="0"
              r="28"
              fill="none"
              stroke="rgba(217, 180, 106, 0.32)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />
            {/* Graceful coiled ball python body */}
            <path
              d="M -16 12 C -24 2, -18 -18, 0 -18 C 18 -18, 22 -2, 12 10 C 4 18, -10 16, -12 4 C -14 -6, -4 -10, 6 -4"
              fill="none"
              stroke="#E5BC6E"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            {/* Pattern dots along coil */}
            <path
              d="M -16 12 C -24 2, -18 -18, 0 -18 C 18 -18, 22 -2, 12 10 C 4 18, -10 16, -12 4"
              fill="none"
              stroke="#3B2B1C"
              strokeWidth="2.4"
              strokeDasharray="2 7"
              strokeLinecap="round"
            />
            {/* Cute head + catchlight eye */}
            <ellipse
              cx="9"
              cy="-2"
              rx="6.5"
              ry="4.8"
              transform="rotate(24 9 -2)"
              fill="#E5BC6E"
              stroke="#2B2118"
              strokeWidth="1"
            />
            <circle cx="11" cy="-3" r="1.4" fill="#1A140F" />
            <circle cx="11.5" cy="-3.4" r="0.5" fill="#FFFFFF" />
          </g>

          {/* Emblem Wordmark */}
          <text
            x="92"
            y="49"
            fill="#F5EFE4"
            fontFamily="Fraunces, Georgia, serif"
            fontSize="34"
            fontWeight="600"
            letterSpacing="-0.015em"
          >
            Noodle Morphs
          </text>
          <line x1="94" y1="60" x2="366" y2="60" stroke="rgba(217, 180, 106, 0.45)" strokeWidth="1" />
          <text
            x="94"
            y="74"
            fill="#CBBFA9"
            fontFamily="Plus Jakarta Sans, sans-serif"
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.14em"
          >
            BALL PYTHON VIVARIUM
          </text>
        </svg>

        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F7F1E5] leading-tight tracking-tight mb-3 [text-wrap:balance]">
          Breed calm noodles, uncover rare morph genetics.
        </h1>

        <p className="text-[14px] leading-relaxed text-[#D8CEBE] mb-7 max-w-md">
          A peaceful, zero-stress terrarium with procedural slithering physics, real recessive and
          co-dominant morph inheritance, and modular skin patterns.
        </p>

        {/* Regular Game Main Menu */}
        <nav aria-label="Main menu" className="flex flex-col gap-2.5 max-w-xs">
          {hasSaves && (
            <button
              type="button"
              data-start="true"
              data-testid="title-continue-btn"
              onClick={onContinue}
              className="w-full px-5 py-3 rounded-xl bg-[#D9A754] hover:bg-[#E4B668] active:scale-[0.99] text-[#1D1711] font-semibold text-base transition-all duration-150 shadow-lg shadow-black/35 cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Continue</span>
              </span>
              {continueSlot && !continueSlot.isEmpty && (
                <span className="text-[11px] font-medium text-[#3A2B16] tabular-nums">
                  Slot {continueSlot.slotId} · {getGameModeLabel(continueSlot.gameConfig.mode)}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            data-start={!hasSaves ? 'true' : undefined}
            data-testid="title-new-btn"
            onClick={onNewGame}
            className={`w-full px-5 py-3 rounded-xl font-semibold text-base transition-all duration-150 cursor-pointer flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692] ${
              !hasSaves
                ? 'bg-[#D9A754] hover:bg-[#E4B668] text-[#1D1711] shadow-lg shadow-black/35'
                : 'bg-[#26201A]/95 hover:bg-[#332B23] text-[#F5EFE4] border border-[#D8BC87]/28'
            }`}
          >
            <PlusCircle className="w-4 h-4" aria-hidden="true" />
            <span>New</span>
          </button>

          {hasSaves && (
            <button
              type="button"
              data-testid="title-load-btn"
              onClick={onLoadGame}
              className="w-full px-5 py-3 rounded-xl bg-[#26201A]/95 hover:bg-[#332B23] text-[#F5EFE4] border border-[#D8BC87]/28 font-semibold text-base transition-all duration-150 cursor-pointer flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
            >
              <FolderOpen className="w-4 h-4 text-[#D9A754]" aria-hidden="true" />
              <span>Load</span>
            </button>
          )}

          <button
            type="button"
            data-testid="title-mod-packs-btn"
            onClick={onOpenModPacks}
            className="w-full px-5 py-2.5 rounded-xl bg-[#1E2728]/90 hover:bg-[#263537] text-[#D8F2EE] border border-[#56B8B0]/30 font-medium text-sm transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7AE0D4]"
          >
            <span className="inline-flex items-center gap-2.5">
              <Package className="w-4 h-4 text-[#7AE0D4]" aria-hidden="true" />
              <span>Gene Packs</span>
            </span>
            <span className="text-[11px] font-mono-code text-[#9EE8DE] tabular-nums">
              {installedPackCount > 0 ? `${installedPackCount} installed` : 'Workshop'}
            </span>
          </button>

          {onOpenDevGeneEditor && (
            <button
              type="button"
              data-testid="title-dev-gene-editor-btn"
              onClick={onOpenDevGeneEditor}
              className="w-full px-5 py-2.5 rounded-xl bg-[#342615]/95 hover:bg-[#46331B] text-[#F7DFAA] border border-[#D9A754]/50 font-semibold text-sm transition-all duration-150 cursor-pointer flex items-center justify-between gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
            >
              <span className="inline-flex items-center gap-2.5">
                <Wrench className="w-4 h-4 text-[#F1CD82]" aria-hidden="true" />
                <span>Dev Gene Editor</span>
              </span>
              <span className="text-[10px] font-mono-code text-[#E6BE70]">CORE &amp; FUN</span>
            </button>
          )}

          <button
            type="button"
            data-testid="title-exit-btn"
            onClick={handleExit}
            className="w-full px-5 py-2.5 rounded-xl bg-[#1C1713]/85 hover:bg-[#2A221C] text-[#C8BAA5] hover:text-[#F5EFE4] border border-[#D8BC87]/18 font-medium text-sm transition-all duration-150 cursor-pointer flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
          >
            <LogOut className="w-4 h-4 text-[#A89884]" aria-hidden="true" />
            <span>Exit</span>
          </button>

          {exitNotice && (
            <p className="text-[11px] text-[#C8BAA5] px-1">
              Your browser prevented closing this tab automatically — you can close it safely.
            </p>
          )}
        </nav>
      </div>

      {/* Flat borderless inline control hint in bottom safe margin */}
      <div className="text-xs text-[#B5A797] tracking-wide">
        Click snakes to pet &amp; inspect · Tap moss to call curious noodles · Esc to pause
      </div>
    </div>
  );
}
