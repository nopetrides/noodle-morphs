import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  FileJson,
  FlaskConical,
  Image as ImageIcon,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { createWildTypeGenotype, evaluatePhenotype } from '../game/genetics';
import {
  exportModPackJson,
  getInstalledModPacks,
  installModPack,
  type ModGenePack,
  type ModGrayscaleTexture,
  type ModLocusSpec,
  type ModPackSource,
  SAMPLE_CELESTIAL_PACK,
  uninstallModPack,
} from '../game/modPacks';
import {
  createDefaultSkinFieldParams,
  registerGrayscaleMapField,
  SKIN_GENERATOR_VERSION,
  unregisterGrayscaleMapField,
} from '../game/skinField';
import type {
  FieldOperation,
  InheritanceMode,
  SkinFieldPrimitiveId,
  SnakePhenotype,
} from '../game/types';
import { MiniSnakeCanvas } from './MiniSnakeCanvas';
import { MorphSimulatorPanel } from './MorphSimulatorPanel';

interface ModPacksModalProps {
  onClose: () => void;
  onPacksChanged?: () => void;
}

type ModModalTab = 'installed' | 'import' | 'studio';

interface StudioGeneDraft {
  id: string;
  name: string;
  superName: string;
  mode: InheritanceMode;
  baseHex: string;
  patternHex: string;
  superBaseHex: string;
  superPatternHex: string;
  opacity: number;
  field: SkinFieldPrimitiveId;
  op: FieldOperation;
  strength: number;
  freq: number;
  textureKey: string | null;
  customTexture: ModGrayscaleTexture | null;
  textureLabel: string | null;
}

const STUDIO_PREVIEW_MAP_ID = 'studio_live_preview_mask';

const STUDIO_PRIMITIVES: Array<{ id: SkinFieldPrimitiveId; label: string }> = [
  { id: 'speckled_granite', label: 'Starlight / Speckled' },
  { id: 'crystal_facets', label: 'Crystal Facets' },
  { id: 'banded_agate', label: 'Banded Agate' },
  { id: 'stepped_bismuth', label: 'Stepped Bismuth' },
  { id: 'water_caustics', label: 'Water Caustics' },
  { id: 'magma_fissures', label: 'Magma Fissures' },
  { id: 'mineral_veins', label: 'Mineral Veins' },
  { id: 'angled_waves', label: 'Angled Ribbons' },
  { id: 'radial_rings', label: 'Radial Rings' },
  { id: 'radial_teardrops', label: 'Teardrops' },
  { id: 'cellular_pavers', label: 'Cellular Pavers' },
  { id: 'wind_wisps', label: 'Wind Wisps' },
  { id: 'shattered_mosaic', label: 'Shattered Mosaic' },
  { id: 'custom_map', label: 'Custom PNG Mask' },
];

const STUDIO_OPS: FieldOperation[] = [
  'blend',
  'smoothUnion',
  'union',
  'modulate',
  'subtract',
  'warp',
];

function slugify(input: string, fallback: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return cleaned.length >= 2 ? cleaned : fallback;
}

function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function createDefaultGeneDraft(index = 1): StudioGeneDraft {
  return {
    id: index === 1 ? 'prism' : `custom_gene_${index}`,
    name: index === 1 ? 'Prism' : `Gene ${index}`,
    superName: index === 1 ? 'Hyper Prism' : `Super Gene ${index}`,
    mode: 'codominant',
    baseHex: index === 1 ? '#213654' : '#3E224A',
    patternHex: index === 1 ? '#6CF0E4' : '#F4C97A',
    superBaseHex: index === 1 ? '#121B3A' : '#241033',
    superPatternHex: index === 1 ? '#FF84E8' : '#7AF5E8',
    opacity: 1,
    field: 'crystal_facets',
    op: 'blend',
    strength: 0.88,
    freq: 1.25,
    textureKey: null,
    customTexture: null,
    textureLabel: null,
  };
}

function locusSpecToStudioDraft(
  loc: ModLocusSpec,
  packTextures?: Record<string, ModGrayscaleTexture>
): StudioGeneDraft {
  const texKey = loc.field1x.textureKey ?? null;
  const tex = texKey && packTextures ? packTextures[texKey] ?? null : null;
  return {
    id: loc.id,
    name: loc.name,
    superName: loc.superName ?? `Super ${loc.name}`,
    mode: loc.mode,
    baseHex: loc.palette1x.base,
    patternHex: loc.palette1x.patternPrimary,
    superBaseHex: loc.palette2x?.base ?? loc.palette1x.base,
    superPatternHex: loc.palette2x?.patternPrimary ?? loc.palette1x.patternPrimary,
    opacity: loc.palette1x.bodyOpacity ?? 1,
    field: loc.field1x.field,
    op: loc.field1x.operation,
    strength: loc.field1x.strength,
    freq: loc.field1x.frequency ?? 1.2,
    textureKey: texKey,
    customTexture: tex,
    textureLabel: texKey ? `${texKey} (${tex?.width ?? 64}×${tex?.height ?? 16})` : null,
  };
}

function getEffectivePackSource(pack: ModGenePack): ModPackSource {
  if (pack.source === 'local' || pack.source === 'imported' || pack.source === 'workshop') {
    return pack.source;
  }
  return pack.workshopId ? 'workshop' : 'imported';
}

export function ModPacksModal({ onClose, onPacksChanged }: ModPacksModalProps) {
  const [tab, setTab] = useState<ModModalTab>('installed');
  const [packs, setPacks] = useState<ModGenePack[]>(() => getInstalledModPacks());
  const [simulatingPack, setSimulatingPack] = useState<ModGenePack | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Import tab state
  const [importText, setImportText] = useState<string>('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Gene Studio creator / editor state (supports creating new local packs OR editing existing local packs)
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [studioPackName, setStudioPackName] = useState<string>('My Workshop Pack');
  const [studioAuthor, setStudioAuthor] = useState<string>('Local Creator');
  const [studioVersion, setStudioVersion] = useState<string>('1.0.0');
  const [studioGenes, setStudioGenes] = useState<StudioGeneDraft[]>(() => [
    createDefaultGeneDraft(1),
  ]);
  const [activeGeneIdx, setActiveGeneIdx] = useState<number>(0);
  const textureInputRef = useRef<HTMLInputElement | null>(null);

  const activeGene = studioGenes[activeGeneIdx] ?? studioGenes[0];

  // Register live PNG mask preview in skinField when activeGene uses a custom_map texture
  useEffect(() => {
    if (activeGene.field === 'custom_map' && activeGene.customTexture) {
      registerGrayscaleMapField(
        STUDIO_PREVIEW_MAP_ID,
        activeGene.customTexture.width,
        activeGene.customTexture.height,
        new Float32Array(activeGene.customTexture.data)
      );
      return () => {
        unregisterGrayscaleMapField(STUDIO_PREVIEW_MAP_ID);
      };
    }
    unregisterGrayscaleMapField(STUDIO_PREVIEW_MAP_ID);
    return undefined;
  }, [activeGene.field, activeGene.customTexture]);

  const updateActiveGene = (patch: Partial<StudioGeneDraft>) => {
    setStudioGenes((prev) =>
      prev.map((g, idx) => (idx === activeGeneIdx ? { ...g, ...patch } : g))
    );
  };

  const resetStudioForNewPack = () => {
    setEditingPackId(null);
    setStudioPackName('My Workshop Pack');
    setStudioAuthor('Local Creator');
    setStudioVersion('1.0.0');
    setStudioGenes([createDefaultGeneDraft(1)]);
    setActiveGeneIdx(0);
    setStatusMessage(null);
  };

  const handleEditLocalPack = (pack: ModGenePack) => {
    setEditingPackId(pack.packId);
    setStudioPackName(pack.name);
    setStudioAuthor(pack.author);
    setStudioVersion(pack.version);
    const drafts =
      pack.loci.length > 0
        ? pack.loci.map((loc) => locusSpecToStudioDraft(loc, pack.textures))
        : [createDefaultGeneDraft(1)];
    setStudioGenes(drafts);
    setActiveGeneIdx(0);
    setStatusMessage(null);
    setTab('studio');
  };

  const handleAddGeneToStudio = () => {
    const nextIdx = studioGenes.length + 1;
    setStudioGenes((prev) => [...prev, createDefaultGeneDraft(nextIdx)]);
    setActiveGeneIdx(studioGenes.length);
  };

  const handleRemoveActiveGene = () => {
    if (studioGenes.length <= 1) return;
    setStudioGenes((prev) => prev.filter((_, idx) => idx !== activeGeneIdx));
    setActiveGeneIdx((prev) => Math.max(0, prev - 1));
  };

  const refreshPacks = () => {
    setPacks(getInstalledModPacks());
    onPacksChanged?.();
  };

  const sampleInstalled = packs.some((p) => p.packId === SAMPLE_CELESTIAL_PACK.packId);

  const handleInstallSample = () => {
    const res = installModPack(SAMPLE_CELESTIAL_PACK, true, 'workshop');
    if (res.ok) {
      refreshPacks();
      setStatusMessage({
        kind: 'ok',
        text: `Installed "${res.pack.name}" (${res.pack.loci.length} genes, ${res.pack.synthesisRecipes?.length ?? 0} synthesis recipe). Enable it when starting a New Game!`,
      });
    }
  };

  const handleUninstall = (packId: string, name: string) => {
    uninstallModPack(packId, true);
    if (editingPackId === packId) {
      resetStudioForNewPack();
    }
    refreshPacks();
    setStatusMessage({
      kind: 'ok',
      text: `Removed "${name}". Existing saves keep raw gene IDs safely if you reinstall later.`,
    });
  };

  const handleImportJsonString = (rawText: string) => {
    setImportErrors([]);
    setStatusMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      setImportErrors([`Invalid JSON syntax: ${err instanceof Error ? err.message : 'parse error'}`]);
      return;
    }
    // Preserve 'workshop' if the file declares a workshopId; otherwise mark as 'imported' (read-only)
    const hasWorkshopId =
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).workshopId === 'string' &&
      ((parsed as Record<string, unknown>).workshopId as string).trim().length > 0;
    const res = installModPack(parsed, true, hasWorkshopId ? 'workshop' : 'imported');
    if (!res.ok) {
      setImportErrors(res.errors);
      return;
    }
    refreshPacks();
    setImportText('');
    setTab('installed');
    setStatusMessage({
      kind: 'ok',
      text: `Imported "${res.pack.name}" (${res.pack.loci.length} loci) as ${hasWorkshopId ? 'Workshop' : 'Imported'} pack.`,
    });
  };

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setImportText(text);
      handleImportJsonString(text);
    };
    reader.readAsText(file);
  };

  const handleUploadPngMask = (file: File) => {
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
        const r = imgData[i * 4];
        const g = imgData[i * 4 + 1];
        const b = imgData[i * 4 + 2];
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        data[i] = Number(lum.toFixed(3));
      }
      const texKey = slugify(`${activeGene.name}_mask`, `mask_${activeGeneIdx + 1}`);
      updateActiveGene({
        textureKey: texKey,
        customTexture: { width: w, height: h, data },
        textureLabel: file.name,
        field: 'custom_map',
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setStatusMessage({ kind: 'err', text: 'Could not decode image mask.' });
    };
    img.src = objectUrl;
  };

  const studioPackDraft = useMemo<ModGenePack>(() => {
    const packId = editingPackId ?? slugify(studioPackName, 'custom_pack');
    const textures: Record<string, ModGrayscaleTexture> = {};
    const usedIds = new Set<string>();

    const loci: ModLocusSpec[] = studioGenes.map((g, idx) => {
      let baseSlug = editingPackId ? g.id : slugify(g.name, `custom_gene_${idx + 1}`);
      if (!baseSlug || baseSlug.length < 2) baseSlug = `custom_gene_${idx + 1}`;
      let locusId = baseSlug;
      let suffix = 2;
      while (usedIds.has(locusId)) {
        locusId = `${baseSlug}_${suffix++}`;
      }
      usedIds.add(locusId);

      const useCustomTex = g.field === 'custom_map' && g.customTexture !== null;
      const effectiveField: SkinFieldPrimitiveId = useCustomTex
        ? 'custom_map'
        : g.field === 'custom_map'
          ? 'crystal_facets'
          : g.field;
      const texKey = useCustomTex
        ? slugify(g.textureKey ?? `${locusId}_mask`, `mask_${idx + 1}`)
        : undefined;
      if (useCustomTex && texKey && g.customTexture) {
        textures[texKey] = g.customTexture;
      }

      const displayName = g.name.trim() || `Gene ${idx + 1}`;
      return {
        id: locusId,
        name: displayName,
        ...(g.mode === 'codominant' && g.superName.trim()
          ? { superName: g.superName.trim() }
          : {}),
        mode: g.mode,
        shortCode: displayName.slice(0, 3).toUpperCase(),
        description: `Locally designed ${g.mode} morph.`,
        visualEffect: `${displayName} pattern (${effectiveField.replace('_', ' ')}).`,
        rarityWeight: g.mode === 'recessive' ? 2.8 : 2.2,
        tags: ['Color', 'Pattern', 'Custom'],
        palette1x: {
          base: g.baseHex,
          patternPrimary: g.patternHex,
          bodyOpacity: g.opacity,
          pigmentWeight: 0.82,
        },
        ...(g.mode === 'codominant'
          ? {
              palette2x: {
                base: g.superBaseHex,
                patternPrimary: g.superPatternHex,
                bodyOpacity: g.opacity,
                pigmentWeight: 0.92,
              },
            }
          : {}),
        field1x: {
          field: effectiveField,
          operation: g.op,
          strength: g.strength,
          frequency: g.freq,
          ...(texKey ? { textureKey: texKey } : {}),
          paramOverrides: { coverage: 0.44 },
        },
        ...(g.mode === 'codominant'
          ? {
              field2x: {
                field: effectiveField,
                operation: g.op,
                strength: Math.min(1.15, Number((g.strength + 0.14).toFixed(2))),
                frequency: Number((g.freq * 1.12).toFixed(2)),
                ...(texKey ? { textureKey: texKey } : {}),
                paramOverrides: { coverage: 0.54, blush: 0.5 },
              },
            }
          : {}),
      };
    });

    // Preserve any existing synthesis recipes when editing a local pack
    const existingPack = editingPackId ? packs.find((p) => p.packId === editingPackId) : undefined;
    const preservedRecipes = existingPack?.synthesisRecipes?.filter(
      (r) => loci.some((l) => l.id === r.result)
    );

    return {
      schemaVersion: 1,
      packId,
      name: studioPackName.trim() || 'My Workshop Pack',
      author: studioAuthor.trim() || 'Local Creator',
      version: studioVersion.trim() || '1.0.0',
      description: `Created in Morpharium Gene Studio (${loci.map((l) => l.name).join(', ')}).`,
      source: 'local',
      ...(Object.keys(textures).length > 0 ? { textures } : {}),
      loci,
      ...(preservedRecipes && preservedRecipes.length > 0
        ? { synthesisRecipes: preservedRecipes }
        : {}),
    };
  }, [editingPackId, studioPackName, studioAuthor, studioVersion, studioGenes, packs]);

  const wildTypePreview = useMemo(
    () => evaluatePhenotype(createWildTypeGenotype(), 0.42),
    []
  );

  // Live 1× and 2× Super preview phenotypes for the active gene in Gene Studio
  const studioPreview1x = useMemo<SnakePhenotype>(() => {
    const loc = studioPackDraft.loci[activeGeneIdx] ?? studioPackDraft.loci[0];
    const params = createDefaultSkinFieldParams();
    params.coverage = 0.44;
    params.frequency = activeGene.freq;
    const pal = loc.palette1x;
    const usesLiveMap = activeGene.field === 'custom_map' && activeGene.customTexture !== null;
    return {
      morphKey: `preview-${loc.id}-1x`,
      morphName: loc.name,
      visualGenes: [loc.name],
      hetGenes: [],
      rarity: 'uncommon',
      isUpsideDown: false,
      isCustomMorph: true,
      lineageVigor: 100,
      lineageNote: 'Gene Studio preview',
      behavior: 'calm_wanderer',
      behaviorLabel: 'Studio Preview',
      healthPredisposition: 'Studio preview',
      palette: {
        base: pal.base,
        patternPrimary: pal.patternPrimary,
        patternSecondary: pal.patternPrimary,
        belly: '#F4EFE4',
        outline: '#1B1510',
        eyeIris: pal.patternPrimary,
        eyePupil: '#120E0B',
        headBlush: pal.base,
        isLeucistic: false,
        isAlbino: false,
        isPiebald: false,
        ...(pal.bodyOpacity !== undefined && pal.bodyOpacity < 0.99
          ? { bodyOpacity: pal.bodyOpacity }
          : {}),
      },
      patternRule: {
        motif: 'facets',
        weight: 'medium',
        modifier: 'banded',
        formula: `(${loc.field1x.field.replace('_', ' ')})`,
        glyph: '◆◇◆',
        frequency: activeGene.freq,
        variationSeed: 0.42,
        isCustomPattern: true,
      },
      skinSpec: {
        generatorVersion: SKIN_GENERATOR_VERSION,
        params,
        contributions: [
          {
            field: usesLiveMap
              ? 'custom_map'
              : loc.field1x.field === 'custom_map'
                ? 'crystal_facets'
                : loc.field1x.field,
            operation: loc.field1x.operation,
            strength: loc.field1x.strength,
            frequency: loc.field1x.frequency,
          },
        ],
        ...(usesLiveMap ? { customMapId: STUDIO_PREVIEW_MAP_ID } : {}),
      },
      tags: ['Custom'],
    };
  }, [studioPackDraft, activeGeneIdx, activeGene]);

  const studioPreview2x = useMemo<SnakePhenotype>(() => {
    const loc = studioPackDraft.loci[activeGeneIdx] ?? studioPackDraft.loci[0];
    const pal = loc.palette2x ?? loc.palette1x;
    const fld = loc.field2x ?? loc.field1x;
    const params = createDefaultSkinFieldParams();
    params.coverage = 0.54;
    params.frequency = fld.frequency ?? activeGene.freq;
    params.blush = 0.5;
    const usesLiveMap = activeGene.field === 'custom_map' && activeGene.customTexture !== null;
    return {
      ...studioPreview1x,
      morphKey: `preview-${loc.id}-2x`,
      morphName: loc.superName ?? `Super ${loc.name}`,
      palette: {
        base: pal.base,
        patternPrimary: pal.patternPrimary,
        patternSecondary: pal.patternPrimary,
        belly: '#F4EFE4',
        outline: '#1B1510',
        eyeIris: pal.patternPrimary,
        eyePupil: '#120E0B',
        headBlush: pal.base,
        isLeucistic: false,
        isAlbino: false,
        isPiebald: false,
        ...(pal.bodyOpacity !== undefined && pal.bodyOpacity < 0.99
          ? { bodyOpacity: pal.bodyOpacity }
          : {}),
      },
      skinSpec: {
        generatorVersion: SKIN_GENERATOR_VERSION,
        params,
        contributions: [
          {
            field: usesLiveMap
              ? 'custom_map'
              : fld.field === 'custom_map'
                ? 'crystal_facets'
                : fld.field,
            operation: fld.operation,
            strength: fld.strength,
            frequency: fld.frequency,
          },
        ],
        ...(usesLiveMap ? { customMapId: STUDIO_PREVIEW_MAP_ID } : {}),
      },
    };
  }, [studioPackDraft, activeGeneIdx, activeGene, studioPreview1x]);

  const handleSaveStudioPack = (openSimulatorAfter = false) => {
    const wasEditing = editingPackId !== null;
    const res = installModPack(studioPackDraft, true, 'local');
    if (!res.ok) {
      setStatusMessage({ kind: 'err', text: res.errors.join(' ') });
      return;
    }
    refreshPacks();
    setEditingPackId(res.pack.packId);
    if (openSimulatorAfter) {
      setSimulatingPack(res.pack);
      return;
    }
    setTab('installed');
    setStatusMessage({
      kind: 'ok',
      text: wasEditing
        ? `Updated local pack "${res.pack.name}" (${res.pack.loci.length} ${res.pack.loci.length === 1 ? 'gene' : 'genes'}). Live snakes refreshed.`
        : `Created local pack "${res.pack.name}"! Enable it in New Game or edit it anytime from Installed.`,
    });
  };

  if (simulatingPack) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pack-simulator-title"
        data-testid="pack-simulator-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/88 backdrop-blur-[2px]"
        onClick={(e) => {
          if (e.target === e.currentTarget) setSimulatingPack(null);
        }}
      >
        <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl bg-[#1D1814] border border-[#56B8B0]/45 shadow-2xl shadow-black/80 text-[#F5EFE4] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#D8BC87]/20 bg-[#231D17]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                data-testid="pack-sim-back-btn"
                onClick={() => setSimulatingPack(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2E2720] hover:bg-[#3A3128] text-xs font-medium text-[#E6DAC8] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Packs</span>
              </button>
              <div className="min-w-0">
                <h2
                  id="pack-simulator-title"
                  className="font-display text-lg font-semibold text-[#F7F1E5] flex items-center gap-2 truncate"
                >
                  <FlaskConical className="w-4 h-4 text-[#7AE0D4] shrink-0" aria-hidden="true" />
                  <span className="truncate">Pack Simulator · {simulatingPack.name}</span>
                </h2>
                <p className="text-[11px] text-[#B3A490]">
                  Preview genes in this pack alone, or toggle &ldquo;Include all installed genes&rdquo; to test combos.
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close pack simulator"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#C2B4A1] hover:text-[#F7F1E5] hover:bg-[#322A22] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <MorphSimulatorPanel focusPackId={simulatingPack.packId} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-packs-title"
      data-testid="mod-packs-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0A08]/85 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#1D1814] border border-[#56B8B0]/40 shadow-2xl shadow-black/80 text-[#F5EFE4] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#D8BC87]/20 bg-[#231D17]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className="w-5 h-5 text-[#7AE0D4] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="mod-packs-title" className="font-display text-xl font-semibold text-[#F7F1E5]">
                Gene Packs &amp; Workshop Studio
              </h2>
              <p className="text-xs text-[#B3A490]">
                Locally authored packs are editable in Gene Studio; imported &amp; Workshop packs stay read-only.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close gene packs manager"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#C2B4A1] hover:text-[#F7F1E5] hover:bg-[#322A22] cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[#D8BC87]/15 bg-[#191511]">
          {(
            [
              { id: 'installed', label: `Installed (${packs.length})`, icon: Package },
              { id: 'import', label: 'Import JSON', icon: Upload },
              {
                id: 'studio',
                label: editingPackId ? 'Gene Studio (Editing)' : 'Gene Studio',
                icon: Wand2,
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`mod-tab-${t.id}`}
                onClick={() => {
                  setTab(t.id);
                  setStatusMessage(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'bg-[#56B8B0] text-[#102022]'
                    : 'bg-[#26201A] text-[#C8BAA5] hover:text-[#F7F1E5]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === 'installed' && (
            <>
              {/* Quick-Start Sample Workshop Pack Banner */}
              <div className="rounded-xl bg-[#1B282A] border border-[#56B8B0]/35 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#9EE8DE] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Sample Workshop Pack: Celestial Morphs</span>
                  </div>
                  <p className="text-[11px] text-[#B8D2CF] leading-relaxed">
                    Includes <strong>Starlight</strong> (2× Supernova), <strong>Aurora</strong> (2× Solar Flare), and{' '}
                    <strong>Nebula</strong> (synthesized via Starlight × Aurora with a bundled grayscale UV texture).
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="download-sample-pack-btn"
                    onClick={() =>
                      downloadJsonFile(
                        'celestial-morphs-pack.json',
                        exportModPackJson(SAMPLE_CELESTIAL_PACK)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#24373A] hover:bg-[#2E464A] border border-[#56B8B0]/35 text-[11px] font-medium text-[#D5F6F2] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>JSON</span>
                  </button>
                  <button
                    type="button"
                    data-testid="install-sample-pack-btn"
                    disabled={sampleInstalled}
                    onClick={handleInstallSample}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#56B8B0] hover:bg-[#6CCAC2] disabled:opacity-45 text-xs font-semibold text-[#102022] cursor-pointer"
                  >
                    {sampleInstalled ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Installed</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Install Sample</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {packs.length === 0 ? (
                <div className="rounded-xl bg-[#241E18] border border-[#D8BC87]/18 p-8 text-center space-y-2">
                  <p className="text-sm text-[#DFD3C2] font-medium">No Gene Packs installed yet.</p>
                  <p className="text-xs text-[#9E8F7B]">
                    Install the sample pack above, import a `.json` pack, or design your own editable pack in Gene Studio.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {packs.map((pack) => {
                    const source = getEffectivePackSource(pack);
                    const isLocal = source === 'local';
                    return (
                      <article
                        key={pack.packId}
                        data-testid={`installed-pack-${pack.packId}`}
                        className={`rounded-xl bg-[#241E18] border p-4 space-y-2.5 ${
                          isLocal ? 'border-[#D9A754]/40' : 'border-[#D8BC87]/22'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-display text-base font-semibold text-[#F7F1E5]">
                                {pack.name}
                              </h3>
                              <span className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#2F2720] text-[#D8BC87]">
                                v{pack.version}
                              </span>
                              {source === 'local' ? (
                                <span
                                  data-testid={`pack-source-${pack.packId}`}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#3A2E1A] text-[#F1CD82] border border-[#D9A754]/45"
                                >
                                  Local · Editable
                                </span>
                              ) : source === 'workshop' ? (
                                <span
                                  data-testid={`pack-source-${pack.packId}`}
                                  className="font-mono-code text-[10px] px-1.5 py-0.5 rounded bg-[#1E363A] text-[#9EE8DE] border border-[#56B8B0]/35"
                                >
                                  Workshop{pack.workshopId ? ` · ${pack.workshopId}` : ''}
                                </span>
                              ) : (
                                <span
                                  data-testid={`pack-source-${pack.packId}`}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#2A2622] text-[#C8BAA5] border border-[#D8BC87]/25"
                                >
                                  Imported
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#A89A87] mt-0.5">
                              by {pack.author} · ID: <code className="text-[#C8BAA5]">{pack.packId}</code>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              data-testid={`simulate-pack-${pack.packId}`}
                              onClick={() => setSimulatingPack(pack)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1D3234] hover:bg-[#254043] border border-[#56B8B0]/45 text-[11px] font-semibold text-[#A6ECE3] cursor-pointer"
                            >
                              <FlaskConical className="w-3 h-3" aria-hidden="true" />
                              <span>Simulator</span>
                            </button>
                            {isLocal && (
                              <button
                                type="button"
                                data-testid={`edit-pack-${pack.packId}`}
                                onClick={() => handleEditLocalPack(pack)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3A2E1A] hover:bg-[#4C3B21] border border-[#D9A754]/45 text-[11px] font-semibold text-[#F5D692] cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                downloadJsonFile(`${pack.packId}.json`, exportModPackJson(pack))
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2E2720] hover:bg-[#3A3128] text-[11px] text-[#E6DAC8] cursor-pointer"
                            >
                              <Download className="w-3 h-3" aria-hidden="true" />
                              <span>Export</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`uninstall-pack-${pack.packId}`}
                              onClick={() => handleUninstall(pack.packId, pack.name)}
                              className="p-1.5 rounded-lg text-[#C98977] hover:text-[#F5B4A3] hover:bg-[#35221C] cursor-pointer"
                              title={`Remove ${pack.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-[#C8BAA5]">{pack.description}</p>

                        {/* Gene Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {pack.loci.map((l) => (
                            <span
                              key={l.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#1A1511] border border-[#D8BC87]/20 text-[11px] text-[#EFE5D6]"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-white/25 shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${l.palette1x.base} 50%, ${l.palette1x.patternPrimary} 50%)`,
                                }}
                              />
                              <span>{l.name}</span>
                              <span className="text-[10px] text-[#9E8F7B] capitalize">{l.mode}</span>
                              {l.isSynthesisOnly && (
                                <span className="text-[9px] text-[#E9C16E]">✦ synth</span>
                              )}
                            </span>
                          ))}
                        </div>

                        {pack.synthesisRecipes && pack.synthesisRecipes.length > 0 && (
                          <div className="text-[11px] text-[#B3A490] pt-1 border-t border-[#D8BC87]/12">
                            Synthesis:{' '}
                            {pack.synthesisRecipes
                              .map(
                                (r) =>
                                  `${r.ingredientA.locus} + ${r.ingredientB.locus} → ${r.name}`
                              )
                              .join(' · ')}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {tab === 'import' && (
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileRead(file);
                }}
                className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver
                    ? 'border-[#56B8B0] bg-[#1C2E30]'
                    : 'border-[#D8BC87]/25 bg-[#231D17]'
                }`}
              >
                <FileJson className="w-7 h-7 text-[#7AE0D4] mx-auto mb-2" aria-hidden="true" />
                <p className="text-xs sm:text-sm text-[#EFE5D6] font-medium">
                  Drop a Morpharium Gene Pack <code>.json</code> file here
                </p>
                <p className="text-[11px] text-[#9E8F7B] mt-0.5 mb-3">
                  Schema-validated &amp; sandboxed (no JavaScript executed). Imported packs are marked read-only.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileRead(file);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2F2720] hover:bg-[#3A3128] border border-[#D8BC87]/25 text-xs font-medium text-[#F5EFE4] cursor-pointer"
                >
                  Choose .json File
                </button>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mod-json-paste" className="text-xs font-medium text-[#C8BAA5]">
                  Or paste Gene Pack JSON directly
                </label>
                <textarea
                  id="mod-json-paste"
                  data-testid="mod-json-textarea"
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"schemaVersion": 1, "packId": "my_pack", ...}'
                  className="w-full rounded-xl bg-[#14110E] border border-[#D8BC87]/25 p-3 font-mono-code text-[11px] text-[#EFE5D6] placeholder:text-[#6F6254] focus:outline-none focus:border-[#56B8B0]"
                />
              </div>

              {importErrors.length > 0 && (
                <div className="rounded-xl bg-[#331D1A] border border-[#D97762]/45 p-3 space-y-1">
                  <div className="text-xs font-semibold text-[#F6B4A6]">Validation Errors</div>
                  <ul className="list-disc pl-4 text-[11px] text-[#F2C7BE] space-y-0.5">
                    {importErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  data-testid="mod-validate-import-btn"
                  disabled={importText.trim().length === 0}
                  onClick={() => handleImportJsonString(importText)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#56B8B0] hover:bg-[#6CCAC2] disabled:opacity-40 text-xs font-semibold text-[#102022] cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Validate &amp; Install Pack</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'studio' && (
            <div className="space-y-4">
              {/* Editing Mode Banner */}
              {editingPackId && (
                <div className="rounded-xl bg-[#2E2417] border border-[#D9A754]/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-[#F5DFB0]">
                    Editing local pack <code className="text-[#F7F1E5] font-semibold">{editingPackId}</code> — saving updates this pack in place.
                  </div>
                  <button
                    type="button"
                    onClick={resetStudioForNewPack}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#3D3122] hover:bg-[#4D3E2B] text-[11px] font-medium text-[#F5EFE4] cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>Start New Pack</span>
                  </button>
                </div>
              )}

              {/* Pack-Level Gene Selector Tabs (supports multi-gene local packs!) */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {studioGenes.map((g, idx) => (
                    <button
                      key={`${g.id}-${idx}`}
                      type="button"
                      onClick={() => setActiveGeneIdx(idx)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer border transition-colors ${
                        idx === activeGeneIdx
                          ? 'bg-[#33291E] border-[#D9A754]/65 text-[#F7F1E5]'
                          : 'bg-[#231D17] border-[#D8BC87]/18 text-[#B3A490] hover:text-[#F5EFE4]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/25"
                        style={{
                          background: `linear-gradient(135deg, ${g.baseHex} 50%, ${g.patternHex} 50%)`,
                        }}
                      />
                      <span>{g.name.trim() || `Gene ${idx + 1}`}</span>
                    </button>
                  ))}
                  {studioGenes.length < 12 && (
                    <button
                      type="button"
                      data-testid="studio-add-gene-btn"
                      onClick={handleAddGeneToStudio}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1F2D2F] hover:bg-[#283B3E] border border-[#56B8B0]/35 text-xs font-medium text-[#BCEFE9] cursor-pointer"
                    >
                      <Plus className="w-3 h-3" aria-hidden="true" />
                      <span>Add Gene</span>
                    </button>
                  )}
                </div>

                {studioGenes.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRemoveActiveGene}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-[#E09B88] hover:bg-[#35221C] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" aria-hidden="true" />
                    <span>Remove Gene</span>
                  </button>
                )}
              </div>

              {/* Live 1x and 2x Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#241E18] border border-[#D8BC87]/22 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F7F1E5]">
                      {activeGene.mode === 'recessive'
                        ? `Classic Normal (Het ${studioPreview1x.morphName})`
                        : studioPreview1x.morphName}
                    </span>
                    <span className="font-mono-code text-[10px] text-[#B3A490]">
                      {activeGene.mode === 'recessive' ? 'Het 1× (Wild-Type)' : '1× Visual'}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <MiniSnakeCanvas
                      phenotype={activeGene.mode === 'recessive' ? wildTypePreview : studioPreview1x}
                      width={260}
                      height={94}
                      animate={false}
                      lazy={false}
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-[#241E18] border border-[#D8BC87]/22 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#F7F1E5]">
                      {activeGene.mode === 'codominant'
                        ? studioPreview2x.morphName
                        : activeGene.mode === 'recessive'
                          ? studioPreview1x.morphName
                          : `${studioPreview1x.morphName} (Homozygous)`}
                    </span>
                    <span className="font-mono-code text-[10px] text-[#E4BE74]">
                      {activeGene.mode === 'codominant'
                        ? 'Super 2×'
                        : activeGene.mode === 'recessive'
                          ? 'Visual 2×'
                          : '2×'}
                    </span>
                  </div>
                  <div className="flex justify-center">
                    <MiniSnakeCanvas
                      phenotype={activeGene.mode === 'codominant' ? studioPreview2x : studioPreview1x}
                      width={260}
                      height={94}
                      animate={false}
                      lazy={false}
                    />
                  </div>
                </div>
              </div>

              {/* Pack & Gene Metadata Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Pack Name</span>
                  <input
                    type="text"
                    value={studioPackName}
                    onChange={(e) => setStudioPackName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Author</span>
                  <input
                    type="text"
                    value={studioAuthor}
                    onChange={(e) => setStudioAuthor(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Version</span>
                  <input
                    type="text"
                    value={studioVersion}
                    onChange={(e) => setStudioVersion(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Gene Name</span>
                  <input
                    type="text"
                    data-testid="studio-gene-name"
                    value={activeGene.name}
                    onChange={(e) => updateActiveGene({ name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Inheritance Mode</span>
                  <select
                    value={activeGene.mode}
                    onChange={(e) =>
                      updateActiveGene({ mode: e.target.value as InheritanceMode })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    <option value="codominant">Codominant (1× + Super 2×)</option>
                    <option value="dominant">Dominant (1× Visual)</option>
                    <option value="recessive">Recessive (Het 1× / Vis 2×)</option>
                  </select>
                </label>
                {activeGene.mode === 'codominant' && (
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[#B3A490]">Super (2×) Name</span>
                    <input
                      type="text"
                      value={activeGene.superName}
                      onChange={(e) => updateActiveGene({ superName: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                    />
                  </label>
                )}
              </div>

              {/* Color Swatches */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#241E18] border border-[#D8BC87]/18">
                  <input
                    type="color"
                    value={activeGene.baseHex}
                    onChange={(e) => updateActiveGene({ baseHex: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[11px] text-[#D8CEBE]">1× Base</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-[#241E18] border border-[#D8BC87]/18">
                  <input
                    type="color"
                    value={activeGene.patternHex}
                    onChange={(e) => updateActiveGene({ patternHex: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="text-[11px] text-[#D8CEBE]">1× Pattern</span>
                </label>
                {activeGene.mode === 'codominant' && (
                  <>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#241E18] border border-[#D8BC87]/18">
                      <input
                        type="color"
                        value={activeGene.superBaseHex}
                        onChange={(e) => updateActiveGene({ superBaseHex: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-[11px] text-[#D8CEBE]">2× Base</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[#241E18] border border-[#D8BC87]/18">
                      <input
                        type="color"
                        value={activeGene.superPatternHex}
                        onChange={(e) => updateActiveGene({ superPatternHex: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                      />
                      <span className="text-[11px] text-[#D8CEBE]">2× Pattern</span>
                    </label>
                  </>
                )}
              </div>

              {/* Field Primitive, Op, & Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Pattern Field Primitive</span>
                  <select
                    value={activeGene.field}
                    onChange={(e) =>
                      updateActiveGene({ field: e.target.value as SkinFieldPrimitiveId })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    {STUDIO_PRIMITIVES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[#B3A490]">Blend Operator</span>
                  <select
                    value={activeGene.op}
                    onChange={(e) =>
                      updateActiveGene({ op: e.target.value as FieldOperation })
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#14110E] border border-[#D8BC87]/25 text-[#F5EFE4]"
                  >
                    {STUDIO_OPS.map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Field Strength</span>
                    <span className="font-mono-code text-[#DFC086]">{activeGene.strength.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.1}
                    step={0.05}
                    value={activeGene.strength}
                    onChange={(e) => updateActiveGene({ strength: parseFloat(e.target.value) })}
                    className="w-full accent-[#56B8B0]"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Body Opacity</span>
                    <span className="font-mono-code text-[#DFC086]">{activeGene.opacity.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={1}
                    step={0.02}
                    value={activeGene.opacity}
                    onChange={(e) => updateActiveGene({ opacity: parseFloat(e.target.value) })}
                    className="w-full accent-[#56B8B0]"
                  />
                </label>
                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#B3A490]">Pattern Frequency</span>
                    <span className="font-mono-code text-[#DFC086]">{activeGene.freq.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={2.2}
                    step={0.05}
                    value={activeGene.freq}
                    onChange={(e) => updateActiveGene({ freq: parseFloat(e.target.value) })}
                    className="w-full accent-[#56B8B0]"
                  />
                </label>

                <div className="flex items-end">
                  <input
                    ref={textureInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadPngMask(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => textureInputRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#26201A] hover:bg-[#322A22] border border-[#D8BC87]/25 text-xs text-[#E6DAC8] cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-[#7AE0D4]" aria-hidden="true" />
                    <span className="truncate">
                      {activeGene.textureLabel
                        ? `Mask: ${activeGene.textureLabel}`
                        : 'Optional PNG Mask (64×16)'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#D8BC87]/15">
                <button
                  type="button"
                  onClick={() =>
                    downloadJsonFile(
                      `${studioPackDraft.packId}.json`,
                      exportModPackJson(studioPackDraft)
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2B241D] hover:bg-[#382F26] text-xs font-medium text-[#E6DAC8] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export Workshop JSON</span>
                </button>
                <button
                  type="button"
                  data-testid="studio-save-simulate-btn"
                  onClick={() => handleSaveStudioPack(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1D3234] hover:bg-[#254043] border border-[#56B8B0]/45 text-xs font-semibold text-[#A6ECE3] cursor-pointer"
                >
                  <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save &amp; Simulate</span>
                </button>
                <button
                  type="button"
                  data-testid="studio-install-pack-btn"
                  onClick={() => handleSaveStudioPack(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#56B8B0] hover:bg-[#6CCAC2] text-xs font-semibold text-[#102022] cursor-pointer"
                >
                  {editingPackId ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Save Changes</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Install Pack Locally</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
