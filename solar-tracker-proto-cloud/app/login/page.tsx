"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      let payload: { error?: string } = {};
      try {
        payload = (await r.json()) as { error?: string };
      } catch {
        /* non-JSON */
      }
      if (!r.ok) {
        if (r.status === 401) {
          setError("Wrong password.");
        } else if (typeof payload.error === "string") {
          setError(payload.error);
        } else {
          setError(`Sign-in failed (${r.status}). Check Vercel env vars and redeploy.`);
        }
        setLoading(false);
        return;
      }
      const from = searchParams.get("from");
      window.location.href =
        from && from.startsWith("/") && !from.startsWith("//")
          ? from
          : "/";
    } catch {
      setError("Request failed.");
      setLoading(false);
    }
  }

  return (
    <main className="login-main">
      <h1>Solar Tracker Proto</h1>
      <p className="hint">Enter your site password to continue.</p>
      <form onSubmit={onSubmit}>
        <label className="plain">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="submit" disabled={loading || !password}>
          {loading ? "…" : "Sign in"}
        </button>
      </form>
      {error ? <p className="err">{error}</p> : null}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="hint" style={{ padding: "2rem" }}>Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
