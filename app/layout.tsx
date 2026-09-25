import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import { SwRegister } from "@/components/SwRegister";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const display = Cinzel({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ring Tracker",
  description: "Tyler's bachelor party leaderboard — report wins, curse the Ringbearer.",
  appleWebApp: { capable: true, title: "Ring Tracker", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0f0d0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <ToastProvider>
          <main className="shell">{children}</main>
          <Nav />
        </ToastProvider>
        <SwRegister />
      </body>
    </html>
  );
}
