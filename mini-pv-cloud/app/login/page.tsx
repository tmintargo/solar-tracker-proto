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
      if (!r.ok) {
        setError("Wrong password.");
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
    <main style={{ maxWidth: 360, margin: "4rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.25rem" }}>Mini PV cloud</h1>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        Enter your site password to continue.
      </p>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              fontSize: 16,
            }}
          />
        </label>
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            marginTop: 12,
            padding: "10px 16px",
            fontSize: 16,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "…" : "Sign in"}
        </button>
      </form>
      {error ? (
        <p style={{ color: "#c00", marginTop: 12 }}>{error}</p>
      ) : null}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}
