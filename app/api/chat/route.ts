import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { runMecanicoService } from "@/lib/openai/mecanico-service";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { assertPlanAllowsAttachments, assertPlanAllowsChat, recordPlanUsage } from "@/lib/security/plan-usage";
import { assertChatRateLimit } from "@/lib/security/rate-limit";
import { hasVerifiedAccess, isVerifiedAccessRequired, issueInstallToken } from "@/lib/security/install-tokens";
import { createRequestId, getClientIp, requireInstallAuth } from "@/lib/security/request";
import { chatRequestSchema } from "@/lib/validation/chat";

export const runtime = "nodejs";

function getLocalModelOverride(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const value = request.headers.get("x-local-model-override")?.trim() || "";
  return value ? value.slice(0, 120) : undefined;
}

function classifyChatError(error: unknown) {
  if (error instanceof ZodError) {
    return new ApiError({
      status: 400,
      code: "invalid_chat_request",
      message: "La solicitud del chat no es valida.",
      details: error.flatten()
    });
  }

  if (isApiError(error)) {
    return error;
  }

  const maybeError = error as { status?: number; message?: string; name?: string; code?: string };
  if (maybeError?.status === 429) {
    return new ApiError({
      status: 429,
      code: "assistant_rate_limited",
      message: "El servicio esta ocupado. Intenta de nuevo en un momento."
    });
  }

  if (maybeError?.status && maybeError.status >= 500) {
    return new ApiError({
      status: 502,
      code: "upstream_ai_error",
      message: "No se pudo completar la consulta con el modelo."
    });
  }

  if (
    typeof maybeError?.message === "string" &&
    (
      maybeError.message.includes("ASSISTANT_API_KEY") ||
      maybeError.message.includes("OPENAI_API_KEY") ||
      maybeError.message.includes("ASSISTANT_MODEL_ID")
    )
  ) {
    return new ApiError({
      status: 503,
      code: "assistant_not_configured",
      message: maybeError.message
    });
  }

  return new ApiError({
    status: 500,
    code: "chat_failed",
    message: "No se pudo procesar el chat."
  });
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const startedAt = Date.now();

  try {
    const auth = requireInstallAuth(request);
    if (isVerifiedAccessRequired() && !hasVerifiedAccess(auth.entitlement)) {
      throw new ApiError({
        status: 402,
        code: "verified_access_required",
        message: "Se requiere una instalacion verificada desde Google Play para usar el chat."
      });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = chatRequestSchema.parse(body);
    assertPlanAllowsAttachments(auth.plan, auth.usage, parsed.attachments.length);
    assertPlanAllowsChat(auth.plan, auth.usage);
    const rateLimit = assertChatRateLimit(auth.installId);

    if (parsed.sessionId && parsed.sessionId.length > 120) {
      throw new ApiError({
        status: 400,
        code: "invalid_session_id",
        message: "El sessionId no es valido."
      });
    }

    const recentMessages = parsed.recentMessages.map((message, index) => ({
      id: `${parsed.sessionId ?? "local"}-${index}`,
      role: message.role,
      content: message.text,
      usedWebSearch: message.usedWebSearch ?? false,
      createdAt: message.createdAt ?? new Date().toISOString()
    }));

    const completion = await runMecanicoService({
      message: parsed.message,
      language: parsed.language,
      mode: parsed.mode,
      vehicle: parsed.vehicle ?? null,
      recentMessages,
      attachments: parsed.attachments,
      modelOverride: getLocalModelOverride(request)
    });
    const nextUsage = recordPlanUsage(auth.plan, auth.usage);
    const remainingSeconds = Math.max(auth.exp - Math.floor(Date.now() / 1000), 60 * 30);
    const refreshed = issueInstallToken({
      installId: auth.installId,
      entitlement: auth.entitlement,
      plan: auth.plan,
      usage: nextUsage.record,
      expiresInSeconds: remainingSeconds,
      purchase: auth.purchase
    });

    console.info(
      JSON.stringify({
        event: "chat_completed",
        requestId,
        installId: auth.installId,
        ip: getClientIp(request),
        durationMs: Date.now() - startedAt,
        plan: auth.plan,
        planUsage: nextUsage.usage,
        usedWebSearch: completion.usedWebSearch,
        minuteRemaining: rateLimit.minuteRemaining,
        dayRemaining: rateLimit.dayRemaining
      })
    );

    return NextResponse.json(
      {
        ...completion.parsed,
        used_web_search: completion.usedWebSearch,
        plan: auth.plan,
        usage: nextUsage.usage,
        token: refreshed.token,
        expiresAt: new Date(refreshed.payload.exp * 1000).toISOString(),
        sessionId: parsed.sessionId,
        requestId
      },
      {
        status: 200,
        headers: {
          "x-request-id": requestId,
          "x-rate-limit-minute-remaining": String(rateLimit.minuteRemaining),
          "x-rate-limit-day-remaining": String(rateLimit.dayRemaining)
        }
      }
    );
  } catch (error) {
    const apiError = classifyChatError(error);

    console.error(
      JSON.stringify({
        event: "chat_failed",
        requestId,
        durationMs: Date.now() - startedAt,
        status: apiError.status,
        code: apiError.code,
        message: apiError.message,
        cause:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message
              }
            : undefined
      })
    );

    const headers: Record<string, string> = {
      "x-request-id": requestId
    };
    if (apiError.retryAfterSeconds) {
      headers["retry-after"] = String(apiError.retryAfterSeconds);
    }

    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
        requestId
      },
      { status: apiError.status, headers }
    );
  }
}
