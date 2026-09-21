/**
 * Records the current tab to a WebM file using the browser's screen-capture
 * API. Chrome offers "This tab" in its picker; the caller should switch the
 * page into clean mode first so only the stage is captured.
 */
export interface Recording {
  stop: () => Promise<Blob>;
}

export async function startTabRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen capture is not supported in this browser");
  }
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 60 },
    audio: false,
    // Chrome-only hints; ignored elsewhere.
    ...({ preferCurrentTab: true, selfBrowserSurface: "include" } as Record<string, unknown>),
  });
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 12_000_000 } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(200);

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
        };
        recorder.stop();
      }),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = "text/plain") {
  downloadBlob(new Blob([text], { type }), filename);
}
