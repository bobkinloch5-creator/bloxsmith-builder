// 2D React renderer that mirrors a Roblox ScreenGui spec.
// Coordinates: Roblox UDim2 (xScale, xOffset, yScale, yOffset). We map them
// to absolute-positioned divs sized in % + px so the preview scales inside
// any device frame.
import type { CSSProperties } from "react";

type Udim2 = { xScale: number; xOffset: number; yScale: number; yOffset: number };
type Color = { r: number; g: number; b: number };

export type SpecElement = {
  type: string;
  id: string;
  name: string;
  text?: string;
  textColor?: Color;
  textSize?: number;
  font?: string;
  textAlign?: "Left" | "Center" | "Right";
  image?: string;
  position?: Udim2;
  size?: Udim2;
  anchorPoint?: { x: number; y: number };
  zIndex?: number;
  backgroundColor?: Color;
  backgroundTransparency?: number;
  cornerRadius?: number;
  strokeColor?: Color;
  strokeThickness?: number;
  gradient?: { from: Color; to: Color; rotation: number };
  layout?: "List" | "Grid" | "None";
  layoutDirection?: "Vertical" | "Horizontal";
  layoutPadding?: number;
  cellSize?: Udim2;
  children?: SpecElement[];
};

function rgb(c?: Color, a = 1) {
  if (!c) return "transparent";
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
}

function imageUrl(image?: string) {
  if (!image) return undefined;
  const id = image.match(/(\d+)/)?.[1];
  if (!id) return undefined;
  return `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=420&height=420&format=png`;
}

function elementStyle(el: SpecElement, isRoot: boolean): CSSProperties {
  const size = el.size ?? (isRoot ? { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 } : { xScale: 0, xOffset: 100, yScale: 0, yOffset: 40 });
  const pos = el.position ?? { xScale: 0, xOffset: 0, yScale: 0, yOffset: 0 };
  const anchor = el.anchorPoint ?? { x: 0, y: 0 };
  const bgAlpha = 1 - (el.backgroundTransparency ?? (el.type === "Frame" || isRoot ? 0 : 0));

  const style: CSSProperties = {
    position: "absolute",
    left: `calc(${pos.xScale * 100}% + ${pos.xOffset}px)`,
    top: `calc(${pos.yScale * 100}% + ${pos.yOffset}px)`,
    width: `calc(${size.xScale * 100}% + ${size.xOffset}px)`,
    height: `calc(${size.yScale * 100}% + ${size.yOffset}px)`,
    transform: `translate(${-anchor.x * 100}%, ${-anchor.y * 100}%)`,
    boxSizing: "border-box",
    zIndex: el.zIndex ?? undefined,
    color: rgb(el.textColor ?? { r: 255, g: 255, b: 255 }),
    fontSize: el.textSize ? `${Math.max(8, el.textSize)}px` : undefined,
    textAlign: (el.textAlign?.toLowerCase() as CSSProperties["textAlign"]) ?? "center",
    display: "flex",
    alignItems: "center",
    justifyContent:
      (el.textAlign === "Left" && "flex-start") ||
      (el.textAlign === "Right" && "flex-end") ||
      "center",
    overflow: el.type === "ScrollingFrame" ? "auto" : "hidden",
  };

  if (el.backgroundColor) {
    style.background = rgb(el.backgroundColor, bgAlpha);
  } else if (!isRoot && (el.type === "TextButton" || el.type === "ImageButton")) {
    style.background = "rgba(255,255,255,0.05)";
  }
  if (el.gradient) {
    style.background = `linear-gradient(${el.gradient.rotation}deg, ${rgb(el.gradient.from, bgAlpha)}, ${rgb(el.gradient.to, bgAlpha)})`;
  }
  if (el.cornerRadius && el.cornerRadius > 0) {
    style.borderRadius = `${el.cornerRadius}px`;
  }
  if (el.strokeColor && el.strokeThickness) {
    style.boxShadow = `0 0 0 ${el.strokeThickness}px ${rgb(el.strokeColor)}`;
  }
  return style;
}

function layoutChildren(el: SpecElement): CSSProperties {
  if (el.layout === "List") {
    return {
      display: "flex",
      flexDirection: el.layoutDirection === "Horizontal" ? "row" : "column",
      gap: `${el.layoutPadding ?? 8}px`,
      padding: `${el.layoutPadding ?? 8}px`,
      alignItems: "stretch",
      justifyContent: "flex-start",
    };
  }
  if (el.layout === "Grid") {
    const cell = el.cellSize ?? { xScale: 0, xOffset: 120, yScale: 0, yOffset: 120 };
    const cellW = (cell.xScale * 100) + (cell.xOffset || 0);
    return {
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(60, cell.xOffset || cellW)}px, 1fr))`,
      gap: `${el.layoutPadding ?? 8}px`,
      padding: `${el.layoutPadding ?? 8}px`,
      alignItems: "start",
      justifyItems: "stretch",
    };
  }
  return {};
}

function renderElement(el: SpecElement, isRoot = false, depth = 0) {
  const style = elementStyle(el, isRoot);
  const layoutCss = layoutChildren(el);
  const isLayoutContainer = el.layout === "List" || el.layout === "Grid";

  const childWrapperStyle: CSSProperties = isLayoutContainer
    ? { ...layoutCss, position: "absolute", inset: 0, overflow: "auto" }
    : { position: "absolute", inset: 0, pointerEvents: "none" };

  const img = imageUrl(el.image);

  return (
    <div key={el.id ?? `${depth}-${el.name}`} style={style} data-el={el.name} data-type={el.type}>
      {(el.type === "ImageButton" || el.type === "ImageLabel") && img && (
        <img
          src={img}
          alt=""
          loading="lazy"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {el.text && (
        <span
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            padding: "0 8px",
            fontWeight: el.type === "TextButton" ? 600 : 500,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            textShadow: el.gradient ? "0 1px 2px rgba(0,0,0,0.3)" : undefined,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {el.text}
        </span>
      )}
      {el.children?.length ? (
        <div style={{ ...childWrapperStyle, pointerEvents: "auto" }}>
          {isLayoutContainer ? (
            el.children.map((c) => (
              <div
                key={c.id ?? c.name}
                style={{
                  position: "relative",
                  width: el.layout === "List" && el.layoutDirection !== "Horizontal" ? "100%" : "auto",
                  minHeight: el.cellSize?.yOffset ?? 40,
                  minWidth: el.cellSize?.xOffset ?? undefined,
                }}
              >
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  {renderElement({ ...c, position: undefined, size: { xScale: 1, xOffset: 0, yScale: 1, yOffset: 0 } } as SpecElement, false, depth + 1)}
                </div>
              </div>
            ))
          ) : (
            el.children.map((c) => renderElement(c, false, depth + 1))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function UIPreview({ spec, bg }: { spec: { root: SpecElement }; bg?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: bg ?? "linear-gradient(135deg, #1a3a4a, #2d5d7a)",
        overflow: "hidden",
      }}
    >
      {renderElement(spec.root, true)}
    </div>
  );
}
