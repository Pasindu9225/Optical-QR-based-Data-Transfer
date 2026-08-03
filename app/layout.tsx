import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Radio, ArrowDownLeft, ShieldCheck, Zap } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotonDrop | High-Speed Optical Fountain QR File Transfer",
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
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white">
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-3 sm:px-8 py-2.5 sm:py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 group-hover:scale-105 transition-transform shadow-lg shadow-cyan-500/20">
                <QrCode className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-gradient">
                  PhotonDrop
                </span>
                <span className="hidden md:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                  Fountain LT
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-1.5 sm:gap-3">
              <Link
                href="/transmit"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 border border-slate-700/60 transition-all font-medium text-xs sm:text-sm"
              >
                <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-pulse" />
                <span>Sender</span>
              </Link>

              <Link
                href="/receive"
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs sm:text-sm shadow-md shadow-cyan-500/20 transition-all"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Scanner</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 overflow-x-hidden">
          {children}
        </main>

        {/* Responsive Mobile Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/90 py-4 sm:py-6 px-3 sm:px-4 text-center text-slate-500 text-xs">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Air-Gapped Optical Transfer</span>
            </div>

            <div className="text-[11px] sm:text-xs font-mono text-slate-400">
              Developed by <span className="text-cyan-400 font-bold hover:underline">Pasindu Gayan</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> 60 FPS Turbo Mode
              </span>
              <span>•</span>
              <span>Zero Server Required</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
