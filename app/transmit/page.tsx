"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { zipSync } from "fflate";
import { FountainEncoder, FileMetadata } from "@/lib/fountain";
import {
  Upload,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sliders,
  FileText,
  Copy,
  Check,
  Zap,
  Radio,
  Info,
  Folder,
  FileUp,
} from "lucide-react";

export default function TransmitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [encoder, setEncoder] = useState<FountainEncoder | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Animation Controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [targetFps, setTargetFps] = useState<number>(30);
  const [chunkSize, setChunkSize] = useState<number>(450);
  const [currentSeq, setCurrentSeq] = useState<number>(0);
  const [actualFps, setActualFps] = useState<number>(0);
  const [speedPreset, setSpeedPreset] = useState<"safe" | "turbo" | "hyper">("turbo");

  // Debug & UI state
  const [copied, setCopied] = useState<boolean>(false);
  const [currentPacketText, setCurrentPacketText] = useState<string>("");

  // Refs for performance loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(0);
  const seqRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  const targetFpsRef = useRef<number>(30);

  // Keep refs updated for animation loop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    targetFpsRef.current = targetFps;
  }, [isPlaying, targetFps]);

  // Handle Single File Upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    const metadata: FileMetadata = {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type || "application/octet-stream",
    };
    setFileMetadata(metadata);

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        const uint8Array = new Uint8Array(arrayBuffer);
        const newEncoder = new FountainEncoder(uint8Array, metadata, chunkSize);
        setEncoder(newEncoder);
        seqRef.current = 0;
        setCurrentSeq(0);
        setIsPlaying(true);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  // Handle Entire Folder Upload (Zips folder recursively)
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    const filesArray = Array.from(filesList);
    const folderName = filesArray[0].webkitRelativePath.split("/")[0] || "folder";

    const zipData: Record<string, Uint8Array> = {};
    for (const f of filesArray) {
      const relPath = f.webkitRelativePath || f.name;
      const buf = new Uint8Array(await f.arrayBuffer());
      zipData[relPath] = buf;
    }

    const zippedBytes = zipSync(zipData);
    const mockFile = new File([zippedBytes], `${folderName}.zip`, { type: "application/zip" });
    setFile(mockFile);

    const metadata: FileMetadata = {
      name: `${folderName}.zip`,
      size: zippedBytes.length,
      type: "application/zip",
    };
    setFileMetadata(metadata);

    const newEncoder = new FountainEncoder(zippedBytes, metadata, chunkSize);
    setEncoder(newEncoder);
    seqRef.current = 0;
    setCurrentSeq(0);
    setIsPlaying(true);
  };

  // Drag and Drop Event Handlers
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    if (droppedFiles.length === 1) {
      const singleFile = droppedFiles[0];
      setFile(singleFile);
      const metadata: FileMetadata = {
        name: singleFile.name,
        size: singleFile.size,
        type: singleFile.type || "application/octet-stream",
      };
      setFileMetadata(metadata);

      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        if (arrayBuffer) {
          const uint8Array = new Uint8Array(arrayBuffer);
          const newEncoder = new FountainEncoder(uint8Array, metadata, chunkSize);
          setEncoder(newEncoder);
          seqRef.current = 0;
          setCurrentSeq(0);
          setIsPlaying(true);
        }
      };
      reader.readAsArrayBuffer(singleFile);
    } else {
      const zipData: Record<string, Uint8Array> = {};
      for (const f of droppedFiles) {
        const buf = new Uint8Array(await f.arrayBuffer());
        zipData[f.name] = buf;
      }
      const zippedBytes = zipSync(zipData);
      const mockFile = new File([zippedBytes], "dropped_files.zip", { type: "application/zip" });
      setFile(mockFile);

      const metadata: FileMetadata = {
        name: "dropped_files.zip",
        size: zippedBytes.length,
        type: "application/zip",
      };
      setFileMetadata(metadata);

      const newEncoder = new FountainEncoder(zippedBytes, metadata, chunkSize);
      setEncoder(newEncoder);
      seqRef.current = 0;
      setCurrentSeq(0);
      setIsPlaying(true);
    }
  };

  // Re-initialize encoder when chunkSize changes
  useEffect(() => {
    if (!file || !fileMetadata) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        const uint8Array = new Uint8Array(arrayBuffer);
        const newEncoder = new FountainEncoder(uint8Array, fileMetadata, chunkSize);
        setEncoder(newEncoder);
        seqRef.current = 0;
        setCurrentSeq(0);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [chunkSize]);

  // Apply Speed Presets (Safe, Turbo, Hyper)
  const applyPreset = (preset: "safe" | "turbo" | "hyper") => {
    setSpeedPreset(preset);
    if (preset === "safe") {
      setChunkSize(350);
      setTargetFps(20);
    } else if (preset === "turbo") {
      setChunkSize(500);
      setTargetFps(30);
    } else if (preset === "hyper") {
      setChunkSize(750);
      setTargetFps(45);
    }
  };

  // QR Code Rendering Function optimized for requestAnimationFrame
  const renderFrame = useCallback(
    async (timestamp: number) => {
      if (!encoder || !canvasRef.current) return;

      const frameInterval = 1000 / targetFpsRef.current;
      const elapsed = timestamp - lastFrameTimeRef.current;

      if (isPlayingRef.current && elapsed >= frameInterval) {
        lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);

        const seq = seqRef.current;
        const packetString = encoder.getPacket(seq);

        // Update text preview
        setCurrentPacketText(packetString);

        // Stark high contrast Apple QR code rendering
        try {
          await QRCode.toCanvas(canvasRef.current, packetString, {
            errorCorrectionLevel: "L",
            margin: 2,
            width: 400,
            color: {
              dark: "#000000",
              light: "#FFFFFF",
            },
          });
        } catch (err) {
          console.error("QR Code Render Error:", err);
        }

        // FPS Calculation
        frameCountRef.current++;
        if (timestamp - fpsTimerRef.current >= 1000) {
          setActualFps(frameCountRef.current);
          frameCountRef.current = 0;
          fpsTimerRef.current = timestamp;
        }

        setCurrentSeq(seq);
        seqRef.current = seq + 1;
      }

      if (isPlayingRef.current) {
        animationFrameIdRef.current = requestAnimationFrame(renderFrame);
      }
    },
    [encoder]
  );

  // Trigger frame animation loop when encoder or playback changes
  useEffect(() => {
    if (!encoder) return;

    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      fpsTimerRef.current = performance.now();
      frameCountRef.current = 0;
      animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    } else if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [encoder, isPlaying, renderFrame]);

  // Single step forward function
  const stepForward = () => {
    if (!encoder || !canvasRef.current) return;
    const seq = seqRef.current;
    const packetString = encoder.getPacket(seq);
    setCurrentPacketText(packetString);

    QRCode.toCanvas(canvasRef.current, packetString, {
      errorCorrectionLevel: "L",
      margin: 2,
      width: 400,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    setCurrentSeq(seq);
    seqRef.current = seq + 1;
  };

  const resetSequence = () => {
    seqRef.current = 0;
    setCurrentSeq(0);
  };

  const copyPacket = () => {
    if (!currentPacketText) return;
    navigator.clipboard.writeText(currentPacketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const calculatedSpeedKBps = Math.round((chunkSize * targetFps) / 1024);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4">
      {!file ? (
        /* State 1: The Upload View (Empty State - Apple HIG Blueprint) */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`apple-glass-card rounded-[2.5rem] p-12 sm:p-16 text-center space-y-8 max-w-2xl mx-auto border transition-all duration-300 ${
            isDragging
              ? "border-blue-500 bg-blue-500/10 scale-[1.01] glow-blue"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          {/* Large Elegant Upload Icon */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 shadow-inner">
            {isDragging ? (
              <FileUp className="w-10 h-10 stroke-[1.5] text-blue-400 animate-bounce" />
            ) : (
              <Upload className="w-10 h-10 stroke-[1.5] text-gray-400" />
            )}
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-2 max-w-md mx-auto">
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {isDragging ? "Drop payload here" : "Select a file to transmit"}
            </h1>
            <p className="text-gray-400 text-sm font-normal leading-relaxed">
              Upload a payload to encode into optical droplets. Supports files and entire folder archives.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-blue-500 hover:bg-blue-400 text-white font-medium shadow-lg shadow-blue-500/20 cursor-pointer transition-all">
              <Upload className="w-4 h-4 stroke-[2]" />
              <span>Choose File</span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 text-sm cursor-pointer transition-all">
              <Folder className="w-4 h-4 text-blue-400 stroke-[2]" />
              <span>Upload Folder</span>
              <input
                type="file"
                className="hidden"
                // @ts-expect-error - webkitdirectory non-standard attribute
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFolderChange}
              />
            </label>
          </div>
        </div>
      ) : (
        /* State 2: Active Transmission View (Dashboard - Apple HIG Blueprint) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: The Transmitter (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="apple-glass-card rounded-[2.5rem] p-8 space-y-6 border border-white/10 relative overflow-hidden">
              {/* Top Status Header */}
              <div className="flex items-center justify-between text-xs font-mono text-gray-400 border-b border-white/5 pb-4">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-white font-medium">Optic Stream</span>
                </span>
                <span>
                  Target: <strong className="text-white">{targetFps} FPS</strong> • Actual:{" "}
                  <strong className="text-blue-400">{actualFps} FPS</strong>
                </span>
              </div>

              {/* Stark White High-Contrast QR Canvas Container */}
              <div className="bg-white rounded-2xl p-4 shadow-2xl mx-auto w-full max-w-[360px] aspect-square flex items-center justify-center border border-white/20">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block rounded-lg"
                />
              </div>

              {/* Apple-Style Sleek Thin Progress Bar */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-mono text-gray-400">
                  <span className="text-gray-300">
                    {encoder && currentSeq < encoder.totalChunks
                      ? "Systematic Chunks"
                      : "Parity Droplets"}
                  </span>
                  <span>
                    Seq: <strong className="text-white">{currentSeq}</strong> / Total K:{" "}
                    <strong className="text-blue-400">{encoder?.totalChunks}</strong>
                  </span>
                </div>

                <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150"
                    style={{
                      width: `${
                        encoder
                          ? Math.min(100, Math.floor((currentSeq / encoder.totalChunks) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="bg-white/10 hover:bg-white/20 text-white rounded-full px-6 py-2.5 text-sm font-medium border border-white/10 transition-all flex items-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" /> Start Stream
                      </>
                    )}
                  </button>

                  <button
                    onClick={stepForward}
                    disabled={isPlaying}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 border border-white/10 transition-all"
                    title="Step 1 Frame"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  <button
                    onClick={resetSequence}
                    className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all"
                    title="Reset Sequence"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setFile(null);
                    setEncoder(null);
                  }}
                  className="px-4 py-2 rounded-full bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-gray-400 text-xs font-medium border border-white/10 transition-all"
                >
                  Change File
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Controls & Metrics (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Card A: File Info */}
            <div className="apple-glass-card rounded-3xl p-6 space-y-4 border border-white/10">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 border-b border-white/5 pb-3">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>File Metadata</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Name</span>
                  <span className="text-sm font-medium text-white truncate max-w-[200px]">
                    {fileMetadata?.name}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Size</span>
                  <span className="text-sm font-medium text-white">
                    {fileMetadata ? (fileMetadata.size / 1024).toFixed(1) + " KB" : "0 KB"}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Total Chunks</span>
                  <span className="text-sm font-medium text-blue-400">
                    {encoder?.totalChunks}
                  </span>
                </div>
              </div>
            </div>

            {/* Card B: Stream Parameters & Metrics */}
            <div className="apple-glass-card rounded-3xl p-6 space-y-5 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <span>Stream Controls</span>
                </span>
                <span className="text-3xl font-light text-blue-400 tracking-tight">
                  {calculatedSpeedKBps} <span className="text-xs font-normal text-gray-400">KB/s</span>
                </span>
              </div>

              {/* iOS-Style Segmented Picker for Speed Presets */}
              <div className="space-y-2">
                <span className="text-xs text-gray-400">Speed Preset</span>
                <div className="bg-white/10 p-1 rounded-full border border-white/10 grid grid-cols-3 gap-1">
                  <button
                    onClick={() => applyPreset("safe")}
                    className={`py-1.5 rounded-full text-xs font-medium transition-all ${
                      speedPreset === "safe"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Safe
                  </button>

                  <button
                    onClick={() => applyPreset("turbo")}
                    className={`py-1.5 rounded-full text-xs font-medium transition-all ${
                      speedPreset === "turbo"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Turbo
                  </button>

                  <button
                    onClick={() => applyPreset("hyper")}
                    className={`py-1.5 rounded-full text-xs font-medium transition-all ${
                      speedPreset === "hyper"
                        ? "bg-white/20 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Hyper
                  </button>
                </div>
              </div>

              {/* macOS-Style Sliders: Thin track (h-1 bg-white/20), small white circular thumb */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">Target Frame Rate</span>
                  <span className="text-white font-medium">{targetFps} FPS</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={targetFps}
                  onChange={(e) => setTargetFps(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none accent-blue-500 cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-gray-400">Chunk Payload Size</span>
                  <span className="text-white font-medium">{chunkSize} B</span>
                </div>
                <input
                  type="range"
                  min="150"
                  max="1000"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none accent-blue-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Card C: Encoded String Output */}
            <div className="apple-glass-card rounded-3xl p-6 space-y-3 border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-400" /> Packet Output
                </span>
                <button
                  onClick={copyPacket}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs text-gray-300 transition-all border border-white/10"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-blue-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="bg-black/50 rounded-xl p-4 border border-white/5 font-mono text-[11px] text-gray-400 break-all max-h-24 overflow-y-auto leading-relaxed">
                {currentPacketText || "Ready to stream payload..."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
