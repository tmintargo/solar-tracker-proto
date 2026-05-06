import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mini PV cloud",
  description: "Mini solar PV — remote control",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#0f1419",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
