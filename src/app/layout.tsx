import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  // DM Sans is variable: no weight list means one font file instead of four.
  display: "swap",
});

// The display face: the logo and the big headings. Also variable, so one file.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Optical sizing is what makes it tight and punchy at headline sizes.
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "ResTix: the student ticket exchange", template: "%s · ResTix" },
  description:
    "Spare a ticket or need one? ResTix lets verified students trade tickets for fests, gigs and events. Your number stays private until you accept a buyer.",
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
    <html lang="en-IN" className={`${dmSans.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
