import {
  ContentFlag,
  DEFAULT_CONTENT_FLAGS,
  hasContentFlag,
} from './contentFlags';
import {
  applyAutomaticSynthesis,
  ELEMENTAL_LOCI_ORDER,
  ELEMENTAL_LOCUS_DEFINITIONS,
  ELEMENTAL_SYNTHESIS_RECIPES,
  ELEMENTAL_VISUAL_PROFILES,
  getElementalTier,
  isSynthesisOnlyLocus,
} from './elementalSynthesis';
import {
  applyModSynthesis,
  buildModFieldContribution,
  cleanModAlleles,
  getEnabledModLoci,
  getEnabledModRecipes,
  getModLocus,
  isModSynthesisOnlyLocus,
} from './modPacks';
import { clamp, createDefaultSkinFieldParams, SKIN_GENERATOR_VERSION } from './skinField';
import type {
  AllelePair,
  BehaviorTrait,
  BreedingOddsEntry,
  BreedingOutcomeKind,
  ClutchEgg,
  FieldContribution,
  GeneBiasDistribution,
  Genotype,
  InheritanceMode,
  LocusDefinition,
  LocusId,
  ModAlleleMap,
  MorphDiscovery,
  MorphRarity,
  MorphTag,
  PatternModifier,
  PatternMotif,
  PatternRule,
  PatternWeight,
  SkinPhenotypeSpec,
  SnakeEntity,
  SnakePalette,
  SnakePhenotype,
} from './types';

export const LOCI_ORDER: LocusId[] = [
  'pastel',
  'mojave',
  'lesser',
  'enchi',
  'spider',
  'pinstripe',
  'albino',
  'piebald',
  'clown',
  'axanthic',
  'banana',
  'fire',
  'yellowbelly',
  'blackpastel',
  'ghi',
  'cypress',
  'calico',
  'lavenderalbino',
  'desertghost',
  'hypo',
  'ultramel',
  // Custom Morpharium Originals (appended to preserve compact v2 save indices)
  'saddler',
  'bullring',
  'chevron',
  'raindrop',
  'magma',
  'tidal',
  'crossbar',
  'trackline',
  'milksnake',
  'invert',
  // Additional Extreme Real-World Ball Python Genes (appended to preserve compact v2 save indices)
  'monsoon',
  'sunset',
  'geneticstripe',
  'tristripe',
  'leopard',
  'monarch',
  'cinnamon',
  'blade',
  // Element & Mineral Synthesis Tree (appended to preserve compact v2 save indices)
  ...ELEMENTAL_LOCI_ORDER,
];

export const LOCUS_DEFINITIONS: Record<LocusId, LocusDefinition> = {
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    superName: 'Super Pastel',
    mode: 'codominant',
    shortCode: 'Pas',
    description: 'Brightens golden yellow pigment and washes the head with soft blushing.',
    visualEffect: 'Golden lemon tones & blushed crown',
    rarityWeight: 1,
    tags: ['Color', 'Light'],
  },
  mojave: {
    id: 'mojave',
    name: 'Mojave',
    superName: 'Blue-Eyed Leucistic',
    mode: 'codominant',
    shortCode: 'Moj',
    description: 'Simplifies wild alien heads into crisp single-eye keyholes. Two copies or pairing with Lesser creates a Blue-Eyed Leucistic.',
    visualEffect: 'Single-dot keyhole alien heads · BEL complex',
    rarityWeight: 1.5,
    tags: ['Pattern', 'Complex'],
  },
  lesser: {
    id: 'lesser',
    name: 'Lesser',
    superName: 'Blue-Eyed Leucistic',
    mode: 'codominant',
    shortCode: 'Les',
    description: 'Widens and melts alien heads into warm butterscotch blushed keyholes. Part of the Blue-Eyed Leucistic allelic complex.',
    visualEffect: 'Butterscotch blushed keyholes · BEL complex',
    rarityWeight: 1.5,
    tags: ['Color', 'Light', 'Complex'],
  },
  enchi: {
    id: 'enchi',
    name: 'Enchi',
    superName: 'Super Enchi',
    mode: 'codominant',
    shortCode: 'Enc',
    description: 'Brightens golden-orange sides and reduces alien heads into flat, featureless copper/bronze openings with thin chocolate bridges and a heavily blushed crown.',
    visualEffect: 'Golden-copper reduced alien heads · Blushed crown',
    rarityWeight: 1.4,
    tags: ['Color', 'Pattern'],
  },
  spider: {
    id: 'spider',
    name: 'Spider',
    mode: 'dominant',
    shortCode: 'Spd',
    description: 'Thins dark inkblots into delicate webbed lines with high-white flanks. Carries a neurological wobble that makes this noodle live upside-down.',
    visualEffect: 'Delicate web lines · Upside-down posture',
    rarityWeight: 1.3,
    tags: ['Pattern', 'High-White', 'Wobble'],
  },
  pinstripe: {
    id: 'pinstripe',
    name: 'Pinstripe',
    mode: 'dominant',
    shortCode: 'Pin',
    description: 'Thins dark pigment into irregular, stuttering lightning-like dorsal pinstripes and broken vertical/horizontal water-droplet flank dashes.',
    visualEffect: 'Jaggy broken pinstripes & flank dashes',
    rarityWeight: 1.2,
    tags: ['Pattern'],
  },
  albino: {
    id: 'albino',
    name: 'Albino',
    mode: 'recessive',
    shortCode: 'alb',
    description: 'Amelanistic recessive gene lacking dark melanin. Recolors wild alien heads into butter-yellow & ivory with ruby-pink eyes.',
    visualEffect: 'Butter-yellow alien heads · Ruby eyes',
    rarityWeight: 3,
    tags: ['Color', 'Light'],
  },
  piebald: {
    id: 'piebald',
    name: 'Piebald',
    mode: 'recessive',
    shortCode: 'pie',
    description: 'Recessive trait introducing bold porcelain-white saddle patches that cleanly interrupt any underlying pattern.',
    visualEffect: 'Stark white patched sections',
    rarityWeight: 3.2,
    tags: ['Pattern', 'High-White'],
  },
  clown: {
    id: 'clown',
    name: 'Clown',
    mode: 'recessive',
    shortCode: 'cln',
    description: 'Hugely reduces side alien heads into crisp open flanks beneath a thick dark dorsal stripe and iconic bold headstamp.',
    visualEffect: 'Thick dark dorsal stripe & bold headstamp',
    rarityWeight: 3.1,
    tags: ['Pattern'],
  },
  axanthic: {
    id: 'axanthic',
    name: 'Axanthic',
    mode: 'recessive',
    shortCode: 'axn',
    description: 'Recessive gene suppressing yellow and red pigments for cool monochrome silver, slate, and charcoal scales.',
    visualEffect: 'Monochrome silver & charcoal',
    rarityWeight: 3.2,
    tags: ['Color', 'Dark'],
  },
  banana: {
    id: 'banana',
    name: 'Banana',
    superName: 'Super Banana',
    mode: 'codominant',
    shortCode: 'Ban',
    description: 'Iconic Coral Glow / Banana trait washing wild alien heads in lilac-lavender and bright banana-yellow with cute dark freckles.',
    visualEffect: 'Lilac & banana-yellow alien heads with freckles',
    rarityWeight: 1.8,
    tags: ['Color', 'Light'],
  },
  fire: {
    id: 'fire',
    name: 'Fire',
    superName: 'Black-Eyed Leucistic',
    mode: 'codominant',
    shortCode: 'Fir',
    description: 'Brightens golden highlights, luminous headstamps, and warm flames rising from the flanks. Two copies create a Black-Eyed Leucistic.',
    visualEffect: 'Bright blushed alien heads & side flames · BlackEL super',
    rarityWeight: 1.6,
    tags: ['Color', 'Light', 'Complex'],
  },
  yellowbelly: {
    id: 'yellowbelly',
    name: 'Yellow Belly',
    superName: 'Ivory',
    mode: 'codominant',
    shortCode: 'YB',
    description: 'Gives puzzle alien heads a sun-kissed tan glow with bold golden flames rising from the lower sides. Two copies unlock the pearly Ivory.',
    visualEffect: 'Sun-kissed flamed sides · Ivory super complex',
    rarityWeight: 1.6,
    tags: ['Color', 'Pattern', 'Complex'],
  },
  blackpastel: {
    id: 'blackpastel',
    name: 'Black Pastel',
    superName: '8-Ball',
    mode: 'codominant',
    shortCode: 'BP',
    description: 'Packs the body with thick, hollowed-out dark chocolate alien heads, squiggly puzzle blushing, and warm side flaming. Two copies create the solid dark 8-Ball.',
    visualEffect: 'Hollowed dark puzzle rings · Solid dark 8-Ball super',
    rarityWeight: 1.7,
    tags: ['Dark', 'Pattern', 'Complex'],
  },
  ghi: {
    id: 'ghi',
    name: 'GHI',
    superName: 'Super GHI',
    mode: 'codominant',
    shortCode: 'GHI',
    description: 'Dark pattern-reducing gene filling in dorsal inkblots into rich jet-black contrast with clean pale side markers.',
    visualEffect: 'Deep jet-black inkblots & contrasting side markers',
    rarityWeight: 1.9,
    tags: ['Dark', 'Pattern'],
  },
  cypress: {
    id: 'cypress',
    name: 'Cypress',
    superName: 'Super Cypress',
    mode: 'codominant',
    shortCode: 'Cyp',
    description: 'Compresses and disrupts wild-type markings into earthy olive-bronze broken linear tracks and elongated lateral dashes.',
    visualEffect: 'Olive-bronze compressed broken linear tracks',
    rarityWeight: 1.7,
    tags: ['Pattern', 'Color'],
  },
  calico: {
    id: 'calico',
    name: 'Calico',
    mode: 'dominant',
    shortCode: 'Cal',
    description: 'High-contrast gene adding sharp, random splashes of pure snowy white rising cleanly up from the lower flanks.',
    visualEffect: 'Sharp snowy-white splashes rising along flanks',
    rarityWeight: 1.5,
    tags: ['High-White', 'Pattern'],
  },
  lavenderalbino: {
    id: 'lavenderalbino',
    name: 'Lavender Albino',
    mode: 'recessive',
    shortCode: 'lav',
    description: 'Distinct recessive amelanistic morph featuring vivid tangerine-gold markings over soft violet-lavender scales and ruby eyes.',
    visualEffect: 'Tangerine & pale violet · Ruby eyes',
    rarityWeight: 3.4,
    tags: ['Color', 'Light'],
  },
  desertghost: {
    id: 'desertghost',
    name: 'Desert Ghost',
    mode: 'recessive',
    shortCode: 'dg',
    description: 'Prized contrast enhancer that keeps cream backgrounds clean and dark patterns razor-sharp with zero browning.',
    visualEffect: 'Ultra-clean high-contrast cream & jet',
    rarityWeight: 3.5,
    tags: ['Color', 'Light'],
  },
  hypo: {
    id: 'hypo',
    name: 'Hypo',
    mode: 'recessive',
    shortCode: 'hyp',
    description: 'Orange Ghost hypomelanistic gene softening dark blacks into dreamy smoky taupe and peach tones.',
    visualEffect: 'Smoky pastel-taupe & peach wash',
    rarityWeight: 3.0,
    tags: ['Color', 'Light'],
  },
  ultramel: {
    id: 'ultramel',
    name: 'Ultramel',
    mode: 'recessive',
    shortCode: 'ult',
    description: 'Caramel-toned recessive gene reducing melanin into rich amber-gold alien heads with deep burgundy-plum eyes.',
    visualEffect: 'Caramel-amber alien heads · Burgundy eyes',
    rarityWeight: 3.3,
    tags: ['Color', 'Light'],
  },
  // --- Custom Morpharium Originals (Not based on real-world ball python morphs) ---
  saddler: {
    id: 'saddler',
    name: 'Saddler',
    mode: 'dominant',
    shortCode: 'Sad',
    description: 'Custom Morpharium pattern: stamps symmetrical twin-dot medallion ovals neatly down the spine.',
    visualEffect: 'Custom geometric twin-dot saddles',
    rarityWeight: 1.4,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  bullring: {
    id: 'bullring',
    name: 'Bullring',
    superName: 'Super Bullring',
    mode: 'codominant',
    shortCode: 'Blr',
    description: 'Custom Morpharium pattern: turns markings into bold double-window concentric dorsal rings.',
    visualEffect: 'Custom concentric double-window rings',
    rarityWeight: 1.6,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  chevron: {
    id: 'chevron',
    name: 'Chevron',
    superName: 'Super Chevron',
    mode: 'codominant',
    shortCode: 'Chv',
    description: 'Custom Morpharium pattern: replaces blotches with crisp marching arrowhead chevrons (>>>->>>).',
    visualEffect: 'Custom marching arrowhead chevrons',
    rarityWeight: 1.6,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  raindrop: {
    id: 'raindrop',
    name: 'Raindrop',
    mode: 'recessive',
    shortCode: 'rnd',
    description: 'Custom Morpharium recessive pattern: threads alternating misty teardrop beads along a delicate spine line.',
    visualEffect: 'Custom alternating spine teardrops',
    rarityWeight: 3.0,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  magma: {
    id: 'magma',
    name: 'Lava',
    superName: 'Super Lava',
    mode: 'codominant',
    shortCode: 'Lav',
    description: 'Custom Elemental morph: charred basalt crust split by glowing molten magma cracks. Breed with Water to forge Cobblestone!',
    visualEffect: 'Custom glowing magma fissures · Lava + Water = Cobblestone',
    rarityWeight: 2.2,
    tags: ['Color', 'Pattern', 'Dark', 'Complex', 'Custom'],
    isCustom: true,
  },
  tidal: {
    id: 'tidal',
    name: 'Water',
    superName: 'Super Water',
    mode: 'codominant',
    shortCode: 'Wtr',
    description: 'Custom Elemental morph: shimmering cerulean scales crossed by seafoam wave ripples. Breed with Lava to forge Cobblestone!',
    visualEffect: 'Custom shimmering aqua ripples · Lava + Water = Cobblestone',
    rarityWeight: 2.2,
    tags: ['Color', 'Pattern', 'Light', 'Complex', 'Custom'],
    isCustom: true,
  },
  crossbar: {
    id: 'crossbar',
    name: 'Crossbar',
    mode: 'dominant',
    shortCode: 'Bar',
    description: 'Custom Morpharium pattern: lays crisp straight geometric cross-body bars evenly from neck to tail.',
    visualEffect: 'Custom straight cross-body bars',
    rarityWeight: 1.4,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  trackline: {
    id: 'trackline',
    name: 'Trackline',
    mode: 'dominant',
    shortCode: 'Trk',
    description: 'Custom Morpharium pattern: stamps clean, uniform geometric dash-dot railway tracks (-o-o-o-) straight down the spine.',
    visualEffect: 'Custom uniform dash-dot tracks (-o-o-o-)',
    rarityWeight: 1.4,
    tags: ['Pattern', 'Custom'],
    isCustom: true,
  },
  milksnake: {
    id: 'milksnake',
    name: 'Milk Band',
    superName: 'Super Milk Band',
    mode: 'codominant',
    shortCode: 'Mlk',
    description: 'Custom tricolor transverse-wave morph: vivid scarlet saddles bordered by jet-black rings and cream bands. Composes with Classic/pattern genes via field modulation.',
    visualEffect: 'Custom tricolor transverse rings · Modulates cellular morphs',
    rarityWeight: 1.9,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  invert: {
    id: 'invert',
    name: 'Inverted',
    mode: 'recessive',
    shortCode: 'Inv',
    description: 'Recessive custom chromatic-flip gene that inverts every final scale and eye color when homozygous—turning bright Albinos dark and pale coats obsidian.',
    visualEffect: 'Full RGB color inversion across any morph combo (1× = Het carrier, 2× = Inverted)',
    rarityWeight: 2.0,
    tags: ['Color', 'Custom'],
    isCustom: true,
  },
  // --- Additional Extreme Real-World Ball Python Genes ---
  monsoon: {
    id: 'monsoon',
    name: 'Monsoon',
    mode: 'recessive',
    shortCode: 'mon',
    description: 'Extreme recessive pattern disruptor that shatters alien heads into an intricate mosaic labyrinth of scattered spots and a thin fragmented dorsal thread.',
    visualEffect: 'Shattered mosaic labyrinth spots & broken dorsal thread',
    rarityWeight: 3.6,
    tags: ['Pattern'],
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    mode: 'recessive',
    shortCode: 'sun',
    description: 'Fiery recessive morph washing the body in burnt-orange and rust gradients with bright orange flank flaming and a dark bubbly dorsal stripe.',
    visualEffect: 'Burnt-orange rust flanks & dark bubbly dorsal stripe',
    rarityWeight: 3.6,
    tags: ['Color', 'Pattern'],
  },
  geneticstripe: {
    id: 'geneticstripe',
    name: 'Genetic Stripe',
    mode: 'recessive',
    shortCode: 'gs',
    description: 'Classic recessive stripe mutation forming a crisp, continuous golden-tan dorsal stripe bordered by dark margins and smooth, patternless flanks.',
    visualEffect: 'Continuous golden dorsal stripe & clean flanks',
    rarityWeight: 3.2,
    tags: ['Pattern'],
  },
  tristripe: {
    id: 'tristripe',
    name: 'Tri-Stripe',
    mode: 'recessive',
    shortCode: 'tri',
    description: 'Recessive pattern mutation combining a thick solid dark dorsal stripe with merged lateral alien heads forming two parallel dashed side stripes.',
    visualEffect: 'Bold triple longitudinal stripes from head to tail',
    rarityWeight: 3.5,
    tags: ['Pattern'],
  },
  leopard: {
    id: 'leopard',
    name: 'Leopard',
    superName: 'Super Leopard',
    mode: 'codominant',
    shortCode: 'Leo',
    description: 'Codominant pattern shatterer that breaks alien heads into a busy, high-contrast dark rosette and spotted puzzle matrix with strong blushing.',
    visualEffect: 'Busy dark speckled rosettes & broken puzzle contrast',
    rarityWeight: 1.8,
    tags: ['Pattern', 'Dark'],
  },
  monarch: {
    id: 'monarch',
    name: 'Monarch',
    mode: 'recessive',
    shortCode: 'mnr',
    description: 'Recessive hypomelanistic color and pattern morph pairing bright yellow scales with a clean lilac-chocolate blushed puzzle pattern and spotless flanks.',
    visualEffect: 'Bright yellow & lilac-chocolate clean puzzle pattern',
    rarityWeight: 3.5,
    tags: ['Color', 'Light', 'Pattern'],
  },
  cinnamon: {
    id: 'cinnamon',
    name: 'Cinnamon',
    superName: 'Super Cinnamon',
    mode: 'codominant',
    shortCode: 'Cin',
    description: 'Deep mahogany-chocolate codominant gene with wide, melted squiggly alien heads and heavy side blushing. Two copies produce a dark solid Super Cinnamon.',
    visualEffect: 'Rich mahogany melted rings · Solid dark super',
    rarityWeight: 1.6,
    tags: ['Dark', 'Pattern'],
  },
  blade: {
    id: 'blade',
    name: 'Blade',
    superName: 'Super Blade',
    mode: 'codominant',
    shortCode: 'Bld',
    description: 'Clean codominant pattern-reducer that streamlines and elongates alien heads into sharp reduced bands and linear dorsal corridors.',
    visualEffect: 'Streamlined reduced bands & clean linear corridors',
    rarityWeight: 1.7,
    tags: ['Pattern'],
  },
  ...ELEMENTAL_LOCUS_DEFINITIONS,
};

export function getLocusContentFlag(locusId: LocusId): ContentFlag {
  const def = LOCUS_DEFINITIONS[locusId];
  if (def.contentFlag !== undefined) return def.contentFlag;
  return def.isCustom ? ContentFlag.CustomMorphs : ContentFlag.RealMorphs;
}

export function getEnabledLoci(contentFlags = DEFAULT_CONTENT_FLAGS): LocusId[] {
  return LOCI_ORDER.filter((loc) => hasContentFlag(contentFlags, getLocusContentFlag(loc)));
}

/** True if the snake carries at least one copy of the dominant Spider gene. */
export function carriesSpider(snake: SnakeEntity): boolean {
  return countAlleles(snake.genotype.spider) >= 1;
}

/**
 * Homozygous Super Spider (Spider × Spider) is lethal in real ball pythons.
 * Returns true whenever both parents carry Spider so pairing can be blocked kindly.
 */
export function isLethalSpiderPairing(sire: SnakeEntity, dam: SnakeEntity): boolean {
  return carriesSpider(sire) && carriesSpider(dam);
}

/**
 * Picks a safe mate for `anchor` from `candidates` that is not `anchor` itself
 * and does not form a lethal Spider × Spider pairing.
 */
export function pickSafeMateFor(
  anchor: SnakeEntity,
  candidates: SnakeEntity[],
  preferredId?: string
): SnakeEntity | null {
  const valid = candidates.filter(
    (c) => c.id !== anchor.id && !isLethalSpiderPairing(anchor, c)
  );
  if (valid.length === 0) return null;
  if (preferredId) {
    const pref = valid.find((c) => c.id === preferredId);
    if (pref) return pref;
  }
  return valid[0];
}

/** Spontaneous mutation chance per egg: 1 in 1,000 (0.1%) so The Jean Pool is the primary gene source */
export const MUTATION_CHANCE_PER_EGG = 0.001;
export const MIN_LINEAGE_VIGOR = 25;

export function formatMutationOddsText(): string {
  const denom = Math.max(1, Math.round(1 / MUTATION_CHANCE_PER_EGG));
  const pct = MUTATION_CHANCE_PER_EGG * 100;
  const pctStr = pct >= 1 ? `${Math.round(pct)}%` : `${Number(pct.toFixed(2))}%`;
  return `${pctStr} (1 in ${denom.toLocaleString()})`;
}

export function createWildTypeGenotype(): Genotype {
  const g = {} as Genotype;
  for (const loc of LOCI_ORDER) {
    g[loc] = [0, 0];
  }
  return g;
}

export function normalizeAllelePair(a: 0 | 1, b: 0 | 1): AllelePair {
  return a >= b ? [a, b] : [b, a];
}

export function countAlleles(pair: AllelePair | undefined): 0 | 1 | 2 {
  if (!pair) return 0;
  return (pair[0] + pair[1]) as 0 | 1 | 2;
}

export function makeGenotype(overrides: Partial<Record<LocusId, AllelePair>>): Genotype {
  const base = createWildTypeGenotype();
  for (const key of LOCI_ORDER) {
    const ov = overrides[key];
    if (ov) {
      base[key] = normalizeAllelePair(ov[0], ov[1]);
    }
  }
  return base;
}

function seededFloat(seed: number, salt: number): number {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Checks if a genotype expresses the Blue-Eyed Leucistic (BEL) complex:
 * Homozygous Mojave, Homozygous Lesser, OR compound heterozygous Mojave + Lesser.
 */
export function isBlueEyedLeucistic(genotype: Genotype): boolean {
  const moj = countAlleles(genotype.mojave);
  const les = countAlleles(genotype.lesser);
  return moj === 2 || les === 2 || (moj >= 1 && les >= 1);
}

/**
 * Checks if a genotype expresses the Black-Eyed Leucistic (Super Fire).
 */
export function isBlackEyedLeucistic(genotype: Genotype): boolean {
  return countAlleles(genotype.fire) === 2;
}

/**
 * Checks if a genotype expresses Ivory (Super Yellow Belly).
 */
export function isIvory(genotype: Genotype): boolean {
  return countAlleles(genotype.yellowbelly) === 2;
}

/**
 * Checks if a genotype expresses 8-Ball (Super Black Pastel).
 */
export function isEightBall(genotype: Genotype): boolean {
  return countAlleles(genotype.blackpastel) === 2;
}

/**
 * Custom Elemental Fusion Complex: Cobblestone locus OR legacy Lava (magma) + Water (tidal)!
 */
export function isCobblestone(genotype: Genotype): boolean {
  return (
    countAlleles(genotype.cobblestone) >= 1 ||
    (countAlleles(genotype.magma) >= 1 && countAlleles(genotype.tidal) >= 1)
  );
}

/**
 * Super Elemental Fusion: Obsidian locus OR legacy Homozygous Lava + Homozygous Water!
 */
export function isObsidianCobblestone(genotype: Genotype): boolean {
  return (
    countAlleles(genotype.obsidian) >= 1 ||
    (countAlleles(genotype.magma) === 2 && countAlleles(genotype.tidal) === 2)
  );
}

const CUSTOM_PATTERN_MOTIFS = new Set<PatternMotif>([
  'saddles',
  'rings',
  'chevrons',
  'teardrops',
  'bars',
  'tracks',
  'magma_cracks',
  'ripples',
  'cobblestone',
  'milk_bands',
  'veins',
  'facets',
  'strata',
  'bismuth',
]);

function formatMotifFormulaLabel(motif: PatternMotif): string {
  return motif.replace(/_/g, ' ');
}

/**
 * Derives a modular shader/pattern rule from genetic loci + subtle polygenic seed.
 * Wild-type and pure color/tone morphs preserve the iconic Ball Python "alien_heads" puzzle coat,
 * real pattern genes transform it authentically, and Morpharium Custom genes drive preserved/elemental motifs.
 */
export function derivePatternRule(genotype: Genotype, polygenicSeed: number): PatternRule {
  const bel = isBlueEyedLeucistic(genotype);
  const blackEl = isBlackEyedLeucistic(genotype);
  const ivory = isIvory(genotype);
  const eightBall = isEightBall(genotype);
  const cobblestone = isCobblestone(genotype);
  const obsidianCobble = isObsidianCobblestone(genotype);
  const magma = countAlleles(genotype.magma);
  const tidal = countAlleles(genotype.tidal);
  const saddler = countAlleles(genotype.saddler) >= 1;
  const bullring = countAlleles(genotype.bullring);
  const chevron = countAlleles(genotype.chevron);
  const raindrop = countAlleles(genotype.raindrop) === 2;
  const crossbar = countAlleles(genotype.crossbar) >= 1;
  const trackline = countAlleles(genotype.trackline) >= 1;
  const milksnake = countAlleles(genotype.milksnake);
  const monsoon = countAlleles(genotype.monsoon) === 2;
  const sunset = countAlleles(genotype.sunset) === 2;
  const geneticstripe = countAlleles(genotype.geneticstripe) === 2;
  const tristripe = countAlleles(genotype.tristripe) === 2;
  const leopard = countAlleles(genotype.leopard);
  const monarch = countAlleles(genotype.monarch) === 2;
  const cinnamon = countAlleles(genotype.cinnamon);
  const blade = countAlleles(genotype.blade);

  const spider = countAlleles(genotype.spider) >= 1;
  const pinstripe = countAlleles(genotype.pinstripe) >= 1;
  const clown = countAlleles(genotype.clown) === 2;
  const piebald = countAlleles(genotype.piebald) === 2;
  const enchi = countAlleles(genotype.enchi);
  const mojave = countAlleles(genotype.mojave);
  const lesser = countAlleles(genotype.lesser);
  const pastel = countAlleles(genotype.pastel);
  const fire = countAlleles(genotype.fire);
  const albino = countAlleles(genotype.albino) === 2;
  const banana = countAlleles(genotype.banana);
  const ghi = countAlleles(genotype.ghi);
  const cypress = countAlleles(genotype.cypress);
  const blackpastel = countAlleles(genotype.blackpastel);
  const yellowbelly = countAlleles(genotype.yellowbelly);
  const desertghost = countAlleles(genotype.desertghost) === 2;
  const hypo = countAlleles(genotype.hypo) === 2;

  const r1 = seededFloat(polygenicSeed, 1);
  const r2 = seededFloat(polygenicSeed, 2);
  const r3 = seededFloat(polygenicSeed, 3);

  let motif: PatternMotif = 'alien_heads';
  let weight: PatternWeight = 'medium';
  let modifier: PatternModifier = 'banded';

  const legacyCobbleOnly =
    cobblestone && countAlleles(genotype.cobblestone) === 0 && countAlleles(genotype.obsidian) === 0;
  const activeElementalProfiles = ELEMENTAL_VISUAL_PROFILES.filter((prof) => {
    const c = countAlleles(genotype[prof.locusId]);
    const def = LOCUS_DEFINITIONS[prof.locusId];
    return def.mode === 'recessive' ? c === 2 : c >= 1;
  });

  if (legacyCobbleOnly) {
    motif = 'cobblestone';
    weight = obsidianCobble ? 'broad' : 'medium';
    modifier = obsidianCobble ? 'speckled' : 'banded';
  } else if (activeElementalProfiles.length > 0) {
    // Pick highest-tier active elemental/mineral profile for pattern rule metadata
    const top = activeElementalProfiles.reduce((best, cur) => (cur.tier >= best.tier ? cur : best));
    motif = top.motif;
    weight = top.weight;
    modifier = top.modifier;
  } else if (magma >= 1) {
    motif = 'magma_cracks';
    weight = magma === 2 ? 'broad' : 'thin';
    modifier = 'flamed';
  } else if (tidal >= 1) {
    motif = 'ripples';
    weight = tidal === 2 ? 'broad' : 'blushed';
    modifier = 'flamed';
  } else if (bel || blackEl || ivory) {
    motif = ivory ? 'lines' : r1 < 0.5 ? 'lines' : 'keyholes';
    weight = 'blushed';
    modifier = 'faded';
  } else if (eightBall) {
    motif = 'inkblot';
    weight = 'broad';
    modifier = 'faded';
  } else if (milksnake >= 1) {
    motif = 'milk_bands';
    weight = milksnake === 2 ? 'broad' : 'medium';
    modifier = 'banded';
  } else if (trackline) {
    // Preserved uniform dash-dot tracks (-o-o-o-) -> Custom Trackline gene
    motif = 'tracks';
    weight = 'thin';
    modifier = r2 < 0.65 ? 'dotted' : 'banded';
  } else if (crossbar) {
    // Preserved straight cross-body bars -> Custom Crossbar gene
    motif = 'bars';
    weight = pastel > 0 ? 'blushed' : 'medium';
    modifier = 'banded';
  } else if (pinstripe && spider) {
    motif = 'lines';
    weight = 'thin';
    modifier = 'dotted';
  } else if (pinstripe) {
    motif = 'lines';
    weight = 'thin';
    modifier = r2 < 0.55 ? 'flamed' : 'dotted';
  } else if (spider) {
    motif = 'webbing';
    weight = 'thin';
    modifier = r2 < 0.5 ? 'dotted' : 'speckled';
  } else if (clown) {
    motif = 'dorsal_stripe';
    weight = pastel > 0 ? 'blushed' : 'broad';
    modifier = r2 < 0.5 ? 'banded' : 'flamed';
  } else if (monsoon) {
    motif = 'mosaic';
    weight = 'thin';
    modifier = 'speckled';
  } else if (tristripe) {
    motif = 'tri_stripe';
    weight = 'broad';
    modifier = 'dotted';
  } else if (geneticstripe) {
    motif = 'dorsal_stripe';
    weight = 'medium';
    modifier = 'banded';
  } else if (sunset) {
    motif = 'dorsal_stripe';
    weight = 'blushed';
    modifier = 'flamed';
  } else if (leopard >= 1) {
    motif = 'rosettes';
    weight = leopard === 2 ? 'broad' : 'medium';
    modifier = 'speckled';
  } else if (blade >= 1) {
    motif = 'banded';
    weight = blade === 2 ? 'thin' : 'medium';
    modifier = 'banded';
  } else if (cinnamon >= 1) {
    motif = cinnamon === 2 ? 'inkblot' : 'keyholes';
    weight = 'broad';
    modifier = 'flamed';
  } else if (monarch) {
    motif = 'alien_heads';
    weight = 'blushed';
    modifier = 'faded';
  } else if (raindrop) {
    // Preserved original teardrop motif -> Custom Raindrop gene
    motif = 'teardrops';
    weight = pastel > 0 ? 'blushed' : 'medium';
    modifier = r2 < 0.5 ? 'dotted' : 'flamed';
  } else if (chevron >= 1) {
    // Preserved original chevron motif -> Custom Chevron gene
    motif = 'chevrons';
    weight = chevron === 2 ? 'broad' : 'medium';
    modifier = 'banded';
  } else if (bullring >= 1) {
    // Preserved original concentric rings motif -> Custom Bullring gene
    motif = 'rings';
    weight = bullring === 2 ? 'broad' : 'medium';
    modifier = r2 < 0.5 ? 'dotted' : 'banded';
  } else if (saddler) {
    // Preserved original geometric twin-dot saddles -> Custom Saddler gene
    motif = 'saddles';
    weight = pastel > 0 ? 'blushed' : 'medium';
    modifier = r2 < 0.5 ? 'banded' : 'dotted';
  } else if (cypress >= 1) {
    motif = 'lines';
    weight = cypress === 2 ? 'thin' : 'medium';
    modifier = 'flamed';
  } else if (ghi >= 1) {
    motif = 'inkblot';
    weight = 'broad';
    modifier = 'speckled';
  } else if (enchi >= 1) {
    // Authentic Enchi: reduced flat copper/gold alien heads with thin chocolate bridges & blushed crown
    motif = 'banded';
    weight = enchi === 2 || pastel >= 1 ? 'blushed' : 'medium';
    modifier = 'flamed';
  } else if (mojave === 1) {
    motif = 'keyholes';
    weight = pastel >= 1 ? 'blushed' : 'medium';
    modifier = r2 < 0.6 ? 'flamed' : 'dotted';
  } else if (blackpastel === 1) {
    motif = 'keyholes';
    weight = 'broad';
    modifier = 'flamed';
  } else if (lesser === 1) {
    motif = 'keyholes';
    weight = 'blushed';
    modifier = 'flamed';
  } else {
    // Wild-type Normal & pure color/tone morphs (Pastel, Fire, Banana, Yellow Belly, Albino,
    // Axanthic, Lavender Albino, Desert Ghost, Hypo, Ultramel) retain authentic "alien_heads"!
    motif = 'alien_heads';
    if (banana >= 1) {
      weight = 'blushed';
      modifier = 'speckled';
    } else if (hypo) {
      weight = 'blushed';
      modifier = 'faded';
    } else if (pastel >= 1) {
      weight = 'blushed';
      modifier = r3 < 0.6 ? 'flamed' : 'banded';
    } else if (fire === 1 || yellowbelly === 1) {
      weight = 'medium';
      modifier = 'flamed';
    } else if (desertghost) {
      weight = 'medium';
      modifier = 'banded';
    } else if (albino) {
      weight = 'medium';
      modifier = r3 < 0.5 ? 'flamed' : 'banded';
    } else {
      weight = r2 < 0.55 ? 'medium' : 'broad';
      modifier = r3 < 0.3 ? 'dotted' : r3 < 0.72 ? 'banded' : 'flamed';
    }
  }

  // Piebald overrides modifier to patched (unless pure leucistic); Calico renders as its own snowy flank splash pass!
  if (piebald && !bel && !blackEl) {
    modifier = 'patched';
  }

  const glyph = buildPatternGlyph(motif, weight, modifier);
  const frequency =
    weight === 'thin' ? 1.35 : weight === 'broad' ? 0.78 : weight === 'blushed' ? 0.92 : 1.0;

  return {
    motif,
    weight,
    modifier,
    formula: `(${formatMotifFormulaLabel(motif)}) (${weight}) (${modifier})`,
    glyph,
    frequency,
    variationSeed: r3,
    isCustomPattern: CUSTOM_PATTERN_MOTIFS.has(motif),
  };
}

function buildPatternGlyph(
  motif: PatternMotif,
  weight: PatternWeight,
  modifier: PatternModifier
): string {
  if (motif === 'cobblestone') return '[#][#][#]';
  if (motif === 'magma_cracks') return '/\\~/\\~/\\';
  if (motif === 'ripples') return '≈~≈~≈~≈';
  if (motif === 'milk_bands') return '▓█░█▓█░';
  if (motif === 'veins') return '~/~\\~/~';
  if (motif === 'facets') return '◇◆◇◆◇◆◇';
  if (motif === 'strata') return '≡≈≡≈≡≈≡';
  if (motif === 'bismuth') return '回·回·回';
  if (motif === 'bars') return '| | | | |';
  if (motif === 'tracks') return modifier === 'dotted' ? '-o-o-o-' : '=======';
  if (modifier === 'faded') return '· · · · ·';
  if (motif === 'lines' && modifier === 'dotted') return '-o-o-o-';
  if (motif === 'lines') return weight === 'thin' ? '~~-~~-~' : '=~=~=~=';
  if (motif === 'dorsal_stripe') return '===·===·===';
  if (motif === 'tri_stripe') return '===···===';
  if (motif === 'mosaic') return '∷·∷·∷·∷';
  if (motif === 'rosettes') return '❖·❖·❖·❖';
  if (motif === 'keyholes') return '(o)-(o)';
  if (motif === 'banded') return '{ }-={ }';
  if (motif === 'inkblot') return '▓░▓░▓░▓';
  if (motif === 'alien_heads') return '{··}-{··}';
  if (motif === 'rings' && modifier === 'dotted') return 'o·o·o·o';
  if (motif === 'rings') return '(O)-(O)';
  if (motif === 'webbing') return '/\\/o/\\/';
  if (motif === 'teardrops') return '<>·<>·<>';
  if (motif === 'chevrons') return '>>>->>>';
  if (modifier === 'patched') return '[##]___[##]';
  if (modifier === 'speckled') return ':#::#::#:';
  return '(8)-(8)';
}

// --- Layered Hex Color Utilities for Composable Pigment & Melanin Blending ---

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [180, 150, 110];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${ch(r)}${ch(g)}${ch(b)}`.toUpperCase();
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const k = clamp(t, 0, 1);
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

function desaturateHex(hex: string, amount: number, coolTint = 0): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = clamp(amount, 0, 1);
  const nr = r + (lum - r) * k;
  const ng = g + (lum - g) * k;
  const nb = b + (lum - b) * k + coolTint * 12;
  return rgbToHex(nr, ng, nb);
}

function invertHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(255 - r, 255 - g, 255 - b);
}

function colorDistance(hexA: string, hexB: string): number {
  const [ar, ag, ab] = hexToRgb(hexA);
  const [br, bg, bb] = hexToRgb(hexB);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

/**
 * Unified biological melanin-removal transform ("removes dark eumelanin" rather than "paints white/yellow"):
 * - Pure dark melanin (low luminance, low chroma: black/espresso ridges, charcoal obsidian, dark mortar)
 *   lifts cleanly to bright ivory-white (or soft orchid-white for Lavender Albino).
 * - Non-melanin chromatic pigments (yellow xanthophores, Sunset orange, Water aqua, Lava glow, Banana lilac)
 *   are preserved and brightened cleanly without hardcoded per-morph branches!
 */
function removeMelaninColor(
  hex: string,
  opts: { whiteTarget?: string; yellowTarget?: string; isPatternChannel?: boolean } = {}
): string {
  const { whiteTarget = '#FFF7EA', yellowTarget = '#F9D65C', isPatternChannel = false } = opts;
  const [r, g, b] = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const chroma = maxC - minC;

  // 1) Pure dark melanin (low luminance + low chroma -> black/espresso/charcoal, or very dark shadow pattern):
  //    removing dark eumelanin leaves crisp ivory-white (with tiny hue echo on dark gem shadows for high contrast!)
  if ((lum < 92 && chroma < 62) || (isPatternChannel && lum < 78)) {
    const residualTint = lum < 60 && chroma < 35 ? 0 : clamp((chroma - 24) / 140, 0, 0.22);
    if (residualTint < 0.04) return whiteTarget;
    const scale = 248 / Math.max(1, maxC);
    const tinted = rgbToHex(
      clamp(r * scale * 0.88 + 30, 0, 255),
      clamp(g * scale * 0.88 + 30, 0, 255),
      clamp(b * scale * 0.88 + 30, 0, 255)
    );
    return mixHex(whiteTarget, tinted, residualTint);
  }

  // 2) Low-chroma neutral stone/gray (e.g. Cobblestone pavers): lifts to warm sunlit alabaster/ivory
  if (chroma < 42) {
    return mixHex(whiteTarget, yellowTarget, isPatternChannel ? 0.08 : 0.22);
  }

  // 3) Chromatic pigments (Sunset orange, Water aqua, Lava orange, Classic tan, Banana, etc.):
  //    Lift lightness while preserving the chromatic hue; standard warm tan maps to vivid golden yellow.
  const liftScale = 250 / Math.max(1, maxC);
  const lifted = rgbToHex(
    clamp(r * liftScale * 0.9 + 26, 0, 255),
    clamp(g * liftScale * 0.86 + 24, 0, 255),
    clamp(b * liftScale * 0.84 + 22, 0, 255)
  );
  // Wild-type tan (#B5894F: r-g=44, b<g) sits near yellow; strong orange/red, green (Malachite/Emerald/Jade),
  // or cool/blue/purple hues keep their vivid hue cleanly when melanin is stripped!
  const orangePull = clamp((r - g - 44) / 72, 0, 1);
  const greenPull = clamp((g - r - 18) / 78, 0, 1);
  const coolPull = clamp((b - Math.min(r, g) + 8) / 95, 0, 1);
  const highChromaPull = clamp((chroma - 75) / 100, 0, 1);
  const hueKeep = clamp(
    Math.max(orangePull * 0.94, greenPull * 0.92, coolPull * 0.92, highChromaPull * 0.88),
    0,
    0.95
  );
  return mixHex(isPatternChannel ? whiteTarget : yellowTarget, lifted, hueKeep);
}

/**
 * Composable 4-layer pigment & melanin palette resolver:
 * 1) Base & pattern hue tones (warm wild-type, dark/light modifiers, elemental hues, tricolor accents)
 * 2) Hue-shifting color genes (Banana, Pastel, Enchi, Fire blend cleanly onto any base/elemental hue)
 * 3) Melanin & xanthophore filters (Axanthic, Hypo, Ultramel, Desert Ghost, Albino, Lavender Albino, Leucistic)
 * 4) Chromatic Inversion (flips every final RGB color regardless of prior layers)
 */
function derivePalette(
  genotype: Genotype,
  polygenicSeed = 0.5,
  modAlleles?: ModAlleleMap
): SnakePalette {
  const bel = isBlueEyedLeucistic(genotype);
  const blackEl = isBlackEyedLeucistic(genotype);
  const ivory = isIvory(genotype);
  const eightBall = isEightBall(genotype);
  const albino = countAlleles(genotype.albino) === 2;
  const lavenderAlbino = countAlleles(genotype.lavenderalbino) === 2;
  const ultramel = countAlleles(genotype.ultramel) === 2;
  const axanthic = countAlleles(genotype.axanthic) === 2;
  const piebald = countAlleles(genotype.piebald) === 2;
  const desertGhost = countAlleles(genotype.desertghost) === 2;
  const hypo = countAlleles(genotype.hypo) === 2;
  const pastel = countAlleles(genotype.pastel);
  const enchi = countAlleles(genotype.enchi);
  const mojave = countAlleles(genotype.mojave);
  const lesser = countAlleles(genotype.lesser);
  const spider = countAlleles(genotype.spider) >= 1;
  const pinstripe = countAlleles(genotype.pinstripe) >= 1;
  const clown = countAlleles(genotype.clown) === 2;
  const banana = countAlleles(genotype.banana);
  const fire = countAlleles(genotype.fire);
  const yellowbelly = countAlleles(genotype.yellowbelly);
  const blackpastel = countAlleles(genotype.blackpastel);
  const ghi = countAlleles(genotype.ghi);
  const cypress = countAlleles(genotype.cypress);
  const calico = countAlleles(genotype.calico) >= 1;
  const cobblestone = isCobblestone(genotype);
  const obsidianCobble = isObsidianCobblestone(genotype);
  const magma = countAlleles(genotype.magma);
  const tidal = countAlleles(genotype.tidal);
  const saddler = countAlleles(genotype.saddler) >= 1;
  const bullring = countAlleles(genotype.bullring);
  const chevron = countAlleles(genotype.chevron);
  const raindrop = countAlleles(genotype.raindrop) === 2;
  const crossbar = countAlleles(genotype.crossbar) >= 1;
  const trackline = countAlleles(genotype.trackline) >= 1;
  const milksnake = countAlleles(genotype.milksnake);
  const invert = countAlleles(genotype.invert) === 2;
  const monsoon = countAlleles(genotype.monsoon) === 2;
  const sunset = countAlleles(genotype.sunset) === 2;
  const geneticstripe = countAlleles(genotype.geneticstripe) === 2;
  const tristripe = countAlleles(genotype.tristripe) === 2;
  const leopard = countAlleles(genotype.leopard);
  const monarch = countAlleles(genotype.monarch) === 2;
  const cinnamon = countAlleles(genotype.cinnamon);
  const blade = countAlleles(genotype.blade);
  const isStrongMelanistic = eightBall || cinnamon === 2;
  const pigmentVoices: Array<{ hex: string; weight: number }> = [];
  const addPigmentVoice = (hex: string, weight: number) => {
    pigmentVoices.push({ hex, weight });
  };

  // --- Layer 1: Base Coat & Pattern Tones ---
  let base = '#B5894F';
  let patternPrimary = '#2E2219';
  let patternSecondary = '#D8B376';
  let accentColor: string | undefined;
  let belly = '#F3EAD8';
  let outline = '#1F1711';
  let eyeIris = '#7C5D3B';
  let eyePupil = '#120E0B';
  let headBlush = '#947348';
  let isLeucistic = false;
  let isAlbino = false;

  if (pastel === 2) {
    base = '#F6DB65';
    patternPrimary = '#5C4E37';
    patternSecondary = '#FFF0A8';
    headBlush = '#F9EBA7';
    eyeIris = '#77A876';
  } else if (pastel === 1) {
    base = '#E6C257';
    patternPrimary = '#3B2D20';
    patternSecondary = '#F5DF96';
    headBlush = '#DFC47B';
    eyeIris = '#7C9E6C';
  }

  if (fire === 1) {
    base = mixHex(base, pastel >= 1 ? '#F7DA78' : '#D9AE62', 0.78);
    patternPrimary = mixHex(patternPrimary, '#4D3B28', 0.65);
    patternSecondary = '#FBEAC0';
    headBlush = '#F4DFB0';
  }

  if (yellowbelly === 1) {
    base = mixHex(base, pastel >= 1 ? '#F0CE62' : '#CE9F52', 0.72);
    patternSecondary = '#F5D47D';
    belly = '#F9F2DC';
  }

  if (enchi === 2) {
    base = mixHex(base, '#EE9E3C', 0.85);
    patternPrimary = '#4E2E17';
    patternSecondary = '#FFE099';
    headBlush = '#FAD07E';
  } else if (enchi === 1) {
    base = mixHex(base, pastel >= 1 ? '#F6C150' : '#DF963F', 0.8);
    patternPrimary = '#462A16';
    patternSecondary = '#F7CF84';
    headBlush = '#F0C574';
  }

  if (cypress >= 1) {
    base = mixHex(base, cypress === 2 ? '#B8A66E' : '#A69460', 0.78);
    patternPrimary = '#362D1F';
    patternSecondary = '#DFD0A2';
  }

  if (eightBall) {
    base = '#2A2524';
    patternPrimary = '#1A1615';
    patternSecondary = '#443C39';
    belly = '#635954';
    outline = '#100D0C';
    eyeIris = '#4D413B';
    eyePupil = '#0B0908';
    headBlush = '#3A3331';
  } else if (blackpastel === 1) {
    base = mixHex(base, pastel >= 1 ? '#9E8568' : '#7C5C42', 0.8);
    patternPrimary = '#231914';
    patternSecondary = '#B89B7C';
    headBlush = '#634A37';
  }

  if (ghi >= 1) {
    base = mixHex(base, ghi === 2 ? '#594C3F' : '#857154', 0.82);
    patternPrimary = '#171412';
    patternSecondary = '#C4B18D';
    headBlush = '#4A3E33';
  }

  if (lesser === 1) {
    base = mixHex(base, pastel >= 1 ? '#ECCE82' : '#CFA96D', 0.8);
    patternPrimary = mixHex(patternPrimary, '#6E5233', 0.75);
    patternSecondary = '#F3E3BE';
    headBlush = '#E7D1A4';
  } else if (mojave === 1) {
    base = mixHex(base, pastel >= 1 ? '#D9C074' : '#A68E63', 0.78);
    patternPrimary = '#2A231E';
    patternSecondary = '#E6D6B0';
    headBlush = '#8D7C62';
  }

  if (pinstripe && !isStrongMelanistic) {
    base = mixHex(base, pastel >= 1 ? '#E8C563' : '#C99E57', 0.45);
    patternPrimary = mixHex(patternPrimary, '#3C2A1A', 0.45);
    patternSecondary = mixHex(patternSecondary, '#E9CFA0', 0.6);
  }

  if (clown && !isStrongMelanistic) {
    base = mixHex(base, pastel >= 1 ? '#F2CE6D' : '#D4A154', 0.58);
    patternPrimary = mixHex(patternPrimary, '#2C1B12', 0.7);
    patternSecondary = mixHex(patternSecondary, '#F2D694', 0.65);
    headBlush = '#4A2F1C';
  }

  if (cinnamon === 2) {
    // Super Cinnamon: sleek solid deep mahogany-charcoal
    base = '#382520';
    patternPrimary = '#1E1412';
    patternSecondary = '#5C3D34';
    belly = '#7A635A';
    outline = '#120C0A';
    headBlush = '#4C332C';
  } else if (cinnamon === 1 && !eightBall) {
    base = mixHex(base, '#8C593A', 0.72);
    patternPrimary = '#271712';
    patternSecondary = '#C9966E';
    headBlush = '#734B34';
    addPigmentVoice('#9A5B36', 0.52);
  }

  // Primarily pattern/shape genes: apply full warm tint when solo, but stay light on melanistic bases!
  if (leopard >= 1 && !isStrongMelanistic) {
    base = mixHex(base, leopard === 2 ? '#C49448' : '#CFA054', 0.42);
    patternPrimary = mixHex(patternPrimary, '#1B1410', 0.65);
    patternSecondary = mixHex(patternSecondary, '#EBC880', 0.55);
  }

  if (blade >= 1 && !isStrongMelanistic) {
    base = mixHex(base, blade === 2 ? '#DFB564' : '#CCA158', 0.35);
    patternSecondary = mixHex(patternSecondary, '#F0D599', 0.45);
  }

  if (geneticstripe && !isStrongMelanistic) {
    base = mixHex(base, '#D7AB5A', 0.44);
    patternPrimary = mixHex(patternPrimary, '#2E2016', 0.5);
    patternSecondary = mixHex(patternSecondary, '#EFE0B8', 0.5);
    belly = '#FAF6EB';
  }

  if (tristripe && !isStrongMelanistic) {
    base = mixHex(base, '#D5A756', 0.42);
    patternPrimary = mixHex(patternPrimary, '#191411', 0.55);
    patternSecondary = mixHex(patternSecondary, '#F2D99B', 0.5);
  }

  if (monsoon && !isStrongMelanistic) {
    // Clean light tan head & high-contrast warm tan/espresso mosaic
    base = mixHex(base, '#C9A46B', 0.52);
    patternPrimary = mixHex(patternPrimary, '#251B14', 0.6);
    patternSecondary = mixHex(patternSecondary, '#E6CCA0', 0.55);
    headBlush = '#D9BE8E';
  }

  if (pastel >= 1) addPigmentVoice(pastel === 2 ? '#F7DD72' : '#E5C662', pastel === 2 ? 0.55 : 0.42);
  if (enchi >= 1) addPigmentVoice(enchi === 2 ? '#EE9E3C' : '#DF963F', enchi === 2 ? 0.62 : 0.48);

  if (sunset) {
    // Fiery burnt-orange & rust gradient with bright orange flank flaming (strong pigment influencer)
    base = mixHex(base, '#D86327', isStrongMelanistic ? 0.58 : 0.86);
    patternPrimary = mixHex(patternPrimary, '#3B1C11', 0.72);
    patternSecondary = '#FFA142';
    belly = '#F8E3CC';
    outline = '#23100A';
    headBlush = '#E88542';
    addPigmentVoice('#E06424', 0.92);
  }

  if (saddler && !isStrongMelanistic && !sunset && pastel === 0 && enchi === 0 && mojave === 0 && lesser === 0) {
    base = '#C7944C';
    patternPrimary = '#2E1F15';
    patternSecondary = '#E6C282';
  }
  if (bullring >= 1 && !isStrongMelanistic && !sunset && pastel === 0 && mojave === 0 && lesser === 0) {
    base = bullring === 2 ? '#D98C52' : '#C47E4B';
    patternPrimary = '#2D1C14';
    patternSecondary = '#F0BE8A';
  }
  if (chevron >= 1 && !isStrongMelanistic && !sunset && pastel === 0 && enchi === 0) {
    base = chevron === 2 ? '#E2AF4E' : '#CC9B49';
    patternPrimary = '#2B1F16';
    patternSecondary = '#F2D28B';
  }
  if (raindrop && !isStrongMelanistic) {
    base = mixHex(base, '#94A68D', sunset || pastel >= 1 ? 0.48 : 0.82);
    patternPrimary = mixHex(patternPrimary, '#283229', 0.65);
    patternSecondary = mixHex(patternSecondary, '#D4E2CE', 0.6);
    headBlush = mixHex(headBlush, '#AEBF9F', 0.65);
    addPigmentVoice('#7F9B76', 0.62);
  }
  if (crossbar && !isStrongMelanistic && !sunset && pastel === 0 && enchi === 0) {
    base = '#D69F4E';
    patternPrimary = '#352216';
    patternSecondary = '#F4D594';
  }
  if (trackline && !isStrongMelanistic && !sunset && pastel === 0 && !pinstripe) {
    base = '#C9A462';
    patternPrimary = '#302317';
    patternSecondary = '#ECD4A4';
  }

  if (spider) {
    patternSecondary = '#FAF7F0';
    belly = '#FDFBF7';
  } else if (calico) {
    belly = '#FDFBF7';
  }

  // Elemental hue layers: symmetric dosage-scaled composition across all Element & Mineral loci
  // (Water, Lava, plus all 35 Tier 0-5 loci in ELEMENTAL_VISUAL_PROFILES — never paves over other genes!)
  const activeElementals: Array<{ profile: (typeof ELEMENTAL_VISUAL_PROFILES)[number]; count: 1 | 2 }> = [];
  for (const prof of ELEMENTAL_VISUAL_PROFILES) {
    const c = countAlleles(genotype[prof.locusId]);
    const def = LOCUS_DEFINITIONS[prof.locusId];
    const isVisual = def.mode === 'recessive' ? c === 2 : c >= 1;
    if (isVisual) {
      activeElementals.push({ profile: prof, count: c as 1 | 2 });
    }
  }
  const legacyCobbleOnly =
    cobblestone && countAlleles(genotype.cobblestone) === 0 && countAlleles(genotype.obsidian) === 0;
  const hasElemental = cobblestone || magma >= 1 || tidal >= 1 || activeElementals.length > 0;
  const hasPriorPigment =
    pigmentVoices.length > 0 || isStrongMelanistic || blackpastel === 1 || ghi >= 1;
  const hasPriorChromatic = pigmentVoices.some((v) => v.weight >= 0.6);

  if (legacyCobbleOnly) {
    const stoneBase = obsidianCobble ? '#4C505D' : '#858B92';
    const stonePrim = obsidianCobble ? '#1C1E26' : '#31363E';
    const stoneSec = obsidianCobble ? '#8B94A0' : '#BCC3CB';
    const stoneHead = obsidianCobble ? '#6B727D' : '#9FA6AE';
    const stoneMix = hasPriorPigment ? (obsidianCobble ? 0.58 : 0.52) : 0.92;
    base = mixHex(base, stoneBase, stoneMix);
    patternPrimary = mixHex(patternPrimary, stonePrim, hasPriorPigment ? 0.62 : 0.92);
    patternSecondary = mixHex(patternSecondary, stoneSec, stoneMix);
    accentColor = obsidianCobble ? '#434852' : '#6C737C';
    belly = mixHex(belly, '#CDD3D9', stoneMix);
    outline = '#17191E';
    eyeIris = obsidianCobble ? '#B785F5' : '#D9AA58';
    eyePupil = '#141210';
    headBlush = mixHex(headBlush, stoneHead, stoneMix);
    addPigmentVoice(stoneBase, obsidianCobble ? 0.72 : 0.56);
  } else {
    if (magma >= 1) {
      const lavaWeight = magma === 2 ? (hasPriorChromatic ? 0.62 : 0.88) : 0.5;
      base = mixHex(base, magma === 2 ? '#1E1412' : '#2C1F1C', lavaWeight);
      patternPrimary = mixHex(patternPrimary, magma === 2 ? '#FF5A14' : '#F46A1F', magma === 2 ? 0.9 : 0.58);
      patternSecondary = mixHex(patternSecondary, '#FFD35E', magma === 2 ? 0.85 : 0.55);
      belly = mixHex(belly, '#4A2B20', lavaWeight);
      outline = '#110B0A';
      eyeIris = '#FFA02E';
      eyePupil = '#3D0F06';
      headBlush = mixHex(headBlush, '#FF7D2A', lavaWeight);
      addPigmentVoice(magma === 2 ? '#FF5A14' : '#E86826', magma === 2 ? 0.86 : 0.52);
    }
    if (tidal >= 1) {
      const waterWeight = tidal === 2 ? (hasPriorChromatic || magma >= 1 ? 0.54 : 0.86) : 0.48;
      const waterBase = tidal === 2 ? '#1E6996' : '#2D85B2';
      base = mixHex(base, waterBase, waterWeight);
      patternPrimary = mixHex(patternPrimary, '#8CE5F4', tidal === 2 ? 0.84 : 0.54);
      patternSecondary = mixHex(patternSecondary, '#DDFBFF', tidal === 2 ? 0.82 : 0.52);
      belly = mixHex(belly, '#E3F8FC', waterWeight);
      outline = mixHex(outline, '#123A52', waterWeight);
      eyeIris = '#5FE7FA';
      eyePupil = '#0A2536';
      headBlush = mixHex(headBlush, '#76D7EB', waterWeight);
      addPigmentVoice(waterBase, tidal === 2 ? 0.92 : 0.55);
    }
  }

  // Symmetric blending for all 35 Element & Mineral synthesis loci (Tiers 0-5)
  let intrinsicMottle: { a: string; b: string; strength: number } | null = null;
  let translucentSum = 0;
  let translucentCount = 0;
  for (const { profile, count } of activeElementals) {
    const hasExisting = hasPriorPigment || magma >= 1 || tidal >= 1 || pigmentVoices.length > 0;
    const rawDosage = count === 2 ? profile.dosage2x : profile.dosage1x;
    const mixAmt = hasExisting ? Math.min(rawDosage, 0.62) : rawDosage;
    const targetBase = count === 2 ? profile.superBaseHex : profile.baseHex;
    const targetPrim = count === 2 ? (profile.superPrimaryHex ?? profile.primaryHex) : profile.primaryHex;
    const targetSec = count === 2 ? (profile.superSecondaryHex ?? profile.secondaryHex) : profile.secondaryHex;
    const targetHead = count === 2 ? (profile.superHeadHex ?? profile.headHex) : profile.headHex;
    base = mixHex(base, targetBase, mixAmt);
    patternPrimary = mixHex(patternPrimary, targetPrim, hasExisting ? Math.min(mixAmt + 0.1, 0.72) : Math.min(rawDosage + 0.12, 0.94));
    patternSecondary = mixHex(patternSecondary, targetSec, mixAmt);
    headBlush = mixHex(headBlush, targetHead, mixAmt);
    if (profile.bellyHex) belly = mixHex(belly, profile.bellyHex, mixAmt);
    if (profile.outlineHex) outline = mixHex(outline, profile.outlineHex, mixAmt);
    if (profile.eyeIrisHex && !albino && !lavenderAlbino) eyeIris = profile.eyeIrisHex;
    if (profile.eyePupilHex && !albino && !lavenderAlbino) eyePupil = profile.eyePupilHex;
    if (profile.accentHex && !accentColor) accentColor = profile.accentHex;
    addPigmentVoice(profile.voiceHex, count === 2 ? profile.voiceWeight2x : profile.voiceWeight1x);

    const op = count === 2 ? (profile.bodyOpacity2x ?? profile.bodyOpacity1x) : profile.bodyOpacity1x;
    if (op !== undefined && op < 0.99) {
      translucentSum += op;
      translucentCount++;
    }

    if (
      profile.intrinsicMottleA &&
      profile.intrinsicMottleB &&
      (!profile.intrinsicMottleSuperOnly || count === 2)
    ) {
      intrinsicMottle = {
        a: profile.intrinsicMottleA,
        b: profile.intrinsicMottleB,
        strength: profile.intrinsicMottleStrength ?? 0.62,
      };
    }
  }
  // Translucent genes (Air, Glass, Diamond, Frost, Quartz, Sap, Amber, Gems) blend opacity gracefully with opaque partners!
  const hasOpaquePartner =
    hasPriorPigment || magma >= 1 || tidal >= 1 || banana >= 1 || activeElementals.length > translucentCount;
  const rawOpacity = translucentCount > 0 ? translucentSum / translucentCount : 1;
  let bodyOpacity =
    translucentCount > 0
      ? clamp(hasOpaquePartner ? rawOpacity * 0.68 + 0.32 : rawOpacity, 0.28, 1)
      : 1;

  // Tricolor Milk Band scarlet saddle accent
  if (milksnake >= 1 && !cobblestone) {
    accentColor = milksnake === 2 ? '#D92F23' : '#C93C2B';
    if (!hasElemental && !sunset && !isStrongMelanistic && pastel === 0 && enchi === 0 && mojave === 0 && lesser === 0 && ghi === 0 && blackpastel === 0) {
      base = '#F2E4BE';
      patternPrimary = '#1C1715';
      patternSecondary = '#FCEFD2';
      headBlush = '#261D1A';
    }
  }

  // --- Layer 2: Hue-Shifting Color Genes (apply across BOTH classic and elemental bases!) ---
  if (hasElemental) {
    if (pastel >= 1) {
      base = mixHex(base, '#F6E17A', pastel === 2 ? 0.36 : 0.24);
      patternSecondary = mixHex(patternSecondary, '#FFF5C4', 0.45);
      headBlush = mixHex(headBlush, '#FAF0B8', 0.4);
    }
    if (enchi >= 1) {
      base = mixHex(base, '#E59A3E', enchi === 2 ? 0.34 : 0.22);
    }
    if (fire === 1) {
      base = mixHex(base, '#F2D68A', 0.22);
      patternSecondary = mixHex(patternSecondary, '#FFF3D4', 0.35);
    }
  }

  if (banana >= 1) {
    const banBase = banana === 2 ? '#FFE37A' : '#F4CF67';
    const banPrim = banana === 2 ? '#DFBEE8' : '#B997C9';
    addPigmentVoice(banBase, banana === 2 ? 0.8 : 0.65);
    if (hasElemental || sunset || isStrongMelanistic || raindrop) {
      // Blend banana-yellow & lilac-lavender smoothly into Sunset, Water, Lava, 8-Ball, etc.!
      const mixAmt = banana === 2 ? 0.6 : 0.48;
      base = mixHex(base, banBase, mixAmt);
      patternPrimary = mixHex(patternPrimary, banPrim, mixAmt);
      patternSecondary = mixHex(patternSecondary, '#FFF2B8', 0.52);
      headBlush = mixHex(headBlush, '#EBD3F2', 0.52);
      if (accentColor) accentColor = mixHex(accentColor, '#F29BB8', 0.4);
    } else {
      base = banBase;
      patternPrimary = banPrim;
      patternSecondary = '#FFF2B8';
      belly = '#FCF7EA';
      outline = '#8C7099';
      eyeIris = '#B5748A';
      eyePupil = '#361B26';
      headBlush = '#EBD3F2';
      if (accentColor) accentColor = mixHex(accentColor, '#F27D8F', 0.35);
    }
  }

  if (monarch && !albino && !lavenderAlbino) {
    addPigmentVoice('#8E6F9E', 0.62);
  }

  // Blend active visual Workshop / local Gene Pack palettes BEFORE melanin/albino/invert filters
  if (modAlleles) {
    const modEntries = Object.entries(modAlleles).sort(([a], [b]) => a.localeCompare(b));
    for (const [fullId, pair] of modEntries) {
      const count = countAlleles(pair);
      if (count === 0) continue;
      const modLoc = getModLocus(fullId);
      if (!modLoc) continue;
      const { spec } = modLoc;
      if (spec.mode === 'recessive' && count < 2) continue;
      const pal = count === 2 && spec.palette2x ? spec.palette2x : spec.palette1x;
      const w = clamp(pal.pigmentWeight ?? (count === 2 ? 0.88 : 0.76), 0.2, 1);
      const secW = clamp(w * 0.88, 0.2, 0.95);
      base = mixHex(base, pal.base, w);
      patternPrimary = mixHex(patternPrimary, pal.patternPrimary, secW);
      if (pal.patternSecondary) {
        patternSecondary = mixHex(patternSecondary, pal.patternSecondary, secW);
      }
      if (pal.accentColor) {
        accentColor = accentColor ? mixHex(accentColor, pal.accentColor, 0.55) : pal.accentColor;
      }
      if (pal.belly) belly = mixHex(belly, pal.belly, w * 0.8);
      if (pal.outline) outline = mixHex(outline, pal.outline, w * 0.75);
      if (pal.eyeIris) eyeIris = mixHex(eyeIris, pal.eyeIris, w * 0.8);
      if (typeof pal.bodyOpacity === 'number' && pal.bodyOpacity < bodyOpacity) {
        bodyOpacity = clamp(pal.bodyOpacity, 0.45, 1);
      }
      pigmentVoices.push({ hex: pal.base, weight: w });
    }
  }

  // Emergent dual-pigment "mixed paint" mottling: whenever two opposing/distant chromatic pigment voices
  // combine (e.g. Water + Sunset, Malachite + Sunset, Ruby + Sapphire), or a multi-hue mineral (Opal, Bismuth,
  // Verdigris Copper, Crying Obsidian) is expressed, swirling patches preserve each pigment!
  let mottleColorA: string | undefined;
  let mottleColorB: string | undefined;
  let mottleStrength = 0;
  if (pigmentVoices.length >= 2 && !axanthic) {
    let bestDist = 0;
    let bestA: { hex: string; weight: number } | null = null;
    let bestB: { hex: string; weight: number } | null = null;
    for (let i = 0; i < pigmentVoices.length; i++) {
      for (let j = i + 1; j < pigmentVoices.length; j++) {
        const d = colorDistance(pigmentVoices[i].hex, pigmentVoices[j].hex);
        if (d > bestDist) {
          bestDist = d;
          bestA = pigmentVoices[i];
          bestB = pigmentVoices[j];
        }
      }
    }
    if (bestA && bestB && bestDist >= 105) {
      mottleColorA = bestA.hex;
      mottleColorB = bestB.hex;
      mottleStrength = clamp(((bestDist - 105) / 120) * Math.min(bestA.weight, bestB.weight) * 0.95, 0.28, 0.78);
    }
  }
  if (!mottleColorA && intrinsicMottle && !axanthic) {
    mottleColorA = intrinsicMottle.a;
    mottleColorB = intrinsicMottle.b;
    mottleStrength = intrinsicMottle.strength;
  }

  const preAlbinoBase = base;

  // --- Layer 3: Melanin, Xanthophore & Contrast Biological Filters ---
  if (axanthic) {
    // Strips yellow/red xanthophores into cool monochrome silver/charcoal/ice tones
    if (!hasElemental && banana === 0 && !albino && !lavenderAlbino) {
      base = desertGhost ? '#E5E8EC' : pastel >= 1 ? '#D3D7DC' : '#A9B0B8';
      patternPrimary = clown || ghi >= 1 ? '#20242A' : '#353A42';
      patternSecondary = '#ECEFF2';
      belly = '#F4F6F8';
      outline = '#1B1F24';
      eyeIris = '#8F9AA6';
      eyePupil = '#111418';
      headBlush = pastel >= 1 ? '#E1E5EA' : '#969DA6';
    } else {
      base = desaturateHex(base, 0.82, 0.35);
      patternPrimary = desaturateHex(patternPrimary, 0.85, 0.25);
      patternSecondary = desaturateHex(patternSecondary, 0.85, 0.25);
      headBlush = desaturateHex(headBlush, 0.82, 0.25);
      outline = desaturateHex(outline, 0.9, 0.1);
      eyeIris = desaturateHex(eyeIris, 0.85, 0.2);
      if (accentColor) accentColor = desaturateHex(accentColor, 0.88, 0.2);
    }
  }

  if (hypo && !albino && !lavenderAlbino) {
    // Hypomelanistic smoky pastel wash over any underlying palette
    base = mixHex(base, '#E8CBB0', hasElemental ? 0.38 : 0.72);
    patternPrimary = mixHex(patternPrimary, '#8C7C70', 0.65);
    patternSecondary = mixHex(patternSecondary, '#F5E8D6', 0.65);
    outline = mixHex(outline, '#66584E', 0.6);
    headBlush = mixHex(headBlush, '#EEDBC4', 0.6);
  }

  if (ultramel && !albino && !lavenderAlbino) {
    isAlbino = true;
    base = mixHex(base, '#E3A74F', hasElemental ? 0.45 : 0.82);
    patternPrimary = mixHex(patternPrimary, '#8E5329', 0.72);
    patternSecondary = mixHex(patternSecondary, '#F7D79A', 0.65);
    outline = mixHex(outline, '#6B3D1D', 0.7);
    eyeIris = '#9B354D';
    eyePupil = '#4A0F1F';
    headBlush = mixHex(headBlush, '#EAC17D', 0.65);
  }

  if (monarch && !albino && !lavenderAlbino) {
    // Monarch hypomelanistic filter: bright yellow & cream against clean lilac-chocolate puzzle pattern
    base = mixHex(base, '#F2D674', hasElemental ? 0.45 : 0.82);
    patternPrimary = mixHex(patternPrimary, '#7B617A', 0.74);
    patternSecondary = mixHex(patternSecondary, '#FBF0C4', 0.7);
    outline = mixHex(outline, '#584459', 0.65);
    headBlush = mixHex(headBlush, '#EFE3F5', 0.7);
  }

  if (desertGhost && !albino && !lavenderAlbino) {
    // High-contrast clean brightening without browning
    base = mixHex(base, '#FFF4C8', hasElemental ? 0.22 : 0.45);
    patternPrimary = mixHex(patternPrimary, '#171412', hasElemental ? 0.35 : 0.72);
    patternSecondary = mixHex(patternSecondary, '#FFF9E6', 0.6);
  }

  if (albino && axanthic) {
    // Snow (Albino + Axanthic)
    isAlbino = true;
    base = hasElemental ? mixHex(desaturateHex(base, 0.85, 0.2), '#F7F2E8', 0.72) : '#F7F2E8';
    patternPrimary = '#E3D5E8';
    patternSecondary = '#FFFDF8';
    belly = '#FFFDF9';
    outline = '#BBA9B8';
    eyeIris = '#F06A83';
    eyePupil = '#8E1730';
    headBlush = '#FBF5FA';
    if (accentColor) accentColor = mixHex(desaturateHex(accentColor, 0.75), '#F2DCE8', 0.55);
  } else if (lavenderAlbino) {
    // Lavender Albino: removes melanin across ALL channels while tinting amelanistic white toward soft orchid-lavender
    isAlbino = true;
    const lavYellow = '#F7B44A';
    const lavWhite = '#DCC6EE';
    base = removeMelaninColor(preAlbinoBase, { whiteTarget: '#FBF2FF', yellowTarget: lavYellow });
    patternPrimary = mixHex(
      removeMelaninColor(patternPrimary, { whiteTarget: lavWhite, yellowTarget: lavYellow, isPatternChannel: true }),
      lavWhite,
      0.55
    );
    patternSecondary = removeMelaninColor(patternSecondary, { whiteTarget: '#FFF4E0', yellowTarget: '#FFE39E' });
    belly = '#FAF4FF';
    outline = '#B47933';
    headBlush = mixHex(removeMelaninColor(headBlush, { whiteTarget: '#EBD9F7', yellowTarget: '#FFE39E' }), '#EBD9F7', 0.45);
    if (accentColor) accentColor = mixHex(removeMelaninColor(accentColor, { whiteTarget: '#F5D6E8', yellowTarget: '#FF9E6B' }), '#F29BB8', 0.4);
    if (mottleColorA && mottleColorB) {
      mottleColorA = removeMelaninColor(mottleColorA, { whiteTarget: '#FBF2FF', yellowTarget: lavYellow });
      mottleColorB = removeMelaninColor(mottleColorB, { whiteTarget: '#FBF2FF', yellowTarget: lavYellow });
    }
    eyeIris = '#F05988';
    eyePupil = '#7D1032';
  } else if (albino) {
    // Unified biological melanin-removal Albino: strips dark melanin to crisp ivory-white while preserving
    // underlying xanthophores & chromatic hues across Classic, Sunset, Water, Lava, Cobblestone, etc.!
    isAlbino = true;
    const brightYellow =
      banana >= 1 ? '#FFF08A' : pastel >= 1 ? '#FFE76B' : enchi >= 1 ? '#FFBF47' : '#F9D65C';
    const whiteBand = spider || sunset || tidal >= 1 ? '#FFFDF6' : '#FFF5E0';
    base = removeMelaninColor(preAlbinoBase, { whiteTarget: whiteBand, yellowTarget: brightYellow });
    patternPrimary = removeMelaninColor(patternPrimary, {
      whiteTarget: whiteBand,
      yellowTarget: brightYellow,
      isPatternChannel: true,
    });
    patternSecondary = removeMelaninColor(patternSecondary, {
      whiteTarget: '#FFFDF6',
      yellowTarget: '#F4B44E',
    });
    belly = '#FFFDF7';
    outline = mixHex('#C9892C', base, 0.35);
    headBlush = removeMelaninColor(headBlush, { whiteTarget: '#FFF8E8', yellowTarget: '#FFF0B8' });
    if (accentColor) {
      accentColor = removeMelaninColor(accentColor, { whiteTarget: '#FFF2E6', yellowTarget: '#FF845C' });
    }
    if (mottleColorA && mottleColorB) {
      mottleColorA = removeMelaninColor(mottleColorA, { whiteTarget: whiteBand, yellowTarget: brightYellow });
      mottleColorB = removeMelaninColor(mottleColorB, { whiteTarget: whiteBand, yellowTarget: brightYellow });
    }
    eyeIris = '#F25A74';
    eyePupil = '#8C1028';
  }

  // Leucistic complexes (pure white coat with signature eyes)
  if (bel) {
    isLeucistic = true;
    isAlbino = albino || lavenderAlbino;
    base = albino ? '#FFFDF7' : '#F6F4EE';
    patternPrimary = '#EAE6DB';
    patternSecondary = '#FDFCF9';
    belly = '#FFFFFF';
    outline = '#C5BFA8';
    eyeIris = albino || lavenderAlbino ? '#E86A87' : '#65B8E6';
    eyePupil = albino || lavenderAlbino ? '#9C1D3B' : '#11293B';
    headBlush = '#FFFFFF';
  } else if (blackEl) {
    isLeucistic = true;
    base = '#FAF8F0';
    patternPrimary = '#F7E194';
    patternSecondary = '#FFFFFF';
    belly = '#FFFFFF';
    outline = '#CFC8B4';
    eyeIris = '#262321';
    eyePupil = '#0A0908';
    headBlush = '#FFFDF5';
  } else if (ivory) {
    isLeucistic = true;
    base = '#F5F0E3';
    patternPrimary = '#DDD2E6';
    patternSecondary = '#FFFDF7';
    belly = '#FFFFFF';
    outline = '#C2B7A3';
    eyeIris = '#48403A';
    eyePupil = '#14110F';
    headBlush = '#FAF6EC';
  }

  // Individual polygenic tone/warmth/contrast expression (zero extra save bytes, derived from polygenicSeed)
  if (!isLeucistic) {
    const toneShift = (seededFloat(polygenicSeed, 51) - 0.5) * 2; // [-1, 1]
    const warmShift = (seededFloat(polygenicSeed, 52) - 0.5) * 2; // [-1, 1]
    const contrastShift = (seededFloat(polygenicSeed, 53) - 0.5) * 2; // [-1, 1]

    if (toneShift > 0) {
      base = mixHex(base, '#FFF4D8', toneShift * 0.11);
      patternSecondary = mixHex(patternSecondary, '#FFF8E6', toneShift * 0.1);
      headBlush = mixHex(headBlush, '#FFF5DC', toneShift * 0.09);
    } else if (toneShift < 0) {
      const amt = -toneShift;
      base = mixHex(base, '#2E2016', amt * 0.1);
      patternSecondary = mixHex(patternSecondary, '#4A3826', amt * 0.08);
      headBlush = mixHex(headBlush, '#36271C', amt * 0.08);
    }

    if (warmShift > 0) {
      base = mixHex(base, '#F4B64A', warmShift * 0.09);
      patternSecondary = mixHex(patternSecondary, '#FFD67A', warmShift * 0.08);
    } else if (warmShift < 0) {
      const amt = -warmShift;
      base = mixHex(base, '#8B8F99', amt * 0.08);
      patternSecondary = mixHex(patternSecondary, '#D0D4DC', amt * 0.07);
    }

    if (contrastShift > 0) {
      patternPrimary = mixHex(patternPrimary, '#140F0C', contrastShift * 0.09);
    } else if (contrastShift < 0) {
      patternPrimary = mixHex(patternPrimary, '#9E8D7B', -contrastShift * 0.08);
    }
  }

  // --- Layer 4: Chromatic Inversion (flips every final RGB color regardless of prior layers) ---
  if (invert) {
    base = invertHex(base);
    patternPrimary = invertHex(patternPrimary);
    patternSecondary = invertHex(patternSecondary);
    if (accentColor) accentColor = invertHex(accentColor);
    belly = invertHex(belly);
    outline = invertHex(outline);
    eyeIris = invertHex(eyeIris);
    eyePupil = invertHex(eyePupil);
    headBlush = invertHex(headBlush);
    if (mottleColorA) mottleColorA = invertHex(mottleColorA);
    if (mottleColorB) mottleColorB = invertHex(mottleColorB);
  }

  return {
    base,
    patternPrimary,
    patternSecondary,
    accentColor,
    belly,
    outline,
    eyeIris,
    eyePupil,
    headBlush,
    isLeucistic,
    isAlbino,
    isPiebald: piebald,
    isCalico: calico,
    isInverted: invert,
    ...(mottleColorA && mottleColorB && !isLeucistic
      ? { mottleColorA, mottleColorB, mottleStrength }
      : {}),
    ...(bodyOpacity < 0.99 && !isLeucistic ? { bodyOpacity } : {}),
  };
}

/**
 * Stages 1 & 2: Resolves genotype into a continuous phenotype vector (`SkinFieldParams`)
 * plus composable `FieldContribution[]` in local (u, v) snake skin coordinates.
 *
 * - Biological morphs transform the shared Voronoi-edge pattern skeleton along a true
 *   morphological erosion/dilation continuum (GHI/Black Pastel -> Classic -> Mojave -> Enchi -> Spider -> Pinstripe).
 * - Custom genes introduce distinct mathematical fields (`transverse_waves`, `angled_waves`,
 *   `cellular_pavers`, `magma_fissures`, `water_caustics`, etc.) that compose via modulation,
 *   blending, union, or coordinate warping when bred with any biological morph!
 */
export function deriveSkinPhenotypeSpec(
  genotype: Genotype,
  polygenicSeed = 0.5,
  modAlleles?: ModAlleleMap
): SkinPhenotypeSpec {
  const params = createDefaultSkinFieldParams();
  const contributions: FieldContribution[] = [];

  const bel = isBlueEyedLeucistic(genotype);
  const blackEl = isBlackEyedLeucistic(genotype);
  const ivory = isIvory(genotype);
  const eightBall = isEightBall(genotype);
  const cobblestone = isCobblestone(genotype);
  const obsidianCobble = isObsidianCobblestone(genotype);

  const pastel = countAlleles(genotype.pastel);
  const mojave = countAlleles(genotype.mojave);
  const lesser = countAlleles(genotype.lesser);
  const enchi = countAlleles(genotype.enchi);
  const spider = countAlleles(genotype.spider);
  const pinstripe = countAlleles(genotype.pinstripe);
  const piebald = countAlleles(genotype.piebald) === 2;
  const clown = countAlleles(genotype.clown) === 2;
  const banana = countAlleles(genotype.banana);
  const fire = countAlleles(genotype.fire);
  const yellowbelly = countAlleles(genotype.yellowbelly);
  const blackpastel = countAlleles(genotype.blackpastel);
  const ghi = countAlleles(genotype.ghi);
  const cypress = countAlleles(genotype.cypress);
  const calico = countAlleles(genotype.calico) >= 1;
  const desertghost = countAlleles(genotype.desertghost) === 2;
  const hypo = countAlleles(genotype.hypo) === 2;

  const saddler = countAlleles(genotype.saddler) >= 1;
  const bullring = countAlleles(genotype.bullring);
  const chevron = countAlleles(genotype.chevron);
  const raindrop = countAlleles(genotype.raindrop) === 2;
  const magma = countAlleles(genotype.magma);
  const tidal = countAlleles(genotype.tidal);
  const crossbar = countAlleles(genotype.crossbar) >= 1;
  const trackline = countAlleles(genotype.trackline) >= 1;
  const milksnake = countAlleles(genotype.milksnake);
  const monsoon = countAlleles(genotype.monsoon) === 2;
  const sunset = countAlleles(genotype.sunset) === 2;
  const geneticstripe = countAlleles(genotype.geneticstripe) === 2;
  const tristripe = countAlleles(genotype.tristripe) === 2;
  const leopard = countAlleles(genotype.leopard);
  const monarch = countAlleles(genotype.monarch) === 2;
  const cinnamon = countAlleles(genotype.cinnamon);
  const blade = countAlleles(genotype.blade);

  // Individual polygenic expression variance (zero extra save bytes; spans low-to-high expression per snake)
  const vFreq = (seededFloat(polygenicSeed, 11) - 0.5) * 0.26;
  const vCov = (seededFloat(polygenicSeed, 12) - 0.5) * 0.1;
  const vAspect = (seededFloat(polygenicSeed, 13) - 0.5) * 0.22;
  const vWarp = (seededFloat(polygenicSeed, 14) - 0.5) * 0.16;
  const vBlush = (seededFloat(polygenicSeed, 15) - 0.5) * 0.26;
  const vFlame = (seededFloat(polygenicSeed, 16) - 0.5) * 0.26;
  const vWidthVar = (seededFloat(polygenicSeed, 17) - 0.5) * 0.2;
  const vSymmetry = (seededFloat(polygenicSeed, 18) - 0.5) * 0.22;

  params.frequency = clamp(1.0 + vFreq, 0.72, 1.34);
  params.coverage = clamp(0.54 + vCov, 0.45, 0.63);
  params.aspectRatio = clamp(params.aspectRatio + vAspect, 0.72, 1.35);
  params.warpStrength = clamp(params.warpStrength + vWarp, 0.04, 0.45);
  params.blush = clamp(params.blush + vBlush, 0.02, 0.55);
  params.flankFlame = clamp(params.flankFlame + vFlame, 0.02, 0.55);
  params.localWidthVariation = clamp(params.localWidthVariation + vWidthVar, 0.25, 0.85);
  params.symmetry = clamp(params.symmetry + vSymmetry, 0.02, 0.55);
  params.dorsalBias = -0.18; // Subtle Classic dorsal beading + tail stripe

  // --- Biological Color & Tone Modifiers (preserve underlying topology while adjusting softness/blush/flames) ---
  if (pastel >= 1) {
    params.blush += pastel === 2 ? 0.45 : 0.26;
    params.edgeSoftness += 0.015;
    params.flankFlame += 0.15;
    // Expressive "hook" and "ringed" alien-head crowns
    params.crownNotch += pastel === 2 ? 0.18 : 0.12;
    params.localWidthVariation += 0.08;
  }
  if (fire === 1) {
    params.blush += 0.3;
    params.flankFlame += 0.45;
    params.coverage -= 0.03;
    params.regionalCoherence += 0.12;
  }
  if (yellowbelly === 1) {
    params.flankFlame += 0.52;
    params.blush += 0.14;
    params.baseTaper -= 0.1;
  }
  if (banana >= 1) {
    params.blush += 0.25;
    params.speckleAmount = Math.max(params.speckleAmount, banana === 2 ? 0.55 : 0.42);
  }
  if (hypo) {
    params.blush += 0.35;
    params.edgeSoftness += 0.025;
  }
  if (desertghost) {
    params.edgeSoftness = Math.max(0.025, params.edgeSoftness - 0.028);
  }

  // --- Biological Pattern Modifiers along the Shared Erosion / Dilation Continuum ---
  // Dilation end: GHI & Black Pastel / 8-Ball
  if (eightBall) {
    params.coverage += 0.34;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.edgeSoftness += 0.04;
    params.widthContrast = 0;
    params.baseTaper = 0;
    params.crownNotch = 0;
  } else if (blackpastel === 1) {
    // Hollowed-out puzzle alien heads with enlarged centers & heavy side flaming
    params.coverage += 0.13;
    params.eyeCount = Math.min(params.eyeCount, 1);
    params.eyeStrength = 0.95;
    params.warpStrength += 0.16;
    params.flankFlame += 0.32;
    params.widthContrast = 0.52;
    params.baseTaper = 0.44;
    params.crownNotch = 0.72;
    params.localWidthVariation = 0.72;
    params.regionalCoherence = 0.24;
    // Gentle organic coordinate warp melts alien-head edges into squiggly puzzle curves
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.24,
      frequency: 0.72,
    });
  }

  if (ghi >= 1) {
    // Misshapen dark rings/splatters of gold with spotting & silvery side flames
    params.coverage += ghi === 2 ? 0.28 : 0.2;
    params.warpStrength += 0.24;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.dorsalBias = Math.max(params.dorsalBias, 0.12);
    params.widthContrast = 0.56;
    params.baseTaper = 0.78;
    params.crownNotch = 0.25;
    params.localWidthVariation = 0.82;
    params.regionalCoherence = 0.15;
    params.speckleAmount = Math.max(params.speckleAmount, 0.28);
    // Jagged coordinate distortion fragments dark saddles into erratic splatters
    contributions.push({
      field: 'magma_fissures',
      operation: 'warp',
      strength: ghi === 2 ? 0.36 : 0.26,
      frequency: 0.85,
    });
  }

  // Mid-band keyholes: Mojave & Lesser
  if (mojave === 1 && !bel) {
    // Crisp single-eye keyhole silhouette: pinched neck, cleaner rounded crown, uniform rhythm
    params.coverage -= 0.05;
    params.eyeCount = Math.min(params.eyeCount, 1);
    params.eyeStrength = 0.85;
    params.symmetry += 0.34;
    params.blush += 0.2;
    params.widthContrast = 0.18;
    params.baseTaper = 0.84;
    params.crownNotch = 0.22;
    params.localWidthVariation = 0.34;
    params.regionalCoherence = 0.62;
  }
  if (lesser === 1 && !bel) {
    // Heavily blushed puzzle pattern with wider, softer alien heads
    params.coverage -= 0.08;
    params.eyeCount = Math.min(params.eyeCount, 1);
    params.eyeStrength = 0.72;
    params.symmetry += 0.28;
    params.blush += 0.34;
    params.edgeSoftness += 0.018;
    params.baseTaper = 0.46;
    params.crownNotch = 0.34;
    params.regionalCoherence = 0.56;
    // Gentle subtraction carves open bright butterscotch windows in dark bridges
    contributions.push({
      field: 'radial_rings',
      operation: 'subtract',
      strength: 0.24,
      frequency: 0.92,
      params: { style: 0 },
    });
  }

  // Erosion progression: Classic (0.54) -> Enchi (0.38) -> Spider (0.25) -> Pinstripe (0.19)
  if (enchi >= 1) {
    // Greatly reduced pattern with flat, featureless copper/bronze alien heads
    params.coverage -= enchi === 2 ? 0.21 : 0.16;
    params.frequency *= enchi === 2 ? 0.82 : 0.88;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.symmetry += 0.22;
    params.flankFlame += 0.45;
    params.blush += 0.26;
    params.dorsalBias = Math.max(0, params.dorsalBias);
    params.widthContrast = enchi === 2 ? 0.1 : 0.16;
    params.baseTaper = enchi === 2 ? 0.1 : 0.22;
    params.crownNotch = enchi === 2 ? 0 : 0.08;
    params.localWidthVariation = enchi === 2 ? 0.22 : 0.3;
    params.regionalCoherence = 0.68;
    // Subtle transverse pigmentation modulation pulls combos toward clean banded rhythm
    contributions.push({
      field: 'transverse_waves',
      operation: 'modulate',
      strength: enchi === 2 ? 0.48 : 0.34,
      frequency: 0.88,
    });
  }

  if (spider >= 1) {
    // Heavily reduced black web/puzzle lines around enlarged golden alien heads
    params.coverage -= 0.27;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.warpStrength += 0.36;
    params.aspectRatio *= 1.15;
    params.flankFlame += 0.3;
    params.baseTaper = 0.18;
    params.crownNotch = 0.12;
    params.localWidthVariation = 0.74;
    params.regionalCoherence = 0.22;
    // Directional coordinate distortion stretches lateral bridges into asymmetric webbing
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.34,
      frequency: 1.05,
    });
  }

  if (pinstripe >= 1) {
    // Contrasting dorsal stripe, dark pinstripes, and water-droplet lateral lines
    params.coverage -= 0.34;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.dorsalBias = Math.max(params.dorsalBias, 0.38);
    params.aspectRatio *= 1.48;
    params.warpStrength += 0.36;
    params.edgeSoftness = Math.max(0.028, params.edgeSoftness - 0.02);
    params.widthContrast = 0.22;
    params.baseTaper = 0.48;
    params.crownNotch = 0.08;
    params.regionalCoherence = 0.74;
    // Fine longitudinal tracks fuse onto whatever cellular pattern is underneath
    contributions.push({
      field: 'longitudinal_waves',
      operation: 'smoothUnion',
      strength: 0.4,
      frequency: 1.05,
      params: { trackOffset: 0.24, trackWidth: 0.075, dotted: 0.35 },
    });
  }

  if (cypress >= 1) {
    // Large alien heads displaying keyholes + prominent dorsal stripe tendency
    params.coverage -= cypress === 2 ? 0.24 : 0.17;
    params.dorsalBias = Math.max(params.dorsalBias, 0.28);
    params.aspectRatio *= cypress === 2 ? 1.75 : 1.5;
    params.warpStrength += 0.22;
    params.flankFlame += 0.3;
    params.eyeCount = Math.min(params.eyeCount, 1);
    params.eyeStrength = 0.72;
    params.widthContrast = 0.44;
    params.baseTaper = 0.54;
    params.crownNotch = 0.24;
    params.regionalCoherence = 0.72;
    // Longitudinal smoothUnion reinforces prominent dorsal corridors while preserving flank keyholes
    contributions.push({
      field: 'longitudinal_waves',
      operation: 'smoothUnion',
      strength: cypress === 2 ? 0.46 : 0.32,
      frequency: 0.95,
      params: { trackOffset: 0.22, trackWidth: 0.1, dotted: 0 },
    });
  }

  // Emergent interaction: dark dilators (GHI / Black Pastel) + banded/linear reducers (Enchi / Spider / Pinstripe)
  // intersect to carve heavy dark saddles into crisp broken islands & segmented bars
  if ((ghi >= 1 || blackpastel === 1) && (enchi >= 1 || spider >= 1 || pinstripe >= 1)) {
    contributions.push({
      field: 'transverse_waves',
      operation: 'intersection',
      strength: 0.32,
      frequency: 0.92,
    });
  }

  if (clown) {
    // Extremely clean, reduced flanks beneath a bold dorsal stripe
    params.dorsalBias = 0.88;
    params.coverage = clamp(params.coverage - 0.06, 0.28, 0.65);
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.edgeSoftness = 0.032;
    params.widthContrast = 0.18;
    params.baseTaper = 0.24;
    params.crownNotch = 0.1;
    params.localWidthVariation = 0.28;
    params.regionalCoherence = 0.75;
  }

  // --- Additional Extreme Real-World Pattern Modifiers ---
  if (cinnamon === 2) {
    // Super Cinnamon: sleek, nearly solid deep mahogany coat
    params.coverage += 0.34;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.edgeSoftness += 0.035;
    params.widthContrast = 0;
    params.baseTaper = 0;
    params.crownNotch = 0;
  } else if (cinnamon === 1) {
    // Rich dark melted puzzle alien heads with heavy side blushing
    params.coverage += 0.14;
    params.eyeCount = Math.min(params.eyeCount, 1);
    params.eyeStrength = 0.88;
    params.warpStrength += 0.18;
    params.blush += 0.24;
    params.flankFlame += 0.28;
    params.widthContrast = 0.48;
    params.baseTaper = 0.38;
    params.crownNotch = 0.66;
    params.localWidthVariation = 0.64;
    params.regionalCoherence = 0.28;
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.28,
      frequency: 0.76,
    });
  }

  if (leopard >= 1) {
    // Busy dark speckled rosette/puzzle shatterer
    params.coverage += leopard === 2 ? 0.18 : 0.1;
    params.frequency *= leopard === 2 ? 1.4 : 1.26;
    params.aspectRatio *= 0.78;
    params.warpStrength += 0.24;
    params.blush += 0.24;
    params.speckleAmount = Math.max(params.speckleAmount, leopard === 2 ? 0.26 : 0.16);
    params.localWidthVariation = 0.76;
    params.regionalCoherence = 0.2;
    contributions.push({
      field: 'shattered_mosaic',
      operation: 'union',
      strength: leopard === 2 ? 0.56 : 0.42,
      frequency: 1.08,
      params: { mode: 1 },
    });
  }

  if (blade >= 1) {
    // Clean pattern reducer streamlining alien heads into crisp bands & linear dorsal corridors
    params.coverage -= blade === 2 ? 0.22 : 0.13;
    params.aspectRatio *= blade === 2 ? 1.58 : 1.3;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.crownNotch = 0.06;
    params.baseTaper = 0.22;
    params.regionalCoherence = 0.84;
    contributions.push({
      field: 'longitudinal_waves',
      operation: 'subtract',
      strength: blade === 2 ? 0.5 : 0.3,
      frequency: 0.9,
      params: { trackOffset: 0.0, trackWidth: 0.14, dotted: 0 },
    });
  }

  if (monarch) {
    // Clean lilac-chocolate puzzle pattern without eye pixelation
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.blush += 0.44;
    params.edgeSoftness += 0.016;
    params.crownNotch = 0.18;
    params.warpStrength += 0.18;
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.26,
      frequency: 0.85,
    });
  }

  if (sunset) {
    // Burnt-orange fiery reduced flanks + dark bubbly dorsal stripe + stretched candle-flame bands
    params.coverage = clamp(params.coverage - 0.1, 0.34, 0.56);
    params.aspectRatio = Math.min(params.aspectRatio, 0.74);
    params.dorsalBias = Math.max(params.dorsalBias, 0.58);
    params.flankFlame = Math.max(params.flankFlame, 0.92);
    params.blush += 0.32;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.baseTaper = 0.18;
    params.crownNotch = 0.08;
    params.warpStrength += 0.28;
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.42,
      frequency: 0.95,
    });
  }

  if (geneticstripe) {
    // Clean continuous golden dorsal stripe framed by dark margins; blends proportionally with other morphs
    params.coverage = params.coverage * 0.52 + 0.48 * 0.48;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.warpStrength = Math.min(params.warpStrength, 0.16);
    params.crownNotch = 0;
    params.baseTaper = 0.2;
    params.regionalCoherence = 0.88;
    contributions.push({
      field: 'stripe_tracks',
      operation: 'blend',
      strength: eightBall || cinnamon === 2 ? 0.42 : 0.64,
      frequency: 1.0,
      params: { style: 0 },
    });
  }

  if (tristripe) {
    // Thick solid dark central dorsal stripe + two undulating lateral side stripes; lets melanistic/pattern combos breathe
    params.coverage = params.coverage * 0.52 + 0.46 * 0.48;
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.warpStrength = Math.min(params.warpStrength, 0.18);
    params.crownNotch = 0.05;
    params.regionalCoherence = 0.86;
    contributions.push({
      field: 'stripe_tracks',
      operation: 'blend',
      strength: eightBall || cinnamon === 2 ? 0.44 : 0.66,
      frequency: 1.05,
      params: { style: 1 },
    });
  }

  if (monsoon) {
    // Extreme shattered mosaic labyrinth spots + horizontal coordinate distortion + broken dorsal thread
    params.coverage = 0.34;
    params.frequency = 1.75;
    params.aspectRatio = 0.55;
    params.warpStrength = 0.72;
    params.dorsalBias = -0.5;
    params.symmetry = 0;
    params.widthContrast = 0.14;
    params.baseTaper = 0.3;
    params.crownNotch = 0;
    params.localWidthVariation = 0.62;
    params.regionalCoherence = 0.42;
    params.edgeSoftness = Math.max(params.edgeSoftness, 0.055);
    params.blush = Math.max(params.blush, 0.42);
    params.scaleRelief = Math.max(params.scaleRelief, 0.56);
    // Smooth horizontal coordinate distortion shears vertical alien-head columns apart without tearing
    contributions.push({
      field: 'water_caustics',
      operation: 'warp',
      strength: 0.68,
      frequency: 1.35,
      params: { horizWarp: 1 },
    });
    // 90-degree-turned mosaic subtract/union shatters remaining bands into crisp confetti pebble spots
    contributions.push({
      field: 'shattered_mosaic',
      operation: 'subtract',
      strength: 0.48,
      frequency: 1.15,
      params: { mode: 0 },
    });
    contributions.push({
      field: 'shattered_mosaic',
      operation: 'union',
      strength: 0.72,
      frequency: 0.98,
      params: { mode: 0 },
    });
  }

  // Orthogonal regional pigment suppression (never overrides underlying pattern topology!)
  if (calico && !bel && !blackEl) {
    // Solo Calico is the lightest, patchiest white-siding; mixing with other visual morphs (Pastel, Enchi, Spider,
    // Mojave, Black Pastel, Fire, Yellow Belly, etc.) dramatically pulls out larger scraped high-white splashes!
    const otherVisualCount =
      (pastel > 0 ? 1 : 0) +
      (mojave > 0 ? 1 : 0) +
      (lesser > 0 ? 1 : 0) +
      (enchi > 0 ? 1 : 0) +
      (spider > 0 ? 1 : 0) +
      (pinstripe > 0 ? 1 : 0) +
      (clown ? 1 : 0) +
      (banana > 0 ? 1 : 0) +
      (fire > 0 ? 1 : 0) +
      (yellowbelly > 0 ? 1 : 0) +
      (blackpastel > 0 ? 1 : 0) +
      (ghi > 0 ? 1 : 0) +
      (cypress > 0 ? 1 : 0) +
      (desertghost ? 1 : 0) +
      (hypo ? 1 : 0) +
      (countAlleles(genotype.albino) === 2 ? 1 : 0) +
      (countAlleles(genotype.axanthic) === 2 ? 1 : 0) +
      (countAlleles(genotype.lavenderalbino) === 2 ? 1 : 0) +
      (countAlleles(genotype.ultramel) === 2 ? 1 : 0) +
      (saddler || bullring > 0 || chevron > 0 || raindrop || magma > 0 || tidal > 0 || crossbar || trackline || milksnake > 0
        ? 1
        : 0);

    const calicoPoly = seededFloat(polygenicSeed, 41);
    if (otherVisualCount === 0) {
      // Solo Calico: subtle pale/frosted lower flank patches & scattered white scales (0.26..0.54)
      params.calicoRise = 0.26 + calicoPoly * 0.28;
    } else {
      // Mixed-morph Calico combos bring out much stronger high-white scraped patches (0.54..0.94)
      params.calicoRise = clamp(0.54 + (otherVisualCount - 1) * 0.13 + calicoPoly * 0.24, 0.54, 0.94);
    }
    // Calico also subtly enhances contrast & dorsal tail striping
    params.flankFlame = clamp(params.flankFlame + 0.16, 0, 1);
  }
  if (piebald && !bel && !blackEl) {
    // Authentic low-white (~15%) to high-white (~92%) Piebald expression:
    // Random base roll from polygenicSeed + real-world genetic high-white pushers & low-white anchors!
    let pieAmt = 0.22 + seededFloat(polygenicSeed, 42) * 0.6;
    // High-white pushers (Spider, Pastel, Enchi, Fire, Pinstripe)
    if (spider >= 1) pieAmt += 0.16;
    if (pastel >= 1) pieAmt += pastel === 2 ? 0.14 : 0.07;
    if (enchi >= 1) pieAmt += enchi === 2 ? 0.14 : 0.08;
    if (fire === 1) pieAmt += 0.07;
    if (pinstripe >= 1) pieAmt += 0.07;
    // Low-white dark anchors (Black Pastel / 8-Ball, Cinnamon / Super Cinnamon, GHI, Leopard)
    if (blackpastel >= 1) pieAmt -= blackpastel === 2 ? 0.22 : 0.14;
    if (cinnamon >= 1) pieAmt -= cinnamon === 2 ? 0.22 : 0.14;
    if (ghi >= 1) pieAmt -= 0.1;
    if (leopard >= 1) pieAmt -= 0.08;
    params.piebaldAmount = clamp(pieAmt, 0.12, 0.92);
  }

  // Leucistic complexes soften internal contrast cleanly
  if (bel || blackEl || ivory) {
    params.coverage = 0.12;
    params.blush = 0.85;
    params.edgeSoftness = 0.2;
    params.scaleRelief = 0.28;
  }

  // --- Composable Custom Mathematical Fields (always interact with the shared cellular field) ---
  const legacyCobbleOnly =
    cobblestone && countAlleles(genotype.cobblestone) === 0 && countAlleles(genotype.obsidian) === 0;
  const hasExplicitAlienEyes =
    mojave === 1 || lesser === 1 || blackpastel === 1 || cinnamon === 1 || leopard >= 1;
  if (legacyCobbleOnly) {
    // Legacy Lava + Water fusion fallback: crisp running-bond cobblestone bricks via symmetric blend + mortar union
    const targetCov = obsidianCobble ? 0.62 : 0.56;
    params.coverage = params.coverage * 0.45 + targetCov * 0.55;
    params.edgeSoftness = Math.min(params.edgeSoftness, 0.024);
    params.warpStrength = Math.min(params.warpStrength, 0.14);
    params.scaleRelief = 0.16;
    if (!hasExplicitAlienEyes) {
      params.eyeCount = 0;
      params.eyeStrength = 0;
    }
    contributions.push({
      field: 'cellular_pavers',
      operation: 'blend',
      strength: 0.88,
      frequency: obsidianCobble ? 1.15 : 1.0,
    });
    contributions.push({
      field: 'cellular_pavers',
      operation: 'smoothUnion',
      strength: 0.24,
      frequency: obsidianCobble ? 1.15 : 1.0,
    });
  } else {
    if (magma >= 1) {
      params.coverage = params.coverage * 0.5 + (magma === 2 ? 0.58 : 0.46) * 0.5;
      params.warpStrength += 0.25;
      contributions.push({
        field: 'magma_fissures',
        operation: 'smoothUnion',
        strength: magma === 2 ? 0.88 : 0.76,
        frequency: magma === 2 ? 1.15 : 1.0,
      });
    }
    if (tidal >= 1) {
      params.coverage = params.coverage * 0.5 + (tidal === 2 ? 0.54 : 0.46) * 0.5;
      params.blush += 0.25;
      contributions.push({
        field: 'water_caustics',
        operation: 'warp',
        strength: tidal === 2 ? 0.82 : 0.66,
        frequency: tidal === 2 ? 1.18 : 1.0,
      });
      contributions.push({
        field: 'water_caustics',
        operation: 'modulate',
        strength: tidal === 2 ? 0.56 : 0.42,
        frequency: tidal === 2 ? 1.18 : 1.0,
      });
    }
  }

  // Symmetric bespoke contributions for all 35 Element & Mineral synthesis loci (Tiers 0-5)
  let activeElementalCount = 0;
  for (const prof of ELEMENTAL_VISUAL_PROFILES) {
    const c = countAlleles(genotype[prof.locusId]);
    const def = LOCUS_DEFINITIONS[prof.locusId];
    const isVisual = def.mode === 'recessive' ? c === 2 : c >= 1;
    if (!isVisual) continue;
    activeElementalCount++;
    const count = c as 1 | 2;
    const covDelta = count === 2 ? (prof.coverageDelta2x ?? prof.coverageDelta1x ?? 0) : (prof.coverageDelta1x ?? 0);
    params.coverage += covDelta;
    if (prof.edgeSoftness !== undefined) params.edgeSoftness = Math.min(params.edgeSoftness, prof.edgeSoftness);
    if (prof.blushDelta) params.blush += prof.blushDelta;
    if (prof.flankFlameDelta) params.flankFlame += prof.flankFlameDelta;
    if (prof.warpDelta) params.warpStrength += prof.warpDelta;
    if (prof.speckleAmount) params.speckleAmount = Math.max(params.speckleAmount, prof.speckleAmount);
    if (prof.scaleRelief !== undefined) params.scaleRelief = Math.min(params.scaleRelief, prof.scaleRelief);
    for (const contrib of prof.buildContributions(count)) {
      contributions.push(contrib);
    }
  }
  // Clear Classic's default twin alien-head eyes on bespoke mineral textures unless an explicit alien-head gene is paired
  if (activeElementalCount > 0 && !hasExplicitAlienEyes) {
    params.eyeCount = 0;
    params.eyeStrength = 0;
    params.dorsalBias = Math.max(params.dorsalBias, 0);
  }

  if (milksnake >= 1 && !cobblestone) {
    params.accentBandStrength = milksnake === 2 ? 1.0 : 0.9;
    params.coverage -= 0.14;
    params.dorsalBias = Math.min(params.dorsalBias, -0.32);
    params.edgeSoftness = 0.032;
    // Modulates the cellular network into tricolor cream/black/scarlet rings while letting base genetics show through
    contributions.push({
      field: 'transverse_waves',
      operation: 'modulate',
      strength: milksnake === 2 ? 0.95 : 0.86,
      frequency: milksnake === 2 ? 1.15 : 0.95,
    });
  }

  if (crossbar && !cobblestone) {
    // Slices the cellular pattern into crisp cross-body bars via intersection
    contributions.push({
      field: 'transverse_waves',
      operation: 'intersection',
      strength: 0.74,
      frequency: 1.05,
    });
  }

  if (trackline && !cobblestone) {
    // Organically fuses dash-dot railway tracks over the spine
    contributions.push({
      field: 'longitudinal_waves',
      operation: 'smoothUnion',
      strength: 0.78,
      frequency: 1.0,
      params: {
        trackOffset: 0.28,
        trackWidth: 0.13,
        dotted: spider > 0 || seededFloat(polygenicSeed, 2) < 0.65 ? 1 : 0,
      },
    });
  }

  if (chevron >= 1 && !cobblestone) {
    // Modulates the cellular field into marching arrowhead chevrons
    contributions.push({
      field: 'angled_waves',
      operation: 'modulate',
      strength: chevron === 2 ? 0.88 : 0.76,
      frequency: chevron === 2 ? 1.15 : 0.95,
      params: { slant: 0.095 },
    });
  }

  if (bullring >= 1 && !cobblestone) {
    // Stamps bold concentric double-window rings via union
    contributions.push({
      field: 'radial_rings',
      operation: 'union',
      strength: bullring === 2 ? 0.86 : 0.76,
      frequency: bullring === 2 ? 0.88 : 1.0,
      params: { style: 0 },
    });
  }

  if (saddler && !cobblestone) {
    // Smoothly fuses twin-dot medallion saddles onto the cellular field
    contributions.push({
      field: 'radial_rings',
      operation: 'smoothUnion',
      strength: 0.74,
      frequency: 1.0,
      params: { style: 1 },
    });
  }

  if (raindrop && !cobblestone) {
    // Carves crisp light alternating teardrop beads out of dark dorsal pigment via subtraction
    contributions.push({
      field: 'radial_teardrops',
      operation: 'subtract',
      strength: 0.72,
      frequency: 1.05,
    });
  }

  // Apply active visual Workshop / local Gene Pack scalar field contributions & custom UV textures
  let customMapId: string | undefined;
  if (modAlleles) {
    const modEntries = Object.entries(modAlleles).sort(([a], [b]) => a.localeCompare(b));
    for (const [fullId, pair] of modEntries) {
      const count = countAlleles(pair);
      if (count === 0) continue;
      const modLoc = getModLocus(fullId);
      if (!modLoc) continue;
      const { spec } = modLoc;
      if (spec.mode === 'recessive' && count < 2) continue;
      const fieldSpec = count === 2 && spec.field2x ? spec.field2x : spec.field1x;
      const built = buildModFieldContribution(modLoc.packId, fieldSpec);
      contributions.push(built.contribution);
      if (built.customMapId) customMapId = built.customMapId;
      if (fieldSpec.paramOverrides) {
        const po = fieldSpec.paramOverrides;
        if (typeof po.coverage === 'number') params.coverage = params.coverage * 0.35 + po.coverage * 0.65;
        if (typeof po.frequency === 'number') params.frequency = params.frequency * 0.35 + po.frequency * 0.65;
        if (typeof po.aspectRatio === 'number') params.aspectRatio = params.aspectRatio * 0.35 + po.aspectRatio * 0.65;
        if (typeof po.warpStrength === 'number') params.warpStrength = Math.max(params.warpStrength, po.warpStrength);
        if (typeof po.blush === 'number') params.blush = Math.max(params.blush, po.blush);
        if (typeof po.flankFlame === 'number') params.flankFlame = Math.max(params.flankFlame, po.flankFlame);
        if (typeof po.speckleAmount === 'number') params.speckleAmount = Math.max(params.speckleAmount, po.speckleAmount);
        if (typeof po.calicoRise === 'number') params.calicoRise = Math.max(params.calicoRise, po.calicoRise);
        if (typeof po.piebaldAmount === 'number') params.piebaldAmount = Math.max(params.piebaldAmount, po.piebaldAmount);
        if (typeof po.scaleRelief === 'number') params.scaleRelief = Math.max(params.scaleRelief, po.scaleRelief);
        if (typeof po.accentBandStrength === 'number') {
          params.accentBandStrength = Math.max(params.accentBandStrength, po.accentBandStrength);
        }
      }
    }
  }

  // Post-morph individual expression nudge so even fixed-target morphs (Monsoon, Stripes, Clown, etc.)
  // exhibit authentic low-to-high polygenic individuality across seeds without changing morph identity
  if (!bel && !blackEl && !ivory) {
    const postCov = (seededFloat(polygenicSeed, 54) - 0.5) * 0.06;
    const postFreq = 1 + (seededFloat(polygenicSeed, 55) - 0.5) * 0.14;
    const postWarp = (seededFloat(polygenicSeed, 56) - 0.5) * 0.1;
    const postBlush = (seededFloat(polygenicSeed, 57) - 0.5) * 0.14;
    const postFlame = (seededFloat(polygenicSeed, 58) - 0.5) * 0.14;
    params.coverage += postCov;
    params.frequency *= postFreq;
    params.warpStrength += postWarp;
    params.blush += postBlush;
    params.flankFlame += postFlame;

    for (let i = 0; i < contributions.length; i++) {
      const c = contributions[i];
      const delta = (seededFloat(polygenicSeed, 60 + i) - 0.5) * 0.14;
      c.strength = clamp(c.strength + delta, 0.12, 1.0);
    }
  }

  // Final safe clamps across the continuous phenotype space
  params.coverage = clamp(params.coverage, 0.14, 0.88);
  params.frequency = clamp(params.frequency, 0.55, 2.0);
  params.aspectRatio = clamp(params.aspectRatio, 0.5, 2.4);
  params.warpStrength = clamp(params.warpStrength, 0, 1.0);
  params.dorsalBias = clamp(params.dorsalBias, -0.5, 1.0);
  params.symmetry = clamp(params.symmetry, 0, 1.0);
  params.widthContrast = clamp(params.widthContrast, 0, 1.0);
  params.baseTaper = clamp(params.baseTaper, 0, 1.0);
  params.crownNotch = clamp(params.crownNotch, 0, 1.0);
  params.localWidthVariation = clamp(params.localWidthVariation, 0, 1.0);
  params.regionalCoherence = clamp(params.regionalCoherence, 0, 1.0);
  params.eyeCount = clamp(params.eyeCount, 0, 2);
  params.eyeStrength = clamp(params.eyeStrength, 0, 1);
  params.edgeSoftness = clamp(params.edgeSoftness, 0.02, 0.24);
  params.blush = clamp(params.blush, 0, 1);
  params.flankFlame = clamp(params.flankFlame, 0, 1);
  params.calicoRise = clamp(params.calicoRise, 0, 1);
  params.piebaldAmount = clamp(params.piebaldAmount, 0, 1);
  params.speckleAmount = clamp(params.speckleAmount, 0, 1);
  params.accentBandStrength = clamp(params.accentBandStrength, 0, 1);
  params.scaleRelief = clamp(params.scaleRelief, 0, 1);

  return {
    generatorVersion: SKIN_GENERATOR_VERSION,
    params,
    contributions,
    ...(customMapId ? { customMapId } : {}),
  };
}

/**
 * Resolves a SkinPhenotypeSpec from any SnakePhenotype (falling back gracefully
 * if a legacy MorphDiscovery or mock object omits `skinSpec`).
 */
export function resolveSkinSpecForPhenotype(phenotype: SnakePhenotype): SkinPhenotypeSpec {
  if (phenotype.skinSpec) return phenotype.skinSpec;
  const params = createDefaultSkinFieldParams();
  const contributions: FieldContribution[] = [];
  const { motif, weight, modifier } = phenotype.patternRule;

  if (weight === 'thin') params.coverage = 0.24;
  else if (weight === 'broad') params.coverage = 0.68;
  else if (weight === 'blushed') {
    params.coverage = 0.48;
    params.blush = 0.45;
  }

  if (motif === 'banded') {
    params.coverage = 0.38;
    params.eyeCount = 0;
    params.flankFlame = 0.55;
  } else if (motif === 'webbing') {
    params.coverage = 0.25;
    params.eyeCount = 0;
    params.warpStrength = 0.58;
  } else if (motif === 'lines') {
    params.coverage = weight === 'thin' ? 0.2 : 0.36;
    params.eyeCount = 0;
    params.dorsalBias = 0.36;
    params.aspectRatio = 1.5;
  } else if (motif === 'dorsal_stripe') {
    params.dorsalBias = 0.88;
    params.eyeCount = 0;
  } else if (motif === 'keyholes') {
    params.eyeCount = 1;
    params.symmetry = 0.5;
  } else if (motif === 'inkblot') {
    params.coverage = 0.74;
    params.eyeCount = 0;
  } else if (motif === 'cobblestone') {
    contributions.push({ field: 'cellular_pavers', operation: 'blend', strength: 0.96 });
  } else if (motif === 'magma_cracks') {
    contributions.push({ field: 'magma_fissures', operation: 'blend', strength: 0.94 });
  } else if (motif === 'ripples') {
    contributions.push({ field: 'water_caustics', operation: 'blend', strength: 0.92 });
  } else if (motif === 'milk_bands') {
    params.accentBandStrength = 0.95;
    contributions.push({ field: 'transverse_waves', operation: 'blend', strength: 0.94 });
  } else if (motif === 'bars') {
    contributions.push({ field: 'transverse_waves', operation: 'blend', strength: 0.94 });
  } else if (motif === 'tracks') {
    contributions.push({
      field: 'longitudinal_waves',
      operation: 'blend',
      strength: 0.94,
      params: { dotted: modifier === 'dotted' ? 1 : 0 },
    });
  } else if (motif === 'chevrons') {
    contributions.push({ field: 'angled_waves', operation: 'blend', strength: 0.93 });
  } else if (motif === 'rings' || motif === 'saddles') {
    contributions.push({
      field: 'radial_rings',
      operation: 'blend',
      strength: 0.92,
      params: { style: motif === 'saddles' ? 1 : 0 },
    });
  } else if (motif === 'teardrops') {
    contributions.push({ field: 'radial_teardrops', operation: 'blend', strength: 0.93 });
  }

  if (phenotype.palette.isCalico) params.calicoRise = 0.72;
  if (phenotype.palette.isPiebald) params.piebaldAmount = 0.78;

  return {
    generatorVersion: SKIN_GENERATOR_VERSION,
    params,
    contributions,
  };
}

export function evaluatePhenotype(
  genotype: Genotype,
  polygenicSeed = 0.5,
  modAlleles?: ModAlleleMap
): SnakePhenotype {
  const bel = isBlueEyedLeucistic(genotype);
  const blackEl = isBlackEyedLeucistic(genotype);
  const ivory = isIvory(genotype);
  const eightBall = isEightBall(genotype);
  const cobblestone = isCobblestone(genotype);
  const obsidianCobble = isObsidianCobblestone(genotype);
  const visualGenes: string[] = [];
  const hetGenes: string[] = [];
  const tagSet = new Set<MorphTag>();

  const addTags = (loc: LocusId) => {
    for (const t of LOCUS_DEFINITIONS[loc].tags) tagSet.add(t);
  };

  const pastel = countAlleles(genotype.pastel);
  const mojave = countAlleles(genotype.mojave);
  const lesser = countAlleles(genotype.lesser);
  const enchi = countAlleles(genotype.enchi);
  const spider = countAlleles(genotype.spider);
  const pinstripe = countAlleles(genotype.pinstripe);
  const albino = countAlleles(genotype.albino);
  const piebald = countAlleles(genotype.piebald);
  const clown = countAlleles(genotype.clown);
  const axanthic = countAlleles(genotype.axanthic);
  const banana = countAlleles(genotype.banana);
  const fire = countAlleles(genotype.fire);
  const yellowbelly = countAlleles(genotype.yellowbelly);
  const blackpastel = countAlleles(genotype.blackpastel);
  const ghi = countAlleles(genotype.ghi);
  const cypress = countAlleles(genotype.cypress);
  const calico = countAlleles(genotype.calico);
  const lavenderalbino = countAlleles(genotype.lavenderalbino);
  const desertghost = countAlleles(genotype.desertghost);
  const hypo = countAlleles(genotype.hypo);
  const ultramel = countAlleles(genotype.ultramel);
  const saddler = countAlleles(genotype.saddler);
  const bullring = countAlleles(genotype.bullring);
  const chevron = countAlleles(genotype.chevron);
  const raindrop = countAlleles(genotype.raindrop);
  const magma = countAlleles(genotype.magma);
  const tidal = countAlleles(genotype.tidal);
  const crossbar = countAlleles(genotype.crossbar);
  const trackline = countAlleles(genotype.trackline);
  const milksnake = countAlleles(genotype.milksnake);
  const invert = countAlleles(genotype.invert);
  const monsoon = countAlleles(genotype.monsoon);
  const sunset = countAlleles(genotype.sunset);
  const geneticstripe = countAlleles(genotype.geneticstripe);
  const tristripe = countAlleles(genotype.tristripe);
  const leopard = countAlleles(genotype.leopard);
  const monarch = countAlleles(genotype.monarch);
  const cinnamon = countAlleles(genotype.cinnamon);
  const blade = countAlleles(genotype.blade);

  // Iconic real-world named combos: Killer Bee (Super Pastel + Spider) & Bumblebee (Pastel + Spider)
  const isKillerBee = pastel === 2 && spider >= 1;
  const isBumblebee = pastel === 1 && spider >= 1;

  if (isKillerBee) {
    visualGenes.push('Killer Bee');
    addTags('pastel');
    addTags('spider');
  } else if (isBumblebee) {
    visualGenes.push('Bumblebee');
    addTags('pastel');
    addTags('spider');
  } else if (pastel === 2) {
    visualGenes.push('Super Pastel');
    addTags('pastel');
  } else if (pastel === 1) {
    visualGenes.push('Pastel');
    addTags('pastel');
  }

  if (banana === 2) {
    visualGenes.push('Super Banana');
    addTags('banana');
  } else if (banana === 1) {
    visualGenes.push('Banana');
    addTags('banana');
  }

  if (enchi === 2) {
    visualGenes.push('Super Enchi');
    addTags('enchi');
  } else if (enchi === 1) {
    visualGenes.push('Enchi');
    addTags('enchi');
  }

  if (ghi === 2) {
    visualGenes.push('Super GHI');
    addTags('ghi');
  } else if (ghi === 1) {
    visualGenes.push('GHI');
    addTags('ghi');
  }

  if (cypress === 2) {
    visualGenes.push('Super Cypress');
    addTags('cypress');
  } else if (cypress === 1) {
    visualGenes.push('Cypress');
    addTags('cypress');
  }

  if (spider >= 1 && !isKillerBee && !isBumblebee) {
    visualGenes.push('Spider');
    addTags('spider');
  }
  if (pinstripe >= 1) {
    visualGenes.push('Pinstripe');
    addTags('pinstripe');
  }
  if (calico >= 1) {
    visualGenes.push('Calico');
    addTags('calico');
  }

  if (bel) {
    visualGenes.push('Blue-Eyed Leucistic');
    addTags('mojave');
    addTags('lesser');
  } else {
    if (mojave === 1) {
      visualGenes.push('Mojave');
      addTags('mojave');
    }
    if (lesser === 1) {
      visualGenes.push('Lesser');
      addTags('lesser');
    }
  }

  if (blackEl) {
    visualGenes.push('Black-Eyed Leucistic');
    addTags('fire');
  } else if (fire === 1) {
    visualGenes.push('Fire');
    addTags('fire');
  }

  if (ivory) {
    visualGenes.push('Ivory');
    addTags('yellowbelly');
  } else if (yellowbelly === 1) {
    visualGenes.push('Yellow Belly');
    addTags('yellowbelly');
  }

  if (eightBall) {
    visualGenes.push('8-Ball');
    addTags('blackpastel');
  } else if (blackpastel === 1) {
    visualGenes.push('Black Pastel');
    addTags('blackpastel');
  }

  if (albino === 2 && axanthic === 2) {
    visualGenes.push('Snow');
    addTags('albino');
    addTags('axanthic');
  } else {
    if (albino === 2) {
      visualGenes.push('Albino');
      addTags('albino');
    } else if (albino === 1) {
      hetGenes.push('Albino');
    }

    if (axanthic === 2) {
      visualGenes.push('Axanthic');
      addTags('axanthic');
    } else if (axanthic === 1) {
      hetGenes.push('Axanthic');
    }
  }

  if (lavenderalbino === 2) {
    visualGenes.push('Lavender Albino');
    addTags('lavenderalbino');
  } else if (lavenderalbino === 1) {
    hetGenes.push('Lavender Albino');
  }

  if (ultramel === 2) {
    visualGenes.push('Ultramel');
    addTags('ultramel');
  } else if (ultramel === 1) {
    hetGenes.push('Ultramel');
  }

  if (desertghost === 2) {
    visualGenes.push('Desert Ghost');
    addTags('desertghost');
  } else if (desertghost === 1) {
    hetGenes.push('Desert Ghost');
  }

  if (hypo === 2) {
    visualGenes.push('Hypo');
    addTags('hypo');
  } else if (hypo === 1) {
    hetGenes.push('Hypo');
  }

  if (piebald === 2) {
    visualGenes.push('Piebald');
    addTags('piebald');
  } else if (piebald === 1) {
    hetGenes.push('Piebald');
  }

  if (clown === 2) {
    visualGenes.push('Clown');
    addTags('clown');
  } else if (clown === 1) {
    hetGenes.push('Clown');
  }

  // Additional Extreme Real-World Ball Python Genes
  if (leopard === 2) {
    visualGenes.push('Super Leopard');
    addTags('leopard');
  } else if (leopard === 1) {
    visualGenes.push('Leopard');
    addTags('leopard');
  }
  if (cinnamon === 2) {
    visualGenes.push('Super Cinnamon');
    addTags('cinnamon');
  } else if (cinnamon === 1) {
    visualGenes.push('Cinnamon');
    addTags('cinnamon');
  }
  if (blade === 2) {
    visualGenes.push('Super Blade');
    addTags('blade');
  } else if (blade === 1) {
    visualGenes.push('Blade');
    addTags('blade');
  }
  if (monsoon === 2) {
    visualGenes.push('Monsoon');
    addTags('monsoon');
  } else if (monsoon === 1) {
    hetGenes.push('Monsoon');
  }
  if (sunset === 2) {
    visualGenes.push('Sunset');
    addTags('sunset');
  } else if (sunset === 1) {
    hetGenes.push('Sunset');
  }
  if (geneticstripe === 2) {
    visualGenes.push('Genetic Stripe');
    addTags('geneticstripe');
  } else if (geneticstripe === 1) {
    hetGenes.push('Genetic Stripe');
  }
  if (tristripe === 2) {
    visualGenes.push('Tri-Stripe');
    addTags('tristripe');
  } else if (tristripe === 1) {
    hetGenes.push('Tri-Stripe');
  }
  if (monarch === 2) {
    visualGenes.push('Monarch');
    addTags('monarch');
  } else if (monarch === 1) {
    hetGenes.push('Monarch');
  }

  // Custom Morpharium Originals
  if (saddler >= 1) {
    visualGenes.push('Saddler');
    addTags('saddler');
  }
  if (bullring === 2) {
    visualGenes.push('Super Bullring');
    addTags('bullring');
  } else if (bullring === 1) {
    visualGenes.push('Bullring');
    addTags('bullring');
  }
  if (chevron === 2) {
    visualGenes.push('Super Chevron');
    addTags('chevron');
  } else if (chevron === 1) {
    visualGenes.push('Chevron');
    addTags('chevron');
  }
  if (raindrop === 2) {
    visualGenes.push('Raindrop');
    addTags('raindrop');
  } else if (raindrop === 1) {
    hetGenes.push('Raindrop');
  }
  if (crossbar >= 1) {
    visualGenes.push('Crossbar');
    addTags('crossbar');
  }
  if (trackline >= 1) {
    visualGenes.push('Trackline');
    addTags('trackline');
  }
  if (milksnake === 2) {
    visualGenes.push('Super Milk Band');
    addTags('milksnake');
  } else if (milksnake === 1) {
    visualGenes.push('Milk Band');
    addTags('milksnake');
  }
  if (invert === 2) {
    visualGenes.push('Inverted');
    addTags('invert');
  } else if (invert === 1) {
    hetGenes.push('Inverted');
  }

  // Extreme Custom Elemental Fusion & Synthesis Tree (Water, Lava, plus all 35 Tier 0-5 loci)
  const legacyCobbleOnly =
    cobblestone && countAlleles(genotype.cobblestone) === 0 && countAlleles(genotype.obsidian) === 0;
  if (legacyCobbleOnly) {
    if (obsidianCobble) {
      visualGenes.push('Obsidian Cobblestone');
    } else {
      visualGenes.push('Cobblestone');
    }
    addTags('magma');
    addTags('tidal');
  } else {
    if (magma === 2) {
      visualGenes.push('Super Lava');
      addTags('magma');
    } else if (magma === 1) {
      visualGenes.push('Lava');
      addTags('magma');
    }
    if (tidal === 2) {
      visualGenes.push('Super Water');
      addTags('tidal');
    } else if (tidal === 1) {
      visualGenes.push('Water');
      addTags('tidal');
    }
  }

  let maxElementalTier = 0;
  let elementalRecessiveVisuals = 0;
  let elementalSupers = 0;
  for (const loc of ELEMENTAL_LOCI_ORDER) {
    const c = countAlleles(genotype[loc]);
    if (c === 0) continue;
    const def = LOCUS_DEFINITIONS[loc];
    const tier = getElementalTier(loc) ?? 0;
    if (def.mode === 'recessive') {
      if (c === 2) {
        visualGenes.push(def.name);
        addTags(loc);
        elementalRecessiveVisuals += 1;
        if (tier > maxElementalTier) maxElementalTier = tier;
      } else {
        hetGenes.push(def.name);
      }
    } else if (c === 2) {
      visualGenes.push(def.superName ?? `Super ${def.name}`);
      addTags(loc);
      elementalSupers += 1;
      if (tier > maxElementalTier) maxElementalTier = tier;
    } else {
      visualGenes.push(def.name);
      addTags(loc);
      if (tier > maxElementalTier) maxElementalTier = tier;
    }
  }

  // Evaluate active Workshop / local Gene Pack loci (gracefully skips uninstalled packs)
  let modRecessiveVisuals = 0;
  let modSupers = 0;
  if (modAlleles) {
    const modEntries = Object.entries(modAlleles).sort(([a], [b]) => a.localeCompare(b));
    for (const [fullId, pair] of modEntries) {
      const c = countAlleles(pair);
      if (c === 0) continue;
      const modLoc = getModLocus(fullId);
      if (!modLoc) continue;
      const { spec } = modLoc;
      if (spec.mode === 'recessive') {
        if (c === 2) {
          visualGenes.push(spec.name);
          for (const t of spec.tags) tagSet.add(t);
          tagSet.add('Custom');
          modRecessiveVisuals += 1;
        } else {
          hetGenes.push(spec.name);
        }
      } else if (spec.mode === 'codominant' && c === 2) {
        visualGenes.push(spec.superName ?? `Super ${spec.name}`);
        for (const t of spec.tags) tagSet.add(t);
        tagSet.add('Custom');
        modSupers += 1;
      } else {
        visualGenes.push(spec.name);
        for (const t of spec.tags) tagSet.add(t);
        tagSet.add('Custom');
      }
    }
  }

  const morphName = visualGenes.length > 0 ? visualGenes.join(' ') : 'Classic Normal';
  const morphKey =
    visualGenes.length > 0
      ? visualGenes
          .map((g) => g.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
          .sort()
          .join('+')
      : 'normal';

  // Spider gene -> Dinnerbone upside-down wobble + lineage vigor penalty (always clamped >= MIN_LINEAGE_VIGOR)
  const isUpsideDown = spider >= 1;
  let lineageVigor = 100;
  let lineageNote = 'Robust, balanced genetic vigor';

  if (isUpsideDown) {
    lineageVigor = spider === 2 ? 68 : 80;
    lineageNote =
      'Spider wobble (−20% lineage vigor) · happily lives upside-down like Dinnerbone';
  } else if (cobblestone) {
    lineageVigor = obsidianCobble ? 114 : 108;
    lineageNote = obsidianCobble
      ? 'Obsidian Cobblestone fusion (Super Lava + Super Water) · rock-solid stamina'
      : 'Cobblestone elemental fusion (Lava + Water) · sturdy granite lineage';
  } else if (eightBall) {
    lineageVigor = 88;
    lineageNote = '8-Ball super dark complex · calm, deliberate mover';
  } else if (bel || blackEl || ivory) {
    lineageVigor = 94;
    lineageNote = 'Leucistic complex · calm metabolism, prefers gentle basking';
  } else if (albino === 2 || lavenderalbino === 2 || ultramel === 2) {
    lineageVigor = 92;
    lineageNote = 'Amelanistic lineage · light-sensitive eyes, thrives in dappled shade';
  } else if (desertghost === 2) {
    lineageVigor = 108;
    lineageNote = 'Desert Ghost vitality · hardy, crisp high-contrast lineage';
  } else if (visualGenes.length >= 3) {
    lineageVigor = 104;
    lineageNote = 'Multi-gene designer lineage · prized energetic trait stack';
  } else if (visualGenes.length === 0) {
    lineageVigor = 105;
    lineageNote = 'Classic wild-type hybrid vigor · resilient & speedy breeder';
  }
  lineageVigor = Math.max(MIN_LINEAGE_VIGOR, lineageVigor);

  // Behavior & health predisposition
  let behavior: BehaviorTrait = 'calm_wanderer';
  let behaviorLabel = 'Calm Wanderer';
  let healthPredisposition = 'Hearty classic constitution · enjoys roaming moss and bark';

  if (isUpsideDown) {
    behavior = 'dinnerbone_wobble';
    behaviorLabel = 'Upside-Down Wobbler';
    healthPredisposition =
      'Neurological head-wobble (Spider complex) · curls & glides belly-up without a care';
  } else if (cobblestone) {
    behavior = 'basking_lounger';
    behaviorLabel = 'River-Stone Lounger';
    healthPredisposition =
      'Elemental Fusion (Lava + Water) · cool cobblestone scales that love basking beside warm slate';
  } else if (magma >= 1) {
    behavior = 'basking_lounger';
    behaviorLabel = 'Ember Basker';
    healthPredisposition =
      'Custom Elemental (Lava) · radiates cozy hearth warmth and gravitates toward sun-lit basking rocks';
  } else if (tidal >= 1) {
    behavior = 'curious_periscoper';
    behaviorLabel = 'Tide Glider';
    healthPredisposition =
      'Custom Elemental (Water) · silky aqua sheen that loves gliding near the cool water dish';
  } else if (bel || blackEl || ivory) {
    behavior = 'basking_lounger';
    behaviorLabel = 'Warm Slate Lounger';
    healthPredisposition =
      'Leucistic skin (reduced dermal melanin) · prefers steady basking warmth';
  } else if (albino === 2 || lavenderalbino === 2 || ultramel === 2) {
    behavior = 'shade_seeker';
    behaviorLabel = 'Cozy Shade Seeker';
    healthPredisposition =
      'Amelanistic photophobia (ruby/plum eyes) · loves shady cork bark hides';
  } else if (clown === 2 || enchi >= 1 || banana >= 1 || ghi >= 1) {
    behavior = 'curious_periscoper';
    behaviorLabel = 'Curious Periscoper';
    healthPredisposition = 'Alert & inquisitive temperament · follows gentle taps on the glass';
  } else if (piebald === 2 || calico >= 1 || hypo === 2) {
    behavior = 'basking_lounger';
    behaviorLabel = 'Coil Lounger';
    healthPredisposition = 'Peaceful temperament · curls neatly beside river stones';
  }

  // Rarity tier based on recessive count, super/complex forms, synthesis tier, and gene stacking
  const recessiveVisualCount =
    (albino === 2 ? 1 : 0) +
    (piebald === 2 ? 1 : 0) +
    (clown === 2 ? 1 : 0) +
    (axanthic === 2 ? 1 : 0) +
    (lavenderalbino === 2 ? 1 : 0) +
    (desertghost === 2 ? 1 : 0) +
    (hypo === 2 ? 1 : 0) +
    (ultramel === 2 ? 1 : 0) +
    (raindrop === 2 ? 1 : 0) +
    elementalRecessiveVisuals +
    modRecessiveVisuals;
  const superCount =
    (pastel === 2 ? 1 : 0) +
    (enchi === 2 ? 1 : 0) +
    (banana === 2 ? 1 : 0) +
    (ghi === 2 ? 1 : 0) +
    (cypress === 2 ? 1 : 0) +
    (bullring === 2 ? 1 : 0) +
    (chevron === 2 ? 1 : 0) +
    (milksnake === 2 ? 1 : 0) +
    (magma === 2 ? 1 : 0) +
    (tidal === 2 ? 1 : 0) +
    (bel ? 1 : 0) +
    (blackEl ? 1 : 0) +
    (ivory ? 1 : 0) +
    (eightBall ? 1 : 0) +
    (cobblestone ? 1 : 0) +
    elementalSupers +
    modSupers;

  let rarity: MorphRarity = 'common';
  if (
    obsidianCobble ||
    maxElementalTier >= 4 ||
    recessiveVisualCount >= 2 ||
    (recessiveVisualCount >= 1 && (visualGenes.length >= 3 || superCount >= 1)) ||
    (cobblestone && visualGenes.length >= 2) ||
    visualGenes.length >= 4
  ) {
    rarity = 'legendary';
  } else if (
    maxElementalTier === 3 ||
    recessiveVisualCount === 1 ||
    superCount >= 1 ||
    visualGenes.length >= 3
  ) {
    rarity = 'rare';
  } else if (maxElementalTier >= 1 || visualGenes.length >= 2) {
    rarity = 'uncommon';
  } else {
    rarity = 'common';
  }

  const palette = derivePalette(genotype, polygenicSeed, modAlleles);
  const patternRule = derivePatternRule(genotype, polygenicSeed);
  const skinSpec = deriveSkinPhenotypeSpec(genotype, polygenicSeed, modAlleles);
  const isCustomMorph = tagSet.has('Custom') || patternRule.isCustomPattern;

  return {
    morphKey,
    morphName,
    visualGenes,
    hetGenes,
    rarity,
    isUpsideDown,
    isCustomMorph,
    lineageVigor,
    lineageNote,
    behavior,
    behaviorLabel,
    healthPredisposition,
    palette,
    patternRule,
    skinSpec,
    tags: Array.from(tagSet),
  };
}

/**
 * Computes the exact probability distribution for a single diploid locus cross.
 * Optionally applies a gentle Hiss Depot self-balancing gene bias nudge.
 */
export function crossLocusDistribution(
  sirePair: AllelePair,
  damPair: AllelePair,
  alleleTransmissionProb = 0.5
): Record<0 | 1 | 2, number> {
  const dist: Record<0 | 1 | 2, number> = { 0: 0, 1: 0, 2: 0 };
  const pPass = Math.max(0.25, Math.min(0.75, alleleTransmissionProb));

  const parentProbs = (pair: AllelePair): [number, number] => {
    const count = countAlleles(pair);
    if (count === 0) return [1, 0];
    if (count === 2) return [0, 1];
    // Heterozygous [1, 0]: probability of passing 0 vs 1
    return [1 - pPass, pPass];
  };

  const [s0, s1] = parentProbs(sirePair);
  const [d0, d1] = parentProbs(damPair);

  dist[0] = s0 * d0;
  dist[1] = s0 * d1 + s1 * d0;
  dist[2] = s1 * d1;
  return dist;
}

/** Converts self-balancing pie weights (sum 100, default 33.3 each) into allele transmission prob around 0.5 */
export function getTransmissionProbForMode(
  mode: InheritanceMode,
  bias?: GeneBiasDistribution
): number {
  if (!bias) return 0.5;
  const baseline = 100 / 3;
  const weight = bias[mode];
  // Each +10% above baseline shifts het transmission by +0.05 (bounded safely within [0.35, 0.72])
  const delta = (weight - baseline) * 0.005;
  return Math.max(0.35, Math.min(0.72, 0.5 + delta));
}

export function formatOddsLabel(probability: number, wasMutation = false): string {
  const pct = probability * 100;
  const pctStr =
    pct >= 10 ? `${Math.round(pct)}%` : pct >= 0.1 ? `${pct.toFixed(1)}%` : '<0.1%';
  if (wasMutation) {
    return `Mutation · ${pctStr}`;
  }
  if (probability >= 0.999) {
    return `1 in 1 · 100%`;
  }
  const denom = Math.max(1, Math.round(1 / probability));
  return `1 in ${denom} · ${pctStr}`;
}

/**
 * Computes exact Punnett-square visual phenotype odds for any Sire × Dam pair.
 * Only iterates over polymorphic loci (where at least one parent carries a mutant allele)
 * so computation stays instantaneous (<1ms).
 */
export function computeBreedingPreview(
  sire: SnakeEntity,
  dam: SnakeEntity,
  discoveredKeys: Set<string> = new Set(),
  bias?: GeneBiasDistribution,
  contentFlags = DEFAULT_CONTENT_FLAGS,
  enabledModPacks?: string[]
): BreedingOddsEntry[] {
  const activeLoci = LOCI_ORDER.filter(
    (loc) => countAlleles(sire.genotype[loc]) > 0 || countAlleles(dam.genotype[loc]) > 0
  );

  // Collect polymorphic Workshop / local Gene Pack loci present on either parent
  const modKeySet = new Set<string>();
  for (const k of Object.keys(sire.modAlleles ?? {})) {
    if (countAlleles(sire.modAlleles?.[k] ?? [0, 0]) > 0 && getModLocus(k)) modKeySet.add(k);
  }
  for (const k of Object.keys(dam.modAlleles ?? {})) {
    if (countAlleles(dam.modAlleles?.[k] ?? [0, 0]) > 0 && getModLocus(k)) modKeySet.add(k);
  }
  const activeModLoci = Array.from(modKeySet).sort();

  interface PartialOutcome {
    genotype: Genotype;
    modAlleles?: ModAlleleMap;
    prob: number;
  }

  let outcomes: PartialOutcome[] = [{ genotype: createWildTypeGenotype(), prob: 1 }];

  for (const loc of activeLoci) {
    const mode = LOCUS_DEFINITIONS[loc].mode;
    const pPass = getTransmissionProbForMode(mode, bias);
    const dist = crossLocusDistribution(sire.genotype[loc], dam.genotype[loc], pPass);
    const next: PartialOutcome[] = [];
    for (const item of outcomes) {
      const pairs: Array<[0 | 1 | 2, AllelePair]> = [
        [0, [0, 0]],
        [1, [1, 0]],
        [2, [1, 1]],
      ];
      for (const [count, pair] of pairs) {
        const p = dist[count];
        if (p > 0) {
          next.push({
            genotype: { ...item.genotype, [loc]: pair },
            modAlleles: item.modAlleles,
            prob: item.prob * p,
          });
        }
      }
    }
    outcomes = next;
  }

  for (const fullId of activeModLoci) {
    const modDef = getModLocus(fullId)!;
    const pPass = getTransmissionProbForMode(modDef.spec.mode, bias);
    const sirePair: AllelePair = sire.modAlleles?.[fullId] ?? [0, 0];
    const damPair: AllelePair = dam.modAlleles?.[fullId] ?? [0, 0];
    const dist = crossLocusDistribution(sirePair, damPair, pPass);
    const next: PartialOutcome[] = [];
    for (const item of outcomes) {
      const pairs: Array<[0 | 1 | 2, AllelePair]> = [
        [0, [0, 0]],
        [1, [1, 0]],
        [2, [1, 1]],
      ];
      for (const [count, pair] of pairs) {
        const p = dist[count];
        if (p > 0) {
          const nextMod: ModAlleleMap | undefined =
            count > 0 ? { ...(item.modAlleles ?? {}), [fullId]: pair } : item.modAlleles;
          next.push({
            genotype: item.genotype,
            modAlleles: nextMod,
            prob: item.prob * p,
          });
        }
      }
    }
    outcomes = next;
  }

  const byMorph = new Map<
    string,
    {
      morphKey: string;
      morphName: string;
      probability: number;
      rarity: MorphRarity;
      includesUpsideDown: boolean;
      outcomeKind: BreedingOutcomeKind;
      synthesisTier?: number;
      synthesisResultLocus?: LocusId | string;
    }
  >();

  for (const out of outcomes) {
    // Automatic (100%) elemental synthesis when CustomMorphs is enabled; bypassed cleanly when disabled
    const coreSynth = applyAutomaticSynthesis(
      out.genotype,
      sire.genotype,
      dam.genotype,
      contentFlags
    );
    const modSynth = applyModSynthesis(
      coreSynth.genotype,
      out.modAlleles,
      sire.genotype,
      sire.modAlleles,
      dam.genotype,
      dam.modAlleles,
      enabledModPacks
    );
    const resolvedGeno = modSynth.genotype;
    const resolvedMod = modSynth.modAlleles;
    const pheno = evaluatePhenotype(resolvedGeno, 0.5, resolvedMod);

    let bucketKey = pheno.morphKey;
    let displayMorphName = pheno.morphName;
    let outcomeKind: BreedingOutcomeKind = 'mix';
    let synthesisTier: number | undefined;
    let synthesisResultLocus: LocusId | string | undefined;

    if (modSynth.recipe) {
      outcomeKind = 'synthesis';
      synthesisTier = modSynth.recipe.tier;
      synthesisResultLocus = modSynth.recipe.resultFullId;
      const modRes = getModLocus(modSynth.recipe.resultFullId);
      const resCount = countAlleles(resolvedMod?.[modSynth.recipe.resultFullId] ?? [0, 0]);
      if (modRes && modRes.spec.mode === 'recessive' && resCount === 1) {
        bucketKey = `synth:${modSynth.recipe.resultFullId}:het:${pheno.morphKey}`;
        displayMorphName =
          pheno.morphKey === 'normal'
            ? `Het ${modRes.spec.name}`
            : `${pheno.morphName} (Het ${modRes.spec.name})`;
      } else {
        bucketKey = `synth:${modSynth.recipe.resultFullId}:${pheno.morphKey}`;
      }
    } else if (coreSynth.recipe) {
      outcomeKind = 'synthesis';
      synthesisTier = coreSynth.recipe.tier;
      synthesisResultLocus = coreSynth.recipe.result;
      const resultDef = LOCUS_DEFINITIONS[coreSynth.recipe.result];
      const resultCount = countAlleles(resolvedGeno[coreSynth.recipe.result]);
      if (resultDef.mode === 'recessive' && resultCount === 1) {
        // Keep recessive Het syntheses distinct from Classic Normal so players see the Synthesis callout!
        bucketKey = `synth:${coreSynth.recipe.result}:het:${pheno.morphKey}`;
        displayMorphName =
          pheno.morphKey === 'normal'
            ? `Het ${resultDef.name}`
            : `${pheno.morphName} (Het ${resultDef.name})`;
      } else {
        bucketKey = `synth:${coreSynth.recipe.result}:${pheno.morphKey}`;
      }
    } else if (
      isBlueEyedLeucistic(resolvedGeno) ||
      isBlackEyedLeucistic(resolvedGeno) ||
      isIvory(resolvedGeno) ||
      isEightBall(resolvedGeno) ||
      (countAlleles(resolvedGeno.albino) === 2 && countAlleles(resolvedGeno.axanthic) === 2) ||
      (countAlleles(resolvedGeno.pastel) >= 1 && countAlleles(resolvedGeno.spider) >= 1)
    ) {
      outcomeKind = 'complex';
    }

    const existing = byMorph.get(bucketKey);
    if (existing) {
      existing.probability += out.prob;
    } else {
      byMorph.set(bucketKey, {
        morphKey: coreSynth.recipe || modSynth.recipe ? pheno.morphKey : bucketKey,
        morphName: displayMorphName,
        probability: out.prob,
        rarity: pheno.rarity,
        includesUpsideDown: pheno.isUpsideDown,
        outcomeKind,
        synthesisTier,
        synthesisResultLocus,
      });
    }
  }

  return Array.from(byMorph.values())
    .sort((a, b) => b.probability - a.probability)
    .map((entry) => {
      const resultName = entry.synthesisResultLocus
        ? LOCUS_DEFINITIONS[entry.synthesisResultLocus as LocusId]?.name ??
          getModLocus(entry.synthesisResultLocus)?.spec.name ??
          null
        : null;
      const resultKey = resultName ? resultName.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null;
      const isDiscovered =
        entry.outcomeKind === 'synthesis' && resultKey
          ? discoveredKeys.has(entry.morphKey) && (entry.morphKey !== 'normal' || discoveredKeys.has(resultKey))
          : discoveredKeys.has(entry.morphKey);
      return {
        ...entry,
        oddsLabel: formatOddsLabel(entry.probability, false),
        isDiscovered,
      };
    });
}

const COZY_SNAKE_NAMES = [
  'Biscuit',
  'Mochi',
  'Noodle',
  'Pretzel',
  'Waffles',
  'Pebble',
  'Sprout',
  'Clover',
  'Buttercup',
  'Tumble',
  'Cinnamon',
  'Opal',
  'Pippin',
  'Saffron',
  'Marshmallow',
  'Juniper',
  'Sesame',
  'Pudding',
  'Maple',
  'Fig',
  'Chai',
  'Truffle',
  'Acorn',
  'Nutmeg',
  'Brioche',
  'Yuzu',
  'Dandelion',
  'Miso',
  'Nori',
  'Pecan',
  'Honey',
  'Taro',
  'Gnocchi',
  'Caramel',
];

export function pickCozySnakeName(existingNames: Set<string>, rng = Math.random): string {
  const available = COZY_SNAKE_NAMES.filter((n) => !existingNames.has(n));
  if (available.length > 0) {
    return available[Math.floor(rng() * available.length)];
  }
  const base = COZY_SNAKE_NAMES[Math.floor(rng() * COZY_SNAKE_NAMES.length)];
  let suffix = 2;
  while (existingNames.has(`${base} ${suffix}`)) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

export function breedClutch(
  sire: SnakeEntity,
  dam: SnakeEntity,
  discoveredKeys: Set<string>,
  existingNames: Set<string>,
  clutchSize = 2,
  rng: () => number = Math.random,
  bias?: GeneBiasDistribution,
  contentFlags = DEFAULT_CONTENT_FLAGS,
  enabledModPacks?: string[]
): ClutchEgg[] {
  const preview = computeBreedingPreview(
    sire,
    dam,
    discoveredKeys,
    bias,
    contentFlags,
    enabledModPacks
  );
  const probByMorphKey = new Map<string, number>();
  for (const e of preview) {
    probByMorphKey.set(e.morphKey, (probByMorphKey.get(e.morphKey) ?? 0) + e.probability);
  }
  const usedNames = new Set(existingNames);
  const clutchDiscoveredKeys = new Set(discoveredKeys);
  const enabledLoci = getEnabledLoci(contentFlags);
  const mutatableLoci = enabledLoci.filter((loc) => !isSynthesisOnlyLocus(loc));
  const enabledModLoci = getEnabledModLoci(enabledModPacks);
  const mutatableModLoci = enabledModLoci.filter((m) => !isModSynthesisOnlyLocus(m.fullId));

  const parentModKeys = Array.from(
    new Set<string>([
      ...Object.keys(sire.modAlleles ?? {}),
      ...Object.keys(dam.modAlleles ?? {}),
    ])
  ).sort();

  const eggs: ClutchEgg[] = [];
  const now = Date.now();

  const drawParentAllele = (pair: AllelePair, pPass: number): 0 | 1 => {
    const c = countAlleles(pair);
    if (c === 0) return 0;
    if (c === 2) return 1;
    return rng() < pPass ? 1 : 0;
  };

  for (let i = 0; i < clutchSize; i++) {
    let childGenotype = createWildTypeGenotype();

    // Mendelian inheritance per core locus (with optional Hiss Depot category balance)
    for (const loc of LOCI_ORDER) {
      const pPass = getTransmissionProbForMode(LOCUS_DEFINITIONS[loc].mode, bias);
      const sireAllele = drawParentAllele(sire.genotype[loc], pPass);
      const damAllele = drawParentAllele(dam.genotype[loc], pPass);
      childGenotype[loc] = normalizeAllelePair(sireAllele, damAllele);
    }

    // Mendelian inheritance per Workshop / local Gene Pack locus carried by parents
    let childModAlleles: ModAlleleMap | undefined;
    if (parentModKeys.length > 0) {
      const nextMod: ModAlleleMap = {};
      for (const fullId of parentModKeys) {
        const modDef = getModLocus(fullId);
        const mode: InheritanceMode = modDef?.spec.mode ?? 'codominant';
        const pPass = getTransmissionProbForMode(mode, bias);
        const sireAllele = drawParentAllele(sire.modAlleles?.[fullId] ?? [0, 0], pPass);
        const damAllele = drawParentAllele(dam.modAlleles?.[fullId] ?? [0, 0], pPass);
        const pair = normalizeAllelePair(sireAllele, damAllele);
        if (countAlleles(pair) > 0) nextMod[fullId] = pair;
      }
      childModAlleles = cleanModAlleles(nextMod);
    }

    // Automatic (100%) elemental & Workshop mod synthesis
    const coreSynth = applyAutomaticSynthesis(childGenotype, sire.genotype, dam.genotype, contentFlags);
    const modSynth = applyModSynthesis(
      coreSynth.genotype,
      childModAlleles,
      sire.genotype,
      sire.modAlleles,
      dam.genotype,
      dam.modAlleles,
      enabledModPacks
    );
    childGenotype = modSynth.genotype;
    childModAlleles = modSynth.modAlleles;

    const wasSynthesis = modSynth.recipe !== null || coreSynth.recipe !== null;
    const synthesisLocusName = modSynth.recipe
      ? getModLocus(modSynth.recipe.resultFullId)?.spec.name ?? modSynth.recipe.name
      : coreSynth.recipe
        ? LOCUS_DEFINITIONS[coreSynth.recipe.result].name
        : null;
    const synthesisTier = modSynth.recipe?.tier ?? coreSynth.recipe?.tier;

    // Gentle spontaneous mutation roll weighted by gene bias if set (strictly non-synthesis enabled loci)
    let wasMutation = false;
    let mutationLocusName: string | null = null;
    if (rng() < MUTATION_CHANCE_PER_EGG) {
      const coreCandidates = mutatableLoci.filter((loc) => {
        const current = countAlleles(childGenotype[loc]);
        if (loc === 'spider' && current >= 1) return false;
        return current < 2;
      });
      const modCandidates = mutatableModLoci.filter(
        (m) => countAlleles(childModAlleles?.[m.fullId] ?? [0, 0]) < 2
      );
      const totalPool = coreCandidates.length + modCandidates.length;
      if (totalPool > 0) {
        const pickMod =
          modCandidates.length > 0 && rng() < modCandidates.length / totalPool;
        if (pickMod) {
          const chosenMod = modCandidates[Math.floor(rng() * modCandidates.length)];
          const current = countAlleles(childModAlleles?.[chosenMod.fullId] ?? [0, 0]);
          const nextPair: AllelePair =
            chosenMod.spec.mode === 'recessive' && current === 0
              ? rng() < 0.35
                ? [1, 1]
                : [1, 0]
              : current === 0
                ? [1, 0]
                : [1, 1];
          childModAlleles = cleanModAlleles({
            ...(childModAlleles ?? {}),
            [chosenMod.fullId]: nextPair,
          });
          wasMutation = true;
          mutationLocusName = chosenMod.spec.name;
        } else if (coreCandidates.length > 0) {
          const chosen = pickWeightedMutationLocus(coreCandidates, bias, rng);
          const current = countAlleles(childGenotype[chosen]);
          if (LOCUS_DEFINITIONS[chosen].mode === 'recessive' && current === 0) {
            childGenotype[chosen] = rng() < 0.35 ? [1, 1] : [1, 0];
          } else {
            childGenotype[chosen] = current === 0 ? [1, 0] : [1, 1];
          }
          wasMutation = true;
          mutationLocusName = LOCUS_DEFINITIONS[chosen].name;
        }
      }
    }

    // Belt-and-suspenders guard: never hatch homozygous lethal Super Spider
    if (countAlleles(childGenotype.spider) >= 2) {
      childGenotype.spider = [1, 0];
    }

    const polygenicSeed = rng();
    const phenotype = evaluatePhenotype(childGenotype, polygenicSeed, childModAlleles);

    const mendelianProb = probByMorphKey.get(phenotype.morphKey);
    let odds: number;
    let isMutatedDisplay = false;
    if (wasMutation && mendelianProb === undefined) {
      odds = Number(
        (MUTATION_CHANCE_PER_EGG / Math.max(1, enabledLoci.length + enabledModLoci.length)).toFixed(4)
      );
      isMutatedDisplay = true;
    } else if (mendelianProb !== undefined) {
      odds = mendelianProb;
    } else {
      odds = 0.025;
      isMutatedDisplay = true;
    }

    const oddsLabel = formatOddsLabel(odds, isMutatedDisplay);
    const isNewMorph = !clutchDiscoveredKeys.has(phenotype.morphKey);
    clutchDiscoveredKeys.add(phenotype.morphKey);

    const name = pickCozySnakeName(usedNames, rng);
    usedNames.add(name);

    const snake: SnakeEntity = {
      id: `snake_${now}_${i}_${Math.floor(rng() * 100000)}`,
      name,
      genotype: childGenotype,
      ...(childModAlleles ? { modAlleles: childModAlleles } : {}),
      polygenicSeed,
      phenotype,
      currentVigor: phenotype.lineageVigor,
      onDisplay: false,
      hatchedAt: now + i,
      generation: Math.max(sire.generation, dam.generation) + 1,
      sire: { id: sire.id, name: sire.name, morphName: sire.phenotype.morphName },
      dam: { id: dam.id, name: dam.name, morphName: dam.phenotype.morphName },
      hatchOdds: odds,
      hatchOddsLabel: oddsLabel,
      wasMutation: isMutatedDisplay,
      petCount: 0,
    };

    eggs.push({
      id: `egg_${now}_${i}`,
      revealed: false,
      isNewMorph,
      odds,
      oddsLabel,
      wasMutation: isMutatedDisplay,
      mutationLocusName: isMutatedDisplay ? mutationLocusName : null,
      wasSynthesis,
      synthesisLocusName,
      synthesisTier,
      snake,
    });
  }

  return eggs;
}

function pickWeightedMutationLocus(
  candidates: LocusId[],
  bias: GeneBiasDistribution | undefined,
  rng: () => number
): LocusId {
  if (!bias) {
    return candidates[Math.floor(rng() * candidates.length)];
  }
  const weights = candidates.map((loc) => Math.max(1, bias[LOCUS_DEFINITIONS[loc].mode]));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

const STARTER_CODOMINANT_POOL: LocusId[] = [
  'pastel',
  'mojave',
  'lesser',
  'enchi',
  'banana',
  'fire',
  'yellowbelly',
  'blackpastel',
  'ghi',
  'cypress',
];

const STARTER_DOMINANT_POOL: LocusId[] = ['pinstripe', 'calico'];

// Curated opening recessives; rarer late-game recessives (Lavender Albino, Desert Ghost, Ultramel)
// stay reserved for The Jean Pool & mutations to preserve long-term discovery.
const STARTER_HET_POOL: LocusId[] = ['albino', 'piebald', 'clown', 'hypo'];

/**
 * Generates 2 curated random starter breeders ("Classic 2+1"):
 * - Parent A & B carry two distinct, healthy visual genes (Spider excluded so new runs never start handicapped).
 * - At least one starter is guaranteed Codominant so a Super morph is achievable by Gen 2.
 * - Avoids Mojave + Lesser together on Clutch #1 so Blue-Eyed Leucistic remains a rewarding milestone.
 * - Both share 1 hidden recessive Het, guaranteeing exactly 8 Mendelian outcomes (6 undiscovered) on Clutch #1.
 */
export function createRandomStarterPair(
  rng: () => number = Math.random,
  contentFlags = DEFAULT_CONTENT_FLAGS
): SnakeEntity[] {
  const now = Date.now() - 60_000;
  const enabledSet = new Set(getEnabledLoci(contentFlags));

  const codomPool = STARTER_CODOMINANT_POOL.filter((loc) => enabledSet.has(loc));
  const domPool = STARTER_DOMINANT_POOL.filter((loc) => enabledSet.has(loc));
  const hetPool = STARTER_HET_POOL.filter((loc) => enabledSet.has(loc));

  const codomLocus =
    codomPool[Math.floor(rng() * codomPool.length)] ?? STARTER_CODOMINANT_POOL[0];

  const secondaryPool = [...codomPool, ...domPool].filter((loc) => {
    if (loc === codomLocus) return false;
    // Prevent an immediate Clutch #1 Blue-Eyed Leucistic complex shortcut
    if (
      (codomLocus === 'mojave' && loc === 'lesser') ||
      (codomLocus === 'lesser' && loc === 'mojave')
    ) {
      return false;
    }
    return true;
  });

  const secondLocus =
    secondaryPool[Math.floor(rng() * secondaryPool.length)] ?? STARTER_CODOMINANT_POOL[1];
  const swapOrder = rng() < 0.5;
  const locusA = swapOrder ? secondLocus : codomLocus;
  const locusB = swapOrder ? codomLocus : secondLocus;

  const sharedHet = hetPool[Math.floor(rng() * hetPool.length)] ?? STARTER_HET_POOL[0];
  const usedNames = new Set<string>();
  const nameA = pickCozySnakeName(usedNames, rng);
  usedNames.add(nameA);
  const nameB = pickCozySnakeName(usedNames, rng);

  const defs = [
    {
      id: `starter_${now}_a_${Math.floor(rng() * 10000)}`,
      name: nameA,
      genotype: makeGenotype({ [locusA]: [1, 0], [sharedHet]: [1, 0] }),
      seed: Number((0.15 + rng() * 0.7).toFixed(4)),
    },
    {
      id: `starter_${now}_b_${Math.floor(rng() * 10000)}`,
      name: nameB,
      genotype: makeGenotype({ [locusB]: [1, 0], [sharedHet]: [1, 0] }),
      seed: Number((0.15 + rng() * 0.7).toFixed(4)),
    },
  ];

  return defs.map((def, idx) => {
    const phenotype = evaluatePhenotype(def.genotype, def.seed);
    return {
      id: def.id,
      name: def.name,
      genotype: def.genotype,
      polygenicSeed: def.seed,
      phenotype,
      currentVigor: phenotype.lineageVigor,
      onDisplay: true,
      hatchedAt: now + idx * 1000,
      generation: 1,
      sire: null,
      dam: null,
      hatchOdds: 1,
      hatchOddsLabel: 'Founder',
      wasMutation: false,
      petCount: 0,
    };
  });
}

/** Deterministic classic 4-founder helper retained for unit tests & benchmarks */
export function createStarterSnakes(): SnakeEntity[] {
  const now = Date.now() - 60_000;

  const definitions: Array<{
    id: string;
    name: string;
    genotype: Genotype;
    seed: number;
    onDisplay: boolean;
  }> = [
    {
      id: 'starter_biscuit',
      name: 'Biscuit',
      genotype: makeGenotype({ pastel: [1, 0], albino: [1, 0] }),
      seed: 0.21,
      onDisplay: true,
    },
    {
      id: 'starter_mochi',
      name: 'Mochi',
      genotype: makeGenotype({ mojave: [1, 0], albino: [1, 0] }),
      seed: 0.48,
      onDisplay: true,
    },
    {
      id: 'starter_tumble',
      name: 'Tumble',
      genotype: makeGenotype({ spider: [1, 0], pinstripe: [1, 0], piebald: [1, 0] }),
      seed: 0.77,
      onDisplay: true,
    },
    {
      id: 'starter_clover',
      name: 'Clover',
      genotype: makeGenotype({ lesser: [1, 0], piebald: [1, 0] }),
      seed: 0.34,
      onDisplay: true,
    },
  ];

  return definitions.map((def, idx) => {
    const phenotype = evaluatePhenotype(def.genotype, def.seed);
    return {
      id: def.id,
      name: def.name,
      genotype: def.genotype,
      polygenicSeed: def.seed,
      phenotype,
      currentVigor: phenotype.lineageVigor,
      onDisplay: def.onDisplay,
      hatchedAt: now + idx * 1000,
      generation: 1,
      sire: null,
      dam: null,
      hatchOdds: 1,
      hatchOddsLabel: 'Founder',
      wasMutation: false,
      petCount: 0,
    };
  });
}

/**
 * Generates random showcase morphs exclusively for the title screen vivarium background.
 * Uses unique `title_` IDs so they are cleanly replaced when starting or loading a save.
 * Defaults to `ContentFlag.RealMorphs` (non-custom snakes only for first-time users);
 * custom snake categories are included only when present in `contentFlags`.
 */
export function createTitleShowcaseSnakes(
  count = 5,
  rng: () => number = Math.random,
  contentFlags: number = ContentFlag.RealMorphs,
  enabledModPacks?: string[]
): SnakeEntity[] {
  const now = Date.now();
  const usedNames = new Set<string>();
  const showcasePool = getEnabledLoci(contentFlags).filter((loc) => loc !== 'spider');
  const modPool = getEnabledModLoci(enabledModPacks);
  const snakes: SnakeEntity[] = [];

  for (let i = 0; i < count; i++) {
    const partial: Partial<Genotype> = {};
    let modAlleles: ModAlleleMap | undefined;
    const geneCount = 1 + (rng() < 0.65 ? 1 : 0);
    for (let g = 0; g < geneCount; g++) {
      // Mix enabled Workshop / local Gene Pack loci into title showcase only when enabled in continue slot
      if (modPool.length > 0 && rng() < 0.35) {
        const modLoc = modPool[Math.floor(rng() * modPool.length)];
        const pair: AllelePair =
          modLoc.spec.mode === 'recessive' || (modLoc.spec.mode === 'codominant' && rng() < 0.3)
            ? [1, 1]
            : [1, 0];
        modAlleles = { ...(modAlleles ?? {}), [modLoc.fullId]: pair };
        continue;
      }
      const loc = showcasePool[Math.floor(rng() * showcasePool.length)];
      const def = LOCUS_DEFINITIONS[loc];
      if (def.mode === 'recessive') {
        partial[loc] = [1, 1];
      } else if (def.mode === 'codominant' && rng() < 0.25) {
        partial[loc] = [1, 1];
      } else {
        partial[loc] = [1, 0];
      }
    }

    const genotype = makeGenotype(partial);
    const cleanedMod = cleanModAlleles(modAlleles);
    const seed = Number((0.1 + rng() * 0.8).toFixed(4));
    const phenotype = evaluatePhenotype(genotype, seed, cleanedMod);
    const name = pickCozySnakeName(usedNames, rng);
    usedNames.add(name);

    snakes.push({
      id: `title_${now}_${i}_${Math.floor(rng() * 10000)}`,
      name,
      genotype,
      ...(cleanedMod ? { modAlleles: cleanedMod } : {}),
      polygenicSeed: seed,
      phenotype,
      currentVigor: phenotype.lineageVigor,
      onDisplay: true,
      hatchedAt: now + i,
      generation: 1,
      sire: null,
      dam: null,
      hatchOdds: 1,
      hatchOddsLabel: 'Showcase',
      wasMutation: false,
      petCount: 0,
    });
  }

  return snakes;
}

export function buildInitialDiscoveries(snakes: SnakeEntity[]): Record<string, MorphDiscovery> {
  const map: Record<string, MorphDiscovery> = {};
  for (const snake of snakes) {
    const key = snake.phenotype.morphKey;
    if (!map[key]) {
      map[key] = {
        morphKey: key,
        morphName: snake.phenotype.morphName,
        rarity: snake.phenotype.rarity,
        firstDiscoveredAt: snake.hatchedAt,
        countHatched: 1,
        sampleSnakeId: snake.id,
        samplePatternFormula: snake.phenotype.patternRule.formula,
        samplePalette: snake.phenotype.palette,
        samplePatternRule: snake.phenotype.patternRule,
        sampleIsUpsideDown: snake.phenotype.isUpsideDown,
        parentLineageSummary:
          snake.sire && snake.dam
            ? `${snake.sire.morphName} × ${snake.dam.morphName}`
            : 'Founder Lineage',
        tags: snake.phenotype.tags,
      };
    } else {
      map[key].countHatched += 1;
    }
  }
  return map;
}

export interface SimulatorSynthesisResult {
  genotype: Genotype;
  modAlleles: ModAlleleMap | undefined;
  triggered: {
    resultName: string;
    ingredientAName: string;
    ingredientBName: string;
    resultCount: 1 | 2;
    isRecessiveHet: boolean;
  } | null;
}

/**
 * Interactive simulator synthesis resolver: when "Allow synthesis" is enabled in the Gene Simulator,
 * detects any matching mod-pack or built-in elemental synthesis recipe in the current selection,
 * consumes the required ingredient copies (turning them Off), and increments the synthesized gene On.
 */
export function applySimulatorSynthesis(
  genotype: Genotype,
  modAlleles: ModAlleleMap | undefined,
  options: {
    allowCoreSynthesis: boolean;
    enabledModPacks?: string[];
  }
): SimulatorSynthesisResult {
  const pairFor = (c: number): AllelePair => (c >= 2 ? [1, 1] : c === 1 ? [1, 0] : [0, 0]);

  // 1. Check enabled Workshop / local Gene Pack recipes first
  const modRecipes = getEnabledModRecipes(options.enabledModPacks);
  for (const recipe of modRecipes) {
    const getCount = (ing: { target: string; isCore: boolean }): number =>
      ing.isCore
        ? countAlleles(genotype[ing.target as LocusId])
        : countAlleles(modAlleles?.[ing.target] ?? [0, 0]);

    const cA = getCount(recipe.ingredientA);
    const cB = getCount(recipe.ingredientB);
    const reqA = recipe.ingredientA.minParentCopies;
    const reqB = recipe.ingredientB.minParentCopies;
    if (cA < reqA || cB < reqB) continue;

    const nextGenotype: Genotype = { ...genotype };
    const nextMod: ModAlleleMap = { ...(modAlleles ?? {}) };

    if (recipe.ingredientA.isCore) {
      const k = recipe.ingredientA.target as LocusId;
      nextGenotype[k] = pairFor(Math.max(0, cA - reqA));
    } else {
      nextMod[recipe.ingredientA.target] = pairFor(Math.max(0, cA - reqA));
    }

    if (recipe.ingredientB.isCore) {
      const k = recipe.ingredientB.target as LocusId;
      nextGenotype[k] = pairFor(Math.max(0, cB - reqB));
    } else {
      nextMod[recipe.ingredientB.target] = pairFor(Math.max(0, cB - reqB));
    }

    const curRes = countAlleles(nextMod[recipe.resultFullId] ?? [0, 0]);
    const nextResCount: 1 | 2 = curRes >= 1 ? 2 : 1;
    nextMod[recipe.resultFullId] = pairFor(nextResCount);

    const resDef = getModLocus(recipe.resultFullId);
    const nameOf = (ing: { target: string; isCore: boolean }): string =>
      ing.isCore
        ? LOCUS_DEFINITIONS[ing.target as LocusId]?.name ?? ing.target
        : getModLocus(ing.target)?.spec.name ?? ing.target;

    return {
      genotype: nextGenotype,
      modAlleles: cleanModAlleles(nextMod),
      triggered: {
        resultName: resDef?.spec.name ?? recipe.name,
        ingredientAName: nameOf(recipe.ingredientA),
        ingredientBName: nameOf(recipe.ingredientB),
        resultCount: nextResCount,
        isRecessiveHet: resDef?.spec.mode === 'recessive' && nextResCount === 1,
      },
    };
  }

  // 2. Check built-in Elemental & Mineral synthesis recipes when core CustomMorphs are active
  if (options.allowCoreSynthesis) {
    for (const recipe of ELEMENTAL_SYNTHESIS_RECIPES) {
      const cA = countAlleles(genotype[recipe.ingredientA]);
      const cB = countAlleles(genotype[recipe.ingredientB]);
      const reqA = recipe.minParentAllelesA;
      const reqB = recipe.minParentAllelesB;
      if (cA < reqA || cB < reqB) continue;

      const curRes = countAlleles(genotype[recipe.result]);
      const nextResCount: 1 | 2 = curRes >= 1 ? 2 : 1;
      const nextGenotype: Genotype = {
        ...genotype,
        [recipe.ingredientA]: pairFor(Math.max(0, cA - reqA)),
        [recipe.ingredientB]: pairFor(Math.max(0, cB - reqB)),
        [recipe.result]: pairFor(nextResCount),
      };

      const resDef = LOCUS_DEFINITIONS[recipe.result];
      return {
        genotype: nextGenotype,
        modAlleles: cleanModAlleles(modAlleles),
        triggered: {
          resultName: resDef.name,
          ingredientAName: LOCUS_DEFINITIONS[recipe.ingredientA].name,
          ingredientBName: LOCUS_DEFINITIONS[recipe.ingredientB].name,
          resultCount: nextResCount,
          isRecessiveHet: resDef.mode === 'recessive' && nextResCount === 1,
        },
      };
    }
  }

  return {
    genotype,
    modAlleles: cleanModAlleles(modAlleles),
    triggered: null,
  };
}

/**
 * Spawns a full SnakeEntity from any simulated genotype + polygenic seed (used by Simulator dev debug spawn).
 */
export function createSimulatedSnake(
  genotype: Genotype,
  polygenicSeed: number,
  existingNames: Set<string>,
  customName?: string,
  rng: () => number = Math.random,
  modAlleles?: ModAlleleMap
): SnakeEntity {
  const normalized = makeGenotype(genotype);
  const cleanedMod = cleanModAlleles(modAlleles);
  const phenotype = evaluatePhenotype(normalized, polygenicSeed, cleanedMod);
  const trimmed = customName?.trim();
  const name = trimmed && trimmed.length > 0 ? trimmed : pickCozySnakeName(existingNames, rng);
  const now = Date.now();
  return {
    id: `sim_${now}_${Math.floor(rng() * 100000)}`,
    name,
    genotype: normalized,
    ...(cleanedMod ? { modAlleles: cleanedMod } : {}),
    polygenicSeed,
    phenotype,
    currentVigor: phenotype.lineageVigor,
    onDisplay: false,
    hatchedAt: now,
    generation: 1,
    sire: null,
    dam: null,
    hatchOdds: 1,
    hatchOddsLabel: 'Simulator',
    wasMutation: false,
    petCount: 0,
  };
}
