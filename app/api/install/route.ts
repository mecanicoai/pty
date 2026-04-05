import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createEmptyUsageSnapshot, getDefaultPlan } from "@/lib/billing/plans";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { createIntegrityRequestHash } from "@/lib/security/integrity-challenge";
import { issueInstallToken, issueIntegrityChallenge, isVerifiedAccessRequired } from "@/lib/security/install-tokens";
import { createRequestId, getClientIp } from "@/lib/security/request";
import { installRequestSchema } from "@/lib/validation/install";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = installRequestSchema.parse(body);
    const verificationRequired = isVerifiedAccessRequired();
    const defaultPlan = getDefaultPlan();

    if (verificationRequired) {
      const issuedAtMs = Date.now();
      const requestHash = createIntegrityRequestHash({ installId: parsed.installId, issuedAtMs });
      const challenge = issueIntegrityChallenge({
        installId: parsed.installId,
        requestHash,
        expiresInSeconds: 60 * 5
      });

      return NextResponse.json(
        {
          installId: parsed.installId,
          plan: defaultPlan,
          usage: createEmptyUsageSnapshot(defaultPlan),
          integrityRequired: true,
          integrity: {
            challengeToken: challenge.token,
            requestHash,
            issuedAt: new Date(issuedAtMs).toISOString(),
            expiresAt: new Date(challenge.payload.exp * 1000).toISOString()
          },
          requestId
        },
        { status: 200, headers: { "x-request-id": requestId } }
      );
    }

    const issued = issueInstallToken({
      installId: parsed.installId,
      entitlement: "anonymous",
      plan: defaultPlan,
      usage: null,
      expiresInSeconds: 60 * 60 * 24 * 7
    });

    console.info(JSON.stringify({ event: "install_token_issued", requestId, installId: parsed.installId, ip: getClientIp(request) }));

    return NextResponse.json(
      {
        installId: parsed.installId,
        token: issued.token,
        expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
        plan: issued.payload.plan,
        usage: createEmptyUsageSnapshot(issued.payload.plan),
        integrityRequired: false,
        requestId
      },
      { status: 200, headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    const apiError =
      error instanceof ZodError
        ? new ApiError({
            status: 400,
            code: "invalid_install_request",
            message: "La solicitud de instalacion no es valida.",
            details: error.flatten()
          })
        : isApiError(error)
          ? error
          : new ApiError({
              status: 500,
              code: "install_token_failed",
              message: "No se pudo iniciar la sesion del dispositivo."
            });

    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
        requestId
      },
      { status: apiError.status, headers: { "x-request-id": requestId } }
    );
  }
}
