"use client";

import { useState } from "react";

import { buildDocumentShareText, buildWhatsAppShareUrl, openPrintableDocument } from "@/lib/product/pro-workflows";
import type { MessageActionEvent, UiMessage } from "@/components/chat/types";

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

function QuoteLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <p className="text-[var(--wa-text-secondary)]">{label}</p>
      <p className="text-right text-[var(--wa-text-primary)]">{value}</p>
    </div>
  );
}

function WhatsAppLabel({ text = "WhatsApp" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366]">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-2.5 w-2.5 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.768.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.787-1.48-1.76-1.653-2.057-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.496.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.71.307 1.263.49 1.694.628.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347z" />
        </svg>
      </span>
      <span>{text}</span>
    </span>
  );
}

export function MessageBubble({
  message,
  onAction
}: {
  message: UiMessage;
  onAction?: (message: UiMessage, action: MessageActionEvent) => void;
}) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  function buildShareText() {
    if (message.workflowOutput) {
      return [
        "Taller",
        `Brief interno: ${message.workflowOutput.internalJobBrief}`,
        `Categoria probable: ${message.workflowOutput.likelyIssueCategory}`,
        `Siguiente diagnostico: ${message.workflowOutput.recommendedNextDiagnosticStep}`,
        message.workflowOutput.unansweredQuestions.length
          ? `Preguntas: ${message.workflowOutput.unansweredQuestions.join(" | ")}`
          : "",
        "",
        "Cliente",
        `Respuesta sugerida: ${message.workflowOutput.suggestedReply}`,
        `Siguiente paso: ${message.workflowOutput.nextStepExplanation}`
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (message.documentPreview) {
      return buildDocumentShareText(message.documentPreview.title, message.documentPreview.business, message.documentPreview.draft);
    }

    if (message.diagnostic) {
      return [
        message.diagnostic.summary,
        "",
        "Causas probables:",
        ...message.diagnostic.likely_causes.map((item) => `- ${item}`),
        "",
        "Siguientes pruebas:",
        ...message.diagnostic.next_steps.map((item) => `- ${item}`)
      ]
        .filter(Boolean)
        .join("\n");
    }

    return message.text;
  }

  async function handleCopy() {
    const textToCopy = buildShareText();

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function handleShareMessage() {
    const text = buildShareText();
    if (!text.trim()) {
      return;
    }

    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    onAction?.(message, {
      kind: message.documentPreview
        ? message.documentPreview.draft.documentType === "invoice"
          ? "invoice"
          : message.documentPreview.draft.documentType === "brief"
            ? "brief"
            : "quote"
        : message.workflowOutput
          ? "reply"
          : "reply",
      channel: "whatsapp"
    });
  }

  function handleCopyDocument() {
    if (!message.documentPreview) {
      return;
    }

    const { title, draft, business } = message.documentPreview;
    const text = buildDocumentShareText(title, business, draft);

    void navigator.clipboard.writeText(text);
    onAction?.(message, {
      kind: draft.documentType === "invoice" ? "invoice" : draft.documentType === "brief" ? "brief" : "quote",
      channel: "copy"
    });
  }

  function handleShareDocument() {
    if (!message.documentPreview) {
      return;
    }

    const { title, draft, business } = message.documentPreview;
    const text = buildDocumentShareText(title, business, draft);

    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    onAction?.(message, {
      kind: draft.documentType === "invoice" ? "invoice" : draft.documentType === "brief" ? "brief" : "quote",
      channel: "whatsapp"
    });
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
    onAction?.(message, { kind: "questions", channel: "whatsapp" });
  }

  function handleShareReply() {
    if (!message.workflowOutput) {
      return;
    }

    const text = message.workflowOutput.suggestedReply;
    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    onAction?.(message, { kind: "reply", channel: "whatsapp" });
  }

  function handleCopyReply() {
    if (!message.workflowOutput) {
      return;
    }

    const text = [message.workflowOutput.suggestedReply, `Siguiente paso: ${message.workflowOutput.nextStepExplanation}`].join("\n\n");
    void navigator.clipboard.writeText(text);
    onAction?.(message, { kind: "reply", channel: "copy" });
  }

  function handleShareReminder() {
    if (!message.workflowOutput) {
      return;
    }

    const text = message.workflowOutput.unansweredQuestions.length
      ? [
          "Te sigo este mensaje para avanzar con tu caso.",
          "Cuando puedas, mandame esto por favor:",
          ...message.workflowOutput.unansweredQuestions.map((item, index) => `${index + 1}. ${item}`)
        ].join("\n")
      : [
          "Te sigo este mensaje para avanzar con tu servicio.",
          'Si quieres que avancemos, responde "Autorizo" o mandame la info que falte.'
        ].join("\n");

    window.open(buildWhatsAppShareUrl(text), "_blank", "noopener,noreferrer");
    onAction?.(message, { kind: "reminder", channel: "whatsapp" });
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleShareMessage}
                className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                aria-label="Enviar por WhatsApp"
                title="Enviar por WhatsApp"
              >
                <WhatsAppLabel />
              </button>
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
          </div>
        ) : null}

        {message.workflowOutput ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mech-orange)]">Taller</p>
              <div className="mt-2 space-y-2 text-[14px] text-[var(--wa-text-primary)]">
                <p className="whitespace-pre-wrap">
                  <span className="font-semibold">Brief interno:</span> {message.workflowOutput.internalJobBrief}
                </p>
                <p>
                  <span className="font-semibold">Categoria probable:</span> {message.workflowOutput.likelyIssueCategory}
                </p>
                <p>
                  <span className="font-semibold">Siguiente diagnostico:</span> {message.workflowOutput.recommendedNextDiagnosticStep}
                </p>
              </div>
            </div>

            {message.workflowOutput.unansweredQuestions.length ? (
              <div className="rounded-[18px] bg-[var(--wa-bg-app)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--mech-orange)]">Preguntas por confirmar</p>
                <ul className="mt-2 space-y-1 text-[13px] text-[var(--wa-text-primary)]">
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
                    <WhatsAppLabel text="Compartir preguntas" />
                  </button>
                </div>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--taller-green)]">Cliente</p>
              <div className="mt-2 space-y-2 text-[14px] text-[var(--wa-text-primary)]">
                <p><span className="font-semibold">Respuesta sugerida:</span> {message.workflowOutput.suggestedReply}</p>
                <p>
                  <span className="font-semibold">Siguiente paso:</span> {message.workflowOutput.nextStepExplanation}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyReply}
                    className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  >
                    Copiar respuesta
                  </button>
                  <button
                    type="button"
                    onClick={handleShareReply}
                    className="rounded-full border border-[var(--wa-divider)] bg-[var(--wa-control-bg)] px-3 py-1.5 text-[11px] font-medium text-[var(--wa-text-secondary)] transition hover:bg-[var(--wa-control-bg-soft)] hover:text-[var(--wa-text-primary)]"
                  >
                    <WhatsAppLabel text="Enviar respuesta" />
                  </button>
                </div>
              </div>
            </div>

            {message.documentPreview ? (
              <div className="rounded-[18px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-3">
                <p className="text-sm font-semibold text-[var(--wa-text-primary)]">
                  Cotizacion preliminar{message.documentPreview.version ? ` • v${message.documentPreview.version}` : ""}
                </p>
                <div className="mt-2 grid gap-1 text-[12px] text-[var(--wa-text-secondary)]">
                  <p>Cliente: {message.documentPreview.draft.customerName || "Pendiente"}</p>
                  <p>Vehiculo: {message.documentPreview.draft.vehicleLabel || "Pendiente"}</p>
                  {message.documentPreview.draft.customerPhone ? <p>Telefono: {message.documentPreview.draft.customerPhone}</p> : null}
                  <p>Total preliminar: {message.documentPreview.draft.amountLabel || "Pendiente por confirmar"}</p>
                </div>
                {message.workflowOutput.quoteDraft?.intro ? (
                  <p className="mt-3 text-[13px] leading-5 text-[var(--wa-text-primary)]">{message.workflowOutput.quoteDraft.intro}</p>
                ) : null}
                {message.workflowOutput.quoteDraft?.lineItems?.length ? (
                  <div className="mt-3 space-y-2 text-[13px] text-[var(--wa-text-primary)]">
                    {message.workflowOutput.quoteDraft.lineItems.map((item) => (
                      <div key={`${item.label}-${item.totalRange}`} className="rounded-[14px] border border-[var(--wa-divider)] bg-white/60 p-3 dark:bg-white/5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-semibold">{item.label}</p>
                          <p className="shrink-0 text-right text-[12px] font-semibold text-[var(--taller-green)]">{item.totalRange}</p>
                        </div>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--wa-text-secondary)]">{item.why}</p>
                        <div className="mt-2 space-y-1">
                          <QuoteLine label="Tiempo tipico" value={item.laborHours} />
                          <QuoteLine label="Mano de obra" value={item.laborCostRange} />
                          <QuoteLine label="Refacciones" value={item.partsCostRange} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 space-y-1 text-[12px] leading-5 text-[var(--wa-text-secondary)]">
                  {message.documentPreview.draft.notes
                    .split("\n")
                    .filter(Boolean)
                    .slice(0, 8)
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
                    <WhatsAppLabel text="Enviar cotizacion" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPrintableDocument(message.documentPreview!);
                      onAction?.(message, {
                        kind:
                          message.documentPreview?.draft.documentType === "invoice"
                            ? "invoice"
                            : message.documentPreview?.draft.documentType === "brief"
                              ? "brief"
                              : "quote",
                        channel: "pdf"
                      });
                    }}
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
            {message.documentPreview && !message.workflowOutput ? (
              <div className="mt-3 rounded-[18px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] p-3">
                <p className="text-sm font-semibold text-[var(--wa-text-primary)]">
                  {message.documentPreview.title}
                  {message.documentPreview.version ? ` • v${message.documentPreview.version}` : ""}
                </p>
                <div className="mt-2 grid gap-1 text-[12px] text-[var(--wa-text-secondary)]">
                  <p>Cliente: {message.documentPreview.draft.customerName || "Pendiente"}</p>
                  <p>Vehiculo: {message.documentPreview.draft.vehicleLabel || "Pendiente"}</p>
                  {message.documentPreview.draft.customerPhone ? <p>Telefono: {message.documentPreview.draft.customerPhone}</p> : null}
                  {message.documentPreview.draft.amountLabel ? <p>Total: {message.documentPreview.draft.amountLabel}</p> : null}
                </div>
                {message.documentPreview.draft.notes ? (
                  <div className="mt-3 space-y-1 text-[12px] leading-5 text-[var(--wa-text-secondary)]">
                    {message.documentPreview.draft.notes
                      .split("\n")
                      .filter(Boolean)
                      .slice(0, 6)
                      .map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                  </div>
                ) : null}
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
                    <WhatsAppLabel text={message.documentPreview.draft.documentType === "invoice" ? "Enviar factura" : "Enviar por WhatsApp"} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openPrintableDocument(message.documentPreview!);
                      onAction?.(message, {
                        kind:
                          message.documentPreview?.draft.documentType === "invoice"
                            ? "invoice"
                            : message.documentPreview?.draft.documentType === "brief"
                              ? "brief"
                              : "quote",
                        channel: "pdf"
                      });
                    }}
                    className="rounded-full bg-[var(--taller-green)] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#138655]"
                  >
                    Descargar PDF
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <span className="mt-1 block text-right text-[10px] opacity-60">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
