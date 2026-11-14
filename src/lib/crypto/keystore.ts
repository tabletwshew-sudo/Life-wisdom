/**
 * Keeps unlocked keys on this device (IndexedDB), so people don't have to type
 * their password every time the app opens. Keys are stored as Web Crypto key
 * objects — the personal private key is non-extractable, so even code running
 * on the page can't read its raw bytes. Everything is wiped on sign-out.
 */
const DB = 'fh-keys'
const STORE = 'keys'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    t.oncomplete = () => db.close()
  })
}

export async function getKey(name: string): Promise<CryptoKey | null> {
  try {
    return ((await tx('readonly', (s) => s.get(name))) as CryptoKey | undefined) ?? null
  } catch {
    return null
  }
}

export async function putKey(name: string, key: CryptoKey): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(key, name))
  } catch {
    /* private mode: keys just live in memory this session */
  }
}

export async function deleteKey(name: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(name))
  } catch {
    /* ignore */
  }
}

export async function clearKeys(): Promise<void> {
  try {
    await tx('readwrite', (s) => s.clear())
  } catch {
    /* ignore */
  }
}

export const privateKeyName = (userId: string) => `private:${userId}`
export const familyKeyName = (familyId: string, userId: string) => `family:${familyId}:${userId}`
