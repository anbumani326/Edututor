"use client";
import { useRef, useState } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import { useSources, useUpload, useAddYoutube } from "@/hooks/api";
import Link from "next/link";

const LABEL = {
  PENDING: ["b", "● Queued"],
  PROCESSING: ["b", "● Ingesting & Indexing…"],
  COMPLETED: ["", "● Indexed & Ready"],
  FAILED: ["w", "● Processing Issue"],
} as const;

function Inner() {
  const c = useCurrentCourse();
  const { data: src = [] } = useSources(c.id);
  const up = useUpload(c.id);
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [ytUrl, setYtUrl] = useState("");
  const ready = src.filter((s) => s.status === "COMPLETED").length;
  const send = (f?: File) => f && up.mutate(f);
  const yt = useAddYoutube(c.id);
  const sendYt = () => {
    if (ytUrl.trim()) yt.mutate(ytUrl.trim());
    setYtUrl("");
  };

  const getFormatBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === "pdf") return <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>PDF</span>;
    if (t === "pptx" || t === "presentation") return <span style={{ background: "#ffedd5", color: "#9a3412", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>PPTX</span>;
    if (t === "youtube") return <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>YOUTUBE</span>;
    return <span style={{ background: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>VIDEO</span>;
  };

  const getSourceDetail = (s: any) => {
    if (s.type === "pdf") return s.pages ? `${s.pages} pages` : "Document";
    if (s.type === "pptx") return s.pages ? `${s.pages} slides` : "Slide deck";
    if (s.metadata?.duration) {
      const mins = Math.floor(s.metadata.duration / 60);
      const secs = Math.floor(s.metadata.duration % 60);
      return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
    }
    return s.type === "youtube" ? "Online stream" : "Media stream";
  };

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name}</div>
          <h1>Multimodal Course Knowledge Base</h1>
          <p className="sub">
            Upload course materials to index them into your private vector store. AI Tutor answers and quizzes are grounded strictly in these sources.
          </p>
        </div>
        <button className="btn p" onClick={() => ref.current?.click()} disabled={up.isPending}>
          {up.isPending ? "Uploading…" : "+ Upload materials"}
        </button>
      </div>

      <input
        ref={ref}
        type="file"
        accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,video/mp4,video/quicktime,video/x-matroska,video/webm,.pdf,.pptx,.ppt,.mp4,.mov,.mkv,.webm"
        hidden
        onChange={(e) => send(e.target.files?.[0])}
      />

      <div
        className="drop"
        style={drag ? { background: "var(--pri-soft)" } : {}}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          send(e.dataTransfer.files[0]);
        }}
      >
        <div>
          <b style={{ fontSize: 18, fontWeight: 500 }}>Drop your course materials here</b>
          <div style={{ color: "var(--mut)", marginTop: 4 }}>
            Supported formats: PDF textbooks, PPTX slides, MP4 / MOV videos, and YouTube lectures.
          </div>
        </div>
        <button className="btn" onClick={() => ref.current?.click()}>Browse files</button>
      </div>

      <div className="banner">
        <div>
          <b style={{ fontWeight: 500 }}>{ready} of {src.length} sources indexed into Qdrant</b>
          <div style={{ color: "var(--mut)" }}>
            Chunks, OCR frames, and audio transcripts are embedded using MiniLM-L6-v2 vectors for grounded RAG.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "20px 0" }}>
        <input
          className="field"
          placeholder="Or paste a YouTube lecture URL (e.g. https://www.youtube.com/watch?v=...)"
          value={ytUrl}
          onChange={(e) => setYtUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendYt()}
        />
        <button className="btn" onClick={sendYt} disabled={!ytUrl.trim() || yt.isPending}>
          {yt.isPending ? "Adding…" : "Add YouTube Lecture"}
        </button>
      </div>

      {up.error && <p className="err">{up.error.message}</p>}
      {yt.error && <p className="err">{yt.error.message}</p>}

      {src.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
          <b style={{ fontSize: 16 }}>No materials uploaded yet</b>
          <p style={{ color: "var(--mut)", maxWidth: 440, margin: "8px auto 16px" }}>
            Add your first lecture notes, syllabus, slides, or video above to build the grounded knowledge base.
          </p>
        </div>
      ) : (
        <div className="card tbl" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Format</th>
                <th>Content scope</th>
                <th>Readiness</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {src.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td>{getFormatBadge(s.type)}</td>
                  <td>{getSourceDetail(s)}</td>
                  <td>
                    <span className={`st ${LABEL[s.status]?.[0] ?? ""}`}>
                      {LABEL[s.status]?.[1] ?? s.status}
                    </span>
                    {s.error && <small style={{ display: "block", color: "var(--err)", marginTop: 2 }}>{s.error}</small>}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <Link href="/tutor" className="btn" style={{ padding: "4px 8px", fontSize: 12 }}>
                        Ask Tutor
                      </Link>
                      <Link href="/practice" className="btn" style={{ padding: "4px 8px", fontSize: 12 }}>
                        Generate Quiz
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
export default function Page() { return <Shell title="Course materials"><Inner /></Shell>; }
