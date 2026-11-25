import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustGeneBiasWeights,
  analyzeSaleWarnings,
  BASE_GLOBAL_VIGOR,
  BREED_VIGOR_COST,
  buildJeanPoolOffers,
  canAfford,
  clampUint,
  computeBreedTimeMultiplier,
  computePairBreedDurationSec,
  createDefaultHissDepotState,
  evaluateSnakeSaleValue,
  getActiveClutchConfig,
  getBiasCapUpgradePrice,
  getDisplaySlotUpgradePrice,
  getIncubatorUpgradePrice,
  getJeanPoolOfferPrice,
  getMaxVigor,
  getMissingLoci,
  hasTriplicateMorph,
  isHissDepotUnlocked,
  isJeanPoolUnlocked,
  recoverSnakesVigor,
  safeAddCurrency,
  safeSpendCurrency,
} from './economy';
import {
  computeBreedingPreview,
  countAlleles,
  createRandomStarterPair,
  createStarterSnakes,
  evaluatePhenotype,
  formatMutationOddsText,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  makeGenotype,
  MUTATION_CHANCE_PER_EGG,
} from './genetics';
import type { SnakeEntity } from './types';

test('Unsigned int currency math prevents decimals, underflow, negative costs, and unaffordable purchases', () => {
  assert.equal(clampUint(-50), 0);
  assert.equal(clampUint(12.9), 12);
  assert.equal(clampUint(Number.NaN), 0);

  assert.equal(canAfford(50, 51), false);
  assert.equal(canAfford(50, 50), true);
  assert.equal(canAfford(50, -10), false);

  const failSpend = safeSpendCurrency(40, 100);
  assert.equal(failSpend.ok, false);
  assert.equal(failSpend.nextBalance, 40);

  const negSpend = safeSpendCurrency(40, -5);
  assert.equal(negSpend.ok, false);
  assert.equal(negSpend.nextBalance, 40);

  const okSpend = safeSpendCurrency(100, 35.8);
  assert.equal(okSpend.ok, true);
  assert.equal(okSpend.nextBalance, 65);

  const overflowAdd = safeAddCurrency(Number.MAX_SAFE_INTEGER - 5, 100);
  assert.equal(overflowAdd, Number.MAX_SAFE_INTEGER);
});

test('Vigour allows 5 baseline clutches, clamps low-vigor morphs to >=1 clutch, and scales breed time X in [0.5, 2.0]', () => {
  const starters = createStarterSnakes();
  const baseSnake: SnakeEntity = {
    ...starters[0],
    phenotype: { ...starters[0].phenotype, lineageVigor: BASE_GLOBAL_VIGOR },
    currentVigor: BASE_GLOBAL_VIGOR,
  };
  assert.equal(Math.floor(getMaxVigor(baseSnake) / BREED_VIGOR_COST), 5);

  // Even an ultra-low vigor snake clamps max vigor >= BREED_VIGOR_COST so it can always breed once
  const ultraLow: SnakeEntity = {
    ...starters[0],
    phenotype: { ...starters[0].phenotype, lineageVigor: 5 },
    currentVigor: 20,
  };
  assert.ok(getMaxVigor(ultraLow) >= BREED_VIGOR_COST);

  // Equal to global base vigor -> X = 1.0 -> 120s base breed time
  const depot = createDefaultHissDepotState();
  assert.equal(computeBreedTimeMultiplier(baseSnake, baseSnake), 1);
  assert.equal(computePairBreedDurationSec(baseSnake, baseSnake, depot), 120);

  // Higher than base vigor -> faster (clamped at 0.5)
  const highVigor: SnakeEntity = { ...baseSnake, currentVigor: 250 };
  assert.equal(computeBreedTimeMultiplier(highVigor, highVigor), 0.5);

  // Lower than base vigor -> slower (clamped at 2.0), governed by lower of the two parents
  const lowVigor: SnakeEntity = { ...baseSnake, currentVigor: 40 };
  assert.equal(computeBreedTimeMultiplier(highVigor, lowVigor), 2.0);
  assert.equal(computePairBreedDurationSec(highVigor, lowVigor, depot), 240);

  // Vigour recovers when not actively breeding
  const tired = [{ ...baseSnake, currentVigor: 10 }];
  const recovered = recoverSnakesVigor(tired, new Set(), 40);
  assert.equal(recovered[0].currentVigor, 20);
  const breeding = recoverSnakesVigor(tired, new Set([baseSnake.id]), 40);
  assert.equal(breeding[0].currentVigor, 10);
});

test('Valuation applies obvious First-Sale Bonus and Last-Two safety warnings catch rare genes & 2-snake floor', () => {
  const starters = createStarterSnakes();
  const firstSale = evaluateSnakeSaleValue(starters[0], new Set());
  const repeatSale = evaluateSnakeSaleValue(starters[0], new Set([starters[0].phenotype.morphKey]));

  assert.equal(firstSale.isFirstSale, true);
  assert.ok(firstSale.firstSaleBonus > 0);
  assert.ok(firstSale.total > repeatSale.total);
  assert.equal(repeatSale.isFirstSale, false);
  assert.equal(repeatSale.firstSaleBonus, 0);

  // With only 2 snakes total, selling must be blocked
  const twoOnly = starters.slice(0, 2);
  const blocked = analyzeSaleWarnings(twoOnly[0], twoOnly, twoOnly[0].id, twoOnly[1].id);
  assert.equal(blocked.canSell, false);
  assert.equal(blocked.hasWarning, true);

  // With 4 starters, Biscuit is the ONLY Pastel carrier -> must trigger big warning
  const warn = analyzeSaleWarnings(starters[0], starters, starters[2].id, starters[3].id);
  assert.equal(warn.canSell, true);
  assert.equal(warn.hasWarning, true);
  assert.ok(warn.reasons.some((r) => r.includes('Pastel')));
});

test('The Jean Pool only offers missing single-gene snakes, escalates price, and empties when all genes owned', () => {
  const starters = createStarterSnakes();
  const offers = buildJeanPoolOffers(starters, { purchasesCount: 0, stockSeed: 42 });
  assert.equal(offers.length, 3);

  const missingSet = new Set(getMissingLoci(starters));
  for (const offer of offers) {
    assert.ok(missingSet.has(offer.locusId), `Offer ${offer.locusId} must be a missing gene`);
    const activeCount = LOCI_ORDER.filter((l) => countAlleles(offer.snake.genotype[l]) > 0).length;
    assert.equal(activeCount, 1, 'Each Jean Pool snake must introduce strictly one missing gene');
  }

  // Price escalates with each purchase
  const p0 = getJeanPoolOfferPrice('banana', 0);
  const p1 = getJeanPoolOfferPrice('banana', 1);
  const p2 = getJeanPoolOfferPrice('banana', 2);
  assert.ok(p1 > p0 && p2 > p1);

  // If player owns every locus, Jean Pool offers nothing new
  const allGeneOverrides: Record<string, [0 | 1, 0 | 1]> = {};
  for (const loc of LOCI_ORDER) allGeneOverrides[loc] = [1, 0];
  const omniGeno = makeGenotype(allGeneOverrides);
  const omniSnake: SnakeEntity = {
    ...starters[0],
    genotype: omniGeno,
    phenotype: evaluatePhenotype(omniGeno, 0.5),
  };
  assert.equal(buildJeanPoolOffers([omniSnake], { purchasesCount: 0, stockSeed: 42 }).length, 0);
});

test('The Hiss Depot scales upgrade prices independently, sets incubator range, and self-balances gene bias to 100%', () => {
  assert.ok(getIncubatorUpgradePrice(1) > getIncubatorUpgradePrice(0));
  assert.ok(getDisplaySlotUpgradePrice(1) > getDisplaySlotUpgradePrice(0));
  assert.ok(getBiasCapUpgradePrice(1) > getBiasCapUpgradePrice(0));

  const depot = createDefaultHissDepotState();
  depot.incubatorMaxLevel = 2;
  depot.incubatorActiveLevel = 0;
  assert.deepEqual(getActiveClutchConfig(depot), { clutchSize: 2, baseBreedSec: 120 });
  depot.incubatorActiveLevel = 2;
  assert.deepEqual(getActiveClutchConfig(depot), { clutchSize: 4, baseBreedSec: 240 });

  // Self-balancing gene bias: raising recessive diminishes dominant & codominant so total stays 100%
  const caps = { dominant: 2, codominant: 1, recessive: 3 };
  const adjusted = adjustGeneBiasWeights(depot.biasWeights, caps, 'recessive', 60);
  const sum = adjusted.dominant + adjusted.codominant + adjusted.recessive;
  assert.ok(Math.abs(sum - 100) < 0.05, `Expected sum 100, got ${sum}`);
  assert.ok(adjusted.recessive > 55);
  assert.ok(adjusted.dominant < 33 && adjusted.codominant < 33);
});

test('Real-world ball python complexes (Black-Eyed Leucistic, Ivory, 8-Ball, Banana, Lavender Albino) & random 2-starter pair work', () => {
  assert.equal(evaluatePhenotype(makeGenotype({ fire: [1, 1] })).morphName, 'Black-Eyed Leucistic');
  assert.equal(evaluatePhenotype(makeGenotype({ yellowbelly: [1, 1] })).morphName, 'Ivory');
  assert.equal(evaluatePhenotype(makeGenotype({ blackpastel: [1, 1] })).morphName, '8-Ball');
  assert.equal(evaluatePhenotype(makeGenotype({ banana: [1, 0] })).morphName, 'Banana');
  assert.equal(
    evaluatePhenotype(makeGenotype({ lavenderalbino: [1, 1] })).morphName,
    'Lavender Albino'
  );

  // Verify hardened Classic 2+1 starter pair across 50 deterministic seeds
  let seed = 1337;
  const lcg = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 50; i++) {
    const pair = createRandomStarterPair(lcg);
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0].phenotype.morphKey, pair[1].phenotype.morphKey);

    // Never starts handicapped with Spider
    assert.equal(pair[0].genotype.spider[0] + pair[0].genotype.spider[1], 0);
    assert.equal(pair[1].genotype.spider[0] + pair[1].genotype.spider[1], 0);

    // At least one starter carries a Codominant gene for Gen-2 Super potential
    const hasCodom = pair.some((s) =>
      LOCI_ORDER.some(
        (loc) =>
          LOCUS_DEFINITIONS[loc].mode === 'codominant' &&
          s.genotype[loc][0] + s.genotype[loc][1] > 0
      )
    );
    assert.equal(hasCodom, true);

    // No accidental Mojave x Lesser BEL shortcut on Clutch #1
    const hasMojave = pair.some((s) => s.genotype.mojave[0] + s.genotype.mojave[1] > 0);
    const hasLesser = pair.some((s) => s.genotype.lesser[0] + s.genotype.lesser[1] > 0);
    assert.equal(hasMojave && hasLesser, false);

    // Both share 1 recessive Het -> always produces exactly 8 Mendelian visual outcomes
    assert.equal(pair[0].phenotype.hetGenes.length, 1);
    assert.deepEqual(pair[0].phenotype.hetGenes, pair[1].phenotype.hetGenes);
    const preview = computeBreedingPreview(pair[0], pair[1]);
    assert.equal(preview.length, 8);
  }
});

test('Mutation rate is 1 in 1,000, progression gates unlock in order, and sale values align with Jean Pool pricing', () => {
  assert.equal(MUTATION_CHANCE_PER_EGG, 0.001);
  assert.ok(formatMutationOddsText().includes('1 in 1,000'));

  const starters = createRandomStarterPair();
  assert.equal(hasTriplicateMorph(starters), false);
  const withDuplicate: SnakeEntity[] = [
    ...starters,
    { ...starters[0], id: 'second_copy' },
  ];
  assert.equal(hasTriplicateMorph(withDuplicate), false);
  const withTriplicate: SnakeEntity[] = [
    ...withDuplicate,
    { ...starters[0], id: 'third_copy' },
  ];
  assert.equal(hasTriplicateMorph(withTriplicate), true);

  const freshEco = {
    money: 0,
    totalSnakesSold: 0,
    soldMorphKeys: [],
    sellUnlocked: false,
    jeanPoolIntroSeen: false,
    jeanPool: { purchasesCount: 0, cooldownRemainingSec: 0, stockSeed: 7 },
    hissDepot: createDefaultHissDepotState(),
  };
  assert.equal(isJeanPoolUnlocked(freshEco), false);
  assert.equal(isHissDepotUnlocked(freshEco), false);

  const afterFirstSale = { ...freshEco, totalSnakesSold: 1, sellUnlocked: true };
  assert.equal(isJeanPoolUnlocked(afterFirstSale), true);
  assert.equal(isHissDepotUnlocked(afterFirstSale), false);

  const afterJeanBuy = {
    ...afterFirstSale,
    jeanPool: { ...afterFirstSale.jeanPool, purchasesCount: 1 },
  };
  assert.equal(isHissDepotUnlocked(afterJeanBuy), true);

  // Common starter extra sale value stays modest compared to first Jean Pool breeder
  const commonSale = evaluateSnakeSaleValue(starters[0], new Set());
  const firstJeanPrice = getJeanPoolOfferPrice('banana', 0);
  assert.ok(commonSale.baseValue < 65, `Expected common base value < 65, got ${commonSale.baseValue}`);
  assert.ok(firstJeanPrice >= 85, `Expected first Jean Pool offer >= 85, got ${firstJeanPrice}`);
});
