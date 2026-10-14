"use client";
import { useState } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import SourceViewer from "@/components/SourceViewer";
import { useRecommendations } from "@/hooks/api";
import { Recommendation, pct } from "@/lib/api";
import Link from "next/link";

function Inner() {
  const c = useCurrentCourse();
  const { data: recsData, isLoading, error } = useRecommendations(c.id);
  const recs = recsData?.recommendations ?? [];
  const [activeRec, setActiveRec] = useState<Recommendation | null>(null);



  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name} · Adaptive Recommendations</div>
          <h1>Personalized Study Recommendations</h1>
          <p className="sub">
            Prioritized learning actions derived from your Bayesian Knowledge Tracing mastery scores, quiz performance, and indexed course content.
          </p>
        </div>
        <Link href="/practice" className="btn p">
          Take Practice Quiz
        </Link>
      </div>

      {isLoading && <p>Analyzing mastery profiles &amp; formulating recommendations…</p>}
      {error && <p className="err">{error.message}</p>}

      {!isLoading && recs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌟</div>
          <b style={{ fontSize: 16 }}>No Urgent Study Deficits Detected</b>
          <p style={{ color: "var(--mut)", maxWidth: 460, margin: "8px auto 16px" }}>
            All your tracked concepts either demonstrate high mastery (P &gt; 80%) or you have not yet taken a diagnostic quiz for this course.
          </p>
          <Link href="/practice" className="btn p">
            Take a Quiz to Calibrate Mastery
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {recs.map((rec, i) => (
            <div
              key={i}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
                borderLeft: rec.mastery < 0.5 ? "4px solid #ef4444" : "4px solid #f59e0b",
              }}
            >
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <span
                    className="pill"
                    style={{
                      background: rec.mastery < 0.5 ? "#fee2e2" : "#fef3c7",
                      color: rec.mastery < 0.5 ? "#991b1b" : "#92400e",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      fontSize: 11,
                    }}
                  >
                    {rec.mastery < 0.5 ? "High Priority Focus" : "Review Recommended"}
                  </span>
                  <span className="pill" style={{ fontWeight: 600 }}>
                    {rec.concept}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--mut)" }}>
                    Current Mastery: <b>{pct(rec.mastery)}</b>
                  </span>
                </div>

                <h3 style={{ margin: "4px 0 6px", fontSize: 17, fontWeight: 600 }}>
                  {rec.action}
                </h3>
                {rec.source_name && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--accent)" }}>
                    Source Evidence: <b>{rec.source_name}</b> ({rec.location})
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {rec.source_id && (
                  <button
                    className="btn"
                    onClick={() => setActiveRec(rec)}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    Open Source ({rec.location}) ↗
                  </button>
                )}
                <Link href="/practice" className="btn p" style={{ whiteSpace: "nowrap" }}>
                  Practice This Topic
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeRec && activeRec.source_id && (
        <SourceViewer
          citation={{
            n: 0,
            source_id: activeRec.source_id,
            source_name: activeRec.source_name,
            page: activeRec.page ?? undefined,
            timestamp_start: activeRec.timestamp_start ?? undefined,
            excerpt: activeRec.action,
            score: 0,
          }}
          onClose={() => setActiveRec(null)}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Shell title="Study Recommendations">
      <Inner />
    </Shell>
  );
}
