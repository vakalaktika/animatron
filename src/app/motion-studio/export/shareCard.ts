import { getFontEmbedCSS, toSvg } from "html-to-image";

/** The preview picture a short link shows wherever it is pasted: the Open Graph size. */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
const CARD_BACKGROUND = "#141618";
const CARD_INSET = 56;
const CARD_RADIUS = 18;

/** Where the frame sits on the card: fitted inside the inset, centred, in card pixels. */
export function cardPlacement(stage: { width: number; height: number }, card = { width: CARD_WIDTH, height: CARD_HEIGHT, inset: CARD_INSET }): { x: number; y: number; width: number; height: number } {
  const maxW = card.width - card.inset * 2;
  const maxH = card.height - card.inset * 2;
  const zoom = Math.min(maxW / stage.width, maxH / stage.height);
  const width = Math.round(stage.width * zoom);
  const height = Math.round(stage.height * zoom);
  return { x: Math.round((card.width - width) / 2), y: Math.round((card.height - height) / 2), width, height };
}

/** Rasterises the stage node as it is right now, at its native size. */
export async function snapshotStage(node: HTMLElement, width: number, height: number): Promise<HTMLImageElement> {
  const fontEmbedCSS = await getFontEmbedCSS(node);
  const url = await toSvg(node, { width, height, cacheBust: false, fontEmbedCSS });
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Paints the frame onto a dark card with rounded corners and a soft edge,
 * the way the share page and link previews show it, and returns it as PNG.
 */
export async function drawShareCard(frame: CanvasImageSource, stage: { width: number; height: number; background: string; transparent: boolean }): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the preview card");
  ctx.fillStyle = CARD_BACKGROUND;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const { x, y, width, height } = cardPlacement(stage);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = stage.transparent ? "#ffffff" : stage.background;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, CARD_RADIUS);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, CARD_RADIUS);
  ctx.clip();
  ctx.drawImage(frame, x, y, width, height);
  ctx.restore();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode the preview card"))), "image/png");
  });
}
