import { getMedia, hasMediaStore, mediaDataUrl, putMediaDataUrl } from "@/app/components/motion-studio/engine/media";
import type { StudioDoc } from "@/app/components/motion-studio/types";

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

/** Whether the document references media that cannot travel in a link. */
export const hasMedia = (doc: StudioDoc) => !!doc.audio || doc.clips.some((c) => c.type === "sprite" && c.source.kind === "video");
