import type { AppMode, VehicleContext } from "@/types/chat";

const WEB_SEARCH_KEYWORDS = [
  /\b(latest|current|recent|today)\b/i,
  /\b(recall|recalls)\b/i,
  /\b(tsb|service bulletin|bulletin|boletin)\b/i,
  /\b(availability|disponibilidad)\b/i,
  /\b(price|precio|cost|costo|labor rate|mano de obra)\b/i,
  /\b(regulation|regulations|reglamento|normativa|safety notice)\b/i,
  /\b(field report|foro|forum|reportes recientes)\b/i,
  /\b(updated?|actualizado|actual)\b/i
];

const DIAGNOSTIC_ONLY_HINTS = [
  /\b(misfire|falla|ruido|vibracion|cascabeleo)\b/i,
  /\b(obd|dtc|p0\d{3}|u\d{4}|b\d{4}|c\d{4})\b/i,
  /\b(check engine|test|prueba|compresion|sensor)\b/i
];

export function shouldUseWebSearch(message: string, mode: AppMode, vehicleContext?: VehicleContext | null): boolean {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }

  if (WEB_SEARCH_KEYWORDS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (mode === "diagnostic" && DIAGNOSTIC_ONLY_HINTS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (mode === "shop" && /\b(precio|cost|quote|cotizacion|availability)\b/i.test(normalized)) {
    return true;
  }

  if (
    vehicleContext?.make &&
    vehicleContext?.model &&
    /\b(common issue|known issue|problema conocido|falla comun)\b/i.test(normalized)
  ) {
    return true;
  }

  return false;
}
