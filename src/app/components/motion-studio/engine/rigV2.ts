import type { RigAsset } from "../types";

/** Rig 2 extends rigid bindings; raw SVG retains the Rig 1 allowlist. */
export const RASTER_LIMITS = { bytes: 2_000_000, side: 4096, pixels: 16_000_000, attachments: 128 } as const;
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** No fetches, metadata/decompression bombs, APNG, SVG, or MIME spoofing. */
export function pngInfo(src: unknown): { bytes: number; pixels: number } | null {
  if (typeof src !== "string" || src.length > Math.ceil(RASTER_LIMITS.bytes / 3) * 4 + 22) return null;
  if (!src.startsWith("data:image/png;base64,")) return null;
  const encoded = src.slice(22);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  let bin: string;
  try { bin = atob(src.slice(22)); } catch { return null; }
  if (bin.length < 57 || bin.length > RASTER_LIMITS.bytes) return null;
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  if ([137,80,78,71,13,10,26,10].some((v,i) => bytes[i] !== v)) return null;
  const view = new DataView(bytes.buffer);
  let pos = 8, pixels = 0, data = false, ended = false;
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos), end = pos + 12 + length;
    if (end > bytes.length) return null;
    const kind = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
    if (!["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(kind)) return null;
    let crc = 0xffffffff;
    for (let i = pos + 4; i < end - 4; i++) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4)) return null;
    if (pos === 8 && kind !== "IHDR") return null;
    if (kind === "IHDR") {
      if (pos !== 8 || length !== 13) return null;
      const w = view.getUint32(pos + 8), h = view.getUint32(pos + 12);
      if (!w || !h || w > RASTER_LIMITS.side || h > RASTER_LIMITS.side || w * h > RASTER_LIMITS.pixels) return null;
      const depth = bytes[pos + 16], color = bytes[pos + 17];
      const depths: Record<number, number[]> = { 0:[1,2,4,8,16], 2:[8,16], 3:[1,2,4,8], 4:[8,16], 6:[8,16] };
      if (!depths[color]?.includes(depth) || bytes[pos + 18] !== 0 || bytes[pos + 19] !== 0 || bytes[pos + 20] > 1) return null;
      pixels = w * h;
    }
    if (kind === "IDAT" && length) data = true;
    if (kind === "IEND") { if (length || end !== bytes.length || !data) return null; ended = true; }
    pos = end;
  }
  return ended && pos === bytes.length ? { bytes:bytes.length, pixels } : null;
}

/** Call only after pngInfo: read the already validated IHDR dimensions. */
export function pngDimensions(src: string): { width: number; height: number } {
  const header=atob(src.slice(22));
  const read=(at:number)=>Array.from(header.slice(at,at+4)).reduce((n,c)=>n*256+c.charCodeAt(0),0);
  return {width:read(16),height:read(20)};
}

export function rasterSource(asset: Partial<Pick<RigAsset,"rasterSources">>, part: {src:unknown}): string {
  if(typeof part.src!=="string")return "";
  const src=part.src;
  return src.startsWith("@") ? (Array.isArray(asset.rasterSources)?asset.rasterSources.find(s=>s?.id===src.slice(1))?.src:undefined) ?? "" : src;
}

/** Extension-only structural checks, also usable at the SVG rendering boundary. */
export function validateRigV2(raw: unknown): string[] {
  if (!object(raw)) return ["Invalid rig extension."];
  const errors: string[] = [], fail = (message: string) => errors.push(message);
  const animations = Array.isArray(raw.animations) ? raw.animations : [];
  if (raw.version !== 4 && (raw.rasterSources !== undefined || Array.isArray(raw.rasterAttachments) && raw.rasterAttachments.some(a=>object(a)&&(a.sourceRect!==undefined||typeof a.src==="string"&&a.src.startsWith("@"))))) fail("Shared PNG sources and source rectangles require Rig version 4.");
  if (raw.version !== 2 && raw.version !== 3 && raw.version !== 4) {
    if (raw.rasterAttachments !== undefined || raw.drawingSets !== undefined || animations.some(a => object(a) && a.drawingTracks !== undefined)) fail("Raster attachments and drawing sets require Rig version 2.");
    return errors;
  }
  const targets = new Set((Array.isArray(raw.bindings) ? raw.bindings : []).filter(object).map(b => b.svgId));
  let bytes = 0, pixels = 0;
  const sources=new Map<string,string>(),counted=new Set<string>();
  const count=(src:string,info:{bytes:number;pixels:number})=>{
    if(raw.version===4&&counted.has(src))return;
    counted.add(src);bytes+=info.bytes;pixels+=info.pixels;
  };
  if(raw.rasterSources!==undefined) {
    if(!Array.isArray(raw.rasterSources)||raw.rasterSources.length>128)fail("Invalid shared PNG source count.");
    else for(const source of raw.rasterSources) {
      if(!object(source)||!id(source.id)||sources.has(source.id)||typeof source.src!=="string") {fail("Shared PNG sources require unique IDs and PNG data.");continue;}
      const info=pngInfo(source.src);
      if(!info)fail("Shared PNG source must contain bounded, structurally valid PNG data.");
      else {sources.set(source.id,source.src);count(source.src,info);}
    }
  }
  if (raw.rasterAttachments !== undefined) {
    const attachments = raw.rasterAttachments;
    if (!Array.isArray(attachments) || attachments.length > RASTER_LIMITS.attachments) fail("Invalid raster attachment count.");
    else {
      const ids = new Set(), groups = new Set();
      for (const a of attachments) {
        if (!object(a) || !id(a.id) || ids.has(a.id) || !id(a.svgId) || groups.has(a.svgId) || !targets.has(a.svgId) || ![a.x,a.y,a.width,a.height].every(finite) || (a.width as number) <= 0 || (a.height as number) <= 0) { fail("Invalid raster attachment or target."); continue; }
        ids.add(a.id); groups.add(a.svgId);
        const src=typeof a.src==="string"&&a.src.startsWith("@")?sources.get(a.src.slice(1)):a.src;
        const info = pngInfo(src);
        if (!info) fail("Raster attachments must contain bounded, structurally valid PNG data.");
        else {
          count(src as string,info);
          if(a.sourceRect!==undefined) {
            const r=a.sourceRect,size=pngDimensions(src as string);
            if(!object(r)||![r.x,r.y,r.width,r.height].every(v=>Number.isInteger(v)&&Number(v)>=0)||Number(r.width)<=0||Number(r.height)<=0||Number(r.x)+Number(r.width)>size.width||Number(r.y)+Number(r.height)>size.height)fail("PNG source rectangle must lie inside its image.");
          }
        }
      }
    }
  }
  if (bytes > RASTER_LIMITS.bytes || pixels > RASTER_LIMITS.pixels) fail("Raster attachments exceed the total byte or pixel budget.");
  const sets = new Map<string, Set<string>>(), used = new Set();
  if (raw.drawingSets !== undefined) {
    if (!Array.isArray(raw.drawingSets) || raw.drawingSets.length > 64) fail("Invalid drawing sets.");
    else for (const s of raw.drawingSets) {
      if (!object(s) || !id(s.id) || sets.has(s.id) || !Array.isArray(s.drawings) || !s.drawings.length || s.drawings.length > 128) { fail("Invalid drawing set."); continue; }
      const drawings = new Set<string>();
      for (const d of s.drawings) {
        if (!object(d) || !id(d.id) || drawings.has(d.id) || !Array.isArray(d.svgIds) || !d.svgIds.length || d.svgIds.length > 256) { fail("Invalid registered drawing."); continue; }
        drawings.add(d.id);
        for (const target of d.svgIds) {
          if (!id(target) || !targets.has(target) || used.has(target)) fail("Drawing groups must be existing, uniquely registered bound SVG targets.");
          used.add(target);
        }
      }
      if (!id(s.defaultDrawingId) || !drawings.has(s.defaultDrawingId)) fail("Drawing set default is missing.");
      sets.set(s.id, drawings);
    }
  }
  let keys = 0;
  for (const a of animations) {
    if (!object(a) || a.drawingTracks === undefined) continue;
    if (!Array.isArray(a.drawingTracks) || a.drawingTracks.length > 64) { fail("Invalid drawing tracks."); continue; }
    const seen = new Set();
    for (const t of a.drawingTracks) {
      if (!object(t) || !id(t.setId) || !sets.has(t.setId) || seen.has(t.setId) || !Array.isArray(t.keys) || !t.keys.length || t.keys.length > 10000) { fail("Invalid drawing track."); continue; }
      seen.add(t.setId); let previous = -1;
      for (const k of t.keys) {
        keys++;
        if (!object(k) || !finite(k.time) || k.time < 0 || !finite(a.duration) || k.time > a.duration || k.time <= previous || !id(k.drawingId) || !sets.get(t.setId)!.has(k.drawingId)) { fail("Invalid or unsorted drawing key."); continue; }
        previous = k.time;
      }
    }
  }
  const boneKeys = animations.filter(object).flatMap(a => Array.isArray(a.tracks) ? a.tracks : []).filter(object).reduce((n,t) => n + (Array.isArray(t.keys) ? t.keys.length : 0),0);
  if (keys + boneKeys > 10000) fail("Asset exceeds 10000 combined animation keys.");
  return [...new Set(errors)];
}

/** A missing group entry means always visible. Keys are explicit discrete holds. */
export function drawingVisibility(asset: RigAsset, animationId: string | null, seconds: number): Record<string, boolean> {
  const anim = asset.animations.find(a => a.id === animationId);
  const time = anim ? (anim.loop ? ((seconds % anim.duration) + anim.duration) % anim.duration : Math.max(0, Math.min(anim.duration,seconds))) : 0;
  return Object.fromEntries((asset.drawingSets ?? []).flatMap(set => {
    let selected = set.defaultDrawingId;
    for (const key of anim?.drawingTracks?.find(t => t.setId === set.id)?.keys ?? []) {
      if (key.time > time) break;
      selected = key.drawingId;
    }
    return set.drawings.flatMap(d => d.svgIds.map(group => [group, d.id === selected]));
  }));
}

/** Change the master default or record a discrete drawing key in the active clip. */
export function setDrawing(asset: RigAsset, setId: string, drawingId: string, animationId: string | null, seconds: number): RigAsset {
  if (!asset.drawingSets?.some(s => s.id === setId && s.drawings.some(d => d.id === drawingId))) return asset;
  if (!animationId) return { ...asset, drawingSets:asset.drawingSets.map(s => s.id === setId ? {...s,defaultDrawingId:drawingId} : s) };
  return { ...asset, animations:asset.animations.map(a => {
    if (a.id !== animationId) return a;
    const time = Math.max(0,Math.min(a.duration,seconds));
    const old = a.drawingTracks?.find(t => t.setId === setId);
    const track = {setId, keys:[...(old?.keys ?? []).filter(k => Math.abs(k.time-time)>1e-6),{time,drawingId}].sort((x,y)=>x.time-y.time)};
    return {...a,drawingTracks:[...(a.drawingTracks ?? []).filter(t=>t.setId!==setId),track]};
  }) };
}

/** Explicit lossless migration; legacy assets need no migration just to open. */
export function upgradeRigToV2(asset: RigAsset): RigAsset {
  return asset.version >= 2 ? asset : { ...asset, version: 2 };
}
