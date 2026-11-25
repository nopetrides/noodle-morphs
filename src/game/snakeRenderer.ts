import { resolveSkinSpecForPhenotype } from './genetics';
import { globalSkinCache } from './skinCache';
import { computeOutlineGeometry } from './spine';
import type {
  SkinDebugStage,
  SkinPhenotypeSpec,
  SnakePhenotype,
  SnakeSpine,
} from './types';

function traceSmoothClosedLoop(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>
): void {
  if (pts.length < 3) return;
  const n = pts.length;
  const firstMidX = (pts[n - 1].x + pts[0].x) * 0.5;
  const firstMidY = (pts[n - 1].y + pts[0].y) * 0.5;
  ctx.beginPath();
  ctx.moveTo(firstMidX, firstMidY);
  for (let i = 0; i < n; i++) {
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) * 0.5, (curr.y + next.y) * 0.5);
  }
  ctx.closePath();
}

function buildBodyLoop(spine: SnakeSpine): Array<{ x: number; y: number }> {
  const { left, right, headCap, tailCap } = computeOutlineGeometry(spine);
  const loop: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < left.length; i++) loop.push(left[i]);
  for (let i = 0; i < tailCap.length; i++) loop.push(tailCap[i]);
  for (let i = right.length - 1; i >= 0; i--) loop.push(right[i]);
  for (let i = 0; i < headCap.length; i++) loop.push(headCap[i]);
  return loop;
}

export interface UVRibbonVertex {
  x: number;
  y: number;
  u: number;
  v: number;
}

export interface UVRibbonMesh {
  left: UVRibbonVertex[];
  right: UVRibbonVertex[];
}

/**
 * Builds persistent rest-space UV coordinates mapped to current world-space spine geometry.
 * - Longitudinal U stays permanently attached to each spine cross-section (0 = snout tip, 1 = tail tip).
 * - Transverse V maps left edge (v = 0) to right edge (v = 1).
 * - Inner-bend anti-folding clamps sharp turn inversions so inner skin compresses cleanly while outer skin stretches!
 */
export function buildSpineUVRibbon(spine: SnakeSpine): UVRibbonMesh {
  const pts = spine.points;
  const n = pts.length;
  const left: UVRibbonVertex[] = [];
  const right: UVRibbonVertex[] = [];
  if (n < 2) return { left, right };

  // Extend slightly past snout and tail so rounded caps inside the silhouette clip are seamlessly textured
  const snout = pts[0];
  const snoutPad = snout.radius * 1.25;
  const snoutNx = -Math.sin(snout.angle);
  const snoutNy = Math.cos(snout.angle);
  const snoutTipX = snout.x + Math.cos(snout.angle) * snoutPad;
  const snoutTipY = snout.y + Math.sin(snout.angle) * snoutPad;
  const snoutHalfW = snout.radius * 0.92;
  left.push({ x: snoutTipX + snoutNx * snoutHalfW, y: snoutTipY + snoutNy * snoutHalfW, u: 0, v: 0 });
  right.push({ x: snoutTipX - snoutNx * snoutHalfW, y: snoutTipY - snoutNy * snoutHalfW, u: 0, v: 1 });

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const nx = -Math.sin(p.angle);
    const ny = Math.cos(p.angle);
    // Slight over-expansion (+6%) ensures quadratic silhouette edges are always 100% covered inside clip
    const r = p.radius * 1.06;
    const u = 0.03 + (i / (n - 1)) * 0.94;
    left.push({ x: p.x + nx * r, y: p.y + ny * r, u, v: 0 });
    right.push({ x: p.x - nx * r, y: p.y - ny * r, u, v: 1 });
  }

  const tail = pts[n - 1];
  const tailPad = tail.radius * 1.25;
  const tailNx = -Math.sin(tail.angle);
  const tailNy = Math.cos(tail.angle);
  const tailTipX = tail.x - Math.cos(tail.angle) * tailPad;
  const tailTipY = tail.y - Math.sin(tail.angle) * tailPad;
  const tailHalfW = tail.radius * 0.72;
  left.push({ x: tailTipX + tailNx * tailHalfW, y: tailTipY + tailNy * tailHalfW, u: 1, v: 0 });
  right.push({ x: tailTipX - tailNx * tailHalfW, y: tailTipY - tailNy * tailHalfW, u: 1, v: 1 });

  // Tight-turn anti-folding guard: prevent inner-curve edge vertices from crossing backward over their previous node
  for (let i = 1; i < left.length - 1; i++) {
    const prevMidX = (left[i - 1].x + right[i - 1].x) * 0.5;
    const prevMidY = (left[i - 1].y + right[i - 1].y) * 0.5;
    const currMidX = (left[i].x + right[i].x) * 0.5;
    const currMidY = (left[i].y + right[i].y) * 0.5;
    const dirX = currMidX - prevMidX;
    const dirY = currMidY - prevMidY;

    const lDot = (left[i].x - left[i - 1].x) * dirX + (left[i].y - left[i - 1].y) * dirY;
    if (lDot < 0) {
      left[i].x = left[i - 1].x * 0.55 + left[i].x * 0.45;
      left[i].y = left[i - 1].y * 0.55 + left[i].y * 0.45;
    }

    const rDot = (right[i].x - right[i - 1].x) * dirX + (right[i].y - right[i - 1].y) * dirY;
    if (rDot < 0) {
      right[i].x = right[i - 1].x * 0.55 + right[i].x * 0.45;
      right[i].y = right[i - 1].y * 0.55 + right[i].y * 0.45;
    }
  }

  return { left, right };
}

/**
 * Draws a single affine-mapped textured triangle in Canvas2D.
 * Inflates the clip triangle outward from its centroid by `seamBleed` pixels while keeping
 * the exact UV matrix uninflated, eliminating anti-aliased subpixel hairline seams cleanly.
 */
function drawAffineTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  dx0: number,
  dy0: number,
  dx1: number,
  dy1: number,
  dx2: number,
  dy2: number,
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number
): void {
  const denom = sx0 * (sy1 - sy2) - sy0 * (sx1 - sx2) + (sx1 * sy2 - sy1 * sx2);
  if (Math.abs(denom) < 1e-5) return;

  // Reject degenerate or inverted screen triangles cleanly
  const screenArea2 = (dx1 - dx0) * (dy2 - dy0) - (dy1 - dy0) * (dx2 - dx0);
  if (Math.abs(screenArea2) < 0.05) return;

  const invDenom = 1 / denom;
  const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) * invDenom;
  const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) * invDenom;
  const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) * invDenom;
  const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) * invDenom;
  const e =
    (dx0 * (sx1 * sy2 - sx2 * sy1) +
      dx1 * (sx2 * sy0 - sx0 * sy2) +
      dx2 * (sx0 * sy1 - sx1 * sy0)) *
    invDenom;
  const f =
    (dy0 * (sx1 * sy2 - sx2 * sy1) +
      dy1 * (sx2 * sy0 - sx0 * sy2) +
      dy2 * (sx0 * sy1 - sx1 * sy0)) *
    invDenom;

  // Slight outward clip inflation (~0.65px) prevents subpixel gaps between neighboring triangles
  const cx = (dx0 + dx1 + dx2) / 3;
  const cy = (dy0 + dy1 + dy2) / 3;
  const seamBleed = 0.65;
  const expand = (px: number, py: number): [number, number] => {
    const vx = px - cx;
    const vy = py - cy;
    const len = Math.hypot(vx, vy);
    if (len < 1e-4) return [px, py];
    return [px + (vx / len) * seamBleed, py + (vy / len) * seamBleed];
  };

  const [p0x, p0y] = expand(dx0, dy0);
  const [p1x, p1y] = expand(dx1, dy1);
  const [p2x, p2y] = expand(dx2, dy2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0x, p0y);
  ctx.lineTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * Warps a cached (u, v) synthesized skin texture onto the deformed spine triangle strip.
 * Markings & scales naturally compress on the inner bend and stretch along the outer bend!
 */
function renderUVWarpedSkinRibbon(
  ctx: CanvasRenderingContext2D,
  spine: SnakeSpine,
  skinCanvas: HTMLCanvasElement
): void {
  const { left, right } = buildSpineUVRibbon(spine);
  if (left.length < 2) return;

  const texW = skinCanvas.width;
  const texH = skinCanvas.height;

  for (let i = 0; i < left.length - 1; i++) {
    const l0 = left[i];
    const r0 = right[i];
    const l1 = left[i + 1];
    const r1 = right[i + 1];

    const u0 = l0.u * (texW - 1);
    const u1 = l1.u * (texW - 1);
    const vLeft = 0.5;
    const vRight = texH - 1.5;

    // Triangle 1: (L0, R0, L1)
    drawAffineTexturedTriangle(
      ctx,
      skinCanvas,
      l0.x,
      l0.y,
      r0.x,
      r0.y,
      l1.x,
      l1.y,
      u0,
      vLeft,
      u0,
      vRight,
      u1,
      vLeft
    );

    // Triangle 2: (R0, R1, L1)
    drawAffineTexturedTriangle(
      ctx,
      skinCanvas,
      r0.x,
      r0.y,
      r1.x,
      r1.y,
      l1.x,
      l1.y,
      u0,
      vRight,
      u1,
      vRight,
      u1,
      vLeft
    );
  }
}

export interface RenderSnakeOptions {
  selected?: boolean;
  showShadow?: boolean;
  showNameTag?: boolean;
  name?: string;
  lightAngle?: number;
  highlightPulse?: number;
  /** Optional debug view stage ('final' | 'raw_field' | 'pigment_mask' | 'scale_map') */
  debugStage?: SkinDebugStage;
  /** Optional live skin-spec override for Developer Skin Field Debugger calibration */
  skinSpecOverride?: SkinPhenotypeSpec;
  /** Optional explicit seed override */
  seedOverride?: number;
}

/**
 * Renders a procedurally animated Ball Python using:
 * 1) Persistent UV coordinates mapped onto the deformed spine triangle strip,
 * 2) Bounded LRU-cached composable scalar-field skin synthesis,
 * 3) Spider Dinnerbone upside-down belly scute mode, and crisp anatomical head details.
 */
export function renderProceduralSnake(
  ctx: CanvasRenderingContext2D,
  spine: SnakeSpine,
  phenotype: SnakePhenotype,
  opts: RenderSnakeOptions = {}
): void {
  const pts = spine.points;
  if (pts.length < 4) return;

  const {
    selected = false,
    showShadow = true,
    showNameTag = false,
    name = '',
    lightAngle = Math.PI * 0.25,
    highlightPulse = 0,
    debugStage = 'final',
    skinSpecOverride,
    seedOverride,
  } = opts;

  const { palette, isUpsideDown } = phenotype;
  const loop = buildBodyLoop(spine);
  const spec = skinSpecOverride ?? resolveSkinSpecForPhenotype(phenotype);
  const seed = seedOverride ?? phenotype.patternRule.variationSeed;

  // Resolution scaling: crisp 256×64 for terrarium / large previews, compact 192×48 for mini cards
  const texW = spine.baseRadius >= 11 ? 256 : 192;
  const texH = spine.baseRadius >= 11 ? 64 : 48;
  const cachedSkin = globalSkinCache.getOrSynthesize(spec, palette, seed, texW, texH, debugStage);

  ctx.save();

  // 1. Soft grounded contact shadow
  if (showShadow) {
    ctx.save();
    ctx.translate(Math.cos(lightAngle) * 5, Math.sin(lightAngle) * 6);
    traceSmoothClosedLoop(ctx, loop);
    ctx.fillStyle = 'rgba(12, 9, 6, 0.34)';
    ctx.fill();
    ctx.restore();
  }

  // 2. Selection glow ring (clean warm brass outline)
  if (selected || highlightPulse > 0.01) {
    ctx.save();
    traceSmoothClosedLoop(ctx, loop);
    ctx.strokeStyle = selected
      ? 'rgba(244, 211, 134, 0.88)'
      : `rgba(248, 224, 152, ${Math.min(0.85, highlightPulse * 0.85)})`;
    ctx.lineWidth = selected ? 5 : 4;
    ctx.stroke();
    ctx.restore();
  }

  // 3. Tongue flick
  if (spine.tongueActive > 0) {
    drawTongue(ctx, spine, isUpsideDown);
  }

  // 4. Base silhouette fill + clipped UV-warped deformable skin ribbon
  ctx.save();
  traceSmoothClosedLoop(ctx, loop);
  ctx.fillStyle = isUpsideDown && debugStage === 'final' ? palette.belly : palette.base;
  ctx.fill();
  ctx.clip();

  if (cachedSkin.canvas) {
    // Always draw the UV-warped skin first (even on upside-down Spider snakes so dorsal flank margins peek organically!)
    renderUVWarpedSkinRibbon(ctx, spine, cachedSkin.canvas);
  }

  if (isUpsideDown && debugStage === 'final') {
    renderUpsideDownBelly(ctx, spine, phenotype);
  }

  if (debugStage === 'final') {
    renderDorsalSheen(ctx, spine, isUpsideDown, palette.isLeucistic);
  }
  ctx.restore();

  // 5. Crisp anatomical outline
  traceSmoothClosedLoop(ctx, loop);
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = Math.max(1.3, spine.baseRadius * 0.12);
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 6. Head details (eyes, nostrils, crown blush/eyestripes — kept minimal during field debug inspection)
  renderHeadDetails(ctx, spine, phenotype, debugStage);

  // 7. Optional subtle name caption when selected/hovered
  if (showNameTag && name) {
    const head = pts[1] ?? pts[0];
    ctx.save();
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    const textW = ctx.measureText(name).width;
    const tagX = head.x;
    const tagY = head.y - spine.baseRadius - 14;
    ctx.fillStyle = 'rgba(26, 22, 18, 0.88)';
    ctx.beginPath();
    ctx.roundRect(tagX - textW * 0.5 - 8, tagY - 11, textW + 16, 20, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 198, 134, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#F5EFE4';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, tagX, tagY - 1);
    ctx.restore();
  }

  ctx.restore();
}

function drawTongue(ctx: CanvasRenderingContext2D, spine: SnakeSpine, isUpsideDown: boolean): void {
  const head = spine.points[0];
  const progress = Math.sin((spine.tongueActive / 0.42) * Math.PI);
  const length = spine.baseRadius * (0.65 + 0.7 * progress);
  const sway = Math.sin(spine.tongueActive * 32) * 0.22;
  const dir = head.angle + sway;

  const startX = head.x + Math.cos(head.angle) * head.radius * 1.15;
  const startY = head.y + Math.sin(head.angle) * head.radius * 1.15;
  const forkBaseX = startX + Math.cos(dir) * length * 0.72;
  const forkBaseY = startY + Math.sin(dir) * length * 0.72;
  const tipL = {
    x: forkBaseX + Math.cos(dir + 0.36) * length * 0.36,
    y: forkBaseY + Math.sin(dir + 0.36) * length * 0.36,
  };
  const tipR = {
    x: forkBaseX + Math.cos(dir - 0.36) * length * 0.36,
    y: forkBaseY + Math.sin(dir - 0.36) * length * 0.36,
  };

  ctx.save();
  ctx.strokeStyle = isUpsideDown ? '#E97C94' : '#D95D76';
  ctx.lineWidth = Math.max(1.2, spine.baseRadius * 0.11);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(forkBaseX, forkBaseY);
  ctx.moveTo(forkBaseX, forkBaseY);
  ctx.lineTo(tipL.x, tipL.y);
  ctx.moveTo(forkBaseX, forkBaseY);
  ctx.lineTo(tipR.x, tipR.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Renders the upside-down ventral belly of a Spider gene snake ("Dinnerbone" effect):
 * Cream ventral scute ribbon centered over the UV-warped skin so dorsal markings peek along the outer flanks!
 */
function renderUpsideDownBelly(
  ctx: CanvasRenderingContext2D,
  spine: SnakeSpine,
  phenotype: SnakePhenotype
): void {
  const pts = spine.points;
  const { palette } = phenotype;

  // Smooth central ventral cream strip leaving the outer ~22% of each flank showing UV-warped dorsal pattern!
  const leftEdge: Array<{ x: number; y: number }> = [];
  const rightEdge: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const nx = -Math.sin(p.angle);
    const ny = Math.cos(p.angle);
    const bellyR = p.radius * 0.76;
    leftEdge.push({ x: p.x + nx * bellyR, y: p.y + ny * bellyR });
    rightEdge.push({ x: p.x - nx * bellyR, y: p.y - ny * bellyR });
  }
  if (leftEdge.length > 1) {
    ctx.fillStyle = palette.belly;
    ctx.beginPath();
    ctx.moveTo(leftEdge[0].x, leftEdge[0].y);
    for (let i = 1; i < leftEdge.length; i++) ctx.lineTo(leftEdge[i].x, leftEdge[i].y);
    for (let i = rightEdge.length - 1; i >= 0; i--) ctx.lineTo(rightEdge[i].x, rightEdge[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // Repeating curved ventral belly scute plates along the entire spine
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = palette.outline;
  ctx.lineWidth = Math.max(1, spine.baseRadius * 0.08);
  for (let i = 2; i < pts.length - 1; i++) {
    const p = pts[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const halfW = p.radius * 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -halfW);
    ctx.quadraticCurveTo(p.radius * 0.24, 0, 0, halfW);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function renderDorsalSheen(
  ctx: CanvasRenderingContext2D,
  spine: SnakeSpine,
  isUpsideDown: boolean,
  isLeucistic: boolean
): void {
  const pts = spine.points;
  ctx.save();
  ctx.beginPath();
  for (let i = 1; i < pts.length - 2; i++) {
    const p = pts[i];
    const nx = -Math.sin(p.angle);
    const ny = Math.cos(p.angle);
    const hx = p.x - nx * p.radius * 0.2;
    const hy = p.y - ny * p.radius * 0.2;
    if (i === 1) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.strokeStyle = isLeucistic
    ? 'rgba(255, 255, 255, 0.72)'
    : isUpsideDown
      ? 'rgba(255, 252, 240, 0.35)'
      : 'rgba(255, 248, 228, 0.18)';
  ctx.lineWidth = Math.max(2, spine.baseRadius * 0.32);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function renderHeadDetails(
  ctx: CanvasRenderingContext2D,
  spine: SnakeSpine,
  phenotype: SnakePhenotype,
  debugStage: SkinDebugStage
): void {
  const snout = spine.points[0];
  const head = spine.points[1];
  if (!snout || !head) return;

  const { palette, isUpsideDown, patternRule } = phenotype;
  const r = head.radius;
  const snoutDist = spine.segmentLength;

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(head.angle);

  if (isUpsideDown && debugStage === 'final') {
    // Underside chin groove extending forward from skull pivot toward snout tip
    ctx.strokeStyle = palette.outline;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(snoutDist + snout.radius * 0.35, 0);
    ctx.lineTo(-r * 0.45, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Eyes peeking out along wide skull jaw cheeks
    for (const side of [-1, 1]) {
      ctx.fillStyle = palette.eyeIris;
      ctx.beginPath();
      ctx.ellipse(r * 0.2, side * r * 0.84, r * 0.21, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.eyePupil;
      ctx.beginPath();
      ctx.arc(r * 0.22, side * r * 0.84, r * 0.085, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Only draw morph headstamps in 'final' coloration mode so debug stages show the pure UV field
    if (debugStage === 'final') {
      if (patternRule.motif === 'dorsal_stripe') {
        // Iconic Clown dark skull cap / headstamp
        ctx.fillStyle = palette.patternPrimary;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.ellipse(-r * 0.04, 0, r * 0.68, r * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = palette.patternSecondary;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(-r * 0.08, 0, r * 0.26, r * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (patternRule.motif === 'banded' && !palette.isLeucistic) {
        // Authentic Enchi head: heavily blushed luminous golden crown + brighter yellow eye stripes
        ctx.fillStyle = palette.patternPrimary;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(r * 0.48, 0);
        ctx.quadraticCurveTo(r * 0.04, r * 0.48, -r * 0.52, r * 0.36);
        ctx.lineTo(-r * 0.34, 0);
        ctx.lineTo(-r * 0.52, -r * 0.36);
        ctx.quadraticCurveTo(r * 0.04, -r * 0.48, r * 0.48, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = palette.headBlush;
        ctx.globalAlpha = 0.86;
        ctx.beginPath();
        ctx.ellipse(-r * 0.06, 0, r * 0.44, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = palette.patternSecondary;
        ctx.globalAlpha = 0.92;
        ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(r * 0.14, side * r * 0.52);
          ctx.lineTo(-r * 0.54, side * r * 0.58);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (
        (patternRule.motif === 'alien_heads' ||
          patternRule.motif === 'keyholes' ||
          patternRule.motif === 'inkblot' ||
          patternRule.motif === 'lines') &&
        !palette.isLeucistic
      ) {
        // Classic Ball Python crown arrow + post-ocular eyestripes (blushed for Pastel/Fire)
        ctx.fillStyle = patternRule.weight === 'blushed' ? palette.headBlush : palette.patternPrimary;
        ctx.globalAlpha = patternRule.weight === 'blushed' ? 0.72 : 0.6;
        ctx.beginPath();
        ctx.moveTo(r * 0.48, 0);
        ctx.quadraticCurveTo(r * 0.04, r * 0.46, -r * 0.52, r * 0.34);
        ctx.lineTo(-r * 0.34, 0);
        ctx.lineTo(-r * 0.52, -r * 0.34);
        ctx.quadraticCurveTo(r * 0.04, -r * 0.46, r * 0.48, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = palette.patternSecondary;
        ctx.globalAlpha = 0.58;
        ctx.lineWidth = Math.max(1.1, r * 0.11);
        ctx.lineCap = 'round';
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(r * 0.1, side * r * 0.52);
          ctx.lineTo(-r * 0.5, side * r * 0.56);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (patternRule.motif === 'milk_bands' && !palette.isLeucistic) {
        // Milk Band sleek jet-black snout cap with cream collar
        ctx.fillStyle = palette.patternPrimary;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(r * 0.14, 0, r * 0.6, r * 0.46, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (patternRule.motif !== 'cobblestone' && patternRule.motif !== 'magma_cracks' && patternRule.motif !== 'ripples') {
        ctx.fillStyle = palette.headBlush;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(-r * 0.06, 0, r * 0.52, r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // Snout nostrils
    ctx.fillStyle = palette.outline;
    ctx.globalAlpha = 0.55;
    const nostrilX = snoutDist + snout.radius * 0.65;
    const nostrilY = snout.radius * 0.3;
    const nostrilR = Math.max(0.95, snout.radius * 0.1);
    ctx.beginPath();
    ctx.arc(nostrilX, -nostrilY, nostrilR, 0, Math.PI * 2);
    ctx.arc(nostrilX, nostrilY, nostrilR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Expressive glossy eyes positioned on the cranium behind the snout
    for (const side of [-1, 1]) {
      const ex = r * 0.22;
      const ey = side * r * 0.6;
      const er = Math.max(2.6, r * 0.23);

      ctx.fillStyle = palette.eyeIris;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = palette.eyePupil;
      ctx.beginPath();
      ctx.arc(ex + er * 0.16, ey, er * 0.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex + er * 0.3, ey - er * 0.24, er * 0.27, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
