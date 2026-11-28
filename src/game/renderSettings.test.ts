import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RENDER_SETTINGS,
  RENDER_QUALITY_ORDER,
  RENDER_QUALITY_PROFILES,
  getEffectiveTargetFps,
  getRenderQualityProfile,
  getScaledSkinDimensions,
  normalizeRenderSettings,
} from './renderSettings';
import { createWildTypeGenotype, evaluatePhenotype, resolveSkinSpecForPhenotype } from './genetics';
import { BoundedSkinCache } from './skinCache';
import {
  __setFrameClockEnvironmentForTest,
  getCurrentTargetFps,
  getFrameRateSnapshot,
  setFrameClockSettings,
  subscribeFrameRate,
} from './frameClock';
import { terminateIdleSkinWorkers } from './renderScheduler';

test('normalizeRenderSettings falls back to safe defaults for missing or invalid inputs', () => {
  assert.deepEqual(normalizeRenderSettings(), DEFAULT_RENDER_SETTINGS);
  assert.deepEqual(normalizeRenderSettings(null), DEFAULT_RENDER_SETTINGS);
  assert.deepEqual(
    normalizeRenderSettings({
      quality: 'extreme' as never,
      backgroundMode: 'turbo' as never,
    }),
    DEFAULT_RENDER_SETTINGS
  );

  for (const quality of RENDER_QUALITY_ORDER) {
    for (const backgroundMode of ['pause', 'eco', 'normal'] as const) {
      assert.deepEqual(normalizeRenderSettings({ quality, backgroundMode }), {
        quality,
        backgroundMode,
      });
    }
  }
});

test('getEffectiveTargetFps pauses hidden tabs and respects backgroundMode on unfocused windows', () => {
  for (const quality of RENDER_QUALITY_ORDER) {
    const profile = getRenderQualityProfile(quality);

    // Focused window always uses the preset's foreground FPS
    assert.equal(
      getEffectiveTargetFps({ quality, backgroundMode: 'pause' }, true, false),
      profile.foregroundFps
    );
    assert.equal(
      getEffectiveTargetFps({ quality, backgroundMode: 'eco' }, true, false),
      profile.foregroundFps
    );
    assert.equal(
      getEffectiveTargetFps({ quality, backgroundMode: 'normal' }, true, false),
      profile.foregroundFps
    );

    // Unfocused visible window follows backgroundMode
    assert.equal(getEffectiveTargetFps({ quality, backgroundMode: 'pause' }, false, false), 0);
    assert.equal(
      getEffectiveTargetFps({ quality, backgroundMode: 'eco' }, false, false),
      Math.min(5, profile.foregroundFps)
    );
    assert.equal(
      getEffectiveTargetFps({ quality, backgroundMode: 'normal' }, false, false),
      profile.foregroundFps
    );

    // Hidden browser tab ALWAYS pauses rendering (0 FPS) regardless of backgroundMode
    assert.equal(getEffectiveTargetFps({ quality, backgroundMode: 'pause' }, true, true), 0);
    assert.equal(getEffectiveTargetFps({ quality, backgroundMode: 'eco' }, false, true), 0);
    assert.equal(getEffectiveTargetFps({ quality, backgroundMode: 'normal' }, true, true), 0);
  }
});

test('getScaledSkinDimensions scales texture dimensions cleanly by quality profile', () => {
  assert.deepEqual(getScaledSkinDimensions(256, 64, RENDER_QUALITY_PROFILES.low.skinScale), {
    width: 128,
    height: 32,
  });
  assert.deepEqual(getScaledSkinDimensions(256, 64, RENDER_QUALITY_PROFILES.balanced.skinScale), {
    width: 192,
    height: 48,
  });
  assert.deepEqual(getScaledSkinDimensions(256, 64, RENDER_QUALITY_PROFILES.high.skinScale), {
    width: 256,
    height: 64,
  });
  assert.deepEqual(getScaledSkinDimensions(256, 64, 0.1), { width: 128, height: 32 });
  assert.deepEqual(getScaledSkinDimensions(256, 64, 2.5), { width: 256, height: 64 });
});

test('BoundedSkinCache dynamically enforces setMaxBytes and releases detached canvas backing stores', () => {
  const cache = new BoundedSkinCache(256 * 1024);
  const pheno = evaluatePhenotype(createWildTypeGenotype(), 0.25);
  const spec = resolveSkinSpecForPhenotype(pheno);
  const pixels = new Uint8ClampedArray(256 * 64 * 4); // 64 KiB per skin

  const e1 = cache.putSynthesized(spec, pheno.palette, 0.11, 256, 64, pixels, 'final');
  const e2 = cache.putSynthesized(spec, pheno.palette, 0.22, 256, 64, pixels, 'final');
  const e3 = cache.putSynthesized(spec, pheno.palette, 0.33, 256, 64, pixels, 'final');

  // Attach mock canvas backing stores to verify explicit zeroing on eviction and clear
  const fakeCanvas1 = { width: 256, height: 64 } as HTMLCanvasElement;
  const fakeCanvas2 = { width: 256, height: 64 } as HTMLCanvasElement;
  const fakeCanvas3 = { width: 256, height: 64 } as HTMLCanvasElement;
  e1.canvas = fakeCanvas1;
  e2.canvas = fakeCanvas2;
  e3.canvas = fakeCanvas3;

  assert.equal(cache.getStats().entryCount, 3);
  assert.equal(cache.getStats().totalBytes, 3 * 65536);

  // Shrink budget down to fit only 1 entry (64 KiB)
  cache.setMaxBytes(65536);
  const stats = cache.getStats();
  assert.equal(stats.entryCount, 1);
  assert.equal(stats.totalBytes, 65536);
  assert.equal(stats.evictions, 2);

  // Evicted entries must have their GPU backing stores zeroed
  assert.equal(fakeCanvas1.width, 0);
  assert.equal(fakeCanvas1.height, 0);
  assert.equal(fakeCanvas2.width, 0);
  assert.equal(fakeCanvas2.height, 0);
  // Most recent entry survives untouched until clear()
  assert.equal(fakeCanvas3.width, 256);
  assert.equal(fakeCanvas3.height, 64);

  // Headless Node safety for rehydration APIs
  assert.equal(cache.rehydrateAllCanvases(), 0);
  assert.equal(cache.ensureEntryCanvas(e3), null);

  cache.clear();
  assert.equal(fakeCanvas3.width, 0);
  assert.equal(fakeCanvas3.height, 0);
  assert.equal(cache.getStats().entryCount, 0);
  assert.equal(cache.getStats().totalBytes, 0);
});

test('terminateIdleSkinWorkers is safe to call repeatedly when no workers are running', () => {
  assert.doesNotThrow(() => {
    terminateIdleSkinWorkers();
    terminateIdleSkinWorkers();
  });
});

test('frameClock provides a single unified targetFps authority across quality, focus, and visibility transitions', () => {
  const observed: number[] = [];
  const unsubscribe = subscribeFrameRate((snap) => observed.push(snap.targetFps));

  try {
    __setFrameClockEnvironmentForTest(true, false);
    setFrameClockSettings({ quality: 'low', backgroundMode: 'eco' });
    assert.equal(getCurrentTargetFps(), 20);
    assert.equal(getFrameRateSnapshot().disableTransitions, false);

    // Unfocused under Eco -> unified 5 FPS for canvas, animated mini-canvases, and UI animations
    __setFrameClockEnvironmentForTest(false, false);
    assert.equal(getCurrentTargetFps(), 5);
    assert.equal(getFrameRateSnapshot().disableTransitions, true);

    // Switch backgroundMode to Pause while unfocused -> unified 0 FPS
    setFrameClockSettings({ quality: 'low', backgroundMode: 'pause' });
    assert.equal(getCurrentTargetFps(), 0);
    assert.equal(getFrameRateSnapshot().frameIntervalMs, Infinity);

    // Focus restored on Ultra -> 60 FPS
    setFrameClockSettings({ quality: 'ultra', backgroundMode: 'pause' });
    __setFrameClockEnvironmentForTest(true, false);
    assert.equal(getCurrentTargetFps(), 60);

    // Hidden tab -> always 0 FPS
    __setFrameClockEnvironmentForTest(true, true);
    assert.equal(getCurrentTargetFps(), 0);

    assert.ok(observed.includes(20));
    assert.ok(observed.includes(5));
    assert.ok(observed.includes(0));
    assert.ok(observed.includes(60));
  } finally {
    unsubscribe();
    __setFrameClockEnvironmentForTest(true, false);
    setFrameClockSettings(DEFAULT_RENDER_SETTINGS);
  }
});
