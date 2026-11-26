import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { surveySource } from "@/lib/survey/source";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

/* A high-contrast display serif — gives the headings an editorial voice that a
   default sans cannot, and keeps the product from reading as a template. */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["SOFT", "WONK"],
});

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
  themeColor: "#123B2D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-canvas">
        <a
          href="#main"
          className="sr-only-focusable fixed left-4 top-4 z-50 rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-medium text-cream-warm shadow-raised"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
