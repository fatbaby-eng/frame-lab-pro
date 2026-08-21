import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditor } from '../EditorContext';
import type { PathData } from '../types';
import { createPathPoint } from '../types';

type PenSubMode = 'idle' | 'drawing' | 'editing';

export default function PathEditor({ compWidth, compHeight }: { compWidth: number; compHeight: number }) {
  const { state, selectClip, updateClipProperty, addClip } = useEditor();
  const { selectedClipId, toolMode, currentTime } = state;

  const svgRef = useRef<SVGSVGElement>(null);
  const [penSubMode, setPenSubMode] = useState<PenSubMode>('idle');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'cpIn' | 'cpOut' | 'anchor' | null>(null);
  const [dragPointIndex, setDragPointIndex] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const comp = state.project.compositions.find(c => c.id === state.project.activeCompositionId)!;
  const clip = selectedClipId ? comp.tracks.flatMap(t => t.clips).find(c => c.id === selectedClipId && c.type === 'path') : null;
  const path = clip?.pathData;

  // Convert screen coords to composition coords
  const toComp = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = compWidth / rect.width;
    const scaleY = compHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [compWidth, compHeight]);

  // If no path clip selected and pen mode is active, create one on first click
  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    if (toolMode !== 'pen') return;
    // Ignore clicks that are part of a drag
    if (draggingHandle) return;
    const pos = toComp(e.clientX, e.clientY);

    if (!clip) {
      const newClipId = addClip(undefined, 'path', currentTime, 5, undefined, undefined, {
        pathData: {
          points: [createPathPoint(pos.x, pos.y)],
          closed: false,
        },
      });
      selectClip(newClipId);
      setPenSubMode('drawing');
      return;
    }

    if (!path) return;

    // Check if clicking on first point to close path
    if (path.points.length > 2 && hoveredPoint === 0 && penSubMode === 'drawing') {
      updateClipProperty(clip.id, 'pathData', { ...path, closed: true });
      setPenSubMode('editing');
      return;
    }

    // Add new point
    if (hoveredPoint === null && penSubMode !== 'editing') {
      const newPt = createPathPoint(pos.x, pos.y, path.points[path.points.length - 1]);
      const newPath: PathData = {
        points: [...path.points, newPt],
        closed: path.closed,
      };
      updateClipProperty(clip.id, 'pathData', newPath);
      setPenSubMode('drawing');
      setSelectedPoint(newPath.points.length - 1);
    }
  }, [toolMode, clip, path, hoveredPoint, penSubMode, toComp, currentTime, comp, addClip, updateClipProperty, selectClip, draggingHandle]);

  // Mouse down on anchor point
  const handleAnchorMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (toolMode !== 'pen') return;
    const pos = toComp(e.clientX, e.clientY);
    setDraggingHandle('anchor');
    setDragPointIndex(index);
    setDragStart(pos);
    if (path) {
      setDragOffset({ x: path.points[index].x, y: path.points[index].y });
    }
    setSelectedPoint(index);
  }, [toolMode, toComp, path]);

  // Mouse down on control handle
  const handleCpMouseDown = useCallback((e: React.MouseEvent, index: number, handle: 'cpIn' | 'cpOut') => {
    e.stopPropagation();
    if (toolMode !== 'pen') return;
    const pos = toComp(e.clientX, e.clientY);
    setDraggingHandle(handle);
    setDragPointIndex(index);
    setDragStart(pos);
    if (path) {
      const pt = path.points[index];
      if (handle === 'cpIn') {
        setDragOffset({ x: pt.cpInX, y: pt.cpInY });
      } else {
        setDragOffset({ x: pt.cpOutX, y: pt.cpOutY });
      }
    }
    setSelectedPoint(index);
  }, [toolMode, toComp, path]);

  // Global mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingHandle || dragPointIndex === null || !clip || !path) return;
    const pos = toComp(e.clientX, e.clientY);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;

    const newPoints = [...path.points];
    const pt = { ...newPoints[dragPointIndex] };

    if (draggingHandle === 'anchor') {
      const oldX = pt.x;
      const oldY = pt.y;
      pt.x = dragOffset.x + dx;
      pt.y = dragOffset.y + dy;
      // Shift handles relative to anchor movement
      pt.cpInX += pt.x - oldX;
      pt.cpInY += pt.y - oldY;
      pt.cpOutX += pt.x - oldX;
      pt.cpOutY += pt.y - oldY;
    } else if (draggingHandle === 'cpOut') {
      pt.cpOutX = dragOffset.x + dx;
      pt.cpOutY = dragOffset.y + dy;
      // Mirror cpIn for smooth curve
      pt.cpInX = -pt.cpOutX;
      pt.cpInY = -pt.cpOutY;
    } else if (draggingHandle === 'cpIn') {
      pt.cpInX = dragOffset.x + dx;
      pt.cpInY = dragOffset.y + dy;
      // Mirror cpOut for smooth curve
      pt.cpOutX = -pt.cpInX;
      pt.cpOutY = -pt.cpInY;
    }

    newPoints[dragPointIndex] = pt;
    updateClipProperty(clip.id, 'pathData', { ...path, points: newPoints });
  }, [draggingHandle, dragPointIndex, clip, path, dragStart, dragOffset, toComp, updateClipProperty]);

  // Global mouse up
  const handleMouseUp = useCallback(() => {
    setDraggingHandle(null);
    setDragPointIndex(null);
  }, []);

  // Keyboard: Escape exits drawing mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (toolMode === 'pen' && e.key === 'Escape') {
        setPenSubMode('editing');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolMode]);

  if (toolMode !== 'pen') return null;

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 z-40 overflow-visible"
      viewBox={`0 0 ${compWidth} ${compHeight}`}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
      onClick={handleSvgClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Handles only — the canvas already strokes the path */}
      {path && path.points.map((pt, i) => (
        <g key={i}>
          {/* Control handle lines */}
          {path.points.length > 1 && (
            <>
              <line
                x1={pt.x} y1={pt.y}
                x2={pt.x + pt.cpOutX} y2={pt.y + pt.cpOutY}
                stroke="#6366f166" strokeWidth={1}
                style={{ pointerEvents: 'none' }}
              />
              <line
                x1={pt.x} y1={pt.y}
                x2={pt.x + pt.cpInX} y2={pt.y + pt.cpInY}
                stroke="#6366f166" strokeWidth={1}
                style={{ pointerEvents: 'none' }}
              />
              {/* Control handle: cpOut */}
              <rect
                x={pt.x + pt.cpOutX - 3} y={pt.y + pt.cpOutY - 3}
                width={6} height={6}
                fill="#818cf8"
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => handleCpMouseDown(e, i, 'cpOut')}
              />
              {/* Control handle: cpIn */}
              <rect
                x={pt.x + pt.cpInX - 3} y={pt.y + pt.cpInY - 3}
                width={6} height={6}
                fill="#818cf8"
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => handleCpMouseDown(e, i, 'cpIn')}
              />
            </>
          )}
          {/* Anchor point */}
          <circle
            cx={pt.x} cy={pt.y} r={5}
            fill={i === 0 && path.closed ? '#22c55e' : selectedPoint === i ? '#ec4899' : '#ffffff'}
            stroke="#6366f1"
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
            onMouseDown={(e) => handleAnchorMouseDown(e, i)}
          />
        </g>
      ))}

      {/* Preview line from last point to mouse when drawing */}
      {path && penSubMode === 'drawing' && path.points.length > 0 && !path.closed && (
        <path
          d={pathToSvg(path)}
          fill="none"
          stroke={clip?.pathStrokeColor || '#6366f1'}
          strokeWidth={(clip?.pathStrokeWidth || 3) * 0.5}
          strokeDasharray="4 4"
          opacity={0.5}
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
}

function pathToSvg(path: PathData): string {
  if (path.points.length < 2) return '';
  const pts = path.points;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    d += ` C ${prev.x + prev.cpOutX} ${prev.y + prev.cpOutY}, ${curr.x + curr.cpInX} ${curr.y + curr.cpInY}, ${curr.x} ${curr.y}`;
  }
  if (path.closed && pts.length > 2) {
    const last = pts[pts.length - 1];
    const first = pts[0];
    d += ` C ${last.x + last.cpOutX} ${last.y + last.cpOutY}, ${first.x + first.cpInX} ${first.y + first.cpInY}, ${first.x} ${first.y} Z`;
  }
  return d;
}
