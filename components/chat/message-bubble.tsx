"use client";

import { useState } from "react";

import { buildWhatsAppShareUrl, openPrintableDocument } from "@/lib/product/pro-workflows";
import type { UiMessage } from "@/components/chat/types";

function formatTime(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--wa-text-secondary)]">{title}</p>
      <ul className="mt-1 space-y-1 text-[13px] text-[var(--wa-text-primary)]">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="leading-snug">
            - {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const textToCopy = message.workflowOutput
      ? [
          "Cliente",
          `Resumen: ${message.workflowOutput.clientProblemSummary}`,
          `Respuesta sugerida: ${message.workflowOutput.suggestedReply}`,
          `Siguiente paso: ${message.workflowOutput.nextStepExplanation}`,
          "",
          "Taller",
          `Brief interno: ${message.workflowOutput.internalJobBrief}`,
          `Categoria probable: ${message.workflowOutput.likelyIssueCategory}`,
          `Siguiente diagnostico: ${message.workflowOutput.recommendedNextDiagnosticStep}`
        ].join("\n")
      : message.diagnostic
        ? message.diagnostic.summary
        : message.text;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handleCopyDocument() {
    if (!message.documentPreview) {
      return;
    }

    const { title, draft, business } = message.documentPreview;
    const text = [title, business.business_name, `Cliente: ${draft.customerName || "Pendiente"}`, `Vehiculo: ${draft.vehicleLabel || "Pendiente"}`, `Resumen: ${draft.summary}`, draft.notes]
      .filter(Boolean)
      .join("\n\n");

    void navigator.clipboard.writeText(text);
  }

  function handleShareDocument() {
    if (!message.documentPreview) {
      return;
    }

    const { title, draft, business } = message.documentPreview;
    const text = [title, business.business_name, `Cliente: ${draft.customerName || "Pendiente"}`, `Vehiculo: ${draft.vehicleLabel || "Pendiente"}`, `Resumen: ${draft.summary}`, draft.notes]
      .filter(Boolean)
      .join("\n\n");

    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }

  function handleShareQuestions() {
    if (!message.workflowOutput?.unansweredQuestions.length) {
      return;
    }

    const text = [
      "Preguntas para cerrar el diagnostico:",
      ...message.workflowOutput.unansweredQuestions.map((item, index) => `${index + 1}. ${item}`)
    ].join("\n");

    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group`}>
      {!isUser ? (
        <div className="mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow dark:bg-[#1f1f1f]">
          {"\uD83D\uDD27"}
        </div>
      ) : null}

      <div className={`${isUser ? "message-bubble-user" : "message-bubble-bot"} max-w-[82%] px-4 py-3 md:max-w-[75%]`}>
        {!isUser ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
              aria-label="Copiar respuesta"
              title="Copiar respuesta"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        ) : null}

        {message.workflowOutput ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mech-orange)]">Taller</p>
              <div className="mt-2 space-y-2 text-[14px] text-[var(--wa-text-primary)]">
                <p>
                  <span className="font-semibold">Brief interno:</span> {message.workflowOutput.internalJobBrief}
                </p>
                <p>
                  <span className="font-semibold">Categoria probable:</span> {message.workflowOutput.likelyIssueCategory}
                </p>
                <p>
                  <span className="font-semibold">Siguiente diagnostico:</span> {message.workflowOutput.recommendedNextDiagnosticStep}
                </p>
                {message.workflowOutput.unansweredQuestions.length ? (
                  <div>
                    <p className="font-semibold">Preguntas pendientes:</p>
                    <ul className="mt-1 space-y-1 text-[13px]">
                      {message.workflowOutput.unansweredQuestions.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleShareQuestions}
                        className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                      >
                        Compartir preguntas
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--taller-green)]">Cliente</p>
              <div className="mt-2 space-y-2 text-[14px] text-[var(--wa-text-primary)]">
                <p>
                  <span className="font-semibold">Resumen:</span> {message.workflowOutput.clientProblemSummary}
                </p>
                <p>
                  <span className="font-semibold">Respuesta sugerida:</span> {message.workflowOutput.suggestedReply}
                </p>
                <p>
                  <span className="font-semibold">Siguiente paso:</span> {message.workflowOutput.nextStepExplanation}
                </p>
              </div>
            </div>

            {message.documentPreview ? (
              <div className="rounded-[18px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-3">
                <p className="text-sm font-semibold text-[var(--wa-text-primary)]">Cotizacion preliminar</p>
                <div className="mt-2 grid gap-1 text-[12px] text-[var(--wa-text-secondary)]">
                  <p>Cliente: {message.documentPreview.draft.customerName || "Pendiente"}</p>
                  <p>Vehiculo: {message.documentPreview.draft.vehicleLabel || "Pendiente"}</p>
                  <p>
                    Total preliminar: {message.documentPreview.draft.amount.toFixed(2)} {message.documentPreview.business.currency}
                  </p>
                </div>
                {message.workflowOutput.quoteDraft?.lineItems?.length ? (
                  <div className="mt-3 space-y-2 text-[13px] text-[var(--wa-text-primary)]">
                    {message.workflowOutput.quoteDraft.lineItems.map((item) => (
                      <div key={`${item.label}-${item.amount}`} className="rounded-[14px] border border-[var(--wa-divider)] bg-white/60 p-2 dark:bg-white/5">
                        <div className="flex justify-between gap-3">
                          <p className="font-semibold">{item.label}</p>
                          <p className="shrink-0">
                            {item.amount.toFixed(2)} {message.documentPreview?.business.currency}
                          </p>
                        </div>
                        {item.detail ? <p className="mt-1 text-[12px] text-[var(--wa-text-secondary)]">{item.detail}</p> : null}
                        {item.timing ? <p className="mt-1 text-[12px] text-[var(--wa-text-secondary)]">Tiempo: {item.timing}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 space-y-1 text-[12px] leading-5 text-[var(--wa-text-secondary)]">
                  {message.documentPreview.draft.notes
                    .split("\n")
                    .filter(Boolean)
                    .map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyDocument}
                    className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={handleShareDocument}
                    className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => openPrintableDocument(message.documentPreview!)}
                    className="rounded-full bg-[var(--taller-green)] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#138655]"
                  >
                    Descargar PDF
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : message.diagnostic ? (
          <div className="space-y-1">
            <p className="text-[16px] leading-tight">{message.diagnostic.summary}</p>
            <div className="inline-flex rounded-full bg-[var(--wa-control-bg-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--wa-text-secondary)]">
              Urgencia: {message.diagnostic.urgency}
            </div>
            <Section title="Causas probables" items={message.diagnostic.likely_causes} />
            <Section title="Causas posibles" items={message.diagnostic.possible_causes} />
            <Section title="Riesgos críticos" items={message.diagnostic.safety_critical} />
            <Section title="Siguientes pruebas" items={message.diagnostic.next_steps} />
            <Section title="Herramientas" items={message.diagnostic.tools_needed} />
            <Section title="Preguntas" items={message.diagnostic.follow_up_questions} />
          </div>
        ) : (
          <div>
            <p className="whitespace-pre-wrap break-words text-[16px] leading-tight">{message.text}</p>
            {message.attachmentNames?.length ? (
              <div className="mt-2 space-y-1">
                {message.attachmentNames.map((name) => (
                  <p key={name} className="text-[12px] text-[var(--wa-text-secondary)]">
                    Archivo: {name}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <span className="mt-1 block text-right text-[10px] opacity-60">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
