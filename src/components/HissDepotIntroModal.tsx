import { Hammer, Sparkles } from 'lucide-react';
import hissDepotMascot from '../assets/images/hiss_depot_mascot_1795554050643.jpg';
import { formatCurrency } from '../game/economy';

interface HissDepotIntroModalProps {
  money: number;
  onAcknowledge: () => void;
}

export function HissDepotIntroModal({ money, onAcknowledge }: HissDepotIntroModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="The Hiss Depot Unlocked"
      data-testid="hiss-depot-intro-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/75 backdrop-blur-[1.5px]"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1E1914] border border-[#DF8342]/55 shadow-2xl shadow-black/80 p-5 sm:p-6 text-[#F5EFE4] space-y-4 animate-card-reveal">
        <div className="flex items-center gap-4">
          <img
            src={hissDepotMascot}
            alt="The Hiss Depot mascot — ball python in a hardware apron"
            className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-[#E69354]/70 shadow-md shrink-0"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#F3B078] mb-0.5">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Shop Open</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#F5EFE4]">
              The Hiss Depot is Open!
            </h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#D8CFC2]">
          Your breeding program is growing! With{' '}
          <span className="font-mono-code font-semibold text-[#E9C16E]">
            {formatCurrency(money)}
          </span>{' '}
          on hand, you can visit <strong className="text-[#FBD7B6]">The Hiss Depot</strong> anytime
          from the bottom dock to upgrade your vivarium.
        </p>

        <div className="rounded-xl bg-[#2A1C14]/85 border border-[#DF8342]/30 px-3.5 py-2.5 text-xs text-[#F5C9A3]">
          Expand your glass display slots, tune incubator clutch size, and unlock gene inheritance
          bias controls.
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            data-testid="hiss-depot-intro-visit"
            onClick={onAcknowledge}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E28A48] hover:bg-[#EE9B5C] text-[#1C110A] text-sm font-semibold transition-colors cursor-pointer shadow-md shadow-black/35"
          >
            <Hammer className="w-4 h-4" aria-hidden="true" />
            <span>Let&apos;s take a look</span>
          </button>
        </div>
      </div>
    </div>
  );
}
