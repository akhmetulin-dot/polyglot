import React, { useRef, useState, useEffect } from 'react';

interface Transform {
  x: number;
  y: number;
  scale: number;
}

export function usePanZoom(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialTransform: Transform = { x: 0, y: 0, scale: 1 },
) {
  const [transform, setTransform] = useState<Transform>(initialTransform);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey) {
        // Zoom
        const zoomSensitivity = 0.01;
        const delta = -e.deltaY * zoomSensitivity;
        
        setTransform((prev) => {
          const newScale = Math.min(Math.max(0.2, prev.scale * (1 + delta)), 5);
          
          // Calculate mouse position relative to container
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;

          // Adjust offset to zoom into mouse point
          const scaleRatio = newScale / prev.scale;
          const newX = mx - (mx - prev.x) * scaleRatio;
          const newY = my - (my - prev.y) * scaleRatio;

          return { x: newX, y: newY, scale: newScale };
        });
      } else {
        // Pan
        setTransform(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
          scale: prev.scale
        }));
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target !== el && !(e.target as Element).classList.contains('canvas-background')) return;
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return;
      
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };

      setTransform(prev => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy
      }));
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDragging.current = false;
      el.releasePointerCapture(e.pointerId);
    };

    // prevent default pinch zoom on mobile
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerUp);
    el.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerUp);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, [containerRef]);

  return { transform, setTransform };
}
