"use client";
import { useState } from "react";
import Shell, { useCurrentCourse } from "@/components/Shell";
import SourceViewer from "@/components/SourceViewer";
import { useGenerateQuiz, useSubmitQuiz } from "@/hooks/api";
import { Quiz, SubmitResult, Question, pct } from "@/lib/api";
const L = ["A", "B", "C", "D"];
function Inner() {
  const c = useCurrentCourse(); const gen = useGenerateQuiz(c.id); const sub = useSubmitQuiz(c.id);
  const [quiz, setQuiz] = useState<Quiz | null>(null); const [i, setI] = useState(0);
  const [ans, setAns] = useState<(number | null)[]>([]); const [res, setRes] = useState<SubmitResult | null>(null);
  const [view, setView] = useState<Question["source"] | null>(null);
  const formatTime = (sec?: number | null) => {
    if (sec === undefined || sec === null) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const getSourceLoc = (src: Question["source"]) => {
    if (src.slide) return `Slide ${src.slide}`;
    if (src.page) return `Page ${src.page}`;
    if (src.timestamp_start !== undefined && src.timestamp_start !== null) {
      return `Timestamp ${formatTime(src.timestamp_start)}`;
    }
    return "Source";
  };

  const reset = () => {
    setQuiz(null);
    setRes(null);
    setI(0);
    setAns([]);
  };

  const start = () =>
    gen.mutate(5, {
      onSuccess: (q) => {
        setQuiz(q);
        setAns(q.questions.map(() => null));
        setI(0);
        setRes(null);
      },
    });

  const header = (
    <div className="head">
      <div>
        <div className="eyebrow">{c.name} · Bayesian Knowledge Tracing Assessment</div>
        <h1>Adaptive Practice &amp; Mastery</h1>
        <p className="sub">
          Dynamic quizzes generated from course material. Difficulty and topics dynamically target your weakest knowledge components using BKT.
        </p>
      </div>
      {quiz && !res && (
        <button className="btn" onClick={reset}>
          ⇥ Exit session
        </button>
      )}
    </div>
  );

  if (res) {
    const weak = [...res.topics].sort((a, b) => a.p_after - b.p_after)[0];
    const wq = quiz?.questions.find((q) => q.concept === weak?.concept);

    return (
      <>
        {header}
        <div className="grid4" style={{ marginBottom: 20 }}>
          <div className="card stat">
            <span>Accuracy</span>
            <b>{pct(res.score)}</b>
            <small>{res.correct} of {res.total} correct</small>
          </div>
          <div className="card stat">
            <span>Mastery Updates</span>
            <b>{res.topics.length} Concepts</b>
            <small>Calibrated via BKT</small>
          </div>
          <div className="card stat">
            <span>Diagnosed Misconceptions</span>
            <b>{res.misconceptions?.length ?? 0}</b>
            <small>{(res.misconceptions?.length ?? 0) > 0 ? "Targeted insights" : "Flawless run!"}</small>
          </div>
          <div className="card stat">
            <span>Priority Focus</span>
            <b style={{ fontSize: 16 }}>{weak ? weak.concept : "None"}</b>
            <small>{weak ? `${pct(weak.p_after)} mastery` : "All mastered"}</small>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, fontWeight: 600, fontSize: 18 }}>Topic Performance &amp; Bayesian Mastery Transition</h3>
          <p style={{ color: "var(--mut)", fontSize: 13, marginBottom: 12 }}>
            Mastery values updated through Bayesian Knowledge Tracing (P(L|Observed) with slip/guess calibration).
          </p>
          <table>
            <thead>
              <tr>
                <th>Concept</th>
                <th>Quiz Result</th>
                <th>Prior P(L)</th>
                <th>Updated P(L)</th>
                <th>Mastery Gain</th>
              </tr>
            </thead>
            <tbody>
              {res.topics.map((t) => {
                const diff = t.p_after - t.p_before;
                const sign = diff > 0 ? "+" : "";
                return (
                  <tr key={t.concept}>
                    <td><b>{t.concept}</b></td>
                    <td>{t.correct} / {t.total}</td>
                    <td>{pct(t.p_before)}</td>
                    <td><b>{pct(t.p_after)}</b></td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: diff > 0 ? "var(--good, #16a34a)" : diff < 0 ? "var(--bad, #dc2626)" : "var(--mut)",
                        }}
                      >
                        {sign}{Math.round(diff * 100)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {res.misconceptions && res.misconceptions.length > 0 && (
          <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid #ef4444" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 18, color: "#991b1b" }}>
                🔍 AI Diagnosed Conceptual Misconceptions
              </h3>
              <span className="pill" style={{ background: "#fee2e2", color: "#991b1b" }}>
                {res.misconceptions.length} Detected
              </span>
            </div>
            <p style={{ color: "var(--mut)", fontSize: 13, marginBottom: 16 }}>
              Our LLM tutor analyzed your incorrect answers to identify faulty mental models and provide targeted conceptual corrections:
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              {res.misconceptions.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--bg-subtle, #f9fafb)",
                    padding: "12px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                    <b style={{ fontSize: 14, color: "var(--ink)" }}>{m.concept}</b>
                    <span className="cite" style={{ cursor: "pointer", color: "var(--accent)" }} onClick={() => setView(m.source)}>
                      {m.source.source_name} ({getSourceLoc(m.source)}) ↗
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 6 }}>
                    <b>Question:</b> {m.question}
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: "#dc2626" }}><b>Selected:</b> {m.chosen_answer}</span>
                    <span style={{ color: "#16a34a" }}><b>Correct:</b> {m.correct_answer}</span>
                  </div>
                  <div style={{ background: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 13, borderLeft: "3px solid #f59e0b" }}>
                    <b>Tutor Diagnosis:</b> {m.diagnosis}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <b style={{ fontWeight: 600, fontSize: 16 }}>Recommended Next Action</b>
            <p style={{ color: "var(--mut)", margin: "4px 0 0" }}>
              {weak
                ? `Focus on strengthening “${weak.concept}” (${pct(weak.p_after)} mastery) before attempting advanced topics.`
                : "Great job! All concepts in this course show solid mastery."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {wq && (
              <button className="btn" onClick={() => setView(wq.source)}>
                Open Source ({wq.source.source_name})
              </button>
            )}
            <button className="btn p" onClick={start}>
              Generate Next Adaptive Quiz
            </button>
          </div>
        </div>

        {view && (
          <SourceViewer
            citation={{
              n: 0,
              source_id: view.source_id,
              source_name: view.source_name,
              page: view.page ?? undefined,
              slide: view.slide ?? undefined,
              timestamp_start: view.timestamp_start ?? undefined,
              timestamp_end: view.timestamp_end ?? undefined,
              excerpt: "",
              score: 0,
            }}
            onClose={() => setView(null)}
          />
        )}
      </>
    );
  }

  if (!quiz) {
    return (
      <>
        {header}
        <div className="card" style={{ maxWidth: 600 }}>
          <h3 style={{ marginTop: 0, fontWeight: 600 }}>Personalized Adaptive Assessment</h3>
          <p style={{ color: "var(--mut)", lineHeight: 1.5 }}>
            EduTutor AI builds an individualized assessment targeting your specific zone of proximal development:
          </p>
          <ul style={{ color: "var(--ink-muted)", fontSize: 14, margin: "12px 0 20px 20px", lineHeight: 1.6 }}>
            <li>Prioritizes your weakest concepts (P(L) &lt; 0.60) identified by Bayesian Knowledge Tracing.</li>
            <li>Dynamically calibrates question difficulty (Easy / Medium / Hard) based on current concept mastery.</li>
            <li>Strictly grounded in uploaded course materials (PDF pages, PPTX slides, video timestamps).</li>
            <li>Prevents question repetition and updates mastery in real-time upon submission.</li>
          </ul>
          <button className="btn p" disabled={gen.isPending} onClick={start} style={{ padding: "8px 20px", fontSize: 15 }}>
            {gen.isPending ? "Analyzing mastery & writing grounded questions…" : "Generate Adaptive Quiz"}
          </button>
          {gen.isPending && (
            <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 10 }}>
              Retrieving grounded chunks from Qdrant and generating question distractor keys using Ollama (Qwen3 8B)…
            </p>
          )}
          {gen.error && <p className="err">{gen.error.message}</p>}
        </div>
      </>
    );
  }

  const q = quiz.questions[i];
  const a = ans[i];
  const done = ans.filter((x) => x !== null).length;
  const right = ans.filter((x, k) => x === quiz.questions[k].correct_index).length;

  return (
    <>
      {header}
      <div className="card row" style={{ marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div>
          <b style={{ fontWeight: 600, fontSize: 17 }}>{c.name} · Adaptive Assessment</b>
          <div style={{ color: "var(--mut)", fontSize: 13, marginTop: 2 }}>
            {quiz.questions.length} questions · Grounded in course sources
          </div>
        </div>
        <div className="row" style={{ gap: 20 }}>
          <span className="pill">• Bayesian Adaptation Active</span>
          <div style={{ minWidth: 200 }}>
            <div className="row" style={{ color: "var(--mut)", fontSize: 12, marginBottom: 4 }}>
              Answered <b style={{ color: "var(--ink)" }}>{done} of {ans.length}</b>
            </div>
            <div className="bar">
              <i style={{ width: `${(done / ans.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <span className="eyebrow">Question {i + 1} of {ans.length}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <span className="pill" style={{ background: "var(--bg)", color: "var(--mut)" }}>
                {q.concept}
              </span>
              <span
                className="pill"
                style={{
                  background: q.difficulty === "hard" ? "#fee2e2" : q.difficulty === "medium" ? "#fef3c7" : "#dcfce7",
                  color: q.difficulty === "hard" ? "#991b1b" : q.difficulty === "medium" ? "#92400e" : "#166534",
                  textTransform: "capitalize",
                  fontWeight: 600,
                }}
              >
                {q.difficulty}
              </span>
            </div>
          </div>

          {q.reason && (
            <div
              style={{
                margin: "12px 0 4px",
                padding: "4px 10px",
                borderRadius: 6,
                background: "var(--pri-soft)",
                fontSize: 12,
                color: "var(--pri)",
                display: "inline-block",
              }}
            >
              {q.reason}
            </div>
          )}

          <h2 style={{ fontWeight: 500, fontSize: 22, margin: "16px 0 12px", lineHeight: 1.4 }}>
            {q.question}
          </h2>
          <p style={{ color: "var(--mut)", fontSize: 13, marginBottom: 16 }}>Select the most accurate answer.</p>

          <div style={{ display: "grid", gap: 8 }}>
            {q.options.map((o, k) => {
              const cls = a === null ? "" : k === q.correct_index ? "good" : k === a ? "bad" : "";
              return (
                <button
                  key={k}
                  className={`opt ${cls}`}
                  onClick={() => a === null && setAns(ans.map((x, j) => (j === i ? k : x)))}
                >
                  <em>{L[k]}</em>
                  {o}
                  {cls === "good" && <span>Correct ✓</span>}
                  {cls === "bad" && <span>Incorrect ✕</span>}
                </button>
              );
            })}
          </div>

          {a !== null && (
            <div className="q" style={{ marginTop: 16, background: "var(--bg-subtle, #f9fafb)", padding: 14, borderRadius: 8 }}>
              <b style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>Explanation &amp; Grounding</b>
              <p style={{ margin: "4px 0 8px", fontSize: 14, lineHeight: 1.5 }}>{q.explanation}</p>
              <span
                className="cite"
                style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 500, fontSize: 12 }}
                onClick={() => setView(q.source)}
              >
                {q.source.source_name} ({getSourceLoc(q.source)}) ↗
              </span>
            </div>
          )}

          <div className="row" style={{ marginTop: 20, justifyContent: "space-between" }}>
            <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
              ← Previous
            </button>
            {i < ans.length - 1 ? (
              <button className="btn p" disabled={a === null} onClick={() => setI(i + 1)}>
                Next Question →
              </button>
            ) : (
              <button
                className="btn p"
                disabled={done < ans.length || sub.isPending}
                onClick={() => sub.mutate({ id: quiz.id, answers: ans }, { onSuccess: setRes })}
              >
                {sub.isPending ? "Evaluating & Updating BKT…" : "Submit & Update Mastery"}
              </button>
            )}
          </div>
          {sub.error && <p className="err">{sub.error.message}</p>}
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ margin: 0, fontWeight: 500, fontSize: 18 }}>Question Navigator</h3>
            <div className="nums" style={{ margin: "14px 0" }}>
              {ans.map((x, k) => (
                <i
                  key={k}
                  className={x === null ? "" : x === quiz.questions[k].correct_index ? "g" : "r"}
                  style={k === i ? { outline: "2px solid var(--pri)" } : {}}
                  onClick={() => setI(k)}
                >
                  {k + 1}
                </i>
              ))}
            </div>
            <div className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: 14, justifyContent: "space-between" }}>
              <span style={{ color: "var(--mut)" }}>Answered Correctly</span>
              <b style={{ fontSize: 18 }}>{right} / {done}</b>
            </div>
            <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 8 }}>
              Each submitted answer updates the posterior probability of mastery P(L) in the learner model.
            </p>
          </div>

          <div className="card">
            <b style={{ fontWeight: 600, fontSize: 16 }}>✦ Adaptive Personalization</b>
            <p style={{ margin: "8px 0" }}>
              <span className="pill">Difficulty: {q.difficulty}</span>
            </p>
            <p style={{ color: "var(--mut)", fontSize: 13, lineHeight: 1.5 }}>
              Questions dynamically adapt: weak concepts receive focused diagnostic questions, while mastered concepts are tested with challenging synthesis problems.
            </p>
          </div>
        </div>
      </div>

      {view && (
        <SourceViewer
          citation={{
            n: 0,
            source_id: view.source_id,
            source_name: view.source_name,
            page: view.page ?? undefined,
            slide: view.slide ?? undefined,
            timestamp_start: view.timestamp_start ?? undefined,
            timestamp_end: view.timestamp_end ?? undefined,
            excerpt: "",
            score: 0,
          }}
          onClose={() => setView(null)}
        />
      )}
    </>
  );
}
export default function Page() { return <Shell title="Practice & quizzes"><Inner /></Shell>; }
