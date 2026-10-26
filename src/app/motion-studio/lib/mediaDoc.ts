import { deleteMedia, getMedia, hasMediaStore, listMediaIds, mediaDataUrl, putMediaDataUrl } from "@/app/components/motion-studio/engine/media";
import type { Clip, StudioDoc } from "@/app/components/motion-studio/types";
import type { ProjectStore } from "./projects";

/**
 * Video and sound live in the browser's media store, not in the document.
 * A JSON file has to stand on its own, so on the way out each media id is
 * joined by the file as a data URL (`mediaData`), and on the way in those
 * are put back into the store under fresh ids.
 */

type WithData<T> = T & { mediaData?: string };

export async function inlineMedia(doc: StudioDoc): Promise<StudioDoc> {
  const clips = await Promise.all(
    doc.clips.map(async (clip) => {
      if (clip.type !== "sprite" || clip.source.kind !== "video") return clip;
      const mediaData = (await mediaDataUrl(clip.source.mediaId)) ?? undefined;
      return { ...clip, source: { ...clip.source, mediaData } as WithData<typeof clip.source> };
    }),
  );
  const audio = doc.audio ? ({ ...doc.audio, mediaData: (await mediaDataUrl(doc.audio.mediaId)) ?? undefined } as WithData<NonNullable<StudioDoc["audio"]>>) : doc.audio;
  return { ...doc, clips, audio };
}

/** Stores any inlined media and strips the data URLs; media that is neither stored nor inlined is reported. */
export async function hydrateMedia(doc: StudioDoc): Promise<{ doc: StudioDoc; missing: string[] }> {
  const missing: string[] = [];
  const restore = async (mediaId: string, data: string | undefined, name: string): Promise<string> => {
    if (!hasMediaStore()) {
      missing.push(name);
      return mediaId;
    }
    if (await getMedia(mediaId)) return mediaId;
    if (data) return putMediaDataUrl(data, name);
    missing.push(name);
    return mediaId;
  };
  const clips = await Promise.all(
    doc.clips.map(async (clip) => {
      if (clip.type !== "sprite" || clip.source.kind !== "video") return clip;
      const { mediaData, ...source } = clip.source as WithData<typeof clip.source>;
      return { ...clip, source: { ...source, mediaId: await restore(source.mediaId, mediaData, source.label) } };
    }),
  );
  let audio = doc.audio;
  if (audio) {
    const { mediaData, ...rest } = audio as WithData<NonNullable<StudioDoc["audio"]>>;
    audio = { ...rest, mediaId: await restore(rest.mediaId, mediaData, rest.name) };
  }
  return { doc: { ...doc, clips, audio }, missing };
}

/** One clip on its own (the "Save layer as JSON" path). */
export async function inlineClipMedia(clip: Clip): Promise<Clip> {
  const { clips } = await inlineMedia({ version: 2, name: "", stage: { width: 0, height: 0, background: "", transparent: false }, clips: [clip] });
  return clips[0];
}

export async function hydrateClipMedia(clip: Clip): Promise<{ clip: Clip; missing: string[] }> {
  const { doc, missing } = await hydrateMedia({ version: 2, name: "", stage: { width: 0, height: 0, background: "", transparent: false }, clips: [clip] });
  return { clip: doc.clips[0], missing };
}

/** Every media id any saved composition still points at. */
export function referencedMedia(store: ProjectStore, extra?: StudioDoc): Set<string> {
  const ids = new Set<string>();
  const docs = [...store.projects.map((p) => p.doc), ...(extra ? [extra] : [])];
  for (const doc of docs) {
    if (doc.audio) ids.add(doc.audio.mediaId);
    for (const clip of doc.clips) if (clip.type === "sprite" && clip.source.kind === "video") ids.add(clip.source.mediaId);
  }
  return ids;
}

/**
 * Drops stored files no saved composition points at any more. Run at start
 * and when a project is deleted; not after a layer or sound is removed,
 * since undo can bring those back, and never on a timer: an import puts its
 * file in the store a moment before the document references it.
 */
export async function pruneMedia(store: ProjectStore, current?: StudioDoc): Promise<number> {
  if (!hasMediaStore()) return 0;
  const keep = referencedMedia(store, current);
  const ids = await listMediaIds().catch(() => [] as string[]);
  const gone = ids.filter((id) => !keep.has(id));
  await Promise.all(gone.map((id) => deleteMedia(id).catch(() => undefined)));
  return gone.length;
}

/** Whether the document references media that cannot travel in a link. */
export const hasMedia = (doc: StudioDoc) => !!doc.audio || doc.clips.some((c) => c.type === "sprite" && c.source.kind === "video");
