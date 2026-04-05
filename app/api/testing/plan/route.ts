import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { createEmptyUsageSnapshot } from "@/lib/billing/plans";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { issueInstallToken, type InstallEntitlement } from "@/lib/security/install-tokens";
import { createRequestId } from "@/lib/security/request";
import { testPlanOverrideSchema } from "@/lib/validation/test-plan";

export const runtime = "nodejs";

function isTestOverrideEnabled() {
  return process.env.ALLOW_TEST_PLAN_OVERRIDE === "true";
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    if (!isTestOverrideEnabled()) {
      throw new ApiError({
        status: 403,
        code: "test_plan_override_disabled",
        message: "La activacion manual de planes de prueba no esta habilitada."
      });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = testPlanOverrideSchema.parse(body);
    const entitlement: InstallEntitlement = parsed.plan === "free" ? "anonymous" : "verified_purchase";
    const issued = issueInstallToken({
      installId: parsed.installId,
      entitlement,
      plan: parsed.plan,
      usage: null,
      expiresInSeconds: 60 * 60 * 24 * 30
    });

    return NextResponse.json(
      {
        installId: parsed.installId,
        token: issued.token,
        expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
        entitlement: issued.payload.entitlement,
        plan: issued.payload.plan,
        usage: createEmptyUsageSnapshot(parsed.plan),
        requestId
      },
      { status: 200, headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    const apiError =
      error instanceof ZodError
        ? new ApiError({
            status: 400,
            code: "invalid_test_plan_request",
            message: "La solicitud de prueba no es valida.",
            details: error.flatten()
          })
        : isApiError(error)
          ? error
          : new ApiError({
              status: 500,
              code: "test_plan_override_failed",
              message: "No se pudo activar el plan de prueba."
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
