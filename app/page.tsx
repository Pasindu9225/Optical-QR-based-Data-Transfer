import Link from "next/link";
import { Radio, ArrowDownLeft, Shield, Zap, Layers, RefreshCw, Cpu, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-12 py-4">
      {/* Hero Banner */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-6 pb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 text-xs font-mono tracking-wide">
          <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400" />
          <span>Fountain QR Optical Air-Gap Transfer</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
          Optical File Transfer via{" "}
          <span className="text-gradient">Fountain Codes</span>
        </h1>

        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
          Transfer any binary file visually between air-gapped devices using animated QR code streams. Powered by Luby Transform (LT) codes for 100% loss-tolerant packet recovery.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/transmit"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-semibold text-lg shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
          >
            <Radio className="w-5 h-5" />
            <span>Transmit File (Sender)</span>
          </Link>

          <Link
            href="/receive"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl glass-card hover:bg-slate-800/80 text-white font-semibold text-lg border border-slate-700/80 transition-all transform hover:-translate-y-0.5"
          >
            <ArrowDownLeft className="w-5 h-5 text-cyan-400" />
            <span>Receive File (Scanner)</span>
          </Link>
        </div>
      </section>

      {/* Protocol Visual Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
          <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-800/50 w-fit text-cyan-400">
            <Radio className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Transmitter Features</h2>
          <ul className="space-y-3 text-slate-300 text-sm">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <span>High-speed canvas rendering loop (up to 30+ FPS).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <span>Systematic chunking followed by infinite XOR parity droplets.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
              <span>Customizable QR payload density & frame rates.</span>
            </li>
          </ul>
          <div className="pt-4">
            <Link
              href="/transmit"
              className="text-cyan-400 font-semibold text-sm hover:underline inline-flex items-center gap-1"
            >
              Open Transmitter →
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-4 relative overflow-hidden group">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/20 transition-all" />
          <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-800/50 w-fit text-indigo-400">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">Receiver Features</h2>
          <ul className="space-y-3 text-slate-300 text-sm">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <span>High-frequency offscreen canvas camera parsing.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <span>Real-time online Belief Propagation (Peeling) solver.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <span>Live progress bar, speed metrics (KB/s), & auto-download trigger.</span>
            </li>
          </ul>
          <div className="pt-4">
            <Link
              href="/receive"
              className="text-indigo-400 font-semibold text-sm hover:underline inline-flex items-center gap-1"
            >
              Open Receiver →
            </Link>
          </div>
        </div>
      </section>

      {/* How Fountain Codes Work */}
      <section className="glass-panel rounded-2xl p-8 space-y-6">
        <h2 className="text-2xl font-bold text-center">How Fountain Code Transfer Works</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-cyan-400 w-fit">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200">1. Chunking & Headering</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Files are parsed into $K$ binary blocks. Header tags sequence numbers and random seeds to pair packet payloads.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400 w-fit">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200">2. Fountain Generation</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The sender emits systematic raw chunks followed by infinite XOR combinations generated via Soliton degree distribution.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 space-y-3">
            <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/40 text-purple-400 w-fit">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-200">3. Belief Propagation</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The receiver peeling algorithm solves linear equations as packets arrive, reconstructing the original file even if frames are dropped.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
