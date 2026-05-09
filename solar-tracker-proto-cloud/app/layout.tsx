import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Solar Tracker Proto",
  description: "Solar Tracker Proto — cloud remote control",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${sans.className}`}>
      <body>{children}</body>
    </html>
  );
}
