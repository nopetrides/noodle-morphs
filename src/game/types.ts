import type { ContentFlag, GameConfig, GameModeId, SaveSlotId } from './contentFlags';
export { ContentFlag };
export type { GameConfig, GameModeId, SaveSlotId };

export type GamePhase = 'title' | 'playing' | 'paused';

export type LocusId =
  | 'pastel'
  | 'mojave'
  | 'lesser'
  | 'enchi'
  | 'spider'
  | 'pinstripe'
  | 'albino'
  | 'piebald'
  | 'clown'
  | 'axanthic'
  | 'banana'
  | 'fire'
  | 'yellowbelly'
  | 'blackpastel'
  | 'ghi'
  | 'cypress'
  | 'calico'
  | 'lavenderalbino'
  | 'desertghost'
  | 'hypo'
  | 'ultramel'
  // Custom Morpharium Originals (appended to end to preserve compact v2 save indices)
  | 'saddler'
  | 'bullring'
  | 'chevron'
  | 'raindrop'
  | 'magma'
  | 'tidal'
  | 'crossbar'
  | 'trackline'
  | 'milksnake'
  | 'invert'
  // Additional Extreme Real-World Ball Python Genes (appended to preserve compact v2 save indices)
  | 'monsoon'
  | 'sunset'
  | 'geneticstripe'
  | 'tristripe'
  | 'leopard'
  | 'monarch'
  | 'cinnamon'
  | 'blade'
  // Element & Mineral Synthesis Tree (CustomMorphs — appended to preserve compact v2 save indices)
  // Tier 0 Starters (alongside tidal & magma)
  | 'earth'
  | 'air'
  | 'wood'
  // Tier 1 Primary Fusions
  | 'cobblestone'
  | 'clay'
  | 'sand'
  | 'frost'
  | 'ash'
  | 'sap'
  | 'basalt'
  // Tier 2 Back-Breeding & Refined Materials
  | 'glass'
  | 'terracotta'
  | 'sandstone'
  | 'amber'
  | 'coal'
  | 'quartz'
  | 'iron'
  | 'copper'
  // Tier 3 Supers & Cross-Tier Alloys / Stones
  | 'obsidian'
  | 'steel'
  | 'gold'
  | 'malachite'
  | 'granite'
  | 'marble'
  | 'petrifiedwood'
  | 'agate'
  // Tier 4 Cross-Tier + Supers + Recessive Gems
  | 'amethyst'
  | 'ruby'
  | 'lapis'
  | 'emerald'
  | 'opal'
  // Tier 5 Apex Recessive Mastery
  | 'diamond'
  | 'sapphire'
  | 'bismuth'
  | 'jade';

export type InheritanceMode = 'dominant' | 'codominant' | 'recessive';

export type MorphTag =
  | 'Color'
  | 'Pattern'
  | 'Light'
  | 'Dark'
  | 'High-White'
  | 'Complex'
  | 'Wobble'
  | 'Custom';

export interface LocusDefinition {
  id: LocusId;
  name: string;
  superName?: string;
  mode: InheritanceMode;
  shortCode: string;
  description: string;
  visualEffect: string;
  rarityWeight: number;
  tags: MorphTag[];
  /** True for Morpharium-original custom morphs/patterns not based on real-world ball python genes */
  isCustom?: boolean;
  /** Content expansion flag gating this locus (defaults to CustomMorphs if isCustom, else RealMorphs) */
  contentFlag?: ContentFlag;
}

/**
 * Each diploid locus carries 2 allele copies:
 * 0 = wild-type (normal), 1 = mutant morph allele.
 * Tuple is always sorted descending [a, b] where a >= b for canonical representation:
 * [0, 0] = wild-type, [1, 0] = heterozygous (visual for dom/codom, het for recessive), [1, 1] = homozygous (super/visual recessive).
 */
export type AllelePair = [0 | 1, 0 | 1];

export type Genotype = Record<LocusId, AllelePair>;

export type MorphRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type PatternMotif =
  // Real-world Ball Python pattern motifs
  | 'alien_heads'
  | 'keyholes'
  | 'banded'
  | 'dorsal_stripe'
  | 'tri_stripe'
  | 'mosaic'
  | 'rosettes'
  | 'lines'
  | 'webbing'
  | 'inkblot'
  // Preserved original Morpharium Custom motifs
  | 'saddles'
  | 'rings'
  | 'chevrons'
  | 'teardrops'
  | 'bars'
  | 'tracks'
  // Custom Elemental Fusion & Showcase motifs
  | 'magma_cracks'
  | 'ripples'
  | 'cobblestone'
  | 'milk_bands'
  | 'veins'
  | 'facets'
  | 'strata'
  | 'bismuth';

export type PatternWeight = 'thin' | 'medium' | 'broad' | 'blushed';

export type PatternModifier =
  | 'dotted'
  | 'banded'
  | 'speckled'
  | 'flamed'
  | 'patched'
  | 'faded';

export interface PatternRule {
  motif: PatternMotif;
  weight: PatternWeight;
  modifier: PatternModifier;
  /** Human-readable modular rule formula, e.g. "(alien heads) (medium) (banded)" */
  formula: string;
  /** Compact ASCII visual motif cue, e.g. "-o-o-o-" */
  glyph: string;
  /** Deterministic frequency multiplier along spine */
  frequency: number;
  /** Deterministic secondary variation seed 0..1 */
  variationSeed: number;
  /** True when the rendered pattern motif is a Morpharium Custom pattern (not based on real morphs) */
  isCustomPattern: boolean;
}

export type BehaviorTrait =
  | 'dinnerbone_wobble'
  | 'shade_seeker'
  | 'basking_lounger'
  | 'curious_periscoper'
  | 'calm_wanderer';

export interface SnakePalette {
  base: string;
  patternPrimary: string;
  patternSecondary: string;
  /** Optional third pigment region color (e.g. Milk Band scarlet rings or Cobblestone granite accent) */
  accentColor?: string;
  belly: string;
  outline: string;
  eyeIris: string;
  eyePupil: string;
  headBlush: string;
  isLeucistic: boolean;
  isAlbino: boolean;
  isPiebald: boolean;
  isCalico?: boolean;
  isInverted?: boolean;
  /** Emergent dual-pigment mixed-paint mottling when two chromatically distinct color genes combine */
  mottleColorA?: string;
  mottleColorB?: string;
  mottleStrength?: number;
  /** Optional body opacity in (0, 1] for translucent elements/crystals (Air, Glass, Frost, Diamond, Gems) */
  bodyOpacity?: number;
}

export type FieldOperation =
  | 'blend'
  | 'union'
  | 'smoothUnion'
  | 'intersection'
  | 'subtract'
  | 'modulate'
  | 'warp';

export type SkinFieldPrimitiveId =
  | 'voronoi_network'
  | 'longitudinal_waves'
  | 'transverse_waves'
  | 'angled_waves'
  | 'radial_rings'
  | 'radial_teardrops'
  | 'cellular_pavers'
  | 'magma_fissures'
  | 'water_caustics'
  | 'shattered_mosaic'
  | 'stripe_tracks'
  | 'mineral_veins'
  | 'crystal_facets'
  | 'banded_agate'
  | 'stepped_bismuth'
  | 'wind_wisps'
  | 'speckled_granite'
  | 'custom_map';

export interface FieldContribution {
  field: SkinFieldPrimitiveId;
  operation: FieldOperation;
  strength: number;
  frequency?: number;
  aspectRatio?: number;
  phase?: number;
  params?: Record<string, number>;
}

export interface SkinFieldParams {
  /** Morphological erosion/dilation threshold: higher = broader dark markings, lower = thinner */
  coverage: number;
  /** Longitudinal pattern frequency along spine u */
  frequency: number;
  /** Aspect ratio (>1 elongates along spine, <1 compresses transversely) */
  aspectRatio: number;
  /** Multi-scale domain warp irregularity */
  warpStrength: number;
  /** Longitudinal dorsal continuity (+1 strong spine stripe, 0 neutral, -1 split) */
  dorsalBias: number;
  /** Bilateral alignment (0 = alternating wild-type, 1 = mirrored flanks) */
  symmetry: number;
  /** Alternates wider and narrower flank cells by shifting shared boundaries (0..1) */
  widthContrast: number;
  /** Widens dark gaps toward outer flank edges to taper light cell necks (0..1) */
  baseTaper: number;
  /** Indents dorsal-facing edge of broader crowns with rounded shoulders for heart outlines (0..1) */
  crownNotch: number;
  /** Stable seeded per-cell width variation with occasional substantially wider heads (0..1) */
  localWidthVariation: number;
  /** Smooth regional width tendency shared across nearby cells along the body (0..1) */
  regionalCoherence: number;
  /** Interior alien-head eye count (0 = none, 1 = keyhole, 2 = classic alien head) */
  eyeCount: number;
  /** Interior eye dot prominence 0..1 */
  eyeStrength: number;
  /** Transition softness (small = sharp edges, large = blushed/smoky) */
  edgeSoftness: number;
  /** Interior blushing intensity 0..1 */
  blush: number;
  /** Rising lower-flank flaming 0..1 */
  flankFlame: number;
  /** Calico rising snowy-white lower-flank suppression 0..1 */
  calicoRise: number;
  /** Piebald regional pure-white suppression 0..1 */
  piebaldAmount: number;
  /** Banana / dark-speckle flecking intensity 0..1 */
  speckleAmount: number;
  /** Multi-pigment third region strength (e.g. Milk Band tricolor rings) 0..1 */
  accentBandStrength: number;
  /** Logically separate scale relief shading strength 0..1 */
  scaleRelief: number;
}

export interface SkinPhenotypeSpec {
  generatorVersion: number;
  params: SkinFieldParams;
  contributions: FieldContribution[];
  customMapId?: string;
}

export type SkinDebugStage = 'final' | 'raw_field' | 'pigment_mask' | 'scale_map';

export interface SnakePhenotype {
  morphKey: string;
  morphName: string;
  visualGenes: string[];
  hetGenes: string[];
  rarity: MorphRarity;
  isUpsideDown: boolean;
  /** True when this morph expresses any Morpharium Custom gene or pattern */
  isCustomMorph: boolean;
  /** Maximum lineage vigour (baseline 100, always clamped >= minimum breed cost) */
  lineageVigor: number;
  lineageNote: string;
  behavior: BehaviorTrait;
  behaviorLabel: string;
  healthPredisposition: string;
  palette: SnakePalette;
  patternRule: PatternRule;
  /** Composable continuous scalar-field specification in local (u, v) snake skin coordinates */
  skinSpec?: SkinPhenotypeSpec;
  tags: MorphTag[];
}

export interface ParentReference {
  id: string;
  name: string;
  morphName: string;
}

export interface SnakeEntity {
  id: string;
  name: string;
  genotype: Genotype;
  polygenicSeed: number;
  phenotype: SnakePhenotype;
  /** Current breeding vigour in [0, phenotype.lineageVigor] */
  currentVigor: number;
  onDisplay: boolean;
  hatchedAt: number;
  generation: number;
  sire: ParentReference | null;
  dam: ParentReference | null;
  hatchOdds: number;
  hatchOddsLabel: string;
  wasMutation: boolean;
  petCount: number;
}

export type BreedingOutcomeKind = 'mix' | 'complex' | 'synthesis';

export interface ClutchEgg {
  id: string;
  revealed: boolean;
  isNewMorph: boolean;
  odds: number;
  oddsLabel: string;
  wasMutation: boolean;
  mutationLocusName: string | null;
  wasSynthesis?: boolean;
  synthesisLocusName?: string | null;
  synthesisTier?: number;
  sold?: boolean;
  snake: SnakeEntity;
}

export interface MorphDiscovery {
  morphKey: string;
  morphName: string;
  rarity: MorphRarity;
  firstDiscoveredAt: number;
  countHatched: number;
  sampleSnakeId: string;
  samplePatternFormula: string;
  samplePalette: SnakePalette;
  samplePatternRule: PatternRule;
  sampleIsUpsideDown: boolean;
  parentLineageSummary: string;
  tags?: MorphTag[];
}

export interface BreedingOddsEntry {
  morphKey: string;
  morphName: string;
  probability: number;
  oddsLabel: string;
  rarity: MorphRarity;
  isDiscovered: boolean;
  includesUpsideDown: boolean;
  outcomeKind?: BreedingOutcomeKind;
  synthesisTier?: number;
  synthesisResultLocus?: LocusId;
}

export interface SpinePoint {
  x: number;
  y: number;
  angle: number;
  radius: number;
}

export interface SnakeSpine {
  points: SpinePoint[];
  /** Ground-space breadcrumb trail recorded by headPivot (node 1) so body segments follow the exact ground path */
  trail: Array<{ x: number; y: number }>;
  segmentLength: number;
  baseRadius: number;
  maxTurnAngle: number;
  heading: number;
  slitherPhase: number;
  tongueTimer: number;
  tongueActive: number;
  wobblePhase: number;
}

export type ActiveDrawerTab =
  | 'collection'
  | 'breeding'
  | 'morphdex'
  | 'simulator'
  | 'jeanpool'
  | 'hissdepot';

export interface TerrariumSettings {
  heatLampOn: boolean;
  muted: boolean;
}

export interface GeneBiasDistribution {
  /** Percentage weight 0..100 for dominant inheritance nudge */
  dominant: number;
  /** Percentage weight 0..100 for codominant inheritance nudge */
  codominant: number;
  /** Percentage weight 0..100 for recessive inheritance nudge */
  recessive: number;
}

export interface HissDepotState {
  /** Number of [+1 clutch size / +1 min breed time] upgrades purchased */
  incubatorMaxLevel: number;
  /** Currently active incubator level in [0, incubatorMaxLevel] */
  incubatorActiveLevel: number;
  /** Number of permanent +1 display slot upgrades purchased */
  displaySlotsBought: number;
  /** Number of +10% cap upgrades purchased per category */
  biasCapsBought: {
    dominant: number;
    codominant: number;
    recessive: number;
  };
  /** Self-balancing percentages summing to 100 */
  biasWeights: GeneBiasDistribution;
}

export interface JeanPoolState {
  /** Total purchases made at The Jean Pool (scales price) */
  purchasesCount: number;
  /** Remaining store cooldown in seconds (0 = open) */
  cooldownRemainingSec: number;
  /** Deterministic seed for the current batch of up to 3 missing-gene snakes */
  stockSeed: number;
}

export interface EconomyState {
  /** Unsigned integer currency balance (always >= 0, integer) */
  money: number;
  /** Total snakes sold (unlocks The Jean Pool once >= 1) */
  totalSnakesSold: number;
  /** Morph keys that have already claimed their First-Sale Bonus */
  soldMorphKeys: string[];
  /** Unlocks Sell buttons once the first extra (triplicate, 3+) of any morph is born */
  sellUnlocked: boolean;
  /** True once the player has seen the Jean Pool unlock intro dialogue */
  jeanPoolIntroSeen: boolean;
  /** True once the player has seen the Hiss Depot unlock intro dialogue */
  hissDepotIntroSeen?: boolean;
  jeanPool: JeanPoolState;
  hissDepot: HissDepotState;
}
