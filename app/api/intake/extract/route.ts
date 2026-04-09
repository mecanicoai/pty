import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { extractTextFromImageAttachments } from "@/lib/openai/mecanico-service";
import { ApiError, isApiError } from "@/lib/security/api-error";
import { assertPlanAllowsAttachments } from "@/lib/security/plan-usage";
import { createRequestId, requireInstallAuth } from "@/lib/security/request";

export const runtime = "nodejs";

function getLocalModelOverride(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  const value = request.headers.get("x-local-model-override")?.trim() || "";
  return value ? value.slice(0, 120) : undefined;
}

const extractRequestSchema = z.object({
  language: z.enum(["es", "en"]).default("es"),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        mimeType: z.string().trim().min(1).max(120),
        kind: z.enum(["image", "file"]),
        dataBase64: z.string().min(20).max(12_000_000)
      })
    )
    .min(1)
    .max(4)
});

function classifyExtractError(error: unknown) {
  if (error instanceof ZodError) {
    return new ApiError({
      status: 400,
      code: "invalid_extract_request",
      message: "La solicitud de extraccion no es valida.",
      details: error.flatten()
    });
  }

  if (isApiError(error)) {
    return error;
  }

  const maybeError = error as { status?: number; message?: string };
  if (maybeError?.status && maybeError.status >= 500) {
    return new ApiError({
      status: 502,
      code: "upstream_extract_error",
      message: "No se pudo extraer el texto de la captura."
    });
  }

  if (
    typeof maybeError?.message === "string" &&
    (maybeError.message.includes("ASSISTANT_API_KEY") ||
      maybeError.message.includes("OPENAI_API_KEY") ||
      maybeError.message.includes("ASSISTANT_MODEL_ID"))
  ) {
    return new ApiError({
      status: 503,
      code: "assistant_not_configured",
      message: maybeError.message
    });
  }

  return new ApiError({
    status: 500,
    code: "extract_failed",
    message: "No se pudo extraer el texto de la captura."
  });
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    const auth = requireInstallAuth(request);
    const body = await request.json().catch(() => ({}));
    const parsed = extractRequestSchema.parse(body);

    assertPlanAllowsAttachments(auth.plan, auth.usage, parsed.attachments.length);

    const text = await extractTextFromImageAttachments({
      attachments: parsed.attachments,
      language: parsed.language,
      modelOverride: getLocalModelOverride(request)
    });

    return NextResponse.json(
      {
        text,
        requestId
      },
      {
        status: 200,
        headers: {
          "x-request-id": requestId
        }
      }
    );
  } catch (error) {
    const apiError = classifyExtractError(error);

    return NextResponse.json(
      {
        error: apiError.message,
        code: apiError.code,
        details: apiError.details,
        requestId
      },
      {
        status: apiError.status,
        headers: {
          "x-request-id": requestId
        }
      }
    );
  }
}
