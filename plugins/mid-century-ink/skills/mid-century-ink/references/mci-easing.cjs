// Generated from engine/easing.ts; regenerate with scripts/sync-rig-v2.mjs.
(function(host,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;else host.MCIEasing=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){const exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_BEZIERS = exports.DEFAULT_BEZIER = exports.EASE_LABELS = exports.EASE_PRESETS = exports.lerp = exports.clamp01 = void 0;
exports.cubicBezier = cubicBezier;
exports.backOut = backOut;
exports.easeCss = easeCss;
exports.resolveEase = resolveEase;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
exports.clamp01 = clamp01;
const lerp = (a, b, t) => a + (b - a) * t;
exports.lerp = lerp;
/** Solves a CSS cubic-bezier(x1, y1, x2, y2) timing function for t in 0..1. */
function cubicBezier(x1, y1, x2, y2) {
    const ax = 1 - 3 * x2 + 3 * x1;
    const bx = 3 * x2 - 6 * x1;
    const cx = 3 * x1;
    const ay = 1 - 3 * y2 + 3 * y1;
    const by = 3 * y2 - 6 * y1;
    const cy = 3 * y1;
    const sampleX = (u) => ((ax * u + bx) * u + cx) * u;
    const sampleY = (u) => ((ay * u + by) * u + cy) * u;
    const slopeX = (u) => (3 * ax * u + 2 * bx) * u + cx;
    return (t) => {
        if (t <= 0)
            return 0;
        if (t >= 1)
            return 1;
        let u = t;
        for (let i = 0; i < 8; i++) {
            const err = sampleX(u) - t;
            const s = slopeX(u);
            if (Math.abs(err) < 1e-5 || s === 0)
                break;
            u -= err / s;
        }
        u = (0, exports.clamp01)(u);
        return sampleY(u);
    };
}
/** Ease-out with a tunable overshoot; 0 overshoot is a plain cubic ease-out. */
function backOut(overshoot) {
    const c1 = overshoot;
    const c3 = c1 + 1;
    return (t) => {
        const u = (0, exports.clamp01)(t) - 1;
        return 1 + c3 * u * u * u + c1 * u * u;
    };
}
exports.EASE_PRESETS = {
    linear: (t) => (0, exports.clamp01)(t),
    // transitions.dev --ease-smooth-out
    smoothOut: cubicBezier(0.22, 1, 0.36, 1),
    inOut: cubicBezier(0.45, 0, 0.55, 1),
    // Gentle start, slightly early arrival: tuned for Chippy's swoop.
    flight: cubicBezier(0.4, 0.1, 0.55, 0.94),
    backOut: backOut(1.2),
    // Pulls back a touch before it goes, then overshoots: a wind-up.
    anticipate: cubicBezier(0.68, -0.4, 0.3, 1.3),
    // Nearly all of the move happens at once, then a long soft settle.
    snap: cubicBezier(0.1, 0.9, 0.15, 1),
};
exports.EASE_LABELS = {
    linear: "Linear",
    smoothOut: "Smooth out",
    inOut: "In / out",
    flight: "Flight swoop",
    backOut: "Overshoot",
    anticipate: "Wind-up",
    snap: "Snap",
    custom: "Custom",
};
exports.DEFAULT_BEZIER = [0.25, 0.1, 0.25, 1];
/** Control points that draw the same curve as a preset, for the curve editor to start from. */
exports.PRESET_BEZIERS = {
    linear: [0, 0, 1, 1],
    smoothOut: [0.22, 1, 0.36, 1],
    inOut: [0.45, 0, 0.55, 1],
    flight: [0.4, 0.1, 0.55, 0.94],
    // backOut(1.2) is not a bezier; this is the closest two-handle shape.
    backOut: [0.34, 1.56, 0.64, 1],
    anticipate: [0.68, -0.4, 0.3, 1.3],
    snap: [0.1, 0.9, 0.15, 1],
};
/** The CSS timing function for an ease, for live previews. */
function easeCss(ease) {
    if (ease.name === "linear")
        return "linear";
    const [x1, y1, x2, y2] = ease.name === "custom" ? (ease.custom ?? exports.DEFAULT_BEZIER) : (exports.PRESET_BEZIERS[ease.name] ?? exports.PRESET_BEZIERS.smoothOut);
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
}
function resolveEase(ease) {
    if (ease.name === "custom") {
        const [x1, y1, x2, y2] = ease.custom ?? [0.25, 0.1, 0.25, 1];
        return cubicBezier(x1, y1, x2, y2);
    }
    // A name this build doesn't know (a newer file) plays as the default rather than throwing.
    return exports.EASE_PRESETS[ease.name] ?? exports.EASE_PRESETS.smoothOut;
}

return exports;});
