import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialDiscoveries, createStarterSnakes } from './genetics';
import {
  countUndiscoveredChildren,
  sortCollectionSnakes,
  sortMorphDiscoveries,
  sortParentCandidates,
} from './sorting';

test('Parent sorting by undiscovered offspring ranks highest-discovery mate first', () => {
  const starters = createStarterSnakes();
  // Starters: [0] Biscuit (Pastel het Albino), [1] Mochi (Mojave het Albino),
  // [2] Tumble (Spider Pinstripe het Piebald), [3] Clover (Lesser het Piebald)
  const discoveredKeys = new Set(starters.map((s) => s.phenotype.morphKey));

  // With Biscuit (Pastel het Albino) fixed in Parent A:
  // Pairing with Tumble (Spider + Pinstripe) has 2^3 = 8 combinations (6 undiscovered!)
  // Pairing with Mochi (Mojave + shared het Albino) has 8 combinations (6 undiscovered)
  // Pairing with Clover (Lesser) has 4 combinations (2 undiscovered: Pastel Lesser, Classic Normal)
  const sortedForBiscuit = sortParentCandidates(starters, 'undiscovered', starters[0], discoveredKeys);

  assert.equal(
    sortedForBiscuit[sortedForBiscuit.length - 1].id,
    starters[0].id,
    'Selected partner itself should be placed last'
  );
  const topScore = countUndiscoveredChildren(sortedForBiscuit[0], starters[0], discoveredKeys);
  const cloverScore = countUndiscoveredChildren(starters[3], starters[0], discoveredKeys);
  assert.ok(
    topScore > cloverScore,
    `Expected top-ranked mate (${topScore} undiscovered) to beat Clover (${cloverScore} undiscovered)`
  );
});

test('Collection and Morphdex sorting modes order deterministically by name, morph, and rarity', () => {
  const starters = createStarterSnakes();
  const byName = sortCollectionSnakes(starters, 'name');
  assert.deepEqual(
    byName.map((s) => s.name),
    ['Biscuit', 'Clover', 'Mochi', 'Tumble']
  );

  const byMorph = sortCollectionSnakes(starters, 'morph');
  assert.deepEqual(
    byMorph.map((s) => s.phenotype.morphName),
    ['Lesser', 'Mojave', 'Pastel', 'Spider Pinstripe']
  );

  const discoveries = Object.values(buildInitialDiscoveries(starters));
  const dexByMorph = sortMorphDiscoveries(discoveries, 'morph');
  assert.deepEqual(
    dexByMorph.map((d) => d.morphName),
    ['Lesser', 'Mojave', 'Pastel', 'Spider Pinstripe']
  );
});
