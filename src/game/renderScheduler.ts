import { buildSkinCacheKey, type CachedSkinEntry, globalSkinCache } from './skinCache';
import {
  buildSmoothTrailFromPoints,
  getBallPythonRadius,
  normalizeAngle,
  solveDistanceAndAngleConstraints,
} from './spine';
import type {
  SkinWorkerMessage,
  SkinWorkerRequest,
  SkinWorkerResponse,
} from './skinWorker';
import type { SkinDebugStage, SkinPhenotypeSpec, SnakePalette, SnakeSpine, SpinePoint } from './types';

export type RenderPriority = 'high' | 'normal';

interface PendingJob {
  id: number;
  key: string;
  request: Omit<SkinWorkerRequest, 'id'>;
  priority: RenderPriority;
  resolvers: Array<(entry: CachedSkinEntry) => void>;
  rejecters: Array<(err: unknown) => void>;
}

interface WorkerSlot {
  worker: Worker;
  busyJobId: number | null;
}

const MAX_WORKERS =
  typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
    ? Math.max(1, Math.min(3, Math.floor(navigator.hardwareConcurrency / 2)))
    : 2;

let nextJobId = 1;
let workerPoolInitialized = false;
let workersSupported = false;
const workerSlots: WorkerSlot[] = [];
const activeJobsById = new Map<number, PendingJob>();
const pendingJobsByKey = new Map<string, PendingJob>();
const highPriorityQueue: PendingJob[] = [];
const normalPriorityQueue: PendingJob[] = [];
let fallbackTimer: number | null = null;
let idleWorkerTimer: number | null = null;
const WORKER_IDLE_TIMEOUT_MS = 15_000;
const syncedWorkerMaps = new Map<string, { width: number; height: number; data: Float32Array }>();

/**
 * Terminates idle skin Web Workers after inactivity so resting browser tabs release
 * worker heap memory (~15–30 MB) and respawn transparently on the next lazy card/sheet load.
 */
export function terminateIdleSkinWorkers(): void {
  if (idleWorkerTimer !== null) {
    globalThis.clearTimeout(idleWorkerTimer);
    idleWorkerTimer = null;
  }
  if (activeJobsById.size > 0 || highPriorityQueue.length > 0 || normalPriorityQueue.length > 0) {
    return;
  }
  for (const slot of workerSlots) {
    try {
      slot.worker.terminate();
    } catch {
      // Ignore worker termination errors
    }
  }
  workerSlots.length = 0;
  workerPoolInitialized = false;
  workersSupported = false;
}

function scheduleIdleWorkerCleanup(): void {
  if (idleWorkerTimer !== null) {
    globalThis.clearTimeout(idleWorkerTimer);
    idleWorkerTimer = null;
  }
  if (
    workerSlots.length === 0 ||
    activeJobsById.size > 0 ||
    highPriorityQueue.length > 0 ||
    normalPriorityQueue.length > 0
  ) {
    return;
  }
  idleWorkerTimer = globalThis.setTimeout(() => {
    idleWorkerTimer = null;
    terminateIdleSkinWorkers();
  }, WORKER_IDLE_TIMEOUT_MS) as unknown as number;
}

/**
 * Syncs a registered custom grayscale UV map into the Web Worker pool (and replays it to any
 * workers spawned later) so Workshop `custom_map` textures render identically off-thread.
 */
export function syncGrayscaleMapToWorkers(
  id: string,
  width: number,
  height: number,
  data: Float32Array
): void {
  syncedWorkerMaps.set(id, { width, height, data });
  if (!workersSupported || workerSlots.length === 0) return;
  const msg: SkinWorkerMessage = { type: 'register_map', id, width, height, data };
  for (const slot of workerSlots) {
    slot.worker.postMessage(msg);
  }
}

export function unsyncGrayscaleMapFromWorkers(id: string): void {
  syncedWorkerMaps.delete(id);
  if (!workersSupported || workerSlots.length === 0) return;
  const msg: SkinWorkerMessage = { type: 'unregister_map', id };
  for (const slot of workerSlots) {
    slot.worker.postMessage(msg);
  }
}

function ensureWorkerPool(): boolean {
  if (workerPoolInitialized) return workersSupported;
  workerPoolInitialized = true;
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    workersSupported = false;
    return false;
  }

  try {
    for (let i = 0; i < MAX_WORKERS; i++) {
      const worker = new Worker(new URL('./skinWorker.ts', import.meta.url), { type: 'module' });
      const slot: WorkerSlot = { worker, busyJobId: null };
      worker.onmessage = (event: MessageEvent<SkinWorkerResponse>) => {
        const { id, pixels, width, height } = event.data;
        slot.busyJobId = null;
        const job = activeJobsById.get(id);
        if (job) {
          activeJobsById.delete(id);
          pendingJobsByKey.delete(job.key);
          const { spec, palette, seed, debugStage } = job.request;
          const entry = globalSkinCache.putSynthesized(
            spec,
            palette,
            seed,
            width,
            height,
            pixels,
            debugStage
          );
          for (const resolve of job.resolvers) resolve(entry);
        }
        pumpWorkerQueue();
      };
      worker.onerror = () => {
        // Fallback seamlessly to cooperative main-thread synthesis if worker fails
        const failedId = slot.busyJobId;
        slot.busyJobId = null;
        if (failedId !== null) {
          const job = activeJobsById.get(failedId);
          if (job) {
            activeJobsById.delete(failedId);
            pendingJobsByKey.delete(job.key);
            const { spec, palette, seed, width, height, debugStage } = job.request;
            const entry = globalSkinCache.getOrSynthesize(spec, palette, seed, width, height, debugStage);
            for (const resolve of job.resolvers) resolve(entry);
          }
        }
        pumpWorkerQueue();
      };
      workerSlots.push(slot);
      // Replay any already-registered custom grayscale maps to this newly spawned worker
      for (const [mapId, map] of syncedWorkerMaps.entries()) {
        const msg: SkinWorkerMessage = {
          type: 'register_map',
          id: mapId,
          width: map.width,
          height: map.height,
          data: map.data,
        };
        worker.postMessage(msg);
      }
    }
    workersSupported = workerSlots.length > 0;
  } catch {
    workersSupported = false;
  }
  return workersSupported;
}

function dequeueNextJob(): PendingJob | null {
  while (highPriorityQueue.length > 0) {
    const job = highPriorityQueue.shift()!;
    if (pendingJobsByKey.has(job.key) && !activeJobsById.has(job.id)) return job;
  }
  while (normalPriorityQueue.length > 0) {
    const job = normalPriorityQueue.shift()!;
    if (pendingJobsByKey.has(job.key) && !activeJobsById.has(job.id)) return job;
  }
  return null;
}

function pumpWorkerQueue(): void {
  if (workersSupported && workerSlots.length > 0) {
    if (idleWorkerTimer !== null) {
      globalThis.clearTimeout(idleWorkerTimer);
      idleWorkerTimer = null;
    }
    for (const slot of workerSlots) {
      if (slot.busyJobId !== null) continue;
      const job = dequeueNextJob();
      if (!job) break;
      slot.busyJobId = job.id;
      activeJobsById.set(job.id, job);
      const payload: SkinWorkerRequest = { id: job.id, ...job.request };
      slot.worker.postMessage(payload);
    }
    scheduleIdleWorkerCleanup();
    return;
  }

  // Cooperative time-sliced main-thread fallback (keeps frames responsive even without Workers)
  if (fallbackTimer !== null) return;
  const runSlice = () => {
    fallbackTimer = null;
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let processed = 0;
    while (processed < 2) {
      const job = dequeueNextJob();
      if (!job) return;
      pendingJobsByKey.delete(job.key);
      const { spec, palette, seed, width, height, debugStage } = job.request;
      const entry = globalSkinCache.getOrSynthesize(spec, palette, seed, width, height, debugStage);
      for (const resolve of job.resolvers) resolve(entry);
      processed++;
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
      if (elapsed >= 6) break;
    }
    if (highPriorityQueue.length > 0 || normalPriorityQueue.length > 0) {
      fallbackTimer = globalThis.setTimeout(runSlice, 4) as unknown as number;
    }
  };
  fallbackTimer = globalThis.setTimeout(runSlice, 0) as unknown as number;
}

/**
 * Lazily synthesizes a procedural snake skin off the main thread via Web Workers (with automatic
 * deduplication and cooperative fallback). Returns immediately on LRU cache hits.
 */
export function requestSkinAsync(
  spec: SkinPhenotypeSpec,
  palette: SnakePalette,
  seed: number,
  width: number,
  height: number,
  debugStage: SkinDebugStage = 'final',
  priority: RenderPriority = 'normal'
): Promise<CachedSkinEntry> {
  const cached = globalSkinCache.getCached(spec, palette, seed, width, height, debugStage);
  if (cached) {
    return Promise.resolve(cached);
  }

  const key = buildSkinCacheKey(spec, palette, seed, width, height, debugStage);
  const existing = pendingJobsByKey.get(key);
  if (existing) {
    if (priority === 'high' && existing.priority !== 'high' && !activeJobsById.has(existing.id)) {
      existing.priority = 'high';
      highPriorityQueue.push(existing);
    }
    return new Promise((resolve, reject) => {
      existing.resolvers.push(resolve);
      existing.rejecters.push(reject);
    });
  }

  ensureWorkerPool();

  return new Promise((resolve, reject) => {
    const job: PendingJob = {
      id: nextJobId++,
      key,
      request: { spec, palette, seed, width, height, debugStage },
      priority,
      resolvers: [resolve],
      rejecters: [reject],
    };
    pendingJobsByKey.set(key, job);
    if (priority === 'high') {
      highPriorityQueue.push(job);
    } else {
      normalPriorityQueue.push(job);
    }
    pumpWorkerQueue();
  });
}

// --- Frame-Budgeted Progressive Canvas Paint Scheduler ---

interface PaintTask {
  fn: () => void;
  cancelled: boolean;
}

const paintQueue: PaintTask[] = [];
let paintRafId: number | null = null;

function flushPaintQueue(): void {
  paintRafId = null;
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let painted = 0;

  while (paintQueue.length > 0) {
    const task = paintQueue.shift()!;
    if (task.cancelled) continue;
    task.fn();
    painted++;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
    // Strict ~6ms per-frame paint budget after at least 1 card paints
    if (painted >= 1 && elapsed >= 6) break;
  }

  if (paintQueue.length > 0 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    paintRafId = window.requestAnimationFrame(flushPaintQueue);
  }
}

/**
 * Schedules a lightweight Canvas2D draw across animation frames with a 6ms budget so opening a
 * 30+ snake collection or morphdex never drops frames. Returns a cancel handle.
 */
export function scheduleCanvasPaint(fn: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    fn();
    return () => {};
  }
  const task: PaintTask = { fn, cancelled: false };
  paintQueue.push(task);
  if (paintRafId === null) {
    paintRafId = window.requestAnimationFrame(flushPaintQueue);
  }
  return () => {
    task.cancelled = true;
  };
}

// --- Seeded Personality Preview Spines (unique per snake, always in-bounds & never curled up) ---

function seededPoseUnit(seed: number, salt: number): number {
  const x = Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function clampVal(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface SpineBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function computeVisualSpineBounds(points: SpinePoint[]): SpineBBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Include outer body outline (+18% margin) plus snout/tail cap reach
    const pad = i === 0 ? p.radius * 1.45 + 2 : p.radius * 1.2 + 2;
    if (p.x - pad < minX) minX = p.x - pad;
    if (p.x + pad > maxX) maxX = p.x + pad;
    if (p.y - pad < minY) minY = p.y - pad;
    if (p.y + pad > maxY) maxY = p.y + pad;
  }

  return { minX, maxX, minY, maxY };
}

/**
 * Generates a unique, natural, personality-rich preview spine deterministically from a snake's seed:
 * - Randomizes facing direction (left/right), body wave polarity, diagonal tilt, S/C-curve frequency,
 *   phase, arch, subtle curious head angle, and safe framing offset inside the card.
 * - Obeys real ball python joint/curvature limits with a dense Catmull-Rom ground trail and
 *   phase-synced heading so animated snakes glide smoothly with zero polygonal chugging.
 * - Mathematically guarantees the snake stays strictly inside card bounds and never curls/coils up.
 */
export function createSeededPreviewSpine(
  width: number,
  height: number,
  seed: number,
  isUpsideDown = false
): SnakeSpine {
  const segCount = 20;
  const baseRad = clampVal(Math.min(height * 0.098, width * 0.055), 2.8, 11.2);
  let segLen = clampVal(Math.min(width * 0.029, height * 0.075), 2.0, 7.2);

  const padX = clampVal(width * 0.04, 3, 10);
  const padY = clampVal(height * 0.06, 3, 9);
  const availW = Math.max(8, width - padX * 2);
  const availH = Math.max(6, height - padY * 2);

  // Ensure even a nearly straight snake fits comfortably inside narrow/tiny thumbnails
  const maxSafeSegLen = Math.max(1.4, (availW - baseRad * 3.0) / (segCount - 1));
  if (segLen > maxSafeSegLen) {
    segLen = maxSafeSegLen;
  }

  const flipX = seededPoseUnit(seed, 1) < 0.5 ? -1 : 1;
  const flipY = seededPoseUnit(seed, 2) < 0.5 ? -1 : 1;
  const waves = 1.2 + seededPoseUnit(seed, 3) * 0.95; // 1.2 (sweeping C/S) .. 2.15 (smooth S-wave)
  const phase = seededPoseUnit(seed, 4) * Math.PI * 2;
  let amp = 0.34 + seededPoseUnit(seed, 5) * 0.34; // 0.34 .. 0.68 rad (matches live slither curvature)
  let arch = (seededPoseUnit(seed, 6) - 0.5) * 0.48; // -0.24 .. +0.24 rad
  // Keep diagonal tilt gentler on very wide/short aspect ratios
  const aspect = width / Math.max(1, height);
  const maxTilt = aspect > 2.4 ? 0.24 : 0.36;
  let tilt = (seededPoseUnit(seed, 8) - 0.5) * 2 * maxTilt;
  const offsetUnitX = seededPoseUnit(seed, 9) - 0.5;
  const offsetUnitY = seededPoseUnit(seed, 10) - 0.5;
  const upsideDownNudge = isUpsideDown ? 0.06 : 0;

  const buildCandidatePoints = (curAmp: number, curArch: number, curTilt: number): SpinePoint[] => {
    const localPts: Array<{ x: number; y: number }> = new Array(segCount);
    const maxDev = 0.74; // cos(0.74) >= 0.738 -> strictly monotonic, impossible to curl up!
    const maxStep = 0.22; // matches real stepSpine per-segment curvature limit (<= 0.46 * 0.5)

    // Evaluate continuous head tangent right at u = 0 so snout -> head -> neck has zero angular break
    const headAlpha = clampVal(
      curAmp * Math.sin(phase) + (curArch + upsideDownNudge) * -0.5,
      -maxDev * 0.85,
      maxDev * 0.85
    );

    localPts[1] = { x: 0, y: 0 };
    localPts[0] = {
      x: Math.cos(headAlpha) * segLen,
      y: Math.sin(headAlpha) * segLen,
    };

    let prevAlpha = headAlpha;
    for (let k = 1; k <= segCount - 2; k++) {
      const i = k + 1;
      const u = k / (segCount - 2);
      const rawAlpha =
        curAmp * Math.sin(u * Math.PI * waves + phase) +
        (curArch + upsideDownNudge) * (u - 0.5);
      const clampedAlpha = clampVal(rawAlpha, -maxDev, maxDev);
      const alpha = prevAlpha + clampVal(clampedAlpha - prevAlpha, -maxStep, maxStep);
      prevAlpha = alpha;

      localPts[i] = {
        x: localPts[i - 1].x - Math.cos(alpha) * segLen,
        y: localPts[i - 1].y - Math.sin(alpha) * segLen,
      };
    }

    const cosT = Math.cos(curTilt);
    const sinT = Math.sin(curTilt);
    const points: SpinePoint[] = new Array(segCount);

    for (let i = 0; i < segCount; i++) {
      const mx = localPts[i].x * flipX;
      const my = localPts[i].y * flipY;
      const rx = mx * cosT - my * sinT;
      const ry = mx * sinT + my * cosT;
      const t = i / (segCount - 1);
      points[i] = {
        x: rx,
        y: ry,
        angle: 0,
        radius: getBallPythonRadius(t, baseRad),
      };
    }

    // Assign exact forward tangents (pointing from body -> head)
    const headAngle = Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x);
    points[1].angle = headAngle;
    points[0].angle = headAngle;
    for (let i = 2; i < segCount; i++) {
      points[i].angle = normalizeAngle(
        Math.atan2(points[i - 1].y - points[i].y, points[i - 1].x - points[i].x)
      );
    }

    return points;
  };

  let points = buildCandidatePoints(amp, arch, tilt);
  let bbox = computeVisualSpineBounds(points);

  // Attenuate wave amplitude & tilt if needed so the pose always fits comfortably inside the card
  for (let attempt = 0; attempt < 6; attempt++) {
    const bw = bbox.maxX - bbox.minX;
    const bh = bbox.maxY - bbox.minY;
    if (bw <= availW && bh <= availH) break;
    amp *= 0.76;
    arch *= 0.72;
    tilt *= 0.65;
    points = buildCandidatePoints(amp, arch, tilt);
    bbox = computeVisualSpineBounds(points);
  }

  // Enforce exact rigid snout + segment distance/angle constraints
  solveDistanceAndAngleConstraints(points, segLen, 0.46);
  bbox = computeVisualSpineBounds(points);

  // Position within available slack so each snake sits naturally without ever clipping edges
  const bboxW = bbox.maxX - bbox.minX;
  const bboxH = bbox.maxY - bbox.minY;
  const slackX = Math.max(0, availW - bboxW);
  const slackY = Math.max(0, availH - bboxH);

  const targetCenterX = width * 0.5 + offsetUnitX * slackX * 0.74;
  const targetCenterY = height * 0.5 + offsetUnitY * slackY * 0.74;
  const curCenterX = (bbox.minX + bbox.maxX) * 0.5;
  const curCenterY = (bbox.minY + bbox.maxY) * 0.5;

  let dx = targetCenterX - curCenterX;
  let dy = targetCenterY - curCenterY;

  // Hard containment clamp so no segment radius ever crosses [padX, width - padX] × [padY, height - padY]
  if (bbox.minX + dx < padX) dx = padX - bbox.minX;
  if (bbox.maxX + dx > width - padX) dx = width - padX - bbox.maxX;
  if (bbox.minY + dy < padY) dy = padY - bbox.minY;
  if (bbox.maxY + dy > height - padY) dy = height - padY - bbox.maxY;

  for (let i = 0; i < points.length; i++) {
    points[i].x += dx;
    points[i].y += dy;
  }

  // Sync heading to the natural forward body axis & slitherPhase to the head's current weave offset
  const baseAxisAngle = normalizeAngle((flipX < 0 ? Math.PI : 0) + tilt);
  const headWeaveDelta = normalizeAngle(points[1].angle - baseAxisAngle);
  const syncedSlitherPhase = Math.asin(clampVal(headWeaveDelta / 0.52, -0.92, 0.92));

  return {
    points,
    trail: buildSmoothTrailFromPoints(points, 6),
    segmentLength: segLen,
    baseRadius: baseRad,
    maxTurnAngle: 0.46,
    heading: baseAxisAngle,
    slitherPhase: syncedSlitherPhase,
    tongueTimer: 1.5 + seededPoseUnit(seed, 12) * 3.5,
    tongueActive: 0,
    wobblePhase: seededPoseUnit(seed, 13) * Math.PI * 2,
  };
}

export interface SeededWanderOrbit {
  /** Samples the snake's seeded wander target (x, y) and cruise speed at elapsed time `t` (seconds). */
  sample: (t: number) => { targetX: number; targetY: number; speed: number };
}

/**
 * Creates a unique, smoothly precessing Lissajous wander orbit derived deterministically from a
 * snake's seed so animated snakes in the same modal/clutch explore distinct paths and tempos
 * while staying comfortably inside stepSpine's wall-avoidance corridor (preventing hard wall clamps).
 */
export function createSeededWanderOrbit(
  width: number,
  height: number,
  seed: number,
  initialHeading = 0
): SeededWanderOrbit {
  // Keep targets inside stepSpine's safe wall corridor so animated previews glide smoothly without clamping
  const marginX = clampVal(width * 0.16, 18, 40);
  const marginY = clampVal(height * 0.30, 14, 34);

  const centerX = width * (0.46 + seededPoseUnit(seed, 21) * 0.08);
  const centerY = height * (0.47 + seededPoseUnit(seed, 22) * 0.06);
  const maxRx = Math.max(8, Math.min(centerX - marginX, width - marginX - centerX));
  const maxRy = Math.max(4, Math.min(centerY - marginY, height - marginY - centerY));
  const rx = maxRx * (0.72 + seededPoseUnit(seed, 23) * 0.25);
  const ry = maxRy * (0.65 + seededPoseUnit(seed, 24) * 0.32);

  const angularSpeed = 0.65 + seededPoseUnit(seed, 25) * 0.38;
  const freqY = 1.25 + seededPoseUnit(seed, 26) * 1.1;
  const dirX = seededPoseUnit(seed, 27) < 0.5 ? 1 : -1;
  const dirY = seededPoseUnit(seed, 28) < 0.5 ? 1 : -1;
  const driftPhase = seededPoseUnit(seed, 29) * Math.PI * 2;
  const driftRate = 0.22 + seededPoseUnit(seed, 30) * 0.18;
  const speed = 29 + seededPoseUnit(seed, 31) * 13;

  // Bias t=0 target broadly ahead of the snake's seeded starting heading, with seeded divergence
  const aimAngle = initialHeading + (seededPoseUnit(seed, 32) - 0.5) * 0.85;
  const phaseX0 = Math.atan2(Math.sin(aimAngle), Math.cos(aimAngle));
  const phaseY0 =
    Math.asin(clampVal(Math.sin(aimAngle), -0.95, 0.95)) +
    (seededPoseUnit(seed, 33) - 0.5) * 0.85;

  return {
    sample: (t: number) => {
      const px = phaseX0 + t * angularSpeed * dirX;
      const py = phaseY0 + t * angularSpeed * freqY * dirY;
      const drift = Math.sin(driftPhase + t * driftRate) * 0.16;
      const targetX = clampVal(centerX + Math.cos(px + drift) * rx, marginX, width - marginX);
      const targetY = clampVal(centerY + Math.sin(py - drift * 0.7) * ry, marginY, height - marginY);
      return { targetX, targetY, speed };
    },
  };
}

const staticSpineCache = new Map<string, SnakeSpine>();
const MAX_STATIC_SPINE_CACHE = 256;

export function getSharedStaticPreviewSpine(
  width: number,
  height: number,
  isUpsideDown: boolean,
  seed = 0.5
): SnakeSpine {
  const key = `${width}x${height}:${isUpsideDown ? 'u' : 'n'}:${seed.toFixed(4)}`;
  const cached = staticSpineCache.get(key);
  if (cached) return cached;

  const spine = createSeededPreviewSpine(width, height, seed, isUpsideDown);
  if (staticSpineCache.size >= MAX_STATIC_SPINE_CACHE) {
    const oldestKey = staticSpineCache.keys().next().value;
    if (oldestKey !== undefined) staticSpineCache.delete(oldestKey);
  }
  staticSpineCache.set(key, spine);
  return spine;
}
