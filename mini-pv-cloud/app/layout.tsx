import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mini PV cloud log",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: "1rem" }}>{children}</body>
    </html>
  );
}
