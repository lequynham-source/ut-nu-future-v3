import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'ut-nu-offline-db';
const STORE_NAME = 'offline-reports';
const CACHE_STORE = 'app-cache';
const VERSION = 2;

export interface OfflineReport {
  id?: number;
  type: 'driver' | 'sale' | 'return' | 'expense';
  data: any;
  timestamp: string;
  synced: boolean;
}

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('synced', 'synced');
          store.createIndex('type', 'type');
        }
        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          db.createObjectStore(CACHE_STORE);
        }
      },
    });
  }
  return dbPromise;
};

export const setCache = async (key: string, data: any) => {
  const db = await getDB();
  return db.put(CACHE_STORE, data, key);
};

export const getCache = async (key: string) => {
  const db = await getDB();
  return db.get(CACHE_STORE, key);
};

export const saveOfflineReport = async (report: Omit<OfflineReport, 'id' | 'synced'>) => {
  const db = await getDB();
  return db.add(STORE_NAME, {
    ...report,
    synced: false,
  });
};

export const getUnsyncedReports = async () => {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, 'synced', 0); // 0 for false
};

export const markReportAsSynced = async (id: number) => {
  const db = await getDB();
  const report = await db.get(STORE_NAME, id);
  if (report) {
    report.synced = true;
    return db.put(STORE_NAME, report);
  }
};

export const deleteSyncedReports = async () => {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const index = tx.store.index('synced');
  let cursor = await index.openCursor(1); // 1 for true
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
};
