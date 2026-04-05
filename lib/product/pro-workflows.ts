import type { BusinessProfile, ProDocumentDraft, ProWorkflowOutput, WorkflowQuoteDraft } from "@/types/product";
import type { DiagnosticResponse, VehicleContext } from "@/types/chat";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

export function buildSuggestedReply(
  diagnostic: DiagnosticResponse,
  draftMessage: string,
  language: "es" | "en"
) {
  if (language === "en") {
    return `Thanks for the details. Based on what you sent, the likely path is ${diagnostic.likely_causes[0] || "a mechanical inspection"} . Next we should ${diagnostic.next_steps[0] || "inspect the vehicle in person"} before confirming parts or labor.`;
  }

  return `Gracias por la info. Por lo que cuentas, la ruta mas probable apunta a ${diagnostic.likely_causes[0] || "una revision mecanica"} . El siguiente paso recomendado es ${diagnostic.next_steps[0] || "revisar el vehiculo en persona"} antes de confirmar piezas o mano de obra.`;
}

export function buildQuoteDraft(
  business: BusinessProfile | null,
  diagnostic: DiagnosticResponse
): WorkflowQuoteDraft | null {
  if (!business) {
    return null;
  }

  const lineItems: WorkflowQuoteDraft["lineItems"] = [];

  if (typeof business.default_diagnostic_fee === "number" && business.default_diagnostic_fee > 0) {
    lineItems.push({
      label: "Diagnostico inicial",
      amount: business.default_diagnostic_fee
    });
  }

  if (typeof business.labor_rate === "number" && business.labor_rate > 0) {
    lineItems.push({
      label: "Revision y pruebas iniciales",
      amount: business.labor_rate
    });
  }

  if (!lineItems.length) {
    return null;
  }

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    title: "Cotizacion preliminar",
    lineItems,
    total,
    notes: [
      diagnostic.likely_causes[0] ? `Posible area principal: ${diagnostic.likely_causes[0]}` : "",
      diagnostic.next_steps[0] ? `Siguiente paso: ${diagnostic.next_steps[0]}` : "",
      business.default_disclaimer || "Cotizacion preliminar sujeta a inspeccion y aprobacion final."
    ].filter(Boolean)
  };
}

export function buildProWorkflowOutput(input: {
  customerMessage: string;
  customerName?: string;
  vehicleLabel?: string;
  business: BusinessProfile | null;
  diagnostic: DiagnosticResponse;
  vehicle: VehicleContext | null;
  language: "es" | "en";
}): ProWorkflowOutput {
  const likelyIssueCategory = input.diagnostic.likely_causes[0] || input.diagnostic.possible_causes[0] || "Revision general";
  const nextDiagnostic = input.diagnostic.next_steps[0] || "Confirmar sintomas, revisar codigos y validar la falla en persona.";
  const quoteDraft = buildQuoteDraft(input.business, input.diagnostic);

  return {
    sourceMessage: input.customerMessage,
    customerName: input.customerName,
    vehicleLabel: input.vehicleLabel,
    clientProblemSummary: input.diagnostic.summary,
    suggestedReply: buildSuggestedReply(input.diagnostic, input.customerMessage, input.language),
    nextStepExplanation: nextDiagnostic,
    quoteDraft,
    internalJobBrief: [
      `Resumen: ${input.diagnostic.summary}`,
      `Categoria probable: ${likelyIssueCategory}`,
      `Prueba recomendada: ${nextDiagnostic}`
    ].join("\n"),
    likelyIssueCategory,
    unansweredQuestions: input.diagnostic.follow_up_questions,
    recommendedNextDiagnosticStep: nextDiagnostic,
    technicianNotes: [...input.diagnostic.tools_needed, ...input.diagnostic.safety_critical].slice(0, 8),
    rawSummary: input.diagnostic.summary
  };
}

export function createQuoteDocumentDraft(
  business: BusinessProfile,
  workflow: ProWorkflowOutput | null,
  fallbackSummary = "Revision mecanica"
): ProDocumentDraft {
  return {
    customerName: workflow?.customerName || "",
    vehicleLabel: workflow?.vehicleLabel || "",
    summary: workflow?.clientProblemSummary || fallbackSummary,
    notes: workflow?.quoteDraft?.notes.join("\n") || business.default_disclaimer || "Cotizacion preliminar sujeta a revision.",
    amount: workflow?.quoteDraft?.total || business.default_diagnostic_fee || 0
  };
}

export function createInvoiceDocumentDraft(
  business: BusinessProfile,
  workflow: ProWorkflowOutput | null
): ProDocumentDraft {
  return {
    customerName: workflow?.customerName || "",
    vehicleLabel: workflow?.vehicleLabel || "",
    summary: workflow?.clientProblemSummary || "Servicio automotriz",
    notes: business.payment_link ? `Pago: ${business.payment_link}` : business.default_disclaimer || "",
    amount: workflow?.quoteDraft?.total || business.default_diagnostic_fee || 0
  };
}

export function createBriefDocumentDraft(
  workflow: ProWorkflowOutput | null
): ProDocumentDraft {
  return {
    customerName: workflow?.customerName || "",
    vehicleLabel: workflow?.vehicleLabel || "",
    summary: workflow?.internalJobBrief || "Sin brief interno todavia.",
    notes: workflow?.technicianNotes.join("\n") || "",
    amount: 0
  };
}

function buildDocumentHtml(input: {
  title: string;
  business: BusinessProfile;
  draft: ProDocumentDraft;
  currency: string;
}) {
  const amountLine = input.draft.amount > 0 ? `<p><strong>Total:</strong> ${formatMoney(input.draft.amount, input.currency)}</p>` : "";
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${input.title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #1f2933; }
          h1 { margin: 0 0 8px; }
          .muted { color: #667781; }
          .card { border: 1px solid #d1d7db; border-radius: 16px; padding: 20px; margin-top: 20px; }
          pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
        </style>
      </head>
      <body>
        <h1>${input.title}</h1>
        <p class="muted">${input.business.business_name}</p>
        <p class="muted">${input.business.mechanic_name}</p>
        <div class="card">
          <p><strong>Cliente:</strong> ${input.draft.customerName || "Pendiente"}</p>
          <p><strong>Vehiculo:</strong> ${input.draft.vehicleLabel || "Pendiente"}</p>
          <p><strong>Resumen:</strong> ${input.draft.summary}</p>
          ${amountLine}
          <pre>${input.draft.notes || ""}</pre>
        </div>
      </body>
    </html>
  `;
}

export function openPrintableDocument(input: {
  title: string;
  business: BusinessProfile;
  draft: ProDocumentDraft;
}) {
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(
    buildDocumentHtml({
      title: input.title,
      business: input.business,
      draft: input.draft,
      currency: input.business.currency
    })
  );
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 250);
  return true;
}

export function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
