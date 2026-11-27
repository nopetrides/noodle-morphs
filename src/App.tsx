import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GalleryDrawer } from './components/GalleryDrawer';
import { HatchRevealModal } from './components/HatchRevealModal';
import { HissDepotIntroModal } from './components/HissDepotIntroModal';
import { JeanPoolIntroModal } from './components/JeanPoolIntroModal';
import { ModPacksModal } from './components/ModPacksModal';
import { PauseModal } from './components/PauseModal';
import { SaveSlotModal, type SaveSlotModalMode } from './components/SaveSlotModal';
import { SellConfirmModal } from './components/SellConfirmModal';
import { SnakeInspectorCard } from './components/SnakeInspectorCard';
import { SpiderLethalModal } from './components/SpiderLethalModal';
import { StarterPairModal } from './components/StarterPairModal';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { TerrariumDock } from './components/TerrariumDock';
import { TitleOverlay } from './components/TitleOverlay';
import { TopIncubatorHud } from './components/TopIncubatorHud';
import { audioEngine } from './game/audio';
import {
  ContentFlag,
  DEFAULT_GAME_CONFIG,
  hasContentFlag,
  type GameConfig,
  type SaveSlotId,
} from './game/contentFlags';
import {
  adjustGeneBiasWeights,
  analyzeSaleWarnings,
  BREED_VIGOR_COST,
  canSnakeBreed,
  computePairBreedDurationSec,
  createDefaultEconomyState,
  createDefaultHissDepotState,
  evaluateSnakeSaleValue,
  getActiveClutchConfig,
  getBiasCapUpgradePrice,
  getDisplaySlotUpgradePrice,
  getEffectiveHissDepot,
  getIncubatorUpgradePrice,
  getMaxDisplaySlots,
  getMissingLoci,
  hasTriplicateMorph,
  isHissDepotUnlocked,
  isJeanPoolUnlocked,
  JEAN_POOL_COOLDOWN_SEC,
  type JeanPoolOffer,
  MAX_BIAS_CAP_UPGRADES,
  MAX_DISPLAY_UPGRADES,
  MAX_INCUBATOR_UPGRADES,
  recoverSnakesVigor,
  safeAddCurrency,
  safeSpendCurrency,
} from './game/economy';
import { DEV_TOOLS_ENABLED } from './game/env';
import {
  breedClutch,
  buildInitialDiscoveries,
  createRandomStarterPair,
  createTitleShowcaseSnakes,
  evaluatePhenotype,
  isLethalSpiderPairing,
  pickSafeMateFor,
} from './game/genetics';
import {
  findMissingModPacks,
  getInstalledModPacks,
  hydrateModPacksFromStorage,
  onModPacksChanged,
} from './game/modPacks';
import {
  deleteSaveSlot,
  getLastActiveSlotId,
  getMostRecentSaveSlot,
  listSaveSlots,
  loadSaveSlot,
  saveToSlot,
  setLastActiveSlotId,
  type SaveSlotSummary,
} from './game/storage';
import {
  advanceUiEventQueue,
  completeActiveUiEvent,
  createUiEventQueueState,
  enqueueUiEvent,
  type UiEventQueueState,
} from './game/uiEventQueue';
import type {
  ActiveDrawerTab,
  ClutchEgg,
  EconomyState,
  GamePhase,
  InheritanceMode,
  MorphDiscovery,
  SnakeEntity,
  TerrariumSettings,
} from './game/types';

function getInitialAutostart(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('autostart') === '1';
}

function buildFreshGame(gameConfig: GameConfig = DEFAULT_GAME_CONFIG) {
  const starters = createRandomStarterPair(Math.random, gameConfig.contentFlags);
  const economy = createDefaultEconomyState(Math.floor(Math.random() * 100000) + 1);
  const effectiveDepot = getEffectiveHissDepot(economy, gameConfig.contentFlags);
  const breedDur = computePairBreedDurationSec(starters[0], starters[1], effectiveDepot);
  return {
    snakes: starters,
    discoveries: buildInitialDiscoveries(starters),
    sireId: starters[0].id,
    damId: starters[1].id,
    clutchDurationSec: breedDur,
    clutchRemainingSec: Math.min(18, breedDur), // brisk first clutch so new players hatch soon
    clutchReady: false,
    clutchesHatched: 0,
    settings: { heatLampOn: true, muted: false } as TerrariumSettings,
    economy,
    gameConfig: { ...gameConfig },
  };
}

type PendingSale =
  | { kind: 'collection'; snake: SnakeEntity }
  | { kind: 'hatchling'; egg: ClutchEgg };

function resolveContinueSlotSummary(slots: SaveSlotSummary[]): SaveSlotSummary | null {
  const preferred = getLastActiveSlotId() ?? getMostRecentSaveSlot();
  if (!preferred) return null;
  const found = slots.find((s) => s.slotId === preferred && !s.isEmpty);
  return found ?? slots.find((s) => !s.isEmpty) ?? null;
}

function getTitleShowcaseContentFlags(continueSlot: SaveSlotSummary | null): number {
  return continueSlot && !continueSlot.isEmpty
    ? continueSlot.gameConfig.contentFlags
    : ContentFlag.RealMorphs;
}

function getTitleShowcaseModPacks(continueSlot: SaveSlotSummary | null): string[] | undefined {
  return continueSlot && !continueSlot.isEmpty
    ? continueSlot.gameConfig.enabledModPacks
    : undefined;
}

export default function App() {
  // Hydrate installed local / Workshop Gene Packs before decoding saves or title showcase snakes
  hydrateModPacksFromStorage();

  const autostart = useMemo(() => getInitialAutostart(), []);

  // Optional autostart boot (for dev preview URLs); normal players begin cleanly on Title Screen
  const autostartBoot = useMemo(() => {
    if (!autostart) return null;
    const preferred = getLastActiveSlotId() ?? getMostRecentSaveSlot();
    if (preferred) {
      const loaded = loadSaveSlot(preferred);
      if (loaded) return { slotId: preferred, state: loaded, isFresh: false };
    }
    return { slotId: 1 as SaveSlotId, state: buildFreshGame(DEFAULT_GAME_CONFIG), isFresh: true };
  }, [autostart]);

  const [phase, setPhase] = useState<GamePhase>(() => (autostartBoot ? 'playing' : 'title'));
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>(() => listSaveSlots());
  const [installedPackCount, setInstalledPackCount] = useState<number>(
    () => getInstalledModPacks().length
  );
  const [modPacksModalOpen, setModPacksModalOpen] = useState<boolean>(false);
  const [missingModPacks, setMissingModPacks] = useState<string[]>(() => {
    const candidate = autostartBoot?.state as { missingModPacks?: string[] } | undefined;
    return candidate?.missingModPacks ?? [];
  });
  const [titleSnakes, setTitleSnakes] = useState<SnakeEntity[]>(() => {
    if (autostartBoot) return [];
    const initialContinue = resolveContinueSlotSummary(listSaveSlots());
    return createTitleShowcaseSnakes(
      5,
      Math.random,
      getTitleShowcaseContentFlags(initialContinue),
      getTitleShowcaseModPacks(initialContinue)
    );
  });
  const [activeSlotId, setActiveSlotId] = useState<SaveSlotId | null>(() =>
    autostartBoot ? autostartBoot.slotId : null
  );
  const [slotModalMode, setSlotModalMode] = useState<SaveSlotModalMode | null>(null);

  const [gameConfig, setGameConfig] = useState<GameConfig>(() =>
    autostartBoot ? autostartBoot.state.gameConfig : { ...DEFAULT_GAME_CONFIG }
  );
  const [needsStarterConfirm, setNeedsStarterConfirm] = useState<boolean>(false);
  const [snakes, setSnakes] = useState<SnakeEntity[]>(() =>
    autostartBoot ? autostartBoot.state.snakes : []
  );
  const [discoveries, setDiscoveries] = useState<Record<string, MorphDiscovery>>(() =>
    autostartBoot ? autostartBoot.state.discoveries : {}
  );
  const [sireId, setSireId] = useState<string>(() => (autostartBoot ? autostartBoot.state.sireId : ''));
  const [damId, setDamId] = useState<string>(() => (autostartBoot ? autostartBoot.state.damId : ''));
  const [clutchDurationSec, setClutchDurationSec] = useState<number>(() =>
    autostartBoot ? autostartBoot.state.clutchDurationSec : 120
  );
  const [clutchRemainingSec, setClutchRemainingSec] = useState<number>(() =>
    autostartBoot ? autostartBoot.state.clutchRemainingSec : 120
  );
  const [clutchReady, setClutchReady] = useState<boolean>(() =>
    autostartBoot ? autostartBoot.state.clutchReady : false
  );
  const [clutchesHatched, setClutchesHatched] = useState<number>(() =>
    autostartBoot ? autostartBoot.state.clutchesHatched : 0
  );
  const [settings, setSettings] = useState<TerrariumSettings>(() =>
    autostartBoot ? autostartBoot.state.settings : { heatLampOn: true, muted: false }
  );
  const [economy, setEconomy] = useState<EconomyState>(() =>
    autostartBoot ? autostartBoot.state.economy : createDefaultEconomyState()
  );

  const [selectedSnakeId, setSelectedSnakeId] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawerTab | null>(null);
  const [activeClutch, setActiveClutch] = useState<ClutchEgg[] | null>(null);
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [mistTriggerCount, setMistTriggerCount] = useState(0);
  const [uiEventState, setUiEventState] = useState<UiEventQueueState>(() =>
    createUiEventQueueState()
  );
  const [dockHighlightTab, setDockHighlightTab] = useState<ActiveDrawerTab | null>(null);
  const [spiderBlockedNotice, setSpiderBlockedNotice] = useState<{
    attemptedA: string;
    attemptedB: string;
    replacementName: string | null;
  } | null>(null);

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(listSaveSlots());
  }, []);

  const hasSaves = useMemo(() => saveSlots.some((s) => !s.isEmpty), [saveSlots]);
  const continueSlot = useMemo(() => resolveContinueSlotSummary(saveSlots), [saveSlots]);
  const titleShowcaseFlags = useMemo(
    () => getTitleShowcaseContentFlags(continueSlot),
    [continueSlot]
  );
  const titleShowcaseModPacks = useMemo(
    () => getTitleShowcaseModPacks(continueSlot),
    [continueSlot]
  );
  const titleShowcaseSig = `${titleShowcaseFlags}|${(titleShowcaseModPacks ?? []).join(',')}|${installedPackCount}`;
  const lastTitleShowcaseSigRef = useRef<string>(titleShowcaseSig);

  // If the continue slot's enabled categories or installed packs change while on the title screen,
  // refresh the background showcase snakes to match.
  useEffect(() => {
    if (phase !== 'title') {
      lastTitleShowcaseSigRef.current = titleShowcaseSig;
      return;
    }
    if (lastTitleShowcaseSigRef.current !== titleShowcaseSig) {
      lastTitleShowcaseSigRef.current = titleShowcaseSig;
      setTitleSnakes(
        createTitleShowcaseSnakes(5, Math.random, titleShowcaseFlags, titleShowcaseModPacks)
      );
    }
  }, [phase, titleShowcaseSig, titleShowcaseFlags, titleShowcaseModPacks]);

  // Keep installed pack count and active snake phenotypes in sync when packs are installed/removed
  useEffect(() => {
    return onModPacksChanged(() => {
      setInstalledPackCount(getInstalledModPacks().length);
      refreshSaveSlots();
      setSnakes((prev) => {
        if (prev.length === 0) return prev;
        const updated = prev.map((s) =>
          s.modAlleles
            ? { ...s, phenotype: evaluatePhenotype(s.genotype, s.polygenicSeed, s.modAlleles) }
            : s
        );
        setMissingModPacks(
          findMissingModPacks(
            gameConfig.enabledModPacks,
            updated.map((s) => s.modAlleles)
          )
        );
        return updated;
      });
    });
  }, [gameConfig.enabledModPacks, refreshSaveSlots]);

  const jeanPoolEnabled = hasContentFlag(gameConfig.contentFlags, ContentFlag.JeanPool);
  const hissDepotEnabled = hasContentFlag(gameConfig.contentFlags, ContentFlag.HissDepot);

  const effectiveHissDepot = useMemo(
    () => getEffectiveHissDepot(economy, gameConfig.contentFlags),
    [economy, gameConfig.contentFlags]
  );

  const maxDisplay = useMemo(
    () => getMaxDisplaySlots(effectiveHissDepot),
    [effectiveHissDepot]
  );
  const activeClutchConfig = useMemo(
    () => getActiveClutchConfig(effectiveHissDepot),
    [effectiveHissDepot]
  );

  useEffect(() => {
    audioEngine.setMuted(settings.muted);
  }, [settings.muted]);

  useEffect(() => {
    document.body.dataset.state = phase;
  }, [phase]);

  const displayedIds = useMemo(
    () => snakes.filter((s) => s.onDisplay).map((s) => s.id),
    [snakes]
  );

  // Auto-save active gameplay state to its slot once starter pair is confirmed
  useEffect(() => {
    if (phase === 'title' || needsStarterConfirm || activeSlotId === null || snakes.length < 2) {
      return;
    }
    saveToSlot(activeSlotId, {
      snakes,
      displayedIds,
      discoveries,
      sireId,
      damId,
      clutchDurationSec,
      clutchRemainingSec,
      clutchReady,
      clutchesHatched,
      settings,
      economy,
      gameConfig,
    });
  }, [
    phase,
    needsStarterConfirm,
    activeSlotId,
    snakes,
    displayedIds,
    discoveries,
    sireId,
    damId,
    clutchDurationSec,
    clutchRemainingSec,
    clutchReady,
    clutchesHatched,
    settings,
    economy,
    gameConfig,
  ]);

  const sire = useMemo<SnakeEntity | null>(
    () => snakes.find((s) => s.id === sireId) ?? snakes[0] ?? null,
    [snakes, sireId]
  );
  const dam = useMemo<SnakeEntity | null>(
    () =>
      (sire
        ? snakes.find((s) => s.id === damId && s.id !== sire.id) ??
          snakes.find((s) => s.id !== sire.id)
        : null) ??
      snakes[1] ??
      sire,
    [snakes, damId, sire]
  );

  const pairCanBreedNow = Boolean(sire && dam && canSnakeBreed(sire) && canSnakeBreed(dam));

  // Unified 1Hz idle simulation tick
  useEffect(() => {
    if (phase !== 'playing' || needsStarterConfirm || !sire || !dam) return;

    const timer = window.setInterval(() => {
      const isActivelyBreeding =
        !clutchReady && activeClutch === null && pairCanBreedNow && clutchRemainingSec > 0;

      // 1. Tick incubator countdown
      if (isActivelyBreeding) {
        setClutchRemainingSec((prev) => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && prev > 0) {
            setClutchReady(true);
            setSnakes((currSnakes) =>
              currSnakes.map((s) =>
                s.id === sire.id || s.id === dam.id
                  ? { ...s, currentVigor: Math.max(0, s.currentVigor - BREED_VIGOR_COST) }
                  : s
              )
            );
          }
          return next;
        });
      }

      // 2. Recover vigour for non-breeding snakes
      const activeIds = isActivelyBreeding
        ? new Set<string>([sire.id, dam.id])
        : new Set<string>();
      setSnakes((currSnakes) => recoverSnakesVigor(currSnakes, activeIds, 1));

      // 3. Tick Jean Pool restock cooldown (only when Jean Pool is enabled)
      if (jeanPoolEnabled) {
        setEconomy((prev) => {
          if (prev.jeanPool.cooldownRemainingSec <= 0) return prev;
          return {
            ...prev,
            jeanPool: {
              ...prev.jeanPool,
              cooldownRemainingSec: Math.max(0, prev.jeanPool.cooldownRemainingSec - 1),
            },
          };
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    phase,
    needsStarterConfirm,
    clutchReady,
    activeClutch,
    pairCanBreedNow,
    clutchRemainingSec,
    sire,
    dam,
    jeanPoolEnabled,
  ]);

  // --- Save Slot, Title, New Game, and Load Transitions ---

  const handleLoadSlot = useCallback(
    (slotId: SaveSlotId) => {
      const loaded = loadSaveSlot(slotId);
      if (!loaded) return;

      audioEngine.playSoftClick();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Clear title screen showcase morphs & all transient gameplay UI
      setTitleSnakes([]);
      setSlotModalMode(null);
      setSelectedSnakeId(null);
      setActiveDrawer(null);
      setActiveClutch(null);
      setPendingSale(null);
      setNeedsStarterConfirm(false);
      setUiEventState(createUiEventQueueState());
      setDockHighlightTab(null);
      setSpiderBlockedNotice(null);

      // Reinitialize every system strictly from this save's settings & flags
      const nextConfig = loaded.gameConfig;
      const nextHissEnabled = hasContentFlag(nextConfig.contentFlags, ContentFlag.HissDepot);
      const cleanEconomy: EconomyState = nextHissEnabled
        ? loaded.economy
        : { ...loaded.economy, hissDepot: createDefaultHissDepotState() };

      const loadedSire = loaded.snakes.find((s) => s.id === loaded.sireId) ?? loaded.snakes[0];
      const loadedDam =
        loaded.snakes.find((s) => s.id === loaded.damId && s.id !== loadedSire.id) ??
        loaded.snakes.find((s) => s.id !== loadedSire.id) ??
        loaded.snakes[0];

      const effectiveDepot = getEffectiveHissDepot(cleanEconomy, nextConfig.contentFlags);
      const cleanDur = nextHissEnabled
        ? loaded.clutchDurationSec
        : computePairBreedDurationSec(loadedSire, loadedDam, effectiveDepot);

      setActiveSlotId(slotId);
      setLastActiveSlotId(slotId);
      setGameConfig(nextConfig);
      setMissingModPacks(loaded.missingModPacks ?? []);
      setSnakes(loaded.snakes);
      setDiscoveries(loaded.discoveries);
      setSireId(loadedSire.id);
      setDamId(loadedDam.id);
      setClutchDurationSec(cleanDur);
      setClutchRemainingSec(Math.min(loaded.clutchRemainingSec, cleanDur));
      setClutchReady(loaded.clutchReady);
      setClutchesHatched(loaded.clutchesHatched);
      setSettings(loaded.settings);
      setEconomy(cleanEconomy);
      setPhase('playing');
      refreshSaveSlots();
    },
    [refreshSaveSlots]
  );

  const handleContinueFromTitle = useCallback(() => {
    const target = continueSlot?.slotId ?? getLastActiveSlotId() ?? getMostRecentSaveSlot();
    if (target) {
      handleLoadSlot(target);
    }
  }, [continueSlot, handleLoadSlot]);

  const handleStartNewGame = useCallback(
    (slotId: SaveSlotId, config: GameConfig) => {
      audioEngine.playSoftClick();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const fresh = buildFreshGame(config);
      setTitleSnakes([]);
      setSlotModalMode(null);
      setSelectedSnakeId(null);
      setActiveDrawer(null);
      setActiveClutch(null);
      setPendingSale(null);
      setUiEventState(createUiEventQueueState());
      setDockHighlightTab(null);
      setSpiderBlockedNotice(null);

      setActiveSlotId(slotId);
      setLastActiveSlotId(slotId);
      setGameConfig(fresh.gameConfig);
      setMissingModPacks([]);
      setSnakes(fresh.snakes);
      setDiscoveries(fresh.discoveries);
      setSireId(fresh.sireId);
      setDamId(fresh.damId);
      setClutchDurationSec(fresh.clutchDurationSec);
      setClutchRemainingSec(fresh.clutchRemainingSec);
      setClutchReady(false);
      setClutchesHatched(0);
      setSettings(fresh.settings);
      setEconomy(fresh.economy);
      setNeedsStarterConfirm(true);
      setPhase('playing');
    },
    []
  );

  const handleSaveToSlot = useCallback(
    (slotId: SaveSlotId) => {
      if (snakes.length < 2) return;
      audioEngine.playPetChime();
      saveToSlot(slotId, {
        snakes,
        displayedIds,
        discoveries,
        sireId,
        damId,
        clutchDurationSec,
        clutchRemainingSec,
        clutchReady,
        clutchesHatched,
        settings,
        economy,
        gameConfig,
      });
      setActiveSlotId(slotId);
      setLastActiveSlotId(slotId);
      refreshSaveSlots();
      setSlotModalMode(null);
    },
    [
      snakes,
      displayedIds,
      discoveries,
      sireId,
      damId,
      clutchDurationSec,
      clutchRemainingSec,
      clutchReady,
      clutchesHatched,
      settings,
      economy,
      gameConfig,
      refreshSaveSlots,
    ]
  );

  const handleDeleteSlot = useCallback(
    (slotId: SaveSlotId) => {
      audioEngine.playSoftClick();
      deleteSaveSlot(slotId);
      if (activeSlotId === slotId) {
        setActiveSlotId(null);
      }
      refreshSaveSlots();
    },
    [activeSlotId, refreshSaveSlots]
  );

  const handleReturnToTitle = useCallback(() => {
    audioEngine.playSoftClick();
    // Flush active save cleanly before tearing down state
    if (activeSlotId !== null && !needsStarterConfirm && snakes.length >= 2) {
      saveToSlot(activeSlotId, {
        snakes,
        displayedIds,
        discoveries,
        sireId,
        damId,
        clutchDurationSec,
        clutchRemainingSec,
        clutchReady,
        clutchesHatched,
        settings,
        economy,
        gameConfig,
      });
    }

    // Complete teardown of active save state & modifiers, then spawn fresh random title snakes
    setActiveSlotId(null);
    setSnakes([]);
    setDiscoveries({});
    setSireId('');
    setDamId('');
    setClutchDurationSec(120);
    setClutchRemainingSec(120);
    setClutchReady(false);
    setClutchesHatched(0);
    setEconomy(createDefaultEconomyState());
    setGameConfig({ ...DEFAULT_GAME_CONFIG });
    setSelectedSnakeId(null);
    setActiveDrawer(null);
    setActiveClutch(null);
    setPendingSale(null);
    setSlotModalMode(null);
    setNeedsStarterConfirm(false);
    setUiEventState(createUiEventQueueState());
    setDockHighlightTab(null);
    const updatedSlots = listSaveSlots();
    setSaveSlots(updatedSlots);
    const nextContinue = resolveContinueSlotSummary(updatedSlots);
    const nextTitleFlags = getTitleShowcaseContentFlags(nextContinue);
    const nextTitlePacks = getTitleShowcaseModPacks(nextContinue);
    lastTitleShowcaseSigRef.current = `${nextTitleFlags}|${(nextTitlePacks ?? []).join(',')}|${getInstalledModPacks().length}`;
    setMissingModPacks([]);
    setTitleSnakes(createTitleShowcaseSnakes(5, Math.random, nextTitleFlags, nextTitlePacks));
    setPhase('title');
  }, [
    activeSlotId,
    needsStarterConfirm,
    snakes,
    displayedIds,
    discoveries,
    sireId,
    damId,
    clutchDurationSec,
    clutchRemainingSec,
    clutchReady,
    clutchesHatched,
    settings,
    economy,
    gameConfig,
    refreshSaveSlots,
  ]);

  const handleRerollStarters = useCallback(() => {
    audioEngine.playSoftClick();
    const fresh = buildFreshGame(gameConfig);
    setSnakes(fresh.snakes);
    setDiscoveries(fresh.discoveries);
    setSireId(fresh.sireId);
    setDamId(fresh.damId);
    setClutchDurationSec(fresh.clutchDurationSec);
    setClutchRemainingSec(fresh.clutchRemainingSec);
    setClutchReady(false);
    setEconomy(fresh.economy);
  }, [gameConfig]);

  const handleConfirmStarters = useCallback(() => {
    audioEngine.playSoftClick();
    setNeedsStarterConfirm(false);
    if (activeSlotId !== null && snakes.length >= 2) {
      saveToSlot(activeSlotId, {
        snakes,
        displayedIds,
        discoveries,
        sireId,
        damId,
        clutchDurationSec,
        clutchRemainingSec,
        clutchReady,
        clutchesHatched,
        settings,
        economy,
        gameConfig,
      });
      refreshSaveSlots();
    }
  }, [
    activeSlotId,
    snakes,
    displayedIds,
    discoveries,
    sireId,
    damId,
    clutchDurationSec,
    clutchRemainingSec,
    clutchReady,
    clutchesHatched,
    settings,
    economy,
    gameConfig,
    refreshSaveSlots,
  ]);

  const handleToggleMute = useCallback(() => {
    setSettings((prev) => ({ ...prev, muted: !prev.muted }));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (isTyping) return;

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (slotModalMode && e.key === 'Escape') {
          e.preventDefault();
          setSlotModalMode(null);
          return;
        }
        if (phase === 'title') return;
        if (pendingSale && e.key === 'Escape') {
          e.preventDefault();
          setPendingSale(null);
          return;
        }
        if (activeClutch || needsStarterConfirm) return;
        e.preventDefault();
        if (activeDrawer) {
          setActiveDrawer(null);
          return;
        }
        if (selectedSnakeId && e.key === 'Escape') {
          setSelectedSnakeId(null);
          return;
        }
        refreshSaveSlots();
        setPhase((curr) => (curr === 'playing' ? 'paused' : curr === 'paused' ? 'playing' : curr));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    slotModalMode,
    activeClutch,
    activeDrawer,
    selectedSnakeId,
    pendingSale,
    needsStarterConfirm,
    handleToggleMute,
    refreshSaveSlots,
  ]);

  const displayedCount = displayedIds.length;

  const discoveredKeys = useMemo(
    () => new Set(Object.keys(discoveries)),
    [discoveries]
  );

  const soldMorphKeysSet = useMemo(
    () => new Set(economy.soldMorphKeys),
    [economy.soldMorphKeys]
  );

  const selectedSnake = useMemo(
    () => snakes.find((s) => s.id === selectedSnakeId) ?? null,
    [snakes, selectedSnakeId]
  );

  const handleSelectSnake = useCallback((snakeId: string | null, wasPetted: boolean) => {
    setSelectedSnakeId(snakeId);
    if (snakeId && wasPetted) {
      audioEngine.playPetChime();
      setSnakes((prev) =>
        prev.map((s) => (s.id === snakeId ? { ...s, petCount: s.petCount + 1 } : s))
      );
    }
  }, []);

  const handleRenameSnake = useCallback((snakeId: string, newName: string) => {
    setSnakes((prev) =>
      prev.map((s) => (s.id === snakeId ? { ...s, name: newName } : s))
    );
  }, []);

  const handleToggleDisplay = useCallback(
    (snakeId: string) => {
      audioEngine.playSoftClick();
      setSnakes((prev) => {
        const currentDisplayed = prev.filter((s) => s.onDisplay).length;
        return prev.map((s) => {
          if (s.id !== snakeId) return s;
          if (s.onDisplay && currentDisplayed <= 1) return s;
          if (!s.onDisplay && currentDisplayed >= maxDisplay) return s;
          return { ...s, onDisplay: !s.onDisplay };
        });
      });
    },
    [maxDisplay]
  );

  const handleAssignParent = useCallback(
    (role: 'sire' | 'dam', snakeId: string) => {
      if (!sire || !dam) return;
      audioEngine.playSoftClick();
      let nextSireId = sire.id;
      let nextDamId = dam.id;
      if (role === 'sire') {
        if (snakeId === dam.id) nextDamId = sire.id;
        nextSireId = snakeId;
      } else {
        if (snakeId === sire.id) nextSireId = dam.id;
        nextDamId = snakeId;
      }

      let nextSire = snakes.find((s) => s.id === nextSireId) ?? sire;
      let nextDam = snakes.find((s) => s.id === nextDamId) ?? dam;

      // Ethical Breeding Guard: disallow homozygous lethal Spider × Spider pairings & auto-pick safe mate
      if (isLethalSpiderPairing(nextSire, nextDam)) {
        const chosen = role === 'sire' ? nextSire : nextDam;
        const other = role === 'sire' ? nextDam : nextSire;
        const safeMate = pickSafeMateFor(chosen, snakes);
        if (safeMate) {
          if (role === 'sire') {
            nextSire = chosen;
            nextDam = safeMate;
          } else {
            nextDam = chosen;
            nextSire = safeMate;
          }
          nextSireId = nextSire.id;
          nextDamId = nextDam.id;
        } else {
          // No non-Spider mate available: keep existing safe pair
          nextSire = sire;
          nextDam = dam;
          nextSireId = sire.id;
          nextDamId = dam.id;
        }
        setSpiderBlockedNotice({
          attemptedA: chosen.name,
          attemptedB: other.name,
          replacementName: safeMate ? safeMate.name : null,
        });
      }

      setSireId(nextSireId);
      setDamId(nextDamId);

      if (!clutchReady) {
        const nextDur = computePairBreedDurationSec(nextSire, nextDam, effectiveHissDepot);
        setClutchDurationSec(nextDur);
        setClutchRemainingSec((prev) => Math.min(prev, nextDur));
      }
    },
    [sire, dam, snakes, clutchReady, effectiveHissDepot]
  );

  const handleWarmIncubator = useCallback(() => {
    if (!DEV_TOOLS_ENABLED || !pairCanBreedNow || clutchReady || !sire || !dam) return;
    audioEngine.playSoftClick();
    setClutchRemainingSec((prev) => {
      const next = Math.max(0, prev - 5);
      if (next <= 0 && prev > 0) {
        setClutchReady(true);
        setSnakes((currSnakes) =>
          currSnakes.map((s) =>
            s.id === sire.id || s.id === dam.id
              ? { ...s, currentVigor: Math.max(0, s.currentVigor - BREED_VIGOR_COST) }
              : s
          )
        );
      }
      return next;
    });
  }, [pairCanBreedNow, clutchReady, sire, dam]);

  const handleOpenHatch = useCallback(() => {
    if (!sire || !dam) return;
    audioEngine.playSoftClick();
    const existingNames = new Set(snakes.map((s) => s.name));
    const eggs = breedClutch(
      sire,
      dam,
      discoveredKeys,
      existingNames,
      activeClutchConfig.clutchSize,
      Math.random,
      hissDepotEnabled ? effectiveHissDepot.biasWeights : undefined,
      gameConfig.contentFlags,
      gameConfig.enabledModPacks
    );
    setActiveDrawer(null);
    setSelectedSnakeId(null);
    setActiveClutch(eggs);
  }, [
    snakes,
    sire,
    dam,
    discoveredKeys,
    activeClutchConfig.clutchSize,
    hissDepotEnabled,
    effectiveHissDepot.biasWeights,
    gameConfig.contentFlags,
    gameConfig.enabledModPacks,
  ]);

  const handleRevealEgg = useCallback((eggId: string) => {
    setActiveClutch((prev) => {
      if (!prev) return prev;
      const target = prev.find((e) => e.id === eggId);
      if (target && !target.revealed) {
        audioEngine.playEggCrack(
          target.isNewMorph,
          target.snake.phenotype.rarity === 'rare' ||
            target.snake.phenotype.rarity === 'legendary'
        );
      }
      return prev.map((e) => (e.id === eggId ? { ...e, revealed: true } : e));
    });
  }, []);

  const handleRevealAllEggs = useCallback(() => {
    setActiveClutch((prev) => {
      if (!prev) return prev;
      const anyNew = prev.some((e) => !e.revealed && e.isNewMorph);
      audioEngine.playEggCrack(anyNew, anyNew);
      return prev.map((e) => ({ ...e, revealed: true }));
    });
  }, []);

  const handleRenameEggSnake = useCallback((eggId: string, name: string) => {
    setActiveClutch((prev) =>
      prev
        ? prev.map((e) =>
            e.id === eggId ? { ...e, snake: { ...e.snake, name } } : e
          )
        : prev
    );
  }, []);

  const handleToggleEggDisplay = useCallback(
    (eggId: string) => {
      audioEngine.playSoftClick();
      setActiveClutch((prev) => {
        if (!prev) return prev;
        const extraSelected = prev.filter((e) => !e.sold && e.snake.onDisplay).length;
        return prev.map((e) => {
          if (e.id !== eggId || e.sold) return e;
          if (!e.snake.onDisplay && displayedCount + extraSelected >= maxDisplay) {
            return e;
          }
          return {
            ...e,
            snake: { ...e.snake, onDisplay: !e.snake.onDisplay },
          };
        });
      });
    },
    [displayedCount, maxDisplay]
  );

  const archiveSnakeDiscovery = useCallback(
    (prev: Record<string, MorphDiscovery>, snake: SnakeEntity): Record<string, MorphDiscovery> => {
      const key = snake.phenotype.morphKey;
      if (prev[key]) {
        return {
          ...prev,
          [key]: {
            ...prev[key],
            countHatched: prev[key].countHatched + 1,
          },
        };
      }
      return {
        ...prev,
        [key]: {
          morphKey: key,
          morphName: snake.phenotype.morphName,
          rarity: snake.phenotype.rarity,
          firstDiscoveredAt: snake.hatchedAt,
          countHatched: 1,
          sampleSnakeId: snake.id,
          samplePatternFormula: snake.phenotype.patternRule.formula,
          samplePalette: snake.phenotype.palette,
          samplePatternRule: snake.phenotype.patternRule,
          sampleIsUpsideDown: snake.phenotype.isUpsideDown,
          parentLineageSummary:
            snake.sire && snake.dam
              ? `${snake.sire.morphName} × ${snake.dam.morphName}`
              : snake.hatchOddsLabel === 'Jean Pool'
                ? 'The Jean Pool'
                : 'Founder Lineage',
          tags: snake.phenotype.tags,
        },
      };
    },
    []
  );

  const handleConfirmSale = useCallback(() => {
    if (!pendingSale) return;
    audioEngine.playPetChime();

    const targetSnake =
      pendingSale.kind === 'collection' ? pendingSale.snake : pendingSale.egg.snake;
    const valuation = evaluateSnakeSaleValue(targetSnake, soldMorphKeysSet);

    if (pendingSale.kind === 'collection') {
      if (snakes.length <= 2) {
        setPendingSale(null);
        return;
      }
      const remainingSnakes = snakes.filter((s) => s.id !== targetSnake.id);
      if (!remainingSnakes.some((s) => s.onDisplay) && remainingSnakes.length > 0) {
        remainingSnakes[0] = { ...remainingSnakes[0], onDisplay: true };
      }
      setSnakes(remainingSnakes);

      if (targetSnake.id === sireId && remainingSnakes.length >= 2) {
        const anchorDam = remainingSnakes.find((s) => s.id === damId) ?? remainingSnakes[0];
        const replacement =
          pickSafeMateFor(anchorDam, remainingSnakes) ??
          remainingSnakes.find((s) => s.id !== damId) ??
          remainingSnakes[0];
        setSireId(replacement.id);
      } else if (targetSnake.id === damId && remainingSnakes.length >= 2) {
        const anchorSire = remainingSnakes.find((s) => s.id === sireId) ?? remainingSnakes[0];
        const replacement =
          pickSafeMateFor(anchorSire, remainingSnakes) ??
          remainingSnakes.find((s) => s.id !== sireId) ??
          remainingSnakes[0];
        setDamId(replacement.id);
      }
      if (selectedSnakeId === targetSnake.id) {
        setSelectedSnakeId(null);
      }
    } else {
      const eggId = pendingSale.egg.id;
      setActiveClutch((prev) =>
        prev
          ? prev.map((e) =>
              e.id === eggId
                ? { ...e, sold: true, snake: { ...e.snake, onDisplay: false } }
                : e
            )
          : prev
      );
      setDiscoveries((prev) => archiveSnakeDiscovery(prev, targetSnake));
    }

    setEconomy((prev) => ({
      ...prev,
      money: safeAddCurrency(prev.money, valuation.total),
      totalSnakesSold: prev.totalSnakesSold + 1,
      sellUnlocked: true,
      soldMorphKeys: prev.soldMorphKeys.includes(targetSnake.phenotype.morphKey)
        ? prev.soldMorphKeys
        : [...prev.soldMorphKeys, targetSnake.phenotype.morphKey],
    }));

    setPendingSale(null);
  }, [
    pendingSale,
    soldMorphKeysSet,
    snakes,
    sireId,
    damId,
    selectedSnakeId,
    archiveSnakeDiscovery,
  ]);

  const handleCompleteClutch = useCallback(
    (nextSireId: string, nextDamId: string) => {
      if (!activeClutch) return;
      audioEngine.playSoftClick();

      const keptHatchlings = activeClutch
        .filter((e) => !e.sold)
        .map((e) => ({
          ...e.snake,
          name: e.snake.name.trim() || 'Noodle',
        }));

      const nextSnakesList = [...keptHatchlings, ...snakes];
      setSnakes(nextSnakesList);

      setDiscoveries((prev) => {
        let next = prev;
        for (const snake of keptHatchlings) {
          next = archiveSnakeDiscovery(next, snake);
        }
        return next;
      });

      let resolvedSire =
        nextSnakesList.find((s) => s.id === nextSireId) ?? nextSnakesList[0];
      let resolvedDam =
        nextSnakesList.find((s) => s.id === nextDamId && s.id !== resolvedSire.id) ??
        nextSnakesList.find((s) => s.id !== resolvedSire.id) ??
        nextSnakesList[0];

      if (isLethalSpiderPairing(resolvedSire, resolvedDam)) {
        const safeMate = pickSafeMateFor(resolvedSire, nextSnakesList);
        setSpiderBlockedNotice({
          attemptedA: resolvedSire.name,
          attemptedB: resolvedDam.name,
          replacementName: safeMate ? safeMate.name : null,
        });
        if (safeMate) {
          resolvedDam = safeMate;
        }
      }

      const nextDur = computePairBreedDurationSec(resolvedSire, resolvedDam, effectiveHissDepot);
      setSireId(resolvedSire.id);
      setDamId(resolvedDam.id);
      setClutchesHatched((c) => c + 1);
      setClutchDurationSec(nextDur);
      setClutchRemainingSec(nextDur);
      setClutchReady(false);
      setActiveClutch(null);
    },
    [activeClutch, snakes, effectiveHissDepot, archiveSnakeDiscovery]
  );

  // --- The Jean Pool Purchase ---
  const handleBuyJeanPoolOffer = useCallback(
    (offer: JeanPoolOffer) => {
      if (!jeanPoolEnabled) return;
      if (economy.jeanPool.cooldownRemainingSec > 0) return;
      const spend = safeSpendCurrency(economy.money, offer.price);
      if (!spend.ok) return;

      audioEngine.playEggCrack(true, true);
      const canShow = displayedCount < maxDisplay;
      const adoptedSnake: SnakeEntity = {
        ...offer.snake,
        id: `jean_${Date.now()}_${offer.locusId}`,
        hatchedAt: Date.now(),
        onDisplay: canShow,
      };

      setSnakes((prev) => [adoptedSnake, ...prev]);
      setDiscoveries((prev) => archiveSnakeDiscovery(prev, adoptedSnake));
      setEconomy((prev) => ({
        ...prev,
        money: spend.nextBalance,
        jeanPool: {
          purchasesCount: prev.jeanPool.purchasesCount + 1,
          cooldownRemainingSec: JEAN_POOL_COOLDOWN_SEC,
          stockSeed: prev.jeanPool.stockSeed + 137,
        },
      }));
    },
    [jeanPoolEnabled, economy, displayedCount, maxDisplay, archiveSnakeDiscovery]
  );

  // --- Developer Debug Spawn from Gene Simulator (Dev builds only) ---
  const handleDebugAddSnake = useCallback(
    (simulatedSnake: SnakeEntity) => {
      if (!DEV_TOOLS_ENABLED) return;
      audioEngine.playPetChime();
      const canShow = displayedCount < maxDisplay;
      const spawned: SnakeEntity = {
        ...simulatedSnake,
        onDisplay: canShow,
      };
      setSnakes((prev) => [spawned, ...prev]);
      setDiscoveries((prev) => archiveSnakeDiscovery(prev, spawned));
    },
    [displayedCount, maxDisplay, archiveSnakeDiscovery]
  );

  // --- The Hiss Depot Upgrades & Tuning (all guarded by hissDepotEnabled) ---
  const handleBuyIncubatorUpgrade = useCallback(() => {
    if (!hissDepotEnabled) return;
    const curLvl = economy.hissDepot.incubatorMaxLevel;
    if (curLvl >= MAX_INCUBATOR_UPGRADES) return;
    const price = getIncubatorUpgradePrice(curLvl);
    const spend = safeSpendCurrency(economy.money, price);
    if (!spend.ok) return;

    audioEngine.playPetChime();
    const nextMax = curLvl + 1;
    setEconomy((prev) => ({
      ...prev,
      money: spend.nextBalance,
      hissDepot: {
        ...prev.hissDepot,
        incubatorMaxLevel: nextMax,
        incubatorActiveLevel: nextMax,
      },
    }));
  }, [hissDepotEnabled, economy]);

  const handleSetIncubatorActive = useCallback(
    (level: number) => {
      if (!hissDepotEnabled || !sire || !dam) return;
      audioEngine.playSoftClick();
      setEconomy((prev) => {
        const clamped = Math.max(0, Math.min(prev.hissDepot.incubatorMaxLevel, Math.floor(level)));
        const nextDepot = { ...prev.hissDepot, incubatorActiveLevel: clamped };
        if (!clutchReady) {
          const nextDur = computePairBreedDurationSec(sire, dam, nextDepot);
          setClutchDurationSec(nextDur);
          setClutchRemainingSec((rem) => Math.min(rem, nextDur));
        }
        return { ...prev, hissDepot: nextDepot };
      });
    },
    [hissDepotEnabled, clutchReady, sire, dam]
  );

  const handleBuyDisplaySlot = useCallback(() => {
    if (!hissDepotEnabled) return;
    const bought = economy.hissDepot.displaySlotsBought;
    if (bought >= MAX_DISPLAY_UPGRADES) return;
    const price = getDisplaySlotUpgradePrice(bought);
    const spend = safeSpendCurrency(economy.money, price);
    if (!spend.ok) return;

    audioEngine.playPetChime();
    setEconomy((prev) => ({
      ...prev,
      money: spend.nextBalance,
      hissDepot: {
        ...prev.hissDepot,
        displaySlotsBought: prev.hissDepot.displaySlotsBought + 1,
      },
    }));
  }, [hissDepotEnabled, economy]);

  const handleBuyBiasCap = useCallback(
    (mode: InheritanceMode) => {
      if (!hissDepotEnabled) return;
      const bought = economy.hissDepot.biasCapsBought[mode];
      if (bought >= MAX_BIAS_CAP_UPGRADES) return;
      const price = getBiasCapUpgradePrice(bought);
      const spend = safeSpendCurrency(economy.money, price);
      if (!spend.ok) return;

      audioEngine.playPetChime();
      setEconomy((prev) => ({
        ...prev,
        money: spend.nextBalance,
        hissDepot: {
          ...prev.hissDepot,
          biasCapsBought: {
            ...prev.hissDepot.biasCapsBought,
            [mode]: prev.hissDepot.biasCapsBought[mode] + 1,
          },
        },
      }));
    },
    [hissDepotEnabled, economy]
  );

  const handleAdjustBiasWeight = useCallback(
    (mode: InheritanceMode, value: number) => {
      if (!hissDepotEnabled) return;
      setEconomy((prev) => ({
        ...prev,
        hissDepot: {
          ...prev.hissDepot,
          biasWeights: adjustGeneBiasWeights(
            prev.hissDepot.biasWeights,
            prev.hissDepot.biasCapsBought,
            mode,
            value
          ),
        },
      }));
    },
    [hissDepotEnabled]
  );

  const handleResetBiasWeights = useCallback(() => {
    if (!hissDepotEnabled) return;
    audioEngine.playSoftClick();
    const def = createDefaultHissDepotState().biasWeights;
    setEconomy((prev) => ({
      ...prev,
      hissDepot: {
        ...prev.hissDepot,
        biasWeights: def,
      },
    }));
  }, [hissDepotEnabled]);

  const handleMist = useCallback(() => {
    audioEngine.playMistSpritz();
    setMistTriggerCount((c) => c + 1);
  }, []);

  const handleToggleHeatLamp = useCallback(() => {
    audioEngine.playSoftClick();
    setSettings((prev) => ({ ...prev, heatLampOn: !prev.heatLampOn }));
  }, []);

  const handleResetTerrarium = useCallback(() => {
    if (activeSlotId !== null) {
      deleteSaveSlot(activeSlotId);
    }
    const fresh = buildFreshGame(gameConfig);
    setSnakes(fresh.snakes);
    setDiscoveries(fresh.discoveries);
    setSireId(fresh.sireId);
    setDamId(fresh.damId);
    setClutchDurationSec(fresh.clutchDurationSec);
    setClutchRemainingSec(fresh.clutchRemainingSec);
    setClutchReady(false);
    setClutchesHatched(0);
    setSettings(fresh.settings);
    setEconomy(fresh.economy);
    setSelectedSnakeId(null);
    setActiveDrawer(null);
    setActiveClutch(null);
    setPendingSale(null);
    setUiEventState(createUiEventQueueState());
    setDockHighlightTab(null);
    setNeedsStarterConfirm(true);
    refreshSaveSlots();
    setPhase('playing');
  }, [activeSlotId, gameConfig, refreshSaveSlots]);

  const discoveredCount = Object.keys(discoveries).length;

  // Permanently unlock Sell buttons once the first extra (triplicate, 3+) of any morph is born/revealed
  useEffect(() => {
    if (phase === 'title' || economy.sellUnlocked) return;
    const revealedClutchSnakes = (activeClutch ?? [])
      .filter((e) => e.revealed && !e.sold)
      .map((e) => e.snake);
    if (hasTriplicateMorph([...snakes, ...revealedClutchSnakes])) {
      setEconomy((prev) => (prev.sellUnlocked ? prev : { ...prev, sellUnlocked: true }));
    }
  }, [phase, economy.sellUnlocked, snakes, activeClutch]);

  const jeanPoolUnlocked = isJeanPoolUnlocked(economy, gameConfig.contentFlags);
  const hissDepotUnlocked = isHissDepotUnlocked(economy, gameConfig.contentFlags);
  const showCurrency = economy.sellUnlocked || economy.money > 0 || economy.totalSnakesSold > 0;

  // First-sale spotlight runs on first safe third-of-a-kind hatchling regardless of any other feature flag
  const showSellTutorial = economy.totalSnakesSold === 0;

  // Enqueue Jean Pool intro after first sale (ONLY if Jean Pool is enabled AND has missing genes to offer)
  useEffect(() => {
    if (phase !== 'playing' || needsStarterConfirm || !jeanPoolEnabled) return;
    if (!jeanPoolUnlocked || economy.jeanPoolIntroSeen) return;

    const missing = getMissingLoci(snakes, gameConfig.contentFlags, gameConfig.enabledModPacks);
    if (missing.length === 0) {
      // Player somehow already owns every possible gene before first sale — skip empty Jean Pool flow
      setEconomy((prev) => (prev.jeanPoolIntroSeen ? prev : { ...prev, jeanPoolIntroSeen: true }));
      return;
    }
    setUiEventState((prev) => enqueueUiEvent(prev, 'jean_pool_intro'));
  }, [
    phase,
    needsStarterConfirm,
    jeanPoolEnabled,
    jeanPoolUnlocked,
    economy.jeanPoolIntroSeen,
    snakes,
    gameConfig.contentFlags,
  ]);

  // Enqueue Hiss Depot intro after 3rd sale (counts clutch & collection sales; waits for current UI to close)
  useEffect(() => {
    if (phase !== 'playing' || needsStarterConfirm || !hissDepotEnabled) return;
    if (economy.totalSnakesSold < 3 || economy.hissDepotIntroSeen) return;
    setUiEventState((prev) => enqueueUiEvent(prev, 'hiss_depot_intro'));
  }, [
    phase,
    needsStarterConfirm,
    hissDepotEnabled,
    economy.totalSnakesSold,
    economy.hissDepotIntroSeen,
  ]);

  // Advance UI event queue strictly one event at a time once all blocking UI menus have closed
  const isUiBusy =
    phase !== 'playing' ||
    needsStarterConfirm ||
    Boolean(activeClutch) ||
    Boolean(pendingSale) ||
    Boolean(slotModalMode) ||
    Boolean(activeDrawer);

  useEffect(() => {
    if (isUiBusy || uiEventState.active !== null || uiEventState.queue.length === 0) return;
    setUiEventState((prev) => advanceUiEventQueue(prev, false));
  }, [isUiBusy, uiEventState.active, uiEventState.queue.length]);

  // When a queued intro event activates, automatically open its shop UI behind the intro modal & highlight dock button
  useEffect(() => {
    const kind = uiEventState.active?.kind;
    if (!kind) return;
    setSelectedSnakeId(null);
    if (kind === 'jean_pool_intro') {
      setActiveDrawer('jeanpool');
      setDockHighlightTab('jeanpool');
    } else if (kind === 'hiss_depot_intro') {
      setActiveDrawer('hissdepot');
      setDockHighlightTab('hissdepot');
    }
  }, [uiEventState.active]);

  const handleAcknowledgeJeanPoolIntro = useCallback(() => {
    audioEngine.playSoftClick();
    setEconomy((prev) => ({ ...prev, jeanPoolIntroSeen: true }));
    setUiEventState((prev) => completeActiveUiEvent(prev));
  }, []);

  const handleAcknowledgeHissDepotIntro = useCallback(() => {
    audioEngine.playSoftClick();
    setEconomy((prev) => ({ ...prev, hissDepotIntroSeen: true }));
    setUiEventState((prev) => completeActiveUiEvent(prev));
  }, []);

  const pendingSaleMeta = useMemo(() => {
    if (!pendingSale || !sire || !dam) return null;
    if (pendingSale.kind === 'collection') {
      return {
        snake: pendingSale.snake,
        valuation: evaluateSnakeSaleValue(pendingSale.snake, soldMorphKeysSet),
        warnings: analyzeSaleWarnings(pendingSale.snake, snakes, sire.id, dam.id, false),
      };
    }
    const otherUnsold = (activeClutch ?? [])
      .filter((e) => !e.sold && e.id !== pendingSale.egg.id)
      .map((e) => e.snake);
    return {
      snake: pendingSale.egg.snake,
      valuation: evaluateSnakeSaleValue(pendingSale.egg.snake, soldMorphKeysSet),
      warnings: analyzeSaleWarnings(
        pendingSale.egg.snake,
        [...snakes, ...otherUnsold],
        sire.id,
        dam.id,
        true
      ),
    };
  }, [pendingSale, soldMorphKeysSet, snakes, activeClutch, sire, dam]);

  const canvasSnakes = phase === 'title' ? titleSnakes : snakes;

  return (
    <main className="relative w-full h-full overflow-hidden">
      {/* Full-bleed live procedural Terrarium Canvas */}
      <TerrariumCanvas
        snakes={canvasSnakes}
        selectedSnakeId={phase === 'title' ? null : selectedSnakeId}
        phase={phase}
        heatLampOn={phase === 'title' ? true : settings.heatLampOn}
        isOccluded={Boolean(
          activeClutch ||
            activeDrawer ||
            needsStarterConfirm ||
            pendingSale ||
            slotModalMode ||
            modPacksModalOpen
        )}
        mistTriggerCount={mistTriggerCount}
        onSelectSnake={handleSelectSnake}
        onTapSubstrate={() => audioEngine.playSoftClick()}
      />

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <TitleOverlay
          hasSaves={hasSaves}
          continueSlot={continueSlot}
          installedPackCount={installedPackCount}
          onContinue={handleContinueFromTitle}
          onNewGame={() => {
            audioEngine.playSoftClick();
            refreshSaveSlots();
            setSlotModalMode('new');
          }}
          onLoadGame={() => {
            audioEngine.playSoftClick();
            refreshSaveSlots();
            setSlotModalMode('load');
          }}
          onOpenModPacks={() => {
            audioEngine.playSoftClick();
            setModPacksModalOpen(true);
          }}
        />
      )}

      {/* Missing Workshop / Gene Pack Non-Destructive Warning Banner */}
      {phase === 'playing' && missingModPacks.length > 0 && (
        <div
          role="status"
          data-testid="missing-mod-packs-banner"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[calc(100%-2rem)] rounded-xl bg-[#2B2016]/95 border border-[#D9A754]/55 shadow-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#F5E6C8]"
        >
          <span className="min-w-0">
            <strong className="text-[#F1CD82]">Missing Gene Pack(s):</strong>{' '}
            {missingModPacks.join(', ')}. Affected snakes render as wild-type until reinstalled; raw
            genetics are safely preserved.
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setModPacksModalOpen(true)}
              className="px-2.5 py-1 rounded-md bg-[#56B8B0] hover:bg-[#6CCAC2] text-[#102022] font-semibold cursor-pointer"
            >
              Gene Packs
            </button>
            <button
              type="button"
              onClick={() => setMissingModPacks([])}
              className="px-2 py-1 rounded-md bg-[#3A2E22] hover:bg-[#493A2B] text-[#E6DAC8] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* First-Time 2-Starter Random Pair Onboarding Modal */}
      {phase === 'playing' && needsStarterConfirm && snakes.length >= 2 && (
        <StarterPairModal
          pair={snakes.slice(0, 2)}
          onConfirm={handleConfirmStarters}
          onReroll={handleRerollStarters}
        />
      )}

      {/* Playing HUD */}
      {phase !== 'title' && !needsStarterConfirm && sire && dam && (
        <>
          <TopIncubatorHud
            sire={sire}
            dam={dam}
            remainingSec={clutchRemainingSec}
            durationSec={clutchDurationSec}
            clutchSize={activeClutchConfig.clutchSize}
            clutchReady={clutchReady}
            discoveredCount={discoveredCount}
            money={economy.money}
            showCurrency={showCurrency}
            muted={settings.muted}
            onHatchReady={handleOpenHatch}
            onWarmIncubator={handleWarmIncubator}
            onOpenBreeding={() => setActiveDrawer('breeding')}
            onToggleMute={handleToggleMute}
            onPause={() => {
              refreshSaveSlots();
              setPhase('paused');
            }}
          />

          {selectedSnake && !activeDrawer && !activeClutch && (
            <SnakeInspectorCard
              snake={selectedSnake}
              isSire={selectedSnake.id === sire.id}
              isDam={selectedSnake.id === dam.id}
              canHideFromDisplay={displayedCount > 1}
              onClose={() => setSelectedSnakeId(null)}
              onRename={handleRenameSnake}
              onToggleDisplay={handleToggleDisplay}
              onAssignParent={handleAssignParent}
            />
          )}

          <TerrariumDock
            totalSnakes={snakes.length}
            displayedCount={displayedCount}
            maxDisplay={maxDisplay}
            discoveredCount={discoveredCount}
            heatLampOn={settings.heatLampOn}
            jeanPoolUnlocked={jeanPoolUnlocked}
            hissDepotUnlocked={hissDepotUnlocked}
            jeanPoolCooldownSec={economy.jeanPool.cooldownRemainingSec}
            activeTab={activeDrawer}
            highlightTab={dockHighlightTab}
            onOpenDrawer={(tab) => {
              audioEngine.playSoftClick();
              setSelectedSnakeId(null);
              if (dockHighlightTab === tab) {
                setDockHighlightTab(null);
              }
              setActiveDrawer((curr) => (curr === tab ? null : tab));
            }}
            onMist={handleMist}
            onToggleHeatLamp={handleToggleHeatLamp}
          />
        </>
      )}

      {/* Field Guide & Shops Drawer */}
      {phase === 'playing' && !needsStarterConfirm && activeDrawer && !activeClutch && sire && dam && (
        <GalleryDrawer
          activeTab={activeDrawer}
          snakes={snakes}
          discoveries={discoveries}
          sireId={sire.id}
          damId={dam.id}
          maxDisplay={maxDisplay}
          clutchesHatched={clutchesHatched}
          economy={economy}
          contentFlags={gameConfig.contentFlags}
          enabledModPacks={gameConfig.enabledModPacks}
          onChangeTab={(tab) => {
            audioEngine.playSoftClick();
            setActiveDrawer(tab);
          }}
          onClose={() => setActiveDrawer(null)}
          onToggleDisplay={handleToggleDisplay}
          onRenameSnake={handleRenameSnake}
          onAssignParent={handleAssignParent}
          onRequestSellSnake={(snake) => setPendingSale({ kind: 'collection', snake })}
          onBuyJeanPoolOffer={handleBuyJeanPoolOffer}
          onBuyIncubatorUpgrade={handleBuyIncubatorUpgrade}
          onSetIncubatorActive={handleSetIncubatorActive}
          onBuyDisplaySlot={handleBuyDisplaySlot}
          onBuyBiasCap={handleBuyBiasCap}
          onAdjustBiasWeight={handleAdjustBiasWeight}
          onResetBiasWeights={handleResetBiasWeights}
          onDebugAddSnake={handleDebugAddSnake}
          onOpenModPacks={() => setModPacksModalOpen(true)}
        />
      )}

      {/* Clutch Hatch Reveal Modal */}
      {phase === 'playing' && !needsStarterConfirm && activeClutch && sire && dam && (
        <HatchRevealModal
          eggs={activeClutch}
          sire={sire}
          dam={dam}
          allSnakes={snakes}
          discoveredKeys={discoveredKeys}
          soldMorphKeys={soldMorphKeysSet}
          contentFlags={gameConfig.contentFlags}
          biasWeights={effectiveHissDepot.biasWeights}
          displayedCount={displayedCount}
          maxDisplay={maxDisplay}
          sellUnlocked={economy.sellUnlocked}
          showSellTutorial={showSellTutorial}
          onRevealEgg={handleRevealEgg}
          onRevealAll={handleRevealAllEggs}
          onRenameEggSnake={handleRenameEggSnake}
          onToggleEggDisplay={handleToggleEggDisplay}
          onRequestSellEgg={(egg) => setPendingSale({ kind: 'hatchling', egg })}
          onSpiderPairingBlocked={(attemptedA, attemptedB, replacementName) =>
            setSpiderBlockedNotice({ attemptedA, attemptedB, replacementName })
          }
          onCompleteClutch={handleCompleteClutch}
        />
      )}

      {/* Sell Confirmation Modal with Big Last-Two Warning */}
      {pendingSaleMeta && (
        <SellConfirmModal
          snake={pendingSaleMeta.snake}
          valuation={pendingSaleMeta.valuation}
          warnings={pendingSaleMeta.warnings}
          onCancel={() => setPendingSale(null)}
          onConfirm={handleConfirmSale}
        />
      )}

      {/* Queued Shop Intro Dialogues (shown on top of their opened shop UI, one at a time) */}
      {uiEventState.active?.kind === 'jean_pool_intro' && (
        <JeanPoolIntroModal
          money={economy.money}
          onAcknowledge={handleAcknowledgeJeanPoolIntro}
        />
      )}
      {uiEventState.active?.kind === 'hiss_depot_intro' && (
        <HissDepotIntroModal
          money={economy.money}
          onAcknowledge={handleAcknowledgeHissDepotIntro}
        />
      )}

      {/* Super Spider Ethical Breeding Guard Modal */}
      {spiderBlockedNotice && (
        <SpiderLethalModal
          attemptedA={spiderBlockedNotice.attemptedA}
          attemptedB={spiderBlockedNotice.attemptedB}
          replacementName={spiderBlockedNotice.replacementName}
          onClose={() => setSpiderBlockedNotice(null)}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <PauseModal
          activeSlotId={activeSlotId}
          gameConfig={gameConfig}
          hasSaves={hasSaves}
          snakeCount={snakes.length}
          discoveredCount={discoveredCount}
          clutchesHatched={clutchesHatched}
          onResume={() => setPhase('playing')}
          onOpenSaveModal={() => {
            audioEngine.playSoftClick();
            refreshSaveSlots();
            setSlotModalMode('save');
          }}
          onOpenLoadModal={() => {
            audioEngine.playSoftClick();
            refreshSaveSlots();
            setSlotModalMode('load');
          }}
          onReturnTitle={handleReturnToTitle}
          onResetTerrarium={handleResetTerrarium}
        />
      )}

      {/* 3-Slot Save / Load / New Game Picker Modal */}
      {slotModalMode && (
        <SaveSlotModal
          mode={slotModalMode}
          slots={saveSlots}
          activeSlotId={activeSlotId}
          onClose={() => setSlotModalMode(null)}
          onStartNewGame={handleStartNewGame}
          onLoadSlot={handleLoadSlot}
          onSaveToSlot={handleSaveToSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      )}

      {/* Workshop / Local Gene Packs Manager & Studio Modal */}
      {modPacksModalOpen && (
        <ModPacksModal
          onClose={() => setModPacksModalOpen(false)}
          onPacksChanged={() => {
            setInstalledPackCount(getInstalledModPacks().length);
            refreshSaveSlots();
          }}
        />
      )}
    </main>
  );
}
