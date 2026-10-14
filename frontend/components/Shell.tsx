"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useCourses, useCreateCourse } from "@/hooks/api";
import { Course } from "@/lib/api";

const CourseCtx = createContext<Course | null>(null);
export const useCurrentCourse = () => useContext(CourseCtx) as Course;
const NAV = [
  ["/", "▦", "Overview"],
  ["/materials", "▭", "Course materials"],
  ["/tutor", "✦", "AI tutor"],
  ["/practice", "☑", "Practice & quizzes"],
  ["/progress", "⌁", "My progress"],
  ["/concepts", "◈", "Concept map"],
  ["/recommendations", "★", "Recommendations"],
  ["/evaluation", "◎", "Evaluation"],
];

export default function Shell({ title, children }: { title: string; children: ReactNode }) {
  const path = usePathname(), router = useRouter();
  const { data: courses, isLoading } = useCourses();
  const create = useCreateCourse();
  const [cid, setCid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) router.replace("/login");
    setCid(localStorage.getItem("course"));
  }, [router]);

  const course = courses?.find((c) => c.id === cid) ?? courses?.[0] ?? null;

  const handleCreate = () => {
    if (!newCourseName.trim()) return;
    create.mutate(newCourseName.trim(), {
      onSuccess: (newC) => {
        localStorage.setItem("course", newC.id);
        setCid(newC.id);
        setNewCourseName("");
        setShowCreate(false);
      },
    });
  };

  return (
    <div className="app">
      <aside>
        <div className="logo"><i>▤</i>EduTutor AI</div>
        <p className="tag">Personalized Multimodal AI Tutor</p>
        <div className="course">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <small>Current course</small>
            <button 
              className="btn" 
              style={{ padding: "2px 6px", fontSize: 11 }}
              onClick={() => setShowCreate(!showCreate)}
            >
              {showCreate ? "Cancel" : "+ New"}
            </button>
          </div>
          {showCreate && (
            <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
              <input
                className="field"
                style={{ padding: "4px 8px", fontSize: 12 }}
                placeholder="Course title..."
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <button 
                className="btn p" 
                style={{ padding: "4px 8px", fontSize: 12 }}
                disabled={create.isPending || !newCourseName.trim()}
                onClick={handleCreate}
              >
                Add
              </button>
            </div>
          )}
          {courses && courses.length > 0 ? (
            <select
              className="field"
              style={{ margin: "6px 0 0", padding: 6, width: "100%" }}
              value={course?.id}
              onChange={(e) => {
                localStorage.setItem("course", e.target.value);
                setCid(e.target.value);
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <b>No course yet</b>
          )}
        </div>
        <nav>
          {NAV.map(([href, ic, label]) => (
            <Link key={href} href={href} className="navlink">
              <button className={path === href ? "on" : ""}>{ic} {label}</button>
            </Link>
          ))}
        </nav>
        <button
          className="btn"
          style={{ marginTop: "auto" }}
          onClick={() => {
            localStorage.removeItem("token");
            router.replace("/login");
          }}
        >
          Log out
        </button>
      </aside>
      <div>
        <div className="top">
          <div className="crumb">My workspace &nbsp;›&nbsp; <b>{title}</b></div>
          {course && <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>Course: <b>{course.name}</b></span>}
        </div>
        <main>
          {isLoading ? (
            <p>Loading…</p>
          ) : course ? (
            <CourseCtx.Provider value={course}>{children}</CourseCtx.Provider>
          ) : (
            <div className="card" style={{ maxWidth: 480 }}>
              <h2 style={{ fontWeight: 500 }}>Create your first course</h2>
              <p style={{ color: "var(--ink-muted)", marginBottom: 12 }}>
                EduTutor AI allows you to learn any subject (CS, Math, Physics, Biology, etc.) from your own uploaded lecture slides, textbooks, and videos.
              </p>
              <input
                className="field"
                placeholder="e.g. Machine Learning Fundamentals"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                className="btn p"
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate(name.trim(), {
                  onSuccess: (newC) => {
                    localStorage.setItem("course", newC.id);
                    setCid(newC.id);
                  }
                })}
              >
                Create course
              </button>
              {create.error && <p className="err">{create.error.message}</p>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
