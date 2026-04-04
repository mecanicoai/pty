import { createSign } from "node:crypto";

import { ApiError } from "@/lib/security/api-error";

const OAUTH_AUDIENCE = "https://oauth2.googleapis.com/token";
const ANDROID_PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

function encodeJsonBase64Url(value: Record<string, unknown>) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ApiError({
      status: 503,
      code: "purchase_verification_not_configured",
      message: "La verificacion de compra no esta configurada."
    });
  }
  return value;
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
    scope: ANDROID_PUBLISHER_SCOPE,
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

export interface VerifiedPurchase {
  packageName: string;
  productId: string;
  orderId?: string;
  purchaseTimeMillis?: string;
  acknowledgementState?: number;
}

export async function verifyGooglePlayOneTimePurchase(input: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}): Promise<VerifiedPurchase> {
  const allowedPackageName = process.env.GOOGLE_PLAY_PACKAGE_NAME?.trim();
  if (allowedPackageName && input.packageName !== allowedPackageName) {
    throw new ApiError({
      status: 400,
      code: "package_name_mismatch",
      message: "El package name no coincide con la configuracion del servidor."
    });
  }

  const accessToken = await getGoogleAccessToken();
  const url = new URL(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(input.packageName)}/purchases/products/${encodeURIComponent(input.productId)}/tokens/${encodeURIComponent(input.purchaseToken)}`
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError({
      status: response.status === 404 ? 403 : 502,
      code: "purchase_verification_failed",
      message: "No se pudo validar la compra con Google Play.",
      details: data
    });
  }

  const purchaseState = typeof data.purchaseState === "number" ? data.purchaseState : null;
  if (purchaseState !== 0) {
    throw new ApiError({
      status: 402,
      code: "purchase_not_active",
      message: "La compra no esta activa o sigue pendiente.",
      details: data
    });
  }

  return {
    packageName: input.packageName,
    productId: typeof data.productId === "string" ? data.productId : input.productId,
    orderId: typeof data.orderId === "string" ? data.orderId : undefined,
    purchaseTimeMillis: typeof data.purchaseTimeMillis === "string" ? data.purchaseTimeMillis : undefined,
    acknowledgementState: typeof data.acknowledgementState === "number" ? data.acknowledgementState : undefined
  };
}
