import React, { useRef, useEffect } from 'react';
import { type LayoutNode } from '@/lib/tree-layout';

interface MapNodeProps {
  node: LayoutNode;
  selected: boolean;
  editing: boolean;
  hasChildren: boolean;
  descendantCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onEndEdit: (text: string) => void;
  onToggleCollapse: () => void;
}

export function MapNode({
  node,
  selected,
  editing,
  hasChildren,
  descendantCount,
  onSelect,
  onEdit,
  onEndEdit,
  onToggleCollapse,
}: MapNodeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(0, inputRef.current.value.length);
    }
  }, [editing]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEndEdit(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onEndEdit(node.text);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onEndEdit(e.target.value);
  };

  return (
    <div
      className="relative flex items-center gap-1.5 select-none cursor-pointer"
      style={{ height: 28 }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(); }}
    >
      {/* Collapse toggle circle — left side, only if node has children */}
      {hasChildren && (
        <button
          className={`
            flex-none w-4 h-4 rounded-full border flex items-center justify-center z-10
            transition-colors
            ${node.collapsed
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-muted-foreground/40 bg-transparent text-muted-foreground/60 hover:border-muted-foreground'}
          `}
          style={{ minWidth: 16 }}
          onClick={(e) => { e.stopPropagation(); onToggleCollapse(); }}
          title={node.collapsed ? 'Развернуть' : 'Свернуть'}
        >
          {node.collapsed && descendantCount > 0 && (
            <span className="text-[8px] font-bold leading-none">{descendantCount > 9 ? '9+' : descendantCount}</span>
          )}
          {!node.collapsed && (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </button>
      )}

      {/* Text / input */}
      <div
        className={`
          px-1.5 rounded-sm transition-colors whitespace-nowrap
          ${selected
            ? 'bg-primary/15 text-foreground ring-1 ring-primary/60'
            : 'text-foreground/85 hover:text-foreground'}
        `}
      >
        {editing ? (
          <input
            ref={inputRef}
            defaultValue={node.text}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            style={{ width: Math.max(60, (node.text?.length || 0) * 8 + 20) }}
            placeholder="Новый узел"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm tracking-tight leading-none">
            {node.text || <span className="text-muted-foreground/40 italic">…</span>}
          </span>
        )}
      </div>
    </div>
  );
}
