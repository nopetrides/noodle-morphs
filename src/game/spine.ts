import type { SnakeSpine, SpinePoint } from './types';

/**
 * Ball python anatomical body radius profile along normalized spine parameter t in [0, 1].
 * 0.00 (node 0) = rounded snout, ~0.04 (node 1) = wide cheeks / rigid skull pivot,
 * ~0.12 (node 3) = tucked neck, 0.28..0.72 = plump mid-body, 1.00 = soft tapered tail tip.
 */
export function getBallPythonRadius(t: number, baseRadius: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.045) {
    // Rounded snout swelling into wide cheeks at node 1
    const u = clamped / 0.045;
    return baseRadius * (0.56 + 0.37 * Math.sin(u * Math.PI * 0.55));
  }
  if (clamped < 0.13) {
    // Wide skull tapering smoothly into tucked neck behind the head pivot
    const u = (clamped - 0.045) / 0.085;
    const headR = 0.93;
    const neckR = 0.6;
    return baseRadius * (headR + (neckR - headR) * (0.5 - 0.5 * Math.cos(u * Math.PI)));
  }
  if (clamped < 0.32) {
    // Neck swelling gently into plump mid-body
    const u = (clamped - 0.13) / 0.19;
    return baseRadius * (0.6 + 0.46 * (0.5 - 0.5 * Math.cos(u * Math.PI)));
  }
  if (clamped < 0.72) {
    // Cozy full mid-body
    const u = (clamped - 0.32) / 0.4;
    return baseRadius * (1.06 - 0.08 * Math.pow(u, 1.4));
  }
  // Smooth taper to rounded ball python tail tip
  const u = (clamped - 0.72) / 0.28;
  return baseRadius * Math.max(0.22, 0.98 * Math.pow(1 - u, 1.05));
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Subdivides body points (node 1..N-1) along a smooth Catmull-Rom curve (~6x denser)
 * so ground-trail arc-length sampling never chugs across coarse segment-length chords.
 */
export function buildSmoothTrailFromPoints(
  points: SpinePoint[],
  subdivisions = 6
): Array<{ x: number; y: number }> {
  const body = points.slice(1);
  if (body.length < 2) return body.map((p) => ({ x: p.x, y: p.y }));

  const trail: Array<{ x: number; y: number }> = [{ x: body[0].x, y: body[0].y }];
  for (let i = 0; i < body.length - 1; i++) {
    const p0 = body[Math.max(0, i - 1)];
    const p1 = body[i];
    const p2 = body[i + 1];
    const p3 = body[Math.min(body.length - 1, i + 2)];

    for (let s = 1; s <= subdivisions; s++) {
      const t = s / subdivisions;
      const t2 = t * t;
      const t3 = t2 * t;
      trail.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return trail;
}

export function createSpine(
  startX: number,
  startY: number,
  heading = 0,
  segmentCount = 26,
  segmentLength = 10.5,
  baseRadius = 15
): SnakeSpine {
  const points: SpinePoint[] = [];
  const fwdX = Math.cos(heading);
  const fwdY = Math.sin(heading);
  const backX = -fwdX;
  const backY = -fwdY;
  const perpX = -backY;
  const perpY = backX;

  for (let i = 0; i < segmentCount; i++) {
    const t = i / Math.max(1, segmentCount - 1);
    if (i === 0) {
      // Node 0: rigid snout positioned directly ahead of the head pivot (node 1)
      points.push({
        x: startX + fwdX * segmentLength,
        y: startY + fwdY * segmentLength,
        angle: heading,
        radius: getBallPythonRadius(t, baseRadius),
      });
    } else if (i === 1) {
      // Node 1: rigid cranium / head pivot center
      points.push({
        x: startX,
        y: startY,
        angle: heading,
        radius: getBallPythonRadius(t, baseRadius),
      });
    } else {
      // Nodes 2..N-1: gentle smooth-onset S-curve (tapered near neck so node 1->2 never kinks)
      const bodyIndex = i - 1;
      const bodyT = bodyIndex / Math.max(1, segmentCount - 2);
      const neckEase = Math.min(1, bodyT / 0.25);
      const smoothEase = neckEase * neckEase * (3 - 2 * neckEase);
      const wave = Math.sin(bodyT * Math.PI * 2.1) * segmentLength * 1.65 * smoothEase;
      points.push({
        x: startX + backX * bodyIndex * segmentLength * 0.96 + perpX * wave,
        y: startY + backY * bodyIndex * segmentLength * 0.96 + perpY * wave,
        angle: heading,
        radius: getBallPythonRadius(t, baseRadius),
      });
    }
  }

  // Enforce rigid snout + exact distance & angular constraints down the body
  solveDistanceAndAngleConstraints(points, segmentLength, 0.46);

  // Seed smooth dense ground-space path history directly from initial headPivot (node 1) back to tail
  const trail = buildSmoothTrailFromPoints(points, 6);

  return {
    points,
    trail,
    segmentLength,
    baseRadius,
    maxTurnAngle: 0.46,
    heading,
    slitherPhase: 0,
    tongueTimer: 1.5 + Math.random() * 4,
    tongueActive: 0,
    wobblePhase: Math.random() * Math.PI * 2,
  };
}

/**
 * Monotonically samples a point at exact arc-length `targetDist` backward along `trail`
 * (index 0 = headPivot). Never jumps across U-turns or self-intersections.
 */
function sampleTrailAtArcLength(
  trail: Array<{ x: number; y: number }>,
  targetDist: number
): { x: number; y: number } | null {
  if (trail.length === 0) return null;
  if (targetDist <= 0) return { x: trail[0].x, y: trail[0].y };

  let accumulated = 0;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (accumulated + segLen >= targetDist && segLen > 1e-6) {
      const t = (targetDist - accumulated) / segLen;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
    accumulated += segLen;
  }
  return null;
}

/**
 * Core procedural animation constraint solver (Argonaut technique) with rigid skull pivot:
 * - Node 1 is the cranium/head pivot; Node 0 (snout) is rigidly locked ahead of Node 1
 *   at exact `segmentLength` along `points[1].angle` so the nose never bends away from the head.
 * - Nodes 2..N-1 follow with exact distance constraints and clamped angular turn limits.
 */
export function solveDistanceAndAngleConstraints(
  points: SpinePoint[],
  segmentLength: number,
  maxTurnAngle: number
): void {
  if (points.length < 2) return;

  // Rigidly lock snout (node 0) directly in front of head pivot (node 1)
  const snout = points[0];
  const headPivot = points[1];
  snout.angle = headPivot.angle;
  snout.x = headPivot.x + Math.cos(headPivot.angle) * segmentLength;
  snout.y = headPivot.y + Math.sin(headPivot.angle) * segmentLength;

  // Solve flexible neck & body chain starting from node 2 behind the rigid skull
  for (let i = 2; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dist = Math.hypot(dx, dy);

    // Angle pointing from prev -> curr (back along body)
    let backAngle = dist > 1e-5 ? Math.atan2(dy, dx) : prev.angle + Math.PI;

    // Reference backward angle of parent segment
    const parentBackAngle =
      i === 2
        ? headPivot.angle + Math.PI
        : Math.atan2(prev.y - points[i - 2].y, prev.x - points[i - 2].x);

    const delta = normalizeAngle(backAngle - parentBackAngle);
    if (Math.abs(delta) > maxTurnAngle) {
      // Guard against ±π sign-flip discontinuity: if a segment ever approaches opposite
      // alignment, preserve its previous bend side rather than teleporting across the body.
      let bendSign = Math.sign(delta);
      if (Math.abs(delta) > Math.PI * 0.85 || bendSign === 0) {
        const prevBackAngle = normalizeAngle(curr.angle + Math.PI);
        const prevDelta = normalizeAngle(prevBackAngle - parentBackAngle);
        bendSign = prevDelta >= 0 ? 1 : -1;
      }
      backAngle = parentBackAngle + bendSign * maxTurnAngle;
    }

    curr.x = prev.x + Math.cos(backAngle) * segmentLength;
    curr.y = prev.y + Math.sin(backAngle) * segmentLength;
    // Forward tangent angle (pointing toward head)
    curr.angle = normalizeAngle(backAngle + Math.PI);
  }
}

export interface StepSpineOptions {
  targetX: number;
  targetY: number;
  speed: number;
  dt: number;
  isResting?: boolean;
  isUpsideDown?: boolean;
  bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}

export function stepSpine(spine: SnakeSpine, opts: StepSpineOptions): void {
  const { targetX, targetY, speed, dt, isResting = false, isUpsideDown = false, bounds } = opts;
  const headPivot = spine.points[1] ?? spine.points[0];
  if (!headPivot) return;

  const dx = targetX - headPivot.x;
  const dy = targetY - headPivot.y;
  const distToTarget = Math.hypot(dx, dy);

  // Start with normalized desire toward target
  let dirX = distToTarget > 1e-4 ? dx / distToTarget : Math.cos(spine.heading);
  let dirY = distToTarget > 1e-4 ? dy / distToTarget : Math.sin(spine.heading);
  let wallUrgency = 0;

  // Smooth anticipatory wall-avoidance steering (never teleports heading on wall contact)
  let padX = 0;
  let padY = 0;
  if (bounds) {
    const spanX = Math.max(1, bounds.maxX - bounds.minX);
    const spanY = Math.max(1, bounds.maxY - bounds.minY);
    const idealPad = spine.baseRadius * 1.35 + spine.segmentLength;
    padX = Math.min(idealPad, spanX * 0.32);
    padY = Math.min(idealPad, spanY * 0.32);

    const safeMinX = bounds.minX + padX;
    const safeMaxX = bounds.maxX - padX;
    const safeMinY = bounds.minY + padY;
    const safeMaxY = bounds.maxY - padY;

    const marginX = Math.max(12, Math.min(56, (safeMaxX - safeMinX) * 0.35));
    const marginY = Math.max(10, Math.min(48, (safeMaxY - safeMinY) * 0.35));

    let avoidX = 0;
    let avoidY = 0;
    if (headPivot.x < safeMinX + marginX) {
      const t = Math.min(1, Math.max(0, (safeMinX + marginX - headPivot.x) / marginX));
      avoidX += t * t * 2.6;
      wallUrgency = Math.max(wallUrgency, t);
    } else if (headPivot.x > safeMaxX - marginX) {
      const t = Math.min(1, Math.max(0, (headPivot.x - (safeMaxX - marginX)) / marginX));
      avoidX -= t * t * 2.6;
      wallUrgency = Math.max(wallUrgency, t);
    }

    if (headPivot.y < safeMinY + marginY) {
      const t = Math.min(1, Math.max(0, (safeMinY + marginY - headPivot.y) / marginY));
      avoidY += t * t * 2.6;
      wallUrgency = Math.max(wallUrgency, t);
    } else if (headPivot.y > safeMaxY - marginY) {
      const t = Math.min(1, Math.max(0, (headPivot.y - (safeMaxY - marginY)) / marginY));
      avoidY -= t * t * 2.6;
      wallUrgency = Math.max(wallUrgency, t);
    }

    if (avoidX !== 0 || avoidY !== 0) {
      dirX += avoidX;
      dirY += avoidY;
    }
  }

  const desiredAngle =
    Math.hypot(dirX, dirY) > 1e-4 ? Math.atan2(dirY, dirX) : spine.heading;
  const angleDiff = normalizeAngle(desiredAngle - spine.heading);

  // Calm ball python turn speed, gently boosted when curving away from glass
  const baseSteerRate = isResting ? 1.15 : 2.1;
  const maxSteerRate = baseSteerRate + wallUrgency * 1.4;
  const steerStep = Math.max(-maxSteerRate * dt, Math.min(maxSteerRate * dt, angleDiff));
  spine.heading = normalizeAngle(spine.heading + steerStep);

  // Slither undulation synced to movement speed
  const activeSpeed = isResting
    ? speed * 0.16
    : distToTarget < 18
      ? speed * 0.25
      : speed;

  // Advance head S-weave phase proportionally to ground distance traveled so the snake carves
  // ~1.75 sweeping, ground-anchored S-curves along its body regardless of crawl speed
  spine.slitherPhase += dt * (isResting ? 0.35 : activeSpeed * 0.044);
  spine.wobblePhase += dt * 4.2;

  // Fluid ground-carving head S-weave + adorable Dinnerbone Spider head wobble
  // Gently dampen lateral weave when curving tightly along glass borders
  const slitherAmp = (isResting ? 0.1 : 0.52) * (1 - wallUrgency * 0.5);
  const wobbleOffset = isUpsideDown
    ? Math.sin(spine.wobblePhase) * (0.22 * (1 - wallUrgency * 0.4))
    : 0;
  let desiredMoveAngle = normalizeAngle(
    spine.heading + Math.sin(spine.slitherPhase) * slitherAmp + wobbleOffset
  );

  // Keep desired head orientation strictly inside natural neck bend limit relative to node 2 -> node 1
  // (strictly < maxTurnAngle so solveDistanceAndAngleConstraints never yanks node 2 off the trail)
  if (spine.points.length >= 3) {
    const neck = spine.points[2];
    const neckForward = Math.atan2(headPivot.y - neck.y, headPivot.x - neck.x);
    const neckDelta = normalizeAngle(desiredMoveAngle - neckForward);
    const maxNeckFold = spine.maxTurnAngle * 0.82;
    if (Math.abs(neckDelta) > maxNeckFold) {
      desiredMoveAngle = normalizeAngle(neckForward + Math.sign(neckDelta) * maxNeckFold);
    }
  }

  // Smoothly rate-limit head pivot rotation per frame AND bound ground-track curvature
  // so the recorded trail never bends tighter than maxTurnAngle per segmentLength
  const headDelta = normalizeAngle(desiredMoveAngle - headPivot.angle);
  const stepDist = Math.max(0.2, activeSpeed * dt);
  const curvatureHeadLimit = (stepDist / Math.max(1, spine.segmentLength)) * spine.maxTurnAngle * 0.85;
  const maxHeadStep = Math.min(4.6 * dt, spine.maxTurnAngle * 0.42, curvatureHeadLimit);
  const clampedHeadStep = Math.max(-maxHeadStep, Math.min(maxHeadStep, headDelta));
  const nextHeadAngle = normalizeAngle(headPivot.angle + clampedHeadStep);

  // Advance and pivot around node 1 (the skull center), carrying the snout rigidly ahead
  const prevHeadX = headPivot.x;
  const prevHeadY = headPivot.y;
  headPivot.angle = nextHeadAngle;
  headPivot.x += Math.cos(nextHeadAngle) * activeSpeed * dt;
  headPivot.y += Math.sin(nextHeadAngle) * activeSpeed * dt;

  // Soft positional clamp only — if wall contact redirects motion, smoothly align head angle
  let wasClamped = false;
  if (bounds) {
    const safeMinX = bounds.minX + padX;
    const safeMaxX = bounds.maxX - padX;
    const safeMinY = bounds.minY + padY;
    const safeMaxY = bounds.maxY - padY;
    if (headPivot.x < safeMinX) {
      headPivot.x = safeMinX;
      wasClamped = true;
    } else if (headPivot.x > safeMaxX) {
      headPivot.x = safeMaxX;
      wasClamped = true;
    }
    if (headPivot.y < safeMinY) {
      headPivot.y = safeMinY;
      wasClamped = true;
    } else if (headPivot.y > safeMaxY) {
      headPivot.y = safeMaxY;
      wasClamped = true;
    }
  }

  const headMoved = Math.hypot(headPivot.x - prevHeadX, headPivot.y - prevHeadY);

  // Ground-referenced path following: record headPivot's exact ground track and pull body
  // segments monotonically along the head's ground coordinates so curves stay pinned to the substrate.
  if (!spine.trail || spine.trail.length === 0) {
    spine.trail = buildSmoothTrailFromPoints(spine.points, 6);
  }

  if (wasClamped) {
    // During tight glass wall contact, rely on smooth constraint following and resync a smooth dense trail
    solveDistanceAndAngleConstraints(spine.points, spine.segmentLength, spine.maxTurnAngle);
    spine.trail = buildSmoothTrailFromPoints(spine.points, 6);
  } else {
    if (headMoved > 1e-4) {
      const first = spine.trail[0];
      const second = spine.trail[1];
      const distFromSecond = second
        ? Math.hypot(headPivot.x - second.x, headPivot.y - second.y)
        : Infinity;

      if (!first || distFromSecond >= 1.5) {
        spine.trail.unshift({ x: headPivot.x, y: headPivot.y });
      } else {
        first.x = headPivot.x;
        first.y = headPivot.y;
      }

      // Sample body segments monotonically along the head's ground trail
      for (let i = 2; i < spine.points.length; i++) {
        const sampled = sampleTrailAtArcLength(spine.trail, (i - 1) * spine.segmentLength);
        if (sampled) {
          spine.points[i].x = sampled.x;
          spine.points[i].y = sampled.y;
        }
      }

      // Trim trail beyond body length + a small buffer so memory stays bounded O(N)
      const maxTrailLen = (spine.points.length + 2) * spine.segmentLength;
      let totalLen = 0;
      for (let i = 1; i < spine.trail.length; i++) {
        totalLen += Math.hypot(
          spine.trail[i].x - spine.trail[i - 1].x,
          spine.trail[i].y - spine.trail[i - 1].y
        );
        if (totalLen > maxTrailLen) {
          spine.trail.length = i + 1;
          break;
        }
      }
    }

    // Lock snout ahead of head pivot and verify exact segment distances & angular bounds
    solveDistanceAndAngleConstraints(spine.points, spine.segmentLength, spine.maxTurnAngle);
  }

  // Tongue flick timer
  if (spine.tongueActive > 0) {
    spine.tongueActive = Math.max(0, spine.tongueActive - dt);
  } else {
    spine.tongueTimer -= dt;
    if (spine.tongueTimer <= 0) {
      spine.tongueActive = 0.42;
      spine.tongueTimer = 3.2 + Math.random() * 5.5;
    }
  }
}

export interface OutlineGeometry {
  left: Array<{ x: number; y: number }>;
  right: Array<{ x: number; y: number }>;
  headCap: Array<{ x: number; y: number }>;
  tailCap: Array<{ x: number; y: number }>;
}

/**
 * Generates smooth left/right boundary points and rounded snout/tail caps
 * by projecting along each spine segment's normal vector (Argonaut skinning step).
 */
export function computeOutlineGeometry(spine: SnakeSpine): OutlineGeometry {
  const pts = spine.points;
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const normalX = -Math.sin(p.angle);
    const normalY = Math.cos(p.angle);
    left.push({
      x: p.x + normalX * p.radius,
      y: p.y + normalY * p.radius,
    });
    right.push({
      x: p.x - normalX * p.radius,
      y: p.y - normalY * p.radius,
    });
  }

  const snout = pts[0];
  const headCap: Array<{ x: number; y: number }> = [];
  const snoutStretch = 1.15;
  for (let s = 1; s <= 5; s++) {
    const a = snout.angle - Math.PI / 2 + (s / 6) * Math.PI;
    const isFront = Math.cos(a - snout.angle);
    const r = snout.radius * (1 + Math.max(0, isFront) * (snoutStretch - 1));
    headCap.push({
      x: snout.x + Math.cos(a) * r,
      y: snout.y + Math.sin(a) * r,
    });
  }

  const tail = pts[pts.length - 1];
  const tailCap: Array<{ x: number; y: number }> = [];
  for (let s = 1; s <= 3; s++) {
    const a = tail.angle + Math.PI / 2 + (s / 4) * Math.PI;
    tailCap.push({
      x: tail.x + Math.cos(a) * tail.radius * 1.15,
      y: tail.y + Math.sin(a) * tail.radius * 1.15,
    });
  }

  return { left, right, headCap, tailCap };
}

export function hitTestSpine(spine: SnakeSpine, x: number, y: number, extraPadding = 10): boolean {
  for (let i = 0; i < spine.points.length; i++) {
    const p = spine.points[i];
    const d = Math.hypot(x - p.x, y - p.y);
    if (d <= p.radius + extraPadding) {
      return true;
    }
  }
  return false;
}
