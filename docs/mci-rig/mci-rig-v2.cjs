// Generated from engine/rigV2.ts; regenerate with scripts/sync-rig-v2.mjs.
(function(host,factory){ const api=factory(); if(typeof module!=="undefined" && module.exports) module.exports=api; else host.MCIRigV2=api; })(typeof globalThis!=="undefined"?globalThis:this,function(){ const exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RASTER_LIMITS = void 0;
exports.pngInfo = pngInfo;
exports.validateRigV2 = validateRigV2;
exports.drawingVisibility = drawingVisibility;
exports.setDrawing = setDrawing;
exports.upgradeRigToV2 = upgradeRigToV2;
/** Rig 2 extends rigid bindings; raw SVG retains the Rig 1 allowlist. */
exports.RASTER_LIMITS = { bytes: 2000000, side: 4096, pixels: 16000000, attachments: 128 };
const id = (v) => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(v);
const finite = (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e7;
const object = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/** No fetches, metadata/decompression bombs, APNG, SVG, or MIME spoofing. */
function pngInfo(src) {
    if (typeof src !== "string" || src.length > Math.ceil(exports.RASTER_LIMITS.bytes / 3) * 4 + 22)
        return null;
    if (!src.startsWith("data:image/png;base64,"))
        return null;
    const encoded = src.slice(22);
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        return null;
    let bin;
    try {
        bin = atob(src.slice(22));
    }
    catch {
        return null;
    }
    if (bin.length < 57 || bin.length > exports.RASTER_LIMITS.bytes)
        return null;
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    if ([137, 80, 78, 71, 13, 10, 26, 10].some((v, i) => bytes[i] !== v))
        return null;
    const view = new DataView(bytes.buffer);
    let pos = 8, pixels = 0, data = false, ended = false;
    while (pos + 12 <= bytes.length) {
        const length = view.getUint32(pos), end = pos + 12 + length;
        if (end > bytes.length)
            return null;
        const kind = String.fromCharCode(...bytes.slice(pos + 4, pos + 8));
        if (!["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(kind))
            return null;
        let crc = 0xffffffff;
        for (let i = pos + 4; i < end - 4; i++) {
            crc ^= bytes[i];
            for (let bit = 0; bit < 8; bit++)
                crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        if (((crc ^ 0xffffffff) >>> 0) !== view.getUint32(end - 4))
            return null;
        if (pos === 8 && kind !== "IHDR")
            return null;
        if (kind === "IHDR") {
            if (pos !== 8 || length !== 13)
                return null;
            const w = view.getUint32(pos + 8), h = view.getUint32(pos + 12);
            if (!w || !h || w > exports.RASTER_LIMITS.side || h > exports.RASTER_LIMITS.side || w * h > exports.RASTER_LIMITS.pixels)
                return null;
            const depth = bytes[pos + 16], color = bytes[pos + 17];
            const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
            if (!depths[color]?.includes(depth) || bytes[pos + 18] !== 0 || bytes[pos + 19] !== 0 || bytes[pos + 20] > 1)
                return null;
            pixels = w * h;
        }
        if (kind === "IDAT" && length)
            data = true;
        if (kind === "IEND") {
            if (length || end !== bytes.length || !data)
                return null;
            ended = true;
        }
        pos = end;
    }
    return ended && pos === bytes.length ? { bytes: bytes.length, pixels } : null;
}
/** Extension-only structural checks, also usable at the SVG rendering boundary. */
function validateRigV2(raw) {
    if (!object(raw))
        return ["Invalid rig extension."];
    const errors = [], fail = (message) => errors.push(message);
    const animations = Array.isArray(raw.animations) ? raw.animations : [];
    if (raw.version !== 2) {
        if (raw.rasterAttachments !== undefined || raw.drawingSets !== undefined || animations.some(a => object(a) && a.drawingTracks !== undefined))
            fail("Raster attachments and drawing sets require Rig version 2.");
        return errors;
    }
    const targets = new Set((Array.isArray(raw.bindings) ? raw.bindings : []).filter(object).map(b => b.svgId));
    let bytes = 0, pixels = 0;
    if (raw.rasterAttachments !== undefined) {
        const attachments = raw.rasterAttachments;
        if (!Array.isArray(attachments) || attachments.length > exports.RASTER_LIMITS.attachments)
            fail("Invalid raster attachment count.");
        else {
            const ids = new Set(), groups = new Set();
            for (const a of attachments) {
                if (!object(a) || !id(a.id) || ids.has(a.id) || !id(a.svgId) || groups.has(a.svgId) || !targets.has(a.svgId) || ![a.x, a.y, a.width, a.height].every(finite) || a.width <= 0 || a.height <= 0) {
                    fail("Invalid raster attachment or target.");
                    continue;
                }
                ids.add(a.id);
                groups.add(a.svgId);
                const info = pngInfo(a.src);
                if (!info)
                    fail("Raster attachments must contain bounded, structurally valid PNG data.");
                else {
                    bytes += info.bytes;
                    pixels += info.pixels;
                }
            }
        }
    }
    if (bytes > exports.RASTER_LIMITS.bytes || pixels > exports.RASTER_LIMITS.pixels)
        fail("Raster attachments exceed the total byte or pixel budget.");
    const sets = new Map(), used = new Set();
    if (raw.drawingSets !== undefined) {
        if (!Array.isArray(raw.drawingSets) || raw.drawingSets.length > 64)
            fail("Invalid drawing sets.");
        else
            for (const s of raw.drawingSets) {
                if (!object(s) || !id(s.id) || sets.has(s.id) || !Array.isArray(s.drawings) || !s.drawings.length || s.drawings.length > 128) {
                    fail("Invalid drawing set.");
                    continue;
                }
                const drawings = new Set();
                for (const d of s.drawings) {
                    if (!object(d) || !id(d.id) || drawings.has(d.id) || !Array.isArray(d.svgIds) || !d.svgIds.length || d.svgIds.length > 256) {
                        fail("Invalid registered drawing.");
                        continue;
                    }
                    drawings.add(d.id);
                    for (const target of d.svgIds) {
                        if (!id(target) || !targets.has(target) || used.has(target))
                            fail("Drawing groups must be existing, uniquely registered bound SVG targets.");
                        used.add(target);
                    }
                }
                if (!id(s.defaultDrawingId) || !drawings.has(s.defaultDrawingId))
                    fail("Drawing set default is missing.");
                sets.set(s.id, drawings);
            }
    }
    let keys = 0;
    for (const a of animations) {
        if (!object(a) || a.drawingTracks === undefined)
            continue;
        if (!Array.isArray(a.drawingTracks) || a.drawingTracks.length > 64) {
            fail("Invalid drawing tracks.");
            continue;
        }
        const seen = new Set();
        for (const t of a.drawingTracks) {
            if (!object(t) || !id(t.setId) || !sets.has(t.setId) || seen.has(t.setId) || !Array.isArray(t.keys) || !t.keys.length || t.keys.length > 10000) {
                fail("Invalid drawing track.");
                continue;
            }
            seen.add(t.setId);
            let previous = -1;
            for (const k of t.keys) {
                keys++;
                if (!object(k) || !finite(k.time) || k.time < 0 || !finite(a.duration) || k.time > a.duration || k.time <= previous || !id(k.drawingId) || !sets.get(t.setId).has(k.drawingId)) {
                    fail("Invalid or unsorted drawing key.");
                    continue;
                }
                previous = k.time;
            }
        }
    }
    const boneKeys = animations.filter(object).flatMap(a => Array.isArray(a.tracks) ? a.tracks : []).filter(object).reduce((n, t) => n + (Array.isArray(t.keys) ? t.keys.length : 0), 0);
    if (keys + boneKeys > 10000)
        fail("Asset exceeds 10000 combined animation keys.");
    return [...new Set(errors)];
}
/** A missing group entry means always visible. Keys are explicit discrete holds. */
function drawingVisibility(asset, animationId, seconds) {
    const anim = asset.animations.find(a => a.id === animationId);
    const time = anim ? (anim.loop ? ((seconds % anim.duration) + anim.duration) % anim.duration : Math.max(0, Math.min(anim.duration, seconds))) : 0;
    return Object.fromEntries((asset.drawingSets ?? []).flatMap(set => {
        let selected = set.defaultDrawingId;
        for (const key of anim?.drawingTracks?.find(t => t.setId === set.id)?.keys ?? []) {
            if (key.time > time)
                break;
            selected = key.drawingId;
        }
        return set.drawings.flatMap(d => d.svgIds.map(group => [group, d.id === selected]));
    }));
}
/** Change the master default or record a discrete drawing key in the active clip. */
function setDrawing(asset, setId, drawingId, animationId, seconds) {
    if (!asset.drawingSets?.some(s => s.id === setId && s.drawings.some(d => d.id === drawingId)))
        return asset;
    if (!animationId)
        return { ...asset, drawingSets: asset.drawingSets.map(s => s.id === setId ? { ...s, defaultDrawingId: drawingId } : s) };
    return { ...asset, animations: asset.animations.map(a => {
            if (a.id !== animationId)
                return a;
            const time = Math.max(0, Math.min(a.duration, seconds));
            const old = a.drawingTracks?.find(t => t.setId === setId);
            const track = { setId, keys: [...(old?.keys ?? []).filter(k => Math.abs(k.time - time) > 1e-6), { time, drawingId }].sort((x, y) => x.time - y.time) };
            return { ...a, drawingTracks: [...(a.drawingTracks ?? []).filter(t => t.setId !== setId), track] };
        }) };
}
/** Explicit lossless migration; legacy assets need no migration just to open. */
function upgradeRigToV2(asset) {
    return asset.version === 2 ? asset : { ...asset, version: 2 };
}

return exports; });
