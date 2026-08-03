"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import confetti from "canvas-confetti";
import { unzipSync } from "fflate";
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
  Eye,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  Folder,
  ChevronRight,
  File,
} from "lucide-react";

export interface ZipEntry {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  blob: Blob;
  url: string;
  category: "image" | "text" | "audio" | "video" | "other";
  textSnippet?: string;
}

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

  // Single File Preview State
  const [fileCategory, setFileCategory] = useState<"image" | "text" | "audio" | "video" | "other">("other");
  const [textPreview, setTextPreview] = useState<string | null>(null);

  // ZIP / Folder Explorer State
  const [isZipArchive, setIsZipArchive] = useState<boolean>(false);
  const [zipEntries, setZipEntries] = useState<ZipEntry[]>([]);
  const [currentFolderPrefix, setCurrentFolderPrefix] = useState<string>("");
  const [selectedFileInZip, setSelectedFileInZip] = useState<ZipEntry | null>(null);

  // Performance stats & Live Speedometer
  const [scanFps, setScanFps] = useState<number>(0);
  const [transferSpeed, setTransferSpeed] = useState<number>(0); // Live KB/s
  const [peakSpeed, setPeakSpeed] = useState<number>(0); // Peak KB/s
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastScannedText, setLastScannedText] = useState<string>("");

  const recentBytesRef = useRef<Array<{ time: number; bytes: number }>>([]);

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
      // Audio context policy
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

  // Helper to categorize MIME / Extension
  const getCategory = (filename: string, mime: string) => {
    const m = mime.toLowerCase();
    const n = filename.toLowerCase();
    if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) return "image";
    if (m.startsWith("text/") || /\.(txt|json|md|csv|html|xml|js|ts|css|py)$/.test(n)) return "text";
    if (m.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/.test(n)) return "audio";
    if (m.startsWith("video/") || /\.(mp4|webm|mov)$/.test(n)) return "video";
    return "other";
  };

  // High Frequency Scanning Loop
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

            if (rawData !== lastScannedText || timestamp - lastPacketTimeRef.current > 16) {
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

              // Real-time Sliding Window Speedometer (1.5 second rolling window)
              const approxBytes = rawData.length * 0.75;
              recentBytesRef.current.push({ time: timestamp, bytes: approxBytes });

              const cutoff = timestamp - 1500;
              recentBytesRef.current = recentBytesRef.current.filter((item) => item.time >= cutoff);

              const totalRecentBytes = recentBytesRef.current.reduce((acc, item) => acc + item.bytes, 0);
              const liveKBps = parseFloat(((totalRecentBytes / 1024) / 1.5).toFixed(1));

              setTransferSpeed(liveKBps);
              setPeakSpeed((prev) => Math.max(prev, liveKBps));

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

                  const mime = result.metadata.type.toLowerCase();
                  const name = result.metadata.name.toLowerCase();

                  // Check if file is ZIP Folder Archive
                  if (mime.includes("zip") || name.endsWith(".zip")) {
                    setIsZipArchive(true);
                    result.blob.arrayBuffer().then((ab) => {
                      const u8 = new Uint8Array(ab);
                      try {
                        const unzipped = unzipSync(u8);
                        const entries: ZipEntry[] = [];
                        Object.keys(unzipped).forEach((path) => {
                          const fileData = unzipped[path];
                          const isDir = path.endsWith("/");
                          const filename = path.split("/").filter(Boolean).pop() || path;
                          const fileBlob = new Blob([fileData]);
                          const fileUrl = URL.createObjectURL(fileBlob);
                          const category = getCategory(filename, "");

                          let snippet: string | undefined;
                          if (category === "text" && fileData.length < 50000) {
                            snippet = new TextDecoder().decode(fileData).slice(0, 1000);
                          }

                          entries.push({
                            path,
                            name: filename,
                            size: fileData.length,
                            isDir,
                            blob: fileBlob,
                            url: fileUrl,
                            category,
                            textSnippet: snippet,
                          });
                        });
                        setZipEntries(entries);
                      } catch (err) {
                        console.error("Failed to unzip folder archive:", err);
                      }
                    });
                  } else {
                    // Single file
                    setIsZipArchive(false);
                    const cat = getCategory(name, mime);
                    setFileCategory(cat);
                    if (cat === "text") {
                      result.blob.text().then((txt) => setTextPreview(txt.slice(0, 1000)));
                    }
                  }
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
    setFileCategory("other");
    setTextPreview(null);
    setIsZipArchive(false);
    setZipEntries([]);
    setCurrentFolderPrefix("");
    setSelectedFileInZip(null);
    startTimeRef.current = null;
    recentBytesRef.current = [];
    setTransferSpeed(0);
    setPeakSpeed(0);
    setLastScannedText("");
  };

  // Filter ZIP entries by current folder path prefix
  const getCurrentFolderItems = () => {
    const items: ZipEntry[] = [];
    const seenDirs = new Set<string>();

    zipEntries.forEach((entry) => {
      if (!entry.path.startsWith(currentFolderPrefix)) return;
      const relative = entry.path.slice(currentFolderPrefix.length);
      if (!relative) return;

      const parts = relative.split("/").filter(Boolean);
      if (parts.length > 1) {
        // Subdirectory
        const dirName = parts[0];
        const dirPath = currentFolderPrefix + dirName + "/";
        if (!seenDirs.has(dirPath)) {
          seenDirs.add(dirPath);
          items.push({
            path: dirPath,
            name: dirName,
            size: 0,
            isDir: true,
            blob: new Blob(),
            url: "",
            category: "other",
          });
        }
      } else if (parts.length === 1 && !entry.isDir) {
        // File in current dir
        items.push(entry);
      }
    });

    return items;
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

                {/* Completed Viewfinder Overlay with In-Window Media Viewer */}
                {isComplete && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-3 z-20 overflow-y-auto">
                    <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                      <CheckCircle2 className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-100">
                      {isZipArchive ? "Folder Received!" : "File Decoded Successfully!"}
                    </h3>
                    <p className="text-xs font-mono text-cyan-300 truncate max-w-[240px] sm:max-w-[280px]">
                      {fileMeta?.name}
                    </p>

                    {/* Single File Image Preview */}
                    {!isZipArchive && fileCategory === "image" && downloadUrl && (
                      <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-xl max-h-36 overflow-hidden flex items-center justify-center">
                        {/* eslint-disable-next-html-element-suppression */}
                        <img
                          src={downloadUrl}
                          alt="Preview"
                          className="max-h-32 object-contain rounded-lg shadow-md"
                        />
                      </div>
                    )}

                    {/* Single File Audio Preview */}
                    {!isZipArchive && fileCategory === "audio" && downloadUrl && (
                      <div className="w-full max-w-[260px] p-2 bg-slate-900 rounded-xl border border-slate-800">
                        <audio controls src={downloadUrl} className="w-full h-8" />
                      </div>
                    )}

                    {/* Action Buttons: View in App vs Download */}
                    {downloadUrl && (
                      <div className="flex flex-col xs:flex-row items-center gap-2 pt-1 w-full justify-center">
                        <button
                          onClick={() => {
                            const el = document.getElementById("received-file-card");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="w-full xs:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs border border-slate-700/80 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> View in App
                        </button>

                        <a
                          href={downloadUrl}
                          download={fileMeta?.name || "downloaded-file"}
                          className="w-full xs:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/30 transition-all"
                        >
                          <Download className="w-3.5 h-3.5" /> Save File
                        </a>
                      </div>
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

        {/* Right Column: Progress & Interactive Media Hub / Folder Explorer */}
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

              {/* Live Sliding-Window Speedometer Widget */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1 relative overflow-hidden">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-500">
                  <span className="flex items-center gap-1">
                    <Zap className={`w-3 h-3 text-amber-400 ${transferSpeed > 0 ? "animate-pulse" : ""}`} />
                    Live Speed
                  </span>
                  <span className="text-cyan-400 font-semibold">Peak: {peakSpeed}</span>
                </div>

                <div className="text-lg font-bold font-mono text-cyan-300">
                  {transferSpeed} <span className="text-xs text-slate-500 font-normal">KB/s</span>
                </div>

                {/* Live Gauge Progress Bar */}
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60 mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 transition-all duration-200"
                    style={{ width: `${Math.min(100, (transferSpeed / 120) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Interactive ZIP Folder Explorer (If Folder Scanned) */}
          {isZipArchive && fileMeta && (
            <div className="glass-card p-5 rounded-xl space-y-4 border border-cyan-500/40 bg-slate-900/80 glow-cyan">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                  <Folder className="w-4 h-4 text-amber-400" /> Interactive Folder Explorer
                </div>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={fileMeta.name}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-mono text-[11px]"
                  >
                    <Download className="w-3 h-3" /> Download ZIP
                  </a>
                )}
              </div>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-xs font-mono text-slate-400 overflow-x-auto pb-1">
                <button
                  onClick={() => {
                    setCurrentFolderPrefix("");
                    setSelectedFileInZip(null);
                  }}
                  className="hover:text-cyan-400 underline font-semibold"
                >
                  Root
                </button>
                {currentFolderPrefix
                  .split("/")
                  .filter(Boolean)
                  .map((folder, idx, arr) => {
                    const prefix = arr.slice(0, idx + 1).join("/") + "/";
                    return (
                      <span key={prefix} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-slate-600" />
                        <button
                          onClick={() => {
                            setCurrentFolderPrefix(prefix);
                            setSelectedFileInZip(null);
                          }}
                          className="hover:text-cyan-400 underline"
                        >
                          {folder}
                        </button>
                      </span>
                    );
                  })}
              </div>

              {/* Folder Item Grid List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {getCurrentFolderItems().map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-900 text-xs font-mono transition-colors"
                  >
                    {item.isDir ? (
                      <button
                        onClick={() => {
                          setCurrentFolderPrefix(item.path);
                          setSelectedFileInZip(null);
                        }}
                        className="flex items-center gap-2 text-amber-300 hover:text-amber-200 font-medium truncate"
                      >
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">{item.name} /</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedFileInZip(item)}
                        className="flex items-center gap-2 text-slate-200 hover:text-cyan-400 truncate text-left"
                      >
                        <File className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </button>
                    )}

                    {!item.isDir && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-500">
                          {(item.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          onClick={() => setSelectedFileInZip(item)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300"
                          title="Preview in Window"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={item.url}
                          download={item.name}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400"
                          title="Download File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* In-Zip File Preview Panel */}
              {selectedFileInZip && (
                <div className="p-3 bg-slate-950 rounded-xl border border-indigo-500/40 space-y-3 pt-3">
                  <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
                    <span className="flex items-center gap-1.5 truncate">
                      <Eye className="w-3.5 h-3.5 text-cyan-400" /> Previewing: {selectedFileInZip.name}
                    </span>
                    <button
                      onClick={() => setSelectedFileInZip(null)}
                      className="text-slate-500 hover:text-slate-300 text-[10px]"
                    >
                      Close Preview
                    </button>
                  </div>

                  {selectedFileInZip.category === "image" && (
                    <div className="p-2 bg-slate-900 rounded-lg flex justify-center">
                      {/* eslint-disable-next-html-element-suppression */}
                      <img src={selectedFileInZip.url} alt={selectedFileInZip.name} className="max-h-48 object-contain rounded" />
                    </div>
                  )}

                  {selectedFileInZip.category === "text" && selectedFileInZip.textSnippet && (
                    <pre className="p-3 bg-slate-900 rounded-lg text-[11px] font-mono text-emerald-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                      {selectedFileInZip.textSnippet}
                    </pre>
                  )}

                  {selectedFileInZip.category === "audio" && (
                    <audio controls src={selectedFileInZip.url} className="w-full h-8" />
                  )}

                  {selectedFileInZip.category === "video" && (
                    <video controls src={selectedFileInZip.url} className="w-full max-h-48 rounded object-contain" />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Single File Media Hub (If Single File Scanned) */}
          {!isZipArchive && fileMeta && downloadUrl && (
            <div id="received-file-card" className="glass-card p-5 rounded-xl space-y-4 border border-emerald-500/40 bg-emerald-950/20 glow-cyan">
              <div className="flex items-center justify-between border-b border-emerald-800/40 pb-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <FileCheck className="w-4 h-4" /> Received Media Viewer
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono text-emerald-300">
                  {fileCategory.toUpperCase()}
                </span>
              </div>

              {/* In-Window Media Viewer */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> File Preview:
                </div>

                {fileCategory === "image" && (
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-html-element-suppression */}
                    <img
                      src={downloadUrl}
                      alt={fileMeta.name}
                      className="max-h-56 w-auto object-contain rounded-lg shadow-lg border border-slate-800"
                    />
                  </div>
                )}

                {fileCategory === "text" && textPreview !== null && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mb-1">
                      <FileText className="w-3 h-3 text-emerald-400" /> Snippet Content:
                    </div>
                    <pre className="max-h-40 overflow-y-auto text-[11px] font-mono text-emerald-300 break-all whitespace-pre-wrap">
                      {textPreview}
                    </pre>
                  </div>
                )}

                {fileCategory === "audio" && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-indigo-300">
                      <Music className="w-4 h-4 text-cyan-400" /> In-Window Audio Player
                    </div>
                    <audio controls src={downloadUrl} className="w-full h-9 rounded" />
                  </div>
                )}

                {fileCategory === "video" && (
                  <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-indigo-300 mb-2">
                      <Film className="w-4 h-4 text-purple-400" /> In-Window Video Player
                    </div>
                    <video controls src={downloadUrl} className="w-full max-h-48 rounded-lg object-contain" />
                  </div>
                )}

                {fileCategory === "other" && (
                  <div className="p-3 sm:p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3 overflow-hidden">
                    <div className="p-2.5 sm:p-3 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 shrink-0">
                      <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="space-y-0.5 text-xs font-mono min-w-0 flex-1 overflow-hidden">
                      <div className="text-slate-100 font-bold truncate">
                        {fileMeta.name}
                      </div>
                      <div className="text-slate-400 text-[10px] break-all leading-tight max-h-12 overflow-y-auto">
                        Type: {fileMeta.type || "binary"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* File Metadata & Manual Download Button */}
              <div className="space-y-1.5 text-xs font-mono text-slate-300 pt-1">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">File Name:</span>
                  <span className="text-white font-bold truncate text-right max-w-[180px] sm:max-w-xs">{fileMeta.name}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 shrink-0">File Size:</span>
                  <span className="text-slate-200">{(fileMeta.size / 1024).toFixed(2)} KB</span>
                </div>
              </div>

              <a
                href={downloadUrl}
                download={fileMeta.name}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all text-center leading-snug"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">Save / Download File</span>
              </a>
            </div>
          )}

          {/* Block Matrix Grid Heatmap */}
          {totalK > 0 && (
            <div className="glass-card p-4 sm:p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Block Recovery Grid
                </span>
                <span>{solvedCount} / {totalK}</span>
              </div>

              <div className="grid grid-cols-8 xs:grid-cols-10 sm:grid-cols-12 gap-1 max-h-36 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-900">
                {Array.from({ length: totalK }).map((_, idx) => {
                  const isSolved = decoderRef.current.decodedBlocks.has(idx);
                  return (
                    <div
                      key={idx}
                      title={`Block #${idx}: ${isSolved ? "Solved" : "Pending"}`}
                      className={`aspect-square rounded-[2px] transition-all duration-200 ${
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
        </div>
      </div>
    </div>
  );
}
