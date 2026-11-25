import { useEffect, useRef } from 'react';
import { renderProceduralSnake } from '../game/snakeRenderer';
import { createSpine, stepSpine } from '../game/spine';
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
  debugStage?: SkinDebugStage;
  skinSpecOverride?: SkinPhenotypeSpec;
  seedOverride?: number;
  className?: string;
}

export function MiniSnakeCanvas({
  phenotype,
  width = 240,
  height = 116,
  animate = true,
  debugStage = 'final',
  skinSpecOverride,
  seedOverride,
  className = '',
}: MiniSnakeCanvasProps) {
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

  // Trigger an instant redraw whenever phenotype/debugger overrides change without resetting the spine pose!
  useEffect(() => {
    drawRef.current?.();
  }, [
    phenotype,
    debugStage,
    skinSpecOverride,
    seedOverride,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const segLen = Math.max(4.8, Math.min(width * 0.027, height * 0.072));
    const baseRad = Math.max(7, Math.min(height * 0.095, 11.2));
    const spine: SnakeSpine = createSpine(
      width * 0.62,
      height * 0.52,
      0,
      20,
      segLen,
      baseRad
    );

    // Pre-settle into a graceful S-curve centered inside the preview frame so inner/outer skin curves are visible
    let phase = 0.75;
    const stepPreview = (dt: number) => {
      phase += dt * 1.0;
      const cx = width * 0.5;
      const cy = height * 0.52;
      const targetX = cx + Math.cos(phase) * (width * 0.24);
      const targetY = cy + Math.sin(phase * 2) * (height * 0.14);
      stepSpine(spine, {
        targetX,
        targetY,
        speed: 36,
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

    for (let i = 0; i < 45; i++) {
      stepPreview(1 / 60);
    }

    const draw = () => {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

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

      renderProceduralSnake(ctx, spine, phenoRef.current, {
        showShadow: true,
        selected: false,
        debugStage: debugStageRef.current,
        skinSpecOverride: specOverrideRef.current,
        seedOverride: seedOverrideRef.current,
      });

      ctx.restore();
    };

    drawRef.current = draw;
    draw();

    if (!animate) {
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
      stepPreview(dt);
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
  }, [width, height, animate]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`block rounded-lg ${className}`}
      aria-label={`${phenotype.morphName} procedural preview`}
    />
  );
}
