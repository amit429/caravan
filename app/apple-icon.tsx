import { ImageResponse } from "next/og";

// Same mark as icon.tsx, scaled up for iOS/Android "add to home screen" —
// Apple ignores border-radius on touch icons and rounds it itself, so this
// stays a plain square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        }}
      >
        <svg width="128" height="128" viewBox="0 0 96 96" fill="none">
          <circle cx="48" cy="48" r="34" stroke="#EDEAE3" strokeWidth="6" />
          <circle cx="48" cy="48" r="5" fill="#EDEAE3" />
          <path d="M60 32 L44 44 L36 64 L52 52 Z" fill="#EDEAE3" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
