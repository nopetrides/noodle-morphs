import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentFlag, createGameConfigForMode } from './contentFlags';
import { buildJeanPoolOffers, getMissingLoci } from './economy';
import {
  applySimulatorSynthesis,
  breedClutch,
  computeBreedingPreview,
  createSimulatedSnake,
  createTitleShowcaseSnakes,
  createWildTypeGenotype,
  evaluatePhenotype,
} from './genetics';
import {
  clearInstalledModPacks,
  exportModPackJson,
  getInstalledModPack,
  installModPack,
  makeModLocusId,
  SAMPLE_CELESTIAL_PACK,
  uninstallModPack,
  validateModGenePack,
} from './modPacks';
import { synthesizeSkinBuffer } from './skinField';
import { decodeSaveStateV2, encodeSaveStateV2 } from './storage';

test('validateModGenePack accepts sample Celestial pack and rejects invalid/unsafe packs', () => {
  const ok = validateModGenePack(SAMPLE_CELESTIAL_PACK);
  assert.equal(ok.ok, true);

  // Invalid hex color & unsupported field primitive
  const badColor = validateModGenePack({
    ...SAMPLE_CELESTIAL_PACK,
    loci: [
      {
        ...SAMPLE_CELESTIAL_PACK.loci[0],
        palette1x: { base: 'not-a-hex', patternPrimary: '#FFFFFF' },
        field1x: { field: 'arbitrary_js_eval', operation: 'blend', strength: 0.8 },
      },
    ],
  });
  assert.equal(badColor.ok, false);
  if (!badColor.ok) {
    assert.ok(badColor.errors.some((e) => e.includes('hex color')));
    assert.ok(badColor.errors.some((e) => e.includes('not a supported skin field primitive')));
  }

  // Oversized texture rejected
  const hugeTex = validateModGenePack({
    ...SAMPLE_CELESTIAL_PACK,
    textures: {
      too_big: { width: 512, height: 128, data: new Array(512 * 128).fill(0.5) },
    },
  });
  assert.equal(hugeTex.ok, false);

  // Circular synthesis DAG rejected
  const cyclic = validateModGenePack({
    ...SAMPLE_CELESTIAL_PACK,
    synthesisRecipes: [
      {
        id: 'cyc_a',
        name: 'A',
        tier: 1,
        ingredientA: { locus: 'starlight' },
        ingredientB: { locus: 'aurora' },
        result: 'nebula',
      },
      {
        id: 'cyc_b',
        name: 'B',
        tier: 2,
        ingredientA: { locus: 'nebula' },
        ingredientB: { locus: 'aurora' },
        result: 'starlight',
      },
    ],
  });
  assert.equal(cyclic.ok, false);
  if (!cyclic.ok) {
    assert.ok(cyclic.errors.some((e) => e.includes('circular dependency')));
  }
});

test('Mod loci evaluate 1x, 2x Super, recessive Het/Visual, custom_map synthesis, and core combos', () => {
  clearInstalledModPacks(false);
  const res = installModPack(SAMPLE_CELESTIAL_PACK, false);
  assert.equal(res.ok, true);

  const starId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'starlight');
  const nebId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'nebula');
  const wild = createWildTypeGenotype();

  const p1 = evaluatePhenotype(wild, 0.42, { [starId]: [1, 0] });
  const p2 = evaluatePhenotype(wild, 0.42, { [starId]: [1, 1] });
  assert.equal(p1.morphName, 'Starlight');
  assert.equal(p2.morphName, 'Supernova');
  assert.equal(p1.isCustomMorph, true);
  assert.notEqual(p1.palette.base, p2.palette.base);

  // Recessive Nebula: 1x is hidden Het, 2x expresses visual + customMapId texture
  const nebHet = evaluatePhenotype(wild, 0.42, { [nebId]: [1, 0] });
  const nebVis = evaluatePhenotype(wild, 0.42, { [nebId]: [1, 1] });
  assert.equal(nebHet.morphName, 'Classic Normal');
  assert.ok(nebHet.hetGenes.includes('Nebula'));
  assert.equal(nebVis.morphName, 'Nebula');
  assert.ok(nebVis.skinSpec?.customMapId?.includes('nebula_clouds'));

  // Synthesize pixel buffer using the bundled grayscale UV texture
  const px = synthesizeSkinBuffer(nebVis.skinSpec!, nebVis.palette, 0.42, 64, 16, 'final');
  assert.equal(px.length, 64 * 16 * 4);
  assert.ok(px.some((v, idx) => idx % 4 === 3 && v > 150 && v < 250), 'Translucent Nebula alpha applied');

  // Composes cleanly with core Albino & Invert
  const starInv = evaluatePhenotype({ ...wild, invert: [1, 1] }, 0.42, { [starId]: [1, 0] });
  assert.ok(starInv.visualGenes.includes('Starlight'));
  assert.ok(starInv.visualGenes.includes('Inverted'));
  assert.notEqual(starInv.palette.base, p1.palette.base);

  clearInstalledModPacks(false);
});

test('Mod Mendelian breeding and Starlight x Aurora -> Nebula synthesis respect enabledModPacks', () => {
  clearInstalledModPacks(false);
  installModPack(SAMPLE_CELESTIAL_PACK, false);

  const starId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'starlight');
  const aurId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'aurora');
  const nebId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'nebula');
  const wild = createWildTypeGenotype();

  const sire = createSimulatedSnake(wild, 0.25, new Set(), 'Comet', Math.random, {
    [starId]: [1, 0],
  });
  const dam = createSimulatedSnake(wild, 0.71, new Set(['Comet']), 'Lyra', Math.random, {
    [aurId]: [1, 0],
  });

  // With pack enabled: 25% Het Nebula synthesis outcome appears
  const preview = computeBreedingPreview(
    sire,
    dam,
    new Set(),
    undefined,
    ContentFlag.RealMorphs,
    [SAMPLE_CELESTIAL_PACK.packId]
  );
  const synthOutcome = preview.find((e) => e.outcomeKind === 'synthesis');
  assert.ok(synthOutcome, 'Expected Nebula synthesis outcome in Punnett preview');
  assert.ok(Math.abs(synthOutcome.probability - 0.25) < 0.001);
  assert.equal(synthOutcome.synthesisResultLocus, nebId);

  // Without pack enabled: synthesis does not trigger
  const previewDisabled = computeBreedingPreview(
    sire,
    dam,
    new Set(),
    undefined,
    ContentFlag.RealMorphs,
    []
  );
  assert.equal(previewDisabled.some((e) => e.outcomeKind === 'synthesis'), false);

  // Deterministic RNG forcing both parents to pass their mutant alleles -> 100% synthesized egg
  const alwaysPassRng = () => 0.01;
  const clutch = breedClutch(
    sire,
    dam,
    new Set(),
    new Set(['Comet', 'Lyra']),
    1,
    alwaysPassRng,
    undefined,
    ContentFlag.RealMorphs,
    [SAMPLE_CELESTIAL_PACK.packId]
  );
  assert.equal(clutch[0].wasSynthesis, true);
  assert.equal(clutch[0].synthesisLocusName, 'Nebula');
  assert.deepEqual(clutch[0].snake.modAlleles?.[nebId], [1, 0]);

  clearInstalledModPacks(false);
});

test('Compact v2 saves round-trip modAlleles and gracefully preserve raw genetics when pack is uninstalled', () => {
  clearInstalledModPacks(false);
  installModPack(SAMPLE_CELESTIAL_PACK, false);

  const starId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'starlight');
  const nebId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'nebula');
  const wild = createWildTypeGenotype();

  const s1 = createSimulatedSnake(wild, 0.33, new Set(), 'Nova', Math.random, {
    [starId]: [1, 1],
  });
  s1.onDisplay = true;
  const s2 = createSimulatedSnake(wild, 0.66, new Set(['Nova']), 'Vega', Math.random, {
    [nebId]: [1, 1],
  });
  s2.onDisplay = true;

  const config = createGameConfigForMode('real_only', {
    enabledModPacks: [SAMPLE_CELESTIAL_PACK.packId],
  });

  const encoded = encodeSaveStateV2({
    snakes: [s1, s2],
    displayedIds: [s1.id, s2.id],
    discoveries: {},
    sireId: s1.id,
    damId: s2.id,
    clutchDurationSec: 120,
    clutchRemainingSec: 120,
    clutchesHatched: 0,
    settings: { heatLampOn: true, muted: false },
    gameConfig: config,
  });

  // Reload while installed
  const decodedOk = decodeSaveStateV2(encoded);
  assert.ok(decodedOk);
  assert.equal(decodedOk.missingModPacks, undefined);
  assert.deepEqual(decodedOk.gameConfig.enabledModPacks, [SAMPLE_CELESTIAL_PACK.packId]);
  const novaOk = decodedOk.snakes.find((s) => s.name === 'Nova')!;
  const vegaOk = decodedOk.snakes.find((s) => s.name === 'Vega')!;
  assert.equal(novaOk.phenotype.morphName, 'Supernova');
  assert.equal(vegaOk.phenotype.morphName, 'Nebula');

  // Uninstall pack -> load gracefully degrades to wild-type while preserving raw modAlleles
  uninstallModPack(SAMPLE_CELESTIAL_PACK.packId, false);
  const decodedMissing = decodeSaveStateV2(encoded);
  assert.ok(decodedMissing);
  assert.deepEqual(decodedMissing.missingModPacks, [SAMPLE_CELESTIAL_PACK.packId]);
  const novaMissing = decodedMissing.snakes.find((s) => s.name === 'Nova')!;
  assert.equal(novaMissing.phenotype.morphName, 'Classic Normal');
  assert.deepEqual(novaMissing.modAlleles?.[starId], [1, 1], 'Raw modAlleles must be preserved');

  // Re-saving while missing and then reinstalling restores the exact snake!
  const reEncoded = encodeSaveStateV2({
    ...decodedMissing,
  });
  installModPack(SAMPLE_CELESTIAL_PACK, false);
  const restored = decodeSaveStateV2(reEncoded);
  assert.ok(restored);
  assert.equal(restored.missingModPacks, undefined);
  assert.equal(restored.snakes.find((s) => s.name === 'Nova')!.phenotype.morphName, 'Supernova');
  assert.equal(restored.snakes.find((s) => s.name === 'Vega')!.phenotype.morphName, 'Nebula');

  clearInstalledModPacks(false);
});

test('Jean Pool and Title Showcase strictly isolate mod packs per save', () => {
  clearInstalledModPacks(false);
  installModPack(SAMPLE_CELESTIAL_PACK, false);

  const starId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'starlight');
  const aurId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'aurora');
  const nebId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'nebula');

  // Without enabledModPacks: zero mod loci in Jean Pool or Title Showcase
  const missingWithoutPack = getMissingLoci([], ContentFlag.RealMorphs, []);
  assert.equal(missingWithoutPack.includes(starId), false);
  assert.equal(missingWithoutPack.includes(aurId), false);

  const titleNoPack = createTitleShowcaseSnakes(25, Math.random, ContentFlag.RealMorphs, []);
  assert.ok(titleNoPack.every((s) => !s.modAlleles));

  // With pack enabled: non-synthesis Starlight & Aurora appear, synthesis-only Nebula excluded
  const missingWithPack = getMissingLoci([], ContentFlag.RealMorphs, [
    SAMPLE_CELESTIAL_PACK.packId,
  ]);
  assert.equal(missingWithPack.includes(starId), true);
  assert.equal(missingWithPack.includes(aurId), true);
  assert.equal(missingWithPack.includes(nebId), false);

  // Build Jean Pool offer with a pack-enabled snake when all core genes owned -> offers mod snake
  const fullCoreSnake = createSimulatedSnake(
    Object.fromEntries(
      Object.keys(createWildTypeGenotype()).map((k) => [k, [1, 0]])
    ) as ReturnType<typeof createWildTypeGenotype>,
    0.5,
    new Set(),
    'AllCore'
  );
  const offers = buildJeanPoolOffers(
    [fullCoreSnake],
    { purchasesCount: 0, stockSeed: 42 },
    ContentFlag.RealMorphs,
    [SAMPLE_CELESTIAL_PACK.packId]
  );
  assert.equal(offers.length, 2);
  assert.ok(offers.every((o) => o.packName === 'Celestial Morphs'));

  // Title showcase with pack enabled can spawn modded snakes
  const titleWithPack = createTitleShowcaseSnakes(
    30,
    Math.random,
    ContentFlag.RealMorphs,
    [SAMPLE_CELESTIAL_PACK.packId]
  );
  assert.ok(titleWithPack.some((s) => s.modAlleles && Object.keys(s.modAlleles).length > 0));

  clearInstalledModPacks(false);
});

test('Pack provenance separates local editable packs from imported and Workshop packs', () => {
  clearInstalledModPacks(false);

  // Sample pack with workshopId registers as 'workshop'
  const sampleRes = installModPack(SAMPLE_CELESTIAL_PACK, false);
  assert.equal(sampleRes.ok, true);
  assert.equal(getInstalledModPack(SAMPLE_CELESTIAL_PACK.packId)?.source, 'workshop');

  // Local Studio pack registers as 'local' and updates cleanly in-place
  const localDraft = {
    ...SAMPLE_CELESTIAL_PACK,
    packId: 'my_local_pack',
    name: 'My Local Pack',
    workshopId: undefined,
  };
  const localRes = installModPack(localDraft, false, 'local');
  assert.equal(localRes.ok, true);
  assert.equal(getInstalledModPack('my_local_pack')?.source, 'local');

  // Export strips machine-local provenance so importing it on another client marks it 'imported'
  const exported = exportModPackJson(getInstalledModPack('my_local_pack')!);
  const parsed = JSON.parse(exported) as Record<string, unknown>;
  assert.equal(parsed.source, undefined, 'Exported portable JSON must omit local provenance');

  const reimported = installModPack(parsed, false, 'imported');
  assert.equal(reimported.ok, true);
  assert.equal(getInstalledModPack('my_local_pack')?.source, 'imported');

  clearInstalledModPacks(false);
});

test('applySimulatorSynthesis consumes ingredients and enables synthesized result for mod and core recipes', () => {
  clearInstalledModPacks(false);
  installModPack(SAMPLE_CELESTIAL_PACK, false);

  const starId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'starlight');
  const aurId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'aurora');
  const nebId = makeModLocusId(SAMPLE_CELESTIAL_PACK.packId, 'nebula');
  const wild = createWildTypeGenotype();

  // Mod synthesis: Starlight 1x + Aurora 1x -> turns both Off and sets Nebula to Het (1x)
  const modRes1 = applySimulatorSynthesis(
    wild,
    { [starId]: [1, 0], [aurId]: [1, 0] },
    { allowCoreSynthesis: false, enabledModPacks: [SAMPLE_CELESTIAL_PACK.packId] }
  );
  assert.ok(modRes1.triggered);
  assert.equal(modRes1.triggered.resultName, 'Nebula');
  assert.equal(modRes1.triggered.isRecessiveHet, true);
  assert.equal(modRes1.modAlleles?.[starId], undefined, 'Starlight should turn Off');
  assert.equal(modRes1.modAlleles?.[aurId], undefined, 'Aurora should turn Off');
  assert.deepEqual(modRes1.modAlleles?.[nebId], [1, 0]);

  // Repeating Starlight 1x + Aurora 1x upgrades Het Nebula (1x) -> Visual Nebula (2x)
  const modRes2 = applySimulatorSynthesis(
    wild,
    { [starId]: [1, 0], [aurId]: [1, 0], [nebId]: [1, 0] },
    { allowCoreSynthesis: false, enabledModPacks: [SAMPLE_CELESTIAL_PACK.packId] }
  );
  assert.ok(modRes2.triggered);
  assert.equal(modRes2.triggered.resultCount, 2);
  assert.equal(modRes2.triggered.isRecessiveHet, false);
  assert.deepEqual(modRes2.modAlleles?.[nebId], [1, 1]);

  // Core elemental synthesis: Super Lava (2x) + Super Water (2x) -> consumes both and sets Obsidian (1x)
  const coreRes = applySimulatorSynthesis(
    { ...wild, magma: [1, 1], tidal: [1, 1] },
    undefined,
    { allowCoreSynthesis: true, enabledModPacks: [] }
  );
  assert.ok(coreRes.triggered);
  assert.equal(coreRes.triggered.resultName, 'Obsidian');
  assert.deepEqual(coreRes.genotype.magma, [0, 0]);
  assert.deepEqual(coreRes.genotype.tidal, [0, 0]);
  assert.deepEqual(coreRes.genotype.obsidian, [1, 0]);

  clearInstalledModPacks(false);
});
