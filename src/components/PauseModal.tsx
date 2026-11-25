import { useState } from 'react';

interface PauseModalProps {
  snakeCount: number;
  discoveredCount: number;
  clutchesHatched: number;
  onResume: () => void;
  onReturnTitle: () => void;
  onResetTerrarium: () => void;
}

export function PauseModal({
  snakeCount,
  discoveredCount,
  clutchesHatched,
  onResume,
  onReturnTitle,
  onResetTerrarium,
}: PauseModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#100C09]/82"
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#1F1A15] border border-[#D8BC87]/35 shadow-2xl shadow-black/70 p-6 text-[#F5EFE4]">
        <h2
          id="pause-modal-title"
          className="font-display text-2xl font-semibold text-[#F7F1E5] mb-1"
        >
          Terrarium Paused
        </h2>
        <p className="text-xs text-[#B5A693] mb-5">
          Your noodles and incubator timer are resting quietly.
        </p>

        <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-[#27201A] border border-[#D8BC87]/15 mb-5 text-center">
          <div>
            <div className="font-mono-code text-lg font-semibold text-[#F5EFE4] tabular-nums">
              {snakeCount}
            </div>
            <div className="text-[11px] text-[#A89884]">Snakes</div>
          </div>
          <div>
            <div className="font-mono-code text-lg font-semibold text-[#E6BE70] tabular-nums">
              {discoveredCount}
            </div>
            <div className="text-[11px] text-[#A89884]">Morphs</div>
          </div>
          <div>
            <div className="font-mono-code text-lg font-semibold text-[#F5EFE4] tabular-nums">
              {clutchesHatched}
            </div>
            <div className="text-[11px] text-[#A89884]">Clutches</div>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-xl bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] font-semibold text-sm transition-colors cursor-pointer"
          >
            Resume Terrarium
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2B241D] hover:bg-[#382F26] text-[#EDE3D3] font-medium text-sm transition-colors cursor-pointer"
          >
            Return to Title
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium text-[#C89A8A] hover:text-[#F0B8A5] hover:bg-[#2A1F1B] transition-colors cursor-pointer"
            >
              Reset Terrarium Save
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-[#2C1E1A] border border-[#C97C63]/40 space-y-2">
              <p className="text-xs text-[#ECC8BA]">
                Start fresh with the 4 founder snakes?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    onResetTerrarium();
                  }}
                  className="flex-1 py-1.5 rounded-lg bg-[#C96B52] hover:bg-[#D97A60] text-[#FFF9F5] text-xs font-semibold cursor-pointer"
                >
                  Yes, Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 py-1.5 rounded-lg bg-[#382B24] hover:bg-[#46362D] text-[#E6DAC8] text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
