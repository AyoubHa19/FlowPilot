"use client";

import { useEffect, useRef } from "react";

/**
 * The page background: black, with a field of glyphs that only shows
 * around the mouse and fades out with distance. Glyphs flicker slowly.
 * No glow: only the background itself is revealed.
 *
 * If BACKGROUND_IMAGE is set, that image is revealed around the mouse too.
 * On touch screens the reveal wanders slowly on its own.
 *
 * It also sets --gx / --gy on the hovered `.glass` panel, which draws the
 * small highlight that follows the mouse on cards (see globals.css).
 */

// Drop an image in public/ and set its path here, e.g. "/background.jpg".
const BACKGROUND_IMAGE: string | null = null;

const CELL = 22; // px between glyphs
const RADIUS = 280; // px, size of the revealed area
// Email and lease vocabulary in the FlowPilot colors: signal lime, violet,
// and a cool white.
const GLYPHS = "@@#&%*+=<>/\\[]{}()?!:;.,~^ABCDEFGHJKLMNPRSTUVWXYZ0123456789€§";
const COLORS = ["#c8f135", "#c8f135", "#a78bfa", "#8b9cff", "#e4e7ee", "#e4e7ee"];
const DENSITY = 0.42; // share of cells that hold a glyph
const FLICKER = 0.012; // chance per visible glyph per frame to change

type Cell = { glyph: string; color: string; on: boolean };

function randomCell(): Cell {
  return {
    glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    on: Math.random() < DENSITY,
  };
}

export function CursorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let cells: Cell[] = [];

    let image: HTMLImageElement | null = null;
    const layer = document.createElement("canvas");
    const layerCtx = layer.getContext("2d");
    if (BACKGROUND_IMAGE) {
      image = new Image();
      image.src = BACKGROUND_IMAGE;
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      layer.width = canvas!.width;
      layer.height = canvas!.height;
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      cells = Array.from({ length: cols * rows }, randomCell);
    }
    resize();

    // Start in the upper middle until the mouse moves.
    const target = { x: width * 0.55, y: height * 0.3 };
    const light = { ...target };
    let moved = false;

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      target.x = event.clientX;
      target.y = event.clientY;
      moved = true;

      const panel = (event.target as Element | null)?.closest?.(".glass");
      if (panel instanceof HTMLElement) {
        const box = panel.getBoundingClientRect();
        panel.style.setProperty("--gx", `${event.clientX - box.left}px`);
        panel.style.setProperty("--gy", `${event.clientY - box.top}px`);
      }
      if (reduceMotion) draw(performance.now());
    }

    function drawImageLayer() {
      if (!image?.complete || !layerCtx || image.naturalWidth === 0) return;
      // Cover the viewport, then keep only what is under the light.
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layerCtx.globalCompositeOperation = "source-over";
      layerCtx.clearRect(0, 0, width, height);
      layerCtx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      layerCtx.globalCompositeOperation = "destination-in";
      const mask = layerCtx.createRadialGradient(light.x, light.y, 0, light.x, light.y, RADIUS * 1.6);
      mask.addColorStop(0, "rgba(0,0,0,0.9)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      layerCtx.fillStyle = mask;
      layerCtx.fillRect(0, 0, width, height);
      ctx!.drawImage(layer, 0, 0, width, height);
    }

    function draw(time: number) {
      if (!moved && !finePointer && !reduceMotion) {
        // No mouse: let the light wander.
        target.x = width * (0.5 + 0.32 * Math.sin(time / 5200));
        target.y = height * (0.4 + 0.22 * Math.sin(time / 3700));
      }
      const ease = reduceMotion ? 1 : 0.12;
      light.x += (target.x - light.x) * ease;
      light.y += (target.y - light.y) * ease;

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);

      drawImageLayer();

      // Glyphs near the light, fading out with distance.
      ctx!.font = `500 13px ui-monospace, "Geist Mono", monospace`;
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      const c0 = Math.max(0, Math.floor((light.x - RADIUS) / CELL));
      const c1 = Math.min(cols - 1, Math.ceil((light.x + RADIUS) / CELL));
      const r0 = Math.max(0, Math.floor((light.y - RADIUS) / CELL));
      const r1 = Math.min(rows - 1, Math.ceil((light.y + RADIUS) / CELL));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const cell = cells[r * cols + c];
          if (!reduceMotion && Math.random() < FLICKER) cells[r * cols + c] = randomCell();
          if (!cell.on) continue;
          const x = c * CELL + CELL / 2;
          const y = r * CELL + CELL / 2;
          const d = Math.hypot(x - light.x, y - light.y) / RADIUS;
          if (d >= 1) continue;
          ctx!.globalAlpha = (1 - d) * (1 - d) * 0.6;
          ctx!.fillStyle = cell.color;
          ctx!.fillText(cell.glyph, x, y);
        }
      }
      ctx!.globalAlpha = 1;
    }

    let frame = 0;
    function loop(time: number) {
      draw(time);
      frame = requestAnimationFrame(loop);
    }

    function onResize() {
      resize();
      draw(performance.now());
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResize);
    if (reduceMotion) {
      draw(performance.now());
      image?.addEventListener("load", () => draw(performance.now()));
    } else {
      frame = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 size-full"
    />
  );
}
