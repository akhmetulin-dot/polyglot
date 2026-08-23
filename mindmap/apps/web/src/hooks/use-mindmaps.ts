import { useState, useEffect, useCallback, useRef } from 'react';
import { getMaps, saveMap, markMapDeleted, type MapRecord, type NodeRecord, syncTransaction } from '../lib/idb';
import { runBackgroundSync, subscribeToSyncStatus, subscribeToDataChanges, type SyncStatus } from '../lib/sync';

export function useMindmaps() {
  const [maps, setMaps] = useState<MapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');

  const load = useCallback(async () => {
    const data = await getMaps();
    setMaps(data.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const unsub = subscribeToSyncStatus(setSyncStatus);
    const unsubData = subscribeToDataChanges(load);
    runBackgroundSync();
    return () => {
      unsub();
      unsubData();
    };
  }, [load]);

  const create = async (title: string) => {
    const id = crypto.randomUUID();
    const newMap: MapRecord = {
      id,
      title,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSyncedRevision: 0,
      dirty: true
    };
    const rootNode: NodeRecord = {
      id: crypto.randomUUID(),
      mapId: id,
      parentId: null,
      text: title,
      order: 0,
      collapsed: false
    };

    await syncTransaction(
      (mapsStore) => mapsStore.put(newMap),
      (nodesStore) => nodesStore.put(rootNode)
    );
    
    await load();
    runBackgroundSync();
    return id;
  };

  const remove = async (id: string) => {
    await markMapDeleted(id);
    await load();
    runBackgroundSync();
  };

  const rename = async (id: string, newTitle: string) => {
    const map = maps.find(m => m.id === id);
    if (map) {
      map.title = newTitle;
      map.dirty = true;
      map.updatedAt = new Date().toISOString();
      await saveMap(map);
      await load();
      runBackgroundSync();
    }
  };

  return { maps, loading, create, remove, rename, refresh: load, syncStatus };
}
