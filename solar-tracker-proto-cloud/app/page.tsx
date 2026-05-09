import { ControlPanel } from "./ControlPanel";
import { LogoutButton } from "./LogoutButton";

export default function Home() {
  return (
    <main className="app-shell">
      <div className="toolbar">
        <LogoutButton />
      </div>

      <div className="brand-row">
        <img
          className="brand-logo-img"
          src="/brand-logo.png"
          alt=""
          width={160}
          height={48}
        />
        <span className="product-tagline">Solar Tracker Proto</span>
      </div>

      <h1>Remote control</h1>

      <ControlPanel />

      <p className="hint doc-footer">
        The dashboard reads live data from Node-RED on your Pi. When <code>MONGODB_URI</code> is
        set, successful calls also append to Atlas collections <code>stp_command_events</code> and{" "}
        <code>stp_telemetry_snapshots</code> (telemetry is throttled per device). MongoDB TTL removes
        those documents automatically after <code>MONGO_EVENT_TTL_SEC</code> (default one day).
      </p>
    </main>
  );
}
