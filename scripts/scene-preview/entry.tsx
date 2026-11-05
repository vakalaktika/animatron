import { createRoot } from "react-dom/client";
import { frameData, frameSteps, motionValue } from "motion/react";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { docFromJson } from "@/app/motion-studio/lib/importDoc";
import { renderVideo } from "@/app/motion-studio/export/renderer";
import { snapshotStage } from "@/app/motion-studio/export/shareCard";
import type { StudioDoc } from "@/app/components/motion-studio/types";

const STEPS = ["setup", "read", "resolveKeyframes", "preUpdate", "update", "preRender", "render", "postRender"] as const;
const time = motionValue(0);
const root = createRoot(document.getElementById("root")!);
const win = window as unknown as {
  scene: { load: (json: string) => Promise<number>; seek: (seconds: number) => Promise<void>; still: () => Promise<string>; video: () => Promise<string>; save: () => string };
};
let doc: StudioDoc;
const node = () => document.getElementById("root")!.firstElementChild as HTMLElement;
const dataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

async function seek(seconds: number) {
  time.set(seconds);
  for (const step of STEPS) frameSteps[step].process(frameData);
  // SVG raster attachments decode asynchronously; wait for image decoding
  // before snapshotting. These fixtures intentionally carry no video/audio.
  await Promise.all(Array.from(node().querySelectorAll("image")).map(async (el) => {
    const img = new Image();
    img.src = el.getAttribute("href") ?? "";
    await img.decode();
  }));
}

win.scene = {
  async load(json) {
    const result = docFromJson(json, "preview.animatron.json");
    if (!result.ok) throw new Error(result.message);
    if (result.warnings.length) throw new Error(result.warnings.join("; "));
    doc = result.doc;
    root.render(<StageCanvas doc={doc} time={time} />);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await seek(0);
    return docDuration(doc);
  },
  seek,
  save: () => JSON.stringify(doc),
  async still() {
    const image = await snapshotStage(node(), doc.stage.width, doc.stage.height);
    const canvas = document.createElement("canvas");
    canvas.width = doc.stage.width;
    canvas.height = doc.stage.height;
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  },
  async video() {
    const result = await renderVideo({ width: doc.stage.width, height: doc.stage.height, fps: 24, duration: docDuration(doc), background: doc.stage.background, format: "mp4", alpha: false }, { node, seek });
    return dataUrl(result.blob);
  },
};
