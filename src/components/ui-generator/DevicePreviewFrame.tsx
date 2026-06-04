import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type DeviceMode = "desktop" | "mobile";

const DIMS = {
  desktop: { w: 1920, h: 1080, label: "Desktop 1920×1080" },
  mobile: { w: 932, h: 430, label: "Mobile 932×430" },
};

export function DevicePreviewFrame({
  mode,
  children,
}: {
  mode: DeviceMode;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const dim = DIMS[mode];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - 16;
      const h = el.clientHeight - 16;
      if (w <= 0 || h <= 0) return;
      const s = Math.min(w / dim.w, h / dim.h);
      setScale(s);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [dim.w, dim.h]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full flex items-center justify-center rounded-lg overflow-hidden border border-border/70 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--border)_45%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_oklab,var(--border)_35%,transparent)_1px,transparent_1px)] bg-[length:28px_28px]"
    >
      <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-md border border-border/70 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {dim.label}
      </div>
      <div
        style={{
          width: dim.w,
          height: dim.h,
          transform: `scale(${scale})`,
          transformOrigin: "center",
          position: "relative",
          borderRadius: mode === "mobile" ? 32 : 8,
          overflow: "hidden",
          background: "#0f1419",
          boxShadow: "0 24px 70px -18px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
