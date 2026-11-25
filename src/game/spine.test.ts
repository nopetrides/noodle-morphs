import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOutlineGeometry,
  createSpine,
  getBallPythonRadius,
  hitTestSpine,
  normalizeAngle,
  stepSpine,
} from './spine';

test('Spine maintains exact fixed segment distances after stepping', () => {
  const spine = createSpine(300, 300, 0, 26, 11, 15);
  for (let frame = 0; frame < 90; frame++) {
    stepSpine(spine, {
      targetX: 500 + Math.cos(frame * 0.1) * 140,
      targetY: 320 + Math.sin(frame * 0.1) * 140,
      speed: 55,
      dt: 1 / 60,
    });
  }

  for (let i = 1; i < spine.points.length; i++) {
    const prev = spine.points[i - 1];
    const curr = spine.points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    assert.ok(
      Math.abs(dist - spine.segmentLength) < 1e-4,
      `Segment ${i} drifted from fixed distance: ${dist} vs ${spine.segmentLength}`
    );
  }
});

test('Angular constraint prevents sharp unnatural kinks between adjacent segments', () => {
  const spine = createSpine(200, 200, 0, 24, 10, 14);
  // Force rapid U-turn target directly behind the head
  for (let frame = 0; frame < 40; frame++) {
    stepSpine(spine, {
      targetX: 50,
      targetY: 205,
      speed: 80,
      dt: 1 / 60,
    });
  }

  for (let i = 2; i < spine.points.length; i++) {
    const a1 = Math.atan2(
      spine.points[i - 1].y - spine.points[i - 2].y,
      spine.points[i - 1].x - spine.points[i - 2].x
    );
    const a2 = Math.atan2(
      spine.points[i].y - spine.points[i - 1].y,
      spine.points[i].x - spine.points[i - 1].x
    );
    const turn = Math.abs(normalizeAngle(a2 - a1));
    assert.ok(
      turn <= spine.maxTurnAngle + 1e-3,
      `Segment ${i} exceeded max turn angle: ${turn} > ${spine.maxTurnAngle}`
    );
  }
});

test('Ball python radius profile has plump mid-body, narrower neck, and tapered tail', () => {
  const neck = getBallPythonRadius(0.12, 16);
  const mid = getBallPythonRadius(0.45, 16);
  const tail = getBallPythonRadius(1.0, 16);

  assert.ok(mid > neck, 'Mid-body should be plumper than tucked neck');
  assert.ok(neck > tail, 'Neck should be wider than tail tip');
  assert.ok(tail > 0, 'Tail tip radius should stay positive');
});

test('Outline geometry and body hit-testing match spine coordinates', () => {
  const spine = createSpine(400, 250, 0, 20, 10, 15);
  const geom = computeOutlineGeometry(spine);
  assert.equal(geom.left.length, 20);
  assert.equal(geom.right.length, 20);
  assert.ok(geom.headCap.length > 0);
  assert.ok(geom.tailCap.length > 0);

  const mid = spine.points[10];
  assert.equal(hitTestSpine(spine, mid.x, mid.y), true);
  assert.equal(hitTestSpine(spine, mid.x + 500, mid.y + 500), false);
});

test('Rigid head pivot keeps snout (node 0) strictly aligned with head (node 1) while turning', () => {
  const spine = createSpine(300, 300, 0, 26, 10.5, 15);
  for (let frame = 0; frame < 50; frame++) {
    stepSpine(spine, {
      targetX: 120,
      targetY: 460,
      speed: 75,
      dt: 1 / 60,
    });

    const snout = spine.points[0];
    const head = spine.points[1];
    assert.equal(snout.angle, head.angle, 'Snout angle must stay locked to head pivot angle');

    const snoutDir = Math.atan2(snout.y - head.y, snout.x - head.x);
    const alignmentError = Math.abs(normalizeAngle(snoutDir - head.angle));
    assert.ok(
      alignmentError < 1e-5,
      `Snout drifted off head axis during turn: ${alignmentError}`
    );

    const snoutDist = Math.hypot(snout.x - head.x, snout.y - head.y);
    assert.ok(
      Math.abs(snoutDist - spine.segmentLength) < 1e-4,
      `Snout-to-head distance drifted: ${snoutDist}`
    );
  }
});

test('Spine never snaps chain or teleports head angle when hitting tight borders or turning sharply', () => {
  // Simulate exact Hatch Reveal MiniSnakeCanvas tight 238x90 frame with Spider wobble enabled
  const width = 238;
  const height = 90;
  const segLen = Math.max(4.8, Math.min(width * 0.027, height * 0.072));
  const baseRad = Math.max(7, Math.min(height * 0.088, 10.5));
  const spine = createSpine(width * 0.62, height * 0.52, 0, 20, segLen, baseRad);
  const bounds = { minX: 8, maxX: width - 8, minY: 8, maxY: height - 8 };

  let phase = 0.75;
  const dt = 0.05; // worst-case frame delta (~20fps)

  for (let frame = 0; frame < 400; frame++) {
    const prevPoints = spine.points.map((p) => ({ x: p.x, y: p.y, angle: p.angle }));
    phase += dt * 1.0;

    // Deliberately drive targets past borders on some frames to stress wall avoidance
    const targetX =
      frame % 90 < 20
        ? frame % 180 < 90
          ? -40
          : width + 40
        : width * 0.5 + Math.cos(phase) * (width * 0.24);
    const targetY =
      frame % 70 < 15
        ? frame % 140 < 70
          ? -30
          : height + 30
        : height * 0.52 + Math.sin(phase * 2) * (height * 0.14);

    stepSpine(spine, {
      targetX,
      targetY,
      speed: 44,
      dt,
      isUpsideDown: true,
      bounds,
    });

    const headAngleJump = Math.abs(normalizeAngle(spine.points[1].angle - prevPoints[1].angle));
    assert.ok(
      headAngleJump <= 0.25,
      `Frame ${frame}: head angle snapped by ${headAngleJump.toFixed(3)} rad`
    );

    // Every spine node must move continuously without chain-whip snapping
    for (let i = 0; i < spine.points.length; i++) {
      const moveDist = Math.hypot(
        spine.points[i].x - prevPoints[i].x,
        spine.points[i].y - prevPoints[i].y
      );
      assert.ok(
        moveDist < 8.5,
        `Frame ${frame} node ${i}: chain snapped by ${moveDist.toFixed(2)}px in one frame`
      );
    }
  }
});

test('Body segments follow the exact ground path carved by the head pivot with organic S-curves', () => {
  const spine = createSpine(100, 300, 0, 24, 11, 15);
  const headHistory: Array<{ x: number; y: number }> = [];

  // Drive straight to the right for 360 frames so the entire body rides on newly carved head track
  for (let frame = 0; frame < 360; frame++) {
    stepSpine(spine, {
      targetX: 4000,
      targetY: 300,
      speed: 48,
      dt: 1 / 60,
    });
    headHistory.push({ x: spine.points[1].x, y: spine.points[1].y });
  }

  // Mid-body segments should have natural S-curve spread from the head's ground track
  const midYs = spine.points.slice(5, 18).map((p) => p.y);
  const lateralSpread = Math.max(...midYs) - Math.min(...midYs);
  assert.ok(
    lateralSpread > 8,
    `Expected organic ground-track S-curve spread > 8px, got ${lateralSpread.toFixed(2)}px`
  );

  // Every body segment (nodes 2..20) must lie right on the ground track previously visited by headPivot!
  for (let i = 2; i <= 20; i++) {
    const seg = spine.points[i];
    let minDist = Infinity;
    for (const h of headHistory) {
      const d = Math.hypot(seg.x - h.x, seg.y - h.y);
      if (d < minDist) minDist = d;
    }
    assert.ok(
      minDist < 3.5,
      `Body node ${i} drifted ${minDist.toFixed(2)}px away from the head's ground path`
    );
  }
});



