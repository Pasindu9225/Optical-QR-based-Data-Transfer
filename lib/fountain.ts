/**
 * Fountain Code Engine for Optical QR Transmission
 * Implements Systematic Luby Transform (LT) codes with online Belief Propagation decoding.
 */

// Simple deterministic PRNG (Mulberry32)
export function createPRNG(seed: number) {
  let s = seed >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert string to uint32 seed
export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

// Base64 helpers for Uint8Array (browser compatible)
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof window !== "undefined"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString =
    typeof window !== "undefined"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface PacketHeader {
  version: "F1";
  fileId: string;
  totalChunks: number;
  seq: number;
  base64Payload: string;
}

/**
  * Calculate degree set for a given sequence number and file ID
  */
export function getDegreeSet(
  fileId: string,
  totalChunks: number,
  seq: number
): Set<number> {
  const K = totalChunks;
  if (seq < K) {
    // Systematic chunk: direct 1-to-1 mapping
    return new Set([seq]);
  }

  // Parity chunk: pseudo-random degree distribution
  const seed = stringToSeed(`${fileId}:${seq}`);
  const rng = createPRNG(seed);

  // Degree selection: degree 1 (5%), degree 2 (35%), degree 3..min(K, 8) (60%)
  let degree = 2;
  const r = rng();
  if (r < 0.05) {
    degree = 1;
  } else if (r < 0.4) {
    degree = 2;
  } else {
    degree = 3 + Math.floor(rng() * Math.min(K - 2, 6));
  }

  degree = Math.min(degree, K);

  const degreeSet = new Set<number>();
  while (degreeSet.size < degree) {
    const idx = Math.floor(rng() * K);
    degreeSet.add(idx);
  }

  return degreeSet;
}

export class FountainEncoder {
  public fileId: string;
  public totalChunks: number;
  public chunkSize: number;
  private chunks: Uint8Array[];
  private metadata: FileMetadata;

  constructor(fileData: Uint8Array, metadata: FileMetadata, targetChunkSize = 300) {
    this.metadata = metadata;
    // Prepend metadata header to raw file payload: JSON + '\n\n'
    const metaStr = JSON.stringify(metadata) + "\n\n";
    const metaBytes = new TextEncoder().encode(metaStr);

    const fullPayload = new Uint8Array(metaBytes.length + fileData.length);
    fullPayload.set(metaBytes, 0);
    fullPayload.set(fileData, metaBytes.length);

    this.chunkSize = targetChunkSize;
    this.totalChunks = Math.ceil(fullPayload.length / targetChunkSize);
    this.fileId = Math.random().toString(36).substring(2, 10);

    this.chunks = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const start = i * targetChunkSize;
      const end = Math.min(start + targetChunkSize, fullPayload.length);
      const chunk = new Uint8Array(targetChunkSize); // Pad to uniform size
      chunk.set(fullPayload.subarray(start, end));
      this.chunks.push(chunk);
    }
  }

  /**
   * Generate encoded string packet for sequence `seq`
   * Format: F1:<fileId>:<totalChunks>:<seq>:<base64Payload>
   */
  public getPacket(seq: number): string {
    const degreeSet = getDegreeSet(this.fileId, this.totalChunks, seq);
    const payload = new Uint8Array(this.chunkSize);

    for (const chunkIdx of degreeSet) {
      const srcChunk = this.chunks[chunkIdx];
      for (let i = 0; i < this.chunkSize; i++) {
        payload[i] ^= srcChunk[i];
      }
    }

    const base64 = bytesToBase64(payload);
    return `F1:${this.fileId}:${this.totalChunks}:${seq}:${base64}`;
  }
}

export class FountainDecoder {
  public fileId: string | null = null;
  public totalChunks = 0;
  public decodedBlocks = new Map<number, Uint8Array>();
  public pendingEquations: Array<{
    seq: number;
    degreeSet: Set<number>;
    payload: Uint8Array;
  }> = [];

  public totalPacketsProcessed = 0;
  public duplicateCount = 0;

  /**
   * Parse encoded QR string into header object
   */
  public static parsePacket(raw: string): PacketHeader | null {
    if (!raw.startsWith("F1:")) return null;
    const parts = raw.split(":");
    if (parts.length < 5) return null;

    const [version, fileId, totalChunksStr, seqStr, base64Payload] = parts;
    const totalChunks = parseInt(totalChunksStr, 10);
    const seq = parseInt(seqStr, 10);

    if (isNaN(totalChunks) || isNaN(seq) || !base64Payload) return null;

    return {
      version: "F1",
      fileId,
      totalChunks,
      seq,
      base64Payload,
    };
  }

  /**
   * Ingest a scanned packet. Returns boolean indicating if a new chunk was solved.
   */
  public ingest(rawPacket: string): boolean {
    const header = FountainDecoder.parsePacket(rawPacket);
    if (!header) return false;

    this.totalPacketsProcessed++;

    // Reset decoder if new file ID encountered
    if (!this.fileId || this.fileId !== header.fileId) {
      this.fileId = header.fileId;
      this.totalChunks = header.totalChunks;
      this.decodedBlocks.clear();
      this.pendingEquations = [];
      this.duplicateCount = 0;
    }

    // Fast check if sequence already present in pending
    if (this.pendingEquations.some((eq) => eq.seq === header.seq)) {
      this.duplicateCount++;
      return false;
    }

    const degreeSet = getDegreeSet(this.fileId, this.totalChunks, header.seq);
    let payload = base64ToBytes(header.base64Payload);

    // Reduce equation using currently solved blocks
    for (const solvedIdx of Array.from(degreeSet)) {
      if (this.decodedBlocks.has(solvedIdx)) {
        const solvedPayload = this.decodedBlocks.get(solvedIdx)!;
        payload = this.xorBytes(payload, solvedPayload);
        degreeSet.delete(solvedIdx);
      }
    }

    if (degreeSet.size === 0) {
      this.duplicateCount++;
      return false; // Packet was redundant
    }

    let progressMade = false;

    if (degreeSet.size === 1) {
      // Solved new degree-1 block!
      const newBlockIdx = Array.from(degreeSet)[0];
      this.decodedBlocks.set(newBlockIdx, payload);
      progressMade = true;

      // Belief Propagation Peeling
      this.peel(newBlockIdx, payload);
    } else {
      // Store in pending equations
      this.pendingEquations.push({
        seq: header.seq,
        degreeSet,
        payload,
      });
    }

    return progressMade;
  }

  /**
   * Cascade peeling phase for Belief Propagation
   */
  private peel(solvedIdx: number, solvedPayload: Uint8Array) {
    let newlySolvedQueue: Array<{ idx: number; payload: Uint8Array }> = [];

    // Reduce all pending equations
    for (let i = this.pendingEquations.length - 1; i >= 0; i--) {
      const eq = this.pendingEquations[i];
      if (eq.degreeSet.has(solvedIdx)) {
        eq.payload = this.xorBytes(eq.payload, solvedPayload);
        eq.degreeSet.delete(solvedIdx);

        if (eq.degreeSet.size === 1) {
          const newIdx = Array.from(eq.degreeSet)[0];
          this.pendingEquations.splice(i, 1);

          if (!this.decodedBlocks.has(newIdx)) {
            this.decodedBlocks.set(newIdx, eq.payload);
            newlySolvedQueue.push({ idx: newIdx, payload: eq.payload });
          }
        } else if (eq.degreeSet.size === 0) {
          this.pendingEquations.splice(i, 1);
        }
      }
    }

    // Recursively peel newly solved blocks
    for (const item of newlySolvedQueue) {
      this.peel(item.idx, item.payload);
    }
  }

  private xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
    const result = new Uint8Array(Math.max(a.length, b.length));
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      result[i] = a[i] ^ b[i];
    }
    return result;
  }

  public get isComplete(): boolean {
    return this.totalChunks > 0 && this.decodedBlocks.size === this.totalChunks;
  }

  public get progressPercentage(): number {
    if (this.totalChunks === 0) return 0;
    return Math.floor((this.decodedBlocks.size / this.totalChunks) * 100);
  }

  /**
   * Reassemble binary data and reconstruct Blob + metadata
   */
  public reconstruct(): { blob: Blob; metadata: FileMetadata } | null {
    if (!this.isComplete) return null;

    // Combine blocks 0..K-1
    let totalLen = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      totalLen += this.decodedBlocks.get(i)!.length;
    }

    const fullPayload = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < this.totalChunks; i++) {
      const block = this.decodedBlocks.get(i)!;
      fullPayload.set(block, offset);
      offset += block.length;
    }

    // Find '\n\n' metadata separator
    let separatorIdx = -1;
    for (let i = 0; i < fullPayload.length - 1; i++) {
      if (fullPayload[i] === 10 && fullPayload[i + 1] === 10) {
        separatorIdx = i;
        break;
      }
    }

    if (separatorIdx === -1) return null;

    const metaBytes = fullPayload.subarray(0, separatorIdx);
    const fileBytesWithPadding = fullPayload.subarray(separatorIdx + 2);

    const metaStr = new TextDecoder().decode(metaBytes);
    const metadata: FileMetadata = JSON.parse(metaStr);

    // Slice to exact file size
    const rawFileBytes = fileBytesWithPadding.subarray(0, metadata.size);
    const blob = new Blob([rawFileBytes], { type: metadata.type || "application/octet-stream" });

    return { blob, metadata };
  }
}
