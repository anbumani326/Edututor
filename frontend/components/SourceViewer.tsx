"use client";
import { useEffect, useState } from "react";
import { fetchPdfBlobUrl, fetchSourceMeta, Citation } from "@/lib/api";

export default function SourceViewer({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ id: string; type: string; path: string } | null>(null);
  const [err, setErr] = useState("");

  const formatTime = (sec?: number) => {
    if (sec === undefined || sec === null) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getSourceLocation = () => {
    if (citation.slide) return `Slide ${citation.slide}`;
    if (citation.page) return `Page ${citation.page}`;
    if (citation.timestamp_start !== undefined && citation.timestamp_start !== null) {
      return `Timestamp ${formatTime(citation.timestamp_start)}${citation.timestamp_end ? ` - ${formatTime(citation.timestamp_end)}` : ""}`;
    }
    return "Source Reference";
  };

  useEffect(() => {
    fetchSourceMeta(citation.source_id)
      .then(async (m) => {
        setMeta(m);
        if (m.type === "pdf" || m.type === "video" || m.type === "pptx") {
          setUrl(await fetchPdfBlobUrl(citation.source_id));
        } else if (m.type === "youtube") {
          const match = m.path.match(/(?:v=|youtu\.be\/)([^&]+)/);
          const vid = match ? match[1] : "";
          const t = citation.timestamp_start ? `?start=${Math.floor(citation.timestamp_start)}&autoplay=1` : "";
          setUrl(`https://www.youtube.com/embed/${vid}${t}`);
        }
      })
      .catch((e) => setErr(e.message));
  }, [citation]);

  return (
    <div className="modal" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860, width: "95%" }}>
        <div className="row" style={{ marginBottom: 12, justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <b style={{ fontSize: 16 }}>{citation.source_name}</b>
            <span style={{ marginLeft: 8, padding: "2px 8px", background: "var(--accent-soft)", borderRadius: 12, fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>
              {getSourceLocation()}
            </span>
          </div>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>

        {citation.excerpt && (
          <div style={{ background: "var(--bg-subtle, #f8f9fa)", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, borderLeft: "3px solid var(--accent)", color: "var(--ink)" }}>
            <span style={{ fontWeight: 600, display: "block", marginBottom: 4, color: "var(--ink-muted)", fontSize: 11, textTransform: "uppercase" }}>
              Grounded Citation Excerpt
            </span>
            &ldquo;{citation.excerpt}&rdquo;
          </div>
        )}

        {err ? (
          <p className="err">{err}</p>
        ) : url ? (
          meta?.type === "video" ? (
            <video
              src={`${url}#t=${citation.timestamp_start || 0}`}
              controls
              autoPlay
              style={{ width: "100%", maxHeight: "65vh", borderRadius: 8, background: "#000" }}
            />
          ) : meta?.type === "pptx" ? (
            <div style={{ padding: 24, textAlign: "center", background: "#fdfefe", border: "1px dashed var(--line)", borderRadius: 8 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>📊</div>
              <h3 style={{ margin: 0, fontWeight: 600 }}>Presentation Slide {citation.slide ?? 1}</h3>
              <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: "8px 0 16px" }}>
                This citation references Slide {citation.slide ?? 1} of {citation.source_name}.
              </p>
              <a href={url} download={citation.source_name} className="btn p">
                Download Slide Deck ({citation.source_name})
              </a>
            </div>
          ) : (
            <iframe
              src={meta?.type === "pdf" && citation.page ? `${url}#page=${citation.page}` : url}
              title={citation.source_name}
              style={{ width: "100%", height: "65vh", borderRadius: 8, border: "1px solid var(--line)" }}
            />
          )
        ) : (
          <p style={{ padding: 20, textAlign: "center" }}>Loading source material…</p>
        )}
      </div>
    </div>
  );
}
