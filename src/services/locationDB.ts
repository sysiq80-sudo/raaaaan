/**
 * ران — IndexedDB Location Buffer (locationDB.ts)
 *
 * Stores GPS pings locally when offline. Zero dependencies — pure IndexedDB API.
 * Automatically synced to Supabase driver_live_locations upon reconnection.
 */

const DB_NAME    = 'raan-locations';
const DB_VERSION = 1;
const STORE_NAME = 'location-buffer';

export interface BufferedLocation {
  id?:       number;       // auto-increment local PK
  driver_id: string;
  ride_id:   string;
  lat:       number;
  lng:       number;
  accuracy:  number;
  heading?:  number | null;
  speed?:    number | null;
  timestamp: number;
  synced:    boolean;      // false = not yet pushed to Supabase
}

let _db: IDBDatabase | null = null;

// ─────────────────────────────────────────────────────────────
// Internal
// ─────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id', autoIncrement: true,
        });
        store.createIndex('by_driver',    'driver_id', { unique: false });
        store.createIndex('by_ride',      'ride_id',   { unique: false });
        store.createIndex('by_synced',    'synced',    { unique: false });
        store.createIndex('by_timestamp', 'timestamp', { unique: false });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      _db.onclose = () => { _db = null; };
      resolve(_db);
    };
    req.onerror   = () => reject(req.error);
    req.onblocked = () => console.warn('[locationDB] upgrade blocked by open tab');
  });
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Persist a GPS ping; returns the auto-incremented local id. */
export async function addLocation(
  data: Omit<BufferedLocation, 'id' | 'synced'>,
): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const r  = tx.objectStore(STORE_NAME).add({ ...data, synced: false });
    r.onsuccess = () => resolve(r.result as number);
    r.onerror   = () => reject(r.error);
  });
}

/** All un-synced pings for a driver, sorted oldest-first. */
export async function getPendingLocations(
  driverId: string,
): Promise<BufferedLocation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const index = tx.objectStore(STORE_NAME).index('by_driver');
    const r     = index.getAll(IDBKeyRange.only(driverId));
    r.onsuccess = () =>
      resolve(
        (r.result as BufferedLocation[])
          .filter((x) => !x.synced)
          .sort((a, b) => a.timestamp - b.timestamp),
      );
    r.onerror = () => reject(r.error);
  });
}

/** Mark a batch of local ids as successfully synced. */
export async function markLocationsSynced(ids: number[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDB();
  return new Promise((resolve) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let left = ids.length;
    const done = () => { if (--left === 0) resolve(); };

    for (const id of ids) {
      const get = store.get(id);
      get.onsuccess = () => {
        const rec = get.result as BufferedLocation | undefined;
        if (rec) { rec.synced = true; store.put(rec); }
        done();
      };
      get.onerror = done;
    }
  });
}

/** Delete synced records older than `ms` milliseconds (default 24 h). */
export async function purgeOldLocations(ms = 86_400_000): Promise<number> {
  const db     = await openDB();
  const cutoff = Date.now() - ms;
  let deleted  = 0;

  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.objectStore(STORE_NAME).index('by_timestamp');
    const cur   = index.openCursor(IDBKeyRange.upperBound(cutoff));

    cur.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) { resolve(deleted); return; }
      if ((cursor.value as BufferedLocation).synced) {
        cursor.delete();
        deleted++;
      }
      cursor.continue();
    };
    cur.onerror = () => reject(cur.error);
  });
}

/** Count pending (un-synced) pings for a driver. */
export async function countPending(driverId: string): Promise<number> {
  return (await getPendingLocations(driverId)).length;
}
