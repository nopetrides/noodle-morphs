import { HeartHandshake, ShieldAlert } from 'lucide-react';

interface SpiderLethalModalProps {
  attemptedA: string;
  attemptedB: string;
  replacementName: string | null;
  onClose: () => void;
}

export function SpiderLethalModal({
  attemptedA,
  attemptedB,
  replacementName,
  onClose,
}: SpiderLethalModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spider-lethal-modal-title"
      data-testid="spider-lethal-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/80 backdrop-blur-[1.5px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[#1F1A15] border border-[#E6A382]/55 shadow-2xl shadow-black/80 p-5 sm:p-6 text-[#F5EFE4] space-y-4 animate-card-reveal">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#3A231B] border border-[#E6A382]/45 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#F0AC8B]" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#E9A684]">
              Ethical Breeding Guard
            </div>
            <h2
              id="spider-lethal-modal-title"
              className="font-display text-xl font-semibold text-[#F7F1E5] leading-snug"
            >
              Spider × Spider Pairing Blocked
            </h2>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-[#D8CFC2]">
          Pairing <strong className="text-[#F5EFE4]">{attemptedA}</strong> and{' '}
          <strong className="text-[#F5EFE4]">{attemptedB}</strong> can produce a homozygous{' '}
          <strong className="text-[#F0AC8B]">Super Spider</strong>, which is lethal in real ball
          pythons. Responsible breeders never pair two Spider carriers together.
        </p>

        <div className="rounded-xl bg-[#262019] border border-[#D8BC87]/25 px-3.5 py-2.5 text-xs text-[#DFD3C2] flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-[#D9A754] shrink-0" aria-hidden="true" />
          <span>
            {replacementName ? (
              <>
                Automatically paired with{' '}
                <strong className="text-[#F5EFE4]">{replacementName}</strong> instead to keep your
                clutch healthy.
              </>
            ) : (
              <>Kept your current safe breeding pair instead.</>
            )}
          </span>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            data-testid="spider-lethal-modal-close"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] text-sm font-semibold transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
