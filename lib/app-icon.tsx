import { ImageResponse } from "next/og";

// Path of Phosphor's "Bus" icon, fill weight (@phosphor-icons/react, MIT).
// Copied as data because ImageResponse can't render the icon component.
const BUS_PATH =
  "M248,80v24a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0ZM16,72a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V80A8,8,0,0,0,16,72Zm200-8V208a16,16,0,0,1-16,16H184a16,16,0,0,1-16-16v-8H88v8a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V64A32,32,0,0,1,72,32H184A32,32,0,0,1,216,64ZM104,148a12,12,0,1,0-12,12A12,12,0,0,0,104,148Zm72,0a12,12,0,1,0-12,12A12,12,0,0,0,176,148Zm24-76H56v40H200Z";

// Home-screen and manifest icon: the bus on the accent green.
export function appIcon(size: number) {
  const glyph = Math.round(size * 0.6);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#059669",
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 256 256" fill="#ffffff">
          <path d={BUS_PATH} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
