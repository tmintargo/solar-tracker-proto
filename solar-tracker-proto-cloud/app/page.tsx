import { ControlPanel } from "./ControlPanel";
import { LogoutButton } from "./LogoutButton";

export default function Home() {
  return (
    <main>
      <div className="toolbar">
        <LogoutButton />
      </div>

      <div className="brand-row">
        {/* Add Kilat logo as public/brand-logo.png in this Next.js app */}
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

      <p className="hint" style={{ marginTop: 24 }}>
        Event logging (optional): <code>POST /api/events</code> +{" "}
        <code>x-internal-secret</code>
      </p>
    </main>
  );
}
