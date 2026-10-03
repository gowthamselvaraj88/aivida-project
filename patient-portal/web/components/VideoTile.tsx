"use client";
import { useEffect, useRef } from "react";
import { VideoOff, User } from "lucide-react";

type Props = {
  stream: MediaStream | null;
  label: string;
  local?: boolean;
  off?: boolean;
  placeholder: string;
};

export default function VideoTile({ stream, label, local, off, placeholder }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  const showVideo = stream && !off;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#111827",
        borderRadius: "18px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid #1f2937",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
      }}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: local ? "scaleX(-1)" : "none",
          display: showVideo ? "block" : "none",
        }}
      />

      {!showVideo && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.9rem",
            color: "#94a3b8",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              display: "grid",
              placeItems: "center",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#34d399",
            }}
          >
            {off ? <VideoOff size={32} /> : <User size={34} />}
          </div>
          <span style={{ fontSize: "0.9rem", maxWidth: "240px", color: "#cbd5e1" }}>{placeholder}</span>
        </div>
      )}

      {/* Floating Name & Status Badge */}
      <div
        style={{
          position: "absolute",
          bottom: "1rem",
          left: "1rem",
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          padding: "0.35rem 0.85rem",
          borderRadius: "999px",
          fontSize: "0.82rem",
          fontWeight: 600,
          border: "1px solid rgba(255, 255, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: showVideo ? "#10b981" : "#f59e0b",
          }}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
