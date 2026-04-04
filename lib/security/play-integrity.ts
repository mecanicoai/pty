import { createSign } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";
import { verifyIntegrityChallenge } from "@/lib/security/install-tokens";

const OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";
const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ApiError({
      status: 503,
      code: "play_integrity_not_configured",
      message: "La verificacion de Play Integrity no esta configurada."
    });
  }
  return value;
}

function encodeJsonBase64Url(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function getGooglePrivateKey() {
  return requireEnv("GOOGLE_PLAY_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function buildServiceAccountAssertion() {
  const email = requireEnv("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL");
  const privateKey = getGooglePrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJsonBase64Url({ alg: "RS256", typ: "JWT" });
  const claims = encodeJsonBase64Url({
    iss: email,
    scope: PLAY_INTEGRITY_SCOPE,
    aud: OAUTH_AUDIENCE,
    exp: now + 3600,
    iat: now
  });
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

async function getGoogleAccessToken() {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildServiceAccountAssertion()
  });

  const response = await fetch(OAUTH_AUDIENCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok || typeof data.access_token !== "string") {
    throw new ApiError({
      status: 502,
      code: "google_oauth_failed",
      message: "No se pudo autenticar con Google Play.",
      details: data
    });
  }

  return data.access_token;
}

export interface VerifiedIntegrityInstall {
  packageName: string;
  appLicensingVerdict: string;
  appRecognitionVerdict?: string;
  deviceRecognitionVerdicts: string[];
}

export async function verifyPlayIntegrityInstall(input: {
  installId: string;
  integrityToken: string;
  challengeToken: string;
}): Promise<VerifiedIntegrityInstall> {
  const expectedPackageName = requireEnv("GOOGLE_PLAY_PACKAGE_NAME");
  const challenge = verifyIntegrityChallenge(input.challengeToken);
  if (challenge.installId !== input.installId) {
    throw new ApiError({
      status: 401,
      code: "integrity_challenge_mismatch",
      message: "La verificacion no coincide con el dispositivo."
    });
  }

  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://playintegrity.googleapis.com/v1/${encodeURIComponent(expectedPackageName)}:decodeIntegrityToken`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        integrity_token: input.integrityToken
      })
    }
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError({
      status: 502,
      code: "play_integrity_decode_failed",
      message: "No se pudo validar la integridad con Google Play.",
      details: data
    });
  }

  const payload = (data.tokenPayloadExternal ?? {}) as Record<string, unknown>;
  const requestDetails = (payload.requestDetails ?? {}) as Record<string, unknown>;
  const appIntegrity = (payload.appIntegrity ?? {}) as Record<string, unknown>;
  const deviceIntegrity = (payload.deviceIntegrity ?? {}) as Record<string, unknown>;
  const accountDetails = (payload.accountDetails ?? {}) as Record<string, unknown>;

  const requestPackageName = typeof requestDetails.requestPackageName === "string" ? requestDetails.requestPackageName : "";
  const requestHash = typeof requestDetails.requestHash === "string" ? requestDetails.requestHash : "";
  const licensingVerdict = typeof accountDetails.appLicensingVerdict === "string" ? accountDetails.appLicensingVerdict : "";
  const appRecognitionVerdict =
    typeof appIntegrity.appRecognitionVerdict === "string" ? appIntegrity.appRecognitionVerdict : undefined;
  const deviceRecognitionVerdicts = Array.isArray(deviceIntegrity.deviceRecognitionVerdict)
    ? deviceIntegrity.deviceRecognitionVerdict.filter((item): item is string => typeof item === "string")
    : [];

  if (requestPackageName !== expectedPackageName) {
    throw new ApiError({
      status: 403,
      code: "package_name_mismatch",
      message: "La verificacion de integridad no corresponde a esta app."
    });
  }

  if (requestHash !== challenge.requestHash) {
    throw new ApiError({
      status: 403,
      code: "integrity_request_hash_mismatch",
      message: "La verificacion de integridad no coincide con la solicitud."
    });
  }

  if (licensingVerdict !== "LICENSED") {
    throw new ApiError({
      status: 402,
      code: "app_not_licensed",
      message: "La cuenta de Google Play no tiene licencia valida para esta app.",
      details: { appLicensingVerdict: licensingVerdict || "UNKNOWN" }
    });
  }

  if (appRecognitionVerdict && appRecognitionVerdict !== "PLAY_RECOGNIZED") {
    throw new ApiError({
      status: 403,
      code: "app_not_play_recognized",
      message: "La app no fue reconocida como binario valido de Google Play.",
      details: { appRecognitionVerdict }
    });
  }

  if (!deviceRecognitionVerdicts.length) {
    throw new ApiError({
      status: 403,
      code: "device_not_trusted",
      message: "El dispositivo no paso la verificacion de integridad."
    });
  }

  return {
    packageName: expectedPackageName,
    appLicensingVerdict: licensingVerdict,
    appRecognitionVerdict,
    deviceRecognitionVerdicts
  };
}
