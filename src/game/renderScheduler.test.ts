import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWildTypeGenotype,
  evaluatePhenotype,
  resolveSkinSpecForPhenotype,
} from './genetics';
import {
  createSeededPreviewSpine,
  createSeededWanderOrbit,
  getSharedStaticPreviewSpine,
  requestSkinAsync,
  scheduleCanvasPaint,
} from './renderScheduler';
import { globalSkinCache } from './skinCache';
import { normalizeAngle, stepSpine } from './spine';
import { computeSpriteSheetLayout } from './spriteSheet';

test('globalSkinCache.getCached and putSynthesized round-trip externally synthesized pixels', () => {
  globalSkinCache.clear();
  const pheno = evaluatePhenotype(createWildTypeGenotype(), 0.31);
  const spec = resolveSkinSpecForPhenotype(pheno);

  assert.equal(globalSkinCache.getCached(spec, pheno.palette, 0.31, 64, 16, 'final'), null);

  const synthetic = new Uint8ClampedArray(64 * 16 * 4);
  synthetic.fill(180);
  const stored = globalSkinCache.putSynthesized(
    spec,
    pheno.palette,
    0.31,
    64,
    16,
    synthetic,
    'final'
  );

  assert.equal(stored.width, 64);
  assert.equal(stored.height, 16);
  assert.equal(stored.pixels[0], 180);

  const hit = globalSkinCache.getCached(spec, pheno.palette, 0.31, 64, 16, 'final');
  assert.ok(hit);
  assert.equal(hit, stored);
});

test('requestSkinAsync deduplicates concurrent requests and caches result for instant subsequent hits', async () => {
  globalSkinCache.clear();
  const pheno = evaluatePhenotype(
    { ...createWildTypeGenotype(), bismuth: [1, 1] },
    0.55
  );
  const spec = resolveSkinSpecForPhenotype(pheno);

  const [a, b] = await Promise.all([
    requestSkinAsync(spec, pheno.palette, 0.55, 64, 16, 'final', 'normal'),
    requestSkinAsync(spec, pheno.palette, 0.55, 64, 16, 'final', 'high'),
  ]);

  assert.equal(a, b, 'Concurrent identical requests should resolve to the exact same cached entry');
  assert.equal(a.pixels.length, 64 * 16 * 4);

  const cached = globalSkinCache.getCached(spec, pheno.palette, 0.55, 64, 16, 'final');
  assert.equal(cached, a);

  const c = await requestSkinAsync(spec, pheno.palette, 0.55, 64, 16, 'final', 'normal');
  assert.equal(c, a);
});

test('getSharedStaticPreviewSpine caches seeded spines per dimensions, posture, and seed', () => {
  const s1 = getSharedStaticPreviewSpine(250, 92, false, 0.25);
  const s2 = getSharedStaticPreviewSpine(250, 92, false, 0.25);
  const sSeed2 = getSharedStaticPreviewSpine(250, 92, false, 0.81);
  const sUp = getSharedStaticPreviewSpine(250, 92, true, 0.25);
  const sOther = getSharedStaticPreviewSpine(236, 90, false, 0.25);

  assert.equal(s1, s2, 'Identical dimensions + posture + seed should reuse the exact same spine instance');
  assert.notEqual(s1, sSeed2, 'Different snake seeds should produce unique poses');
  assert.notEqual(s1, sUp, 'Upside-down posture should have its own spine');
  assert.notEqual(s1, sOther, 'Different card dimensions should have their own spine');
  assert.equal(s1.points.length, 20);
});

test('createSeededPreviewSpine gives varied pos/rot per seed while staying strictly in-bounds and uncurled', () => {
  const sizes: Array<[number, number]> = [
    [250, 92],
    [238, 90],
    [300, 100],
    [64, 28],
  ];

  for (const [w, h] of sizes) {
    let facingLeft = 0;
    let facingRight = 0;
    const headXs: number[] = [];
    const headYs: number[] = [];

    for (let i = 0; i < 60; i++) {
      const seed = (i + 0.37) / 60;
      const spine = createSeededPreviewSpine(w, h, seed, i % 7 === 0);
      assert.equal(spine.points.length, 20);

      // 1. Strictly inside canvas bounds (including full body radius)
      for (const p of spine.points) {
        assert.ok(
          p.x - p.radius >= 0 && p.x + p.radius <= w,
          `Out of X bounds on ${w}x${h} for seed ${seed}: x=${p.x}, r=${p.radius}`
        );
        assert.ok(
          p.y - p.radius >= 0 && p.y + p.radius <= h,
          `Out of Y bounds on ${w}x${h} for seed ${seed}: y=${p.y}, r=${p.radius}`
        );
      }

      // 2. Never fully curled up: snout-to-tail span must stay open (>= 55% of total body arc length)
      const head = spine.points[0];
      const tail = spine.points[spine.points.length - 1];
      const span = Math.hypot(head.x - tail.x, head.y - tail.y);
      const arcLength = spine.segmentLength * (spine.points.length - 1);
      assert.ok(
        span >= arcLength * 0.55,
        `Snake too curled on ${w}x${h} for seed ${seed}: span=${span.toFixed(1)}, arc=${arcLength.toFixed(1)}`
      );

      // 3. No tight self-folding between non-adjacent segments
      for (let a = 0; a < spine.points.length; a++) {
        for (let b = a + 4; b < spine.points.length; b++) {
          const dist = Math.hypot(
            spine.points[a].x - spine.points[b].x,
            spine.points[a].y - spine.points[b].y
          );
          assert.ok(
            dist >= spine.segmentLength * 1.4,
            `Self-curled segments (${a},${b}) on ${w}x${h} seed ${seed}: dist=${dist.toFixed(1)}`
          );
        }
      }

      if (Math.cos(spine.heading) >= 0) facingRight++;
      else facingLeft++;
      headXs.push(spine.points[1].x);
      headYs.push(spine.points[1].y);
    }

    // 4. Genuine variety in orientation and starting position across seeds
    assert.ok(facingLeft >= 10 && facingRight >= 10, `Expected both left & right orientations on ${w}x${h}`);
    const spreadX = Math.max(...headXs) - Math.min(...headXs);
    const spreadY = Math.max(...headYs) - Math.min(...headYs);
    assert.ok(spreadX > w * 0.35, `Expected varied head X positions on ${w}x${h}, got spread=${spreadX.toFixed(1)}`);
    assert.ok(spreadY > h * 0.12, `Expected varied head Y positions on ${w}x${h}, got spread=${spreadY.toFixed(1)}`);
  }
});

test('createSeededWanderOrbit produces distinct, bounded wander paths for different seeds', () => {
  const w = 238;
  const h = 90;
  const orbitA = createSeededWanderOrbit(w, h, 0.17, 0);
  const orbitB = createSeededWanderOrbit(w, h, 0.63, 0);
  const orbitACopy = createSeededWanderOrbit(w, h, 0.17, 0);

  let maxDivergence = 0;
  for (let step = 0; step <= 20; step++) {
    const t = step * 0.4;
    const a = orbitA.sample(t);
    const b = orbitB.sample(t);
    const aCopy = orbitACopy.sample(t);

    // Deterministic for identical seed
    assert.equal(a.targetX, aCopy.targetX);
    assert.equal(a.targetY, aCopy.targetY);
    assert.equal(a.speed, aCopy.speed);

    // Strictly inside safe margins
    assert.ok(a.targetX >= 12 && a.targetX <= w - 12);
    assert.ok(a.targetY >= 10 && a.targetY <= h - 10);
    assert.ok(b.targetX >= 12 && b.targetX <= w - 12);
    assert.ok(b.targetY >= 10 && b.targetY <= h - 10);

    const d = Math.hypot(a.targetX - b.targetX, a.targetY - b.targetY);
    if (d > maxDivergence) maxDivergence = d;
  }

  assert.ok(
    maxDivergence > 35,
    `Expected distinct seeds to diverge significantly in wander path, got maxDivergence=${maxDivergence.toFixed(1)}`
  );
  assert.notEqual(orbitA.sample(0).speed, orbitB.sample(0).speed);
});

test('Seeded spine has dense smooth trail and glides through stepSpine with zero chugging or joint snaps', () => {
  const w = 238;
  const h = 90;
  for (const seed of [0.05, 0.17, 0.37, 0.52, 0.64, 0.89]) {
    const spine = createSeededPreviewSpine(w, h, seed, false);
    assert.ok(
      spine.trail.length >= (spine.points.length - 2) * 5,
      `Expected dense sub-segment trail, got ${spine.trail.length} points`
    );

    const orbit = createSeededWanderOrbit(w, h, seed, spine.heading);
    let elapsed = 0;
    const totalBodyLen = spine.segmentLength * (spine.points.length + 2);
    const warmupSteps = Math.max(180, Math.min(300, Math.ceil((totalBodyLen / 28) * 60)));
    for (let i = 0; i < warmupSteps; i++) {
      elapsed += 1 / 60;
      const { targetX, targetY, speed } = orbit.sample(elapsed);
      stepSpine(spine, {
        targetX,
        targetY,
        speed,
        dt: 1 / 60,
        bounds: { minX: 8, maxX: w - 8, minY: 8, maxY: h - 8 },
      });
    }

    // Verify 120 live animation frames at MiniSnakeCanvas's real 50ms tick step
    for (let frame = 0; frame < 120; frame++) {
      const prevAngles = spine.points.map((p) => p.angle);
      elapsed += 0.05;
      const { targetX, targetY, speed } = orbit.sample(elapsed);
      stepSpine(spine, {
        targetX,
        targetY,
        speed,
        dt: 0.05,
        bounds: { minX: 8, maxX: w - 8, minY: 8, maxY: h - 8 },
      });

      // No segment should ever snap angle abruptly on a live tick
      for (let i = 0; i < spine.points.length; i++) {
        const dAng = Math.abs(normalizeAngle(spine.points[i].angle - prevAngles[i]));
        assert.ok(
          dAng < 0.28,
          `Sudden joint snap at seg ${i}, frame ${frame}, seed ${seed}: dAng=${dAng.toFixed(3)}`
        );
      }
    }
  }
});

test('scheduleCanvasPaint executes immediately in headless Node environments', () => {
  let called = 0;
  const cancel = scheduleCanvasPaint(() => {
    called++;
  });
  assert.equal(called, 1);
  assert.equal(typeof cancel, 'function');
});

test('computeSpriteSheetLayout scales dynamically for 149-snake sheet', () => {
  const withUv = computeSpriteSheetLayout(149, true);
  assert.equal(withUv.cols, 6);
  assert.equal(withUv.pairCount, 74);
  assert.equal(withUv.rows, 25);
  assert.equal(withUv.cellH, 168);

  const withoutUv = computeSpriteSheetLayout(149, false);
  assert.equal(withoutUv.cellH, 148);
  assert.ok(withoutUv.height < withUv.height);
});
