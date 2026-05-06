import { ControlPanel } from "./ControlPanel";
import { LogoutButton } from "./LogoutButton";

export default function Home() {
  return (
    <main>
      <div className="toolbar">
        <LogoutButton />
      </div>

      <h1>Mini solar PV system</h1>

      <ControlPanel />

      <p className="hint" style={{ marginTop: 24 }}>
        Logging API (Node-RED): <code>POST /api/events</code> +{" "}
        <code>x-internal-secret</code> — unchanged.
      </p>
    </main>
  );
}
