import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../store';
import { parseKey, makeKey } from '../utils/coords';

export const Editor2D: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { board, cells, palette, setCell, fill, activeTool, selectedColorId } = useStore();
  
  // Viewport state for pan/zoom
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#f8fafc'; // Slate 50
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Transform
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Center grid in view initially if reset
    const cellSize = 20; // Base pixel size for rendering
    const gridWidth = board.cols * cellSize;
    const gridHeight = board.rows * cellSize;
    const startX = (rect.width / scale - gridWidth) / 2; 
    const startY = (rect.height / scale - gridHeight) / 2;

    // Draw Grid Background
    ctx.fillStyle = '#e2e8f0'; // Slate 200
    ctx.fillRect(startX, startY, gridWidth, gridHeight);

    // Draw Grid Lines (optional optimization: skip if zoomed out too far)
    ctx.strokeStyle = '#cbd5e1'; // Slate 300
    ctx.lineWidth = 1 / scale;
    ctx.beginPath();
    for (let i = 0; i <= board.cols; i++) {
        ctx.moveTo(startX + i * cellSize, startY);
        ctx.lineTo(startX + i * cellSize, startY + gridHeight);
    }
    for (let j = 0; j <= board.rows; j++) {
        ctx.moveTo(startX, startY + j * cellSize);
        ctx.lineTo(startX + gridWidth, startY + j * cellSize);
    }
    ctx.stroke();

    // Draw Peg Holes (Empty)
    ctx.fillStyle = '#94a3b8'; // Slate 400
    for (let x = 0; x < board.cols; x++) {
        for (let y = 0; y < board.rows; y++) {
            const cx = startX + x * cellSize + cellSize / 2;
            const cy = startY + y * cellSize + cellSize / 2;
            const r = (cellSize / 4); // Hole radius
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw Active Cylinders
    cells.forEach((colorId, key) => {
        const { x, y } = parseKey(key);
        const color = palette.find(p => p.id === colorId)?.hex || '#000';
        
        const cx = startX + x * cellSize + cellSize / 2;
        const cy = startY + y * cellSize + cellSize / 2;
        const r = (cellSize / 2) - 2; // Cylinder radius

        ctx.fillStyle = color;
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
        
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner hole
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        
        // Highlight (Fake 3D)
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(cx - r*0.2, cy - r*0.2, r*0.3, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();

  }, [board, cells, palette, scale, offset]);

  // Interaction Logic
  const handleInteract = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cellSize = 20;
    const gridWidth = board.cols * cellSize;
    const gridHeight = board.rows * cellSize;
    
    // Reverse Transform
    const relativeX = (clientX - rect.left - offset.x) / scale;
    const relativeY = (clientY - rect.top - offset.y) / scale;

    const startX = (rect.width / scale - gridWidth) / 2; 
    const startY = (rect.height / scale - gridHeight) / 2;

    const gridX = Math.floor((relativeX - startX) / cellSize);
    const gridY = Math.floor((relativeY - startY) / cellSize);

    if (gridX >= 0 && gridX < board.cols && gridY >= 0 && gridY < board.rows) {
        if (activeTool === 'fill') {
            fill(gridX, gridY);
        } else {
            setCell(gridX, gridY);
        }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || activeTool === 'line') { // Middle click or specific tools could be drag
         setIsDragging(true);
         setLastPos({ x: e.clientX, y: e.clientY });
    } else {
        handleInteract(e.clientX, e.clientY);
        setIsDragging(true); // Allow painting
        setLastPos({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    // Pan logic (using two fingers or specific modifier)
    // For simplicity: If tool is drag (not impl) or if just panning
    // Here we implement "Paint Drag" for pencil/eraser
    if (activeTool === 'pencil' || activeTool === 'eraser') {
         handleInteract(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-100 touch-none">
       <canvas 
         ref={canvasRef}
         className="w-full h-full block"
         style={{ width: '100%', height: '100%' }}
         onPointerDown={handlePointerDown}
         onPointerMove={handlePointerMove}
         onPointerUp={handlePointerUp}
         onPointerLeave={handlePointerUp}
       />
       
       {/* Zoom Controls Overlay */}
       <div className="absolute bottom-4 right-4 flex gap-2">
         <button className="bg-white p-2 shadow rounded-full" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>-</button>
         <button className="bg-white p-2 shadow rounded-full" onClick={() => setScale(1)}>1:1</button>
         <button className="bg-white p-2 shadow rounded-full" onClick={() => setScale(s => Math.min(3, s + 0.1))}>+</button>
       </div>
    </div>
  );
};
