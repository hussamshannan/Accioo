import { useEffect, useState } from "react";
import { getConversations } from "../../services/chatService";

export default function ForwardDialog({ message, open, onClose, onForward }) {
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(""); setSuccess(false); return; }
    setLoading(true);
    getConversations()
      .then((res) => setConversations(res.data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const filtered = conversations.filter((c) => {
    const other = c.participants?.find((p) => p._id !== message?.sender?._id);
    const name = other?.displayName || other?.username || "";
    return name.toLowerCase().includes(query.toLowerCase());
  });

  const handleSelect = async (conv) => {
    try {
      await onForward(message.dbId, conv._id);
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch { /* silent */ }
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 100,
          background: "rgba(0,0,0,0.4)",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 101,
          width: "clamp(300px, 100%, 600px)",
          background: "var(--body-bg-clr)",
          borderRadius: "24px 24px 0 0",
          padding: "20px 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxHeight: "70vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            alignSelf: "center",
            width: "36px",
            height: "4px",
            borderRadius: "2px",
            background: "var(--accent-clr)",
            marginBottom: "4px",
          }}
        />
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--txt-clr)" }}>
          Forward to…
        </h3>
        {success && (
          <p style={{ color: "var(--primary-clr)", fontSize: "14px" }}>
            ✓ Forwarded!
          </p>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          style={{
            padding: "8px 14px",
            borderRadius: "20px",
            border: "1px solid var(--accent-clr)",
            background: "var(--body-bg-clr-gray)",
            color: "var(--txt-clr)",
            fontSize: "14px",
            outline: "none",
          }}
        />
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
          {loading && <p style={{ color: "var(--txt-clr-dark)", fontSize: "14px" }}>Loading…</p>}
          {filtered.map((conv) => {
            const other = conv.participants?.find((p) => p._id !== message?.sender?._id);
            const name = other?.displayName || other?.username || "Unknown";
            return (
              <button
                key={conv._id}
                onClick={() => handleSelect(conv)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--body-bg-clr-gray)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "var(--accent-clr)",
                    overflow: "hidden",
                    flexShrink: 0,
                    display: "grid",
                    placeContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--txt-clr)",
                  }}
                >
                  {other?.avatarUrl
                    ? <img src={other.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : name[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: "14px", color: "var(--txt-clr)", fontWeight: 500 }}>
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
