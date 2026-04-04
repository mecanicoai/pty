"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import type { UiMessage } from "@/components/chat/types";
import { clearStoredInstallSession, ensureInstallToken, registerNativeInstallBridge } from "@/lib/chat/install-auth";
import { VehicleIntakeDrawer } from "@/components/intake/vehicle-intake-drawer";
import { createLocalSession, loadLocalSessions, saveLocalSessions, type LocalChatSession } from "@/lib/chat/local-store";
import { SessionList } from "@/components/sidebar/session-list";
import { Button } from "@/components/ui/button";
import type { ApiErrorResponse, ChatHistoryItem, ChatRequestPayload, ChatResponse } from "@/types/api";
import type { AppLanguage, ChatAttachment, DiagnosticResponse, VehicleContext } from "@/types/chat";

const PREF_KEYS = {
  darkMode: "mecanico-ui-dark",
  language: "mecanico-ui-language",
  activeSessionId: "mecanico-active-session-id"
} as const;

function getDefaultSessionTitle(language: AppLanguage) {
  return language === "es" ? "Nuevo chat" : "New chat";
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
    };
    error.status = response.status;
    error.code = typeof data.code === "string" ? data.code : undefined;
    error.requestId = typeof data.requestId === "string" ? data.requestId : undefined;
    throw error;
  }
  return data as T;
}

function deriveTitle(message: string, vehicle: VehicleContext | null) {
  if (vehicle?.year || vehicle?.make || vehicle?.model) {
    return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Nuevo chat";
  }

  const clean = message.replace(/\s+/g, " ").trim();
  return clean.slice(0, 48) || "Nuevo chat";
}

function buildHistory(messages: UiMessage[]): ChatHistoryItem[] {
  return messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.diagnostic?.summary || message.text,
    createdAt: message.createdAt,
    usedWebSearch: message.usedWebSearch
  }));
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [installLoading, setInstallLoading] = useState(true);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  );

  const displayedMessages = useMemo<UiMessage[]>(() => {
    if (activeSession?.messages.length) {
      return activeSession.messages;
    }

    return [
      {
        id: "welcome-message",
        role: "assistant",
        text:
          language === "es"
            ? "Órale jefe, soy Mecánico AI. Dime el año, la marca, el modelo y la falla detallada del vehículo."
            : "Hey boss, I am Mecanico AI. Tell me the year, make, model, and the detailed issue.",
        createdAt: ""
      }
    ];
  }, [activeSession?.messages, language]);

  const quickReplies = useMemo(
    () =>
      language === "es"
        ? ["Subir foto del problema", "Diagnosticar ruido extraño", "Revisar batería", "Código de error OBD"]
        : ["Upload problem photo", "Diagnose strange noise", "Check battery", "OBD error code"],
    [language]
  );

  useEffect(() => {
    const savedDark = localStorage.getItem(PREF_KEYS.darkMode);
    const savedLanguage = localStorage.getItem(PREF_KEYS.language);
    const savedActiveSessionId = localStorage.getItem(PREF_KEYS.activeSessionId);
    const localSessions = loadLocalSessions();

    if (savedDark === "true") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    }

    const nextLanguage = savedLanguage === "en" ? "en" : "es";
    setLanguage(nextLanguage);

    if (localSessions.length) {
      setSessions(localSessions);
      setActiveSessionId(savedActiveSessionId && localSessions.some((item) => item.id === savedActiveSessionId) ? savedActiveSessionId : localSessions[0].id);
    } else {
      const first = createLocalSession(nextLanguage);
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
    let cancelled = false;
    registerNativeInstallBridge();

    async function bootstrapInstallSession() {
      try {
        await ensureInstallToken();
        if (!cancelled) {
          setInstallReady(true);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "No se pudo iniciar la sesión del dispositivo.");
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
      }
    };

    window.addEventListener("mecanico-install-token-ready", handleTokenReady);

    return () => {
      cancelled = true;
      window.removeEventListener("mecanico-install-token-ready", handleTokenReady);
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

  async function handleRefresh() {
    setError(null);
  }

  async function handleSend(payload: { message: string; attachments: ChatAttachment[] }) {
    if (!activeSession) {
      return;
    }

    const messageText =
      language === "es" && payload.message === "Subir foto del problema"
        ? "Aquí está la foto del problema."
        : payload.message;

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
      title: deriveTitle(messageText, session.vehicle),
      messages: [...session.messages, optimisticUser],
      updatedAt: now
    }));

    setLoadingReply(true);
    setError(null);

    const requestBody: ChatRequestPayload = {
      sessionId: activeSession.id,
      message: messageText,
      vehicle: activeSession.vehicle,
      language,
      mode: "diagnostic",
      attachments: payload.attachments,
      recentMessages: buildHistory(existingMessages)
    };

    try {
      const sendChatRequest = async (token: string) =>
        requestJson<ChatResponse>("/api/chat", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(requestBody)
        });

      let token = await ensureInstallToken();
      let response: ChatResponse;

      try {
        response = await sendChatRequest(token);
      } catch (err) {
        const status = (err as { status?: number } | undefined)?.status;
        if (status !== 401) {
          throw err;
        }

        clearStoredInstallSession();
        token = await ensureInstallToken();
        response = await sendChatRequest(token);
      }

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.summary,
        diagnostic: response as DiagnosticResponse,
        usedWebSearch: response.used_web_search,
        createdAt: new Date().toISOString()
      };

      updateActiveSession((session) => ({
        ...session,
        language,
        title: deriveTitle(messageText, session.vehicle),
        messages: [...session.messages, assistantMessage],
        updatedAt: assistantMessage.createdAt
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
      updateActiveSession((session) => ({
        ...session,
        messages: session.messages.filter((message) => message.id !== optimisticUser.id)
      }));
    } finally {
      setLoadingReply(false);
    }
  }

  async function handleNewThread() {
    const session = createLocalSession(language);
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleSaveVehicle(nextVehicle: VehicleContext) {
    updateActiveSession((session) => ({
      ...session,
      vehicle: nextVehicle,
      title: deriveTitle(session.title, nextVehicle),
      updatedAt: new Date().toISOString()
    }));
  }

  async function handleClearCurrent() {
    if (!activeSession) {
      return;
    }

    const confirmed = window.confirm(language === "es" ? "¿Quieres borrar el chat actual?" : "Clear current chat?");
    if (!confirmed) {
      return;
    }

    updateActiveSession((session) => ({
      ...session,
      title: getDefaultSessionTitle(language),
      messages: [],
      updatedAt: new Date().toISOString()
    }));
    setMenuOpen(false);
    setHistoryOpen(false);
  }

  async function handleClearAll() {
    const confirmed = window.confirm(language === "es" ? "¿Quieres borrar todo el historial?" : "Clear all history?");
    if (!confirmed) {
      return;
    }

    const fresh = createLocalSession(language);
    setSessions([fresh]);
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

  return (
    <main className="wa-app-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] bg-[var(--wa-bg-sidebar)] md:max-w-[640px] lg:max-w-[820px]">
        <div className="wa-phone-shell relative flex min-h-screen min-w-0 flex-1 flex-col shadow-[var(--wa-shadow-md)]">
          {loadingInit ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--wa-text-secondary)]">
              {language === "es" ? "Cargando sesión..." : "Loading session..."}
            </div>
          ) : (
            <ChatPanel
              title={activeSession?.title || "Mecanico AI"}
              language={language}
              isDarkMode={isDarkMode}
              messages={displayedMessages}
              loading={loadingReply}
              disabled={!installReady}
              quickReplies={quickReplies}
              onSend={handleSend}
              onNewThread={handleNewThread}
              onOpenHistory={() => setHistoryOpen(true)}
              onOpenIntake={() => setVehicleModalOpen(true)}
              onRefresh={handleRefresh}
              onToggleLanguage={handleToggleLanguage}
              onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
              onOpenMenu={() => setMenuOpen(true)}
            />
          )}

          {error ? <div className="mx-4 mb-2 rounded-3xl bg-red-600 px-4 py-2 text-sm text-white shadow-lg">{error}</div> : null}
          {installLoading ? (
            <div className="mx-4 mb-2 rounded-3xl bg-[var(--wa-control-bg)] px-4 py-2 text-sm text-[var(--wa-text-secondary)] shadow-sm">
              {language === "es" ? "Protegiendo la sesión del dispositivo..." : "Securing device session..."}
            </div>
          ) : null}
        </div>
      </div>

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
                sessions={sessions.map((session) => ({
                  id: session.id,
                  title: session.title,
                  language: session.language,
                  mode: "diagnostic",
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
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" onClick={() => void handleNewThread()}>
                {language === "es" ? "Nuevo chat" : "New chat"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setVehicleModalOpen(true)}>
                {language === "es" ? "Vehículo" : "Vehicle"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setMenuOpen(false);
                  setHistoryOpen(true);
                }}
              >
                {language === "es" ? "Historial" : "History"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void handleRefresh()}>
                {language === "es" ? "Refrescar" : "Refresh"}
              </Button>
              <Button type="button" variant="secondary" onClick={handleToggleLanguage}>
                {language === "es" ? "English" : "Español"}
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

      <VehicleIntakeDrawer
        open={vehicleModalOpen}
        initialVehicle={activeSession?.vehicle ?? null}
        onClose={() => setVehicleModalOpen(false)}
        onSave={handleSaveVehicle}
      />
    </main>
  );
}
