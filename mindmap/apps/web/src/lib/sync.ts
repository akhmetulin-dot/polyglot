import { getDirtyMaps, getMaps, getNodes, saveMap, saveNodes, syncTransaction, deleteNodesByMap, type MapRecord, type NodeRecord } from './idb';
import { listMindmaps, syncMindmapNodes, createMindmap, updateMindmap, deleteMindmap, getMindmap } from '@mindmap/api-client-react';

let syncInProgress = false;

// Simple event emitter for sync status
export type SyncStatus = 'offline' | 'syncing' | 'synced';
let currentStatus: SyncStatus = navigator.onLine ? 'synced' : 'offline';
const listeners = new Set<(status: SyncStatus) => void>();

export function subscribeToSyncStatus(listener: (status: SyncStatus) => void) {
  listeners.add(listener);
  listener(currentStatus);
  return () => listeners.delete(listener);
}

function setStatus(status: SyncStatus) {
  if (currentStatus !== status) {
    currentStatus = status;
    listeners.forEach(l => l(status));
  }
}

// Listeners notified when sync pulled fresh data into IndexedDB (UI should reload)
const dataListeners = new Set<() => void>();

export function subscribeToDataChanges(listener: () => void) {
  dataListeners.add(listener);
  return () => {
    dataListeners.delete(listener);
  };
}

function notifyDataChanged() {
  dataListeners.forEach(l => l());
}

async function pullMapFromServer(
  id: string,
  prefetched?: Awaited<ReturnType<typeof getMindmap>>,
) {
  const data = prefetched ?? (await getMindmap(id));
  const record: MapRecord = {
    id: data.map.id,
    title: data.map.title,
    revision: data.map.revision,
    createdAt: data.map.createdAt,
    updatedAt: data.map.updatedAt,
    lastSyncedRevision: data.map.revision,
    dirty: false,
  };
  await saveMap(record);
  await deleteNodesByMap(id);
  const nodes: NodeRecord[] = data.nodes.map(n => ({
    id: n.id,
    mapId: id,
    parentId: n.parentId,
    text: n.text,
    order: n.order,
    collapsed: n.collapsed,
  }));
  if (nodes.length > 0) await saveNodes(nodes);
}

export async function runBackgroundSync() {
  if (syncInProgress || !navigator.onLine) {
    if (!navigator.onLine) setStatus('offline');
    return;
  }
  
  syncInProgress = true;
  setStatus('syncing');
  
  try {
    // 1. Fetch server maps to reconcile
    const serverMapsRes = await listMindmaps().catch(() => null);
    if (!serverMapsRes) {
      throw new Error("Failed to reach server");
    }
    const serverMaps = serverMapsRes.maps;
    const serverMapMap = new Map(serverMaps.map(m => [m.id, m]));

    // 2. Push local dirty maps
    const dirtyMaps = await getDirtyMaps();
    for (const map of dirtyMaps) {
      try {
        if (map.deleted) {
          if (serverMapMap.has(map.id)) {
            await deleteMindmap(map.id);
          }
          await syncTransaction(
            (mapsStore) => mapsStore.delete(map.id),
            (nodesStore) => {}
          );
          await deleteNodesByMap(map.id);
          continue;
        }

        const nodes = await getNodes(map.id);
        const serverMap = serverMapMap.get(map.id);
        
        if (!serverMap) {
          // Create
          await createMindmap({ id: map.id, title: map.title });
        } else if (serverMap.title !== map.title) {
          // Update title
          await updateMindmap(map.id, { title: map.title });
        }
        
        // Sync nodes
        try {
          const syncRes = await syncMindmapNodes(map.id, {
            baseRevision: map.lastSyncedRevision,
            nodes: nodes.map(n => ({
              id: n.id,
              parentId: n.parentId,
              text: n.text,
              order: n.order,
              collapsed: n.collapsed
            }))
          });
          // Update local map with new revision
          map.revision = syncRes.revision;
          map.lastSyncedRevision = syncRes.revision;
          map.dirty = false;
          await saveMap(map);
        } catch (e: any) {
          if (e?.status === 409 || e?.response?.status === 409) {
            // Conflict - server is newer. Pull server data.
            const serverData = await getMindmap(map.id);
            if (new Date(serverData.map.updatedAt) > new Date(map.updatedAt)) {
               // Server wins: replace local copy with server state
               await pullMapFromServer(serverData.map.id, serverData);
            } else {
              // Local is newer, force overwrite
              const syncRes = await syncMindmapNodes(map.id, {
                baseRevision: map.lastSyncedRevision,
                nodes: nodes.map(n => ({
                  id: n.id,
                  parentId: n.parentId,
                  text: n.text,
                  order: n.order,
                  collapsed: n.collapsed
                })),
                force: true
              });
              map.revision = syncRes.revision;
              map.lastSyncedRevision = syncRes.revision;
              map.dirty = false;
              await saveMap(map);
            }
          }
        }
      } catch (err) {
        console.error("Error syncing map", map.id, err);
      }
    }

    // 3. Pull maps that exist only on the server, or whose server revision is newer
    const localMaps = await getMaps();
    const localById = new Map(localMaps.map(m => [m.id, m]));
    for (const serverMap of serverMaps) {
      const local = localById.get(serverMap.id);
      if (!local || (!local.dirty && serverMap.revision > local.lastSyncedRevision)) {
        try {
          await pullMapFromServer(serverMap.id);
        } catch (err) {
          console.error("Error pulling map", serverMap.id, err);
        }
      }
    }

    setStatus('synced');
    notifyDataChanged();
  } catch (err) {
    console.error("Background sync failed", err);
    setStatus('offline'); // Treat network failure as offline
  } finally {
    syncInProgress = false;
  }
}

// Set up listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setStatus('syncing');
    runBackgroundSync();
  });
  window.addEventListener('offline', () => setStatus('offline'));
}
