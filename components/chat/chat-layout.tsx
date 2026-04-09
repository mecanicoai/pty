"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { PricingSheet } from "@/components/billing/pricing-sheet";
import { ChatPanel } from "@/components/chat/chat-panel";
import type { MessageActionEvent, UiMessage } from "@/components/chat/types";
import { ModeSelectionScreen } from "@/components/product/mode-selection-screen";
import { BusinessSetupDrawer } from "@/components/pro/business-setup-drawer";
import { CustomerMessageWorkspace } from "@/components/pro/customer-message-workspace";
import { DocumentWorkspace } from "@/components/pro/document-workspace";
import { SessionList } from "@/components/sidebar/session-list";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { createEmptyUsageSnapshot, PLAN_DEFINITIONS, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import {
  activateTestPlan,
  clearStoredInstallSession,
  ensureInstallToken,
  getStoredPlan,
  getStoredUsage,
  isTestPlanOverrideEnabled,
  registerNativeInstallBridge,
  storeInstallToken,
  storeUsageSnapshot
} from "@/lib/chat/install-auth";
import { nativeBridgeEvents, openExternalUrl, registerNativeMediaBridge, type SharedIntentPayload } from "@/lib/chat/native-bridge";
import { createDefaultProCase, createLocalSession, loadLocalSessions, saveLocalSessions, type LocalChatSession } from "@/lib/chat/local-store";
import {
  getBusinessProfile,
  getLastVehicleContext,
  getLastWorkflowOutput,
  getLocalModelOverride,
  getSelectedMode,
  getSelectedPlan,
  setBusinessProfile,
  setLastVehicleContext as persistLastVehicleContext,
  setLastWorkflowOutput,
  setLocalModelOverride,
  setSelectedMode,
  setSelectedPlan,
  clearLocalModelOverride,
  clearSelectedMode,
  clearSelectedPlan
} from "@/lib/product/local-store";
import {
  buildWhatsAppShareUrl,
  buildProWorkflowOutput,
  extractWorkflowContactFields,
  createBriefDocumentDraft,
  createInvoiceDocumentDraft,
  createQuoteDocumentDraft
} from "@/lib/product/pro-workflows";
import { VehicleIntakeDrawer } from "@/components/intake/vehicle-intake-drawer";
import type { ApiErrorResponse, ChatHistoryItem, ChatRequestPayload, ChatResponse } from "@/types/api";
import type { AppLanguage, ChatAttachment, DiagnosticResponse, VehicleContext } from "@/types/chat";
import type {
  AppExperienceMode,
  BusinessProfile,
  ProCaseRecord,
  ProPipelineStage,
  ProCaseStatus,
  ProSentRecord,
  ProWorkflowOutput,
  ProWorkspaceView
} from "@/types/product";

const PREF_KEYS = {
  darkMode: "mecanico-ui-dark",
  language: "mecanico-ui-language",
  activeSessionId: "mecanico-active-session-id"
} as const;

const LOCAL_MODEL_OPTIONS = [
  { value: "", label: "Default (.env.local)" },
  { value: "gpt-5.4-mini-2026-03-17", label: "gpt-5.4-mini-2026-03-17" },
  { value: "gpt-5-mini", label: "gpt-5-mini" }
] as const;

function canUseLocalModelSwitcher() {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

function getDefaultSessionTitle(language: AppLanguage, experienceMode: AppExperienceMode) {
  if (experienceMode === "pro") {
    return language === "es" ? "Nuevo cliente" : "New customer";
  }
  return language === "es" ? "Nuevo chat" : "New chat";
}

function getWelcomeMessage(language: AppLanguage, experienceMode: AppExperienceMode, plan: SubscriptionPlan) {
  if (experienceMode === "pro") {
    return language === "es"
      ? "Soy tu asistente mecanico y tu maestro para diagnosticar. Pasa el mensaje del cliente, la falla o el vehiculo y te ayudo a bajarlo a triage, siguiente paso y trabajo aprobado. ¿Como te ayudo?"
      : "I am your mechanic assistant and lead diagnostic guide. Send the customer message, fault, or vehicle details and I will help turn it into triage, next steps, and approved work.";
  }

  if (plan === "basic") {
    return language === "es"
      ? "Vamos a aterrizar esa falla paso a paso. Dime el ano, marca, modelo y el sintoma exacto para darte una ruta DIY mas profunda."
      : "Let's narrow the problem down step by step. Tell me the year, make, model, and exact symptom for deeper DIY guidance.";
  }

  return language === "es"
    ? "Dime el ano, marca, modelo y la falla detallada del vehiculo para ayudarte a entender mejor que revisar."
    : "Tell me the year, make, model, and the detailed issue so I can help you understand what to check first.";
}

function getEntryWelcomeMessage(language: AppLanguage, experienceMode: AppExperienceMode, plan: SubscriptionPlan) {
  if (experienceMode === "pro") {
    return language === "es"
      ? "Soy tu asistente del taller. Arranca con un ingreso, una captura o una cotizacion."
      : "I am your shop assistant. Start with an intake, a screenshot, or a quote.";
  }

  return getWelcomeMessage(language, experienceMode, plan);
}

function getPlanUsageLabel(language: AppLanguage, plan: SubscriptionPlan, usage: PlanUsageSnapshot) {
  if (language === "en") {
    if (plan === "free") {
      return `${usage.totalRemaining ?? 0} of 5 free questions left`;
    }
    if (plan === "basic") {
      return `${usage.dayRemaining ?? 0} of 10 questions left today`;
    }
    return "Unlimited use plus voice and uploads";
  }

  if (plan === "free") {
    return `${usage.totalRemaining ?? 0} de 5 preguntas gratis restantes`;
  }
  if (plan === "basic") {
    return `${usage.dayRemaining ?? 0} de 10 preguntas restantes hoy`;
  }
  return "Uso ilimitado mas voz y archivos";
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    }
  });
  const data = (await response.json().catch(() => ({}))) as ApiErrorResponse & Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "No se pudo completar la solicitud.") as Error & {
      status?: number;
      code?: string;
      requestId?: string;
      details?: unknown;
    };
    error.status = response.status;
    error.code = typeof data.code === "string" ? data.code : undefined;
    error.requestId = typeof data.requestId === "string" ? data.requestId : undefined;
    error.details = data.details;
    throw error;
  }
  return data as T;
}

function deriveTitle(message: string, vehicle: VehicleContext | null, language: AppLanguage, experienceMode: AppExperienceMode) {
  if (vehicle?.year || vehicle?.make || vehicle?.model) {
    return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || getDefaultSessionTitle(language, experienceMode);
  }

  const clean = message.replace(/\s+/g, " ").trim();
  return clean.slice(0, 48) || getDefaultSessionTitle(language, experienceMode);
}

function buildProSessionTitle(language: AppLanguage, customerName?: string, vehicleLabel?: string, fallbackMessage?: string) {
  const cleanCustomer = customerName?.trim() || "";
  const cleanVehicle = vehicleLabel?.trim() || "";

  if (cleanCustomer && cleanVehicle) {
    return `${cleanVehicle} • ${cleanCustomer}`;
  }
  if (cleanVehicle) {
    return cleanVehicle;
  }
  if (cleanCustomer) {
    return cleanCustomer;
  }
  if (fallbackMessage?.trim()) {
    return fallbackMessage.trim().slice(0, 48);
  }
  return getDefaultSessionTitle(language, "pro");
}

function getDefaultProCaseRecord(): ProCaseRecord {
  return createDefaultProCase();
}

function appendSentRecord(history: ProSentRecord[], entry: ProSentRecord) {
  return [entry, ...history].slice(0, 12);
}

function getStatusLabel(language: AppLanguage, status: ProCaseStatus) {
  if (language === "en") {
    switch (status) {
      case "missing_info":
        return "Missing info";
      case "waiting_customer":
        return "Waiting on customer";
      case "quoted":
        return "Quoted";
      case "approved":
        return "Approved";
      case "in_progress":
        return "In progress";
      case "delivered":
        return "Delivered";
      default:
        return "New case";
    }
  }

  switch (status) {
    case "missing_info":
      return "Falta info";
    case "waiting_customer":
      return "Esperando cliente";
    case "quoted":
      return "Cotizado";
    case "approved":
      return "Aprobado";
    case "in_progress":
      return "En trabajo";
    case "delivered":
      return "Entregado";
    default:
      return "Nuevo";
  }
}

function getPipelineStageFromStatus(status: ProCaseStatus): ProPipelineStage {
  switch (status) {
    case "waiting_customer":
    case "quoted":
      return "quoted";
    case "approved":
    case "in_progress":
      return "scheduled";
    case "delivered":
      return "completed";
    default:
      return "diagnosis";
  }
}

function getPipelineStageLabel(language: AppLanguage, stage: ProPipelineStage) {
  if (language === "en") {
    switch (stage) {
      case "diagnosis":
        return "Diagnosis";
      case "quoted":
        return "Quoted";
      case "scheduled":
        return "Scheduled";
      case "completed":
        return "Completed";
    }
  }

  switch (stage) {
    case "diagnosis":
      return "Diagnostico";
    case "quoted":
      return "Cotizado";
    case "scheduled":
      return "Agendado";
    case "completed":
      return "Completado";
  }
}

function getPipelineStatusFromStage(stage: ProPipelineStage, existing: ProCaseRecord | null | undefined): ProCaseStatus {
  if (stage === "diagnosis") {
    return existing?.missingFields?.length ? "missing_info" : "new";
  }
  if (stage === "quoted") {
    return existing?.pendingQuestions?.length ? "waiting_customer" : "quoted";
  }
  if (stage === "scheduled") {
    return "approved";
  }
  return "delivered";
}

function getPipelineRank(status: ProCaseStatus) {
  switch (getPipelineStageFromStatus(status)) {
    case "diagnosis":
      return 0;
    case "quoted":
      return 1;
    case "scheduled":
      return 2;
    case "completed":
      return 3;
  }
}

function mergeWorkflowStatus(currentStatus: ProCaseStatus, nextStatus: ProCaseStatus) {
  return getPipelineRank(currentStatus) > getPipelineRank(nextStatus) ? currentStatus : nextStatus;
}

function getNextProStatus(workflow: ProWorkflowOutput): ProCaseStatus {
  if (workflow.unansweredQuestions.length) {
    return "waiting_customer";
  }
  if (workflow.quoteDraft) {
    return "quoted";
  }
  return "new";
}

function isApprovalMessage(message: string) {
  return /\bautorizo\b/i.test(message) || /\bapproved?\b/i.test(message);
}

function getManualPipelineStageFromMessage(message: string): ProPipelineStage | null {
  const value = message.toLowerCase();
  if (/\b(diagnostico|diagnosis|triage|en diagnostico)\b/i.test(value)) {
    return "diagnosis";
  }
  if (/\b(cotizado|cotizacion enviada|quoted?|quote)\b/i.test(value)) {
    return "quoted";
  }
  if (/\b(agendado|agendada|programado|programada|scheduled?)\b/i.test(value)) {
    return "scheduled";
  }
  if (/\b(completado|completada|terminado|terminada|entregado|entregada|completed|done)\b/i.test(value)) {
    return "completed";
  }
  return null;
}

function isPaidMessage(message: string) {
  return /\b(pagado|pagada|paid|cobrado|cobrada)\b/i.test(message);
}

type DocumentIntent = "quote" | "invoice" | "brief";

function getDocumentIntent(message: string): DocumentIntent | null {
  const value = message.toLowerCase();

  if (/\b(cotizacion|cotiza|cotizar|quote|estimate|estimado|presupuesto)\b/i.test(value)) {
    return "quote";
  }
  if (/\b(factura|invoice|cobro|bill)\b/i.test(value)) {
    return "invoice";
  }
  if (/\b(brief|memo interno|brief interno|internal brief|job brief)\b/i.test(value)) {
    return "brief";
  }

  return null;
}

function buildCustomerReminderText(session: LocalChatSession, workflow: ProWorkflowOutput | null) {
  if (workflow?.unansweredQuestions.length) {
    return [
      "Te sigo este mensaje para avanzar con tu diagnostico.",
      "Cuando puedas, mandame esto por favor:",
      ...workflow.unansweredQuestions.map((item, index) => `${index + 1}. ${item}`)
    ].join("\n");
  }

  if (session.proCase?.quoteVersion) {
    return [
      "Te sigo este mensaje para avanzar con tu cotizacion.",
      'Si quieres que avancemos, responde "Autorizo" o mandame la info que falte.'
    ].join("\n");
  }

  return "Te sigo este mensaje para avanzar con tu caso. Cuando puedas, respondeme por aqui.";
}

function getModeForPlan(plan: SubscriptionPlan): AppExperienceMode {
  return plan === "pro" ? "pro" : "diy";
}

function buildHistory(messages: UiMessage[]): ChatHistoryItem[] {
  return messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.workflowOutput
      ? [
          `Resumen cliente: ${message.workflowOutput.clientProblemSummary}`,
          `Brief interno: ${message.workflowOutput.internalJobBrief}`,
          message.workflowOutput.unansweredQuestions.length
            ? `Preguntas pendientes: ${message.workflowOutput.unansweredQuestions.join(" | ")}`
            : "",
          message.workflowOutput.quoteDraft
            ? `Cotizacion preliminar: ${message.workflowOutput.quoteDraft.totalLabel}. ${message.workflowOutput.quoteDraft.intro}`
            : ""
        ]
          .filter(Boolean)
          .join("\n")
      : message.diagnostic?.summary || message.text,
    createdAt: message.createdAt,
    usedWebSearch: message.usedWebSearch
  }));
}

function normalizeMessageForDisplay(language: AppLanguage, payloadMessage: string) {
  if (language === "es" && payloadMessage === "Subir foto del problema") {
    return "Aqui va la foto del problema.";
  }
  return payloadMessage;
}

function buildProActionPrompt(language: AppLanguage) {
  return language === "es"
    ? [
        "Para arrancar, mandame esto en el chat:",
        "Cliente: Nombre del cliente",
        "Vehiculo: Ano marca modelo",
        "Telefono: WhatsApp o celular",
        "Mensaje: Texto del cliente o resumen de su nota de voz"
      ].join("\n")
    : [
        "To start, send this in chat:",
        "Customer: Customer name",
        "Vehicle: Year make model",
        "Phone: WhatsApp or cell",
        "Message: Customer text or voice note summary"
      ].join("\n");
}

interface TriageLeadDraft {
  customerName: string;
  vehicleLabel: string;
  customerPhone: string;
  customerMessage: string;
}

interface PendingImportedLead {
  targetSessionId: string;
  draft: TriageLeadDraft;
  attachments: ChatAttachment[];
  sourceApp?: string;
}

function getMissingTriageFields(messageText: string) {
  const fields = extractWorkflowContactFields(messageText);
  const missing: string[] = [];

  if (!fields.customerName) {
    missing.push("Cliente");
  }
  if (!fields.vehicleLabel) {
    missing.push("Vehiculo");
  }
  if (!fields.customerPhone) {
    missing.push("Telefono");
  }

  return { fields, missing };
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

function getMissingLeadFields(draft: TriageLeadDraft, requireMessage = true) {
  const missing: string[] = [];

  if (!draft.customerName.trim()) {
    missing.push("Cliente");
  }
  if (!draft.vehicleLabel.trim()) {
    missing.push("Vehiculo");
  }
  if (!draft.customerPhone.trim()) {
    missing.push("Telefono");
  }
  if (requireMessage && !draft.customerMessage.trim()) {
    missing.push("Mensaje");
  }

  return missing;
}

function buildLeadMessage(draft: TriageLeadDraft, options?: { hasAttachments?: boolean; language?: AppLanguage }) {
  const hasAttachments = Boolean(options?.hasAttachments);
  const language = options?.language ?? "es";
  const messageText =
    draft.customerMessage.trim() ||
    (hasAttachments ? (language === "es" ? "Captura del cliente adjunta." : "Customer screenshot attached.") : "");

  return [
    `Cliente: ${draft.customerName.trim()}`,
    `Vehiculo: ${draft.vehicleLabel.trim()}`,
    `Telefono: ${draft.customerPhone.trim()}`,
    messageText ? `Mensaje: ${messageText}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function appendExtractedTextToLeadMessage(message: string, extractedText: string, language: AppLanguage) {
  const clean = extractedText.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) {
    return message;
  }

  return [
    message,
    "",
    language === "es" ? "Texto extraido de la captura:" : "Extracted screenshot text:",
    clean
  ].join("\n");
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const commaIndex = raw.indexOf(",");
      if (commaIndex < 0) {
        reject(new Error("No se pudo procesar el archivo."));
        return;
      }
      resolve(raw.slice(commaIndex + 1));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

async function buildScreenshotAttachment(file: File | null): Promise<ChatAttachment[]> {
  if (!file) {
    return [];
  }

  const dataBase64 = await readFileAsBase64(file);
  return [
    {
      name: file.name,
      mimeType: file.type || "image/png",
      kind: "image",
      dataBase64
    }
  ];
}

export function ChatLayout() {
  const [language, setLanguage] = useState<AppLanguage>("es");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sessions, setSessions] = useState<LocalChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingReply, setLoadingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [businessModalOpen, setBusinessModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [pricingOpen, setPricingOpen] = useState(false);
  const [activatingPlan, setActivatingPlan] = useState<SubscriptionPlan | null>(null);
  const [launchSelectionLoading, setLaunchSelectionLoading] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [installLoading, setInstallLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [usage, setUsage] = useState<PlanUsageSnapshot>(createEmptyUsageSnapshot("free"));
  const [selectedMode, setSelectedModeState] = useState<AppExperienceMode | null>(null);
  const [businessProfile, setBusinessProfileState] = useState<BusinessProfile | null>(null);
  const [proView, setProView] = useState<ProWorkspaceView>("chat");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowOutput, setWorkflowOutput] = useState<ProWorkflowOutput | null>(null);
  const [lastVehicleContext, setLastVehicleContextState] = useState<VehicleContext | null>(null);
  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [triageDraft, setTriageDraft] = useState<TriageLeadDraft>({
    customerName: "",
    vehicleLabel: "",
    customerPhone: "",
    customerMessage: ""
  });
  const [triageAttachments, setTriageAttachments] = useState<ChatAttachment[]>([]);
  const [importLeadModalOpen, setImportLeadModalOpen] = useState(false);
  const [importLeadDraft, setImportLeadDraft] = useState<TriageLeadDraft>({
    customerName: "",
    vehicleLabel: "",
    customerPhone: "",
    customerMessage: ""
  });
  const [importLeadAttachments, setImportLeadAttachments] = useState<ChatAttachment[]>([]);
  const [importLeadSourceApp, setImportLeadSourceApp] = useState<string | undefined>(undefined);
  const [importLeadSessionId, setImportLeadSessionId] = useState<string | null>(null);
  const [pendingImportedLead, setPendingImportedLead] = useState<PendingImportedLead | null>(null);
  const [pendingSharedIntent, setPendingSharedIntent] = useState<SharedIntentPayload | null>(null);
  const [localModelSwitcherEnabled, setLocalModelSwitcherEnabled] = useState(false);
  const [localModelOverride, setLocalModelOverrideState] = useState("");
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  const currentChatExperienceMode: AppExperienceMode = selectedMode === "pro" ? "pro" : "diy";
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.experienceMode === currentChatExperienceMode),
    [sessions, currentChatExperienceMode]
  );

  const activeSession = useMemo(
    () => visibleSessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, visibleSessions]
  );
  const activeWorkflow = useMemo(() => getLatestWorkflowFromSession(activeSession) ?? workflowOutput, [activeSession, workflowOutput]);
  const activeProCase = activeSession?.experienceMode === "pro" ? activeSession.proCase ?? getDefaultProCaseRecord() : null;
  const activeTitle =
    activeSession?.experienceMode === "pro"
      ? buildProSessionTitle(language, activeSession.customerName, activeSession.vehicleLabel, activeSession.title)
      : activeSession?.title || getDefaultSessionTitle(language, currentChatExperienceMode);
  const filteredVisibleSessions = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) {
      return visibleSessions;
    }

    return visibleSessions.filter((session) =>
      [session.title, session.customerName, session.customerPhone, session.vehicleLabel, session.vehicle?.make, session.vehicle?.model]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [historySearch, visibleSessions]);

  const displayedMessages = useMemo<UiMessage[]>(() => {
    if (activeSession?.messages.length) {
      return activeSession.messages;
    }

    if (currentChatExperienceMode === "diy") {
      return [];
    }

    return [
      {
        id: `welcome-${currentChatExperienceMode}`,
        role: "assistant",
        text: getEntryWelcomeMessage(language, currentChatExperienceMode, plan),
        createdAt: ""
      }
    ];
  }, [activeSession?.messages, currentChatExperienceMode, language, plan]);

  const showDiyHome = currentChatExperienceMode === "diy" && !activeSession?.messages.length;

  useEffect(() => {
    const savedDark = localStorage.getItem(PREF_KEYS.darkMode);
    const savedLanguage = localStorage.getItem(PREF_KEYS.language);
    const savedActiveSessionId = localStorage.getItem(PREF_KEYS.activeSessionId);
    const localSessions = loadLocalSessions();
    const persistedMode = getSelectedMode();
    const persistedSelectedPlan = getSelectedPlan();

    if (savedDark === "true") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    const nextLanguage = savedLanguage === "en" ? "en" : "es";
    setLanguage(nextLanguage);
    setPlan(persistedSelectedPlan ?? getStoredPlan());
    setUsage(getStoredUsage());
    setLocalModelSwitcherEnabled(canUseLocalModelSwitcher());
    setLocalModelOverrideState(getLocalModelOverride());
    setSelectedModeState(persistedMode ?? (persistedSelectedPlan ? getModeForPlan(persistedSelectedPlan) : null));
    setBusinessProfileState(getBusinessProfile());
    setWorkflowOutput(getLastWorkflowOutput());
    setLastVehicleContextState(getLastVehicleContext());

    if (localSessions.length) {
      setSessions(localSessions);
      setActiveSessionId(savedActiveSessionId && localSessions.some((item) => item.id === savedActiveSessionId) ? savedActiveSessionId : localSessions[0].id);
    } else if (persistedMode) {
      const first = createLocalSession(nextLanguage, persistedMode);
      setSessions([first]);
      setActiveSessionId(first.id);
      saveLocalSessions([first]);
    }

    setLoadingInit(false);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem(PREF_KEYS.darkMode, String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem(PREF_KEYS.language, language);
  }, [language]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(PREF_KEYS.activeSessionId, activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (!loadingInit) {
      saveLocalSessions(sessions);
    }
  }, [loadingInit, sessions]);

  useEffect(() => {
    if (loadingInit || !selectedMode) {
      return;
    }

    const matching = sessions.filter((session) => session.experienceMode === selectedMode);
    if (matching.length === 0) {
      const fresh = createLocalSession(language, selectedMode);
      setSessions((prev) => [fresh, ...prev]);
      setActiveSessionId(fresh.id);
      return;
    }

    if (!matching.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(matching[0].id);
    }
  }, [activeSessionId, language, loadingInit, selectedMode, sessions]);

  useEffect(() => {
    let cancelled = false;
    registerNativeInstallBridge();
    registerNativeMediaBridge();

    async function bootstrapInstallSession() {
      try {
        await ensureInstallToken();
        if (!cancelled) {
          setInstallReady(true);
          setError(null);
          setPlan(getStoredPlan());
          setUsage(getStoredUsage());
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar la sesion del dispositivo.");
        }
      } finally {
        if (!cancelled) {
          setInstallLoading(false);
        }
      }
    }

    void bootstrapInstallSession();

    const handleTokenReady = () => {
      if (!cancelled) {
        setInstallReady(true);
        setInstallLoading(false);
        setError(null);
        setPlan(getStoredPlan());
        setUsage(getStoredUsage());
      }
    };

    const handleUsageUpdated = () => {
      if (!cancelled) {
        setUsage(getStoredUsage());
      }
    };

    window.addEventListener("mecanico-install-token-ready", handleTokenReady);
    window.addEventListener("mecanico-install-usage-updated", handleUsageUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("mecanico-install-token-ready", handleTokenReady);
      window.removeEventListener("mecanico-install-usage-updated", handleUsageUpdated);
    };
  }, []);

  useEffect(() => {
    if (loadingInit || installLoading || launchSelectionLoading) {
      return;
    }

    const selectedPlan = getSelectedPlan();
    if (!selectedPlan || selectedPlan === getStoredPlan()) {
      return;
    }

    if (!isTestPlanOverrideEnabled()) {
      return;
    }

    void applyLaunchPlanSelection(selectedPlan);
  }, [installLoading, launchSelectionLoading, loadingInit]);

  useEffect(() => {
    function handleSharedIntent(event: Event) {
      const detail = (event as CustomEvent<SharedIntentPayload>).detail;
      if (!detail) {
        return;
      }

      if (!businessProfile) {
        setPendingSharedIntent(detail);
        setSelectedMode("pro");
        setSelectedModeState("pro");
        setBusinessModalOpen(true);
        return;
      }

      const extracted = extractWorkflowContactFields(detail.sharedText || "");
      const normalizedPhone = normalizePhone(extracted.customerPhone || "");
      const proSessions = sessions.filter((session) => session.experienceMode === "pro");
      const matchedSession =
        normalizedPhone
          ? proSessions.find((session) => normalizePhone(session.customerPhone || "") === normalizedPhone)
          : null;
      const matchedVehicleLabel =
        matchedSession?.vehicleLabel ||
        [matchedSession?.vehicle?.year, matchedSession?.vehicle?.make, matchedSession?.vehicle?.model].filter(Boolean).join(" ");

      if (selectedMode !== "pro") {
        setSelectedMode("pro");
        setSelectedModeState("pro");
      }

      let targetSessionId = matchedSession?.id || "";
      if (matchedSession) {
        targetSessionId = matchedSession.id;
        setActiveSessionId(matchedSession.id);
      } else {
        const fresh = createLocalSession(language, "pro");
        fresh.customerPhone = extracted.customerPhone || "";
        fresh.customerName = extracted.customerName || "";
        fresh.vehicleLabel = extracted.vehicleLabel || "";
        fresh.title = buildProSessionTitle(language, fresh.customerName, fresh.vehicleLabel);
        targetSessionId = fresh.id;
        setSessions((prev) => [fresh, ...prev]);
        setActiveSessionId(fresh.id);
      }

      setPendingImportedLead({
        targetSessionId,
        draft: {
          customerName: extracted.customerName || matchedSession?.customerName || "",
          vehicleLabel: extracted.vehicleLabel || matchedVehicleLabel || "",
          customerPhone: extracted.customerPhone || matchedSession?.customerPhone || "",
          customerMessage: detail.sharedText || ""
        },
        attachments: detail.attachments || [],
        sourceApp: detail.sourceApp
      });
    }

    window.addEventListener(nativeBridgeEvents.sharedIntent, handleSharedIntent);
    if (typeof window !== "undefined" && window.__mecanicoPendingSharedIntent) {
      const pendingDetail = window.__mecanicoPendingSharedIntent as SharedIntentPayload;
      window.__mecanicoPendingSharedIntent = undefined;
      window.dispatchEvent(new CustomEvent(nativeBridgeEvents.sharedIntent, { detail: pendingDetail }));
    }
    return () => {
      window.removeEventListener(nativeBridgeEvents.sharedIntent, handleSharedIntent);
    };
  }, [businessProfile, language, selectedMode, sessions]);

  useEffect(() => {
    if (!pendingSharedIntent || !businessProfile) {
      return;
    }

    const detail = pendingSharedIntent;
    setPendingSharedIntent(null);
    window.dispatchEvent(new CustomEvent(nativeBridgeEvents.sharedIntent, { detail }));
  }, [businessProfile, pendingSharedIntent]);

  function updateSessionById(sessionId: string | null, mutator: (session: LocalChatSession) => LocalChatSession) {
    if (!sessionId) {
      return;
    }

    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }
        return mutator(session);
      })
    );
  }

  function updateActiveSession(mutator: (session: LocalChatSession) => LocalChatSession) {
    updateSessionById(activeSessionId, mutator);
  }

  function recordSessionAction(sessionId: string | null, action: ProSentRecord) {
    updateSessionById(sessionId, (session) => {
      if (session.experienceMode !== "pro") {
        return session;
      }

      const proCase = session.proCase ?? getDefaultProCaseRecord();
      return {
        ...session,
        proCase: {
          ...proCase,
          lastSentAt: action.at,
          lastSentLabel: action.label,
          sentHistory: appendSentRecord(proCase.sentHistory, action)
        },
        updatedAt: action.at
      };
    });
  }

  function setProSessionStatus(sessionId: string | null, status: ProCaseStatus) {
    updateSessionById(sessionId, (session) => {
      if (session.experienceMode !== "pro") {
        return session;
      }

      const now = new Date().toISOString();
      const proCase = session.proCase ?? getDefaultProCaseRecord();
      return {
        ...session,
        proCase: {
          ...proCase,
          status,
          approvedAt: status === "approved" ? now : proCase.approvedAt,
          scheduledAt: status === "approved" || status === "in_progress" ? now : proCase.scheduledAt,
          completedAt: status === "delivered" ? now : proCase.completedAt
        },
        updatedAt: now
      };
    });
  }

  function setProSessionStage(sessionId: string | null, stage: ProPipelineStage) {
    updateSessionById(sessionId, (session) => {
      if (session.experienceMode !== "pro") {
        return session;
      }

      const now = new Date().toISOString();
      const proCase = session.proCase ?? getDefaultProCaseRecord();
      const nextStatus = getPipelineStatusFromStage(stage, proCase);
      return {
        ...session,
        proCase: {
          ...proCase,
          status: nextStatus,
          approvedAt: stage === "scheduled" ? now : proCase.approvedAt,
          scheduledAt: stage === "scheduled" ? now : proCase.scheduledAt,
          completedAt: stage === "completed" ? now : proCase.completedAt
        },
        updatedAt: now
      };
    });
  }

  function setProSessionPaid(sessionId: string | null, paid: boolean) {
    updateSessionById(sessionId, (session) => {
      if (session.experienceMode !== "pro") {
        return session;
      }

      const now = new Date().toISOString();
      const proCase = session.proCase ?? getDefaultProCaseRecord();
      return {
        ...session,
        proCase: {
          ...proCase,
          paidAt: paid ? now : undefined
        },
        updatedAt: now
      };
    });
  }

  useEffect(() => {
    if (!pendingImportedLead || !businessProfile) {
      return;
    }

    const targetSession = sessions.find((session) => session.id === pendingImportedLead.targetSessionId) ?? null;
    if (!targetSession || activeSessionId !== pendingImportedLead.targetSessionId) {
      return;
    }

    const missing = getMissingLeadFields(pendingImportedLead.draft, pendingImportedLead.attachments.length === 0);
    if (missing.length) {
      updateSessionById(pendingImportedLead.targetSessionId, (session) => ({
        ...session,
        customerName: pendingImportedLead.draft.customerName || session.customerName,
        customerPhone: pendingImportedLead.draft.customerPhone || session.customerPhone,
        vehicleLabel: pendingImportedLead.draft.vehicleLabel || session.vehicleLabel,
        title: buildProSessionTitle(language, pendingImportedLead.draft.customerName || session.customerName, pendingImportedLead.draft.vehicleLabel || session.vehicleLabel),
        proCase: {
          ...(session.proCase ?? getDefaultProCaseRecord()),
          status: "missing_info",
          missingFields: missing
        }
      }));
      setImportLeadDraft(pendingImportedLead.draft);
      setImportLeadAttachments(pendingImportedLead.attachments);
      setImportLeadSourceApp(pendingImportedLead.sourceApp);
      setImportLeadSessionId(pendingImportedLead.targetSessionId);
      setImportLeadModalOpen(true);
      setPendingImportedLead(null);
      return;
    }

    setPendingImportedLead(null);
    void submitLeadToWorkflow(pendingImportedLead.draft, pendingImportedLead.attachments, pendingImportedLead.targetSessionId);
  }, [activeSessionId, businessProfile, language, pendingImportedLead, sessions]);

  function appendAssistantMessage(partial: Omit<UiMessage, "id" | "role" | "createdAt">) {
    const createdAt = new Date().toISOString();
    updateActiveSession((session) => ({
      ...session,
      messages: [
        ...session.messages,
        {
          id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          createdAt,
          ...partial
        }
      ],
      updatedAt: createdAt
    }));
  }

  function getLatestWorkflowFromSession(session: LocalChatSession | null) {
    if (!session) {
      return null;
    }

    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const candidate = session.messages[index];
      if (candidate.workflowOutput) {
        return candidate.workflowOutput;
      }
    }

    return null;
  }

  function switchMode(mode: AppExperienceMode) {
    setSelectedMode(mode);
    setSelectedModeState(mode);
    setMenuOpen(false);
    setHistoryOpen(false);
    setHistorySearch("");
    setProView("chat");
    if (mode === "pro" && !businessProfile) {
      setBusinessModalOpen(true);
    }
  }

  async function applyLaunchPlanSelection(nextPlan: SubscriptionPlan) {
    setLaunchSelectionLoading(true);
    setError(null);

    try {
      if (isTestPlanOverrideEnabled()) {
        const response = await activateTestPlan(nextPlan);
        setPlan(response.plan);
        setUsage(response.usage);
      } else if (nextPlan === "free") {
        clearStoredInstallSession();
        const token = await ensureInstallToken();
        if (!token) {
          throw new Error("No se pudo iniciar el plan gratis.");
        }
        setPlan(getStoredPlan());
        setUsage(getStoredUsage());
      } else {
        throw new Error("Activa el modo de prueba para cambiar DIY o Pro desde el selector.");
      }

      const nextMode = getModeForPlan(nextPlan);
      setSelectedPlan(nextPlan);
      setSelectedMode(nextMode);
      setSelectedModeState(nextMode);
      setMenuOpen(false);
      setHistoryOpen(false);
      setHistorySearch("");
      setPricingOpen(false);
      setProView("chat");

      if (nextMode === "pro" && !businessProfile) {
        setBusinessModalOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar el nivel de acceso.");
    } finally {
      setLaunchSelectionLoading(false);
    }
  }

  async function handleRefresh() {
    setError(null);
  }

  async function sendChatRequest(input: {
    message: string;
    attachments: ChatAttachment[];
    mode: "diy" | "shop";
    recentMessages: ChatHistoryItem[];
    vehicle: VehicleContext | null;
    sessionId?: string;
  }) {
    const requestBody: ChatRequestPayload = {
      sessionId: input.sessionId,
      message: input.message,
      vehicle: input.vehicle,
      language,
      mode: input.mode,
      attachments: input.attachments,
      recentMessages: input.recentMessages
    };

    const runRequest = async (token: string) =>
      requestJson<ChatResponse>("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(localModelSwitcherEnabled && localModelOverride ? { "x-local-model-override": localModelOverride } : {})
        },
        body: JSON.stringify(requestBody)
      });

    let token = await ensureInstallToken();

    try {
      return await runRequest(token);
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status;
      if (status !== 401) {
        throw err;
      }

      clearStoredInstallSession();
      token = await ensureInstallToken();
      return await runRequest(token);
    }
  }

  async function extractAttachmentText(input: { attachments: ChatAttachment[]; language: AppLanguage }) {
    if (!input.attachments.some((attachment) => attachment.kind === "image")) {
      return "";
    }

    const runRequest = async (token: string) =>
      requestJson<{ text?: string }>("/api/intake/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(localModelSwitcherEnabled && localModelOverride ? { "x-local-model-override": localModelOverride } : {})
        },
        body: JSON.stringify(input)
      });

    let token = await ensureInstallToken();

    try {
      const response = await runRequest(token);
      return response.text?.trim() || "";
    } catch (err) {
      const status = (err as { status?: number } | undefined)?.status;
      if (status !== 401) {
        return "";
      }

      clearStoredInstallSession();
      token = await ensureInstallToken();
      const response = await runRequest(token);
      return response.text?.trim() || "";
    }
  }

  async function submitLeadToWorkflow(draft: TriageLeadDraft, attachments: ChatAttachment[], sessionId?: string | null) {
    const targetSessionId = sessionId ?? activeSessionId;
    const targetSession = sessions.find((session) => session.id === targetSessionId) ?? null;
    if (!targetSessionId || !targetSession) {
      return;
    }

    const nextDraft = {
      customerName: draft.customerName.trim(),
      vehicleLabel: draft.vehicleLabel.trim(),
      customerPhone: draft.customerPhone.trim(),
      customerMessage: draft.customerMessage.trim()
    };

    const requireMessage = attachments.length === 0;

    if (getMissingLeadFields(nextDraft, requireMessage).length) {
      setError(
        requireMessage
          ? language === "es"
            ? "Completa cliente, vehiculo, telefono y mensaje."
            : "Complete customer, vehicle, phone, and message."
          : language === "es"
            ? "Completa cliente, vehiculo y telefono."
            : "Complete customer, vehicle, and phone."
      );
      return;
    }

    updateSessionById(targetSessionId, (session) => ({
      ...session,
      pendingProAction: "triage_quote",
      customerName: nextDraft.customerName,
      customerPhone: nextDraft.customerPhone,
      vehicleLabel: nextDraft.vehicleLabel,
      title: buildProSessionTitle(language, nextDraft.customerName, nextDraft.vehicleLabel),
      proCase: {
        ...(session.proCase ?? getDefaultProCaseRecord()),
        status: "new",
        missingFields: []
      },
      updatedAt: new Date().toISOString()
    }));

    setError(null);

    const extractedText = attachments.some((attachment) => attachment.kind === "image")
      ? await extractAttachmentText({ attachments, language })
      : "";

    await handleSend(
      {
        message: appendExtractedTextToLeadMessage(
          buildLeadMessage(nextDraft, {
            hasAttachments: attachments.length > 0,
            language
          }),
          extractedText,
          language
        ),
        attachments
      },
      {
        forceWorkflowMode: true,
        sessionId: targetSessionId
      }
    );
  }

  async function handleSend(
    payload: { message: string; attachments: ChatAttachment[] },
    options?: { forceWorkflowMode?: boolean; sessionId?: string | null }
  ) {
    const targetSessionId = options?.sessionId ?? activeSessionId;
    const targetSession = sessions.find((session) => session.id === targetSessionId) ?? null;
    if (!targetSessionId || !targetSession) {
      return;
    }

    const messageText = normalizeMessageForDisplay(language, payload.message);
    const now = new Date().toISOString();
    const optimisticUser: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: messageText,
      attachmentNames: payload.attachments.map((item) => item.name),
      createdAt: now
    };

    const existingMessages = targetSession.messages;
    const latestWorkflowBefore = getLatestWorkflowFromSession(targetSession);
    const documentIntent =
      targetSession.experienceMode === "pro" && businessProfile ? getDocumentIntent(messageText) : null;
    const isCollectingTriage =
      targetSession.experienceMode === "pro" &&
      targetSession.pendingProAction === "triage_collect" &&
      !options?.forceWorkflowMode;
    const triageCheck = isCollectingTriage ? getMissingTriageFields(messageText) : null;
    updateSessionById(targetSessionId, (session) => ({
      ...session,
      language,
      title:
        session.experienceMode === "pro"
          ? buildProSessionTitle(language, session.customerName, session.vehicleLabel, messageText)
          : deriveTitle(messageText, session.vehicle, language, session.experienceMode),
      messages: [...session.messages, optimisticUser],
      updatedAt: now
    }));

    setLoadingReply(true);
    setError(null);

    try {
      if (documentIntent && businessProfile && latestWorkflowBefore && !payload.attachments.length && !options?.forceWorkflowMode) {
        const assistantCreatedAt = new Date().toISOString();
        const documentPreview =
          documentIntent === "invoice"
            ? {
                title: "Factura",
                draft: createInvoiceDocumentDraft(businessProfile, latestWorkflowBefore, targetSession.vehicle),
                business: businessProfile
              }
            : documentIntent === "brief"
              ? {
                  title: "Brief interno",
                  draft: createBriefDocumentDraft(latestWorkflowBefore),
                  business: businessProfile
                }
              : {
                  title: "Cotizacion",
                  draft: createQuoteDocumentDraft(businessProfile, latestWorkflowBefore, targetSession.vehicle),
                  business: businessProfile,
                  version: targetSession.proCase?.quoteVersion || undefined
                };

        updateSessionById(targetSessionId, (session) => ({
          ...session,
          messages: [
            ...session.messages,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text:
                documentIntent === "invoice"
                  ? language === "es"
                    ? "Listo. Aqui va la factura en este hilo."
                    : "Done. Here is the invoice in this thread."
                  : documentIntent === "brief"
                    ? language === "es"
                      ? "Listo. Aqui va el brief interno en este hilo."
                      : "Done. Here is the internal brief in this thread."
                    : language === "es"
                      ? "Listo. Aqui va la cotizacion en este hilo."
                      : "Done. Here is the quote in this thread.",
              documentPreview,
              createdAt: assistantCreatedAt
            }
          ],
          updatedAt: assistantCreatedAt,
          proCase:
            documentIntent === "quote" && session.experienceMode === "pro"
              ? {
                  ...(session.proCase ?? getDefaultProCaseRecord()),
                  sentHistory: appendSentRecord((session.proCase ?? getDefaultProCaseRecord()).sentHistory, {
                    kind: "quote",
                    channel: "generated",
                    label: language === "es" ? "Cotizacion abierta desde chat" : "Quote opened from chat",
                    at: assistantCreatedAt
                  })
                }
              : session.proCase
        }));
        return;
      }

      if (isCollectingTriage && triageCheck && triageCheck.missing.length) {
        const reminder =
          language === "es"
            ? `Antes de correr el triage me faltan: ${triageCheck.missing.join(", ")}. Mandamelo asi:\nCliente: ...\nVehiculo: ...\nTelefono: ...\nMensaje: ...`
            : `Before I run triage I still need: ${triageCheck.missing.join(", ")}. Send it like this:\nCustomer: ...\nVehicle: ...\nPhone: ...\nMessage: ...`;

        updateSessionById(targetSessionId, (session) => ({
          ...session,
          messages: [
            ...session.messages,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: reminder,
              createdAt: new Date().toISOString()
            }
          ],
          pendingProAction: "triage_collect",
          proCase:
            session.experienceMode === "pro"
              ? {
                  ...(session.proCase ?? getDefaultProCaseRecord()),
                  status: "missing_info",
                  missingFields: triageCheck.missing
                }
              : session.proCase,
          updatedAt: new Date().toISOString()
        }));
        return;
      }

      if (targetSession.experienceMode === "pro") {
        const manualStage = getManualPipelineStageFromMessage(messageText);
        const markPaid = isPaidMessage(messageText);

        if (manualStage || markPaid) {
          updateSessionById(targetSessionId, (session) => {
            const nowAt = new Date().toISOString();
            const proCase = session.proCase ?? getDefaultProCaseRecord();
            const nextStatus = manualStage ? getPipelineStatusFromStage(manualStage, proCase) : proCase.status;

            return {
              ...session,
              proCase: {
                ...proCase,
                status: nextStatus,
                approvedAt: manualStage === "scheduled" ? nowAt : proCase.approvedAt,
                scheduledAt: manualStage === "scheduled" ? nowAt : proCase.scheduledAt,
                completedAt: manualStage === "completed" ? nowAt : proCase.completedAt,
                paidAt: markPaid ? nowAt : proCase.paidAt
              },
              updatedAt: nowAt
            };
          });
        }
      }

      if (targetSession.experienceMode === "pro" && latestWorkflowBefore && isApprovalMessage(messageText)) {
        const approvedAt = new Date().toISOString();
        updateSessionById(targetSessionId, (session) => ({
          ...session,
          messages: [
            ...session.messages,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text:
                language === "es"
                  ? "Quedo autorizado. Marco este caso como aprobado y listo para pasar a trabajo."
                  : "Approved. I marked this case as approved and ready for work.",
              createdAt: approvedAt
            }
          ],
          proCase: {
            ...(session.proCase ?? getDefaultProCaseRecord()),
            status: "approved",
            approvedAt
          },
          updatedAt: approvedAt
        }));
        return;
      }

        const isWorkflowMode =
          !!options?.forceWorkflowMode ||
          targetSession.experienceMode === "pro" &&
          !!businessProfile &&
          (
            (targetSession.pendingProAction === "triage_quote" || targetSession.pendingProAction === "triage_collect") ||
            !!latestWorkflowBefore ||
            !!documentIntent
          );
      const response = await sendChatRequest({
        message: isWorkflowMode
          ? [
              "Mensaje del cliente:",
              messageText,
              latestWorkflowBefore
                ? "Actualiza el memo interno, las preguntas pendientes y la cotizacion preliminar con esta nueva respuesta del cliente."
                : "Genera una ruta de triage profesional para cliente y taller. Si hay base suficiente, arma una cotizacion preliminar."
            ].join("\n")
          : messageText,
        attachments: payload.attachments,
        mode: targetSession.experienceMode === "pro" ? "shop" : "diy",
        recentMessages: buildHistory(existingMessages),
        vehicle: targetSession.vehicle,
        sessionId: targetSession.id
      });

      if (response.token) {
        storeInstallToken(response.token, response.expiresAt);
      }
      setPlan(response.plan);
      setUsage(response.usage);
      storeUsageSnapshot(response.usage);

      const assistantCreatedAt = new Date().toISOString();
      const nextWorkflow =
        isWorkflowMode && businessProfile
          ? buildProWorkflowOutput({
              customerMessage: messageText,
              customerName: latestWorkflowBefore?.customerName,
              vehicleLabel: latestWorkflowBefore?.vehicleLabel,
              customerPhone: latestWorkflowBefore?.customerPhone,
              diagnostic: response,
              language
            })
          : null;
      const nextQuoteVersion = nextWorkflow?.quoteDraft ? Math.max((targetSession.proCase?.quoteVersion ?? 0) + 1, 1) : targetSession.proCase?.quoteVersion ?? 0;
      const nextQuotePreview =
        nextWorkflow && businessProfile
          ? {
              title: "Cotizacion",
              draft: createQuoteDocumentDraft(businessProfile, nextWorkflow, targetSession.vehicle),
              business: businessProfile,
              version: nextQuoteVersion
            }
          : null;
      const requestedDocumentPreview =
        nextWorkflow && businessProfile && documentIntent
          ? documentIntent === "invoice"
            ? {
                title: "Factura",
                draft: createInvoiceDocumentDraft(businessProfile, nextWorkflow, targetSession.vehicle),
                business: businessProfile
              }
            : documentIntent === "brief"
              ? {
                  title: "Brief interno",
                  draft: createBriefDocumentDraft(nextWorkflow),
                  business: businessProfile
                }
              : nextQuotePreview
          : null;
      const assistantMessage: UiMessage = nextWorkflow && businessProfile
        ? {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text:
              documentIntent === "invoice"
                ? language === "es"
                  ? "Listo. Ya actualice el caso y te dejo la factura en este hilo."
                  : "Done. I updated the case and left the invoice in this thread."
                : documentIntent === "brief"
                  ? language === "es"
                    ? "Listo. Ya actualice el caso y te dejo el brief interno en este hilo."
                    : "Done. I updated the case and left the internal brief in this thread."
                  : language === "es"
                    ? latestWorkflowBefore
                      ? "Listo. Ya actualice el memo interno y la cotizacion preliminar con la nueva info."
                      : "Listo. Primero te dejo el memo interno y abajo la cotizacion preliminar para el cliente."
                    : "First I left the internal shop memo, then the preliminary customer quote in this chat.",
            workflowOutput: nextWorkflow,
            documentPreview: requestedDocumentPreview ?? nextQuotePreview ?? undefined,
            usedWebSearch: response.used_web_search,
            createdAt: assistantCreatedAt
          }
        : {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: response.summary,
            diagnostic: response as DiagnosticResponse,
            usedWebSearch: response.used_web_search,
            createdAt: assistantCreatedAt
          };

        updateSessionById(targetSessionId, (session) => ({
          ...session,
          language,
          title:
            session.experienceMode === "pro"
              ? buildProSessionTitle(language, nextWorkflow?.customerName || session.customerName, nextWorkflow?.vehicleLabel || session.vehicleLabel, messageText)
              : deriveTitle(messageText, session.vehicle, language, session.experienceMode),
          messages: [...session.messages, assistantMessage],
          customerName: nextWorkflow?.customerName || session.customerName,
          customerPhone: nextWorkflow?.customerPhone || session.customerPhone,
          vehicleLabel: nextWorkflow?.vehicleLabel || session.vehicleLabel,
          pendingProAction: isWorkflowMode ? "triage_quote" : session.pendingProAction ?? null,
          proCase:
            nextWorkflow && session.experienceMode === "pro"
              ? {
                  ...(session.proCase ?? getDefaultProCaseRecord()),
                  status: mergeWorkflowStatus(session.proCase?.status ?? "new", getNextProStatus(nextWorkflow)),
                  quoteVersion: nextQuotePreview ? nextQuoteVersion : (session.proCase?.quoteVersion ?? 0),
                  pendingQuestions: nextWorkflow.unansweredQuestions,
                  missingFields: [],
                  lastQuoteAt: nextQuotePreview ? assistantCreatedAt : session.proCase?.lastQuoteAt,
                  lastQuoteNumber: nextQuotePreview?.draft.quoteNumber || session.proCase?.lastQuoteNumber,
                  approvedAt: session.proCase?.approvedAt,
                  scheduledAt: session.proCase?.scheduledAt,
                  completedAt: session.proCase?.completedAt,
                  paidAt: session.proCase?.paidAt,
                  sentHistory: nextQuotePreview
                    ? appendSentRecord((session.proCase ?? getDefaultProCaseRecord()).sentHistory, {
                        kind: "quote",
                        channel: "generated",
                        label: `Cotizacion v${nextQuoteVersion} lista`,
                        at: assistantCreatedAt
                      })
                    : (session.proCase ?? getDefaultProCaseRecord()).sentHistory
                }
              : session.proCase,
          updatedAt: assistantMessage.createdAt
        }));

      if (nextWorkflow) {
        setWorkflowOutput(nextWorkflow);
        setLastWorkflowOutput(nextWorkflow);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
      const code = (err as { code?: string } | undefined)?.code;
      const details = (err as { details?: { usage?: PlanUsageSnapshot } } | undefined)?.details;
      if (details?.usage) {
        setUsage(details.usage);
        setPlan(details.usage.plan);
        storeUsageSnapshot(details.usage);
      }
      if (code === "plan_limit_reached" || code === "plan_feature_locked") {
        setPricingOpen(true);
      }
      updateSessionById(targetSessionId, (session) => ({
        ...session,
        messages: session.messages.filter((message) => message.id !== optimisticUser.id)
      }));
    } finally {
      setLoadingReply(false);
    }
  }

  async function handleSuggestedPrompt(prompt: string) {
    await handleSend({ message: prompt, attachments: [] });
  }

  async function handleSubmitTriageModal() {
    updateActiveSession((session) => ({
      ...session,
      customerName: triageDraft.customerName.trim() || session.customerName,
      customerPhone: triageDraft.customerPhone.trim() || session.customerPhone,
      vehicleLabel: triageDraft.vehicleLabel.trim() || session.vehicleLabel,
      title: buildProSessionTitle(
        language,
        triageDraft.customerName.trim() || session.customerName,
        triageDraft.vehicleLabel.trim() || session.vehicleLabel,
        session.title
      )
    }));
    setTriageModalOpen(false);
    await submitLeadToWorkflow(triageDraft, triageAttachments);
    setTriageAttachments([]);
  }

  async function handleSubmitImportLead() {
    updateSessionById(importLeadSessionId, (session) => ({
      ...session,
      customerName: importLeadDraft.customerName.trim() || session.customerName,
      customerPhone: importLeadDraft.customerPhone.trim() || session.customerPhone,
      vehicleLabel: importLeadDraft.vehicleLabel.trim() || session.vehicleLabel,
      title: buildProSessionTitle(
        language,
        importLeadDraft.customerName.trim() || session.customerName,
        importLeadDraft.vehicleLabel.trim() || session.vehicleLabel,
        session.title
      )
    }));
    await submitLeadToWorkflow(importLeadDraft, importLeadAttachments, importLeadSessionId);
    if (!getMissingLeadFields(importLeadDraft, importLeadAttachments.length === 0).length) {
      setImportLeadModalOpen(false);
      setImportLeadAttachments([]);
      setImportLeadSourceApp(undefined);
      setImportLeadSessionId(null);
    }
  }

  async function handleOpenScreenshotIntake(file: File | null) {
    if (!file || !activeSession) {
      return;
    }

    const attachments = await buildScreenshotAttachment(file);
    setTriageDraft({
      customerName: activeSession.customerName || activeWorkflow?.customerName || "",
      vehicleLabel: activeSession.vehicleLabel || activeWorkflow?.vehicleLabel || "",
      customerPhone: activeSession.customerPhone || activeWorkflow?.customerPhone || "",
      customerMessage: ""
    });
    setTriageAttachments(attachments);
    setTriageModalOpen(true);
  }

  function handleScreenshotAction() {
    if (!activeSession) {
      return;
    }

    if (!businessProfile) {
      setBusinessModalOpen(true);
      return;
    }

    if (!isProUnlocked) {
      setPricingOpen(true);
      return;
    }

    screenshotInputRef.current?.click();
  }

  function handleProActionInChat(action: "triage" | "quote" | "invoice" | "brief" | "screenshot" | "maestro") {
    if (!activeSession) {
      return;
    }

    if (!businessProfile) {
      setBusinessModalOpen(true);
      return;
    }

    if (!isProUnlocked) {
      setPricingOpen(true);
      return;
    }

    if (action === "screenshot") {
      handleScreenshotAction();
      return;
    }

    if (action === "maestro") {
      handleMasterMechanicAction();
      return;
    }

    if (action === "triage") {
      setTriageDraft({
        customerName: activeSession.customerName || activeWorkflow?.customerName || "",
        vehicleLabel: activeSession.vehicleLabel || activeWorkflow?.vehicleLabel || "",
        customerPhone: activeSession.customerPhone || activeWorkflow?.customerPhone || "",
        customerMessage: ""
      });
      setTriageAttachments([]);
      setTriageModalOpen(true);
      return;
    }

    const latestWorkflow = activeWorkflow;
    if (!latestWorkflow) {
      appendAssistantMessage({
        text:
          language === "es"
            ? "Primero corre Triage y cotizacion inicial en este chat para sacar la informacion base del cliente."
            : "Run the triage and quote step first so there is enough customer information to build this document."
      });
      return;
    }

    if (action === "quote") {
      appendAssistantMessage({
        text: language === "es" ? "Te dejo la cotizacion lista en este chat." : "Here is the quote inside this chat.",
        documentPreview: {
          title: "Cotizacion",
          draft: createQuoteDocumentDraft(businessProfile, latestWorkflow, activeSession.vehicle),
          business: businessProfile,
          version: activeSession.proCase?.quoteVersion || undefined
        }
      });
      return;
    }

    if (action === "invoice") {
      appendAssistantMessage({
        text: language === "es" ? "Te dejo la factura lista en este chat." : "Here is the invoice inside this chat.",
        documentPreview: {
          title: "Factura",
          draft: createInvoiceDocumentDraft(businessProfile, latestWorkflow, activeSession.vehicle),
          business: businessProfile
        }
      });
      return;
    }

    appendAssistantMessage({
      text: language === "es" ? "Te dejo el brief interno listo en este chat." : "Here is the internal brief inside this chat.",
      documentPreview: {
        title: "Brief interno",
        draft: createBriefDocumentDraft(latestWorkflow),
        business: businessProfile
      }
    });
  }

  function handleMasterMechanicAction() {
    if (!activeSession) {
      return;
    }

    if (!businessProfile) {
      setBusinessModalOpen(true);
      return;
    }

    if (!isProUnlocked) {
      setPricingOpen(true);
      return;
    }

    appendAssistantMessage({
      text:
        language === "es"
          ? "Listo. Pasa la falla, el ruido, el codigo o el contexto del taller y lo vemos como Maestro."
          : "Ready. Send the fault, noise, code, or shop context and we will work through it as Master Mechanic."
    });
  }

  async function handleNewThread() {
    const session = createLocalSession(language, currentChatExperienceMode);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleSaveVehicle(nextVehicle: VehicleContext) {
    updateActiveSession((session) => ({
      ...session,
      vehicle: nextVehicle,
      title: deriveTitle(session.title, nextVehicle, language, session.experienceMode),
      updatedAt: new Date().toISOString()
    }));
    syncLastVehicleContext(nextVehicle);
  }

  function syncLastVehicleContext(vehicle: VehicleContext | null) {
    setLastVehicleContextState(vehicle);
    persistLastVehicleContext(vehicle);
  }

  async function handleSaveBusiness(profile: BusinessProfile) {
    setBusinessProfile(profile);
    setBusinessProfileState(profile);
    if (selectedMode === "pro") {
      setProView("chat");
    }
  }

  async function handleCustomerMessageSubmit(input: { customerMessage: string; customerName?: string; vehicleLabel?: string; screenshot?: File | null }) {
    if (!businessProfile) {
      setBusinessModalOpen(true);
      return;
    }

    if (plan !== "pro") {
      setPricingOpen(true);
      return;
    }

    setWorkflowLoading(true);
    setError(null);

    try {
      const attachments = await buildScreenshotAttachment(input.screenshot ?? null);
      const response = await sendChatRequest({
        message: [
          "Mensaje del cliente:",
          input.customerMessage,
          input.customerName ? `Cliente: ${input.customerName}` : "",
          input.vehicleLabel ? `Vehiculo: ${input.vehicleLabel}` : "",
          "Genera una ruta de triage profesional para cliente y taller."
        ]
          .filter(Boolean)
          .join("\n"),
        attachments,
        mode: "shop",
        recentMessages: [],
        vehicle: lastVehicleContext,
        sessionId: undefined
      });

      if (response.token) {
        storeInstallToken(response.token, response.expiresAt);
      }
      setPlan(response.plan);
      setUsage(response.usage);
      storeUsageSnapshot(response.usage);

      const nextOutput = buildProWorkflowOutput({
        customerMessage: input.customerMessage,
        customerName: input.customerName,
        vehicleLabel: input.vehicleLabel,
        customerPhone: undefined,
        diagnostic: response,
        language
      });

      setWorkflowOutput(nextOutput);
      setLastWorkflowOutput(nextOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la salida del taller.");
      const code = (err as { code?: string } | undefined)?.code;
      if (code === "plan_limit_reached" || code === "plan_feature_locked") {
        setPricingOpen(true);
      }
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleClearCurrent() {
    if (!activeSession) {
      return;
    }

    const confirmed = window.confirm(language === "es" ? "Quieres borrar el chat actual?" : "Clear current chat?");
    if (!confirmed) {
      return;
    }

    updateActiveSession((session) => ({
      ...session,
      title: getDefaultSessionTitle(language, session.experienceMode),
      customerName: "",
      customerPhone: "",
      vehicleLabel: "",
      messages: [],
      proCase: session.experienceMode === "pro" ? getDefaultProCaseRecord() : session.proCase,
      updatedAt: new Date().toISOString()
    }));
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleClearAll() {
    const firstGate = window.confirm(
      language === "es" ? "Quieres borrar todo el historial?" : "Do you want to clear all history?"
    );
    if (!firstGate) {
      return;
    }

    const secondGate = window.confirm(
      language === "es"
        ? "Esto borrara todos los hilos guardados. Si estas seguro, pulsa OK para borrar todo."
        : "This will delete all saved threads. If you are sure, press OK to delete everything."
    );
    if (!secondGate) {
      return;
    }

    const preserved = sessions.filter((session) => session.experienceMode !== currentChatExperienceMode);
    const fresh = createLocalSession(language, currentChatExperienceMode);
    setSessions([fresh, ...preserved]);
    setActiveSessionId(fresh.id);
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleBackupLog() {
    const header = [
      "thread_id",
      "thread_title",
      "mode",
      "updated_at",
      "customer_name",
      "customer_phone",
      "vehicle_label",
      "status",
      "quote_version",
      "message_created_at",
      "message_role",
      "message_text"
    ];

    const escapeCsv = (value: string | number | null | undefined) => {
      const normalized = String(value ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
      return `"${normalized}"`;
    };

    const rows = sessions.flatMap((session) => {
      if (!session.messages.length) {
        return [
          [
            session.id,
            session.title,
            session.experienceMode,
            session.updatedAt,
            session.customerName || "",
            session.customerPhone || "",
            session.vehicleLabel || "",
            session.proCase?.status || "",
            session.proCase?.quoteVersion ?? "",
            "",
            "",
            ""
          ]
        ];
      }

      return session.messages.map((message) => [
        session.id,
        session.title,
        session.experienceMode,
        session.updatedAt,
        session.customerName || "",
        session.customerPhone || "",
        session.vehicleLabel || "",
        session.proCase?.status || "",
        session.proCase?.quoteVersion ?? "",
        message.createdAt,
        message.role,
        message.text ||
          message.workflowOutput?.suggestedReply ||
          message.workflowOutput?.internalJobBrief ||
          message.diagnostic?.summary ||
          ""
      ]);
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell as string | number | null | undefined)).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const fileName = `mecanico-backup-${new Date().toISOString().slice(0, 10)}.csv`;
    const file = new File([blob], fileName, { type: "text/csv" });

    try {
      if (typeof navigator !== "undefined" && "canShare" in navigator && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Mecanico backup",
          text: language === "es" ? "Guarda este respaldo en Google Drive." : "Save this backup to Google Drive."
        });
      } else {
        const url = window.URL.createObjectURL(blob);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 2000);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : language === "es" ? "No se pudo exportar el CSV." : "Could not export the CSV.");
      return;
    }

    setMenuOpen(false);
  }

  function handleToggleLanguage() {
    setLanguage((prev) => (prev === "es" ? "en" : "es"));
    updateActiveSession((session) => ({
      ...session,
      language: session.language === "es" ? "en" : "es"
    }));
  }

  function handleLockedFeature(feature: "voice" | "attachments") {
    setError(
      language === "es"
        ? feature === "voice"
          ? "La voz esta disponible solo en Para los Pros."
          : "Las fotos y archivos estan disponibles solo en Para los Pros."
        : feature === "voice"
          ? "Voice is only available on the Pro plan."
          : "Photo and file upload are only available on the Pro plan."
    );
    setPricingOpen(true);
  }

  async function handleActivateTestPlan(nextPlan: SubscriptionPlan) {
    setActivatingPlan(nextPlan);
    setError(null);

    try {
      const response = await activateTestPlan(nextPlan);
      setPlan(response.plan);
      setUsage(response.usage);
      const nextMode = getModeForPlan(nextPlan);
      setSelectedPlan(nextPlan);
      setSelectedMode(nextMode);
      setSelectedModeState(nextMode);
      if (nextMode === "pro") {
        setProView("chat");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar el plan de prueba.");
    } finally {
      setActivatingPlan(null);
    }
  }

  function handleMessageAction(message: UiMessage, action: MessageActionEvent) {
    if (!activeSession || activeSession.experienceMode !== "pro") {
      return;
    }

    const now = new Date().toISOString();
    const labelMap: Record<MessageActionEvent["kind"], string> = {
      questions: "Preguntas enviadas",
      reply: "Respuesta enviada",
      quote: "Cotizacion enviada",
      invoice: "Factura enviada",
      brief: "Brief compartido",
      reminder: "Recordatorio enviado"
    };

    recordSessionAction(activeSession.id, {
      kind: action.kind,
      channel: action.channel,
      label: labelMap[action.kind],
      at: now
    });

    if (action.channel === "whatsapp" && (action.kind === "questions" || action.kind === "reply" || action.kind === "quote" || action.kind === "reminder")) {
      setProSessionStatus(activeSession.id, "waiting_customer");
    }
  }

  function handleThreadReminder() {
    if (!activeSession || activeSession.experienceMode !== "pro") {
      return;
    }

    const latestWorkflow = getLatestWorkflowFromSession(activeSession) ?? workflowOutput;
    openExternalUrl(buildWhatsAppShareUrl(buildCustomerReminderText(activeSession, latestWorkflow)));
    handleMessageAction(
      {
        id: "thread-reminder",
        role: "assistant",
        text: "",
        createdAt: new Date().toISOString()
      },
      { kind: "reminder", channel: "whatsapp" }
    );
  }

  function openTriageFromBanner() {
    if (!activeSession) {
      return;
    }

    const latestWorkflow = getLatestWorkflowFromSession(activeSession) ?? workflowOutput;
    setTriageDraft({
      customerName: activeSession.customerName || latestWorkflow?.customerName || "",
      vehicleLabel: activeSession.vehicleLabel || latestWorkflow?.vehicleLabel || "",
      customerPhone: activeSession.customerPhone || latestWorkflow?.customerPhone || "",
      customerMessage: ""
    });
    setTriageAttachments([]);
    setTriageModalOpen(true);
  }

  const usageLabel = getPlanUsageLabel(language, plan, usage);
  const isProUnlocked = plan === "pro";
  const importMissingFields = getMissingLeadFields(importLeadDraft, importLeadAttachments.length === 0);
  const shouldShowProBanner = selectedMode === "pro" && activeSession && activeProCase;
  const proThreadBanner =
    shouldShowProBanner && activeSession && activeProCase
      ? {
          statusLabel: language === "es" ? "Pipeline del caso" : "Case pipeline",
          detail:
            activeProCase.status === "missing_info"
              ? language === "es"
                ? `Falta cerrar: ${activeProCase.missingFields.join(", ")}`
                : `Still missing: ${activeProCase.missingFields.join(", ")}`
              : activeProCase.status === "waiting_customer"
                ? language === "es"
                  ? activeProCase.pendingQuestions.length
                    ? `${activeProCase.pendingQuestions.length} preguntas pendientes por responder`
                    : "Ya se compartio la propuesta. Falta respuesta del cliente."
                  : activeProCase.pendingQuestions.length
                    ? `${activeProCase.pendingQuestions.length} questions still pending`
                    : "The proposal is out. Waiting on the customer."
                : activeProCase.status === "approved"
                  ? language === "es"
                    ? "El cliente ya autorizo este trabajo."
                    : "The customer has already approved this job."
                  : activeProCase.status === "in_progress"
                    ? language === "es"
                      ? "Este caso ya esta marcado en trabajo."
                      : "This case is already in progress."
                    : activeProCase.status === "delivered"
                      ? language === "es"
                        ? "Este caso ya se marco como entregado."
                        : "This case is already marked delivered."
                      : activeProCase.quoteVersion
                        ? language === "es"
                          ? `Cotizacion v${activeProCase.quoteVersion} lista en este hilo.`
                          : `Quote v${activeProCase.quoteVersion} is ready in this thread.`
                        : language === "es"
                          ? "Este hilo ya guarda el record vivo del cliente."
                          : "This thread is now the live customer record.",
          helper:
            activeSession.customerPhone || activeSession.vehicleLabel
              ? [activeSession.customerPhone, activeSession.vehicleLabel].filter(Boolean).join(" • ")
              : undefined,
          tone:
            activeProCase.status === "missing_info"
              ? ("warning" as const)
              : activeProCase.status === "approved" || activeProCase.status === "delivered"
                ? ("success" as const)
                : ("neutral" as const),
          pipeline: {
            currentStage: getPipelineStageFromStatus(activeProCase.status),
            paid: Boolean(activeProCase.paidAt),
            stages: (["diagnosis", "quoted", "scheduled", "completed"] as ProPipelineStage[]).map((stage) => ({
              id: stage,
              label: getPipelineStageLabel(language, stage),
              active: getPipelineStageFromStatus(activeProCase.status) === stage,
              completed: getPipelineRank(getPipelineStatusFromStage(stage, activeProCase)) < getPipelineRank(activeProCase.status),
              onClick: () => setProSessionStage(activeSession.id, stage)
            })),
            paidLabel: activeProCase.paidAt ? (language === "es" ? "Pagado" : "Paid") : language === "es" ? "Marcar pagado" : "Mark paid",
            onTogglePaid: () => setProSessionPaid(activeSession.id, !activeProCase.paidAt)
          },
          actionLabel:
            activeProCase.status === "missing_info"
              ? language === "es"
                ? "Completar datos"
                : "Complete details"
              : activeProCase.status === "waiting_customer" || activeProCase.status === "quoted"
                ? language === "es"
                  ? "Enviar preguntas"
                  : "Send follow up questions"
                : undefined,
          onAction:
            activeProCase.status === "missing_info"
              ? openTriageFromBanner
              : activeProCase.status === "waiting_customer" || activeProCase.status === "quoted"
                ? handleThreadReminder
                : undefined,
          secondaryActionLabel:
            activeProCase.status === "waiting_customer" || activeProCase.status === "quoted"
              ? language === "es"
                ? "Completar datos"
                : "Complete details"
              : undefined,
          onSecondaryAction:
            activeProCase.status === "waiting_customer" || activeProCase.status === "quoted" ? openTriageFromBanner : undefined
        }
      : null;
  const proActions =
    selectedMode === "pro" && activeSession?.experienceMode === "pro"
      ? [
          {
            id: "triage",
            label:
              language === "es"
                ? activeProCase?.status === "new" && !activeWorkflow && !activeSession.customerName && !activeSession.vehicleLabel
                  ? "Nuevo ingreso"
                  : "Actualizar triage"
                : activeProCase?.status === "new" && !activeWorkflow && !activeSession.customerName && !activeSession.vehicleLabel
                  ? "New intake"
                  : "Refresh triage",
            onClick: () => handleProActionInChat("triage")
          },
          {
            id: "screenshot",
            label: language === "es" ? "Subir captura" : "Upload screenshot",
            onClick: () => handleProActionInChat("screenshot")
          },
          {
            id: "history",
            label: language === "es" ? "Historial clientes" : "Client history",
            onClick: () => setHistoryOpen(true)
          },
          {
            id: "new-client",
            label: language === "es" ? "Nuevo cliente" : "New customer",
            onClick: () => {
              void handleNewThread();
            }
          },
          {
            id: "quote",
            label: language === "es" ? "Cotizacion" : "Quote",
            onClick: () => handleProActionInChat("quote")
          },
          {
            id: "invoice",
            label: language === "es" ? "Factura" : "Invoice",
            onClick: () => handleProActionInChat("invoice")
          },
          {
            id: "maestro",
            label: language === "es" ? "Maestro" : "Master",
            onClick: handleMasterMechanicAction
          },
          ...(() => {
            if (!activeProCase) {
              return [] as Array<{ id: string; label: string; onClick: () => void }>;
            }

            if (activeProCase.status === "missing_info") {
              return [
                {
                  id: "complete-details",
                  label: language === "es" ? "Completar datos" : "Complete details",
                  onClick: openTriageFromBanner
                }
              ];
            }

            if (activeProCase.status === "waiting_customer" || activeProCase.status === "quoted") {
              return [
                {
                  id: "reminder",
                  label: language === "es" ? "Recordatorio" : "Reminder",
                  onClick: handleThreadReminder
                }
              ];
            }

            return [] as Array<{ id: string; label: string; onClick: () => void }>;
          })()
        ]
      : [];

  if (loadingInit) {
    return (
      <main className="wa-app-shell min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center bg-[var(--wa-bg-sidebar)] text-sm text-[var(--wa-text-secondary)]">
          Cargando Mecanico AI...
        </div>
      </main>
    );
  }

  if (!selectedMode) {
    return <ModeSelectionScreen loading={launchSelectionLoading} onSelect={(nextPlan) => void applyLaunchPlanSelection(nextPlan)} />;
  }

  return (
    <main className="wa-app-shell min-h-screen">
      {selectedMode === "diy" || (selectedMode === "pro" && proView === "chat") ? (
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] bg-[var(--wa-bg-sidebar)] md:max-w-[640px] lg:max-w-[820px]">
          <div className="wa-phone-shell relative flex min-h-screen min-w-0 flex-1 flex-col shadow-[var(--wa-shadow-md)]">
            <ChatPanel
              threadTitle={activeTitle}
              language={language}
              isDarkMode={isDarkMode}
              mode={currentChatExperienceMode}
              messages={displayedMessages}
              loading={loadingReply}
              showDiyHome={showDiyHome}
              disabled={!installReady}
              plan={plan}
              usageLabel={usageLabel}
              proThreadBanner={proThreadBanner}
              proActions={proActions}
              onSend={handleSend}
              onSuggestedPrompt={handleSuggestedPrompt}
              onNewThread={handleNewThread}
              onOpenHistory={() => setHistoryOpen(true)}
              onOpenIntake={() => setVehicleModalOpen(true)}
              onRefresh={handleRefresh}
              onToggleLanguage={handleToggleLanguage}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onOpenPlans={() => setPricingOpen(true)}
              onLockedFeature={handleLockedFeature}
              onOpenMenu={() => setMenuOpen(true)}
              onProStarterAction={(action) => handleProActionInChat(action)}
              onMessageAction={handleMessageAction}
            />

            {error ? <div className="mx-4 mb-2 rounded-3xl bg-red-600 px-4 py-2 text-sm text-white shadow-lg">{error}</div> : null}
            {installLoading ? (
              <div className="mx-4 mb-2 rounded-3xl bg-[var(--wa-control-bg)] px-4 py-2 text-sm text-[var(--wa-text-secondary)] shadow-sm">
                Protegiendo la sesion del dispositivo...
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedMode === "pro" && !businessProfile ? (
        <section className="flex min-h-screen flex-col items-center justify-center bg-[var(--wa-bg-app)] px-4">
          <div className="w-full max-w-[520px] rounded-[28px] bg-[var(--wa-bg-sidebar)] p-6 shadow-[var(--wa-shadow-md)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--mech-orange)]">Para los Pros</p>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--wa-text-primary)]">Configura tu negocio primero</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--wa-text-secondary)]">
              Antes de abrir el flujo Pro, guarda el nombre del negocio, WhatsApp, tipo de taller, moneda, link de pago y mano de obra por hora.
            </p>
            <div className="mt-5 flex gap-2">
              <Button type="button" onClick={() => setBusinessModalOpen(true)}>
                Configurar negocio
              </Button>
              <Button type="button" variant="secondary" onClick={() => switchMode("diy")}>
                Volver a DIY
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {selectedMode === "pro" && proView === "client_message" && businessProfile ? (
        <CustomerMessageWorkspace
          business={businessProfile}
          output={workflowOutput}
          loading={workflowLoading}
          onBack={() => setProView("chat")}
          onSubmit={handleCustomerMessageSubmit}
        />
      ) : null}

      {selectedMode === "pro" && proView === "quote" && businessProfile ? (
        <DocumentWorkspace
          title="Cotizacion"
          business={businessProfile}
          initialDraft={createQuoteDocumentDraft(businessProfile, workflowOutput, activeSession?.vehicle ?? lastVehicleContext)}
          onBack={() => setProView("chat")}
        />
      ) : null}

      {selectedMode === "pro" && proView === "invoice" && businessProfile ? (
        <DocumentWorkspace
          title="Factura"
          business={businessProfile}
          initialDraft={createInvoiceDocumentDraft(businessProfile, workflowOutput, activeSession?.vehicle ?? lastVehicleContext)}
          onBack={() => setProView("chat")}
        />
      ) : null}

      {selectedMode === "pro" && proView === "brief" && businessProfile ? (
        <DocumentWorkspace
          title="Brief interno"
          business={businessProfile}
          initialDraft={createBriefDocumentDraft(workflowOutput)}
          showAmount={false}
          onBack={() => setProView("chat")}
        />
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setHistoryOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-[var(--wa-bg-sidebar)] p-4 shadow-[var(--wa-shadow-md)] md:left-1/2 md:bottom-6 md:w-[480px] md:-translate-x-1/2 md:rounded-[24px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300 md:hidden" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-[var(--wa-text-primary)]">{language === "es" ? "Historial" : "History"}</p>
              <Button type="button" variant="secondary" onClick={() => void handleNewThread()}>
                {currentChatExperienceMode === "pro"
                  ? language === "es"
                    ? "Nuevo cliente"
                    : "New customer"
                  : language === "es"
                    ? "Nuevo chat"
                    : "New chat"}
              </Button>
            </div>
            <div className="mb-3">
              <Input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={language === "es" ? "Buscar cliente, telefono o vehiculo" : "Search customer, phone, or vehicle"}
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)]">
              <SessionList
                sessions={filteredVisibleSessions.map((session) => ({
                  id: session.id,
                  title: session.title,
                  language: session.language,
                  mode: session.experienceMode === "pro" ? "shop" : "diy",
                  updatedAt: session.updatedAt,
                  customerName: session.customerName,
                  customerPhone: session.customerPhone,
                  vehicleLabel: session.vehicleLabel,
                  proStatus: session.proCase?.status,
                  quoteVersion: session.proCase?.quoteVersion,
                  pendingQuestionsCount: session.proCase?.pendingQuestions.length,
                  missingFields: session.proCase?.missingFields,
                  lastSentLabel: session.proCase?.lastSentLabel,
                  approvedAt: session.proCase?.approvedAt,
                  paidAt: session.proCase?.paidAt
                }))}
                activeSessionId={activeSessionId}
                onSelect={(id: string) => {
                  setActiveSessionId(id);
                  setHistoryOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {menuOpen ? (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-[28px] bg-[var(--wa-bg-sidebar)] p-4 shadow-[var(--wa-shadow-md)] md:left-1/2 md:bottom-6 md:w-[420px] md:-translate-x-1/2 md:rounded-[24px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-gray-300 md:hidden" />
            <div className="mb-4 rounded-[20px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-[var(--wa-text-secondary)]">
                {language === "es" ? "Plan actual" : "Current plan"}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-[var(--wa-text-primary)]">{PLAN_DEFINITIONS[plan].name}</p>
                <p className="text-right text-sm text-[var(--wa-text-secondary)]">{usageLabel}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => void handleNewThread()}>
                {currentChatExperienceMode === "pro"
                  ? language === "es"
                    ? "Nuevo cliente"
                    : "New customer"
                  : language === "es"
                    ? "Nuevo chat"
                    : "New chat"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setVehicleModalOpen(true)}>
                {language === "es" ? "Vehiculo" : "Vehicle"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  clearSelectedMode();
                  clearSelectedPlan();
                  setSelectedModeState(null);
                  setMenuOpen(false);
                }}
              >
                {language === "es" ? "Cambiar nivel" : "Change tier"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPricingOpen(true)}>
                {language === "es" ? "Planes" : "Plans"}
              </Button>
              {localModelSwitcherEnabled ? (
                <div className="col-span-2 rounded-[20px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] px-3 py-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-[var(--wa-text-secondary)]">
                    {language === "es" ? "Modelo local" : "Local model"}
                  </p>
                  <div className="space-y-2">
                    <Select
                      value={LOCAL_MODEL_OPTIONS.some((option) => option.value === localModelOverride) ? localModelOverride : "__custom__"}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === "__custom__") {
                          return;
                        }
                        setLocalModelOverrideState(nextValue);
                        setLocalModelOverride(nextValue);
                      }}
                    >
                      {LOCAL_MODEL_OPTIONS.map((option) => (
                        <option key={option.value || "default"} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                      <option value="__custom__">{language === "es" ? "Personalizado" : "Custom"}</option>
                    </Select>
                    <Input
                      placeholder={language === "es" ? "Modelo personalizado" : "Custom model"}
                      value={LOCAL_MODEL_OPTIONS.some((option) => option.value === localModelOverride) ? "" : localModelOverride}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setLocalModelOverrideState(nextValue);
                        setLocalModelOverride(nextValue);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setLocalModelOverrideState("");
                          clearLocalModelOverride();
                        }}
                      >
                        {language === "es" ? "Usar default" : "Use default"}
                      </Button>
                      <p className="text-xs text-[var(--wa-text-secondary)]">
                        {localModelOverride || (language === "es" ? "Tomando .env.local" : "Using .env.local")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setBusinessModalOpen(true);
                  setMenuOpen(false);
                }}
              >
                {language === "es" ? "Editar negocio" : "Edit business"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleBackupLog()}>
                {language === "es" ? "Respaldar log" : "Backup log"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleToggleLanguage}>
                {language === "es" ? "English" : "Espanol"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setIsDarkMode((prev) => !prev)}>
                {language === "es" ? (isDarkMode ? "Tema claro" : "Tema oscuro") : isDarkMode ? "Light mode" : "Dark mode"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleClearCurrent()}>
                {language === "es" ? "Borrar chat" : "Clear chat"}
              </Button>
              <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={() => void handleClearAll()}>
                {language === "es" ? "Borrar historial" : "Clear history"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <PricingSheet
        open={pricingOpen}
        language={language}
        currentPlan={plan}
        usage={usage}
        allowTestOverride={isTestPlanOverrideEnabled()}
        activatingPlan={activatingPlan}
        onActivateTestPlan={handleActivateTestPlan}
        onClose={() => setPricingOpen(false)}
      />

      <VehicleIntakeDrawer
        open={vehicleModalOpen}
        initialVehicle={activeSession?.vehicle ?? lastVehicleContext ?? null}
        onClose={() => setVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
      />

      <BusinessSetupDrawer
        open={businessModalOpen}
        initialProfile={businessProfile}
        onClose={() => setBusinessModalOpen(false)}
        onSave={handleSaveBusiness}
      />

      <Modal
        open={importLeadModalOpen}
        title={language === "es" ? "Completa lo minimo para correr el triage" : "Complete the basics to run triage"}
        onClose={() => setImportLeadModalOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[var(--wa-text-secondary)]">
            {language === "es"
              ? `Ya importamos el mensaje${importLeadSourceApp ? ` desde ${importLeadSourceApp}` : ""}. Solo completa lo que falta para abrir el caso y sacar la cotizacion.`
              : `The message is already imported${importLeadSourceApp ? ` from ${importLeadSourceApp}` : ""}. Only fill the missing basics to open the case and run the quote.`}
          </p>
          {importMissingFields.includes("Cliente") ? (
            <Input
              placeholder={language === "es" ? "Cliente" : "Customer"}
              value={importLeadDraft.customerName}
              onChange={(event) => setImportLeadDraft((prev) => ({ ...prev, customerName: event.target.value }))}
            />
          ) : null}
          {importMissingFields.includes("Vehiculo") ? (
            <Input
              placeholder={language === "es" ? "Vehiculo" : "Vehicle"}
              value={importLeadDraft.vehicleLabel}
              onChange={(event) => setImportLeadDraft((prev) => ({ ...prev, vehicleLabel: event.target.value }))}
            />
          ) : null}
          {importMissingFields.includes("Telefono") ? (
            <Input
              placeholder={language === "es" ? "Telefono / WhatsApp" : "Phone / WhatsApp"}
              value={importLeadDraft.customerPhone}
              onChange={(event) => setImportLeadDraft((prev) => ({ ...prev, customerPhone: event.target.value }))}
            />
          ) : null}
          {importMissingFields.includes("Mensaje") || importLeadAttachments.length ? (
            <Textarea
              rows={4}
              placeholder={
                importLeadAttachments.length
                  ? language === "es"
                    ? "Nota rapida (opcional)"
                    : "Quick note (optional)"
                  : language === "es"
                    ? "Que reporto el cliente?"
                    : "What did the customer report?"
              }
              value={importLeadDraft.customerMessage}
              onChange={(event) => setImportLeadDraft((prev) => ({ ...prev, customerMessage: event.target.value }))}
            />
          ) : importLeadDraft.customerMessage ? (
            <div className="rounded-[20px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)] px-4 py-3 text-sm leading-6 text-[var(--wa-text-secondary)]">
              {importLeadDraft.customerMessage}
            </div>
          ) : null}
          {importLeadAttachments.length ? (
            <p className="text-xs text-[var(--wa-text-secondary)]">
              {language === "es"
                ? `Adjuntos importados: ${importLeadAttachments.map((item) => item.name).join(", ")}`
                : `Imported attachments: ${importLeadAttachments.map((item) => item.name).join(", ")}`}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setImportLeadModalOpen(false)}>
              {language === "es" ? "Luego" : "Later"}
            </Button>
            <Button type="button" onClick={() => void handleSubmitImportLead()}>
              {language === "es" ? "Correr triage" : "Run triage"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={triageModalOpen}
        title={language === "es" ? "Triage y cotizacion inicial" : "Initial triage and quote"}
        onClose={() => setTriageModalOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-[var(--wa-text-secondary)]">
            {language === "es"
              ? "Captura los datos del cliente primero. Al guardar, se meten al chat y el triage corre con esa informacion."
              : "Capture the customer details first. When you save, they are written into the chat and triage runs with that information."}
          </p>
          <Input
            placeholder={language === "es" ? "Cliente" : "Customer"}
            value={triageDraft.customerName}
            onChange={(event) => setTriageDraft((prev) => ({ ...prev, customerName: event.target.value }))}
          />
          <Input
            placeholder={language === "es" ? "Vehiculo" : "Vehicle"}
            value={triageDraft.vehicleLabel}
            onChange={(event) => setTriageDraft((prev) => ({ ...prev, vehicleLabel: event.target.value }))}
          />
          <Input
            placeholder={language === "es" ? "Telefono / WhatsApp" : "Phone / WhatsApp"}
            value={triageDraft.customerPhone}
            onChange={(event) => setTriageDraft((prev) => ({ ...prev, customerPhone: event.target.value }))}
          />
          <Textarea
            rows={5}
            placeholder={
              triageAttachments.length
                ? language === "es"
                  ? "Nota rapida sobre la captura (opcional)"
                  : "Quick note about the screenshot (optional)"
                : language === "es"
                  ? "Mensaje del cliente o resumen de la nota de voz"
                  : "Customer message or voice note summary"
            }
            value={triageDraft.customerMessage}
            onChange={(event) => setTriageDraft((prev) => ({ ...prev, customerMessage: event.target.value }))}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setTriageModalOpen(false)}>
              {language === "es" ? "Cancelar" : "Cancel"}
            </Button>
            <Button type="button" onClick={() => void handleSubmitTriageModal()}>
              {language === "es" ? "Guardar y correr triage" : "Save and run triage"}
            </Button>
          </div>
          {triageAttachments.length ? (
            <p className="text-xs text-[var(--wa-text-secondary)]">
              {language === "es"
                ? `Adjuntos importados: ${triageAttachments.map((item) => item.name).join(", ")}`
                : `Imported attachments: ${triageAttachments.map((item) => item.name).join(", ")}`}
            </p>
          ) : null}
        </div>
      </Modal>

      <input
        ref={screenshotInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.currentTarget.value = "";
          void handleOpenScreenshotIntake(file);
        }}
      />
    </main>
  );
}
