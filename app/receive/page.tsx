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
      // Audio play blocked or not supported
    }
  }, []);

  // Classify file category
  const detectCategory = (filename: string, mimeType: string): "image" | "text" | "audio" | "video" | "other" => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    const mime = mimeType.toLowerCase();

    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
    if (mime.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
    if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "aac", "m4a"].includes(ext)) return "audio";
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("javascript") ||
      ["txt", "md", "json", "js", "ts", "html", "css", "py", "csv", "xml"].includes(ext)
    )
      return "text";

    return "other";
  };

  // Enumerate camera devices
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setCameraDevices(videoInputs);

        const backCam = videoInputs.find(
          (d) => d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("environment")
        );
        if (backCam) {
          setSelectedDeviceId(backCam.deviceId);
        } else if (videoInputs.length > 0) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Device enumeration failed:", err);
      }
    }
    getDevices();
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setHasCameraAccess(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasCameraAccess(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startCamera]);

  // High-frequency jsQR scan loop
  const scanLoop = useCallback(
    (timestamp: number) => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;

        // Calculate Scan FPS
        scanFrameCountRef.current++;
        if (timestamp - scanFpsTimerRef.current >= 1000) {
          setScanFps(scanFrameCountRef.current);
          scanFrameCountRef.current = 0;
          scanFpsTimerRef.current = timestamp;
        }

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
                  const name = result.metadata.name;
                  const cat = detectCategory(name, mime);
                  setFileCategory(cat);

                  // Process ZIP Folder Archive
                  if (mime.includes("zip") || name.endsWith(".zip")) {
                    setIsZipArchive(true);
                    (async () => {
                      try {
                        const arrayBuffer = await result.blob.arrayBuffer();
                        const unzipped = unzipSync(new Uint8Array(arrayBuffer));
                        const entries: ZipEntry[] = [];

                        for (const path in unzipped) {
                          const isDir = path.endsWith("/");
                          const bytes = unzipped[path];
                          const blob = new Blob([bytes.buffer as ArrayBuffer]);
                          const entryUrl = URL.createObjectURL(blob);
                          const entryName = path.split("/").filter(Boolean).pop() || path;
                          const entryCat = detectCategory(entryName, "");

                          let snippet: string | undefined = undefined;
                          if (entryCat === "text" && bytes.length < 20000) {
                            snippet = new TextDecoder().decode(bytes.subarray(0, 1000));
                          }

                          entries.push({
                            path,
                            name: entryName,
                            size: bytes.length,
                            isDir,
                            blob,
                            url: entryUrl,
                            category: entryCat,
                            textSnippet: snippet,
                          });
                        }
                        setZipEntries(entries);
                      } catch (err) {
                        console.error("Failed to unzip archive:", err);
                      }
                    })();
                  } else if (cat === "text") {
                    // Single text file preview snippet
                    result.blob.text().then((txt) => {
                      setTextPreview(txt.slice(0, 3000));
                    });
                  }
                }
              }
            }
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
      if (parts.length === 1) {
        // Direct child file or dir
        if (!entry.isDir) items.push(entry);
      } else if (parts.length > 1) {
        // Subdirectory
        const subDirName = parts[0];
        const subDirPath = currentFolderPrefix + subDirName + "/";
        if (!seenDirs.has(subDirPath)) {
          seenDirs.add(subDirPath);
          items.push({
            path: subDirPath,
            name: subDirName,
            size: 0,
            isDir: true,
            blob: new Blob(),
            url: "",
            category: "other",
          });
        }
      }
    });

    return items;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Camera Viewfinder (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="apple-glass-card rounded-[2.5rem] p-6 space-y-6 border border-white/10 relative overflow-hidden">
            {/* Viewfinder Header Bar */}
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-white font-medium">Optical Scanner</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
                  title="Toggle Audio Feedback"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>

                <button
                  onClick={resetDecoder}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
                  title="Reset Scanner Session"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Video Stream Container */}
            <div className="relative rounded-3xl overflow-hidden bg-black border border-white/10 aspect-video sm:aspect-square flex items-center justify-center">
              {hasCameraAccess === false ? (
                <div className="p-8 text-center space-y-4 max-w-sm">
                  <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Camera Access Denied</h3>
                  <p className="text-xs text-gray-400">
                    Please allow camera permissions in your browser to scan the optical QR stream.
                  </p>
                  <button
                    onClick={startCamera}
                    className="px-6 py-2.5 rounded-full bg-blue-500 text-white font-medium text-xs shadow-lg shadow-blue-500/20"
                  >
                    Retry Permission
                  </button>
                </div>
              ) : (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover rounded-3xl"
                    playsInline
                    muted
                  />

                  {/* Corner Targeting Reticle */}
                  <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-blue-500 rounded-tl-lg pointer-events-none" />
                  <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-blue-500 rounded-tr-lg pointer-events-none" />
                  <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-blue-500 rounded-bl-lg pointer-events-none" />
                  <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-blue-500 rounded-br-lg pointer-events-none" />

                  {/* Scanner FPS Badge */}
                  <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-mono text-gray-300 backdrop-blur">
                    Scan: {scanFps} FPS
                  </div>

                  {/* Completed Viewfinder Overlay */}
                  {isComplete && (
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                      <div className="w-14 h-14 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {isZipArchive ? "Folder Received!" : "File Decoded Successfully!"}
                      </h3>
                      <p className="text-xs font-mono text-gray-300 truncate max-w-[280px]">
                        {fileMeta?.name}
                      </p>

                      {/* Action Buttons: View in App vs Download */}
                      {downloadUrl && (
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            onClick={() => {
                              const el = document.getElementById("received-file-card");
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }}
                            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs border border-white/10 transition-all flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" /> View in App
                          </button>

                          <a
                            href={downloadUrl}
                            download={fileMeta?.name || "downloaded-file"}
                            className="px-6 py-2.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-medium text-xs shadow-lg shadow-blue-500/20 transition-all flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" /> Save File
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera Select Dropdown */}
            {cameraDevices.length > 1 && (
              <div className="pt-2">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  {cameraDevices.map((d, idx) => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-black text-white">
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Progress & Interactive Media Hub / Folder Explorer (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Progress Card */}
          <div className="apple-glass-card rounded-3xl p-6 space-y-5 border border-white/10">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span>Decoding Engine</span>
              </span>
              <span className="text-3xl font-light text-blue-400 tracking-tight">
                {progressPct}%
              </span>
            </div>

            {/* Apple Thin Progress Bar */}
            <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Solved Blocks</span>
                <div className="text-xl font-bold font-mono text-white">
                  {solvedCount} <span className="text-xs text-gray-500 font-normal">/ {totalK}</span>
                </div>
              </div>

              {/* Live Speedometer */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase text-gray-400">
                  <span>Live Speed</span>
                  <span className="text-blue-400 font-semibold">Peak: {peakSpeed}</span>
                </div>
                <div className="text-xl font-bold font-mono text-blue-400">
                  {transferSpeed} <span className="text-xs text-gray-500 font-normal">KB/s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive ZIP Folder Explorer (If Folder Scanned) */}
          {isZipArchive && fileMeta && (
            <div className="apple-glass-card rounded-3xl p-6 space-y-4 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-white font-medium text-sm">
                  <Folder className="w-4 h-4 text-blue-400" /> Folder Explorer
                </div>
                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={fileMeta.name}
                    className="px-4 py-1.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-medium text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" /> Download ZIP
                  </a>
                )}
              </div>

              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-xs font-mono text-gray-400 overflow-x-auto pb-1">
                <button
                  onClick={() => {
                    setCurrentFolderPrefix("");
                    setSelectedFileInZip(null);
                  }}
                  className="hover:text-blue-400 underline font-medium"
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
                        <ChevronRight className="w-3 h-3 text-gray-600" />
                        <button
                          onClick={() => {
                            setCurrentFolderPrefix(prefix);
                            setSelectedFileInZip(null);
                          }}
                          className="hover:text-blue-400 underline"
                        >
                          {folder}
                        </button>
                      </span>
                    );
                  })}
              </div>

              {/* Directory Listing */}
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {getCurrentFolderItems().map((item) => (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (item.isDir) {
                        setCurrentFolderPrefix(item.path);
                        setSelectedFileInZip(null);
                      } else {
                        setSelectedFileInZip(item);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono cursor-pointer transition-all ${
                      selectedFileInZip?.path === item.path
                        ? "bg-blue-500/20 border-blue-500/50 text-white"
                        : "bg-white/5 border-white/5 hover:bg-white/10 text-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {item.isDir ? (
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                      ) : item.category === "image" ? (
                        <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : item.category === "audio" ? (
                        <Music className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : item.category === "video" ? (
                        <Film className="w-4 h-4 text-rose-400 shrink-0" />
                      ) : item.category === "text" ? (
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>

                    {!item.isDir && (
                      <span className="text-[10px] text-gray-500 shrink-0">
                        {(item.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single File Media Hub (If Single File Scanned) */}
          {!isZipArchive && fileMeta && downloadUrl && (
            <div id="received-file-card" className="apple-glass-card rounded-3xl p-6 space-y-4 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-white font-medium text-sm">
                  <FileCheck className="w-4 h-4 text-blue-400" /> Media Hub
                </div>
                <span className="px-3 py-1 rounded-full bg-white/10 text-gray-300 font-mono text-[10px]">
                  {fileCategory.toUpperCase()}
                </span>
              </div>

              {fileCategory === "image" && (
                <div className="p-2 bg-black rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center max-h-64">
                  {/* eslint-disable-next-html-element-suppression */}
                  <img src={downloadUrl} alt="Received Image" className="max-h-60 object-contain rounded-xl" />
                </div>
              )}

              {fileCategory === "audio" && (
                <div className="p-4 bg-black rounded-2xl border border-white/10">
                  <audio controls src={downloadUrl} className="w-full" />
                </div>
              )}

              {fileCategory === "video" && (
                <div className="p-2 bg-black rounded-2xl border border-white/10 overflow-hidden">
                  <video controls src={downloadUrl} className="w-full max-h-64 rounded-xl" />
                </div>
              )}

              {fileCategory === "text" && textPreview && (
                <div className="p-4 bg-black/60 rounded-2xl border border-white/5 font-mono text-xs text-gray-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {textPreview}
                </div>
              )}

              <div className="pt-2">
                <a
                  href={downloadUrl}
                  download={fileMeta.name}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-medium text-xs shadow-lg shadow-blue-500/20 transition-all"
                >
                  <Download className="w-4 h-4" /> Save {fileMeta.name}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
