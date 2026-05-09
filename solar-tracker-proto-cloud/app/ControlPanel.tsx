"use client";

import { useCallback, useEffect, useState } from "react";
import { HelpTip } from "./HelpTip";

const STORAGE_DEVICE = "solarTrackerProtoDeviceId";

type LedGuess = "on" | "off" | "unknown";

function guessLedStatus(raw: unknown): LedGuess {
  if (!raw || typeof raw !== "object") return "unknown";
  const o = raw as Record<string, unknown>;

  const readStatus = (obj: Record<string, unknown>): LedGuess => {
    const s = obj.status;
    if (s === "on" || s === "off") return s;
    if (typeof s === "string") {
      const t = s.toLowerCase();
      if (t === "on" || t === "off") return t as LedGuess;
    }
    if (typeof obj.relay === "boolean") return obj.relay ? "on" : "off";
    return "unknown";
  };

  const tel = o.telemetry;
  if (tel && typeof tel === "object") {
    const g = readStatus(tel as Record<string, unknown>);
    if (g !== "unknown") return g;
  }

  return readStatus(o);
}

function clampMinutes(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 1;
  const max = 24 * 60;
  if (n > max) return max;
  return Math.floor(n);
}

export function ControlPanel() {
  const [deviceId, setDeviceId] = useState("xiao-esp32c3");
  const [durationMin, setDurationMin] = useState(30);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("Loading…");
  const [led, setLed] = useState<LedGuess>("unknown");
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
      setLed("unknown");
      return;
    }
    try {
      const r = await fetch(
        `/api/device-status?device_id=${encodeURIComponent(deviceId.trim())}`,
        { cache: "no-store" }
      );
      const text = await r.text();
      try {
        const j = JSON.parse(text) as unknown;
        setStatusText(JSON.stringify(j, null, 2));
        setLed(guessLedStatus(j));
      } catch {
        setStatusText(text || "(empty)");
        setLed("unknown");
      }
    } catch {
      setStatusText("(could not load)");
      setLed("unknown");
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
      const data = (await r.json()) as {
        ok?: boolean;
        upstream?: unknown;
        error?: string;
      };
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

  const badge =
    led === "on"
      ? { cls: "on", label: "Output ON" }
      : led === "off"
        ? { cls: "off", label: "Output OFF" }
        : { cls: "unknown", label: "Unknown" };

  const minutes = clampMinutes(durationMin);
  const timedSeconds = minutes * 60;

  return (
    <div className="control-panel">
      <section className="glass-card">
        <div className="card-head-row">
          <span className={`status-badge ${badge.cls}`}>
            <span className="dot" aria-hidden />
            {badge.label}
          </span>
          <HelpTip
            tip={
              "Shows telemetry.status from the last snapshot Node-RED cached for this device_id (not live MQTT directly)."
            }
          />
        </div>
      </section>

      <section className="glass-card glass-card-pad">
        <div className="field-row-label">
          <label className="field" htmlFor="deviceId">
            Device ID
          </label>
          <HelpTip
            tip={
              "Must match DEVICE_ID in firmware and MQTT topics (e.g. devices/your-id/cmd)."
            }
          />
        </div>
        <input
          id="deviceId"
          className="field"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          autoComplete="off"
          placeholder="xiao-esp32c3"
          spellCheck={false}
        />

        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void sendCmd({ state: "on" })}
          >
            Turn ON
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void sendCmd({ state: "off" })}
          >
            Turn OFF
          </button>
        </div>

        <div className="timed-block">
          <div className="field-row-label">
            <label className="field" htmlFor="durationMin">
              Timed ON (minutes)
            </label>
            <HelpTip
              tip={
                "Sends ON with duration_sec = minutes × 60. Range 1–1440 (24 h). Firmware turns OFF when the window ends."
              }
            />
          </div>
          <div className="timed-row">
            <input
              id="durationMin"
              type="number"
              className="field field-number"
              min={1}
              max={1440}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn btn-outline"
              disabled={busy}
              onClick={() =>
                void sendCmd({
                  state: "on",
                  duration_sec: timedSeconds,
                })
              }
            >
              Apply ({minutes} min)
            </button>
          </div>
        </div>
      </section>

      {err ? <p className="error">{err}</p> : null}

      <section className="glass-card telemetry-card">
        <div className="card-head-row">
          <h2 className="telemetry-title">Telemetry</h2>
          <HelpTip
            tip={
              "Raw JSON returned by Vercel from Node-RED (/api/device/status). Updates every few seconds while this page is open."
            }
          />
        </div>
        <pre className="pre telemetry-pre">{statusText}</pre>
      </section>
    </div>
  );
}
