import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solar Tracker Proto",
  description: "Solar Tracker Proto — cloud remote control",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}