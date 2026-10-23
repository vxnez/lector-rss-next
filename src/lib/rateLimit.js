// src/lib/rateLimit.js — Rate limiting simple en memoria para Edge/Serverless.
// No persist: diseñado para proteger endpoints de auth contra brute-force básico.
// Para producción con múltiples instancias, migrar a Upstash Redis.

const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 5; // 5 req/min por clave

const buckets = new Map(); // key -> { count, resetAt }

function getKey(identifier, suffix = "") {
  return `${identifier}:${suffix}`;
}

function cleanup() {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

// Ejecutar limpieza periódica
setInterval(cleanup, WINDOW_MS);

export function rateLimit(identifier, { max = MAX_REQUESTS, windowMs = WINDOW_MS } = {}) {
  const key = getKey(identifier);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, max - bucket.count);
  const resetIn = Math.max(0, bucket.resetAt - now);

  return {
    allowed: bucket.count <= max,
    remaining,
    resetIn,
    limit: max,
    retryAfter: bucket.count > max ? Math.ceil(resetIn / 1000) : 0,
  };
}

export function getClientIp(req) {
  // En Vercel, la IP real viene en x-forwarded-for
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function createRateLimitHeaders(result) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil((Date.now() + result.resetIn) / 1000)),
    ...(result.retryAfter > 0 ? { "Retry-After": String(result.retryAfter) } : {}),
  };
}