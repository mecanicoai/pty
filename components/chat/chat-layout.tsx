"use client";

import { useEffect, useMemo, useState } from "react";

import { PricingSheet } from "@/components/billing/pricing-sheet";
import { ChatPanel } from "@/components/chat/chat-panel";
import type { UiMessage } from "@/components/chat/types";
import { ModeSelectionScreen } from "@/components/product/mode-selection-screen";
import { BusinessSetupDrawer } from "@/components/pro/business-setup-drawer";
import { CustomerMessageWorkspace } from "@/components/pro/customer-message-workspace";
import { DocumentWorkspace } from "@/components/pro/document-workspace";
import { ProHome } from "@/components/pro/pro-home";
import { SessionList } from "@/components/sidebar/session-list";
import { Button } from "@/components/ui/button";
import { createEmptyUsageSnapshot, PLAN_DEFINITIONS, type PlanUsageSnapshot, type SubscriptionPlan } from "@/lib/billing/plans";
import {
  clearStoredInstallSession,
  ensureInstallToken,
  getStoredPlan,
  getStoredUsage,
  registerNativeInstallBridge,
  storeUsageSnapshot
} from "@/lib/chat/install-auth";
import { createLocalSession, loadLocalSessions, saveLocalSessions, type LocalChatSession } from "@/lib/chat/local-store";
import {
  getBusinessProfile,
  getLastVehicleContext,
  getLastWorkflowOutput,
  getSelectedMode,
  setBusinessProfile,
  setLastVehicleContext as persistLastVehicleContext,
  setLastWorkflowOutput,
  setSelectedMode
} from "@/lib/product/local-store";
import {
  buildProWorkflowOutput,
  createBriefDocumentDraft,
  createInvoiceDocumentDraft,
  createQuoteDocumentDraft
} from "@/lib/product/pro-workflows";
import { VehicleIntakeDrawer } from "@/components/intake/vehicle-intake-drawer";
import type { ApiErrorResponse, ChatHistoryItem, ChatRequestPayload, ChatResponse } from "@/types/api";
import type { AppLanguage, ChatAttachment, DiagnosticResponse, VehicleContext } from "@/types/chat";
import type { AppExperienceMode, BusinessProfile, ProWorkflowOutput, ProWorkspaceView } from "@/types/product";

const PREF_KEYS = {
  darkMode: "mecanico-ui-dark",
  language: "mecanico-ui-language",
  activeSessionId: "mecanico-active-session-id"
} as const;

function getDefaultSessionTitle(language: AppLanguage, experienceMode: AppExperienceMode) {
  if (experienceMode === "pro") {
    return language === "es" ? "Maestro Mecanico" : "Master Mechanic";
  }
  return language === "es" ? "Nuevo chat" : "New chat";
}

function getWelcomeMessage(language: AppLanguage, experienceMode: AppExperienceMode, plan: SubscriptionPlan) {
  if (experienceMode === "pro") {
    return language === "es"
      ? "Soy tu Maestro Mecanico. Pasa el caso, la falla, el vehiculo y te ayudo a bajarlo a diagnostico, siguiente prueba y trabajo aprobado."
      : "I am your Master Mechanic. Send the case, the fault, and the vehicle details and I will help turn it into a diagnosis and next step.";
  }

  if (plan === "basic") {
    return language === "es"
      ? "Vamos a aterrizar esa falla paso a paso. Dime el ano, marca, modelo y el sintoma exacto para darte una ruta DIY mas profunda."
      : "Let's narrow the problem down step by step. Tell me the year, make, model, and exact symptom for deeper DIY guidance.";
  }

  return language === "es"
    ? "Que tal. Dime el ano, marca, modelo y la falla detallada del vehiculo para ayudarte a entender mejor que revisar."
    : "Tell me the year, make, model, and the detailed issue so I can help you understand what to check first.";
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

function buildHistory(messages: UiMessage[]): ChatHistoryItem[] {
  return messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.diagnostic?.summary || message.text,
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
  const [pricingOpen, setPricingOpen] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [installLoading, setInstallLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [usage, setUsage] = useState<PlanUsageSnapshot>(createEmptyUsageSnapshot("free"));
  const [selectedMode, setSelectedModeState] = useState<AppExperienceMode | null>(null);
  const [businessProfile, setBusinessProfileState] = useState<BusinessProfile | null>(null);
  const [proView, setProView] = useState<ProWorkspaceView>("home");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowOutput, setWorkflowOutput] = useState<ProWorkflowOutput | null>(null);
  const [lastVehicleContext, setLastVehicleContextState] = useState<VehicleContext | null>(null);

  const currentChatExperienceMode: AppExperienceMode = selectedMode === "pro" ? "pro" : "diy";
  const visibleSessions = useMemo(
    () => sessions.filter((session) => session.experienceMode === currentChatExperienceMode),
    [sessions, currentChatExperienceMode]
  );

  const activeSession = useMemo(
    () => visibleSessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, visibleSessions]
  );

  const displayedMessages = useMemo<UiMessage[]>(() => {
    if (activeSession?.messages.length) {
      return activeSession.messages;
    }

    return [
      {
        id: `welcome-${currentChatExperienceMode}`,
        role: "assistant",
        text: getWelcomeMessage(language, currentChatExperienceMode, plan),
        createdAt: ""
      }
    ];
  }, [activeSession?.messages, currentChatExperienceMode, language, plan]);

  useEffect(() => {
    const savedDark = localStorage.getItem(PREF_KEYS.darkMode);
    const savedLanguage = localStorage.getItem(PREF_KEYS.language);
    const savedActiveSessionId = localStorage.getItem(PREF_KEYS.activeSessionId);
    const localSessions = loadLocalSessions();
    const persistedMode = getSelectedMode();

    if (savedDark === "true") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    const nextLanguage = savedLanguage === "en" ? "en" : "es";
    setLanguage(nextLanguage);
    setPlan(getStoredPlan());
    setUsage(getStoredUsage());
    setSelectedModeState(persistedMode);
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

  function updateActiveSession(mutator: (session: LocalChatSession) => LocalChatSession) {
    setSessions((prev) =>
      prev.map((session) => {
        if (session.id !== activeSessionId) {
          return session;
        }
        return mutator(session);
      })
    );
  }

  function switchMode(mode: AppExperienceMode) {
    setSelectedMode(mode);
    setSelectedModeState(mode);
    setMenuOpen(false);
    setHistoryOpen(false);
    setProView("home");
    if (mode === "pro" && !businessProfile) {
      setBusinessModalOpen(true);
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
          Authorization: `Bearer ${token}`
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

  async function handleSend(payload: { message: string; attachments: ChatAttachment[] }) {
    if (!activeSession) {
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

    const existingMessages = activeSession.messages;
    updateActiveSession((session) => ({
      ...session,
      language,
      title: deriveTitle(messageText, session.vehicle, language, session.experienceMode),
      messages: [...session.messages, optimisticUser],
      updatedAt: now
    }));

    setLoadingReply(true);
    setError(null);

    try {
      const response = await sendChatRequest({
        message: messageText,
        attachments: payload.attachments,
        mode: currentChatExperienceMode === "pro" ? "shop" : "diy",
        recentMessages: buildHistory(existingMessages),
        vehicle: activeSession.vehicle,
        sessionId: activeSession.id
      });

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.summary,
        diagnostic: response as DiagnosticResponse,
        usedWebSearch: response.used_web_search,
        createdAt: new Date().toISOString()
      };

      setPlan(response.plan);
      setUsage(response.usage);
      storeUsageSnapshot(response.usage);

      updateActiveSession((session) => ({
        ...session,
        language,
        title: deriveTitle(messageText, session.vehicle, language, session.experienceMode),
        messages: [...session.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt
      }));
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
      updateActiveSession((session) => ({
        ...session,
        messages: session.messages.filter((message) => message.id !== optimisticUser.id)
      }));
    } finally {
      setLoadingReply(false);
    }
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
      setProView("home");
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

      setPlan(response.plan);
      setUsage(response.usage);
      storeUsageSnapshot(response.usage);

      const nextOutput = buildProWorkflowOutput({
        customerMessage: input.customerMessage,
        customerName: input.customerName,
        vehicleLabel: input.vehicleLabel,
        business: businessProfile,
        diagnostic: response,
        vehicle: lastVehicleContext,
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
      messages: [],
      updatedAt: new Date().toISOString()
    }));
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleClearAll() {
    const confirmed = window.confirm(language === "es" ? "Quieres borrar todo el historial?" : "Clear all history?");
    if (!confirmed) {
      return;
    }

    const preserved = sessions.filter((session) => session.experienceMode !== currentChatExperienceMode);
    const fresh = createLocalSession(language, currentChatExperienceMode);
    setSessions([fresh, ...preserved]);
    setActiveSessionId(fresh.id);
    setMenuOpen(false);
    setHistoryOpen(false);
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

  const usageLabel = getPlanUsageLabel(language, plan, usage);
  const isProUnlocked = plan === "pro";

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
    return <ModeSelectionScreen onSelect={switchMode} />;
  }

  return (
    <main className="wa-app-shell min-h-screen">
      {selectedMode === "diy" || (selectedMode === "pro" && proView === "chat") ? (
        <div className="mx-auto flex min-h-screen w-full max-w-[520px] bg-[var(--wa-bg-sidebar)] md:max-w-[640px] lg:max-w-[820px]">
          <div className="wa-phone-shell relative flex min-h-screen min-w-0 flex-1 flex-col shadow-[var(--wa-shadow-md)]">
            <ChatPanel
              title={activeSession?.title || getDefaultSessionTitle(language, currentChatExperienceMode)}
              language={language}
              isDarkMode={isDarkMode}
              messages={displayedMessages}
              loading={loadingReply}
              disabled={!installReady}
              plan={plan}
              usageLabel={usageLabel}
              onSend={handleSend}
              onNewThread={handleNewThread}
              onOpenHistory={() => setHistoryOpen(true)}
              onOpenIntake={() => setVehicleModalOpen(true)}
              onRefresh={handleRefresh}
              onToggleLanguage={handleToggleLanguage}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onOpenPlans={() => setPricingOpen(true)}
              onLockedFeature={handleLockedFeature}
              onOpenMenu={() => setMenuOpen(true)}
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

      {selectedMode === "pro" && proView === "home" && businessProfile ? (
        <ProHome
          business={businessProfile}
          proEnabled={isProUnlocked}
          onSelect={(view) => setProView(view)}
          onEditBusiness={() => setBusinessModalOpen(true)}
          onOpenPlans={() => setPricingOpen(true)}
          onSwitchMode={() => switchMode("diy")}
        />
      ) : null}

      {selectedMode === "pro" && !businessProfile ? (
        <section className="flex min-h-screen flex-col items-center justify-center bg-[var(--wa-bg-app)] px-4">
          <div className="w-full max-w-[520px] rounded-[28px] bg-[var(--wa-bg-sidebar)] p-6 shadow-[var(--wa-shadow-md)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--mech-orange)]">Para los Pros</p>
            <h1 className="mt-3 text-2xl font-semibold text-[var(--wa-text-primary)]">Configura tu negocio primero</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--wa-text-secondary)]">
              Antes de abrir el flujo Pro, guarda el nombre del negocio, WhatsApp, tipo de taller, moneda y link de pago.
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
          onBack={() => setProView("home")}
          onSubmit={handleCustomerMessageSubmit}
        />
      ) : null}

      {selectedMode === "pro" && proView === "quote" && businessProfile ? (
        <DocumentWorkspace
          title="Cotizacion"
          business={businessProfile}
          initialDraft={createQuoteDocumentDraft(businessProfile, workflowOutput)}
          onBack={() => setProView("home")}
        />
      ) : null}

      {selectedMode === "pro" && proView === "invoice" && businessProfile ? (
        <DocumentWorkspace
          title="Factura"
          business={businessProfile}
          initialDraft={createInvoiceDocumentDraft(businessProfile, workflowOutput)}
          onBack={() => setProView("home")}
        />
      ) : null}

      {selectedMode === "pro" && proView === "brief" && businessProfile ? (
        <DocumentWorkspace
          title="Brief interno"
          business={businessProfile}
          initialDraft={createBriefDocumentDraft(workflowOutput)}
          showAmount={false}
          onBack={() => setProView("home")}
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
                {language === "es" ? "Nuevo chat" : "New chat"}
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-[24px] border border-[var(--wa-divider)] bg-[var(--wa-bg-app)]">
              <SessionList
                sessions={visibleSessions.map((session) => ({
                  id: session.id,
                  title: session.title,
                  language: session.language,
                  mode: session.experienceMode === "pro" ? "shop" : "diy",
                  updatedAt: session.updatedAt
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
                {language === "es" ? "Nuevo chat" : "New chat"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setVehicleModalOpen(true)}>
                {language === "es" ? "Vehiculo" : "Vehicle"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => switchMode(selectedMode === "diy" ? "pro" : "diy")}>
                {selectedMode === "diy" ? "Para los Pros" : "DIY"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPricingOpen(true)}>
                {language === "es" ? "Planes" : "Plans"}
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
    </main>
  );
}
