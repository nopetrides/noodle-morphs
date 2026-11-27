import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  FlaskConical,
  GitBranch,
  Image as ImageIcon,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import {
  BUILTIN_GENE_OVERRIDES_REL_PATH,
  type BuiltinGeneFieldOverride,
  type BuiltinGeneOverride,
  type BuiltinGeneOverridesFile,
  type BuiltinGenePaletteOverride,
  getBuiltinGeneOverridesSnapshot,
} from '../game/builtinGeneOverrides';
import {
  ELEMENTAL_LOCI_ORDER,
  ELEMENTAL_VISUAL_PROFILES,
  getElementalTier,
} from '../game/elementalSynthesis';
import {
  applyBuiltinGeneOverrides,
  createWildTypeGenotype,
  evaluatePhenotype,
  getBaseLocusDefinition,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  makeGenotype,
  resolveSkinSpecForPhenotype,
} from '../game/genetics';
import type { ModGrayscaleTexture } from '../game/modPacks';
import type {
  FieldOperation,
  InheritanceMode,
  LocusId,
  MorphTag,
  SkinFieldParams,
  SkinFieldPrimitiveId,
} from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';
import { MorphSimulatorPanel } from './MorphSimulatorPanel';

interface DevGeneEditorModalProps {
  onClose: () => void;
  onGenesSaved?: () => void;
}

type CategoryFilter = 'all' | 'core' | 'fun_originals' | 'fun_elemental' | 'modified';

interface GitStatusInfo {
  loading: boolean;
  available: boolean;
  clean: boolean;
  dirtyCount: number;
  files: string[];
}

const ELEMENTAL_SET = new Set<LocusId>(ELEMENTAL_LOCI_ORDER);
const ELEMENTAL_PROFILE_BY_ID = new Map(ELEMENTAL_VISUAL_PROFILES.map((p) => [p.locusId, p]));

const ALL_TAGS: MorphTag[] = [
  'Color',
  'Pattern',
  'Light',
  'Dark',
  'High-White',
  'Complex',
  'Wobble',
  'Custom',
];

const FIELD_PRIMITIVES: Array<{ id: SkinFieldPrimitiveId; label: string }> = [
  { id: 'voronoi_network', label: 'Voronoi Alien-Head Network' },
  { id: 'longitudinal_waves', label: 'Longitudinal Tracks / Waves' },
  { id: 'transverse_waves', label: 'Transverse Bands / Rings' },
  { id: 'angled_waves', label: 'Angled Chevrons / Ribbons' },
  { id: 'radial_rings', label: 'Radial Rings / Saddles' },
  { id: 'radial_teardrops', label: 'Radial Teardrops' },
  { id: 'cellular_pavers', label: 'Cellular Pavers (Cobble)' },
  { id: 'magma_fissures', label: 'Magma Fissures' },
  { id: 'water_caustics', label: 'Water Caustics' },
  { id: 'shattered_mosaic', label: 'Shattered Mosaic' },
  { id: 'stripe_tracks', label: 'Dorsal / Tri-Stripe Tracks' },
  { id: 'mineral_veins', label: 'Mineral Veins / Woodgrain' },
  { id: 'crystal_facets', label: 'Crystal Facets' },
  { id: 'banded_agate', label: 'Banded Agate / Strata' },
  { id: 'stepped_bismuth', label: 'Stepped Bismuth' },
  { id: 'wind_wisps', label: 'Wind Wisps' },
  { id: 'speckled_granite', label: 'Speckled Granite / Starlight' },
  { id: 'custom_map', label: 'Custom PNG Mask (64×16)' },
];

const FIELD_OPS: FieldOperation[] = [
  'blend',
  'smoothUnion',
  'union',
  'intersection',
  'modulate',
  'subtract',
  'warp',
];

function cloneOverridesFile(file: BuiltinGeneOverridesFile): BuiltinGeneOverridesFile {
  return JSON.parse(JSON.stringify(file)) as BuiltinGeneOverridesFile;
}

function stableJson(val: unknown): string {
  return JSON.stringify(val ?? null);
}

function cleanOverrideEntry(entry: BuiltinGeneOverride): BuiltinGeneOverride | undefined {
  const cleaned: BuiltinGeneOverride = {};
  if (entry.name !== undefined) cleaned.name = entry.name;
  if (entry.superName !== undefined) cleaned.superName = entry.superName;
  if (entry.mode !== undefined) cleaned.mode = entry.mode;
  if (entry.shortCode !== undefined) cleaned.shortCode = entry.shortCode;
  if (entry.description !== undefined) cleaned.description = entry.description;
  if (entry.visualEffect !== undefined) cleaned.visualEffect = entry.visualEffect;
  if (entry.rarityWeight !== undefined) cleaned.rarityWeight = entry.rarityWeight;
  if (entry.tags !== undefined && entry.tags.length > 0) cleaned.tags = entry.tags;
  if (entry.palette1x !== undefined) cleaned.palette1x = entry.palette1x;
  if (entry.palette2x !== undefined) cleaned.palette2x = entry.palette2x;
  if (entry.field1x !== undefined) cleaned.field1x = entry.field1x;
  if (entry.field2x !== undefined) cleaned.field2x = entry.field2x;
  if (entry.customTexture !== undefined) cleaned.customTexture = entry.customTexture;
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function getGeneCategory(locusId: LocusId): 'core' | 'fun_originals' | 'fun_elemental' {
  if (ELEMENTAL_SET.has(locusId)) return 'fun_elemental';
  const baseDef = getBaseLocusDefinition(locusId);
  return baseDef.isCustom ? 'fun_originals' : 'core';
}

function extractPaletteBaseline(
  locusId: LocusId,
  copyCount: 1 | 2
): BuiltinGenePaletteOverride {
  const def = LOCUS_DEFINITIONS[locusId];
  const pair: [0 | 1, 0 | 1] =
    def.mode === 'recessive' || copyCount === 2 ? [1, 1] : [1, 0];
  const pheno = evaluatePhenotype(makeGenotype({ [locusId]: pair }), 0.5);
  const p = pheno.palette;
  const el = ELEMENTAL_PROFILE_BY_ID.get(locusId);
  return {
    base: p.base,
    patternPrimary: p.patternPrimary,
    patternSecondary: p.patternSecondary,
    ...(p.accentColor ? { accentColor: p.accentColor } : {}),
    belly: p.belly,
    outline: p.outline,
    eyeIris: p.eyeIris,
    headBlush: p.headBlush,
    bodyOpacity:
      p.bodyOpacity ??
      (el ? (copyCount === 2 ? el.bodyOpacity2x ?? el.bodyOpacity1x : el.bodyOpacity1x) : undefined) ??
      1,
    pigmentWeight: el ? (copyCount === 2 ? el.dosage2x : el.dosage1x) : 0.9,
  };
}

function extractFieldBaseline(
  locusId: LocusId,
  copyCount: 1 | 2
): BuiltinGeneFieldOverride {
  const def = LOCUS_DEFINITIONS[locusId];
  const pair: [0 | 1, 0 | 1] =
    def.mode === 'recessive' || copyCount === 2 ? [1, 1] : [1, 0];
  const pheno = evaluatePhenotype(makeGenotype({ [locusId]: pair }), 0.5);
  const spec = resolveSkinSpecForPhenotype(pheno);
  const firstContrib = spec.contributions[0];
  return {
    field: firstContrib?.field ?? 'voronoi_network',
    operation: firstContrib?.operation ?? 'blend',
    strength: firstContrib?.strength ?? 0.82,
    frequency: firstContrib?.frequency ?? Number(spec.params.frequency.toFixed(2)),
    ...(firstContrib?.params ? { params: { ...firstContrib.params } } : {}),
    paramOverrides: {
      coverage: Number(spec.params.coverage.toFixed(2)),
      warpStrength: Number(spec.params.warpStrength.toFixed(2)),
      blush: Number(spec.params.blush.toFixed(2)),
      flankFlame: Number(spec.params.flankFlame.toFixed(2)),
      speckleAmount: Number(spec.params.speckleAmount.toFixed(2)),
      scaleRelief: Number(spec.params.scaleRelief.toFixed(2)),
      edgeSoftness: Number(spec.params.edgeSoftness.toFixed(3)),
      dorsalBias: Number(spec.params.dorsalBias.toFixed(2)),
    },
  };
}

export function DevGeneEditorModal({ onClose, onGenesSaved }: DevGeneEditorModalProps) {
  const initialSnapshot = useMemo(() => cloneOverridesFile(getBuiltinGeneOverridesSnapshot()), []);
  const [savedOverrides, setSavedOverrides] = useState<BuiltinGeneOverridesFile>(initialSnapshot);
  const savedOverridesRef = useRef<BuiltinGeneOverridesFile>(initialSnapshot);
  const [draftOverrides, setDraftOverrides] = useState<BuiltinGeneOverridesFile>(() =>
    cloneOverridesFile(initialSnapshot)
  );
  const [previewRevision, setPreviewRevision] = useState(0);

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocus, setSelectedLocus] = useState<LocusId>('pastel');
  const [showSimulator, setShowSimulator] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatusInfo>({
    loading: false,
    available: false,
    clean: false,
    dirtyCount: 0,
    files: [],
  });
  const maskInputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft overrides live into genetics runtime so previews + Simulator reflect edits immediately
  useEffect(() => {
    applyBuiltinGeneOverrides(draftOverrides);
    setPreviewRevision((r) => r + 1);
  }, [draftOverrides]);

  // Restore last saved snapshot on unmount so closing without saving never leaves dirty runtime state
  useEffect(() => {
    return () => {
      applyBuiltinGeneOverrides(savedOverridesRef.current);
    };
  }, []);

  // Poll git status whenever the save confirmation window opens
  useEffect(() => {
    if (!showSaveConfirm) return;
    let cancelled = false;
    setGitStatus({ loading: true, available: false, clean: false, dirtyCount: 0, files: [] });
    fetch('/__noodle_morphs_dev__/git-status')
      .then((res) => res.json())
      .then((data: Partial<GitStatusInfo>) => {
        if (cancelled) return;
        setGitStatus({
          loading: false,
          available: Boolean(data.available),
          clean: Boolean(data.clean),
          dirtyCount: typeof data.dirtyCount === 'number' ? data.dirtyCount : 0,
          files: Array.isArray(data.files) ? data.files : [],
        });
      })
      .catch(() => {
        if (cancelled) return;
        setGitStatus({ loading: false, available: false, clean: false, dirtyCount: 0, files: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [showSaveConfirm]);

  const diffSummary = useMemo(() => {
    const addedOrUpdated: LocusId[] = [];
    const resetToDefault: LocusId[] = [];
    for (const loc of LOCI_ORDER) {
      const before = savedOverrides.genes[loc];
      const after = draftOverrides.genes[loc];
      if (stableJson(before) === stableJson(after)) continue;
      if (after) addedOrUpdated.push(loc);
      else resetToDefault.push(loc);
    }
    return {
      addedOrUpdated,
      resetToDefault,
      hasUnsavedChanges: addedOrUpdated.length > 0 || resetToDefault.length > 0,
      totalActiveOverrides: Object.keys(draftOverrides.genes).length,
    };
  }, [savedOverrides, draftOverrides]);

  const categoryCounts = useMemo(() => {
    let core = 0;
    let funOriginals = 0;
    let funElemental = 0;
    let modified = 0;
    for (const loc of LOCI_ORDER) {
      const cat = getGeneCategory(loc);
      if (cat === 'core') core++;
      else if (cat === 'fun_originals') funOriginals++;
      else funElemental++;
      if (draftOverrides.genes[loc] || savedOverrides.genes[loc]) modified++;
    }
    return { all: LOCI_ORDER.length, core, funOriginals, funElemental, modified };
  }, [draftOverrides, savedOverrides]);

  const filteredLoci = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return LOCI_ORDER.filter((loc) => {
      const cat = getGeneCategory(loc);
      if (category === 'core' && cat !== 'core') return false;
      if (category === 'fun_originals' && cat !== 'fun_originals') return false;
      if (category === 'fun_elemental' && cat !== 'fun_elemental') return false;
      if (category === 'modified' && !draftOverrides.genes[loc] && !savedOverrides.genes[loc]) {
        return false;
      }
      if (!q) return true;
      const def = LOCUS_DEFINITIONS[loc];
      return (
        loc.toLowerCase().includes(q) ||
        def.name.toLowerCase().includes(q) ||
        (def.superName?.toLowerCase().includes(q) ?? false) ||
        def.shortCode.toLowerCase().includes(q)
      );
    });
  }, [category, searchQuery, draftOverrides, savedOverrides, previewRevision]);

  const baseDef = useMemo(() => getBaseLocusDefinition(selectedLocus), [selectedLocus]);
  const activeDef = useMemo(
    () => LOCUS_DEFINITIONS[selectedLocus],
    [selectedLocus, previewRevision]
  );
  const activeOverride = draftOverrides.genes[selectedLocus];
  const isSelectedDirty =
    stableJson(savedOverrides.genes[selectedLocus]) !==
    stableJson(draftOverrides.genes[selectedLocus]);

  const wildPreview = useMemo(() => evaluatePhenotype(createWildTypeGenotype(), 0.42), []);
  const preview1x = useMemo(
    () => evaluatePhenotype(makeGenotype({ [selectedLocus]: [1, 0] }), 0.42),
    [selectedLocus, previewRevision]
  );
  const preview2x = useMemo(
    () => evaluatePhenotype(makeGenotype({ [selectedLocus]: [1, 1] }), 0.42),
    [selectedLocus, previewRevision]
  );

  // Current effective palette & field values shown in controls
  const effectivePal1x = useMemo(
    () => activeOverride?.palette1x ?? extractPaletteBaseline(selectedLocus, 1),
    [activeOverride?.palette1x, selectedLocus, previewRevision]
  );
  const effectivePal2x = useMemo(
    () => activeOverride?.palette2x ?? extractPaletteBaseline(selectedLocus, 2),
    [activeOverride?.palette2x, selectedLocus, previewRevision]
  );
  const effectiveField1x = useMemo(
    () => activeOverride?.field1x ?? extractFieldBaseline(selectedLocus, 1),
    [activeOverride?.field1x, selectedLocus, previewRevision]
  );
  const effectiveField2x = useMemo(
    () => activeOverride?.field2x ?? extractFieldBaseline(selectedLocus, 2),
    [activeOverride?.field2x, selectedLocus, previewRevision]
  );

  const mutateSelectedOverride = (updater: (prev: BuiltinGeneOverride) => BuiltinGeneOverride) => {
    setStatusMessage(null);
    setDraftOverrides((prev) => {
      const current = prev.genes[selectedLocus] ? { ...prev.genes[selectedLocus] } : {};
      const nextEntry = cleanOverrideEntry(updater(current));
      const nextGenes = { ...prev.genes };
      if (nextEntry) {
        nextGenes[selectedLocus] = nextEntry;
      } else {
        delete nextGenes[selectedLocus];
      }
      return { schemaVersion: 1, genes: nextGenes };
    });
  };

  const updateMetaField = <K extends keyof BuiltinGeneOverride>(
    key: K,
    value: BuiltinGeneOverride[K]
  ) => {
    mutateSelectedOverride((cur) => {
      const next = { ...cur, [key]: value };
      // Prune fields matching original code defaults cleanly
      if (key === 'name' && value === baseDef.name) delete next.name;
      if (key === 'superName' && value === (baseDef.superName ?? '')) delete next.superName;
      if (key === 'mode' && value === baseDef.mode) delete next.mode;
      if (key === 'shortCode' && value === baseDef.shortCode) delete next.shortCode;
      if (key === 'description' && value === baseDef.description) delete next.description;
      if (key === 'visualEffect' && value === baseDef.visualEffect) delete next.visualEffect;
      if (key === 'rarityWeight' && value === baseDef.rarityWeight) delete next.rarityWeight;
      if (
        key === 'tags' &&
        Array.isArray(value) &&
        stableJson([...value].sort()) === stableJson([...baseDef.tags].sort())
      ) {
        delete next.tags;
      }
      return next;
    });
  };

  const updatePalette = (
    slot: 'palette1x' | 'palette2x',
    patch: Partial<BuiltinGenePaletteOverride>
  ) => {
    mutateSelectedOverride((cur) => {
      const basePal1 = cur.palette1x ?? extractPaletteBaseline(selectedLocus, 1);
      const basePal2 =
        cur.palette2x ??
        (activeDef.mode === 'codominant' ? extractPaletteBaseline(selectedLocus, 2) : undefined);
      if (slot === 'palette1x') {
        const next1 = { ...basePal1, ...patch };
        return {
          ...cur,
          palette1x: next1,
          ...(activeDef.mode === 'codominant'
            ? {
                palette2x:
                  patch.bodyOpacity !== undefined && basePal2
                    ? { ...basePal2, bodyOpacity: patch.bodyOpacity }
                    : basePal2,
              }
            : {}),
        };
      }
      const next2 = { ...(basePal2 ?? basePal1), ...patch };
      return {
        ...cur,
        palette1x: basePal1,
        palette2x: next2,
      };
    });
  };

  const updateField = (
    slot: 'field1x' | 'field2x',
    patch: Partial<BuiltinGeneFieldOverride>,
    paramPatch?: Partial<SkinFieldParams>
  ) => {
    mutateSelectedOverride((cur) => {
      const baseF1 = cur.field1x ?? extractFieldBaseline(selectedLocus, 1);
      const baseF2 =
        cur.field2x ??
        (activeDef.mode === 'codominant' ? extractFieldBaseline(selectedLocus, 2) : undefined);
      if (slot === 'field1x') {
        const next1: BuiltinGeneFieldOverride = {
          ...baseF1,
          ...patch,
          paramOverrides: {
            ...(baseF1.paramOverrides ?? {}),
            ...(paramPatch ?? {}),
          },
        };
        return {
          ...cur,
          field1x: next1,
          ...(activeDef.mode === 'codominant' && baseF2 ? { field2x: baseF2 } : {}),
        };
      }
      const target2 = baseF2 ?? baseF1;
      const next2: BuiltinGeneFieldOverride = {
        ...target2,
        ...patch,
        paramOverrides: {
          ...(target2.paramOverrides ?? {}),
          ...(paramPatch ?? {}),
        },
      };
      return {
        ...cur,
        field1x: baseF1,
        field2x: next2,
      };
    });
  };

  const handleUploadMask = (file: File) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const w = 64;
      const h = 16;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h).data;
      const data: number[] = new Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const lum = (0.299 * imgData[i * 4] + 0.587 * imgData[i * 4 + 1] + 0.114 * imgData[i * 4 + 2]) / 255;
        data[i] = Number(lum.toFixed(3));
      }
      const texture: ModGrayscaleTexture = { width: w, height: h, data };
      mutateSelectedOverride((cur) => {
        const baseF1 = cur.field1x ?? extractFieldBaseline(selectedLocus, 1);
        const baseF2 =
          cur.field2x ??
          (activeDef.mode === 'codominant' ? extractFieldBaseline(selectedLocus, 2) : undefined);
        return {
          ...cur,
          customTexture: texture,
          field1x: { ...baseF1, field: 'custom_map' },
          ...(baseF2 ? { field2x: { ...baseF2, field: 'custom_map' } } : {}),
        };
      });
      setStatusMessage({ kind: 'ok', text: `Loaded 64×16 PNG mask "${file.name}" for ${activeDef.name}.` });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setStatusMessage({ kind: 'err', text: 'Failed to decode PNG mask image.' });
    };
    img.src = objectUrl;
  };

  const handleDiscardUnsaved = () => {
    const restored = cloneOverridesFile(savedOverrides);
    setDraftOverrides(restored);
    setStatusMessage({ kind: 'ok', text: 'Discarded unsaved edits.' });
  };

  const handleConfirmOverwriteProjectFile = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const response = await fetch('/__noodle_morphs_dev__/builtin-genes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftOverrides),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        file?: string;
        geneCount?: number;
        errors?: string[];
      };
      if (!response.ok || !result.ok) {
        setStatusMessage({
          kind: 'err',
          text:
            result.errors?.join(' ') ??
            `Save failed (HTTP ${response.status}). Make sure you launched via "npm run dev:gene-editor".`,
        });
        setShowSaveConfirm(false);
        return;
      }

      const committed = cloneOverridesFile(draftOverrides);
      savedOverridesRef.current = committed;
      setSavedOverrides(committed);
      applyBuiltinGeneOverrides(committed);
      onGenesSaved?.();
      setShowSaveConfirm(false);
      setConfirmChecked(false);
      setStatusMessage({
        kind: 'ok',
        text: `Saved ${result.geneCount ?? Object.keys(committed.genes).length} built-in gene override(s) to ${
          result.file ?? BUILTIN_GENE_OVERRIDES_REL_PATH
        }.`,
      });
    } catch (err) {
      setStatusMessage({
        kind: 'err',
        text: `Network error saving to dev server: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
      setShowSaveConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  if (showSimulator) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-sim-title"
        data-testid="dev-gene-simulator-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/90 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#1D1814] border border-[#D9A754]/50 shadow-2xl shadow-black/80 text-[#F5EFE4] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#D8BC87]/20 bg-[#241D16]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowSimulator(false)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#30271E] hover:bg-[#3D3226] text-xs font-medium text-[#F5EFE4] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Back to Gene Editor</span>
              </button>
              <div>
                <h2 id="dev-sim-title" className="font-display text-lg font-semibold text-[#F7F1E5] flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#E6BE70]" aria-hidden="true" />
                  <span>Live Combo Simulator (Unsaved Edits Active)</span>
                </h2>
                <p className="text-[11px] text-[#B3A490]">
                  Test your live edits to Core &amp; Fun genes in any combination before writing to project files.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSimulator(false)}
              className="p-1.5 rounded-lg text-[#C2B4A1] hover:text-[#F7F1E5] hover:bg-[#322A22] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <MorphSimulatorPanel key={`dev-sim-${previewRevision}`} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-gene-editor-title"
      data-testid="dev-gene-editor-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0C0907]/90 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-6xl h-[92vh] flex flex-col rounded-2xl bg-[#1C1713] border border-[#D9A754]/50 shadow-2xl shadow-black/85 text-[#F5EFE4] overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#D8BC87]/22 bg-[#241D16]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#3A2D18] border border-[#D9A754]/50 flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-[#F1CD82]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="dev-gene-editor-title" className="font-display text-lg font-semibold text-[#F7F1E5]">
                  Dev Gene Editor · Core &amp; Fun Genes
                </h2>
                <span className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#3A2D18] text-[#F5D692] border border-[#D9A754]/45">
                  PROJECT FILE MODE
                </span>
              </div>
              <p className="text-[11px] text-[#B3A490]">
                Saves changes back into <code className="text-[#E6CE9D]">{BUILTIN_GENE_OVERRIDES_REL_PATH}</code> ·{' '}
                {diffSummary.totalActiveOverrides} active override{diffSummary.totalActiveOverrides === 1 ? '' : 's'}
                {diffSummary.hasUnsavedChanges ? ' · Unsaved changes pending' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="dev-open-simulator-btn"
              onClick={() => setShowSimulator(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D3234] hover:bg-[#254043] border border-[#56B8B0]/45 text-xs font-semibold text-[#A6ECE3] cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Test Combos</span>
            </button>
            <button
              type="button"
              disabled={!diffSummary.hasUnsavedChanges}
              onClick={handleDiscardUnsaved}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2C241D] hover:bg-[#3A2F26] disabled:opacity-40 text-xs font-medium text-[#E6DAC8] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              data-testid="dev-save-project-btn"
              onClick={() => {
                setConfirmChecked(false);
                setShowSaveConfirm(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] text-[#1A140E] text-xs font-semibold cursor-pointer shadow-md shadow-black/30"
            >
              <Save className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                Save to Project Files
                {diffSummary.hasUnsavedChanges
                  ? ` (${diffSummary.addedOrUpdated.length + diffSummary.resetToDefault.length})`
                  : ''}
              </span>
            </button>
            <button
              type="button"
              aria-label="Close dev gene editor"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#C2B4A1] hover:text-[#F7F1E5] hover:bg-[#322A22] cursor-pointer"
              title="Close editor (play/test in game; unsaved edits revert)"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Status Banner */}
        {statusMessage && (
          <div
            data-testid="dev-editor-status"
            className={`mx-5 mt-3 px-3.5 py-2 rounded-lg text-xs flex items-center gap-2 border ${
              statusMessage.kind === 'ok'
                ? 'bg-[#1B2F2C] border-[#56B8B0]/45 text-[#BCEFE9]'
                : 'bg-[#331D1A] border-[#D97762]/45 text-[#F6B4A6]'
            }`}
          >
            {statusMessage.kind === 'ok' ? (
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Main Split Workspace */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Gene Catalog Sidebar */}
          <aside className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-[#D8BC87]/18 bg-[#181410] flex flex-col max-h-56 md:max-h-none">
            <div className="p-3 space-y-2 border-b border-[#D8BC87]/15">
              <div className="relative">
                <Search
                  className="w-3.5 h-3.5 text-[#8F806E] absolute left-2.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  data-testid="dev-gene-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter 74 Core & Fun genes…"
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-[#120F0C] border border-[#D8BC87]/22 text-xs text-[#F5EFE4] placeholder:text-[#786A5B] focus:outline-none focus:border-[#D9A754]"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: `All (${categoryCounts.all})` },
                    { id: 'core', label: `Core (${categoryCounts.core})` },
                    { id: 'fun_originals', label: `Fun (${categoryCounts.funOriginals})` },
                    { id: 'fun_elemental', label: `Elements (${categoryCounts.funElemental})` },
                    { id: 'modified', label: `Edited (${categoryCounts.modified})` },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`dev-cat-${item.id}`}
                    onClick={() => setCategory(item.id)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${
                      category === item.id
                        ? 'bg-[#D9A754] text-[#1A140E] font-semibold'
                        : 'bg-[#241E18] text-[#B8A996] hover:text-[#F5EFE4]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredLoci.map((loc) => {
                const def = LOCUS_DEFINITIONS[loc];
                const cat = getGeneCategory(loc);
                const hasSaved = Boolean(savedOverrides.genes[loc]);
                const hasDraft = Boolean(draftOverrides.genes[loc]);
                const dirty = stableJson(savedOverrides.genes[loc]) !== stableJson(draftOverrides.genes[loc]);
                const tier = getElementalTier(loc);
                const selected = loc === selectedLocus;
                const elProf = ELEMENTAL_PROFILE_BY_ID.get(loc);
                const ovPal = draftOverrides.genes[loc]?.palette1x;
                const swatchA = ovPal?.base ?? elProf?.baseHex ?? (cat === 'core' ? '#C79B54' : '#56B8B0');
                const swatchB = ovPal?.patternPrimary ?? elProf?.primaryHex ?? '#2B2118';

                return (
                  <button
                    key={loc}
                    type="button"
                    data-testid={`dev-gene-item-${loc}`}
                    onClick={() => setSelectedLocus(loc)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[#2E2418] border-[#D9A754]/65 text-[#F7F1E5]'
                        : 'bg-transparent border-transparent hover:bg-[#221C16] text-[#D2C5B3]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full border border-white/25 shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${swatchA} 50%, ${swatchB} 50%)`,
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{def.name}</div>
                        <div className="text-[10px] text-[#8F806E] truncate">
                          {cat === 'core'
                            ? 'Core'
                            : cat === 'fun_originals'
                              ? 'Fun Original'
                              : `Element T${tier ?? 0}`}{' '}
                          · {def.mode}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {dirty && (
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#4A3214] text-[#F8D078]"
                          title="Unsaved change"
                        >
                          *
                        </span>
                      )}
                      {hasDraft && !dirty && hasSaved && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#56B8B0]"
                          title="Saved project override"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredLoci.length === 0 && (
                <p className="text-xs text-[#8F806E] text-center py-6">No genes match this filter.</p>
              )}
            </div>
          </aside>

          {/* Right Editor Form */}
          <section className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
            {/* Selected Gene Header & Reset */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-xl font-semibold text-[#F7F1E5]">{activeDef.name}</h3>
                  <code className="font-mono-code text-[11px] px-1.5 py-0.5 rounded bg-[#27201A] text-[#D8BC87]">
                    {selectedLocus}
                  </code>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#25201B] border border-[#D8BC87]/20 text-[#C8BAA5]">
                    {getGeneCategory(selectedLocus) === 'core'
                      ? 'Core Ball Python Gene'
                      : getGeneCategory(selectedLocus) === 'fun_originals'
                        ? 'Fun · Noodle Morphs Original'
                        : `Fun · Elemental Tier ${getElementalTier(selectedLocus) ?? 0}`}
                  </span>
                  {activeOverride && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#3A2D18] text-[#F5D692] border border-[#D9A754]/45">
                      {isSelectedDirty ? 'Modified (Unsaved)' : 'Saved Override'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#A89A87] mt-0.5">
                  Editing directly updates the live preview below. Click &ldquo;Save to Project Files&rdquo; when ready to write back to disk.
                </p>
              </div>

              {activeOverride && (
                <button
                  type="button"
                  data-testid="dev-reset-gene-btn"
                  onClick={() => mutateSelectedOverride(() => ({}))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#33201B] hover:bg-[#442922] border border-[#D97762]/40 text-xs font-medium text-[#F5BEB0] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Reset Gene to Code Default</span>
                </button>
              )}
            </div>

            {/* Live Previews */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#241E18] border border-[#D8BC87]/22 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F7F1E5]">
                    {activeDef.mode === 'recessive'
                      ? `Classic Normal (Het ${activeDef.name})`
                      : preview1x.morphName}
                  </span>
                  <span className="font-mono-code text-[10px] text-[#B3A490]">
                    {activeDef.mode === 'recessive' ? 'Het 1× (Wild-Type)' : '1× Visual'}
                  </span>
                </div>
                <div className="flex justify-center">
                  <MiniSnakeCanvas
                    key={`p1-${selectedLocus}-${previewRevision}`}
                    phenotype={activeDef.mode === 'recessive' ? wildPreview : preview1x}
                    width={290}
                    height={98}
                    animate={false}
                    lazy={false}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#241E18] border border-[#D8BC87]/22 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F7F1E5]">{preview2x.morphName}</span>
                  <span className="font-mono-code text-[10px] text-[#E4BE74]">
                    {activeDef.mode === 'codominant'
                      ? 'Super 2×'
                      : activeDef.mode === 'recessive'
                        ? 'Visual 2×'
                        : 'Homozygous 2×'}
                  </span>
                </div>
                <div className="flex justify-center">
                  <MiniSnakeCanvas
                    key={`p2-${selectedLocus}-${previewRevision}`}
                    phenotype={preview2x}
                    width={290}
                    height={98}
                    animate={false}
                    lazy={false}
                  />
                </div>
              </div>
            </div>

            {/* Section 1: Metadata */}
            <div className="rounded-xl bg-[#221C16] border border-[#D8BC87]/18 p-4 space-y-3">
              <div className="text-xs font-semibold text-[#F1CD82] uppercase tracking-wider">
                1. Gene Metadata &amp; Genetics
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Display Name</span>
                  <input
                    type="text"
                    data-testid="dev-gene-name-input"
                    value={activeDef.name}
                    onChange={(e) => updateMetaField('name', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-[#B3A490]">Inheritance Mode</span>
                  <select
                    value={activeDef.mode}
                    onChange={(e) => updateMetaField('mode', e.target.value as InheritanceMode)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    <option value="codominant">Codominant (1× + Super 2×)</option>
                    <option value="dominant">Dominant (1× Visual)</option>
                    <option value="recessive">Recessive (Het 1× / Vis 2×)</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[#B3A490]">Short Code</span>
                  <input
                    type="text"
                    maxLength={5}
                    value={activeDef.shortCode}
                    onChange={(e) => updateMetaField('shortCode', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4] font-mono-code"
                  />
                </label>

                {activeDef.mode === 'codominant' && (
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[#B3A490]">Super (2×) Name</span>
                    <input
                      type="text"
                      value={activeDef.superName ?? `Super ${activeDef.name}`}
                      onChange={(e) => updateMetaField('superName', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                    />
                  </label>
                )}

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Rarity Weight</span>
                    <span className="font-mono-code text-[#DFC086]">{activeDef.rarityWeight.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={5.0}
                    step={0.1}
                    value={activeDef.rarityWeight}
                    onChange={(e) => updateMetaField('rarityWeight', parseFloat(e.target.value))}
                    className="w-full accent-[#D9A754]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Visual Effect Summary</span>
                  <input
                    type="text"
                    value={activeDef.visualEffect}
                    onChange={(e) => updateMetaField('visualEffect', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-[#B3A490]">Tags</span>
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {ALL_TAGS.map((tag) => {
                      const active = activeDef.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const nextTags = active
                              ? activeDef.tags.filter((t) => t !== tag)
                              : [...activeDef.tags, tag];
                            if (nextTags.length > 0) updateMetaField('tags', nextTags);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer border ${
                            active
                              ? 'bg-[#382C1B] border-[#D9A754]/55 text-[#F5D692]'
                              : 'bg-[#17130F] border-[#D8BC87]/18 text-[#9E8F7B]'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="text-[#B3A490]">Field Guide Description</span>
                <textarea
                  rows={2}
                  value={activeDef.description}
                  onChange={(e) => updateMetaField('description', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                />
              </label>
            </div>

            {/* Section 2: Palette Override */}
            <div className="rounded-xl bg-[#221C16] border border-[#D8BC87]/18 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#F1CD82] uppercase tracking-wider">
                    2. Colors &amp; Opacity
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      activeOverride?.palette1x
                        ? 'bg-[#1D3234] text-[#9EE8DE]'
                        : 'bg-[#2B241D] text-[#A89A87]'
                    }`}
                  >
                    {activeOverride?.palette1x ? 'Custom Override Active' : 'Using Procedural Default'}
                  </span>
                </div>
                {activeOverride?.palette1x && (
                  <button
                    type="button"
                    onClick={() =>
                      mutateSelectedOverride((cur) => {
                        const next = { ...cur };
                        delete next.palette1x;
                        delete next.palette2x;
                        return next;
                      })
                    }
                    className="text-[11px] text-[#E0A490] hover:text-[#F8C8B8] cursor-pointer"
                  >
                    Reset Palette
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                {(
                  [
                    { key: 'base', label: '1× Base', value: effectivePal1x.base },
                    { key: 'patternPrimary', label: '1× Pattern', value: effectivePal1x.patternPrimary },
                    {
                      key: 'patternSecondary',
                      label: '1× Highlight',
                      value: effectivePal1x.patternSecondary ?? effectivePal1x.base,
                    },
                    { key: 'belly', label: 'Belly', value: effectivePal1x.belly ?? '#F3EAD8' },
                    { key: 'outline', label: 'Outline', value: effectivePal1x.outline ?? '#1F1711' },
                    { key: 'eyeIris', label: 'Eye Iris', value: effectivePal1x.eyeIris ?? '#7C5D3B' },
                  ] as const
                ).map((sw) => (
                  <label
                    key={sw.key}
                    className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1511] border border-[#D8BC87]/18"
                  >
                    <input
                      type="color"
                      value={sw.value}
                      onChange={(e) => updatePalette('palette1x', { [sw.key]: e.target.value })}
                      className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] text-[#E6DAC8] truncate">{sw.label}</div>
                      <div className="font-mono-code text-[9px] text-[#9E8F7B]">{sw.value}</div>
                    </div>
                  </label>
                ))}
              </div>

              {activeDef.mode === 'codominant' && (
                <div className="pt-2 border-t border-[#D8BC87]/12 space-y-2">
                  <div className="text-[11px] font-medium text-[#DFC086]">Super (2×) Colors</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                    {(
                      [
                        { key: 'base', label: '2× Base', value: effectivePal2x.base },
                        { key: 'patternPrimary', label: '2× Pattern', value: effectivePal2x.patternPrimary },
                        {
                          key: 'patternSecondary',
                          label: '2× Highlight',
                          value: effectivePal2x.patternSecondary ?? effectivePal2x.base,
                        },
                        { key: 'outline', label: '2× Outline', value: effectivePal2x.outline ?? '#1F1711' },
                        { key: 'eyeIris', label: '2× Eye Iris', value: effectivePal2x.eyeIris ?? '#7C5D3B' },
                      ] as const
                    ).map((sw) => (
                      <label
                        key={sw.key}
                        className="flex items-center gap-2 p-2 rounded-lg bg-[#1A1511] border border-[#D8BC87]/18"
                      >
                        <input
                          type="color"
                          value={sw.value}
                          onChange={(e) => updatePalette('palette2x', { [sw.key]: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] text-[#E6DAC8] truncate">{sw.label}</div>
                          <div className="font-mono-code text-[9px] text-[#9E8F7B]">{sw.value}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Body Opacity</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectivePal1x.bodyOpacity ?? 1).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.02}
                    value={effectivePal1x.bodyOpacity ?? 1}
                    onChange={(e) =>
                      updatePalette('palette1x', { bodyOpacity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Combo Pigment Weight</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectivePal1x.pigmentWeight ?? 0.9).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.05}
                    value={effectivePal1x.pigmentWeight ?? 0.9}
                    onChange={(e) =>
                      updatePalette('palette1x', { pigmentWeight: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>
              </div>
            </div>

            {/* Section 3: Pattern Field & Skin Params */}
            <div className="rounded-xl bg-[#221C16] border border-[#D8BC87]/18 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#F1CD82] uppercase tracking-wider">
                    3. Pattern Field &amp; Surface Parameters
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      activeOverride?.field1x
                        ? 'bg-[#1D3234] text-[#9EE8DE]'
                        : 'bg-[#2B241D] text-[#A89A87]'
                    }`}
                  >
                    {activeOverride?.field1x ? 'Custom Override Active' : 'Using Procedural Default'}
                  </span>
                </div>
                {activeOverride?.field1x && (
                  <button
                    type="button"
                    onClick={() =>
                      mutateSelectedOverride((cur) => {
                        const next = { ...cur };
                        delete next.field1x;
                        delete next.field2x;
                        delete next.customTexture;
                        return next;
                      })
                    }
                    className="text-[11px] text-[#E0A490] hover:text-[#F8C8B8] cursor-pointer"
                  >
                    Reset Pattern
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">1× Field Primitive</span>
                  <select
                    value={effectiveField1x.field}
                    onChange={(e) =>
                      updateField('field1x', { field: e.target.value as SkinFieldPrimitiveId })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    {FIELD_PRIMITIVES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[#B3A490]">1× Blend Operator</span>
                  <select
                    value={effectiveField1x.operation}
                    onChange={(e) =>
                      updateField('field1x', { operation: e.target.value as FieldOperation })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    {FIELD_OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <input
                    ref={maskInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadMask(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => maskInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A231C] hover:bg-[#362D24] border border-[#D8BC87]/25 text-xs text-[#E6DAC8] cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#7AE0D4]" aria-hidden="true" />
                    <span>
                      {activeOverride?.customTexture ? 'Replace PNG Mask' : 'Upload PNG Mask'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Field Strength</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {effectiveField1x.strength.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.2}
                    step={0.05}
                    value={effectiveField1x.strength}
                    onChange={(e) =>
                      updateField('field1x', { strength: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Frequency</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectiveField1x.frequency ?? 1).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.4}
                    step={0.05}
                    value={effectiveField1x.frequency ?? 1}
                    onChange={(e) =>
                      updateField('field1x', { frequency: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Coverage</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectiveField1x.paramOverrides?.coverage ?? 0.5).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.14}
                    max={0.86}
                    step={0.02}
                    value={effectiveField1x.paramOverrides?.coverage ?? 0.5}
                    onChange={(e) =>
                      updateField('field1x', {}, { coverage: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Warp Strength</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectiveField1x.paramOverrides?.warpStrength ?? 0.2).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.03}
                    value={effectiveField1x.paramOverrides?.warpStrength ?? 0.2}
                    onChange={(e) =>
                      updateField('field1x', {}, { warpStrength: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Blush</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectiveField1x.paramOverrides?.blush ?? 0.25).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.04}
                    value={effectiveField1x.paramOverrides?.blush ?? 0.25}
                    onChange={(e) =>
                      updateField('field1x', {}, { blush: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Speckling</span>
                    <span className="font-mono-code text-[#DFC086]">
                      {(effectiveField1x.paramOverrides?.speckleAmount ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.04}
                    value={effectiveField1x.paramOverrides?.speckleAmount ?? 0}
                    onChange={(e) =>
                      updateField('field1x', {}, { speckleAmount: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#56B8B0]"
                  />
                </label>
              </div>

              {activeDef.mode === 'codominant' && (
                <div className="pt-2 border-t border-[#D8BC87]/12 space-y-2.5 text-xs">
                  <div className="text-[11px] font-medium text-[#DFC086]">
                    Super (2×) Pattern Field
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <label className="space-y-1">
                      <span className="text-[#B3A490]">2× Field</span>
                      <select
                        value={effectiveField2x.field}
                        onChange={(e) =>
                          updateField('field2x', { field: e.target.value as SkinFieldPrimitiveId })
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                      >
                        {FIELD_PRIMITIVES.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[#B3A490]">2× Operator</span>
                      <select
                        value={effectiveField2x.operation}
                        onChange={(e) =>
                          updateField('field2x', { operation: e.target.value as FieldOperation })
                        }
                        className="w-full px-2 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                      >
                        {FIELD_OPS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#B3A490]">2× Strength</span>
                        <span className="font-mono-code text-[#DFC086]">
                          {effectiveField2x.strength.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={1.2}
                        step={0.05}
                        value={effectiveField2x.strength}
                        onChange={(e) =>
                          updateField('field2x', { strength: parseFloat(e.target.value) })
                        }
                        className="w-full accent-[#56B8B0]"
                      />
                    </label>
                    <label className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#B3A490]">2× Frequency</span>
                        <span className="font-mono-code text-[#DFC086]">
                          {(effectiveField2x.frequency ?? 1).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.4}
                        step={0.05}
                        value={effectiveField2x.frequency ?? 1}
                        onChange={(e) =>
                          updateField('field2x', { frequency: parseFloat(e.target.value) })
                        }
                        className="w-full accent-[#56B8B0]"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Overwrite Project Files Confirmation Modal */}
      {showSaveConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dev-save-confirm-title"
          data-testid="dev-save-confirm-dialog"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#090705]/85 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#201A14] border border-[#E0A854]/60 shadow-2xl shadow-black/90 p-5 space-y-4 text-[#F5EFE4]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#3D2914] border border-[#E0A854]/55 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#F6C46A]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h3
                  id="dev-save-confirm-title"
                  className="font-display text-lg font-semibold text-[#FFF4DE]"
                >
                  Overwrite Project Files?
                </h3>
                <p className="text-xs text-[#D4C7B4] leading-relaxed">
                  This action will directly overwrite{' '}
                  <code className="font-mono-code text-[#F5D692] bg-[#14100C] px-1.5 py-0.5 rounded">
                    {BUILTIN_GENE_OVERRIDES_REL_PATH}
                  </code>{' '}
                  in your workspace so these Core &amp; Fun gene changes become part of the project source.
                </p>
              </div>
            </div>

            {/* Rollback & Git Cleanliness Reminder */}
            <div className="rounded-xl bg-[#2A2014] border border-[#D9A754]/40 p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-[#F5D692] flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Git Rollback Reminder</span>
              </div>
              <p className="text-[#E0D2BE] leading-relaxed">
                Make sure you have <strong>committed your previous changes</strong> before overwriting project
                files if you want a clean rollback point (e.g.{' '}
                <code className="font-mono-code text-[11px] text-[#F7E5BE]">
                  git checkout -- {BUILTIN_GENE_OVERRIDES_REL_PATH}
                </code>
                ).
              </p>

              <div className="pt-1 border-t border-[#D8BC87]/15">
                {gitStatus.loading ? (
                  <span className="text-[11px] text-[#B3A490]">Checking local git working tree…</span>
                ) : !gitStatus.available ? (
                  <span className="text-[11px] text-[#C8BAA5]">
                    Git status unavailable — please verify your commits manually before proceeding.
                  </span>
                ) : gitStatus.clean ? (
                  <span className="text-[11px] text-[#9BE8DC] font-medium flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Git working tree is clean — safe rollback point ready.</span>
                  </span>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-[#F5BA84] font-semibold">
                      Uncommitted changes detected in {gitStatus.dirtyCount} file
                      {gitStatus.dirtyCount === 1 ? '' : 's'} — consider committing first!
                    </div>
                    <pre className="max-h-20 overflow-y-auto rounded bg-[#14100C] p-2 font-mono-code text-[10px] text-[#D8C9B5]">
                      {gitStatus.files.join('\n')}
                      {gitStatus.dirtyCount > gitStatus.files.length
                        ? `\n…and ${gitStatus.dirtyCount - gitStatus.files.length} more`
                        : ''}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Pending Changes Summary */}
            <div className="rounded-xl bg-[#17130F] border border-[#D8BC87]/18 p-3 space-y-1.5 text-xs">
              <div className="font-medium text-[#E6DAC8]">
                Write summary ({diffSummary.totalActiveOverrides} total active gene override
                {diffSummary.totalActiveOverrides === 1 ? '' : 's'}):
              </div>
              {diffSummary.hasUnsavedChanges ? (
                <ul className="space-y-1 text-[11px] text-[#C8BAA5] max-h-28 overflow-y-auto">
                  {diffSummary.addedOrUpdated.map((loc) => (
                    <li key={`up-${loc}`}>
                      • Update <strong className="text-[#F5EFE4]">{LOCUS_DEFINITIONS[loc].name}</strong>{' '}
                      <code className="text-[#9E8F7B]">({loc})</code>
                    </li>
                  ))}
                  {diffSummary.resetToDefault.map((loc) => (
                    <li key={`rst-${loc}`}>
                      • Reset <strong className="text-[#F5BEB0]">{getBaseLocusDefinition(loc).name}</strong>{' '}
                      <code className="text-[#9E8F7B]">({loc})</code> back to code default
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[#A89A87]">
                  No new edits since last save — confirming will rewrite the file with the current{' '}
                  {diffSummary.totalActiveOverrides} override(s).
                </p>
              )}
            </div>

            {/* Explicit Confirmation Checkbox */}
            <label className="flex items-start gap-2.5 text-xs text-[#E6DAC8] cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="dev-save-confirm-checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 accent-[#D9A754] cursor-pointer"
              />
              <span>
                I understand this will overwrite <code>{BUILTIN_GENE_OVERRIDES_REL_PATH}</code> in the
                project files.
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setShowSaveConfirm(false)}
                className="px-3.5 py-2 rounded-lg bg-[#2C241D] hover:bg-[#3A2F26] text-xs font-medium text-[#E6DAC8] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="dev-save-confirm-submit"
                disabled={!confirmChecked || saving}
                onClick={handleConfirmOverwriteProjectFile}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#D9A754] hover:bg-[#E7B96A] disabled:opacity-40 text-[#1A140E] text-xs font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{saving ? 'Writing…' : 'Overwrite Project File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
