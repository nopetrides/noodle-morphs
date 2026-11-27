import { useState } from 'react';
import { FolderOpen, Gauge, Monitor, Save } from 'lucide-react';
import { getGameModeLabel, type GameConfig, type SaveSlotId } from '../game/contentFlags';
import {
  type BackgroundRenderMode,
  getRenderQualityProfile,
  RENDER_QUALITY_ORDER,
  type RenderSettings,
} from '../game/renderSettings';

interface PauseModalProps {
  activeSlotId: SaveSlotId | null;
  gameConfig: GameConfig;
  renderSettings: RenderSettings;
  hasSaves: boolean;
  snakeCount: number;
  discoveredCount: number;
  clutchesHatched: number;
  onChangeRenderSettings: (next: RenderSettings) => void;
  onResume: () => void;
  onOpenSaveModal: () => void;
  onOpenLoadModal: () => void;
  onReturnTitle: () => void;
  onResetTerrarium: () => void;
}

const BACKGROUND_MODE_OPTIONS: Array<{ id: BackgroundRenderMode; label: string }> = [
  { id: 'pause', label: 'Pause' },
  { id: 'eco', label: 'Eco (5 FPS)' },
  { id: 'normal', label: 'Full' },
];

export function PauseModal({
  activeSlotId,
  gameConfig,
  renderSettings,
  hasSaves,
  snakeCount,
  discoveredCount,
  clutchesHatched,
  onChangeRenderSettings,
  onResume,
  onOpenSaveModal,
  onOpenLoadModal,
  onReturnTitle,
  onResetTerrarium,
}: PauseModalProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const qualityIndex = Math.max(0, RENDER_QUALITY_ORDER.indexOf(renderSettings.quality));
  const activeProfile = getRenderQualityProfile(renderSettings.quality);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-modal-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#100C09]/82"
    >
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-[#1F1A15] border border-[#D8BC87]/35 shadow-2xl shadow-black/70 p-6 text-[#F5EFE4]">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2
            id="pause-modal-title"
            className="font-display text-2xl font-semibold text-[#F7F1E5]"
          >
            Terrarium Paused
          </h2>
          {activeSlotId !== null && (
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-[#2B241D] text-[#E6BE70] border border-[#D8BC87]/25 shrink-0">
              Slot {activeSlotId}
            </span>
          )}
        </div>
        <p className="text-xs text-[#B5A693] mb-4">
          {getGameModeLabel(gameConfig.mode)} · Your noodles and incubator timer are resting quietly.
        </p>

        <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-[#27201A] border border-[#D8BC87]/15 mb-4 text-center">
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

        {/* Display & Performance Controls (Browser Quality Slider + Background Throttling) */}
        <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/18 p-3.5 mb-4 space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#EFE5D6]">
                <Gauge className="w-3.5 h-3.5 text-[#D9A754]" aria-hidden="true" />
                <span>Render Quality</span>
              </span>
              <span
                data-testid="pause-quality-label"
                className="font-mono-code text-[11px] font-semibold text-[#E6BE70]"
              >
                {activeProfile.label}
              </span>
            </div>
            <input
              type="range"
              aria-label="Render Quality"
              data-testid="pause-quality-slider"
              min={0}
              max={RENDER_QUALITY_ORDER.length - 1}
              step={1}
              value={qualityIndex}
              onChange={(e) => {
                const nextPreset = RENDER_QUALITY_ORDER[Number(e.target.value)] ?? 'high';
                onChangeRenderSettings({ ...renderSettings, quality: nextPreset });
              }}
              className="w-full accent-[#D9A754] h-1.5 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#8F806E] px-0.5">
              <span>Low</span>
              <span>Balanced</span>
              <span>High</span>
              <span>Ultra</span>
            </div>
            <p className="text-[11px] text-[#B3A490]">{activeProfile.description}</p>
          </div>

          <div className="pt-2.5 border-t border-[#D8BC87]/12 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#EFE5D6]">
                <Monitor className="w-3.5 h-3.5 text-[#7AE0D4]" aria-hidden="true" />
                <span>Background Window</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-[#1A1511] p-1 rounded-lg border border-[#D8BC87]/15">
              {BACKGROUND_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`pause-bg-mode-${opt.id}`}
                  onClick={() =>
                    onChangeRenderSettings({ ...renderSettings, backgroundMode: opt.id })
                  }
                  className={`py-1 px-1.5 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                    renderSettings.backgroundMode === opt.id
                      ? 'bg-[#D9A754] text-[#1C1610] font-semibold'
                      : 'text-[#B3A490] hover:text-[#F5EFE4]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#9E8F7B]">
              Hidden browser tabs always pause rendering automatically to protect GPU memory.
            </p>
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

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="pause-save-btn"
              onClick={onOpenSaveModal}
              className="py-2.5 px-3 rounded-xl bg-[#2B241D] hover:bg-[#382F26] text-[#EDE3D3] font-medium text-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-[#D9A754]" aria-hidden="true" />
              <span>Save</span>
            </button>
            <button
              type="button"
              data-testid="pause-load-btn"
              onClick={onOpenLoadModal}
              disabled={!hasSaves}
              className="py-2.5 px-3 rounded-xl bg-[#2B241D] hover:bg-[#382F26] disabled:opacity-40 text-[#EDE3D3] font-medium text-sm transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#D9A754]" aria-hidden="true" />
              <span>Load</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="pause-return-title-btn"
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
              Reset Current Slot
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-[#2C1E1A] border border-[#C97C63]/40 space-y-2">
              <p className="text-xs text-[#ECC8BA]">
                Start fresh in Slot {activeSlotId ?? 1} with a new starter pair?
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
