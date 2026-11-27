import { useEffect, useRef } from 'react';
import { terminateIdleSkinWorkers } from '../game/renderScheduler';
import {
  DEFAULT_RENDER_SETTINGS,
  getEffectiveTargetFps,
  getRenderQualityProfile,
  type RenderSettings,
} from '../game/renderSettings';
import { globalSkinCache } from '../game/skinCache';
import { renderProceduralSnake } from '../game/snakeRenderer';
import { createSpine, hitTestSpine, stepSpine } from '../game/spine';
import type { GamePhase, SnakeEntity, SnakeSpine } from '../game/types';

import BACKDROP_SRC from '../assets/images/terrarium_floor_backdrop_1795521551353.jpg';

interface SimSnake {
  id: string;
  spine: SnakeSpine;
  targetX: number;
  targetY: number;
  retargetTimer: number;
  isResting: boolean;
  highlightPulse: number;
  speedBase: number;
}

type ParticleKind = 'heart' | 'ripple' | 'mist' | 'mote' | 'sparkle';

interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

interface TerrariumCanvasProps {
  snakes: SnakeEntity[];
  selectedSnakeId: string | null;
  phase: GamePhase;
  heatLampOn: boolean;
  isOccluded: boolean;
  mistTriggerCount: number;
  renderSettings?: RenderSettings;
  onSelectSnake: (snakeId: string | null, wasPetted: boolean) => void;
  onTapSubstrate: () => void;
}

const PARTICLE_POOL_SIZE = 120;

export function TerrariumCanvas({
  snakes,
  selectedSnakeId,
  phase,
  heatLampOn,
  isOccluded,
  mistTriggerCount,
  renderSettings = DEFAULT_RENDER_SETTINGS,
  onSelectSnake,
  onTapSubstrate,
}: TerrariumCanvasProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const snakesRef = useRef<SnakeEntity[]>(snakes);
  const selectedIdRef = useRef<string | null>(selectedSnakeId);
  const phaseRef = useRef<GamePhase>(phase);
  const heatLampRef = useRef<boolean>(heatLampOn);
  const isOccludedRef = useRef<boolean>(isOccluded);
  const renderSettingsRef = useRef<RenderSettings>(renderSettings);
  const onSelectRef = useRef(onSelectSnake);
  const onTapRef = useRef(onTapSubstrate);
  const lastMistCountRef = useRef(mistTriggerCount);
  const wakeLoopRef = useRef<(() => void) | null>(null);
  const applyQualityRef = useRef<(() => void) | null>(null);

  snakesRef.current = snakes;
  selectedIdRef.current = selectedSnakeId;
  phaseRef.current = phase;
  heatLampRef.current = heatLampOn;
  isOccludedRef.current = isOccluded;
  renderSettingsRef.current = renderSettings;
  onSelectRef.current = onSelectSnake;
  onTapRef.current = onTapSubstrate;

  const mistBurstFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (mistTriggerCount !== lastMistCountRef.current) {
      lastMistCountRef.current = mistTriggerCount;
      mistBurstFnRef.current?.();
    }
  }, [mistTriggerCount]);

  // Wake paused render loop immediately when phase, occlusion, lamp, or render settings change
  useEffect(() => {
    applyQualityRef.current?.();
    wakeLoopRef.current?.();
  }, [phase, isOccluded, heatLampOn, renderSettings.quality, renderSettings.backgroundMode]);

  useEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;
    if (!staticCanvas || !liveCanvas) return;

    const sctx = staticCanvas.getContext('2d');
    const ctx = liveCanvas.getContext('2d');
    if (!sctx || !ctx) return;

    let width = liveCanvas.clientWidth || window.innerWidth;
    let height = liveCanvas.clientHeight || window.innerHeight;
    let dpr = Math.min(
      window.devicePixelRatio || 1,
      getRenderQualityProfile(renderSettingsRef.current.quality).maxDpr
    );
    let staticDirty = true;
    let lastStaticLamp = heatLampRef.current;

    const resize = () => {
      width = liveCanvas.clientWidth || window.innerWidth;
      height = liveCanvas.clientHeight || window.innerHeight;
      const profile = getRenderQualityProfile(renderSettingsRef.current.quality);
      const nextDpr = Math.min(window.devicePixelRatio || 1, profile.maxDpr);
      const pw = Math.round(width * nextDpr);
      const ph = Math.round(height * nextDpr);
      if (dpr !== nextDpr || staticCanvas.width !== pw || staticCanvas.height !== ph) {
        dpr = nextDpr;
        staticCanvas.width = pw;
        staticCanvas.height = ph;
        liveCanvas.width = pw;
        liveCanvas.height = ph;
        staticDirty = true;
      }
    };
    resize();
    applyQualityRef.current = () => {
      const profile = getRenderQualityProfile(renderSettingsRef.current.quality);
      globalSkinCache.setMaxBytes(profile.cacheBudgetBytes);
      resize();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(liveCanvas);

    // Load botanical vivarium backdrop
    const backdropImg = new Image();
    let backdropLoaded = false;
    backdropImg.onload = () => {
      backdropLoaded = true;
      staticDirty = true;
    };
    backdropImg.src = BACKDROP_SRC;

    // Pooled particle ring buffer (zero GC inside animation loop)
    const particles: Particle[] = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      kind: 'mote',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      size: 4,
      color: '#F5E4B8',
    }));
    let particleCursor = 0;

    const spawnParticle = (
      kind: ParticleKind,
      x: number,
      y: number,
      vx: number,
      vy: number,
      life: number,
      size: number,
      color: string
    ) => {
      const p = particles[particleCursor];
      particleCursor = (particleCursor + 1) % PARTICLE_POOL_SIZE;
      p.active = true;
      p.kind = kind;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.age = 0;
      p.life = life;
      p.size = size;
      p.color = color;
    };

    for (let i = 0; i < 12; i++) {
      spawnParticle(
        'mote',
        Math.random() * width,
        Math.random() * height,
        (Math.random() - 0.5) * 6,
        -3 - Math.random() * 5,
        4 + Math.random() * 6,
        1.8 + Math.random() * 2.2,
        '#F6DF9C'
      );
    }

    const getPropsLayout = () => ({
      baskingSlate: {
        x: width * 0.25,
        y: height * 0.34,
        rx: Math.min(110, width * 0.095),
        ry: Math.min(72, height * 0.088),
      },
      waterBowl: {
        x: width * 0.78,
        y: height * 0.68,
        rx: Math.min(82, width * 0.072),
        ry: Math.min(62, height * 0.076),
      },
      shadeHide: {
        x: width * 0.22,
        y: height * 0.73,
      },
    });

    mistBurstFnRef.current = () => {
      for (let i = 0; i < 24; i++) {
        spawnParticle(
          'mist',
          width * (0.12 + Math.random() * 0.76),
          height * (0.12 + Math.random() * 0.72),
          (Math.random() - 0.5) * 18,
          8 + Math.random() * 14,
          1.4 + Math.random() * 1.1,
          3 + Math.random() * 5,
          '#D8F0EA'
        );
      }
      const bowl = getPropsLayout().waterBowl;
      spawnParticle('ripple', bowl.x, bowl.y, 0, 0, 1.3, bowl.rx * 0.3, '#A6E1DB');
    };

    const simMap = new Map<string, SimSnake>();

    const pickTargetForSnake = (snake: SnakeEntity, sim: SimSnake) => {
      const props = getPropsLayout();
      const padX = Math.max(90, width * 0.11);
      const padY = Math.max(95, height * 0.14);
      const behavior = snake.phenotype.behavior;

      if (behavior === 'basking_lounger' && heatLampRef.current && Math.random() < 0.62) {
        sim.targetX = props.baskingSlate.x + (Math.random() - 0.5) * props.baskingSlate.rx * 0.85;
        sim.targetY = props.baskingSlate.y + (Math.random() - 0.5) * props.baskingSlate.ry * 0.85;
        sim.retargetTimer = 7 + Math.random() * 6;
        sim.isResting = Math.random() < 0.55;
        return;
      }

      if (behavior === 'shade_seeker' && Math.random() < 0.6) {
        sim.targetX = props.shadeHide.x + (Math.random() - 0.5) * 140;
        sim.targetY = props.shadeHide.y + (Math.random() - 0.5) * 90;
        sim.retargetTimer = 6 + Math.random() * 6;
        sim.isResting = Math.random() < 0.4;
        return;
      }

      sim.targetX = padX + Math.random() * Math.max(80, width - padX * 2);
      sim.targetY = padY + Math.random() * Math.max(80, height - padY * 2);
      sim.retargetTimer = 5 + Math.random() * 6;
      sim.isResting = Math.random() < 0.22;
    };

    const syncSimSnakes = () => {
      const displayed = snakesRef.current.filter((s) => s.onDisplay);
      const activeIds = new Set(displayed.map((s) => s.id));

      for (const id of simMap.keys()) {
        if (!activeIds.has(id)) {
          simMap.delete(id);
        }
      }

      displayed.forEach((snake, idx) => {
        if (!simMap.has(snake.id)) {
          const angle = (idx / Math.max(1, displayed.length)) * Math.PI * 2 + 0.4;
          const spawnX = width * 0.5 + Math.cos(angle) * Math.min(220, width * 0.22);
          const spawnY = height * 0.5 + Math.sin(angle) * Math.min(130, height * 0.18);
          const segLen = Math.max(10.5, Math.min(13.5, width * 0.0095));
          const baseRad = Math.max(13, Math.min(17.5, width * 0.0125));

          const sim: SimSnake = {
            id: snake.id,
            spine: createSpine(spawnX, spawnY, angle + 1.2, 23, segLen, baseRad),
            targetX: spawnX,
            targetY: spawnY,
            retargetTimer: 1.5 + Math.random() * 3,
            isResting: false,
            highlightPulse: 0,
            speedBase: snake.phenotype.isUpsideDown ? 34 : 42 + (idx % 3) * 5,
          };
          pickTargetForSnake(snake, sim);
          simMap.set(snake.id, sim);
        }
      });
    };

    syncSimSnakes();

    const screenToWorld = (clientX: number, clientY: number) => {
      const rect = liveCanvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    };

    let hoveredSnakeId: string | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      const pt = screenToWorld(e.clientX, e.clientY);
      const displayed = snakesRef.current.filter((s) => s.onDisplay);
      let found: string | null = null;
      for (let i = displayed.length - 1; i >= 0; i--) {
        const sim = simMap.get(displayed[i].id);
        if (sim && hitTestSpine(sim.spine, pt.x, pt.y, 12)) {
          found = displayed[i].id;
          break;
        }
      }
      hoveredSnakeId = found;
      liveCanvas.style.cursor = found ? 'pointer' : 'default';
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (phaseRef.current !== 'playing') return;
      const pt = screenToWorld(e.clientX, e.clientY);
      const displayed = snakesRef.current.filter((s) => s.onDisplay);

      for (let i = displayed.length - 1; i >= 0; i--) {
        const snake = displayed[i];
        const sim = simMap.get(snake.id);
        if (sim && hitTestSpine(sim.spine, pt.x, pt.y, 14)) {
          sim.highlightPulse = 1;
          sim.spine.tongueActive = 0.42;
          sim.isResting = false;
          for (let h = 0; h < 5; h++) {
            spawnParticle(
              h % 2 === 0 ? 'heart' : 'sparkle',
              pt.x + (Math.random() - 0.5) * 26,
              pt.y - 6 + (Math.random() - 0.5) * 14,
              (Math.random() - 0.5) * 22,
              -28 - Math.random() * 24,
              0.95 + Math.random() * 0.45,
              6 + Math.random() * 3,
              h % 2 === 0 ? '#E89B8B' : '#F3D487'
            );
          }
          onSelectRef.current(snake.id, true);
          return;
        }
      }

      const props = getPropsLayout();
      const dxBowl = (pt.x - props.waterBowl.x) / props.waterBowl.rx;
      const dyBowl = (pt.y - props.waterBowl.y) / props.waterBowl.ry;
      const inWater = dxBowl * dxBowl + dyBowl * dyBowl <= 1;

      spawnParticle(
        'ripple',
        pt.x,
        pt.y,
        0,
        0,
        0.95,
        inWater ? 14 : 10,
        inWater ? '#A8E6DF' : '#E7CFA1'
      );

      for (const snake of displayed) {
        const sim = simMap.get(snake.id);
        if (!sim) continue;
        if (
          snake.phenotype.behavior === 'curious_periscoper' ||
          Math.hypot(sim.spine.points[0].x - pt.x, sim.spine.points[0].y - pt.y) < 280
        ) {
          sim.targetX = pt.x + (Math.random() - 0.5) * 44;
          sim.targetY = pt.y + (Math.random() - 0.5) * 44;
          sim.isResting = false;
          sim.retargetTimer = 5.5;
        }
      }

      onSelectRef.current(null, false);
      onTapRef.current();
    };

    liveCanvas.addEventListener('pointermove', handlePointerMove);
    liveCanvas.addEventListener('pointerdown', handlePointerDown);

    const rebuildStaticLayer = () => {
      const props = getPropsLayout();
      sctx.save();
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Floor backdrop
      if (backdropLoaded && backdropImg.naturalWidth > 0) {
        const imgAspect = backdropImg.naturalWidth / backdropImg.naturalHeight;
        const viewAspect = width / height;
        let drawW = width;
        let drawH = height;
        let offsetX = 0;
        let offsetY = 0;
        if (viewAspect > imgAspect) {
          drawH = width / imgAspect;
          offsetY = (height - drawH) * 0.5;
        } else {
          drawW = height * imgAspect;
          offsetX = (width - drawW) * 0.5;
        }
        sctx.drawImage(backdropImg, offsetX, offsetY, drawW, drawH);
      } else {
        const grad = sctx.createRadialGradient(
          width * 0.45,
          height * 0.45,
          40,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.72
        );
        grad.addColorStop(0, '#463527');
        grad.addColorStop(0.65, '#31251C');
        grad.addColorStop(1, '#1E1813');
        sctx.fillStyle = grad;
        sctx.fillRect(0, 0, width, height);
      }

      sctx.fillStyle = heatLampRef.current ? 'rgba(20, 14, 10, 0.16)' : 'rgba(14, 16, 22, 0.36)';
      sctx.fillRect(0, 0, width, height);

      // 2. Organic Hand-Chiseled Basking Slate Rock
      sctx.save();
      sctx.translate(props.baskingSlate.x, props.baskingSlate.y);
      sctx.rotate(-0.14);
      const rx = props.baskingSlate.rx;
      const ry = props.baskingSlate.ry;
      const traceSlateShape = (scale = 1, ox = 0, oy = 0) => {
        sctx.beginPath();
        sctx.moveTo(ox - rx * 0.92 * scale, oy - ry * 0.18 * scale);
        sctx.bezierCurveTo(
          ox - rx * 0.72 * scale, oy - ry * 0.92 * scale,
          ox + rx * 0.25 * scale, oy - ry * 1.02 * scale,
          ox + rx * 0.85 * scale, oy - ry * 0.44 * scale
        );
        sctx.bezierCurveTo(
          ox + rx * 1.06 * scale, oy + ry * 0.14 * scale,
          ox + rx * 0.68 * scale, oy + ry * 0.95 * scale,
          ox - rx * 0.14 * scale, oy + ry * 0.94 * scale
        );
        sctx.bezierCurveTo(
          ox - rx * 0.82 * scale, oy + ry * 0.88 * scale,
          ox - rx * 1.04 * scale, oy + ry * 0.32 * scale,
          ox - rx * 0.92 * scale, oy - ry * 0.18 * scale
        );
        sctx.closePath();
      };

      // Ground shadow
      traceSlateShape(1.03, 6, 8);
      sctx.fillStyle = 'rgba(10, 8, 5, 0.48)';
      sctx.fill();

      // Main weathered slate stone
      const slateGrad = sctx.createLinearGradient(-rx, -ry, rx, ry);
      slateGrad.addColorStop(0, heatLampRef.current ? '#787165' : '#585A5E');
      slateGrad.addColorStop(0.55, heatLampRef.current ? '#5C564E' : '#45474B');
      slateGrad.addColorStop(1, '#393632');
      traceSlateShape(1, 0, 0);
      sctx.fillStyle = slateGrad;
      sctx.fill();
      sctx.strokeStyle = 'rgba(20, 17, 13, 0.78)';
      sctx.lineWidth = 2.2;
      sctx.stroke();

      // Painterly bevel top rim + mineral strata cracks
      traceSlateShape(0.88, -2, -2);
      sctx.strokeStyle = heatLampRef.current ? 'rgba(248, 224, 175, 0.18)' : 'rgba(215, 222, 232, 0.12)';
      sctx.lineWidth = 1.6;
      sctx.stroke();

      sctx.strokeStyle = 'rgba(20, 16, 12, 0.28)';
      sctx.lineWidth = 1.4;
      sctx.beginPath();
      sctx.moveTo(-rx * 0.62, -ry * 0.14);
      sctx.quadraticCurveTo(-rx * 0.08, -ry * 0.34, rx * 0.56, -ry * 0.06);
      sctx.moveTo(-rx * 0.46, ry * 0.28);
      sctx.quadraticCurveTo(rx * 0.04, ry * 0.12, rx * 0.48, ry * 0.32);
      sctx.stroke();

      // Tiny moss tuft hugging lower-left slate edge
      sctx.fillStyle = '#3B5C33';
      sctx.beginPath();
      sctx.arc(-rx * 0.78, ry * 0.44, 12, 0, Math.PI * 2);
      sctx.arc(-rx * 0.64, ry * 0.56, 9, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      // 3. Handcrafted Stoneware Terrarium Water Dish
      sctx.save();
      sctx.translate(props.waterBowl.x, props.waterBowl.y);
      const wrx = props.waterBowl.rx;
      const wry = props.waterBowl.ry;
      sctx.fillStyle = 'rgba(10, 8, 6, 0.48)';
      sctx.beginPath();
      sctx.ellipse(5, 7, wrx * 1.05, wry * 1.05, 0, 0, Math.PI * 2);
      sctx.fill();

      // Earthy stoneware rim
      const rimGrad = sctx.createLinearGradient(-wrx, -wry, wrx, wry);
      rimGrad.addColorStop(0, '#A5927B');
      rimGrad.addColorStop(0.5, '#7D6C5A');
      rimGrad.addColorStop(1, '#54473B');
      sctx.fillStyle = rimGrad;
      sctx.beginPath();
      sctx.ellipse(0, 0, wrx, wry, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.strokeStyle = '#241D17';
      sctx.lineWidth = 2.2;
      sctx.stroke();

      // Subtle ceramic glaze speckles on rim
      sctx.fillStyle = 'rgba(34, 26, 18, 0.28)';
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        sctx.beginPath();
        sctx.arc(Math.cos(a) * wrx * 0.9, Math.sin(a) * wry * 0.9, 1.4, 0, Math.PI * 2);
        sctx.fill();
      }

      // Inner recessed lip shadow
      sctx.fillStyle = '#332B23';
      sctx.beginPath();
      sctx.ellipse(0, 0, wrx * 0.83, wry * 0.81, 0, 0, Math.PI * 2);
      sctx.fill();

      // Clear jade-teal water basin
      const waterGrad = sctx.createRadialGradient(-wrx * 0.2, -wry * 0.2, 6, 0, 0, wrx * 0.82);
      waterGrad.addColorStop(0, '#62A89F');
      waterGrad.addColorStop(0.62, '#3D7873');
      waterGrad.addColorStop(1, '#244A49');
      sctx.fillStyle = waterGrad;
      sctx.beginPath();
      sctx.ellipse(1, 2, wrx * 0.79, wry * 0.76, 0, 0, Math.PI * 2);
      sctx.fill();
      sctx.restore();

      // 4. Warm golden basking lamp cone
      if (heatLampRef.current) {
        const lampGrad = sctx.createRadialGradient(
          props.baskingSlate.x,
          props.baskingSlate.y,
          14,
          props.baskingSlate.x,
          props.baskingSlate.y,
          Math.max(width, height) * 0.42
        );
        lampGrad.addColorStop(0, 'rgba(255, 206, 122, 0.22)');
        lampGrad.addColorStop(0.45, 'rgba(240, 178, 84, 0.08)');
        lampGrad.addColorStop(1, 'rgba(240, 178, 84, 0)');
        sctx.fillStyle = lampGrad;
        sctx.fillRect(0, 0, width, height);
      }

      // 5. Soft vivarium edge vignette
      const vig = sctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.78
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(12, 9, 6, 0.44)');
      sctx.fillStyle = vig;
      sctx.fillRect(0, 0, width, height);

      sctx.restore();
      staticDirty = false;
      lastStaticLamp = heatLampRef.current;
    };

    const drawDynamicPropsAndFraming = (elapsedTotal: number) => {
      const props = getPropsLayout();

      // Subtle animated water shimmer crescent
      ctx.save();
      ctx.translate(props.waterBowl.x, props.waterBowl.y);
      const shimmerShift = Math.sin(elapsedTotal * 1.5) * 3;
      ctx.strokeStyle = 'rgba(220, 248, 244, 0.34)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(
        -props.waterBowl.rx * 0.16 + shimmerShift,
        -props.waterBowl.ry * 0.1,
        props.waterBowl.ry * 0.42,
        Math.PI * 1.05,
        Math.PI * 1.55
      );
      ctx.stroke();
      ctx.restore();

      // Gently swaying overhanging fern fronds in top-right corner
      const sway = Math.sin(elapsedTotal * 0.9) * 0.04;
      ctx.save();
      ctx.translate(width + 10, -10);
      ctx.rotate(2.35 + sway);
      drawFernFrond(ctx, 175, '#2E5434', '#427047');
      ctx.rotate(0.28);
      drawFernFrond(ctx, 130, '#25442A', '#38623D');
      ctx.restore();
    };

    const drawParticles = () => {
      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const p = particles[i];
        if (!p.active) continue;
        const t = p.age / p.life;
        const alpha = p.kind === 'mote' ? Math.sin(t * Math.PI) * 0.45 : Math.max(0, 1 - t);

        ctx.save();
        ctx.globalAlpha = alpha;

        if (p.kind === 'ripple') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + t * 34, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 'heart') {
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          const s = p.size * (0.85 + t * 0.3);
          ctx.beginPath();
          ctx.moveTo(0, s * 0.35);
          ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.55, -s * 1.1, 0, -s * 0.42);
          ctx.bezierCurveTo(s * 0.55, -s * 1.1, s, -s * 0.4, 0, s * 0.35);
          ctx.fill();
        } else if (p.kind === 'sparkle') {
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(t * 2.2);
          const s = p.size * (1 - t * 0.4);
          ctx.beginPath();
          ctx.moveTo(0, -s);
          ctx.lineTo(s * 0.3, -s * 0.3);
          ctx.lineTo(s, 0);
          ctx.lineTo(s * 0.3, s * 0.3);
          ctx.lineTo(0, s);
          ctx.lineTo(-s * 0.3, s * 0.3);
          ctx.lineTo(-s, 0);
          ctx.lineTo(-s * 0.3, -s * 0.3);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    };

    let timerId = 0;
    let rafId = 0;
    let disposed = false;
    let isContextLost = false;
    let isTabHidden = typeof document !== 'undefined' ? document.hidden : false;
    let isWindowFocused = typeof document !== 'undefined' ? document.hasFocus() : true;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let waterRippleCooldown = 0;

    const clearScheduledFrame = () => {
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = 0;
      }
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    const recoverGpuSurfaces = () => {
      isContextLost = false;
      globalSkinCache.rehydrateAllCanvases();
      staticDirty = true;
      wakeLoop();
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      isContextLost = true;
      clearScheduledFrame();
    };

    const handleContextRestored = () => {
      recoverGpuSurfaces();
    };

    const handleVisibilityChange = () => {
      isTabHidden = document.hidden;
      if (isTabHidden) {
        clearScheduledFrame();
        // Shed idle Web Worker memory while user is in another tab
        terminateIdleSkinWorkers();
      } else {
        // Proactively verify GPU surfaces & rehydrate skins after returning from a background tab
        lastTime = performance.now();
        const sLost =
          typeof (sctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }).isContextLost === 'function' &&
          (sctx as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost();
        const lLost =
          typeof (ctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }).isContextLost === 'function' &&
          (ctx as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost();
        if (sLost || lLost || staticCanvas.width === 0) {
          resize();
        }
        globalSkinCache.rehydrateAllCanvases();
        staticDirty = true;
        wakeLoop();
      }
    };

    const handleWindowFocus = () => {
      isWindowFocused = true;
      lastTime = performance.now();
      wakeLoop();
    };

    const handleWindowBlur = () => {
      isWindowFocused = false;
      const fps = getEffectiveTargetFps(renderSettingsRef.current, false, isTabHidden);
      if (fps === 0) {
        clearScheduledFrame();
      }
    };

    staticCanvas.addEventListener('contextlost', handleContextLost);
    staticCanvas.addEventListener('contextrestored', handleContextRestored);
    liveCanvas.addEventListener('contextlost', handleContextLost);
    liveCanvas.addEventListener('contextrestored', handleContextRestored);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    const scheduleNextFrame = (targetFps: number) => {
      if (disposed || isContextLost || targetFps <= 0) return;
      clearScheduledFrame();
      if (targetFps >= 58) {
        rafId = window.requestAnimationFrame(renderFrame);
        return;
      }
      const delayMs = Math.max(8, Math.floor(1000 / targetFps) - 4);
      timerId = window.setTimeout(() => {
        timerId = 0;
        if (!disposed) {
          rafId = window.requestAnimationFrame(renderFrame);
        }
      }, delayMs);
    };

    function wakeLoop() {
      if (disposed || isContextLost) return;
      const isPausedOrHidden = phaseRef.current === 'paused' || isOccludedRef.current;
      const targetFps = getEffectiveTargetFps(
        renderSettingsRef.current,
        isWindowFocused,
        isTabHidden
      );
      if (isPausedOrHidden || targetFps <= 0) {
        clearScheduledFrame();
        return;
      }
      if (!timerId && !rafId) {
        lastTime = performance.now();
        rafId = window.requestAnimationFrame(renderFrame);
      }
    }
    wakeLoopRef.current = wakeLoop;

    const renderFrame = () => {
      rafId = 0;
      if (disposed || isContextLost) return;

      const sLost =
        typeof (sctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }).isContextLost === 'function' &&
        (sctx as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost();
      const lLost =
        typeof (ctx as CanvasRenderingContext2D & { isContextLost?: () => boolean }).isContextLost === 'function' &&
        (ctx as CanvasRenderingContext2D & { isContextLost: () => boolean }).isContextLost();
      if (sLost || lLost) {
        isContextLost = true;
        return;
      }

      const isPausedOrHidden = phaseRef.current === 'paused' || isOccludedRef.current;
      const targetFps = getEffectiveTargetFps(
        renderSettingsRef.current,
        isWindowFocused,
        isTabHidden
      );

      if (staticDirty || lastStaticLamp !== heatLampRef.current) {
        rebuildStaticLayer();
      }

      if (isPausedOrHidden || targetFps <= 0) {
        // Truly idle: stop scheduling RAF/timers until wakeLoop() fires on resume/focus/visible
        clearScheduledFrame();
        return;
      }

      const now = performance.now();
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.08);
      const profile = getRenderQualityProfile(renderSettingsRef.current.quality);

      syncSimSnakes();

      if (true) {
        elapsedTotal += dt;
        waterRippleCooldown = Math.max(0, waterRippleCooldown - dt);
        const props = getPropsLayout();
        const bounds = {
          minX: 44,
          maxX: width - 44,
          minY: 74,
          maxY: height - 74,
        };

        const displayed = snakesRef.current.filter((s) => s.onDisplay);
        for (const snake of displayed) {
          const sim = simMap.get(snake.id);
          if (!sim) continue;

          sim.retargetTimer -= dt;
          sim.highlightPulse = Math.max(0, sim.highlightPulse - dt * 1.8);

          const head = sim.spine.points[0];
          const dist = Math.hypot(sim.targetX - head.x, sim.targetY - head.y);
          if (sim.retargetTimer <= 0 || dist < 24) {
            pickTargetForSnake(snake, sim);
          }

          stepSpine(sim.spine, {
            targetX: sim.targetX,
            targetY: sim.targetY,
            speed: sim.speedBase,
            dt,
            isResting: sim.isResting,
            isUpsideDown: snake.phenotype.isUpsideDown,
            bounds,
          });

          if (waterRippleCooldown <= 0) {
            const dxB = (head.x - props.waterBowl.x) / (props.waterBowl.rx * 0.78);
            const dyB = (head.y - props.waterBowl.y) / (props.waterBowl.ry * 0.78);
            if (dxB * dxB + dyB * dyB < 0.92) {
              spawnParticle('ripple', head.x, head.y, 0, 0, 1.1, 6, '#B5EAE3');
              waterRippleCooldown = 1.4;
            }
          }
        }

        let activeMotes = 0;
        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
          const p = particles[i];
          if (!p.active) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.kind === 'mote') activeMotes++;
        }

        if (heatLampRef.current && activeMotes < profile.maxAmbientMotes && Math.random() < dt * 2.5) {
          spawnParticle(
            'mote',
            props.baskingSlate.x + (Math.random() - 0.5) * width * 0.45,
            props.baskingSlate.y + (Math.random() - 0.5) * height * 0.45,
            (Math.random() - 0.5) * 6,
            -3 - Math.random() * 4,
            5 + Math.random() * 4,
            1.6 + Math.random() * 2,
            '#F9E5A9'
          );
        }
      }

      // Only clear and draw transparent live snake layer!
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const displayed = snakesRef.current.filter((s) => s.onDisplay);
      for (const snake of displayed) {
        const sim = simMap.get(snake.id);
        if (!sim) continue;
        const isSelected = selectedIdRef.current === snake.id;
        const isHovered = hoveredSnakeId === snake.id;
        renderProceduralSnake(ctx, sim.spine, snake.phenotype, {
          selected: isSelected,
          showShadow: profile.showShadows,
          showNameTag: phaseRef.current === 'playing' && (isSelected || isHovered),
          name: snake.name,
          highlightPulse: sim.highlightPulse,
          skinScale: profile.skinScale,
        });
      }

      drawParticles();
      drawDynamicPropsAndFraming(elapsedTotal);
      ctx.restore();

      scheduleNextFrame(targetFps);
    };

    renderFrame();

    return () => {
      disposed = true;
      wakeLoopRef.current = null;
      applyQualityRef.current = null;
      mistBurstFnRef.current = null;
      clearScheduledFrame();
      backdropImg.onload = null;
      resizeObserver.disconnect();
      staticCanvas.removeEventListener('contextlost', handleContextLost);
      staticCanvas.removeEventListener('contextrestored', handleContextRestored);
      liveCanvas.removeEventListener('contextlost', handleContextLost);
      liveCanvas.removeEventListener('contextrestored', handleContextRestored);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      liveCanvas.removeEventListener('pointermove', handlePointerMove);
      liveCanvas.removeEventListener('pointerdown', handlePointerDown);
      // Release full-viewport GPU backing stores cleanly on unmount
      staticCanvas.width = 0;
      staticCanvas.height = 0;
      liveCanvas.width = 0;
      liveCanvas.height = 0;
    };
  }, []);

  return (
    <div className="fixed inset-0 w-full h-full">
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 w-full h-full block pointer-events-none"
        aria-hidden="true"
      />
      <canvas
        ref={liveCanvasRef}
        data-testid="terrarium-canvas"
        className="absolute inset-0 w-full h-full block touch-none"
        aria-label="Interactive ball python terrarium"
      />
    </div>
  );
}

function drawFernFrond(
  ctx: CanvasRenderingContext2D,
  length: number,
  darkColor: string,
  lightColor: string
): void {
  ctx.save();
  ctx.strokeStyle = darkColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(length * 0.5, -14, length, 0);
  ctx.stroke();

  const leafletCount = 9;
  for (let i = 1; i <= leafletCount; i++) {
    const t = i / (leafletCount + 1);
    const lx = length * t;
    const ly = -Math.sin(t * Math.PI) * 7;
    const leafLen = (1 - t * 0.58) * 34;

    for (const side of [-1, 1]) {
      ctx.fillStyle = side === 1 ? lightColor : darkColor;
      ctx.beginPath();
      ctx.ellipse(
        lx + 4,
        ly + side * leafLen * 0.45,
        leafLen * 0.5,
        leafLen * 0.19,
        side * 0.65,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }
  ctx.restore();
}
