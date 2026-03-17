import { useEffect } from "react";

export default function ImageLightbox({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch { /* silent */ }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px",
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onClose}
    >
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          objectFit: "contain",
          borderRadius: "8px",
        }}
      />
      <div
        style={{ display: "flex", gap: "12px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleDownload}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ↓ Download
        </button>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            padding: "8px 16px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ✕ Close
        </button>
      </div>
    </div>
  );
}
