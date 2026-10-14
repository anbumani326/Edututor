"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [err, setErr] = useState("");
  async function submit() {
    try {
      const r = await api<{ token: string }>(`/auth/${mode}`, { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem("token", r.token); router.push("/");
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div className="card" style={{ width: 380 }}>
        <div className="logo" style={{ marginBottom: 16 }}><i>▤</i>EduTutor AI</div>
        <input className="field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field" type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="btn p" style={{ width: "100%", marginTop: 8 }} onClick={submit}>
          {mode === "login" ? "Log in" : "Create account"}
        </button>
        <button
          className="btn"
          type="button"
          style={{ width: "100%", marginTop: 8, fontSize: 13, background: "var(--bg-subtle, #f9fafb)" }}
          onClick={() => {
            setEmail("demo@example.com");
            setPassword("password123");
            setMode("login");
          }}
        >
          ⚡ Fill Demo Student (demo@example.com)
        </button>
        <p style={{ color: "var(--mut)", textAlign: "center", cursor: "pointer", marginTop: 14 }} onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Log in"}
        </p>
      </div>
    </main>
  );
}
