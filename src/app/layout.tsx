import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "ResTix: campus ticket exchange", template: "%s · ResTix" },
  description:
    "Spare a fest wristband or need one? ResTix lets verified students list and find tickets for campus events, without the WhatsApp-group chaos.",
  applicationName: "ResTix",
  // Private by default; public pages opt back in to indexing.
  robots: { index: false, follow: false },
  openGraph: { siteName: "ResTix", type: "website", locale: "en_IN" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={dmSans.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
