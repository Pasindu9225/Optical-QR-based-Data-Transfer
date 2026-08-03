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
  const [targetFps, setTargetFps] = useState<number>(35);
  const [chunkSize, setChunkSize] = useState<number>(600);
  const [currentSeq, setCurrentSeq] = useState<number>(0);
  const [actualFps, setActualFps] = useState<number>(0);

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
  const targetFpsRef = useRef<number>(35);

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

        // High speed canvas render
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-cyan-400 font-mono text-xs font-semibold uppercase tracking-wider">
            <Radio className="w-4 h-4 animate-pulse" />
            <span>Optic Transmitter Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Fountain QR Generator</h1>
        </div>

        {encoder && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
              Target: <span className="font-bold text-white">{targetFps} FPS</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-xs font-mono text-cyan-400">
              Actual: <span className="font-bold text-white">{actualFps} FPS</span>
            </div>
          </div>
        )}
      </div>

      {!file ? (
        /* Interactive Drag & Drop Upload Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`glass-panel p-10 sm:p-14 rounded-2xl text-center space-y-6 border-2 border-dashed transition-all duration-200 ${
            isDragging
              ? "border-cyan-400 bg-cyan-950/40 scale-[1.01] glow-cyan shadow-2xl"
              : "border-slate-700/80 hover:border-cyan-500/50"
          }`}
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 transition-transform group-hover:scale-105">
            {isDragging ? (
              <FileUp className="w-10 h-10 animate-bounce text-cyan-300" />
            ) : (
              <Upload className="w-10 h-10 animate-bounce" />
            )}
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-semibold">
              {isDragging ? "Drop your file or folder here!" : "Drag & Drop files or folder here"}
            </h2>
            <p className="text-slate-400 text-sm">
              Drag and drop any file or folder directly into this box, or select using the buttons below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-medium shadow-lg shadow-cyan-500/20 cursor-pointer transition-all">
              <Upload className="w-4 h-4" />
              <span>Choose File</span>
              <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>

            <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl glass-card hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium cursor-pointer transition-all">
              <Folder className="w-4 h-4 text-cyan-400" />
              <span>Upload Entire Folder</span>
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
        /* Main Transmitter Interface */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Canvas Display Card (Left / Top) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 glow-cyan relative overflow-hidden">
              <div className="p-3 bg-white rounded-2xl shadow-2xl border-4 border-slate-900">
                <canvas
                  ref={canvasRef}
                  className="w-full max-w-[360px] aspect-square block rounded-lg"
                />
              </div>

              {/* Live Sequence Progress Bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>
                    Phase:{" "}
                    <strong className="text-cyan-400">
                      {encoder && currentSeq < encoder.totalChunks
                        ? "Systematic Chunks"
                        : "Parity Droplets"}
                    </strong>
                  </span>
                  <span>
                    Seq: <strong className="text-white">{currentSeq}</strong> / Total K:{" "}
                    <strong className="text-cyan-300">{encoder?.totalChunks}</strong>
                  </span>
                </div>

                <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-150"
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

              {/* Playback Action Controls */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md ${
                    isPlaying
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause Loop
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-slate-950" /> Start Stream
                    </>
                  )}
                </button>

                <button
                  onClick={stepForward}
                  disabled={isPlaying}
                  className="p-2.5 rounded-xl glass-card hover:bg-slate-800 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700/60"
                  title="Step 1 Frame"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  onClick={resetSequence}
                  className="p-2.5 rounded-xl glass-card hover:bg-slate-800 text-slate-200 border border-slate-700/60"
                  title="Reset Sequence to 0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    setFile(null);
                    setEncoder(null);
                  }}
                  className="px-3 py-2.5 rounded-xl glass-card hover:bg-rose-950/40 text-rose-400 border border-rose-900/40 text-xs font-semibold"
                >
                  Change File
                </button>
              </div>
            </div>
          </div>

          {/* Controls & Configuration Sidebar (Right) */}
          <div className="lg:col-span-5 space-y-6">
            {/* File Info Card */}
            <div className="glass-card p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-3">
                <span className="flex items-center gap-2 font-medium text-sm">
                  <FileText className="w-4 h-4 text-cyan-400" /> File Info
                </span>
                <span className="text-xs font-mono text-slate-500">
                  ID: {encoder?.fileId}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-semibold text-slate-100 truncate max-w-[180px]">
                    {fileMetadata?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Size:</span>
                  <span className="text-slate-200">
                    {fileMetadata
                      ? (fileMetadata.size / 1024).toFixed(2) + " KB"
                      : "0 KB"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Chunks (K):</span>
                  <span className="text-cyan-400 font-bold">
                    {encoder?.totalChunks}
                  </span>
                </div>
              </div>
            </div>

            {/* Slider & Speed Presets Card */}
            <div className="glass-card p-5 rounded-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="flex items-center gap-2 text-slate-200 font-medium text-sm">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Stream Parameters & Speed</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Est. {Math.round((chunkSize * targetFps) / 1024)} KB/s
                </span>
              </div>

              {/* Speed Preset Quick Buttons */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400">Speed Presets:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setChunkSize(300);
                      setTargetFps(25);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      chunkSize === 300 && targetFps === 25
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    🛡️ Safe
                  </button>

                  <button
                    onClick={() => {
                      setChunkSize(600);
                      setTargetFps(35);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      chunkSize === 600 && targetFps === 35
                        ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/60 shadow-sm"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    ⚡ Turbo (2x)
                  </button>

                  <button
                    onClick={() => {
                      setChunkSize(900);
                      setTargetFps(45);
                    }}
                    className={`px-2.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                      chunkSize === 900 && targetFps === 45
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-sm"
                        : "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                    }`}
                  >
                    🚀 Hyper (4x)
                  </button>
                </div>
              </div>

              {/* Target FPS Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Target Frame Rate:</span>
                  <span className="text-cyan-400 font-bold">{targetFps} FPS</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={targetFps}
                  onChange={(e) => setTargetFps(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>5 FPS</span>
                  <span>30 FPS</span>
                  <span>60 FPS</span>
                </div>
              </div>

              {/* Payload Chunk Size Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Chunk Payload Size:</span>
                  <span className="text-indigo-400 font-bold">{chunkSize} bytes</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1200"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>100B</span>
                  <span>600B</span>
                  <span>1200B</span>
                </div>
              </div>
            </div>

            {/* Current Packet Raw Debug Text */}
            <div className="glass-card p-5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Encoded Packet String
                </span>
                <button
                  onClick={copyPacket}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 break-all max-h-24 overflow-y-auto">
                {currentPacketText || "Ready to stream..."}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                <span>
                  First {encoder?.totalChunks} frames are systematic raw chunks. Subsequent frames are XOR parity droplets.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
