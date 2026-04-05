import type { VehicleContext } from "@/types/chat";
import type { BusinessProfile, ProDocumentDraft, ProWorkflowOutput, WorkflowQuoteDraft } from "@/types/product";
import type { CustomerQuote, DiagnosticResponse } from "@/types/chat";

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

function pickTopQuestions(questions: string[]) {
  const unique = Array.from(new Set(questions.map((item) => item.trim()).filter(Boolean)));
  return unique.slice(0, 3);
}

function extractLabeledValue(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function extractCustomerPhone(source: string) {
  const labeled = extractLabeledValue(source, [/(?:telefono|tel|whatsapp|celular)\s*:\s*([^\n]+)/i]);
  if (labeled) {
    return labeled;
  }

  const directMatch = source.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  return directMatch?.[1]?.trim() || "";
}

export function extractWorkflowContactFields(sourceMessage: string) {
  const customerName = extractLabeledValue(sourceMessage, [/(?:cliente|nombre)\s*:\s*([^\n]+)/i]);
  const vehicleLabel = extractLabeledValue(sourceMessage, [/(?:vehiculo|vehículo|auto|carro|unidad)\s*:\s*([^\n]+)/i]);
  const customerPhone = extractCustomerPhone(sourceMessage);

  return { customerName, vehicleLabel, customerPhone };
}

function parseVehicleLabel(vehicleLabel: string, vehicle?: VehicleContext | null) {
  const clean = (vehicleLabel || "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const year = vehicle?.year?.toString() || (/^(19|20)\d{2}$/.test(parts[0] || "") ? parts.shift() || "" : "");
  const make = vehicle?.make || parts.shift() || "";
  const model = vehicle?.model || parts.join(" ");

  return {
    year,
    make,
    model,
    engine: vehicle?.engine || "",
    identifier: ""
  };
}

function todayLabel() {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date());
}

function buildQuoteNumber() {
  const stamp = new Date();
  const datePart = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, "0")}${String(stamp.getDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COT-${datePart}-${randomPart}`;
}

export function buildSuggestedReply(diagnostic: DiagnosticResponse, language: "es" | "en") {
  if (language === "en") {
    const nextStep = diagnostic.next_steps[0] || "inspect it in person";
    return `Thanks for the info. The likely path points first to ${diagnostic.likely_causes[0] || "a mechanical check"}. Next step would be ${nextStep}.`;
  }

  const nextStep = diagnostic.next_steps[0] || "revisarlo en persona";
  return `Gracias por mandarme eso. Lo mas probable apunta primero a ${diagnostic.likely_causes[0] || "una revision mecanica"}. El siguiente paso seria ${nextStep}.`;
}

function getHeuristicQuoteFallback(language: "es" | "en"): WorkflowQuoteDraft {
  if (language === "en") {
    return {
      title: "Preliminary quote",
      intro: "I still need a couple of details to tighten the estimate, but this is the likely repair path.",
      totalLabel: "Pending inspection",
      lineItems: [
        {
          label: "Confirm fault and inspect affected area",
          why: "Confirm the source before locking parts or labor.",
          laborHours: "0.5 to 1.0 h",
          laborCostRange: "Varies by shop",
          partsCostRange: "Pending confirmation",
          totalRange: "Pending inspection"
        }
      ],
      notes: ["Final price is confirmed after inspection and supplier check."]
    };
  }

  return {
    title: "Cotizacion preliminar",
    intro: "Todavia faltan unos datos para cerrarla bien, pero esta es la ruta mas probable.",
    totalLabel: "Pendiente de inspeccion",
    lineItems: [
      {
        label: "Confirmar la falla y revisar la zona afectada",
        why: "Confirmar la causa antes de cerrar mano de obra o refacciones.",
        laborHours: "0.5 a 1.0 h",
        laborCostRange: "Depende del taller",
        partsCostRange: "Pendiente por confirmar",
        totalRange: "Pendiente de inspeccion"
      }
    ],
    notes: ["El precio final se confirma despues de revisar el vehiculo y validar refacciones con proveedor."]
  };
}

function buildQuoteDraftFromCustomerQuote(customerQuote: CustomerQuote, language: "es" | "en"): WorkflowQuoteDraft {
  return {
    title: language === "es" ? "Cotizacion preliminar" : "Preliminary quote",
    intro: customerQuote.intro,
    totalLabel: customerQuote.total_estimate_range,
    lineItems: customerQuote.line_items.map((item) => ({
      label: item.label,
      why: item.why,
      laborHours: item.labor_hours,
      laborCostRange: item.labor_cost_range,
      partsCostRange: item.parts_cost_range,
      totalRange: item.total_range
    })),
    notes: customerQuote.notes
  };
}

export function buildQuoteDraft(diagnostic: DiagnosticResponse, language: "es" | "en"): WorkflowQuoteDraft | null {
  if (diagnostic.customer_quote) {
    return buildQuoteDraftFromCustomerQuote(diagnostic.customer_quote, language);
  }

  return getHeuristicQuoteFallback(language);
}

function buildInternalMemo(diagnostic: DiagnosticResponse, unansweredQuestions: string[], language: "es" | "en") {
  if (language === "en") {
    return [
      `Resumen rapido: ${diagnostic.summary}`,
      `Probable: ${diagnostic.likely_causes[0] || diagnostic.possible_causes[0] || "General inspection"}`,
      `Sigue: ${diagnostic.next_steps[0] || "Confirm the fault in person."}`,
      unansweredQuestions.length ? `Falta: ${unansweredQuestions.join(" / ")}` : ""
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `Resumen rapido: ${diagnostic.summary}`,
    `Probable: ${diagnostic.likely_causes[0] || diagnostic.possible_causes[0] || "Revision general"}`,
    `Sigue: ${diagnostic.next_steps[0] || "Confirmar la falla en persona."}`,
    unansweredQuestions.length ? `Falta: ${unansweredQuestions.join(" / ")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildProWorkflowOutput(input: {
  customerMessage: string;
  customerName?: string;
  vehicleLabel?: string;
  customerPhone?: string;
  diagnostic: DiagnosticResponse;
  language: "es" | "en";
}): ProWorkflowOutput {
  const extracted = extractWorkflowContactFields(input.customerMessage);
  const unansweredQuestions = pickTopQuestions(input.diagnostic.follow_up_questions);
  const likelyIssueCategory = input.diagnostic.likely_causes[0] || input.diagnostic.possible_causes[0] || "Revision general";
  const nextDiagnostic = input.diagnostic.next_steps[0] || "Confirmar sintomas, revisar codigos y validar la falla en persona.";
  const quoteDraft = buildQuoteDraft(input.diagnostic, input.language);

  return {
    sourceMessage: input.customerMessage,
    customerName: input.customerName || extracted.customerName,
    vehicleLabel: input.vehicleLabel || extracted.vehicleLabel,
    customerPhone: input.customerPhone || extracted.customerPhone,
    clientProblemSummary: input.diagnostic.summary,
    suggestedReply: buildSuggestedReply(input.diagnostic, input.language),
    nextStepExplanation: nextDiagnostic,
    quoteDraft,
    internalJobBrief: buildInternalMemo(input.diagnostic, unansweredQuestions, input.language),
    likelyIssueCategory,
    unansweredQuestions,
    recommendedNextDiagnosticStep: nextDiagnostic,
    technicianNotes: [...input.diagnostic.tools_needed, ...input.diagnostic.safety_critical].slice(0, 8),
    rawSummary: input.diagnostic.summary
  };
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function sanitizePdfText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-");
}

function stringToPdfBytes(value: string) {
  const bytes: number[] = [];
  const safeValue = sanitizePdfText(value);
  for (let index = 0; index < safeValue.length; index += 1) {
    const code = safeValue.charCodeAt(index);
    bytes.push(code <= 255 ? code : 63);
  }
  return bytes;
}

function getQuoteLineBuckets(draft: ProDocumentDraft) {
  return {
    diagnostic: draft.diagnosticFeeLabel || "Por confirmar",
    labor: draft.laborTotalLabel || "Por confirmar",
    parts: draft.partsTotalLabel || "Por confirmar",
    other: draft.otherTotalLabel || "0",
    subtotal: draft.subtotalLabel || draft.amountLabel || "Por confirmar",
    taxes: draft.taxTotalLabel || "Por confirmar",
    total: draft.amountLabel || "Por confirmar"
  };
}

function buildShortQuoteText(business: BusinessProfile, draft: ProDocumentDraft) {
  const buckets = getQuoteLineBuckets(draft);
  return [
    "COTIZACION",
    "",
    `Negocio: ${business.business_name}`,
    `Mecanico: ${business.mechanic_name}`,
    `WhatsApp: ${business.whatsapp_number}`,
    `Fecha: ${draft.quoteDate || todayLabel()}`,
    `Cotizacion #: ${draft.quoteNumber || buildQuoteNumber()}`,
    "",
    `Cliente: ${draft.customerName || "Pendiente"}`,
    `Vehiculo: ${[draft.vehicleYear, draft.vehicleMake, draft.vehicleModel].filter(Boolean).join(" ") || draft.vehicleLabel || "Pendiente"}`,
    "",
    "Problema reportado:",
    draft.customerComplaint || draft.summary,
    "",
    "Servicio recomendado:",
    draft.recommendedService || draft.summary,
    "",
    "Incluye:",
    "",
    `Diagnostico / revision: ${buckets.diagnostic}`,
    `Mano de obra: ${buckets.labor}`,
    `Partes / refacciones: ${buckets.parts}`,
    `Otros: ${buckets.other}`,
    `Total estimado: ${buckets.total}`,
    "",
    `Tiempo estimado: ${draft.estimatedTime || "Por confirmar"}`,
    `Anticipo requerido: ${draft.depositAmountLabel || "Por confirmar"}`,
    `Enlace de pago: ${business.payment_link || "Pendiente"}`,
    "",
    "Notas:",
    ...(draft.importantNotes?.length ? draft.importantNotes : [draft.notes || "Cotizacion preliminar sujeta a revision."]),
    "",
    "Para autorizar, responde “Autorizo” o realiza el anticipo."
  ].join("\n");
}

function buildPdfLines(input: { business: BusinessProfile; draft: ProDocumentDraft }) {
  const { business, draft } = input;
  const buckets = getQuoteLineBuckets(draft);

  if (draft.documentType !== "quote") {
    return [
      draft.summary,
      draft.notes
    ].filter(Boolean);
  }

  return [
    "Mecanico AI Quote / Estimate",
    "",
    "COTIZACION / ESTIMADO DE SERVICIO",
    "",
    `Negocio: ${business.business_name}`,
    `Mecanico: ${business.mechanic_name}`,
    `WhatsApp / Telefono: ${business.whatsapp_number}`,
    `Correo: ${business.email || "Pendiente"}`,
    `Direccion: ${business.business_address || "Pendiente"}`,
    "",
    "Informacion del cliente",
    `Cliente: ${draft.customerName || "Pendiente"}`,
    `Telefono: ${draft.customerPhone || "Pendiente"}`,
    `Vehiculo: ${[draft.vehicleYear, draft.vehicleMake, draft.vehicleModel, draft.vehicleEngine].filter(Boolean).join(" ") || draft.vehicleLabel || "Pendiente"}`,
    `Placas / VIN: ${draft.vehicleIdentifier || "Pendiente"}`,
    `Fecha: ${draft.quoteDate || todayLabel()}`,
    `Cotizacion #: ${draft.quoteNumber || buildQuoteNumber()}`,
    "",
    "Resumen del problema",
    `Reporte del cliente: ${draft.customerComplaint || draft.summary}`,
    `Resumen del caso: ${draft.summary}`,
    "",
    "Servicio recomendado",
    `Servicio / diagnostico recomendado: ${draft.recommendedService || draft.summary}`,
    `Descripcion del trabajo: ${draft.serviceDescription || draft.notes.split("\n")[0] || "Pendiente"}`,
    "",
    "Conceptos",
    `Diagnostico / inspeccion: ${buckets.diagnostic}`,
    `Mano de obra: ${buckets.labor}`,
    `Refacciones / partes: ${buckets.parts}`,
    `Otros: ${buckets.other}`,
    "",
    `Subtotal: ${buckets.subtotal}`,
    `Impuestos: ${buckets.taxes}`,
    `Total estimado: ${buckets.total}`,
    "",
    "Tiempo estimado",
    `Tiempo estimado de revision / reparacion: ${draft.estimatedTime || "Por confirmar"}`,
    `Disponibilidad estimada: ${draft.availabilityEstimate || "Por confirmar"}`,
    "",
    "Pago / anticipo",
    `Anticipo requerido: ${draft.depositAmountLabel || "Por confirmar"}`,
    `Metodo de pago: ${draft.paymentMethod || "Pendiente"}`,
    `Enlace de pago: ${business.payment_link || "Pendiente"}`,
    "",
    "Notas importantes",
    ...(draft.importantNotes?.length ? draft.importantNotes : [draft.notes || "Cotizacion preliminar sujeta a revision."]),
    "",
    "Terminos",
    "Esta cotizacion es un estimado inicial con base en la informacion disponible al momento.",
    "El monto final puede cambiar si durante la inspeccion o reparacion se detectan danos, fallas o necesidades adicionales.",
    "En trabajos de diagnostico, la revision inicial no garantiza una reparacion final sin confirmar fisicamente la causa del problema.",
    "Ninguna refaccion o reparacion adicional sera realizada sin autorizacion del cliente.",
    "Los tiempos pueden variar segun disponibilidad de partes, complejidad del trabajo y validacion de la falla.",
    "",
    "Autorizacion",
    "Para autorizar este trabajo, responde a este mensaje con: “Autorizo”",
    `O realiza el anticipo en el siguiente enlace: ${business.payment_link || "Pendiente"}`,
    "",
    "Gracias",
    `Gracias por confiar en ${business.business_name}.`,
    `Si tienes preguntas, contactanos por WhatsApp: ${business.whatsapp_number}`
  ];
}

function buildPdfContent(input: { title: string; business: BusinessProfile; draft: ProDocumentDraft; currency: string }) {
  const lines = buildPdfLines({ business: input.business, draft: input.draft }).slice(0, 70);
  const operations = ["BT", "/F1 10 Tf", "40 790 Td", "12 TL"];
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
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
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

function buildQuoteNotes(quoteDraft: WorkflowQuoteDraft | null, business: BusinessProfile) {
  if (!quoteDraft) {
    return business.default_disclaimer || "Cotizacion preliminar sujeta a revision.";
  }

  const lines = [
    quoteDraft.intro,
    "",
    ...quoteDraft.lineItems.flatMap((item) => [
      item.label,
      `- ${item.why}`,
      `- Tiempo: ${item.laborHours}`,
      `- Mano de obra: ${item.laborCostRange}`,
      `- Refacciones: ${item.partsCostRange}`,
      `- Rango: ${item.totalRange}`,
      ""
    ]),
    ...quoteDraft.notes.slice(0, 3)
  ].filter(Boolean);

  return lines.join("\n");
}

function estimateTimeLabel(quoteDraft: WorkflowQuoteDraft | null) {
  if (!quoteDraft?.lineItems.length) {
    return "Por confirmar";
  }
  return quoteDraft.lineItems.map((item) => item.laborHours).filter(Boolean).join(" + ");
}

function buildDraftFromWorkflow(
  business: BusinessProfile,
  workflow: ProWorkflowOutput | null,
  vehicle?: VehicleContext | null,
  fallbackSummary = "Revision mecanica"
): ProDocumentDraft {
  const parsedVehicle = parseVehicleLabel(workflow?.vehicleLabel || "", vehicle);
  const quoteDraft = workflow?.quoteDraft ?? null;
  const firstLine = quoteDraft?.lineItems[0];
  const lineCount = quoteDraft?.lineItems.length || 0;
  const diagnosticFeeLabel =
    typeof business.default_diagnostic_fee === "number" && business.default_diagnostic_fee > 0
      ? formatMoney(business.default_diagnostic_fee, business.currency)
      : "Por confirmar";
  const laborLabel = firstLine?.laborCostRange || "Por confirmar";
  const partsLabel =
    lineCount > 1
      ? quoteDraft?.lineItems.map((item) => item.partsCostRange).filter(Boolean).join(" / ")
      : firstLine?.partsCostRange || "Por confirmar";
  const totalLabel = quoteDraft?.totalLabel || "Por confirmar";
  const notes = quoteDraft?.notes.slice(0, 3) || [business.default_disclaimer || "Cotizacion preliminar sujeta a revision."];

  return {
    documentType: "quote",
    customerName: workflow?.customerName || "",
    vehicleLabel: workflow?.vehicleLabel || "",
    customerPhone: workflow?.customerPhone || "",
    summary: workflow?.clientProblemSummary || fallbackSummary,
    notes: buildQuoteNotes(quoteDraft, business),
    amount: 0,
    amountLabel: totalLabel,
    quoteDate: todayLabel(),
    quoteNumber: buildQuoteNumber(),
    customerComplaint: workflow?.sourceMessage || workflow?.clientProblemSummary || fallbackSummary,
    recommendedService: firstLine?.label || workflow?.clientProblemSummary || fallbackSummary,
    serviceDescription: firstLine?.why || quoteDraft?.intro || workflow?.clientProblemSummary || fallbackSummary,
    diagnosticFeeLabel,
    laborTotalLabel: laborLabel,
    partsTotalLabel: partsLabel,
    otherTotalLabel: "0",
    subtotalLabel: totalLabel,
    taxTotalLabel: "Por confirmar",
    estimatedTime: estimateTimeLabel(quoteDraft),
    availabilityEstimate: "Segun disponibilidad de refacciones",
    depositAmountLabel: "Por confirmar",
    paymentMethod: business.payment_link ? "Link de pago" : "Transferencia / efectivo",
    importantNotes: notes,
    vehicleYear: parsedVehicle.year,
    vehicleMake: parsedVehicle.make,
    vehicleModel: parsedVehicle.model,
    vehicleEngine: parsedVehicle.engine,
    vehicleIdentifier: parsedVehicle.identifier
  };
}

export function createQuoteDocumentDraft(
  business: BusinessProfile,
  workflow: ProWorkflowOutput | null,
  vehicle?: VehicleContext | null,
  fallbackSummary = "Revision mecanica"
): ProDocumentDraft {
  return buildDraftFromWorkflow(business, workflow, vehicle, fallbackSummary);
}

export function createInvoiceDocumentDraft(
  business: BusinessProfile,
  workflow: ProWorkflowOutput | null,
  vehicle?: VehicleContext | null
): ProDocumentDraft {
  const base = buildDraftFromWorkflow(business, workflow, vehicle, "Servicio automotriz");
  return {
    ...base,
    documentType: "invoice",
    notes: business.payment_link ? `Pago: ${business.payment_link}` : business.default_disclaimer || ""
  };
}

export function createBriefDocumentDraft(workflow: ProWorkflowOutput | null): ProDocumentDraft {
  return {
    documentType: "brief",
    customerName: workflow?.customerName || "",
    vehicleLabel: workflow?.vehicleLabel || "",
    customerPhone: workflow?.customerPhone || "",
    summary: workflow?.internalJobBrief || "Sin brief interno todavia.",
    notes: workflow?.technicianNotes.join("\n") || "",
    amount: 0
  };
}

export function buildDocumentShareText(title: string, business: BusinessProfile, draft: ProDocumentDraft) {
  if (draft.documentType === "quote" || title.toLowerCase().includes("cotizacion")) {
    return buildShortQuoteText(business, draft);
  }

  return [
    title,
    business.business_name,
    `Cliente: ${draft.customerName || "Pendiente"}`,
    `Vehiculo: ${draft.vehicleLabel || "Pendiente"}`,
    draft.customerPhone ? `Telefono: ${draft.customerPhone}` : "",
    `Resumen: ${draft.summary}`,
    draft.amountLabel ? `Total: ${draft.amountLabel}` : "",
    draft.notes
  ]
    .filter(Boolean)
    .join("\n\n");
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
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  window.document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    if (window.navigator.userAgent.toLowerCase().includes("android")) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, 120);
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
  return true;
}

export function buildWhatsAppShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
