import type {
  FieldContribution,
  FieldOperation,
  SkinDebugStage,
  SkinFieldParams,
  SkinFieldPrimitiveId,
  SkinPhenotypeSpec,
  SnakePalette,
} from './types';

export const SKIN_GENERATOR_VERSION = 1;

/**
 * Common interface for all procedural, analytical, and authored grayscale/SDF skin fields.
 * Coordinates: u in [0, 1] (snout -> tail), v in [-1, 1] (left flank -> dorsal 0 -> right flank).
 * Returns a scalar value nominally in [0, 1].
 */
export interface SkinField {
  sample(u: number, v: number, seed: number, params?: Record<string, number>): number;
}

export interface EvaluatedSkinSample {
  /** Combined continuous scalar field F(u, v) in [0, 1] */
  rawField: number;
  /** Thresholded primary dark/pattern mask M(u, v) in [0, 1] */
  primaryMask: number;
  /** Secondary interior blush / flank-flame mask in [0, 1] */
  secondaryMask: number;
  /** Third pigment region mask (e.g. tricolor Milk Band crimson or granite paver tone) in [0, 1] */
  accentMask: number;
  /** Regional pigment suppression mask (Calico high-white flanks + Piebald patches) in [0, 1] */
  suppressionMask: number;
  /** Independent diamond scale relief height in [0, 1] */
  scaleHeight: number;
  /** Independent scale directional shading factor in [-1, 1] */
  scaleShade: number;
}

// --- Deterministic Fast Math & Multiscale Noise (GLSL-portable, zero DOM deps) ---

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-6) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / denom, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Smooth polynomial maximum (organic union of two fields) */
export function smin(a: number, b: number, k = 0.12): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / Math.max(1e-4, k), 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}

export function smax(a: number, b: number, k = 0.12): number {
  return -smin(-a, -b, k);
}

function hash2D(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function hash2DB(ix: number, iy: number, seed: number): number {
  const s = Math.sin(ix * 269.5 + iy * 183.3 + seed * 113.1) * 28461.1923;
  return s - Math.floor(s);
}

/** Deterministic 2D value noise in [0, 1] */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);

  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/** 3-octave deterministic fBm in [0, 1] */
export function fbm2D(x: number, y: number, seed: number, octaves = 3): number {
  let value = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    value += amp * valueNoise2D(x * freq, y * freq, seed + o * 17.3);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return value / norm;
}

// --- Authored Grayscale / SDF Map Registry (supports arbitrary custom maps in the same interface) ---

interface RegisteredGrayscaleMap {
  width: number;
  height: number;
  data: Float32Array;
}

const authoredMaps = new Map<string, RegisteredGrayscaleMap>();

export function registerGrayscaleMapField(
  id: string,
  width: number,
  height: number,
  data: Float32Array
): void {
  authoredMaps.set(id, { width, height, data });
}

export function unregisterGrayscaleMapField(id: string): void {
  authoredMaps.delete(id);
}

function sampleGrayscaleMap(id: string | undefined, u: number, v: number): number {
  if (!id) return 0.5;
  const map = authoredMaps.get(id);
  if (!map || map.width < 1 || map.height < 1) return 0.5;
  const fx = clamp(u, 0, 1) * (map.width - 1);
  const fy = clamp(v * 0.5 + 0.5, 0, 1) * (map.height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(map.width - 1, x0 + 1);
  const y1 = Math.min(map.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const s00 = map.data[y0 * map.width + x0] ?? 0.5;
  const s10 = map.data[y0 * map.width + x1] ?? 0.5;
  const s01 = map.data[y1 * map.width + x0] ?? 0.5;
  const s11 = map.data[y1 * map.width + x1] ?? 0.5;
  return lerp(lerp(s00, s10, tx), lerp(s01, s11, tx), ty);
}

// --- Core Ball Python Bilateral Voronoi-Edge Skeleton Field ---

interface VoronoiSkeletonSample {
  /** Scalar network field: ~1 on dark connected ridges, ~0 inside light flank alien-head cells */
  networkValue: number;
  /** Subtractive eye-dot lift inside each flank cell (0 outside eyes, ~1 inside eyes) */
  eyeValue: number;
  /** Cell interior radial factor (1 at cell center, 0 on dark border) for blushing */
  cellInterior: number;
}

/**
 * Evaluates a structured bilateral Voronoi/cellular skeleton in (u, v) space:
 * - Places jittered flank alien-head cell centers along left (v ~ -0.60) and right (v ~ +0.60) flanks.
 * - `d_edge = F2 - F1` forms the connected dark dorsal & lateral bridge network.
 * - Adjusting `coverage` erodes/dilates this single continuous field across:
 *   GHI/Black Pastel -> Classic Normal -> Mojave -> Enchi -> Spider -> Pinstripe!
 */
function sampleBilateralVoronoiSkeleton(
  u: number,
  v: number,
  seed: number,
  frequency: number,
  aspectRatio: number,
  symmetry: number,
  eyeCount: number,
  eyeStrength: number,
  widthContrast = 0,
  baseTaper = 0,
  crownNotch = 0,
  localWidthVariation = 0,
  regionalCoherence = 0
): VoronoiSkeletonSample {
  // Longitudinal cell grid scale (around 10..12 alien heads along a classic ball python body)
  const uScale = Math.max(3.5, 11.2 * frequency / Math.max(0.5, Math.sqrt(aspectRatio)));
  const ux = u * uScale;
  const vScale = Math.max(0.55, Math.sqrt(aspectRatio));

  // Organic lateral spine meander so the dark dorsal bridge weaves naturally rather than running ruler-straight
  const spineWeave = (fbm2D(u * 5.8, 0.5, seed + 4.2, 2) - 0.5) * 0.26 * (1 - symmetry * 0.72);
  const vy = (v + spineWeave) * vScale;

  // Bilateral flank centers sit at +/- 0.60 * vScale
  const flankY = 0.6 * vScale;
  const baseCell = Math.floor(ux);

  const hasWidthMod = widthContrast > 0.0001 || localWidthVariation > 0.0001;
  const dcRadius = hasWidthMod ? 2 : 1;

  let d1 = 1e9;
  let d2 = 1e9;
  let nearestDu = 0;
  let nearestDv = 0;
  let nearestSide = 1;
  let nearestId = 0;
  let nearestCellWidth = 1;

  // Check nearby longitudinal cells on both flanks (wider neighborhood when width modulation is active)
  for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
    const side = sideIdx === 0 ? -1 : 1;
    // Symmetry 0 = classic alternating/staggered flanks; symmetry 1 = aligned flanks
    const sidePhase = side > 0 ? (1 - symmetry) * 0.48 : 0;

    for (let dc = -dcRadius; dc <= dcRadius; dc++) {
      const ci = baseCell + dc;
      // Use mirrored jitter when symmetry approaches 1
      const jitterKeyY = symmetry > 0.7 ? 1 : sideIdx + 1;
      const jx = (hash2D(ci, jitterKeyY, seed) - 0.5) * 0.44 * (1 - symmetry * 0.45);
      const jy = (hash2DB(ci, jitterKeyY, seed) - 0.5) * 0.24;
      // Slight per-cell organic size variance so neighboring alien heads are never identical clones
      const sizeScale = 0.88 + hash2D(ci + 19, jitterKeyY + 7, seed) * 0.26;

      let cellWidth = 1;
      if (hasWidthMod) {
        // Alternating width contrast: even/odd cells shift shared boundaries without overlap
        const parity = (ci & 1) === 0 ? 1 : -1;
        const altTerm = parity * widthContrast * 0.28;

        // Deterministic per-cell width draw with occasional substantially wider heads
        let seededTerm = 0;
        if (localWidthVariation > 0.0001) {
          const r1 = hash2D(ci + 37, jitterKeyY + 13, seed);
          const r2 = hash2DB(ci + 53, jitterKeyY + 29, seed);
          const baseLocal = (r1 - 0.5) * 0.56;
          const wideBurst = smoothstep(0.68, 0.96, r2) * 0.48;
          const localRaw = baseLocal + wideBurst - 0.07;

          if (regionalCoherence > 0.0001) {
            const regionalRaw =
              (fbm2D(ci * 0.24 + 4.1, jitterKeyY * 1.9, seed + 67.3, 2) - 0.5) * 0.88;
            seededTerm =
              localWidthVariation *
              lerp(localRaw, localRaw * 0.45 + regionalRaw * 0.85, regionalCoherence);
          } else {
            seededTerm = localWidthVariation * localRaw;
          }
        }

        cellWidth = clamp(Math.exp(altTerm + seededTerm), 0.72, 1.72);
      }

      const cx = ci + 0.5 + sidePhase + jx;
      const cy = side * (flankY + jy * vScale);

      const du = ux - cx;
      const dv = (vy - cy) * 1.12;
      const dist = Math.hypot(hasWidthMod ? du / cellWidth : du, dv) * sizeScale;

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        nearestDu = du;
        nearestDv = vy - cy;
        nearestSide = side;
        nearestId = ci * 3 + sideIdx;
        nearestCellWidth = cellWidth;
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  // Distance to Voronoi ridge separating adjacent alien heads (including across the spine)
  const edgeDist = Math.max(0, d2 - d1);

  // Softly bias dorsal spine slightly stronger than lower belly border so alien heads open toward flanks
  const dorsalAnchor = Math.exp(-Math.pow((v + spineWeave) / 0.42, 2)) * 0.14;
  // Open the very lower flank edge slightly so alien heads breathe toward the belly
  const bellyOpenBase = smoothstep(0.75, 1.0, Math.abs(v)) * 0.18;
  const bellyOpen = baseTaper > 0.0001 ? bellyOpenBase * (1 - baseTaper * 0.85) : bellyOpenBase;

  // Base Taper: widen dark ridges progressively toward outer flank edges while keeping dorsal crowns broad
  let ridgeSpan = 0.56;
  if (baseTaper > 0.0001) {
    const absV = Math.abs(v + spineWeave * 0.5);
    const taperProfile = smoothstep(0.36, 0.96, absV);
    ridgeSpan = 0.56 * (1 + baseTaper * taperProfile * 1.05);
  }

  // Core network scalar field in [0, 1]: 1 on dark ridges, 0 in deep alien-head centers
  let networkValue = clamp(1 - edgeDist / ridgeSpan + dorsalAnchor - bellyOpen, 0, 1);

  // Crown Notch: indent dorsal-facing edge of broader crowns & round shoulders on either side
  if (crownNotch > 0.0001) {
    const dorsalDir = (-nearestSide * nearestDv) / vScale;
    if (dorsalDir > 0.0) {
      const notchRoll = hash2D(nearestId, 41, seed);
      const breadthGate = smoothstep(0.84, 1.16, nearestCellWidth);
      const cellNotchSelect = smoothstep(0.28, 0.68, notchRoll);
      const cellNotchStrength =
        crownNotch * clamp(breadthGate * (0.35 + 0.85 * cellNotchSelect), 0, 1.2);

      if (cellNotchStrength > 0.001) {
        const normU = nearestDu / Math.max(0.7, nearestCellWidth);
        // Deep localized V/U cleft at top center of dorsal crown
        const indentU = Math.exp(-Math.pow(normU / 0.14, 2));
        const indentV =
          smoothstep(0.02, 0.26, dorsalDir) * (1 - smoothstep(0.54, 0.78, dorsalDir));
        const notchIndent = indentU * indentV * 0.72;

        // Two rounded light shoulders flanking the cleft to form a heart silhouette
        const shoulderU = Math.exp(-Math.pow((Math.abs(normU) - 0.25) / 0.15, 2));
        const shoulderV =
          smoothstep(0.01, 0.22, dorsalDir) * (1 - smoothstep(0.46, 0.7, dorsalDir));
        const shoulderRound = shoulderU * shoulderV * 0.28;

        networkValue = clamp(networkValue + cellNotchStrength * (notchIndent - shoulderRound), 0, 1);
      }
    }
  }

  const cellInterior = clamp(edgeDist / 0.48, 0, 1);

  // Subtractive interior eye SDFs (0 = Enchi/Spider/Pinstripe, 1 = Mojave/Black Pastel, 2 = Classic Normal)
  let eyeValue = 0;
  if (eyeCount >= 0.4 && eyeStrength > 0.01 && u > 0.12 && u < 0.86) {
    // Shift eyes slightly dorsal-ward inside each alien head cutout with gentle organic per-cell jitter
    const eyeJitterU = (hash2D(nearestId, 13, seed) - 0.5) * 0.07;
    const eyeJitterV = (hash2DB(nearestId, 17, seed) - 0.5) * 0.06;
    const eyeV = nearestDv + nearestSide * 0.06 * vScale + eyeJitterV;
    const dotRadius = 0.122 * (0.72 + eyeStrength * 0.42);

    if (eyeCount >= 1.5) {
      // Classic Ball Python twin dark eye dots (occasionally 1 dot on ~26% of heads for natural variety)
      const hasTwin = hash2D(nearestId, 9, seed) > 0.26;
      if (hasTwin) {
        const sep = 0.155 + (hash2D(nearestId, 23, seed) - 0.5) * 0.04;
        const dLeft = Math.hypot((nearestDu + sep + eyeJitterU) * 1.06, (eyeV - 0.015) * 1.28);
        const dRight = Math.hypot((nearestDu - sep + eyeJitterU) * 1.06, (eyeV + 0.015) * 1.28);
        const dEye = Math.min(dLeft, dRight);
        eyeValue = (1 - smoothstep(dotRadius * 0.62, dotRadius * 1.15, dEye)) * eyeStrength;
      } else {
        const dSingle = Math.hypot((nearestDu + eyeJitterU) * 0.88, eyeV * 1.22);
        eyeValue = (1 - smoothstep(dotRadius * 0.7, dotRadius * 1.24, dSingle)) * eyeStrength;
      }
    } else {
      // Single centered keyhole eye (Mojave / Lesser / Black Pastel)
      const dSingle = Math.hypot((nearestDu + eyeJitterU) * 0.9, eyeV * 1.18);
      const rKey = dotRadius * 1.18;
      eyeValue = (1 - smoothstep(rKey * 0.64, rKey * 1.18, dSingle)) * eyeStrength;
    }
  }

  return { networkValue, eyeValue, cellInterior };
}

// --- Library of Pluggable Composable SkinField Primitives ---

export const SKIN_FIELD_PRIMITIVES: Record<SkinFieldPrimitiveId, SkinField> = {
  voronoi_network: {
    sample(u, v, seed, p) {
      const res = sampleBilateralVoronoiSkeleton(
        u,
        v,
        seed,
        p?.frequency ?? 1,
        p?.aspectRatio ?? 1,
        p?.symmetry ?? 0.2,
        p?.eyeCount ?? 2,
        p?.eyeStrength ?? 0.85,
        p?.widthContrast ?? 0,
        p?.baseTaper ?? 0,
        p?.crownNotch ?? 0,
        p?.localWidthVariation ?? 0,
        p?.regionalCoherence ?? 0
      );
      return clamp(Math.max(res.networkValue, res.eyeValue * 0.88), 0, 1);
    },
  },

  longitudinal_waves: {
    sample(u, v, seed, p) {
      // Twin dorsal tracks + optional stuttering dashes (Pinstripe / Cypress / Trackline)
      const trackOffset = p?.trackOffset ?? 0.28;
      const trackWidth = p?.trackWidth ?? 0.13;
      const dotted = p?.dotted ?? 0;
      const dashFreq = (p?.frequency ?? 1) * 14;
      const absV = Math.abs(v);
      const railDist = Math.abs(absV - trackOffset);
      let val = 1 - smoothstep(trackWidth * 0.45, trackWidth * 1.25, railDist);
      if (dotted > 0.25) {
        // Signature "-o-o-o-" dashed dorsal bead rhythm
        const wave = Math.cos(u * Math.PI * 2 * dashFreq + seed * 9);
        const bead = 1 - smoothstep(0.14, 0.28, absV);
        const dotPulse = smoothstep(0.25, 0.7, wave);
        val = Math.max(val * (0.45 + 0.55 * (1 - dotPulse)), bead * dotPulse * dotted);
      }
      return clamp(val, 0, 1);
    },
  },

  transverse_waves: {
    sample(u, _v, seed, p) {
      // Repeating transverse bands along body length (Milk Band / Crossbar)
      const freq = (p?.frequency ?? 1) * 11.5;
      const phase = (p?.phase ?? 0) + seed * Math.PI * 2;
      return 0.5 + 0.5 * Math.cos(2 * Math.PI * freq * u + phase);
    },
  },

  angled_waves: {
    sample(u, v, seed, p) {
      // Marching arrowhead chevrons along spine (Chevron custom gene)
      const freq = (p?.frequency ?? 1) * 10.5;
      const slant = p?.slant ?? 0.085;
      const phase = (p?.phase ?? 0) + seed * Math.PI * 2;
      const arg = 2 * Math.PI * freq * (u - slant * Math.abs(v)) + phase;
      return 0.5 + 0.5 * Math.cos(arg);
    },
  },

  radial_rings: {
    sample(u, v, seed, p) {
      // Concentric double-window dorsal rings / saddles (Bullring / Saddler)
      const freq = (p?.frequency ?? 1) * 10.5;
      const style = p?.style ?? 0; // 0 = bullring double windows, 1 = saddler twin-dot oval
      const cellU = ((u * freq + seed * 3) % 1 + 1) % 1 - 0.5;
      const outer = Math.hypot(cellU * 1.65, v * 0.92);
      const outerMask = 1 - smoothstep(0.62, 0.78, outer);
      if (style >= 0.5) {
        // Saddler: dark oval with twin light windows & tiny center dots
        const dWin = Math.min(Math.hypot(cellU * 2.1, (v - 0.4) * 2.2), Math.hypot(cellU * 2.1, (v + 0.4) * 2.2));
        const winCut = 1 - smoothstep(0.32, 0.46, dWin);
        const dot = 1 - smoothstep(0.11, 0.2, dWin);
        return clamp(outerMask * (1 - winCut * 0.85) + dot * 0.85, 0, 1);
      }
      // Bullring: bold dark ellipse hollowed by twin bright windows
      const dWin = Math.min(Math.hypot(cellU * 2.1, (v - 0.34) * 1.9), Math.hypot(cellU * 2.1, (v + 0.34) * 1.9));
      const winCut = 1 - smoothstep(0.36, 0.52, dWin);
      return clamp(outerMask * (1 - winCut * 0.92), 0, 1);
    },
  },

  radial_teardrops: {
    sample(u, v, seed, p) {
      // Fine dorsal line + alternating lateral teardrop beads (Raindrop)
      const freq = (p?.frequency ?? 1) * 11;
      const spineLine = 1 - smoothstep(0.08, 0.16, Math.abs(v));
      const idx = Math.floor(u * freq);
      const localU = u * freq - idx - 0.5;
      const side = idx % 2 === 0 ? 1 : -1;
      const dDrop = Math.hypot(localU * 1.5, (v - side * 0.44) * 1.9 + seed * 0.001);
      const drop = 1 - smoothstep(0.32, 0.52, dDrop);
      return clamp(Math.max(spineLine * 0.9, drop), 0, 1);
    },
  },

  cellular_pavers: {
    sample(u, v, seed, p) {
      // Interlocking running-bond granite/slate cobblestone pavers with dark mortar grooves
      const uFreq = (p?.frequency ?? 1) * 16;
      const vCourses = 3.0;
      const row = Math.floor((v * 0.5 + 0.5) * vCourses);
      const stagger = (row % 2) * 0.5;
      const gu = u * uFreq + stagger;
      const gv = (v * 0.5 + 0.5) * vCourses;
      const fu = gu - Math.floor(gu);
      const fv = gv - Math.floor(gv);
      // Slight rounded paver corner distance to cell edge
      const du = Math.min(fu, 1 - fu);
      const dv = Math.min(fv, 1 - fv);
      const cornerEdge = Math.min(du, dv) + (hash2D(Math.floor(gu), row, seed) - 0.5) * 0.03;
      // High value (1.0) in dark mortar groove, low value (0.0) on stone face
      return 1 - smoothstep(0.07, 0.15, cornerEdge);
    },
  },

  magma_fissures: {
    sample(u, v, seed, p) {
      // Sharp glowing volcanic cracks via ridged fBm (Lava)
      const freq = (p?.frequency ?? 1) * 9;
      const n1 = fbm2D(u * freq, v * 2.6, seed + 3.1, 3);
      const ridge1 = 1 - Math.abs(n1 * 2 - 1);
      const n2 = fbm2D(u * freq * 1.7 + 4.2, v * 3.8, seed + 19.7, 2);
      const ridge2 = 1 - Math.abs(n2 * 2 - 1);
      const crack = Math.max(Math.pow(ridge1, 3.2), Math.pow(ridge2, 4.0) * 0.82);
      return clamp(crack, 0, 1);
    },
  },

  water_caustics: {
    sample(u, v, seed, p) {
      // Shimmering aqua caustic interference ribbons (Water)
      const freq = (p?.frequency ?? 1) * 10;
      const w1 = Math.sin(u * freq * 2.1 + Math.sin(v * 3.4 + seed * 5) * 1.4);
      const w2 = Math.cos(u * freq * 1.4 - v * 4.2 + seed * 9);
      const caustic = 1 - Math.abs(w1 * 0.55 + w2 * 0.45);
      return clamp(Math.pow(caustic, 1.8), 0, 1);
    },
  },

  shattered_mosaic: {
    sample(u, v, seed, p) {
      // 90-degree-rotated organic cellular & labyrinth mosaic field (Monsoon / Leopard)
      const freq = (p?.frequency ?? 1.0) * 6.5;
      const mode = p?.mode ?? 0; // 0 = shattered jigsaw/confetti blotches (Monsoon), 1 = bold dark rosettes (Leopard)
      // Swap axes (90-degree turn) + smooth shear along body u to break vertical alien-head columns
      const shear = (fbm2D(u * freq * 0.55, v * 2.2, seed + 13.4, 2) - 0.5) * 0.72;
      const gx = (v * 1.75 + shear) * (freq * 0.24);
      const gy = u * freq * 1.45;

      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      let d1 = 1e9;
      let d2 = 1e9;
      let cellHash = 0.5;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx + 0.16 + hash2D(ix + dx, iy + dy, seed + 5.7) * 0.68;
          const cy = iy + dy + 0.16 + hash2DB(ix + dx, iy + dy, seed + 11.3) * 0.68;
          const dist = Math.hypot((gx - cx) * 1.08, (gy - cy) * 0.94);
          if (dist < d1) {
            d2 = d1;
            d1 = dist;
            cellHash = hash2D(ix + dx + 19, iy + dy + 31, seed + 2.3);
          } else if (dist < d2) {
            d2 = dist;
          }
        }
      }

      if (mode >= 0.5) {
        // Leopard: bold dark irregular rosette blotches that shatter classic alien heads cleanly
        const sizeBias = 0.24 + cellHash * 0.18;
        const spot = 1 - smoothstep(sizeBias, sizeBias + 0.24, d1);
        return clamp(spot * 0.94, 0, 1);
      }

      // Monsoon: organic shattered jigsaw/pebble spots of varied sizes + thin broken bright-edged dorsal thread
      const pebbleSize = 0.18 + cellHash * 0.22;
      const fleck = 1 - smoothstep(pebbleSize, pebbleSize + 0.22, d1);
      const mazeChannel = smoothstep(0.05, 0.22, d2 - d1);
      const dorsalThread =
        (1 - smoothstep(0.035, 0.11, Math.abs(v))) *
        smoothstep(0.32, 0.64, fbm2D(u * 14, 1.3, seed + 31.2, 2));
      return clamp(Math.max(fleck * (0.5 + 0.5 * mazeChannel), dorsalThread * 0.8), 0, 1);
    },
  },

  stripe_tracks: {
    sample(u, v, seed, p) {
      // Dedicated linear dorsal/lateral stripe topologies:
      // style 0 = Genetic Stripe (clean bright dorsal stripe framed by dark margins, smooth flanks)
      // style 1 = Tri-Stripe (bold dark central dorsal stripe + two continuous undulating lateral stripes)
      const style = p?.style ?? 0;
      const wobble = (fbm2D(u * 6.0, 0.7, seed + 8.9, 2) - 0.5) * 0.085;
      const absV = Math.abs(v + wobble);

      if (style >= 0.5) {
        // Tri-Stripe: bold continuous dark central stripe + two organic undulating lateral stripes
        const sideSign = v >= 0 ? 1 : -1;
        const sideWobble = (fbm2D(u * 8.5, sideSign * 2.3, seed + 19.1, 2) - 0.5) * 0.09;
        const centerThickness = 0.16 + (fbm2D(u * 7.2, 0.3, seed + 3.7, 2) - 0.5) * 0.05;
        const centerDark = 1 - smoothstep(centerThickness * 0.72, centerThickness * 1.25, absV);
        const lateralDist = Math.abs(Math.abs(v + sideWobble) - 0.62);
        const lateralWidth = 0.11 + (fbm2D(u * 9.5, sideSign * 4.1, seed + 27.4, 2) - 0.5) * 0.05;
        const lateralStripe = 1 - smoothstep(lateralWidth * 0.62, lateralWidth * 1.35, lateralDist);
        return clamp(Math.max(centerDark * 0.96, lateralStripe * 0.92), 0, 1);
      }

      // Genetic Stripe: clean bright golden dorsal center + dark flanking rails + calm patternless outer sides
      const flankRail = 1 - smoothstep(0.08, 0.2, Math.abs(absV - 0.34));
      const outerShade = smoothstep(0.45, 0.92, absV) * 0.34;
      const centerClear = 1 - smoothstep(0.1, 0.22, absV);
      return clamp(Math.max(flankRail * 0.92, outerShade) * (1 - centerClear * 0.92), 0, 1);
    },
  },

  custom_map: {
    sample(u, v, _seed, p) {
      const id = p && typeof p.mapHash === 'number' ? String(p.mapHash) : undefined;
      return sampleGrayscaleMap(id, u, v);
    },
  },
};

// --- Composable Field Operators ---

export function combineFieldValues(
  base: number,
  secondary: number,
  operation: FieldOperation,
  strength: number
): number {
  const s = clamp(strength, 0, 1.5);
  switch (operation) {
    case 'blend':
      return clamp(lerp(base, secondary, clamp(s, 0, 1)), 0, 1);
    case 'union':
      return clamp(Math.max(base, secondary * s), 0, 1);
    case 'smoothUnion':
      return clamp(smax(base, lerp(base, secondary, clamp(s, 0, 1)), 0.16), 0, 1);
    case 'intersection':
      return clamp(lerp(base, smin(base, secondary, 0.12), clamp(s, 0, 1)), 0, 1);
    case 'subtract':
      return clamp(base - secondary * s * 0.75, 0, 1);
    case 'modulate':
      // One pattern rhythmically dilates and erodes the thickness/coverage of the other!
      return clamp(base + (secondary - 0.5) * s * 0.68, 0, 1);
    case 'warp':
      // Handled during coordinate transformation stage; gentle fallback if called directly
      return clamp(base + (secondary - 0.5) * s * 0.2, 0, 1);
  }
}

// --- Stage 6: Logically Separate Diamond/Hexagonal Ball Python Scale Relief ---

export function sampleScaleRelief(u: number, v: number): { height: number; shade: number } {
  // Overlapping ball python dorsal scales (~44 rows along body, ~7.5 across width)
  const su = u * 44;
  const sv = (v * 0.5 + 0.5) * 7.5;
  const row = Math.floor(sv);
  const offset = (row % 2) * 0.5;
  const fu = su + offset - Math.floor(su + offset) - 0.5;
  const fv = sv - row - 0.5;

  // Rounded diamond-oval scale dome
  const d = Math.hypot(fu * 1.38, fv * 1.52);
  const height = clamp(1 - smoothstep(0.28, 0.74, d), 0, 1);
  // Subtle directional top-left sheen highlight across each scale dome
  const shade = clamp((-fu * 0.65 - fv * 0.55) * height * 1.4, -1, 1);
  return { height, shade };
}

// --- 7-Stage Deterministic Evaluator ---

export function createDefaultSkinFieldParams(): SkinFieldParams {
  return {
    coverage: 0.54,
    frequency: 1.0,
    aspectRatio: 1.0,
    warpStrength: 0.24,
    dorsalBias: 0.0,
    symmetry: 0.18,
    widthContrast: 0.34,
    baseTaper: 0.66,
    crownNotch: 0.58,
    localWidthVariation: 0.56,
    regionalCoherence: 0.42,
    eyeCount: 2,
    eyeStrength: 0.85,
    edgeSoftness: 0.065,
    blush: 0.2,
    flankFlame: 0.16,
    calicoRise: 0,
    piebaldAmount: 0,
    speckleAmount: 0,
    accentBandStrength: 0,
    scaleRelief: 0.42,
  };
}

/**
 * Evaluates all stages (3: Coordinate Transform, 4: Composable Field Evaluation,
 * 5: Pigment Region & Suppression Resolution, 6: Independent Scale Relief)
 * deterministically for a single (u, v) coordinate on the snake's skin.
 */
export function evaluateSkinPoint(
  u: number,
  v: number,
  spec: SkinPhenotypeSpec,
  seed: number
): EvaluatedSkinSample {
  const { params, contributions, customMapId } = spec;

  // Stage 3: Transform coordinates (multiscale domain warping + warp contributions)
  const warpAmp = params.warpStrength;
  let wu = u;
  let wv = v;
  if (warpAmp > 0.001) {
    // Low-frequency macro deformation + high-frequency organic edge irregularity
    const lowU = fbm2D(u * 5.5, v * 2.0, seed + 1.1, 2) - 0.5;
    const lowV = fbm2D(u * 5.5 + 13.7, v * 2.0, seed + 5.3, 2) - 0.5;
    const hiU = valueNoise2D(u * 26.0, v * 8.5, seed + 9.7) - 0.5;
    const hiV = valueNoise2D(u * 26.0 + 7.1, v * 8.5, seed + 14.3) - 0.5;
    wu += (lowU * 0.052 + hiU * 0.018) * warpAmp;
    wv += (lowV * 0.32 + hiV * 0.11) * warpAmp;
  }

  // Apply explicit 'warp' field contributions in coordinate space BEFORE evaluating fields
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    if (c.operation !== 'warp') continue;
    const prim = SKIN_FIELD_PRIMITIVES[c.field];
    const sampleVal =
      c.field === 'custom_map'
        ? sampleGrayscaleMap(customMapId, wu, wv)
        : prim.sample(wu, wv, seed + i * 3.7, {
            frequency: c.frequency ?? params.frequency,
            aspectRatio: c.aspectRatio ?? params.aspectRatio,
            phase: c.phase ?? 0,
            ...(c.params ?? {}),
          });
    const shift = (sampleVal - 0.5) * c.strength;
    const horizBoost = c.params?.horizWarp ?? 0;
    wu += shift * (0.045 + horizBoost * 0.125);
    wv += shift * (0.28 - horizBoost * 0.12);
  }

  // Stage 4: Evaluate base bilateral cellular skeleton + dorsal continuity + composable fields
  const baseSkel = sampleBilateralVoronoiSkeleton(
    wu,
    wv,
    seed,
    params.frequency,
    params.aspectRatio,
    params.symmetry,
    params.eyeCount,
    params.eyeStrength,
    params.widthContrast,
    params.baseTaper,
    params.crownNotch,
    params.localWidthVariation,
    params.regionalCoherence
  );

  // Non-uniform organic thickness noise `a * N(u, v)` so thinning naturally breaks narrow connections!
  const erosionNoise = (fbm2D(wu * 22, wv * 6.5, seed + 29.4, 3) - 0.5) * (0.14 + warpAmp * 0.24);
  let rawField = clamp(baseSkel.networkValue + erosionNoise, 0, 1);

  // Dorsal spine continuity (Clown dorsal stripe, Pinstripe longitudinal dorsal channel, tail stripe)
  const absV = Math.abs(wv);
  if (params.dorsalBias > 0.01) {
    if (params.dorsalBias > 0.55) {
      // Strong Clown-like crisp dorsal stripe + cleaner open sides
      const stripeW = 0.24 + (params.dorsalBias - 0.55) * 0.22;
      const dorsalStripe = 1 - smoothstep(stripeW * 0.65, stripeW * 1.25, absV);
      const flankClear = smoothstep(0.32, 0.72, absV) * (params.dorsalBias - 0.45) * 0.72;
      rawField = clamp(Math.max(rawField - flankClear, dorsalStripe * 0.94 + erosionNoise * 0.45), 0, 1);
    } else {
      // Pinstripe / Cypress: jaggy broken twin longitudinal dorsal pinstripes flanking a clean lighter center,
      // with delicate lateral Voronoi ridges branching off into irregular flank dashes!
      const centerOpen = (1 - smoothstep(0.05, 0.2, absV)) * Math.min(1, params.dorsalBias * 2.1);
      const trackWobble = (fbm2D(u * 14, wv * 2.2, seed + 11.4, 2) - 0.5) * 0.14;
      const railDist = Math.abs(Math.abs(wv + trackWobble) - 0.25);
      // Hairline width narrows as coverage drops (crisp Pinstripe vs slightly fuller Cypress)
      const railHalfW = lerp(0.036, 0.075, clamp(params.coverage * 1.8, 0, 1));
      const pinTrack = 1 - smoothstep(railHalfW * 0.45, railHalfW * 1.35, railDist);
      // Natural irregular stutter breaks along the pinstripes (never ruler-straight rails)
      const stutter = smoothstep(0.24, 0.52, fbm2D(u * 26, wv > 0 ? 1.7 : 4.3, seed + 47.1, 2));
      const railStrength = pinTrack * lerp(0.58, 0.97, stutter) * smoothstep(0.06, 0.25, params.dorsalBias);
      rawField = clamp(Math.max(rawField * (1 - centerOpen * 0.78), railStrength), 0, 1);
    }
  } else if (params.dorsalBias < -0.01) {
    // Open / beaded dorsal center (classic wild-type beading transitioning to tail stripe)
    const centerBead = Math.cos(wu * Math.PI * 2 * 10 * params.frequency + seed * 4) * 0.5 + 0.5;
    const centerStrip = 1 - smoothstep(0.05, 0.18, absV);
    const tailBoost = smoothstep(0.7, 0.86, u);
    const openAmt = centerStrip * (-params.dorsalBias) * lerp(centerBead * 0.65, 0.9, tailBoost);
    rawField = clamp(rawField - openAmt, 0, 1);
  }

  // Merge interior alien-head / keyhole eyes cleanly into rawField (eyes vanish automatically as coverage erodes!)
  if (baseSkel.eyeValue > 0.01) {
    rawField = clamp(Math.max(rawField, baseSkel.eyeValue * 0.9), 0, 1);
  }

  // Track if a paver or tricolor contribution wants to drive accent regions
  let accentMask = 0;
  let hasCobblestone = false;

  // Apply non-warp composable FieldContributions in canonical order:
  // modulate -> symmetric blend -> union/smoothUnion -> intersection -> subtract
  const orderedOps: FieldOperation[] = [
    'modulate',
    'blend',
    'union',
    'smoothUnion',
    'intersection',
    'subtract',
  ];
  for (let opIdx = 0; opIdx < orderedOps.length; opIdx++) {
    const targetOp = orderedOps[opIdx];
    if (targetOp === 'blend') {
      // Order-independent symmetric weighted blend: P1 x P2 === P2 x P1 (no gene paves over another!)
      let blendSum = 0;
      let weightSum = 0;
      let maxWeight = 0;
      for (let i = 0; i < contributions.length; i++) {
        const c = contributions[i];
        if (c.operation !== 'blend') continue;
        const prim = SKIN_FIELD_PRIMITIVES[c.field];
        const secVal =
          c.field === 'custom_map'
            ? sampleGrayscaleMap(customMapId, wu, wv)
            : prim.sample(wu, wv, seed + i * 5.3, {
                frequency: c.frequency ?? params.frequency,
                aspectRatio: c.aspectRatio ?? params.aspectRatio,
                phase: c.phase ?? 0,
                ...(c.params ?? {}),
              });
        const w = clamp(c.strength, 0, 1);
        blendSum += secVal * w;
        weightSum += w;
        if (w > maxWeight) maxWeight = w;
        if (c.field === 'cellular_pavers') hasCobblestone = true;
      }
      if (weightSum > 0.0001) {
        const combinedTarget = blendSum / weightSum;
        const effectiveMix = clamp(maxWeight, 0, 1);
        rawField = clamp(lerp(rawField, combinedTarget, effectiveMix), 0, 1);
      }
      continue;
    }

    for (let i = 0; i < contributions.length; i++) {
      const c = contributions[i];
      if (c.operation !== targetOp) continue;
      const prim = SKIN_FIELD_PRIMITIVES[c.field];
      const secVal =
        c.field === 'custom_map'
          ? sampleGrayscaleMap(customMapId, wu, wv)
          : prim.sample(wu, wv, seed + i * 5.3, {
              frequency: c.frequency ?? params.frequency,
              aspectRatio: c.aspectRatio ?? params.aspectRatio,
              phase: c.phase ?? 0,
              ...(c.params ?? {}),
            });
      rawField = combineFieldValues(rawField, secVal, c.operation, c.strength);

      if (c.field === 'cellular_pavers') {
        hasCobblestone = true;
      }
      if (c.field === 'transverse_waves' && params.accentBandStrength > 0.01) {
        // Tricolor Milk Band: dark border rings surround vivid scarlet saddle centers!
        const scarletCore = smoothstep(0.6, 0.72, secVal);
        accentMask = Math.max(accentMask, scarletCore * params.accentBandStrength);
      }
    }
  }

  // Stage 5: Resolve pigment regions (threshold + erosion + multi-channel masks + regional suppression)
  const threshold = clamp(1 - params.coverage, 0.04, 0.96);
  const softness = Math.max(0.015, params.edgeSoftness);
  let primaryMask = smoothstep(threshold - softness, threshold + softness, rawField);

  // For Milk Band tricolor rings, carve sharp dark borders right around the scarlet saddles
  if (params.accentBandStrength > 0.05 && contributions.some((c) => c.field === 'transverse_waves')) {
    const c = contributions.find((item) => item.field === 'transverse_waves')!;
    const wave = SKIN_FIELD_PRIMITIVES.transverse_waves.sample(wu, wv, seed, {
      frequency: c.frequency ?? params.frequency,
      phase: c.phase ?? 0,
    });
    const blackRing = smoothstep(0.34, 0.44, wave) * (1 - smoothstep(0.62, 0.72, wave));
    const scarletCore = smoothstep(0.62, 0.72, wave) * params.accentBandStrength;
    accentMask = Math.max(accentMask, scarletCore);
    // Keep pure dark borders cleanly framing the scarlet rings while preserving modulation with any base morph
    primaryMask = clamp(Math.max(primaryMask * (1 - scarletCore * 0.85), blackRing * 0.95), 0, 1);
  }

  // For Cobblestone, assign distinct per-paver stone shade index into accentMask + crisp mortar in primaryMask
  if (hasCobblestone) {
    const uFreq = params.frequency * 16;
    const row = Math.floor((wv * 0.5 + 0.5) * 3.0);
    const col = Math.floor(wu * uFreq + (row % 2) * 0.5);
    accentMask = hash2D(col, row, seed + 41.2);
  }

  // Banana / speckle flecking
  if (params.speckleAmount > 0.02) {
    const sp = valueNoise2D(u * 48, v * 16, seed + 61.3);
    const fleck = smoothstep(0.86 - params.speckleAmount * 0.14, 0.93, sp) * params.speckleAmount;
    primaryMask = clamp(Math.max(primaryMask, fleck * 0.82), 0, 1);
  }

  // Secondary interior blush & rising golden lower-flank flaming
  const flankRise = smoothstep(0.45, 0.96, Math.abs(v));
  const flameNoise = fbm2D(u * 14, v * 3.5, seed + 19.2, 2);
  const flankFlameMask = flankRise * smoothstep(0.28, 0.78, flameNoise) * params.flankFlame;
  const interiorBlush =
    params.blush *
    (1 - primaryMask * 0.55) *
    (0.35 + baseSkel.cellInterior * 0.65) *
    (1 - flankRise * 0.35);
  const secondaryMask = clamp(Math.max(interiorBlush, flankFlameMask), 0, 1);

  // Regional pigment suppression (Calico patchy spray-painted/scraped white scales + Piebald bold pure-white sections)
  let suppressionMask = 0;
  if (params.calicoRise > 0.01) {
    const rise = params.calicoRise;
    // Asymmetric left vs. right flank envelopes (never mirrored parallel white rails!)
    const sideOffset = v >= 0 ? 11.7 : 0;
    // Real Calicos express heavier patchy white from mid-body toward tail
    const posteriorRamp = smoothstep(0.12, 0.54, u);
    const macroA = fbm2D(u * 4.2, v * 1.8 + sideOffset, seed + 37.9, 3);
    const macroB = fbm2D(u * 9.4 + 3.1, v * 3.4 - sideOffset * 0.5, seed + 71.3, 2);
    const macro = macroA * 0.66 + macroB * 0.34;

    // Discrete organic patch islands: sparse on solo Calico, large climbing splashes on mixed morph combos
    const macroPatch = smoothstep(0.55 - rise * 0.26, 0.7 - rise * 0.18, macro);
    const flankLift = Math.abs(v) + (macroA - 0.5) * (0.42 + rise * 0.25);
    const flankWeight = smoothstep(0.95 - rise * 0.9, 1.0 - rise * 0.25, flankLift);
    const patchEnv = clamp(
      flankWeight * (0.2 + 0.8 * posteriorRamp) * macroPatch * (0.48 + rise * 0.78),
      0,
      1
    );

    // Sample the exact diamond scale grid used by sampleScaleRelief so scales pixelate individually ("scraped scales")
    const su = u * 44;
    const sv = (v * 0.5 + 0.5) * 7.5;
    const scaleRow = Math.floor(sv);
    const scaleOffset = (scaleRow % 2) * 0.5;
    const scaleCol = Math.floor(su + scaleOffset);
    const scaleRand = hash2D(scaleCol, scaleRow, seed + 83.7);
    const sprayGrain = valueNoise2D(u * 72, v * 26, seed + 109.1);

    // 1) Soft pale / frosted halo around patchy zones ("lightest version of piebald")
    const paleHalo = smoothstep(0.14, 0.62, patchEnv) * (0.22 + 0.28 * sprayGrain);

    // 2) Scraped, pixelated individual white scale clusters (stray dark scales remain inside white blotches)
    const scaleWhite =
      smoothstep(0.05, 0.18, patchEnv - scaleRand * (0.76 - rise * 0.36)) *
      (0.82 + 0.18 * sprayGrain);

    // 3) Fine white spray-paint overspray speckles scattered along lower flanks and patch borders
    const flankSprayZone =
      smoothstep(0.46 - rise * 0.28, 0.96, Math.abs(v)) * (0.28 + 0.72 * posteriorRamp);
    const overspray =
      smoothstep(0.86 - patchEnv * 0.34 - rise * 0.12, 0.95, sprayGrain) *
      flankSprayZone *
      (0.55 + 0.45 * scaleRand);

    const calicoMask = clamp(Math.max(paleHalo, scaleWhite, overspray), 0, 1);
    suppressionMask = Math.max(suppressionMask, calicoMask);
  }
  if (params.piebaldAmount > 0.01) {
    // Authentic Piebald spatial variance:
    // - Head (u < 0.12) ALWAYS stays pigmented ("Normal Head Rule")
    // - Seed-driven migration field produces 1 to 4 organic saddles/islands in unpredictable locations
    // - Low-white shows localized bands or flank-rising flashes; medium-white ~50/50 saddles;
    //   high-white sweeps mostly snow-white with isolated dorsal islands & optional colored tail tip!
    const pieAmt = clamp(params.piebaldAmount, 0, 0.94);
    const headGuard = smoothstep(0.11, 0.16, u);
    const tailHasTip = hash2D(17, 31, seed + 4.2) < 0.68;
    const tailAnchor = tailHasTip ? smoothstep(0.9, 0.96, u) * 0.34 : 0;
    const frontLoadBias = hash2D(29, 11, seed + 8.7) < 0.55
      ? (1 - smoothstep(0.16, 0.52, u)) * 0.16
      : 0;

    // Seed-varied spatial frequency (low = 1-2 big sweeping wraps, high = 3-4 varied saddles)
    const patchFreq = 2.0 + hash2D(5, 19, seed + 2.1) * 2.8;
    const patchPhase = seed * 23.7;
    const cloudWarp = (fbm2D(u * 9.5, v * 2.8, seed + 51.4, 2) - 0.5) * 0.16;
    const primaryWave = fbm2D((u + cloudWarp) * patchFreq + patchPhase, v * 0.42 + 1.3, seed + 13.9, 3);
    // Low-white Pieds can show white rising from flanks/sides; high-white wraps cleanly across spine
    const flankAssist = (1 - pieAmt) * (Math.abs(v) - 0.38) * 0.16;
    const whitePotential = clamp(primaryWave + flankAssist - frontLoadBias - tailAnchor, 0, 1);

    // Map pieAmt (0.12..0.92) cleanly to threshold across the fBm distribution (~[0.24..0.76])
    const whiteThreshold = lerp(0.73, 0.25, pieAmt);
    const pieMask = smoothstep(whiteThreshold - 0.028, whiteThreshold + 0.028, whitePotential) * headGuard;
    suppressionMask = Math.max(suppressionMask, pieMask);
  }

  // Stage 6: Logically separate scale relief
  const { height: scaleHeight, shade: scaleShade } = sampleScaleRelief(u, v);

  return {
    rawField,
    primaryMask,
    secondaryMask,
    accentMask,
    suppressionMask,
    scaleHeight,
    scaleShade,
  };
}

// --- Color Utilities & RGBA Buffer Synthesis (Stage 6 Coloration + Debug Views) ---

interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseHexColor(hex: string): RGB {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 180, g: 150, b: 110 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  const k = clamp(t, 0, 1);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

/**
 * Synthesizes a deterministic RGBA pixel buffer for unwrapped (u, v) snake skin.
 * Pure TypeScript (no Canvas2D / DOM dependency) so it runs in unit tests and is ready for WebGL2.
 */
export function synthesizeSkinBuffer(
  spec: SkinPhenotypeSpec,
  palette: SnakePalette,
  seed: number,
  width: number,
  height: number,
  debugStage: SkinDebugStage = 'final'
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const cBase = parseHexColor(palette.base);
  const cPrim = parseHexColor(palette.patternPrimary);
  const cSec = parseHexColor(palette.patternSecondary);
  const cHead = parseHexColor(palette.headBlush);
  const cAccent = parseHexColor(palette.accentColor ?? '#C6382B');
  const cWhite: RGB = palette.isInverted
    ? { r: 10, g: 12, b: 16 }
    : { r: 251, g: 249, b: 244 };
  const hasMottle =
    Boolean(palette.mottleColorA && palette.mottleColorB) &&
    (palette.mottleStrength ?? 0) > 0.01 &&
    !palette.isLeucistic;
  const cMottleA = hasMottle ? parseHexColor(palette.mottleColorA!) : cBase;
  const cMottleB = hasMottle ? parseHexColor(palette.mottleColorB!) : cBase;
  const mottleStrength = hasMottle ? clamp(palette.mottleStrength ?? 0, 0, 0.85) : 0;

  const hasCobblestone = spec.contributions.some((c) => c.field === 'cellular_pavers');
  const isLeucistic = palette.isLeucistic;

  for (let y = 0; y < height; y++) {
    // v in [-1, 1] from left flank (y=0) to right flank (y=height-1)
    const v = (y / Math.max(1, height - 1)) * 2 - 1;
    // Cylindrical cross-section subtle dorsal-to-flank ambient curve (pure lighting cue)
    const bodyCylinder = 1 - Math.pow(Math.abs(v), 2.4) * 0.14;

    for (let x = 0; x < width; x++) {
      const u = x / Math.max(1, width - 1);
      const sample = evaluateSkinPoint(u, v, spec, seed);
      const idx = (y * width + x) * 4;

      if (debugStage === 'raw_field') {
        // High-contrast Viridis-inspired amber/indigo heatmap for scalar field inspection
        const f = sample.rawField;
        const r = Math.round(clamp(lerp(28, 246, Math.pow(f, 0.85)), 0, 255));
        const g = Math.round(clamp(lerp(22, 196, Math.sin(f * Math.PI * 0.85)), 0, 255));
        const b = Math.round(clamp(lerp(56, 78, 1 - f), 0, 255));
        out[idx] = r;
        out[idx + 1] = g;
        out[idx + 2] = b;
        out[idx + 3] = 255;
        continue;
      }

      if (debugStage === 'pigment_mask') {
        // Shows thresholded primary mask (dark), accent band (warm red), and white suppression (cyan-white)
        let r = Math.round(lerp(236, 26, sample.primaryMask));
        let g = Math.round(lerp(226, 24, sample.primaryMask));
        let b = Math.round(lerp(206, 28, sample.primaryMask));
        if (sample.accentMask > 0.05 && !hasCobblestone) {
          r = Math.round(lerp(r, 224, sample.accentMask));
          g = Math.round(lerp(g, 68, sample.accentMask));
          b = Math.round(lerp(b, 58, sample.accentMask));
        }
        if (sample.suppressionMask > 0.05) {
          r = Math.round(lerp(r, 255, sample.suppressionMask));
          g = Math.round(lerp(g, 255, sample.suppressionMask));
          b = Math.round(lerp(b, 255, sample.suppressionMask));
        }
        out[idx] = r;
        out[idx + 1] = g;
        out[idx + 2] = b;
        out[idx + 3] = 255;
        continue;
      }

      if (debugStage === 'scale_map') {
        // Pure independent diamond scale height & directional normal shading
        const val = clamp(sample.scaleHeight * 0.72 + 0.18 + sample.scaleShade * 0.22, 0, 1);
        const lum = Math.round(val * 255);
        out[idx] = lum;
        out[idx + 1] = Math.round(clamp(lum * 0.98, 0, 255));
        out[idx + 2] = Math.round(clamp(lum * 0.92, 0, 255));
        out[idx + 3] = 255;
        continue;
      }

      // Final coloration stage
      const bodyFade = smoothstep(0.05, 0.13, u);
      let col: RGB;
      if (isLeucistic) {
        // Pure porcelain / ivory leucistic coat with ultra-subtle pearlescent blush
        col = mixRgb(cBase, cHead, sample.secondaryMask * 0.18);
      } else {
        // 1) Base coat (with emergent dual-pigment "mixed paint" mottling when opposing hues combine)
        let localBase = cBase;
        if (hasMottle) {
          const mWarpU = (fbm2D(u * 3.8, v * 1.6, seed + 71.1, 2) - 0.5) * 0.24;
          const mWarpV = (fbm2D(u * 4.4, v * 2.1, seed + 83.7, 2) - 0.5) * 0.32;
          const mField = fbm2D((u + mWarpU) * 5.2, (v + mWarpV) * 2.2, seed + 97.3, 3);
          const pullA = smoothstep(0.51, 0.72, mField) * mottleStrength;
          const pullB = (1 - smoothstep(0.28, 0.49, mField)) * mottleStrength;
          if (pullA > 0.005) localBase = mixRgb(localBase, cMottleA, pullA);
          if (pullB > 0.005) localBase = mixRgb(localBase, cMottleB, pullB);
        }
        // Subtle per-paver stone shading when Cobblestone/Obsidian Cobblestone is active (never paves over other genes!)
        if (hasCobblestone) {
          const stoneShade = (sample.accentMask - 0.5) * 0.28;
          if (stoneShade > 0) {
            localBase = mixRgb(localBase, cSec, stoneShade);
          } else {
            localBase = mixRgb(localBase, cHead, -stoneShade);
          }
        }
        // Secondary blushing / lower-flank flaming
        col = mixRgb(localBase, cSec, sample.secondaryMask * (hasCobblestone ? 0.38 : 0.68));
        // 2) Third pigment region (e.g. Milk Band vivid scarlet rings)
        if (!hasCobblestone && sample.accentMask > 0.01) {
          col = mixRgb(col, cAccent, sample.accentMask * bodyFade);
        }
        // 3) Primary dark pattern mask (carries both cobblestone mortar AND any combined morph patterns!)
        col = mixRgb(col, cPrim, sample.primaryMask * bodyFade);
      }

      // 4) Regional white suppression (Calico high-white flanks + Piebald bold patches)
      // Applies uniformly across ALL pattern types including Cobblestone!
      if (!isLeucistic && sample.suppressionMask > 0.01) {
        col = mixRgb(col, cWhite, sample.suppressionMask * bodyFade);
      }

      // Apply logically separate scale micro-shading & cylindrical dorsal-to-flank shading
      const relief = spec.params.scaleRelief;
      const scaleMul = 1 + (sample.scaleHeight - 0.55) * 0.1 * relief + sample.scaleShade * 0.09 * relief;
      const lightMul = bodyCylinder * scaleMul;

      out[idx] = Math.round(clamp(col.r * lightMul, 0, 255));
      out[idx + 1] = Math.round(clamp(col.g * lightMul, 0, 255));
      out[idx + 2] = Math.round(clamp(col.b * lightMul, 0, 255));
      out[idx + 3] = 255;
    }
  }

  return out;
}
