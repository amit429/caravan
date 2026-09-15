import { ImageResponse } from "next/og";

// The same compass mark used across the app's illustrations (see
// components/caravan/primitives/illustrations.tsx) and the README title —
// "you haven't picked a direction yet" is the whole product, so it's the
// one motif worth using as the brand mark too.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#5D2A5B",
          borderRadius: 7,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="34" stroke="#EDEAE3" strokeWidth="8" />
          <circle cx="48" cy="48" r="5" fill="#EDEAE3" />
          <path d="M60 32 L44 44 L36 64 L52 52 Z" fill="#EDEAE3" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
