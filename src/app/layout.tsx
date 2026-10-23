import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { CursorField } from "@/components/cursor-field";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Display serif for big titles: the editorial half of the FlowPilot look.
const instrumentSerif = Instrument_Serif({
  variable: "--font-display-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "An AI email agent for property managers: it reads each tenant email, finds the tenant and the lease, and drafts the reply. Nothing is sent until you approve it.";

export const metadata: Metadata = {
  // Absolute base for the Open Graph / Twitter images (src/app/opengraph-image.png).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://flow-pilot-rose.vercel.app"),
  title: { default: "FlowPilot AI", template: "%s · FlowPilot AI" },
  description,
  openGraph: {
    type: "website",
    siteName: "FlowPilot",
    title: "FlowPilot · Tenant email, drafted before you open it",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "FlowPilot · Tenant email, drafted before you open it",
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="en"
        className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <CursorField />
            <ConvexClientProvider>{children}</ConvexClientProvider>
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
