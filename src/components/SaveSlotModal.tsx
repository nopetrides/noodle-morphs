import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Hammer,
  PlusCircle,
  Save,
  SlidersHorizontal,
  Sparkles,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import {
  ContentFlag,
  createGameConfigForMode,
  getGameModeLabel,
  hasContentFlag,
  type GameConfig,
  type GameModeId,
  type SaveSlotId,
} from '../game/contentFlags';
import { formatCurrency } from '../game/economy';
import type { SaveSlotSummary } from '../game/storage';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';

export type SaveSlotModalMode = 'new' | 'load' | 'save';

interface SaveSlotModalProps {
  mode: SaveSlotModalMode;
  slots: SaveSlotSummary[];
  activeSlotId: SaveSlotId | null;
  onClose: () => void;
  onStartNewGame: (slotId: SaveSlotId, config: GameConfig) => void;
  onLoadSlot: (slotId: SaveSlotId) => void;
  onSaveToSlot: (slotId: SaveSlotId) => void;
  onDeleteSlot: (slotId: SaveSlotId) => void;
}

function formatSavedTimestamp(ts: number): string {
  if (!ts) return 'Empty';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Saved';
  }
}

export function SaveSlotModal({
  mode,
  slots,
  activeSlotId,
  onClose,
  onStartNewGame,
  onLoadSlot,
  onSaveToSlot,
  onDeleteSlot,
}: SaveSlotModalProps) {
  const firstEmpty = slots.find((s) => s.isEmpty)?.slotId ?? 1;
  const [selectedSlotId, setSelectedSlotId] = useState<SaveSlotId>(
    mode === 'new' ? firstEmpty : (activeSlotId ?? slots.find((s) => !s.isEmpty)?.slotId ?? 1)
  );
  const [gameMode, setGameMode] = useState<GameModeId>('real_plus_fun');
  const [customSystemsOpen, setCustomSystemsOpen] = useState<boolean>(false);
  const [jeanPoolEnabled, setJeanPoolEnabled] = useState<boolean>(true);
  const [hissDepotEnabled, setHissDepotEnabled] = useState<boolean>(true);
  const hasCustomSystems = !jeanPoolEnabled || !hissDepotEnabled;
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState<SaveSlotId | null>(null);
  const [confirmOverwriteSlot, setConfirmOverwriteSlot] = useState<SaveSlotId | null>(null);

  const selectedSlot = slots.find((s) => s.slotId === selectedSlotId) ?? slots[0];

  const handleNewConfirm = () => {
    const config = createGameConfigForMode(gameMode, {
      jeanPool: jeanPoolEnabled,
      hissDepot: hissDepotEnabled,
    });
    if (!selectedSlot.isEmpty && confirmOverwriteSlot !== selectedSlotId) {
      setConfirmOverwriteSlot(selectedSlotId);
      return;
    }
    onStartNewGame(selectedSlotId, config);
  };

  const handleSaveSlotClick = (slot: SaveSlotSummary) => {
    setSelectedSlotId(slot.slotId);
    if (!slot.isEmpty && slot.slotId !== activeSlotId && confirmOverwriteSlot !== slot.slotId) {
      setConfirmOverwriteSlot(slot.slotId);
      return;
    }
    onSaveToSlot(slot.slotId);
  };

  const title =
    mode === 'new'
      ? 'New Terrarium'
      : mode === 'load'
        ? 'Load Terrarium'
        : 'Save Terrarium';

  const subtitle =
    mode === 'new'
      ? 'Choose a save slot, game mode, and active systems for your new vivarium.'
      : mode === 'load'
        ? 'Select a saved vivarium to load.'
        : 'Choose a slot to save your current vivarium progress.';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-slot-modal-title"
      data-testid="save-slot-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#100C09]/86"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#1F1A15] border border-[#D8BC87]/35 shadow-2xl shadow-black/75 text-[#F5EFE4] overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[#D8BC87]/20 bg-[#181410]">
          <div>
            <h2
              id="save-slot-modal-title"
              className="font-display text-xl sm:text-2xl font-semibold text-[#F7F1E5] flex items-center gap-2"
            >
              {mode === 'new' && <PlusCircle className="w-5 h-5 text-[#D9A754]" aria-hidden="true" />}
              {mode === 'load' && <FolderOpen className="w-5 h-5 text-[#D9A754]" aria-hidden="true" />}
              {mode === 'save' && <Save className="w-5 h-5 text-[#D9A754]" aria-hidden="true" />}
              <span>{title}</span>
            </h2>
            <p className="text-xs text-[#B5A693] mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close slot picker"
            className="p-1.5 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-[#C8BAA5] hover:text-[#F5EFE4] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 3 Save Slots */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#B3A490]">
              Save Slots
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              {slots.map((slot) => {
                const isSelected = selectedSlotId === slot.slotId;
                const isActive = activeSlotId === slot.slotId;
                const hasJP = hasContentFlag(slot.gameConfig.contentFlags, ContentFlag.JeanPool);
                const hasHD = hasContentFlag(slot.gameConfig.contentFlags, ContentFlag.HissDepot);

                return (
                  <div
                    key={slot.slotId}
                    data-testid={`save-slot-${slot.slotId}`}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isSelected
                        ? 'bg-[#2B231B] border-[#D9A754]/70'
                        : 'bg-[#241E18] border-[#D8BC87]/20 hover:border-[#D8BC87]/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmOverwriteSlot(null);
                          setConfirmDeleteSlot(null);
                          if (mode === 'load') {
                            if (!slot.isEmpty) onLoadSlot(slot.slotId);
                          } else if (mode === 'save') {
                            handleSaveSlotClick(slot);
                          } else {
                            setSelectedSlotId(slot.slotId);
                          }
                        }}
                        disabled={mode === 'load' && slot.isEmpty}
                        className="flex-1 text-left flex items-center gap-3.5 min-w-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                      >
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-[#1A1511] border border-[#D8BC87]/25 flex flex-col items-center justify-center">
                          <span className="text-[10px] uppercase tracking-wider text-[#A89884]">
                            Slot
                          </span>
                          <span className="font-mono-code text-sm font-semibold text-[#F1CD82] leading-none">
                            {slot.slotId}
                          </span>
                        </div>

                        {slot.isEmpty ? (
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-[#C8BAA5]">Empty Slot</div>
                            <div className="text-[11px] text-[#8F806E]">
                              {mode === 'load'
                                ? 'No vivarium saved here'
                                : mode === 'save'
                                  ? 'Click to save current vivarium here'
                                  : 'Ready for a fresh terrarium'}
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-sm font-semibold text-[#F7F1E5]">
                                {slot.snakeCount} {slot.snakeCount === 1 ? 'Snake' : 'Snakes'} ·{' '}
                                {slot.discoveredCount} Morphs
                              </span>
                              {isActive && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#2C3F2F] text-[#CBEAD0] border border-[#65A37D]/35">
                                  Active
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                  slot.gameConfig.mode === 'real_only'
                                    ? 'bg-[#2C281E] text-[#E6C78A] border-[#D9A754]/35'
                                    : 'bg-[#332642] text-[#DEC2FF] border-[#9B6EDB]/35'
                                }`}
                              >
                                {getGameModeLabel(slot.gameConfig.mode)}
                              </span>
                              {!hasJP && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A221B] text-[#A89884]">
                                  No Jean Pool
                                </span>
                              )}
                              {!hasHD && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A221B] text-[#A89884]">
                                  No Hiss Depot
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[#A89884] flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums">
                              <span>{slot.clutchesHatched} clutches</span>
                              <span>·</span>
                              <span>{formatCurrency(slot.money)}</span>
                              <span>·</span>
                              <span>Saved {formatSavedTimestamp(slot.savedAt)}</span>
                            </div>
                          </div>
                        )}

                        {!slot.isEmpty && slot.previewSnakes.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1 shrink-0">
                            {slot.previewSnakes.slice(0, 2).map((s) => (
                              <MiniSnakeCanvas
                                key={s.id}
                                phenotype={s.phenotype}
                                width={64}
                                height={28}
                                animate={false}
                                seedOverride={s.polygenicSeed}
                              />
                            ))}
                          </div>
                        )}
                      </button>

                      {/* Slot Action / Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mode === 'save' && (
                          <button
                            type="button"
                            onClick={() => handleSaveSlotClick(slot)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] text-xs font-semibold cursor-pointer"
                          >
                            {confirmOverwriteSlot === slot.slotId ? 'Confirm Overwrite' : 'Save Here'}
                          </button>
                        )}
                        {mode === 'load' && !slot.isEmpty && (
                          <button
                            type="button"
                            onClick={() => onLoadSlot(slot.slotId)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] text-xs font-semibold cursor-pointer"
                          >
                            Load
                          </button>
                        )}
                        {!slot.isEmpty && (
                          confirmDeleteSlot === slot.slotId ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteSlot(null);
                                  onDeleteSlot(slot.slotId);
                                }}
                                className="px-2 py-1 rounded-md bg-[#C96B52] hover:bg-[#D97A60] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSlot(null)}
                                className="px-2 py-1 rounded-md bg-[#332A22] text-[#D8CEBE] text-[11px] cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSlot(slot.slotId)}
                              title={`Delete Slot ${slot.slotId}`}
                              aria-label={`Delete Slot ${slot.slotId}`}
                              className="p-1.5 rounded-lg text-[#B89284] hover:text-[#F2AE98] hover:bg-[#33231D] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Game Mode & Content Switches */}
          {mode === 'new' && (
            <>
              <div className="space-y-2.5 pt-2 border-t border-[#D8BC87]/18">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#B3A490]">
                  Game Mode
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="mode-real-only"
                    onClick={() => setGameMode('real_only')}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      gameMode === 'real_only'
                        ? 'bg-[#2E251B] border-[#D9A754] shadow-md shadow-black/25'
                        : 'bg-[#231D17] border-[#D8BC87]/20 hover:border-[#D8BC87]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-[#F7F1E5]">Real Morphs Only</span>
                      {gameMode === 'real_only' && (
                        <Check className="w-4 h-4 text-[#D9A754]" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-xs text-[#B3A490] leading-relaxed">
                      Authentic real-world ball python genetics only. All custom genes are disabled
                      across starters, mutations, and shops.
                    </p>
                  </button>

                  <button
                    type="button"
                    data-testid="mode-real-plus-fun"
                    onClick={() => setGameMode('real_plus_fun')}
                    className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      gameMode === 'real_plus_fun'
                        ? 'bg-[#2A2133] border-[#B68DF2] shadow-md shadow-black/25'
                        : 'bg-[#231D17] border-[#D8BC87]/20 hover:border-[#D8BC87]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-[#F7F1E5] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#DEC2FF]" aria-hidden="true" />
                        <span>Real + Fun</span>
                      </span>
                      {gameMode === 'real_plus_fun' && (
                        <Check className="w-4 h-4 text-[#DEC2FF]" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-xs text-[#B3A490] leading-relaxed">
                      All real-world morphs plus Morpharium custom original patterns and elemental
                      fusions.
                    </p>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#D8BC87]/15">
                <button
                  type="button"
                  data-testid="toggle-custom-game-options"
                  onClick={() => setCustomSystemsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#A89884] hover:text-[#EFE5D6] transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#B3A490]" aria-hidden="true" />
                  <span>Custom game</span>
                  {hasCustomSystems && (
                    <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded bg-[#D9A754]/20 text-[#F1CD82]">
                      edited
                    </span>
                  )}
                  {customSystemsOpen ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#8F806E]" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#8F806E]" aria-hidden="true" />
                  )}
                </button>

                {customSystemsOpen && (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-[#231D17] border border-[#D8BC87]/20 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        data-testid="toggle-jean-pool"
                        checked={jeanPoolEnabled}
                        onChange={(e) => setJeanPoolEnabled(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#D9A754] rounded cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#EFE5D6] flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-[#8BB3DE]" aria-hidden="true" />
                          <span>The Jean Pool</span>
                        </div>
                        <p className="text-[11px] text-[#A89884] mt-0.5">
                          Adopt missing single-gene breeders and show the Jean Pool intro tutorial.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 rounded-xl bg-[#231D17] border border-[#D8BC87]/20 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        data-testid="toggle-hiss-depot"
                        checked={hissDepotEnabled}
                        onChange={(e) => setHissDepotEnabled(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-[#D9A754] rounded cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#EFE5D6] flex items-center gap-1.5">
                          <Hammer className="w-3.5 h-3.5 text-[#E8A36D]" aria-hidden="true" />
                          <span>The Hiss Depot</span>
                        </div>
                        <p className="text-[11px] text-[#A89884] mt-0.5">
                          Vivarium upgrades for clutch size, glass display slots, and gene bias.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer for New Game */}
        {mode === 'new' && (
          <div className="px-5 py-3.5 border-t border-[#D8BC87]/20 bg-[#181410] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#B3A490]">
              {!selectedSlot.isEmpty
                ? confirmOverwriteSlot === selectedSlotId
                  ? `Click again to overwrite Slot ${selectedSlotId}.`
                  : `Slot ${selectedSlotId} already has a saved vivarium.`
                : `Creating new save in Slot ${selectedSlotId}.`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-xs font-medium text-[#E6DAC8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-new-game-btn"
                onClick={handleNewConfirm}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  confirmOverwriteSlot === selectedSlotId
                    ? 'bg-[#C96B52] hover:bg-[#D97A60] text-white'
                    : 'bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610]'
                }`}
              >
                {confirmOverwriteSlot === selectedSlotId
                  ? `Overwrite Slot ${selectedSlotId} & Start`
                  : `Start in Slot ${selectedSlotId}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
