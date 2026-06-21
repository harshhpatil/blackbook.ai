import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlackBook AI - MSBTE Documentation Operating System",
  description:
    "Upload your project. Download your Blackbook. Upload project files and generate complete MSBTE-compliant documentation in minutes.",
  keywords: [
    "MSBTE",
    "Blackbook",
    "Project Report",
    "Documentation",
    "AI",
    "Diploma",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0A0A0A] text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
