"use client";
import { useState } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import SourceViewer from "@/components/SourceViewer";
import { useMastery, useQuizzes } from "@/hooks/api";
import Link from "next/link";
import { ConceptMastery, pct } from "@/lib/api";

function Inner() {
  const c = useCurrentCourse();
  const { data: m } = useMastery(c.id);
  const { data: qz = [] } = useQuizzes(c.id);
  const [view, setView] = useState<ConceptMastery | null>(null);

  const concepts = m?.concepts ?? [];
  const weak = concepts.filter((x) => x.p < 0.6);
  const strong = concepts.filter((x) => x.p >= 0.8);
  const inProgress = concepts.filter((x) => x.p >= 0.6 && x.p < 0.8);

  const totalAttempts = concepts.reduce((acc, x) => acc + x.attempts, 0);
  const totalCorrect = concepts.reduce((acc, x) => acc + x.correct, 0);
  const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name} · Learner Model</div>
          <h1>Learner Progress &amp; Knowledge Tracing</h1>
          <p className="sub">
            Real-time Bayesian Knowledge Tracing (BKT) tracking posterior mastery probability P(L) for each concept.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/practice" className="btn p">
            Take Adaptive Quiz
          </Link>
          <Link href="/recommendations" className="btn">
            View Recommendations
          </Link>
        </div>
      </div>

      {!concepts.length ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
          <b style={{ fontSize: 16 }}>No Mastery Data Yet</b>
          <p style={{ color: "var(--mut)", maxWidth: 440, margin: "8px auto 16px" }}>
            Complete your first adaptive practice quiz to calibrate your knowledge profile with Bayesian Knowledge Tracing.
          </p>
          <Link href="/practice" className="btn p">
            Start Diagnostic Practice
          </Link>
        </div>
      ) : (
        <>
          <div className="grid4" style={{ marginBottom: 20 }}>
            <div className="card stat">
              <span>Overall Course Mastery</span>
              <b>{pct(m?.overall ?? 0)}</b>
              <small>{concepts.length} concepts tracked</small>
            </div>
            <div className="card stat">
              <span>Average Accuracy</span>
              <b>{pct(overallAccuracy)}</b>
              <small>{totalCorrect} of {totalAttempts} questions correct</small>
            </div>
            <div className="card stat">
              <span>Concepts Mastered</span>
              <b>{strong.length}</b>
              <small>&ge; 80% posterior mastery</small>
            </div>
            <div className="card stat">
              <span>Needs Focus</span>
              <b>{weak.length}</b>
              <small>&lt; 60% posterior mastery</small>
            </div>
          </div>

          <div className="two">
            <div className="card">
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Concept Mastery Breakdown</h3>
                <span className="pill">• BKT Modeled</span>
              </div>
              <div style={{ display: "grid", gap: 14 }}>
                {concepts.map((x) => {
                  const barColor =
                    x.p >= 0.8 ? "var(--good, #16a34a)" : x.p < 0.6 ? "var(--bad, #dc2626)" : "var(--warn, #f59e0b)";
                  return (
                    <div key={x.concept}>
                      <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, fontSize: 14 }}>{x.concept}</span>
                        <b style={{ color: barColor }}>{pct(x.p)}</b>
                      </div>
                      <div className="bar" style={{ height: 8, background: "var(--line)" }}>
                        <i style={{ width: pct(x.p), background: barColor }} />
                      </div>
                      <div className="row" style={{ justifyContent: "space-between", marginTop: 4 }}>
                        <small style={{ color: "var(--mut)" }}>
                          {x.correct} of {x.attempts} correct ({x.attempts > 0 ? pct(x.correct / x.attempts) : "—"} accuracy)
                        </small>
                        {x.source_name && (
                          <small
                            className="cite"
                            style={{ cursor: "pointer", color: "var(--accent)" }}
                            onClick={() => setView(x)}
                          >
                            Source: {x.source_name} {x.page ? `(p. ${x.page})` : ""} ↗
                          </small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gap: 20 }}>
              <div className="card">
                <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
                  Priority Weak Topics
                </h3>
                {weak.length === 0 ? (
                  <p style={{ color: "var(--mut)", fontSize: 13 }}>
                    🎉 No weak topics right now! All concepts have at least 60% mastery.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {weak.map((x) => (
                      <div
                        key={x.concept}
                        style={{
                          background: "#fff1f2",
                          padding: "10px 14px",
                          borderRadius: 6,
                          borderLeft: "3px solid #e11d48",
                        }}
                      >
                        <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                          <b style={{ color: "#9f1239" }}>{x.concept}</b>
                          <span style={{ color: "#e11d48", fontWeight: 600, fontSize: 12 }}>
                            {pct(x.p)} mastery
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: "0 0 6px" }}>
                          Targeted by the adaptive quiz engine for focused review.
                        </p>
                        {x.source_name && (
                          <span
                            className="cite"
                            style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }}
                            onClick={() => setView(x)}
                          >
                            Review {x.source_name} {x.page ? `(Page ${x.page})` : ""} ↗
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Quiz Assessment History</h3>
                  <span className="pill">{qz.length} completed</span>
                </div>
                {qz.length === 0 ? (
                  <p style={{ color: "var(--mut)", fontSize: 13 }}>No recorded quizzes yet.</p>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {qz.map((z, idx) => (
                      <div
                        key={z.id}
                        className="row"
                        style={{
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "var(--bg-subtle, #f9fafb)",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <b>Quiz #{qz.length - idx}</b>
                          <div style={{ fontSize: 11, color: "var(--mut)" }}>
                            {new Date(z.created_at).toLocaleDateString()} · {z.total} questions
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <b style={{ color: z.score >= 0.7 ? "var(--good, #16a34a)" : "var(--warn, #f59e0b)" }}>
                            {pct(z.score)}
                          </b>
                          <div style={{ fontSize: 11, color: "var(--mut)" }}>
                            {Math.round(z.score * z.total)} / {z.total}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {view && (
        <SourceViewer
          citation={{
            n: 0,
            source_id: view.source_id,
            source_name: view.source_name,
            page: view.page,
            excerpt: "",
            score: 0,
          }}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell title="My progress">
      <Inner />
    </Shell>
  );
}
