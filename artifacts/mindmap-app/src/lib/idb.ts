export interface MapRecord {
  id: string;
  title: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedRevision: number;
  dirty: boolean;
  deleted?: boolean;
}

export interface NodeRecord {
  id: string;
  mapId: string;
  parentId: string | null;
  text: string;
  order: number;
  collapsed: boolean;
}

const DB_NAME = 'mindmap_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('maps')) {
          db.createObjectStore('maps', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('nodes')) {
          const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
          nodeStore.createIndex('mapId', 'mapId', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function getMaps(): Promise<MapRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('maps', 'readonly');
    const store = tx.objectStore('maps');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.filter(m => !m.deleted));
    request.onerror = () => reject(request.error);
  });
}

export async function getMap(id: string): Promise<MapRecord | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('maps', 'readonly');
    const store = tx.objectStore('maps');
    const request = store.get(id);
    request.onsuccess = () => {
      const map = request.result;
      if (map && !map.deleted) resolve(map);
      else resolve(null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveMap(map: MapRecord): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('maps', 'readwrite');
    const store = tx.objectStore('maps');
    const request = store.put(map);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function markMapDeleted(id: string): Promise<void> {
  const map = await getMap(id);
  if (!map) return;
  map.deleted = true;
  map.dirty = true;
  map.updatedAt = new Date().toISOString();
  await saveMap(map);
}

export async function getNodes(mapId: string): Promise<NodeRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('nodes', 'readonly');
    const store = tx.objectStore('nodes');
    const index = store.index('mapId');
    const request = index.getAll(mapId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveNodes(nodes: NodeRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('nodes', 'readwrite');
    const store = tx.objectStore('nodes');
    nodes.forEach(node => store.put(node));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Atomically replace a map's whole node set (persists deletions too)
export async function replaceNodes(mapId: string, nodes: NodeRecord[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('nodes', 'readwrite');
    const store = tx.objectStore('nodes');
    const index = store.index('mapId');
    const request = index.openCursor(IDBKeyRange.only(mapId));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        nodes.forEach(node => store.put(node));
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteNodesByMap(mapId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('nodes', 'readwrite');
    const store = tx.objectStore('nodes');
    const index = store.index('mapId');
    const request = index.openCursor(IDBKeyRange.only(mapId));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncTransaction(
  mapOps: (store: IDBObjectStore) => void,
  nodeOps: (store: IDBObjectStore) => void
): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['maps', 'nodes'], 'readwrite');
    mapOps(tx.objectStore('maps'));
    nodeOps(tx.objectStore('nodes'));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDirtyMaps(): Promise<MapRecord[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('maps', 'readonly');
    const store = tx.objectStore('maps');
    const request = store.getAll();
    request.onsuccess = () => {
      resolve(request.result.filter((m: MapRecord) => m.dirty));
    };
    request.onerror = () => reject(request.error);
  });
}
