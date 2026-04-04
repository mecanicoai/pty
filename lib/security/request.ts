import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/security/api-error";
import { verifyInstallToken } from "@/lib/security/install-tokens";

export function createRequestId() {
  return crypto.randomUUID();
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function requireInstallAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw new ApiError({
      status: 401,
      code: "install_token_missing",
      message: "No se encontro la autorizacion del dispositivo."
    });
  }

  return verifyInstallToken(token);
}
