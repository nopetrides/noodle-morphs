import { useEffect, useRef } from 'react';
import { resolveSkinSpecForPhenotype } from '../game/genetics';
import {
  createSeededPreviewSpine,
  createSeededWanderOrbit,
  getSharedStaticPreviewSpine,
  requestSkinAsync,
  scheduleCanvasPaint,
} from '../game/renderScheduler';
import type { CachedSkinEntry } from '../game/skinCache';
import { renderProceduralSnake } from '../game/snakeRenderer';
import { stepSpine } from '../game/spine';
import type {
  SkinDebugStage,
  SkinPhenotypeSpec,
  SnakePhenotype,
  SnakeSpine,
} from '../game/types';

interface MiniSnakeCanvasProps {
  phenotype: SnakePhenotype;
  width?: number;
  height?: number;
  animate?: boolean;
  /**
   * When true, immediately renders a lightweight placeholder and lazily synthesizes
   * the procedural skin off-thread once near the viewport, painting progressively under
   * a frame budget. Defaults to `!animate` so live animated previews & egg reveals stay instant.
   */
  lazy?: boolean;
  debugStage?: SkinDebugStage;
  skinSpecOverride?: SkinPhenotypeSpec;
  seedOverride?: number;
  className?: string;
}

function drawCardBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const bgGrad = ctx.createRadialGradient(
    width * 0.35,
    height * 0.25,
    8,
    width * 0.5,
    height * 0.5,
    width * 0.72
  );
  bgGrad.addColorStop(0, '#383028');
  bgGrad.addColorStop(1, '#221C17');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(227, 206, 168, 0.14)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

/**
 * Draws an ultra-lightweight (<0.1ms) tinted placeholder silhouette matching the snake's
 * exact seeded spine pose so cards show immediate placeholders with zero visual jump on fill.
 */
function drawSnakePlaceholder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  phenotype: SnakePhenotype,
  spine: SnakeSpine,
  dpr: number
): void {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawCardBackdrop(ctx, width, height);

  const pts = spine.points;
  if (pts.length >= 2) {
    const lineW = Math.max(4, spine.baseRadius * 1.55);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    ctx.lineWidth = lineW;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = phenotype.palette.base || '#8C7456';
    ctx.stroke();

    // Subtle dorsal shimmer highlight
    ctx.lineWidth = Math.max(1.5, lineW * 0.34);
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = phenotype.palette.patternPrimary || '#D9A754';
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export function MiniSnakeCanvas({
  phenotype,
  width = 240,
  height = 116,
  animate = true,
  lazy,
  debugStage = 'final',
  skinSpecOverride,
  seedOverride,
  className = '',
}: MiniSnakeCanvasProps) {
  const effectiveLazy = lazy ?? !animate;
  const poseSeed = seedOverride ?? phenotype.patternRule.variationSeed;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phenoRef = useRef(phenotype);
  const debugStageRef = useRef<SkinDebugStage>(debugStage);
  const specOverrideRef = useRef<SkinPhenotypeSpec | undefined>(skinSpecOverride);
  const seedOverrideRef = useRef<number | undefined>(seedOverride);
  const drawRef = useRef<(() => void) | null>(null);

  phenoRef.current = phenotype;
  debugStageRef.current = debugStage;
  specOverrideRef.current = skinSpecOverride;
  seedOverrideRef.current = seedOverride;

  // Immediate redraw for non-lazy (animated / egg-reveal / simulator) canvases when props change
  useEffect(() => {
    if (!effectiveLazy) {
      drawRef.current?.();
    }
  }, [effectiveLazy, phenotype, debugStage, skinSpecOverride, seedOverride]);

  // Lazy progressive path for static cards (Collection, Morphdex, Jean Pool, Save Slots)
  useEffect(() => {
    if (!effectiveLazy) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.dataset.renderState = 'placeholder';

    const spine = getSharedStaticPreviewSpine(width, height, phenotype.isUpsideDown, poseSeed);

    // Frame 0: paint lightweight placeholder matching the snake's exact seeded pose
    drawSnakePlaceholder(ctx, width, height, phenotype, spine, dpr);

    let disposed = false;
    let started = false;
    let cancelScheduledPaint: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;

    const renderWithSkin = (skin: CachedSkinEntry) => {
      if (disposed) return;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawCardBackdrop(ctx, width, height);

      renderProceduralSnake(ctx, spine, phenotype, {
        showShadow: true,
        selected: false,
        debugStage,
        skinSpecOverride,
        seedOverride,
        cachedSkinOverride: skin,
      });

      ctx.restore();
      canvas.dataset.renderState = 'ready';
    };

    const kickOffLazyRender = () => {
      if (disposed || started) return;
      started = true;
      observer?.disconnect();
      observer = null;

      const spec = skinSpecOverride ?? resolveSkinSpecForPhenotype(phenotype);
      const texW = spine.baseRadius >= 11 ? 256 : 192;
      const texH = spine.baseRadius >= 11 ? 64 : 48;

      requestSkinAsync(spec, phenotype.palette, poseSeed, texW, texH, debugStage, 'high')
        .then((skin) => {
          if (disposed) return;
          cancelScheduledPaint = scheduleCanvasPaint(() => {
            renderWithSkin(skin);
          });
        })
        .catch(() => {
          // Graceful fallback if worker unexpectedly rejects
          if (disposed) return;
          cancelScheduledPaint = scheduleCanvasPaint(() => {
            if (disposed) return;
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, width, height);
            drawCardBackdrop(ctx, width, height);
            renderProceduralSnake(ctx, spine, phenotype, {
              showShadow: true,
              selected: false,
              debugStage,
              skinSpecOverride,
              seedOverride,
            });
            ctx.restore();
            canvas.dataset.renderState = 'ready';
          });
        });
    };

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              kickOffLazyRender();
              break;
            }
          }
        },
        { rootMargin: '240px 0px', threshold: 0.01 }
      );
      observer.observe(canvas);
    } else {
      kickOffLazyRender();
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      cancelScheduledPaint?.();
    };
  }, [effectiveLazy, width, height, phenotype, poseSeed, debugStage, skinSpecOverride, seedOverride]);

  // Synchronous / zero-delay path for animated previews, Breeding parents, Simulator, & Egg Reveals
  useEffect(() => {
    if (effectiveLazy) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const initialSeed = seedOverrideRef.current ?? phenoRef.current.patternRule.variationSeed;
    let spine: SnakeSpine;
    let stepPreview: ((dt: number) => void) | null = null;

    if (!animate) {
      spine = getSharedStaticPreviewSpine(
        width,
        height,
        phenoRef.current.isUpsideDown,
        initialSeed
      );
    } else {
      // Start directly in the snake's unique seeded pose (zero 45-step warm-up delay!)
      spine = createSeededPreviewSpine(
        width,
        height,
        initialSeed,
        phenoRef.current.isUpsideDown
      );

      // Seed a unique precessing wander orbit so sibling snakes explore distinct paths & tempos
      const orbit = createSeededWanderOrbit(width, height, initialSeed, spine.heading);
      let elapsed = 0;
      stepPreview = (dt: number) => {
        elapsed += dt;
        const { targetX, targetY, speed } = orbit.sample(elapsed);
        stepSpine(spine, {
          targetX,
          targetY,
          speed,
          dt,
          isUpsideDown: phenoRef.current.isUpsideDown,
          bounds: {
            minX: 8,
            maxX: width - 8,
            minY: 8,
            maxY: height - 8,
          },
        });
      };

      // Pre-simulate enough gentle physics steps (~0.8ms total) to flush the ENTIRE 20-segment
      // body & ground trail cleanly onto the live stepSpine trajectory (zero startup junction!)
      const totalBodyLen = spine.segmentLength * (spine.points.length + 2);
      const warmupSteps = Math.max(180, Math.min(300, Math.ceil((totalBodyLen / 28) * 60)));
      for (let i = 0; i < warmupSteps; i++) {
        stepPreview(1 / 60);
      }
    }

    const draw = () => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      drawCardBackdrop(ctx, width, height);

      renderProceduralSnake(ctx, spine, phenoRef.current, {
        showShadow: true,
        selected: false,
        debugStage: debugStageRef.current,
        skinSpecOverride: specOverrideRef.current,
        seedOverride: seedOverrideRef.current,
      });

      ctx.restore();
      canvas.dataset.renderState = 'ready';
    };

    drawRef.current = draw;
    draw();

    if (!animate || !stepPreview) {
      return () => {
        drawRef.current = null;
      };
    }

    let timerId = 0;
    let disposed = false;
    let lastTime = performance.now();
    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      stepPreview!(dt);
      draw();
      timerId = window.setTimeout(() => {
        if (!disposed) window.requestAnimationFrame(tick);
      }, 60);
    };

    timerId = window.setTimeout(() => {
      if (!disposed) window.requestAnimationFrame(tick);
    }, 60);

    return () => {
      disposed = true;
      drawRef.current = null;
      window.clearTimeout(timerId);
    };
  }, [effectiveLazy, width, height, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`block rounded-lg ${className}`}
      aria-label={`${phenotype.morphName} procedural preview`}
    />
  );
}
