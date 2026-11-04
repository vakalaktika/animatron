import type { StudioDoc } from "@/app/components/motion-studio/types";
import { RIG_FORMAT } from "@/app/components/motion-studio/types";
import { FRAME_SIZES, makeLottie, parseImport } from "../presets";

export type ImportedDoc = { ok: true; doc: StudioDoc; warnings: string[] } | { ok: false; message: string };

/** A fresh composition in the default frame, named after the file. */
function blankDoc(name: string, stage: Pick<StudioDoc["stage"], "width" | "height">): StudioDoc {
  return { version: 2, name, stage: { ...stage, background: "#ffffff", transparent: false }, clips: [] };
}

const stem = (fileName: string) => fileName.replace(/\.(studio|clip|mci)?\.json$/i, "").replace(/\.json$/i, "") || "Imported";

/**
 * Reads any JSON the studio understands as a composition of its own: a
 * studio document as it is, or a single layer, a rig or a Lottie file
 * placed in the middle of a fresh default-size canvas named after the file.
 * Nothing here touches the open composition; the caller files the result.
 */
export function docFromJson(text: string, fileName: string): ImportedDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: `${fileName} is not valid JSON.` };
  }
  const { width, height } = FRAME_SIZES[0];
  const asObj = parsed as Record<string, unknown> | null;
  if (typeof parsed === "object" && asObj && asObj.format !== RIG_FORMAT && "layers" in asObj && "fr" in asObj) {
    const clip = makeLottie(asObj, fileName, { x: width / 2, y: height / 2 });
    return { ok: true, doc: { ...blankDoc(stem(fileName), { width, height }), clips: [clip] }, warnings: [] };
  }
  const result = parseImport(parsed, { width, height });
  if (result.kind === "error") return { ok: false, message: `${fileName}: ${result.message}` };
  if (result.kind === "doc") {
    const doc = result.doc.name.trim() ? result.doc : { ...result.doc, name: stem(fileName) };
    return { ok: true, doc, warnings: result.warnings };
  }
  const clip = { ...result.clip, x: width / 2, y: height / 2 };
  return { ok: true, doc: { ...blankDoc(result.clip.name || stem(fileName), { width, height }), clips: [clip] }, warnings: [] };
}
