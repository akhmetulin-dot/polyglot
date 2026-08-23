import React, { useState, useMemo, useRef } from 'react';
import { useRoute, Link } from 'wouter';
import { useMapEditor } from '@/hooks/use-map-editor';
import { MapCanvas, type MapCanvasHandle } from '@/components/MapCanvas';
import {
  ArrowLeft, Undo2, Redo2, Download, Share2, ClipboardCopy,
  Check, FolderInput, Plus, Trash2, Maximize2, MoreHorizontal,
  Share, Move, Copy, CornerDownRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { NodeRecord } from '@/lib/idb';

export default function MapEditor() {
  const [, params] = useRoute('/map/:id');
  const id = params?.id || '';

  const {
    mapInfo,
    nodes,
    loading,
    updateNode,
    addNode,
    addSibling,
    deleteNode,
    importSubtree,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useMapEditor(id);

  const canvasRef = useRef<MapCanvasHandle>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [shareNodeId, setShareNodeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importTargetId, setImportTargetId] = useState<string | null | undefined>(undefined);
  const [importText, setImportText] = useState('');
  const [moveNodeId, setMoveNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find(n => n.id === selectedId) : null),
    [selectedId, nodes],
  );

  // ── Share Markdown ───────────────────────────────────────────────────────────
  const shareText = useMemo(() => {
    if (!shareNodeId) return '';
    const node = nodes.find(n => n.id === shareNodeId);
    if (!node) return '';

    const path: string[] = [];
    let curr: NodeRecord | undefined = node;
    while (curr) {
      path.unshift(curr.text);
      if (!curr.parentId) break;
      curr = nodes.find(n => n.id === curr!.parentId);
    }

    function fmt(nId: string, depth: number): string {
      const n = nodes.find(x => x.id === nId);
      if (!n) return '';
      let s = `${'  '.repeat(depth)}- ${n.text}\n`;
      nodes
        .filter(x => x.parentId === nId)
        .sort((a, b) => a.order - b.order)
        .forEach(c => { s += fmt(c.id, depth + 1); });
      return s;
    }

    return `# ${path.join(' > ')}\n\n${fmt(shareNodeId, 0)}`;
  }, [shareNodeId, nodes]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) { console.error(e); }
  };

  const handleNativeShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Карта жизни: Ветка', text: shareText });
      } catch (e) { console.error(e); }
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────────
  const handleImport = () => {
    if (importText.trim()) importSubtree(importTargetId ?? null, importText);
    setImportTargetId(undefined);
    setImportText('');
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const handleExportMd = () => {
    if (!mapInfo) return;
    const root = nodes.find(n => !n.parentId);
    if (!root) return;

    function fmt(nId: string, depth: number): string {
      const n = nodes.find(x => x.id === nId);
      if (!n) return '';
      let s = `${'  '.repeat(depth)}- ${n.text}\n`;
      nodes.filter(x => x.parentId === nId).sort((a,b) => a.order - b.order)
        .forEach(c => { s += fmt(c.id, depth + 1); });
      return s;
    }

    const md = `# ${mapInfo.title}\n\n${fmt(root.id, 0)}`;
    trigger(md, `${mapInfo.title}.md`, 'text/markdown');
  };

  const handleExportJson = () => {
    if (!mapInfo) return;
    trigger(JSON.stringify({ map: mapInfo, nodes }, null, 2), `${mapInfo.title}.json`, 'application/json');
  };

  function trigger(content: string, filename: string, mime: string) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Move ─────────────────────────────────────────────────────────────────────
  const handleMoveNode = (newParentId: string) => {
    if (moveNodeId) updateNode(moveNodeId, { parentId: newParentId, order: Date.now() });
    setMoveNodeId(null);
  };

  // ── Bottom toolbar actions ────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!selectedId) return;
    const node = nodes.find(n => n.id === selectedId);
    if (!node) return;
    const hasChildren = nodes.some(n => n.parentId === selectedId);
    if (hasChildren
      ? confirm('Удалить этот узел и все вложенные?')
      : true) {
      deleteNode(selectedId);
      setSelectedId(null);
    }
  };

  const handleAddChild = () => {
    if (!selectedId) return;
    const newId = addNode(selectedId, '');
    if (newId) setSelectedId(newId);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header className="h-12 flex-none flex items-center justify-between px-3 z-10 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Link href="/">
            <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-foreground/70">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <span className="text-sm font-medium truncate max-w-[180px] text-foreground/90">
            {mapInfo?.title || '…'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Undo / Redo */}
          <button
            onClick={undo} disabled={!canUndo}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-25 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo} disabled={!canRedo}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-25 transition-colors"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Settings / export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-foreground/70">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleExportMd}>
                <Download className="mr-2 w-4 h-4" /> Экспорт Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson}>
                <Download className="mr-2 w-4 h-4" /> Экспорт JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                const root = nodes.find(n => !n.parentId);
                setImportTargetId(root?.id ?? null);
              }}>
                <FolderInput className="mr-2 w-4 h-4" /> Вставить текст как ветку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ── Canvas ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-0">
        <MapCanvas
          ref={canvasRef}
          nodes={nodes}
          selectedId={selectedId}
          onSelectChange={setSelectedId}
          onUpdateNode={updateNode}
          onAddChild={addNode}
          onAddSibling={addSibling}
        />
      </div>

      {/* ── Bottom toolbar (Фокус style) ──────────────────────────────────────── */}
      <div className="flex-none h-16 border-t border-white/5 bg-card/60 backdrop-blur flex items-center justify-around px-6 z-10 pb-safe">
        {/* Node options — shows share / import / move / rename for selected node */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!selectedNode}
              className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-colors
                ${selectedNode ? 'bg-white/8 hover:bg-white/15 text-foreground' : 'text-foreground/25'}
              `}
            >
              <div className="w-8 h-8 rounded-full border-2 border-current flex items-center justify-center">
                <MoreHorizontal className="w-4 h-4" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 mb-2">
            <DropdownMenuItem onClick={() => selectedId && setShareNodeId(selectedId)}>
              <Share className="mr-2 w-4 h-4" /> Поделиться с агентом
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => selectedId && setImportTargetId(selectedId)}>
              <FolderInput className="mr-2 w-4 h-4" /> Вставить ветку сюда
            </DropdownMenuItem>
            {selectedNode?.parentId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => selectedId && addSibling(selectedId, '')}>
                  <CornerDownRight className="mr-2 w-4 h-4" /> Добавить соседний
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedId && setMoveNodeId(selectedId)}>
                  <Move className="mr-2 w-4 h-4" /> Переместить узел
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={!selectedNode}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-colors
            ${selectedNode
              ? 'bg-white/8 hover:bg-red-500/20 text-foreground hover:text-red-400'
              : 'text-foreground/25'}
          `}
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Add child */}
        <button
          onClick={handleAddChild}
          disabled={!selectedNode}
          className={`
            w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg
            ${selectedNode
              ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
              : 'bg-white/10 text-foreground/25'}
          `}
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Fit to screen */}
        <button
          onClick={() => canvasRef.current?.fitToScreen()}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/15 text-foreground/70 hover:text-foreground transition-colors"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>

      {/* ── Share dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!shareNodeId} onOpenChange={open => !open && setShareNodeId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Поделиться с агентом</DialogTitle>
            <DialogDescription>
              Скопируйте текст ниже и вставьте в чат с ИИ — агент сразу поймёт контекст.
            </DialogDescription>
          </DialogHeader>
          <pre className="p-3 rounded-lg bg-secondary/50 text-xs font-mono text-secondary-foreground whitespace-pre-wrap max-h-[280px] overflow-auto border">
            {shareText}
          </pre>
          <DialogFooter className="flex gap-2 sm:justify-between w-full">
            <Button variant="ghost" onClick={() => setShareNodeId(null)}>Закрыть</Button>
            <div className="flex gap-2">
              {typeof navigator.share === 'function' && (
                <Button variant="outline" onClick={handleNativeShare}>
                  <Share2 className="w-4 h-4 mr-2" /> Поделиться
                </Button>
              )}
              <Button onClick={handleCopyShare}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <ClipboardCopy className="w-4 h-4 mr-2" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={importTargetId !== undefined}
        onOpenChange={open => !open && setImportTargetId(undefined)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Вставить ветку</DialogTitle>
            <DialogDescription>
              Маркированный список или текст с отступами — каждая строка станет узлом.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={"- Первый пункт\n  - Подпункт 1\n  - Подпункт 2"}
            className="min-h-[180px] font-mono text-sm"
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportTargetId(undefined)}>Отмена</Button>
            <Button onClick={handleImport} disabled={!importText.trim()}>Импортировать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={moveNodeId !== null} onOpenChange={open => !open && setMoveNodeId(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Выберите нового родителя</DialogTitle>
          </DialogHeader>
          <div className="py-2 overflow-y-auto flex-1 border rounded-md">
            {nodes.map(n => {
              let p: string | null = n.parentId;
              let isDesc = n.id === moveNodeId;
              while (p && !isDesc) {
                if (p === moveNodeId) isDesc = true;
                p = nodes.find(y => y.id === p)?.parentId ?? null;
              }
              if (isDesc) return null;
              return (
                <button
                  key={n.id}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-secondary truncate"
                  onClick={() => handleMoveNode(n.id)}
                >
                  {n.text || '(Пустой узел)'}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveNodeId(null)}>Отмена</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
