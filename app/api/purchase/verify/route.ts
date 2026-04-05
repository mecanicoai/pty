import { resolvePlanFromProductId } from "@/lib/billing/plans";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { verifyGooglePlayOneTimePurchase } from "@/lib/purchases/google-play";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { issueInstallToken } from "@/lib/security/install-tokens";
import { createEmptyUsageSnapshot } from "@/lib/billing/plans";
import { createRequestId } from "@/lib/security/request";
import { purchaseVerificationSchema } from "@/lib/validation/purchase";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = purchaseVerificationSchema.parse(body);
    const verified = await verifyGooglePlayOneTimePurchase(parsed);
    const plan = resolvePlanFromProductId(verified.productId);
    const issued = issueInstallToken({
      installId: parsed.installId,
      entitlement: "verified_purchase",
      plan,
      usage: null,
      expiresInSeconds: 60 * 60 * 24 * 30,
      purchase: {
        packageName: verified.packageName,
        productId: verified.productId,
        orderId: verified.orderId
      }
    });

    console.info(
      JSON.stringify({
        event: "purchase_verified",
        requestId,
        installId: parsed.installId,
        packageName: verified.packageName,
        productId: verified.productId,
        orderId: verified.orderId
      })
    );

    return NextResponse.json(
      {
        token: issued.token,
        expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
        entitlement: issued.payload.entitlement,
        plan: issued.payload.plan,
        usage: createEmptyUsageSnapshot(plan),
        purchase: issued.payload.purchase,
        requestId
      },
      { status: 200, headers: { "x-request-id": requestId } }
    );
  } catch (error) {
    const apiError =
      error instanceof ZodError
        ? new ApiError({
            status: 400,
            code: "invalid_purchase_request",
            message: "La solicitud de verificacion no es valida.",
            details: error.flatten()
          })
        : isApiError(error)
          ? error
          : new ApiError({
              status: 500,
              code: "purchase_verification_failed",
              message: "No se pudo verificar la compra."
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
