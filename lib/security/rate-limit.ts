import { ApiError } from "@/lib/security/api-error";

interface RateLimitEntry {
  minuteWindowStart: number;
  minuteCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const entries = new Map<string, RateLimitEntry>();

function getNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function currentMinuteWindow(now: number) {
  return Math.floor(now / 60_000) * 60_000;
}

function currentDayWindow(now: number) {
  return Math.floor(now / 86_400_000) * 86_400_000;
}

export function assertChatRateLimit(key: string) {
  const now = Date.now();
  const minuteLimit = getNumberEnv("CHAT_RATE_LIMIT_PER_MINUTE", 12);
  const dayLimit = getNumberEnv("CHAT_RATE_LIMIT_PER_DAY", 150);

  const minuteWindowStart = currentMinuteWindow(now);
  const dayWindowStart = currentDayWindow(now);
  const entry = entries.get(key);

  const next: RateLimitEntry =
    entry && entry.minuteWindowStart === minuteWindowStart && entry.dayWindowStart === dayWindowStart
      ? { ...entry }
      : {
          minuteWindowStart,
          minuteCount: entry?.minuteWindowStart === minuteWindowStart ? entry.minuteCount : 0,
          dayWindowStart,
          dayCount: entry?.dayWindowStart === dayWindowStart ? entry.dayCount : 0
        };

  if (entry?.minuteWindowStart !== minuteWindowStart) {
    next.minuteCount = 0;
  }
  if (entry?.dayWindowStart !== dayWindowStart) {
    next.dayCount = 0;
  }

  if (next.minuteCount >= minuteLimit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((minuteWindowStart + 60_000 - now) / 1000));
    throw new ApiError({
      status: 429,
      code: "rate_limited",
      message: "Estas enviando muchas consultas. Espera un momento y vuelve a intentar.",
      retryAfterSeconds
    });
  }

  if (next.dayCount >= dayLimit) {
    const retryAfterSeconds = Math.max(60, Math.ceil((dayWindowStart + 86_400_000 - now) / 1000));
    throw new ApiError({
      status: 429,
      code: "daily_quota_reached",
      message: "Ya llegaste al limite diario de consultas.",
      retryAfterSeconds
    });
  }

  next.minuteCount += 1;
  next.dayCount += 1;
  entries.set(key, next);

  if (entries.size > 5000) {
    const cutoff = now - 2 * 86_400_000;
    for (const [entryKey, value] of entries.entries()) {
      if (value.dayWindowStart < cutoff) {
        entries.delete(entryKey);
      }
    }
  }

  return {
    minuteRemaining: Math.max(0, minuteLimit - next.minuteCount),
    dayRemaining: Math.max(0, dayLimit - next.dayCount)
  };
}
