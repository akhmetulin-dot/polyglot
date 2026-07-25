import { useState, useEffect, useCallback, useRef } from 'react';
import { getMap, getNodes, saveMap, replaceNodes, type MapRecord, type NodeRecord } from '../lib/idb';
import { runBackgroundSync, subscribeToDataChanges } from '../lib/sync';

export function useMapEditor(mapId: string) {
  const [mapInfo, setMapInfo] = useState<MapRecord | null>(null);
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Single source of truth for the current node set. All mutations go through
  // applyNodes() so they run exactly once (never inside a React updater,
  // which React may invoke multiple times).
  const nodesRef = useRef<NodeRecord[]>([]);
  const historyRef = useRef<NodeRecord[][]>([]);
  const historyIndexRef = useRef<number>(-1);
  const saveTimeoutRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [info, nds] = await Promise.all([getMap(mapId), getNodes(mapId)]);
    if (info) setMapInfo(info);
    if (nds.length > 0) {
      nodesRef.current = nds;
      setNodes(nds);
      if (historyRef.current.length === 0) {
        historyRef.current = [JSON.parse(JSON.stringify(nds))];
        historyIndexRef.current = 0;
      }
    }
    setLoading(false);
  }, [mapId]);

  useEffect(() => {
    load();
    // Also trigger a sync so we pull from server if map isn't in IndexedDB yet
    runBackgroundSync();
    // Reload when background sync pulled fresh data, but never while a local
    // save is pending (the local edit is newer).
    const unsub = subscribeToDataChanges(() => {
      if (!saveTimeoutRef.current) load();
    });
    return () => {
      unsub();
    };
  }, [load]);

  const scheduleSave = useCallback((newNodes: NodeRecord[]) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = window.setTimeout(async () => {
      saveTimeoutRef.current = null;
      // Replace the whole map's node set so deletions are persisted too
      await replaceNodes(mapId, newNodes);
      if (mapInfo) {
        mapInfo.dirty = true;
        mapInfo.updatedAt = new Date().toISOString();
        await saveMap(mapInfo);
      }
      runBackgroundSync();
    }, 1000); // debounce 1s
  }, [mapId, mapInfo]);

  const commitNodes = useCallback((newNodes: NodeRecord[]) => {
    nodesRef.current = newNodes;
    setNodes(newNodes);

    // Manage history
    const history = historyRef.current;
    history.splice(historyIndexRef.current + 1);
    history.push(JSON.parse(JSON.stringify(newNodes)));
    // Keep last 50 states
    if (history.length > 50) {
      history.shift();
    }
    historyIndexRef.current = history.length - 1;

    scheduleSave(newNodes);
  }, [scheduleSave]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const state: NodeRecord[] = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      nodesRef.current = state;
      setNodes(state);
      scheduleSave(state);
    }
  }, [scheduleSave]);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const state: NodeRecord[] = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
      nodesRef.current = state;
      setNodes(state);
      scheduleSave(state);
    }
  }, [scheduleSave]);

  const updateNode = useCallback((id: string, updates: Partial<NodeRecord>) => {
    const next = nodesRef.current.map(n => (n.id === id ? { ...n, ...updates } : n));
    commitNodes(next);
  }, [commitNodes]);

  const addNode = useCallback((parentId: string, text: string = "") => {
    const current = nodesRef.current;
    const newNode: NodeRecord = {
      id: crypto.randomUUID(),
      mapId,
      parentId,
      text,
      order: Date.now(),
      collapsed: false
    };
    let next = [...current, newNode];
    const parent = current.find(n => n.id === parentId);
    if (parent && parent.collapsed) {
      next = next.map(n => (n.id === parentId ? { ...n, collapsed: false } : n));
    }
    commitNodes(next);
    return newNode.id;
  }, [mapId, commitNodes]);

  const addSibling = useCallback((nodeId: string, text: string = "") => {
    const current = nodesRef.current;
    const node = current.find(n => n.id === nodeId);
    if (!node || !node.parentId) return null; // Can't add sibling to root
    const newNode: NodeRecord = {
      id: crypto.randomUUID(),
      mapId,
      parentId: node.parentId,
      text,
      order: node.order + 1,
      collapsed: false
    };
    commitNodes([...current, newNode]);
    return newNode.id;
  }, [mapId, commitNodes]);

  const deleteNode = useCallback((id: string) => {
    const current = nodesRef.current;
    // Find all descendants
    const toDelete = new Set<string>([id]);
    let added = true;
    while (added) {
      added = false;
      current.forEach(n => {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          added = true;
        }
      });
    }
    commitNodes(current.filter(n => !toDelete.has(n.id)));
  }, [commitNodes]);

  // For importing tree strings
  const importSubtree = useCallback((parentId: string | null, markdownList: string) => {
    const lines = markdownList.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return;

    const current = nodesRef.current;
    const newNodes: NodeRecord[] = [];

    type StackItem = { depth: number, id: string };
    const stack: StackItem[] = [];
    let currentOrder = Date.now();

    for (const line of lines) {
      // match indentation and text
      const match = line.match(/^(\s*)(?:-\s*|\*\s*)?(.*)$/);
      if (!match) continue;

      const indentStr = match[1];
      const text = match[2].trim();
      // convert tabs to spaces
      const spaces = indentStr.replace(/\t/g, '  ').length;
      const depth = spaces; // heuristic: indentation level = spaces

      // pop stack until we find parent
      while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
        stack.pop();
      }

      const actualParentId = stack.length > 0 ? stack[stack.length - 1].id : parentId;
      const newNodeId = crypto.randomUUID();

      newNodes.push({
        id: newNodeId,
        mapId,
        parentId: actualParentId,
        text,
        order: currentOrder++,
        collapsed: false
      });

      stack.push({ depth, id: newNodeId });
    }

    let next = [...current, ...newNodes];
    // If attaching to existing parent, ensure it's not collapsed
    if (parentId) {
      next = next.map(n => (n.id === parentId ? { ...n, collapsed: false } : n));
    }
    commitNodes(next);
  }, [mapId, commitNodes]);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  return {
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
    canRedo
  };
}
