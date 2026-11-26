import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { surveySource } from "@/lib/survey/source";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/* The brand is clean and modern rather than editorial, so headings use the same
   family at a heavier weight and tighter tracking instead of a display serif. */

export const metadata: Metadata = {
  title: {
    default: surveySource.form_title,
    template: `%s · ${surveySource.owner}`,
  },
  description:
    "Baseline survey for the Peace and Love Proclaimers school curriculum. Captures each student's starting confidence, skills and values before the PLP programme begins.",
  applicationName: "PLP Survey Platform",
  authors: [{ name: surveySource.owner }],
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1D75BD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={inter.variable}
      // Browser extensions (password managers, writing assistants) inject
      // attributes into <html> before React hydrates, which React otherwise
      // reports as a hydration mismatch. This suppresses that noise on this
      // element only — it does not affect any of our own markup.
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas">
        <a
          href="#main"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-xl bg-plp-700 px-4 py-2.5 text-sm font-medium text-paper-warm shadow-raised"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
