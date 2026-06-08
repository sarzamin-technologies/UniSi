"use client";
import { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}

export interface SignaturePadProps {
  width?: number;
  height?: number;
  onChange?: (dataUrl: string | null) => void;
}

/**
 * HTML5 canvas signature pad with quadratic-Bezier stroke smoothing. Renders
 * at 2× device pixels for print quality, then exports a transparent PNG.
 */
export function SignaturePad({ width = 360, height = 140, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const drawingRef = useRef(false);
  const pointsRef = useRef<Point[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, [width, height]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    pointsRef.current = [getPoint(e)];
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const next = getPoint(e);
    pointsRef.current.push(next);
    const pts = pointsRef.current;
    if (pts.length < 3) return;
    // Smooth with quadratic Bezier between midpoints.
    const last3 = pts.slice(-3);
    const a = last3[0]!;
    const b = last3[1]!;
    const c = last3[2]!;
    const mid1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const mid2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(mid1.x, mid1.y);
    ctx.quadraticCurveTo(b.x, b.y, mid2.x, mid2.y);
    ctx.stroke();
    if (!hasStrokes) setHasStrokes(true);
  }

  function handleUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    pointsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas && onChange) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    if (onChange) onChange(null);
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        style={{ width, height, touchAction: "none" }}
        className="border border-zinc-300 dark:border-zinc-700 rounded-md bg-white"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{hasStrokes ? "Looks good" : "Sign above"}</span>
        <button
          type="button"
          onClick={clear}
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
