import { createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";

export type InstallEntitlement = "anonymous" | "licensed_install" | "verified_purchase";

export interface InstallTokenPayload {
  version: 1;
  installId: string;
  entitlement: InstallEntitlement;
  iat: number;
  exp: number;
  purchase?: {
    packageName: string;
    productId: string;
    orderId?: string;
  };
}

export interface IntegrityChallengePayload {
  version: 1;
  installId: string;
  requestHash: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getInstallTokenSecret() {
  const secret = process.env.INSTALL_TOKEN_SECRET?.trim();
  if (secret) {
    return secret;
  }
  if (process.env.NODE_ENV !== "production") {
    return "mecanico-dev-install-token-secret";
  }
  throw new ApiError({
    status: 503,
    code: "install_secret_missing",
    message: "INSTALL_TOKEN_SECRET no esta configurada."
  });
}

function sign(unsignedToken: string) {
  return createHmac("sha256", getInstallTokenSecret()).update(unsignedToken).digest("base64url");
}

export function issueInstallToken(input: {
  installId: string;
  entitlement: InstallEntitlement;
  expiresInSeconds: number;
  purchase?: InstallTokenPayload["purchase"];
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: InstallTokenPayload = {
    version: 1,
    installId: input.installId,
    entitlement: input.entitlement,
    iat: now,
    exp: now + input.expiresInSeconds,
    purchase: input.purchase
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    payload
  };
}

export function verifyInstallToken(token: string): InstallTokenPayload {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new ApiError({
      status: 401,
      code: "install_token_invalid",
      message: "El token de instalacion no es valido."
    });
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ApiError({
      status: 401,
      code: "install_token_invalid",
      message: "El token de instalacion no es valido."
    });
  }

  let payload: InstallTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as InstallTokenPayload;
  } catch {
    throw new ApiError({
      status: 401,
      code: "install_token_invalid",
      message: "El token de instalacion no es valido."
    });
  }

  if (payload.version !== 1 || !payload.installId || !payload.entitlement) {
    throw new ApiError({
      status: 401,
      code: "install_token_invalid",
      message: "El token de instalacion no es valido."
    });
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError({
      status: 401,
      code: "install_token_expired",
      message: "La sesion del dispositivo vencio. Intenta de nuevo."
    });
  }

  return payload;
}

export function issueIntegrityChallenge(input: { installId: string; requestHash: string; expiresInSeconds: number }) {
  const now = Math.floor(Date.now() / 1000);
  const payload: IntegrityChallengePayload = {
    version: 1,
    installId: input.installId,
    requestHash: input.requestHash,
    iat: now,
    exp: now + input.expiresInSeconds
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    payload
  };
}

export function verifyIntegrityChallenge(token: string): IntegrityChallengePayload {
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_invalid",
      message: "El desafio de integridad no es valido."
    });
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_invalid",
      message: "El desafio de integridad no es valido."
    });
  }

  let payload: IntegrityChallengePayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as IntegrityChallengePayload;
  } catch {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_invalid",
      message: "El desafio de integridad no es valido."
    });
  }

  if (payload.version !== 1 || !payload.installId || !payload.requestHash) {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_invalid",
      message: "El desafio de integridad no es valido."
    });
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_expired",
      message: "El desafio de integridad vencio. Intenta otra vez."
    });
  }

  return payload;
}

export function isVerifiedAccessRequired() {
  return process.env.REQUIRE_PLAY_INTEGRITY_LICENSE === "true" || process.env.REQUIRE_PURCHASE_VERIFICATION === "true";
}

export function hasVerifiedAccess(entitlement: InstallEntitlement) {
  return entitlement === "licensed_install" || entitlement === "verified_purchase";
}
