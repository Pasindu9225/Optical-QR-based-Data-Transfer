"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import confetti from "canvas-confetti";
import { FountainDecoder, FileMetadata } from "@/lib/fountain";
import {
  Camera,
  ArrowDownLeft,
  CheckCircle2,
  Download,
  Zap,
  Activity,
  Layers,
  RotateCcw,
  Volume2,
  VolumeX,
  FileCheck,
  AlertCircle,
} from "lucide-react";

export default function ReceivePage() {
  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Decoder State
  const decoderRef = useRef<FountainDecoder>(new FountainDecoder());
  const [progressPct, setProgressPct] = useState<number>(0);
  const [solvedCount, setSolvedCount] = useState<number>(0);
  const [totalK, setTotalK] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [fileMeta, setFileMeta] = useState<FileMetadata | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Performance stats
  const [scanFps, setScanFps] = useState<number>(0);
  const [transferSpeed, setTransferSpeed] = useState<number>(0); // KB/s
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastScannedText, setLastScannedText] = useState<string>("");

  // HTML & Animation Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const bytesReceivedRef = useRef<number>(0);
  const lastPacketTimeRef = useRef<number>(0);
  const scanFrameCountRef = useRef<number>(0);
  const scanFpsTimerRef = useRef<number>(0);

  // Audio Beep generator
  const playBeep = useCallback((freq = 880, type: OscillatorType = "sine") => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio context may be restricted by browser policy
    }
  }, []);

  // Initialize camera list
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setCameraDevices(videoInputs);
        if (videoInputs.length > 0) {
          // Prefer environment / rear camera
          const backCamera = videoInputs.find((d) =>
            d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment")
          );
          setSelectedDeviceId(backCamera ? backCamera.deviceId : videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error enumerating video devices:", err);
      }
    }
    getDevices();
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async (deviceId?: string) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setHasCameraAccess(true);
    } catch (err) {
      console.error("Camera access denied or failed:", err);
      setHasCameraAccess(false);
    }
  }, []);

  useEffect(() => {
    startCamera(selectedDeviceId);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedDeviceId, startCamera]);

  // High Frequency Offscreen Canvas Scanning Loop
  const scanLoop = useCallback(
    (timestamp: number) => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        if (!offscreenCanvasRef.current) {
          offscreenCanvasRef.current = document.createElement("canvas");
        }
        const canvas = offscreenCanvasRef.current;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (qrCode && qrCode.data) {
            const rawData = qrCode.data;

            // Avoid re-ingesting exact same frame in rapid succession
            if (rawData !== lastScannedText || timestamp - lastPacketTimeRef.current > 150) {
              lastPacketTimeRef.current = timestamp;
              setLastScannedText(rawData);

              const decoder = decoderRef.current;
              const progressMade = decoder.ingest(rawData);

              if (progressMade) {
                if (soundEnabled) playBeep(880, "sine");
              }

              // Update stats
              setSolvedCount(decoder.decodedBlocks.size);
              setTotalK(decoder.totalChunks);
              setProgressPct(decoder.progressPercentage);
              setDuplicateCount(decoder.duplicateCount);
              setProcessedCount(decoder.totalPacketsProcessed);

              if (!startTimeRef.current && decoder.totalChunks > 0) {
                startTimeRef.current = timestamp;
              }

              // Track transfer speed
              if (startTimeRef.current) {
                const elapsedSeconds = (timestamp - startTimeRef.current) / 1000;
                if (elapsedSeconds > 0) {
                  // Rough estimation based on payload size
                  const totalBytes = decoder.decodedBlocks.size * 300;
                  bytesReceivedRef.current = totalBytes;
                  setTransferSpeed(Math.round((totalBytes / 1024) / elapsedSeconds));
                }
              }

              // Check if completed
              if (decoder.isComplete && !isComplete) {
                setIsComplete(true);
                if (soundEnabled) playBeep(1200, "triangle");
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

                const result = decoder.reconstruct();
                if (result) {
                  setFileMeta(result.metadata);
                  const url = URL.createObjectURL(result.blob);
                  setDownloadUrl(url);

                  // Automatic anchor download
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = result.metadata.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }
            }
          }

          // Scan FPS counter
          scanFrameCountRef.current++;
          if (timestamp - scanFpsTimerRef.current >= 1000) {
            setScanFps(scanFrameCountRef.current);
            scanFrameCountRef.current = 0;
            scanFpsTimerRef.current = timestamp;
          }
        }
      }

      if (!isComplete) {
        animFrameRef.current = requestAnimationFrame(scanLoop);
      }
    },
    [isComplete, lastScannedText, playBeep, soundEnabled]
  );

  useEffect(() => {
    if (hasCameraAccess && !isComplete) {
      scanFpsTimerRef.current = performance.now();
      scanFrameCountRef.current = 0;
      animFrameRef.current = requestAnimationFrame(scanLoop);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [hasCameraAccess, isComplete, scanLoop]);

  const resetDecoder = () => {
    decoderRef.current = new FountainDecoder();
    setProgressPct(0);
    setSolvedCount(0);
    setTotalK(0);
    setDuplicateCount(0);
    setProcessedCount(0);
    setIsComplete(false);
    setFileMeta(null);
    setDownloadUrl(null);
    startTimeRef.current = null;
    setTransferSpeed(0);
    setLastScannedText("");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-indigo-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <ArrowDownLeft className="w-4 h-4" />
            <span>Optic Receiver Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Fountain QR Scanner</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 rounded-xl glass-card hover:bg-slate-800 text-slate-300 border border-slate-700/60"
            title={soundEnabled ? "Mute Decode Beep" : "Enable Decode Beep"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={resetDecoder}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-card hover:bg-slate-800 text-slate-200 border border-slate-700/60 font-medium text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Scanner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Camera Stream Viewfinder (Left) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-4 rounded-2xl glow-purple relative overflow-hidden flex flex-col items-center justify-center">
            {hasCameraAccess === false ? (
              <div className="p-12 text-center space-y-4 max-w-md">
                <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                <h3 className="text-lg font-semibold text-rose-300">Camera Access Denied</h3>
                <p className="text-xs text-slate-400">
                  Please allow camera permission in your browser settings to scan Fountain QR codes.
                </p>
                <button
                  onClick={() => startCamera(selectedDeviceId)}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs"
                >
                  Retry Camera Connection
                </button>
              </div>
            ) : (
              <div className="relative w-full max-w-[480px] aspect-square rounded-xl overflow-hidden bg-black border-2 border-indigo-500/40 shadow-2xl">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Laser Scanning Overlay Line */}
                {!isComplete && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#38bdf8] animate-scan-line z-10 pointer-events-none" />
                )}

                {/* Corner Targeting Reticle */}
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

                {/* Live Scanner FPS Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 font-mono text-[10px] text-cyan-300 backdrop-blur">
                  Scan: {scanFps} FPS
                </div>

                {isComplete && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                    <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-100">File Received Successfully!</h3>
                    <p className="text-xs font-mono text-cyan-300">{fileMeta?.name}</p>
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download={fileMeta?.name || "downloaded-file"}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all"
                      >
                        <Download className="w-4 h-4" /> Download Reconstructed File
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Camera Input Selector Dropdown */}
            {cameraDevices.length > 1 && (
              <div className="w-full max-w-[480px] pt-4">
                <label className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mb-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-400" /> Select Video Camera Device:
                </label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {cameraDevices.map((d, idx) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Decoder Status & Belief Propagation Heatmap (Right) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Progress Bar Card */}
          <div className="glass-card p-6 rounded-2xl space-y-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Activity className="w-4 h-4 text-cyan-400" /> Decoding Progress
              </span>
              <span className="text-xl font-bold font-mono text-cyan-400">
                {progressPct}%
              </span>
            </div>

            <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Solved Blocks</span>
                <div className="text-lg font-bold font-mono text-slate-100">
                  {solvedCount} <span className="text-xs text-slate-500">/ {totalK}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Transfer Speed</span>
                <div className="text-lg font-bold font-mono text-indigo-400">
                  {transferSpeed} <span className="text-xs text-slate-500">KB/s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Statistics List */}
          <div className="glass-card p-5 rounded-xl space-y-3 font-mono text-xs text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" /> Scanned Packets:
              </span>
              <span className="text-slate-100 font-bold">{processedCount}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-slate-400">Redundant / Dropped:</span>
              <span className="text-amber-400 font-bold">{duplicateCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Equations Pending:</span>
              <span className="text-cyan-400 font-bold">
                {decoderRef.current.pendingEquations.length}
              </span>
            </div>
          </div>

          {/* Block Matrix Grid Heatmap */}
          {totalK > 0 && (
            <div className="glass-card p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Block Recovery Grid
                </span>
                <span>{solvedCount} / {totalK}</span>
              </div>

              <div className="grid grid-cols-10 sm:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-900">
                {Array.from({ length: totalK }).map((_, idx) => {
                  const isSolved = decoderRef.current.decodedBlocks.has(idx);
                  return (
                    <div
                      key={idx}
                      title={`Block #${idx}: ${isSolved ? "Solved" : "Pending"}`}
                      className={`aspect-square rounded-[3px] transition-all duration-200 ${
                        isSolved
                          ? "bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] scale-100"
                          : "bg-slate-800 border border-slate-700/50 scale-90"
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed File Result Card */}
          {fileMeta && (
            <div className="glass-card p-5 rounded-xl space-y-3 border border-emerald-500/30 bg-emerald-950/20">
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-xs">
                <FileCheck className="w-4 h-4" /> Ready for Download
              </div>

              <div className="space-y-1 text-xs font-mono text-slate-300">
                <div className="truncate">
                  <span className="text-slate-500">File: </span>
                  <span className="text-white font-bold">{fileMeta.name}</span>
                </div>
                <div>
                  <span className="text-slate-500">Size: </span>
                  <span>{(fileMeta.size / 1024).toFixed(2)} KB</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
