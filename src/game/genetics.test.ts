import test from 'node:test';
import assert from 'node:assert/strict';
import {
  breedClutch,
  computeBreedingPreview,
  createSimulatedSnake,
  createStarterSnakes,
  derivePatternRule,
  evaluatePhenotype,
  isBlueEyedLeucistic,
  makeGenotype,
} from './genetics';

test('Spider gene produces upside-down Dinnerbone posture and lineage vigor penalty', () => {
  const spiderGeno = makeGenotype({ spider: [1, 0] });
  const pheno = evaluatePhenotype(spiderGeno, 0.3);

  assert.equal(pheno.isUpsideDown, true);
  assert.equal(pheno.behavior, 'dinnerbone_wobble');
  assert.ok(pheno.lineageVigor < 100, 'Spider should apply a gentle lineage vigor penalty');
  assert.match(pheno.morphName, /Spider/);
});

test('Blue-Eyed Leucistic and Albinism are distinct traits with different palettes and predispositions', () => {
  const belGeno = makeGenotype({ mojave: [1, 0], lesser: [1, 0] });
  const albinoGeno = makeGenotype({ albino: [1, 1] });

  assert.equal(isBlueEyedLeucistic(belGeno), true);
  assert.equal(isBlueEyedLeucistic(albinoGeno), false);

  const belPheno = evaluatePhenotype(belGeno, 0.4);
  const albinoPheno = evaluatePhenotype(albinoGeno, 0.4);

  assert.equal(belPheno.morphName, 'Blue-Eyed Leucistic');
  assert.equal(belPheno.palette.isLeucistic, true);
  assert.equal(belPheno.palette.isAlbino, false);
  assert.equal(belPheno.behavior, 'basking_lounger');

  assert.equal(albinoPheno.morphName, 'Albino');
  assert.equal(albinoPheno.palette.isAlbino, true);
  assert.equal(albinoPheno.palette.isLeucistic, false);
  assert.equal(albinoPheno.behavior, 'shade_seeker');
  assert.notEqual(belPheno.palette.eyeIris, albinoPheno.palette.eyeIris);
  assert.notEqual(belPheno.healthPredisposition, albinoPheno.healthPredisposition);
});

test('Recessive genes stay hidden as Het carriers until homozygous', () => {
  const hetAlbino = evaluatePhenotype(makeGenotype({ albino: [1, 0] }), 0.2);
  assert.equal(hetAlbino.morphName, 'Classic Normal');
  assert.deepEqual(hetAlbino.hetGenes, ['Albino']);
  assert.equal(hetAlbino.palette.isAlbino, false);

  const visualAlbino = evaluatePhenotype(makeGenotype({ albino: [1, 1] }), 0.2);
  assert.equal(visualAlbino.morphName, 'Albino');
  assert.deepEqual(visualAlbino.hetGenes, []);
  assert.equal(visualAlbino.palette.isAlbino, true);
});

test('Modular pattern rules generate alien_heads for wild-type/color morphs, authentic real-world patterns, and preserved Custom genes', () => {
  const rule = derivePatternRule(makeGenotype({ pinstripe: [1, 0], spider: [1, 0] }), 0.25);
  assert.equal(rule.motif, 'lines');
  assert.equal(rule.weight, 'thin');
  assert.equal(rule.modifier, 'dotted');
  assert.equal(rule.formula, '(lines) (thin) (dotted)');
  assert.equal(rule.glyph, '-o-o-o-');
  assert.equal(rule.isCustomPattern, false);

  // Classic Normal and color-only morphs (Pastel, Fire, Albino) keep authentic wild-type alien_heads
  for (let i = 0; i < 12; i++) {
    const seed = i / 12;
    const pastelRule = derivePatternRule(makeGenotype({ pastel: [1, 0] }), seed);
    assert.equal(pastelRule.motif, 'alien_heads');
    assert.equal(pastelRule.weight, 'blushed');
    assert.equal(pastelRule.isCustomPattern, false);

    const normalRule = derivePatternRule(makeGenotype({}), seed);
    assert.equal(normalRule.motif, 'alien_heads');
    assert.equal(normalRule.isCustomPattern, false);
  }

  // Authentic real-world pattern mutations
  assert.equal(derivePatternRule(makeGenotype({ mojave: [1, 0] }), 0.4).motif, 'keyholes');
  assert.equal(derivePatternRule(makeGenotype({ enchi: [1, 0] }), 0.4).motif, 'banded');
  assert.equal(derivePatternRule(makeGenotype({ clown: [1, 1] }), 0.4).motif, 'dorsal_stripe');
  assert.equal(derivePatternRule(makeGenotype({ ghi: [1, 0] }), 0.4).motif, 'inkblot');

  // Preserved original motifs live under Custom-tagged Morpharium genes
  const saddler = evaluatePhenotype(makeGenotype({ saddler: [1, 0] }), 0.4);
  assert.equal(saddler.patternRule.motif, 'saddles');
  assert.equal(saddler.patternRule.isCustomPattern, true);
  assert.equal(saddler.isCustomMorph, true);
  assert.ok(saddler.tags.includes('Custom'));

  const bullring = evaluatePhenotype(makeGenotype({ bullring: [1, 0] }), 0.4);
  assert.equal(bullring.patternRule.motif, 'rings');
  assert.equal(bullring.isCustomMorph, true);

  const chevron = evaluatePhenotype(makeGenotype({ chevron: [1, 0] }), 0.4);
  assert.equal(chevron.patternRule.motif, 'chevrons');
  assert.equal(chevron.isCustomMorph, true);

  const raindrop = evaluatePhenotype(makeGenotype({ raindrop: [1, 1] }), 0.4);
  assert.equal(raindrop.patternRule.motif, 'teardrops');
  assert.equal(raindrop.isCustomMorph, true);

  const crossbar = evaluatePhenotype(makeGenotype({ crossbar: [1, 0] }), 0.4);
  assert.equal(crossbar.patternRule.motif, 'bars');
  assert.equal(crossbar.patternRule.isCustomPattern, true);
  assert.equal(crossbar.isCustomMorph, true);
  assert.ok(crossbar.tags.includes('Custom'));

  const trackline = evaluatePhenotype(makeGenotype({ trackline: [1, 0] }), 0.4);
  assert.equal(trackline.patternRule.motif, 'tracks');
  assert.equal(trackline.patternRule.isCustomPattern, true);
  assert.equal(trackline.isCustomMorph, true);
  assert.ok(trackline.tags.includes('Custom'));

  // Calico adds high-white flank splashes via palette.isCalico without clobbering underlying alien_heads
  const calico = evaluatePhenotype(makeGenotype({ calico: [1, 0] }), 0.4);
  assert.equal(calico.palette.isCalico, true);
  assert.equal(calico.patternRule.motif, 'alien_heads');
  assert.equal(calico.isCustomMorph, false);

  // Authentic Enchi keeps banded motif with flamed golden sides
  const enchi = evaluatePhenotype(makeGenotype({ enchi: [1, 0] }), 0.4);
  assert.equal(enchi.patternRule.motif, 'banded');
  assert.equal(enchi.patternRule.modifier, 'flamed');
  assert.equal(enchi.isCustomMorph, false);
});

test('Custom elemental Lava + Water breeds into Cobblestone (and homozygous into Obsidian Cobblestone)', () => {
  const lavaPheno = evaluatePhenotype(makeGenotype({ magma: [1, 0] }), 0.3);
  const waterPheno = evaluatePhenotype(makeGenotype({ tidal: [1, 0] }), 0.5);
  assert.equal(lavaPheno.morphName, 'Lava');
  assert.equal(lavaPheno.patternRule.motif, 'magma_cracks');
  assert.equal(lavaPheno.isCustomMorph, true);
  assert.ok(lavaPheno.tags.includes('Custom'));

  assert.equal(waterPheno.morphName, 'Water');
  assert.equal(waterPheno.patternRule.motif, 'ripples');
  assert.equal(waterPheno.isCustomMorph, true);
  assert.ok(waterPheno.tags.includes('Custom'));

  const lavaSnake = {
    id: 'lava_1',
    name: 'Ember',
    genotype: makeGenotype({ magma: [1, 0] }),
    polygenicSeed: 0.3,
    phenotype: lavaPheno,
    currentVigor: lavaPheno.lineageVigor,
    onDisplay: true,
    hatchedAt: 1,
    generation: 1,
    sire: null,
    dam: null,
    hatchOdds: 1,
    hatchOddsLabel: 'Founder',
    wasMutation: false,
    petCount: 0,
  };
  const waterSnake = {
    id: 'water_1',
    name: 'Brook',
    genotype: makeGenotype({ tidal: [1, 0] }),
    polygenicSeed: 0.5,
    phenotype: waterPheno,
    currentVigor: waterPheno.lineageVigor,
    onDisplay: true,
    hatchedAt: 2,
    generation: 1,
    sire: null,
    dam: null,
    hatchOdds: 1,
    hatchOddsLabel: 'Founder',
    wasMutation: false,
    petCount: 0,
  };

  // Punnett preview of Lava [1,0] x Water [1,0] yields 25% Cobblestone!
  const preview = computeBreedingPreview(lavaSnake, waterSnake);
  const cobbleOutcome = preview.find((o) => o.morphName === 'Cobblestone');
  assert.ok(cobbleOutcome, 'Expected Lava x Water to include Cobblestone outcome');
  assert.ok(Math.abs(cobbleOutcome.probability - 0.25) < 1e-6);

  const cobblePheno = evaluatePhenotype(makeGenotype({ magma: [1, 0], tidal: [1, 0] }), 0.4);
  assert.equal(cobblePheno.morphName, 'Cobblestone');
  assert.equal(cobblePheno.patternRule.motif, 'cobblestone');
  assert.equal(cobblePheno.patternRule.isCustomPattern, true);
  assert.equal(cobblePheno.isCustomMorph, true);
  assert.equal(cobblePheno.rarity, 'rare');
  assert.ok(cobblePheno.tags.includes('Custom'));
  assert.ok(cobblePheno.tags.includes('Complex'));

  const obsidianPheno = evaluatePhenotype(makeGenotype({ magma: [1, 1], tidal: [1, 1] }), 0.4);
  assert.equal(obsidianPheno.morphName, 'Obsidian Cobblestone');
  assert.equal(obsidianPheno.patternRule.motif, 'cobblestone');
  assert.equal(obsidianPheno.rarity, 'legendary');

  // Simulator helper creates playable Super Water & Super Lava snakes that guarantee 100% Cobblestone!
  const superWater = createSimulatedSnake(makeGenotype({ tidal: [1, 1] }), 0.42, new Set());
  const superLava = createSimulatedSnake(makeGenotype({ magma: [1, 1] }), 0.42, new Set([superWater.name]));
  assert.equal(superWater.phenotype.morphName, 'Super Water');
  assert.equal(superLava.phenotype.morphName, 'Super Lava');
  const guaranteedPreview = computeBreedingPreview(superWater, superLava);
  assert.equal(guaranteedPreview.length, 1);
  assert.equal(guaranteedPreview[0].morphName, 'Cobblestone');
  assert.ok(Math.abs(guaranteedPreview[0].probability - 1) < 1e-6);
});

test('Punnett square odds sum to 1.0 and recessive outcomes have exact 25% odds for het x het', () => {
  const starters = createStarterSnakes();
  // Biscuit (Pastel het Albino) x Mochi (Mojave het Albino)
  const biscuit = starters[0];
  const mochi = starters[1];

  const preview = computeBreedingPreview(biscuit, mochi);
  const totalProb = preview.reduce((sum, entry) => sum + entry.probability, 0);
  assert.ok(Math.abs(totalProb - 1) < 1e-6, `Expected total probability 1, got ${totalProb}`);

  const albinoProb = preview
    .filter((entry) => entry.morphName.includes('Albino'))
    .reduce((sum, entry) => sum + entry.probability, 0);
  assert.ok(Math.abs(albinoProb - 0.25) < 1e-6, `Expected 25% Albino total odds, got ${albinoProb}`);
});

test('breedClutch produces deterministic clutch with parent lineage and valid odds', () => {
  const starters = createStarterSnakes();
  let state = 42;
  const deterministicRng = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };

  const eggs = breedClutch(
    starters[0],
    starters[1],
    new Set(starters.map((s) => s.phenotype.morphKey)),
    new Set(starters.map((s) => s.name)),
    3,
    deterministicRng
  );

  assert.equal(eggs.length, 3);
  for (const egg of eggs) {
    assert.equal(egg.revealed, false);
    assert.ok(egg.odds > 0 && egg.odds <= 1);
    assert.equal(egg.snake.sire?.id, starters[0].id);
    assert.equal(egg.snake.dam?.id, starters[1].id);
    assert.equal(egg.snake.generation, 2);
  }
});
