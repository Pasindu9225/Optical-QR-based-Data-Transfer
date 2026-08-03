import Link from "next/link";
import { Radio, Camera, Layers, RefreshCw, Cpu, CheckCircle2, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-12 py-6 max-w-6xl mx-auto">
      {/* Hero Banner */}
      <section className="text-center space-y-6 max-w-3xl mx-auto pt-8 pb-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-gray-300 text-xs font-mono tracking-wide">
          <Zap className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
          <span>Air-Gapped Optical LT Fountain Transfer</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-semibold text-white tracking-tight leading-tight">
          Optical File Transfer via <span className="text-blue-400">Fountain Codes</span>
        </h1>

        <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          Transfer any binary file visually between air-gapped devices using animated QR code streams. Powered by Luby Transform (LT) codes for 100% loss-tolerant packet recovery.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/transmit"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-medium text-base shadow-lg shadow-blue-500/20 transition-all"
          >
            <Radio className="w-4 h-4" />
            <span>Transmit File (Sender)</span>
          </Link>

          <Link
            href="/receive"
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-base border border-white/10 transition-all"
          >
            <Camera className="w-4 h-4 text-blue-400" />
            <span>Receive File (Scanner)</span>
          </Link>
        </div>
      </section>

      {/* Protocol Visual Matrix */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="apple-glass-card rounded-[2.5rem] p-8 space-y-4 border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-blue-400">
            <Radio className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Transmitter Engine</h2>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>High-speed requestAnimationFrame QR canvas loop (30-60 FPS).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>Built-in GZIP Deflate compression for 8x-10x document transfer speedup.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>Systematic chunking followed by infinite XOR parity droplets.</span>
            </li>
          </ul>
          <div className="pt-4">
            <Link
              href="/transmit"
              className="text-blue-400 font-medium text-sm hover:underline inline-flex items-center gap-1"
            >
              Open Transmitter →
            </Link>
          </div>
        </div>

        <div className="apple-glass-card rounded-[2.5rem] p-8 space-y-4 border border-white/10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-blue-400">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold text-white tracking-tight">Receiver Engine</h2>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>High-frequency offscreen canvas camera frame parser (jsQR).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>Real-time online Belief Propagation (Peeling) linear solver.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span>Live sliding-window speedometer with peak KB/s rate tracking.</span>
            </li>
          </ul>
          <div className="pt-4">
            <Link
              href="/receive"
              className="text-blue-400 font-medium text-sm hover:underline inline-flex items-center gap-1"
            >
              Open Receiver →
            </Link>
          </div>
        </div>
      </section>

      {/* How Fountain Codes Work */}
      <section className="apple-glass-card rounded-[2.5rem] p-8 sm:p-10 space-y-6 border border-white/10">
        <h2 className="text-2xl font-semibold text-white text-center tracking-tight">How Fountain Code Transfer Works</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">1. Deflate & Chunking</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              Files are compressed with GZIP Deflate and parsed into $K$ binary blocks. Headers seed random pseudo-indexing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">2. Fountain Stream</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              The sender emits systematic raw chunks followed by infinite XOR combinations generated via Soliton degree distribution.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white">3. Belief Propagation</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              The receiver peeling algorithm solves linear equations as packets arrive, reconstructing the original file even if frames are dropped.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
