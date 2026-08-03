import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Radio, Camera } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotonDrop | Optical Fountain QR File Transfer",
  description: "Air-gapped optical data transfer using high-speed animated Fountain QR codes and belief propagation decoding.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body className="min-h-full flex flex-col bg-black text-gray-100 font-sans selection:bg-blue-500 selection:text-white">
        {/* Apple HIG Floating Top Navigation Bar */}
        <header className="sticky top-0 z-50 apple-glass border-b border-white/10 px-4 sm:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            {/* Left: Monochrome SF Symbol Logo & Title */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white group-hover:bg-white/20 transition-all">
                <QrCode className="w-4 h-4 stroke-[1.75]" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">
                PhotonDrop
              </span>
            </Link>

            {/* Right: iOS-Style Segmented Control */}
            <nav className="bg-white/10 p-1 rounded-full border border-white/10 flex items-center gap-1">
              <Link
                href="/transmit"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all text-white bg-white/20 shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 text-blue-400" />
                <span>Sender</span>
              </Link>

              <Link
                href="/receive"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all text-gray-400 hover:text-white hover:bg-white/10"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scanner</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>

        {/* Apple HIG Minimal Footer */}
        <footer className="border-t border-white/5 bg-black py-6 px-4 text-center text-xs text-gray-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              Developed by <span className="text-gray-300 font-medium">Pasindu Gayan</span>
            </div>

            <div className="flex items-center gap-2 text-gray-500">
              <span>60 FPS Engine</span>
              <span>•</span>
              <span>Zero Server</span>
              <span>•</span>
              <span>Optical LT Fountain</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
