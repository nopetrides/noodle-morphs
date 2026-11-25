import test from 'node:test';
import assert from 'node:assert/strict';
import {
  breedClutch,
  buildInitialDiscoveries,
  createStarterSnakes,
} from './genetics';
import {
  decodeSaveStateV2,
  encodeSaveStateV2,
  findInMorphTree,
} from './storage';
import type { SnakeEntity } from './types';

test('Compact morph-tree v2 save groups snakes by genotype, omits per-snake onDisplay, and preserves names and modified vigor', () => {
  const starters = createStarterSnakes();
  // Create a custom-named snake with modified lineage vigor
  const customBiscuit: SnakeEntity = {
    ...starters[0],
    name: 'Honeybun',
    petCount: 7,
    phenotype: {
      ...starters[0].phenotype,
      lineageVigor: 91, // modified from default 100
    },
  };

  // Clone another snake with the exact same genotype to verify morph-tree compaction
  const siblingBiscuit: SnakeEntity = {
    ...starters[0],
    id: 'sibling_pastel_1',
    name: 'Waffles',
    onDisplay: false,
    hatchedAt: starters[0].hatchedAt + 5000,
    generation: 2,
    sire: { id: customBiscuit.id, name: customBiscuit.name, morphName: customBiscuit.phenotype.morphName },
    dam: { id: starters[1].id, name: starters[1].name, morphName: starters[1].phenotype.morphName },
    hatchOdds: 0.25,
    hatchOddsLabel: '1 in 4 · 25%',
  };

  const snakes = [siblingBiscuit, customBiscuit, starters[1], starters[2], starters[3]];
  const discoveries = buildInitialDiscoveries(snakes);
  const displayedIds = [customBiscuit.id, starters[1].id];

  const encoded = encodeSaveStateV2({
    snakes,
    displayedIds,
    discoveries,
    sireId: customBiscuit.id,
    damId: starters[1].id,
    clutchDurationSec: 30,
    clutchRemainingSec: 12,
    clutchesHatched: 3,
    settings: { heatLampOn: true, muted: false },
  }, 1_700_000_000_000);

  // Verify morph search tree groups both Pastel het Albino snakes under the exact same leaf node
  const matchingLeaves = findInMorphTree(encoded.tree, customBiscuit.genotype);
  assert.equal(matchingLeaves.length, 2, 'Two snakes with identical genotype should share one trie leaf');

  // Verify no per-snake `onDisplay` boolean exists anywhere in the serialized tree
  const serializedTree = JSON.stringify(encoded.tree);
  assert.equal(serializedTree.includes('onDisplay'), false, 'Tree must not store per-snake onDisplay booleans');
  assert.deepEqual(encoded.disp, displayedIds, 'Terrarium manager display IDs stored once at root');

  // Verify modified vigor is stored ONLY on the snake whose vigor differs from default
  const honeybunLeaf = matchingLeaves.find((l) => l.i === customBiscuit.id);
  const wafflesLeaf = matchingLeaves.find((l) => l.i === siblingBiscuit.id);
  assert.equal(honeybunLeaf?.v, 91);
  assert.equal(wafflesLeaf?.v, undefined, 'Default vigor must not be redundantly stored');

  // Decode and verify full round-trip fidelity
  const decoded = decodeSaveStateV2(encoded, 1_700_000_005_000);
  assert.ok(decoded, 'Decoded state should be valid');
  assert.equal(decoded.snakes.length, 5);
  assert.equal(decoded.clutchRemainingSec, 7, 'Idle elapsed time (5s) should be subtracted');

  const decodedHoneybun = decoded.snakes.find((s) => s.id === customBiscuit.id);
  const decodedWaffles = decoded.snakes.find((s) => s.id === siblingBiscuit.id);
  assert.equal(decodedHoneybun?.name, 'Honeybun');
  assert.equal(decodedHoneybun?.phenotype.lineageVigor, 91);
  assert.equal(decodedHoneybun?.petCount, 7);
  assert.equal(decodedHoneybun?.onDisplay, true);

  assert.equal(decodedWaffles?.name, 'Waffles');
  assert.equal(decodedWaffles?.onDisplay, false);
  assert.equal(decodedWaffles?.sire?.name, 'Honeybun');
  assert.equal(decodedWaffles?.dam?.id, starters[1].id);
  assert.equal(decodedWaffles?.phenotype.morphName, 'Pastel');
});

test('Compact morph-tree v2 save is dramatically smaller than flat v1 serialization', () => {
  const starters = createStarterSnakes();
  let snakes = [...starters];
  const discovered = new Set(snakes.map((s) => s.phenotype.morphKey));
  const names = new Set(snakes.map((s) => s.name));
  let seed = 1337;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Breed 12 clutches (36 more snakes = 40 total)
  for (let c = 0; c < 12; c++) {
    const eggs = breedClutch(snakes[0], snakes[1], discovered, names, 3, rng);
    for (const egg of eggs) {
      snakes.unshift(egg.snake);
      discovered.add(egg.snake.phenotype.morphKey);
      names.add(egg.snake.name);
    }
  }

  const discoveries = buildInitialDiscoveries(snakes);
  const flatV1Size = JSON.stringify({
    version: 1,
    snakes,
    discoveries,
    sireId: snakes[0].id,
    damId: snakes[1].id,
    clutchDurationSec: 30,
    clutchRemainingSec: 15,
    clutchesHatched: 12,
    settings: { heatLampOn: true, muted: false },
    savedAt: Date.now(),
  }).length;

  const compactV2Size = JSON.stringify(
    encodeSaveStateV2({
      snakes,
      discoveries,
      sireId: snakes[0].id,
      damId: snakes[1].id,
      clutchDurationSec: 30,
      clutchRemainingSec: 15,
      clutchesHatched: 12,
      settings: { heatLampOn: true, muted: false },
    })
  ).length;

  assert.ok(
    compactV2Size < flatV1Size * 0.25,
    `Expected compact v2 (${compactV2Size}B) to be <25% of flat v1 (${flatV1Size}B)`
  );
});
