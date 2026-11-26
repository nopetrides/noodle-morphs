import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FlaskConical,
  Grid2x2,
  Layers,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { ContentFlag, hasContentFlag } from '../game/contentFlags';
import { DEV_TOOLS_ENABLED } from '../game/env';
import { evaluateSnakeSaleValue, formatCurrency, getMaxVigor } from '../game/economy';
import {
  countAlleles,
  createSimulatedSnake,
  createWildTypeGenotype,
  evaluatePhenotype,
  getEnabledLoci,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  resolveSkinSpecForPhenotype,
} from '../game/genetics';
import { globalSkinCache } from '../game/skinCache';
import { renderMorphSpriteSheetProgressive } from '../game/spriteSheet';
import type {
  AllelePair,
  FieldOperation,
  Genotype,
  InheritanceMode,
  LocusId,
  MorphDiscovery,
  SkinDebugStage,
  SkinFieldParams,
  SkinPhenotypeSpec,
  SnakeEntity,
  SnakePalette,
} from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';

interface MorphSimulatorPanelProps {
  snakes: SnakeEntity[];
  discoveries: Record<string, MorphDiscovery>;
  soldMorphKeys: Set<string>;
  contentFlags: number;
  onDebugAddSnake: (snake: SnakeEntity) => void;
}

type SimulatorFilter = 'all' | 'real' | 'custom' | InheritanceMode;

const DEBUG_STAGES: { id: SkinDebugStage; label: string }[] = [
  { id: 'final', label: 'Final' },
  { id: 'raw_field', label: 'Raw Field' },
  { id: 'pigment_mask', label: 'Pigment' },
  { id: 'scale_map', label: 'Scales' },
];

const FIELD_OPS: FieldOperation[] = [
  'modulate',
  'blend',
  'smoothUnion',
  'union',
  'intersection',
  'subtract',
  'warp',
];

interface CalibrationSliderDef {
  key: keyof SkinFieldParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

const CALIBRATION_SLIDERS: CalibrationSliderDef[] = [
  { key: 'coverage', label: 'Coverage', min: 0.05, max: 0.92, step: 0.01 },
  { key: 'frequency', label: 'Frequency', min: 0.55, max: 1.85, step: 0.02 },
  { key: 'aspectRatio', label: 'Aspect', min: 0.55, max: 1.9, step: 0.02 },
  { key: 'warpStrength', label: 'Warp', min: 0, max: 0.9, step: 0.02 },
  { key: 'dorsalBias', label: 'Dorsal Bias', min: -0.6, max: 0.95, step: 0.02 },
  { key: 'symmetry', label: 'Symmetry', min: 0, max: 1, step: 0.02 },
  { key: 'widthContrast', label: 'Width Contrast', min: 0, max: 1, step: 0.02 },
  { key: 'baseTaper', label: 'Base Taper', min: 0, max: 1, step: 0.02 },
  { key: 'crownNotch', label: 'Crown Notch', min: 0, max: 1, step: 0.02 },
  { key: 'localWidthVariation', label: 'Local Width Variation', min: 0, max: 1, step: 0.02 },
  { key: 'regionalCoherence', label: 'Regional Coherence', min: 0, max: 1, step: 0.02 },
  { key: 'eyeCount', label: 'Eye Count', min: 0, max: 2, step: 1 },
  { key: 'blush', label: 'Blush', min: 0, max: 1, step: 0.02 },
  { key: 'flankFlame', label: 'Flank Flame', min: 0, max: 1, step: 0.02 },
  { key: 'calicoRise', label: 'Calico White', min: 0, max: 1, step: 0.02 },
  { key: 'scaleRelief', label: 'Scale Relief', min: 0, max: 1, step: 0.02 },
];

function UnwrappedSkinStrip({
  spec,
  palette,
  seed,
  debugStage,
}: {
  spec: SkinPhenotypeSpec;
  palette: SnakePalette;
  seed: number;
  debugStage: SkinDebugStage;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const entry = globalSkinCache.getOrSynthesize(spec, palette, seed, 256, 64, debugStage);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (entry.canvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(entry.canvas, 0, 0, canvas.width, canvas.height);
    }
  }, [spec, palette, seed, debugStage]);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono-code text-[#9E8F7B]">
        <span>Unwrapped Skin (u, v)</span>
        <span>Snout 0 → Tail 1</span>
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={56}
        data-testid="sim-unwrapped-uv-canvas"
        className="w-full h-[56px] rounded-md border border-[#D8BC87]/30 bg-[#14110E] block"
      />
    </div>
  );
}

function allelesForCount(count: 0 | 1 | 2): AllelePair {
  if (count === 2) return [1, 1];
  if (count === 1) return [1, 0];
  return [0, 0];
}

function getAlleleButtonLabels(mode: InheritanceMode): [string, string, string] {
  if (mode === 'recessive') return ['Off', 'Het (1×)', 'Vis (2×)'];
  if (mode === 'codominant') return ['Off', '1×', 'Super (2×)'];
  return ['Off', 'Vis (1×)', '2×'];
}

function formatActiveChipBadge(mode: InheritanceMode, count: number): string {
  if (mode === 'recessive') return count === 2 ? 'Visual' : 'Het';
  if (mode === 'codominant') return count === 2 ? 'Super' : '1×';
  return count === 2 ? '2×' : '1×';
}

export function MorphSimulatorPanel({
  snakes,
  discoveries,
  soldMorphKeys,
  contentFlags,
  onDebugAddSnake,
}: MorphSimulatorPanelProps) {
  const customEnabled = hasContentFlag(contentFlags, ContentFlag.CustomMorphs);
  const enabledLoci = useMemo(() => getEnabledLoci(contentFlags), [contentFlags]);
  const [genotype, setGenotype] = useState<Genotype>(() => createWildTypeGenotype());
  const [polygenicSeed, setPolygenicSeed] = useState<number>(0.42);
  const [includeUnowned, setIncludeUnowned] = useState<boolean>(false);
  const [confirmUnownedOpen, setConfirmUnownedOpen] = useState<boolean>(false);
  const [categoryFilter, setCategoryFilter] = useState<SimulatorFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [spawnNotice, setSpawnNotice] = useState<string | null>(null);

  // Skin Field Debugger state
  const [debugStage, setDebugStage] = useState<SkinDebugStage>('final');
  const [debuggerOpen, setDebuggerOpen] = useState<boolean>(false);
  const [paramOverrides, setParamOverrides] = useState<Partial<SkinFieldParams>>({});
  const [opOverride, setOpOverride] = useState<FieldOperation | 'auto'>('auto');
  const [opStrengthOverride, setOpStrengthOverride] = useState<number | null>(null);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  // Reference Sprite Sheet Exporter state (progressive non-blocking live canvas)
  const totalSheetSnakes = 1 + LOCI_ORDER.length * 2;
  const [sheetModalOpen, setSheetModalOpen] = useState<boolean>(false);
  const [sheetStage, setSheetStage] = useState<SkinDebugStage>('final');
  const [sheetIncludeUv, setSheetIncludeUv] = useState<boolean>(true);
  const [sheetDims, setSheetDims] = useState<{ width: number; height: number } | null>(null);
  const [sheetProgress, setSheetProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: totalSheetSnakes,
  });
  const [sheetExporting, setSheetExporting] = useState<boolean>(false);
  const sheetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Loci currently present (visual or het) anywhere in the player's collection
  const ownedLoci = useMemo(() => {
    const set = new Set<LocusId>();
    for (const snake of snakes) {
      for (const locus of enabledLoci) {
        if (countAlleles(snake.genotype[locus]) > 0) {
          set.add(locus);
        }
      }
    }
    return set;
  }, [snakes, enabledLoci]);

  const previewPhenotype = useMemo(
    () => evaluatePhenotype(genotype, polygenicSeed),
    [genotype, polygenicSeed]
  );

  const baseSkinSpec = useMemo(
    () => resolveSkinSpecForPhenotype(previewPhenotype),
    [previewPhenotype]
  );

  const hasOverrides =
    Object.keys(paramOverrides).length > 0 || opOverride !== 'auto' || opStrengthOverride !== null;

  const activeSkinSpec = useMemo<SkinPhenotypeSpec>(() => {
    if (!hasOverrides) return baseSkinSpec;
    return {
      ...baseSkinSpec,
      params: {
        ...baseSkinSpec.params,
        ...paramOverrides,
      },
      contributions: baseSkinSpec.contributions.map((c, idx) =>
        idx === 0
          ? {
              ...c,
              operation: opOverride === 'auto' ? c.operation : opOverride,
              strength: opStrengthOverride === null ? c.strength : opStrengthOverride,
            }
          : c
      ),
    };
  }, [baseSkinSpec, hasOverrides, paramOverrides, opOverride, opStrengthOverride]);

  // Lightweight virtual snake for valuation & max-vigor readouts
  const previewSnake = useMemo<SnakeEntity>(() => {
    return {
      id: 'sim_preview',
      name: customName.trim() || previewPhenotype.morphName,
      genotype,
      polygenicSeed,
      phenotype: previewPhenotype,
      currentVigor: previewPhenotype.lineageVigor,
      onDisplay: false,
      hatchedAt: 0,
      generation: 1,
      sire: null,
      dam: null,
      hatchOdds: 1,
      hatchOddsLabel: 'Simulated',
      wasMutation: false,
      petCount: 0,
    };
  }, [genotype, polygenicSeed, previewPhenotype, customName]);

  const valuation = useMemo(
    () => evaluateSnakeSaleValue(previewSnake, soldMorphKeys),
    [previewSnake, soldMorphKeys]
  );
  const maxVigor = getMaxVigor(previewSnake);
  const isAlreadyDiscovered = Boolean(discoveries[previewPhenotype.morphKey]);

  const activeLoci = useMemo(
    () =>
      enabledLoci.filter((id) => countAlleles(genotype[id]) > 0).map((id) => ({
        id,
        def: LOCUS_DEFINITIONS[id],
        count: countAlleles(genotype[id]),
      })),
    [genotype, enabledLoci]
  );

  const visibleLoci = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enabledLoci.filter((id) => {
      const def = LOCUS_DEFINITIONS[id];
      const active = countAlleles(genotype[id]) > 0;
      if (!includeUnowned && !ownedLoci.has(id) && !active) return false;
      if (categoryFilter === 'custom' && !def.isCustom) return false;
      if (categoryFilter === 'real' && def.isCustom) return false;
      if (
        (categoryFilter === 'dominant' ||
          categoryFilter === 'codominant' ||
          categoryFilter === 'recessive') &&
        def.mode !== categoryFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${def.name} ${def.superName ?? ''} ${def.visualEffect} ${def.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [includeUnowned, ownedLoci, genotype, categoryFilter, searchQuery, enabledLoci]);

  const clearFieldOverrides = () => {
    setParamOverrides({});
    setOpOverride('auto');
    setOpStrengthOverride(null);
    setCopiedJson(false);
  };

  const setLocusCount = (locusId: LocusId, count: 0 | 1 | 2) => {
    // Super Spider (2x) is homozygous lethal in real ball pythons and cannot be bred
    if (locusId === 'spider' && count === 2) return;
    setGenotype((prev) => ({
      ...prev,
      [locusId]: allelesForCount(count),
    }));
    clearFieldOverrides();
    setSpawnNotice(null);
  };

  const handleReset = () => {
    setGenotype(createWildTypeGenotype());
    setCustomName('');
    clearFieldOverrides();
    setDebugStage('final');
    setSpawnNotice(null);
  };

  const handleRerollSeed = () => {
    setPolygenicSeed(Math.round(Math.random() * 1000) / 1000);
  };

  const handleCopyCalibratedJson = () => {
    const payload = {
      morph: previewPhenotype.morphName,
      seed: Number(polygenicSeed.toFixed(3)),
      params: activeSkinSpec.params,
      contributions: activeSkinSpec.contributions,
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(() => {
        // Ignore clipboard errors in restricted frames
      });
    }
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleDevAddToCollection = () => {
    const existingNames = new Set(snakes.map((s) => s.name));
    const spawned = createSimulatedSnake(
      genotype,
      polygenicSeed,
      existingNames,
      customName.trim() || undefined
    );
    onDebugAddSnake(spawned);
    setSpawnNotice(`Added ${spawned.name} (${spawned.phenotype.morphName}) to Collection`);
    setCustomName('');
  };

  // Drive progressive off-thread sprite sheet rendering whenever the modal opens or options change
  useEffect(() => {
    if (!sheetModalOpen) return;
    const canvas = sheetCanvasRef.current;
    if (!canvas) return;

    const handle = renderMorphSpriteSheetProgressive(
      canvas,
      {
        seed: polygenicSeed,
        debugStage: sheetStage,
        includeUnwrappedStrip: sheetIncludeUv,
      },
      {
        onProgress: (done, total) => {
          setSheetProgress({ done, total });
        },
        onComplete: (total) => {
          setSheetProgress({ done: total, total });
        },
      }
    );
    setSheetDims({ width: handle.layout.width, height: handle.layout.height });

    return () => {
      handle.cancel();
    };
  }, [sheetModalOpen, sheetStage, sheetIncludeUv, polygenicSeed]);

  const handleOpenSpriteSheet = () => {
    setSheetStage(debugStage);
    setSheetProgress({ done: 0, total: totalSheetSnakes });
    setSheetModalOpen(true);
  };

  const handleChangeSheetStage = (nextStage: SkinDebugStage) => {
    setSheetStage(nextStage);
  };

  const handleToggleSheetUv = (nextIncludeUv: boolean) => {
    setSheetIncludeUv(nextIncludeUv);
  };

  const handleDownloadSpriteSheet = () => {
    const canvas = sheetCanvasRef.current;
    if (!canvas || sheetExporting) return;
    setSheetExporting(true);
    const filename = `morpharium-${totalSheetSnakes}-morphs-seed-${polygenicSeed.toFixed(3)}-${sheetStage}.png`;

    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        setSheetExporting(false);
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, 'image/png');
    } else {
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSheetExporting(false);
    }
  };

  const primaryContribution = activeSkinSpec.contributions[0];

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[345px_1fr] gap-5 items-start"
      data-testid="morph-simulator-panel"
    >
      {/* Left Sticky Live Preview & Debug Spawner */}
      <aside className="lg:sticky lg:top-0 space-y-3">
        <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/28 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3
                  data-testid="sim-preview-morph-name"
                  className="font-display text-xl font-semibold text-[#F7F1E5] leading-tight"
                >
                  {previewPhenotype.morphName}
                </h3>
                {previewPhenotype.isCustomMorph && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/40">
                    Custom
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#B3A490] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="capitalize text-[#E4BE74] font-medium">
                  {previewPhenotype.rarity}
                </span>
                <span>·</span>
                <span className="tabular-nums">Est. {formatCurrency(valuation.total)}</span>
                <span>·</span>
                <span className="tabular-nums">Vigour {maxVigor}</span>
              </div>
            </div>
            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                isAlreadyDiscovered
                  ? 'bg-[#2C3F2F] text-[#CBEAD0] border border-[#65A37D]/35'
                  : 'bg-[#3A2E1A] text-[#F1CD82] border border-[#D9A754]/40'
              }`}
            >
              {isAlreadyDiscovered ? 'Discovered' : 'Undiscovered'}
            </span>
          </div>

          <div className="flex justify-center">
            <MiniSnakeCanvas
              phenotype={previewPhenotype}
              width={310}
              height={118}
              animate
              debugStage={debugStage}
              skinSpecOverride={activeSkinSpec}
              seedOverride={polygenicSeed}
            />
          </div>

          {/* Stage View Switcher (Final / Raw Field / Pigment Mask / Scale Map) */}
          <div className="grid grid-cols-4 gap-1 bg-[#1B1612] p-1 rounded-lg border border-[#D8BC87]/18">
            {DEBUG_STAGES.map((stage) => (
              <button
                key={stage.id}
                type="button"
                data-testid={`sim-stage-${stage.id}`}
                onClick={() => setDebugStage(stage.id)}
                className={`py-1 px-1 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                  debugStage === stage.id
                    ? 'bg-[#D9A754] text-[#1C1610] font-semibold'
                    : 'text-[#B3A490] hover:text-[#F5EFE4]'
                }`}
              >
                {stage.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 text-[11px] font-mono-code text-[#DFC086] px-1">
            <span className="truncate">{previewPhenotype.patternRule.formula}</span>
            <span className="text-[#A89A87] shrink-0">{previewPhenotype.patternRule.glyph}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRerollSeed}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2F2720] hover:bg-[#3A3128] text-xs font-medium text-[#E6DAC8] cursor-pointer transition-colors"
            >
              <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reroll Seed</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={activeLoci.length === 0 && !hasOverrides && debugStage === 'final'}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2F2720] hover:bg-[#3A3128] disabled:opacity-40 text-xs font-medium text-[#E6DAC8] cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset Normal</span>
            </button>
          </div>

          {/* Skin Field Debugger Expandable Panel (Dev builds only) */}
          {DEV_TOOLS_ENABLED && (
            <div className="pt-2 border-t border-[#D8BC87]/15">
            <button
              type="button"
              data-testid="sim-field-debugger-toggle"
              onClick={() => setDebuggerOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#1D1814] hover:bg-[#2A221C] border border-[#D8BC87]/20 text-xs font-medium text-[#E8D5B0] cursor-pointer transition-colors"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#D9A754]" aria-hidden="true" />
                <span>Skin Field Debugger</span>
                {hasOverrides && (
                  <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded bg-[#D9A754]/20 text-[#F1CD82]">
                    edited
                  </span>
                )}
              </span>
              {debuggerOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-[#A89A87]" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#A89A87]" aria-hidden="true" />
              )}
            </button>

            {debuggerOpen && (
              <div
                data-testid="sim-field-debugger-body"
                className="mt-2.5 rounded-lg bg-[#1A1511] border border-[#D8BC87]/18 overflow-hidden"
              >
                {/* Pinned Unwrapped (u, v) Skin Strip — always visible while scrolling sliders */}
                <div className="p-3 pb-2.5 border-b border-[#D8BC87]/15 bg-[#1D1814]">
                  <UnwrappedSkinStrip
                    spec={activeSkinSpec}
                    palette={previewPhenotype.palette}
                    seed={polygenicSeed}
                    debugStage={debugStage}
                  />
                </div>

                {/* Scrollable Sliders & Field Operator Controls */}
                <div
                  data-testid="sim-field-sliders-scroll"
                  className="max-h-[195px] overflow-y-auto px-3 py-2.5 space-y-3"
                >
                  {/* Seed Lock Control */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#B3A490]">Polygenic Seed</span>
                      <span className="font-mono-code text-[#DFC086] tabular-nums">
                        {polygenicSeed.toFixed(3)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.005}
                      value={polygenicSeed}
                      onChange={(e) => setPolygenicSeed(parseFloat(e.target.value))}
                      className="w-full accent-[#D9A754] h-1.5 cursor-pointer"
                    />
                  </div>

                  {/* Composable Field Operator Tester (when custom field contributions are active) */}
                  {primaryContribution && (
                    <div className="space-y-1.5 pt-2 border-t border-[#D8BC87]/15">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 text-[#D6B8FF] font-medium">
                          <Layers className="w-3 h-3" aria-hidden="true" />
                          <span>Field: {primaryContribution.field}</span>
                        </span>
                        <span className="font-mono-code text-[10px] text-[#A89A87]">
                          {primaryContribution.operation}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          data-testid="sim-field-op-select"
                          value={opOverride}
                          onChange={(e) => setOpOverride(e.target.value as FieldOperation | 'auto')}
                          className="flex-1 bg-[#241E19] border border-[#9B6EDB]/35 rounded px-2 py-1 text-[11px] text-[#F5EFE4] focus:outline-none focus:border-[#B68DF2]"
                        >
                          <option value="auto">
                            Auto ({baseSkinSpec.contributions[0]?.operation})
                          </option>
                          {FIELD_OPS.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        <span className="font-mono-code text-[10px] text-[#DFC086] w-8 text-right tabular-nums">
                          {primaryContribution.strength.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1.2}
                        step={0.05}
                        value={primaryContribution.strength}
                        onChange={(e) => setOpStrengthOverride(parseFloat(e.target.value))}
                        className="w-full accent-[#9B6EDB] h-1.5 cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Live Phenotype Field Calibration Sliders */}
                  <div className="space-y-2 pt-2 border-t border-[#D8BC87]/15">
                    {CALIBRATION_SLIDERS.map((slider) => {
                      const val = activeSkinSpec.params[slider.key];
                      const isModified = paramOverrides[slider.key] !== undefined;
                      return (
                        <div key={slider.key} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span
                              className={isModified ? 'text-[#F1CD82] font-medium' : 'text-[#B3A490]'}
                            >
                              {slider.label}
                            </span>
                            <span className="font-mono-code text-[#DFC086] tabular-nums">
                              {slider.step >= 1 ? Math.round(val) : val.toFixed(2)}
                            </span>
                          </div>
                          <input
                            type="range"
                            data-testid={`sim-slider-${slider.key}`}
                            min={slider.min}
                            max={slider.max}
                            step={slider.step}
                            value={val}
                            onChange={(e) =>
                              setParamOverrides((prev) => ({
                                ...prev,
                                [slider.key]: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-[#D9A754] h-1.5 cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pinned Reset & Copy JSON Footer */}
                <div className="grid grid-cols-2 gap-1.5 px-3 py-2 border-t border-[#D8BC87]/15 bg-[#17120F]">
                  <button
                    type="button"
                    onClick={clearFieldOverrides}
                    disabled={!hasOverrides}
                    className="px-2 py-1.5 rounded-md bg-[#2A221B] hover:bg-[#362C23] disabled:opacity-40 text-[11px] font-medium text-[#E6DAC8] cursor-pointer"
                  >
                    Reset Sliders
                  </button>
                  <button
                    type="button"
                    data-testid="sim-copy-json-btn"
                    onClick={handleCopyCalibratedJson}
                    className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-[#2D2636] hover:bg-[#3A3046] border border-[#9B6EDB]/35 text-[11px] font-medium text-[#DEC2FF] cursor-pointer"
                  >
                    {copiedJson ? (
                      <>
                        <Check className="w-3 h-3 text-[#B8F0CA]" aria-hidden="true" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" aria-hidden="true" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Expressed & Het breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-[#D8BC87]/15 text-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-[#9E8F7B] shrink-0">Visuals</span>
              <span className="text-[#EFE5D6] text-right truncate">
                {previewPhenotype.visualGenes.length > 0
                  ? previewPhenotype.visualGenes.join(' · ')
                  : 'Classic Wild-Type'}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[11px] text-[#9E8F7B] shrink-0">Hets</span>
              <span className="text-[#C8BAA5] text-right truncate">
                {previewPhenotype.hetGenes.length > 0
                  ? previewPhenotype.hetGenes.map((h) => `Het ${h}`).join(' · ')
                  : 'None'}
              </span>
            </div>
            {previewPhenotype.isUpsideDown && (
              <div className="text-[11px] text-[#E6A382]">
                Spider complex · Upside-down posture
              </div>
            )}
          </div>

          {/* Active Genes Chip List */}
          <div className="pt-2 border-t border-[#D8BC87]/15 space-y-1.5">
            <div className="text-[11px] font-semibold text-[#B3A490] flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#D9A754]" aria-hidden="true" />
              <span>Active Genes ({activeLoci.length})</span>
            </div>
            {activeLoci.length === 0 ? (
              <p className="text-[11px] text-[#8F806E]">
                Select genes on the right to simulate any combo.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeLoci.map(({ id, def, count }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setLocusCount(id, 0)}
                    title={`Remove ${def.name}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#33291E] hover:bg-[#443525] text-[#F5E6C8] border border-[#D9A754]/40 cursor-pointer transition-colors"
                  >
                    <span>
                      {def.name}{' '}
                      <span className="text-[#E4BE74] font-mono-code text-[10px]">
                        {formatActiveChipBadge(def.mode, count)}
                      </span>
                    </span>
                    <X className="w-3 h-3 text-[#C8BAA5]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Developer Debug Spawner (disabled in production builds) */}
        {DEV_TOOLS_ENABLED && (
          <div className="rounded-xl bg-[#1E1924] border border-[#9B6EDB]/35 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#D6B8FF]">
                <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Developer Debug</span>
              </span>
              <span className="text-[10px] text-[#A898BE]">Spawns into Collection</span>
            </div>
            <label htmlFor="sim-snake-name" className="sr-only">
              Optional custom name for spawned snake
            </label>
            <input
              id="sim-snake-name"
              type="text"
              maxLength={24}
              placeholder="Optional custom name..."
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-[#141118] border border-[#9B6EDB]/30 text-xs text-[#F5EFE4] placeholder:text-[#8E7FA3] focus:outline-none focus:border-[#B68DF2]"
            />
            <button
              type="button"
              data-testid="sim-dev-add-btn"
              onClick={handleDevAddToCollection}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#7D4EC2] hover:bg-[#9162D6] text-white cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>[Dev] Add to Collection</span>
            </button>
            <button
              type="button"
              data-testid="sim-export-sheet-btn"
              onClick={handleOpenSpriteSheet}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#2E2538] hover:bg-[#3B3049] border border-[#9B6EDB]/45 text-[#E8D7FF] cursor-pointer transition-colors"
            >
              <Grid2x2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>[Dev] {totalSheetSnakes}-Snake Sprite Sheet</span>
            </button>
            {spawnNotice && (
              <div
                data-testid="sim-dev-add-notice"
                className="flex items-start gap-1.5 text-[11px] text-[#B8F0CA]"
              >
                <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{spawnNotice}</span>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Right Scrollable Gene Selector */}
      <section className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h3 className="font-display text-lg font-semibold text-[#F7F1E5] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#D9A754]" aria-hidden="true" />
              <span>Gene Simulator</span>
            </h3>
            <p className="text-xs text-[#B3A490]">
              Toggle any mix of traits to preview outcomes live.
            </p>
          </div>

          <label
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#27201A] border border-[#D8BC87]/25 cursor-pointer select-none"
            data-testid="sim-toggle-unowned-label"
          >
            <input
              type="checkbox"
              data-testid="sim-toggle-unowned"
              checked={includeUnowned}
              onChange={(e) => {
                if (e.target.checked) {
                  setConfirmUnownedOpen(true);
                } else {
                  setIncludeUnowned(false);
                }
              }}
              className="w-3.5 h-3.5 accent-[#D9A754] rounded cursor-pointer"
            />
            <span className="text-xs font-medium text-[#EFE5D6]">
              Include unowned genes
            </span>
            <span className="font-mono-code text-[11px] text-[#A89A87]">
              ({includeUnowned ? enabledLoci.length : ownedLoci.size}/{enabledLoci.length})
            </span>
          </label>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {(customEnabled
              ? ([
                  { id: 'all', label: 'All' },
                  { id: 'real', label: 'Real-World' },
                  { id: 'custom', label: 'Custom' },
                  { id: 'dominant', label: 'Dominant' },
                  { id: 'codominant', label: 'Codominant' },
                  { id: 'recessive', label: 'Recessive' },
                ] as const)
              : ([
                  { id: 'all', label: 'All' },
                  { id: 'dominant', label: 'Dominant' },
                  { id: 'codominant', label: 'Codominant' },
                  { id: 'recessive', label: 'Recessive' },
                ] as const)
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                  categoryFilter === tab.id
                    ? tab.id === 'custom'
                      ? 'bg-[#9B6EDB] text-white'
                      : 'bg-[#D9A754] text-[#1C1610]'
                    : 'bg-[#27201A] text-[#C2B4A1] hover:text-[#F5EFE4]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px] flex-1 sm:flex-initial">
            <Search
              className="w-3.5 h-3.5 text-[#9E8F7B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              data-testid="sim-gene-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter genes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#27201A] border border-[#D8BC87]/25 text-xs text-[#F5EFE4] placeholder:text-[#8F806E] focus:outline-none focus:border-[#D9A754]"
            />
          </div>
        </div>

        {/* Gene Picker Grid */}
        {visibleLoci.length === 0 ? (
          <div className="rounded-xl bg-[#251F19] border border-[#D8BC87]/20 p-6 text-center space-y-2">
            <p className="text-sm text-[#DFD3C2]">No genes match the current filter.</p>
            {!includeUnowned && (
              <button
                type="button"
                onClick={() => setConfirmUnownedOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-xs font-semibold text-[#1C1610] cursor-pointer"
              >
                Include unowned genes ({enabledLoci.length} total)
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {visibleLoci.map((id) => {
              const def = LOCUS_DEFINITIONS[id];
              const count = countAlleles(genotype[id]);
              const isOwned = ownedLoci.has(id);
              const [lbl0, lbl1, lbl2] = getAlleleButtonLabels(def.mode);

              return (
                <div
                  key={id}
                  data-testid={`sim-locus-card-${id}`}
                  className={`rounded-xl p-3 border transition-colors flex flex-col justify-between gap-2 ${
                    count > 0
                      ? 'bg-[#2C241B] border-[#D9A754]/55'
                      : 'bg-[#231D17] border-[#D8BC87]/18'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-sm font-semibold text-[#F7F1E5]">
                          {def.name}
                        </span>
                        {def.isCustom && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3B2B4B] text-[#DEC2FF] border border-[#9B6EDB]/35">
                            Custom
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] capitalize text-[#A89A87]">
                          {def.mode}
                        </span>
                        {isOwned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2A3D2C] text-[#BCE6C3] border border-[#5F9A6E]/35">
                            Owned
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-[#AEA08D] mt-0.5 leading-snug">
                      {def.visualEffect}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {([0, 1, 2] as const).map((level) => {
                      const label = level === 0 ? lbl0 : level === 1 ? lbl1 : lbl2;
                      const selected = count === level;
                      const isLethalSuperSpider = id === 'spider' && level === 2;
                      return (
                        <button
                          key={level}
                          type="button"
                          disabled={isLethalSuperSpider}
                          data-testid={`sim-locus-${id}-${level}`}
                          title={
                            isLethalSuperSpider
                              ? 'Super Spider (2×) is homozygous lethal in real ball pythons and cannot be bred.'
                              : undefined
                          }
                          onClick={() => setLocusCount(id, level)}
                          className={`py-1 px-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                            isLethalSuperSpider
                              ? 'bg-[#1D1513] text-[#7D665C] border border-[#C97C63]/20 line-through cursor-not-allowed opacity-65'
                              : selected
                                ? level === 0
                                  ? 'bg-[#3D342A] text-[#F5EFE4] border border-[#D8BC87]/35 cursor-pointer'
                                  : 'bg-[#D9A754] text-[#1C1610] font-semibold cursor-pointer'
                                : 'bg-[#1A1511] text-[#A89A87] hover:text-[#EFE5D6] hover:bg-[#29221B] cursor-pointer'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {id === 'spider' && (
                    <p className="text-[10px] text-[#E6A382]/90 leading-snug">
                      Super Spider (2×) is homozygous lethal in real ball pythons and cannot be bred.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Spoiler Warning Confirmation for Including Unowned Genes */}
      {confirmUnownedOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sim-spoiler-title"
          data-testid="sim-unowned-spoiler-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/82 backdrop-blur-[1.5px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmUnownedOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-[#1F1A15] border border-[#D8BC87]/40 shadow-2xl shadow-black/80 p-5 text-[#F5EFE4] space-y-4 animate-card-reveal">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#E9C16E]">
                Spoiler Warning
              </div>
              <h4
                id="sim-spoiler-title"
                className="font-display text-lg font-semibold text-[#F7F1E5]"
              >
                Show Unowned Genes?
              </h4>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed text-[#D8CFC2]">
              Enabling unowned genes will reveal morph names, patterns, and rare combinations you
              haven&apos;t discovered in your vivarium yet.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="sim-spoiler-cancel-btn"
                onClick={() => setConfirmUnownedOpen(false)}
                className="px-3.5 py-2 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-xs font-medium text-[#E6DAC8] cursor-pointer"
              >
                Keep Hidden
              </button>
              <button
                type="button"
                data-testid="sim-spoiler-confirm-btn"
                onClick={() => {
                  setIncludeUnowned(true);
                  setConfirmUnownedOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-xs font-semibold text-[#1C1610] cursor-pointer"
              >
                Show Unowned Genes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progressive Morph Reference Sprite Sheet Preview & PNG Export Modal */}
      {sheetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${totalSheetSnakes}-Snake Morph Sprite Sheet Export`}
          data-testid="sprite-sheet-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/88"
        >
          <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-2xl bg-[#1D1814] border border-[#D8BC87]/35 shadow-2xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#D8BC87]/20 bg-[#241E18]">
              <div>
                <h3 className="font-display text-base font-semibold text-[#F7F1E5] flex items-center gap-2">
                  <Grid2x2 className="w-4 h-4 text-[#D9A754]" aria-hidden="true" />
                  <span>{totalSheetSnakes}-Snake Morph Sprite Sheet</span>
                  {sheetProgress.done < sheetProgress.total && (
                    <span className="text-[10px] font-mono-code font-medium px-2 py-0.5 rounded bg-[#3A2E1A] text-[#F1CD82] border border-[#D9A754]/40 tabular-nums">
                      Rendering {sheetProgress.done}/{sheetProgress.total}…
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-[#B3A490]">
                  1 Base + {LOCI_ORDER.length} Loci at 1× &amp; 2× · Seed {polygenicSeed.toFixed(3)}
                  {sheetDims ? ` · ${sheetDims.width}×${sheetDims.height}px PNG` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-[#16120F] p-1 rounded-lg border border-[#D8BC87]/20">
                  {DEBUG_STAGES.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      data-testid={`sheet-stage-${st.id}`}
                      onClick={() => handleChangeSheetStage(st.id)}
                      className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                        sheetStage === st.id
                          ? 'bg-[#D9A754] text-[#1C1610] font-semibold'
                          : 'text-[#B3A490] hover:text-[#F5EFE4]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#16120F] border border-[#D8BC87]/20 text-[11px] text-[#E6DAC8] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sheetIncludeUv}
                    onChange={(e) => handleToggleSheetUv(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#D9A754] cursor-pointer"
                  />
                  <span>UV strips</span>
                </label>

                <button
                  type="button"
                  data-testid="sheet-download-btn"
                  onClick={handleDownloadSpriteSheet}
                  disabled={sheetProgress.done < sheetProgress.total || sheetExporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#D9A754] hover:bg-[#E7B96A] text-[#1C1610] cursor-pointer transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{sheetExporting ? 'Exporting…' : 'Download PNG'}</span>
                </button>

                <button
                  type="button"
                  aria-label="Close sprite sheet preview"
                  onClick={() => setSheetModalOpen(false)}
                  className="p-1.5 rounded-lg text-[#C2B4A1] hover:text-[#F7F1E5] hover:bg-[#322A22] cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {sheetProgress.done < sheetProgress.total && (
              <div className="h-1 w-full bg-[#16120F] overflow-hidden shrink-0">
                <div
                  className="h-full bg-[#D9A754] transition-[width] duration-150"
                  style={{
                    width: `${Math.round((sheetProgress.done / Math.max(1, sheetProgress.total)) * 100)}%`,
                  }}
                />
              </div>
            )}

            <div className="flex-1 overflow-auto p-4 bg-[#120F0C]">
              <canvas
                ref={sheetCanvasRef}
                aria-label={`${totalSheetSnakes}-snake Morpharium reference sprite sheet showing base wild-type plus ${LOCI_ORDER.length} genes at 1x and 2x`}
                data-testid="sprite-sheet-preview-canvas"
                className="max-w-full h-auto mx-auto rounded-lg border border-[#D8BC87]/20 block"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
