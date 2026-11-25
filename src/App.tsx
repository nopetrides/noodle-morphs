import { useCallback, useEffect, useMemo, useState } from 'react';
import { GalleryDrawer } from './components/GalleryDrawer';
import { HatchRevealModal } from './components/HatchRevealModal';
import { JeanPoolIntroModal } from './components/JeanPoolIntroModal';
import { PauseModal } from './components/PauseModal';
import { SellConfirmModal } from './components/SellConfirmModal';
import { SnakeInspectorCard } from './components/SnakeInspectorCard';
import { StarterPairModal } from './components/StarterPairModal';
import { TerrariumCanvas } from './components/TerrariumCanvas';
import { TerrariumDock } from './components/TerrariumDock';
import { TitleOverlay } from './components/TitleOverlay';
import { TopIncubatorHud } from './components/TopIncubatorHud';
import { audioEngine } from './game/audio';
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
  getIncubatorUpgradePrice,
  getMaxDisplaySlots,
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
import {
  breedClutch,
  buildInitialDiscoveries,
  createRandomStarterPair,
} from './game/genetics';
import { clearSavedState, loadSavedState, saveGameState } from './game/storage';
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

function buildFreshGame() {
  const starters = createRandomStarterPair();
  const economy = createDefaultEconomyState(Math.floor(Math.random() * 100000) + 1);
  const breedDur = computePairBreedDurationSec(starters[0], starters[1], economy.hissDepot);
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
    isFreshNewGame: true,
  };
}

type PendingSale =
  | { kind: 'collection'; snake: SnakeEntity }
  | { kind: 'hatchling'; egg: ClutchEgg };

export default function App() {
  const loadedFromDisk = useMemo(() => loadSavedState(), []);
  const initialState = useMemo(
    () =>
      loadedFromDisk
        ? { ...loadedFromDisk, isFreshNewGame: false }
        : buildFreshGame(),
    [loadedFromDisk]
  );

  const autostart = getInitialAutostart();
  const [phase, setPhase] = useState<GamePhase>(() => (autostart ? 'playing' : 'title'));
  const [needsStarterConfirm, setNeedsStarterConfirm] = useState<boolean>(
    () => initialState.isFreshNewGame && !autostart
  );
  const [snakes, setSnakes] = useState<SnakeEntity[]>(initialState.snakes);
  const [discoveries, setDiscoveries] = useState<Record<string, MorphDiscovery>>(
    initialState.discoveries
  );
  const [sireId, setSireId] = useState<string>(initialState.sireId);
  const [damId, setDamId] = useState<string>(initialState.damId);
  const [clutchDurationSec, setClutchDurationSec] = useState<number>(
    initialState.clutchDurationSec
  );
  const [clutchRemainingSec, setClutchRemainingSec] = useState<number>(
    initialState.clutchRemainingSec
  );
  const [clutchReady, setClutchReady] = useState<boolean>(initialState.clutchReady);
  const [clutchesHatched, setClutchesHatched] = useState<number>(
    initialState.clutchesHatched
  );
  const [settings, setSettings] = useState<TerrariumSettings>(initialState.settings);
  const [economy, setEconomy] = useState<EconomyState>(initialState.economy);

  const [selectedSnakeId, setSelectedSnakeId] = useState<string | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawerTab | null>(null);
  const [activeClutch, setActiveClutch] = useState<ClutchEgg[] | null>(null);
  const [pendingSale, setPendingSale] = useState<PendingSale | null>(null);
  const [mistTriggerCount, setMistTriggerCount] = useState(0);

  const maxDisplay = useMemo(
    () => getMaxDisplaySlots(economy.hissDepot),
    [economy.hissDepot]
  );
  const activeClutchConfig = useMemo(
    () => getActiveClutchConfig(economy.hissDepot),
    [economy.hissDepot]
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

  // Persist save state to localStorage once starter pair is confirmed
  useEffect(() => {
    if (needsStarterConfirm) return;
    saveGameState({
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
    });
  }, [
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
  ]);

  const sire = useMemo(
    () => snakes.find((s) => s.id === sireId) ?? snakes[0],
    [snakes, sireId]
  );
  const dam = useMemo(
    () =>
      snakes.find((s) => s.id === damId && s.id !== sire.id) ??
      snakes.find((s) => s.id !== sire.id) ??
      snakes[0],
    [snakes, damId, sire.id]
  );

  const pairCanBreedNow = canSnakeBreed(sire) && canSnakeBreed(dam);

  // Unified 1Hz idle simulation tick:
  // 1) Incubator countdown (only when pair has enough vigour & clutch isn't already ready)
  // 2) Vigour recovery for every snake NOT actively breeding (including parents during ready/reveal/recovery!)
  // 3) The Jean Pool restock cooldown countdown
  useEffect(() => {
    if (phase !== 'playing' || needsStarterConfirm) return;

    const timer = window.setInterval(() => {
      const isActivelyBreeding =
        !clutchReady && activeClutch === null && pairCanBreedNow && clutchRemainingSec > 0;

      // 1. Tick incubator countdown
      if (isActivelyBreeding) {
        setClutchRemainingSec((prev) => {
          const next = Math.max(0, prev - 1);
          if (next <= 0 && prev > 0) {
            // Clutch finished! Deduct vigour once from active breeders & mark ready
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

      // 2. Recover vigour for non-breeding snakes (and for parents whenever ready/modal/recovering!)
      const activeIds = isActivelyBreeding
        ? new Set<string>([sire.id, dam.id])
        : new Set<string>();
      setSnakes((currSnakes) => recoverSnakesVigor(currSnakes, activeIds, 1));

      // 3. Tick Jean Pool restock cooldown
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
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    phase,
    needsStarterConfirm,
    clutchReady,
    activeClutch,
    pairCanBreedNow,
    clutchRemainingSec,
    sire.id,
    dam.id,
  ]);

  const handleStart = useCallback(() => {
    document.body.dataset.state = 'playing';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    audioEngine.playSoftClick();
    setPhase('playing');
  }, []);

  const handleRerollStarters = useCallback(() => {
    audioEngine.playSoftClick();
    const fresh = buildFreshGame();
    setSnakes(fresh.snakes);
    setDiscoveries(fresh.discoveries);
    setSireId(fresh.sireId);
    setDamId(fresh.damId);
    setClutchDurationSec(fresh.clutchDurationSec);
    setClutchRemainingSec(fresh.clutchRemainingSec);
    setClutchReady(false);
    setEconomy(fresh.economy);
  }, []);

  const handleConfirmStarters = useCallback(() => {
    audioEngine.playSoftClick();
    setNeedsStarterConfirm(false);
  }, []);

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

      if (phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStart();
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
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
        setPhase((curr) => (curr === 'playing' ? 'paused' : curr === 'paused' ? 'playing' : curr));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    activeClutch,
    activeDrawer,
    selectedSnakeId,
    pendingSale,
    needsStarterConfirm,
    handleStart,
    handleToggleMute,
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
      setSireId(nextSireId);
      setDamId(nextDamId);

      // Recompute breed duration cleanly for the newly chosen pair if not already ready
      if (!clutchReady) {
        const nextSire = snakes.find((s) => s.id === nextSireId) ?? sire;
        const nextDam = snakes.find((s) => s.id === nextDamId) ?? dam;
        const nextDur = computePairBreedDurationSec(nextSire, nextDam, economy.hissDepot);
        setClutchDurationSec(nextDur);
        setClutchRemainingSec((prev) => Math.min(prev, nextDur));
      }
    },
    [sire, dam, snakes, clutchReady, economy.hissDepot]
  );

  const handleWarmIncubator = useCallback(() => {
    if (!pairCanBreedNow || clutchReady) return;
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
  }, [pairCanBreedNow, clutchReady, sire.id, dam.id]);

  const handleOpenHatch = useCallback(() => {
    audioEngine.playSoftClick();
    const existingNames = new Set(snakes.map((s) => s.name));
    const eggs = breedClutch(
      sire,
      dam,
      discoveredKeys,
      existingNames,
      activeClutchConfig.clutchSize,
      Math.random,
      economy.hissDepot.biasWeights
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
    economy.hissDepot.biasWeights,
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

  // Record a snake's morph into Morphdex helper
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

  // Confirm sale (from either Collection or Hatch Reveal)
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
      // Ensure at least 1 displayed snake remains
      if (!remainingSnakes.some((s) => s.onDisplay) && remainingSnakes.length > 0) {
        remainingSnakes[0] = { ...remainingSnakes[0], onDisplay: true };
      }
      setSnakes(remainingSnakes);

      // Reassign sire/dam cleanly if we sold one of the active parents
      if (targetSnake.id === sireId && remainingSnakes.length >= 2) {
        const replacement = remainingSnakes.find((s) => s.id !== damId) ?? remainingSnakes[0];
        setSireId(replacement.id);
      } else if (targetSnake.id === damId && remainingSnakes.length >= 2) {
        const replacement = remainingSnakes.find((s) => s.id !== sireId) ?? remainingSnakes[0];
        setDamId(replacement.id);
      }
      if (selectedSnakeId === targetSnake.id) {
        setSelectedSnakeId(null);
      }
    } else {
      // Selling directly from Hatch Reveal marks the egg sold & still logs its discovery!
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

      const resolvedSire =
        nextSnakesList.find((s) => s.id === nextSireId) ?? nextSnakesList[0];
      const resolvedDam =
        nextSnakesList.find((s) => s.id === nextDamId && s.id !== resolvedSire.id) ??
        nextSnakesList.find((s) => s.id !== resolvedSire.id) ??
        nextSnakesList[0];

      const nextDur = computePairBreedDurationSec(resolvedSire, resolvedDam, economy.hissDepot);
      setSireId(resolvedSire.id);
      setDamId(resolvedDam.id);
      setClutchesHatched((c) => c + 1);
      setClutchDurationSec(nextDur);
      setClutchRemainingSec(nextDur);
      setClutchReady(false);
      setActiveClutch(null);
    },
    [activeClutch, snakes, economy.hissDepot, archiveSnakeDiscovery]
  );

  // --- The Jean Pool Purchase ---
  const handleBuyJeanPoolOffer = useCallback(
    (offer: JeanPoolOffer) => {
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
    [economy, displayedCount, maxDisplay, archiveSnakeDiscovery]
  );

  // --- Developer Debug Spawn from Gene Simulator ---
  const handleDebugAddSnake = useCallback(
    (simulatedSnake: SnakeEntity) => {
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

  // --- The Hiss Depot Upgrades & Tuning ---
  const handleBuyIncubatorUpgrade = useCallback(() => {
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
  }, [economy]);

  const handleSetIncubatorActive = useCallback((level: number) => {
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
  }, [clutchReady, sire, dam]);

  const handleBuyDisplaySlot = useCallback(() => {
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
  }, [economy]);

  const handleBuyBiasCap = useCallback(
    (mode: InheritanceMode) => {
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
    [economy]
  );

  const handleAdjustBiasWeight = useCallback((mode: InheritanceMode, value: number) => {
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
  }, []);

  const handleResetBiasWeights = useCallback(() => {
    audioEngine.playSoftClick();
    const def = createDefaultHissDepotState().biasWeights;
    setEconomy((prev) => ({
      ...prev,
      hissDepot: {
        ...prev.hissDepot,
        biasWeights: def,
      },
    }));
  }, []);

  const handleMist = useCallback(() => {
    audioEngine.playMistSpritz();
    setMistTriggerCount((c) => c + 1);
  }, []);

  const handleToggleHeatLamp = useCallback(() => {
    audioEngine.playSoftClick();
    setSettings((prev) => ({ ...prev, heatLampOn: !prev.heatLampOn }));
  }, []);

  const handleResetTerrarium = useCallback(() => {
    clearSavedState();
    const fresh = buildFreshGame();
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
    setNeedsStarterConfirm(true);
    setPhase('playing');
  }, []);

  const discoveredCount = Object.keys(discoveries).length;

  // Permanently unlock Sell buttons the moment the first extra (triplicate, 3+) of any morph is born/revealed
  useEffect(() => {
    if (economy.sellUnlocked) return;
    const revealedClutchSnakes = (activeClutch ?? [])
      .filter((e) => e.revealed && !e.sold)
      .map((e) => e.snake);
    if (hasTriplicateMorph([...snakes, ...revealedClutchSnakes])) {
      setEconomy((prev) => (prev.sellUnlocked ? prev : { ...prev, sellUnlocked: true }));
    }
  }, [economy.sellUnlocked, snakes, activeClutch]);

  const jeanPoolUnlocked = isJeanPoolUnlocked(economy);
  const hissDepotUnlocked = isHissDepotUnlocked(economy);
  const showCurrency = economy.sellUnlocked || economy.money > 0 || economy.totalSnakesSold > 0;
  const showJeanPoolIntro =
    phase === 'playing' &&
    !needsStarterConfirm &&
    jeanPoolUnlocked &&
    !economy.jeanPoolIntroSeen &&
    !pendingSale;

  const handleDismissJeanPoolIntro = useCallback(() => {
    audioEngine.playSoftClick();
    setEconomy((prev) => ({ ...prev, jeanPoolIntroSeen: true }));
  }, []);

  const handleVisitJeanPoolFromIntro = useCallback(() => {
    audioEngine.playSoftClick();
    setEconomy((prev) => ({ ...prev, jeanPoolIntroSeen: true }));
    setSelectedSnakeId(null);
    setActiveDrawer('jeanpool');
  }, []);

  // Compute pending sale valuation & warnings cleanly
  const pendingSaleMeta = useMemo(() => {
    if (!pendingSale) return null;
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
  }, [pendingSale, soldMorphKeysSet, snakes, activeClutch, sire.id, dam.id]);

  return (
    <main className="relative w-full h-full overflow-hidden">
      {/* Full-bleed live procedural Terrarium Canvas */}
      <TerrariumCanvas
        snakes={snakes}
        selectedSnakeId={selectedSnakeId}
        phase={phase}
        heatLampOn={settings.heatLampOn}
        isOccluded={Boolean(activeClutch || activeDrawer || needsStarterConfirm || pendingSale)}
        mistTriggerCount={mistTriggerCount}
        onSelectSnake={handleSelectSnake}
        onTapSubstrate={() => audioEngine.playSoftClick()}
      />

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <TitleOverlay
          onStart={handleStart}
          discoveredCount={discoveredCount}
          snakeCount={snakes.length}
        />
      )}

      {/* First-Time 2-Starter Random Pair Onboarding Modal */}
      {phase === 'playing' && needsStarterConfirm && (
        <StarterPairModal
          pair={snakes.slice(0, 2)}
          onConfirm={handleConfirmStarters}
          onReroll={handleRerollStarters}
        />
      )}

      {/* Playing HUD */}
      {phase !== 'title' && !needsStarterConfirm && (
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
            onPause={() => setPhase('paused')}
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
            onOpenDrawer={(tab) => {
              audioEngine.playSoftClick();
              setSelectedSnakeId(null);
              setActiveDrawer((curr) => (curr === tab ? null : tab));
            }}
            onMist={handleMist}
            onToggleHeatLamp={handleToggleHeatLamp}
          />
        </>
      )}

      {/* Field Guide & Shops Drawer */}
      {phase === 'playing' && !needsStarterConfirm && activeDrawer && !activeClutch && (
        <GalleryDrawer
          activeTab={activeDrawer}
          snakes={snakes}
          discoveries={discoveries}
          sireId={sire.id}
          damId={dam.id}
          maxDisplay={maxDisplay}
          clutchesHatched={clutchesHatched}
          economy={economy}
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
        />
      )}

      {/* Clutch Hatch Reveal Modal */}
      {phase === 'playing' && !needsStarterConfirm && activeClutch && (
        <HatchRevealModal
          eggs={activeClutch}
          sire={sire}
          dam={dam}
          allSnakes={snakes}
          discoveredKeys={discoveredKeys}
          soldMorphKeys={soldMorphKeysSet}
          biasWeights={economy.hissDepot.biasWeights}
          displayedCount={displayedCount}
          maxDisplay={maxDisplay}
          sellUnlocked={economy.sellUnlocked}
          showSellTutorial={economy.sellUnlocked && economy.totalSnakesSold === 0}
          onRevealEgg={handleRevealEgg}
          onRevealAll={handleRevealAllEggs}
          onRenameEggSnake={handleRenameEggSnake}
          onToggleEggDisplay={handleToggleEggDisplay}
          onRequestSellEgg={(egg) => setPendingSale({ kind: 'hatchling', egg })}
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

      {/* First-Sale Jean Pool Unlock Dialogue */}
      {showJeanPoolIntro && (
        <JeanPoolIntroModal
          money={economy.money}
          inActiveClutch={Boolean(activeClutch)}
          onDismiss={handleDismissJeanPoolIntro}
          onVisitJeanPool={handleVisitJeanPoolFromIntro}
        />
      )}

      {/* Pause Modal */}
      {phase === 'paused' && (
        <PauseModal
          snakeCount={snakes.length}
          discoveredCount={discoveredCount}
          clutchesHatched={clutchesHatched}
          onResume={() => setPhase('playing')}
          onReturnTitle={() => {
            setActiveDrawer(null);
            setSelectedSnakeId(null);
            setPhase('title');
          }}
          onResetTerrarium={handleResetTerrarium}
        />
      )}
    </main>
  );
}
