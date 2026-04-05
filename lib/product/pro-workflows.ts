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
    return `Thanks. The likely path points to ${diagnostic.likely_causes[0] || "a mechanical check"}. Next step: ${diagnostic.next_steps[0] || "inspect it in person"} before locking parts or labor.`;
  }

  return `Gracias. Lo mas probable apunta a ${diagnostic.likely_causes[0] || "una revision mecanica"}. Siguiente paso: ${diagnostic.next_steps[0] || "revisar el vehiculo en persona"} antes de cerrar piezas o mano de obra.`;
}

function getLikelyWorkExplanation(diagnostic: DiagnosticResponse, language: "es" | "en") {
  const likelyCause = diagnostic.likely_causes[0] || diagnostic.possible_causes[0] || (language === "es" ? "la falla reportada" : "the reported issue");
  const nextStep = diagnostic.next_steps[0] || (language === "es" ? "confirmar la falla con pruebas en sitio" : "confirm the fault with hands-on testing");

  if (language === "en") {
    return {
      repair: `The most likely path is to inspect and correct the area related to ${likelyCause}.`,
      why: `This is recommended because the current symptoms point there first, and the next best step is to ${nextStep}.`
    };
  }

  return {
    repair: `Lo mas probable es trabajar el area de ${likelyCause}.`,
    why: `Se recomienda por los sintomas que trae y porque el siguiente paso util es ${nextStep}.`
  };
}

export function buildQuoteDraft(
  business: BusinessProfile | null,
  diagnostic: DiagnosticResponse,
  language: "es" | "en"
): WorkflowQuoteDraft | null {
  if (!business) {
    return null;
  }

  const lineItems: WorkflowQuoteDraft["lineItems"] = [];
  const explanation = getLikelyWorkExplanation(diagnostic, language);

  if (typeof business.default_diagnostic_fee === "number" && business.default_diagnostic_fee > 0) {
    lineItems.push({
      label: language === "es" ? "Revision inicial" : "Initial inspection",
      amount: business.default_diagnostic_fee,
      detail: language === "es" ? "Confirmar la falla y revisar la zona afectada." : "Confirm the fault and inspect the affected area.",
      timing: language === "es" ? "30 a 60 min" : "30 to 60 min"
    });
  }

  if (typeof business.labor_rate === "number" && business.labor_rate > 0) {
    lineItems.push({
      label: language === "es" ? "Pruebas y plan de reparacion" : "Testing and repair plan",
      amount: business.labor_rate,
      detail: language === "es" ? explanation.repair : explanation.repair,
      timing: language === "es" ? "1.0 h" : "1.0 h"
    });
  }

  if (!lineItems.length) {
    return null;
  }

  const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

  return {
    title: language === "es" ? "Cotizacion preliminar" : "Preliminary quote",
    lineItems,
    total,
    notes: [
      language === "es" ? `Trabajo probable: ${explanation.repair}` : `Likely work: ${explanation.repair}`,
      language === "es" ? `Por que: ${explanation.why}` : `Why: ${explanation.why}`,
      language === "es"
        ? "Refacciones en tu zona: se cotizan con proveedor local al confirmar la falla y la pieza correcta."
        : "Typical parts cost in your area: confirmed with a local supplier before final approval.",
      language === "es"
        ? "Tiempo tipico por etapa: revision inicial 30 a 60 min; pruebas y plan 1.0 h; reparacion final depende de acceso y refacciones."
        : "Typical time by step: initial confirmation 30 to 60 min; testing and prep about 1.0 h; final repair depends on access and parts.",
      business.default_disclaimer || (language === "es" ? "Cotizacion preliminar sujeta a inspeccion y aprobacion final." : "Preliminary quote subject to inspection and final approval.")
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
  const quoteDraft = buildQuoteDraft(input.business, input.diagnostic, input.language);

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
      `Categoria: ${likelyIssueCategory}`,
      `Siguiente prueba: ${nextDiagnostic}`
    ].join("\n"),
    likelyIssueCategory,
    unansweredQuestions: input.diagnostic.follow_up_questions,
    recommendedNextDiagnosticStep: nextDiagnostic,
    technicianNotes: [...input.diagnostic.tools_needed, ...input.diagnostic.safety_critical].slice(0, 8),
    rawSummary: input.diagnostic.summary
  };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function stringToPdfBytes(value: string) {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes.push(code <= 255 ? code : 63);
  }
  return bytes;
}

function buildPdfContent(input: { title: string; business: BusinessProfile; draft: ProDocumentDraft; currency: string }) {
  const lines = [
    input.title,
    input.business.business_name,
    input.business.mechanic_name,
    "",
    `Cliente: ${input.draft.customerName || "Pendiente"}`,
    `Vehiculo: ${input.draft.vehicleLabel || "Pendiente"}`,
    `Resumen: ${input.draft.summary}`,
    input.draft.amount > 0 ? `Total preliminar: ${formatMoney(input.draft.amount, input.currency)}` : "",
    "",
    ...input.draft.notes.split("\n")
  ]
    .filter(Boolean)
    .slice(0, 38);

  const operations = ["BT", "/F1 12 Tf", "50 780 Td", "14 TL"];
  lines.forEach((line, index) => {
    const escaped = escapePdfText(line);
    operations.push(index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`);
  });
  operations.push("ET");
  return operations.join("\n");
}

function buildPdfBlob(input: { title: string; business: BusinessProfile; draft: ProDocumentDraft; currency: string }) {
  const content = buildPdfContent(input);
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${stringToPdfBytes(content).length} >> stream\n${content}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj"
  ];

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [];
  let position = stringToPdfBytes(header).length;

  objects.forEach((object) => {
    offsets.push(position);
    const block = `${object}\n`;
    body += block;
    position += stringToPdfBytes(block).length;
  });

  const xrefStart = position;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF"
  ].join("\n");

  const bytes = new Uint8Array([...stringToPdfBytes(header + body + xref)]);
  return new Blob([bytes], { type: "application/pdf" });
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
  const blob = buildPdfBlob({
    title: input.title,
    business: input.business,
    draft: input.draft,
    currency: input.business.currency
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${input.title.toLowerCase().replace(/\s+/g, "-") || "documento"}.pdf`;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  return true;
}

export function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
