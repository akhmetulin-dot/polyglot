import React, { useRef, useMemo, useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { usePanZoom } from '@/hooks/use-pan-zoom';
import { buildTree, layoutTree, getFlatLayout } from '@/lib/tree-layout';
import type { NodeRecord } from '@/lib/idb';
import { MapNode } from './MapNode';

// Estimate text pixel width for layout
function estimateWidth(text: string) {
  return Math.max(48, Math.min(220, text.length * 7.5 + 24));
}

export interface MapCanvasHandle {
  fitToScreen: () => void;
}

interface MapCanvasProps {
  nodes: NodeRecord[];
  selectedId: string | null;
  onSelectChange: (id: string | null) => void;
  onUpdateNode: (id: string, updates: Partial<NodeRecord>) => void;
  onAddChild: (parentId: string, text?: string) => string | undefined;
  onAddSibling: (nodeId: string, text?: string) => string | null | undefined;
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { nodes, selectedId, onSelectChange, onUpdateNode, onAddChild },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Start with a reasonable transform so nodes at layout origin (0,0) land
  // roughly in the left-center of a mobile screen. doFit() will refine it.
  const { transform, setTransform } = usePanZoom(containerRef, { x: 60, y: 400, scale: 1 });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Keep latest layout in a ref so doFit() always reads fresh values
  const layoutRef = useRef<{
    layoutNodes: ReturnType<typeof getFlatLayout>;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  }>({ layoutNodes: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } });

  const { layoutNodes, links } = useMemo(() => {
    const root = buildTree(nodes);
    if (!root) {
      layoutRef.current = { layoutNodes: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } };
      return { layoutNodes: [], links: [] };
    }

    layoutTree(root);
    const flat = getFlatLayout(root);

    const lnks: { id: string; d: string }[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    flat.forEach(n => {
      const w = estimateWidth(n.text);
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + w);
      minY = Math.min(minY, n.y - 14);
      maxY = Math.max(maxY, n.y + 14);

      if (!n.collapsed) {
        n.children.forEach(c => {
          const sx = n.x + w;
          const sy = n.y;
          const tx = c.x;
          const ty = c.y;
          const mx = (sx + tx) / 2;
          lnks.push({ id: `${n.id}-${c.id}`, d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}` });
        });
      }
    });

    layoutRef.current = { layoutNodes: flat, bounds: { minX, maxX, minY, maxY } };
    return { layoutNodes: flat, links: lnks };
  }, [nodes]);

  // doFit always reads fresh values from layoutRef
  const doFit = useCallback(() => {
    const el = containerRef.current;
    const { layoutNodes: ln, bounds } = layoutRef.current;
    if (!el || ln.length === 0) return;
    const rect = el.getBoundingClientRect();
    const { minX, maxX, minY, maxY } = bounds;
    const pad = 60;
    const scaleX = rect.width / (maxX - minX + pad * 2);
    const scaleY = rect.height / (maxY - minY + pad * 2);
    const scale = Math.min(1, scaleX, scaleY);
    const x = (rect.width - (maxX - minX) * scale) / 2 - minX * scale;
    const y = (rect.height - (maxY - minY) * scale) / 2 - minY * scale;
    setTransform({ x, y, scale });
  }, [setTransform]);

  // Auto-center once after first load (nodes appear)
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || layoutNodes.length === 0) return;
    initialized.current = true;
    // Double-rAF: first frame commits layout, second has accurate getBoundingClientRect
    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => doFit());
      return id2; // not returned from outer scope; cancel outer only
    });
    return () => cancelAnimationFrame(id1);
  }, [layoutNodes, doFit]);

  useImperativeHandle(ref, () => ({
    fitToScreen: doFit,
  }));

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const target = e.target as Element;
    if (target === containerRef.current || target.classList.contains('canvas-bg')) {
      onSelectChange(null);
      setEditingId(null);
    }
  };

  const transformStyle = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-background canvas-bg touch-none cursor-default relative outline-none"
      onPointerDown={handleCanvasPointerDown}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !editingId) {
          // handled by parent via toolbar
        }
        if (e.key === 'Escape') { setEditingId(null); }
      }}
    >
      {/* SVG links */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={transformStyle}
      >
        <g>
          {links.map(l => (
            <path
              key={l.id}
              d={l.d}
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
          ))}
        </g>
      </svg>

      {/* Nodes */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={transformStyle}
      >
        {layoutNodes.map(n => {
          // count descendants (only needed for badge)
          const descendantCount = nodes.filter(x => {
            let p = x.parentId;
            while (p) {
              if (p === n.id) return true;
              p = nodes.find(y => y.id === p)?.parentId ?? null;
            }
            return false;
          }).length;

          const hasChildren = n.children.length > 0;

          return (
            <div
              key={n.id}
              className="absolute pointer-events-auto"
              style={{
                left: n.x,
                top: n.y,
                transform: 'translateY(-50%)',
              }}
            >
              <MapNode
                node={n}
                selected={selectedId === n.id}
                editing={editingId === n.id}
                hasChildren={hasChildren}
                descendantCount={descendantCount}
                onSelect={() => { onSelectChange(n.id); setEditingId(null); }}
                onEdit={() => { onSelectChange(n.id); setEditingId(n.id); }}
                onEndEdit={(text) => {
                  setEditingId(null);
                  if (text !== n.text) onUpdateNode(n.id, { text });
                }}
                onToggleCollapse={() => onUpdateNode(n.id, { collapsed: !n.collapsed })}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
