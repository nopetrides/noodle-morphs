import {
  BookOpen,
  Droplets,
  Hammer,
  HeartHandshake,
  Lamp,
  LayoutGrid,
  Store,
} from 'lucide-react';
import type { ActiveDrawerTab } from '../game/types';

interface TerrariumDockProps {
  totalSnakes: number;
  displayedCount: number;
  maxDisplay: number;
  discoveredCount: number;
  heatLampOn: boolean;
  jeanPoolUnlocked: boolean;
  hissDepotUnlocked: boolean;
  jeanPoolCooldownSec: number;
  activeTab: ActiveDrawerTab | null;
  onOpenDrawer: (tab: ActiveDrawerTab) => void;
  onMist: () => void;
  onToggleHeatLamp: () => void;
}

export function TerrariumDock({
  totalSnakes,
  displayedCount,
  maxDisplay,
  discoveredCount,
  heatLampOn,
  jeanPoolUnlocked,
  hissDepotUnlocked,
  jeanPoolCooldownSec,
  activeTab,
  onOpenDrawer,
  onMist,
  onToggleHeatLamp,
}: TerrariumDockProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none flex justify-center px-2 pb-2.5 pt-1 sm:p-4">
      <div className="pointer-events-auto relative max-w-full rounded-xl bg-[#1F1A15]/95 border border-[#D8BC87]/30 shadow-lg shadow-black/45 px-2 pt-2 pb-1.5">
        <div className="dock-scroll flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onOpenDrawer('collection')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
              activeTab === 'collection'
                ? 'bg-[#D9A754] text-[#1C1610]'
                : 'bg-[#2B241D] hover:bg-[#382F26] text-[#F2EADF]'
            }`}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Collection</span>
            <span
              className={`font-mono-code text-xs tabular-nums ${
                activeTab === 'collection' ? 'text-[#2B2012]' : 'text-[#BCA98E]'
              }`}
            >
              {displayedCount}/{maxDisplay} · {totalSnakes}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer('breeding')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
              activeTab === 'breeding'
                ? 'bg-[#D9A754] text-[#1C1610]'
                : 'bg-[#2B241D] hover:bg-[#382F26] text-[#F2EADF]'
            }`}
          >
            <HeartHandshake className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Breed Pair</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer('morphdex')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
              activeTab === 'morphdex'
                ? 'bg-[#D9A754] text-[#1C1610]'
                : 'bg-[#2B241D] hover:bg-[#382F26] text-[#F2EADF]'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Morphdex</span>
            <span
              className={`font-mono-code text-xs tabular-nums ${
                activeTab === 'morphdex' ? 'text-[#2B2012]' : 'text-[#BCA98E]'
              }`}
            >
              {discoveredCount}
            </span>
          </button>

          {(jeanPoolUnlocked || hissDepotUnlocked) && (
            <div className="h-6 w-px bg-[#D8BC87]/20 mx-0.5 shrink-0" aria-hidden="true" />
          )}

          {jeanPoolUnlocked && (
            <button
              type="button"
              onClick={() => onOpenDrawer('jeanpool')}
              data-testid="jean-pool-dock-btn"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
                activeTab === 'jeanpool'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'bg-[#252B33] hover:bg-[#2F3742] text-[#DCE8F7] border border-[#6C8FB8]/30'
              }`}
            >
              <Store className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Jean Pool</span>
              {jeanPoolCooldownSec > 0 && (
                <span
                  className={`font-mono-code text-[11px] tabular-nums ${
                    activeTab === 'jeanpool' ? 'text-[#2B2012]' : 'text-[#9BB5D4]'
                  }`}
                >
                  {Math.ceil(jeanPoolCooldownSec / 60)}m
                </span>
              )}
            </button>
          )}

          {hissDepotUnlocked && (
            <button
              type="button"
              onClick={() => onOpenDrawer('hissdepot')}
              data-testid="hiss-depot-dock-btn"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
                activeTab === 'hissdepot'
                  ? 'bg-[#D9A754] text-[#1C1610]'
                  : 'bg-[#362419] hover:bg-[#462F20] text-[#FBD7B6] border border-[#DF8342]/35'
              }`}
            >
              <Hammer className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Hiss Depot</span>
            </button>
          )}

          <div className="h-6 w-px bg-[#D8BC87]/20 mx-0.5 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={onMist}
            aria-label="Mist terrarium"
            title="Spritz warm mist across moss"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-xs sm:text-sm font-medium text-[#CFE7E2] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70]"
          >
            <Droplets className="w-4 h-4 text-[#7BC0B8] shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Mist</span>
          </button>

          <button
            type="button"
            onClick={onToggleHeatLamp}
            aria-pressed={heatLampOn}
            aria-label={heatLampOn ? 'Turn basking lamp off' : 'Turn basking lamp on'}
            title={heatLampOn ? 'Basking Lamp: On' : 'Basking Lamp: Dusk Mode'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E8BE70] ${
              heatLampOn
                ? 'bg-[#3A2E1E] hover:bg-[#493924] text-[#F5D692] border border-[#D9A754]/40'
                : 'bg-[#2B241D] hover:bg-[#382F26] text-[#A89E92]'
            }`}
          >
            <Lamp className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{heatLampOn ? 'Lamp On' : 'Dusk'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
