import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'webcontainer-cache';
const STORE_NAME = 'dependencies';
const CACHE_KEY = 'base_deps_installed';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase> {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return dbPromise;
}

export async function markDepsInstalled(): Promise<void> {
    try {
        const db = await getDB();
        await db.put(STORE_NAME, {
            installed: true,
            timestamp: Date.now(),
        }, CACHE_KEY);
        console.log('✅ Marked dependencies as installed in cache');
    } catch (err) {
        console.error('Failed to save cache flag:', err);
    }
}

export async function areDepsInstalled(): Promise<boolean> {
    try {
        const db = await getDB();
        const cached = await db.get(STORE_NAME, CACHE_KEY);
        return cached?.installed === true;
    } catch {
        return false;
    }
}

export async function clearDepsCache(): Promise<void> {
    try {
        const db = await getDB();
        await db.delete(STORE_NAME, CACHE_KEY);
        console.log('🗑️ Cache cleared');
    } catch (err) {
        console.error('Failed to clear cache:', err);
    }
}
