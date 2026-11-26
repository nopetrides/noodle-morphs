import { Sparkles, Store } from 'lucide-react';
import jeanPoolMascot from '../assets/images/jean_pool_mascot_1795554052499.jpg';
import { formatCurrency } from '../game/economy';

interface JeanPoolIntroModalProps {
  money: number;
  onAcknowledge: () => void;
}

export function JeanPoolIntroModal({ money, onAcknowledge }: JeanPoolIntroModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Jean Pool Unlocked"
      data-testid="jean-pool-intro-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/75 backdrop-blur-[1.5px]"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1E1914] border border-[#6C8FB8]/55 shadow-2xl shadow-black/80 p-5 sm:p-6 text-[#F5EFE4] space-y-4 animate-card-reveal">
        <div className="flex items-center gap-4">
          <img
            src={jeanPoolMascot}
            alt="The Jean Pool mascot — ball python peeking through denim jeans"
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#7FA3CE]/65 shadow-md shrink-0"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9BC1EC] mb-0.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Shop Open</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F5EFE4]">
              The Jean Pool is Open!
            </h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#D8CFC2]">
          Nice sale! You now have{' '}
          <span className="font-mono-code font-semibold text-[#E9C16E]">
            {formatCurrency(money)}
          </span>{' '}
          in vivarium funds. Visit <strong className="text-[#DCE8F7]">The Jean Pool</strong> anytime
          from the bottom dock to spend your funds on new breeding stock carrying{' '}
          <strong className="text-[#F5EFE4]">genes you do not yet have</strong>.
        </p>

        <div className="rounded-xl bg-[#192029]/85 border border-[#6C8FB8]/30 px-3.5 py-2.5 text-xs text-[#BFD4EC]">
          Each shipment offers up to 3 single-gene snakes missing from your collection, then restocks
          after a cooldown.
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            data-testid="jean-pool-intro-visit"
            onClick={onAcknowledge}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#6B93C2] hover:bg-[#7CA4D4] text-[#0D131A] text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-black/35"
          >
            <Store className="w-4 h-4" aria-hidden="true" />
            <span>Let&apos;s take a look</span>
          </button>
        </div>
      </div>
    </div>
  );
}
