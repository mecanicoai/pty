import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDefaultPlan } from "@/lib/billing/plans";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { issueInstallToken } from "@/lib/security/install-tokens";
import { getPlanUsageSnapshot } from "@/lib/security/plan-usage";
import { verifyPlayIntegrityInstall } from "@/lib/security/play-integrity";
import { createRequestId } from "@/lib/security/request";
import { integrityVerificationSchema } from "@/lib/validation/integrity";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = integrityVerificationSchema.parse(body);
    const verified = await verifyPlayIntegrityInstall(parsed);
    const defaultPlan = getDefaultPlan();
    const issued = issueInstallToken({
      installId: parsed.installId,
      entitlement: "licensed_install",
      plan: defaultPlan,
      expiresInSeconds: 60 * 60 * 24 * 30
    });

    console.info(
      JSON.stringify({
        event: "play_integrity_verified",
        requestId,
        installId: parsed.installId,
        packageName: verified.packageName,
        appLicensingVerdict: verified.appLicensingVerdict,
        appRecognitionVerdict: verified.appRecognitionVerdict,
        deviceRecognitionVerdicts: verified.deviceRecognitionVerdicts
      })
    );

    return NextResponse.json(
      {
        token: issued.token,
        expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
        entitlement: issued.payload.entitlement,
        plan: issued.payload.plan,
        usage: getPlanUsageSnapshot(defaultPlan, parsed.installId),
        integrity: verified,
        requestId
      },
      { status: 200, headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    const apiError =
      error instanceof ZodError
        ? new ApiError({
            status: 400,
            code: "invalid_integrity_request",
            message: "La solicitud de integridad no es valida.",
            details: error.flatten()
          })
        : isApiError(error)
          ? error
          : new ApiError({
              status: 500,
              code: "integrity_verification_failed",
              message: "No se pudo verificar la integridad del dispositivo."
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
