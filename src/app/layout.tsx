import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Personal CRM", description: "A local-first CRM for contacts, deals and follow-ups." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
