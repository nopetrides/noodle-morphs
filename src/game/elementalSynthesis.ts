import { ContentFlag, hasContentFlag } from './contentFlags';
import type {
  AllelePair,
  FieldContribution,
  Genotype,
  LocusDefinition,
  LocusId,
  PatternModifier,
  PatternMotif,
  PatternWeight,
} from './types';

export interface ElementalSynthesisRecipe {
  id: string;
  tier: 1 | 2 | 3 | 4 | 5;
  ingredientA: LocusId;
  ingredientB: LocusId;
  /** Minimum parent allele count for ingredient A (1 = any carrier/visual, 2 = requires 2x Super parent) */
  minParentAllelesA: 1 | 2;
  /** Minimum parent allele count for ingredient B (1 = any carrier/visual, 2 = requires 2x Super parent) */
  minParentAllelesB: 1 | 2;
  result: LocusId;
  /** Short geological/chemical note shown in Morphdex once discovered */
  rationale: string;
}

export interface ElementalVisualProfile {
  locusId: LocusId;
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  /** Pigment colors */
  baseHex: string;
  superBaseHex: string;
  primaryHex: string;
  superPrimaryHex?: string;
  secondaryHex: string;
  superSecondaryHex?: string;
  headHex: string;
  superHeadHex?: string;
  bellyHex?: string;
  outlineHex?: string;
  eyeIrisHex?: string;
  eyePupilHex?: string;
  accentHex?: string;
  /** Chromatic voice hex & weight for emergent dual-pigment mixed-paint mottling */
  voiceHex: string;
  voiceWeight1x: number;
  voiceWeight2x: number;
  /** Optional inherent dual-hue mottle for multi-colored minerals (e.g. Verdigris, Opal, Bismuth) */
  intrinsicMottleA?: string;
  intrinsicMottleB?: string;
  intrinsicMottleStrength?: number;
  /** Only activate intrinsic mottle at 2x Super (e.g. Copper -> 2x Verdigris Patina) */
  intrinsicMottleSuperOnly?: boolean;
  /** Dosage blend strength when solo vs. mixed with other strong pigments */
  dosage1x: number;
  dosage2x: number;
  /** Optional translucent body opacity in (0, 1] (Air, Glass, Diamond, Frost, Quartz, Sap, Amber, Gems) */
  bodyOpacity1x?: number;
  bodyOpacity2x?: number;
  /** Pattern rule summary */
  motif: PatternMotif;
  weight: PatternWeight;
  modifier: PatternModifier;
  /** Non-stomping SkinField parameter nudges */
  coverageDelta1x?: number;
  coverageDelta2x?: number;
  edgeSoftness?: number;
  blushDelta?: number;
  flankFlameDelta?: number;
  warpDelta?: number;
  speckleAmount?: number;
  scaleRelief?: number;
  /** Composable field contributions (symmetric order-independent blend + crisp detail accents) */
  buildContributions: (alleleCount: 1 | 2) => FieldContribution[];
}

/**
 * Declarative 35-locus Element & Mineral definitions (appended to LOCUS_DEFINITIONS;
 * tidal & magma already live in core CustomMorphs as Tier 0 starters).
 */
export const ELEMENTAL_LOCUS_DEFINITIONS: Record<
  | 'earth'
  | 'air'
  | 'wood'
  | 'cobblestone'
  | 'clay'
  | 'sand'
  | 'frost'
  | 'ash'
  | 'sap'
  | 'basalt'
  | 'glass'
  | 'terracotta'
  | 'sandstone'
  | 'amber'
  | 'coal'
  | 'quartz'
  | 'iron'
  | 'copper'
  | 'obsidian'
  | 'steel'
  | 'gold'
  | 'malachite'
  | 'granite'
  | 'marble'
  | 'petrifiedwood'
  | 'agate'
  | 'amethyst'
  | 'ruby'
  | 'lapis'
  | 'emerald'
  | 'opal'
  | 'diamond'
  | 'sapphire'
  | 'bismuth'
  | 'jade',
  LocusDefinition
> = {
  // --- Tier 0 Starters (alongside tidal=Water and magma=Lava) ---
  earth: {
    id: 'earth',
    name: 'Earth',
    superName: 'Bedrock',
    mode: 'codominant',
    shortCode: 'Ert',
    description: 'Starter elemental gene infusing rich loam-umber mineral strata that deepens into dark Bedrock when homozygous.',
    visualEffect: 'Layered soil-ochre strata (1× Earth) to dense slate Bedrock (2×)',
    rarityWeight: 1.5,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  air: {
    id: 'air',
    name: 'Air',
    superName: 'Pressure',
    mode: 'codominant',
    shortCode: 'Air',
    description: 'Starter elemental gene weaving wispy pale wind currents that condense into dense barometric Pressure when homozygous.',
    visualEffect: 'Silver-sky wispy shear (1× Air) to condensed Pressure bands (2×)',
    rarityWeight: 1.5,
    tags: ['Pattern', 'Light', 'Custom'],
    isCustom: true,
  },
  wood: {
    id: 'wood',
    name: 'Wood',
    superName: 'Timber',
    mode: 'codominant',
    shortCode: 'Wod',
    description: 'Starter organic elemental gene etching warm cedar-oak bark grain that matures into deep dark Timber heartwood.',
    visualEffect: 'Longitudinal bark grain (1× Wood) to rich dark heartwood Timber (2×)',
    rarityWeight: 1.5,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },

  // --- Tier 1 Primary Fusions (1x + 1x, introduces first Recessive Het prove-outs) ---
  cobblestone: {
    id: 'cobblestone',
    name: 'Cobblestone',
    superName: 'Granite Cobble',
    mode: 'codominant',
    shortCode: 'Cob',
    description: 'Synthesized from Water + Lava: cooled stone interlocking into crisp running-bond mortar pavers.',
    visualEffect: 'Running-bond cobblestone mortar etched cleanly over any pattern',
    rarityWeight: 1.9,
    tags: ['Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
  clay: {
    id: 'clay',
    name: 'Clay',
    superName: 'Porcelain',
    mode: 'codominant',
    shortCode: 'Cly',
    description: 'Synthesized from Water + Earth: smooth wet terracotta-clay swirls that refine into lustrous ivory Porcelain.',
    visualEffect: 'Silky sedimentary clay swirls (1×) to pale glazed Porcelain (2×)',
    rarityWeight: 1.8,
    tags: ['Color', 'Custom'],
    isCustom: true,
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    superName: 'Dune',
    mode: 'codominant',
    shortCode: 'Snd',
    description: 'Synthesized from Earth + Air: wind-carved golden ochre ripples that roll into sweeping desert Dunes.',
    visualEffect: 'Fine wind-rippled desert sand waves (1× Sand / 2× Dune)',
    rarityWeight: 1.8,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  frost: {
    id: 'frost',
    name: 'Frost',
    superName: 'Glacier',
    mode: 'codominant',
    shortCode: 'Frs',
    description: 'Synthesized from Water + Air: crisp rime-ice crystalline edges that deepen into glacial cyan facets.',
    visualEffect: 'Pale frosty rime facets (1× Frost) to vivid icy Glacier planes (2×)',
    rarityWeight: 1.9,
    tags: ['Light', 'Pattern', 'Custom'],
    isCustom: true,
  },
  ash: {
    id: 'ash',
    name: 'Ash',
    superName: 'Cinder',
    mode: 'codominant',
    shortCode: 'Ash',
    description: 'Synthesized from Wood + Lava: smoky charcoal-gray ash plumes dotted with faint glowing cinders.',
    visualEffect: 'Drifting volcanic ash haze (1× Ash) to glowing Cinder dust (2×)',
    rarityWeight: 1.8,
    tags: ['Dark', 'Color', 'Custom'],
    isCustom: true,
  },
  sap: {
    id: 'sap',
    name: 'Sap',
    mode: 'recessive',
    shortCode: 'sap',
    description: 'Recessive synthesis from Wood + Water: hatches as Het Sap; prove out for warm translucent golden-resin droplets.',
    visualEffect: 'Recessive glossy golden tree-sap teardrops and honey glaze',
    rarityWeight: 2.1,
    tags: ['Color', 'Pattern', 'Custom'],
    isCustom: true,
  },
  basalt: {
    id: 'basalt',
    name: 'Basalt',
    mode: 'recessive',
    shortCode: 'bsl',
    description: 'Recessive synthesis from Earth + Lava: hatches as Het Basalt; prove out for dark hexagonal volcanic stone columns.',
    visualEffect: 'Recessive matte charcoal-indigo polygonal basalt columns',
    rarityWeight: 2.1,
    tags: ['Dark', 'Pattern', 'Custom'],
    isCustom: true,
  },

  // --- Tier 2 Back-Breeding & Refined Materials (still no Supers required) ---
  glass: {
    id: 'glass',
    name: 'Glass',
    superName: 'Prism Glass',
    mode: 'codominant',
    shortCode: 'Gls',
    description: 'Synthesized from Sand + Lava: fused silica with translucent sea-glass clarity and specular facet glints.',
    visualEffect: 'Pale sea-glass facets & bright caustic highlights (2× Prism Glass)',
    rarityWeight: 2.2,
    tags: ['Light', 'Pattern', 'Custom'],
    isCustom: true,
  },
  terracotta: {
    id: 'terracotta',
    name: 'Terracotta',
    superName: 'Glazed Kiln',
    mode: 'codominant',
    shortCode: 'Ter',
    description: 'Synthesized from Clay + Lava: kiln-fired warm sienna pottery bands with subtle artisan kiln glaze.',
    visualEffect: 'Baked sienna-cinnabar banded pottery contours',
    rarityWeight: 2.2,
    tags: ['Color', 'Pattern', 'Custom'],
    isCustom: true,
  },
  sandstone: {
    id: 'sandstone',
    name: 'Sandstone',
    superName: 'Canyon Strata',
    mode: 'codominant',
    shortCode: 'Sst',
    description: 'Synthesized from Sand + Water: water-cemented sedimentary canyon stripes in warm ochre and rust.',
    visualEffect: 'Layered red-ochre and amber desert canyon strata',
    rarityWeight: 2.2,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  amber: {
    id: 'amber',
    name: 'Amber',
    mode: 'recessive',
    shortCode: 'amb',
    description: 'Recessive synthesis from Sap + Earth: fossilized golden tree resin with dark ancient inclusions.',
    visualEffect: 'Recessive deep honey-cognac resin glow with tiny fossil flecks',
    rarityWeight: 2.5,
    tags: ['Color', 'Custom'],
    isCustom: true,
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    superName: 'Anthracite',
    mode: 'codominant',
    shortCode: 'Col',
    description: 'Synthesized from Wood + Ash: carbonized charcoal seams hardening into mirror-dark Anthracite.',
    visualEffect: 'Deep matte carbon-black fractures (1× Coal) to glossy Anthracite (2×)',
    rarityWeight: 2.2,
    tags: ['Dark', 'Color', 'Custom'],
    isCustom: true,
  },
  quartz: {
    id: 'quartz',
    name: 'Quartz',
    superName: 'Clear Crystal',
    mode: 'codominant',
    shortCode: 'Qtz',
    description: 'Synthesized from Glass + Earth: crystallized silica planes forming sharp pearlescent mineral facets.',
    visualEffect: 'Crisp polygonal crystal planes with milky-quartz edges (2× Clear Crystal)',
    rarityWeight: 2.3,
    tags: ['Light', 'Pattern', 'Custom'],
    isCustom: true,
  },
  iron: {
    id: 'iron',
    name: 'Iron',
    superName: 'Forged Iron',
    mode: 'codominant',
    shortCode: 'Irn',
    description: 'Synthesized from Basalt + Earth: iron-rich volcanic ore with cool brushed gunmetal sheen.',
    visualEffect: 'Cool metallic gunmetal veining (1× Iron / 2× Forged Iron)',
    rarityWeight: 2.3,
    tags: ['Dark', 'Color', 'Custom'],
    isCustom: true,
  },
  copper: {
    id: 'copper',
    name: 'Copper',
    superName: 'Verdigris',
    mode: 'codominant',
    shortCode: 'Cpr',
    description: 'Synthesized from Basalt + Water: burnished bronze-copper ore that oxidizes into turquoise Verdigris patina at 2×.',
    visualEffect: 'Warm metallic copper (1×) oxidizing into copper-and-turquoise Verdigris (2×)',
    rarityWeight: 2.3,
    tags: ['Color', 'Pattern', 'Custom'],
    isCustom: true,
  },

  // --- Tier 3 Supers & Cross-Tier Stones / Alloys ---
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    superName: 'Crying Obsidian',
    mode: 'codominant',
    shortCode: 'Obs',
    description: 'Synthesized from 2× Super Water + 2× Super Lava: quenched volcanic glass that weeps glowing violet fractures at 2×.',
    visualEffect: 'Glossy jet-slate volcanic glass facets (2× Crying Obsidian violet veins)',
    rarityWeight: 2.7,
    tags: ['Dark', 'Complex', 'Custom'],
    isCustom: true,
  },
  steel: {
    id: 'steel',
    name: 'Steel',
    superName: 'Damascus Steel',
    mode: 'codominant',
    shortCode: 'Stl',
    description: 'Synthesized from Iron + Coal: carbon-forged chrome steel that ripples into swirling folded Damascus Steel at 2×.',
    visualEffect: 'Sleek silver-chrome sheen (1× Steel) to folded Damascus ripples (2×)',
    rarityWeight: 2.6,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    superName: 'Electrum',
    mode: 'codominant',
    shortCode: 'Gld',
    description: 'Synthesized from Quartz + 2× Super Water: riverbed placer gold eroded from hydrothermal quartz veins.',
    visualEffect: 'Gleaming metallic gold-amber seams laced with dark ore lines',
    rarityWeight: 2.8,
    tags: ['Color', 'Light', 'Custom'],
    isCustom: true,
  },
  malachite: {
    id: 'malachite',
    name: 'Malachite',
    superName: 'Banded Malachite',
    mode: 'codominant',
    shortCode: 'Mal',
    description: 'Synthesized from 2× Verdigris Copper + Earth: weathered copper carbonate swirling in concentric emerald-and-black bands.',
    visualEffect: 'Iconic swirling concentric emerald and forest-black mineral rings',
    rarityWeight: 2.8,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  granite: {
    id: 'granite',
    name: 'Granite',
    superName: 'Porphyry',
    mode: 'codominant',
    shortCode: 'Grn',
    description: 'Synthesized from Cobblestone + Quartz: coarse igneous stone speckled with pink feldspar, quartz, and dark mica.',
    visualEffect: 'Salt-and-pepper rose-feldspar, ivory quartz, and charcoal mica grain',
    rarityWeight: 2.5,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  marble: {
    id: 'marble',
    name: 'Marble',
    superName: 'Carrara Marble',
    mode: 'codominant',
    shortCode: 'Mrb',
    description: 'Synthesized from Clay + 2× Bedrock Earth: metamorphosed pale stone laced with flowing charcoal and gold veins.',
    visualEffect: 'Luminous pale ivory stone crossed by organic dark mineral veins',
    rarityWeight: 2.7,
    tags: ['Light', 'Pattern', 'Custom'],
    isCustom: true,
  },
  petrifiedwood: {
    id: 'petrifiedwood',
    name: 'Petrified Wood',
    superName: 'Agate Wood',
    mode: 'codominant',
    shortCode: 'Ptw',
    description: 'Synthesized from Wood + Quartz: ancient timber permineralized by colorful agate and crystalline quartz.',
    visualEffect: 'Warm fossilized woodgrain fused with jewel-toned quartz strata',
    rarityWeight: 2.6,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },
  agate: {
    id: 'agate',
    name: 'Agate',
    superName: 'Fire Agate',
    mode: 'codominant',
    shortCode: 'Agt',
    description: 'Synthesized from Basalt + Quartz: banded chalcedony formed in volcanic cavities with warm carnelian geode rings.',
    visualEffect: 'Concentric warm carnelian, cream, and burnt-amber geode contours',
    rarityWeight: 2.6,
    tags: ['Pattern', 'Color', 'Custom'],
    isCustom: true,
  },

  // --- Tier 4 Cross-Tier + Supers + Recessive Gems ---
  amethyst: {
    id: 'amethyst',
    name: 'Amethyst',
    mode: 'recessive',
    shortCode: 'ame',
    description: 'Recessive synthesis from 2× Clear Crystal Quartz + Iron: quartz tinted royal violet by trace iron crystal chemistry.',
    visualEffect: 'Recessive royal violet crystal facets with pale lavender edge highlights',
    rarityWeight: 3.1,
    tags: ['Color', 'Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    mode: 'recessive',
    shortCode: 'rub',
    description: 'Recessive synthesis from 2× Clear Crystal Quartz + 2× Super Lava: high-heat pigeon-blood crimson crystal facets.',
    visualEffect: 'Recessive deep crimson crystal planes with bright rose-magenta glints',
    rarityWeight: 3.2,
    tags: ['Color', 'Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
  lapis: {
    id: 'lapis',
    name: 'Lapis Lazuli',
    superName: 'Royal Lapis',
    mode: 'codominant',
    shortCode: 'Lap',
    description: 'Synthesized from Marble + Gold: metamorphosed ultramarine blue stone flecked with tiny metallic pyrite gold specks.',
    visualEffect: 'Deep royal ultramarine stone dusted with gleaming golden flecks',
    rarityWeight: 3.0,
    tags: ['Color', 'Dark', 'Custom'],
    isCustom: true,
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    mode: 'recessive',
    shortCode: 'emr',
    description: 'Recessive synthesis from Malachite + 2× Clear Crystal Quartz: vivid jewel-green crystal facets with deep pine shadows.',
    visualEffect: 'Recessive brilliant emerald crystal facets and bright mint specular rims',
    rarityWeight: 3.2,
    tags: ['Color', 'Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
  opal: {
    id: 'opal',
    name: 'Opal',
    mode: 'recessive',
    shortCode: 'opl',
    description: 'Recessive synthesis from 2× Prism Glass + 2× Super Water: hydrated amorphous silica flashing milky pearl and iridescent fire.',
    visualEffect: 'Recessive pearlescent opal coat with shifting aqua, peach, and lilac fire',
    rarityWeight: 3.3,
    tags: ['Light', 'Color', 'Complex', 'Custom'],
    isCustom: true,
  },

  // --- Tier 5 Apex Recessive Mastery ---
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    mode: 'recessive',
    shortCode: 'dia',
    description: 'Apex recessive synthesis from 2× Anthracite Coal + 2× Pressure Air: carbon crystallized under immense pressure into prismatic brilliance.',
    visualEffect: 'Recessive ultra-clear icy crystalline facets with razor-sharp prismatic glints',
    rarityWeight: 3.8,
    tags: ['Light', 'Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire',
    mode: 'recessive',
    shortCode: 'sph',
    description: 'Apex recessive synthesis from 2× Royal Lapis + 2× Glacier Frost: velvet midnight-blue crystal cooled to starlight clarity.',
    visualEffect: 'Recessive deep royal sapphire facets with icy cyan starlight glints',
    rarityWeight: 3.6,
    tags: ['Color', 'Dark', 'Complex', 'Custom'],
    isCustom: true,
  },
  bismuth: {
    id: 'bismuth',
    name: 'Bismuth',
    mode: 'recessive',
    shortCode: 'bis',
    description: 'Apex recessive synthesis from 2× Electrum Gold + 2× Verdigris Copper: stepped rectangular hopper-crystals flashing iridescent rainbow oxides.',
    visualEffect: 'Recessive nested stepped geometric hopper terraces with iridescent oxide hues',
    rarityWeight: 3.8,
    tags: ['Pattern', 'Color', 'Complex', 'Custom'],
    isCustom: true,
  },
  jade: {
    id: 'jade',
    name: 'Jade',
    mode: 'recessive',
    shortCode: 'jad',
    description: 'Apex recessive synthesis from Malachite + 2× Carrara Marble: lustrous carved celadon-emerald metamorphic stone.',
    visualEffect: 'Recessive translucent imperial jade stone laced with soft creamy veins',
    rarityWeight: 3.6,
    tags: ['Color', 'Pattern', 'Complex', 'Custom'],
    isCustom: true,
  },
};

export const ELEMENTAL_LOCI_ORDER: readonly LocusId[] = [
  'earth',
  'air',
  'wood',
  'cobblestone',
  'clay',
  'sand',
  'frost',
  'ash',
  'sap',
  'basalt',
  'glass',
  'terracotta',
  'sandstone',
  'amber',
  'coal',
  'quartz',
  'iron',
  'copper',
  'obsidian',
  'steel',
  'gold',
  'malachite',
  'granite',
  'marble',
  'petrifiedwood',
  'agate',
  'amethyst',
  'ruby',
  'lapis',
  'emerald',
  'opal',
  'diamond',
  'sapphire',
  'bismuth',
  'jade',
];

/**
 * Unbounded declarative Element & Mineral synthesis DAG.
 * Automatic (100%) synthesis triggers whenever an offspring inherits alleles from both ingredients
 * AND parent allele counts satisfy minParentAllelesA/B.
 * Sorted highest-tier + Super-specific first so e.g. 2xWater+2xLava -> Obsidian precedes 1xWater+1xLava -> Cobblestone.
 */
export const ELEMENTAL_SYNTHESIS_RECIPES: readonly ElementalSynthesisRecipe[] = [
  // --- Tier 5 Apex Mastery (Recessive) ---
  {
    id: 'syn_diamond',
    tier: 5,
    ingredientA: 'coal',
    ingredientB: 'air',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'diamond',
    rationale: 'Anthracite carbon compressed under extreme atmospheric Pressure crystallizes into Diamond.',
  },
  {
    id: 'syn_sapphire',
    tier: 5,
    ingredientA: 'lapis',
    ingredientB: 'frost',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'sapphire',
    rationale: 'Royal Lapis refined in Glacier Frost crystallizes into velvet starlight Sapphire.',
  },
  {
    id: 'syn_bismuth',
    tier: 5,
    ingredientA: 'gold',
    ingredientB: 'copper',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'bismuth',
    rationale: 'Refining heavy Electrum Gold and Verdigris Copper yields stepped iridescent Bismuth crystals.',
  },
  {
    id: 'syn_jade',
    tier: 5,
    ingredientA: 'malachite',
    ingredientB: 'marble',
    minParentAllelesA: 1,
    minParentAllelesB: 2,
    result: 'jade',
    rationale: 'Malachite infused into metamorphosed Carrara Marble polishes into imperial Jade.',
  },

  // --- Tier 4 Cross-Tier + Supers + Recessive Gems ---
  {
    id: 'syn_amethyst',
    tier: 4,
    ingredientA: 'quartz',
    ingredientB: 'iron',
    minParentAllelesA: 2,
    minParentAllelesB: 1,
    result: 'amethyst',
    rationale: 'Trace Iron inside Clear Crystal Quartz tints silica into royal violet Amethyst.',
  },
  {
    id: 'syn_ruby',
    tier: 4,
    ingredientA: 'quartz',
    ingredientB: 'magma',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'ruby',
    rationale: 'Clear Crystal Quartz superheated by Super Lava glows into pigeon-blood Ruby.',
  },
  {
    id: 'syn_emerald',
    tier: 4,
    ingredientA: 'malachite',
    ingredientB: 'quartz',
    minParentAllelesA: 1,
    minParentAllelesB: 2,
    result: 'emerald',
    rationale: 'Vivid green Malachite fused with Clear Crystal Quartz crystallizes into Emerald.',
  },
  {
    id: 'syn_opal',
    tier: 4,
    ingredientA: 'glass',
    ingredientB: 'tidal',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'opal',
    rationale: 'Hydrated silica (Prism Glass + Super Water) locks shifting fire inside milky Opal.',
  },
  {
    id: 'syn_lapis',
    tier: 4,
    ingredientA: 'marble',
    ingredientB: 'gold',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'lapis',
    rationale: 'Metamorphosed Marble laced with metallic Gold pyrite flecks forms Lapis Lazuli.',
  },

  // --- Tier 3 Supers & Cross-Tier Alloys / Stones ---
  {
    id: 'syn_obsidian',
    tier: 3,
    ingredientA: 'tidal',
    ingredientB: 'magma',
    minParentAllelesA: 2,
    minParentAllelesB: 2,
    result: 'obsidian',
    rationale: 'Super Water rapidly quenching Super Lava vitrifies into sharp volcanic Obsidian.',
  },
  {
    id: 'syn_gold',
    tier: 3,
    ingredientA: 'quartz',
    ingredientB: 'tidal',
    minParentAllelesA: 1,
    minParentAllelesB: 2,
    result: 'gold',
    rationale: 'Hydrothermal Quartz veins eroded by rushing Super Water yield placer riverbed Gold.',
  },
  {
    id: 'syn_malachite',
    tier: 3,
    ingredientA: 'copper',
    ingredientB: 'earth',
    minParentAllelesA: 2,
    minParentAllelesB: 1,
    result: 'malachite',
    rationale: 'Oxidized Verdigris Copper weathering in Earth carbonates swirls into banded Malachite.',
  },
  {
    id: 'syn_marble',
    tier: 3,
    ingredientA: 'clay',
    ingredientB: 'earth',
    minParentAllelesA: 1,
    minParentAllelesB: 2,
    result: 'marble',
    rationale: 'Sedimentary Clay compressed beneath deep Bedrock Earth metamorphoses into veined Marble.',
  },
  {
    id: 'syn_steel',
    tier: 3,
    ingredientA: 'iron',
    ingredientB: 'coal',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'steel',
    rationale: 'Smelting Iron with carbon-rich Coal alloys strong Steel (and Damascus Steel at 2×).',
  },
  {
    id: 'syn_granite',
    tier: 3,
    ingredientA: 'cobblestone',
    ingredientB: 'quartz',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'granite',
    rationale: 'Cobblestone enriched with crystalline Quartz forms coarse speckled Granite.',
  },
  {
    id: 'syn_petrifiedwood',
    tier: 3,
    ingredientA: 'wood',
    ingredientB: 'quartz',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'petrifiedwood',
    rationale: 'Ancient Wood permineralized slowly by silica Quartz becomes Petrified Wood.',
  },
  {
    id: 'syn_agate',
    tier: 3,
    ingredientA: 'basalt',
    ingredientB: 'quartz',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'agate',
    rationale: 'Silica Quartz deposited inside volcanic Basalt cavities bands into Agate.',
  },

  // --- Tier 2 Back-Breeding & Refined Materials (No Supers Required) ---
  {
    id: 'syn_glass',
    tier: 2,
    ingredientA: 'sand',
    ingredientB: 'magma',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'glass',
    rationale: 'Melting silica Sand with volcanic Lava fuses transparent Glass.',
  },
  {
    id: 'syn_terracotta',
    tier: 2,
    ingredientA: 'clay',
    ingredientB: 'magma',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'terracotta',
    rationale: 'Kiln-firing wet Clay with Lava bakes warm sienna Terracotta.',
  },
  {
    id: 'syn_sandstone',
    tier: 2,
    ingredientA: 'sand',
    ingredientB: 'tidal',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'sandstone',
    rationale: 'Water mineralizing layered desert Sand cements canyon Sandstone.',
  },
  {
    id: 'syn_amber',
    tier: 2,
    ingredientA: 'sap',
    ingredientB: 'earth',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'amber',
    rationale: 'Tree Sap buried and fossilized in Earth hardens into glowing Amber.',
  },
  {
    id: 'syn_coal',
    tier: 2,
    ingredientA: 'wood',
    ingredientB: 'ash',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'coal',
    rationale: 'Wood charred and compressed beneath Ash carbonizes into Coal.',
  },
  {
    id: 'syn_quartz',
    tier: 2,
    ingredientA: 'glass',
    ingredientB: 'earth',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'quartz',
    rationale: 'Amorphous silica Glass slowly recrystallizing in Earth forms Quartz.',
  },
  {
    id: 'syn_iron',
    tier: 2,
    ingredientA: 'basalt',
    ingredientB: 'earth',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'iron',
    rationale: 'Mafic volcanic Basalt concentrated in Earth deposits yields metallic Iron.',
  },
  {
    id: 'syn_copper',
    tier: 2,
    ingredientA: 'basalt',
    ingredientB: 'tidal',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'copper',
    rationale: 'Hydrothermal Water leaching through volcanic Basalt deposits native Copper.',
  },

  // --- Tier 1 Primary Fusions (1x + 1x, No Supers Required) ---
  {
    id: 'syn_cobblestone',
    tier: 1,
    ingredientA: 'tidal',
    ingredientB: 'magma',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'cobblestone',
    rationale: 'Water cooling flowing Lava solidifies into interlocking Cobblestone.',
  },
  {
    id: 'syn_clay',
    tier: 1,
    ingredientA: 'tidal',
    ingredientB: 'earth',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'clay',
    rationale: 'Water weathering fine Earth sediment produces smooth Clay.',
  },
  {
    id: 'syn_sand',
    tier: 1,
    ingredientA: 'earth',
    ingredientB: 'air',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'sand',
    rationale: 'Air eroding exposed Earth grinds wind-rippled Sand.',
  },
  {
    id: 'syn_frost',
    tier: 1,
    ingredientA: 'tidal',
    ingredientB: 'air',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'frost',
    rationale: 'Cold Air chilling Water vapor crystallizes into Frost.',
  },
  {
    id: 'syn_ash',
    tier: 1,
    ingredientA: 'wood',
    ingredientB: 'magma',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'ash',
    rationale: 'Wood scorched by volcanic Lava turns into drifting Ash.',
  },
  {
    id: 'syn_sap',
    tier: 1,
    ingredientA: 'wood',
    ingredientB: 'tidal',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'sap',
    rationale: 'Living Wood nourished by Water exudes golden Sap (Recessive).',
  },
  {
    id: 'syn_basalt',
    tier: 1,
    ingredientA: 'earth',
    ingredientB: 'magma',
    minParentAllelesA: 1,
    minParentAllelesB: 1,
    result: 'basalt',
    rationale: 'Earth melted and solidified by Lava forms dark columnar Basalt (Recessive).',
  },
];

const SYNTHESIS_RECIPE_BY_RESULT = new Map<LocusId, ElementalSynthesisRecipe>(
  ELEMENTAL_SYNTHESIS_RECIPES.map((r) => [r.result, r])
);

/** Tier 1–5 synthesized mineral/element loci that are strictly breed-only (never sold in Jean Pool or random mutations) */
export const SYNTHESIS_ONLY_LOCI: ReadonlySet<LocusId> = new Set(
  ELEMENTAL_SYNTHESIS_RECIPES.map((r) => r.result)
);

export function isSynthesisOnlyLocus(locusId: LocusId): boolean {
  return SYNTHESIS_ONLY_LOCI.has(locusId);
}

export function getRecipeForResult(locusId: LocusId): ElementalSynthesisRecipe | undefined {
  return SYNTHESIS_RECIPE_BY_RESULT.get(locusId);
}

export function getElementalTier(locusId: LocusId): number | null {
  if (locusId === 'tidal' || locusId === 'magma' || locusId === 'earth' || locusId === 'air' || locusId === 'wood') {
    return 0;
  }
  const recipe = SYNTHESIS_RECIPE_BY_RESULT.get(locusId);
  return recipe ? recipe.tier : null;
}

function countPair(pair: AllelePair | undefined): 0 | 1 | 2 {
  if (!pair) return 0;
  return (pair[0] + pair[1]) as 0 | 1 | 2;
}

function decrementPair(pair: AllelePair): AllelePair {
  const c = countPair(pair);
  if (c >= 2) return [1, 0];
  return [0, 0];
}

function incrementPair(pair: AllelePair): AllelePair {
  const c = countPair(pair);
  if (c === 0) return [1, 0];
  return [1, 1];
}

/**
 * Deterministic (100%) automatic synthesis check for an offspring genotype.
 * Strictly bypassed when ContentFlag.CustomMorphs is disabled.
 *
 * Rule:
 * - Recipes are evaluated highest-tier + Super-specific first.
 * - Triggers when the child inherited >= 1 allele of BOTH ingredients AND the parents
 *   meet minParentAllelesA / minParentAllelesB (either Sire=A,Dam=B or Dam=A,Sire=B,
 *   or carried together at required dosage).
 * - Consumes 1 allele of A and 1 allele of B on the child egg and grants 1 allele of result C.
 */
export function applyAutomaticSynthesis(
  childGenotype: Genotype,
  sireGenotype: Genotype,
  damGenotype: Genotype,
  contentFlags: number
): { genotype: Genotype; recipe: ElementalSynthesisRecipe | null } {
  if (!hasContentFlag(contentFlags, ContentFlag.CustomMorphs)) {
    return { genotype: childGenotype, recipe: null };
  }

  for (const recipe of ELEMENTAL_SYNTHESIS_RECIPES) {
    const a = recipe.ingredientA;
    const b = recipe.ingredientB;
    if (countPair(childGenotype[a]) < 1 || countPair(childGenotype[b]) < 1) {
      continue;
    }
    const sireA = countPair(sireGenotype[a]);
    const damA = countPair(damGenotype[a]);
    const sireB = countPair(sireGenotype[b]);
    const damB = countPair(damGenotype[b]);

    const maxA = Math.max(sireA, damA);
    const maxB = Math.max(sireB, damB);
    if (maxA < recipe.minParentAllelesA || maxB < recipe.minParentAllelesB) {
      continue;
    }

    const nextGenotype: Genotype = {
      ...childGenotype,
      [a]: decrementPair(childGenotype[a]),
      [b]: decrementPair(childGenotype[b]),
      [recipe.result]: incrementPair(childGenotype[recipe.result]),
    };
    return { genotype: nextGenotype, recipe };
  }

  return { genotype: childGenotype, recipe: null };
}

/**
 * Declarative visual profiles for all 35 new Elemental & Mineral loci.
 * Every profile participates symmetrically in derivePalette & deriveSkinPhenotypeSpec:
 * - Scaled dosage at 1x vs 2x (never paves over other genes)
 * - Registers chromatic pigmentVoices for emergent mixed-paint mottling (e.g. Sunset + Malachite)
 * - Uses non-stomping field operations (smoothUnion, modulate, warp, subtract, union)
 * - Passes cleanly through removeMelaninColor() (Albino) and invertHex() (Inverted)
 */
export const ELEMENTAL_VISUAL_PROFILES: readonly ElementalVisualProfile[] = [
  // --- Tier 0 Starters ---
  {
    locusId: 'earth',
    tier: 0,
    baseHex: '#9E6E42',
    superBaseHex: '#2F343D',
    primaryHex: '#4A301A',
    superPrimaryHex: '#12151C',
    secondaryHex: '#CFA574',
    superSecondaryHex: '#8E98A8',
    headHex: '#855A34',
    superHeadHex: '#3E4450',
    voiceHex: '#94663B',
    voiceWeight1x: 0.56,
    voiceWeight2x: 0.84,
    dosage1x: 0.68,
    dosage2x: 0.88,
    motif: 'strata',
    weight: 'broad',
    modifier: 'banded',
    coverageDelta1x: -0.04,
    coverageDelta2x: 0.08,
    scaleRelief: 0.36,
    // 1x Earth: fine loamy soil grain -> 2x Bedrock: massive dark tectonic slate slabs!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 0.72, params: { hexColumns: 1 } }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.8, frequency: 1.1 }],
  },
  {
    locusId: 'air',
    tier: 0,
    baseHex: '#DEF0FA',
    superBaseHex: '#5982B3',
    primaryHex: '#FFFFFF',
    superPrimaryHex: '#EBF6FF',
    secondaryHex: '#F5FBFF',
    superSecondaryHex: '#9CE2FF',
    headHex: '#E8F4FC',
    superHeadHex: '#6F98C9',
    outlineHex: '#7DA2BA',
    eyeIrisHex: '#9AD8FA',
    voiceHex: '#B8DEF5',
    voiceWeight1x: 0.58,
    voiceWeight2x: 0.88,
    dosage1x: 0.72,
    dosage2x: 0.9,
    bodyOpacity1x: 0.44,
    bodyOpacity2x: 0.34,
    motif: 'veins',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta1x: -0.1,
    coverageDelta2x: -0.04,
    edgeSoftness: 0.05,
    blushDelta: 0.3,
    scaleRelief: 0.14,
    // 1x Air: soft translucent drifting wind streamlines -> 2x Pressure: concentric storm-indigo barometric isobars!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.15 }]
        : [
            { field: 'wind_wisps', operation: 'blend', strength: 0.86, frequency: 0.85 },
            { field: 'wind_wisps', operation: 'warp', strength: 0.3, frequency: 0.9, params: { horizWarp: 1 } },
          ],
  },
  {
    locusId: 'wood',
    tier: 0,
    baseHex: '#CFA068',
    superBaseHex: '#542A14',
    primaryHex: '#6E4520',
    superPrimaryHex: '#1F0D05',
    secondaryHex: '#F0CFA0',
    superSecondaryHex: '#C97B36',
    headHex: '#B88954',
    superHeadHex: '#6B371B',
    voiceHex: '#B87B3D',
    voiceWeight1x: 0.62,
    voiceWeight2x: 0.88,
    dosage1x: 0.72,
    dosage2x: 0.9,
    motif: 'veins',
    weight: 'medium',
    modifier: 'banded',
    coverageDelta1x: -0.06,
    coverageDelta2x: 0.04,
    edgeSoftness: 0.036,
    scaleRelief: 0.26,
    // 1x Wood: light golden-birch straight grain -> 2x Timber: deep mahogany concentric cross-cut burl rings!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.9, frequency: 0.9 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.84, frequency: 1.25, params: { woodgrain: 1 } }],
  },

  // --- Tier 1 Primary Fusions ---
  {
    locusId: 'cobblestone',
    tier: 1,
    baseHex: '#858B92',
    superBaseHex: '#D17A4A',
    primaryHex: '#282C33',
    superPrimaryHex: '#331E18',
    secondaryHex: '#C4CBD4',
    superSecondaryHex: '#F5C494',
    headHex: '#9FA6AE',
    superHeadHex: '#C26C3E',
    accentHex: '#6C737C',
    bellyHex: '#CDD3D9',
    eyeIrisHex: '#D9AA58',
    voiceHex: '#858B92',
    voiceWeight1x: 0.64,
    voiceWeight2x: 0.88,
    intrinsicMottleA: '#D9743E',
    intrinsicMottleB: '#8C7A72',
    intrinsicMottleStrength: 0.56,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.8,
    dosage2x: 0.9,
    motif: 'cobblestone',
    weight: 'broad',
    modifier: 'banded',
    edgeSoftness: 0.024,
    scaleRelief: 0.16,
    // 1x Cobblestone: crisp gray running-bond bricks -> 2x Granite Cobble: shattered warm orange canyon flagstone mosaic!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [
            { field: 'cellular_pavers', operation: 'blend', strength: 0.72, frequency: 1.2 },
            { field: 'shattered_mosaic', operation: 'blend', strength: 0.68, frequency: 1.05, params: { mode: 0 } },
            { field: 'water_caustics', operation: 'warp', strength: 0.34, frequency: 1.2, params: { horizWarp: 1 } },
          ]
        : [
            { field: 'cellular_pavers', operation: 'blend', strength: 0.88, frequency: 1.0 },
            { field: 'cellular_pavers', operation: 'smoothUnion', strength: 0.24, frequency: 1.0 },
          ],
  },
  {
    locusId: 'clay',
    tier: 1,
    baseHex: '#C27E5E',
    superBaseHex: '#F7F5F0',
    primaryHex: '#6E402E',
    superPrimaryHex: '#2C5AA8',
    secondaryHex: '#E8BC9F',
    superSecondaryHex: '#FFFFFF',
    headHex: '#D19476',
    superHeadHex: '#FAF8F4',
    voiceHex: '#C77B58',
    voiceWeight1x: 0.62,
    voiceWeight2x: 0.84,
    dosage1x: 0.72,
    dosage2x: 0.92,
    motif: 'veins',
    weight: 'blushed',
    modifier: 'faded',
    coverageDelta1x: -0.06,
    coverageDelta2x: -0.24,
    blushDelta: 0.34,
    scaleRelief: 0.16,
    // 1x Clay: swirled wet terracotta -> 2x Porcelain: luminous white ceramic with Delft cobalt-blue crackle veins!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'mineral_veins', operation: 'blend', strength: 0.92, frequency: 0.95, params: { marble: 1, sharpness: 3.2 } }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.8, frequency: 0.75, params: { sharpness: 1.6 } }],
  },
  {
    locusId: 'sand',
    tier: 1,
    baseHex: '#EBCE9A',
    superBaseHex: '#F0AE43',
    primaryHex: '#B08C56',
    superPrimaryHex: '#733B10',
    secondaryHex: '#FFF0CE',
    superSecondaryHex: '#FFE08A',
    headHex: '#EED6A8',
    superHeadHex: '#E39A32',
    voiceHex: '#E8C070',
    voiceWeight1x: 0.62,
    voiceWeight2x: 0.88,
    dosage1x: 0.74,
    dosage2x: 0.9,
    motif: 'strata',
    weight: 'thin',
    modifier: 'banded',
    coverageDelta1x: -0.1,
    coverageDelta2x: 0.02,
    scaleRelief: 0.24,
    // 1x Sand: fine powdery beach grain -> 2x Dune: sweeping bold desert dune ridges & shadowed valleys!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [
            { field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 0.72, params: { strata: 1 } },
            { field: 'banded_agate', operation: 'warp', strength: 0.44, frequency: 0.8, params: { strata: 1, horizWarp: 1 } },
          ]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.84, frequency: 1.65 }],
  },
  {
    locusId: 'frost',
    tier: 1,
    baseHex: '#E6F7FC',
    superBaseHex: '#1888BA',
    primaryHex: '#7CC6E0',
    superPrimaryHex: '#FFFFFF',
    secondaryHex: '#FFFFFF',
    superSecondaryHex: '#9CEEFF',
    headHex: '#F0FAFD',
    superHeadHex: '#259CD1',
    outlineHex: '#4E8CA8',
    eyeIrisHex: '#92E8FF',
    voiceHex: '#7AD3F0',
    voiceWeight1x: 0.68,
    voiceWeight2x: 0.92,
    dosage1x: 0.78,
    dosage2x: 0.9,
    bodyOpacity1x: 0.78,
    bodyOpacity2x: 0.62,
    motif: 'facets',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta1x: -0.18,
    coverageDelta2x: -0.02,
    edgeSoftness: 0.024,
    blushDelta: 0.3,
    scaleRelief: 0.14,
    // 1x Frost: delicate icy white rime needles -> 2x Glacier: deep translucent sapphire-teal ice crevasse slabs!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.92, frequency: 0.68 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.84, frequency: 1.35, params: { marble: 1, sharpness: 2.8 } }],
  },
  {
    locusId: 'ash',
    tier: 1,
    baseHex: '#9C9894',
    superBaseHex: '#221E1D',
    primaryHex: '#524F4C',
    superPrimaryHex: '#FF5E1A',
    secondaryHex: '#D4D0CC',
    superSecondaryHex: '#FFD54F',
    headHex: '#8C8884',
    superHeadHex: '#2E2725',
    voiceHex: '#7D7975',
    voiceWeight1x: 0.58,
    voiceWeight2x: 0.86,
    dosage1x: 0.72,
    dosage2x: 0.9,
    bodyOpacity1x: 0.84,
    bodyOpacity2x: 0.96,
    motif: 'veins',
    weight: 'blushed',
    modifier: 'speckled',
    coverageDelta2x: -0.14,
    edgeSoftness: 0.04,
    scaleRelief: 0.2,
    // 1x Ash: soft drifting pale gray smoke -> 2x Cinder: blackened soot bed sparking with fiery glowing embers!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [
            { field: 'speckled_granite', operation: 'blend', strength: 0.86, frequency: 1.25 },
            { field: 'magma_fissures', operation: 'smoothUnion', strength: 0.42, frequency: 1.15 },
          ]
        : [{ field: 'wind_wisps', operation: 'blend', strength: 0.84, frequency: 1.05 }],
  },
  {
    locusId: 'sap',
    tier: 1,
    baseHex: '#E09F24',
    superBaseHex: '#E8A51E',
    primaryHex: '#7A490D',
    secondaryHex: '#FFE899',
    headHex: '#EDBA47',
    eyeIrisHex: '#F2B230',
    voiceHex: '#E8A420',
    voiceWeight1x: 0.72,
    voiceWeight2x: 0.86,
    dosage1x: 0.74,
    dosage2x: 0.84,
    bodyOpacity1x: 0.8,
    bodyOpacity2x: 0.76,
    motif: 'teardrops',
    weight: 'medium',
    modifier: 'dotted',
    coverageDelta2x: -0.08,
    blushDelta: 0.36,
    scaleRelief: 0.16,
    buildContributions: (): FieldContribution[] => [
      { field: 'radial_teardrops', operation: 'blend', strength: 0.82, frequency: 0.95 },
      { field: 'water_caustics', operation: 'warp', strength: 0.26, frequency: 0.9 },
    ],
  },
  {
    locusId: 'basalt',
    tier: 1,
    baseHex: '#3F424D',
    superBaseHex: '#30333D',
    primaryHex: '#14161C',
    secondaryHex: '#6E7385',
    headHex: '#484C59',
    voiceHex: '#3B3F4D',
    voiceWeight1x: 0.7,
    voiceWeight2x: 0.86,
    dosage1x: 0.76,
    dosage2x: 0.88,
    motif: 'facets',
    weight: 'broad',
    modifier: 'banded',
    edgeSoftness: 0.022,
    scaleRelief: 0.2,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.0, params: { hexColumns: 1 } },
    ],
  },

  // --- Tier 2 Back-Breeding & Refined Materials ---
  {
    locusId: 'glass',
    tier: 2,
    baseHex: '#B5E8E0',
    superBaseHex: '#E2FAFF',
    primaryHex: '#59948F',
    superPrimaryHex: '#FFFFFF',
    secondaryHex: '#E8FFFC',
    superSecondaryHex: '#FFFFFF',
    headHex: '#CCF2EC',
    superHeadHex: '#EEF9FF',
    outlineHex: '#6EA8A3',
    eyeIrisHex: '#88EDE4',
    voiceHex: '#9CE6DE',
    voiceWeight1x: 0.64,
    voiceWeight2x: 0.9,
    intrinsicMottleA: '#4DF2FF',
    intrinsicMottleB: '#FF66D9',
    intrinsicMottleStrength: 0.74,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.74,
    dosage2x: 0.9,
    bodyOpacity1x: 0.48,
    bodyOpacity2x: 0.36,
    motif: 'facets',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta1x: -0.18,
    coverageDelta2x: -0.1,
    edgeSoftness: 0.02,
    blushDelta: 0.42,
    scaleRelief: 0.1,
    // 1x Glass: smooth translucent sea-glass ripples -> 2x Prism Glass: sharp rainbow-flashing translucent crystal facets!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.92, frequency: 1.3 }]
        : [{ field: 'water_caustics', operation: 'blend', strength: 0.84, frequency: 0.95 }],
  },
  {
    locusId: 'terracotta',
    tier: 2,
    baseHex: '#D1623D',
    superBaseHex: '#1FA3AD',
    primaryHex: '#5E2414',
    superPrimaryHex: '#B84723',
    secondaryHex: '#F5A47E',
    superSecondaryHex: '#FFF2D4',
    headHex: '#DB7652',
    superHeadHex: '#2EBAC4',
    voiceHex: '#D65D36',
    voiceWeight1x: 0.68,
    voiceWeight2x: 0.9,
    intrinsicMottleA: '#1CAEB8',
    intrinsicMottleB: '#D96436',
    intrinsicMottleStrength: 0.72,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.74,
    dosage2x: 0.9,
    motif: 'strata',
    weight: 'medium',
    modifier: 'banded',
    coverageDelta2x: -0.1,
    edgeSoftness: 0.024,
    scaleRelief: 0.18,
    // 1x Terracotta: matte sienna pottery bands -> 2x Glazed Kiln: glossy turquoise & copper ceramic crackle glaze!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.15 }]
        : [{ field: 'banded_agate', operation: 'blend', strength: 0.86, frequency: 0.9, params: { strata: 1 } }],
  },
  {
    locusId: 'sandstone',
    tier: 2,
    baseHex: '#E0BA84',
    superBaseHex: '#C43E21',
    primaryHex: '#8C6638',
    superPrimaryHex: '#4A120A',
    secondaryHex: '#FAE4BA',
    superSecondaryHex: '#FFD275',
    headHex: '#E8C692',
    superHeadHex: '#D65432',
    voiceHex: '#D67B3C',
    voiceWeight1x: 0.66,
    voiceWeight2x: 0.9,
    dosage1x: 0.74,
    dosage2x: 0.9,
    motif: 'strata',
    weight: 'medium',
    modifier: 'banded',
    edgeSoftness: 0.026,
    scaleRelief: 0.24,
    // 1x Sandstone: warm buff sedimentary block grain -> 2x Canyon Strata: dramatic Antelope Canyon crimson & ochre waves!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.55, params: { strata: 1 } }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.84, frequency: 1.1 }],
  },
  {
    locusId: 'amber',
    tier: 2,
    baseHex: '#D47619',
    superBaseHex: '#DE7914',
    primaryHex: '#4F2206',
    secondaryHex: '#FFCA63',
    headHex: '#E6902E',
    eyeIrisHex: '#FFA433',
    voiceHex: '#E67D17',
    voiceWeight1x: 0.78,
    voiceWeight2x: 0.9,
    dosage1x: 0.8,
    dosage2x: 0.88,
    bodyOpacity1x: 0.78,
    bodyOpacity2x: 0.74,
    motif: 'ripples',
    weight: 'blushed',
    modifier: 'speckled',
    coverageDelta2x: -0.14,
    blushDelta: 0.46,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'speckled_granite', operation: 'blend', strength: 0.8, frequency: 0.7 },
      { field: 'water_caustics', operation: 'modulate', strength: 0.36, frequency: 0.85 },
    ],
  },
  {
    locusId: 'coal',
    tier: 2,
    baseHex: '#3B383B',
    superBaseHex: '#121622',
    primaryHex: '#161517',
    superPrimaryHex: '#7DAEE8',
    secondaryHex: '#635F63',
    superSecondaryHex: '#DCF0FF',
    headHex: '#474447',
    superHeadHex: '#1B2236',
    voiceHex: '#282A30',
    voiceWeight1x: 0.64,
    voiceWeight2x: 0.88,
    dosage1x: 0.74,
    dosage2x: 0.92,
    motif: 'facets',
    weight: 'broad',
    modifier: 'banded',
    coverageDelta1x: 0.04,
    coverageDelta2x: -0.16,
    edgeSoftness: 0.022,
    scaleRelief: 0.22,
    // 1x Coal: matte dusty charcoal chunks -> 2x Anthracite: glossy mirror-black facets catching metallic blue-silver glints!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.92, frequency: 1.15 }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.84, frequency: 1.0 }],
  },
  {
    locusId: 'quartz',
    tier: 2,
    baseHex: '#E0BAC7',
    superBaseHex: '#F4FBFF',
    primaryHex: '#8C6274',
    superPrimaryHex: '#A6D2EB',
    secondaryHex: '#FCEAF0',
    superSecondaryHex: '#FFFFFF',
    headHex: '#E8C8D3',
    superHeadHex: '#FFFFFF',
    outlineHex: '#9B91AD',
    eyeIrisHex: '#C9BEE0',
    voiceHex: '#E0C4D4',
    voiceWeight1x: 0.64,
    voiceWeight2x: 0.88,
    dosage1x: 0.76,
    dosage2x: 0.92,
    bodyOpacity1x: 0.9,
    bodyOpacity2x: 0.56,
    motif: 'facets',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta1x: -0.1,
    coverageDelta2x: -0.2,
    edgeSoftness: 0.02,
    blushDelta: 0.36,
    scaleRelief: 0.14,
    // 1x Quartz: opaque rose/milky quartz veins -> 2x Clear Crystal: razor-sharp translucent water-clear crystal prisms!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.92, frequency: 1.3 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.84, frequency: 0.9, params: { marble: 1, sharpness: 2.2 } }],
  },
  {
    locusId: 'iron',
    tier: 2,
    baseHex: '#7A7470',
    superBaseHex: '#2C3442',
    primaryHex: '#8F482B',
    superPrimaryHex: '#C4D4E6',
    secondaryHex: '#B5ADA8',
    superSecondaryHex: '#EBF4FC',
    headHex: '#87807C',
    superHeadHex: '#3A4454',
    voiceHex: '#707985',
    voiceWeight1x: 0.62,
    voiceWeight2x: 0.88,
    dosage1x: 0.74,
    dosage2x: 0.9,
    motif: 'veins',
    weight: 'medium',
    modifier: 'banded',
    coverageDelta2x: -0.12,
    edgeSoftness: 0.024,
    scaleRelief: 0.18,
    // 1x Iron: raw oxidized rusty iron ore -> 2x Forged Iron: dimpled dark blacksmith wrought-iron with burnished steel edges!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.2, params: { hexColumns: 1 } }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.82, frequency: 1.1 }],
  },
  {
    locusId: 'copper',
    tier: 2,
    baseHex: '#D9723F',
    superBaseHex: '#28C4A8',
    primaryHex: '#632910',
    superPrimaryHex: '#0D5248',
    secondaryHex: '#FFAE7A',
    superSecondaryHex: '#96FFE8',
    headHex: '#E38452',
    superHeadHex: '#3DD9BD',
    voiceHex: '#D46E3B',
    voiceWeight1x: 0.68,
    voiceWeight2x: 0.9,
    intrinsicMottleA: '#24CCA8',
    intrinsicMottleB: '#B85B2E',
    intrinsicMottleStrength: 0.76,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.76,
    dosage2x: 0.9,
    motif: 'veins',
    weight: 'medium',
    modifier: 'patched',
    edgeSoftness: 0.03,
    scaleRelief: 0.18,
    // 1x Copper: gleaming burnished bronze-copper -> 2x Verdigris: oxidized Statue-of-Liberty turquoise patina swirls!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.9, frequency: 1.1 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.82, frequency: 1.15, params: { sharpness: 2.2 } }],
  },

  // --- Tier 3 Supers & Cross-Tier Stones / Alloys ---
  {
    locusId: 'obsidian',
    tier: 3,
    baseHex: '#1C1D24',
    superBaseHex: '#1A1129',
    primaryHex: '#464A5C',
    superPrimaryHex: '#C45CFF',
    secondaryHex: '#686E85',
    superSecondaryHex: '#F2C7FF',
    headHex: '#272933',
    superHeadHex: '#2C1B45',
    eyeIrisHex: '#BF80FF',
    voiceHex: '#56388A',
    voiceWeight1x: 0.7,
    voiceWeight2x: 0.92,
    intrinsicMottleA: '#1A112B',
    intrinsicMottleB: '#B34DFF',
    intrinsicMottleStrength: 0.72,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.8,
    dosage2x: 0.92,
    motif: 'facets',
    weight: 'broad',
    modifier: 'banded',
    coverageDelta1x: -0.14,
    coverageDelta2x: -0.1,
    edgeSoftness: 0.02,
    scaleRelief: 0.14,
    // 1x Obsidian: pure sleek pitch-black volcanic glass facets -> 2x Crying Obsidian: weeping electric neon-violet fissures!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'magma_fissures', operation: 'blend', strength: 0.92, frequency: 1.15 }]
        : [{ field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 0.85 }],
  },
  {
    locusId: 'steel',
    tier: 3,
    baseHex: '#AEB8C2',
    superBaseHex: '#6D7A8A',
    primaryHex: '#4E5863',
    superPrimaryHex: '#1B2028',
    secondaryHex: '#EFF5FA',
    superSecondaryHex: '#DCE8F5',
    headHex: '#BFC8D1',
    superHeadHex: '#8290A1',
    voiceHex: '#94A0AD',
    voiceWeight1x: 0.64,
    voiceWeight2x: 0.88,
    dosage1x: 0.76,
    dosage2x: 0.9,
    motif: 'veins',
    weight: 'thin',
    modifier: 'banded',
    edgeSoftness: 0.026,
    scaleRelief: 0.14,
    // 1x Steel: sleek brushed chrome -> 2x Damascus Steel: iconic tight wavy folded blade ripples!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.25, params: { damascus: 1 } }]
        : [{ field: 'banded_agate', operation: 'blend', strength: 0.82, frequency: 0.8, params: { strata: 1 } }],
  },
  {
    locusId: 'gold',
    tier: 3,
    baseHex: '#E8B225',
    superBaseHex: '#FFF0A8',
    primaryHex: '#3D2E10',
    superPrimaryHex: '#C98916',
    secondaryHex: '#FFE885',
    superSecondaryHex: '#FFFFFF',
    headHex: '#F0C038',
    superHeadHex: '#FFF6C9',
    eyeIrisHex: '#FFD447',
    voiceHex: '#F5C136',
    voiceWeight1x: 0.74,
    voiceWeight2x: 0.92,
    dosage1x: 0.78,
    dosage2x: 0.92,
    motif: 'veins',
    weight: 'medium',
    modifier: 'flamed',
    coverageDelta1x: -0.1,
    coverageDelta2x: -0.06,
    edgeSoftness: 0.024,
    blushDelta: 0.38,
    scaleRelief: 0.14,
    // 1x Gold: raw yellow bullion in dark quartz ore veins -> 2x Electrum: radiant pale champagne-gold geometric inlays!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'stepped_bismuth', operation: 'blend', strength: 0.9, frequency: 0.95 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.86, frequency: 1.0, params: { marble: 1, sharpness: 2.4 } }],
  },
  {
    locusId: 'malachite',
    tier: 3,
    baseHex: '#2B7D52',
    superBaseHex: '#14D47A',
    primaryHex: '#0F2E1E',
    superPrimaryHex: '#041C10',
    secondaryHex: '#63B888',
    superSecondaryHex: '#A8FFD6',
    headHex: '#358F60',
    superHeadHex: '#26E38A',
    eyeIrisHex: '#46DE98',
    voiceHex: '#1BB070',
    voiceWeight1x: 0.76,
    voiceWeight2x: 0.94,
    dosage1x: 0.78,
    dosage2x: 0.92,
    motif: 'strata',
    weight: 'broad',
    modifier: 'banded',
    coverageDelta1x: -0.04,
    coverageDelta2x: -0.06,
    edgeSoftness: 0.024,
    scaleRelief: 0.18,
    // 1x Malachite: raw velvety moss-green crystalline ore -> 2x Banded Malachite: vivid neon-emerald & jet-black bullseyes!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.5 }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.84, frequency: 1.15 }],
  },
  {
    locusId: 'granite',
    tier: 3,
    baseHex: '#B8B3AD',
    superBaseHex: '#7A2540',
    primaryHex: '#2A2829',
    superPrimaryHex: '#F7D4DA',
    secondaryHex: '#F0ECE8',
    superSecondaryHex: '#FFF0F3',
    headHex: '#C4BFBA',
    superHeadHex: '#8F324F',
    voiceHex: '#B8A8A0',
    voiceWeight1x: 0.62,
    voiceWeight2x: 0.88,
    dosage1x: 0.76,
    dosage2x: 0.9,
    motif: 'mosaic',
    weight: 'medium',
    modifier: 'speckled',
    coverageDelta1x: -0.08,
    coverageDelta2x: -0.18,
    edgeSoftness: 0.022,
    scaleRelief: 0.2,
    // 1x Granite: salt-and-pepper gray stone -> 2x Porphyry: Imperial Roman wine-crimson stone with pale crystal phenocrysts!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.25 }]
        : [{ field: 'speckled_granite', operation: 'blend', strength: 0.86, frequency: 1.0 }],
  },
  {
    locusId: 'marble',
    tier: 3,
    baseHex: '#DDD0BC',
    superBaseHex: '#FAF9F5',
    primaryHex: '#7D6A54',
    superPrimaryHex: '#2B2D33',
    secondaryHex: '#F5ECE0',
    superSecondaryHex: '#E8C268',
    headHex: '#E5DAC8',
    superHeadHex: '#FFFFFF',
    voiceHex: '#ECE6DC',
    voiceWeight1x: 0.68,
    voiceWeight2x: 0.9,
    dosage1x: 0.78,
    dosage2x: 0.94,
    motif: 'veins',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta1x: -0.08,
    coverageDelta2x: -0.28,
    edgeSoftness: 0.022,
    scaleRelief: 0.14,
    // 1x Marble: warm creamy-beige travertine bands -> 2x Carrara Marble: pure snow-white Italian marble with sharp dark veins!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'mineral_veins', operation: 'blend', strength: 0.92, frequency: 1.0, params: { marble: 1, sharpness: 3.4 } }]
        : [{ field: 'banded_agate', operation: 'blend', strength: 0.84, frequency: 0.9, params: { strata: 1 } }],
  },
  {
    locusId: 'petrifiedwood',
    tier: 3,
    baseHex: '#8C7E70',
    superBaseHex: '#C9442E',
    primaryHex: '#382F28',
    superPrimaryHex: '#3B1510',
    secondaryHex: '#D1C7BA',
    superSecondaryHex: '#F5C44E',
    headHex: '#9C8E7F',
    superHeadHex: '#D9563C',
    voiceHex: '#A87858',
    voiceWeight1x: 0.68,
    voiceWeight2x: 0.9,
    intrinsicMottleA: '#D43F2A',
    intrinsicMottleB: '#2EBFA8',
    intrinsicMottleStrength: 0.74,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.78,
    dosage2x: 0.9,
    motif: 'veins',
    weight: 'medium',
    modifier: 'banded',
    edgeSoftness: 0.028,
    scaleRelief: 0.2,
    // 1x Petrified Wood: stony ash-gray/driftwood fossil bark -> 2x Agate Wood: real Arizona rainbow-mineralized agate rings!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.25 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.86, frequency: 1.15, params: { woodgrain: 1 } }],
  },
  {
    locusId: 'agate',
    tier: 3,
    baseHex: '#7CA8DB',
    superBaseHex: '#361610',
    primaryHex: '#3A5885',
    superPrimaryHex: '#FF4F1A',
    secondaryHex: '#F5F9FF',
    superSecondaryHex: '#FFD233',
    headHex: '#94BCE8',
    superHeadHex: '#4A1E14',
    voiceHex: '#7EA8DB',
    voiceWeight1x: 0.72,
    voiceWeight2x: 0.92,
    intrinsicMottleA: '#FF4A17',
    intrinsicMottleB: '#FFD02E',
    intrinsicMottleStrength: 0.74,
    intrinsicMottleSuperOnly: true,
    dosage1x: 0.8,
    dosage2x: 0.92,
    motif: 'strata',
    weight: 'medium',
    modifier: 'banded',
    coverageDelta2x: -0.06,
    edgeSoftness: 0.024,
    scaleRelief: 0.16,
    // 1x Agate: cool sky-blue & white Blue Lace Agate -> 2x Fire Agate: dark botryoidal shell flashing molten crimson & gold fire!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'banded_agate', operation: 'blend', strength: 0.92, frequency: 1.55 }]
        : [{ field: 'banded_agate', operation: 'blend', strength: 0.86, frequency: 0.85, params: { strata: 1 } }],
  },

  // --- Tier 4 Cross-Tier + Supers + Recessive Gems ---
  {
    locusId: 'amethyst',
    tier: 4,
    baseHex: '#9252D1',
    superBaseHex: '#8944CF',
    primaryHex: '#3B1666',
    secondaryHex: '#E8C7FF',
    headHex: '#A96EE0',
    eyeIrisHex: '#CF8FFF',
    voiceHex: '#9146D9',
    voiceWeight1x: 0.86,
    voiceWeight2x: 0.92,
    dosage1x: 0.84,
    dosage2x: 0.9,
    bodyOpacity1x: 0.84,
    bodyOpacity2x: 0.84,
    motif: 'facets',
    weight: 'medium',
    modifier: 'flamed',
    coverageDelta2x: -0.08,
    edgeSoftness: 0.02,
    blushDelta: 0.36,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.1 },
    ],
  },
  {
    locusId: 'ruby',
    tier: 4,
    baseHex: '#CF2345',
    superBaseHex: '#C71A3C',
    primaryHex: '#590819',
    secondaryHex: '#FF99AE',
    headHex: '#E03F5F',
    eyeIrisHex: '#FF5478',
    voiceHex: '#D61E42',
    voiceWeight1x: 0.88,
    voiceWeight2x: 0.92,
    dosage1x: 0.84,
    dosage2x: 0.9,
    bodyOpacity1x: 0.84,
    bodyOpacity2x: 0.84,
    motif: 'facets',
    weight: 'medium',
    modifier: 'flamed',
    coverageDelta2x: -0.08,
    edgeSoftness: 0.02,
    blushDelta: 0.34,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.1 },
    ],
  },
  {
    locusId: 'lapis',
    tier: 4,
    baseHex: '#2B56B5',
    superBaseHex: '#10247A',
    primaryHex: '#D4E0F2',
    superPrimaryHex: '#FFD638',
    secondaryHex: '#A6C2ED',
    superSecondaryHex: '#FFF0A0',
    headHex: '#3B66C4',
    superHeadHex: '#1A349E',
    eyeIrisHex: '#6395FF',
    voiceHex: '#1C48BF',
    voiceWeight1x: 0.78,
    voiceWeight2x: 0.94,
    dosage1x: 0.8,
    dosage2x: 0.92,
    motif: 'facets',
    weight: 'broad',
    modifier: 'speckled',
    coverageDelta1x: -0.14,
    coverageDelta2x: -0.16,
    edgeSoftness: 0.022,
    blushDelta: 0.32,
    scaleRelief: 0.16,
    // 1x Lapis Lazuli: denim-cobalt with white calcite veins -> 2x Royal Lapis: deep midnight ultramarine studded with gleaming pyrite gold!
    buildContributions: (c): FieldContribution[] =>
      c === 2
        ? [{ field: 'speckled_granite', operation: 'blend', strength: 0.9, frequency: 1.1 }]
        : [{ field: 'mineral_veins', operation: 'blend', strength: 0.84, frequency: 0.95, params: { marble: 1, sharpness: 2.6 } }],
  },
  {
    locusId: 'emerald',
    tier: 4,
    baseHex: '#18A85E',
    superBaseHex: '#129E54',
    primaryHex: '#084224',
    secondaryHex: '#8CF7BE',
    headHex: '#2CC273',
    eyeIrisHex: '#4FF09C',
    voiceHex: '#15AD5E',
    voiceWeight1x: 0.88,
    voiceWeight2x: 0.92,
    dosage1x: 0.84,
    dosage2x: 0.9,
    bodyOpacity1x: 0.84,
    bodyOpacity2x: 0.84,
    motif: 'facets',
    weight: 'medium',
    modifier: 'flamed',
    coverageDelta2x: -0.08,
    edgeSoftness: 0.02,
    blushDelta: 0.36,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.1 },
    ],
  },
  {
    locusId: 'opal',
    tier: 4,
    baseHex: '#ECF0F5',
    superBaseHex: '#F2F6FA',
    primaryHex: '#8E9DB5',
    secondaryHex: '#FFFFFF',
    headHex: '#F5F8FC',
    eyeIrisHex: '#8CE8F5',
    voiceHex: '#D8ECF5',
    voiceWeight1x: 0.82,
    voiceWeight2x: 0.88,
    intrinsicMottleA: '#5AEAF0',
    intrinsicMottleB: '#FA94CB',
    intrinsicMottleStrength: 0.74,
    dosage1x: 0.82,
    dosage2x: 0.88,
    bodyOpacity1x: 0.82,
    bodyOpacity2x: 0.82,
    motif: 'facets',
    weight: 'blushed',
    modifier: 'faded',
    coverageDelta2x: -0.16,
    edgeSoftness: 0.032,
    blushDelta: 0.45,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.84, frequency: 0.95 },
    ],
  },

  // --- Tier 5 Apex Recessive Mastery ---
  {
    locusId: 'diamond',
    tier: 5,
    baseHex: '#E8F6FC',
    superBaseHex: '#EFFAFF',
    primaryHex: '#7DA8C2',
    secondaryHex: '#FFFFFF',
    headHex: '#F5FCFF',
    outlineHex: '#8CB8D1',
    eyeIrisHex: '#B8EEFF',
    voiceHex: '#D6F0FC',
    voiceWeight1x: 0.86,
    voiceWeight2x: 0.92,
    intrinsicMottleA: '#B8F2FF',
    intrinsicMottleB: '#F2D4FF',
    intrinsicMottleStrength: 0.56,
    dosage1x: 0.84,
    dosage2x: 0.9,
    bodyOpacity1x: 0.64,
    bodyOpacity2x: 0.64,
    motif: 'facets',
    weight: 'thin',
    modifier: 'faded',
    coverageDelta2x: -0.18,
    edgeSoftness: 0.018,
    blushDelta: 0.48,
    scaleRelief: 0.1,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.92, frequency: 1.2 },
    ],
  },
  {
    locusId: 'sapphire',
    tier: 5,
    baseHex: '#1C4DC4',
    superBaseHex: '#1544B8',
    primaryHex: '#081A4F',
    secondaryHex: '#94CAFF',
    headHex: '#2E63DB',
    eyeIrisHex: '#63B3FF',
    voiceHex: '#184AC9',
    voiceWeight1x: 0.88,
    voiceWeight2x: 0.92,
    dosage1x: 0.84,
    dosage2x: 0.9,
    bodyOpacity1x: 0.84,
    bodyOpacity2x: 0.84,
    motif: 'facets',
    weight: 'medium',
    modifier: 'flamed',
    coverageDelta2x: -0.08,
    edgeSoftness: 0.02,
    blushDelta: 0.36,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'crystal_facets', operation: 'blend', strength: 0.9, frequency: 1.1 },
    ],
  },
  {
    locusId: 'bismuth',
    tier: 5,
    baseHex: '#687996',
    superBaseHex: '#627391',
    primaryHex: '#202533',
    secondaryHex: '#F0D078',
    headHex: '#7D90B0',
    eyeIrisHex: '#6EF2D6',
    voiceHex: '#5AC4C9',
    voiceWeight1x: 0.86,
    voiceWeight2x: 0.92,
    intrinsicMottleA: '#24E8CE',
    intrinsicMottleB: '#E84DBB',
    intrinsicMottleStrength: 0.82,
    dosage1x: 0.84,
    dosage2x: 0.9,
    motif: 'bismuth',
    weight: 'broad',
    modifier: 'banded',
    edgeSoftness: 0.02,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'stepped_bismuth', operation: 'blend', strength: 0.92, frequency: 1.05 },
    ],
  },
  {
    locusId: 'jade',
    tier: 5,
    baseHex: '#46B080',
    superBaseHex: '#3BA675',
    primaryHex: '#164A32',
    secondaryHex: '#D0F7E0',
    headHex: '#5AC494',
    eyeIrisHex: '#70E0AA',
    voiceHex: '#40B07C',
    voiceWeight1x: 0.84,
    voiceWeight2x: 0.9,
    dosage1x: 0.82,
    dosage2x: 0.88,
    bodyOpacity1x: 0.86,
    bodyOpacity2x: 0.86,
    motif: 'veins',
    weight: 'blushed',
    modifier: 'faded',
    coverageDelta2x: -0.18,
    edgeSoftness: 0.028,
    blushDelta: 0.4,
    scaleRelief: 0.14,
    buildContributions: (): FieldContribution[] => [
      { field: 'mineral_veins', operation: 'blend', strength: 0.88, frequency: 0.9, params: { marble: 1, sharpness: 2.4 } },
    ],
  },
];

export const ELEMENTAL_PROFILE_BY_LOCUS = new Map<LocusId, ElementalVisualProfile>(
  ELEMENTAL_VISUAL_PROFILES.map((p) => [p.locusId, p])
);

export function formatSynthesisRecipeLabel(
  recipe: ElementalSynthesisRecipe,
  locusNames: Record<LocusId, { name: string; superName?: string }>
): string {
  const defA = locusNames[recipe.ingredientA];
  const defB = locusNames[recipe.ingredientB];
  const defR = locusNames[recipe.result];
  const labelA = recipe.minParentAllelesA === 2 ? `2× ${defA.superName ?? defA.name}` : defA.name;
  const labelB = recipe.minParentAllelesB === 2 ? `2× ${defB.superName ?? defB.name}` : defB.name;
  return `${labelA} + ${labelB} → ${defR.name}`;
}
