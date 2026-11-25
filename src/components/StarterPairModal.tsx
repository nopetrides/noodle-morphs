import { MiniSnakeCanvas } from './MiniSnakeCanvas';
import type { SnakeEntity } from '../game/types';

interface StarterPairModalProps {
  pair: SnakeEntity[];
  onConfirm: () => void;
  onReroll: () => void;
}

export function StarterPairModal({ pair, onConfirm, onReroll }: StarterPairModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-pair-title"
      data-testid="starter-pair-modal"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-[#110D0A]/88 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#1E1914] border border-[#D8BC87]/35 shadow-2xl shadow-black/75 p-5 sm:p-6 my-auto space-y-5">
        <div className="text-center space-y-1">
          <h2
            id="starter-pair-title"
            className="font-display text-2xl sm:text-3xl font-semibold text-[#F7F1E5]"
          >
            Meet Your Founding Pair
          </h2>
          <p className="text-xs sm:text-sm text-[#BFB19E]">
            Your vivarium begins with two calm ball python breeders ready to start your morph lineage.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pair.map((snake, idx) => (
            <div
              key={snake.id}
              className="rounded-xl bg-[#251F19] border border-[#D8BC87]/25 p-4 space-y-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-[#F7F1E5]">
                  {snake.name}
                </h3>
                <span className="text-[11px] text-[#A89A87]">
                  {idx === 0 ? 'Parent A' : 'Parent B'}
                </span>
              </div>

              <div className="flex justify-center">
                <MiniSnakeCanvas phenotype={snake.phenotype} width={250} height={94} animate />
              </div>

              <div className="space-y-1 text-xs">
                <div className="font-semibold text-[#E4BE74]">{snake.phenotype.morphName}</div>
                {snake.phenotype.hetGenes.length > 0 && (
                  <div className="text-[#C7B9A5]">
                    Carries Het {snake.phenotype.hetGenes.join(', ')}
                  </div>
                )}
                <div className="font-mono-code text-[11px] text-[#DFC086]">
                  {snake.phenotype.patternRule.formula}{' '}
                  <span className="text-[#A89A87]">{snake.phenotype.patternRule.glyph}</span>
                </div>
                <div className="text-[11px] text-[#A89A87]">
                  {snake.phenotype.behaviorLabel} · Max Vigour {snake.phenotype.lineageVigor}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 pt-1">
          <button
            type="button"
            data-testid="confirm-starters-btn"
            onClick={onConfirm}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#D9A754] hover:bg-[#E7B96A] active:scale-[0.98] text-[#1C1610] font-semibold text-sm transition-all cursor-pointer shadow-md shadow-black/35"
          >
            Welcome Pair to Terrarium
          </button>

          <p className="text-[11px] sm:text-xs text-[#9E8F7B] text-center">
            These two breeders are a great start. If you&apos;ve already started a game with this pair, feel free to{' '}
            <button
              type="button"
              data-testid="subtle-reroll-link"
              onClick={onReroll}
              className="underline decoration-[#D8BC87]/55 hover:decoration-[#F5D692] text-[#CBBBA4] hover:text-[#F5EFE4] cursor-pointer transition-colors"
            >
              reroll
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
