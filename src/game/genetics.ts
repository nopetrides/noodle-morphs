import {
  ContentFlag,
  DEFAULT_CONTENT_FLAGS,
  hasContentFlag,
} from './contentFlags';
import { clamp, createDefaultSkinFieldParams, SKIN_GENERATOR_VERSION } from './skinField';
import type {
  AllelePair,
  BehaviorTrait,
  BreedingOddsEntry,
  ClutchEgg,
  FieldContribution,
  GeneBiasDistribution,
  Genotype,
  InheritanceMode,
  LocusDefinition,
  LocusId,
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
  return {
    pastel: [0, 0],
    mojave: [0, 0],
    lesser: [0, 0],
    enchi: [0, 0],
    spider: [0, 0],
    pinstripe: [0, 0],
    albino: [0, 0],
    piebald: [0, 0],
    clown: [0, 0],
    axanthic: [0, 0],
    banana: [0, 0],
    fire: [0, 0],
    yellowbelly: [0, 0],
    blackpastel: [0, 0],
    ghi: [0, 0],
    cypress: [0, 0],
    calico: [0, 0],
    lavenderalbino: [0, 0],
    desertghost: [0, 0],
    hypo: [0, 0],
    ultramel: [0, 0],
    saddler: [0, 0],
    bullring: [0, 0],
    chevron: [0, 0],
    raindrop: [0, 0],
    magma: [0, 0],
    tidal: [0, 0],
    crossbar: [0, 0],
    trackline: [0, 0],
    milksnake: [0, 0],
  };
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
 * Custom Elemental Fusion Complex: Lava (magma) + Water (tidal) -> Cobblestone!
 */
export function isCobblestone(genotype: Genotype): boolean {
  return countAlleles(genotype.magma) >= 1 && countAlleles(genotype.tidal) >= 1;
}

/**
 * Super Elemental Fusion: Homozygous Lava + Homozygous Water -> Obsidian Cobblestone!
 */
export function isObsidianCobblestone(genotype: Genotype): boolean {
  return countAlleles(genotype.magma) === 2 && countAlleles(genotype.tidal) === 2;
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

  if (cobblestone) {
    motif = 'cobblestone';
    weight = obsidianCobble ? 'broad' : 'medium';
    modifier = obsidianCobble ? 'speckled' : 'banded';
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
  if (motif === 'bars') return '| | | | |';
  if (motif === 'tracks') return modifier === 'dotted' ? '-o-o-o-' : '=======';
  if (modifier === 'faded') return '· · · · ·';
  if (motif === 'lines' && modifier === 'dotted') return '-o-o-o-';
  if (motif === 'lines') return weight === 'thin' ? '~~-~~-~' : '=~=~=~=';
  if (motif === 'dorsal_stripe') return '===·===·===';
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

function derivePalette(genotype: Genotype): SnakePalette {
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

  // 0. Custom Elemental Fusion Complex: Lava + Water -> Cobblestone (and Obsidian Cobblestone)
  if (cobblestone) {
    return {
      base: obsidianCobble ? '#555A63' : '#858B92',
      patternPrimary: obsidianCobble ? '#1E2026' : '#31363E',
      patternSecondary: obsidianCobble ? '#8B94A0' : '#BCC3CB',
      accentColor: obsidianCobble ? '#434852' : '#6C737C',
      belly: '#CDD3D9',
      outline: '#17191E',
      eyeIris: obsidianCobble ? '#B785F5' : '#D9AA58',
      eyePupil: '#141210',
      headBlush: obsidianCobble ? '#6B727D' : '#9FA6AE',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
    };
  }

  // 0b. Custom Elemental: Lava (obsidian basalt + molten fissures)
  if (magma >= 1) {
    return {
      base: magma === 2 ? '#1E1412' : '#2C1F1C',
      patternPrimary: magma === 2 ? '#FF5A14' : '#F46A1F',
      patternSecondary: '#FFD35E',
      belly: '#4A2B20',
      outline: '#110B0A',
      eyeIris: '#FFA02E',
      eyePupil: '#3D0F06',
      headBlush: '#FF7D2A',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
    };
  }

  // 0c. Custom Elemental: Water (cerulean + seafoam wave caustics)
  if (tidal >= 1) {
    return {
      base: tidal === 2 ? '#1E6996' : '#2D85B2',
      patternPrimary: '#8CE5F4',
      patternSecondary: '#DDFBFF',
      belly: '#E3F8FC',
      outline: '#123A52',
      eyeIris: '#5FE7FA',
      eyePupil: '#0A2536',
      headBlush: '#76D7EB',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
    };
  }

  // 1. Blue-Eyed Leucistic
  if (bel) {
    return {
      base: albino ? '#FFFDF7' : '#F6F4EE',
      patternPrimary: '#EAE6DB',
      patternSecondary: '#FDFCF9',
      belly: '#FFFFFF',
      outline: '#C5BFA8',
      eyeIris: albino || lavenderAlbino ? '#E86A87' : '#65B8E6',
      eyePupil: albino || lavenderAlbino ? '#9C1D3B' : '#11293B',
      headBlush: '#FFFFFF',
      isLeucistic: true,
      isAlbino: albino || lavenderAlbino,
      isPiebald: piebald,
    };
  }

  // 2. Black-Eyed Leucistic (Super Fire)
  if (blackEl) {
    return {
      base: '#FAF8F0',
      patternPrimary: '#F7E194',
      patternSecondary: '#FFFFFF',
      belly: '#FFFFFF',
      outline: '#CFC8B4',
      eyeIris: '#262321',
      eyePupil: '#0A0908',
      headBlush: '#FFFDF5',
      isLeucistic: true,
      isAlbino: false,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 3. Ivory (Super Yellow Belly)
  if (ivory) {
    return {
      base: '#F5F0E3',
      patternPrimary: '#DDD2E6',
      patternSecondary: '#FFFDF7',
      belly: '#FFFFFF',
      outline: '#C2B7A3',
      eyeIris: '#48403A',
      eyePupil: '#14110F',
      headBlush: '#FAF6EC',
      isLeucistic: true,
      isAlbino: false,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 4. 8-Ball (Super Black Pastel) — velvety solid charcoal-black
  if (eightBall && !albino && !lavenderAlbino) {
    return {
      base: '#2A2524',
      patternPrimary: '#1A1615',
      patternSecondary: '#443C39',
      belly: '#635954',
      outline: '#100D0C',
      eyeIris: '#4D413B',
      eyePupil: '#0B0908',
      headBlush: '#3A3331',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 5. Snow (Albino + Axanthic)
  if (albino && axanthic) {
    return {
      base: '#F7F2E8',
      patternPrimary: '#E3D5E8',
      patternSecondary: '#FFFDF8',
      belly: '#FFFDF9',
      outline: '#BBA9B8',
      eyeIris: '#F06A83',
      eyePupil: '#8E1730',
      headBlush: '#FBF5FA',
      isLeucistic: false,
      isAlbino: true,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 6. Lavender Albino (distinct tangerine-gold over violet-lavender)
  if (lavenderAlbino) {
    return {
      base: '#F7B44A',
      patternPrimary: '#D9C2EB',
      patternSecondary: '#FFE39E',
      belly: '#FAF4FF',
      outline: '#B47933',
      eyeIris: '#F05988',
      eyePupil: '#7D1032',
      headBlush: '#EBD9F7',
      isLeucistic: false,
      isAlbino: true,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 7. Classic Albino
  if (albino) {
    const brightYellow = pastel >= 1 ? '#FFE76B' : enchi >= 1 ? '#FFBF47' : '#F9D65C';
    const whiteBand = spider ? '#FFFDF6' : '#FFF4DC';
    return {
      base: brightYellow,
      patternPrimary: whiteBand,
      patternSecondary: '#F2A341',
      belly: '#FFF9EC',
      outline: '#C9892C',
      eyeIris: '#F25A74',
      eyePupil: '#8C1028',
      headBlush: '#FFF0B8',
      isLeucistic: false,
      isAlbino: true,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 8. Ultramel (caramel-amber with plum-burgundy eyes)
  if (ultramel) {
    return {
      base: '#E3A74F',
      patternPrimary: '#8E5329',
      patternSecondary: '#F7D79A',
      belly: '#FAF0DC',
      outline: '#6B3D1D',
      eyeIris: '#9B354D',
      eyePupil: '#4A0F1F',
      headBlush: '#EAC17D',
      isLeucistic: false,
      isAlbino: true,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 9. Axanthic (monochrome silver & charcoal)
  if (axanthic) {
    const silverBase = desertGhost ? '#E5E8EC' : pastel >= 1 ? '#D3D7DC' : '#A9B0B8';
    const darkSlate = clown || ghi >= 1 ? '#20242A' : '#353A42';
    return {
      base: silverBase,
      patternPrimary: darkSlate,
      patternSecondary: '#ECEFF2',
      belly: '#F4F6F8',
      outline: '#1B1F24',
      eyeIris: '#8F9AA6',
      eyePupil: '#111418',
      headBlush: pastel >= 1 ? '#E1E5EA' : '#969DA6',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
      isCalico: calico,
    };
  }

  // 10. Banana / Coral Glow (lilac-lavender & banana-yellow)
  if (banana >= 1) {
    return {
      base: banana === 2 ? '#FFE37A' : '#F4CF67',
      patternPrimary: banana === 2 ? '#DFBEE8' : '#B997C9',
      patternSecondary: '#FFF2B8',
      belly: '#FCF7EA',
      outline: '#8C7099',
      eyeIris: '#B5748A',
      eyePupil: '#361B26',
      headBlush: '#EBD3F2',
      isLeucistic: false,
      isAlbino: false,
      isPiebald: piebald,
    };
  }

  // 11. Standard & combo warm ball python palettes
  let base = '#B5894F';
  let patternPrimary = '#2E2219';
  let patternSecondary = '#D8B376';
  let belly = '#F3EAD8';
  let outline = '#1F1711';
  let eyeIris = '#7C5D3B';
  let headBlush = '#947348';

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
    base = pastel >= 1 ? '#F7DA78' : '#D9AE62';
    patternPrimary = '#4D3B28';
    patternSecondary = '#FBEAC0';
    headBlush = '#F4DFB0';
  }

  if (yellowbelly === 1) {
    base = pastel >= 1 ? '#F0CE62' : '#CE9F52';
    patternSecondary = '#F5D47D';
    belly = '#F9F2DC';
  }

  if (enchi === 2) {
    base = '#EE9E3C';
    patternPrimary = '#4E2E17';
    patternSecondary = '#FFE099';
    headBlush = '#FAD07E';
  } else if (enchi === 1) {
    base = pastel >= 1 ? '#F6C150' : '#DF963F';
    patternPrimary = '#462A16';
    patternSecondary = '#F7CF84';
    headBlush = '#F0C574';
  }

  if (cypress >= 1) {
    base = cypress === 2 ? '#B8A66E' : '#A69460';
    patternPrimary = '#362D1F';
    patternSecondary = '#DFD0A2';
  }

  if (blackpastel === 1) {
    base = pastel >= 1 ? '#9E8568' : '#7C5C42';
    patternPrimary = '#231914';
    patternSecondary = '#B89B7C';
    headBlush = '#634A37';
  }

  if (ghi >= 1) {
    base = ghi === 2 ? '#594C3F' : '#857154';
    patternPrimary = '#171412';
    patternSecondary = '#C4B18D';
    headBlush = '#4A3E33';
  }

  if (lesser === 1) {
    base = pastel >= 1 ? '#ECCE82' : '#CFA96D';
    patternPrimary = '#6E5233';
    patternSecondary = '#F3E3BE';
    headBlush = '#E7D1A4';
  } else if (mojave === 1) {
    base = pastel >= 1 ? '#D9C074' : '#A68E63';
    patternPrimary = '#2A231E';
    patternSecondary = '#E6D6B0';
    headBlush = '#8D7C62';
  }

  if (pinstripe) {
    base = pastel >= 1 ? '#E8C563' : '#C99E57';
    patternPrimary = '#3C2A1A';
    patternSecondary = '#E9CFA0';
  }

  if (clown) {
    base = pastel >= 1 ? '#F2CE6D' : '#D4A154';
    patternPrimary = '#2C1B12';
    patternSecondary = '#F2D694';
    headBlush = '#4A2F1C';
  }

  if (desertGhost) {
    // Ultra-clean high-contrast cream/gold + crisp dark pattern
    base = pastel >= 1 ? '#FCE68A' : '#EED898';
    patternPrimary = '#1C1714';
    patternSecondary = '#FFF7DC';
    headBlush = '#F5E7BA';
  }

  if (hypo) {
    // Soft smoky ghost pastel-taupe wash
    base = '#E2C39C';
    patternPrimary = '#847468';
    patternSecondary = '#F4E5CE';
    outline = '#5E5148';
    headBlush = '#EBD7BD';
  }

  if (saddler && pastel === 0 && enchi === 0 && mojave === 0 && lesser === 0) {
    base = '#C7944C';
    patternPrimary = '#2E1F15';
    patternSecondary = '#E6C282';
  }
  if (bullring >= 1 && pastel === 0 && mojave === 0 && lesser === 0) {
    base = bullring === 2 ? '#D98C52' : '#C47E4B';
    patternPrimary = '#2D1C14';
    patternSecondary = '#F0BE8A';
  }
  if (chevron >= 1 && pastel === 0 && enchi === 0) {
    base = chevron === 2 ? '#E2AF4E' : '#CC9B49';
    patternPrimary = '#2B1F16';
    patternSecondary = '#F2D28B';
  }
  if (raindrop && pastel === 0) {
    base = '#94A68D';
    patternPrimary = '#283229';
    patternSecondary = '#D4E2CE';
    headBlush = '#AEBF9F';
  }

  if (crossbar && pastel === 0 && enchi === 0) {
    base = '#D69F4E';
    patternPrimary = '#352216';
    patternSecondary = '#F4D594';
  }
  if (trackline && pastel === 0 && pinstripe === false) {
    base = '#C9A462';
    patternPrimary = '#302317';
    patternSecondary = '#ECD4A4';
  }

  if (spider) {
    patternSecondary = '#FAF7F0';
    belly = '#FDFBF7';
    if (
      pastel === 0 &&
      enchi === 0 &&
      lesser === 0 &&
      mojave === 0 &&
      ghi === 0 &&
      blackpastel === 0
    ) {
      base = '#C79B58';
      patternPrimary = '#2D2016';
    }
  } else if (calico) {
    // Real Calico displays high-contrast dark alien heads outlined in warm deep gold + bright white lower belly
    belly = '#FDFBF7';
    if (
      pastel === 0 &&
      enchi === 0 &&
      lesser === 0 &&
      mojave === 0 &&
      ghi === 0 &&
      blackpastel === 0
    ) {
      base = '#C9964C';
      patternPrimary = '#231810';
      patternSecondary = '#F0CF7E';
      headBlush = '#A8824B';
    }
  }

  let accentColor: string | undefined;
  if (milksnake >= 1) {
    // Classic tricolor milk snake palette: warm cream/gold base, jet-black rings, vivid scarlet saddles!
    accentColor = milksnake === 2 ? '#D92F23' : '#C93C2B';
    if (pastel === 0 && enchi === 0 && mojave === 0 && lesser === 0 && ghi === 0 && blackpastel === 0) {
      base = '#F2E4BE';
      patternPrimary = '#1C1715';
      patternSecondary = '#FCEFD2';
      headBlush = '#261D1A';
    }
  }

  return {
    base,
    patternPrimary,
    patternSecondary,
    accentColor,
    belly,
    outline,
    eyeIris,
    eyePupil: '#120E0B',
    headBlush,
    isLeucistic: false,
    isAlbino: false,
    isPiebald: piebald,
    isCalico: calico,
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
  polygenicSeed = 0.5
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

  // Subtle individual polygenic variation (each snake in a clutch is uniquely organic)
  const vFreq = (seededFloat(polygenicSeed, 11) - 0.5) * 0.14;
  const vCov = (seededFloat(polygenicSeed, 12) - 0.5) * 0.04;
  params.frequency = clamp(1.0 + vFreq, 0.75, 1.3);
  params.coverage = clamp(0.54 + vCov, 0.48, 0.6);
  params.dorsalBias = -0.18; // Subtle Classic dorsal beading + tail stripe

  const hasBioPatternGene =
    enchi > 0 ||
    spider > 0 ||
    pinstripe > 0 ||
    clown ||
    mojave === 1 ||
    lesser === 1 ||
    blackpastel === 1 ||
    ghi > 0 ||
    cypress > 0;

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
      // Solo Calico: subtle pale/frosted lower flank patches & scattered white scales (0.34..0.50)
      params.calicoRise = 0.34 + calicoPoly * 0.16;
    } else {
      // Mixed-morph Calico combos bring out much stronger high-white scraped patches (0.60..0.92)
      params.calicoRise = clamp(0.6 + (otherVisualCount - 1) * 0.13 + calicoPoly * 0.14, 0.58, 0.92);
    }
    // Calico also subtly enhances contrast & dorsal tail striping
    params.flankFlame = clamp(params.flankFlame + 0.16, 0, 1);
  }
  if (piebald && !bel && !blackEl) {
    params.piebaldAmount = 0.78;
  }

  // Leucistic complexes soften internal contrast cleanly
  if (bel || blackEl || ivory) {
    params.coverage = 0.12;
    params.blush = 0.85;
    params.edgeSoftness = 0.2;
    params.scaleRelief = 0.28;
  }

  // --- Composable Custom Mathematical Fields ---
  if (cobblestone) {
    params.coverage = obsidianCobble ? 0.64 : 0.56;
    params.edgeSoftness = 0.025;
    params.warpStrength = 0.08;
    params.scaleRelief = 0.2;
    contributions.push({
      field: 'cellular_pavers',
      operation: 'blend',
      strength: 0.96,
      frequency: obsidianCobble ? 1.15 : 1.0,
    });
  } else {
    if (magma >= 1) {
      params.coverage = magma === 2 ? 0.58 : 0.46;
      params.warpStrength += 0.25;
      contributions.push({
        field: 'magma_fissures',
        operation: hasBioPatternGene ? 'smoothUnion' : 'blend',
        strength: hasBioPatternGene ? 0.72 : 0.94,
        frequency: magma === 2 ? 1.15 : 1.0,
      });
    }
    if (tidal >= 1) {
      params.coverage = tidal === 2 ? 0.54 : 0.46;
      params.blush += 0.25;
      contributions.push({
        field: 'water_caustics',
        operation: hasBioPatternGene ? 'modulate' : 'blend',
        strength: hasBioPatternGene ? 0.78 : 0.92,
        frequency: tidal === 2 ? 1.18 : 1.0,
      });
    }
  }

  if (milksnake >= 1 && !cobblestone) {
    params.accentBandStrength = milksnake === 2 ? 1.0 : 0.9;
    params.edgeSoftness = 0.032;
    // Key Phase 4 & 5 showcase:
    // - Solo Milk Band -> crisp tricolor transverse bands (blend 0.92)
    // - Milk Band + any biological pattern gene -> modulates the cellular alien-head network!
    const isComposed = hasBioPatternGene || magma > 0 || tidal > 0;
    if (!isComposed) {
      params.eyeCount = 0;
      params.eyeStrength = 0;
      params.warpStrength = 0.1;
    }
    contributions.push({
      field: 'transverse_waves',
      operation: isComposed ? 'modulate' : 'blend',
      strength: isComposed ? 0.82 : 0.94,
      frequency: milksnake === 2 ? 1.15 : 0.95,
    });
  }

  if (crossbar && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) {
      params.eyeCount = 0;
      params.warpStrength = 0.06;
    }
    contributions.push({
      field: 'transverse_waves',
      operation: isComposed ? 'modulate' : 'blend',
      strength: isComposed ? 0.72 : 0.94,
      frequency: 1.05,
    });
  }

  if (trackline && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) {
      params.eyeCount = 0;
      params.warpStrength = 0.04;
    }
    contributions.push({
      field: 'longitudinal_waves',
      operation: isComposed ? 'smoothUnion' : 'blend',
      strength: isComposed ? 0.75 : 0.95,
      frequency: 1.0,
      params: {
        trackOffset: 0.28,
        trackWidth: 0.13,
        dotted: spider > 0 || seededFloat(polygenicSeed, 2) < 0.65 ? 1 : 0,
      },
    });
  }

  if (chevron >= 1 && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) {
      params.eyeCount = 0;
      params.warpStrength = 0.08;
    }
    contributions.push({
      field: 'angled_waves',
      operation: isComposed ? 'modulate' : 'blend',
      strength: isComposed ? 0.74 : 0.93,
      frequency: chevron === 2 ? 1.15 : 0.95,
      params: { slant: 0.095 },
    });
  }

  if (bullring >= 1 && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) params.eyeCount = 0;
    contributions.push({
      field: 'radial_rings',
      operation: isComposed ? 'smoothUnion' : 'blend',
      strength: isComposed ? 0.68 : 0.92,
      frequency: bullring === 2 ? 0.88 : 1.0,
      params: { style: 0 },
    });
  }

  if (saddler && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) params.eyeCount = 0;
    contributions.push({
      field: 'radial_rings',
      operation: isComposed ? 'smoothUnion' : 'blend',
      strength: isComposed ? 0.68 : 0.92,
      frequency: 1.0,
      params: { style: 1 },
    });
  }

  if (raindrop && !cobblestone) {
    const isComposed = hasBioPatternGene || milksnake > 0;
    if (!isComposed) params.eyeCount = 0;
    contributions.push({
      field: 'radial_teardrops',
      operation: isComposed ? 'smoothUnion' : 'blend',
      strength: isComposed ? 0.72 : 0.93,
      frequency: 1.05,
    });
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

export function evaluatePhenotype(genotype: Genotype, polygenicSeed = 0.5): SnakePhenotype {
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

  if (pastel === 2) {
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

  if (spider >= 1) {
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

  // Extreme Custom Elemental Fusion: Lava + Water -> Cobblestone!
  if (obsidianCobble) {
    visualGenes.push('Obsidian Cobblestone');
    addTags('magma');
    addTags('tidal');
  } else if (cobblestone) {
    visualGenes.push('Cobblestone');
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

  // Rarity tier based on recessive count, super/complex forms, and gene stacking
  const recessiveVisualCount =
    (albino === 2 ? 1 : 0) +
    (piebald === 2 ? 1 : 0) +
    (clown === 2 ? 1 : 0) +
    (axanthic === 2 ? 1 : 0) +
    (lavenderalbino === 2 ? 1 : 0) +
    (desertghost === 2 ? 1 : 0) +
    (hypo === 2 ? 1 : 0) +
    (ultramel === 2 ? 1 : 0) +
    (raindrop === 2 ? 1 : 0);
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
    (cobblestone ? 1 : 0);

  let rarity: MorphRarity = 'common';
  if (
    obsidianCobble ||
    recessiveVisualCount >= 2 ||
    (recessiveVisualCount >= 1 && (visualGenes.length >= 3 || superCount >= 1)) ||
    (cobblestone && visualGenes.length >= 2) ||
    visualGenes.length >= 4
  ) {
    rarity = 'legendary';
  } else if (recessiveVisualCount === 1 || superCount >= 1 || visualGenes.length >= 3) {
    rarity = 'rare';
  } else if (visualGenes.length >= 2) {
    rarity = 'uncommon';
  } else {
    rarity = 'common';
  }

  const palette = derivePalette(genotype);
  const patternRule = derivePatternRule(genotype, polygenicSeed);
  const skinSpec = deriveSkinPhenotypeSpec(genotype, polygenicSeed);
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
  bias?: GeneBiasDistribution
): BreedingOddsEntry[] {
  const activeLoci = LOCI_ORDER.filter(
    (loc) => countAlleles(sire.genotype[loc]) > 0 || countAlleles(dam.genotype[loc]) > 0
  );

  interface PartialOutcome {
    genotype: Genotype;
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
    }
  >();

  for (const out of outcomes) {
    const pheno = evaluatePhenotype(out.genotype, 0.5);
    const existing = byMorph.get(pheno.morphKey);
    if (existing) {
      existing.probability += out.prob;
    } else {
      byMorph.set(pheno.morphKey, {
        morphKey: pheno.morphKey,
        morphName: pheno.morphName,
        probability: out.prob,
        rarity: pheno.rarity,
        includesUpsideDown: pheno.isUpsideDown,
      });
    }
  }

  return Array.from(byMorph.values())
    .sort((a, b) => b.probability - a.probability)
    .map((entry) => ({
      ...entry,
      oddsLabel: formatOddsLabel(entry.probability, false),
      isDiscovered: discoveredKeys.has(entry.morphKey),
    }));
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
  contentFlags = DEFAULT_CONTENT_FLAGS
): ClutchEgg[] {
  const preview = computeBreedingPreview(sire, dam, discoveredKeys, bias);
  const probByMorphKey = new Map(preview.map((e) => [e.morphKey, e.probability]));
  const usedNames = new Set(existingNames);
  const clutchDiscoveredKeys = new Set(discoveredKeys);
  const enabledLoci = getEnabledLoci(contentFlags);
  const eggs: ClutchEgg[] = [];
  const now = Date.now();

  const drawParentAllele = (pair: AllelePair, pPass: number): 0 | 1 => {
    const c = countAlleles(pair);
    if (c === 0) return 0;
    if (c === 2) return 1;
    return rng() < pPass ? 1 : 0;
  };

  for (let i = 0; i < clutchSize; i++) {
    const childGenotype = createWildTypeGenotype();

    // Mendelian inheritance per locus (with optional Hiss Depot category balance)
    for (const loc of LOCI_ORDER) {
      const pPass = getTransmissionProbForMode(LOCUS_DEFINITIONS[loc].mode, bias);
      const sireAllele = drawParentAllele(sire.genotype[loc], pPass);
      const damAllele = drawParentAllele(dam.genotype[loc], pPass);
      childGenotype[loc] = normalizeAllelePair(sireAllele, damAllele);
    }

    // Gentle spontaneous mutation roll weighted by gene bias if set (strictly within enabled content flags)
    let wasMutation = false;
    let mutationLocusName: string | null = null;
    if (rng() < MUTATION_CHANCE_PER_EGG) {
      const candidates = enabledLoci.filter((loc) => {
        const current = countAlleles(childGenotype[loc]);
        // Never mutate into homozygous lethal Super Spider
        if (loc === 'spider' && current >= 1) return false;
        return current < 2;
      });
      if (candidates.length > 0) {
        const chosen = pickWeightedMutationLocus(candidates, bias, rng);
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

    // Belt-and-suspenders guard: never hatch homozygous lethal Super Spider
    if (countAlleles(childGenotype.spider) >= 2) {
      childGenotype.spider = [1, 0];
    }

    const polygenicSeed = rng();
    const phenotype = evaluatePhenotype(childGenotype, polygenicSeed);

    const mendelianProb = probByMorphKey.get(phenotype.morphKey);
    let odds: number;
    let isMutatedDisplay = false;
    if (wasMutation && mendelianProb === undefined) {
      odds = Number((MUTATION_CHANCE_PER_EGG / Math.max(1, enabledLoci.length)).toFixed(4));
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
 */
export function createTitleShowcaseSnakes(
  count = 5,
  rng: () => number = Math.random
): SnakeEntity[] {
  const now = Date.now();
  const usedNames = new Set<string>();
  const showcasePool = LOCI_ORDER.filter((loc) => loc !== 'spider');
  const snakes: SnakeEntity[] = [];

  for (let i = 0; i < count; i++) {
    const partial: Partial<Genotype> = {};
    const geneCount = 1 + (rng() < 0.65 ? 1 : 0);
    for (let g = 0; g < geneCount; g++) {
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
    const seed = Number((0.1 + rng() * 0.8).toFixed(4));
    const phenotype = evaluatePhenotype(genotype, seed);
    const name = pickCozySnakeName(usedNames, rng);
    usedNames.add(name);

    snakes.push({
      id: `title_${now}_${i}_${Math.floor(rng() * 10000)}`,
      name,
      genotype,
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

/**
 * Spawns a full SnakeEntity from any simulated genotype + polygenic seed (used by Simulator dev debug spawn).
 */
export function createSimulatedSnake(
  genotype: Genotype,
  polygenicSeed: number,
  existingNames: Set<string>,
  customName?: string,
  rng: () => number = Math.random
): SnakeEntity {
  const normalized = makeGenotype(genotype);
  const phenotype = evaluatePhenotype(normalized, polygenicSeed);
  const trimmed = customName?.trim();
  const name = trimmed && trimmed.length > 0 ? trimmed : pickCozySnakeName(existingNames, rng);
  const now = Date.now();
  return {
    id: `sim_${now}_${Math.floor(rng() * 100000)}`,
    name,
    genotype: normalized,
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
