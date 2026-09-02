"use client";

/**
 * Adapted from react-bits' DotGrid background (reactbits.dev) — ported to
 * TypeScript and re-implemented without GSAP. The original leans on
 * `gsap` + `InertiaPlugin` for the push-and-spring-back displacement; this
 * runs the same idea as a plain damped-spring integrator inside the
 * existing rAF loop instead, since GSAP isn't (and shouldn't become) a
 * dependency here — see the `fitra-motion-ui` skill.
 *
 * For flat, non-photo section backgrounds only.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";

interface Dot {
  cx: number;
  cy: number;
  offsetX: number;
  offsetY: number;
  velX: number;
  velY: number;
  settled: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

interface DotGridBackgroundProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  shockRadius?: number;
  shockStrength?: number;
  className?: string;
}

const SPRING_STIFFNESS = 0.12;
const SPRING_DAMPING = 0.78;
const SETTLE_EPSILON = 0.05;

export default function DotGridBackground({
  dotSize = 3,
  gap = 26,
  baseColor = "rgba(255,255,255,0.14)",
  activeColor = "#FFB366",
  proximity = 120,
  shockRadius = 200,
  shockStrength = 4,
  className = "",
}: DotGridBackgroundProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const activeRgb = useMemo(() => hexToRgb(activeColor), [activeColor]);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const { width, height } = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cell = dotSize + gap;
    const cols = Math.floor((width + gap) / cell);
    const rows = Math.floor((height + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (width - gridW) / 2 + dotSize / 2;
    const startY = (height - gridH) / 2 + dotSize / 2;

    const dots: Dot[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        dots.push({
          cx: startX + x * cell,
          cy: startY + y * cell,
          offsetX: 0,
          offsetY: 0,
          velX: 0,
          velY: 0,
          settled: true,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    buildGrid();
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(buildGrid);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [buildGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const proxSq = proximity * proximity;

    function applyImpulse(fromX: number, fromY: number, radius: number, strength: number) {
      const radiusSq = radius * radius;
      for (const dot of dotsRef.current) {
        const dx = dot.cx - fromX;
        const dy = dot.cy - fromY;
        const distSq = dx * dx + dy * dy;
        if (distSq > radiusSq || !dot.settled) continue;
        const dist = Math.sqrt(distSq) || 1;
        const falloff = 1 - dist / radius;
        dot.velX += (dx / dist) * strength * falloff * 8;
        dot.velY += (dy / dist) * strength * falloff * 8;
        dot.settled = false;
      }
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (!reduceMotion) applyImpulse(pointerRef.current.x, pointerRef.current.y, proximity, 1.4);
    }

    function onClick(e: MouseEvent) {
      if (reduceMotion) return;
      const rect = canvas!.getBoundingClientRect();
      applyImpulse(e.clientX - rect.left, e.clientY - rect.top, shockRadius, shockStrength);
    }

    let lastMove = 0;
    function throttledMove(e: MouseEvent) {
      const now = performance.now();
      if (now - lastMove < 50) return;
      lastMove = now;
      onMouseMove(e);
    }

    window.addEventListener("mousemove", throttledMove, { passive: true });
    window.addEventListener("click", onClick);

    function draw() {
      const width = canvas!.clientWidth;
      const height = canvas!.clientHeight;
      ctx!.clearRect(0, 0, width, height);

      const { x: px, y: py } = pointerRef.current;

      for (const dot of dotsRef.current) {
        if (!dot.settled) {
          dot.velX += -dot.offsetX * SPRING_STIFFNESS;
          dot.velY += -dot.offsetY * SPRING_STIFFNESS;
          dot.velX *= SPRING_DAMPING;
          dot.velY *= SPRING_DAMPING;
          dot.offsetX += dot.velX;
          dot.offsetY += dot.velY;
          if (
            Math.abs(dot.offsetX) < SETTLE_EPSILON &&
            Math.abs(dot.offsetY) < SETTLE_EPSILON &&
            Math.abs(dot.velX) < SETTLE_EPSILON &&
            Math.abs(dot.velY) < SETTLE_EPSILON
          ) {
            dot.offsetX = 0;
            dot.offsetY = 0;
            dot.settled = true;
          }
        }

        const dx = dot.cx - px;
        const dy = dot.cy - py;
        const distSq = dx * dx + dy * dy;

        let fill = baseColor;
        if (distSq <= proxSq) {
          const t = 1 - Math.sqrt(distSq) / proximity;
          fill = `rgba(${activeRgb.r},${activeRgb.g},${activeRgb.b},${(0.15 + t * 0.75).toFixed(3)})`;
        }

        ctx!.beginPath();
        ctx!.fillStyle = fill;
        ctx!.arc(dot.cx + dot.offsetX, dot.cy + dot.offsetY, dotSize / 2, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    if (reduceMotion) {
      draw();
      return () => {
        window.removeEventListener("mousemove", throttledMove);
        window.removeEventListener("click", onClick);
      };
    }

    let raf = requestAnimationFrame(function loop() {
      draw();
      raf = requestAnimationFrame(loop);
    });

    return () => {
      window.removeEventListener("mousemove", throttledMove);
      window.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
  }, [dotSize, proximity, shockRadius, shockStrength, baseColor, activeRgb]);

  return (
    <div ref={wrapperRef} aria-hidden="true" className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}
