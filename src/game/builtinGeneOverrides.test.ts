import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_GENE_OVERRIDES_SCHEMA_VERSION,
  getBuiltinGeneOverridesSnapshot,
  serializeBuiltinGeneOverridesFile,
  validateBuiltinGeneOverridesFile,
  type BuiltinGeneOverridesFile,
} from './builtinGeneOverrides';
import {
  applyBuiltinGeneOverrides,
  evaluatePhenotype,
  getBaseLocusDefinition,
  LOCI_ORDER,
  LOCUS_DEFINITIONS,
  makeGenotype,
} from './genetics';

test('validateBuiltinGeneOverridesFile validates Core & Fun overrides and rejects invalid fields', () => {
  const allowed = new Set<string>(LOCI_ORDER);

  const valid = validateBuiltinGeneOverridesFile(
    {
      schemaVersion: BUILTIN_GENE_OVERRIDES_SCHEMA_VERSION,
      genes: {
        pastel: {
          name: 'Lemon Pastel',
          superName: 'Ultra Lemon',
          rarityWeight: 2.4,
          palette1x: {
            base: '#ffe45e',
            patternPrimary: '#3a2c1c',
            bodyOpacity: 0.96,
            pigmentWeight: 0.9,
          },
        },
        chevron: {
          field1x: {
            field: 'angled_waves',
            operation: 'blend',
            strength: 0.92,
            frequency: 1.35,
            paramOverrides: { coverage: 0.42 },
          },
        },
      },
    },
    allowed
  );

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.genes.pastel?.name, 'Lemon Pastel');
    assert.equal(valid.data.genes.pastel?.palette1x?.base, '#FFE45E');
    assert.equal(valid.data.genes.chevron?.field1x?.strength, 0.92);
  }

  const badColor = validateBuiltinGeneOverridesFile(
    {
      schemaVersion: 1,
      genes: {
        pastel: {
          palette1x: { base: 'not-a-hex', patternPrimary: '#112233' },
        },
      },
    },
    allowed
  );
  assert.equal(badColor.ok, false);

  const missingTex = validateBuiltinGeneOverridesFile(
    {
      schemaVersion: 1,
      genes: {
        chevron: {
          field1x: { field: 'custom_map', operation: 'blend', strength: 0.8 },
        },
      },
    },
    allowed
  );
  assert.equal(missingTex.ok, false);

  const unknownLocus = validateBuiltinGeneOverridesFile(
    {
      schemaVersion: 1,
      genes: {
        nonexistent_gene: { name: 'Fake' },
      },
    },
    allowed
  );
  assert.equal(unknownLocus.ok, false);
});

test('serializeBuiltinGeneOverridesFile produces deterministic, clean TypeScript source', () => {
  const file: BuiltinGeneOverridesFile = {
    schemaVersion: 1,
    genes: {
      chevron: { name: 'Sharp Chevron' },
      albino: { rarityWeight: 3.8 },
    },
  };
  const source = serializeBuiltinGeneOverridesFile(file);
  assert.ok(source.includes('export const BUILTIN_GENE_OVERRIDES: BuiltinGeneOverridesFile ='));
  // Keys must be alphabetically sorted so git diffs stay clean
  assert.ok(source.indexOf('"albino"') < source.indexOf('"chevron"'));
});

test('applyBuiltinGeneOverrides updates Core, Fun Original, and Fun Elemental genes live and resets cleanly', () => {
  const originalSnapshot = getBuiltinGeneOverridesSnapshot();
  const basePastel = getBaseLocusDefinition('pastel');
  const baseChevron = getBaseLocusDefinition('chevron');
  const baseBismuth = getBaseLocusDefinition('bismuth');

  try {
    applyBuiltinGeneOverrides({
      schemaVersion: 1,
      genes: {
        pastel: {
          name: 'Solar Pastel',
          superName: 'Hyper Solar Pastel',
          palette1x: {
            base: '#1288CC',
            patternPrimary: '#0B2233',
            pigmentWeight: 1.0,
          },
        },
        chevron: {
          field1x: {
            field: 'crystal_facets',
            operation: 'blend',
            strength: 0.95,
            frequency: 1.4,
          },
        },
        bismuth: {
          name: 'Prism Bismuth',
          palette1x: {
            base: '#44FFAA',
            patternPrimary: '#112244',
            bodyOpacity: 0.72,
            pigmentWeight: 1.0,
          },
        },
      },
    });

    assert.equal(LOCUS_DEFINITIONS.pastel.name, 'Solar Pastel');
    assert.equal(LOCUS_DEFINITIONS.bismuth.name, 'Prism Bismuth');

    const pastel1x = evaluatePhenotype(makeGenotype({ pastel: [1, 0] }), 0.5);
    assert.equal(pastel1x.morphName, 'Solar Pastel');
    const pastel2x = evaluatePhenotype(makeGenotype({ pastel: [1, 1] }), 0.5);
    assert.equal(pastel2x.morphName, 'Hyper Solar Pastel');

    const chevron1x = evaluatePhenotype(makeGenotype({ chevron: [1, 0] }), 0.5);
    assert.equal(chevron1x.skinSpec?.contributions[0]?.field, 'crystal_facets');

    const bismuth2x = evaluatePhenotype(makeGenotype({ bismuth: [1, 1] }), 0.5);
    assert.equal(bismuth2x.morphName, 'Prism Bismuth');
    assert.ok((bismuth2x.palette.bodyOpacity ?? 1) <= 0.75);
  } finally {
    applyBuiltinGeneOverrides(originalSnapshot);
  }

  // Original code defaults are completely restored after reset
  assert.equal(LOCUS_DEFINITIONS.pastel.name, basePastel.name);
  assert.equal(LOCUS_DEFINITIONS.chevron.name, baseChevron.name);
  assert.equal(LOCUS_DEFINITIONS.bismuth.name, baseBismuth.name);
});
