const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("token") : null);
export type Course = { id: string; name: string };
export type Source = { id: string; name: string; type: string; status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"; pages: number; error: string; metadata?: any };
export type Citation = { n: number; source_id: string; source_name: string; page?: number; slide?: number; timestamp_start?: number; timestamp_end?: number; excerpt: string; score: number };
export type ChatReply = { answer: string; citations: Citation[]; session_id: string };

function headers(extra: HeadersInit = {}, json = false): Record<string, string> {
  const h: Record<string, string> = { ...(extra as Record<string, string>) };
  const t = getToken();
  if (t) h.Authorization = "Bearer " + t;
  if (json) h["Content-Type"] = "application/json";
  return h;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const r = await fetch(BASE + path, { ...init, headers: headers(init.headers, !!init.body && !isForm) });
  if (r.status === 401 && typeof window !== "undefined") { localStorage.removeItem("token"); location.href = "/login"; }
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(typeof e.detail === "string" ? e.detail : "Request failed"); }
  return r.json();
}
export async function fetchPdfBlobUrl(sourceId: string): Promise<string> {
  const r = await fetch(`${BASE}/sources/${sourceId}/file`, { headers: headers() });
  if (!r.ok) throw new Error("Could not load source");
  return URL.createObjectURL(await r.blob());
}
export async function fetchSourceMeta(sourceId: string) {
  const r = await fetch(`${BASE}/sources/${sourceId}/meta`, { headers: headers(undefined, true) });
  if (!r.ok) throw new Error("Failed to load source metadata");
  return r.json() as Promise<{ id: string, type: string, path: string }>;
}
export type Question = { 
  question: string; 
  options: string[]; 
  correct_index: number; 
  concept: string; 
  difficulty: string; 
  reason?: string; 
  explanation: string; 
  source: { 
    source_id: string; 
    source_name: string; 
    page?: number | null; 
    slide?: number | null; 
    timestamp_start?: number | null; 
    timestamp_end?: number | null 
  } 
};
export type Quiz = { id: string; questions: Question[] };
export type Misconception = {
  concept: string;
  question: string;
  chosen_answer: string;
  correct_answer: string;
  diagnosis: string;
  source: Question["source"];
};
export type SubmitResult = { 
  score: number; 
  correct: number; 
  total: number; 
  topics: { concept: string; p_before: number; p_after: number; correct: number; total: number }[];
  misconceptions?: Misconception[];
};
export type ConceptMastery = { concept: string; p: number; attempts: number; correct: number; source_id: string; source_name: string; page: number };
export type Mastery = { overall: number | null; concepts: ConceptMastery[] };
export type QuizSummary = { id: string; score: number; total: number; created_at: string };
export type Recommendation = {
  concept: string;
  mastery: number;
  action: string;
  source_id: string;
  source_name: string;
  location: string;
  page?: number | null;
  timestamp_start?: number | null;
};
export type StudentSimulation = {
  student: string;
  initial_mastery: number;
  adaptive_final_mastery: number;
  adaptive_gain: number;
  baseline_final_mastery: number;
  baseline_gain: number;
  weak_topic_targeting_rate: number;
  repetition_rate: number;
};
export type SimulationResponse = {
  experiment: string;
  students: StudentSimulation[];
  overall_adaptive_gain: number;
  overall_baseline_gain: number;
};
export const pct = (x: number) => Math.round(x * 100) + "%";
