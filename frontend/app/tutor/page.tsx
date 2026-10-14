"use client";
import { useState, useEffect } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import SourceViewer from "@/components/SourceViewer";
import { useSources, useTutor, useSessions, useSessionMessages } from "@/hooks/api";
import { Citation } from "@/lib/api";
type Msg = { q: string; a?: string; cites: Citation[]; err?: string };
function Inner() {
  const c = useCurrentCourse(); const { data: src = [] } = useSources(c.id); const tutor = useTutor(c.id);
  const { data: sessions = [] } = useSessions(c.id);
  const [q, setQ] = useState(""); const [open, setOpen] = useState<Citation | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Set latest session on mount
  useEffect(() => { if (!sessionId && sessions.length > 0) setSessionId(sessions[0].id); }, [sessions, sessionId]);
  
  const { data: hist = [], isLoading: histLoading } = useSessionMessages(c.id, sessionId || undefined);
  const [optimisticMsgs, setOptimisticMsgs] = useState<Msg[]>([]);
  
  // Reset optimistic messages when changing session
  useEffect(() => { setOptimisticMsgs([]); }, [sessionId]);
  
  const msgs: Msg[] = [];
  for (let i = 0; i < hist.length; i += 2) {
    if (hist[i].role === "user") {
      const a = hist[i + 1]?.role === "assistant" ? hist[i + 1] : null;
      msgs.push({ q: hist[i].content, a: a?.content, cites: a?.citations || [] });
    }
  }
  msgs.push(...optimisticMsgs);
  
  const ready = src.filter((s) => s.status === "COMPLETED");
  const last = [...msgs].reverse().find((m) => m.cites.length);
  function ask() {
    const question = q.trim(); if (!question) return; setQ(""); const i = optimisticMsgs.length;
    setOptimisticMsgs((m) => [...m, { q: question, cites: [] }]);
    tutor.mutate({ question, session_id: sessionId || undefined }, {
      onSuccess: (r) => {
        setSessionId(r.session_id);
        setOptimisticMsgs((m) => m.map((x, j) => (j === i ? { ...x, a: r.answer, cites: r.citations } : x)));
      },
      onError: (e) => setOptimisticMsgs((m) => m.map((x, j) => (j === i ? { ...x, err: e.message } : x))),
    });
  }

  const formatTime = (sec?: number) => {
    if (sec === undefined || sec === null) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getCiteLabel = (x: Citation) => {
    if (x.slide) return `Slide ${x.slide}`;
    if (x.page) return `Page ${x.page}`;
    if (x.timestamp_start !== undefined && x.timestamp_start !== null) return `${formatTime(x.timestamp_start)}`;
    return "Source";
  };

  const suggestedQuestions = [
    "Explain the core topics and learning objectives from the course material.",
    "What are the key principles and foundational algorithms covered?",
    "Summarize the main points from the uploaded slides and lectures.",
    "Can you give me a recipe for chocolate chip cookies?" // Demonstration of grounding refusal
  ];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name}</div>
          <h1>Multimodal AI Tutor</h1>
          <p className="sub">
            Ask questions grounded strictly in your uploaded textbooks, slide decks, and video lectures with verified citations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            className="field"
            style={{ margin: 0, minWidth: 160 }}
            value={sessionId || ""}
            onChange={(e) => setSessionId(e.target.value)}
          >
            <option value="" disabled>Select session</option>
            {sessions.map((s, i) => (
              <option key={s.id} value={s.id}>
                Session {sessions.length - i} ({new Date(s.created_at).toLocaleDateString()})
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => setSessionId(null)}>+ New session</button>
        </div>
      </div>

      <div className="two">
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 520 }}>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
            {histLoading && <p style={{ color: "var(--mut)" }}>Loading chat history…</p>}
            {!histLoading && msgs.length === 0 && (
              <div style={{ padding: "20px 0" }}>
                <p style={{ color: "var(--mut)", marginBottom: 16 }}>
                  {ready.length
                    ? "Ask a question about your uploaded materials. The tutor answers using strict source grounding."
                    : "Upload course materials in 'Course materials' first to enable grounded tutoring."}
                </p>
                {ready.length > 0 && (
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-muted)", textTransform: "uppercase" }}>
                      Suggested questions:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {suggestedQuestions.map((sq, idx) => (
                        <button
                          key={idx}
                          className="btn"
                          style={{
                            fontSize: 12,
                            padding: "6px 12px",
                            textAlign: "left",
                            background: idx === 3 ? "#fff1f2" : undefined,
                            borderColor: idx === 3 ? "#fecdd3" : undefined,
                            color: idx === 3 ? "#e11d48" : undefined,
                          }}
                          onClick={() => {
                            setQ(sq);
                          }}
                        >
                          {idx === 3 ? "🛡️ Refusal test: " : "💡 "} {sq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {msgs.map((m, i) => {
              const isRefusal = m.a?.includes("couldn't find enough information") || m.a?.includes("not covered in your uploaded");
              return (
                <div key={i} className="msg" style={{ marginBottom: 20 }}>
                  <div className="q">
                    <small>Student</small>
                    <div style={{ fontSize: 15, marginTop: 4, fontWeight: 500 }}>{m.q}</div>
                  </div>
                  {m.err ? (
                    <p className="err">{m.err}</p>
                  ) : m.a === undefined ? (
                    <p style={{ color: "var(--mut)", marginTop: 8 }}>✦ EduTutor is searching knowledge base & synthesizing…</p>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <div className="row" style={{ justifyContent: "flex-start", gap: 8, marginBottom: 8 }}>
                        <b style={{ fontWeight: 600, color: "var(--accent)" }}>✦ EduTutor AI</b>
                        {isRefusal ? (
                          <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                            🛡️ Grounding Guard: Unverifiable Query Refused
                          </span>
                        ) : m.cites.length > 0 ? (
                          <span className="pill">{m.cites.length} verified sources</span>
                        ) : null}
                      </div>
                      <p style={{ fontSize: 15, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.a}</p>
                      {m.cites.length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {m.cites.map((c) => (
                            <button
                              key={c.n}
                              className="btn"
                              style={{ fontSize: 11, padding: "3px 8px", background: "var(--pri-soft)" }}
                              onClick={() => setOpen(c)}
                            >
                              [{c.n}] {c.source_name} ({getCiteLabel(c)}) ↗
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <input
              className="field"
              style={{ margin: 0, flex: 1 }}
              placeholder={ready.length ? "Ask about your course material (e.g. explain a concept, compare algorithms)..." : "Upload material first..."}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
            />
            <button className="btn p" disabled={tutor.isPending || !ready.length || !q.trim()} onClick={ask}>
              {tutor.isPending ? "Answering…" : "Ask Tutor"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ margin: 0, fontWeight: 500, fontSize: 18 }}>Active Grounding Context</h3>
            <p style={{ color: "var(--mut)", fontSize: 13 }}>
              Answers are synthesized exclusively from indexed chunks in these sources:
            </p>
            {ready.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--mut)" }}>No indexed sources yet.</p>
            ) : (
              ready.map((s) => (
                <div key={s.id} style={{ margin: "8px 0", padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <b>{s.name}</b>
                    <small style={{ fontWeight: 600, color: "var(--accent)" }}>{s.type.toUpperCase()}</small>
                  </div>
                  <small style={{ color: "var(--mut)" }}>
                    {s.type === "pdf" ? `${s.pages} pages` : s.type === "pptx" ? `${s.pages} slides` : "Video lecture"} · Indexed in Qdrant
                  </small>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontWeight: 500, fontSize: 18 }}>Cited Evidence</h3>
              <span className="pill">{last?.cites.length ?? 0} citations</span>
            </div>
            {last?.cites && last.cites.length > 0 ? (
              last.cites.map((x) => (
                <div
                  key={x.n}
                  className="exc"
                  style={{ cursor: "pointer", marginBottom: 10, padding: 10, borderRadius: 6, background: "var(--bg-subtle, #f9fafb)" }}
                  onClick={() => setOpen(x)}
                >
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <b className="cite">[{x.n}] {x.source_name}</b>
                    <span className="cite" style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {getCiteLabel(x)} ↗
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: 0 }}>
                    &ldquo;{x.excerpt.slice(0, 160)}…&rdquo;
                  </p>
                </div>
              ))
            ) : (
              <p style={{ color: "var(--mut)", fontSize: 13 }}>
                When the tutor answers, clickable citations linking directly to exact pages, slides, or timestamps will appear here.
              </p>
            )}
          </div>
        </div>
      </div>
      {open && <SourceViewer citation={open} onClose={() => setOpen(null)} />}
    </>
  );
}
export default function Page() { return <Shell title="AI tutor"><Inner /></Shell>; }
