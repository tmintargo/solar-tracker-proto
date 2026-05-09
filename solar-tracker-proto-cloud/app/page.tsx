import { ControlPanel } from "./ControlPanel";
import { HelpTip } from "./HelpTip";
import { LogoutButton } from "./LogoutButton";

export default function Home() {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <img
            className="brand-logo-img"
            src="/brand-logo.png"
            alt=""
            width={160}
            height={48}
          />
          <span className="product-tagline">Solar Tracker Proto</span>
        </div>
        <LogoutButton />
      </header>

      <div className="page-title-row">
        <h1>Remote control</h1>
        <HelpTip
          tip={
            "Path: browser → Vercel → Cloudflare tunnel → Node-RED on your Pi → MQTT → device. Set COMMAND_TUNNEL_URL (HTTPS base, no trailing slash) in Vercel env."
          }
        />
      </div>

      <ControlPanel />

      <footer className="doc-footer">
        <span className="doc-footer-label">MongoDB logging</span>
        <HelpTip
          tip={
            "If MONGODB_URI is set, commands and throttled telemetry snapshots are stored in Atlas (stp_command_events, stp_telemetry_snapshots). TTL on createdAt removes rows after MONGO_EVENT_TTL_SEC (default 86400 = 1 day)."
          }
        />
      </footer>
    </main>
  );
}
