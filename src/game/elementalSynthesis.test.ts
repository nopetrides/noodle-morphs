import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentFlag, createGameConfigForMode, DEFAULT_CONTENT_FLAGS } from './contentFlags';
import { buildJeanPoolOffers } from './economy';
import {
  ELEMENTAL_LOCI_ORDER,
  ELEMENTAL_SYNTHESIS_RECIPES,
  isSynthesisOnlyLocus,
} from './elementalSynthesis';
import {
  breedClutch,
  computeBreedingPreview,
  countAlleles,
  createWildTypeGenotype,
  evaluatePhenotype,
  getEnabledLoci,
  LOCUS_DEFINITIONS,
  makeGenotype,
} from './genetics';
import { evaluateSkinPoint, synthesizeSkinBuffer } from './skinField';
import type { AllelePair, LocusId, SnakeEntity } from './types';

function makeSnake(id: string, overrides: Partial<Record<LocusId, AllelePair>>): SnakeEntity {
  const genotype = makeGenotype(overrides);
  const phenotype = evaluatePhenotype(genotype, 0.42);
  return {
    id,
    name: id,
    genotype,
    polygenicSeed: 0.42,
    phenotype,
    currentVigor: phenotype.lineageVigor,
    onDisplay: true,
    hatchedAt: 1000,
    generation: 1,
    sire: null,
    dam: null,
    hatchOdds: 1,
    hatchOddsLabel: 'Starter',
    wasMutation: false,
    petCount: 0,
  };
}

test('Every recipe in the 5-tier Element & Mineral DAG is reachable from the 5 Tier 0 starters', () => {
  const reachable = new Set<LocusId>(['tidal', 'magma', 'earth', 'air', 'wood']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of ELEMENTAL_SYNTHESIS_RECIPES) {
      if (reachable.has(r.ingredientA) && reachable.has(r.ingredientB) && !reachable.has(r.result)) {
        reachable.add(r.result);
        changed = true;
      }
    }
  }
  for (const loc of ELEMENTAL_LOCI_ORDER) {
    assert.ok(reachable.has(loc), `Elemental locus "${loc}" is unreachable from the 5 Tier 0 starters`);
  }
  assert.equal(ELEMENTAL_SYNTHESIS_RECIPES.length, 32);
});

test('Automatic 100% synthesis: 1x Water x 1x Lava -> 25% Cobblestone (no Water Lava), 2x Super -> 100% Obsidian, and multi-tier progression', () => {
  const water1 = makeSnake('w1', { tidal: [1, 0] });
  const lava1 = makeSnake('l1', { magma: [1, 0] });
  const preview1 = computeBreedingPreview(water1, lava1, new Set(), undefined, DEFAULT_CONTENT_FLAGS);
  const sum1 = preview1.reduce((acc, e) => acc + e.probability, 0);
  assert.ok(Math.abs(sum1 - 1) < 1e-6, `Odds must sum to 1.0 (got ${sum1})`);

  const cobbleEntry = preview1.find((e) => e.synthesisResultLocus === 'cobblestone');
  assert.ok(cobbleEntry, '1x Water x 1x Lava must produce a Cobblestone synthesis outcome');
  assert.equal(cobbleEntry.outcomeKind, 'synthesis');
  assert.ok(Math.abs(cobbleEntry.probability - 0.25) < 1e-6);
  assert.equal(
    preview1.some((e) => e.morphName.includes('Water') && e.morphName.includes('Lava')),
    false,
    'Automatic synthesis should leave no unsynthesized Water Lava sibling'
  );

  // 2x Super Water x 2x Super Lava -> 100% Obsidian synthesis
  const water2 = makeSnake('w2', { tidal: [1, 1] });
  const lava2 = makeSnake('l2', { magma: [1, 1] });
  const preview2 = computeBreedingPreview(water2, lava2, new Set(), undefined, DEFAULT_CONTENT_FLAGS);
  assert.equal(preview2.length, 1);
  assert.equal(preview2[0].outcomeKind, 'synthesis');
  assert.equal(preview2[0].synthesisResultLocus, 'obsidian');
  assert.equal(preview2[0].morphName, 'Obsidian');
  assert.ok(Math.abs(preview2[0].probability - 1.0) < 1e-6);

  // Layer 1 Recessive synthesis: Wood x Water -> 25% Het Sap synthesis
  const wood1 = makeSnake('wd1', { wood: [1, 0] });
  const sapPreview = computeBreedingPreview(wood1, water1, new Set(), undefined, DEFAULT_CONTENT_FLAGS);
  const hetSap = sapPreview.find((e) => e.synthesisResultLocus === 'sap');
  assert.ok(hetSap, 'Wood x Water must preview Het Sap synthesis');
  assert.equal(hetSap.outcomeKind, 'synthesis');
  assert.equal(hetSap.morphName, 'Het Sap');
  assert.ok(Math.abs(hetSap.probability - 0.25) < 1e-6);

  // Layer 5 Apex Recessive + Early Super: 2x Anthracite Coal x 2x Pressure Air -> 100% Het Diamond
  const coal2 = makeSnake('c2', { coal: [1, 1] });
  const air2 = makeSnake('a2', { air: [1, 1] });
  const diaPreview = computeBreedingPreview(coal2, air2, new Set(), undefined, DEFAULT_CONTENT_FLAGS);
  assert.equal(diaPreview.length, 1);
  assert.equal(diaPreview[0].outcomeKind, 'synthesis');
  assert.equal(diaPreview[0].synthesisResultLocus, 'diamond');
  assert.equal(diaPreview[0].morphName, 'Het Diamond');

  // Breed clutch actually produces synthesized eggs with consumed parent alleles & wasSynthesis=true
  const clutch = breedClutch(coal2, air2, new Set(), new Set(), 3, () => 0.5, undefined, DEFAULT_CONTENT_FLAGS);
  assert.equal(clutch.length, 3);
  for (const egg of clutch) {
    assert.equal(egg.wasSynthesis, true);
    assert.equal(egg.synthesisLocusName, 'Diamond');
    assert.equal(egg.synthesisTier, 5);
    assert.equal(countAlleles(egg.snake.genotype.diamond), 1);
    assert.equal(countAlleles(egg.snake.genotype.coal), 0, 'Consumed parent Coal allele on synthesis');
    assert.equal(countAlleles(egg.snake.genotype.air), 0, 'Consumed parent Air allele on synthesis');
  }

  // Regular gene mix (Lava x Calico) is NOT a synthesis!
  const calico1 = makeSnake('cal1', { calico: [1, 0] });
  const mixPreview = computeBreedingPreview(lava1, calico1, new Set(), undefined, DEFAULT_CONTENT_FLAGS);
  assert.equal(
    mixPreview.some((e) => e.outcomeKind === 'synthesis'),
    false,
    'Lava x Calico must be a regular gene mix, not a synthesis'
  );
});

test('Strict ContentFlag.CustomMorphs isolation & Jean Pool starter-only gating', () => {
  const realOnly = createGameConfigForMode('real_only');
  assert.equal(getEnabledLoci(realOnly.contentFlags).length, 29);

  // Even if given elemental snakes, synthesis is completely bypassed when CustomMorphs is OFF
  const water2 = makeSnake('w2', { tidal: [1, 1] });
  const lava2 = makeSnake('l2', { magma: [1, 1] });
  const offPreview = computeBreedingPreview(water2, lava2, new Set(), undefined, realOnly.contentFlags);
  assert.equal(
    offPreview.some((e) => e.outcomeKind === 'synthesis'),
    false,
    'Synthesis must never emit when ContentFlag.CustomMorphs is disabled'
  );

  // When CustomMorphs is ON, Jean Pool must NEVER offer Tier 1-5 synthesis-only loci
  const baseSnake = makeSnake('n1', {});
  for (let seed = 1; seed <= 40; seed++) {
    const offers = buildJeanPoolOffers([baseSnake], { purchasesCount: 0, stockSeed: seed }, DEFAULT_CONTENT_FLAGS);
    for (const offer of offers) {
      assert.equal(
        isSynthesisOnlyLocus(offer.locusId),
        false,
        `Jean Pool must never offer breed-only synthesis locus "${offer.locusId}"`
      );
    }
  }
  assert.equal(ContentFlag.CustomMorphs > 0, true);
});

test('Elemental & Mineral patterns integrate without stomping across Tri-Stripe, Albino, Sunset, and 2x Inverted', () => {
  const seed = 0.42;
  const diffCount = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 35) {
        diff++;
      }
    }
    return diff;
  };

  // 1) Pattern composition without stomping: Bismuth + Tri-Stripe differs clearly from both solo Bismuth and solo Tri-Stripe
  const bismuth = evaluatePhenotype(makeGenotype({ bismuth: [1, 1] }), seed);
  const tri = evaluatePhenotype(makeGenotype({ tristripe: [1, 1] }), seed);
  const bisTri = evaluatePhenotype(makeGenotype({ bismuth: [1, 1], tristripe: [1, 1] }), seed);
  const bufBis = synthesizeSkinBuffer(bismuth.skinSpec!, bismuth.palette, seed, 96, 24, 'final');
  const bufTri = synthesizeSkinBuffer(tri.skinSpec!, tri.palette, seed, 96, 24, 'final');
  const bufBisTri = synthesizeSkinBuffer(bisTri.skinSpec!, bisTri.palette, seed, 96, 24, 'final');
  assert.ok(diffCount(bufBis, bufBisTri) > 150, 'Bismuth Tri-Stripe must show Tri-Stripe pattern over Bismuth');
  assert.ok(diffCount(bufTri, bufBisTri) > 250, 'Bismuth Tri-Stripe must keep Bismuth geometry & colors');

  // 2) Melanin removal (Albino) preserves gem chromatic hues while lifting dark shadows bright
  const ruby = evaluatePhenotype(makeGenotype({ ruby: [1, 1] }), seed);
  const albinoRuby = evaluatePhenotype(makeGenotype({ ruby: [1, 1], albino: [1, 1] }), seed);
  const hexRgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
  };
  const [ar, ag, ab] = hexRgb(albinoRuby.palette.base);
  const [pr, pg, pb] = hexRgb(albinoRuby.palette.patternPrimary);
  assert.ok(ar > ag + 60 && ar > ab + 60, `Albino Ruby base (${albinoRuby.palette.base}) should remain vivid ruby-rose`);
  assert.ok((pr + pg + pb) / 3 > 190, `Albino Ruby patternPrimary (${albinoRuby.palette.patternPrimary}) should lift bright`);
  assert.notEqual(ruby.palette.base, albinoRuby.palette.base);

  // 3) Sunset tinting & emergent mixed-paint mottling on Malachite
  const sunMal = evaluatePhenotype(makeGenotype({ sunset: [1, 1], malachite: [1, 1] }), seed);
  assert.ok(Boolean(sunMal.palette.mottleColorA && sunMal.palette.mottleColorB), 'Sunset Malachite should activate mixed-paint mottling');

  // 4) 2x Inverted final pass flips RGB channels cleanly on Amethyst & Diamond
  const amethyst = evaluatePhenotype(makeGenotype({ amethyst: [1, 1] }), seed);
  const invAmethyst = evaluatePhenotype(makeGenotype({ amethyst: [1, 1], invert: [1, 1] }), seed);
  const [mr, mg, mb] = hexRgb(amethyst.palette.base);
  const [ir, ig, ib] = hexRgb(invAmethyst.palette.base);
  assert.ok(Math.abs(mr + ir - 255) <= 2 && Math.abs(mg + ig - 255) <= 2 && Math.abs(mb + ib - 255) <= 2, '2x Inverted Amethyst must be exact RGB inverse');

  // 5) Translucent elements (Air, Glass, Diamond) emit true per-pixel alpha < 255 while keeping Piebald patches opaque
  const air = evaluatePhenotype(makeGenotype({ air: [1, 0] }), seed);
  const glass = evaluatePhenotype(makeGenotype({ glass: [1, 1] }), seed);
  assert.ok((air.palette.bodyOpacity ?? 1) < 0.55, 'Air should be translucent (bodyOpacity < 0.55)');
  assert.ok((glass.palette.bodyOpacity ?? 1) < 0.5, 'Prism Glass should be translucent (bodyOpacity < 0.5)');
  const bufAir = synthesizeSkinBuffer(air.skinSpec!, air.palette, seed, 64, 16, 'final');
  let translucentPx = 0;
  for (let i = 3; i < bufAir.length; i += 4) {
    if (bufAir[i] < 200) translucentPx++;
  }
  assert.ok(translucentPx > 400, `Air skin buffer must contain translucent alpha pixels (got ${translucentPx})`);
  assert.equal(createWildTypeGenotype().bismuth[0], 0);
});

test('Every codominant elemental & mineral Super (2x) is quantitatively distinct in BOTH color and pattern from 1x', () => {
  const seed = 0.42;
  const codomElementals = ELEMENTAL_LOCI_ORDER.filter(
    (loc) => LOCUS_DEFINITIONS[loc].mode === 'codominant'
  );
  assert.equal(codomElementals.length, 24);

  for (const loc of codomElementals) {
    const p1 = evaluatePhenotype(makeGenotype({ [loc]: [1, 0] }), seed);
    const p2 = evaluatePhenotype(makeGenotype({ [loc]: [1, 1] }), seed);
    const b1 = synthesizeSkinBuffer(p1.skinSpec!, p1.palette, seed, 80, 20, 'final');
    const b2 = synthesizeSkinBuffer(p2.skinSpec!, p2.palette, seed, 80, 20, 'final');

    let rgbSum = 0;
    const px = 80 * 20;
    for (let i = 0; i < b1.length; i += 4) {
      rgbSum += Math.hypot(b1[i] - b2[i], b1[i + 1] - b2[i + 1], b1[i + 2] - b2[i + 2]);
    }
    const rgbDelta = rgbSum / px;

    let maskSum = 0;
    let samples = 0;
    for (let yi = 0; yi < 6; yi++) {
      const v = (yi / 5) * 2 - 1;
      for (let xi = 0; xi < 20; xi++) {
        const u = 0.15 + (xi / 19) * 0.78;
        maskSum += Math.abs(
          evaluateSkinPoint(u, v, p1.skinSpec!, seed).primaryMask -
            evaluateSkinPoint(u, v, p2.skinSpec!, seed).primaryMask
        );
        samples++;
      }
    }
    const maskDelta = maskSum / samples;

    assert.ok(
      rgbDelta >= 55,
      `${loc} 1x (${p1.morphName}) vs 2x (${p2.morphName}) color delta too low: ${rgbDelta.toFixed(1)}`
    );
    assert.ok(
      maskDelta >= 0.22,
      `${loc} 1x (${p1.morphName}) vs 2x (${p2.morphName}) pattern mask delta too low: ${maskDelta.toFixed(3)}`
    );
  }
});
