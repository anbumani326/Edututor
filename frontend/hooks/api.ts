"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Course, Source, ChatReply, Citation } from "@/lib/api";

export const useCourses = () => useQuery({ queryKey: ["courses"], queryFn: () => api<Course[]>("/courses") });
export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (name: string) => api<Course>("/courses", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["courses"] }) });
}
export const useSources = (cid: string) => useQuery({
  queryKey: ["sources", cid], queryFn: () => api<Source[]>(`/courses/${cid}/sources`),
  refetchInterval: (q) => (q.state.data?.some((s) => s.status === "PENDING" || s.status === "PROCESSING") ? 2000 : false),
});
export function useUpload(cid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api<Source>(`/courses/${cid}/sources`, { method: "POST", body: fd }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources", cid] }),
  });
}
export function useAddYoutube(cid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => api<Source>(`/courses/${cid}/youtube`, { method: "POST", body: JSON.stringify({ url }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sources", cid] }),
  });
}
export const useTutor = (cid: string) => useMutation({
  mutationFn: (args: { question: string, session_id?: string }) => api<ChatReply>(`/courses/${cid}/chat`, { method: "POST", body: JSON.stringify(args) }),
});
export const useSessions = (cid: string) => useQuery({
  queryKey: ["sessions", cid],
  queryFn: () => api<{ id: string; created_at: string }[]>(`/courses/${cid}/chat/sessions`),
});
export const useSessionMessages = (cid: string, sessionId?: string) => useQuery({
  queryKey: ["session", cid, sessionId],
  queryFn: () => api<{ id: string; role: string; content: string; citations: Citation[] }[]>(`/courses/${cid}/chat/sessions/${sessionId}`),
  enabled: !!sessionId,
});
import { Quiz, SubmitResult, Mastery, QuizSummary } from "@/lib/api";
export const useMastery = (cid: string) => useQuery({ queryKey: ["mastery", cid], queryFn: () => api<Mastery>(`/courses/${cid}/mastery`) });
export const useQuizzes = (cid: string) => useQuery({ queryKey: ["quizzes", cid], queryFn: () => api<QuizSummary[]>(`/courses/${cid}/quizzes`) });
export const useGenerateQuiz = (cid: string) => useMutation({
  mutationFn: (count: number) => api<Quiz>(`/courses/${cid}/quiz/generate`, { method: "POST", body: JSON.stringify({ count }) }) });
export function useSubmitQuiz(cid: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; answers: (number | null)[] }) => api<SubmitResult>(`/quiz/${v.id}/submit`, { method: "POST", body: JSON.stringify({ answers: v.answers }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mastery", cid] }); qc.invalidateQueries({ queryKey: ["quizzes", cid] }); },
  });
}
export type EvalCase = { id: string; question: string; expected_source: string; expected_page: number | null };
export type EvalResult = { id: string; created_at: string; metrics: Record<string, number | null>; details: { question: string; expected: string; passed: boolean; retrieved: string[] }[] };
export const useEvalCases = (cid: string) => useQuery({ queryKey: ["evcases", cid], queryFn: () => api<EvalCase[]>(`/courses/${cid}/evaluation/cases`) });
export const useEvalLatest = (cid: string) => useQuery({ queryKey: ["evlatest", cid], queryFn: () => api<EvalResult | null>(`/courses/${cid}/evaluation/latest`) });
export function useAddCase(cid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (c: Omit<EvalCase, "id">) => api(`/courses/${cid}/evaluation/cases`, { method: "POST", body: JSON.stringify(c) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evcases", cid] }) });
}
export function useDeleteCase(cid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api(`/evaluation/cases/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["evcases", cid] }) });
}
export function useRunEval(cid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api<EvalResult>(`/courses/${cid}/evaluation/run`, { method: "POST" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["evlatest", cid] }) });
}
import { ConceptMastery, Recommendation, SimulationResponse } from "@/lib/api";
export const useConceptMap = (cid: string) => useQuery({ queryKey: ["cmap", cid], queryFn: () => api<{ nodes: ConceptMastery[]; edges: { from: string; to: string }[] }>(`/courses/${cid}/concept-map`) });
export const useRecommendations = (cid: string) => useQuery({ queryKey: ["recs", cid], queryFn: () => api<{ recommendations: Recommendation[] }>(`/courses/${cid}/recommendations`) });
export function useSeedCases(cid: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api<{ status: string; seeded_count: number }>(`/courses/${cid}/evaluation/seed-cases`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evcases", cid] }); } });
}
export function useSimulate(cid: string) {
  return useMutation({ mutationFn: () => api<SimulationResponse>(`/courses/${cid}/evaluation/simulate`, { method: "POST" }) });
}

