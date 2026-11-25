interface TitleOverlayProps {
  onStart: () => void;
  discoveredCount: number;
  snakeCount: number;
}

export function TitleOverlay({ onStart, discoveredCount, snakeCount }: TitleOverlayProps) {
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

      {/* Focal left-third botanical field-guide title lockup */}
      <div className="max-w-lg">
        {/* Custom inline SVG Coiled Botanical Serpent Emblem */}
        <svg
          viewBox="0 0 340 84"
          className="w-72 sm:w-80 h-auto mb-5"
          role="img"
          aria-label="Morpharium emblem"
        >
          {/* Coiled botanical snake crest */}
          <g transform="translate(42, 42)">
            <circle cx="0" cy="0" r="34" fill="#231D17" stroke="#D9B46A" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="28" fill="none" stroke="rgba(217, 180, 106, 0.32)" strokeWidth="1" strokeDasharray="3 4" />
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
            <ellipse cx="9" cy="-2" rx="6.5" ry="4.8" transform="rotate(24 9 -2)" fill="#E5BC6E" stroke="#2B2118" strokeWidth="1" />
            <circle cx="11" cy="-3" r="1.4" fill="#1A140F" />
            <circle cx="11.5" cy="-3.4" r="0.5" fill="#FFFFFF" />
          </g>

          {/* Emblem Wordmark */}
          <text
            x="92"
            y="49"
            fill="#F5EFE4"
            fontFamily="Fraunces, Georgia, serif"
            fontSize="36"
            fontWeight="600"
            letterSpacing="-0.015em"
          >
            Morpharium
          </text>
          <line x1="94" y1="60" x2="316" y2="60" stroke="rgba(217, 180, 106, 0.45)" strokeWidth="1" />
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

        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F7F1E5] leading-tight tracking-tight mb-4 [text-wrap:balance]">
          Breed calm noodles, uncover rare morph genetics.
        </h1>

        <p className="text-[15px] leading-relaxed text-[#D8CEBE] mb-8 max-w-md">
          A peaceful, zero-stress terrarium with procedural slithering physics, real recessive and
          co-dominant morph inheritance, and modular skin patterns.
        </p>

        <div className="flex flex-wrap items-center gap-5">
          <button
            type="button"
            data-start="true"
            onClick={onStart}
            className="px-7 py-3.5 rounded-lg bg-[#D9A754] hover:bg-[#E4B668] active:scale-[0.98] text-[#1D1711] font-semibold text-base transition-all duration-150 shadow-lg shadow-black/35 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F5D692]"
          >
            Enter Terrarium
          </button>

          <span className="text-sm text-[#BFAEA0] tabular-nums">
            {snakeCount} snakes · {discoveredCount} morphs recorded
          </span>
        </div>
      </div>

      {/* Flat borderless inline control hint in bottom safe margin */}
      <div className="text-xs text-[#B5A797] tracking-wide">
        Click snakes to pet &amp; inspect · Tap moss to call curious noodles · Enter or Space to begin · Esc to pause
      </div>
    </div>
  );
}
