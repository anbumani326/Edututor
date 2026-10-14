"use client";
import Link from "next/link";
import Shell, { useCurrentCourse } from "@/components/Shell";
import { useSources, useMastery, useQuizzes } from "@/hooks/api";
import { pct } from "@/lib/api";

function Inner() {
  const c = useCurrentCourse();
  const { data: src = [] } = useSources(c.id);
  const { data: m } = useMastery(c.id);
  const { data: qz = [] } = useQuizzes(c.id);

  const ready = src.filter((s) => s.status === "COMPLETED").length;
  const processing = src.filter((s) => s.status === "PENDING" || s.status === "PROCESSING").length;
  const failed = src.filter((s) => s.status === "FAILED").length;

  const weakConcepts = m?.concepts.filter((x) => x.p < 0.6) ?? [];
  const strongConcepts = m?.concepts.filter((x) => x.p >= 0.8) ?? [];

  // Real learning activity calculation: distinct calendar dates with quizzes
  const uniqueQuizDays = new Set(
    qz.map((q) => new Date(q.created_at).toISOString().split("T")[0])
  ).size;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name} · Student Command Center</div>
          <h1>Welcome to EduTutor AI</h1>
          <p className="sub">
            Personalized tutoring, grounded retrieval, and adaptive assessment tailored to your course material.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/materials" className="btn">
            + Upload Materials
          </Link>
          <Link href="/tutor" className="btn p">
            ✦ Ask AI Tutor
          </Link>
        </div>
      </div>

      <div className="grid4" style={{ marginBottom: 20 }}>
        <div className="card stat">
          <span>Course Knowledge Base</span>
          <b>{ready} Ready</b>
          <small>
            {src.length} total ({processing > 0 ? `${processing} indexing, ` : ""}{failed > 0 ? `${failed} failed` : "all verified"})
          </small>
        </div>
        <div className="card stat">
          <span>Overall Course Mastery</span>
          <b>{m?.overall != null ? pct(m.overall) : "—"}</b>
          <small>
            {m?.concepts.length ? `${m.concepts.length} concepts traced via BKT` : "Complete a quiz to trace"}
          </small>
        </div>
        <div className="card stat">
          <span>Practice Accuracy</span>
          <b>{qz[0] ? pct(qz[0].score) : "—"}</b>
          <small>
            {qz[0] ? `Latest quiz: ${Math.round(qz[0].score * qz[0].total)}/${qz[0].total} correct` : "No quizzes recorded"}
          </small>
        </div>
        <div className="card stat">
          <span>Active Study Days</span>
          <b>{uniqueQuizDays > 0 ? `${uniqueQuizDays} Days` : "0 Days"}</b>
          <small>{qz.length} practice sessions completed</small>
        </div>
      </div>

      <div className="two" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 18 }}>
            Recommended Next Learning Step
          </h3>
          {weakConcepts.length > 0 ? (
            <div style={{ background: "#fff1f2", padding: 14, borderRadius: 8, borderLeft: "4px solid #ef4444", marginBottom: 16 }}>
              <b style={{ color: "#9f1239" }}>Priority Focus: {weakConcepts[0].concept}</b>
              <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--ink-muted)" }}>
                Your current mastery is only {pct(weakConcepts[0].p)}. Reviewing this topic or attempting an adaptive quiz is highly recommended.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href="/practice" className="btn p" style={{ fontSize: 13 }}>
                  Take Adaptive Quiz on {weakConcepts[0].concept}
                </Link>
                <Link href="/recommendations" className="btn" style={{ fontSize: 13 }}>
                  View All Recommendations
                </Link>
              </div>
            </div>
          ) : ready > 0 ? (
            <div style={{ background: "var(--pri-soft)", padding: 14, borderRadius: 8, marginBottom: 16 }}>
              <b style={{ color: "var(--pri)" }}>Knowledge Base Ready for Inquiry</b>
              <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--ink)" }}>
                You have {ready} indexed materials in this course. Ask your AI tutor complex conceptual questions or test your understanding.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <Link href="/tutor" className="btn p" style={{ fontSize: 13 }}>
                  ✦ Open AI Tutor
                </Link>
                <Link href="/practice" className="btn" style={{ fontSize: 13 }}>
                  Generate Quiz
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ padding: "16px 0" }}>
              <p style={{ color: "var(--mut)", fontSize: 14 }}>
                No materials indexed yet. Upload a PDF textbook, lecture slides, or video lecture to start learning.
              </p>
              <Link href="/materials" className="btn p">
                Upload Course Materials
              </Link>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <Link href="/concepts" className="card" style={{ padding: 12, border: "1px solid var(--line)" }}>
              <b style={{ fontSize: 14, display: "block", marginBottom: 2 }}>◈ Concept Graph</b>
              <small style={{ color: "var(--mut)" }}>Explore prerequisite dependency tree</small>
            </Link>
            <Link href="/progress" className="card" style={{ padding: 12, border: "1px solid var(--line)" }}>
              <b style={{ fontSize: 14, display: "block", marginBottom: 2 }}>⌁ Knowledge Tracing</b>
              <small style={{ color: "var(--mut)" }}>View detailed BKT posterior mastery</small>
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Mastery Distribution</h3>
              <span className="pill">{m?.concepts.length ?? 0} Concepts</span>
            </div>
            {m?.concepts.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#166534" }}>Mastered (&ge;80%):</span>
                  <b>{strongConcepts.length} concepts</b>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#92400e" }}>In Progress (60-79%):</span>
                  <b>{m.concepts.length - strongConcepts.length - weakConcepts.length} concepts</b>
                </div>
                <div className="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#991b1b" }}>Needs Review (&lt;60%):</span>
                  <b>{weakConcepts.length} concepts</b>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--mut)", fontSize: 13 }}>
                Take a diagnostic practice quiz to populate mastery breakdown.
              </p>
            )}
          </div>

          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Recent Activity</h3>
              <span className="pill">{qz.length} quizzes</span>
            </div>
            {qz.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {qz.slice(0, 3).map((z, idx) => (
                  <div
                    key={z.id}
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 13,
                    }}
                  >
                    <span>
                      Quiz #{qz.length - idx} &bull; {new Date(z.created_at).toLocaleDateString()}
                    </span>
                    <b style={{ color: z.score >= 0.7 ? "var(--good, #16a34a)" : "var(--warn, #f59e0b)" }}>
                      {pct(z.score)} ({Math.round(z.score * z.total)}/{z.total})
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--mut)", fontSize: 13 }}>No recent quizzes taken.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Shell title="Overview">
      <Inner />
    </Shell>
  );
}
