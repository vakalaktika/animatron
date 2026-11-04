import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { get, put } from "@vercel/blob";
import { checkMeta, type ShareMeta } from "./validate";

/**
 * Each share is three public files under its id: the composition, a small
 * meta file the page reads, and the preview card. Nothing is ever
 * overwritten, so a link shows the same thing forever.
 *
 * In production they live in Vercel Blob (BLOB_READ_WRITE_TOKEN, set when
 * the store is connected). With no token outside production they go in a
 * local folder, so `npm run dev` works without an account.
 */
type FileName = "doc.json" | "meta.json" | "card.png";
const path = (id: string, file: FileName) => `shares/${id}/${file}`;

export class ShareExistsError extends Error {}

interface Backend {
  putNew(pathname: string, body: string | Uint8Array<ArrayBuffer>, contentType: string): Promise<void>;
  read(pathname: string): Promise<ReadableStream | null>;
}

const blob: Backend = {
  async putNew(pathname, body, contentType) {
    try {
      await put(pathname, typeof body === "string" ? body : new Blob([body], { type: contentType }), { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType });
    } catch (err) {
      if (err instanceof Error && /already exists|overwrite/i.test(err.message)) throw new ShareExistsError(pathname);
      throw err;
    }
  },
  async read(pathname) {
    const result = await get(pathname, { access: "public" });
    return result?.stream ?? null;
  },
};

const LOCAL_DIR = join(process.cwd(), ".share-data");

const local: Backend = {
  async putNew(pathname, body) {
    const file = join(LOCAL_DIR, pathname);
    await mkdir(join(file, ".."), { recursive: true });
    try {
      await writeFile(file, body, { flag: "wx" });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new ShareExistsError(pathname);
      throw err;
    }
  },
  async read(pathname) {
    try {
      const bytes = await readFile(join(LOCAL_DIR, pathname));
      return new Blob([bytes]).stream();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  },
};

function backend(): Backend {
  if (process.env.BLOB_READ_WRITE_TOKEN) return blob;
  if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN is not set: connect a Blob store to this project.");
  return local;
}

/** Writes the composition first (the id's claim), the card, then the meta that makes the page live. */
export async function saveShare(id: string, doc: string, card: Uint8Array<ArrayBuffer>, meta: ShareMeta): Promise<void> {
  const store = backend();
  await store.putNew(path(id, "doc.json"), doc, "application/json");
  await store.putNew(path(id, "card.png"), card, "image/png");
  await store.putNew(path(id, "meta.json"), JSON.stringify(meta), "application/json");
}

async function readText(pathname: string): Promise<string | null> {
  const stream = await backend().read(pathname);
  return stream ? new Response(stream).text() : null;
}

export async function readMeta(id: string): Promise<ShareMeta | null> {
  const text = await readText(path(id, "meta.json"));
  if (!text) return null;
  try {
    return checkMeta(JSON.parse(text));
  } catch {
    return null;
  }
}

/** The composition as stored, as text: the studio parses and repairs it. */
export async function readDoc(id: string): Promise<string | null> {
  return readText(path(id, "doc.json"));
}

export async function readCard(id: string): Promise<ReadableStream | null> {
  return backend().read(path(id, "card.png"));
}
