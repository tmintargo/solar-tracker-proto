"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_DEVICE = "miniPvDeviceId";

export function ControlPanel() {
  const [deviceId, setDeviceId] = useState("esp32-devkit");
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("Loading…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_DEVICE);
      if (s) setDeviceId(s);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DEVICE, deviceId);
    } catch {
      /* ignore */
    }
  }, [deviceId]);

  const refreshStatus = useCallback(async () => {
    if (!deviceId.trim()) {
      setStatusText("Set device ID.");
      return;
    }
    try {
      const r = await fetch(
        `/api/device-status?device_id=${encodeURIComponent(deviceId.trim())}`,
        { cache: "no-store" }
      );
      const text = await r.text();
      try {
        const j = JSON.parse(text);
        setStatusText(JSON.stringify(j, null, 2));
      } catch {
        setStatusText(text || "(empty)");
      }
    } catch {
      setStatusText("(could not load)");
    }
  }, [deviceId]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  async function sendCmd(body: Record<string, unknown>) {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId.trim(), ...body }),
      });
      const data = (await r.json()) as { ok?: boolean; upstream?: unknown; error?: string };
      if (!r.ok) {
        setErr(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.upstream ?? data)
        );
      }
      await refreshStatus();
    } catch {
      setErr("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="hint">
        Commands go through this site → your{" "}
        <strong>Cloudflare tunnel</strong> → Node-RED{" "}
        <code>POST /mqtt/cmd</code>. Set <code>COMMAND_TUNNEL_URL</code> on Vercel.
      </p>

      <label className="field" htmlFor="deviceId">
        Device ID
      </label>
      <input
        id="deviceId"
        className="field"
        value={deviceId}
        onChange={(e) => setDeviceId(e.target.value)}
        autoComplete="off"
        placeholder="esp32-devkit"
      />

      <div className="row">
        <button
          type="button"
          className="btn btn-on"
          disabled={busy}
          onClick={() => void sendCmd({ state: "on" })}
        >
          Turn ON
        </button>
        <button
          type="button"
          className="btn btn-off"
          disabled={busy}
          onClick={() => void sendCmd({ state: "off" })}
        >
          Turn OFF
        </button>
      </div>
      <div className="row">
        <button
          type="button"
          className="btn btn-pay"
          disabled={busy}
          onClick={() =>
            void sendCmd({ state: "on", duration_sec: 30 * 60 })
          }
        >
          Dummy pay — 30 min
        </button>
      </div>

      {err ? <p className="error">{err}</p> : null}

      <div className="card">
        <h2>Last status</h2>
        <pre className="pre">{statusText}</pre>
      </div>
    </>
  );
}
