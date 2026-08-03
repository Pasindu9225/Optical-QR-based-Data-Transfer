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
        <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 group-hover:scale-105 transition-transform shadow-lg shadow-cyan-500/20">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-gradient">
                  PhotonDrop
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/50">
                  Fountain LT v1.0
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/transmit"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/70 hover:bg-slate-800 text-slate-200 hover:text-cyan-400 border border-slate-700/60 transition-all font-medium text-sm"
              >
                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span>Transmitter</span>
              </Link>

              <Link
                href="/receive"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/35 transition-all"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Receiver</span>
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/90 py-6 px-4 text-center text-slate-500 text-sm">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Air-Gapped Optical Data Transfer Protocol</span>
            </div>

            <div className="text-xs font-mono text-slate-400">
              Developed by <span className="text-cyan-400 font-bold hover:underline">Pasindu Gayan</span>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> 60 FPS Turbo Mode
              </span>
              <span>•</span>
              <span>Zero External Server Connection Required</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
