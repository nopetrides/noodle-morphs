import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCI_ORDER } from './genetics';
import { buildMorphSheetEntries } from './spriteSheet';

test('buildMorphSheetEntries generates 1 base + 2 entries per locus (79 entries for 39 loci)', () => {
  const entries = buildMorphSheetEntries(0.42);
  assert.equal(entries.length, 1 + LOCI_ORDER.length * 2);
  assert.equal(entries.length, 79);

  assert.equal(entries[0].locusId, 'base');
  assert.equal(entries[0].dosage, 'base');
  assert.equal(entries[0].phenotype.morphName, 'Classic Normal');

  for (let i = 0; i < LOCI_ORDER.length; i++) {
    const locusId = LOCI_ORDER[i];
    const e1 = entries[1 + i * 2];
    const e2 = entries[2 + i * 2];
    assert.equal(e1.locusId, locusId);
    assert.equal(e1.dosage, '1x');
    assert.equal(e2.locusId, locusId);
    assert.equal(e2.dosage, '2x');
  }

  // Verify recessive 1x stays Het while 2x expresses visually (e.g. Piebald)
  const pie1 = entries.find((e) => e.locusId === 'piebald' && e.dosage === '1x')!;
  const pie2 = entries.find((e) => e.locusId === 'piebald' && e.dosage === '2x')!;
  assert.ok(pie1.phenotype.hetGenes.includes('Piebald'));
  assert.ok(pie2.phenotype.visualGenes.includes('Piebald'));

  // Verify Calico 1x and 2x entries exist with calicoRise > 0
  const cal1 = entries.find((e) => e.locusId === 'calico' && e.dosage === '1x')!;
  const cal2 = entries.find((e) => e.locusId === 'calico' && e.dosage === '2x')!;
  assert.ok((cal1.phenotype.skinSpec?.params.calicoRise ?? 0) > 0);
  assert.ok((cal2.phenotype.skinSpec?.params.calicoRise ?? 0) > 0);
});
