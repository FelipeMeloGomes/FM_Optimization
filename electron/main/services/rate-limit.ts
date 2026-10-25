/**
 * Rate limiting para handlers IPC (janela deslizante).
 * Protege contra starvation/abuso do processo principal por um renderer
 * comprometido ou loop acidental.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 1000,
  maxRequests: 20,
};

// Canais que executam comandos pesados ou elevados ganham limite mais restrito.
const CHANNEL_CONFIG: Record<string, RateLimitConfig> = {
  'benchmark-dns': { windowMs: 5000, maxRequests: 3 },
  'apply-dns': { windowMs: 3000, maxRequests: 5 },
  'elevate-app': { windowMs: 10000, maxRequests: 2 },
  'create-restore-point': { windowMs: 5000, maxRequests: 2 },
  'restore-system': { windowMs: 5000, maxRequests: 2 },
  'execute-script': { windowMs: 2000, maxRequests: 10 },
  'adb:list-devices': { windowMs: 2000, maxRequests: 5 },
  'adb:list-apps': { windowMs: 5000, maxRequests: 3 },
  'adb:remove-app': { windowMs: 3000, maxRequests: 2 },
  'adb:backup-app': { windowMs: 5000, maxRequests: 3 },
  'adb:restore-app': { windowMs: 5000, maxRequests: 2 },
  'essentials:install': { windowMs: 10_000, maxRequests: 2 },
};

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(channel: string): RateLimitResult {
  const config = CHANNEL_CONFIG[channel] ?? DEFAULT_CONFIG;
  const now = Date.now();

  const bucket = buckets.get(channel) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < config.windowMs);

  if (bucket.timestamps.length >= config.maxRequests) {
    const oldest = bucket.timestamps[0];
    const retryAfterMs = Math.max(0, config.windowMs - (now - oldest));
    buckets.set(channel, bucket);
    return { allowed: false, retryAfterMs };
  }

  bucket.timestamps.push(now);
  buckets.set(channel, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

// Test helper: limpa o estado de todos os buckets.
export function resetRateLimit(): void {
  buckets.clear();
}
