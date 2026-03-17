import { useEffect, useState } from "react";
import api from "../../services/api";

export default function LinkPreview({ url }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api.get("/api/messages/link-preview", { params: { url } })
      .then((res) => { if (!cancelled && res.data) setData(res.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!data) return null;

  let domain = "";
  try { domain = new URL(url).hostname.replace("www.", ""); } catch { /* */ }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview"
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && (
        <img src={data.image} alt="" className="link-preview-thumb" />
      )}
      <div className="link-preview-body">
        {data.title && <span className="link-preview-title">{data.title}</span>}
        {data.description && <span className="link-preview-desc">{data.description}</span>}
        <span className="link-preview-domain">{domain}</span>
      </div>
    </a>
  );
}
