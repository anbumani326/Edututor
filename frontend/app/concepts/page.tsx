"use client";
import Link from "next/link";
import { useState } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import SourceViewer from "@/components/SourceViewer";
import { useConceptMap } from "@/hooks/api";
import { ConceptMastery, pct } from "@/lib/api";
const COLS = 3, W = 220, H = 110;
const color = (p: number) => (p >= 0.7 ? "var(--ok)" : p >= 0.4 ? "var(--warn)" : "var(--bad)");
function Inner() {
  const c = useCurrentCourse();
  const { data } = useConceptMap(c.id);
  const [sel, setSel] = useState<ConceptMastery | null>(null);
  const [view, setView] = useState(false);

  const pos = (i: number) => ({ x: (i % COLS) * W + 20, y: Math.floor(i / COLS) * H + 20 });
  const idx = new Map(data?.nodes.map((n, i) => [n.concept, i]));

  const getPrerequisites = (concept: string) =>
    data?.edges.filter((e) => e.to === concept).map((e) => e.from) ?? [];

  const getDependents = (concept: string) =>
    data?.edges.filter((e) => e.from === concept).map((e) => e.to) ?? [];

  return (
    <>
      <div className="head">
        <div>
          <div className="eyebrow">{c.name} · Knowledge Graph</div>
          <h1>Concept &amp; Prerequisite Map</h1>
          <p className="sub">
            Curriculum prerequisite graph extracted from course materials, dynamically colored by your real-time Bayesian Knowledge Tracing mastery.
          </p>
        </div>
        <Link href="/practice" className="btn p">
          Practice Weakest Concept
        </Link>
      </div>

      {!data?.nodes.length ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>◈</div>
          <b style={{ fontSize: 16 }}>No Concept Graph Available Yet</b>
          <p style={{ color: "var(--mut)", maxWidth: 440, margin: "8px auto 16px" }}>
            The concept map builds automatically as materials are indexed and diagnostic quizzes are taken.
          </p>
          <Link href="/practice" className="btn p">
            Take a Practice Quiz
          </Link>
        </div>
      ) : (
        <div className="two">
          <div className="card tbl" style={{ overflowX: "auto", minHeight: 460 }}>
            <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--ok, #16a34a)" }} />
                High Mastery (&ge;70%)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--warn, #f59e0b)" }} />
                Developing (40–69%)
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--bad, #dc2626)" }} />
                Needs Focus (&lt;40%)
              </span>
            </div>

            <svg
              width={COLS * W + 40}
              height={Math.ceil(data.nodes.length / COLS) * H + 40}
              style={{ display: "block" }}
            >
              <defs>
                <marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0 0L8 4L0 8z" fill="var(--mut)" />
                </marker>
              </defs>
              {data.edges.map((e, k) => {
                const aIdx = idx.get(e.from);
                const bIdx = idx.get(e.to);
                if (aIdx === undefined || bIdx === undefined) return null;
                const a = pos(aIdx),
                  b = pos(bIdx);
                return (
                  <line
                    key={k}
                    x1={a.x + 90}
                    y1={a.y + 36}
                    x2={b.x + 90}
                    y2={b.y + 36}
                    stroke="var(--mut)"
                    strokeWidth="1.5"
                    markerEnd="url(#ar)"
                    opacity="0.6"
                  />
                );
              })}
              {data.nodes.map((n, i) => {
                const { x, y } = pos(i);
                const isSelected = sel?.concept === n.concept;
                return (
                  <g key={n.concept} onClick={() => setSel(n)} style={{ cursor: "pointer" }}>
                    <rect
                      x={x}
                      y={y}
                      width={180}
                      height={72}
                      rx={10}
                      fill={isSelected ? "var(--pri-soft)" : "var(--card)"}
                      stroke={isSelected ? "var(--pri)" : color(n.p)}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    <text
                      x={x + 12}
                      y={y + 26}
                      fill="var(--ink)"
                      fontSize="13"
                      fontWeight="600"
                    >
                      {n.concept.length > 22 ? n.concept.slice(0, 20) + "…" : n.concept}
                    </text>
                    <text
                      x={x + 12}
                      y={y + 50}
                      fill={color(n.p)}
                      fontSize="12"
                      fontWeight="500"
                    >
                      Mastery: {pct(n.p)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="card" style={{ minHeight: 460 }}>
            {!sel ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--mut)" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
                <b>Select any concept node in the graph</b>
                <p style={{ fontSize: 13, margin: "6px 0 0" }}>
                  View its mastery score, prerequisite relationships, and grounded study actions.
                </p>
              </div>
            ) : (
              <>
                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                  <span className="eyebrow">Concept Details</span>
                  <span
                    className="pill"
                    style={{
                      background: sel.p >= 0.7 ? "#dcfce7" : sel.p >= 0.4 ? "#fef3c7" : "#fee2e2",
                      color: sel.p >= 0.7 ? "#166534" : sel.p >= 0.4 ? "#92400e" : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {pct(sel.p)} Mastery
                  </span>
                </div>

                <h2 style={{ marginTop: 0, fontWeight: 600, fontSize: 20 }}>{sel.concept}</h2>
                <p style={{ color: "var(--ink-muted)", fontSize: 13, marginBottom: 16 }}>
                  Practice accuracy: <b>{sel.correct} of {sel.attempts} correct</b> ({sel.attempts > 0 ? pct(sel.correct / sel.attempts) : "No attempts yet"}).
                </p>

                <div style={{ marginBottom: 16 }}>
                  <b style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Prerequisites:</b>
                  {getPrerequisites(sel.concept).length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {getPrerequisites(sel.concept).map((p) => (
                        <span key={p} className="pill" style={{ background: "var(--bg)", fontSize: 12 }}>
                          ← {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--mut)" }}>None (Foundational concept)</span>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <b style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Unlocks / Downstream:</b>
                  {getDependents(sel.concept).length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {getDependents(sel.concept).map((d) => (
                        <span key={d} className="pill" style={{ background: "var(--bg)", fontSize: 12 }}>
                          → {d}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--mut)" }}>Terminal concept in current module</span>
                  )}
                </div>

                <div style={{ background: "var(--bg-subtle, #f9fafb)", padding: 12, borderRadius: 8, marginBottom: 20 }}>
                  <b style={{ fontSize: 12, textTransform: "uppercase", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>
                    Pedagogical Recommendation:
                  </b>
                  <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                    {sel.p < 0.5
                      ? `Mastery is low (${pct(sel.p)}). Review the foundational explanations in ${sel.source_name || "the course material"} before attempting dependent concepts.`
                      : sel.p < 0.75
                      ? `Developing proficiency (${pct(sel.p)}). Take targeted practice to reinforce retention and eliminate potential misconceptions.`
                      : `Strong mastery demonstrated (${pct(sel.p)}). You are fully prepared to advance to dependent concepts.`}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  {sel.page > 0 && sel.source_name && (
                    <button className="btn" onClick={() => setView(true)}>
                      Review Source ({sel.source_name}, p. {sel.page}) ↗
                    </button>
                  )}
                  <Link href="/practice" className="btn p">
                    Practice This Concept
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {view && sel && (
        <SourceViewer
          citation={{
            n: 0,
            source_id: sel.source_id,
            source_name: sel.source_name,
            page: sel.page,
            excerpt: "",
            score: 0,
          }}
          onClose={() => setView(false)}
        />
      )}
    </>
  );
}
export default function Page() { return <Shell title="Concept map"><Inner /></Shell>; }
