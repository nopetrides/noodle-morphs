import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Pencil, X } from 'lucide-react';
import type { SnakeEntity } from '../game/types';

interface SnakeInspectorCardProps {
  snake: SnakeEntity;
  isSire: boolean;
  isDam: boolean;
  canHideFromDisplay: boolean;
  onClose: () => void;
  onRename: (snakeId: string, newName: string) => void;
  onToggleDisplay: (snakeId: string) => void;
  onAssignParent: (role: 'sire' | 'dam', snakeId: string) => void;
}

export function isHatchDayAnniversary(hatchedAt: number, now: Date = new Date()): boolean {
  if (!Number.isFinite(hatchedAt) || hatchedAt <= 0) return false;
  const hatched = new Date(hatchedAt);
  return (
    hatched.getFullYear() !== now.getFullYear() &&
    hatched.getMonth() === now.getMonth() &&
    hatched.getDate() === now.getDate()
  );
}

export function formatHatchedAt(hatchedAt: number): string {
  if (!Number.isFinite(hatchedAt) || hatchedAt <= 0) return 'Unknown';
  return new Date(hatchedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SnakeInspectorCard({
  snake,
  isSire,
  isDam,
  canHideFromDisplay,
  onClose,
  onRename,
  onToggleDisplay,
  onAssignParent,
}: SnakeInspectorCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(snake.name);

  useEffect(() => {
    setDraftName(snake.name);
    setEditing(false);
  }, [snake.id, snake.name]);

  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed.length > 0) {
      onRename(snake.id, trimmed);
    } else {
      setDraftName(snake.name);
    }
    setEditing(false);
  };

  const { phenotype } = snake;
  const now = new Date();
  const isHatchDay = isHatchDayAnniversary(snake.hatchedAt, now);
  const hatchYears = isHatchDay ? Math.abs(now.getFullYear() - new Date(snake.hatchedAt).getFullYear()) : 0;

  return (
    <aside
      data-testid="snake-inspector"
      aria-label={`Inspecting ${snake.name}`}
      className="fixed left-3 sm:left-4 bottom-20 z-20 w-[min(340px,calc(100vw-24px))] rounded-xl bg-[#1F1A15]/96 border border-[#D8BC87]/35 shadow-2xl shadow-black/50 p-4 text-[#F5EFE4]"
    >
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitRename();
              }}
              className="flex items-center gap-1.5"
            >
              <label htmlFor="inspector-rename" className="sr-only">
                Snake name
              </label>
              <input
                id="inspector-rename"
                type="text"
                maxLength={24}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                autoFocus
                className="w-full px-2 py-1 rounded bg-[#2F271F] border border-[#D9A754] text-sm font-semibold text-[#F5EFE4] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Save snake name"
                className="p-1.5 rounded bg-[#D9A754] text-[#1C1610] hover:bg-[#E5B868] cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-semibold text-[#F7F1E5] truncate">
                {snake.name}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={`Rename ${snake.name}`}
                className="p-1 rounded text-[#B9A78E] hover:text-[#F5EFE4] hover:bg-[#2F271F] cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <p className="text-xs text-[#E4BE74] font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{phenotype.morphName}</span>
            {phenotype.isCustomMorph && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                Custom
              </span>
            )}
            <span className="text-[#9E8F7B]">· Gen {snake.generation}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close snake inspector"
          className="p-1.5 rounded-lg text-[#B5A592] hover:text-[#F5EFE4] hover:bg-[#2E261F] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modular Pattern Rule & Genetics Summary */}
      <div className="space-y-2 text-xs border-t border-[#D8BC87]/15 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[#A89884]">Pattern Rule</span>
          <span className="font-mono-code text-[#EDE2CE] text-[11px]">
            {phenotype.patternRule.formula}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[#A89884]">Pattern Motif</span>
          <span className="font-mono-code text-[#D9B675] tracking-widest">
            {phenotype.patternRule.glyph}
          </span>
        </div>

        {phenotype.hetGenes.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#A89884]">Recessive Carriers</span>
            <span className="text-[#DCD0BD] text-right">
              Het {phenotype.hetGenes.join(', ')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-[#A89884]">Breeding Vigour</span>
          <span className="font-mono-code tabular-nums text-[#DCD0BD]">
            {Math.round(snake.currentVigor)}/{phenotype.lineageVigor} · {phenotype.behaviorLabel}
          </span>
        </div>

        {snake.hatchedAt > 0 && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[#A89884]">Hatched</span>
            <span className="text-[#DCD0BD] text-right flex items-center gap-1">
              <span>{formatHatchedAt(snake.hatchedAt)}</span>
              {isHatchDay && (
                <span
                  role="img"
                  aria-label="Hatch day anniversary"
                  title={`Happy Hatch Day! (${hatchYears} ${hatchYears === 1 ? 'yr' : 'yrs'})`}
                  className="text-sm leading-none"
                >
                  🎂
                </span>
              )}
            </span>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-[#C4B7A5] pt-1">
          {phenotype.healthPredisposition}
        </p>

        {snake.sire && snake.dam && (
          <p className="text-[11px] text-[#A89884]">
            Parents: <span className="text-[#DFD3C2]">{snake.sire.name}</span> ×{' '}
            <span className="text-[#DFD3C2]">{snake.dam.name}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-[#D8BC87]/15">
        <button
          type="button"
          onClick={() => onAssignParent('sire', snake.id)}
          disabled={isSire}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            isSire
              ? 'bg-[#3C3124] text-[#D9B675] cursor-default'
              : 'bg-[#2B241D] hover:bg-[#3A3026] text-[#EDE3D3] cursor-pointer'
          }`}
        >
          {isSire ? 'Parent A ✓' : 'Set Parent A'}
        </button>

        <button
          type="button"
          onClick={() => onAssignParent('dam', snake.id)}
          disabled={isDam}
          className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            isDam
              ? 'bg-[#3C3124] text-[#D9B675] cursor-default'
              : 'bg-[#2B241D] hover:bg-[#3A3026] text-[#EDE3D3] cursor-pointer'
          }`}
        >
          {isDam ? 'Parent B ✓' : 'Set Parent B'}
        </button>

        <button
          type="button"
          onClick={() => onToggleDisplay(snake.id)}
          disabled={snake.onDisplay && !canHideFromDisplay}
          aria-label={snake.onDisplay ? `Rest ${snake.name} in enclosure rack` : `Display ${snake.name} in terrarium`}
          title={
            snake.onDisplay
              ? canHideFromDisplay
                ? 'Move off display'
                : 'Keep at least one snake in the terrarium'
              : 'Display in terrarium'
          }
          className="p-2 rounded-lg bg-[#2B241D] hover:bg-[#3A3026] disabled:opacity-40 text-[#DFD3C2] cursor-pointer"
        >
          {snake.onDisplay ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
