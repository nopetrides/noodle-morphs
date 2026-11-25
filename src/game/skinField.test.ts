import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWildTypeGenotype,
  deriveSkinPhenotypeSpec,
  evaluatePhenotype,
} from './genetics';
import {
  SKIN_GENERATOR_VERSION,
  createDefaultSkinFieldParams,
  evaluateSkinPoint,
  registerGrayscaleMapField,
  synthesizeSkinBuffer,
  unregisterGrayscaleMapField,
} from './skinField';
import { BoundedSkinCache } from './skinCache';
import { buildSpineUVRibbon } from './snakeRenderer';
import { createSpine } from './spine';
import type { Genotype, SkinPhenotypeSpec } from './types';

function withGenes(overrides: Partial<Genotype>): Genotype {
  return {
    ...createWildTypeGenotype(),
    ...overrides,
  };
}

function measureDarkRatio(spec: SkinPhenotypeSpec, seed: number): number {
  let darkSum = 0;
  let count = 0;
  for (let yi = 0; yi < 16; yi++) {
    const v = (yi / 15) * 2 - 1;
    for (let xi = 0; xi < 64; xi++) {
      const u = 0.14 + (xi / 63) * 0.72;
      const sample = evaluateSkinPoint(u, v, spec, seed);
      darkSum += sample.primaryMask;
      count++;
    }
  }
  return darkSum / count;
}

test('skin synthesis is 100% deterministic for identical spec, palette, and seed', () => {
  const g = withGenes({ enchi: [1, 0] });
  const pheno = evaluatePhenotype(g, 0.37);
  const spec = deriveSkinPhenotypeSpec(g, 0.37);

  const bufA = synthesizeSkinBuffer(spec, pheno.palette, 0.37, 96, 24, 'final');
  const bufB = synthesizeSkinBuffer(spec, pheno.palette, 0.37, 96, 24, 'final');

  assert.equal(bufA.length, 96 * 24 * 4);
  assert.deepEqual(bufA, bufB);
});

test('continuous erosion continuum: Classic -> Enchi -> Spider -> Pinstripe reduces coverage & dark pigment', () => {
  const seed = 0.42;
  const classic = deriveSkinPhenotypeSpec(withGenes({}), seed);
  const enchi = deriveSkinPhenotypeSpec(withGenes({ enchi: [1, 0] }), seed);
  const spider = deriveSkinPhenotypeSpec(withGenes({ spider: [1, 0] }), seed);
  const pinstripe = deriveSkinPhenotypeSpec(withGenes({ pinstripe: [1, 0] }), seed);

  assert.ok(classic.params.coverage > enchi.params.coverage, 'Classic > Enchi coverage');
  assert.ok(enchi.params.coverage > spider.params.coverage, 'Enchi > Spider coverage');
  assert.ok(spider.params.coverage > pinstripe.params.coverage, 'Spider > Pinstripe coverage');

  const classicDark = measureDarkRatio(classic, seed);
  const enchiDark = measureDarkRatio(enchi, seed);
  const spiderDark = measureDarkRatio(spider, seed);
  const pinstripeDark = measureDarkRatio(pinstripe, seed);

  assert.ok(classicDark > enchiDark, `Expected Classic (${classicDark.toFixed(3)}) > Enchi (${enchiDark.toFixed(3)})`);
  assert.ok(enchiDark > spiderDark, `Expected Enchi (${enchiDark.toFixed(3)}) > Spider (${spiderDark.toFixed(3)})`);
  assert.ok(spiderDark > pinstripeDark, `Expected Spider (${spiderDark.toFixed(3)}) > Pinstripe (${pinstripeDark.toFixed(3)})`);
});

test('Milk Band produces 3 distinct pigment regions (cream base, black border ring, scarlet accent core)', () => {
  const g = withGenes({ milksnake: [1, 0] });
  const pheno = evaluatePhenotype(g, 0.42);
  const spec = deriveSkinPhenotypeSpec(g, 0.42);

  let creamPixels = 0;
  let darkRingPixels = 0;
  let scarletPixels = 0;

  for (let xi = 0; xi < 120; xi++) {
    const u = 0.15 + (xi / 119) * 0.7;
    const sample = evaluateSkinPoint(u, 0, spec, 0.42);
    if (sample.primaryMask > 0.65) {
      darkRingPixels++;
    } else if (sample.accentMask > 0.55) {
      scarletPixels++;
    } else {
      creamPixels++;
    }
  }

  assert.equal(pheno.isCustomMorph, true);
  assert.ok(pheno.palette.accentColor, 'Milk Band defines scarlet accentColor');
  assert.ok(creamPixels > 10, `Expected cream interspaces, got ${creamPixels}`);
  assert.ok(darkRingPixels > 10, `Expected black ring borders, got ${darkRingPixels}`);
  assert.ok(scarletPixels > 10, `Expected scarlet saddles, got ${scarletPixels}`);
});

test('Milk Band x Mojave uses non-blend field modulation producing distinct emergent field vs solo genes', () => {
  const seed = 0.42;
  const milkSolo = deriveSkinPhenotypeSpec(withGenes({ milksnake: [1, 0] }), seed);
  const mojaveSolo = deriveSkinPhenotypeSpec(withGenes({ mojave: [1, 0] }), seed);
  const combo = deriveSkinPhenotypeSpec(withGenes({ milksnake: [1, 0], mojave: [1, 0] }), seed);

  assert.equal(milkSolo.contributions[0]?.operation, 'blend');
  assert.equal(combo.contributions[0]?.operation, 'modulate');

  let diffFromMilk = 0;
  let diffFromMojave = 0;
  for (let xi = 0; xi < 60; xi++) {
    const u = 0.16 + (xi / 59) * 0.68;
    const sMilk = evaluateSkinPoint(u, 0.45, milkSolo, seed);
    const sMoj = evaluateSkinPoint(u, 0.45, mojaveSolo, seed);
    const sCombo = evaluateSkinPoint(u, 0.45, combo, seed);
    diffFromMilk += Math.abs(sCombo.rawField - sMilk.rawField);
    diffFromMojave += Math.abs(sCombo.rawField - sMoj.rawField);
  }

  assert.ok(diffFromMilk > 2.0, `Combo field must differ from solo Milk Band (diff=${diffFromMilk.toFixed(2)})`);
  assert.ok(diffFromMojave > 2.0, `Combo field must differ from solo Mojave (diff=${diffFromMojave.toFixed(2)})`);
});

test('authored grayscale map fields evaluate through the common SkinField custom_map interface', () => {
  const mapId = 'test_checker_stripe';
  const data = new Float32Array(16 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 16; x++) {
      data[y * 16 + x] = x < 8 ? 0.95 : 0.05;
    }
  }
  registerGrayscaleMapField(mapId, 16, 4, data);

  try {
    const spec: SkinPhenotypeSpec = {
      generatorVersion: SKIN_GENERATOR_VERSION,
      params: { ...createDefaultSkinFieldParams(), warpStrength: 0 },
      contributions: [{ field: 'custom_map', operation: 'blend', strength: 1.0 }],
      customMapId: mapId,
    };

    const leftHalf = evaluateSkinPoint(0.2, 0, spec, 0.5);
    const rightHalf = evaluateSkinPoint(0.8, 0, spec, 0.5);

    assert.ok(leftHalf.rawField > 0.85, `Expected high field in left half, got ${leftHalf.rawField}`);
    assert.ok(rightHalf.rawField < 0.15, `Expected low field in right half, got ${rightHalf.rawField}`);
  } finally {
    unregisterGrayscaleMapField(mapId);
  }
});

test('BoundedSkinCache enforces memory byte budget with LRU eviction and hits on repeated requests', () => {
  // Each 128x64 RGBA skin is 32,768 bytes. Cap at 65,536 bytes -> holds max 2 skins.
  const cache = new BoundedSkinCache(65536);
  const g1 = withGenes({});
  const g2 = withGenes({ enchi: [1, 0] });
  const g3 = withGenes({ milksnake: [1, 0] });
  const p1 = evaluatePhenotype(g1, 0.1);
  const p2 = evaluatePhenotype(g2, 0.2);
  const p3 = evaluatePhenotype(g3, 0.3);

  const e1 = cache.getOrSynthesize(p1.skinSpec!, p1.palette, 0.1, 128, 64, 'final');
  const e1Hit = cache.getOrSynthesize(p1.skinSpec!, p1.palette, 0.1, 128, 64, 'final');
  assert.strictEqual(e1, e1Hit, 'Repeated identical request should return exact cached entry');
  assert.equal(cache.getStats().hits, 1);

  cache.getOrSynthesize(p2.skinSpec!, p2.palette, 0.2, 128, 64, 'final');
  assert.equal(cache.getStats().entryCount, 2);

  // Adding a 3rd entry must evict the least-recently-used entry to stay under 65,536 bytes
  cache.getOrSynthesize(p3.skinSpec!, p3.palette, 0.3, 128, 64, 'final');
  const stats = cache.getStats();
  assert.ok(stats.totalBytes <= 65536, `Cache bytes ${stats.totalBytes} exceeded 65536`);
  assert.equal(stats.entryCount, 2);
  assert.equal(stats.evictions, 1);
});

test('buildSpineUVRibbon preserves monotonic u coordinates and compresses inner turns while stretching outer turns', () => {
  // Construct a smooth 90-degree circular arc turning right (center at (0, 80), radius 80)
  const spine = createSpine(0, 0, 0, 18, 7, 10);
  const count = spine.points.length;
  for (let i = 0; i < count; i++) {
    const theta = -Math.PI / 2 + (i / (count - 1)) * (Math.PI / 2);
    spine.points[i].x = Math.cos(theta) * 80;
    spine.points[i].y = 80 + Math.sin(theta) * 80;
    spine.points[i].radius = 10;
    spine.points[i].angle = theta + Math.PI / 2;
  }

  const ribbon = buildSpineUVRibbon(spine);
  assert.equal(ribbon.left.length, count + 2);
  assert.equal(ribbon.right.length, count + 2);
  assert.equal(ribbon.left[0].u, 0);
  assert.equal(ribbon.left[ribbon.left.length - 1].u, 1);

  let leftPathLen = 0;
  let rightPathLen = 0;
  for (let i = 1; i < ribbon.left.length; i++) {
    assert.ok(
      ribbon.left[i].u > ribbon.left[i - 1].u,
      'u coordinate must strictly increase from snout to tail'
    );
    leftPathLen += Math.hypot(
      ribbon.left[i].x - ribbon.left[i - 1].x,
      ribbon.left[i].y - ribbon.left[i - 1].y
    );
    rightPathLen += Math.hypot(
      ribbon.right[i].x - ribbon.right[i - 1].x,
      ribbon.right[i].y - ribbon.right[i - 1].y
    );
  }

  // On a clockwise arc, one side is the outer convex flank and the other is the inner concave flank
  const outerLen = Math.max(leftPathLen, rightPathLen);
  const innerLen = Math.min(leftPathLen, rightPathLen);
  assert.ok(
    outerLen > innerLen * 1.15,
    `Expected outer curve (${outerLen.toFixed(1)}) to stretch noticeably beyond inner curve (${innerLen.toFixed(1)})`
  );
});

test('Calico produces subtle patchy asymmetric white solo and dramatically stronger white patches in mixed-morph combos', () => {
  const seed = 0.42;
  const soloSpec = deriveSkinPhenotypeSpec(withGenes({ calico: [1, 0] }), seed);
  const comboSpec = deriveSkinPhenotypeSpec(
    withGenes({ calico: [1, 0], pastel: [1, 0], enchi: [1, 0] }),
    seed
  );

  assert.ok(
    comboSpec.params.calicoRise > soloSpec.params.calicoRise + 0.25,
    `Combo calicoRise (${comboSpec.params.calicoRise.toFixed(2)}) should significantly exceed solo (${soloSpec.params.calicoRise.toFixed(2)})`
  );

  let soloWhiteSum = 0;
  let comboWhiteSum = 0;
  let soloDorsalWhite = 0;
  let leftFlankWhite = 0;
  let rightFlankWhite = 0;
  let samples = 0;
  let dorsalSamples = 0;

  for (let yi = 0; yi < 16; yi++) {
    const v = (yi / 15) * 2 - 1;
    for (let xi = 0; xi < 64; xi++) {
      const u = 0.14 + (xi / 63) * 0.78;
      const sSolo = evaluateSkinPoint(u, v, soloSpec, seed);
      const sCombo = evaluateSkinPoint(u, v, comboSpec, seed);
      soloWhiteSum += sSolo.suppressionMask;
      comboWhiteSum += sCombo.suppressionMask;
      samples++;
      if (Math.abs(v) < 0.25) {
        soloDorsalWhite += sSolo.suppressionMask;
        dorsalSamples++;
      }
      if (v < -0.6) leftFlankWhite += sSolo.suppressionMask;
      if (v > 0.6) rightFlankWhite += sSolo.suppressionMask;
    }
  }

  const soloAvg = soloWhiteSum / samples;
  const comboAvg = comboWhiteSum / samples;
  const dorsalAvg = soloDorsalWhite / dorsalSamples;

  assert.ok(soloAvg > 0.01 && soloAvg < 0.22, `Solo Calico should be subtle patchy white, got avg=${soloAvg.toFixed(3)}`);
  assert.ok(dorsalAvg < 0.06, `Solo Calico dorsal spine should stay pigmented, got avg=${dorsalAvg.toFixed(3)}`);
  assert.ok(comboAvg > soloAvg * 1.8, `Combo Calico (${comboAvg.toFixed(3)}) should pull out much more white than solo (${soloAvg.toFixed(3)})`);
  assert.ok(
    Math.abs(leftFlankWhite - rightFlankWhite) > 0.5,
    'Calico left and right flank white patches should be asymmetric, not mirrored stripes'
  );
});

test('alien-head silhouette controls (widthContrast, baseTaper, crownNotch, localWidthVariation, regionalCoherence) behave cleanly and reproduce baseline at zero', () => {
  const seed = 0.655;
  const baseParams = {
    ...createDefaultSkinFieldParams(),
    eyeCount: 0,
    eyeStrength: 0,
    widthContrast: 0,
    baseTaper: 0,
    crownNotch: 0,
    localWidthVariation: 0,
    regionalCoherence: 0,
  };
  const makeSpec = (overrides: Partial<typeof baseParams>): SkinPhenotypeSpec => ({
    generatorVersion: SKIN_GENERATOR_VERSION,
    params: { ...baseParams, ...overrides },
    contributions: [],
  });

  const zeroSpec = makeSpec({});
  const taperSpec = makeSpec({ baseTaper: 0.75 });
  const notchSpec = makeSpec({ widthContrast: 0.4, crownNotch: 0.8 });
  const noNotchSpec = makeSpec({ widthContrast: 0.4, crownNotch: 0 });
  const variedLowCoh = makeSpec({ localWidthVariation: 0.7, regionalCoherence: 0 });
  const variedHighCoh = makeSpec({ localWidthVariation: 0.7, regionalCoherence: 0.85 });

  // 1. Base Taper increases dark ridge density near outer flank edges (|v| ~ 0.88) while keeping dorsal crown (|v| ~ 0.30) nearly unchanged
  let zeroOuter = 0;
  let taperOuter = 0;
  let zeroCrown = 0;
  let taperCrown = 0;
  for (let xi = 0; xi < 80; xi++) {
    const u = 0.14 + (xi / 79) * 0.72;
    zeroOuter += evaluateSkinPoint(u, 0.88, zeroSpec, seed).rawField;
    taperOuter += evaluateSkinPoint(u, 0.88, taperSpec, seed).rawField;
    zeroCrown += evaluateSkinPoint(u, 0.3, zeroSpec, seed).rawField;
    taperCrown += evaluateSkinPoint(u, 0.3, taperSpec, seed).rawField;
  }
  assert.ok(
    taperOuter / 80 > zeroOuter / 80 + 0.08,
    `Expected baseTaper to darken outer flank edges (${(taperOuter / 80).toFixed(3)} vs ${(zeroOuter / 80).toFixed(3)})`
  );
  assert.ok(
    Math.abs(taperCrown - zeroCrown) / 80 < 0.04,
    `Expected baseTaper to preserve crown width near dorsal line (delta=${(Math.abs(taperCrown - zeroCrown) / 80).toFixed(3)})`
  );

  // 2. Crown Notch modifies dorsal-facing crown region without altering lower flank contour
  let dorsalDiff = 0;
  let lowerDiff = 0;
  for (let xi = 0; xi < 80; xi++) {
    const u = 0.14 + (xi / 79) * 0.72;
    dorsalDiff += Math.abs(
      evaluateSkinPoint(u, 0.32, notchSpec, seed).rawField -
        evaluateSkinPoint(u, 0.32, noNotchSpec, seed).rawField
    );
    lowerDiff += Math.abs(
      evaluateSkinPoint(u, 0.92, notchSpec, seed).rawField -
        evaluateSkinPoint(u, 0.92, noNotchSpec, seed).rawField
    );
  }
  assert.ok(dorsalDiff > 1.5, `Expected crownNotch to visibly shape dorsal crowns (diff=${dorsalDiff.toFixed(2)})`);
  assert.ok(lowerDiff < 0.05, `Expected crownNotch to leave lower flank contour independent (diff=${lowerDiff.toFixed(4)})`);

  // 3. Regional Coherence measurably changes field distribution vs isolated local variation
  let cohDiff = 0;
  for (let xi = 0; xi < 80; xi++) {
    const u = 0.14 + (xi / 79) * 0.72;
    cohDiff += Math.abs(
      evaluateSkinPoint(u, 0.55, variedHighCoh, seed).rawField -
        evaluateSkinPoint(u, 0.55, variedLowCoh, seed).rawField
    );
  }
  assert.ok(cohDiff > 1.0, `Expected regionalCoherence to alter cell width distribution (diff=${cohDiff.toFixed(2)})`);

  // 4. Setting all 5 controls to 0 is deterministic and distinct from calibrated defaults
  const defaultSpec = deriveSkinPhenotypeSpec(withGenes({}), seed);
  let defaultVsZero = 0;
  for (let xi = 0; xi < 60; xi++) {
    const u = 0.14 + (xi / 59) * 0.72;
    defaultVsZero += Math.abs(
      evaluateSkinPoint(u, 0.75, defaultSpec, seed).rawField -
        evaluateSkinPoint(u, 0.75, zeroSpec, seed).rawField
    );
  }
  assert.ok(defaultVsZero > 1.0, 'Calibrated Classic defaults should differ from zero baseline');
});

test('Real-world pattern genes differentiate silhouette params (Enchi flat, Mojave keyhole, GHI irregular, Cypress keyhole)', () => {
  const seed = 0.655;
  const classic = deriveSkinPhenotypeSpec(withGenes({}), seed).params;
  const enchi = deriveSkinPhenotypeSpec(withGenes({ enchi: [1, 0] }), seed).params;
  const mojave = deriveSkinPhenotypeSpec(withGenes({ mojave: [1, 0] }), seed).params;
  const ghi = deriveSkinPhenotypeSpec(withGenes({ ghi: [1, 0] }), seed).params;
  const cypress = deriveSkinPhenotypeSpec(withGenes({ cypress: [1, 0] }), seed).params;

  // Enchi: flat, featureless alien heads
  assert.ok(enchi.crownNotch < classic.crownNotch * 0.25, 'Enchi flattens crownNotch');
  assert.ok(enchi.baseTaper < classic.baseTaper * 0.5, 'Enchi flattens baseTaper');

  // Mojave: strong keyhole base taper & cleaner single-eye crown
  assert.ok(mojave.baseTaper > classic.baseTaper, 'Mojave strengthens keyhole baseTaper');
  assert.ok(mojave.crownNotch < classic.crownNotch, 'Mojave rounds keyhole crown');
  assert.equal(mojave.eyeCount, 1);

  // GHI: erratic misshapen splatters
  assert.ok(ghi.localWidthVariation > classic.localWidthVariation, 'GHI boosts localWidthVariation');
  assert.ok(ghi.regionalCoherence < classic.regionalCoherence, 'GHI lowers regionalCoherence');

  // Cypress: large keyhole alien heads with higher regional coherence
  assert.equal(cypress.eyeCount, 1);
  assert.ok(cypress.regionalCoherence > classic.regionalCoherence, 'Cypress raises regionalCoherence');
});
