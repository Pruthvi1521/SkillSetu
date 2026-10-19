export interface CanonicalReportPayload {
  schema_version: string;
  assessment_id: string;
  worker_id: string;
  assessor_id: string;
  reviewer_id: string;
  qualification_pack: {
    qp_code: string;
    version: string;
    provenance: string;
  };
  rubric: {
    rubric_id: string;
    version: string;
  };
  nos_results: Array<{
    nos_code: string;
    nos_name: string;
    score: number;
    weight: number;
    passed: boolean;
  }>;
  criterion_scores: Array<{
    pc_id: string;
    pc_code: string;
    score_level: number;
    points: number;
    max_score: number;
    is_critical_safety: boolean;
  }>;
  summary: {
    overall_score: number;
    passed: boolean;
    critical_safety_failed: boolean;
    final_decision: string;
  };
  evidence_digests: Array<{
    evidence_id: string;
    sha256_hash: string;
  }>;
  generated_at: string;
}

/**
 * Deep-sorts object keys alphabetically to ensure deterministic canonical JSON encoding.
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(key => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ':' + canonicalizeJson(val);
  });

  return '{' + pairs.join(',') + '}';
}

// ─── SHA-256 Implementation ────────────────────────────────────────────────────
// Pure JavaScript, no Node.js native bindings — works in browser webpack bundle.

const SHA256_K: number[] = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

const SHA256_H_INIT: number[] = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
];

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256Words(data: Uint8Array): number[] {
  const H = SHA256_H_INIT.slice();
  const totalBits = data.length * 8;

  // Pad: append 0x80, then zeros, then 64-bit big-endian bit length
  const padLen = ((data.length + 8) >> 6) + 1;
  const padded = new Uint8Array(padLen * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, totalBits >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(totalBits / 0x100000000), false);

  const W = new Array<number>(64);

  for (let block = 0; block < padded.length; block += 64) {
    const bv = new DataView(padded.buffer, block, 64);
    for (let i = 0; i < 16; i++) {
      W[i] = bv.getUint32(i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i - 15], 7) ^ rotr32(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr32(W[i - 2], 17) ^ rotr32(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H;
}

function toHex32(n: number): string {
  return n.toString(16).padStart(8, '0');
}

function sha256Utf8(str: string): string {
  const encoded = new TextEncoder().encode(str);
  return sha256Words(encoded).map(toHex32).join('');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Computes the authoritative SHA-256 digest of a canonical report payload.
 */
export function computeReportHash(payload: CanonicalReportPayload): string {
  const canonicalString = canonicalizeJson(payload);
  return sha256Utf8(canonicalString);
}

/**
 * Validates whether a given hash matches the payload's canonical digest.
 */
export function verifyReportHash(payload: CanonicalReportPayload, expectedHash: string): boolean {
  const computed = computeReportHash(payload);
  return computed.toLowerCase() === expectedHash.trim().toLowerCase();
}
