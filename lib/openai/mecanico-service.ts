import OpenAI from "openai";

import { buildMecanicoSystemPrompt } from "@/lib/openai/mecanico-prompt";
import {
  diagnosticResponseJsonSchema,
  diagnosticResponseSchema,
  type DiagnosticStructuredOutput
} from "@/lib/openai/response-schema";
import { shouldUseWebSearch } from "@/lib/openai/should-use-web-search";
import type { AppLanguage, AppMode, ChatAttachment, PersistedMessage, VehicleContext } from "@/types/chat";

const CONFIGURED_MODEL = process.env.ASSISTANT_MODEL_ID?.trim() || process.env.OPENAI_MODEL?.trim() || "";
const DIY_MODEL = process.env.ASSISTANT_DIY_MODEL_ID?.trim() || process.env.OPENAI_DIY_MODEL?.trim() || "";
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

const openai = new OpenAI({
  apiKey: process.env.ASSISTANT_API_KEY || process.env.OPENAI_API_KEY
});

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const outputItem of response?.output ?? []) {
    for (const contentItem of outputItem?.content ?? []) {
      if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("El modelo no devolvio JSON valido.");
    }
    return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as unknown;
  }
}

function truncateText(value: string, limit: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 1)).trim()}…` : clean;
}

function buildFallbackDiagnosticOutput(rawText: string, language: AppLanguage, usedWebSearch: boolean): DiagnosticStructuredOutput {
  const summary =
    truncateText(rawText, 500) ||
    (language === "es"
      ? "Ya tengo una lectura inicial, pero necesito afinarla con una revision mas ordenada."
      : "I have an initial read, but I still need a more structured inspection to tighten it up.");

  return {
    language,
    summary,
    urgency: "caution",
    likely_causes: [
      language === "es" ? "Todavia falta confirmar la causa principal" : "The main cause still needs confirmation"
    ],
    possible_causes: [
      language === "es" ? "Se necesita revisar el vehiculo en orden" : "The vehicle needs a structured inspection"
    ],
    safety_critical: [],
    next_steps: [
      language === "es"
        ? "Confirma sintomas, condiciones en las que falla y una revision fisica antes de cerrar piezas o mano de obra."
        : "Confirm symptoms, operating conditions, and inspect the vehicle before locking parts or labor."
    ],
    tools_needed: [language === "es" ? "Revision basica" : "Basic inspection"],
    follow_up_questions: [],
    customer_quote: null,
    used_web_search: usedWebSearch
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("La salida JSON no tiene formato de objeto.");
  }
  return value as Record<string, unknown>;
}

function toAssistantContext(content: unknown): string {
  if (!content) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (typeof content === "object") {
    const data = content as Record<string, unknown>;
    const summary = typeof data.summary === "string" ? data.summary : "";
    const nextSteps = Array.isArray(data.next_steps) ? data.next_steps : [];
    const followUp = Array.isArray(data.follow_up_questions) ? data.follow_up_questions : [];
    const parts = [
      summary && `Resumen: ${summary}`,
      nextSteps.length ? `Siguientes pruebas: ${nextSteps.join("; ")}` : "",
      followUp.length ? `Preguntas: ${followUp.join("; ")}` : ""
    ].filter(Boolean);
    return parts.join("\n");
  }
  return "";
}

function toVehicleContextText(vehicle: VehicleContext | null | undefined): string {
  if (!vehicle) {
    return "Sin contexto de vehiculo confirmado.";
  }
  const lines = [
    `Ano: ${vehicle.year ?? "N/D"}`,
    `Marca: ${vehicle.make ?? "N/D"}`,
    `Modelo: ${vehicle.model ?? "N/D"}`,
    `Motor: ${vehicle.engine ?? "N/D"}`,
    `Traccion: ${vehicle.drivetrain ?? "N/D"}`,
    `Kilometraje: ${vehicle.mileage ?? "N/D"}`,
    `DTC: ${(vehicle.dtcCodes ?? []).join(", ") || "N/D"}`,
    `Sintomas: ${vehicle.symptomNotes ?? "N/D"}`
  ];
  return lines.join("\n");
}

function buildTools(useWebSearch: boolean) {
  if (!useWebSearch) {
    return undefined;
  }
  return [{ type: "web_search" }] as any;
}

function approxBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function normalizeAttachments(attachments: ChatAttachment[]) {
  return attachments.map((attachment) => {
    const bytes = approxBase64Bytes(attachment.dataBase64);
    if (bytes > MAX_ATTACHMENT_BYTES) {
      throw new Error(`El archivo ${attachment.name} excede 8MB.`);
    }
    return attachment;
  });
}

function buildUserContent(input: {
  message: string;
  mode: AppMode;
  language: AppLanguage;
  vehicle: VehicleContext | null;
  attachments: ChatAttachment[];
}) {
  const content: any[] = [
    {
      type: "input_text",
      text: [
        "Contexto del vehiculo:",
        toVehicleContextText(input.vehicle),
        "",
        `Modo: ${input.mode}`,
        `Idioma solicitado: ${input.language}`,
        "",
        `Consulta del usuario: ${input.message}`
      ].join("\n")
    }
  ];

  for (const attachment of input.attachments) {
    if (attachment.kind === "image") {
      content.push({
        type: "input_image",
        image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`
      });
      continue;
    }

    content.push({
      type: "input_file",
      filename: attachment.name,
      file_data: `data:${attachment.mimeType};base64,${attachment.dataBase64}`
    });
  }

  return content;
}

export interface MecanicoServiceInput {
  message: string;
  language: AppLanguage;
  mode: AppMode;
  vehicle: VehicleContext | null;
  recentMessages: PersistedMessage[];
  attachments?: ChatAttachment[];
  modelOverride?: string;
}

export interface MecanicoServiceOutput {
  parsed: DiagnosticStructuredOutput;
  usedWebSearch: boolean;
  model: string;
  raw: string;
}

function resolveModel(input: { modelOverride?: string; mode?: AppMode; useCase?: "chat" | "ocr" }) {
  const normalizedOverride = input.modelOverride?.trim();
  if (normalizedOverride) {
    return normalizedOverride;
  }

  if (input.useCase === "ocr") {
    return CONFIGURED_MODEL;
  }

  if (input.mode === "diy" && DIY_MODEL) {
    return DIY_MODEL;
  }

  return CONFIGURED_MODEL;
}

function truncateExtractedText(value: string, limit: number) {
  const clean = value.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) {
    return "";
  }
  return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 1)).trim()}…` : clean;
}

export async function extractTextFromImageAttachments(input: {
  attachments: ChatAttachment[];
  language: AppLanguage;
  modelOverride?: string;
}) {
  if (!process.env.ASSISTANT_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error("ASSISTANT_API_KEY no esta configurada.");
  }
  const resolvedModel = resolveModel({
    modelOverride: input.modelOverride,
    useCase: "ocr"
  });
  if (!resolvedModel) {
    throw new Error("ASSISTANT_MODEL_ID no esta configurada.");
  }

  const imageAttachments = normalizeAttachments(input.attachments.filter((attachment) => attachment.kind === "image"));
  if (!imageAttachments.length) {
    return "";
  }

  const response = await openai.responses.create({
    model: resolvedModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              input.language === "es"
                ? "Extrae el texto visible de estas capturas de pantalla. Devuelve solo el texto limpio, en orden de lectura, sin explicacion."
                : "Extract the visible text from these screenshots. Return only the cleaned text in reading order with no explanation."
          },
          ...imageAttachments.map((attachment) => ({
            type: "input_image",
            image_url: `data:${attachment.mimeType};base64,${attachment.dataBase64}`
          }))
        ]
      }
    ],
    temperature: 0
  } as any);

  return truncateExtractedText(extractOutputText(response), 2500);
}

export async function runMecanicoService(input: MecanicoServiceInput): Promise<MecanicoServiceOutput> {
  if (!process.env.ASSISTANT_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error("ASSISTANT_API_KEY no esta configurada.");
  }
  const resolvedModel = resolveModel({
    modelOverride: input.modelOverride,
    mode: input.mode,
    useCase: "chat"
  });
  if (!resolvedModel) {
    throw new Error("ASSISTANT_MODEL_ID no esta configurada.");
  }

  const attachments = normalizeAttachments(input.attachments ?? []);
  const useWebSearch = shouldUseWebSearch(input.message, input.mode, input.vehicle);
  const historyInput = input.recentMessages.map((message) => ({
    role: message.role,
    content:
      message.role === "assistant" ? toAssistantContext(message.content) : (message.content as Record<string, unknown>)?.text ?? ""
  }));

  const response = await openai.responses.create({
    model: resolvedModel,
    instructions: buildMecanicoSystemPrompt(input.language),
    input: [
      ...historyInput,
      {
        role: "user",
        content: buildUserContent({
          message: input.message,
          mode: input.mode,
          language: input.language,
          vehicle: input.vehicle,
          attachments
        })
      }
    ],
    tools: buildTools(useWebSearch),
    text: {
      format: {
        type: "json_schema",
        name: "mecanico_diagnostic_response",
        schema: diagnosticResponseJsonSchema,
        strict: true
      }
    } as any,
    temperature: 0.2
  } as any);

  const rawText = extractOutputText(response);
  let parsed: DiagnosticStructuredOutput;

  try {
    const parsedJson = asObject(tryParseJson(rawText));
    parsed = diagnosticResponseSchema.parse({
      ...parsedJson,
      used_web_search: useWebSearch
    });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "assistant_structured_fallback",
        reason: error instanceof Error ? error.message : "unknown",
        hasRawText: Boolean(rawText.trim())
      })
    );
    parsed = buildFallbackDiagnosticOutput(rawText, input.language, useWebSearch);
  }

  return {
    parsed,
    usedWebSearch: useWebSearch,
    model: resolvedModel,
    raw: rawText
  };
}
