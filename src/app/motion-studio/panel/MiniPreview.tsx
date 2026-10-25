"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStudioClock } from "@/app/components/motion-studio/engine/clock";
import { docDuration } from "@/app/components/motion-studio/engine/timing";
import { StageCanvas } from "@/app/components/motion-studio/StageCanvas";
import type { StudioDoc } from "@/app/components/motion-studio/types";

interface Props {
  doc: StudioDoc;
  /** Playing (hovered / focused tile) or parked on a representative frame. */
  active: boolean;
  className?: string;
}

/**
 * A composition at thumbnail size, rendered by the real engine and fitted
 * inside a 16:9 tile whatever its frame. Parked, it shows the frame about
 * two thirds of the way in, where most pieces have landed; active, it plays
 * from the top and loops.
 */
export function MiniPreview({ doc, active, className = "" }: Props) {
  const duration = useMemo(() => docDuration(doc), [doc]);
  const clock = useStudioClock(duration, { autoplay: false, loop: true });
  const { seek, replay, pause } = clock;
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (active) replay();
    else {
      pause();
      seek(Math.min(duration, Math.max(0.1, duration * 0.66)));
    }
  }, [active, duration, replay, pause, seek]);

  const { width, height } = doc.stage;
  const zoom = box.width > 0 ? Math.min(box.width / width, box.height / height) : 0;
  const left = (box.width - width * zoom) / 2;
  const top = (box.height - height * zoom) / 2;
  return (
    <div ref={boxRef} className={`relative aspect-video w-full overflow-hidden bg-surface-sunken ${className}`} aria-hidden="true">
      {zoom > 0 && (
        <div className="absolute shadow-sm" style={{ left, top, width: width * zoom, height: height * zoom }}>
          <StageCanvas doc={doc} time={clock.time} zoom={zoom} />
        </div>
      )}
    </div>
  );
}
