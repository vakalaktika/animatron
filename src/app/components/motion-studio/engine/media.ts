/**
 * Where big files live. Compositions are JSON in localStorage, which holds a
 * few megabytes at most, so video and sound files go into IndexedDB and the
 * document keeps an id. Object URLs are handed out from a cache so every
 * view of the same file shares one.
 */

const DB_NAME = "animatron.media";
const STORE = "files";

export interface MediaRecord {
  id: string;
  blob: Blob;
  name: string;
  /** ISO time the file was added. */
  addedAt: string;
}

export const hasMediaStore = () => typeof indexedDB !== "undefined";

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Could not open the media store"));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Media store request failed"));
  });

export const newMediaId = () => `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Stores a file and returns its id. */
export async function putMedia(blob: Blob, name: string, id = newMediaId()): Promise<string> {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  const record: MediaRecord = { id, blob, name, addedAt: new Date().toISOString() };
  await request(tx.objectStore(STORE).put(record));
  urls.set(id, URL.createObjectURL(blob));
  return id;
}

export async function getMedia(id: string): Promise<MediaRecord | null> {
  if (!hasMediaStore()) return null;
  const db = await open();
  const tx = db.transaction(STORE, "readonly");
  return (await request(tx.objectStore(STORE).get(id))) ?? null;
}

export async function deleteMedia(id: string): Promise<void> {
  if (!hasMediaStore()) return;
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  await request(tx.objectStore(STORE).delete(id));
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}

const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/** An object URL for the file, shared across callers; null when it is gone. */
export function mediaUrl(id: string): Promise<string | null> {
  const known = urls.get(id);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(id);
  if (inFlight) return inFlight;
  const p = getMedia(id)
    .then((record) => {
      if (!record) return null;
      const url = URL.createObjectURL(record.blob);
      urls.set(id, url);
      return url;
    })
    .catch(() => null)
    .finally(() => pending.delete(id));
  pending.set(id, p);
  return p;
}

/** The URL if it is already loaded (sync, for render paths that have warmed the cache). */
export const knownMediaUrl = (id: string) => urls.get(id) ?? null;

/** Reads the file as a data URL, for carrying media inside a JSON export. */
export async function mediaDataUrl(id: string): Promise<string | null> {
  const record = await getMedia(id);
  if (!record) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read media"));
    reader.readAsDataURL(record.blob);
  });
}

/** Stores a data URL (from an imported JSON file) and returns the new id. */
export async function putMediaDataUrl(dataUrl: string, name: string): Promise<string> {
  const res = await fetch(dataUrl);
  return putMedia(await res.blob(), name);
}

/** Measures a video or audio file: its length and, for video, its aspect. */
export function probeMedia(blob: Blob, kind: "video" | "audio"): Promise<{ length: number; aspect: number }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(kind);
    const url = URL.createObjectURL(blob);
    const done = () => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
    };
    el.preload = "metadata";
    el.onloadedmetadata = () => {
      const aspect = kind === "video" ? (el as HTMLVideoElement).videoHeight / Math.max(1, (el as HTMLVideoElement).videoWidth) : 1;
      const length = Number.isFinite(el.duration) ? el.duration : 0;
      done();
      resolve({ length, aspect });
    };
    el.onerror = () => {
      done();
      reject(new Error(`This browser can't play ${blob.type || "that file"}.`));
    };
    el.src = url;
  });
}

/** The frame-sync registry: media that must finish seeking before a frame is captured. */
export type FrameSeek = (seconds: number) => Promise<void>;
export interface FrameSync {
  register: (seek: FrameSeek) => () => void;
  /** Seeks every registered medium and resolves when all show the moment. */
  settle: (seconds: number) => Promise<void>;
}

export function createFrameSync(): FrameSync {
  const seeks = new Set<FrameSeek>();
  return {
    register: (seek) => {
      seeks.add(seek);
      return () => {
        seeks.delete(seek);
      };
    },
    settle: async (seconds) => {
      await Promise.all([...seeks].map((seek) => seek(seconds)));
    },
  };
}
